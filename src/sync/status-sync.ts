/**
 * Status Synchronization for PLAN.md
 *
 * Provides bidirectional sync between task execution state and PLAN.md documents.
 * Tracks task status in frontmatter and optionally updates content checkboxes.
 */

import { readFile, writeFile } from 'fs/promises';
import * as matter from 'gray-matter';
import type { TaskState } from './types.js';
import type { PlanFrontmatter } from '../types.js';

// ============================================================================
// Extended Frontmatter Type (Internal)
// ============================================================================

/**
 * Extended plan frontmatter with task state tracking
 *
 * This extends the base PlanFrontmatter to include task_states field
 * for execution state tracking.
 */
interface ExtendedPlanFrontmatter extends PlanFrontmatter {
  /** Task execution states keyed by task ID */
  task_states?: Record<string, TaskState>;
}

// ============================================================================
// Task State Reading
// ============================================================================

/**
 * Get task execution states from PLAN.md frontmatter
 *
 * Reads the PLAN.md file and extracts task_states from frontmatter.
 * Returns empty object if task_states field is not present.
 *
 * @param planPath - Absolute path to PLAN.md file
 * @returns Record of task states keyed by task ID
 * @throws Error if file cannot be read or parsed
 *
 * @example
 * ```typescript
 * const states = await getTaskStates('/path/to/PLAN.md');
 * console.log(states['06-01-01']); // { status: 'completed', completed_at: '...' }
 * ```
 */
export async function getTaskStates(
  planPath: string
): Promise<Record<string, TaskState>> {
  const content = await readFile(planPath, 'utf-8');
  const parsed = matter(content);
  const frontmatter = parsed.data as ExtendedPlanFrontmatter;

  return frontmatter.task_states || {};
}

// ============================================================================
// Task State Updates
// ============================================================================

/**
 * Update task execution status in PLAN.md frontmatter
 *
 * Reads PLAN.md, updates the specified task's state in frontmatter.task_states,
 * and writes the file back. Preserves all other frontmatter fields and content.
 *
 * @param planPath - Absolute path to PLAN.md file
 * @param taskId - Task ID (format: {phase}-{plan:02d}-{task:02d})
 * @param update - Partial task state to merge with existing state
 * @throws Error if file cannot be read/written or parsed
 *
 * @example
 * ```typescript
 * await updateTaskStatus('/path/to/PLAN.md', '06-01-01', {
 *   status: 'in_progress',
 *   started_at: new Date().toISOString()
 * });
 * ```
 */
export async function updateTaskStatus(
  planPath: string,
  taskId: string,
  update: Partial<TaskState>
): Promise<void> {
  // Read current file
  const content = await readFile(planPath, 'utf-8');
  const parsed = matter(content);
  const frontmatter = parsed.data as ExtendedPlanFrontmatter;

  // Initialize task_states if not present
  if (!frontmatter.task_states) {
    frontmatter.task_states = {};
  }

  // Get existing state for this task
  const existingState = frontmatter.task_states[taskId] || {
    status: 'pending' as const,
  };

  // Merge update with existing state
  frontmatter.task_states[taskId] = {
    ...existingState,
    ...update,
  };

  // Generate updated markdown with gray-matter
  const updatedMarkdown = matter.stringify(parsed.content, frontmatter);

  // Write back to file
  await writeFile(planPath, updatedMarkdown, 'utf-8');
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Mark task as in progress
 *
 * Convenience wrapper for updateTaskStatus that sets status to 'in_progress'
 * and records the start time.
 *
 * @param planPath - Absolute path to PLAN.md file
 * @param taskId - Task ID
 * @param agentId - Optional agent/session ID for resumption support
 *
 * @example
 * ```typescript
 * await markTaskInProgress('/path/to/PLAN.md', '06-01-01', 'executor-session-123');
 * ```
 */
export async function markTaskInProgress(
  planPath: string,
  taskId: string,
  agentId?: string
): Promise<void> {
  const update: Partial<TaskState> = {
    status: 'in_progress',
    started_at: new Date().toISOString(),
  };

  if (agentId) {
    update.agent_id = agentId;
  }

  await updateTaskStatus(planPath, taskId, update);
}

/**
 * Mark task as completed
 *
 * Convenience wrapper for updateTaskStatus that sets status to 'completed'
 * and records the completion time.
 *
 * @param planPath - Absolute path to PLAN.md file
 * @param taskId - Task ID
 *
 * @example
 * ```typescript
 * await markTaskComplete('/path/to/PLAN.md', '06-01-01');
 * ```
 */
export async function markTaskComplete(
  planPath: string,
  taskId: string
): Promise<void> {
  await updateTaskStatus(planPath, taskId, {
    status: 'completed',
    completed_at: new Date().toISOString(),
  });
}

/**
 * Mark task as failed
 *
 * Convenience wrapper for updateTaskStatus that sets status to 'failed',
 * records the completion time, and stores the error message.
 *
 * @param planPath - Absolute path to PLAN.md file
 * @param taskId - Task ID
 * @param error - Error message or description
 *
 * @example
 * ```typescript
 * await markTaskFailed('/path/to/PLAN.md', '06-01-01', 'Build failed: type error');
 * ```
 */
export async function markTaskFailed(
  planPath: string,
  taskId: string,
  error: string
): Promise<void> {
  await updateTaskStatus(planPath, taskId, {
    status: 'failed',
    error,
    completed_at: new Date().toISOString(),
  });
}

// ============================================================================
// Content Checkbox Updates (Optional Enhancement)
// ============================================================================

/**
 * Update task status attribute in PLAN.md content
 *
 * Finds a task in the content by name and adds/updates the status attribute.
 * This is an optional enhancement - frontmatter tracking is the primary mechanism.
 *
 * @param content - PLAN.md content string
 * @param taskName - Task name to find (e.g., "Task 1: Setup infrastructure")
 * @param completed - Whether task is completed
 * @returns Updated content with status attribute
 *
 * @example
 * ```typescript
 * const updatedContent = updateContentCheckbox(
 *   content,
 *   'Task 1: Setup infrastructure',
 *   true
 * );
 * // <task type="auto" status="completed">
 * //   <name>Task 1: Setup infrastructure</name>
 * // </task>
 * ```
 */
export function updateContentCheckbox(
  content: string,
  taskName: string,
  completed: boolean
): string {
  const status = completed ? 'completed' : 'pending';

  // Escape special regex characters in task name
  const escapedName = taskName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Pattern to match task XML with the specified name
  // Captures: opening tag, name element, rest of task
  const taskPattern = new RegExp(
    `(<task[^>]*)(>\\s*<name>${escapedName}</name>\\s*)([\\s\\S]*?</task>)`,
    'i'
  );

  return content.replace(taskPattern, (match, openTag, nameSection, rest) => {
    // Remove existing status attribute if present
    const cleanedOpenTag = openTag.replace(/\s+status="[^"]*"/, '');

    // Add new status attribute
    const updatedOpenTag = `${cleanedOpenTag} status="${status}"`;

    return `${updatedOpenTag}${nameSection}${rest}`;
  });
}
