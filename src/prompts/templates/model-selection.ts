/**
 * Model Selection Template
 *
 * Reusable template for model selection guidance in prompts.
 * Provides consistent hints across all agents.
 */

/**
 * Model selection guide template
 * Provides consistent guidance for choosing haiku/sonnet/opus
 */
export const MODEL_SELECTION_GUIDE = `
## Model Selection Guide (Hints)

Ultra Planner provides hints, but **YOU make the final decision** based on context.

### Quick Reference

| Complexity | Model | When to Use |
|------------|-------|-------------|
| **Simple** | Haiku | Lookup, find, minor fix, typo |
| **Standard** | Sonnet | Implement, add, modify, test |
| **Complex** | Opus | Refactor, debug, architect, analyze |

### Concrete Examples

**Use Haiku for:**
- "Find where X is defined"
- "Fix typo in README"
- "Rename variable foo to bar"
- "List all files matching pattern"

**Use Sonnet for:**
- "Add validation to user form"
- "Create new API endpoint"
- "Write tests for auth module"
- "Implement caching layer"

**Use Opus for:**
- "Debug race condition in worker pool"
- "Refactor authentication system"
- "Design database schema for X"
- "Analyze performance bottleneck"

### Decision Factors

Consider:
1. **File count**: 1-2 files → simpler, 5+ files → more complex
2. **Keywords**: "refactor", "architect", "debug" → complex
3. **Domain**: auth, security, payments → often complex
4. **Uncertainty**: Unknown scope → err on the side of higher model

### Override Hints When:
- Task seems simpler than hint suggests → downgrade
- Task has hidden complexity → upgrade
- Previous similar task failed with lower model → upgrade
`;

/**
 * Compact model selection table for embedding in prompts
 */
export const MODEL_SELECTION_TABLE = `
| Task Type | Model | Examples |
|-----------|-------|----------|
| Simple | Haiku | "Find X", "Fix typo", "Rename" |
| Standard | Sonnet | "Add feature", "Create", "Implement" |
| Complex | Opus | "Refactor", "Debug", "Architect" |
`;

/**
 * Generate model selection hint text
 */
export function generateModelSelectionHint(
  suggestedModel: 'haiku' | 'sonnet' | 'opus',
  reason: string
): string {
  return `
**Suggested Model**: ${suggestedModel.toUpperCase()}
**Reason**: ${reason}

_This is a hint. Override based on actual task complexity._
`;
}
