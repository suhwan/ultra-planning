/**
 * File ownership tracking for parallel workers
 */
export interface FileOwnership {
  /** Files owned by coordinator (shared files like package.json) */
  coordinator: string[];
  /** Files owned by each worker (keyed by worker ID) */
  workers: Record<string, string[]>;
  /** Files with conflicts (multiple workers attempted modification) */
  conflicts: string[];
}

/**
 * Worker information
 */
export interface WorkerInfo {
  /** Unique worker identifier (UUID) */
  id: string;
  /** Worker status */
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** Assigned subtask description */
  task: string;
  /** Files this worker owns */
  files: string[];
  /** When worker was spawned (ISO 8601) */
  startedAt: string;
  /** When worker completed (ISO 8601) */
  completedAt?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Configuration for Ultrapilot session
 */
export interface UltrapilotConfig {
  /** Maximum concurrent workers */
  maxWorkers?: number;
  /** Maximum iterations before force completion */
  maxIterations?: number;
  /** Custom shared files (added to defaults) */
  sharedFiles?: string[];
}

/**
 * Complete Ultrapilot session state
 */
export interface UltrapilotState extends Record<string, unknown> {
  /** Whether ultrapilot is active */
  active: boolean;
  /** Current iteration number */
  iteration: number;
  /** Maximum allowed iterations */
  maxIterations: number;
  /** Original task from user */
  originalTask: string;
  /** Decomposed subtasks */
  subtasks: string[];
  /** Worker information */
  workers: WorkerInfo[];
  /** File ownership tracking */
  ownership: FileOwnership;
  /** When session started (ISO 8601) */
  startedAt: string;
  /** When session completed (ISO 8601) */
  completedAt: string | null;
  /** Total workers spawned across iterations */
  totalWorkersSpawned: number;
  /** Number of successful workers */
  successfulWorkers: number;
  /** Number of failed workers */
  failedWorkers: number;
  /** Optional session ID for resume */
  sessionId?: string;
}

/**
 * Result of file assignment operation
 */
export interface AssignmentResult {
  /** Whether assignment succeeded */
  success: boolean;
  /** Conflict reason if failed */
  conflict?: string;
}
