/**
 * Delegation Manager
 *
 * Routes tasks to appropriate agents based on complexity and category.
 */

import {
  DelegationCategory,
  CategoryConfig,
  ModelTier,
  AgentRecommendation,
  DELEGATION_CATEGORIES,
  COMPLEXITY_TO_CATEGORY,
  CATEGORY_AGENTS,
  THINKING_BUDGET_TOKENS,
} from './types.js';

import { estimateComplexity, ComplexityLevel } from '../../complexity/index.js';

// ============================================================================
// Category Detection
// ============================================================================

/**
 * Detect delegation category from task description
 */
export function detectCategory(taskDescription: string): DelegationCategory {
  const descLower = taskDescription.toLowerCase();

  // Score each category by keyword matches
  const scores: Record<DelegationCategory, number> = {
    quick: 0,
    standard: 0,
    complex: 0,
    ultrabrain: 0,
    'visual-engineering': 0,
    artistry: 0,
    writing: 0,
    'unspecified-low': 0,
    'unspecified-high': 0,
  };

  for (const [category, config] of Object.entries(DELEGATION_CATEGORIES)) {
    for (const keyword of config.keywords) {
      if (descLower.includes(keyword.toLowerCase())) {
        scores[category as DelegationCategory] += 1;
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

  return bestCategory;
}

/**
 * Get category from complexity level
 */
export function categoryFromComplexity(level: ComplexityLevel): DelegationCategory {
  return COMPLEXITY_TO_CATEGORY[level];
}

/**
 * Get category configuration
 */
export function getCategoryConfig(category: DelegationCategory): CategoryConfig {
  return DELEGATION_CATEGORIES[category];
}

/**
 * Get thinking budget token count for a category.
 * Maps thinkingBudget string to actual token count for Claude API.
 */
export function getCategoryThinkingBudgetTokens(category: DelegationCategory): number {
  const config = DELEGATION_CATEGORIES[category];
  return THINKING_BUDGET_TOKENS[config.model.thinkingBudget];
}

/**
 * Get full category resolution with priority:
 * 1. Explicit category (if provided)
 * 2. Explicit tier -> unspecified-{tier}
 * 3. Auto-detect from description
 */
export function resolveCategory(options: {
  taskDescription: string;
  explicitCategory?: DelegationCategory;
  explicitTier?: ModelTier;
}): DelegationCategory {
  // 1. Explicit category wins
  if (options.explicitCategory) {
    return options.explicitCategory;
  }

  // 2. Explicit tier maps to unspecified-{tier}
  if (options.explicitTier) {
    return options.explicitTier === 'haiku' ? 'unspecified-low' : 'unspecified-high';
  }

  // 3. Auto-detect
  return detectCategory(options.taskDescription);
}

// ============================================================================
// Agent Routing
// ============================================================================

/**
 * Get agent recommendation for a category
 */
export function getAgentForCategory(category: DelegationCategory): AgentRecommendation {
  return CATEGORY_AGENTS[category];
}

/**
 * Route a task to the appropriate agent
 */
export function routeTask(
  taskDescription: string,
  options?: {
    preferredCategory?: DelegationCategory;
    forceModel?: ModelTier;
    contextHints?: {
      isUI?: boolean;
      isDocumentation?: boolean;
      isDebugging?: boolean;
      isArchitecture?: boolean;
    };
  }
): {
  category: DelegationCategory;
  agent: string;
  model: ModelTier;
  reason: string;
} {
  let category: DelegationCategory;

  // Use preferred category if provided
  if (options?.preferredCategory) {
    category = options.preferredCategory;
  } else if (options?.contextHints) {
    // Use context hints for routing
    if (options.contextHints.isUI) {
      category = 'visual-engineering';
    } else if (options.contextHints.isDocumentation) {
      category = 'writing';
    } else if (options.contextHints.isDebugging) {
      category = 'ultrabrain';
    } else if (options.contextHints.isArchitecture) {
      category = 'ultrabrain';
    } else {
      category = detectCategory(taskDescription);
    }
  } else {
    // Auto-detect from description
    category = detectCategory(taskDescription);
  }

  const recommendation = getAgentForCategory(category);

  return {
    category,
    agent: recommendation.agent,
    model: options?.forceModel || recommendation.model,
    reason: recommendation.reason,
  };
}

/**
 * Route based on complexity estimation
 */
export function routeByComplexity(
  taskDescription: string,
  files?: string[]
): {
  complexity: ComplexityLevel;
  category: DelegationCategory;
  agent: string;
  model: ModelTier;
} {
  const { complexity } = estimateComplexity({
    taskDescription,
    files,
  });

  const category = categoryFromComplexity(complexity.level);
  const recommendation = getAgentForCategory(category);

  return {
    complexity: complexity.level,
    category,
    agent: recommendation.agent,
    model: recommendation.model,
  };
}

// ============================================================================
// Executor Loop Prompt
// ============================================================================

/**
 * Generate executor loop prompt for autonomous task execution
 */
export function generateExecutorLoopPrompt(options: {
  workerId?: string;
  sessionId?: string;
  planPath?: string;
  learnings?: string;
}): string {
  return `# Autonomous Executor Loop

You are an executor agent running in autonomous loop mode.
Your job is to continuously claim and execute tasks until none remain.

${options.workerId ? `## Worker Identity\n- **Worker ID**: ${options.workerId}` : ''}
${options.sessionId ? `- **Session ID**: ${options.sessionId}` : ''}
${options.planPath ? `- **Plan**: ${options.planPath}` : ''}

## Execution Loop Protocol

Repeat until no tasks remain:

\`\`\`
LOOP:
  1. CLAIM: Call TaskList, find task with status=pending and empty owner
  2. LOCK: Call TaskUpdate(taskId, owner="{your-id}")
     - If fails (race condition), go back to CLAIM
  3. EXECUTE: Perform the task as specified
     - Read relevant files
     - Make necessary changes
     - Run verification (build, test)
  4. COMPLETE: Call TaskUpdate(taskId, status="completed")
  5. REPORT: Log summary of what was done
  6. Continue to CLAIM
\`\`\`

## Task Claiming Protocol

1. **List Tasks**: Use TaskList to see all tasks
2. **Filter Available**: Find tasks where:
   - status = "pending"
   - owner is empty/null
   - blockedBy list is empty (or all blockers completed)
3. **Atomic Claim**: Use TaskUpdate to set owner
4. **Handle Race**: If claim fails, immediately try next task
5. **Retry Limit**: After 3 failed claims, wait 1 second and retry

## Execution Guidelines

1. **Atomic Changes**: Small, focused modifications
2. **Verify Before Complete**: Build must pass
3. **Report Deviations**: If approach differs from plan
4. **Capture Learnings**: Document useful patterns

## Heartbeat

Every 30 seconds while executing:
- Signal you're still working
- Update progress if long task

## Completion

When TaskList shows no available tasks:
1. Report final summary
2. List all completed tasks
3. Note any issues encountered

${options.learnings ? `## Relevant Learnings\n\n${options.learnings}` : ''}

## Begin

Start by calling TaskList to find available work.
`;
}

/**
 * Generate heartbeat protocol instructions
 */
export function generateHeartbeatProtocol(): string {
  return `## Heartbeat Protocol

While executing long-running tasks, periodically signal activity:

1. **Frequency**: Every 30 seconds
2. **Method**: Update task metadata or log progress
3. **Content**: Current step, % complete, any blockers

### Example Heartbeat

\`\`\`
TaskUpdate(taskId, metadata: {
  heartbeat: "2024-01-31T10:30:00Z",
  progress: "50%",
  currentStep: "Running tests"
})
\`\`\`

### Timeout Handling

If a worker goes 5 minutes without heartbeat:
- Task may be reclaimed by another worker
- Current work may be lost

Always heartbeat to prevent timeout!
`;
}

// ============================================================================
// Routing Utilities
// ============================================================================

/**
 * Get all available categories
 */
export function listCategories(): Array<{
  category: DelegationCategory;
  displayName: string;
  description: string;
}> {
  return Object.values(DELEGATION_CATEGORIES).map(c => ({
    category: c.category,
    displayName: c.displayName,
    description: c.description,
  }));
}

/**
 * Get model for a category
 */
export function getModelForCategory(category: DelegationCategory): ModelTier {
  return DELEGATION_CATEGORIES[category].model.tier;
}

/**
 * Check if task likely needs high-tier model
 */
export function needsHighTierModel(taskDescription: string): boolean {
  const category = detectCategory(taskDescription);
  const model = getModelForCategory(category);
  return model === 'opus';
}

// ============================================================================
// Category-Specific Prompt Enhancement
// ============================================================================

/**
 * Category-specific prompt appendices.
 * Provides domain-specific guidance for each category.
 */
export const CATEGORY_PROMPT_APPEND: Record<DelegationCategory, string> = {
  quick: '',  // No additional guidance needed for simple lookups

  standard: `
Focus on:
- Clean, maintainable implementation
- Following existing codebase patterns
- Appropriate error handling`,

  complex: `
Approach systematically:
- Plan the refactoring steps
- Minimize changes to public APIs
- Consider backward compatibility
- Test after each major change`,

  ultrabrain: `
Approach systematically:
- Root cause analysis first
- Consider edge cases
- Document your reasoning
- Verify assumptions with evidence`,

  'visual-engineering': `
Focus on:
- Visual hierarchy and layout
- Accessibility (ARIA, keyboard navigation)
- Responsive design considerations
- Design system consistency
- User experience flow`,

  artistry: `
Explore creatively:
- Generate multiple alternatives
- Consider unconventional approaches
- Balance creativity with practicality
- Explain tradeoffs of each option`,

  writing: `
Focus on:
- Clarity and conciseness
- Accurate technical details
- Consistent terminology
- Appropriate examples
- Proper formatting`,

  'unspecified-low': '',  // Generic fallback, no specific guidance

  'unspecified-high': `
Approach thoroughly:
- Consider the full context
- Handle edge cases
- Provide complete solution`,
};

/**
 * Enhance a prompt with category-specific guidance.
 * Appends domain-specific instructions to improve task execution quality.
 *
 * @param prompt - Original task prompt
 * @param category - Delegation category
 * @returns Enhanced prompt with category guidance (if any)
 */
export function enhancePromptWithCategory(
  prompt: string,
  category: DelegationCategory
): string {
  const append = CATEGORY_PROMPT_APPEND[category];
  if (!append || append.trim() === '') {
    return prompt;
  }
  return `${prompt}\n\n## Category Guidance (${category})${append}`;
}
