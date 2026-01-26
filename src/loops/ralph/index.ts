/**
 * Ralph Loop Module
 *
 * Persistent task execution with completion detection.
 * The loop continues until the assistant outputs `<promise>TAG</promise>`
 * or max iterations are reached.
 *
 * Based on patterns from oh-my-opencode Ralph Loop implementation.
 *
 * @example
 * ```typescript
 * // Start a Ralph Loop
 * const state = startRalphLoop('Build a REST API with Express', {
 *   maxIterations: 50,
 *   completionPromise: 'DONE',
 * });
 *
 * // Check if loop is active (on resume)
 * if (isRalphLoopActive()) {
 *   const state = readRalphLoopState();
 *   const prompt = buildContinuationPrompt(state);
 *   // Inject prompt into conversation
 * }
 *
 * // End the loop
 * endRalphLoop();
 * ```
 */

// ============================================================================
// Re-exports
// ============================================================================

export * from './types.js';
export * from './state.js';
export * from './detection.js';

// ============================================================================
// Imports
// ============================================================================

import { canStartMode, startMode, endMode } from '../../state/mode-registry.js';
import type { RalphLoopState, RalphLoopConfig } from './types.js';
import {
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_COMPLETION_PROMISE,
} from './types.js';
import {
  readRalphLoopState,
  writeRalphLoopState,
  clearRalphLoopState,
} from './state.js';

// ============================================================================
// Continuation Prompt Template
// ============================================================================

/**
 * Template for continuation prompts
 *
 * Placeholders:
 * - {{ITERATION}} - Current iteration number
 * - {{MAX}} - Maximum iterations allowed
 * - {{PROMISE}} - The completion promise tag
 * - {{PROMPT}} - The original task prompt
 */
const CONTINUATION_PROMPT = `[SYSTEM DIRECTIVE: ULTRA-PLANNING - RALPH LOOP {{ITERATION}}/{{MAX}}]

Your previous attempt did not output the completion promise. Continue working on the task.

IMPORTANT:
- Review your progress so far
- Continue from where you left off
- When FULLY complete, output: <promise>{{PROMISE}}</promise>
- Do not stop until the task is truly done

Original task:
{{PROMPT}}`;

// ============================================================================
// Prompt Building
// ============================================================================

/**
 * Build a continuation prompt for the Ralph Loop
 *
 * Creates a system directive with iteration info and the original task.
 * Used when the loop continues to the next iteration.
 *
 * @param state - Current Ralph Loop state
 * @returns Formatted continuation prompt
 *
 * @example
 * ```typescript
 * const state = readRalphLoopState();
 * const prompt = buildContinuationPrompt(state);
 * // prompt contains:
 * // "[SYSTEM DIRECTIVE: ULTRA-PLANNING - RALPH LOOP 3/100]
 * //  ...
 * //  Original task:
 * //  Build a REST API"
 * ```
 */
export function buildContinuationPrompt(state: RalphLoopState): string {
  return CONTINUATION_PROMPT
    .replace('{{ITERATION}}', String(state.iteration))
    .replace('{{MAX}}', String(state.maxIterations))
    .replace('{{PROMISE}}', state.completionPromise)
    .replace('{{PROMPT}}', state.prompt);
}

// ============================================================================
// Loop Lifecycle
// ============================================================================

/**
 * Start a new Ralph Loop
 *
 * Creates state file and registers with mode registry.
 * Returns null if another exclusive mode (planning, executing, verifying)
 * is already active.
 *
 * @param prompt - The original task prompt
 * @param config - Optional configuration overrides
 * @returns The created state, or null if blocked by another mode
 *
 * @example
 * ```typescript
 * const state = startRalphLoop('Build a REST API', {
 *   maxIterations: 50,
 * });
 *
 * if (!state) {
 *   console.log('Another mode is active');
 * }
 * ```
 */
export function startRalphLoop(
  prompt: string,
  config?: RalphLoopConfig
): RalphLoopState | null {
  // Check if we can start executing mode
  const canStart = canStartMode('executing');
  if (!canStart.allowed) {
    return null;
  }

  // Create initial state
  const state: RalphLoopState = {
    active: true,
    iteration: 1,
    maxIterations: config?.maxIterations ?? DEFAULT_MAX_ITERATIONS,
    completionPromise: config?.completionPromise ?? DEFAULT_COMPLETION_PROMISE,
    startedAt: new Date().toISOString(),
    prompt,
  };

  // Write state file
  const writeSuccess = writeRalphLoopState(state);
  if (!writeSuccess) {
    return null;
  }

  // Register with mode registry
  const registerSuccess = startMode('executing', { mode: 'ralph-loop' });
  if (!registerSuccess) {
    // Clean up state file if registration fails
    clearRalphLoopState();
    return null;
  }

  return state;
}

/**
 * End the Ralph Loop
 *
 * Clears state file and unregisters from mode registry.
 * Call this when:
 * - Completion is detected
 * - Max iterations reached
 * - Loop is manually stopped
 *
 * @returns True if ended successfully
 *
 * @example
 * ```typescript
 * if (detectCompletion(output, state.completionPromise)) {
 *   endRalphLoop();
 *   console.log('Task completed!');
 * }
 * ```
 */
export function endRalphLoop(): boolean {
  // Clear state file
  const clearSuccess = clearRalphLoopState();

  // Unregister from mode registry
  const endSuccess = endMode('executing');

  return clearSuccess && endSuccess;
}

/**
 * Check if Ralph Loop is currently active
 *
 * Reads state file and checks the active flag.
 * Use this on startup to detect if a loop needs continuation.
 *
 * @returns True if loop is active
 *
 * @example
 * ```typescript
 * // On startup
 * if (isRalphLoopActive()) {
 *   const state = readRalphLoopState();
 *   const prompt = buildContinuationPrompt(state);
 *   // Inject continuation prompt
 * }
 * ```
 */
export function isRalphLoopActive(): boolean {
  const state = readRalphLoopState();
  return state?.active === true;
}
