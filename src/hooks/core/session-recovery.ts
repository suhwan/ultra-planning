/**
 * Session Recovery Hook
 *
 * Handles session errors with retry logic for recoverable error types.
 * Tracks retry counts per session and emits recovery events for the
 * orchestrator to act on.
 *
 * Features:
 * - Configurable retry limits (default: 3 retries)
 * - Configurable retry delay (default: 1000ms)
 * - Customizable recoverable error types
 * - Per-session retry state tracking
 * - Recovery attempt events for orchestrator integration
 * - Automatic cleanup on session deletion
 *
 * Events Listened:
 * - session.error: Detect and attempt recovery
 * - session.deleted: Clean up session state
 *
 * Events Emitted:
 * - session_recovery_attempt: When recovery is being attempted
 * - session_recovery_failed: When recovery cannot proceed
 * - session_recovery_success: When recovery completed
 *
 * @module hooks/core/session-recovery
 */

import type {
  HookContext,
  HookHandlers,
  EventInput,
  EventOutput,
  SessionErrorInput,
  SessionErrorOutput,
} from '../types.js';
import { ExtendedSystemDirectiveTypes } from '../types.js';
import { SYSTEM_DIRECTIVE_PREFIX } from '../orchestrator/types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration options for the session recovery hook.
 */
export interface SessionRecoveryOptions {
  /** Maximum number of retries per session (default: 3) */
  maxRetries?: number;
  /** Delay before retry in milliseconds (default: 1000) */
  retryDelayMs?: number;
  /** Error types that can be recovered from */
  recoverableErrors?: string[];
  /** Cooldown period between retries in ms (default: 5000) */
  cooldownMs?: number;
}

/**
 * Per-session recovery state tracking.
 */
interface RecoveryState {
  /** Number of retry attempts made */
  retryCount: number;
  /** Last error type encountered */
  lastError?: string;
  /** Timestamp of last error */
  lastErrorAt?: number;
  /** Whether recovery is in progress */
  recovering: boolean;
  /** Timestamp of last recovery attempt */
  lastRecoveryAt?: number;
}

/**
 * Recovery attempt event payload.
 */
export interface RecoveryAttemptPayload {
  sessionId: string;
  retryCount: number;
  lastError?: string;
  recoveryHint?: string;
}

/**
 * Recovery failed event payload.
 */
export interface RecoveryFailedPayload {
  sessionId: string;
  error?: string;
  reason: 'non_recoverable_error' | 'max_retries_exceeded' | 'cooldown_active';
  retryCount?: number;
}

// ============================================================================
// Constants
// ============================================================================

const HOOK_NAME = 'session-recovery';

/** Default maximum retries per session */
const DEFAULT_MAX_RETRIES = 3;

/** Default delay before retry in milliseconds */
const DEFAULT_RETRY_DELAY_MS = 1000;

/** Default cooldown period between retries */
const DEFAULT_COOLDOWN_MS = 5000;

/**
 * Default error types that can be recovered from.
 * These represent transient failures that may succeed on retry.
 */
const DEFAULT_RECOVERABLE_ERRORS = [
  'RateLimitError',
  'NetworkError',
  'TimeoutError',
  'TransientError',
  'ServiceUnavailableError',
  'ConnectionError',
  'APIError',
];

/**
 * Recovery hints for specific error types.
 */
const RECOVERY_HINTS: Record<string, string> = {
  RateLimitError: 'Rate limit hit. Waiting before retry...',
  NetworkError: 'Network issue detected. Checking connectivity...',
  TimeoutError: 'Request timed out. Retrying with extended timeout...',
  TransientError: 'Temporary failure. Retrying...',
  ServiceUnavailableError: 'Service temporarily unavailable. Waiting...',
  ConnectionError: 'Connection lost. Attempting to reconnect...',
  APIError: 'API error encountered. Retrying request...',
};

/**
 * Create directive string for session recovery messages.
 */
