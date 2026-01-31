/**
 * Orchestrator Prompt Generation
 *
 * Generates prompts for orchestrator agents that coordinate workers.
 * Uses Claude Code's native Task API for worker management.
 */

import type { OrchestratorPromptConfig, GeneratedPrompt } from './types.js';

/**
 * Generate orchestrator prompt for managing parallel workers
 *
 * The orchestrator:
 * 1. Spawns workers using Claude Code's Task tool
 * 2. Monitors progress using TaskList
 * 3. Handles failures and plan changes
 *
 * @param config - Orchestrator configuration
 * @returns Generated prompt
 */
export function generateOrchestratorPrompt(config: OrchestratorPromptConfig): GeneratedPrompt {
  const prompt = `# Swarm Orchestrator

You are orchestrating a swarm of ${config.workerCount} parallel workers executing tasks from: ${config.planPath}

${config.sessionId ? `## Session\n- **Session ID**: ${config.sessionId}` : ''}

## Your Responsibilities

1. **Initialize Workers**: Spawn ${config.workerCount} worker agents using Task tool with run_in_background: true
2. **Monitor Progress**: Periodically check TaskList for progress
3. **Handle Failures**: Restart failed workers if needed
4. **Detect Plan Changes**: Sync tasks if plan is modified
5. **Report Completion**: When all tasks are done, summarize results

## Spawning Workers

For each worker (0 to ${config.workerCount - 1}):

\`\`\`typescript
Task(
  subagent_type: "oh-my-claudecode:executor",
  model: "sonnet",  // or choose based on task complexity
  run_in_background: true,
  prompt: generateWorkerPrompt({ worker: { id: "worker-N", name: "Worker-N", index: N } })
)
\`\`\`

## Model Selection (Hint)

Ultra Planner suggests models per task complexity:

| Complexity | Model | Use For |
|------------|-------|---------|
| Simple | Haiku | Find, lookup, minor fixes |
| Standard | Sonnet | Implement, add, modify |
| Complex | Opus | Refactor, debug, architect |

**You decide the actual model based on task descriptions.**

## Monitoring Protocol

Every 30 seconds (or when a worker completes):

\`\`\`
1. Call TaskList
2. Count: pending, in_progress, completed
3. Calculate progress: completed / total * 100%
4. Check for stuck tasks (in_progress > 5 min with no update)
5. If stuck, consider respawning worker
\`\`\`

## Plan Change Detection

**IMPORTANT**: Before each monitoring cycle:

\`\`\`
1. Re-read ${config.planPath}
2. Compare task list with current TaskList
3. If tasks were added:
   - Create new tasks using TaskCreate
4. If tasks were removed:
   - Mark them as completed with { skipped: true }
5. If tasks were modified:
   - Update description if worker hasn't claimed yet
\`\`\`

## Failure Handling

When a worker fails or times out:
1. Release the task: TaskUpdate(taskId, owner: null, status: "pending")
2. Spawn replacement worker
3. Log the failure for analysis

## Progress Reporting

Format progress updates as:

\`\`\`
## Swarm Progress

- **Completed**: X / Y tasks (Z%)
- **In Progress**: A tasks
- **Pending**: B tasks
- **Workers Active**: C / ${config.workerCount}

### Recently Completed
- Task 1: [description] ✓
- Task 2: [description] ✓
\`\`\`

## Completion

When all tasks are completed (pending = 0, in_progress = 0):

1. Verify all workers have exited
2. Generate summary report:
   - Total tasks completed
   - Time taken
   - Any issues encountered
   - Files modified
3. Call Architect for verification (optional but recommended):
   \`\`\`
   Task(
     subagent_type: "oh-my-claudecode:architect",
     model: "opus",
     prompt: "Verify all changes from swarm execution..."
   )
   \`\`\`

## Decision Recording

Record orchestration decisions:

\`\`\`
mcp__ultra-planner__add_decision(planId, {
  taskId: "orchestrator",
  content: "Spawned 5 workers for Phase 1",
  rationale: "10 tasks, optimal parallelization"
});
\`\`\`

${config.context?.wisdom ? `## Accumulated Wisdom\n\n${config.context.wisdom}` : ''}

${config.context?.project ? `## Project Context\n\n${config.context.project}` : ''}

## Begin

Initialize the swarm and spawn workers using Claude Code's Task tool.
`;

  return {
    prompt,
    modelHint: {
      tier: 'sonnet',
      reason: 'Orchestration requires balanced reasoning and speed',
      confidence: 0.7,
      isHint: true,
    },
    metadata: {
      planPath: config.planPath,
      workerCount: config.workerCount,
      sessionId: config.sessionId,
    },
  };
}

/**
 * Generate simple orchestrator prompt (string only, for backward compatibility)
 */
export function generateOrchestratorPromptString(
  planPath: string,
  sessionId: string,
  workerCount: number
): string {
  return generateOrchestratorPrompt({ planPath, sessionId, workerCount }).prompt;
}
