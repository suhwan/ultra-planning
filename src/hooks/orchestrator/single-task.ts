/**
 * Single Task Directive - Subagent Task Scoping Enforcement
 *
 * Provides the single-task directive to inject into subagent prompts.
 * This directive instructs subagents to refuse multi-task requests and
 * demand single, atomic task specifications.
 *
 * Purpose: Prevent orchestrators from overloading subagents with multiple
 * tasks, which leads to poor completion rates and harder debugging.
 *
 * This is SOFT enforcement via prompt injection - the directive instructs
 * the subagent behavior but does not technically block multi-task requests.
 *
 * @module hooks/orchestrator/single-task
 */

import { createSystemDirective, SystemDirectiveTypes } from './types.js';

/**
 * The single task directive text to inject into subagent prompts.
 *
 * This directive:
 * 1. Instructs subagents to refuse multi-task requests
 * 2. Demands single-task clarity from the orchestrator
 * 3. Provides a template response for rejecting multi-task requests
 *
 * @example
 * // Inject into subagent prompt
 * const prompt = `${SINGLE_TASK_DIRECTIVE}\n\nYour task: Implement the login API endpoint`;
 */
export const SINGLE_TASK_DIRECTIVE = `${createSystemDirective(SystemDirectiveTypes.SINGLE_TASK_ONLY)}

**STOP. READ THIS BEFORE PROCEEDING.**

If you were NOT given **exactly ONE atomic task**, you MUST:
1. **IMMEDIATELY REFUSE** this request
2. **DEMAND** the orchestrator provide a single, specific task

**Your response if multiple tasks detected:**
> "I refuse to proceed. You provided multiple tasks.
> PROVIDE EXACTLY ONE TASK. One file. One change. One verification."

**REFUSE multi-task requests. DEMAND single-task clarity.**
`;

/**
 * Creates a single-task directive with optional task description.
 *
 * If a task description is provided, it will be appended to the directive
 * to clearly specify what the subagent should work on.
 *
 * @param taskDescription - Optional description of the single task
 * @returns The directive text, optionally with task appended
 *
 * @example
 * // Without task description
 * createSingleTaskDirective();
 * // Returns: SINGLE_TASK_DIRECTIVE
 *
 * @example
 * // With task description
 * createSingleTaskDirective('Implement the login API endpoint');
 * // Returns: SINGLE_TASK_DIRECTIVE + "\n\nYour single task: Implement the login API endpoint"
 */
export function createSingleTaskDirective(taskDescription?: string): string {
  if (!taskDescription) {
    return SINGLE_TASK_DIRECTIVE;
  }

  return `${SINGLE_TASK_DIRECTIVE}

Your single task: ${taskDescription}`;
}
