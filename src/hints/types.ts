/**
 * Hints Module Types
 *
 * Type definitions for hint-based suggestions in the Context Architect pattern.
 * All hints are suggestions - AI makes the final decision.
 */

// ============================================================================
// Core Hint Types
// ============================================================================

/**
 * Base hint interface - all hints include isHint: true
 */
export interface Hint {
  /** Always true - indicates this is a suggestion, not a rule */
  isHint: true;
  /** Confidence level (0-1) */
  confidence: number;
  /** Human-readable reason for the suggestion */
  reason: string;
}

/**
 * Model tier suggestions
 */
export type ModelTier = 'haiku' | 'sonnet' | 'opus';

/**
 * Complexity level (1-5 scale)
 */
export type ComplexityLevel = 1 | 2 | 3 | 4 | 5;

/**
 * Complexity category for human readability
 */
export type ComplexityCategory = 'quick' | 'standard' | 'complex' | 'architectural';

// ============================================================================
// Complexity Hints
// ============================================================================

/**
 * Suggested complexity assessment
 */
export interface ComplexityHint extends Hint {
  /** Suggested complexity level (1-5) */
  level: ComplexityLevel;
  /** Human-readable category */
  category: ComplexityCategory;
  /** Factors that influenced the suggestion */
  factors: string[];
  /** Suggested model based on complexity */
  suggestedModel: ModelTier;
}

/**
 * Input for complexity suggestion
 */
export interface ComplexitySuggestionInput {
  /** Task description/action */
  taskDescription: string;
  /** Files to be modified (optional) */
  files?: string[];
  /** Task dependencies (optional) */
  dependencies?: string[];
  /** Additional context (optional) */
  context?: string;
}

// ============================================================================
// Routing Hints
// ============================================================================

/**
 * Delegation categories for routing
 */
export type DelegationCategory =
  | 'quick'               // Simple lookups, basic operations
  | 'standard'            // Normal implementation work
  | 'complex'             // Multi-file changes, refactoring
  | 'ultrabrain'          // Complex reasoning, architecture, deep debugging
  | 'visual-engineering'  // UI/UX, frontend, design systems
  | 'artistry'            // Creative solutions, brainstorming
  | 'writing';            // Documentation, technical writing

/**
 * Agent routing suggestion
 */
export interface RoutingHint extends Hint {
  /** Suggested delegation category */
  category: DelegationCategory;
  /** Suggested agent type */
  agent: string;
  /** Suggested model tier */
  model: ModelTier;
  /** Alternative suggestions */
  alternatives?: Array<{
    agent: string;
    model: ModelTier;
    reason: string;
  }>;
}

/**
 * Input for routing suggestion
 */
export interface RoutingSuggestionInput {
  /** Task description */
  taskDescription: string;
  /** Context hints to help routing */
  contextHints?: {
    isUI?: boolean;
    isDocumentation?: boolean;
    isDebugging?: boolean;
    isArchitecture?: boolean;
    isResearch?: boolean;
  };
  /** Files involved (helps with complexity assessment) */
  files?: string[];
}

// ============================================================================
// Model Hints
// ============================================================================

/**
 * Model selection hint
 */
export interface ModelHint extends Hint {
  /** Suggested model tier */
  tier: ModelTier;
  /** Suggested temperature (0-1) */
  temperature?: number;
  /** Suggested thinking budget */
  thinkingBudget?: 'low' | 'medium' | 'high' | 'max';
}

// ============================================================================
// Combined Result
// ============================================================================

/**
 * Complete hint result with all suggestions
 */
export interface HintResult {
  /** Complexity suggestion */
  complexity?: ComplexityHint;
  /** Routing suggestion */
  routing?: RoutingHint;
  /** Model suggestion */
  model?: ModelHint;
  /** Message to the AI explaining the hints */
  message: string;
}

// ============================================================================
// Reference Data (for hint calculation, not enforcement)
// ============================================================================

/**
 * Keywords associated with high complexity (reference only)
 */
export const HIGH_COMPLEXITY_KEYWORDS = [
  'refactor',
  'architecture',
  'redesign',
  'migrate',
  'rewrite',
  'optimize',
  'performance',
  'security',
  'authentication',
  'authorization',
  'database schema',
  'api design',
  'state management',
  'concurrent',
  'async',
  'race condition',
];

/**
 * Keywords associated with low complexity (reference only)
 */
export const LOW_COMPLEXITY_KEYWORDS = [
  'rename',
  'update',
  'fix typo',
  'add comment',
  'config',
  'constant',
  'import',
  'export',
  'lint',
  'format',
  'simple',
  'straightforward',
];

/**
 * Complexity level to model mapping (reference only)
 */
export const COMPLEXITY_MODEL_REFERENCE: Record<ComplexityLevel, ModelTier> = {
  1: 'haiku',
  2: 'haiku',
  3: 'sonnet',
  4: 'sonnet',
  5: 'opus',
};

/**
 * Category to agent mapping (reference only)
 */
export const CATEGORY_AGENT_REFERENCE: Record<DelegationCategory, { agent: string; model: ModelTier }> = {
  quick: { agent: 'explore', model: 'haiku' },
  standard: { agent: 'executor', model: 'sonnet' },
  complex: { agent: 'executor-high', model: 'opus' },
  ultrabrain: { agent: 'architect', model: 'opus' },
  'visual-engineering': { agent: 'designer-high', model: 'opus' },
  artistry: { agent: 'architect-medium', model: 'sonnet' },
  writing: { agent: 'writer', model: 'sonnet' },
};
