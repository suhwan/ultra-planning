/**
 * Error Recovery with Git Rollback Integration
 *
 * Provides error handling with checkpoint rollback and cooldown timer.
 * When errors occur during Ralph Loop execution:
 * 1. Increment error count and record error
 * 2. Check if max retries exceeded
 * 3. Roll back state files to last checkpoint (if available)
 * 4. Clear Ralph Loop state to allow retry
 * 5. Set cooldown timer before retry allowed
 * 6. Emit events for tracking
 *
 * IMPORTANT: Only rolls back .ultraplan/state/ directory, never source code.
 */

import { StateManager, StateLocation, emitEvent } from '../state/index.js';
import { getLatestCheckpoint, rollbackToCheckpoint } from '../state/checkpoint.js';
import { clearRalphLoopState } from '../loops/ralph/state.js';
import {
  RecoveryState,
  RecoveryConfig,
  RecoveryResult,
  DEFAULT_COOLDOWN_MS,
  DEFAULT_MAX_RETRIES,
  RECOVERY_STATE_FILE,
} from './types.js';

// ============================================================================
// Default State
// ============================================================================

/**
 * Default recovery state when no state file exists
 */
const DEFAULT_RECOVERY_STATE: RecoveryState = {
  isRecovering: false,
  lastErrorAt: null,
  errorCount: 0,
  lastError: null,
  cooldownUntil: null,
};

// ============================================================================
// State Manager Instance
// ============================================================================

/**
 * State manager instance for recovery state
 *
 * Uses LOCAL location so state is project-specific.
 * Path: .ultraplan/state/recovery.json
 */
const recoveryManager = new StateManager<RecoveryState>(
  RECOVERY_STATE_FILE,
  StateLocation.LOCAL
);

// ============================================================================
// State Operations
// ============================================================================

/**
 * Get current recovery state
 *
 * Returns the current recovery state from disk, or default state if
 * the state file doesn't exist.
 *
 * @returns Current recovery state
 *
 * @example
 * ```typescript
 * const state = getRecoveryState();
 * if (state.isRecovering) {
 *   console.log(`Recovering from error: ${state.lastError}`);
 * }
 * ```
 */
export function getRecoveryState(): RecoveryState {
  const result = recoveryManager.read();
  if (!result.exists || !result.data) {
    return { ...DEFAULT_RECOVERY_STATE };
  }
  return result.data;
}

/**
 * Update recovery state
 *
 * Merges partial state with existing state and persists to disk.
 *
 * @param state - Partial state to merge
 * @returns True if write succeeded
 *
 * @example
 * ```typescript
 * setRecoveryState({ errorCount: 0, isRecovering: false });
 * ```
 */
export function setRecoveryState(state: Partial<RecoveryState>): boolean {
  const current = getRecoveryState();
  const merged: RecoveryState = { ...current, ...state };
  return recoveryManager.write(merged).success;
}

/**
 * Clear recovery state by deleting the state file
 *
 * Call this when:
 * - Recovery completes successfully
 * - Manual reset requested
 * - Starting fresh
 *
 * @returns True if deletion succeeded (or file didn't exist)
 *
 * @example
 * ```typescript
 * // After successful retry
 * clearRecoveryState();
 * ```
 */
export function clearRecoveryState(): boolean {
  return recoveryManager.clear();
}

// ============================================================================
// Recovery Logic
// ============================================================================

/**
 * Check if retry is allowed
 *
 * Returns true if:
 * - Error count is below max retries
 * - Cooldown period has passed (if any)
 *
 * @param config - Optional recovery configuration
 * @returns True if retry is allowed
 *
 * @example
 * ```typescript
 * if (canRetry()) {
 *   // Safe to retry the operation
 *   executeTask();
 * } else {
 *   // Must wait or give up
 *   console.log('Retry not allowed');
 * }
 * ```
 */
export function canRetry(config?: RecoveryConfig): boolean {
  const state = getRecoveryState();
  const maxRetries = config?.maxRetries ?? DEFAULT_MAX_RETRIES;

  // Check if we've exceeded max retries
  if (state.errorCount >= maxRetries) {
    return false;
  }

  // Check if we're still in cooldown
  if (state.cooldownUntil) {
    const cooldownEnd = Date.parse(state.cooldownUntil);
    if (Date.now() < cooldownEnd) {
      return false;
    }
  }

  return true;
}

/**
 * Handle an error during execution
 *
 * Performs recovery actions:
 * 1. Increment error count and record error
 * 2. Check if max retries exceeded (emit ralph_loop_failed if so)
 * 3. Roll back state to last checkpoint (if configured)
 * 4. Clear Ralph Loop state to allow retry
 * 5. Set cooldown timer
 * 6. Emit rollback_initiated event
 *
 * @param error - The error that occurred
 * @param context - Execution context (phase and plan)
 * @param config - Optional recovery configuration
 * @returns Recovery result indicating what action was taken
 *
 * @example
 * ```typescript
 * try {
 *   executeTask();
 * } catch (error) {
 *   const result = handleError(error as Error, { phase: '05', plan: 1 });
 *   if (result.canRetry) {
 *     console.log(`Retry after: ${result.retryAfter}`);
 *   } else {
 *     console.log('Max retries exceeded, giving up');
 *   }
 * }
 * ```
 */
export function handleError(
  error: Error,
  context: { phase: string; plan: number },
  config?: RecoveryConfig
): RecoveryResult {
  const state = getRecoveryState();
  const maxRetries = config?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const cooldownMs = config?.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const rollbackOnError = config?.rollbackOnError !== false; // Default true

  // Update error state
  const newErrorCount = state.errorCount + 1;
  const now = new Date().toISOString();

  setRecoveryState({
    lastErrorAt: now,
    errorCount: newErrorCount,
    lastError: error.message,
    isRecovering: true,
  });

  // Check if we've exceeded max retries
  if (newErrorCount >= maxRetries) {
    // Emit ralph_loop_failed event
    emitEvent({
      type: 'ralph_loop_failed',
      payload: {
        error: error.message,
        phase: context.phase,
        plan: context.plan,
        reason: 'max_retries',
        errorCount: newErrorCount,
      },
      source: 'recovery',
    });

    return {
      success: false,
      canRetry: false,
      retryAfter: null,
      action: 'max_retries_exceeded',
      error: `Max retries (${maxRetries}) exceeded`,
    };
  }

  // Calculate cooldown end time
  const cooldownEnd = new Date(Date.now() + cooldownMs).toISOString();

  // Roll back state if configured
  let rollbackSucceeded = false;
  let action: RecoveryResult['action'] = 'cooldown_set';

  if (rollbackOnError) {
    const checkpoint = getLatestCheckpoint();

    if (checkpoint) {
      const rollbackResult = rollbackToCheckpoint(checkpoint.id);

      if (rollbackResult.success) {
        rollbackSucceeded = true;
        action = 'rolled_back';
      }
      // If rollback fails, continue with recovery anyway
    } else {
      // No checkpoint available
      action = 'no_checkpoint';
    }
  }

  // Clear Ralph Loop state to allow retry
  clearRalphLoopState();

  // Set cooldown
  setRecoveryState({
    cooldownUntil: cooldownEnd,
    isRecovering: true,
  });

  // Emit rollback_initiated event
  emitEvent({
    type: 'rollback_initiated',
    payload: {
      error: error.message,
      phase: context.phase,
      plan: context.plan,
      retryAfter: cooldownEnd,
      rollbackSucceeded,
      errorCount: newErrorCount,
    },
    source: 'recovery',
  });

  return {
    success: true,
    canRetry: true,
    retryAfter: cooldownEnd,
    action,
  };
}
