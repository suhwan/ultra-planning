/**
 * Ultrapilot State Management - Session and worker state persistence
 *
 * Manages Ultrapilot session state including worker tracking, task coordination,
 * and file ownership. Integrates with mode registry for mutual exclusion.
 */

import { StateManager } from '../../state/state-manager.js';
import { StateLocation } from '../../state/types.js';
import { canStartMode, startMode, endMode } from '../../state/mode-registry.js';
import type { UltrapilotState, UltrapilotConfig, WorkerInfo } from './types.js';
import { createOwnership } from './ownership.js';

/** State file name for Ultrapilot session */
export const STATE_FILE_NAME = 'ultrapilot-state';

/** Default maximum concurrent workers */
export const DEFAULT_MAX_WORKERS = 5;

/**
 * Initialize a new Ultrapilot session
 *
 * Creates initial state with task decomposition and file ownership tracking.
 * Checks mode registry to prevent conflicts with other exclusive modes.
 *
 * @param originalTask - The high-level task from user
 * @param subtasks - Array of decomposed subtasks
 * @param config - Optional configuration (maxWorkers, maxIterations, etc.)
 * @returns Initial state if successful, null if blocked by another mode
 */
export function initUltrapilot(
  originalTask: string,
  subtasks: string[],
  config?: UltrapilotConfig
): UltrapilotState | null {
  // Check if we can start ultrapilot mode (check for exclusive mode conflicts)
  const canStart = canStartMode('executing');
  if (!canStart.allowed) {
    // Another exclusive mode is active (e.g., planning, verifying)
    return null;
  }

  // Create initial state
  const now = new Date().toISOString();
  const state: UltrapilotState = {
    active: true,
    iteration: 1,
    maxIterations: config?.maxIterations ?? 3,
    originalTask,
    subtasks,
    workers: [],
    ownership: createOwnership(config),
    startedAt: now,
    completedAt: null,
    totalWorkersSpawned: 0,
    successfulWorkers: 0,
    failedWorkers: 0,
  };

  // Write state file
  const manager = new StateManager<UltrapilotState>(STATE_FILE_NAME, StateLocation.LOCAL);
  const writeResult = manager.write(state);

  if (!writeResult.success) {
    return null;
  }

  // Register with mode registry
  startMode('executing', {
    mode: 'ultrapilot',
    originalTask,
    subtaskCount: subtasks.length,
  });

  return state;
}

/**
 * Get current Ultrapilot session state
 *
 * Reads state from file and validates it's active.
 *
 * @returns Current state if session active, null otherwise
 */
export function getUltrapilotState(): UltrapilotState | null {
  const manager = new StateManager<UltrapilotState>(STATE_FILE_NAME, StateLocation.LOCAL);
  const result = manager.read();

  if (!result.exists || !result.data) {
    return null;
  }

  // Return null if session marked as inactive
  if (!result.data.active) {
    return null;
  }

  return result.data;
}

/**
 * Update Ultrapilot state with partial changes
 *
 * Atomically merges updates into current state.
 *
 * @param updates - Partial state updates to apply
 * @returns True if update succeeded, false if no active session
 */
export function updateUltrapilotState(updates: Partial<UltrapilotState>): boolean {
  const manager = new StateManager<UltrapilotState>(STATE_FILE_NAME, StateLocation.LOCAL);

  return manager.update((current) => {
    if (!current) {
      throw new Error('No active Ultrapilot session');
    }

    return {
      ...current,
      ...updates,
    };
  });
}

/**
 * Update a specific worker's information
 *
 * Finds worker by ID and merges updates into worker data.
 *
 * @param workerId - UUID of worker to update
 * @param updates - Partial worker updates to apply
 * @returns True if update succeeded, false if worker not found
 */
export function updateWorker(workerId: string, updates: Partial<WorkerInfo>): boolean {
  const manager = new StateManager<UltrapilotState>(STATE_FILE_NAME, StateLocation.LOCAL);

  return manager.update((current) => {
    if (!current) {
      throw new Error('No active Ultrapilot session');
    }

    // Find worker by ID
    const workerIndex = current.workers.findIndex((w) => w.id === workerId);
    if (workerIndex === -1) {
      // Worker not found, no update
      return current;
    }

    // Create updated workers array
    const updatedWorkers = [...current.workers];
    updatedWorkers[workerIndex] = {
      ...updatedWorkers[workerIndex],
      ...updates,
    };

    return {
      ...current,
      workers: updatedWorkers,
    };
  });
}

/**
 * End the Ultrapilot session
 *
 * Deactivates session and cleans up state file.
 *
 * @returns True if cleanup succeeded
 */
export function endUltrapilot(): boolean {
  // Unregister from mode registry
  endMode('executing');

  // Delete state file
  const manager = new StateManager<UltrapilotState>(STATE_FILE_NAME, StateLocation.LOCAL);
  return manager.clear();
}
