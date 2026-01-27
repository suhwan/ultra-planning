/**
 * Tasks Module
 *
 * Claude Tasks API integration for plan execution.
 * Provides types, API wrappers, and task ID registry.
 *
 * @module tasks
 */

// ============================================================================
// Types
// ============================================================================

export type {
  ClaudeTaskId,
  TaskCreateParams,
  TaskCreateResult,
  TaskUpdateParams,
  TaskListEntry,
  TaskCreateInvocation,
  TaskUpdateInvocation,
} from './types.js';

// ============================================================================
// API Functions
// ============================================================================

export {
  createTask,
  createTaskFromToolParams,
  updateTask,
  startTask,
  completeTask,
} from './api.js';

// ============================================================================
// Registry
// ============================================================================

export { TaskRegistry, createTaskRegistry } from './registry.js';

// ============================================================================
// Dependencies
// ============================================================================

export {
  setTaskDependencies,
  generateTaskCreations,
  generateDependencyUpdates,
  preparePlanRegistration,
} from './dependencies.js';

export type { TaskToolInvocation } from './dependencies.js';
