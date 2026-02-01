/**
 * Tool Output Truncator Hook
 *
 * Truncates large tool outputs to prevent context bloat.
 * This is essential for maintaining efficient context window usage
 * when tools return verbose output (e.g., grep, glob, bash).
 *
 * Features:
 * - Configurable maximum output length
 * - Customizable truncation message
 * - Emit events for monitoring truncation
 * - Applies to all tool.execute.after events
 *
 * @module hooks/tool/tool-output-truncator
 */

import type { HookContext, HookHandlers, ToolExecuteAfterInput, ToolExecuteAfterOutput } from '../types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration options for the tool output truncator.
 */
export interface ToolOutputTruncatorOptions {
  /** Maximum output length in characters (default: 50000) */
  maxOutputLength?: number;
  /** Custom truncation message. Use {max} as placeholder for max length */
  truncationMessage?: string;
  /** Tools to apply truncation to (if empty, applies to all) */
  truncatableTools?: string[];
  /** Tools to skip truncation for */
  skipTools?: string[];
}

// ============================================================================
// Constants
// ============================================================================

const HOOK_NAME = 'tool-output-truncator';

/** Default maximum output length in characters */
const DEFAULT_MAX_OUTPUT_LENGTH = 50000;

/** Default truncation message */
const DEFAULT_TRUNCATION_MESSAGE = '\n\n[Output truncated - exceeded {max} characters]';

/** Default tools that commonly produce large output */
const DEFAULT_TRUNCATABLE_TOOLS = [
  'Bash',
  'Grep',
  'Glob',
  'Read',
  'Task',
];

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a tool output truncator hook.
 *
 * This hook monitors tool.execute.after events and truncates
 * outputs that exceed the configured maximum length.
 *
 * @param ctx - Hook context with state manager and event emitter
 * @param options - Configuration options
 * @returns HookHandlers with tool.execute.after handler
 *
 * @example
 * const hook = createToolOutputTruncatorHook(ctx, {
 *   maxOutputLength: 30000,
 *   truncationMessage: '\n[Truncated at {max} chars]',
 * });
 */
export function createToolOutputTruncatorHook(
  ctx: HookContext,
  options: ToolOutputTruncatorOptions = {}
): HookHandlers {
  const {
    maxOutputLength = DEFAULT_MAX_OUTPUT_LENGTH,
    truncationMessage = DEFAULT_TRUNCATION_MESSAGE,
    truncatableTools = DEFAULT_TRUNCATABLE_TOOLS,
    skipTools = [],
  } = options;

  /**
   * Handler for tool.execute.after events.
   * Truncates output if it exceeds the maximum length.
   */
  async function toolExecuteAfterHandler(
    input: ToolExecuteAfterInput
  ): Promise<ToolExecuteAfterOutput | void> {
    const { toolName, result, sessionId } = input;

    // Skip tools in skip list
    if (skipTools.includes(toolName)) {
      return;
    }

    // If truncatableTools is not empty, only truncate those tools
    if (truncatableTools.length > 0 && !truncatableTools.includes(toolName)) {
      return;
    }

    // Get output as string
    const output = typeof result === 'string' ? result : JSON.stringify(result);
    const originalLength = output.length;

    // Check if truncation needed
    if (originalLength <= maxOutputLength) {
      return;
    }

    // Truncate output
    const truncated = output.slice(0, maxOutputLength) +
      truncationMessage.replace('{max}', String(maxOutputLength));

    // Emit event for monitoring
    ctx.emitEvent({
      type: 'tool_output_truncated',
      payload: {
        toolName,
        originalLength,
        truncatedTo: maxOutputLength,
        sessionId,
      },
      source: `hook:${HOOK_NAME}`,
    });

    // Return modified result
    return {
      result: truncated,
      inject: undefined,
    };
  }

  return {
    'tool.execute.after': toolExecuteAfterHandler,
  };
}
