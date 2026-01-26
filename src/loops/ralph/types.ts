/**
 * Ralph Loop Types and Constants
 *
 * Type definitions for persistent task execution with completion detection.
 * The Ralph Loop continues until the task outputs `<promise>TAG</promise>`
 * or max iterations are reached.
 *
 * Based on patterns from oh-my-opencode Ralph Loop implementation.
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * Default maximum iterations before forced stop
 *
 * High default to allow complex tasks to complete naturally.
 * Can be overridden via RalphLoopConfig.
 */
export const DEFAULT_MAX_ITERATIONS = 100;

/**
 * Default completion promise tag
 *
 * The assistant outputs `<promise>DONE</promise>` when truly finished.
 * Can be customized via RalphLoopConfig.
 */
export const DEFAULT_COMPLETION_PROMISE = 'DONE';

/**
 * State file name for StateManager (without .json extension)
 *
 * State is stored at: .ultraplan/state/ralph-loop.json
 */
export const RALPH_LOOP_STATE_FILE = 'ralph-loop';

// ============================================================================
// State Interface
// ============================================================================

/**
 * Ralph Loop state persisted to disk
 *
 * This state survives process restarts, allowing the orchestrator to detect
 * an active loop and inject continuation prompts on resume.
 *
 * Note: No session ID tracking - Claude Code sessions don't have stable IDs.
 * State file existence is the signal for loop continuation.
 */
export interface RalphLoopState extends Record<string, unknown> {
  /**
   * Whether the loop is currently active
   *
   * Set to true when loop starts, false/deleted when complete or stopped.
   */
  active: boolean;

  /**
   * Current iteration number (1-based)
   *
   * Incremented after each continuation prompt injection.
   * Loop stops when iteration > maxIterations.
   */
  iteration: number;

  /**
   * Maximum iterations before forced stop
   *
   * Prevents infinite loops. Default is 100.
   */
  maxIterations: number;

  /**
   * The promise tag to detect for completion
   *
   * Loop completes when assistant outputs `<promise>{tag}</promise>`.
   * Default is "DONE".
   */
  completionPromise: string;

  /**
   * When the loop was started (ISO 8601)
   *
   * Used for staleness detection and metrics.
   */
  startedAt: string;

  /**
   * The original task prompt
   *
   * Included in continuation prompts so assistant remembers the task.
   */
  prompt: string;
}

// ============================================================================
// Configuration Interface
// ============================================================================

/**
 * Configuration options for starting a Ralph Loop
 *
 * All options are optional - defaults are applied if not specified.
 */
export interface RalphLoopConfig {
  /**
   * Maximum iterations override
   *
   * @default 100
   */
  maxIterations?: number;

  /**
   * Custom completion promise tag
   *
   * @default "DONE"
   */
  completionPromise?: string;
}
