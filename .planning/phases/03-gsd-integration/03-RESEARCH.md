# Phase 3: GSD Integration - Research

**Researched:** 2026-01-26
**Domain:** Document generation, agent prompt engineering, atomic Git commits
**Confidence:** HIGH

## Summary

Phase 3 integrates the GSD (Get Shit Done) document system into Ultra Planner. This involves copying and adapting templates for PROJECT.md, ROADMAP.md, and PLAN.md from the reference implementation, creating a Planner agent prompt, applying XML/YAML hybrid formatting, and implementing atomic commit patterns.

The existing codebase from Phases 1-2 provides a solid foundation: TypeScript types for plan frontmatter (`PlanFrontmatter`, `MustHaves`), state management (`StateManager`), event system (`EventSystem`), and checkpoint infrastructure. Phase 3 builds document generation capabilities on top of this infrastructure.

**Primary recommendation:** Implement document generators as pure TypeScript functions that produce markdown strings conforming to GSD templates, with Zod validation for frontmatter schemas. Use the existing StateManager for any state persistence needs.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9.3 | Type-safe implementation | Already established in Phase 1 |
| Zod | 3.23+ | Schema validation for frontmatter | Already established in Phase 1 |
| Node.js fs | Built-in | File operations for markdown generation | Native, no deps needed |
| gray-matter | 4.0.3 | YAML frontmatter parsing/serialization | Standard for markdown frontmatter |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 3.x | Date formatting for timestamps | ISO 8601 formatting in frontmatter |
| simple-git | 3.x | Git operations for atomic commits | Programmatic git commit/status |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| gray-matter | js-yaml + manual parsing | gray-matter handles frontmatter boundaries automatically |
| simple-git | child_process.exec | simple-git provides typed API, error handling |
| Template strings | Template engine (handlebars) | Template strings simpler for known structures |

**Installation:**
```bash
npm install gray-matter date-fns simple-git
npm install -D @types/gray-matter
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── documents/           # Document generation module
│   ├── index.ts         # Module exports
│   ├── types.ts         # Document-specific types
│   ├── templates/       # Template functions
│   │   ├── project.ts   # PROJECT.md generator
│   │   ├── roadmap.ts   # ROADMAP.md generator
│   │   └── plan.ts      # PLAN.md generator
│   ├── generators/      # High-level document generators
│   │   ├── project-generator.ts
│   │   ├── roadmap-generator.ts
│   │   └── plan-generator.ts
│   └── validation/      # Frontmatter validators
│       └── schemas.ts   # Zod schemas for frontmatter
├── agents/              # Agent prompt management
│   ├── index.ts
│   ├── types.ts         # Agent configuration types
│   └── prompts/         # Agent prompt definitions
│       └── planner.ts   # Planner agent prompt
├── git/                 # Git integration
│   ├── index.ts
│   ├── commit.ts        # Atomic commit operations
│   └── types.ts         # Git-related types
└── index.ts             # Re-export all modules
```

### Pattern 1: Document Generator Pattern

**What:** Pure functions that accept structured input and return markdown strings
**When to use:** All document generation (PROJECT.md, ROADMAP.md, PLAN.md)
**Example:**
```typescript
// Source: GSD template structure
interface ProjectInput {
  name: string;
  description: string;
  coreValue: string;
  requirements: {
    active: string[];
    outOfScope: Array<{ item: string; reason: string }>;
  };
  constraints: Array<{ type: string; what: string; why: string }>;
}

function generateProjectMd(input: ProjectInput): string {
  return `# ${input.name}

## What This Is

${input.description}

## Core Value

${input.coreValue}

## Requirements

### Active

${input.requirements.active.map(r => `- [ ] ${r}`).join('\n')}

### Out of Scope

${input.requirements.outOfScope.map(r => `- ${r.item} - ${r.reason}`).join('\n')}

## Constraints

${input.constraints.map(c => `- **${c.type}**: ${c.what} - ${c.why}`).join('\n')}

---
*Last updated: ${new Date().toISOString().split('T')[0]}*
`;
}
```

### Pattern 2: Frontmatter + Content Pattern

**What:** Documents with YAML frontmatter followed by markdown content
**When to use:** PLAN.md, SUMMARY.md generation
**Example:**
```typescript
// Source: GSD phase-prompt.md template
import matter from 'gray-matter';

interface PlanDocument {
  frontmatter: PlanFrontmatter;
  content: string;
}

function generatePlanMd(doc: PlanDocument): string {
  // gray-matter.stringify combines frontmatter with content
  return matter.stringify(doc.content, doc.frontmatter);
}

function parsePlanMd(markdown: string): PlanDocument {
  const { data, content } = matter(markdown);
  return {
    frontmatter: data as PlanFrontmatter,
    content
  };
}
```

### Pattern 3: XML Task Syntax

