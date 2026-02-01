/**
 * Background Manager
 *
 * Central coordinator for background task lifecycle management with
 * queue-based launch, concurrency control, and state persistence.
 *
 * Features:
 * - Queue-based task launch with pending -> running transitions
 * - Model-tiered concurrency control via ConcurrencyManager
 * - State persistence across process restarts
 * - Callbacks for task lifecycle events
 * - Singleton pattern for global access
 *
 * @module orchestration/background
 */

import { v4 as uuid } from 'uuid';
import { ConcurrencyManager } from './concurrency.js';
import { NotificationManager, createNotificationManager } from './notifications.js';
import { loadBackgroundState, saveBackgroundState, clearBackgroundState } from './state.js';
import { StabilityDetector, createStabilityDetector, type StabilityConfig } from './stability.js';
import type {
  BackgroundTask,
  BackgroundTaskStatus,
  LaunchInput,
  BackgroundConfig,
  BackgroundState,
  SerializedBackgroundTask,
} from './types.js';
import { DEFAULT_BACKGROUND_CONFIG } from './types.js';
import type { HookEventBus } from '../../hooks/event-bus.js';

/**
 * Item in the task queue awaiting execution.
 */
interface QueueItem {
  task: BackgroundTask;
  input: LaunchInput;
}

/**
 * Callback invoked when a task completes (success, error, or cancelled).
 */
export type TaskCompleteCallback = (task: BackgroundTask) => void;

/**
 * Callback invoked when a task starts running.
 */
export type TaskStartCallback = (task: BackgroundTask) => void;

/**
 * Serialize a BackgroundTask for state persistence.
 * Converts Date objects to ISO strings.
 */
function serializeTask(task: BackgroundTask): SerializedBackgroundTask {
  return {
    ...task,
    queuedAt: task.queuedAt?.toISOString(),
    startedAt: task.startedAt?.toISOString(),
    completedAt: task.completedAt?.toISOString(),
    progress: task.progress
      ? {
          toolCalls: task.progress.toolCalls,
          lastTool: task.progress.lastTool,
          lastUpdate: task.progress.lastUpdate.toISOString(),
          lastMessage: task.progress.lastMessage,
          lastMessageAt: task.progress.lastMessageAt?.toISOString(),
        }
      : undefined,
  };
}

/**
 * Deserialize a BackgroundTask from state persistence.
 * Converts ISO strings back to Date objects.
 */
function deserializeTask(serialized: SerializedBackgroundTask): BackgroundTask {
  return {
    ...serialized,
    queuedAt: serialized.queuedAt ? new Date(serialized.queuedAt) : undefined,
    startedAt: serialized.startedAt ? new Date(serialized.startedAt) : undefined,
    completedAt: serialized.completedAt ? new Date(serialized.completedAt) : undefined,
    progress: serialized.progress
      ? {
          toolCalls: serialized.progress.toolCalls,
          lastTool: serialized.progress.lastTool,
          lastUpdate: new Date(serialized.progress.lastUpdate),
          lastMessage: serialized.progress.lastMessage,
          lastMessageAt: serialized.progress.lastMessageAt
            ? new Date(serialized.progress.lastMessageAt)
            : undefined,
        }
      : undefined,
  };
}

/**
 * Background Manager
 *
 * Manages the lifecycle of background tasks from launch to completion.
 * Integrates with ConcurrencyManager for model-based rate limiting.
 *
 * @example
 * ```typescript
 * const manager = getBackgroundManager();
 *
 * // Launch a task
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
 */
export class BackgroundManager {
  private config: Required<BackgroundConfig>;
  private concurrencyManager: ConcurrencyManager;
  private stabilityDetector: StabilityDetector;
  private notificationManager: NotificationManager;
  private tasks: Map<string, BackgroundTask> = new Map();
  private queues: Map<string, QueueItem[]> = new Map();
  private processing: Set<string> = new Set();
  private pollInterval?: ReturnType<typeof setInterval>;
  private isPolling = false;
  private onTaskComplete?: TaskCompleteCallback;
  private onTaskStart?: TaskStartCallback;

