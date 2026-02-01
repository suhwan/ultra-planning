/**
 * EcoMode State Management
 *
 * File-based state persistence for token-efficient parallel execution.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { ComplexityLevel, ModelTier } from '../../complexity/types.js';
import { estimateComplexity, getModelForComplexity } from '../../complexity/estimator.js';
import type {
  EcoModeState,
  EcoModeTask,
  EcoModeWorker,
  EcoModeConfig,
  EcoModeStats,
} from './types.js';
import { MODEL_CONCURRENT_LIMITS, DEFAULT_ECOMODE_CONFIG } from './types.js';

const STATE_DIR = '.omc/state';
const STATE_FILE = 'ecomode-state.json';

function getStatePath(): string {
  return join(process.cwd(), STATE_DIR, STATE_FILE);
}

function ensureStateDir(): void {
  const dir = join(process.cwd(), STATE_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function loadState(): EcoModeState | null {
  const path = getStatePath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function saveState(state: EcoModeState): void {
  ensureStateDir();
  writeFileSync(getStatePath(), JSON.stringify(state, null, 2));
}

function generateSessionId(): string {
  return `ecomode-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateWorkerId(): string {
  return `eco-worker-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function calculateStats(tasks: EcoModeTask[], workers: EcoModeWorker[]): EcoModeStats {
  const byModel: Record<ModelTier, { total: number; completed: number; running: number; tokensUsed: number }> = {
    haiku: { total: 0, completed: 0, running: 0, tokensUsed: 0 },
    sonnet: { total: 0, completed: 0, running: 0, tokensUsed: 0 },
    opus: { total: 0, completed: 0, running: 0, tokensUsed: 0 },
  };

  let totalTokensUsed = 0;

  for (const task of tasks) {
    byModel[task.recommendedModel].total++;
    if (task.status === 'completed') {
      byModel[task.recommendedModel].completed++;
      if (task.result?.tokensUsed) {
        byModel[task.recommendedModel].tokensUsed += task.result.tokensUsed;
        totalTokensUsed += task.result.tokensUsed;
      }
    } else if (task.status === 'running') {
      byModel[task.recommendedModel].running++;
    }
  }

  // Estimate tokens saved by not using opus for everything
  // Assume opus would use ~3x haiku tokens and ~1.5x sonnet tokens
  const opusEquivalent =
    byModel.haiku.tokensUsed * 3 +
    byModel.sonnet.tokensUsed * 1.5 +
    byModel.opus.tokensUsed;
  const estimatedTokensSaved = Math.round(opusEquivalent - totalTokensUsed);

  return {
    totalTasks: tasks.length,
    completedTasks: tasks.filter(t => t.status === 'completed').length,
    failedTasks: tasks.filter(t => t.status === 'failed').length,
    runningTasks: tasks.filter(t => t.status === 'running').length,
    pendingTasks: tasks.filter(t => t.status === 'pending').length,
    byModel,
    totalTokensUsed,
    estimatedTokensSaved,
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Analyze task complexity and get model recommendation
 */
export function analyzeTaskComplexity(
  taskDescription: string,
  files?: string[]
): {
  complexity: ComplexityLevel;
  recommendedModel: ModelTier;
  confidence: number;
  factors: string[];
} {
  const result = estimateComplexity({
    taskDescription,
    files,
  });

  return {
    complexity: result.complexity.level,
    recommendedModel: result.recommendedModel,
    confidence: result.confidence,
    factors: result.factors,
  };
}

/**
 * Get model recommendation with explanation
 */
export function getEcoModelRecommendation(
  complexity: ComplexityLevel
): {
  model: ModelTier;
  maxConcurrent: number;
  rationale: string;
} {
  const model = getModelForComplexity(complexity);
  const maxConcurrent = MODEL_CONCURRENT_LIMITS[model];

  const rationale = {
    haiku: 'Simple task - using haiku for speed and cost efficiency',
    sonnet: 'Standard complexity - using sonnet for balanced performance',
    opus: 'Complex task - using opus for deep reasoning capability',
  }[model];

  return { model, maxConcurrent, rationale };
}

/**
 * Initialize EcoMode session
 */
