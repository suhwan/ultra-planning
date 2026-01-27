/**
 * Task Progress Visualization
 *
 * Provides progress statistics and formatting from TaskList results.
 * Used for displaying execution progress during plan runs.
 */

import type { TaskListEntry } from './types.js';
import { listTasks } from './api.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Progress statistics calculated from TaskList
 */
export interface ProgressStats {
  /** Total number of tasks */
  total: number;
  /** Number of completed tasks */
  completed: number;
  /** Number of tasks currently in progress */
  inProgress: number;
  /** Number of pending tasks (not blocked) */
  pending: number;
  /** Number of blocked tasks (pending with blockers) */
  blocked: number;
  /** Completion percentage (0-100) */
  percentComplete: number;
}

// ============================================================================
// Progress Calculation
// ============================================================================

/**
 * Calculate progress statistics from task list
 *
 * Analyzes TaskListEntry array to compute progress metrics.
 * Blocked tasks are pending tasks that have blockedBy set.
 *
 * @param tasks - Array of TaskListEntry from TaskList
 * @returns Progress statistics
 *
 * @example
 * ```typescript
 * const stats = calculateProgress(tasks);
 * console.log(`${stats.percentComplete}% complete`);
 * ```
 */
export function calculateProgress(tasks: TaskListEntry[]): ProgressStats {
  const total = tasks.length;

  if (total === 0) {
    return {
      total: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
      blocked: 0,
      percentComplete: 100, // Empty plan is "complete"
    };
  }

  const completed = tasks.filter((t) => t.status === 'completed').length;
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
  const blocked = tasks.filter(
    (t) => t.status === 'pending' && t.blockedBy && t.blockedBy.length > 0
  ).length;
  const pending = tasks.filter(
    (t) => t.status === 'pending' && (!t.blockedBy || t.blockedBy.length === 0)
  ).length;

  return {
    total,
    completed,
    inProgress,
    pending,
    blocked,
    percentComplete: Math.round((completed / total) * 100),
  };
}

/**
 * Generate TaskList invocation for progress query
 *
 * Convenience wrapper around listTasks() for semantic clarity.
 *
 * @returns TaskList invocation structure
 */
export function getProgress(): { tool: 'TaskList'; params: Record<string, never> } {
  return listTasks();
}

// ============================================================================
// Formatting Functions
// ============================================================================

/**
 * Format progress bar string
 *
 * Creates a visual progress bar with filled, in-progress, and empty segments.
 * - Filled (completed): solid blocks
 * - In progress: half blocks
 * - Empty (remaining): light blocks
 *
 * @param stats - Progress statistics
 * @param width - Bar width in characters (default 20)
 * @returns Formatted progress bar string
 *
 * @example
 * ```typescript
 * const bar = formatProgressBar(stats);
 * // "[████████▓▓░░░░░░░░░░] 40%"
 * ```
 */
export function formatProgressBar(stats: ProgressStats, width: number = 20): string {
  if (stats.total === 0) {
    return `[${'░'.repeat(width)}] 100%`;
  }

  const filled = Math.round((stats.completed / stats.total) * width);
  const inProg = Math.round((stats.inProgress / stats.total) * width);
  const empty = width - filled - inProg;

  const bar =
    '\u2588'.repeat(filled) +
    '\u2593'.repeat(inProg) +
    '\u2591'.repeat(Math.max(0, empty));
  return `[${bar}] ${stats.percentComplete}%`;
}

/**
 * Format progress for display
 *
 * Creates a multi-line progress summary with bar and statistics.
 *
 * @param stats - Progress statistics
 * @returns Multi-line progress summary string
 *
 * @example
 * ```typescript
 * console.log(formatProgress(stats));
 * // [████████░░░░░░░░░░░░] 40%
 * //
 * // Total: 10 tasks
 * //   Completed: 4
 * //   In Progress: 1
 * //   Pending: 3
 * //   Blocked: 2
 * ```
 */
