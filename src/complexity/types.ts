/**
 * Task Complexity Types
 *
 * Defines complexity metadata for intelligent task routing and model selection.
 * Based on the task-complexity.schema.yaml specification.
 */

// ============================================================================
// Complexity Levels
// ============================================================================

/** Complexity levels (1-5 scale) */
export type ComplexityLevel = 1 | 2 | 3 | 4 | 5;

/** Complexity categories for human readability */
export type ComplexityCategory = 'quick' | 'standard' | 'complex' | 'architectural';

/** Model types for routing */
export type ModelTier = 'haiku' | 'sonnet' | 'opus';

// ============================================================================
// Complexity Metadata
// ============================================================================

/** Task complexity metadata */
export interface TaskComplexity {
  /** Complexity score 1-5 */
  level: ComplexityLevel;
  /** Estimated effort in minutes */
  estimatedMinutes?: number;
  /** Complexity category */
  category?: ComplexityCategory;
  /** Reasoning for complexity assignment */
  rationale?: string;
}

/** Task with complexity information */
export interface TaskWithComplexity {
  /** Task identifier (e.g., "06-01-01") */
  id: string;
  /** Task name */
  name: string;
  /** Task action description */
  action: string;
  /** Complexity metadata */
  complexity: TaskComplexity;
  /** Wave number */
  wave: number;
  /** Done criteria */
  done: string;
  /** Files involved */
  files?: string[];
}

// ============================================================================
// Complexity Estimation
// ============================================================================

/** Input for complexity estimation */
export interface ComplexityEstimationInput {
  /** Task description/action */
  taskDescription: string;
  /** Files to be modified */
  files?: string[];
  /** Task dependencies */
  dependencies?: string[];
  /** Additional context */
  context?: string;
}

/** Result of complexity estimation */
export interface ComplexityEstimationResult {
  /** Estimated complexity */
  complexity: TaskComplexity;
  /** Recommended model */
  recommendedModel: ModelTier;
  /** Confidence in estimation (0-1) */
  confidence: number;
  /** Factors that influenced the estimation */
  factors: string[];
}

// ============================================================================
// Mappings
// ============================================================================

/** Complexity to model mapping */
export const COMPLEXITY_MODEL_MAP: Record<ComplexityLevel, ModelTier> = {
  1: 'haiku',   // Trivial: lookups, simple edits
  2: 'haiku',   // Simple: straightforward implementations
  3: 'sonnet',  // Standard: typical features
  4: 'sonnet',  // Complex: multi-file changes
  5: 'opus',    // Very complex: architectural changes
};

/** Complexity level descriptions */
export const COMPLEXITY_DESCRIPTIONS: Record<ComplexityLevel, string> = {
  1: 'Trivial - Simple lookups, config changes, single-line edits',
  2: 'Simple - Straightforward implementations following clear patterns',
  3: 'Standard - Typical feature work requiring some decisions',
  4: 'Complex - Multi-file changes with significant logic',
  5: 'Architectural - System-wide changes or complex algorithms',
};

/** Category to level range mapping */
export const CATEGORY_LEVEL_MAP: Record<ComplexityCategory, ComplexityLevel[]> = {
  quick: [1, 2],
  standard: [3],
  complex: [4],
  architectural: [5],
};

/** Estimated minutes per level */
export const LEVEL_MINUTES_MAP: Record<ComplexityLevel, { min: number; max: number }> = {
  1: { min: 1, max: 5 },
  2: { min: 5, max: 15 },
  3: { min: 15, max: 30 },
  4: { min: 30, max: 60 },
  5: { min: 60, max: 120 },
};
