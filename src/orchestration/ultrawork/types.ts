/**
 * UltraWork Types
 *
 * Wave-based parallel execution with maximum parallelization.
 */

// ============================================================================
// Worker Types
// ============================================================================

export interface UltraWorkWorker {
  id: string;
  taskId: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  error?: string;
}

// ============================================================================
// Task Types
// ============================================================================

export interface UltraWorkTask {
  id: string;
  name: string;
  action: string;
  files: string[];
  wave: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  workerId?: string;
  result?: {
    success: boolean;
    output?: string;
    error?: string;
  };
}

// ============================================================================
// Session Types
// ============================================================================

export interface UltraWorkConfig {
  maxWorkers: number;
  planPath?: string;
}

export const DEFAULT_ULTRAWORK_CONFIG: UltraWorkConfig = {
  maxWorkers: 5,
};

export interface UltraWorkState {
  sessionId: string;
  planPath?: string;
  config: UltraWorkConfig;
  currentWave: number;
  totalWaves: number;
  tasks: UltraWorkTask[];
  workers: UltraWorkWorker[];
  status: 'initializing' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  stats: UltraWorkStats;
}

export interface UltraWorkStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  runningTasks: number;
  pendingTasks: number;
  activeWorkers: number;
}
