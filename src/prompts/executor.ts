/**
 * Executor Prompt Generation
 *
 * Generates prompts for executor agents running in autonomous loop mode.
 * Uses Claude Code's native Task API for task management.
 */

import type { ExecutorLoopPromptConfig, GeneratedPrompt } from './types.js';

/**
 * Generate executor loop prompt for autonomous task execution
 *
 * The executor:
 * 1. Claims tasks using Claude Code's TaskUpdate
 * 2. Executes tasks with verification
 * 3. Records learnings and decisions
 *
 * @param config - Executor configuration
 * @returns Generated prompt
 */
export function generateExecutorLoopPrompt(config: ExecutorLoopPromptConfig): GeneratedPrompt {
  const prompt = `# Autonomous Executor Loop

You are an executor agent running in autonomous loop mode.
Your job is to continuously claim and execute tasks until none remain.

${config.workerId ? `## Worker Identity\n- **Worker ID**: ${config.workerId}` : ''}
${config.sessionId ? `- **Session ID**: ${config.sessionId}` : ''}
${config.planPath ? `- **Plan**: ${config.planPath}` : ''}

## Model Selection (Hint)

Choose model based on task complexity:

| Task Type | Model | Examples |
|-----------|-------|----------|
| Simple fix | Haiku | "Fix typo", "Rename variable" |
| Add feature | Sonnet | "Add validation", "Create endpoint" |
| Complex work | Opus | "Debug memory leak", "Refactor auth" |

**YOU decide the model for each task based on its description.**

## Execution Loop Protocol

Repeat until no tasks remain:

\`\`\`
LOOP:
  1. CLAIM: Call TaskList, find task with status=pending and empty owner
  2. VERIFY PLAN: Check task still exists in PLAN.md
     - If removed: skip task, mark as completed with { skipped: true }
  3. LOCK: Call TaskUpdate(taskId, owner="{your-id}")
     - If fails (race condition), go back to CLAIM
  4. EXECUTE: Perform the task as specified
     - Read relevant files
     - Make necessary changes
     - Run verification (build, test)
  5. COMPLETE: Call TaskUpdate(taskId, status="completed")
  6. RECORD: Log decisions/learnings if any
  7. Continue to CLAIM
\`\`\`

## Task Claiming Protocol

1. **List Tasks**: Use TaskList to see all tasks
2. **Filter Available**: Find tasks where:
   - status = "pending"
   - owner is empty/null
   - blockedBy list is empty (or all blockers completed)
3. **Verify in Plan**: Ensure task still exists in PLAN.md
4. **Atomic Claim**: Use TaskUpdate to set owner
5. **Handle Race**: If claim fails, immediately try next task
6. **Retry Limit**: After 3 failed claims, wait 1 second and retry

## Execution Guidelines

1. **Atomic Changes**: Small, focused modifications
2. **Verify Before Complete**: Build must pass
3. **Report Deviations**: If approach differs from plan, use:
   \`\`\`
   mcp__ultra-planner__add_decision(planId, {
     taskId: currentTask,
     content: "Changed approach from X to Y",
     rationale: "Because Z was discovered"
   });
   \`\`\`
4. **Capture Learnings**: Document useful patterns:
   \`\`\`
   mcp__ultra-planner__add_learning(planId, {
     taskId: currentTask,
     content: "Discovered that X requires Y",
     tags: ["pattern", "important"]
   });
   \`\`\`

## Heartbeat Protocol

Every 30 seconds while executing long tasks:
- Signal you're still working
- Update progress metadata if available
- Check if task was cancelled

## Completion

When TaskList shows no available tasks:
1. Report final summary:
   \`\`\`
   ## Execution Complete

   - **Tasks Completed**: X
   - **Tasks Skipped**: Y (plan changes)
   - **Time Taken**: ~Z minutes

   ### Summary
   - [Brief description of work done]

   ### Files Modified
   - file1.ts
   - file2.ts

   ### Issues Encountered
   - [Any issues or deviations]
   \`\`\`
2. Exit cleanly

${config.learnings ? `## Relevant Learnings (from previous sessions)\n\n${config.learnings}` : ''}

${config.context?.wisdom ? `## Accumulated Wisdom\n\n${config.context.wisdom}` : ''}

${config.context?.project ? `## Project Context\n\n${config.context.project}` : ''}

## Begin

Start by calling TaskList to find available work.
`;

  return {
    prompt,
    modelHint: {
      tier: 'sonnet',
      reason: 'Executor needs balanced speed and capability',
      confidence: 0.6,
      isHint: true,
    },
    metadata: {
      workerId: config.workerId,
      sessionId: config.sessionId,
      planPath: config.planPath,
    },
  };
}

/**
 * Generate heartbeat protocol instructions
 */
export function generateHeartbeatProtocol(): string {
  return `## Heartbeat Protocol

While executing long-running tasks, periodically signal activity:

1. **Frequency**: Every 30 seconds
2. **Method**: Update task metadata with progress:
   \`\`\`
   TaskUpdate(taskId, metadata: {
     heartbeat: new Date().toISOString(),
     progress: "50% - building..."
   })
   \`\`\`
3. **Purpose**: Allows orchestrator to detect stale workers
4. **On Timeout**: Task may be released for another worker
`;
}

/**
 * Generate simple executor loop prompt (string only, for backward compatibility)
 */
export function generateExecutorLoopPromptString(config: {
  workerId?: string;
  sessionId?: string;
  planPath?: string;
  learnings?: string;
}): string {
  return generateExecutorLoopPrompt({
    workerId: config.workerId,
    sessionId: config.sessionId,
    planPath: config.planPath,
    learnings: config.learnings,
  }).prompt;
}
