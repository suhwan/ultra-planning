/**
 * Ralph Loop State Persistence
 *
 * State management functions for Ralph Loop using existing StateManager.
 * State is stored at: .ultraplan/state/ralph-loop.json
 *
 * Based on patterns from oh-my-opencode Ralph Loop storage.
 */

import { StateManager, StateLocation } from '../../state/index.js';
import type { RalphLoopState } from './types.js';
import { RALPH_LOOP_STATE_FILE } from './types.js';

// ============================================================================
// State Manager Instance
// ============================================================================

/**
 * State manager instance for Ralph Loop state
 *
 * Uses LOCAL location so state is project-specific.
 * Path: .ultraplan/state/ralph-loop.json
 */
const manager = new StateManager<RalphLoopState>(
  RALPH_LOOP_STATE_FILE,
  StateLocation.LOCAL
);

// ============================================================================
// State Operations
// ============================================================================

/**
 * Read Ralph Loop state from file
 *
 * Returns null if state file doesn't exist or is invalid.
 * Use this to check if a loop is active on startup.
 *
 * @returns The Ralph Loop state or null if not exists
 *
 * @example
 * ```typescript
 * const state = readRalphLoopState();
 * if (state?.active) {
 *   // Loop is active, inject continuation prompt
 *   const prompt = buildContinuationPrompt(state);
 * }
 * ```
 */
export function readRalphLoopState(): RalphLoopState | null {
  const result = manager.read();
  if (!result.exists || !result.data) {
    return null;
  }
  return result.data;
}

/**
 * Write Ralph Loop state to file
 *
 * Uses atomic write (temp file + rename) to prevent corruption.
 * Creates directory if needed.
 *
 * @param state - The Ralph Loop state to persist
 * @returns True if write succeeded, false otherwise
 *
 * @example
 * ```typescript
 * const state: RalphLoopState = {
 *   active: true,
 *   iteration: 1,
 *   maxIterations: 100,
 *   completionPromise: 'DONE',
 *   startedAt: new Date().toISOString(),
 *   prompt: 'Build a REST API',
 * };
 * const success = writeRalphLoopState(state);
 * ```
 */
export function writeRalphLoopState(state: RalphLoopState): boolean {
  return manager.write(state).success;
}

/**
 * Clear Ralph Loop state by deleting the state file
 *
 * Call this when:
 * - Loop completes successfully (completion detected)
 * - Loop reaches max iterations
 * - Loop is manually stopped
 * - Error requires state reset
 *
 * @returns True if deletion succeeded (or file didn't exist)
 *
 * @example
 * ```typescript
 * // After detecting completion
 * if (detectCompletion(output, state.completionPromise)) {
 *   clearRalphLoopState();
 * }
 * ```
 */
export function clearRalphLoopState(): boolean {
  return manager.clear();
}

/**
 * Increment iteration counter in Ralph Loop state
 *
 * Returns a new state object with iteration incremented by 1.
 * Does NOT persist the state - caller must call writeRalphLoopState().
 *
 * @param state - The current Ralph Loop state
 * @returns New state with iteration incremented
 *
 * @example
 * ```typescript
 * const state = readRalphLoopState();
 * if (state) {
 *   const updated = incrementIteration(state);
 *   writeRalphLoopState(updated);
 * }
 * ```
 */
export function incrementIteration(state: RalphLoopState): RalphLoopState {
  return {
    ...state,
    iteration: state.iteration + 1,
  };
}
