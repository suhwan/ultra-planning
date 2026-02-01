/**
 * Swarm State Management
 *
 * File-based state persistence for swarm coordination.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type {
  SwarmState,
  SwarmTask,
  SwarmConfig,
  WorkerState,
  SwarmStats,
} from './types.js';

const STATE_DIR = '.omc/state';
const STATE_FILE = 'swarm-state.json';

function getStatePath(): string {
  return join(process.cwd(), STATE_DIR, STATE_FILE);
}

function ensureStateDir(): void {
  const dir = join(process.cwd(), STATE_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function loadState(): SwarmState | null {
  const path = getStatePath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function saveState(state: SwarmState): void {
  ensureStateDir();
  writeFileSync(getStatePath(), JSON.stringify(state, null, 2));
}

// Generate session ID
function generateSessionId(): string {
  return `swarm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Calculate stats from tasks
function calculateStats(tasks: SwarmTask[], workers: WorkerState[]): SwarmStats {
  const completed = tasks.filter(t => t.status === 'completed').length;
  const failed = tasks.filter(t => t.status === 'failed').length;
  const inProgress = tasks.filter(t => t.status === 'claimed' || t.status === 'executing').length;
  const available = tasks.filter(t => t.status === 'available').length;
  const pending = tasks.filter(t => t.status === 'pending').length;
  const activeWorkers = workers.filter(w => w.status === 'executing' || w.status === 'claiming').length;

  return {
    totalTasks: tasks.length,
    completedTasks: completed,
    failedTasks: failed,
    inProgressTasks: inProgress,
    availableTasks: available,
    blockedTasks: pending,
    activeWorkers,
    totalExecutionTimeMs: 0, // Would need to calculate from task results
  };
}

// Check if task is unblocked
function isTaskUnblocked(task: SwarmTask, tasks: SwarmTask[]): boolean {
  if (task.blockedBy.length === 0) return true;
  return task.blockedBy.every(depId => {
    const dep = tasks.find(t => t.id === depId);
    return dep && dep.status === 'completed';
  });
}

// Update task availability based on dependencies
function updateTaskAvailability(state: SwarmState): void {
  for (const task of state.tasks) {
    if (task.status === 'pending' && isTaskUnblocked(task, state.tasks)) {
      task.status = 'available';
    }
  }
}

// Release stale claims (older than 5 minutes)
function releaseStaleClaimsInternal(state: SwarmState): string[] {
  const now = Date.now();
  const timeoutMs = state.config.workerTimeoutMs;
  const released: string[] = [];

  for (const task of state.tasks) {
    if (task.status === 'claimed' && task.claimedAt) {
      const claimAge = now - new Date(task.claimedAt).getTime();
      if (claimAge > timeoutMs) {
        task.status = 'available';
        task.claimedBy = undefined;
        task.claimedAt = undefined;
        released.push(task.id);
      }
    }
  }

  return released;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Initialize a new swarm session
 */
export function initSwarmSession(
  planPath: string,
  config?: Partial<SwarmConfig>
): SwarmState | null {
  const existing = loadState();
  if (existing && existing.status === 'running') {
    return null; // Already active
  }

  const sessionId = generateSessionId();
  const fullConfig: SwarmConfig = {
    maxWorkers: config?.maxWorkers ?? 5,
    claimRetries: config?.claimRetries ?? 3,
    claimRetryDelayMs: config?.claimRetryDelayMs ?? 100,
    heartbeatIntervalMs: config?.heartbeatIntervalMs ?? 30000,
    workerTimeoutMs: config?.workerTimeoutMs ?? 300000,
    autoReleaseStale: config?.autoReleaseStale ?? true,
  };

  const state: SwarmState = {
    planPath,
    sessionId,
    config: fullConfig,
    workers: [],
    tasks: [],
    status: 'initializing',
    startedAt: new Date().toISOString(),
    stats: {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      inProgressTasks: 0,
      availableTasks: 0,
      blockedTasks: 0,
      activeWorkers: 0,
      totalExecutionTimeMs: 0,
    },
  };

  saveState(state);
  return state;
}

/**
 * Add tasks to the swarm pool
 */
export function addSwarmTasks(tasks: Array<{
  id: string;
  subject: string;
  description: string;
  wave?: number;
  blockedBy?: string[];
}>): { added: number; state: SwarmState } | null {
  const state = loadState();
  if (!state) return null;

  for (const t of tasks) {
    const swarmTask: SwarmTask = {
      id: t.id,
      subject: t.subject,
      description: t.description,
      wave: t.wave ?? 1,
      blockedBy: t.blockedBy ?? [],
      status: t.blockedBy && t.blockedBy.length > 0 ? 'pending' : 'available',
    };
    state.tasks.push(swarmTask);
  }

  updateTaskAvailability(state);
  state.stats = calculateStats(state.tasks, state.workers);
  state.status = 'running';
  saveState(state);

  return { added: tasks.length, state };
}