**What:** XML elements within markdown for structured task definitions
**When to use:** Task definitions in PLAN.md
**Example:**
```typescript
// Source: GSD phase-prompt.md template
interface Task {
  type: 'auto' | 'checkpoint:human-verify' | 'checkpoint:decision' | 'checkpoint:human-action';
  name: string;
  files?: string[];
  action: string;
  verify: string;
  done: string;
}

function generateTaskXml(task: Task): string {
  const filesLine = task.files ? `  <files>${task.files.join(', ')}</files>\n` : '';
  return `<task type="${task.type}">
  <name>${task.name}</name>
${filesLine}  <action>${task.action}</action>
  <verify>${task.verify}</verify>
  <done>${task.done}</done>
</task>`;
}

function generateTasksSection(tasks: Task[]): string {
  return `<tasks>

${tasks.map(generateTaskXml).join('\n\n')}

</tasks>`;
}
```

### Pattern 4: Atomic Commit Pattern

**What:** One commit per task, with standardized message format
**When to use:** After each task completes during execution
**Example:**
```typescript
// Source: GSD git-integration.md
import simpleGit from 'simple-git';

interface TaskCommit {
  type: 'feat' | 'fix' | 'test' | 'refactor' | 'perf' | 'chore' | 'docs';
  phase: string;
  plan: string;
  taskName: string;
  changes: string[];
  files: string[];
}

async function commitTask(commit: TaskCommit): Promise<string> {
  const git = simpleGit();

  // Stage only specified files
  await git.add(commit.files);

  // Build message
  const message = `${commit.type}(${commit.phase}-${commit.plan}): ${commit.taskName}

${commit.changes.map(c => `- ${c}`).join('\n')}`;

  // Commit and return hash
  const result = await git.commit(message);
  return result.commit;
}
```

### Anti-Patterns to Avoid

- **Template string concatenation without types:** Always define input interfaces for generators
- **Inline markdown generation:** Extract to dedicated template functions for testability
- **git add . or git add -A:** Always stage specific files to avoid accidental commits
- **Mutating frontmatter during parsing:** Parse produces new objects, never mutate

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Regex-based parser | gray-matter | Handles edge cases (multiline, nested) |
| Git operations | child_process.exec | simple-git | Type-safe, handles errors, cross-platform |
| Date formatting | Manual string manipulation | date-fns | Timezone handling, ISO compliance |
| Schema validation | Manual type guards | Zod | Runtime validation, detailed errors |

**Key insight:** Document generation is straightforward string concatenation, but frontmatter parsing and Git operations have subtle edge cases that mature libraries handle correctly.

## Common Pitfalls

### Pitfall 1: Frontmatter Delimiter Handling

**What goes wrong:** YAML frontmatter must be delimited by `---` on its own lines; content with `---` can break parsing
**Why it happens:** User content or template strings contain triple dashes
**How to avoid:** Use gray-matter which properly handles the first delimiter pair only
**Warning signs:** Frontmatter parsing returns empty or truncated data

### Pitfall 2: XML in Markdown Escaping

**What goes wrong:** Special characters in task content (< > & ") break XML structure
**Why it happens:** Task descriptions contain code or comparisons
**How to avoid:** Escape special characters in user-provided content: `<` -> `&lt;`, `>` -> `&gt;`, `&` -> `&amp;`
**Warning signs:** XML parsing errors when reading generated plans

### Pitfall 3: Git Commit in Dirty State

**What goes wrong:** Commits include unintended changes when staging specific files
**Why it happens:** Other changes exist in working directory
**How to avoid:** Check git status before committing; only stage explicitly listed files
**Warning signs:** Commit includes files not in the expected list

### Pitfall 4: Inconsistent Line Endings

**What goes wrong:** Generated markdown has mixed CRLF/LF line endings
**Why it happens:** Template strings on Windows, or reading files with different endings
**How to avoid:** Normalize to LF before writing: `content.replace(/\r\n/g, '\n')`
**Warning signs:** Git shows entire file as changed, diff tools show invisible changes

### Pitfall 5: Missing Frontmatter Fields

**What goes wrong:** Generated PLAN.md missing required fields causes execution failures
**Why it happens:** Generator doesn't validate all required fields are present
**How to avoid:** Use Zod schema validation before generating; ensure PlanFrontmatter is complete
**Warning signs:** Plan execution fails with "undefined" errors for frontmatter fields

## Code Examples

Verified patterns from GSD reference implementation:

### PROJECT.md Generator

```typescript
// Source: references/get-shit-done/get-shit-done/templates/project.md
interface ProjectConfig {
  name: string;
  description: string;
  coreValue: string;
  activeRequirements: string[];
  outOfScope: Array<{ item: string; reason: string }>;
  context: string;
  constraints: Array<{ type: string; what: string; why: string }>;
}

export function generateProjectMd(config: ProjectConfig): string {
  const outOfScopeItems = config.outOfScope
    .map(({ item, reason }) => `- ${item} - ${reason}`)
    .join('\n');

  const constraintItems = config.constraints
    .map(({ type, what, why }) => `- **${type}**: ${what} - ${why}`)
    .join('\n');

  return `# ${config.name}

## What This Is

${config.description}

## Core Value

${config.coreValue}

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet - ship to validate)

### Active

<!-- Current scope. Building toward these. -->

