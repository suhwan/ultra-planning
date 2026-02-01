/**
 * Delegate Task Retry Hook
 *
 * Provides recovery hints when Task tool (delegation) fails.
 * This helps orchestrators handle common delegation issues
 * and recover gracefully.
 *
 * Features:
 * - Pattern-based error detection
 * - Contextual retry hints
 * - Event emission for monitoring
 * - Only applies to Task tool responses
 *
 * @module hooks/tool/delegate-task-retry
 */

import type { HookContext, HookHandlers, ToolExecuteAfterInput, ToolExecuteAfterOutput } from '../types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Delegation hint definition.
 */
interface DelegationHint {
  /** Pattern to match in error output (case-insensitive) */
  pattern: string;
  /** Retry hint message */
  hint: string;
  /** Error type identifier for events */
  errorType: string;
}

// ============================================================================
// Constants
// ============================================================================

const HOOK_NAME = 'delegate-task-retry';

/**
 * Recovery hints for common delegation failures.
 */
const DELEGATION_HINTS: DelegationHint[] = [
  {
    pattern: 'model not found',
    errorType: 'model_not_found',
    hint: `The specified model is unavailable. Try:
- Use a valid model: haiku, sonnet, or opus
- Check for typos in the model name
- Sonnet is the default if unsure`,
  },
  {
    pattern: 'context overflow',
    errorType: 'context_overflow',
    hint: `The task context is too large. Try:
- Split into smaller, focused tasks
- Reduce the prompt size
- Don't include entire file contents in the prompt`,
  },
  {
    pattern: 'timeout',
    errorType: 'timeout',
    hint: `The task timed out. Try:
- Simplify the task scope
- Break into smaller subtasks
- Increase timeout if allowed
- Retry - it may be a transient issue`,
  },
  {
    pattern: 'rate limit',
    errorType: 'rate_limit',
    hint: `Rate limit reached. Try:
- Wait a moment before retrying
- Reduce parallel task count
- Use a lower-tier model if appropriate`,
  },
  {
    pattern: 'invalid prompt',
    errorType: 'invalid_prompt',
    hint: `The prompt is invalid. Try:
- Check for special characters that may cause issues
- Ensure the prompt is properly formatted
- Keep the prompt clear and focused`,
  },
  {
    pattern: 'agent not found',
    errorType: 'agent_not_found',
    hint: `The specified agent type is not found. Try:
- Use a valid subagent_type (e.g., 'executor', 'architect')
- Check for typos in the agent name
- Use 'oh-my-claudecode:' prefix for omc agents`,
  },
  {
    pattern: 'connection',
    errorType: 'connection_error',
    hint: `Connection error occurred. Try:
- Retry the task - it may be a transient network issue
- Check your internet connection
- Verify API endpoints are accessible`,
  },
  {
    pattern: 'abort',
    errorType: 'aborted',
    hint: `The task was aborted. This may be:
- User-initiated cancellation
- Session timeout
- System interrupt
Consider if retry is appropriate.`,
  },
];

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a delegate task retry hook.
 *
 * This hook monitors Task tool responses for failures and provides
 * retry guidance to help orchestrators recover.
 *
 * @param ctx - Hook context with state manager and event emitter
 * @returns HookHandlers with tool.execute.after handler
 *
 * @example
 * const hook = createDelegateTaskRetryHook(ctx);
 */
export function createDelegateTaskRetryHook(
  ctx: HookContext
): HookHandlers {
  /**
   * Handler for tool.execute.after events.
   * Detects Task failures and provides retry hints.
   */
  async function toolExecuteAfterHandler(
    input: ToolExecuteAfterInput
  ): Promise<ToolExecuteAfterOutput | void> {
    const { toolName, result, success, sessionId } = input;

    // Only process Task tool responses
    if (toolName !== 'Task') {
      return;
    }

    // Skip successful delegations
    if (success) {
      return;
    }

    // Get output as string
    const output = typeof result === 'string' ? result : JSON.stringify(result ?? '');
    const outputLower = output.toLowerCase();

    // Check for error patterns
    for (const { pattern, hint, errorType } of DELEGATION_HINTS) {
      if (outputLower.includes(pattern.toLowerCase())) {
        // Emit event for monitoring
        ctx.emitEvent({
          type: 'delegate_task_retry',
          payload: {
            sessionId,
            errorType,
            pattern,
          },
          source: `hook:${HOOK_NAME}`,
        });

        // Inject retry hint
        return {
          inject: `\n\n[Delegation Hint]\n${hint}`,
        };
      }
    }

    // No specific pattern matched, provide generic hint
    return {
      inject: `\n\n[Delegation Hint]\nTask delegation failed. Consider:
- Simplifying the task description
- Using a different model tier
- Breaking the task into smaller parts
- Retrying - it may be a transient issue`,
    };
  }

  return {
    'tool.execute.after': toolExecuteAfterHandler,
  };
}
