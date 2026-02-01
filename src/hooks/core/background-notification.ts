/**
 * Background Notification Hook
 *
 * Batches background task completion notifications and emits aggregated events.
 * This hook collects completed tasks within a configurable time window and
 * emits a single notification event with batch statistics.
 *
 * Features:
 * - Configurable batch window (default: 1000ms)
 * - Maximum batch size trigger (default: 5 tasks)
 * - Per-session pending task tracking
 * - Automatic cleanup on session deletion
 * - Batch statistics (completed/failed counts)
 *
 * Events Listened:
 * - background_task_completed: Add task to pending batch
 * - session.deleted: Clear pending notifications for session
 *
 * Events Emitted:
 * - background_tasks_notification: Batch of completed tasks
 *
 * @module hooks/core/background-notification
 */

import type { HookContext, HookHandlers, EventInput, EventOutput } from '../types.js';
import { ExtendedSystemDirectiveTypes } from '../types.js';
import { SYSTEM_DIRECTIVE_PREFIX } from '../orchestrator/types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration options for the background notification hook.
 */
export interface BackgroundNotificationOptions {
  /** Milliseconds to batch notifications (default: 1000) */
  batchWindow?: number;
  /** Maximum notifications per batch before immediate flush (default: 5) */
  maxBatchSize?: number;
}

/**
 * Represents a completed background task.
 */
export interface CompletedTask {
  /** Unique task identifier */
  taskId: string;
  /** Session that owns this task */
  sessionId: string;
  /** Task completion status */
  status: 'completed' | 'failed';
  /** Task result (if completed) */
  result?: string;
  /** Error message (if failed) */
  error?: string;
  /** Timestamp when task completed */
  completedAt: number;
}

/**
 * Internal state for managing notification batches.
 */
interface NotificationState {
  /** Tasks waiting to be batched */
  pendingTasks: CompletedTask[];
  /** Timer for batch window */
  batchTimer?: ReturnType<typeof setTimeout>;
}

/**
 * Payload for background_tasks_notification event.
 */
export interface BackgroundTasksNotificationPayload {
  /** Array of completed tasks */
  tasks: CompletedTask[];
  /** Total count of tasks in batch */
  count: number;
  /** Number of successfully completed tasks */
  completedCount: number;
  /** Number of failed tasks */
  failedCount: number;
}

// ============================================================================
// Constants
// ============================================================================

const HOOK_NAME = 'background-notification';

/** Default batch window in milliseconds */
const DEFAULT_BATCH_WINDOW = 1000;

/** Default maximum batch size */
const DEFAULT_MAX_BATCH_SIZE = 5;

/**
 * Create directive string for background notification messages.
 */
function createBackgroundNotificationDirective(): string {
  return `${SYSTEM_DIRECTIVE_PREFIX} - ${ExtendedSystemDirectiveTypes.BACKGROUND_NOTIFICATION}]`;
}

/**
 * Log helper for debugging.
 */
