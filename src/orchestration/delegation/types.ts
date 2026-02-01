/**
 * Delegation Types
 *
 * Types for task complexity categorization and model routing.
 */

// ============================================================================
// Model Tiers
// ============================================================================

/** Model tier */
export type ModelTier = 'haiku' | 'sonnet' | 'opus';

/** Model configuration */
export interface ModelConfig {
  /** Model tier */
  tier: ModelTier;
  /** Temperature (0.0-1.0) */
  temperature: number;
  /** Thinking budget */
  thinkingBudget: 'low' | 'medium' | 'high' | 'max';
}

// ============================================================================
// Delegation Categories
// ============================================================================

/**
 * Delegation categories based on task characteristics
 * Inspired by oh-my-claudecode delegation patterns
 *
 * 7 semantic categories + 2 fallback categories for explicit tier requests
 */
export type DelegationCategory =
  | 'quick'               // Simple lookups, basic operations
  | 'standard'            // Normal implementation work
  | 'complex'             // Multi-file changes, refactoring
  | 'ultrabrain'          // Complex reasoning, architecture, deep debugging
  | 'visual-engineering'  // UI/UX, frontend, design systems
  | 'artistry'            // Creative solutions, brainstorming
  | 'writing'             // Documentation, technical writing
  | 'unspecified-low'     // Fallback for explicit low-tier requests
  | 'unspecified-high';   // Fallback for explicit high-tier requests

// ============================================================================
// Thinking Budget Token Mapping
// ============================================================================

/**
 * Maps thinking budget levels to actual token counts for Claude API.
 */
export const THINKING_BUDGET_TOKENS = {
  low: 1000,
  medium: 5000,
  high: 10000,
  max: 32000,
} as const;

export type ThinkingBudgetLevel = keyof typeof THINKING_BUDGET_TOKENS;

/** Category configuration */
export interface CategoryConfig {
  /** Category name */
  category: DelegationCategory;
  /** Display name */
  displayName: string;
  /** Description */
  description: string;
  /** Model configuration */
  model: ModelConfig;
  /** Keywords that trigger this category */
  keywords: string[];
  /** Typical use cases */
  useCases: string[];
}

// ============================================================================
// Category Definitions
// ============================================================================

