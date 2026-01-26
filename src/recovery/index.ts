/**
 * Error Recovery Module
 *
 * Provides error recovery with Git rollback integration:
 * - Cooldown timer to prevent rapid retry loops
 * - Checkpoint rollback to restore state on error
 * - Ralph Loop state clearing for retry
 * - Event emission for tracking recovery actions
 *
 * Recovery flow:
 * 1. Error occurs during Ralph Loop
 * 2. handleError() called with error and context
 * 3. State rolled back to last checkpoint (if available)
 * 4. Ralph Loop state cleared
 * 5. Cooldown set before retry allowed
 * 6. canRetry() returns true after cooldown
 *
 * Usage:
 * ```typescript
 * import { handleError, canRetry, clearRecoveryState } from 'ultra-planner';
 *
 * try {
 *   executeTask();
 * } catch (error) {
 *   const result = handleError(error, { phase: '05', plan: 1 });
 *
 *   if (result.canRetry) {
 *     // Wait until retryAfter, then retry
 *     await waitUntil(result.retryAfter);
 *     executeTask();
 *   } else {
 *     // Max retries exceeded, give up
 *     console.error('Task failed after max retries');
 *   }
 * }
 *
 * // After successful completion
 * clearRecoveryState();
 * ```
 */

// Types and constants
export * from './types.js';

// Recovery functions
export * from './rollback.js';
