/**
 * Tasks Module
 *
 * Claude Tasks API integration for plan execution.
 * Provides types, API wrappers, task ID registry, status sync, and progress visualization.
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
  createDependencyUpdate,
  listTasks,
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

// ============================================================================
// Status Sync
// ============================================================================

export {
  syncTaskStatus,
  markInProgress,
  markCompleted,
  markFailed,
  checkRegistrationStatus,
} from './status.js';

export type { StatusUpdateResult } from './status.js';

// ============================================================================
// Progress
// ============================================================================

export {
  calculateProgress,
  getProgress,
  formatProgressBar,
  formatProgress,
  formatTaskEntry,
  formatTaskList,
  isAllComplete,
  getReadyTasks,
  getActiveTasks,
} from './progress.js';

export type { ProgressStats } from './progress.js';
