/**
 * Edit Error Recovery Hook
 *
 * Provides recovery guidance when Edit tool encounters errors.
 * This helps agents self-correct common editing mistakes without
 * requiring manual intervention.
 *
 * Features:
 * - Pattern-based error detection
 * - Contextual recovery hints
 * - Event emission for monitoring
 * - Only applies to Edit tool responses
 *
 * @module hooks/tool/edit-error-recovery
 */

import type { HookContext, HookHandlers, ToolExecuteAfterInput, ToolExecuteAfterOutput } from '../types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Recovery hint definition.
 */
interface RecoveryHint {
  /** Pattern to match in error output (case-insensitive) */
  pattern: string;
  /** Recovery hint message */
  hint: string;
  /** Error type identifier for events */
  errorType: string;
}

// ============================================================================
// Constants
// ============================================================================

const HOOK_NAME = 'edit-error-recovery';

/**
 * Recovery hints for common Edit tool errors.
 */
const EDIT_RECOVERY_HINTS: RecoveryHint[] = [
  {
    pattern: 'old_string not found',
    errorType: 'old_text_not_found',
    hint: `The old_string was not found in the file. Try:
- Read the file first to get the exact content
- Use smaller, unique text snippets that definitely exist
- Check for whitespace/indentation differences
- Ensure the file hasn't been modified since you read it`,
  },
  {
    pattern: 'not unique',
    errorType: 'not_unique',
    hint: `The old_string matches multiple locations. Try:
- Include more context (surrounding lines) to make it unique
- Use a longer snippet that only appears once
- Include function/class names for disambiguation`,
  },
  {
    pattern: 'file does not exist',
    errorType: 'file_not_found',
    hint: `The file does not exist. Try:
- Create the file first with the Write tool
- Check the file path for typos
- Verify the directory exists`,
  },
  {
    pattern: 'file not found',
    errorType: 'file_not_found',
    hint: `The file was not found. Try:
- Verify the file path is correct
- Use Glob to find the actual file location
- Create the file if it should exist`,
  },
  {
    pattern: 'permission denied',
    errorType: 'permission_denied',
    hint: `Permission denied. The file cannot be modified. Try:
- Check if the file is read-only
- Verify you have write permissions
- Check if the file is locked by another process`,
  },
  {
    pattern: 'did not read',
    errorType: 'read_first',
    hint: `You must read the file before editing it. Try:
- Use the Read tool to view the file content first
- Then retry the Edit with the exact content from the file`,
  },
];

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an edit error recovery hook.
 *
 * This hook monitors Edit tool responses for errors and provides
 * recovery guidance to help agents self-correct.
 *
 * @param ctx - Hook context with state manager and event emitter
 * @returns HookHandlers with tool.execute.after handler
 *
 * @example
 * const hook = createEditErrorRecoveryHook(ctx);
 */
export function createEditErrorRecoveryHook(
  ctx: HookContext
): HookHandlers {
  /**
   * Handler for tool.execute.after events.
   * Detects Edit errors and provides recovery hints.
   */
  async function toolExecuteAfterHandler(
    input: ToolExecuteAfterInput
  ): Promise<ToolExecuteAfterOutput | void> {
    const { toolName, result, success, sessionId } = input;

    // Only process Edit tool responses
    if (toolName !== 'Edit') {
      return;
    }

    // Skip successful edits
    if (success) {
      return;
    }

    // Get output as string
    const output = typeof result === 'string' ? result : JSON.stringify(result ?? '');
    const outputLower = output.toLowerCase();

    // Check for error patterns
    for (const { pattern, hint, errorType } of EDIT_RECOVERY_HINTS) {
      if (outputLower.includes(pattern.toLowerCase())) {
        // Emit event for monitoring
        ctx.emitEvent({
          type: 'edit_error_recovery',
          payload: {
            sessionId,
            errorType,
            pattern,
          },
          source: `hook:${HOOK_NAME}`,
        });

        // Inject recovery hint
        return {
          inject: `\n\n[Recovery Hint]\n${hint}`,
        };
      }
    }

    // No specific pattern matched, provide generic hint
    return {
      inject: `\n\n[Recovery Hint]\nEdit failed. Try reading the file first to verify the exact content, then retry with the correct old_string.`,
    };
  }

  return {
    'tool.execute.after': toolExecuteAfterHandler,
  };
}
