/**
 * Routing Hints
 *
 * Suggests task routing to agents based on description and context.
 * These are hints for AI decision-making, not enforced rules.
 */

import {
  RoutingHint,
  RoutingSuggestionInput,
  DelegationCategory,
  ModelTier,
  CATEGORY_AGENT_REFERENCE,
} from './types.js';
import { suggestComplexity } from './complexity.js';

// ============================================================================
// Category Keywords (Reference Only)
// ============================================================================

/**
 * Keywords for category detection (reference for heuristics)
 */
const CATEGORY_KEYWORDS: Record<DelegationCategory, string[]> = {
  quick: ['find', 'locate', 'where is', 'what is', 'show me', 'list', 'check'],
  standard: ['add', 'create', 'implement', 'update', 'modify', 'change', 'fix'],
  complex: ['refactor', 'redesign', 'restructure', 'migrate', 'overhaul'],
  ultrabrain: ['debug', 'analyze', 'architect', 'design', 'investigate', 'why', 'how'],
  'visual-engineering': ['ui', 'ux', 'frontend', 'component', 'style', 'design', 'layout', 'visual'],
  artistry: ['creative', 'brainstorm', 'ideas', 'alternatives', 'explore', 'innovate'],
  writing: ['document', 'write', 'explain', 'describe', 'comment', 'readme', 'docs'],
};

// ============================================================================
// Routing Suggestion
// ============================================================================

/**
 * Suggest routing based on task description and context hints.
 *
 * IMPORTANT: This is a hint. AI makes the final decision based on
 * actual context and understanding of the task.
 */
export function suggestRoute(input: RoutingSuggestionInput): RoutingHint {
  const { taskDescription, contextHints, files } = input;
  const descLower = taskDescription.toLowerCase();

  // Determine category
  let category: DelegationCategory;
  let confidence: number;
  let baseReason: string;

  // First, check explicit context hints (higher confidence)
  if (contextHints) {
    if (contextHints.isUI) {
      category = 'visual-engineering';
      confidence = 0.7;
      baseReason = 'UI/frontend context detected';
    } else if (contextHints.isDocumentation) {
      category = 'writing';
      confidence = 0.7;
      baseReason = 'Documentation context detected';
    } else if (contextHints.isDebugging) {
      category = 'ultrabrain';
      confidence = 0.7;
      baseReason = 'Debugging context detected';
    } else if (contextHints.isArchitecture) {
      category = 'ultrabrain';
      confidence = 0.7;
      baseReason = 'Architecture context detected';
    } else if (contextHints.isResearch) {
      category = 'quick';
      confidence = 0.6;
      baseReason = 'Research context detected';
    } else {
      // Fall through to keyword detection
      const detected = detectCategoryFromKeywords(descLower);
      category = detected.category;
      confidence = detected.confidence;
      baseReason = detected.reason;
    }
  } else {
    // No context hints - use keyword detection
    const detected = detectCategoryFromKeywords(descLower);
    category = detected.category;
    confidence = detected.confidence;
    baseReason = detected.reason;
  }

  // Adjust based on file complexity if provided
  if (files && files.length > 0) {
    const complexityHint = suggestComplexity({ taskDescription, files });
    if (complexityHint.level >= 4 && category === 'standard') {
      category = 'complex';
      confidence = Math.min(confidence, complexityHint.confidence);
      baseReason += '; file complexity suggests upgrade to complex';
    }
  }

  const agentRef = CATEGORY_AGENT_REFERENCE[category];

  // Generate alternatives for flexibility
  const alternatives = generateAlternatives(category);

  return {
    isHint: true,
    category,
    agent: agentRef.agent,
    model: agentRef.model,
    confidence,
    reason: `${baseReason}. This is a suggestion - choose based on actual task needs.`,
    alternatives,
  };
}

/**
 * Detect category from keywords in description
 */