  /**
   * Create a new BackgroundManager.
   *
   * @param config - Optional configuration overrides
   */
  constructor(config?: Partial<BackgroundConfig>) {
    this.config = {
      ...DEFAULT_BACKGROUND_CONFIG,
      ...config,
      modelConcurrency: {
        ...DEFAULT_BACKGROUND_CONFIG.modelConcurrency,
        ...config?.modelConcurrency,
      },
    };
    this.concurrencyManager = new ConcurrencyManager(this.config);
    this.stabilityDetector = createStabilityDetector({
      minStabilityTimeMs: config?.minStabilityTimeMs ?? 10_000,
      stabilityThreshold: config?.stabilityThreshold ?? 3,
      staleTimeoutMs: config?.staleTimeoutMs ?? 180_000,
      minRuntimeBeforeStaleMs: config?.minRuntimeBeforeStaleMs ?? 30_000,
      taskTtlMs: config?.taskTtlMs ?? 30 * 60 * 1000,
    });
    this.notificationManager = createNotificationManager({
      batchWindow: config?.notificationBatchWindow ?? 1000,
      maxBatchSize: config?.notificationMaxBatch ?? 5,
    });
    this.loadState();
  }

  /**
   * Load persisted state on startup.
   *
   * Restores tasks from the state file and rebuilds the in-memory map.
   * Note: Running tasks are marked as error (stale) since they can't be resumed.
   */
  private loadState(): void {
    const state = loadBackgroundState();
    if (state) {
      for (const [id, serialized] of Object.entries(state.tasks)) {
        const task = deserializeTask(serialized);

        // Mark previously running tasks as error (process restart means they're stale)
        if (task.status === 'running') {
          task.status = 'error';
          task.error = 'Task interrupted by process restart';
          task.completedAt = new Date();
        }

        this.tasks.set(id, task);
      }
    }
  }

  /**
   * Persist current state to disk.
   *
   * Called after every state change to ensure durability.
   */
  private persistState(): void {
    const serializedTasks: Record<string, SerializedBackgroundTask> = {};
    const activeCount: Record<string, number> = {};

    for (const [id, task] of this.tasks) {
      serializedTasks[id] = serializeTask(task);

      // Track active count per concurrency key
      if (task.status === 'running' && task.concurrencyKey) {
        activeCount[task.concurrencyKey] = (activeCount[task.concurrencyKey] ?? 0) + 1;
      }
    }

    const state: BackgroundState = {
      tasks: serializedTasks,
      activeCount,
      lastUpdated: new Date().toISOString(),
    };

    saveBackgroundState(state);
  }

  /**
   * Launch a new background task.
   *
   * Creates a task in 'pending' status and queues it for execution.
   * Task transitions to 'running' when a concurrency slot becomes available.
   *
   * @param input - Task launch parameters
   * @returns The created task (status will be 'pending' or 'running')
   */
  async launch(input: LaunchInput): Promise<BackgroundTask> {
    const id = `bg-${uuid()}`;
    const concurrencyKey = input.model ?? 'sonnet'; // default to sonnet tier

    const task: BackgroundTask = {
      id,
      parentSessionId: input.parentSessionId,
      parentMessageId: input.parentMessageId,
      description: input.description,
      prompt: input.prompt,
      agent: input.agent,
      status: 'pending',
      queuedAt: new Date(),
      concurrencyKey,
    };

    this.tasks.set(id, task);
    this.persistState();

    // Add to queue for this concurrency key
    const queue = this.queues.get(concurrencyKey) ?? [];
    queue.push({ task, input });
    this.queues.set(concurrencyKey, queue);

    // Trigger queue processing (fire-and-forget)
    this.processQueue(concurrencyKey).catch((error) => {
      console.error('[BackgroundManager] Queue processing error:', error);
    });

    return task;
  }

  /**
   * Process the queue for a concurrency key.
   *
   * Acquires slots and starts tasks until queue is empty.
   * Only one processor runs per key at a time.
   *
   * @param key - Concurrency key (model tier)
   */
  private async processQueue(key: string): Promise<void> {
    // Prevent multiple processors for same key
    if (this.processing.has(key)) return;
    this.processing.add(key);

    try {
      const queue = this.queues.get(key);

      while (queue && queue.length > 0) {
        // Acquire concurrency slot (blocks if at limit)
        await this.concurrencyManager.acquire(key);

        const item = queue.shift();
        if (!item) {
          // Queue emptied while waiting
          this.concurrencyManager.release(key);
          continue;
        }

        // Check if task was cancelled while queued
        if (item.task.status === 'cancelled') {
          this.concurrencyManager.release(key);
          continue;
        }

        // Start the task
        await this.startTask(item.task, item.input);
      }
    } finally {
      this.processing.delete(key);
    }
  }

  /**
   * Start a task (transition from pending to running).
   *
   * @param task - Task to start
   * @param _input - Original launch input (for future use)
   */
  private async startTask(task: BackgroundTask, _input: LaunchInput): Promise<void> {
    task.status = 'running';
    task.startedAt = new Date();
    task.progress = {
      toolCalls: 0,
      lastUpdate: new Date(),
    };
    this.stabilityDetector.resetStability(task);
    this.persistState();

    // Start polling if not already running
    if (!this.pollInterval) {
      this.startPolling();
    }

    // Notify callback
    if (this.onTaskStart) {
      this.onTaskStart(task);
    }

    // Note: Actual session spawning is handled by the orchestrator/integration layer.
    // This manager tracks the state transition. The caller is responsible for
    // actually executing the task (e.g., spawning a Claude session).
  }