function createSessionRecoveryDirective(): string {
  return `${SYSTEM_DIRECTIVE_PREFIX} - ${ExtendedSystemDirectiveTypes.SESSION_RECOVERY}]`;
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
 * Create a session recovery hook.
 *
 * This hook monitors session errors and attempts recovery for transient
 * failures. It tracks retry counts per session and emits events for the
 * orchestrator to coordinate recovery actions.
 *
 * @param ctx - Hook context with event emitter
 * @param options - Configuration options
 * @returns HookHandlers with event and session.error handlers
 *
 * @example
 * const hook = createSessionRecoveryHook(ctx, {
 *   maxRetries: 5,
 *   retryDelayMs: 2000,
 *   recoverableErrors: ['RateLimitError', 'TimeoutError'],
 * });
 */
export function createSessionRecoveryHook(
  ctx: HookContext,
  options: SessionRecoveryOptions = {}
): HookHandlers {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const recoverableErrors = options.recoverableErrors ?? DEFAULT_RECOVERABLE_ERRORS;
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;

  // Per-session recovery state tracking
  const sessionRecovery = new Map<string, RecoveryState>();

  // ==========================================================================
  // State Management
  // ==========================================================================

  /**
   * Get or create recovery state for a session.
   *
   * @param sessionId - Session identifier
   * @returns Recovery state object
   */
  function getRecoveryState(sessionId: string): RecoveryState {
    let state = sessionRecovery.get(sessionId);
    if (!state) {
      state = {
        retryCount: 0,
        recovering: false,
      };
      sessionRecovery.set(sessionId, state);
    }
    return state;
  }

  /**
   * Check if an error type is recoverable.
   *
   * @param errorName - Error type name
   * @returns Whether error can be recovered from
   */
  function isRecoverableError(errorName?: string): boolean {
    if (!errorName) return false;
    return recoverableErrors.some(
      (type) => errorName.includes(type) || type.includes(errorName)
    );
  }

  /**
   * Check if session is in cooldown period.
   *
   * @param state - Session recovery state
   * @returns Whether cooldown is active
   */
  function isInCooldown(state: RecoveryState): boolean {
    if (!state.lastRecoveryAt) return false;
    const elapsed = Date.now() - state.lastRecoveryAt;
    return elapsed < cooldownMs;
  }

  /**
   * Get recovery hint for error type.
   *
   * @param errorName - Error type name
   * @returns Recovery hint message
   */
  function getRecoveryHint(errorName?: string): string {
    if (!errorName) return 'Attempting recovery...';

    // Check for exact match
    if (RECOVERY_HINTS[errorName]) {
      return RECOVERY_HINTS[errorName];
    }

    // Check for partial match
    for (const [type, hint] of Object.entries(RECOVERY_HINTS)) {
      if (errorName.includes(type) || type.includes(errorName)) {
        return hint;
      }
    }

    return 'Attempting recovery...';
  }

  /**
   * Reset recovery state for a session (e.g., after successful recovery).
   *
   * @param sessionId - Session identifier
   */
  function resetRecoveryState(sessionId: string): void {
    const state = sessionRecovery.get(sessionId);
    if (state) {
      state.retryCount = 0;
      state.lastError = undefined;
      state.lastErrorAt = undefined;
      state.recovering = false;
    }
  }

  // ==========================================================================
  // Recovery Logic
  // ==========================================================================

  /**
   * Attempt recovery for a session error.
   *
   * @param sessionId - Session identifier
   * @param state - Current recovery state
   * @param errorName - Error type that triggered recovery
   */
  async function attemptRecovery(
    sessionId: string,
    state: RecoveryState,
    errorName?: string
  ): Promise<void> {
    const hint = getRecoveryHint(errorName);

    log('Attempting recovery', {
      sessionId,
      retryCount: state.retryCount,
      errorName,
      hint,
    });

    // Wait before emitting retry event
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));

    // Build recovery attempt payload
    const payload: RecoveryAttemptPayload = {
      sessionId,
      retryCount: state.retryCount,
      lastError: state.lastError,
      recoveryHint: hint,
    };

    // Emit recovery attempt event
    // The orchestrator listens to this and decides how to retry
    ctx.emitEvent({
      type: 'session_recovery_attempt',
      payload: payload as unknown as Record<string, unknown>,
      source: `hook:${HOOK_NAME}`,
    });

    // Update state
    state.lastRecoveryAt = Date.now();
    state.recovering = false;
  }

  /**
   * Emit recovery failed event.
   *
   * @param sessionId - Session identifier
   * @param reason - Failure reason
   * @param errorName - Error type
   * @param retryCount - Number of retries attempted
   */
  function emitRecoveryFailed(
    sessionId: string,
    reason: RecoveryFailedPayload['reason'],
    errorName?: string,
    retryCount?: number
  ): void {
    const payload: RecoveryFailedPayload = {
      sessionId,
      error: errorName,
      reason,
      retryCount,
    };

    log('Recovery failed', payload as unknown as Record<string, unknown>);

    ctx.emitEvent({
      type: 'session_recovery_failed',
      payload: payload as unknown as Record<string, unknown>,
      source: `hook:${HOOK_NAME}`,
    });
  }

  // ==========================================================================
  // Event Handlers
  // ==========================================================================

  /**
   * Handler for generic events.
   * Routes session.error and session.deleted events.
   */
  async function eventHandler(input: EventInput): Promise<EventOutput | void> {
    const { event, sessionId } = input;
    const eventType = event.type;
    const payload = event.payload as Record<string, unknown> | undefined;

    // -------------------------------------------------------------------------
    // session_error - Check and attempt recovery
    // -------------------------------------------------------------------------
    if (eventType === 'session_error') {
      const error = payload?.error as { name?: string; message?: string } | undefined;
      const errorName = error?.name || (payload?.code as string);

      if (!sessionId || !errorName) {
        log('Missing sessionId or error name in session_error event');
        return { handled: false };
      }

      // Check if error is recoverable
      if (!isRecoverableError(errorName)) {
        emitRecoveryFailed(sessionId, 'non_recoverable_error', errorName);
        return { handled: true };
      }

      const state = getRecoveryState(sessionId);

      // Check cooldown
      if (isInCooldown(state)) {
        log('Session in cooldown, skipping recovery', { sessionId });
        emitRecoveryFailed(sessionId, 'cooldown_active', errorName, state.retryCount);
        return { handled: true };
      }

      // Check retry limit
      if (state.retryCount >= maxRetries) {
        emitRecoveryFailed(sessionId, 'max_retries_exceeded', errorName, state.retryCount);
        return { handled: true };
      }

      // Update state and attempt recovery
      state.retryCount++;
      state.lastError = errorName;
      state.lastErrorAt = Date.now();
      state.recovering = true;

      // Attempt recovery (async, don't await to avoid blocking)
      attemptRecovery(sessionId, state, errorName).catch((err) => {
        log('Recovery attempt threw error', { sessionId, error: String(err) });
        state.recovering = false;
      });

      return { handled: true };
    }

    // -------------------------------------------------------------------------
    // session_deleted - Clean up recovery state
    // -------------------------------------------------------------------------
    if (eventType === 'session_deleted') {
      const sessionInfo = payload?.info as { id?: string } | undefined;
      const deletedSessionId = sessionInfo?.id || sessionId;

      if (deletedSessionId) {
        sessionRecovery.delete(deletedSessionId);
        log('Cleaned up recovery state', { sessionId: deletedSessionId });
      }

      return { handled: true };
    }

    // -------------------------------------------------------------------------
    // session_recovery_success - Reset retry count
    // -------------------------------------------------------------------------
    if (eventType === 'session_recovery_success') {
      const recoveredSessionId = (payload?.sessionId as string) || sessionId;
      if (recoveredSessionId) {
        resetRecoveryState(recoveredSessionId);
        log('Recovery successful, reset state', { sessionId: recoveredSessionId });
      }
      return { handled: true };
    }

    // Not handled by this hook
    return { handled: false };
  }

  /**
   * Handler for session.error events (typed interface).
   */
  async function sessionErrorHandler(
    input: SessionErrorInput
  ): Promise<SessionErrorOutput | void> {
    const { sessionId, error, code, recoverable } = input;

    // Use code or try to extract error name
    const errorName = code || 'UnknownError';

    // Check if marked as non-recoverable by caller
    if (!recoverable) {
      emitRecoveryFailed(sessionId, 'non_recoverable_error', errorName);
      return { handled: true, recovery: 'abort' };
    }

    // Check if error is in our recoverable list
    if (!isRecoverableError(errorName)) {
      emitRecoveryFailed(sessionId, 'non_recoverable_error', errorName);
      return { handled: true, recovery: 'abort' };
    }

    const state = getRecoveryState(sessionId);

    // Check cooldown
    if (isInCooldown(state)) {
      return { handled: true, recovery: 'ignore' };
    }

    // Check retry limit
    if (state.retryCount >= maxRetries) {
      emitRecoveryFailed(sessionId, 'max_retries_exceeded', errorName, state.retryCount);
      return { handled: true, recovery: 'abort' };
    }

    // Update state and attempt recovery
    state.retryCount++;
    state.lastError = errorName;
    state.lastErrorAt = Date.now();
    state.recovering = true;

    // Attempt recovery (async)
    attemptRecovery(sessionId, state, errorName).catch((err) => {
      log('Recovery attempt threw error', { sessionId, error: String(err) });
      state.recovering = false;
    });

    return {
      handled: true,
      recovery: 'retry',
      notification: getRecoveryHint(errorName),
    };
  }

  // ==========================================================================
  // Return Hook Handlers
  // ==========================================================================

  return {
    event: eventHandler,
    'session.error': sessionErrorHandler,
    'session.deleted': async (input) => {
      sessionRecovery.delete(input.sessionId);
      log('Session deleted, cleaned up', { sessionId: input.sessionId });
      return { cleanedUp: ['recovery-state'] };
    },
  };
}

/**
 * Create recovery message for display.
 *
 * @param payload - Recovery attempt payload
 * @returns Formatted recovery message
 */
export function formatRecoveryMessage(payload: RecoveryAttemptPayload): string {
  const { retryCount, lastError, recoveryHint } = payload;

  return `${createSessionRecoveryDirective()}

${recoveryHint || 'Attempting recovery...'}

[Recovery Status: Attempt ${retryCount}${lastError ? ` for ${lastError}` : ''}]`;
}

/**
 * Create failure message for display.
 *
 * @param payload - Recovery failed payload
 * @returns Formatted failure message
 */
export function formatFailureMessage(payload: RecoveryFailedPayload): string {
  const { error, reason, retryCount } = payload;

  const reasonMessages: Record<RecoveryFailedPayload['reason'], string> = {
    non_recoverable_error: 'Error is not recoverable automatically.',
    max_retries_exceeded: `Maximum retries (${retryCount}) exceeded.`,
    cooldown_active: 'Recovery is in cooldown period.',
  };

  return `${createSessionRecoveryDirective()}

Recovery failed: ${reasonMessages[reason]}
${error ? `Error type: ${error}` : ''}

Manual intervention may be required.`;
}
