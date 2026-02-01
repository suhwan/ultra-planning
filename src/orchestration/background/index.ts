/**
 * Background Manager Module
 *
 * Provides background task management with model-based concurrency control,
 * task queuing, stability detection, and parent session notifications.
 *
 * Key components:
 * - ConcurrencyManager: Model-tiered concurrent limits (haiku:5, sonnet:3, opus:2)
 * - BackgroundManager: Task lifecycle management (Plan 21-02)
 * - Stability detection: Auto-completion via idle detection (Plan 21-04)
 * - Notifications: Batch notifications to parent session (Plan 21-03)
 *
 * @example
 * ```typescript
 * import { getBackgroundManager, DEFAULT_BACKGROUND_CONFIG } from './background';
 *
 * const manager = getBackgroundManager();
 *
 * // Launch a background task
 * const task = await manager.launch({
 *   description: 'Fix linting errors',
 *   prompt: 'Fix all ESLint errors in src/',
 *   agent: 'executor',
 *   parentSessionId: 'session-123',
 *   parentMessageId: 'msg-456',
 *   model: 'sonnet',
 * });
 *
 * // Task is queued, transitions to running when slot available
 * console.log(task.status); // 'pending' or 'running'
 *
 * // Mark complete when done
 * manager.completeTask(task.id, 'All errors fixed');
 * ```
 *
 * @module orchestration/background
 */

// Types
export type {
  BackgroundTaskStatus,
  TaskProgress,
  BackgroundTask,
  LaunchInput,
  BackgroundConfig,
  SerializedBackgroundTask,
  BackgroundState,
} from './types.js';

export {
  DEFAULT_BACKGROUND_CONFIG,
  createInitialBackgroundState,
} from './types.js';

// Concurrency management
export { ConcurrencyManager } from './concurrency.js';

// State persistence
export {
  loadBackgroundState,
  saveBackgroundState,
  clearBackgroundState,
  createEmptyState,
} from './state.js';

// Stability detection
export {
  StabilityDetector,
  createStabilityDetector,
  type StabilityConfig,
  type PollResult,
  type MessageCountProvider,
} from './stability.js';

// Notifications
export {
  NotificationManager,
  createNotificationManager,
  formatBatchNotification,
  type NotificationConfig,
  type TaskCompletedPayload,
  type BatchNotificationPayload,
} from './notifications.js';

// Background manager
export {
  BackgroundManager,
  getBackgroundManager,
  resetBackgroundManager,
  type TaskCompleteCallback,
  type TaskStartCallback,
} from './manager.js';
