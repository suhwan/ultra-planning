/**
 * Session Notification Hook
 *
 * Emits notification events for session lifecycle events.
 * Useful for desktop notifications, logging, or alerting systems.
 *
 * Features:
 * - Idle timeout detection with configurable duration
 * - Error notification on session errors
 * - Automatic cleanup on session deletion
 * - Per-session timer management
 *
 * @module hooks/session/session-notification
 */

import type {
  HookContext,
  HookHandlers,
  EventInput,
  EventOutput,
  SessionIdleInput,
  SessionIdleOutput,
  SessionErrorInput,
  SessionErrorOutput,
  SessionDeletedInput,
  SessionDeletedOutput,
} from '../types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration options for the session notification hook.
 */
export interface SessionNotificationOptions {
  /** Notify on session idle (default: true) */
  notifyOnIdle?: boolean;
  /** Notify on session error (default: true) */
  notifyOnError?: boolean;
  /** Idle timeout in milliseconds before notification (default: 30000) */
  idleTimeoutMs?: number;
}

// ============================================================================
// Constants
// ============================================================================

const HOOK_NAME = 'session-notification';

/** Default idle timeout in milliseconds */
const DEFAULT_IDLE_TIMEOUT_MS = 30000;

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a session notification hook.
 *
 * This hook monitors session lifecycle events and emits
 * notification events for idle detection and error handling.
 *
 * @param ctx - Hook context with state manager and event emitter
 * @param options - Configuration options
 * @returns HookHandlers with session lifecycle handlers
 *
 * @example
 * const hook = createSessionNotificationHook(ctx, {
 *   notifyOnIdle: true,
 *   notifyOnError: true,
 *   idleTimeoutMs: 60000, // 1 minute
 * });
 */
export function createSessionNotificationHook(
  ctx: HookContext,
  options: SessionNotificationOptions = {}
): HookHandlers {
  const {
    notifyOnIdle = true,
    notifyOnError = true,
    idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
  } = options;

  /** Per-session idle timers */
  const idleTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Clear idle timer for a session.
   */
  function clearIdleTimer(sessionId: string): void {
    const timer = idleTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      idleTimers.delete(sessionId);
    }
  }

  /**
   * Start idle timer for a session.
   */
  function startIdleTimer(sessionId: string): void {
    // Clear existing timer
    clearIdleTimer(sessionId);

    // Start new timer
    const timer = setTimeout(() => {
      // Emit notification event
      ctx.emitEvent({
        type: 'session_idle_notification',
        payload: {
          sessionId,
          idleDuration: idleTimeoutMs,
        },
        source: `hook:${HOOK_NAME}`,
      });

      // Clean up
      idleTimers.delete(sessionId);
    }, idleTimeoutMs);

    idleTimers.set(sessionId, timer);
  }

  /**
   * Handler for generic events.
   */
  async function eventHandler(input: EventInput): Promise<EventOutput | void> {
    const { event, sessionId } = input;
    const eventType = event.type;
    const payload = event.payload as Record<string, unknown> | undefined;

    // Handle session idle
    if (eventType === 'session_idle' && notifyOnIdle) {
      startIdleTimer(sessionId);
      return { handled: true };
    }

    // Handle session error
    if (eventType === 'session_error' && notifyOnError) {
      const error = payload?.error;

      ctx.emitEvent({
        type: 'session_error_notification',
        payload: {
          sessionId,
          error: typeof error === 'string' ? error : JSON.stringify(error),
        },
        source: `hook:${HOOK_NAME}`,
      });

      // Clear idle timer on error
      clearIdleTimer(sessionId);
      return { handled: true };
    }

    // Handle session deleted
    if (eventType === 'session_deleted') {
      clearIdleTimer(sessionId);
      return { handled: true };
    }

    // Handle activity events (cancel idle timer)
    if (
      eventType === 'message_updated' ||
      eventType === 'tool_execute_before' ||
      eventType === 'tool_execute_after'
    ) {
      clearIdleTimer(sessionId);
      return { handled: true };
    }

    return { handled: false };
  }

  /**
   * Handler for session.idle events.
   */
  async function sessionIdleHandler(
    input: SessionIdleInput
  ): Promise<SessionIdleOutput | void> {
    if (!notifyOnIdle) {
      return { action: 'continue' };
    }

    startIdleTimer(input.sessionId);
    return { action: 'continue' };
  }

  /**
   * Handler for session.error events.
   */
  async function sessionErrorHandler(
    input: SessionErrorInput
  ): Promise<SessionErrorOutput | void> {
    if (!notifyOnError) {
      return { handled: false };
    }

    ctx.emitEvent({
      type: 'session_error_notification',
      payload: {
        sessionId: input.sessionId,
        error: input.error,
        code: input.code,
        recoverable: input.recoverable,
      },
      source: `hook:${HOOK_NAME}`,
    });

    clearIdleTimer(input.sessionId);
    return { handled: true };
  }

  /**
   * Handler for session.deleted events.
   */
  async function sessionDeletedHandler(
    input: SessionDeletedInput
  ): Promise<SessionDeletedOutput | void> {
    clearIdleTimer(input.sessionId);
    return { cleanedUp: ['idle-timers'] };
  }

  return {
    event: eventHandler,
    'session.idle': sessionIdleHandler,
    'session.error': sessionErrorHandler,
    'session.deleted': sessionDeletedHandler,
  };
}
