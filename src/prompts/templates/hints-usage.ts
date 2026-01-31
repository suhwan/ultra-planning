/**
 * Hints Usage Template
 *
 * Templates for explaining how to use Ultra Planner's hint system.
 */

/**
 * Explanation of the hints system for prompts
 */
export const HINTS_EXPLANATION = `
## Ultra Planner Hints

Ultra Planner provides **hints** to help your decision-making:

| Hint Type | Function | What It Does |
|-----------|----------|--------------|
| Complexity | suggestComplexity() | Suggests task complexity level (1-5) |
| Routing | suggestRoute() | Suggests which agent/model to use |
| Model | suggestModelForComplexity() | Suggests model tier (haiku/sonnet/opus) |

### How Hints Work

1. **Hints are suggestions, not rules**
   - Each hint includes \`isHint: true\`
   - Confidence levels indicate certainty (0-1)
   - Lower confidence means more need for your judgment

2. **You make the final decision**
   - Hints are based on heuristics and patterns
   - You have the actual context
   - Override hints when the situation requires it

3. **When to override hints**
   - Task is simpler/more complex than keywords suggest
   - Context changes the requirements
   - Previous experience shows different approach works

### Example Usage

\`\`\`typescript
// Get all hints for a task
const hints = getTaskHints({
  taskDescription: "Refactor the auth module",
  files: ["src/auth/handler.ts"],
  contextHints: { isArchitecture: true }
});

// hints.complexity.level might be 4
// hints.routing.agent might be "executor-high"
// hints.model.tier might be "opus"

// But if you know this is actually simple, override:
// Use executor with sonnet instead
\`\`\`
`;

/**
 * Prompt snippet for including hints info
 */
export const HINTS_USAGE_SNIPPET = `
## Using Ultra Planner Hints

Ultra Planner suggests:
- **Complexity hints**: \`suggestComplexity()\` → Level 1-5
- **Routing hints**: \`suggestRoute()\` → Agent and model
- **Combined hints**: \`getTaskHints()\` → All in one

These are **suggestions only**. You have the context to make the final call.

**Override hints when:**
- Actual task differs from description
- You have domain knowledge
- Previous attempts needed different approach
`;

/**
 * Generate a contextualized hints usage message
 */
export function generateHintsUsageMessage(context?: {
  taskDescription?: string;
  suggestedModel?: 'haiku' | 'sonnet' | 'opus';
  suggestedAgent?: string;
  confidence?: number;
}): string {
  if (!context) {
    return HINTS_USAGE_SNIPPET;
  }

  const confidenceLevel = context.confidence && context.confidence > 0.6
    ? 'fairly confident'
    : 'uncertain';

  return `
## Ultra Planner Hints for This Task

${context.taskDescription ? `**Task**: ${context.taskDescription}` : ''}

**Suggestions** (${confidenceLevel}):
${context.suggestedModel ? `- Model: **${context.suggestedModel}**` : ''}
${context.suggestedAgent ? `- Agent: **${context.suggestedAgent}**` : ''}

These are hints based on heuristics. You see the actual context, so:
- **Trust your judgment** over these hints
- **Upgrade model** if task proves complex
- **Downgrade model** for simple tasks

Your decision is final.
`;
}
