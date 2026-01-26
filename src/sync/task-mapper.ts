/**
 * Task Mapper
 *
 * Converts TaskMapping objects to Claude Task tool invocations with dependency tracking.
 * Enables parallel task execution with proper wave-based dependency management.
 */

import type { TaskMapping, TaskToolParams } from './types.js';
import type { TaskType } from '../documents/xml/types.js';

// Forward type declaration to avoid circular dependency
export interface DependencyMap {
  [task_id: string]: string[];
}

// ============================================================================
// Task Invocation Interface
// ============================================================================

/**
 * Complete Task tool invocation with dependencies
 *
 * Represents a ready-to-execute Task tool call with:
 * - tool_name: Always 'Task' (for Claude Task tool)
 * - tool_input: Parameters for Task tool
 * - task_id: For state tracking and correlation
 * - blocked_by: Task IDs this task depends on (must complete first)
 */
export interface TaskInvocation {
  /** Tool name - always 'Task' for Claude Task tool */
  tool_name: 'Task';

  /** Task tool parameters */
  tool_input: TaskToolParams;

  /** Task identifier for tracking */
  task_id: string;

  /** Task IDs this task is blocked by (wave dependencies) */
  blocked_by: string[];
}

// ============================================================================
// Task Invocation Creation
// ============================================================================

/**
 * Create single TaskInvocation from TaskMapping
 *
 * Converts a TaskMapping (parsed from PLAN.md) into a ready-to-execute
 * Task tool invocation with optional dependency blocking.
 *
 * @param mapping - TaskMapping from plan parser
 * @param blockedBy - Optional array of task IDs this task depends on
 * @returns TaskInvocation ready for Task tool execution
 *
 * @example
 * ```ts
 * const mapping: TaskMapping = {
 *   task_id: '06-02-01',
 *   name: 'Implement task mapper',
 *   type: 'auto',
 *   tool_params: { ... },
 *   status: 'pending',
 *   wave: 2,
 *   plan_path: '...'
 * };
 *
 * const invocation = createTaskInvocation(mapping, ['06-01-01', '06-01-02']);
 * // invocation.blocked_by = ['06-01-01', '06-01-02']
 * ```
 */
export function createTaskInvocation(
  mapping: TaskMapping,
  blockedBy: string[] = []
): TaskInvocation {
  return {
    tool_name: 'Task',
    tool_input: mapping.tool_params,
    task_id: mapping.task_id,
    blocked_by: blockedBy,
  };
}

/**
 * Create multiple TaskInvocations with dependency mapping
 *
 * Converts an array of TaskMappings into TaskInvocations with proper
 * dependency blocking based on wave numbers. Tasks are sorted in
 * execution order (wave, then task ID).
 *
 * @param mappings - Array of TaskMappings from parser
 * @param dependencyMap - Map of task_id -> blocking task_ids
 * @returns Array of TaskInvocations in execution order
 *
 * @example
 * ```ts
 * const mappings = await parseAndExtractMappings('./06-02-PLAN.md');
 * const depMap = buildDependencyMap(mappings);
 * const invocations = createTaskInvocations(mappings, depMap);
 * // Returns sorted array: wave 1 tasks first, then wave 2, etc.
 * ```
 */
export function createTaskInvocations(
  mappings: TaskMapping[],
  dependencyMap: DependencyMap
): TaskInvocation[] {
  // Sort mappings by wave, then by task_id for deterministic ordering
  const sortedMappings = [...mappings].sort((a, b) => {
    if (a.wave !== b.wave) {
      return a.wave - b.wave;
    }
    return a.task_id.localeCompare(b.task_id);
  });

  // Map each TaskMapping to TaskInvocation with dependencies
  return sortedMappings.map((mapping) => {
    const blockedBy = dependencyMap[mapping.task_id] || [];
    return createTaskInvocation(mapping, blockedBy);
  });
}

// ============================================================================
// Subagent Type Determination
// ============================================================================

/**
 * Determine appropriate subagent type based on task type
 *
 * Maps task types to specialized Claude Code subagents:
 * - 'auto' -> executor (standard implementation tasks)
 * - 'checkpoint:human-verify' -> verifier (verification tasks)
 * - 'checkpoint:decision' -> architect (architectural decisions)
 * - 'checkpoint:human-action' -> executor (user action coordination)
 *
 * @param taskType - Task type from PLAN.md
 * @returns Subagent type identifier
 *
 * @example
 * ```ts
 * determineSubagentType('auto'); // 'oh-my-claudecode:executor'
 * determineSubagentType('checkpoint:human-verify'); // 'oh-my-claudecode:verifier'
 * determineSubagentType('checkpoint:decision'); // 'oh-my-claudecode:architect'
 * ```
 */
export function determineSubagentType(taskType: TaskType): string {
  switch (taskType) {
    case 'auto':
      return 'oh-my-claudecode:executor';
    case 'checkpoint:human-verify':
      return 'oh-my-claudecode:verifier';
    case 'checkpoint:decision':
      return 'oh-my-claudecode:architect';
    case 'checkpoint:human-action':
      return 'oh-my-claudecode:executor';
    default:
      // Fallback for any unrecognized checkpoint types
      return 'oh-my-claudecode:executor';
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract task IDs from TaskInvocations
 *
 * @param invocations - Array of TaskInvocations
 * @returns Array of task IDs
 */
export function getTaskIds(invocations: TaskInvocation[]): string[] {
  return invocations.map((inv) => inv.task_id);
}

/**
 * Filter invocations by wave number
 *
 * @param invocations - Array of TaskInvocations
 * @param mappings - Original TaskMappings (for wave lookup)
 * @param wave - Wave number to filter
 * @returns Invocations from specified wave
 */
export function filterByWave(
  invocations: TaskInvocation[],
  mappings: TaskMapping[],
  wave: number
): TaskInvocation[] {
  const waveTaskIds = new Set(
    mappings.filter((m) => m.wave === wave).map((m) => m.task_id)
  );
  return invocations.filter((inv) => waveTaskIds.has(inv.task_id));
}

/**
 * Get ready-to-execute tasks (no blocked_by dependencies)
 *
 * @param invocations - Array of TaskInvocations
 * @returns Invocations with empty blocked_by arrays
 */
export function getReadyTasks(invocations: TaskInvocation[]): TaskInvocation[] {
  return invocations.filter((inv) => inv.blocked_by.length === 0);
}
