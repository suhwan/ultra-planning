/**
 * Background Manager State Persistence
 *
 * Provides state persistence utilities for the BackgroundManager using the
 * StateManager pattern. State is stored locally in `.ultraplan/state/background-manager.json`.
 *
 * @module orchestration/background
 */

import { StateManager } from '../../state/state-manager.js';
import { StateLocation } from '../../state/types.js';
import type { BackgroundState } from './types.js';
import { createInitialBackgroundState } from './types.js';

const STATE_NAME = 'background-manager';

/**
 * State wrapper type that satisfies StateManager's Record constraint.
 * This is needed because BackgroundState uses specific typed properties
 * rather than an index signature.
 */
type StateRecord = BackgroundState & Record<string, unknown>;

// State manager instance (lazy initialized)
let stateManager: StateManager<StateRecord> | null = null;

/**
 * Get or create the state manager instance.
 *
 * Uses lazy initialization to avoid creating the state file
 * until it's actually needed.
 *
 * @returns StateManager instance for background state
 */
function getStateManager(): StateManager<StateRecord> {
  if (!stateManager) {
    stateManager = new StateManager<StateRecord>(STATE_NAME, StateLocation.LOCAL);
  }
  return stateManager;
}

/**
 * Load background state from disk.
 *
 * @returns Persisted state or null if no state file exists
 */
export function loadBackgroundState(): BackgroundState | null {
  const result = getStateManager().read();
  return result.exists ? result.data ?? null : null;
}

/**
 * Save background state to disk.
 *
 * Uses atomic write pattern (write to .tmp then rename) to prevent corruption.
 *
 * @param state - State to persist
 * @returns Whether save succeeded
 */
export function saveBackgroundState(state: BackgroundState): boolean {
  return getStateManager().write(state as StateRecord).success;
}

/**
 * Clear background state from disk.
 *
 * @returns Whether clear succeeded
 */
export function clearBackgroundState(): boolean {
  return getStateManager().clear();
}

/**
 * Create an empty background state.
 *
 * Re-exports from types.js for convenience.
 *
 * @returns Fresh empty state
 */
export function createEmptyState(): BackgroundState {
  return createInitialBackgroundState() as BackgroundState;
}
