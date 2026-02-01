/**
 * Notification Manager
 *
 * Batches background task completion notifications and emits aggregated events.
 * Collects completed tasks within a configurable time window and emits a single
 * notification event with batch statistics.
 *
 * Features:
 * - Per-parent session batching (no cross-contamination)
 * - Configurable batch window (default: 1000ms)
 * - Maximum batch size trigger (default: 5 tasks)
 * - Dual event emission (individual + batch)
 * - Integration with HookEventBus for event propagation
 * - State event system integration for persistence
 *
 * @module orchestration/background
 */

import { HookEventBus, createHookEventBus } from '../../hooks/event-bus.js';
import type { BackgroundTask } from './types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration options for the NotificationManager.
 */
export interface NotificationConfig {
  /** Milliseconds to batch notifications (default: 1000) */
  batchWindow?: number;
  /** Maximum notifications per batch before immediate flush (default: 5) */
  maxBatchSize?: number;
}

/**
 * Internal representation of a pending notification.
 */
interface PendingNotification {
  /** The completed task */
  task: BackgroundTask;
  /** When the notification was queued */
  queuedAt: number;
}

/**
 * Payload for individual task completion events.
 */
export interface TaskCompletedPayload {
  /** Unique task identifier */
  taskId: string;
  /** Child session ID */
  sessionId?: string;
  /** Parent session that launched this task */
  parentSessionId: string;
  /** Task completion status */
  status: string;
  /** Result output if completed */
  result?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Payload for batch notification events.
 */
export interface BatchNotificationPayload {
  /** Parent session ID */
  parentSessionId: string;
  /** Array of completed tasks */
  tasks: BackgroundTask[];
  /** Total count of tasks in batch */
  count: number;
  /** Number of successfully completed tasks */
  completedCount: number;
  /** Number of failed tasks */
  failedCount: number;
  /** Number of cancelled tasks */
  cancelledCount: number;
  /** Whether all tasks for this parent are now complete */
  allComplete: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Default batch window in milliseconds */
const DEFAULT_BATCH_WINDOW = 1000;

/** Default maximum batch size */
const DEFAULT_MAX_BATCH_SIZE = 5;

// ============================================================================
// NotificationManager Class
// ============================================================================

/**
 * Notification Manager
 *
 * Manages batched notifications for background task completions.
 * Each parent session has its own batch to prevent cross-contamination.
 *
 * @example
 * ```typescript
 * import { createNotificationManager } from './notifications.js';
 *
 * const notificationManager = createNotificationManager({
 *   batchWindow: 2000,    // 2 second batching window
 *   maxBatchSize: 10,     // Flush after 10 tasks
 * });
 *
 * // Notify on task completion
 * notificationManager.notify(completedTask);
 *
 * // Force flush all pending notifications
 * notificationManager.flushAll();
 *
 * // Subscribe to batch events
 * notificationManager.getEventBus().subscribe('background_tasks_batch', (payload) => {
 *   console.log(`${payload.count} tasks completed for session ${payload.parentSessionId}`);
 * });
 * ```
 */
export class NotificationManager {
  private config: Required<NotificationConfig>;
  private eventBus: HookEventBus;
  private pendingByParent: Map<string, PendingNotification[]> = new Map();
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /**
   * Create a new NotificationManager.
   *
   * @param config - Optional configuration overrides
   * @param eventBus - Optional shared event bus (creates new if not provided)
   */
  constructor(config?: NotificationConfig, eventBus?: HookEventBus) {
    this.config = {
      batchWindow: config?.batchWindow ?? DEFAULT_BATCH_WINDOW,
      maxBatchSize: config?.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE,
    };
    this.eventBus = eventBus ?? createHookEventBus();
  }

  /**
   * Queue a task completion notification.
   *
   * Batches notifications per parent session. Emits individual event
   * immediately and queues for batch notification.
   *
   * @param task - The completed task
   */
  notify(task: BackgroundTask): void {
    const parentId = task.parentSessionId;
    if (!parentId) return;

    // Get or create pending list for this parent
    const pending = this.pendingByParent.get(parentId) ?? [];
    pending.push({ task, queuedAt: Date.now() });
    this.pendingByParent.set(parentId, pending);

    // Emit individual event for immediate hook consumption
    const completedPayload: TaskCompletedPayload = {
      taskId: task.id,
      sessionId: task.sessionId,
      parentSessionId: task.parentSessionId,
      status: task.status,
      result: task.result,
      error: task.error,
    };
    this.eventBus.dispatch('background_task_completed', completedPayload);

    // Check if batch is full - flush immediately
    if (pending.length >= this.config.maxBatchSize) {
      this.flushParent(parentId);
      return;
    }

    // Start batch timer if not already running for this parent
    if (!this.timers.has(parentId)) {
      const timer = setTimeout(() => {
        this.flushParent(parentId);
      }, this.config.batchWindow);
      this.timers.set(parentId, timer);
    }
  }

