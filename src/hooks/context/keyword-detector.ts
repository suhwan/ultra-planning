/**
 * Keyword Detector Hook
 *
 * Detects magic keywords in user messages and emits events
 * for mode activation. Leverages the existing keyword detection
 * infrastructure from orchestration/keywords.
 *
 * Features:
 * - Integrates with existing keyword patterns
 * - Event emission for orchestrator activation
 * - Code block stripping to prevent false positives
 * - Supports custom keywords via configuration
 *
 * @module hooks/context/keyword-detector
 */

import type { HookContext, HookHandlers, ChatMessageInput, ChatMessageOutput } from '../types.js';
import { detectKeywords, type KeywordConfig } from '../../orchestration/keywords/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration options for the keyword detector.
 */
export interface KeywordDetectorOptions {
  /** Custom keyword configuration */
  keywordConfig?: KeywordConfig;
  /** Whether to process assistant messages (default: false) */
  processAssistantMessages?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const HOOK_NAME = 'keyword-detector';

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a keyword detector hook.
 *
 * This hook monitors chat messages for magic keywords and emits
 * events when keywords are detected, enabling mode activation.
 *
 * @param ctx - Hook context with state manager and event emitter
 * @param options - Configuration options
 * @returns HookHandlers with chat.message handler
 *
 * @example
 * const hook = createKeywordDetectorHook(ctx, {
 *   keywordConfig: {
 *     custom: [
 *       {
 *         triggers: ['mymode'],
 *         description: 'Custom mode',
 *         action: (prompt) => `[MY MODE] ${prompt}`,
 *       },
 *     ],
 *   },
 * });
 */
export function createKeywordDetectorHook(
  ctx: HookContext,
  options: KeywordDetectorOptions = {}
): HookHandlers {
  const {
    keywordConfig,
    processAssistantMessages = false,
  } = options;

  /**
   * Handler for chat.message events.
   * Detects keywords and emits events.
   */
  async function chatMessageHandler(
    input: ChatMessageInput
  ): Promise<ChatMessageOutput | void> {
    const { role, content, sessionId } = input;

    // Skip non-user messages unless configured otherwise
    if (role !== 'user' && !processAssistantMessages) {
      return;
    }

    // Skip if role is system
    if (role === 'system') {
      return;
    }

    // Detect keywords using existing infrastructure
    const result = detectKeywords(content, keywordConfig);

    // If no keywords detected, skip
    if (!result.hasKeywords) {
      return;
    }

    // Emit event for each detected keyword
    ctx.emitEvent({
      type: 'keywords_detected',
      payload: {
        sessionId,
        keywords: result.detected,
        originalPrompt: result.originalPrompt,
        cleanedPrompt: result.cleanedPrompt,
      },
      source: `hook:${HOOK_NAME}`,
    });

    // Return continuation signal (don't modify message)
    return { continue: true };
  }

  return {
    'chat.message': chatMessageHandler,
  };
}
