/**
 * PROJECT.md Generator
 *
 * Generates PROJECT.md documents following GSD template structure.
 */

import type { ProjectDocumentConfig } from '../types.js';

/**
 * Generate PROJECT.md markdown from config
 */
export function generateProjectMd(config: ProjectDocumentConfig): string {
  const lastUpdated = config.lastUpdated
    ? `${config.lastUpdated.date} after ${config.lastUpdated.trigger}`
    : new Date().toISOString().split('T')[0];

  // Frontmatter for PROJECT.md
  const frontmatter = `---
name: "${config.name}"
core_value: "${config.coreValue}"
last_updated: ${lastUpdated}
---

`;

  return frontmatter + `# ${config.name}

## What This Is

${config.description}

## Core Value

${config.coreValue}

## Requirements

### Validated

${
  config.requirements.validated.length === 0
    ? '(None yet — ship to validate)'
    : config.requirements.validated.map((req) => `- ✓ ${req}`).join('\n')
}

### Active

${
  config.requirements.active.length === 0
    ? '(No active requirements)'
    : config.requirements.active.map((req) => `- [ ] ${req}`).join('\n')
}

### Out of Scope

${
  config.requirements.outOfScope.length === 0
    ? '(No explicit exclusions yet)'
    : config.requirements.outOfScope.map((item) => `- ${item.item} — ${item.reason}`).join('\n')
}

## Context

${config.context}

## Constraints

${
  config.constraints.length === 0
    ? '(No constraints defined yet)'
    : config.constraints
        .map((c) => `- **${c.type}**: ${c.description} — ${c.reason}`)
        .join('\n')
}

## Key Decisions

${
  config.keyDecisions.length === 0
    ? '(No key decisions recorded yet)'
    : `| Decision | Rationale | Outcome |
|----------|-----------|---------|
${config.keyDecisions
  .map((d) => {
    const outcome =
      d.outcome === 'good' ? '✓ Good' : d.outcome === 'revisit' ? '⚠️ Revisit' : '— Pending';
    return `| ${d.decision} | ${d.rationale} | ${outcome} |`;
  })
  .join('\n')}`
}

---
*Last updated: ${lastUpdated}*
`;
}