${config.activeRequirements.map(r => `- [ ] ${r}`).join('\n')}

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

${outOfScopeItems || '(None defined)'}

## Context

${config.context}

## Constraints

${constraintItems || '(None defined)'}

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|

---
*Last updated: ${new Date().toISOString().split('T')[0]} after initialization*
`;
}
```

### PLAN.md Frontmatter Schema

```typescript
// Source: references/get-shit-done/get-shit-done/templates/phase-prompt.md
import { z } from 'zod';

const ArtifactSchema = z.object({
  path: z.string(),
  provides: z.string(),
  contains: z.string().optional(),
  exports: z.array(z.string()).optional(),
  min_lines: z.number().optional(),
});

const KeyLinkSchema = z.object({
  from: z.string(),
  to: z.string(),
  via: z.string(),
  pattern: z.string().optional(),
});

const MustHavesSchema = z.object({
  truths: z.array(z.string()),
  artifacts: z.array(ArtifactSchema),
  key_links: z.array(KeyLinkSchema).optional(),
});

export const PlanFrontmatterSchema = z.object({
  phase: z.string(),
  plan: z.number(),
  type: z.enum(['execute', 'tdd']),
  wave: z.number(),
  depends_on: z.array(z.string()),
  files_modified: z.array(z.string()),
  autonomous: z.boolean(),
  user_setup: z.array(z.unknown()).optional(),
  must_haves: MustHavesSchema,
});

export type ValidatedPlanFrontmatter = z.infer<typeof PlanFrontmatterSchema>;
```

### Atomic Commit Implementation

```typescript
// Source: references/get-shit-done/get-shit-done/references/git-integration.md
import simpleGit, { SimpleGit } from 'simple-git';

export interface TaskCommitInput {
  type: 'feat' | 'fix' | 'test' | 'refactor' | 'perf' | 'chore' | 'docs' | 'style';
  phase: string;
  plan: string;
  description: string;
  bulletPoints: string[];
  files: string[];
}

export interface CommitResult {
  success: boolean;
  hash?: string;
  error?: string;
}

export async function commitTaskAtomically(input: TaskCommitInput): Promise<CommitResult> {
  const git: SimpleGit = simpleGit();

  try {
    // Verify files exist and are modified
    const status = await git.status();
    const allChanges = [...status.modified, ...status.not_added, ...status.created];

    const missingFiles = input.files.filter(f => !allChanges.includes(f));
    if (missingFiles.length > 0) {
      return {
        success: false,
        error: `Files not found in git status: ${missingFiles.join(', ')}`
      };
    }

    // Stage only specified files (NEVER use git add .)
    for (const file of input.files) {
      await git.add(file);
    }

    // Build commit message
    const header = `${input.type}(${input.phase}-${input.plan}): ${input.description}`;
    const body = input.bulletPoints.map(bp => `- ${bp}`).join('\n');
    const message = `${header}\n\n${body}`;

    // Commit
    const result = await git.commit(message);

    return {
      success: true,
      hash: result.commit
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Plain string templates | TypeScript template functions with typed inputs | Standard practice | Type safety, testability |
| Manual YAML parsing | gray-matter library | Standard practice | Reliable frontmatter handling |
| exec git commands | simple-git library | Standard practice | Cross-platform, typed API |
| Inline document generation | Separated generators + validators | GSD pattern | Maintainability |

**Deprecated/outdated:**
- Manual `---` delimiter handling: Use gray-matter instead
- child_process for git: Use simple-git for type safety

## Open Questions

Things that couldn't be fully resolved:

1. **Planner Agent Prompt Format**
   - What we know: GSD uses markdown with XML sections for structured prompts
   - What's unclear: Whether to store prompts as .md files or TypeScript string constants
   - Recommendation: Store as TypeScript for type checking; can generate .md if needed for human review

2. **XML Validation Strictness**
   - What we know: Task XML uses custom tags not valid HTML/XML
   - What's unclear: Whether to validate XML structure or trust string generation
   - Recommendation: Trust typed generators; add validation only if parsing becomes needed

## Sources

### Primary (HIGH confidence)

- `references/get-shit-done/get-shit-done/templates/project.md` - PROJECT.md template structure
- `references/get-shit-done/get-shit-done/templates/roadmap.md` - ROADMAP.md template structure
- `references/get-shit-done/get-shit-done/templates/phase-prompt.md` - PLAN.md template structure
- `references/get-shit-done/get-shit-done/references/git-integration.md` - Atomic commit patterns
- `references/get-shit-done/agents/gsd-planner.md` - Planner agent prompt structure
- `src/types.ts` - Existing type definitions from Phase 1

### Secondary (MEDIUM confidence)

- gray-matter npm documentation - Frontmatter parsing API
- simple-git npm documentation - Git operations API

### Tertiary (LOW confidence)

- None - all patterns verified against reference implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using established libraries and patterns from Phase 1
- Architecture: HIGH - Following GSD reference patterns directly
- Pitfalls: HIGH - Documented from GSD implementation experience

**Research date:** 2026-01-26
**Valid until:** 30 days (stable domain, templates change slowly)
