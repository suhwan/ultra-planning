/**
 * Stability Detector
 *
 * Detects when background tasks become idle for automatic completion.
 * Uses a polling-based approach that monitors message count changes
 * and triggers completion after consecutive stable polls.
 *
 * Features:
 * - Minimum runtime before stability detection (10 seconds)
 * - Consecutive stable polls for completion (3 polls = 6+ seconds at 2s interval)
 * - Stale timeout for tasks with no progress (3 minutes)
 * - TTL enforcement for runaway tasks (30 minutes)
 * - Pluggable message count provider for different session backends
 *
 * @module orchestration/background
 */

import type { BackgroundTask } from './types.js';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for stability detection.
 */
export interface StabilityConfig {
  /** Minimum milliseconds before stability detection activates (default: 10000) */
  minStabilityTimeMs?: number;
  /** Consecutive stable polls needed to trigger completion (default: 3) */
  stabilityThreshold?: number;
  /** Milliseconds before task is considered stale (default: 180000 = 3 min) */
  staleTimeoutMs?: number;
  /** Minimum runtime before stale check (default: 30000 = 30 sec) */
  minRuntimeBeforeStaleMs?: number;
  /** Task TTL in milliseconds (default: 1800000 = 30 min) */
  taskTtlMs?: number;
}

/**
 * Default configuration matching oh-my-opencode behavior.
 */
const DEFAULT_STABILITY_CONFIG: Required<StabilityConfig> = {
  minStabilityTimeMs: 10_000,       // 10 seconds
  stabilityThreshold: 3,            // 3 stable polls
  staleTimeoutMs: 180_000,          // 3 minutes
  minRuntimeBeforeStaleMs: 30_000,  // 30 seconds
  taskTtlMs: 30 * 60 * 1000,        // 30 minutes
};

// ============================================================================
// Poll Result
// ============================================================================

/**
 * Result from polling a task for stability.
 */
export interface PollResult {
  /** Task ID that was polled */
  taskId: string;
  /** Action to take based on poll result */
  action: 'complete' | 'stale' | 'expired' | 'continue';
  /** Human-readable reason for the action */
  reason?: string;
}

// ============================================================================
// Stability Detector
// ============================================================================

/**
 * Message count provider function type.
 * Returns the current message count for a task, or null if session not found.
 */
export type MessageCountProvider = (taskId: string) => Promise<number | null>;

/**
 * StabilityDetector monitors background tasks for idle state.
 *
 * It uses a combination of techniques to detect when a task should complete:
 *
 * 1. **Message count stability**: If the message count doesn't change for
 *    `stabilityThreshold` consecutive polls, the task is considered idle.
 *
 * 2. **Stale timeout**: If `progress.lastUpdate` doesn't change for
 *    `staleTimeoutMs`, the task is considered stale and should error.
 *
 * 3. **TTL enforcement**: Tasks running longer than `taskTtlMs` are
 *    force-expired to prevent runaway execution.
 *
 * @example
 * ```typescript
 * const detector = createStabilityDetector({
 *   stabilityThreshold: 3,  // 3 stable polls
 *   staleTimeoutMs: 180_000, // 3 minute stale timeout
 * });
 *
 * // Set message count provider
 * detector.setMessageCountProvider(async (taskId) => {
 *   const session = await getSession(taskId);
 *   return session?.messages.length ?? null;
 * });
 *
 * // Poll a running task
 * const result = await detector.poll(task);
 * if (result.action === 'complete') {
 *   manager.completeTask(task.id, result.reason);
 * }
 * ```
 */
export class StabilityDetector {
  private config: Required<StabilityConfig>;
  private msgCountProvider?: MessageCountProvider;

  /**
   * Create a new StabilityDetector.
   *
   * @param config - Optional configuration overrides
   */
  constructor(config?: StabilityConfig) {
    this.config = { ...DEFAULT_STABILITY_CONFIG, ...config };
  }

