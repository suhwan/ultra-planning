# Phase 20: Category-based Routing - Research

**Researched:** 2026-02-01
**Domain:** Model Routing, Agent Configuration, Delegation Categories
**Confidence:** HIGH

## Summary

Research reveals that **most of Phase 20's functionality already exists** in the codebase. The delegation module (`src/orchestration/delegation/`) contains category types, configurations, and routing logic. The primary remaining work is:

1. Adding Zod schema validation (matching oh-my-opencode reference)
2. Adding thinking budget token mapping
3. Enhancing delegate_task integration (via hooks or explicit routing)
4. Adding `unspecified-low` and `unspecified-high` fallback categories

**Primary recommendation:** Enhance existing implementation with Zod schemas and thinking budget integration rather than building from scratch.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | 3.23+ | Schema validation | Already used in project, matches reference implementation |
| typescript | 5.x | Type definitions | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 2.x | Testing | Existing test infrastructure |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zod | io-ts | Zod already in use, better DX |
| Manual validation | Zod | Zod provides type inference + runtime validation |

**Installation:**
```bash
# Already installed - no new dependencies needed
```

## Architecture Patterns

### Existing Project Structure
```
src/
├── orchestration/
│   └── delegation/              # EXISTING - Category routing
│       ├── types.ts             # Category types (7 categories defined)
│       ├── manager.ts           # Routing logic (detectCategory, routeTask)
│       ├── manager.test.ts      # Comprehensive tests
│       └── index.ts             # Re-exports
├── complexity/                   # EXISTING - Complexity estimation
│   ├── types.ts                 # ComplexityLevel 1-5
│   └── estimator.ts             # estimateComplexity()
└── config/
    ├── types.ts                 # ProjectConfig, ModelRoutingProfile
    └── loader.ts                # Config loading
```

### Recommended Additions
```
src/
├── orchestration/
│   └── delegation/
│       ├── types.ts             # ADD: Zod schema (CategoryConfigSchema)
│       ├── manager.ts           # ADD: thinkingBudgetTokens, enhancePrompt
│       └── index.ts             # No changes
├── hooks/
│   └── tool/
│       └── category-routing.ts  # NEW: delegate_task category injection hook
```

### Pattern 1: Layered Category Resolution
**What:** Categories resolve through a priority hierarchy
**When to use:** Agent configuration, task delegation
**Example:**
```typescript
// Source: references/oh-my-claudecode/src/features/delegation-categories/INTEGRATION.md
// Priority: explicit category > explicit tier > auto-detection > default

function getCategoryForTask(context: {
  taskPrompt: string;
  explicitCategory?: DelegationCategory;
  explicitTier?: ModelTier;
}): ResolvedCategory {
  // 1. Explicit category wins
  if (context.explicitCategory) {
    return resolveCategory(context.explicitCategory);
  }

  // 2. Explicit tier maps to unspecified-{tier}
  if (context.explicitTier) {
    return resolveCategory(
      context.explicitTier === 'haiku' ? 'unspecified-low' : 'unspecified-high'
    );
  }

  // 3. Auto-detect from keywords
  return resolveCategory(detectCategory(context.taskPrompt));
}
```

### Pattern 2: Thinking Budget Token Mapping
**What:** Map thinkingBudget strings to actual token counts
**When to use:** When configuring Claude API calls
**Example:**
```typescript
// Source: references/oh-my-claudecode/src/features/delegation-categories/README.md
const THINKING_BUDGET_TOKENS: Record<ThinkingBudget, number> = {
  low: 1000,      // Simple lookups
  medium: 5000,   // Standard work
  high: 10000,    // Complex reasoning
  max: 32000,     // Deep analysis
};

function getCategoryThinkingBudgetTokens(category: DelegationCategory): number {
  const config = DELEGATION_CATEGORIES[category];
  return THINKING_BUDGET_TOKENS[config.model.thinkingBudget];
}
```

### Pattern 3: Category-Aware Prompt Enhancement
**What:** Append category-specific guidance to prompts
**When to use:** Before delegating to subagents
**Example:**
```typescript
// Source: references/oh-my-claudecode/src/features/delegation-categories/INTEGRATION.md
const CATEGORY_PROMPT_APPEND: Record<DelegationCategory, string> = {
  'visual-engineering': `
Focus on:
- Visual hierarchy and layout
- Accessibility (ARIA, keyboard navigation)
- Responsive design considerations
- Design system consistency`,
  'ultrabrain': `
