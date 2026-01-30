/**
 * Swarm Pattern Types
 *
 * Types for coordinating multiple parallel workers using native Claude Code Task API.
 * Workers autonomously claim and execute tasks from a shared pool.
 */

// ============================================================================
// Worker Types
// ============================================================================

/** Worker identity */
export interface WorkerId {
  /** Unique worker ID */
  id: string;
  /** Worker name for display */
  name: string;
  /** Worker index (0-4 for 5 workers) */
  index: number;
}

/** Worker status */
export type WorkerStatus =
  | 'idle'        // Ready for work
  | 'claiming'    // Trying to claim a task
  | 'executing'   // Working on a task
  | 'completed'   // Finished (may claim more)
  | 'failed'      // Error occurred
  | 'terminated'; // Stopped by orchestrator

/** Worker state */
export interface WorkerState {
  /** Worker identity */
  worker: WorkerId;
  /** Current status */
  status: WorkerStatus;
  /** Currently claimed task ID */
  currentTaskId?: string;
  /** Tasks completed by this worker */
  completedTasks: string[];
  /** Tasks failed by this worker */
  failedTasks: string[];
  /** Last heartbeat timestamp */
  lastHeartbeat: string;
  /** Error message if failed */
  error?: string;
}

// ============================================================================
// Swarm Configuration
// ============================================================================

/** Swarm configuration */
export interface SwarmConfig {
  /** Maximum concurrent workers (default: 5) */
  maxWorkers: number;
  /** Task claim retry attempts (default: 3) */
  claimRetries: number;
  /** Claim retry delay in ms (default: 100) */
  claimRetryDelayMs: number;
  /** Worker heartbeat interval in ms (default: 30000) */
  heartbeatIntervalMs: number;
  /** Worker timeout in ms (default: 300000 = 5 min) */
  workerTimeoutMs: number;
  /** Whether to auto-release stale claims */
  autoReleaseStale: boolean;
}

/** Default swarm configuration */
export const DEFAULT_SWARM_CONFIG: SwarmConfig = {
  maxWorkers: 5,
  claimRetries: 3,
  claimRetryDelayMs: 100,
  heartbeatIntervalMs: 30000,
  workerTimeoutMs: 300000,
  autoReleaseStale: true,
};

// ============================================================================
// Task Pool
// ============================================================================

/** Task in the swarm pool */
export interface SwarmTask {
  /** Task ID (matches Claude Task system) */
  id: string;
  /** Task subject */
  subject: string;
  /** Task description/action */
  description: string;
  /** Wave number for ordering */
  wave: number;
  /** Task IDs this task is blocked by */
  blockedBy: string[];
  /** Current status */
  status: SwarmTaskStatus;
  /** Worker ID that claimed this task */
  claimedBy?: string;
  /** When claimed */
  claimedAt?: string;
  /** When completed */
  completedAt?: string;
  /** Execution result */
  result?: SwarmTaskResult;
}

/** Swarm task status */
export type SwarmTaskStatus =
  | 'pending'     // Not yet available (blocked)
  | 'available'   // Ready to be claimed
  | 'claimed'     // Claimed by a worker
  | 'executing'   // Being executed
  | 'completed'   // Successfully completed
  | 'failed';     // Failed execution

/** Task execution result */
export interface SwarmTaskResult {
  /** Whether task succeeded */
  success: boolean;
  /** Output/summary */
  output?: string;
  /** Files modified */
  filesModified?: string[];
  /** Error message if failed */
  error?: string;
  /** Execution time in ms */
  executionTimeMs?: number;
}

// ============================================================================
// Swarm State
// ============================================================================

/** Complete swarm state */
export interface SwarmState {
  /** Plan path this swarm is for */
  planPath: string;
  /** Session ID */
  sessionId: string;
  /** Swarm configuration */
  config: SwarmConfig;
  /** All workers */
  workers: WorkerState[];
  /** Task pool */
  tasks: SwarmTask[];
  /** Overall status */
  status: SwarmStatus;
  /** Started timestamp */
  startedAt: string;
  /** Completed timestamp */
  completedAt?: string;
  /** Statistics */
  stats: SwarmStats;
}

/** Overall swarm status */
export type SwarmStatus =
  | 'initializing' // Setting up
  | 'running'      // Workers active
  | 'paused'       // Temporarily stopped
  | 'completing'   // Waiting for workers to finish
  | 'completed'    // All tasks done
  | 'failed';      // Unrecoverable error

/** Swarm statistics */
export interface SwarmStats {
  /** Total tasks */
  totalTasks: number;
  /** Completed tasks */
  completedTasks: number;
  /** Failed tasks */
  failedTasks: number;
  /** Tasks in progress */
  inProgressTasks: number;
  /** Available tasks */
  availableTasks: number;
  /** Blocked tasks */
  blockedTasks: number;
  /** Active workers */
  activeWorkers: number;
  /** Total execution time */
  totalExecutionTimeMs: number;
}

// ============================================================================
// Worker Prompt Templates
// ============================================================================

/** Worker prompt configuration */
export interface WorkerPromptConfig {
  /** Worker identity */
  worker: WorkerId;
  /** Plan path */
  planPath?: string;
  /** Session ID */
  sessionId?: string;
  /** Model to use */
  model?: 'haiku' | 'sonnet' | 'opus';
  /** Additional context */
  context?: string;
  /** Learnings to inject */
  learnings?: string;
}

// ============================================================================
// Orchestrator Commands
// ============================================================================

/** Command from orchestrator to worker */
export type OrchestratorCommand =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'terminate' }
  | { type: 'claim_task'; taskId: string }
  | { type: 'release_task'; taskId: string };

/** Worker report to orchestrator */
export interface WorkerReport {
  /** Worker ID */
  workerId: string;
  /** Report type */
  type: 'heartbeat' | 'task_claimed' | 'task_completed' | 'task_failed' | 'error';
  /** Task ID if applicable */
  taskId?: string;
  /** Task result if completed */
  result?: SwarmTaskResult;
  /** Error message if failed */
  error?: string;
  /** Timestamp */
  timestamp: string;
}