function detectCategoryFromKeywords(descLower: string): {
  category: DelegationCategory;
  confidence: number;
  reason: string;
} {
  const scores: Record<DelegationCategory, number> = {
    quick: 0,
    standard: 0,
    complex: 0,
    ultrabrain: 0,
    'visual-engineering': 0,
    artistry: 0,
    writing: 0,
  };

  const matchedKeywords: string[] = [];

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (descLower.includes(keyword.toLowerCase())) {
        scores[category as DelegationCategory] += 1;
        matchedKeywords.push(keyword);
      }
    }
  }

  // Find highest scoring category
  let maxScore = 0;
  let bestCategory: DelegationCategory = 'standard';

  for (const [category, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestCategory = category as DelegationCategory;
    }
  }

  // Calculate confidence based on score
  const confidence = maxScore === 0 ? 0.3 : Math.min(0.6, 0.3 + maxScore * 0.1);

  const reason = maxScore === 0
    ? 'No strong category signals detected'
    : `Detected keywords: ${matchedKeywords.slice(0, 3).join(', ')}`;

  return { category: bestCategory, confidence, reason };
}

/**
 * Generate alternative routing suggestions
 */
function generateAlternatives(
  primary: DelegationCategory
): Array<{ agent: string; model: ModelTier; reason: string }> {
  const alternatives: Array<{ agent: string; model: ModelTier; reason: string }> = [];

  // Always suggest a tier up for important tasks
  if (primary === 'quick') {
    alternatives.push({
      agent: 'executor',
      model: 'sonnet',
      reason: 'Use if task is more complex than it appears',
    });
  } else if (primary === 'standard') {
    alternatives.push({
      agent: 'executor-high',
      model: 'opus',
      reason: 'Use if task requires deeper reasoning',
    });
    alternatives.push({
      agent: 'explore',
      model: 'haiku',
      reason: 'Use if task is simpler than it appears',
    });
  } else if (primary === 'complex') {
    alternatives.push({
      agent: 'architect',
      model: 'opus',
      reason: 'Use if task needs architectural thinking',
    });
  }

  return alternatives;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick routing suggestion from task name only.
 */
export function quickSuggestRoute(taskName: string): RoutingHint {
  const hint = suggestRoute({ taskDescription: taskName });
  return {
    ...hint,
    confidence: Math.max(0.2, hint.confidence - 0.2),
    reason: `Quick suggestion: ${hint.reason}`,
  };
}

/**
 * Suggest route based on complexity level
 */
export function suggestRouteFromComplexity(
  level: 1 | 2 | 3 | 4 | 5
): RoutingHint {
  const categoryMap: Record<1 | 2 | 3 | 4 | 5, DelegationCategory> = {
    1: 'quick',
    2: 'standard',
    3: 'standard',
    4: 'complex',
    5: 'ultrabrain',
  };

  const category = categoryMap[level];
  const agentRef = CATEGORY_AGENT_REFERENCE[category];

  return {
    isHint: true,
    category,
    agent: agentRef.agent,
    model: agentRef.model,
    confidence: 0.5,
    reason: `Based on complexity level ${level}. Adjust based on actual task requirements.`,
    alternatives: generateAlternatives(category),
  };
}

/**
 * List all categories with descriptions (for reference)
 */
export function listCategories(): Array<{
  category: DelegationCategory;
  agent: string;
  model: ModelTier;
  description: string;
}> {
  const descriptions: Record<DelegationCategory, string> = {
    quick: 'Simple lookups, basic operations',
    standard: 'Normal implementation work',
    complex: 'Multi-file changes, refactoring',
    ultrabrain: 'Complex reasoning, architecture, debugging',
    'visual-engineering': 'UI/UX, frontend, design systems',
    artistry: 'Creative solutions, brainstorming',
    writing: 'Documentation, technical writing',
  };

  return Object.entries(CATEGORY_AGENT_REFERENCE).map(([category, ref]) => ({
    category: category as DelegationCategory,
    agent: ref.agent,
    model: ref.model,
    description: descriptions[category as DelegationCategory],
  }));
}