  /**
   * Mark a task as completed successfully.
   *
   * Releases the concurrency slot and triggers completion callback.
   *
   * @param taskId - Task to complete
   * @param result - Optional result output
   * @returns Whether task was successfully completed
   */
  completeTask(taskId: string, result?: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'running') return false;

    task.status = 'completed';
    task.completedAt = new Date();
    task.result = result;

    // Release concurrency slot BEFORE notification
    if (task.concurrencyKey) {
      this.concurrencyManager.release(task.concurrencyKey);
    }

    this.persistState();

    // Notify parent session via NotificationManager
    this.notificationManager.notify(task);

    // Notify callback
    if (this.onTaskComplete) {
      this.onTaskComplete(task);
    }

    return true;
  }

  /**
   * Mark a task as failed with an error.
   *
   * Releases the concurrency slot and triggers completion callback.
   *
   * @param taskId - Task that failed
   * @param error - Error message
   * @returns Whether task was successfully marked as failed
   */
  failTask(taskId: string, error: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'running') return false;

    task.status = 'error';
    task.completedAt = new Date();
    task.error = error;

    // Release concurrency slot BEFORE notification
    if (task.concurrencyKey) {
      this.concurrencyManager.release(task.concurrencyKey);
    }

    this.persistState();

    // Notify parent session via NotificationManager
    this.notificationManager.notify(task);

    // Notify callback
    if (this.onTaskComplete) {
      this.onTaskComplete(task);
    }

    return true;
  }

  /**
   * Cancel a task.
   *
   * Can cancel both pending (queued) and running tasks.
   * Releases concurrency slot if task was running.
   *
   * @param taskId - Task to cancel
   * @returns Whether task was successfully cancelled
   */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    // Can't cancel already completed tasks
    if (task.status === 'completed' || task.status === 'error' || task.status === 'cancelled') {
      return false;
    }

    // Release concurrency slot if running
    if (task.status === 'running' && task.concurrencyKey) {
      this.concurrencyManager.release(task.concurrencyKey);
    }

    task.status = 'cancelled';
    task.completedAt = new Date();
    this.persistState();

    // Notify parent session via NotificationManager
    this.notificationManager.notify(task);

    // Notify callback
    if (this.onTaskComplete) {
      this.onTaskComplete(task);
    }

    return true;
  }

  /**
   * Get a task by ID.
   *
   * @param taskId - Task ID to look up
   * @returns Task or undefined if not found
   */
  getTask(taskId: string): BackgroundTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks.
   *
   * @returns Array of all tasks
   */
  getAllTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get tasks by status.
   *
   * @param status - Status to filter by
   * @returns Tasks with the given status
   */
  getTasksByStatus(status: BackgroundTaskStatus): BackgroundTask[] {
    return this.getAllTasks().filter((t) => t.status === status);
  }

  /**
   * Get all running tasks.
   *
   * Convenience method for getting currently executing tasks.
   *
   * @returns Running tasks
   */
  getRunningTasks(): BackgroundTask[] {
    return this.getTasksByStatus('running');
  }

  /**
   * Get tasks for a parent session.
   *
   * @param parentSessionId - Parent session to filter by
   * @returns Tasks spawned from the given parent
   */
  getTasksForParent(parentSessionId: string): BackgroundTask[] {
    return this.getAllTasks().filter((t) => t.parentSessionId === parentSessionId);
  }

  /**
   * Set callback for task completion.
   *
   * Callback is invoked for all terminal states: completed, error, cancelled.
   *
   * @param callback - Function to call on completion
   */
  onComplete(callback: TaskCompleteCallback): void {
    this.onTaskComplete = callback;
  }

  /**
   * Set callback for task start.
   *
   * Callback is invoked when task transitions from pending to running.
   *
   * @param callback - Function to call on start
   */
  onStart(callback: TaskStartCallback): void {
    this.onTaskStart = callback;
  }

  /**
   * Update task progress.
   *
   * Used for monitoring/stability detection.
   *
   * @param taskId - Task to update
   * @param progress - Partial progress update
   * @returns Whether update succeeded
   */
  updateProgress(
    taskId: string,
    progress: Partial<NonNullable<BackgroundTask['progress']>>,
  ): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'running') return false;

    const currentProgress = task.progress;

    task.progress = {
      toolCalls: progress.toolCalls ?? currentProgress?.toolCalls ?? 0,
      lastUpdate: new Date(),
      lastTool: progress.lastTool ?? currentProgress?.lastTool,
      lastMessage: progress.lastMessage ?? currentProgress?.lastMessage,
      lastMessageAt: progress.lastMessageAt ?? currentProgress?.lastMessageAt,
    };

    // Don't persist on every progress update (too frequent)
    // State is persisted on status changes

    return true;
  }

  /**
   * Start the stability polling loop.
   *
   * Polls all running tasks at regular intervals to check for
   * stability, stale timeout, or TTL expiration.
   *
   * @param intervalMs - Optional polling interval (defaults to config)
   */
  startPolling(intervalMs?: number): void {
    if (this.pollInterval) return;

    const interval = intervalMs ?? this.config.pollingIntervalMs ?? 2000;
    this.pollInterval = setInterval(() => {
      this.pollRunningTasks().catch((error) => {
        console.error('[BackgroundManager] Polling error:', error);
      });
    }, interval);
  }

  /**
   * Stop the stability polling loop.
   */
  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }
  }

  /**
   * Poll all running tasks for stability.
   *
   * Checks each running task and takes action based on poll result:
   * - complete: Mark task as completed
   * - stale: Mark task as error (stale)
   * - expired: Mark task as error (TTL exceeded)
   * - continue: Update task state and keep polling
   */
  private async pollRunningTasks(): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      const runningTasks = this.getTasksByStatus('running');

      for (const task of runningTasks) {
        const result = await this.stabilityDetector.poll(task);

        switch (result.action) {
          case 'complete':
            this.completeTask(task.id, `Auto-completed: ${result.reason}`);
            break;

          case 'stale':
            this.failTask(task.id, `Task stale: ${result.reason}`);
            break;

          case 'expired':
            this.failTask(task.id, `Task expired: ${result.reason}`);
            break;

          case 'continue':
            // Update task state if stability counters changed
            this.persistState();
            break;
        }
      }

      // Stop polling if no running tasks
      if (runningTasks.length === 0) {
        this.stopPolling();
      }
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Set message count provider for stability detection.
   *
   * The provider should return the current message count for a task's session,
   * or null if the session is not found.
   *
   * @param provider - Async function that returns message count
   */
  setMessageCountProvider(provider: (taskId: string) => Promise<number | null>): void {
    this.stabilityDetector.setMessageCountProvider(provider);
  }

  /**
   * Cleanup - clear all state.
   *
   * Releases all concurrency slots, clears queues, and removes state file.
   */
  clear(): void {
    // Stop polling first
    this.stopPolling();

    // Flush and clear notifications
    this.notificationManager.flushAll();
    this.notificationManager.clear();

    // Release slots for running tasks
    for (const task of this.tasks.values()) {
      if (task.status === 'running' && task.concurrencyKey) {
        this.concurrencyManager.release(task.concurrencyKey);
      }
    }

    this.concurrencyManager.clear();
    this.tasks.clear();
    this.queues.clear();
    this.processing.clear();
    clearBackgroundState();
  }

  /**
   * Get the concurrency manager instance.
   *
   * Exposed for testing and advanced usage.
   *
   * @returns ConcurrencyManager instance
   */
  getConcurrencyManager(): ConcurrencyManager {
    return this.concurrencyManager;
  }

  /**
   * Get the stability detector instance.
   *
   * Exposed for testing and advanced usage.
   *
   * @returns StabilityDetector instance
   */
  getStabilityDetector(): StabilityDetector {
    return this.stabilityDetector;
  }

  /**
   * Get the notification manager instance.
   *
   * Exposed for testing and advanced usage.
   *
   * @returns NotificationManager instance
   */
  getNotificationManager(): NotificationManager {
    return this.notificationManager;
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
    return this.notificationManager.getEventBus();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: BackgroundManager | null = null;

/**
 * Get the singleton BackgroundManager instance.
 *
 * Creates a new instance on first call with the given config.
 * Subsequent calls return the existing instance (config is ignored).
 *
 * @param config - Optional configuration (only used on first call)
 * @returns BackgroundManager singleton
 */
export function getBackgroundManager(config?: Partial<BackgroundConfig>): BackgroundManager {
  if (!instance) {
    instance = new BackgroundManager(config);
  }
  return instance;
}

/**
 * Reset the singleton BackgroundManager instance.
 *
 * Clears all state and destroys the singleton.
 * Next call to getBackgroundManager() will create a new instance.
 */
export function resetBackgroundManager(): void {
  if (instance) {
    instance.clear();
    instance = null;
  }
}
