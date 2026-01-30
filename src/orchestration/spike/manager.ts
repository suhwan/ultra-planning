/**
 * Spike Manager
 *
 * Manages spike tasks for high-uncertainty work items.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { randomUUID } from 'crypto';

import {
  UncertaintyLevel,
  UncertaintyCategory,
  SpikeTask,
  SpikeStatus,
  SpikeResult,
  SpikeState,
  SpikeStats,
  SpikeConfig,
  PlanModificationSuggestion,
  TaskUncertaintyMetadata,
  DEFAULT_SPIKE_CONFIG,
  SPIKE_THRESHOLD,
} from './types.js';

import { flagPlanForRevision } from '../revision/manager.js';

// ============================================================================
// State File Management
// ============================================================================

const SPIKE_STATE_DIR = '.ultraplan/state/spikes';

/**
 * Get spike state path for a plan
 */
function getSpikeStatePath(planPath: string, projectRoot: string = process.cwd()): string {
  const planName = basename(planPath, '.md');
  return join(projectRoot, SPIKE_STATE_DIR, `${planName}.json`);
}

/**
 * Load spike state
 */
export function loadSpikeState(
  planPath: string,
  projectRoot: string = process.cwd()
): SpikeState | null {
  const statePath = getSpikeStatePath(planPath, projectRoot);

  if (!existsSync(statePath)) {
    return null;
  }

  try {
    const data = readFileSync(statePath, 'utf-8');
    return JSON.parse(data) as SpikeState;
  } catch {
    return null;
  }
}

/**
 * Save spike state
 */
