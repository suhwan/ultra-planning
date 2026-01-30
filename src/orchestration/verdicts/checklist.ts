/**
 * Checklist Evaluation Logic
 *
 * Implements the 80% pass threshold for agent verdicts.
 */

import {
  ArchitectChecklist,
  ArchitectVerdict,
  ArchitectVerdictType,
  CriticChecklist,
  CriticVerdict,
  CriticVerdictType,
  APPROVAL_THRESHOLD,
  ARCHITECT_CHECKLIST_ITEMS,
  CRITIC_CHECKLIST_ITEMS,
} from './types.js';

// ============================================================================
// Pass Percentage Calculation
// ============================================================================

/**
 * Calculate pass percentage from a checklist
 */
export function calculatePassPercentage(
  checklist: Record<string, boolean>,
  items: string[]
): number {
  const passed = items.filter((item) => checklist[item] === true).length;
  return Math.round((passed / items.length) * 100);
}

/**
 * Calculate Architect checklist pass percentage
 */
export function calculateArchitectPassPercentage(
  checklist: ArchitectChecklist
): number {
  // Convert to Record for generic function
  const record: Record<string, boolean> = {
    codeCompiles: checklist.codeCompiles,
    testsPass: checklist.testsPass,
    requirementsMet: checklist.requirementsMet,
    noRegressions: checklist.noRegressions,
    codeQuality: checklist.codeQuality,
  };
  return calculatePassPercentage(record, [...ARCHITECT_CHECKLIST_ITEMS]);
}

/**
 * Calculate Critic checklist pass percentage
 */
export function calculateCriticPassPercentage(checklist: CriticChecklist): number {
  // Convert to Record for generic function
  const record: Record<string, boolean> = {
    goalsAligned: checklist.goalsAligned,
    tasksAtomic: checklist.tasksAtomic,
    dependenciesClear: checklist.dependenciesClear,
    verifiable: checklist.verifiable,
    waveStructure: checklist.waveStructure,
  };
  return calculatePassPercentage(record, [...CRITIC_CHECKLIST_ITEMS]);
}

// ============================================================================
// Verdict Determination
// ============================================================================

/**
 * Determine Architect verdict based on pass percentage
 */
export function determineArchitectVerdict(
  passPercentage: number
): ArchitectVerdictType {
  if (passPercentage >= APPROVAL_THRESHOLD) {
    return 'APPROVED';
  }
  if (passPercentage >= 60) {
    return 'NEEDS_REVISION';
  }
  return 'REJECTED';
}

/**
 * Determine Critic verdict based on pass percentage
 */
export function determineCriticVerdict(passPercentage: number): CriticVerdictType {
  return passPercentage >= APPROVAL_THRESHOLD ? 'OKAY' : 'REJECT';
}

// ============================================================================
// Verdict Creation
// ============================================================================

/**
 * Create an Architect verdict from checklist
 */
export function createArchitectVerdict(
  taskId: string,
  checklist: ArchitectChecklist,
  options?: {
    issues?: string[];
    suggestions?: string[];
    evidence?: ArchitectVerdict['evidence'];
  }
): ArchitectVerdict {
  const passPercentage = calculateArchitectPassPercentage(checklist);
  const verdict = determineArchitectVerdict(passPercentage);

  return {
    verdict,
    timestamp: new Date().toISOString(),
    taskId,
    checklist,
    passPercentage,
    issues: options?.issues,
    suggestions: options?.suggestions,
    evidence: options?.evidence,
  };
}

/**
 * Create a Critic verdict from checklist
 */
export function createCriticVerdict(
  planPath: string,
  checklist: CriticChecklist,
  justification: string,
  options?: {
    iteration?: number;
    improvements?: string[];
    strengths?: string[];
  }
): CriticVerdict {
  const passPercentage = calculateCriticPassPercentage(checklist);
  const verdict = determineCriticVerdict(passPercentage);

  return {
    verdict,
    timestamp: new Date().toISOString(),
    planPath,
    iteration: options?.iteration,
    checklist,
    passPercentage,
    justification,
    improvements: options?.improvements,
    strengths: options?.strengths,
  };
}

// ============================================================================
// Checklist Validation
// ============================================================================

/**
 * Check if all critical items pass in Architect checklist
 */
export function hasArchitectCriticalFailures(
  checklist: ArchitectChecklist
): boolean {
  // Code must compile and requirements must be met
  return !checklist.codeCompiles || !checklist.requirementsMet;
}

/**
 * Check if all critical items pass in Critic checklist
 */
export function hasCriticCriticalFailures(checklist: CriticChecklist): boolean {
  // Goals must align and tasks must be verifiable
  return !checklist.goalsAligned || !checklist.verifiable;
}

/**
 * Get failed items from a checklist
 */
export function getFailedItems<T extends Record<string, boolean>>(
  checklist: T,
  items: (keyof T)[]
): (keyof T)[] {
  return items.filter((item) => checklist[item] === false);
}

/**
 * Get passed items from a checklist
 */
export function getPassedItems<T extends Record<string, boolean>>(
  checklist: T,
  items: (keyof T)[]
): (keyof T)[] {
  return items.filter((item) => checklist[item] === true);
}

// ============================================================================
// Checklist Display
// ============================================================================

/** Human-readable names for Architect checklist items */
export const ARCHITECT_ITEM_NAMES: Record<keyof ArchitectChecklist, string> = {
  codeCompiles: 'Code compiles without errors',
  testsPass: 'All relevant tests pass',
  requirementsMet: 'Task requirements fulfilled',
  noRegressions: 'No regressions introduced',
  codeQuality: 'Code follows project standards',
};

/** Human-readable names for Critic checklist items */
export const CRITIC_ITEM_NAMES: Record<keyof CriticChecklist, string> = {
  goalsAligned: 'Tasks align with phase/project goals',
  tasksAtomic: 'Each task is atomic (single commit)',
  dependenciesClear: 'Dependencies are explicit and correct',
  verifiable: 'Each task has clear done criteria',
  waveStructure: 'Wave assignments enable parallelism',
};

/**
 * Format checklist for display
 */
export function formatChecklist<T extends Record<string, boolean>>(
  checklist: T,
  names: Record<keyof T, string>
): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(checklist)) {
    const status = value ? '✅' : '❌';
    const name = names[key as keyof T];
    lines.push(`${status} ${name}`);
  }
  return lines.join('\n');
}
