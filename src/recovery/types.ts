/**
 * Recovery Module Types and Constants
 *
 * Type definitions for error recovery with Git rollback integration.
 * The recovery system provides:
 * - Cooldown timer to prevent rapid retry loops
 * - Checkpoint rollback to restore state on error
 * - Ralph Loop state clearing for retry
 * - Event emission for tracking recovery actions
 *
 * Cooldown mechanism rationale:
 * When errors occur, immediate retries often fail for the same reason.
 * The cooldown period allows transient issues (network, rate limits, etc.)
 * to resolve before retrying. This prevents cascading failures and
 * excessive resource consumption from rapid retry loops.
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * Default cooldown period in milliseconds
 *
 * 5 seconds provides enough time for transient issues to resolve
 * without significantly delaying legitimate retry attempts.
 */
export const DEFAULT_COOLDOWN_MS = 5000;

/**
 * Default maximum retry attempts before giving up
 *
 * 3 retries balances persistence with avoiding infinite loops.
 * After 3 failures, the issue is likely not transient.
 */
export const DEFAULT_MAX_RETRIES = 3;

/**
 * State file name for StateManager (without .json extension)
 *
 * State is stored at: .ultraplan/state/recovery.json
 */
export const RECOVERY_STATE_FILE = 'recovery';

// ============================================================================
// State Interface
// ============================================================================

/**
 * Recovery state persisted to disk
 *
 * Tracks error count, cooldown status, and recovery progress.
 * Extends Record<string, unknown> for StateManager compatibility.
 */
export interface RecoveryState extends Record<string, unknown> {
  /**
   * Whether recovery is currently in progress
   *
   * True when an error has occurred and we're in cooldown or retrying.
   */
  isRecovering: boolean;

  /**
   * ISO 8601 timestamp of last error
   *
   * Used for tracking when errors occurred and for staleness detection.
   */
  lastErrorAt: string | null;

  /**
   * Number of consecutive errors
   *
   * Incremented on each error, reset on successful operation.
   * Recovery stops when this reaches maxRetries.
   */
  errorCount: number;

  /**
   * Last error message
   *
   * Stored for diagnostics and logging purposes.
   */
  lastError: string | null;

  /**
   * Cooldown end timestamp (ISO 8601)
   *
   * Retry is allowed only after this timestamp.
   * Null means no active cooldown.
   */
  cooldownUntil: string | null;
}

// ============================================================================
// Configuration Interface
// ============================================================================

/**
 * Configuration options for error recovery
 *
 * All options are optional - defaults are applied if not specified.
 */
export interface RecoveryConfig {
  /**
   * Cooldown period in milliseconds
   *
   * @default 5000 (5 seconds)
   */
  cooldownMs?: number;

  /**
   * Maximum retry attempts before giving up
   *
   * @default 3
   */
  maxRetries?: number;

  /**
   * Whether to roll back state on error
   *
   * When true, state files are restored to last checkpoint on error.
   * @default true
   */
  rollbackOnError?: boolean;
}

// ============================================================================
// Result Interface
// ============================================================================

/**
 * Result of error recovery operation
 *
 * Returned by handleError() to indicate what action was taken
 * and whether retry is allowed.
 */
export interface RecoveryResult {
  /**
   * Whether recovery action succeeded
   *
   * True if rollback/cooldown was set successfully.
   * False if max retries exceeded or rollback failed.
   */
  success: boolean;

  /**
   * Whether retry is allowed after cooldown
   *
   * True if errorCount < maxRetries and we haven't given up.
   */
  canRetry: boolean;

  /**
   * When retry is allowed (ISO 8601)
   *
   * Null if retry is immediate or not allowed.
   */
  retryAfter: string | null;

  /**
   * What action was taken
   *
   * - rolled_back: State was restored from checkpoint
   * - cooldown_set: Cooldown timer started (no checkpoint available)
   * - max_retries_exceeded: Giving up after too many failures
   * - no_checkpoint: No checkpoint available, only cooldown set
   */
  action: 'rolled_back' | 'cooldown_set' | 'max_retries_exceeded' | 'no_checkpoint';

  /**
   * Error message if recovery failed
   */
  error?: string;
}
