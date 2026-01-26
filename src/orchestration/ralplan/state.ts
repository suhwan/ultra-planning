/**
 * Ralplan State Management
 *
 * Manages persistence and lifecycle of Ralplan sessions using StateManager.
 */

import { StateManager } from '../../state/state-manager.js';
import { StateLocation } from '../../state/types.js';
import { canStartMode, startMode, endMode } from '../../state/mode-registry.js';
import type {
  RalplanState,
  RalplanConfig,
  RalplanPhase,
  CriticVerdict,
} from './types.js';
import { DEFAULT_RALPLAN_CONFIG } from './types.js';

/** State file name for Ralplan sessions */
const STATE_FILE_NAME = 'ralplan-state';

/** State manager instance */
const stateManager = new StateManager<RalplanState>(STATE_FILE_NAME, StateLocation.LOCAL);

/**
 * Initialize a new Ralplan session
 *
 * Checks mode registry to prevent conflicts with other exclusive modes,
 * then creates initial state with iteration=1 and planner_planning phase.
 *
 * @param taskDescription - Description of the task to plan
 * @param config - Optional configuration overrides
 * @returns Initial state if started successfully, null if blocked
 */
export function initRalplan(
  taskDescription: string,
  config?: RalplanConfig
): RalplanState | null {
  // Check if we can start ralplan mode
  const canStart = canStartMode('planning');
  if (!canStart.allowed) {
    console.error(`Cannot start ralplan: ${canStart.message}`);
    return null;
  }

  // Merge config with defaults
  const finalConfig = {
    ...DEFAULT_RALPLAN_CONFIG,
    ...config,
  };

  // Create initial state
  const state: RalplanState = {
    active: true,
    mode: 'ralplan',
    iteration: 1,
    maxIterations: finalConfig.maxIterations,
    planPath: finalConfig.planPath,
    currentPhase: 'planner_planning',
    startedAt: new Date().toISOString(),
    taskDescription,
  };

  // Write state file
  const result = stateManager.write(state);
  if (!result.success) {
    console.error(`Failed to write ralplan state: ${result.error}`);
    return null;
  }

  // Register mode in mode registry
  startMode('planning', { type: 'ralplan', taskDescription });

  return state;
}

/**
 * Get current Ralplan session state
 *
 * @returns Current state if session is active, null otherwise
 */
export function getRalplanState(): RalplanState | null {
  const result = stateManager.read();

  if (!result.exists || !result.data) {
    return null;
  }

  // Check if state is still active
  if (!result.data.active) {
    return null;
  }

  return result.data;
}

/**
 * Update the current phase of the Ralplan session
 *
 * @param phase - New phase to transition to
 * @returns True if update succeeded
 */
export function updateRalplanPhase(phase: RalplanPhase): boolean {
  const current = getRalplanState();
  if (!current) {
    return false;
  }

  const updated = {
    ...current,
    currentPhase: phase,
  };

  return stateManager.write(updated).success;
}

/**
 * Advance the Ralplan iteration based on Critic verdict
 *
 * For OKAY verdicts: Marks session as complete.
 * For REJECT verdicts: Increments iteration and resets to planner_planning phase.
 *
 * @param verdict - Critic's verdict (OKAY or REJECT)
 * @param feedback - Optional feedback explaining the verdict
 * @returns True if update succeeded
 */
export function advanceIteration(
  verdict: CriticVerdict,
  feedback?: string
): boolean {
  const current = getRalplanState();
  if (!current) {
    return false;
  }

  let updated: RalplanState;

  if (verdict === 'OKAY') {
    // Plan approved - mark as complete
    updated = {
      ...current,
      currentPhase: 'complete',
      lastVerdict: verdict,
      lastFeedback: feedback,
      completedAt: new Date().toISOString(),
    };
  } else {
    // Plan rejected - increment iteration and return to planning
    updated = {
      ...current,
      iteration: current.iteration + 1,
      currentPhase: 'planner_planning',
      lastVerdict: verdict,
      lastFeedback: feedback,
    };
  }

  return stateManager.write(updated).success;
}

/**
 * End the Ralplan session and clean up state
 *
 * Deletes the state file and deregisters from mode registry.
 *
 * @returns True if cleanup succeeded
 */
export function endRalplan(): boolean {
  // Clear state file
  const cleared = stateManager.clear();

  // Deregister mode
  endMode('planning');

  return cleared;
}
