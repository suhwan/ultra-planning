/**
 * UltraWork State Management
 *
 * File-based state persistence for wave-based parallel execution.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type {
  UltraWorkState,
  UltraWorkTask,
  UltraWorkWorker,
  UltraWorkConfig,
  UltraWorkStats,
} from './types.js';

const STATE_DIR = '.omc/state';
const STATE_FILE = 'ultrawork-state.json';

function getStatePath(): string {
  return join(process.cwd(), STATE_DIR, STATE_FILE);
}

function ensureStateDir(): void {
  const dir = join(process.cwd(), STATE_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function loadState(): UltraWorkState | null {
  const path = getStatePath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function saveState(state: UltraWorkState): void {
  ensureStateDir();
  writeFileSync(getStatePath(), JSON.stringify(state, null, 2));
}

function generateSessionId(): string {
  return `ultrawork-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateWorkerId(): string {
  return `worker-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function calculateStats(tasks: UltraWorkTask[], workers: UltraWorkWorker[]): UltraWorkStats {
  return {
    totalTasks: tasks.length,
    completedTasks: tasks.filter(t => t.status === 'completed').length,
    failedTasks: tasks.filter(t => t.status === 'failed').length,
    runningTasks: tasks.filter(t => t.status === 'running').length,
    pendingTasks: tasks.filter(t => t.status === 'pending').length,
    activeWorkers: workers.filter(w => w.status === 'running').length,
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Initialize UltraWork session
 */
export function initUltraWorkSession(
  tasks: Array<{ id: string; name: string; action: string; files: string[]; wave: number }>,
  config?: Partial<UltraWorkConfig>
): UltraWorkState | null {
  const existing = loadState();
  if (existing && existing.status === 'running') {
    return null;
  }

  const fullConfig: UltraWorkConfig = {
    maxWorkers: config?.maxWorkers ?? 5,
    planPath: config?.planPath,
  };

  const ultraworkTasks: UltraWorkTask[] = tasks.map(t => ({
    ...t,
    status: 'pending',
  }));

  const waves = new Set(tasks.map(t => t.wave));
  const totalWaves = waves.size > 0 ? Math.max(...waves) : 0;

  const state: UltraWorkState = {
    sessionId: generateSessionId(),
    planPath: config?.planPath,
    config: fullConfig,
    currentWave: 1,
    totalWaves,
    tasks: ultraworkTasks,
    workers: [],
    status: 'running',
    startedAt: new Date().toISOString(),
    stats: calculateStats(ultraworkTasks, []),
  };

  saveState(state);
  return state;
}

/**
 * Get tasks available for parallel execution in current wave
 */
export function getParallelTasks(): UltraWorkTask[] | null {
  const state = loadState();
  if (!state) return null;

  // Get pending tasks in current wave
  const waveTasks = state.tasks.filter(
    t => t.wave === state.currentWave && t.status === 'pending'
  );

  // Limit to available worker slots
  const activeWorkers = state.workers.filter(w => w.status === 'running').length;
  const availableSlots = state.config.maxWorkers - activeWorkers;

  return waveTasks.slice(0, availableSlots);
}

/**
 * Spawn a worker for a task
 */
export function spawnUltraWorkWorker(taskId: string): UltraWorkWorker | null {
  const state = loadState();
  if (!state) return null;

  const task = state.tasks.find(t => t.id === taskId);
  if (!task || task.status !== 'pending') return null;

  // Check worker limit
  const activeWorkers = state.workers.filter(w => w.status === 'running').length;
  if (activeWorkers >= state.config.maxWorkers) return null;

  const worker: UltraWorkWorker = {
    id: generateWorkerId(),
    taskId,
    status: 'running',
    startedAt: new Date().toISOString(),
  };

  task.status = 'running';
  task.workerId = worker.id;
  state.workers.push(worker);
  state.stats = calculateStats(state.tasks, state.workers);

  saveState(state);
  return worker;
}

/**
 * Complete a worker's task
 */
export function completeUltraWorkWorker(
  workerId: string,
  result?: { output?: string }
): boolean {
  const state = loadState();
  if (!state) return false;

  const worker = state.workers.find(w => w.id === workerId);
  if (!worker || worker.status !== 'running') return false;

  const task = state.tasks.find(t => t.workerId === workerId);
  if (task) {
    task.status = 'completed';
    task.result = { success: true, output: result?.output };
  }

  worker.status = 'completed';
  worker.completedAt = new Date().toISOString();

  // Check if wave is complete
  const waveComplete = state.tasks
    .filter(t => t.wave === state.currentWave)
    .every(t => t.status === 'completed' || t.status === 'failed');

  if (waveComplete && state.currentWave < state.totalWaves) {
    state.currentWave++;
  } else if (waveComplete && state.currentWave >= state.totalWaves) {
    state.status = 'completed';
    state.completedAt = new Date().toISOString();
  }

  state.stats = calculateStats(state.tasks, state.workers);
  saveState(state);
  return true;
}

/**
 * Fail a worker's task
 */
export function failUltraWorkWorker(workerId: string, error: string): boolean {
  const state = loadState();
  if (!state) return false;

  const worker = state.workers.find(w => w.id === workerId);
  if (!worker) return false;

  const task = state.tasks.find(t => t.workerId === workerId);
  if (task) {
    task.status = 'failed';
    task.result = { success: false, error };
  }

  worker.status = 'failed';
  worker.completedAt = new Date().toISOString();
  worker.error = error;

  state.stats = calculateStats(state.tasks, state.workers);
  saveState(state);
  return true;
}

/**
 * Get UltraWork progress
 */
export function getUltraWorkProgress(): {
  state: UltraWorkState;
  progress: number;
  currentWaveProgress: number;
} | null {
  const state = loadState();
  if (!state) return null;

  const progress = state.stats.totalTasks > 0
    ? Math.round((state.stats.completedTasks / state.stats.totalTasks) * 100)
    : 0;

  const currentWaveTasks = state.tasks.filter(t => t.wave === state.currentWave);
  const currentWaveCompleted = currentWaveTasks.filter(
    t => t.status === 'completed' || t.status === 'failed'
  ).length;
  const currentWaveProgress = currentWaveTasks.length > 0
    ? Math.round((currentWaveCompleted / currentWaveTasks.length) * 100)
    : 0;

  return { state, progress, currentWaveProgress };
}

/**
 * End UltraWork session
 */
export function endUltraWorkSession(): boolean {
  const state = loadState();
  if (!state) return false;

  state.status = 'completed';
  state.completedAt = new Date().toISOString();
  saveState(state);
  return true;
}
