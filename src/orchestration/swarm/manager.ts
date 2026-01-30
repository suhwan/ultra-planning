/**
 * Swarm Manager
 *
 * Orchestrates multiple parallel workers using native Claude Code Task API.
 * Manages task pool, worker coordination, and claim resolution.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { randomUUID } from 'crypto';

import {
  WorkerId,
  WorkerState,
  WorkerStatus,
  SwarmTask,
  SwarmTaskStatus,
  SwarmTaskResult,
  SwarmState,
  SwarmStatus,
  SwarmStats,
  SwarmConfig,
  WorkerPromptConfig,
  WorkerReport,
  DEFAULT_SWARM_CONFIG,
} from './types.js';

import { buildDependencyMap } from '../../sync/dependency-map.js';
import { parsePlanForSync, extractTaskMappings } from '../../sync/plan-parser.js';

// ============================================================================
// State File Management
// ============================================================================

const SWARM_STATE_DIR = '.ultraplan/state/swarm';

/**
 * Get swarm state path
 */
function getSwarmStatePath(sessionId: string, projectRoot: string = process.cwd()): string {
  return join(projectRoot, SWARM_STATE_DIR, `${sessionId}.json`);
}

/**
 * Load swarm state
 */
export function loadSwarmState(
  sessionId: string,
  projectRoot: string = process.cwd()
): SwarmState | null {
  const statePath = getSwarmStatePath(sessionId, projectRoot);

  if (!existsSync(statePath)) {
    return null;
  }

  try {
    const data = readFileSync(statePath, 'utf-8');
    return JSON.parse(data) as SwarmState;
  } catch {
    return null;
  }
}

/**
 * Save swarm state
 */
