/**
 * Empty Task Response Detector Hook
 *
 * Detects when a subagent (Task tool) returns an empty or minimal response.
 * This is a critical safety feature that prevents silent failures in
 * agent-to-agent delegation.
 *
 * Features:
 * - Configurable minimum response length
 * - Automatic warning injection
 * - Event emission for monitoring
 * - Only applies to Task tool responses
 *
 * @module hooks/tool/empty-task-response-detector
 */

import type { HookContext, HookHandlers, ToolExecuteAfterInput, ToolExecuteAfterOutput } from '../types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration options for the empty task response detector.
 */
export interface EmptyTaskResponseDetectorOptions {
  /** Minimum response length in characters (default: 50) */
  minResponseLength?: number;
  /** Custom warning message to inject */
  warningMessage?: string;
}

// ============================================================================
// Constants
// ============================================================================

const HOOK_NAME = 'empty-task-response-detector';

/** Default minimum response length */
const DEFAULT_MIN_RESPONSE_LENGTH = 50;

/** Default warning message for empty responses */
const EMPTY_RESPONSE_WARNING = `[Task Empty Response Warning]

Task invocation completed but returned no response. This indicates the agent either:
- Failed to execute properly
- Did not terminate correctly
- Returned an empty result

Note: The call has already completed - you are NOT waiting for a response. Proceed accordingly.`;

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an empty task response detector hook.
 *
 * This hook monitors Task tool responses and flags empty or
 * minimal responses with a warning.
 *
 * @param ctx - Hook context with state manager and event emitter
 * @param options - Configuration options
 * @returns HookHandlers with tool.execute.after handler
 *
 * @example
 * const hook = createEmptyTaskResponseDetectorHook(ctx, {
 *   minResponseLength: 100,
 * });
 */
export function createEmptyTaskResponseDetectorHook(
  ctx: HookContext,
  options: EmptyTaskResponseDetectorOptions = {}
): HookHandlers {
  const {
    minResponseLength = DEFAULT_MIN_RESPONSE_LENGTH,
    warningMessage = EMPTY_RESPONSE_WARNING,
  } = options;

  /**
   * Handler for tool.execute.after events.
   * Detects and flags empty Task responses.
   */
  async function toolExecuteAfterHandler(
    input: ToolExecuteAfterInput
  ): Promise<ToolExecuteAfterOutput | void> {
    const { toolName, result, sessionId } = input;

    // Only process Task tool responses
    if (toolName !== 'Task') {
      return;
    }

    // Get response as string
    const responseText = typeof result === 'string' ? result : JSON.stringify(result ?? '');
    const trimmedLength = responseText.trim().length;

    // Check if response is empty or too short
    if (trimmedLength >= minResponseLength) {
      return;
    }

    // Emit event for monitoring
    ctx.emitEvent({
      type: 'empty_task_response',
      payload: {
        sessionId,
        responseLength: trimmedLength,
        minExpected: minResponseLength,
      },
      source: `hook:${HOOK_NAME}`,
    });

    // Inject warning message
    if (trimmedLength === 0) {
      return {
        result: warningMessage,
      };
    }

    // For minimal responses, append warning
    return {
      result: responseText + `\n\n[WARNING: Task response appears minimal (${trimmedLength} chars). Consider retrying.]`,
    };
  }

  return {
    'tool.execute.after': toolExecuteAfterHandler,
  };
}
