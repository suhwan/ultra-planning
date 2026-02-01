/**
 * Concurrency Manager
 *
 * Provides model-tiered concurrent task limits with queue-based blocking
 * when limits are reached. Uses the settled-flag pattern to prevent
 * double-resolution race conditions.
 *
 * Limits (from MODEL_CONCURRENT_LIMITS):
 * - haiku: 5 concurrent tasks (fast, cheap)
 * - sonnet: 3 concurrent tasks (balanced)
 * - opus: 2 concurrent tasks (expensive)
 *
 * @module orchestration/background
 */

import type { BackgroundConfig } from './types.js';
import { DEFAULT_BACKGROUND_CONFIG } from './types.js';

/**
 * Queue entry with settled-flag pattern to prevent double-resolution.
 *
 * The settled flag ensures that cancelWaiters() doesn't reject
 * an entry that was already resolved by release().
 */
interface QueueEntry {
  resolve: () => void;
  rawReject: (error: Error) => void;
  settled: boolean;
}

/**
 * Manages concurrent task limits per model tier.
 *
 * Uses a queue-based approach where acquire() blocks when at the limit
 * and release() hands off slots to waiting acquires.
 *
 * @example
 * ```typescript
 * const manager = new ConcurrencyManager();
 *
 * // Acquire a slot (blocks if at limit)
 * await manager.acquire('opus');
 *
 * try {
 *   // Do work with the slot...
 * } finally {
 *   // Always release the slot
 *   manager.release('opus');
 * }
 * ```
 */
export class ConcurrencyManager {
  private config: Required<BackgroundConfig>;
  private counts: Map<string, number> = new Map();
  private queues: Map<string, QueueEntry[]> = new Map();

  /**
   * Create a new concurrency manager.
   *
   * @param config - Optional configuration overrides
   */
  constructor(config?: BackgroundConfig) {
    this.config = {
      ...DEFAULT_BACKGROUND_CONFIG,
      ...config,
      modelConcurrency: {
        ...DEFAULT_BACKGROUND_CONFIG.modelConcurrency,
        ...config?.modelConcurrency,
      },
    };
  }

  /**
   * Get the concurrency limit for a model tier.
   *
   * @param model - Model tier (haiku, sonnet, opus) or custom key
   * @returns Concurrency limit (Infinity if 0 is configured)
   */
  getConcurrencyLimit(model: string): number {
    const modelLimit = this.config.modelConcurrency?.[model];
    if (modelLimit !== undefined) {
      // 0 means unlimited/Infinity
      return modelLimit === 0 ? Infinity : modelLimit;
    }

    const defaultLimit = this.config.defaultConcurrency;
    if (defaultLimit !== undefined) {
      return defaultLimit === 0 ? Infinity : defaultLimit;
    }

    // Fallback to 3 if nothing configured
    return 3;
  }

  /**
   * Acquire a concurrency slot for a model.
   *
   * If under the limit, returns immediately.
   * If at the limit, blocks until a slot becomes available.
   *
   * @param model - Model tier to acquire slot for
   * @returns Promise that resolves when slot is acquired
   */
  async acquire(model: string): Promise<void> {
    const limit = this.getConcurrencyLimit(model);

    // Unlimited concurrency - no blocking needed
    if (limit === Infinity) {
      return;
    }

    const current = this.counts.get(model) ?? 0;

    // Slot available - increment and return
    if (current < limit) {
      this.counts.set(model, current + 1);
      return;
    }

    // At limit - queue and wait
    return new Promise<void>((resolve, reject) => {
      const queue = this.queues.get(model) ?? [];

      const entry: QueueEntry = {
        resolve: () => {
          if (entry.settled) return;
          entry.settled = true;
          resolve();
        },
        rawReject: reject,
        settled: false,
      };

      queue.push(entry);
      this.queues.set(model, queue);
    });
  }

  /**
   * Release a concurrency slot for a model.
   *
   * If there are waiting acquires, hands off the slot to the next waiter.
   * Otherwise, decrements the active count.
   *
   * @param model - Model tier to release slot for
   */
  release(model: string): void {
    const limit = this.getConcurrencyLimit(model);

    // Unlimited concurrency - nothing to release
    if (limit === Infinity) {
      return;
    }

    const queue = this.queues.get(model);

    // Try to hand off to a waiting entry (skip any settled entries from cancelWaiters)
    while (queue && queue.length > 0) {
      const next = queue.shift()!;
      if (!next.settled) {
        // Hand off the slot to this waiter (count stays the same)
        next.resolve();
        return;
      }
    }

    // No handoff occurred - decrement the count to free the slot
    const current = this.counts.get(model) ?? 0;
    if (current > 0) {
      this.counts.set(model, current - 1);
    }
  }

  /**
   * Cancel all waiting acquires for a model.
   *
   * Used during cleanup to reject pending waiters gracefully.
   *
   * @param model - Model tier to cancel waiters for
   */
  cancelWaiters(model: string): void {
    const queue = this.queues.get(model);
    if (queue) {
      for (const entry of queue) {
        if (!entry.settled) {
          entry.settled = true;
          entry.rawReject(new Error(`Concurrency queue cancelled for model: ${model}`));
        }
      }
      this.queues.delete(model);
    }
  }

  /**
   * Clear all state.
   *
   * Used during manager cleanup/shutdown.
   * Cancels all pending waiters and resets counts.
   */
  clear(): void {
    for (const [model] of this.queues) {
      this.cancelWaiters(model);
    }
    this.counts.clear();
    this.queues.clear();
  }

  /**
   * Get current active count for a model.
   *
   * @param model - Model tier to check
   * @returns Current number of active slots
   */
  getCount(model: string): number {
    return this.counts.get(model) ?? 0;
  }

  /**
   * Get queue length for a model.
   *
   * @param model - Model tier to check
   * @returns Number of waiters in queue
   */
  getQueueLength(model: string): number {
    return this.queues.get(model)?.length ?? 0;
  }
}
