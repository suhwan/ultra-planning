/**
 * Worker Prompt Generation
 *
 * Generates prompts for worker agents in the Context Architect pattern.
 * Workers use Claude Code's native Task API for execution.
 */

import type { WorkerPromptConfig, GeneratedPrompt, ModelHint } from './types.js';
import { formatArtifactReference, formatArtifactCollection } from '../artifacts/index.js';

/**
 * Generate a model selection hint based on task context
 */
function suggestModel(config: WorkerPromptConfig): ModelHint {
  // This is a HINT, not a rule. Claude makes the final decision.
  const hasLearnings = !!config.learnings;
  const hasComplexContext = config.context?.wisdom?.includes('refactor') ||
    config.context?.wisdom?.includes('architecture');

  if (hasComplexContext) {
    return {
      tier: 'opus',
      reason: 'Complex context detected (architecture/refactoring)',
      confidence: 0.7,
      isHint: true,
    };
  }

  if (hasLearnings) {
    return {
      tier: 'sonnet',
      reason: 'Has accumulated learnings to apply',
      confidence: 0.6,
      isHint: true,
    };
  }

  return {
    tier: 'sonnet',
    reason: 'Default for standard execution',
    confidence: 0.5,
    isHint: true,
  };
}

/**
 * Format a context section using artifacts when available, falling back to legacy strings
 */
function formatContextSection(
  title: string,
  legacyContent: string | undefined,
  artifacts: any[] | undefined,
  formatFunc?: (item: any) => string
): string {
  // Prefer artifact-based approach
  if (artifacts && artifacts.length > 0 && formatFunc) {
    const formattedArtifacts = artifacts.map(formatFunc).join('\n\n');
    return `## ${title}\n\n${formattedArtifacts}`;
  }

  // Fallback to legacy string content
  if (legacyContent) {
    return `## ${title}\n\n${legacyContent}`;
  }

  return '';
}

/**
 * Generate worker prompt for autonomous task execution
 *
 * The generated prompt guides the worker to:
 * 1. Use Claude Code's TaskList/TaskUpdate for task management
 * 2. Execute tasks according to plan
 * 3. Record learnings and decisions
 *
 * @param config - Worker configuration
 * @returns Generated prompt with model hint
 */
export function generateWorkerPrompt(config: WorkerPromptConfig): GeneratedPrompt {
  const modelHint = suggestModel(config);

  const prompt = `# Swarm Worker: ${config.worker.name}

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

## Model Selection (Hint)

Ultra Planner suggests: **${modelHint.tier}** (${modelHint.reason})

However, YOU make the final decision based on:

| Task Type | Suggested Model | Examples |
|-----------|-----------------|----------|
| Simple lookup/fix | Haiku | "Find file X", "Fix typo" |
| Standard implementation | Sonnet | "Add validation", "Create function" |
| Complex reasoning | Opus | "Debug race condition", "Refactor auth" |

**Decide based on actual task complexity, not just the hint.**

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

## Plan Change Detection

**IMPORTANT**: Before executing a claimed task:
1. Read the current PLAN.md
2. Verify your task still exists in the plan
3. If task was removed/changed:
   - Call TaskUpdate(taskId, status: "completed", metadata: { skipped: true })
   - Report: "Task no longer in plan, skipping"
   - Move to next task

## Completion Reporting

After completing a task:
1. Mark the task as completed using TaskUpdate
2. Include a brief summary of what was done
3. List any files modified
4. Report any issues or deviations

## Decision Recording

**Record important decisions** using Ultra Planner's Notepad:

\`\`\`
mcp__ultra-planner__add_decision(planId, {
  taskId: currentTask,
  content: "Used X instead of Y",
  rationale: "Because of Z"
});
\`\`\`

This helps maintain consistency across sessions.

## Learning Capture

When you discover useful patterns:

\`\`\`
mcp__ultra-planner__add_learning(planId, {
  taskId: currentTask,
  content: "Pattern description",
  tags: ["relevant", "tags"]
});
\`\`\`

## Rules

1. **Atomic Commits**: Make small, focused changes
2. **No Conflicts**: Only modify files specified in your task
3. **Report Deviations**: If you need to change approach, report it
4. **Verify First**: Run build/tests before marking complete
5. **Clean Exit**: When no tasks remain, report completion

${config.learnings ? `## Relevant Learnings (from previous sessions)\n\n${config.learnings}` : ''}

${formatContextSection(
  'Accumulated Wisdom',
  config.context?.wisdom,
  config.context?.artifactCollections?.filter(c => c.name === 'wisdom'),
  formatArtifactCollection
)}

${formatContextSection(
  'Project Context',
  config.context?.project,
  config.context?.artifactCollections?.filter(c => c.name === 'project'),
  formatArtifactCollection
)}

${config.context?.artifacts?.length ? `## Available Artifacts\n\n${config.context.artifacts.map(formatArtifactReference).join('\n\n')}` : ''}

## Begin Execution

Start by calling TaskList to see available tasks.
`;

  return {
    prompt,
    modelHint,
    metadata: {
      workerId: config.worker.id,
      workerName: config.worker.name,
      sessionId: config.sessionId,
    },
  };
}

/**
 * Generate simple worker prompt (string only, for backward compatibility)
 */
export function generateWorkerPromptString(config: WorkerPromptConfig): string {
  return generateWorkerPrompt(config).prompt;
}
