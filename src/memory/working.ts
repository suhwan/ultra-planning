/**
 * WorkingMemoryManager - In-memory volatile task state
 *
 * Manages the current task context in memory only.
 * No file I/O - purely runtime state that is cleared on task completion.
 */

import { WorkingMemory, MemoryLayer } from './types.js';

/**
 * Manages working memory (volatile, current task only)
 *
 * Working memory is purely in-memory and is cleared when a task completes.
 * It holds the current task context for the active execution.
 */
export class WorkingMemoryManager {
  private memory: WorkingMemory | null = null;

  /**
   * Set the current task context
   *
   * @param planId - Plan identifier (e.g., "15-01")
   * @param taskId - Task identifier (e.g., "15-01-02")
   * @param context - Task-specific context data
   */
  setCurrentTask(
    planId: string,
    taskId: string,
    context: Record<string, unknown> = {}
  ): void {
    this.memory = {
      layer: MemoryLayer.Working,
      currentPlan: planId,
      currentTask: taskId,
      taskContext: context,
      volatile: true,
    };
  }

  /**
   * Get the current working memory
   *
   * @returns Current working memory or null if no active task
   */
  getCurrentTask(): WorkingMemory | null {
    return this.memory ? { ...this.memory } : null;
  }

  /**
   * Update task context with additional data
   *
   * @param updates - Additional context data to merge
   * @returns true if update succeeded, false if no active task
   */
  updateContext(updates: Record<string, unknown>): boolean {
    if (!this.memory) {
      return false;
    }

    this.memory.taskContext = {
      ...this.memory.taskContext,
      ...updates,
    };
    return true;
  }

  /**
   * Get a specific context value
   *
   * @param key - Context key to retrieve
   * @returns Context value or undefined if not found
   */
  getContextValue<T = unknown>(key: string): T | undefined {
    return this.memory?.taskContext[key] as T | undefined;
  }

  /**
   * Clear working memory on task completion
   *
   * Called when a task completes (success or failure) to reset state.
   */
  clearOnTaskComplete(): void {
    this.memory = null;
  }

  /**
   * Check if there is an active task
   *
   * @returns true if working memory has an active task
   */
  hasActiveTask(): boolean {
    return this.memory !== null;
  }

  /**
   * Get current plan ID
   *
   * @returns Current plan ID or null
   */
  getCurrentPlanId(): string | null {
    return this.memory?.currentPlan ?? null;
  }

  /**
   * Get current task ID
   *
   * @returns Current task ID or null
   */
  getCurrentTaskId(): string | null {
    return this.memory?.currentTask ?? null;
  }
}
