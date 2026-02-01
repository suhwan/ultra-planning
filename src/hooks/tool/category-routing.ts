/**
 * Category Routing Hook
 *
 * Intercepts Task tool calls to inject category-based routing hints.
 * This hook enhances task delegation with automatic category detection
 * and prompt enhancement based on task characteristics.
 *
 * Features:
 * - Auto-detects category from task prompt if not specified
 * - Injects category-specific guidance into prompts
 * - Provides model/temperature recommendations
 * - Logs category routing decisions
 *
 * @module hooks/tool/category-routing
 */

import type {
  HookContext,
  HookHandlers,
  ToolExecuteBeforeInput,
  ToolExecuteBeforeOutput,
} from '../types.js';
import {
  detectCategory,
  resolveCategory,
  getCategoryConfig,
  enhancePromptWithCategory,
  getCategoryThinkingBudgetTokens,
  type DelegationCategory,
  type ModelTier,
} from '../../orchestration/delegation/index.js';

// ============================================================================
// Types
// ============================================================================

interface TaskToolParams {
  prompt?: string;
  description?: string;
  category?: DelegationCategory;
  model?: ModelTier;
  [key: string]: unknown;
}

// ============================================================================
// Constants
// ============================================================================

const HOOK_NAME = 'category-routing';

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a category routing hook.
 *
 * This hook monitors Task tool invocations and:
 * 1. Auto-detects category from prompt if not specified
 * 2. Enhances prompt with category-specific guidance
 * 3. Suggests model/temperature based on category
 *
 * @param ctx - Hook context with state manager and event emitter
 * @param options - Hook configuration options
 * @returns HookHandlers with tool.execute.before handler
 *
 * @example
 * const hook = createCategoryRoutingHook(ctx, { enhancePrompts: true });
 */
export function createCategoryRoutingHook(
  ctx: HookContext,
  options: {
    /** Whether to enhance prompts with category guidance (default: true) */
    enhancePrompts?: boolean;
    /** Whether to log routing decisions (default: true) */
    logRouting?: boolean;
  } = {}
): HookHandlers {
  const { enhancePrompts = true, logRouting = true } = options;

  /**
   * Handler for tool.execute.before events.
   * Intercepts Task tool calls to inject category routing.
   */
  async function toolExecuteBeforeHandler(
    input: ToolExecuteBeforeInput
  ): Promise<ToolExecuteBeforeOutput | void> {
    const { toolName, params, sessionId } = input;

    // Only process Task tool invocations
    if (toolName !== 'Task') {
      return;
    }

    const taskParams = params as TaskToolParams;
    const prompt = taskParams.prompt || taskParams.description || '';

    // Skip if no prompt to analyze
    if (!prompt) {
      return;
    }

    // Resolve category using priority: explicit > tier-based > auto-detect
    const category = resolveCategory({
      taskDescription: prompt,
      explicitCategory: taskParams.category,
      explicitTier: taskParams.model,
    });

    const config = getCategoryConfig(category);
    const thinkingTokens = getCategoryThinkingBudgetTokens(category);

    // Log routing decision
    if (logRouting) {
      ctx.emitEvent({
        type: 'category_routing',
        payload: {
          sessionId,
          category,
          model: config.model.tier,
          temperature: config.model.temperature,
          thinkingBudget: config.model.thinkingBudget,
          thinkingTokens,
          wasExplicit: !!taskParams.category,
        },
        source: `hook:${HOOK_NAME}`,
      });
    }

    // Prepare modifications
    const modifications: ToolExecuteBeforeOutput = {};

    // Enhance prompt if enabled and category was auto-detected (not explicit)
    if (enhancePrompts && !taskParams.category) {
      const enhancedPrompt = enhancePromptWithCategory(prompt, category);
      if (enhancedPrompt !== prompt) {
        // Use params field to pass modified parameters
        modifications.params = {
          ...taskParams,
          prompt: enhancedPrompt,
        };
      }
    }

    // Use warning field to provide routing hint (inject not available in ToolExecuteBeforeOutput)
    modifications.warning = `[Category Routing: ${category} -> model=${config.model.tier}, temp=${config.model.temperature}, thinking=${thinkingTokens} tokens]`;

    return modifications;
  }

  return {
    'tool.execute.before': toolExecuteBeforeHandler,
  };
}