Approach systematically:
- Root cause analysis first
- Consider edge cases
- Document your reasoning
- Verify assumptions`,
  // ... other categories
};

function enhancePromptWithCategory(
  prompt: string,
  category: DelegationCategory
): string {
  const append = CATEGORY_PROMPT_APPEND[category];
  return append ? `${prompt}\n\n${append}` : prompt;
}
```

### Anti-Patterns to Avoid
- **Bypassing tiers:** Categories enhance tiers, never bypass model routing
- **Hard-coded models:** Use tier → model mapping, not direct model names
- **Missing fallbacks:** Always have unspecified-low/high for edge cases

## Current State Analysis

### What Already Exists (HIGH confidence)

**`src/orchestration/delegation/types.ts`:**
- `DelegationCategory` type with 7 categories: quick, standard, complex, ultrabrain, visual-engineering, artistry, writing
- `CategoryConfig` interface with displayName, description, model, keywords, useCases
- `ModelConfig` with tier, temperature, thinkingBudget
- `DELEGATION_CATEGORIES` constant with all 7 category configs
- `CATEGORY_AGENTS` mapping categories to agent recommendations

**`src/orchestration/delegation/manager.ts`:**
- `detectCategory(taskDescription)` - keyword-based category detection
- `categoryFromComplexity(level)` - map 1-5 complexity to category
- `getCategoryConfig(category)` - get full config for category
- `getAgentForCategory(category)` - get agent recommendation
- `routeTask(description, options)` - full routing with contextHints
- `routeByComplexity(description, files)` - route via complexity estimation
- `getModelForCategory(category)` - get model tier
- `needsHighTierModel(description)` - quick check for opus need

**`src/orchestration/delegation/manager.test.ts`:**
- 238 lines of comprehensive tests
- Tests detectCategory, categoryFromComplexity, getCategoryConfig, routeTask, etc.

### What's Missing (compared to references)

| Feature | Reference Location | Status |
|---------|-------------------|--------|
| Zod schema (CategoryConfigSchema) | `oh-my-opencode/src/config/schema.ts:167-185` | Missing |
| `unspecified-low` / `unspecified-high` categories | `oh-my-claudecode/CATEGORY_IMPLEMENTATION.md` | Missing |
| Thinking budget token constants | `oh-my-claudecode/src/features/delegation-categories/README.md` | Missing |
| Prompt enhancement per category | `oh-my-claudecode/src/features/delegation-categories/INTEGRATION.md` | Partial |
| delegate_task hook integration | Inferred from architecture | Missing |

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Category validation | Custom validation | Zod schema with z.enum | Runtime + compile-time safety |
| Model selection | Manual switch/if | DELEGATION_CATEGORIES lookup | Already implemented |
| Keyword detection | Custom NLP | Existing detectCategory() | Tested, works well |
| Agent routing | Manual mapping | getAgentForCategory() | Already mapped |

**Key insight:** The delegation module is already comprehensive. Enhance, don't rebuild.

## Common Pitfalls

### Pitfall 1: Over-Engineering Category Inheritance
**What goes wrong:** Creating complex inheritance chains (agent → category → tier → model)
**Why it happens:** Trying to match oh-my-claudecode's full agent system
**How to avoid:** Keep it simple - categories directly specify model config
**Warning signs:** More than 2 levels of indirection

### Pitfall 2: Temperature Confusion
**What goes wrong:** Confusing per-category temperature with global settings
**Why it happens:** Claude API has its own temperature; categories add another layer
**How to avoid:** Document that category temperature is *recommended*, not enforced
**Warning signs:** Expecting temperature to be automatically applied

### Pitfall 3: Missing Fallback Categories
**What goes wrong:** Detection returns undefined or throws for edge cases
**Why it happens:** Not all prompts match keywords cleanly
**How to avoid:** Always default to `standard` or `unspecified-high`
**Warning signs:** Undefined category in logs

### Pitfall 4: Hook Integration Complexity
**What goes wrong:** Trying to inject category routing deep into Task tool
**Why it happens:** Wanting seamless integration
**How to avoid:** Use existing hook pattern (tool.execute.after) for hints, not enforcement
**Warning signs:** Modifying core Claude Code internals

## Code Examples

Verified patterns from existing codebase and references:

