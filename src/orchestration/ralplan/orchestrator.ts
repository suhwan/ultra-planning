/**
 * Ralplan Loop Orchestration
 *
 * Controls the Planner -> Critic -> Verdict loop, including forced approval
 * after max iterations.
 */

import type { RalplanState, RalplanPhase, CriticVerdict } from './types.js';
import { getRalplanState, advanceIteration } from './state.js';

/**
 * Check if forced approval should occur
 *
 * Returns true when the current iteration has reached or exceeded maxIterations.
 *
 * @param state - Current Ralplan state
 * @returns True if forced approval should occur
 */
export function shouldForceApproval(state: RalplanState): boolean {
  return state.iteration >= state.maxIterations;
}

/**
 * Get the next phase based on current phase and optional verdict
 *
 * Defines the phase transition state machine:
 * - planner_planning -> critic_review
 * - critic_review -> handling_verdict
 * - handling_verdict + OKAY -> complete
 * - handling_verdict + REJECT -> planner_planning (or architect_consultation if configured)
 * - complete -> complete (terminal state)
 *
 * @param currentPhase - Current phase in the loop
 * @param verdict - Optional verdict from Critic (used in handling_verdict phase)
 * @returns Next phase to transition to
 */
export function getNextPhase(
  currentPhase: RalplanPhase,
  verdict?: CriticVerdict
): RalplanPhase {
  switch (currentPhase) {
    case 'planner_planning':
      return 'critic_review';

    case 'architect_consultation':
      return 'critic_review';

    case 'critic_review':
      return 'handling_verdict';

    case 'handling_verdict':
      if (verdict === 'OKAY') {
        return 'complete';
      } else if (verdict === 'REJECT') {
        // Could transition to architect_consultation if configured
        // For now, go directly back to planner
        return 'planner_planning';
      }
      // If no verdict provided, stay in handling_verdict
      return 'handling_verdict';

    case 'complete':
      // Terminal state - no transitions
      return 'complete';

    default:
      // Unknown phase - return current
      return currentPhase;
  }
}

/**
 * Result of handling a Critic verdict
 */
export interface VerdictHandlingResult {
  /** Next phase to transition to */
  nextPhase: RalplanPhase;
  /** Whether approval was forced due to max iterations */
  forced: boolean;
  /** Human-readable message describing the result */
  message: string;
}

/**
 * Handle a Critic verdict and determine next actions
 *
 * Implements the core loop logic:
 * 1. Check if max iterations reached -> forced approval
 * 2. OKAY verdict -> complete
 * 3. REJECT verdict -> advance iteration and continue
 *
 * @param verdict - Critic's verdict (OKAY or REJECT)
 * @param feedback - Optional feedback explaining the verdict
 * @returns Result with next phase, forced flag, and message
 */
export function handleCriticVerdict(
  verdict: CriticVerdict,
  feedback?: string
): VerdictHandlingResult {
  const state = getRalplanState();

  if (!state) {
    return {
      nextPhase: 'complete',
      forced: false,
      message: 'No active Ralplan session',
    };
  }

  // Check for forced approval
  if (shouldForceApproval(state)) {
    // Update state to mark forced approval and completion
    const updated = {
      ...state,
      currentPhase: 'complete' as RalplanPhase,
      lastVerdict: verdict,
      lastFeedback: feedback,
      forcedApproval: true,
      completedAt: new Date().toISOString(),
    };

    // Note: In real implementation, would write this state
    // For now, rely on advanceIteration to handle state updates

    return {
      nextPhase: 'complete',
      forced: true,
      message: `⚠️ Maximum iterations (${state.maxIterations}) reached. Plan approved with reservations.`,
    };
  }

  // Handle OKAY verdict
  if (verdict === 'OKAY') {
    advanceIteration(verdict, feedback);
    return {
      nextPhase: 'complete',
      forced: false,
      message: `✓ Plan approved by Critic. Ralplan complete after ${state.iteration} iteration(s).`,
    };
  }

  // Handle REJECT verdict
  advanceIteration(verdict, feedback);
  const newIteration = state.iteration + 1;

  return {
    nextPhase: 'planner_planning',
    forced: false,
    message: `↻ Plan rejected. Starting iteration ${newIteration}/${state.maxIterations}.\nFeedback: ${feedback || 'No feedback provided'}`,
  };
}

/**
 * Get a human-readable summary of the current loop state
 *
 * @param state - Current Ralplan state
 * @returns Summary string (e.g., "Ralplan iteration 2/5 - critic_review")
 */
export function getLoopSummary(state: RalplanState): string {
  const phase = state.currentPhase.replace(/_/g, ' ');
  return `Ralplan iteration ${state.iteration}/${state.maxIterations} - ${phase}`;
}
