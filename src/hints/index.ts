/**
 * Hints Module
 *
 * Provides suggestion-based hints for AI decision-making.
 * Following the Context Architect pattern: we suggest, AI decides.
 *
 * @module hints
 */

// Types
export type {
  Hint,
  ModelTier,
  ComplexityLevel,
  ComplexityCategory,
  ComplexityHint,
  ComplexitySuggestionInput,
  DelegationCategory,
  RoutingHint,
  RoutingSuggestionInput,
  ModelHint,
  HintResult,
} from './types.js';

// Reference data (for prompts and documentation)
export {
  HIGH_COMPLEXITY_KEYWORDS,
  LOW_COMPLEXITY_KEYWORDS,
  COMPLEXITY_MODEL_REFERENCE,
  CATEGORY_AGENT_REFERENCE,
} from './types.js';

// Complexity hints
export {
  suggestComplexity,
  quickSuggestComplexity,
  batchSuggestComplexity,
  suggestModelForComplexity,
} from './complexity.js';

// Routing hints
export {
  suggestRoute,
  quickSuggestRoute,
  suggestRouteFromComplexity,
  listCategories,
} from './routing.js';

// ============================================================================
// Convenience Functions
// ============================================================================

import { suggestComplexity, suggestModelForComplexity } from './complexity.js';
import { suggestRoute } from './routing.js';
import type { HintResult, ComplexitySuggestionInput, RoutingSuggestionInput } from './types.js';

/**
 * Get all hints for a task in one call.
 *
 * Returns complexity, routing, and model suggestions with a helpful message.
 */
export function getTaskHints(input: ComplexitySuggestionInput & RoutingSuggestionInput): HintResult {
  const complexity = suggestComplexity(input);
  const routing = suggestRoute(input);
  const model = suggestModelForComplexity(complexity.level);

  const message = generateHintMessage(complexity, routing);

  return {
    complexity,
    routing,
    model: {
      tier: model.model,
      isHint: model.isHint,
      reason: model.reason,
      confidence: Math.min(complexity.confidence, routing.confidence),
    },
    message,
  };
}

/**
 * Generate a helpful message explaining the hints
 */
function generateHintMessage(
  complexity: { level: number; category: string; confidence: number },
  routing: { agent: string; model: string; confidence: number }
): string {
  const avgConfidence = (complexity.confidence + routing.confidence) / 2;
  const confidenceLevel = avgConfidence > 0.6 ? 'reasonably confident' : 'less certain';

  return `
## Ultra Planner Hints

I'm ${confidenceLevel} in these suggestions:

**Complexity**: Level ${complexity.level} (${complexity.category})
**Agent**: ${routing.agent}
**Model**: ${routing.model}

These are hints to help your decision. You have the full context, so:
- Override if the actual task differs from what the hints suggest
- Upgrade model tier for critical or nuanced tasks
- Downgrade for simple tasks to save resources

Your judgment is the final authority.
`.trim();
}