function log(message: string, data?: Record<string, unknown>): void {
  console.log(`[${HOOK_NAME}] ${message}`, data ? JSON.stringify(data) : '');
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a background notification hook.
 *
 * This hook batches background task completions and emits aggregated
 * notification events. Tasks are collected within a time window and
 * flushed either when the window expires or when the batch reaches
 * maximum size.
 *
 * @param ctx - Hook context with event emitter
 * @param options - Configuration options
 * @returns HookHandlers with event handler
 *
 * @example
 * const hook = createBackgroundNotificationHook(ctx, {
 *   batchWindow: 2000,    // 2 second batching window
 *   maxBatchSize: 10,     // Flush after 10 tasks
 * });
 */
export function createBackgroundNotificationHook(
  ctx: HookContext,
  options: BackgroundNotificationOptions = {}
): HookHandlers {
  const batchWindow = options.batchWindow ?? DEFAULT_BATCH_WINDOW;
  const maxBatchSize = options.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;

  // Internal state for managing pending notifications
  const state: NotificationState = {
    pendingTasks: [],
    batchTimer: undefined,
  };

  // ==========================================================================
  // Batch Management
  // ==========================================================================

  /**
   * Flush pending notifications by emitting batch event.
   */
  function flushNotifications(): void {
    // Clear timer if active
    if (state.batchTimer) {
      clearTimeout(state.batchTimer);
      state.batchTimer = undefined;
    }

    // Skip if no pending tasks
    if (state.pendingTasks.length === 0) {
      return;
    }

    // Collect tasks and reset pending list
    const tasks = [...state.pendingTasks];
    state.pendingTasks = [];

    // Calculate statistics
    const completedCount = tasks.filter((t) => t.status === 'completed').length;
    const failedCount = tasks.filter((t) => t.status === 'failed').length;

    // Build payload
    const payload: BackgroundTasksNotificationPayload = {
      tasks,
      count: tasks.length,
      completedCount,
      failedCount,
    };

    log('Flushing notification batch', {
      count: tasks.length,
      completedCount,
      failedCount,
    });

    // Emit batch notification event
    ctx.emitEvent({
      type: 'background_tasks_notification',
      payload: payload as unknown as Record<string, unknown>,
      source: `hook:${HOOK_NAME}`,
    });
  }

  /**
   * Add a completed task to the pending batch.
   * Triggers immediate flush if batch reaches max size.
   *
   * @param task - Completed task to add
   */
  function addToPendingBatch(task: CompletedTask): void {
    state.pendingTasks.push(task);

    log('Task added to batch', {
      taskId: task.taskId,
      sessionId: task.sessionId,
      status: task.status,
      pendingCount: state.pendingTasks.length,
    });

    // Check if batch is full
    if (state.pendingTasks.length >= maxBatchSize) {
      log('Batch full, flushing immediately');
      flushNotifications();
      return;
    }

    // Start batch timer if not already running
    if (!state.batchTimer) {
      state.batchTimer = setTimeout(() => {
        flushNotifications();
      }, batchWindow);

      log('Batch timer started', { windowMs: batchWindow });
    }
  }

  /**
   * Remove all pending tasks for a specific session.
   *
   * @param sessionId - Session to clear
   */
  function clearSessionTasks(sessionId: string): void {
    const initialCount = state.pendingTasks.length;
    state.pendingTasks = state.pendingTasks.filter(
      (t) => t.sessionId !== sessionId
    );
    const removedCount = initialCount - state.pendingTasks.length;

    if (removedCount > 0) {
      log('Cleared session tasks', { sessionId, removedCount });
    }

    // If all tasks cleared, cancel timer
    if (state.pendingTasks.length === 0 && state.batchTimer) {
      clearTimeout(state.batchTimer);
      state.batchTimer = undefined;
    }
  }

  // ==========================================================================
  // Event Handler
  // ==========================================================================

  /**
   * Main event handler for the hook.
   * Handles background_task_completed and session.deleted events.
   */
  async function eventHandler(input: EventInput): Promise<EventOutput | void> {
    const { event, sessionId } = input;
    const eventType = event.type;
    const payload = event.payload as Record<string, unknown> | undefined;

    // -------------------------------------------------------------------------
    // background_task_completed - Add to pending batch
    // -------------------------------------------------------------------------
    if (eventType === 'background_task_completed') {
      const taskId = payload?.taskId as string | undefined;
      const taskSessionId = (payload?.sessionId as string) || sessionId;
      const status = (payload?.status as 'completed' | 'failed') || 'completed';
      const result = payload?.result as string | undefined;
      const error = payload?.error as string | undefined;

      if (!taskId) {
        log('Missing taskId in background_task_completed event');
        return { handled: false };
      }

      const task: CompletedTask = {
        taskId,
        sessionId: taskSessionId,
        status,
        result,
        error,
        completedAt: Date.now(),
      };

      addToPendingBatch(task);
      return { handled: true };
    }

    // -------------------------------------------------------------------------
    // session.deleted - Clear pending notifications for session
    // -------------------------------------------------------------------------
    if (eventType === 'session_deleted') {
      const sessionInfo = payload?.info as { id?: string } | undefined;
      const deletedSessionId = sessionInfo?.id || sessionId;

      if (deletedSessionId) {
        clearSessionTasks(deletedSessionId);
      }

      return { handled: true };
    }

    // Not handled by this hook
    return { handled: false };
  }

  // ==========================================================================
  // Return Hook Handlers
  // ==========================================================================

  return {
    event: eventHandler,
    'session.deleted': async (input) => {
      await eventHandler({
        event: {
          type: 'session_deleted',
          id: '',
          timestamp: new Date().toISOString(),
          payload: { info: { id: input.sessionId } },
          source: 'session',
        },
        sessionId: input.sessionId,
      });
      return { cleanedUp: ['pending-notifications'] };
    },
  };
}

/**
 * Create notification message for a batch of completed tasks.
 *
 * @param payload - Notification payload
 * @returns Formatted notification string
 */
export function formatNotificationMessage(
  payload: BackgroundTasksNotificationPayload
): string {
  const { count, completedCount, failedCount } = payload;

  if (failedCount === 0) {
    return `${createBackgroundNotificationDirective()}

${count} background task${count > 1 ? 's' : ''} completed successfully.`;
  }

  if (completedCount === 0) {
    return `${createBackgroundNotificationDirective()}

${count} background task${count > 1 ? 's' : ''} failed.`;
  }

  return `${createBackgroundNotificationDirective()}

${count} background task${count > 1 ? 's' : ''} finished: ${completedCount} completed, ${failedCount} failed.`;
}
