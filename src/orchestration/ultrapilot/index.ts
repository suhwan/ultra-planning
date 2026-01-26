/**
 * Ultrapilot module - Parallel worker coordination
 *
 * Provides file ownership tracking for parallel workers to prevent conflicts.
 */

// Export all types
export type {
  FileOwnership,
  WorkerInfo,
  UltrapilotConfig,
  UltrapilotState,
  AssignmentResult,
} from './types.js';

// Export all ownership functions
export {
  createOwnership,
  assignFile,
  releaseFile,
  getOwnerOf,
  hasConflicts,
  recordConflict,
  DEFAULT_SHARED_FILES,
} from './ownership.js';

// Export state management functions
export {
  initUltrapilot,
  getUltrapilotState,
  updateUltrapilotState,
  updateWorker,
  endUltrapilot,
  STATE_FILE_NAME,
  DEFAULT_MAX_WORKERS,
} from './state.js';

// Export coordinator functions
export {
  canSpawnMore,
  getActiveWorkers,
  spawnWorker,
  completeWorker,
  failWorker,
  releaseWorkerFiles,
  DEFAULT_MAX_CONCURRENT,
} from './coordinator.js';
