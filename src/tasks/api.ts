/**
 * Claude Tasks API Wrapper
 *
 * Functions for creating Claude Task tool invocation structures.
 * These functions generate the invocation structure that the orchestrator
 * will use to invoke the actual Claude Task tools.
 *
 * NOTE: The actual TaskCreate/TaskUpdate calls are Claude Code tools,
 * not functions we can call directly. These functions create the
 * invocation structure for the orchestrator.
 */

import type { TaskToolParams } from '../sync/types.js';
import type {
  TaskCreateParams,
  TaskCreateInvocation,
  TaskUpdateParams,
  TaskUpdateInvocation,
} from './types.js';

// ============================================================================
// Task Creation
// ============================================================================

/**
 * Create a TaskCreate tool invocation structure.
 *
 * @param params - Task creation parameters
 * @returns TaskCreate invocation structure for the orchestrator
 *
 * @example
 * ```typescript
 * const invocation = createTask({
 *   subject: 'Implement user auth',
 *   description: 'Add JWT authentication to API endpoints',
 *   activeForm: 'Implementing authentication...',
 * });
 * // invocation.tool === 'TaskCreate'
 * // invocation.params.subject === 'Implement user auth'
 * ```
 */
export function createTask(params: TaskCreateParams): TaskCreateInvocation {
  return {
    tool: 'TaskCreate',
    params: {
      subject: params.subject.slice(0, 50), // Enforce max length for display
      description: params.description,
      ...(params.activeForm && { activeForm: params.activeForm }),
    },
  };
}

/**
 * Create a TaskCreate invocation from TaskToolParams (from sync module).
 *
 * This bridges the sync module's TaskToolParams to the Tasks API.
 *
 * @param toolParams - Task tool parameters from sync module
 * @returns TaskCreate invocation structure
 *
 * @example
 * ```typescript
 * const mapping = await mapTask(taskElement, planPath, taskIndex);
 * const invocation = createTaskFromToolParams(mapping.tool_params);
 * ```
 */
export function createTaskFromToolParams(
  toolParams: TaskToolParams
): TaskCreateInvocation {
  return createTask({
    subject: toolParams.description,
    description: toolParams.prompt,
    activeForm: `Executing: ${toolParams.description}`,
  });
}

// ============================================================================
// Task Updates
// ============================================================================

/**
 * Create a TaskUpdate tool invocation structure.
 *
 * @param params - Task update parameters
 * @returns TaskUpdate invocation structure for the orchestrator
 *
 * @example
 * ```typescript
 * const invocation = updateTask({
 *   taskId: '1',
 *   status: 'completed',
 * });
 * ```
 */
export function updateTask(params: TaskUpdateParams): TaskUpdateInvocation {
  return {
    tool: 'TaskUpdate',
    params,
  };
}

/**
 * Create a TaskUpdate invocation to mark a task as in_progress.
 *
 * @param taskId - Claude's task ID
 * @param owner - Optional owner (agent ID)
 * @returns TaskUpdate invocation structure
 */
export function startTask(
  taskId: string,
  owner?: string
): TaskUpdateInvocation {
  return updateTask({
    taskId,
    status: 'in_progress',
    ...(owner && { owner }),
  });
}

/**
 * Create a TaskUpdate invocation to mark a task as completed.
 *
 * @param taskId - Claude's task ID
 * @returns TaskUpdate invocation structure
 */
export function completeTask(taskId: string): TaskUpdateInvocation {
  return updateTask({
    taskId,
    status: 'completed',
  });
}

/**
 * Create a TaskUpdate invocation to set blockedBy dependencies.
 *
 * Convenience function for setting task dependencies.
 * Use this after tasks are created to wire up wave-based dependencies.
 *
 * @param taskId - Claude's task ID to update
 * @param blockedBy - Array of Claude task IDs that block this task
 * @returns TaskUpdate invocation structure
 *
 * @example
 * ```typescript
 * // Wire Wave 2 task to be blocked by Wave 1 tasks
 * const invocation = createDependencyUpdate('3', ['1', '2']);
 * // invocation.params.addBlockedBy === ['1', '2']
 * ```
 */
export function createDependencyUpdate(
  taskId: string,
  blockedBy: string[]
): TaskUpdateInvocation {
  return updateTask({
    taskId,
    addBlockedBy: blockedBy,
  });
}

// ============================================================================
// Task Listing
// ============================================================================

/**
 * List all tasks in Claude Tasks.
 *
 * NOTE: Generates TaskList tool invocation structure.
 * Actual tool call happens via Claude's tool execution system.
 *
 * @returns TaskList invocation
 */
export function listTasks(): { tool: 'TaskList'; params: Record<string, never> } {
  return {
    tool: 'TaskList',
    params: {},
  };
}
