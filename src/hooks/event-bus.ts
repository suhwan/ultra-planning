/**
 * Hook Event Bus
 *
 * Event bus that bridges hooks with the existing EventSystem.
 * Provides pub/sub pattern for hook-to-hook and hook-to-system
 * communication.
 *
 * Key features:
 * - Subscribe/unsubscribe pattern with cleanup functions
 * - Dispatch events to all listeners of an event type
 * - Integration with existing EventSystem via emitToEventSystem()
 *
 * @module hooks/event-bus
 *
 * @example
 * import { createHookEventBus } from './hooks';
 *
 * const eventBus = createHookEventBus();
 *
 * // Subscribe to events
 * const unsubscribe = eventBus.subscribe('tool:executed', (payload) => {
 *   console.log('Tool executed:', payload);
 * });
 *
 * // Dispatch events
 * eventBus.dispatch('tool:executed', { toolName: 'Write', success: true });
 *
 * // Cleanup
 * unsubscribe();
 */

import { emitEvent } from '../state/event-system.js';
import type { StateEvent } from '../state/types.js';
import type { HookEventListener } from './types.js';

// ============================================================================
// HookEventBus Class
// ============================================================================

/**
 * Event bus for hook event propagation.
 *
 * Supports:
 * - Internal pub/sub between hooks
 * - Forwarding to existing EventSystem
 * - Async listener support
 */
export class HookEventBus {
  /** Map of event types to their listener sets */
  private listeners: Map<string, Set<HookEventListener>> = new Map();

  /**
   * Subscribe to an event type.
   *
   * Returns an unsubscribe function for cleanup.
   *
   * @param eventType - Event type to subscribe to
   * @param listener - Callback function to invoke
   * @returns Unsubscribe function
   *
   * @example
   * const unsubscribe = eventBus.subscribe('hook:initialized', (payload) => {
   *   console.log('Hook initialized:', payload);
   * });
   *
   * // Later...
   * unsubscribe();
   */
  subscribe(eventType: string, listener: HookEventListener): () => void {
    // Get or create listener set for this event type
    let listenerSet = this.listeners.get(eventType);
    if (!listenerSet) {
      listenerSet = new Set();
      this.listeners.set(eventType, listenerSet);
    }

    // Add the listener
    listenerSet.add(listener);

    // Return unsubscribe function
    return () => {
      listenerSet?.delete(listener);

      // Clean up empty sets
      if (listenerSet?.size === 0) {
        this.listeners.delete(eventType);
      }
    };
  }

  /**
   * Dispatch an event to all listeners of that type.
   *
   * Calls listeners synchronously but supports async listeners
   * (errors are logged but do not stop other listeners).
   *
   * @param eventType - Event type to dispatch
   * @param payload - Event payload data
   *
   * @example
   * eventBus.dispatch('task:completed', {
   *   taskId: 'task-1',
   *   success: true,
   *   duration: 1234
   * });
   */
  dispatch(eventType: string, payload: unknown): void {
    const listenerSet = this.listeners.get(eventType);
    if (!listenerSet || listenerSet.size === 0) {
      return;
    }

    // Call each listener
    for (const listener of listenerSet) {
      try {
        const result = listener(payload);

        // Handle async listeners (fire and forget, but log errors)
        if (result instanceof Promise) {
          result.catch((error) => {
            console.error(`[HookEventBus] Async listener error for "${eventType}":`, error);
          });
        }
      } catch (error) {
        // Log error but continue with other listeners
        console.error(`[HookEventBus] Listener error for "${eventType}":`, error);
      }
    }
  }

  /**
   * Emit an event to the existing EventSystem.
   *
   * Bridges hook events with the state event system for
   * persistence and cross-component communication.
   *
   * @param event - Event data (id and timestamp will be added)
   * @returns The complete StateEvent with id and timestamp
   *
   * @example
   * eventBus.emitToEventSystem({
   *   type: 'task_completed',
   *   payload: { taskId: 'task-1', success: true },
   *   source: 'hook:my-hook'
   * });
   */
  emitToEventSystem(event: Omit<StateEvent, 'id' | 'timestamp'>): StateEvent {
    return emitEvent(event);
  }

  /**
   * Check if there are any listeners for an event type.
   *
   * @param eventType - Event type to check
   * @returns True if there are listeners
   */
  hasListeners(eventType: string): boolean {
    const listenerSet = this.listeners.get(eventType);
    return listenerSet !== undefined && listenerSet.size > 0;
  }

  /**
   * Get the count of listeners for an event type.
   *
   * @param eventType - Event type to check
   * @returns Number of listeners
   */
  getListenerCount(eventType: string): number {
    const listenerSet = this.listeners.get(eventType);
    return listenerSet?.size ?? 0;
  }

  /**
   * Get all subscribed event types.
   *
   * @returns Array of event type strings
   */
  getEventTypes(): string[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Remove all listeners for a specific event type.
   *
   * @param eventType - Event type to clear
   */
  clearEventType(eventType: string): void {
    this.listeners.delete(eventType);
  }

  /**
   * Remove all listeners for all event types.
   */
  clearAll(): void {
    this.listeners.clear();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new HookEventBus instance.
 *
 * Factory function following oh-my-opencode patterns.
 *
 * @returns New HookEventBus instance
 *
 * @example
 * import { createHookEventBus } from './hooks';
 *
 * const eventBus = createHookEventBus();
 */
export function createHookEventBus(): HookEventBus {
  return new HookEventBus();
}