/**
 * Atomically claim a task for a worker
 * Returns the claimed task or null if claim failed
 */
export function claimSwarmTask(workerId: string): SwarmTask | null {
  const state = loadState();
  if (!state) return null;

  // Auto-release stale claims if enabled
  if (state.config.autoReleaseStale) {
    releaseStaleClaimsInternal(state);
    updateTaskAvailability(state);
  }

  // Find first available task
  const task = state.tasks.find(t => t.status === 'available');
  if (!task) return null;

  // Claim it
  task.status = 'claimed';
  task.claimedBy = workerId;
  task.claimedAt = new Date().toISOString();

  // Update worker state
  let worker = state.workers.find(w => w.worker.id === workerId);
  if (!worker) {
    const newWorker: WorkerState = {
      worker: { id: workerId, name: workerId, index: state.workers.length },
      status: 'executing',
      currentTaskId: task.id,
      completedTasks: [],
      failedTasks: [],
      lastHeartbeat: new Date().toISOString(),
    };
    state.workers.push(newWorker);
  } else {
    worker.status = 'executing';
    worker.currentTaskId = task.id;
    worker.lastHeartbeat = new Date().toISOString();
  }

  state.stats = calculateStats(state.tasks, state.workers);
  saveState(state);

  return task;
}

/**
 * Mark a task as completed
 */
export function completeSwarmTask(
  taskId: string,
  result?: { output?: string; filesModified?: string[] }
): boolean {
  const state = loadState();
  if (!state) return false;

  const task = state.tasks.find(t => t.id === taskId);
  if (!task || task.status !== 'claimed') return false;

  const workerId = task.claimedBy;
  task.status = 'completed';
  task.completedAt = new Date().toISOString();
  task.result = {
    success: true,
    output: result?.output,
    filesModified: result?.filesModified,
  };

  // Update worker
  if (workerId) {
    const worker = state.workers.find(w => w.worker.id === workerId);
    if (worker) {
      worker.completedTasks.push(taskId);
      worker.currentTaskId = undefined;
      worker.status = 'idle';
    }
  }

  // Update availability of dependent tasks
  updateTaskAvailability(state);
  state.stats = calculateStats(state.tasks, state.workers);

  // Check if all done
  if (state.stats.completedTasks + state.stats.failedTasks === state.stats.totalTasks) {
    state.status = 'completed';
    state.completedAt = new Date().toISOString();
  }

  saveState(state);
  return true;
}

/**
 * Release a task back to available
 */
export function releaseSwarmTask(taskId: string): boolean {
  const state = loadState();
  if (!state) return false;

  const task = state.tasks.find(t => t.id === taskId);
  if (!task || task.status !== 'claimed') return false;

  const workerId = task.claimedBy;
  task.status = 'available';
  task.claimedBy = undefined;
  task.claimedAt = undefined;

  if (workerId) {
    const worker = state.workers.find(w => w.worker.id === workerId);
    if (worker && worker.currentTaskId === taskId) {
      worker.currentTaskId = undefined;
      worker.status = 'idle';
    }
  }

  state.stats = calculateStats(state.tasks, state.workers);
  saveState(state);
  return true;
}

/**
 * Get current swarm state
 */
export function getSwarmState(): SwarmState | null {
  const state = loadState();
  if (!state) return null;

  // Auto-release stale claims if enabled
  if (state.config.autoReleaseStale) {
    const released = releaseStaleClaimsInternal(state);
    if (released.length > 0) {
      updateTaskAvailability(state);
      state.stats = calculateStats(state.tasks, state.workers);
      saveState(state);
    }
  }

  return state;
}

/**
 * End swarm session
 */
export function endSwarmSession(): boolean {
  const state = loadState();
  if (!state) return false;

  state.status = 'completed';
  state.completedAt = new Date().toISOString();
  saveState(state);
  return true;
}

/**
 * Release stale claims (called manually)
 */
export function releaseStaleClaimsManual(): { released: string[] } | null {
  const state = loadState();
  if (!state) return null;

  const released = releaseStaleClaimsInternal(state);
  if (released.length > 0) {
    updateTaskAvailability(state);
    state.stats = calculateStats(state.tasks, state.workers);
    saveState(state);
  }

  return { released };
}