function saveSpikeState(state: SpikeState, projectRoot: string = process.cwd()): void {
  const statePath = getSpikeStatePath(state.planPath, projectRoot);
  const dir = dirname(statePath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  state.lastUpdated = new Date().toISOString();
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

/**
 * Initialize empty spike state
 */
function initSpikeState(planPath: string): SpikeState {
  return {
    planPath,
    spikes: [],
    stats: {
      total: 0,
      byStatus: {
        pending: 0,
        in_progress: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
      },
      modificationsTriggered: 0,
    },
    lastUpdated: new Date().toISOString(),
  };
}

// ============================================================================
// Uncertainty Assessment
// ============================================================================

/**
 * Check if a task needs a spike based on uncertainty
 */
export function needsSpike(
  uncertainty: UncertaintyLevel,
  config: SpikeConfig = DEFAULT_SPIKE_CONFIG
): boolean {
  return uncertainty >= config.autoSpikeThreshold;
}

/**
 * Assess task uncertainty based on description and context
 */
export function assessUncertainty(
  taskDescription: string,
  context?: {
    isNewTechnology?: boolean;
    hasExternalDependency?: boolean;
    isPerformanceCritical?: boolean;
    hasUnknownScope?: boolean;
    requiresResearch?: boolean;
  }
): TaskUncertaintyMetadata {
  let level: UncertaintyLevel = 0;
  let category: UncertaintyCategory = 'technical';
  const reasons: string[] = [];

  // Keyword-based assessment
  const highUncertaintyKeywords = [
    'investigate', 'research', 'explore', 'prototype', 'poc', 'proof of concept',
    'unknown', 'unclear', 'might', 'possibly', 'experiment', 'try',
  ];

  const mediumUncertaintyKeywords = [
    'integrate', 'migrate', 'refactor', 'optimize', 'performance',
    'third-party', 'external', 'api', 'complex',
  ];

  const descLower = taskDescription.toLowerCase();

  // Check keywords
  for (const keyword of highUncertaintyKeywords) {
    if (descLower.includes(keyword)) {
      level = Math.min(10, level + 3) as UncertaintyLevel;
      reasons.push(`Contains high-uncertainty keyword: "${keyword}"`);
    }
  }

  for (const keyword of mediumUncertaintyKeywords) {
    if (descLower.includes(keyword)) {
      level = Math.min(10, level + 2) as UncertaintyLevel;
      reasons.push(`Contains medium-uncertainty keyword: "${keyword}"`);
    }
  }

  // Context-based assessment
  if (context?.isNewTechnology) {
    level = Math.min(10, level + 3) as UncertaintyLevel;
    category = 'technical';
    reasons.push('New technology being used');
  }

  if (context?.hasExternalDependency) {
    level = Math.min(10, level + 2) as UncertaintyLevel;
    category = 'dependency';
    reasons.push('External dependency involved');
  }

  if (context?.isPerformanceCritical) {
    level = Math.min(10, level + 2) as UncertaintyLevel;
    category = 'performance';
    reasons.push('Performance-critical task');
  }

  if (context?.hasUnknownScope) {
    level = Math.min(10, level + 3) as UncertaintyLevel;
    category = 'scope';
    reasons.push('Scope is not fully defined');
  }

  if (context?.requiresResearch) {
    level = Math.min(10, level + 2) as UncertaintyLevel;
    category = 'technical';
    reasons.push('Research required');
  }

  return {
    uncertainty: level,
    category,
    reason: reasons.join('; '),
  };
}

// ============================================================================
// Spike Creation
// ============================================================================

/**
 * Create a spike task for a high-uncertainty task
 */
export function createSpike(
  planPath: string,
  originalTaskId: string,
  objective: string,
  questions: string[],
  options?: {
    category?: UncertaintyCategory;
    uncertaintyLevel?: UncertaintyLevel;
    timeBoxMinutes?: number;
    constraints?: string[];
  },
  config: SpikeConfig = DEFAULT_SPIKE_CONFIG,
  projectRoot: string = process.cwd()
): SpikeTask {
  let state = loadSpikeState(planPath, projectRoot);
  if (!state) {
    state = initSpikeState(planPath);
  }

  const spike: SpikeTask = {
    id: randomUUID(),
    originalTaskId,
    planPath,
    objective,
    timeBoxMinutes: options?.timeBoxMinutes ?? config.defaultTimeBoxMinutes,
    category: options?.category ?? 'technical',
    uncertaintyLevel: options?.uncertaintyLevel ?? SPIKE_THRESHOLD,
    questions,
    constraints: options?.constraints,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };

  state.spikes.push(spike);
  state.stats.total++;
  state.stats.byStatus.pending++;

  saveSpikeState(state, projectRoot);

  return spike;
}

/**
 * Auto-create spike if task uncertainty exceeds threshold
 */
export function autoCreateSpikeIfNeeded(
  planPath: string,
  taskId: string,
  taskDescription: string,
  uncertainty: TaskUncertaintyMetadata,
  config: SpikeConfig = DEFAULT_SPIKE_CONFIG,
  projectRoot: string = process.cwd()
): SpikeTask | null {
  if (!needsSpike(uncertainty.uncertainty, config)) {
    return null;
  }

  // Generate questions based on category
  const questions = generateSpikeQuestions(uncertainty.category || 'technical', taskDescription);

  return createSpike(
    planPath,
    taskId,
    `Investigate uncertainty before: ${taskDescription.slice(0, 100)}`,
    questions,
    {
      category: uncertainty.category,
      uncertaintyLevel: uncertainty.uncertainty,
    },
    config,
    projectRoot
  );
}

/**
 * Generate spike questions based on uncertainty category
 */
function generateSpikeQuestions(category: UncertaintyCategory, taskDescription: string): string[] {
  const baseQuestions: Record<UncertaintyCategory, string[]> = {
    technical: [
      'What is the most viable technical approach?',
      'What are the potential technical blockers?',
      'What proof-of-concept demonstrates feasibility?',
    ],
    integration: [
      'How will components communicate?',
      'What are the integration points?',
      'Are there any compatibility issues?',
    ],
    performance: [
      'What is the baseline performance?',
      'What optimizations are available?',
      'Can performance targets be met?',
    ],
    feasibility: [
      'Is the requested feature technically possible?',
      'What are the limiting constraints?',
      'What alternatives exist if not feasible?',
    ],
    dependency: [
      'How does the external dependency behave?',
      'What are the API constraints?',
      'What happens on failure?',
    ],
    api: [
      'What should the API contract look like?',
      'What are the expected inputs and outputs?',
      'How will versioning be handled?',
    ],
    data: [
      'What is the data structure?',
      'What transformations are needed?',
      'What are the data volume constraints?',
    ],
    scope: [
      'What is the full scope of this work?',
      'What sub-tasks are involved?',
      'What are the boundaries?',
    ],
  };

  return baseQuestions[category] || baseQuestions.technical;
}

// ============================================================================
// Spike Execution
// ============================================================================

/**
 * Start a spike (mark as in_progress)
 */
export function startSpike(
  planPath: string,
  spikeId: string,
  projectRoot: string = process.cwd()
): SpikeTask | null {
  const state = loadSpikeState(planPath, projectRoot);
  if (!state) return null;

  const spike = state.spikes.find(s => s.id === spikeId);
  if (!spike) return null;

  if (spike.status !== 'pending') {
    throw new Error(`Spike ${spikeId} is not pending (status: ${spike.status})`);
  }

  const oldStatus = spike.status;
  spike.status = 'in_progress';

  state.stats.byStatus[oldStatus]--;
  state.stats.byStatus.in_progress++;

  saveSpikeState(state, projectRoot);

  return spike;
}

/**
 * Complete a spike with results
 */
export function completeSpike(
  planPath: string,
  spikeId: string,
  result: Omit<SpikeResult, 'completedAt'>,
  config: SpikeConfig = DEFAULT_SPIKE_CONFIG,
  projectRoot: string = process.cwd()
): SpikeTask | null {
  const state = loadSpikeState(planPath, projectRoot);
  if (!state) return null;

  const spike = state.spikes.find(s => s.id === spikeId);
  if (!spike) return null;

  const oldStatus = spike.status;
  spike.status = result.success ? 'completed' : 'failed';
  spike.result = {
    ...result,
    completedAt: new Date().toISOString(),
  };

  state.stats.byStatus[oldStatus]--;
  state.stats.byStatus[spike.status]++;

  // Update success rate
  const completedSpikes = state.spikes.filter(s => s.status === 'completed');
  const proceedingSpikes = completedSpikes.filter(s => s.result?.proceedWithTask);
  state.stats.successRate = completedSpikes.length > 0
    ? proceedingSpikes.length / completedSpikes.length
    : undefined;

  // Update average time
  const spikesWithTime = state.spikes.filter(s => s.result?.timeSpentMinutes);
  if (spikesWithTime.length > 0) {
    const totalTime = spikesWithTime.reduce((sum, s) => sum + (s.result?.timeSpentMinutes || 0), 0);
    state.stats.avgTimeMinutes = totalTime / spikesWithTime.length;
  }

  // Trigger plan revision if modifications suggested
  if (config.autoTriggerRevision && result.planModifications && result.planModifications.length > 0) {
    state.stats.modificationsTriggered++;

    flagPlanForRevision(
      planPath,
      'spike_discovery',
      `Spike ${spikeId} suggests ${result.planModifications.length} plan modifications`,
      { affectedTasks: [spike.originalTaskId], source: `spike:${spikeId}` },
      projectRoot
    );
  }

  saveSpikeState(state, projectRoot);

  return spike;
}

/**
 * Skip a spike
 */
export function skipSpike(
  planPath: string,
  spikeId: string,
  reason: string,
  projectRoot: string = process.cwd()
): SpikeTask | null {
  const state = loadSpikeState(planPath, projectRoot);
  if (!state) return null;

  const spike = state.spikes.find(s => s.id === spikeId);
  if (!spike) return null;

  const oldStatus = spike.status;
  spike.status = 'skipped';
  spike.result = {
    success: false,
    findings: [`Skipped: ${reason}`],
    proceedWithTask: true,
    completedAt: new Date().toISOString(),
    timeSpentMinutes: 0,
  };

  state.stats.byStatus[oldStatus]--;
  state.stats.byStatus.skipped++;

  saveSpikeState(state, projectRoot);

  return spike;
}

// ============================================================================
// Spike Queries
// ============================================================================

/**
 * Get all spikes for a plan
 */
export function getSpikes(
  planPath: string,
  projectRoot: string = process.cwd()
): SpikeTask[] {
  const state = loadSpikeState(planPath, projectRoot);
  return state?.spikes || [];
}

/**
 * Get spike by ID
 */
export function getSpike(
  planPath: string,
  spikeId: string,
  projectRoot: string = process.cwd()
): SpikeTask | null {
  const spikes = getSpikes(planPath, projectRoot);
  return spikes.find(s => s.id === spikeId) || null;
}

/**
 * Get spikes by status
 */
export function getSpikesByStatus(
  planPath: string,
  status: SpikeStatus,
  projectRoot: string = process.cwd()
): SpikeTask[] {
  const spikes = getSpikes(planPath, projectRoot);
  return spikes.filter(s => s.status === status);
}

/**
 * Get pending spikes
 */
export function getPendingSpikes(
  planPath: string,
  projectRoot: string = process.cwd()
): SpikeTask[] {
  return getSpikesByStatus(planPath, 'pending', projectRoot);
}

/**
 * Get spike for a task
 */
export function getSpikeForTask(
  planPath: string,
  taskId: string,
  projectRoot: string = process.cwd()
): SpikeTask | null {
  const spikes = getSpikes(planPath, projectRoot);
  return spikes.find(s => s.originalTaskId === taskId) || null;
}

/**
 * Get spike statistics
 */
export function getSpikeStats(
  planPath: string,
  projectRoot: string = process.cwd()
): SpikeStats | null {
  const state = loadSpikeState(planPath, projectRoot);
  return state?.stats || null;
}

/**
 * Check if plan has pending spikes
 */
export function hasPendingSpikes(
  planPath: string,
  projectRoot: string = process.cwd()
): boolean {
  const pending = getPendingSpikes(planPath, projectRoot);
  return pending.length > 0;
}