  /**
   * Flush all pending notifications for a specific parent session.
   *
   * Clears the batch timer, collects all pending tasks, and emits
   * a batch notification event.
   *
   * @param parentSessionId - Parent session to flush
   */
  flushParent(parentSessionId: string): void {
    // Clear timer if exists
    const timer = this.timers.get(parentSessionId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(parentSessionId);
    }

    // Get and clear pending notifications
    const pending = this.pendingByParent.get(parentSessionId);
    if (!pending || pending.length === 0) return;
    this.pendingByParent.delete(parentSessionId);

    // Build batch payload with statistics
    const tasks = pending.map((p) => p.task);
    const completedCount = tasks.filter((t) => t.status === 'completed').length;
    const failedCount = tasks.filter((t) => t.status === 'error').length;
    const cancelledCount = tasks.filter((t) => t.status === 'cancelled').length;

    const batchPayload: BatchNotificationPayload = {
      parentSessionId,
      tasks,
      count: tasks.length,
      completedCount,
      failedCount,
      cancelledCount,
      allComplete: this.getPendingCountForParent(parentSessionId) === 0,
    };

    // Emit batch notification event for hook consumption
    this.eventBus.dispatch('background_tasks_batch', batchPayload);

    // Also emit to state event system for persistence
    this.eventBus.emitToEventSystem({
      type: 'background_tasks_notification',
      payload: {
        parentSessionId,
        taskIds: tasks.map((t) => t.id),
        count: tasks.length,
        completedCount,
        failedCount,
      },
      source: 'background-manager',
    });
  }

  /**
   * Get the number of pending notifications for a parent session.
   *
   * @param parentSessionId - Parent session to check
   * @returns Number of pending notifications
   */
  getPendingCountForParent(parentSessionId: string): number {
    const pending = this.pendingByParent.get(parentSessionId);
    return pending?.length ?? 0;
  }

  /**
   * Flush all pending notifications for all parent sessions.
   *
   * Use this when shutting down or when immediate notification is required.
   */
  flushAll(): void {
    // Get all parent IDs before iteration (to avoid mutation during loop)
    const parentIds = Array.from(this.pendingByParent.keys());
    for (const parentId of parentIds) {
      this.flushParent(parentId);
    }
  }

  /**
   * Clear all pending notifications without flushing.
   *
   * Cancels all timers and discards pending notifications.
   * Use this for cleanup when notifications are no longer needed.
   */
  clear(): void {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.pendingByParent.clear();
  }

  /**
   * Get the event bus for external subscription.
   *
   * Use this to subscribe to notification events:
   * - 'background_task_completed': Individual task completion
   * - 'background_tasks_batch': Batch notification
   *
   * @returns The HookEventBus instance
   */
  getEventBus(): HookEventBus {
    return this.eventBus;
  }

  /**
   * Get configuration values (for testing/debugging).
   *
   * @returns Current configuration
   */
  getConfig(): Required<NotificationConfig> {
    return { ...this.config };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new NotificationManager instance.
 *
 * Factory function following project patterns.
 *
 * @param config - Optional configuration overrides
 * @param eventBus - Optional shared event bus
 * @returns New NotificationManager instance
 *
 * @example
 * ```typescript
 * import { createNotificationManager } from './notifications.js';
 *
 * // With defaults
 * const manager = createNotificationManager();
 *
 * // With custom config
 * const customManager = createNotificationManager({
 *   batchWindow: 2000,
 *   maxBatchSize: 10,
 * });
 * ```
 */
export function createNotificationManager(
  config?: NotificationConfig,
  eventBus?: HookEventBus
): NotificationManager {
  return new NotificationManager(config, eventBus);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format a human-readable notification message.
 *
 * Creates a summary string suitable for display to users.
 *
 * @param count - Total number of tasks
 * @param completedCount - Number of successfully completed tasks
 * @param failedCount - Number of failed tasks
 * @returns Formatted notification string
 *
 * @example
 * ```typescript
 * formatBatchNotification(5, 4, 1);
 * // => "5 background tasks finished: 4 completed, 1 failed."
 *
 * formatBatchNotification(3, 3, 0);
 * // => "3 background tasks completed successfully."
 * ```
 */
export function formatBatchNotification(
  count: number,
  completedCount: number,
  failedCount: number
): string {
  const plural = count > 1 ? 's' : '';

  if (failedCount === 0) {
    return `${count} background task${plural} completed successfully.`;
  }

  if (completedCount === 0) {
    return `${count} background task${plural} failed.`;
  }

  return `${count} background task${plural} finished: ${completedCount} completed, ${failedCount} failed.`;
}
