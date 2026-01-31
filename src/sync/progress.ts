/**
 * Progress Utilities
 *
 * Progress tracking and visualization for Claude Tasks.
 * Processes TaskList output for human-readable progress display.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Task entry from TaskList (simplified interface)
 */
export interface TaskEntry {
  id: string;
  subject?: string;
  status: 'pending' | 'in_progress' | 'completed';
  owner?: string;
  blockedBy?: string[];
}

/**
 * Progress statistics
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
  /** Number of blocked tasks */
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
 * @param tasks - Array of task entries from TaskList
 * @returns Progress statistics
 *
 * @example
 * ```typescript
 * const stats = calculateProgress(tasks);
 * console.log(`${stats.percentComplete}% complete`);
 * ```
 */
export function calculateProgress(tasks: TaskEntry[]): ProgressStats {
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

// ============================================================================
// Formatting
// ============================================================================

/**
 * Format progress bar string
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
 * @param stats - Progress statistics
 * @returns Multi-line progress summary string
 */
export function formatProgress(stats: ProgressStats): string {
  const lines = [
    formatProgressBar(stats),
    '',
    `Total: ${stats.total} tasks`,
    `  ✓ Completed: ${stats.completed}`,
    `  ▸ In Progress: ${stats.inProgress}`,
    `  ○ Pending: ${stats.pending}`,
  ];

  if (stats.blocked > 0) {
    lines.push(`  ⊘ Blocked: ${stats.blocked}`);
  }

  return lines.join('\n');
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Check if all tasks are complete
 */
export function isAllComplete(tasks: TaskEntry[]): boolean {
  return tasks.length > 0 && tasks.every((t) => t.status === 'completed');
}

/**
 * Get tasks that are ready to execute (pending, not blocked)
 */
export function getReadyTasks(tasks: TaskEntry[]): TaskEntry[] {
  return tasks.filter(
    (t) => t.status === 'pending' && (!t.blockedBy || t.blockedBy.length === 0)
  );
}

/**
 * Get tasks currently in progress
 */
export function getActiveTasks(tasks: TaskEntry[]): TaskEntry[] {
  return tasks.filter((t) => t.status === 'in_progress');
}