  /**
   * Set provider for getting current message count for a task.
   *
   * The provider should return:
   * - Number: Current message count
   * - null: Session not found (triggers completion)
   *
   * @param provider - Async function that returns message count
   */
  setMessageCountProvider(provider: MessageCountProvider): void {
    this.msgCountProvider = provider;
  }

  /**
   * Poll a task and determine if it should be completed, marked stale, or continue.
   *
   * Checks are performed in this order:
   * 1. Skip non-running tasks
   * 2. Check TTL expiration (immediate expiry)
   * 3. Check stale timeout (after minimum runtime)
   * 4. Check message count stability (after minimum stability time)
   *
   * @param task - Task to poll
   * @returns Poll result with action to take
   */
  async poll(task: BackgroundTask): Promise<PollResult> {
    const now = Date.now();

    // Skip non-running tasks
    if (task.status !== 'running') {
      return { taskId: task.id, action: 'continue' };
    }

    const startedAt = task.startedAt?.getTime() ?? now;
    const elapsed = now - startedAt;

    // Check TTL expiration
    if (elapsed > this.config.taskTtlMs) {
      return {
        taskId: task.id,
        action: 'expired',
        reason: `Task exceeded TTL of ${this.config.taskTtlMs / 1000}s`,
      };
    }

    // Check stale timeout (only after minimum runtime)
    if (elapsed > this.config.minRuntimeBeforeStaleMs) {
      const lastUpdate = task.progress?.lastUpdate?.getTime() ?? startedAt;
      const timeSinceUpdate = now - lastUpdate;

      if (timeSinceUpdate > this.config.staleTimeoutMs) {
        return {
          taskId: task.id,
          action: 'stale',
          reason: `No progress for ${this.config.staleTimeoutMs / 1000}s`,
        };
      }
    }

    // Check stability (only after minimum stability time)
    if (elapsed > this.config.minStabilityTimeMs) {
      const stabilityResult = await this.checkStability(task);
      if (stabilityResult) {
        return stabilityResult;
      }
    }

    return { taskId: task.id, action: 'continue' };
  }

  /**
   * Check message count stability for a task.
   *
   * Compares current message count with last known count.
   * If unchanged, increments stable poll counter.
   * When threshold is reached, returns completion result.
   *
   * @param task - Task to check (mutated with stability counters)
   * @returns PollResult if stable, null to continue polling
   */
  private async checkStability(task: BackgroundTask): Promise<PollResult | null> {
    if (!this.msgCountProvider) {
      // No provider - cannot do message-based completion
      // Rely on stale timeout and TTL only
      return null;
    }

    const currentMsgCount = await this.msgCountProvider(task.id);

    if (currentMsgCount === null) {
      // Session not found - may have terminated
      return {
        taskId: task.id,
        action: 'complete',
        reason: 'Session terminated',
      };
    }

    // Compare with last known count
    if (task.lastMsgCount === currentMsgCount) {
      // Count is stable - increment stable polls
      const stablePolls = (task.stablePolls ?? 0) + 1;

      if (stablePolls >= this.config.stabilityThreshold) {
        return {
          taskId: task.id,
          action: 'complete',
          reason: `Message count stable for ${stablePolls} polls`,
        };
      }

      // Update task state (caller must persist)
      task.stablePolls = stablePolls;
    } else {
      // Count changed - reset stability counter
      task.lastMsgCount = currentMsgCount;
      task.stablePolls = 0;
    }

    return null;
  }

  /**
   * Reset stability tracking for a task.
   *
   * Call this when a task starts or resumes to clear any
   * stale stability state from a previous run.
   *
   * @param task - Task to reset (mutated)
   */
  resetStability(task: BackgroundTask): void {
    task.stablePolls = 0;
    task.lastMsgCount = undefined;
  }

  /**
   * Get current configuration.
   *
   * @returns Copy of the current config
   */
  getConfig(): Required<StabilityConfig> {
    return { ...this.config };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Factory function for creating StabilityDetector.
 *
 * @param config - Optional configuration overrides
 * @returns New StabilityDetector instance
 */
export function createStabilityDetector(config?: StabilityConfig): StabilityDetector {
  return new StabilityDetector(config);
}
