/**
 * Swarm Manager - Simplified for Context Architect Pattern
 *
 * Provides configuration and prompt generation support for swarm execution.
 * State management is delegated to Claude Code's native Task API.
 *
 * @module swarm
 */

import {
  WorkerId,
  WorkerState,
  SwarmConfig,
  WorkerPromptConfig,
  DEFAULT_SWARM_CONFIG,
} from './types.js';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Create swarm configuration with defaults
 */
export function createSwarmConfig(options: Partial<SwarmConfig> = {}): SwarmConfig {
  return { ...DEFAULT_SWARM_CONFIG, ...options };
}

/**
 * Get recommended worker count based on task count
 */
export function recommendWorkerCount(taskCount: number): number {
  // Rule of thumb: 1 worker per 3 tasks, max 5 workers
  const recommended = Math.ceil(taskCount / 3);
  return Math.min(recommended, DEFAULT_SWARM_CONFIG.maxWorkers);
}

// ============================================================================
// Worker Identity Generation
// ============================================================================

/**
 * Generate worker identities for a swarm
 */
export function generateWorkerIds(count: number, sessionId?: string): WorkerId[] {
  const workers: WorkerId[] = [];

  for (let i = 0; i < count; i++) {
    workers.push({
      id: sessionId ? `${sessionId}-worker-${i}` : `worker-${i}-${Date.now()}`,
      name: `Worker-${i + 1}`,
      index: i,
    });
  }

  return workers;
}

// ============================================================================
// Prompt Generation (Legacy - use prompts module instead)
// ============================================================================

/**
 * Generate worker prompt for autonomous task execution
 *
 * @deprecated Use prompts module generateWorkerPrompt instead
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

Use Claude Code's native Task API:

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
5. Retry up to ${config.model === 'haiku' ? 2 : 3} times before reporting no work available

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
 *
 * @deprecated Use prompts module generateOrchestratorPrompt instead
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
2. **Monitor Progress**: Periodically check TaskList for overall progress
3. **Handle Completion**: When all tasks are done, summarize results

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
1. Check TaskList for overall progress
2. Count completed vs total tasks
3. Report progress

## Completion

When TaskList shows all tasks completed:
1. Report final summary
2. List any failed tasks
3. Mark orchestration complete

## Begin

Initialize the swarm and spawn workers.
`;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate estimated execution time for a swarm
 */
export function estimateSwarmDuration(
  taskCount: number,
  workerCount: number,
  avgTaskMinutes: number = 5
): {
  estimatedMinutes: number;
  parallel: boolean;
} {
  const parallel = workerCount > 1;
  const estimatedMinutes = parallel
    ? Math.ceil(taskCount * avgTaskMinutes / workerCount)
    : taskCount * avgTaskMinutes;

  return { estimatedMinutes, parallel };
}

/**
 * Generate a session ID for swarm execution
 */
export function generateSessionId(): string {
  return `swarm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================================
// DEPRECATED: State Management Functions
// ============================================================================
// These functions have been removed in v3.0 following the Context Architect pattern.
// State management is now handled by Claude Code's native Task API.
//
// Removed functions:
// - initializeSwarm() - Use TaskCreate instead
// - claimTask() - Use TaskUpdate with owner instead
// - completeTask() - Use TaskUpdate with status instead
// - getSwarmStatus() - Use TaskList instead
// - loadSwarmState() - Use TaskList instead
// - cleanupStaleWorkers() - Claude Code handles timeouts
//
// See: https://docs.anthropic.com/claude-code/task-api
