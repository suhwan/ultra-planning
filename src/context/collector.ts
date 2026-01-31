/**
 * Context Collector
 *
 * Collects context from project files for AI agent consumption.
 * Gathers PROJECT.md, ROADMAP.md, phase plans, and task details.
 *
 * Part of the Context Architect pattern - provides context, not execution.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// ============================================================================
// Types
// ============================================================================

/**
 * Project-level context from PROJECT.md and ROADMAP.md
 */
export interface ProjectContext {
  projectMd?: string;
  roadmapMd?: string;
  requirementsMd?: string;
  planningDir: string;
  exists: boolean;
}

/**
 * Phase-level context from phase research and plans
 */
export interface PhaseContext {
  phaseNumber: number;
  phaseName: string;
  researchMd?: string;
  plans: string[];
  summaries: string[];
  phaseDir: string;
  exists: boolean;
}

/**
 * Task-level context from specific PLAN.md
 */
export interface TaskContext {
  planId: string;
  taskId: string;
  planMd?: string;
  summaryMd?: string;
  planPath: string;
  exists: boolean;
}

/**
 * Combined context for injection
 */
export interface CollectedContext {
  project?: ProjectContext;
  phase?: PhaseContext;
  task?: TaskContext;
  timestamp: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PLANNING_DIR = '.planning';

// ============================================================================
// Project Context Collection
// ============================================================================

/**
 * Collect project-level context
 *
 * @param planningDir - Path to .planning directory (default: .planning)
 * @returns ProjectContext with available files
 *
 * @example
 * ```typescript
 * const ctx = collectProjectContext();
 * if (ctx.projectMd) {
 *   // Use project context
 * }
 * ```
 */
export function collectProjectContext(
  planningDir: string = DEFAULT_PLANNING_DIR
): ProjectContext {
  const result: ProjectContext = {
    planningDir,
    exists: existsSync(planningDir),
  };

  if (!result.exists) {
    return result;
  }

  // Collect PROJECT.md
  const projectPath = join(planningDir, 'PROJECT.md');
  if (existsSync(projectPath)) {
    result.projectMd = readFileSync(projectPath, 'utf-8');
  }

  // Collect ROADMAP.md (try v2 first, then v1)
  const roadmapV2Path = join(planningDir, 'ROADMAP-v2.md');
  const roadmapPath = join(planningDir, 'ROADMAP.md');
  if (existsSync(roadmapV2Path)) {
    result.roadmapMd = readFileSync(roadmapV2Path, 'utf-8');
  } else if (existsSync(roadmapPath)) {
    result.roadmapMd = readFileSync(roadmapPath, 'utf-8');
  }

  // Collect REQUIREMENTS.md
  const reqPath = join(planningDir, 'REQUIREMENTS.md');
  if (existsSync(reqPath)) {
    result.requirementsMd = readFileSync(reqPath, 'utf-8');
  }

  return result;
}

// ============================================================================
// Phase Context Collection
// ============================================================================

/**
 * Collect phase-level context
 *
 * @param phaseNumber - Phase number (e.g., 1, 2, 3)
 * @param planningDir - Path to .planning directory
 * @returns PhaseContext with research and plan files
 *
 * @example
 * ```typescript
 * const ctx = collectPhaseContext(3);
 * console.log(ctx.phaseName); // "03-gsd-integration"
 * ```
 */
export function collectPhaseContext(
  phaseNumber: number,
  planningDir: string = DEFAULT_PLANNING_DIR
): PhaseContext {
  const phaseDir = findPhaseDir(phaseNumber, planningDir);
  const phaseName = phaseDir ? phaseDir.split('/').pop() || '' : '';

  const result: PhaseContext = {
    phaseNumber,
    phaseName,
    plans: [],
    summaries: [],
    phaseDir: phaseDir || '',
    exists: !!phaseDir,
  };

  if (!phaseDir) {
    return result;
  }

  // Collect RESEARCH.md
  const paddedNum = String(phaseNumber).padStart(2, '0');
  const researchPath = join(phaseDir, `${paddedNum}-RESEARCH.md`);
  if (existsSync(researchPath)) {
    result.researchMd = readFileSync(researchPath, 'utf-8');
  }

  // Collect all PLAN.md files
  for (let i = 1; i <= 20; i++) {
    const planNum = String(i).padStart(2, '0');
    const planPath = join(phaseDir, `${paddedNum}-${planNum}-PLAN.md`);
    if (existsSync(planPath)) {
      result.plans.push(readFileSync(planPath, 'utf-8'));
    }
  }

  // Collect all SUMMARY.md files
  for (let i = 1; i <= 20; i++) {
    const planNum = String(i).padStart(2, '0');
    const summaryPath = join(phaseDir, `${paddedNum}-${planNum}-SUMMARY.md`);
    if (existsSync(summaryPath)) {
      result.summaries.push(readFileSync(summaryPath, 'utf-8'));
    }
  }

  return result;
}

/**
 * Find phase directory by number
 */
function findPhaseDir(
  phaseNumber: number,
  planningDir: string
): string | null {
  const paddedNum = String(phaseNumber).padStart(2, '0');
  const phasesDir = join(planningDir, 'phases');

  if (!existsSync(phasesDir)) {
    return null;
  }

  // Read phases directory
  const { readdirSync } = require('fs');
  const dirs = readdirSync(phasesDir, { withFileTypes: true })
    .filter((d: { isDirectory: () => boolean }) => d.isDirectory())
    .map((d: { name: string }) => d.name);

  // Find matching phase
  const match = dirs.find((d: string) => d.startsWith(paddedNum));
  return match ? join(phasesDir, match) : null;
}

// ============================================================================
// Task Context Collection
// ============================================================================

/**
 * Collect task-level context from PLAN.md
 *
 * @param planId - Plan identifier (e.g., "03-01" or "3-1")
 * @param planningDir - Path to .planning directory
 * @returns TaskContext with plan and summary files
 *
 * @example
 * ```typescript
 * const ctx = collectTaskContext('03-02');
 * if (ctx.planMd) {
 *   // Use task plan context
 * }
 * ```
 */
export function collectTaskContext(
  planId: string,
  planningDir: string = DEFAULT_PLANNING_DIR
): TaskContext {
  // Parse plan ID (e.g., "03-02" → phase 3, plan 2)
  const [phaseStr, planStr] = planId.split('-');
  const phaseNum = parseInt(phaseStr, 10);
  const planNum = parseInt(planStr, 10);

  const paddedPhase = String(phaseNum).padStart(2, '0');
  const paddedPlan = String(planNum).padStart(2, '0');
  const planFileName = `${paddedPhase}-${paddedPlan}-PLAN.md`;

  // Find phase directory
  const phaseDir = findPhaseDir(phaseNum, planningDir);
  const planPath = phaseDir ? join(phaseDir, planFileName) : '';

  const result: TaskContext = {
    planId: `${paddedPhase}-${paddedPlan}`,
    taskId: planId,
    planPath,
    exists: !!planPath && existsSync(planPath),
  };

  if (!result.exists) {
    return result;
  }

  // Collect PLAN.md
  if (existsSync(planPath)) {
    result.planMd = readFileSync(planPath, 'utf-8');
  }

  // Collect SUMMARY.md if exists
  const summaryPath = planPath.replace('-PLAN.md', '-SUMMARY.md');
  if (existsSync(summaryPath)) {
    result.summaryMd = readFileSync(summaryPath, 'utf-8');
  }

  return result;
}

// ============================================================================
// Combined Collection
// ============================================================================

/**
 * Collect all relevant context for a task
 *
 * @param options - Collection options
 * @returns Combined context from project, phase, and task
 *
 * @example
 * ```typescript
 * const ctx = collectContext({
 *   planId: '03-02',
 *   includeProject: true,
 *   includePhase: true,
 * });
 * ```
 */
export function collectContext(options: {
  planId?: string;
  phaseNumber?: number;
  includeProject?: boolean;
  includePhase?: boolean;
  planningDir?: string;
}): CollectedContext {
  const {
    planId,
    phaseNumber,
    includeProject = true,
    includePhase = true,
    planningDir = DEFAULT_PLANNING_DIR,
  } = options;

  const result: CollectedContext = {
    timestamp: new Date().toISOString(),
  };

  // Collect project context
  if (includeProject) {
    result.project = collectProjectContext(planningDir);
  }

  // Determine phase number from planId if not provided
  let phase = phaseNumber;
  if (!phase && planId) {
    const [phaseStr] = planId.split('-');
    phase = parseInt(phaseStr, 10);
  }

  // Collect phase context
  if (includePhase && phase) {
    result.phase = collectPhaseContext(phase, planningDir);
  }

  // Collect task context
  if (planId) {
    result.task = collectTaskContext(planId, planningDir);
  }

  return result;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Estimate context size in tokens (chars / 4)
 */
export function estimateContextTokens(ctx: CollectedContext): number {
  let chars = 0;

  if (ctx.project?.projectMd) chars += ctx.project.projectMd.length;
  if (ctx.project?.roadmapMd) chars += ctx.project.roadmapMd.length;
  if (ctx.project?.requirementsMd) chars += ctx.project.requirementsMd.length;

  if (ctx.phase?.researchMd) chars += ctx.phase.researchMd.length;
  ctx.phase?.plans.forEach((p) => (chars += p.length));
  ctx.phase?.summaries.forEach((s) => (chars += s.length));

  if (ctx.task?.planMd) chars += ctx.task.planMd.length;
  if (ctx.task?.summaryMd) chars += ctx.task.summaryMd.length;

  return Math.ceil(chars / 4);
}

/**
 * Format context for display (summary only)
 */
export function formatContextSummary(ctx: CollectedContext): string {
  const lines: string[] = ['# Collected Context'];

  if (ctx.project?.exists) {
    lines.push('');
    lines.push('## Project');
    lines.push(`- PROJECT.md: ${ctx.project.projectMd ? 'Yes' : 'No'}`);
    lines.push(`- ROADMAP.md: ${ctx.project.roadmapMd ? 'Yes' : 'No'}`);
    lines.push(`- REQUIREMENTS.md: ${ctx.project.requirementsMd ? 'Yes' : 'No'}`);
  }

  if (ctx.phase?.exists) {
    lines.push('');
    lines.push(`## Phase ${ctx.phase.phaseNumber}: ${ctx.phase.phaseName}`);
    lines.push(`- RESEARCH.md: ${ctx.phase.researchMd ? 'Yes' : 'No'}`);
    lines.push(`- Plans: ${ctx.phase.plans.length}`);
    lines.push(`- Summaries: ${ctx.phase.summaries.length}`);
  }

  if (ctx.task?.exists) {
    lines.push('');
    lines.push(`## Task ${ctx.task.planId}`);
    lines.push(`- PLAN.md: ${ctx.task.planMd ? 'Yes' : 'No'}`);
    lines.push(`- SUMMARY.md: ${ctx.task.summaryMd ? 'Yes' : 'No'}`);
  }

  lines.push('');
  lines.push(`## Stats`);
  lines.push(`- Estimated Tokens: ${estimateContextTokens(ctx)}`);
  lines.push(`- Collected: ${ctx.timestamp}`);

  return lines.join('\n');
}