function saveSwarmState(state: SwarmState, projectRoot: string = process.cwd()): void {
  const statePath = getSwarmStatePath(state.sessionId, projectRoot);
  const dir = dirname(statePath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

// ============================================================================
// Swarm Initialization
// ============================================================================

/**
 * Initialize a new swarm from a plan
 */
export async function initializeSwarm(
  planPath: string,
  config: Partial<SwarmConfig> = {},
  projectRoot: string = process.cwd()
): Promise<SwarmState> {
  const fullConfig: SwarmConfig = { ...DEFAULT_SWARM_CONFIG, ...config };
  const sessionId = randomUUID();

  // Parse plan and extract tasks
  const planData = await parsePlanForSync(join(projectRoot, planPath));
  const taskMappings = extractTaskMappings(planData);
  const dependencyMap = buildDependencyMap(taskMappings);

  // Create swarm tasks
  const tasks: SwarmTask[] = taskMappings.map(mapping => ({
    id: mapping.task_id,
    subject: mapping.name,
    description: mapping.tool_params.prompt,
    wave: mapping.wave,
    blockedBy: dependencyMap[mapping.task_id] || [],
    status: 'pending' as SwarmTaskStatus,
  }));

  // Mark wave 1 tasks as available
  for (const task of tasks) {
    if (task.wave === 1) {
      task.status = 'available';
    }
  }

  // Initialize workers
  const workers: WorkerState[] = [];
  for (let i = 0; i < fullConfig.maxWorkers; i++) {
    workers.push({
      worker: {
        id: randomUUID(),
        name: `Worker-${i + 1}`,
        index: i,
      },
      status: 'idle',
      completedTasks: [],
      failedTasks: [],
      lastHeartbeat: new Date().toISOString(),
    });
  }

  // Calculate initial stats
  const stats = calculateStats(tasks, workers);

  const state: SwarmState = {
    planPath,
    sessionId,
    config: fullConfig,
    workers,
    tasks,
    status: 'initializing',
    startedAt: new Date().toISOString(),
    stats,
  };

  saveSwarmState(state, projectRoot);

  return state;
}

/**
 * Calculate swarm statistics
 */
function calculateStats(tasks: SwarmTask[], workers: WorkerState[]): SwarmStats {
  return {
    totalTasks: tasks.length,
    completedTasks: tasks.filter(t => t.status === 'completed').length,
    failedTasks: tasks.filter(t => t.status === 'failed').length,
    inProgressTasks: tasks.filter(t => t.status === 'executing' || t.status === 'claimed').length,
    availableTasks: tasks.filter(t => t.status === 'available').length,
    blockedTasks: tasks.filter(t => t.status === 'pending').length,
    activeWorkers: workers.filter(w => w.status === 'executing' || w.status === 'claiming').length,
    totalExecutionTimeMs: tasks
      .filter(t => t.result?.executionTimeMs)
      .reduce((sum, t) => sum + (t.result?.executionTimeMs || 0), 0),
  };
}

// ============================================================================
// Task Pool Management
// ============================================================================

/**
 * Get available tasks (not blocked, not claimed)
 */
export function getAvailableTasks(sessionId: string, projectRoot: string = process.cwd()): SwarmTask[] {
  const state = loadSwarmState(sessionId, projectRoot);
  if (!state) return [];

  return state.tasks.filter(t => t.status === 'available');
}

/**
 * Try to claim a task for a worker
 * Returns the task if claimed, null if failed (race condition)
 */
export function claimTask(
  sessionId: string,
  workerId: string,
  taskId: string,
  projectRoot: string = process.cwd()
): SwarmTask | null {
  const state = loadSwarmState(sessionId, projectRoot);
  if (!state) return null;

  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return null;

  // Check if task is available
  if (task.status !== 'available') {
    return null; // Already claimed or not available
  }

  // Claim the task
  task.status = 'claimed';
  task.claimedBy = workerId;
  task.claimedAt = new Date().toISOString();

  // Update worker state
  const worker = state.workers.find(w => w.worker.id === workerId);
  if (worker) {
    worker.status = 'executing';
    worker.currentTaskId = taskId;
    worker.lastHeartbeat = new Date().toISOString();
  }

  // Update stats
  state.stats = calculateStats(state.tasks, state.workers);

  saveSwarmState(state, projectRoot);

  return task;
}

/**
 * Try to claim any available task
 */
export function claimAnyTask(
  sessionId: string,
  workerId: string,
  projectRoot: string = process.cwd()
): SwarmTask | null {
  const available = getAvailableTasks(sessionId, projectRoot);
  if (available.length === 0) return null;

  // Try to claim the first available task
  // In real concurrent scenario, this might fail due to race condition
  for (const task of available) {
    const claimed = claimTask(sessionId, workerId, task.id, projectRoot);
    if (claimed) return claimed;
  }

  return null;
}

/**
 * Release a claimed task (worker giving up)
 */
export function releaseTask(
  sessionId: string,
  workerId: string,
  taskId: string,
  projectRoot: string = process.cwd()
): boolean {
  const state = loadSwarmState(sessionId, projectRoot);
  if (!state) return false;

  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return false;

  // Verify the worker owns this task
  if (task.claimedBy !== workerId) {
    return false;
  }

  // Release the task
  task.status = 'available';
  task.claimedBy = undefined;
  task.claimedAt = undefined;

  // Update worker state
  const worker = state.workers.find(w => w.worker.id === workerId);
  if (worker) {
    worker.status = 'idle';
    worker.currentTaskId = undefined;
  }

  state.stats = calculateStats(state.tasks, state.workers);
  saveSwarmState(state, projectRoot);

  return true;
}

/**
 * Mark a task as completed
 */
export function completeTask(
  sessionId: string,
  workerId: string,
  taskId: string,
  result: SwarmTaskResult,
  projectRoot: string = process.cwd()
): boolean {
  const state = loadSwarmState(sessionId, projectRoot);
  if (!state) return false;

  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return false;

  // Verify the worker owns this task
  if (task.claimedBy !== workerId) {
    return false;
  }

  // Complete the task
  task.status = result.success ? 'completed' : 'failed';
  task.completedAt = new Date().toISOString();
  task.result = result;

  // Update worker state
  const worker = state.workers.find(w => w.worker.id === workerId);
  if (worker) {
    worker.status = 'idle';
    worker.currentTaskId = undefined;
    if (result.success) {
      worker.completedTasks.push(taskId);
    } else {
      worker.failedTasks.push(taskId);
    }
  }

  // Unblock tasks that were waiting on this one
  if (result.success) {
    updateBlockedTasks(state);
  }

  // Check if swarm is complete
  checkSwarmCompletion(state);

  state.stats = calculateStats(state.tasks, state.workers);
  saveSwarmState(state, projectRoot);

  return true;
}

/**
 * Update blocked tasks after a task completion
 */
function updateBlockedTasks(state: SwarmState): void {
  const completedIds = new Set(
    state.tasks.filter(t => t.status === 'completed').map(t => t.id)
  );

  for (const task of state.tasks) {
    if (task.status === 'pending') {
      // Check if all blocking tasks are complete
      const allBlockersComplete = task.blockedBy.every(id => completedIds.has(id));
      if (allBlockersComplete) {
        task.status = 'available';
      }
    }
  }
}

/**
 * Check if swarm execution is complete
 */
function checkSwarmCompletion(state: SwarmState): void {
  const pendingOrAvailable = state.tasks.filter(
    t => t.status === 'pending' || t.status === 'available' || t.status === 'claimed' || t.status === 'executing'
  );

  if (pendingOrAvailable.length === 0) {
    state.status = 'completed';
    state.completedAt = new Date().toISOString();
  }
}

// ============================================================================
// Worker Management
// ============================================================================

/**
 * Update worker heartbeat
 */
export function workerHeartbeat(
  sessionId: string,
  workerId: string,
  projectRoot: string = process.cwd()
): boolean {
  const state = loadSwarmState(sessionId, projectRoot);
  if (!state) return false;

  const worker = state.workers.find(w => w.worker.id === workerId);
  if (!worker) return false;

  worker.lastHeartbeat = new Date().toISOString();
  saveSwarmState(state, projectRoot);

  return true;
}

/**
 * Check for stale workers and release their tasks
 */
export function cleanupStaleWorkers(
  sessionId: string,
  projectRoot: string = process.cwd()
): string[] {
  const state = loadSwarmState(sessionId, projectRoot);
  if (!state || !state.config.autoReleaseStale) return [];

  const now = Date.now();
  const releasedTasks: string[] = [];

  for (const worker of state.workers) {
    const lastHeartbeat = new Date(worker.lastHeartbeat).getTime();
    const isStale = now - lastHeartbeat > state.config.workerTimeoutMs;

    if (isStale && worker.currentTaskId) {
      // Release the stale task
      const task = state.tasks.find(t => t.id === worker.currentTaskId);
      if (task && task.status === 'claimed') {
        task.status = 'available';
        task.claimedBy = undefined;
        task.claimedAt = undefined;
        releasedTasks.push(task.id);
      }

      worker.status = 'terminated';
      worker.currentTaskId = undefined;
      worker.error = 'Worker timed out';
    }
  }

  if (releasedTasks.length > 0) {
    state.stats = calculateStats(state.tasks, state.workers);
    saveSwarmState(state, projectRoot);
  }

  return releasedTasks;
}

/**
 * Get worker state
 */
export function getWorkerState(
  sessionId: string,
  workerId: string,
  projectRoot: string = process.cwd()
): WorkerState | null {
  const state = loadSwarmState(sessionId, projectRoot);
  if (!state) return null;

  return state.workers.find(w => w.worker.id === workerId) || null;
}

// ============================================================================
// Swarm Control
// ============================================================================

/**
 * Start the swarm
 */
export function startSwarm(
  sessionId: string,
  projectRoot: string = process.cwd()
): boolean {
  const state = loadSwarmState(sessionId, projectRoot);
  if (!state) return false;

  state.status = 'running';
  saveSwarmState(state, projectRoot);

  return true;
}

/**
 * Pause the swarm
 */
export function pauseSwarm(
  sessionId: string,
  projectRoot: string = process.cwd()
): boolean {
  const state = loadSwarmState(sessionId, projectRoot);
  if (!state) return false;

  state.status = 'paused';
  saveSwarmState(state, projectRoot);

  return true;
}

/**
 * Get swarm status
 */
export function getSwarmStatus(
  sessionId: string,
  projectRoot: string = process.cwd()
): { status: SwarmStatus; stats: SwarmStats } | null {
  const state = loadSwarmState(sessionId, projectRoot);
  if (!state) return null;

  return {
    status: state.status,
    stats: state.stats,
  };
}

/**
 * Get full swarm state
 */
export function getSwarmState(
  sessionId: string,
  projectRoot: string = process.cwd()
): SwarmState | null {
  return loadSwarmState(sessionId, projectRoot);
}

// ============================================================================
// Worker Prompt Generation
// ============================================================================

/**
 * Generate worker prompt for autonomous task execution
 */
export function generateWorkerPrompt(config: WorkerPromptConfig): string {
  return `# Swarm Worker: ${config.worker.name}

You are a worker in a parallel execution swarm. Your job is to:
1. Claim available tasks from the task pool
2. Execute claimed tasks
3. Report completion and move to the next task
4. Continue until no tasks remain

## Worker Identity
- **Worker ID**: ${config.worker.id}
- **Worker Name**: ${config.worker.name}
${config.sessionId ? `- **Session ID**: ${config.sessionId}` : ''}
${config.planPath ? `- **Plan**: ${config.planPath}` : ''}

## Execution Loop

Repeat until no available tasks:

\`\`\`
1. Call TaskList to see available tasks
2. Find a task with status "pending" and no owner
3. Call TaskUpdate to set yourself as owner:
   TaskUpdate(taskId, owner: "${config.worker.id}")
4. If claim fails (someone else got it), go back to step 1
5. Execute the task as specified in its description
6. Call TaskUpdate to mark complete:
   TaskUpdate(taskId, status: "completed")
7. Go back to step 1
\`\`\`

## Task Claiming Protocol

When claiming a task:
1. Check TaskList for available tasks (status: pending, no blockedBy remaining)
2. Call TaskUpdate with owner set to your worker ID
3. If the task was already claimed by another worker, the update will fail
4. On failure, immediately try claiming a different task
5. Retry up to 3 times before reporting no work available

## Completion Reporting

After completing a task:
1. Mark the task as completed using TaskUpdate
2. Include a brief summary of what was done
3. List any files modified
4. Report any issues or deviations

## Rules

1. **Atomic Commits**: Make small, focused changes
2. **No Conflicts**: Only modify files specified in your task
3. **Report Deviations**: If you need to change approach, report it
4. **Heartbeat**: Periodically signal you're still working
5. **Clean Exit**: When no tasks remain, report completion

${config.learnings ? `## Relevant Learnings\n\n${config.learnings}` : ''}

${config.context ? `## Additional Context\n\n${config.context}` : ''}

## Begin Execution

Start by calling TaskList to see available tasks.
`;
}

/**
 * Generate orchestrator prompt for managing the swarm
 */
export function generateOrchestratorPrompt(
  planPath: string,
  sessionId: string,
  workerCount: number
): string {
  return `# Swarm Orchestrator

You are orchestrating a swarm of ${workerCount} parallel workers executing tasks from: ${planPath}

## Session
- **Session ID**: ${sessionId}

## Your Responsibilities

1. **Initialize Workers**: Spawn ${workerCount} worker agents using Task tool with run_in_background: true
2. **Monitor Progress**: Periodically check swarm status
3. **Handle Failures**: Restart failed workers if needed
4. **Clean Up**: Release stale task claims
5. **Report Completion**: When all tasks are done, summarize results

## Spawning Workers

For each worker (0 to ${workerCount - 1}):

\`\`\`
Task(
  subagent_type: "oh-my-claudecode:executor",
  model: "sonnet",
  run_in_background: true,
  prompt: "<worker prompt with worker ID>"
)
\`\`\`

## Monitoring

Every 30 seconds:
1. Check getSwarmStatus for overall progress
2. Check for stale workers using cleanupStaleWorkers
3. If a worker died, spawn a replacement

## Completion

When stats show completedTasks == totalTasks:
1. Stop all workers
2. Generate summary report
3. Mark swarm as complete

## Begin

Initialize the swarm and spawn workers.
`;
}