export function initEcoModeSession(
  tasks: Array<{ id: string; name: string; action: string; files: string[] }>,
  config?: Partial<EcoModeConfig>
): EcoModeState | null {
  const existing = loadState();
  if (existing && existing.status === 'running') {
    return null;
  }

  const fullConfig: EcoModeConfig = {
    maxConcurrent: config?.maxConcurrent ?? { ...MODEL_CONCURRENT_LIMITS },
    planPath: config?.planPath,
  };

  // Analyze each task and assign complexity/model
  const ecoTasks: EcoModeTask[] = tasks.map(t => {
    const analysis = analyzeTaskComplexity(`${t.name}: ${t.action}`, t.files);
    return {
      id: t.id,
      name: t.name,
      action: t.action,
      files: t.files,
      complexity: analysis.complexity,
      recommendedModel: analysis.recommendedModel,
      status: 'pending',
    };
  });

  const state: EcoModeState = {
    sessionId: generateSessionId(),
    planPath: config?.planPath,
    config: fullConfig,
    tasks: ecoTasks,
    workers: [],
    status: 'running',
    startedAt: new Date().toISOString(),
    stats: calculateStats(ecoTasks, []),
  };

  saveState(state);
  return state;
}

/**
 * Track token usage for a completed task
 */
export function trackEcoUsage(
  taskId: string,
  tokensUsed: number
): boolean {
  const state = loadState();
  if (!state) return false;

  const task = state.tasks.find(t => t.id === taskId);
  if (task && task.result) {
    task.result.tokensUsed = tokensUsed;
    state.stats = calculateStats(state.tasks, state.workers);
    saveState(state);
    return true;
  }

  return false;
}

/**
 * Get available tasks grouped by model tier, respecting concurrent limits
 */
export function getEcoAvailableTasks(): {
  haiku: EcoModeTask[];
  sonnet: EcoModeTask[];
  opus: EcoModeTask[];
} | null {
  const state = loadState();
  if (!state) return null;

  const running = {
    haiku: state.tasks.filter(t => t.status === 'running' && t.recommendedModel === 'haiku').length,
    sonnet: state.tasks.filter(t => t.status === 'running' && t.recommendedModel === 'sonnet').length,
    opus: state.tasks.filter(t => t.status === 'running' && t.recommendedModel === 'opus').length,
  };

  const available = {
    haiku: [] as EcoModeTask[],
    sonnet: [] as EcoModeTask[],
    opus: [] as EcoModeTask[],
  };

  for (const task of state.tasks) {
    if (task.status !== 'pending') continue;

    const model = task.recommendedModel;
    const limit = state.config.maxConcurrent[model];
    const canSpawn = running[model] < limit;

    if (canSpawn && available[model].length < (limit - running[model])) {
      available[model].push(task);
    }
  }

  return available;
}

/**
 * Spawn an eco worker for a task
 */
export function spawnEcoWorker(taskId: string): EcoModeWorker | null {
  const state = loadState();
  if (!state) return null;

  const task = state.tasks.find(t => t.id === taskId);
  if (!task || task.status !== 'pending') return null;

  // Check concurrent limit
  const model = task.recommendedModel;
  const running = state.workers.filter(w => w.status === 'running' && w.model === model).length;
  if (running >= state.config.maxConcurrent[model]) return null;

  const worker: EcoModeWorker = {
    id: generateWorkerId(),
    taskId,
    model,
    status: 'running',
    startedAt: new Date().toISOString(),
  };

  task.status = 'running';
  task.workerId = worker.id;
  state.workers.push(worker);
  state.stats = calculateStats(state.tasks, state.workers);

  saveState(state);
  return worker;
}

/**
 * Complete an eco worker
 */
export function completeEcoWorker(
  workerId: string,
  result?: { output?: string; tokensUsed?: number }
): boolean {
  const state = loadState();
  if (!state) return false;

  const worker = state.workers.find(w => w.id === workerId);
  if (!worker || worker.status !== 'running') return false;

  const task = state.tasks.find(t => t.workerId === workerId);
  if (task) {
    task.status = 'completed';
    task.result = {
      success: true,
      output: result?.output,
      tokensUsed: result?.tokensUsed,
    };
  }

  worker.status = 'completed';
  worker.completedAt = new Date().toISOString();
  worker.tokensUsed = result?.tokensUsed;

  // Check if all done
  const allDone = state.tasks.every(t => t.status === 'completed' || t.status === 'failed');
  if (allDone) {
    state.status = 'completed';
    state.completedAt = new Date().toISOString();
  }

  state.stats = calculateStats(state.tasks, state.workers);
  saveState(state);
  return true;
}

/**
 * Get eco stats
 */
export function getEcoStats(): EcoModeStats | null {
  const state = loadState();
  if (!state) return null;
  return state.stats;
}

/**
 * Get eco state
 */
export function getEcoState(): EcoModeState | null {
  return loadState();
}

/**
 * End eco session
 */
export function endEcoSession(): boolean {
  const state = loadState();
  if (!state) return false;

  state.status = 'completed';
  state.completedAt = new Date().toISOString();
  saveState(state);
  return true;
}