export function formatProgress(stats: ProgressStats): string {
  const lines = [
    formatProgressBar(stats),
    '',
    `Total: ${stats.total} tasks`,
    `  \u2713 Completed: ${stats.completed}`,
    `  \u25B8 In Progress: ${stats.inProgress}`,
    `  \u25CB Pending: ${stats.pending}`,
  ];

  if (stats.blocked > 0) {
    lines.push(`  \u2298 Blocked: ${stats.blocked}`);
  }

  return lines.join('\n');
}

/**
 * Format single task entry for display
 *
 * Creates a formatted line for a single task with status icon,
 * ID, subject, owner, and blocker information.
 *
 * @param task - TaskListEntry to format
 * @returns Formatted task line string
 *
 * @example
 * ```typescript
 * console.log(formatTaskEntry(task));
 * // "#1 [Completed] Implement auth (owner: executor)"
 * ```
 */
export function formatTaskEntry(task: TaskListEntry): string {
  const statusIcon: Record<string, string> = {
    completed: '\u2713',
    in_progress: '\u25B8',
    pending: '\u25CB',
  };

  const icon = statusIcon[task.status] || '\u25CB';
  let line = `#${task.id} [${icon}] ${task.subject}`;

  if (task.owner) {
    line += ` (owner: ${task.owner})`;
  }

  if (task.blockedBy && task.blockedBy.length > 0) {
    line += ` [blocked by #${task.blockedBy.join(', #')}]`;
  }

  return line;
}

/**
 * Format full task list for display
 *
 * Creates a complete formatted display with progress header,
 * divider, and all task entries.
 *
 * @param tasks - Array of TaskListEntry
 * @returns Multi-line formatted task list string
 *
 * @example
 * ```typescript
 * console.log(formatTaskList(tasks));
 * // [████████░░░░░░░░░░░░] 40%
 * //
 * // Total: 10 tasks
 * //   Completed: 4
 * //   In Progress: 1
 * //   Pending: 5
 * //
 * // ----------------------------------------
 * //
 * // #1 [Completed] Task 1
 * // #2 [In Progress] Task 2
 * // ...
 * ```
 */
export function formatTaskList(tasks: TaskListEntry[]): string {
  if (tasks.length === 0) {
    return 'No tasks registered.';
  }

  const stats = calculateProgress(tasks);
  const header = formatProgress(stats);
  const divider = '\u2500'.repeat(40);
  const taskLines = tasks.map(formatTaskEntry);

  return [header, '', divider, '', ...taskLines].join('\n');
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Check if all tasks are complete
 *
 * @param tasks - Array of TaskListEntry
 * @returns true if all tasks have completed status
 */
export function isAllComplete(tasks: TaskListEntry[]): boolean {
  return tasks.length > 0 && tasks.every((t) => t.status === 'completed');
}

/**
 * Get tasks that are ready to execute (pending, not blocked)
 *
 * Filters for tasks that can be started immediately:
 * - Status is 'pending'
 * - No blockers or empty blockedBy array
 *
 * @param tasks - Array of TaskListEntry
 * @returns Tasks that can be executed now
 *
 * @example
 * ```typescript
 * const ready = getReadyTasks(tasks);
 * // Start executing ready tasks
 * for (const task of ready) {
 *   await execute(task);
 * }
 * ```
 */
export function getReadyTasks(tasks: TaskListEntry[]): TaskListEntry[] {
  return tasks.filter(
    (t) => t.status === 'pending' && (!t.blockedBy || t.blockedBy.length === 0)
  );
}

/**
 * Get tasks currently in progress
 *
 * @param tasks - Array of TaskListEntry
 * @returns Tasks currently being executed
 */
export function getActiveTasks(tasks: TaskListEntry[]): TaskListEntry[] {
  return tasks.filter((t) => t.status === 'in_progress');
}