export const DELEGATION_CATEGORIES: Record<DelegationCategory, CategoryConfig> = {
  quick: {
    category: 'quick',
    displayName: 'Quick',
    description: 'Simple lookups and basic operations',
    model: {
      tier: 'haiku',
      temperature: 0.1,
      thinkingBudget: 'low',
    },
    keywords: ['find', 'locate', 'where is', 'what is', 'show me', 'list'],
    useCases: [
      'Find a file or function',
      'Show current status',
      'List available options',
      'Simple lookups',
    ],
  },

  standard: {
    category: 'standard',
    displayName: 'Standard',
    description: 'Normal implementation and changes',
    model: {
      tier: 'sonnet',
      temperature: 0.3,
      thinkingBudget: 'medium',
    },
    keywords: ['add', 'create', 'implement', 'update', 'modify', 'change'],
    useCases: [
      'Add a new function',
      'Implement a feature',
      'Update existing code',
      'Fix a bug',
    ],
  },

  complex: {
    category: 'complex',
    displayName: 'Complex',
    description: 'Multi-file changes and refactoring',
    model: {
      tier: 'opus',
      temperature: 0.3,
      thinkingBudget: 'high',
    },
    keywords: ['refactor', 'redesign', 'restructure', 'migrate', 'overhaul'],
    useCases: [
      'Refactor a module',
      'Migrate to new pattern',
      'Multi-file restructuring',
      'Complex bug investigation',
    ],
  },

  ultrabrain: {
    category: 'ultrabrain',
    displayName: 'Ultrabrain',
    description: 'Complex reasoning, architecture, deep debugging',
    model: {
      tier: 'opus',
      temperature: 0.3,
      thinkingBudget: 'max',
    },
    keywords: ['debug', 'analyze', 'architect', 'design', 'investigate', 'why', 'how'],
    useCases: [
      'Debug race condition',
      'Design system architecture',
      'Root cause analysis',
      'Complex algorithm design',
    ],
  },

  'visual-engineering': {
    category: 'visual-engineering',
    displayName: 'Visual Engineering',
    description: 'UI/UX, frontend, design systems',
    model: {
      tier: 'opus',
      temperature: 0.7,
      thinkingBudget: 'high',
    },
    keywords: ['ui', 'ux', 'frontend', 'component', 'style', 'design', 'layout', 'visual'],
    useCases: [
      'Create UI component',
      'Design layout',
      'Implement design system',
      'Frontend feature',
    ],
  },

  artistry: {
    category: 'artistry',
    displayName: 'Artistry',
    description: 'Creative solutions and brainstorming',
    model: {
      tier: 'sonnet',
      temperature: 0.9,
      thinkingBudget: 'medium',
    },
    keywords: ['creative', 'brainstorm', 'ideas', 'alternatives', 'explore', 'innovate'],
    useCases: [
      'Generate ideas',
      'Explore alternatives',
      'Creative problem solving',
      'Name generation',
    ],
  },

  writing: {
    category: 'writing',
    displayName: 'Writing',
    description: 'Documentation and technical writing',
    model: {
      tier: 'sonnet',
      temperature: 0.5,
      thinkingBudget: 'medium',
    },
    keywords: ['document', 'write', 'explain', 'describe', 'comment', 'readme', 'docs'],
    useCases: [
      'Write documentation',
      'Add comments',
      'Create README',
      'Technical writing',
    ],
  },

  'unspecified-low': {
    category: 'unspecified-low',
    displayName: 'Unspecified (Low)',
    description: 'Fallback for explicit low-tier requests without semantic category',
    model: {
      tier: 'haiku',
      temperature: 0.3,
      thinkingBudget: 'low',
    },
    keywords: [],
    useCases: [
      'Explicit haiku tier request',
      'Quick tasks without semantic match',
      'Low-priority background work',
    ],
  },

  'unspecified-high': {
    category: 'unspecified-high',
    displayName: 'Unspecified (High)',
    description: 'Fallback for explicit high-tier requests without semantic category',
    model: {
      tier: 'opus',
      temperature: 0.3,
      thinkingBudget: 'high',
    },
    keywords: [],
    useCases: [
      'Explicit opus tier request',
      'Critical tasks without semantic match',
      'High-priority work requiring deep reasoning',
    ],
  },
};

// ============================================================================
// Complexity to Category Mapping
// ============================================================================

/** Map complexity level to delegation category */
export const COMPLEXITY_TO_CATEGORY: Record<1 | 2 | 3 | 4 | 5, DelegationCategory> = {
  1: 'quick',
  2: 'standard',
  3: 'standard',
  4: 'complex',
  5: 'ultrabrain',
};

// ============================================================================
// Agent Routing
// ============================================================================

/** Agent recommendation based on category */
export interface AgentRecommendation {
  /** Recommended agent type */
  agent: string;
  /** Model to use */
  model: ModelTier;
  /** Reason for recommendation */
  reason: string;
}

/** Category to agent mapping */
export const CATEGORY_AGENTS: Record<DelegationCategory, AgentRecommendation> = {
  quick: {
    agent: 'explore',
    model: 'haiku',
    reason: 'Quick lookups use fast, cheap model',
  },
  standard: {
    agent: 'executor',
    model: 'sonnet',
    reason: 'Standard work uses balanced model',
  },
  complex: {
    agent: 'executor-high',
    model: 'opus',
    reason: 'Complex work needs deep reasoning',
  },
  ultrabrain: {
    agent: 'architect',
    model: 'opus',
    reason: 'Analysis and architecture need expert reasoning',
  },
  'visual-engineering': {
    agent: 'designer-high',
    model: 'opus',
    reason: 'UI/UX needs creative and technical skills',
  },
  artistry: {
    agent: 'architect-medium',
    model: 'sonnet',
    reason: 'Creative tasks benefit from balanced creativity',
  },
  writing: {
    agent: 'writer',
    model: 'sonnet',
    reason: 'Documentation requires accuracy and completeness',
  },
  'unspecified-low': {
    agent: 'executor-low',
    model: 'haiku',
    reason: 'Fallback for explicit low-tier requests',
  },
  'unspecified-high': {
    agent: 'executor-high',
    model: 'opus',
    reason: 'Fallback for explicit high-tier requests',
  },
};
