/**
 * Decision Recording Template
 *
 * Templates for recording decisions and learnings via Notepad.
 * Ensures consistency in how agents capture wisdom.
 */

/**
 * Decision recording protocol template
 */
export const DECISION_RECORDING_PROTOCOL = `
## Decision Recording Protocol

When you make important decisions, record them for future reference:

### Recording a Decision

\`\`\`
mcp__ultra-planner__add_decision(planId, {
  taskId: "current-task-id",
  content: "What you decided",
  rationale: "Why you decided this",
  alternatives: ["Option A", "Option B"]  // optional
});
\`\`\`

### When to Record

Record decisions when:
- Choosing between multiple valid approaches
- Deviating from the original plan
- Making architectural choices
- Selecting libraries or tools
- Choosing error handling strategies

### Examples

**Good decision record:**
\`\`\`
{
  content: "Used axios instead of fetch",
  rationale: "Need request interceptors for auth token refresh",
  alternatives: ["fetch + custom wrapper", "ky library"]
}
\`\`\`

**Bad decision record:**
\`\`\`
{
  content: "Fixed the bug",  // Too vague
  rationale: "It was broken"  // Not helpful
}
\`\`\`
`;

/**
 * Learning capture protocol template
 */
export const LEARNING_CAPTURE_PROTOCOL = `
## Learning Capture Protocol

When you discover useful patterns or gotchas, record them:

### Recording a Learning

\`\`\`
mcp__ultra-planner__add_learning(planId, {
  taskId: "current-task-id",
  content: "What you learned",
  learningType: "pattern",  // or: convention, gotcha, discovery, avoid, prefer
  tags: ["relevant", "tags"]
});
\`\`\`

### Learning Types

| Type | Use For | Example |
|------|---------|---------|
| pattern | Reusable solution | "Use .pipe() for Zod transforms" |
| convention | Project style | "Prefix hooks with use-" |
| gotcha | Non-obvious issue | "API returns 200 on validation error" |
| discovery | New information | "Library X supports feature Y" |
| avoid | Anti-pattern | "Don't use any for API responses" |
| prefer | Recommended approach | "Use discriminated unions for state" |

### When to Record

Record learnings when:
- You discover something non-obvious
- You find a pattern that could help future tasks
- You encounter a gotcha that wasted time
- You find a better way to do something

### Priority

Set priority 1-5 (higher = more important):
- 5: Critical, affects many tasks
- 3: Useful, worth remembering
- 1: Minor, nice to know
`;

/**
 * Issue recording protocol template
 */
export const ISSUE_RECORDING_PROTOCOL = `
## Issue Recording Protocol

When you encounter problems, record them:

### Recording an Issue

\`\`\`
mcp__ultra-planner__add_issue(planId, {
  taskId: "current-task-id",
  content: "What the issue is",
  severity: "medium",  // low, medium, high, critical
  status: "open",      // open, workaround, resolved
  workaround: "How to work around it"  // if applicable
});
\`\`\`

### Severity Guide

| Severity | Use For | Example |
|----------|---------|---------|
| critical | Blocks all progress | "Build completely broken" |
| high | Blocks current task | "Test database unreachable" |
| medium | Slows progress | "Slow type checking" |
| low | Minor inconvenience | "Deprecation warning" |

### When to Record

Record issues when:
- Something blocks progress
- A workaround was needed
- A bug was found but not fixed
- External dependency has problems
`;

/**
 * Generate combined wisdom protocol for prompts
 */
export function generateWisdomProtocol(): string {
  return `
## Wisdom Capture

Throughout execution, capture useful knowledge:

**Decisions** - Record when choosing between approaches
**Learnings** - Record when discovering patterns or gotchas
**Issues** - Record when encountering problems

This helps maintain consistency across sessions and workers.
`;
}
