/**
 * Ultrapilot Worker Coordination - Worker lifecycle management
 *
 * Manages worker spawn, completion, and failure with file ownership validation.
 * Enforces concurrent worker limits and coordinates file access across workers.
 */

import { v4 as uuidv4 } from 'uuid';
import type { UltrapilotState, WorkerInfo } from './types.js';
import { getUltrapilotState, updateUltrapilotState, updateWorker } from './state.js';
import { assignFile, releaseFile } from './ownership.js';

/** Default maximum concurrent workers */
export const DEFAULT_MAX_CONCURRENT = 5;

/**
 * Check if more workers can be spawned
 *
 * Counts workers with 'running' status and compares to maximum.
 *
 * @param state - Current Ultrapilot state
 * @param maxConcurrent - Maximum concurrent workers (default: DEFAULT_MAX_CONCURRENT)
 * @returns True if more workers can be spawned
 */
export function canSpawnMore(
  state: UltrapilotState,
  maxConcurrent?: number
): boolean {
  const limit = maxConcurrent ?? DEFAULT_MAX_CONCURRENT;
  const runningCount = state.workers.filter((w) => w.status === 'running').length;
  return runningCount < limit;
}

/**
 * Get all currently active (running) workers
 *
 * Filters workers by 'running' status.
 *
 * @param state - Current Ultrapilot state
 * @returns Array of running workers
 */
export function getActiveWorkers(state: UltrapilotState): WorkerInfo[] {
  return state.workers.filter((w) => w.status === 'running');
}

/**
 * Spawn a new worker for a subtask
 *
 * Creates a worker with unique ID, validates file ownership, and adds to state.
 * Enforces concurrent worker limit and file ownership exclusivity.
 *
 * @param task - Description of subtask for this worker
 * @param files - Files this worker will modify
 * @returns WorkerInfo if spawned successfully, null if at limit or file conflict
 */
export function spawnWorker(task: string, files: string[]): WorkerInfo | null {
  // Get current state
  const state = getUltrapilotState();
  if (!state) {
    return null;
  }

  // Check concurrent worker limit
  if (!canSpawnMore(state)) {
    return null;
  }

  // Generate unique worker ID
  const workerId = uuidv4();

  // Validate file ownership for all files
  const conflicts: string[] = [];
  for (const file of files) {
    const result = assignFile(state.ownership, workerId, file);
    if (!result.success) {
      // Conflict detected - rollback any files we assigned
      for (const assignedFile of files) {
        if (assignedFile === file) {
          break; // Stop at the conflicting file
        }
        releaseFile(state.ownership, workerId, assignedFile);
      }
      return null;
    }
  }

  // Update ownership in state (important: assignFile modifies in place, so we need to persist)
  const ownershipUpdated = updateUltrapilotState({
    ownership: state.ownership,
  });

  if (!ownershipUpdated) {
    // Failed to persist ownership - rollback
    for (const file of files) {
      releaseFile(state.ownership, workerId, file);
    }
    return null;
  }

  // Create worker info
  const now = new Date().toISOString();
  const worker: WorkerInfo = {
    id: workerId,
    status: 'running',
    task,
    files,
    startedAt: now,
  };

  // Add worker to state and increment counter
  const updatedWorkers = [...state.workers, worker];
  const success = updateUltrapilotState({
    workers: updatedWorkers,
    totalWorkersSpawned: state.totalWorkersSpawned + 1,
  });

  if (!success) {
    // Rollback file assignments
    for (const file of files) {
      releaseFile(state.ownership, workerId, file);
    }
    return null;
  }

  return worker;
}

/**
 * Mark a worker as completed
 *
 * Updates worker status to 'completed' and increments success counter.
 * Releases all files owned by the worker.
 *
 * @param workerId - UUID of worker to complete
 * @returns True if update succeeded, false if worker not found
 */
export function completeWorker(workerId: string): boolean {
  const now = new Date().toISOString();

  // Release worker files first
  releaseWorkerFiles(workerId);

  // Update worker status
  const workerUpdated = updateWorker(workerId, {
    status: 'completed',
    completedAt: now,
  });

  if (!workerUpdated) {
    return false;
  }

  // Increment successfulWorkers counter
  const state = getUltrapilotState();
  if (!state) {
    return false;
  }

  return updateUltrapilotState({
    successfulWorkers: state.successfulWorkers + 1,
  });
}

/**
 * Mark a worker as failed
 *
 * Updates worker status to 'failed' with error message and increments failure counter.
 * Releases all files owned by the worker.
 *
 * @param workerId - UUID of worker that failed
 * @param error - Error message describing failure
 * @returns True if update succeeded, false if worker not found
 */
export function failWorker(workerId: string, error: string): boolean {
  const now = new Date().toISOString();

  // Release worker files first
  releaseWorkerFiles(workerId);

  // Update worker status with error
  const workerUpdated = updateWorker(workerId, {
    status: 'failed',
    completedAt: now,
    error,
  });

  if (!workerUpdated) {
    return false;
  }

  // Increment failedWorkers counter
  const state = getUltrapilotState();
  if (!state) {
    return false;
  }

  return updateUltrapilotState({
    failedWorkers: state.failedWorkers + 1,
  });
}

/**
 * Release all files owned by a worker
 *
 * Removes file ownership assignments for the specified worker.
 * Typically called when worker completes or fails.
 *
 * @param workerId - UUID of worker to release files from
 * @returns True if release succeeded, false if worker not found
 */
export function releaseWorkerFiles(workerId: string): boolean {
  const state = getUltrapilotState();
  if (!state) {
    return false;
  }

  // Find worker
  const worker = state.workers.find((w) => w.id === workerId);
  if (!worker) {
    return false;
  }

  // Release all files owned by this worker
  for (const file of worker.files) {
    releaseFile(state.ownership, workerId, file);
  }

  // Update ownership in state
  return updateUltrapilotState({
    ownership: state.ownership,
  });
}