### Existing Category Detection
```typescript
// Source: src/orchestration/delegation/manager.ts:26-60
export function detectCategory(taskDescription: string): DelegationCategory {
  const descLower = taskDescription.toLowerCase();

  const scores: Record<DelegationCategory, number> = {
    quick: 0,
    standard: 0,
    complex: 0,
    ultrabrain: 0,
    'visual-engineering': 0,
    artistry: 0,
    writing: 0,
  };

  for (const [category, config] of Object.entries(DELEGATION_CATEGORIES)) {
    for (const keyword of config.keywords) {
      if (descLower.includes(keyword.toLowerCase())) {
        scores[category as DelegationCategory] += 1;
      }
    }
  }

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
```

### Reference Zod Schema
```typescript
// Source: references/oh-my-opencode/src/config/schema.ts:167-196
export const CategoryConfigSchema = z.object({
  description: z.string().optional(),
  model: z.string().optional(),
  variant: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  maxTokens: z.number().optional(),
  thinking: z.object({
    type: z.enum(["enabled", "disabled"]),
    budgetTokens: z.number().optional(),
  }).optional(),
  reasoningEffort: z.enum(["low", "medium", "high", "xhigh"]).optional(),
  textVerbosity: z.enum(["low", "medium", "high"]).optional(),
  tools: z.record(z.string(), z.boolean()).optional(),
  prompt_append: z.string().optional(),
  is_unstable_agent: z.boolean().optional(),
});

export const BuiltinCategoryNameSchema = z.enum([
  "visual-engineering",
  "ultrabrain",
  "artistry",
  "quick",
  "unspecified-low",
  "unspecified-high",
  "writing",
]);

export const CategoriesConfigSchema = z.record(z.string(), CategoryConfigSchema);
```

### Existing Route Task
```typescript
// Source: src/orchestration/delegation/manager.ts:90-139
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

  if (options?.preferredCategory) {
    category = options.preferredCategory;
  } else if (options?.contextHints) {
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
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct model specification | Category-based routing | 2025+ | Simplified config |
| Manual temperature tuning | Category defaults | 2025+ | Better defaults |
| No thinking budget | Thinking budget per category | 2025+ | Better reasoning control |

**Deprecated/outdated:**
- Direct model strings in config (use tiers/categories instead)
- Manual temperature in every delegation call (use category defaults)

## Recommended Implementation Plan

### Plan 20-01: CategoryConfig Zod Schema
1. Add Zod schema to `src/orchestration/delegation/types.ts`
2. Add `unspecified-low` and `unspecified-high` categories
3. Add thinking budget token mapping
4. Validate existing DELEGATION_CATEGORIES against schema

### Plan 20-02: Category Inheritance Logic
1. Add `getCategoryForTask()` with priority resolution
2. Add `enhancePromptWithCategory()` with category-specific guidance
3. Add utility functions: `getCategoryThinkingBudgetTokens()`
4. Update tests for new functions

### Plan 20-03: delegate_task Integration
1. Create `src/hooks/tool/category-routing.ts` hook
2. Hook intercepts Task tool calls
3. Inject category recommendations as hints (not enforcement)
4. Add tests for hook integration

## Open Questions

Things that couldn't be fully resolved:

1. **Agent inheritance from category**
   - What we know: oh-my-opencode has `AgentOverrideConfigSchema` with `category` field
   - What's unclear: Do we want agents to inherit from categories? (adds complexity)
   - Recommendation: Keep simple - agents use categories as hints, not inheritance

2. **Custom user categories**
   - What we know: Reference allows custom categories via config
   - What's unclear: Is this needed for ultra-planning?
   - Recommendation: Skip for v1, add later if requested

3. **Category analytics**
   - What we know: Could track category usage for cost analysis
   - What's unclear: Where to store analytics
   - Recommendation: Out of scope for Phase 20, future phase

## Sources

### Primary (HIGH confidence)
- `src/orchestration/delegation/types.ts` - Current category implementation
- `src/orchestration/delegation/manager.ts` - Current routing logic
- `src/orchestration/delegation/manager.test.ts` - Existing tests
- `references/oh-my-opencode/src/config/schema.ts` - CategoryConfigSchema reference

### Secondary (MEDIUM confidence)
- `references/oh-my-claudecode/CATEGORY_IMPLEMENTATION.md` - Implementation guide
- `references/oh-my-claudecode/src/features/delegation-categories/README.md` - Category reference
- `references/oh-my-claudecode/src/features/delegation-categories/INTEGRATION.md` - Integration patterns

### Tertiary (LOW confidence)
- None - all findings verified with code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses existing dependencies
- Architecture: HIGH - Enhances existing implementation
- Pitfalls: HIGH - Based on code analysis

**Research date:** 2026-02-01
**Valid until:** 30 days (stable domain)
