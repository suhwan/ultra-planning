/**
 * Dependency Mapper
 *
 * Converts wave numbers to blockedBy dependencies for parallel task execution.
 * Enables proper task ordering based on wave-based parallelization strategy.
 */

import type { TaskMapping } from './types.js';

// ============================================================================
// Dependency Map Type
// ============================================================================

/**
 * Maps task IDs to their blocking dependencies
 *
 * Structure: { [task_id]: [blocking_task_ids] }
 *
 * @example
 * ```ts
 * {
 *   '06-02-01': ['06-01-01', '06-01-02'],  // Wave 2 blocked by Wave 1
 *   '06-02-02': ['06-01-01', '06-01-02'],
 *   '06-03-01': ['06-02-01', '06-02-02']   // Wave 3 blocked by Wave 2
 * }
 * ```
 */
export type DependencyMap = Record<string, string[]>;

// ============================================================================
// Dependency Map Building
// ============================================================================

/**
 * Build dependency map from task mappings
 *
 * Creates a complete dependency map where each task is mapped to all tasks
 * from previous waves that must complete before it can execute.
 *
 * Wave dependency rules:
 * - Wave 1 tasks: No dependencies (blockedBy = [])
 * - Wave N tasks: Blocked by ALL tasks from waves 1 to N-1
 *
 * @param allMappings - All TaskMappings from plan parser(s)
 * @returns DependencyMap mapping task_id -> blocking task_ids
 *
 * @example
 * ```ts
 * const mappings = await parseAndExtractMappings('./06-02-PLAN.md');
 * const depMap = buildDependencyMap(mappings);
 * // {
 * //   '06-02-01': ['06-01-01', '06-01-02'],
 * //   '06-02-02': ['06-01-01', '06-01-02']
 * // }
 * ```
 */
export function buildDependencyMap(allMappings: TaskMapping[]): DependencyMap {
  const dependencyMap: DependencyMap = {};

  // Group tasks by wave for efficient lookup
  const tasksByWave = groupTasksByWave(allMappings);
  const waves = Array.from(tasksByWave.keys()).sort((a, b) => a - b);

  // For each task, compute its dependencies
  for (const mapping of allMappings) {
    const taskWave = mapping.wave;

    // Wave 1 tasks have no dependencies
    if (taskWave === 1 || taskWave === waves[0]) {
      dependencyMap[mapping.task_id] = [];
      continue;
    }

    // Get all tasks from earlier waves
    const blockingTaskIds: string[] = [];
    for (const wave of waves) {
      if (wave >= taskWave) break;
      const tasksInWave = tasksByWave.get(wave) || [];
      blockingTaskIds.push(...tasksInWave.map((t) => t.task_id));
    }

    dependencyMap[mapping.task_id] = blockingTaskIds;
  }

  return dependencyMap;
}

/**
 * Group task mappings by wave number
 *
 * @param mappings - Array of TaskMappings
 * @returns Map of wave -> TaskMappings in that wave
 */
function groupTasksByWave(mappings: TaskMapping[]): Map<number, TaskMapping[]> {
  const groups = new Map<number, TaskMapping[]>();

  for (const mapping of mappings) {
    const wave = mapping.wave;
    if (!groups.has(wave)) {
      groups.set(wave, []);
    }
    groups.get(wave)!.push(mapping);
  }

  return groups;
}

// ============================================================================
// Single Task Dependency Lookup
// ============================================================================

/**
 * Get blocking task IDs for a specific wave
 *
 * Utility function to find all task IDs that must complete before
 * tasks in the specified wave can execute.
 *
 * @param taskWave - Wave number to find dependencies for
 * @param allMappings - All TaskMappings from plan parser(s)
 * @returns Array of task IDs from waves < taskWave
 *
 * @example
 * ```ts
 * const mappings = await parseAndExtractMappings('./06-02-PLAN.md');
 * const blockers = mapWaveToBlockedBy(2, mappings);
 * // Returns: ['06-01-01', '06-01-02'] (all Wave 1 task IDs)
 * ```
 */
export function mapWaveToBlockedBy(
  taskWave: number,
  allMappings: TaskMapping[]
): string[] {
  // Filter for tasks in earlier waves
  return allMappings
    .filter((mapping) => mapping.wave < taskWave)
    .map((mapping) => mapping.task_id);
}

// ============================================================================
// Execution Order
// ============================================================================

/**
 * Sort task mappings in execution order
 *
 * Returns mappings sorted by:
 * 1. Wave number (ascending)
 * 2. Plan number (from task_id)
 * 3. Task index (from task_id)
 *
 * This order ensures proper dependency resolution for sequential execution.
 *
 * @param mappings - Array of TaskMappings to sort
 * @returns Sorted array in execution order
 *
 * @example
 * ```ts
 * const mappings = [task_06_02_01, task_06_01_02, task_06_01_01];
 * const ordered = getExecutionOrder(mappings);
 * // Returns: [task_06_01_01, task_06_01_02, task_06_02_01]
 * ```
 */
export function getExecutionOrder(mappings: TaskMapping[]): TaskMapping[] {
  return [...mappings].sort((a, b) => {
    // Primary sort: wave number
    if (a.wave !== b.wave) {
      return a.wave - b.wave;
    }

    // Secondary sort: task_id (which includes plan and task index)
    return a.task_id.localeCompare(b.task_id);
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get all unique wave numbers from mappings
 *
 * @param mappings - Array of TaskMappings
 * @returns Sorted array of unique wave numbers
 */
export function getWaves(mappings: TaskMapping[]): number[] {
  const waves = new Set(mappings.map((m) => m.wave));
  return Array.from(waves).sort((a, b) => a - b);
}

/**
 * Get tasks for specific wave
 *
 * @param mappings - Array of TaskMappings
 * @param wave - Wave number to filter
 * @returns TaskMappings in specified wave
 */
export function getTasksInWave(
  mappings: TaskMapping[],
  wave: number
): TaskMapping[] {
  return mappings.filter((m) => m.wave === wave);
}

/**
 * Check if task has dependencies
 *
 * @param taskId - Task ID to check
 * @param dependencyMap - Dependency map
 * @returns true if task has blocking dependencies
 */
export function hasDependencies(
  taskId: string,
  dependencyMap: DependencyMap
): boolean {
  const deps = dependencyMap[taskId] || [];
  return deps.length > 0;
}

/**
 * Get tasks ready to execute (no dependencies or all dependencies met)
 *
 * @param mappings - Array of TaskMappings
 * @param dependencyMap - Dependency map
 * @param completedTaskIds - Set of completed task IDs
 * @returns TaskMappings ready to execute
 */
export function getReadyTasks(
  mappings: TaskMapping[],
  dependencyMap: DependencyMap,
  completedTaskIds: Set<string>
): TaskMapping[] {
  return mappings.filter((mapping) => {
    const deps = dependencyMap[mapping.task_id] || [];
    // Ready if no dependencies OR all dependencies completed
    return deps.length === 0 || deps.every((depId) => completedTaskIds.has(depId));
  });
}
