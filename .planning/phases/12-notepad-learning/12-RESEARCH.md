# Phase 12: Notepad Learning System - Research

**Researched:** 2026-01-27
**Domain:** Subagent learning accumulation and cross-plan knowledge transfer
**Confidence:** HIGH

## Summary

This phase implements a notepad-based learning system that enables subagents to record discoveries and allows orchestrators to propagate accumulated knowledge across tasks, plans, and phases. The system is based on the proven oh-my-opencode "Wisdom Accumulation" pattern.

The notepad system serves three purposes:
1. **Plan-scoped learning**: Each plan has its own notepad directory for task-level discoveries
2. **Cross-task propagation**: Orchestrator reads notepads before delegation and injects wisdom
3. **Project-level aggregation**: Learnings merge into project-level files for long-term persistence

**Primary recommendation:** Use simple Markdown files with timestamped sections for easy append operations, matching oh-my-opencode's battle-tested pattern. Leverage existing StateManager for JSON-based indexes, and Markdown files for human-readable content.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `fs` | Built-in | File read/write operations | Native, no dependencies |
| Node.js `path` | Built-in | Path manipulation | Native, cross-platform |
| TypeScript | 5.x | Type safety | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `glob` | 11.x | Already in project | Find notepad files |
| Existing StateManager | N/A | Index/registry persistence | Track notepad metadata |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Markdown files | JSON files | Markdown is human-editable, better for debugging |
| Custom parser | YAML frontmatter | Markdown sections simpler, no parsing library needed |
| SQLite | Files | Overkill for append-only learning entries |

**Installation:**
```bash
# No new dependencies needed - uses existing fs, path, glob
```

## Architecture Patterns

### Recommended Project Structure
```
.planning/                         # Note: .planning/ per prior decision
├── notepads/
│   ├── {plan-id}/                 # Plan-scoped notepads
│   │   ├── learnings.md           # Patterns, conventions, successes
│   │   ├── decisions.md           # Architectural choices + rationales
│   │   └── issues.md              # Problems, gotchas, blockers
│   └── _project/                  # Project-level aggregation
│       ├── learnings.md           # Merged from all plans
│       ├── decisions.md           # Architecture decision history
│       ├── patterns.md            # Discovered code patterns
│       └── summary.md             # Auto-generated summary
src/
├── notepad/
│   ├── types.ts                   # NotepadEntry, NotepadCategory, etc.
│   ├── manager.ts                 # NotepadManager class
│   ├── api.ts                     # addLearning, addDecision, addIssue
│   ├── reader.ts                  # Read and parse notepad content
│   ├── injector.ts                # Format wisdom for subagent prompts
│   ├── merger.ts                  # Cross-plan merge to _project/
│   └── index.ts                   # Public exports
```

### Pattern 1: Append-Only Timestamped Sections
**What:** Each entry is a markdown section with ISO timestamp header
**When to use:** All notepad writes
**Example:**
```markdown
## 2026-01-27T14:30:00Z | Task: 03-01

**Discovery:** Zod 3.23 changed how `.transform()` chains - must use `.pipe()` for type inference

**Pattern found:** `src/documents/validation/schemas.ts:45-60` shows correct approach

**Tags:** zod, validation, typescript
```

### Pattern 2: Orchestrator Wisdom Injection
**What:** Read notepad before delegation, format as `<wisdom>` block in prompt
**When to use:** Every `delegate_task()` call from orchestrator
**Example:**
```typescript
// Source: oh-my-opencode/src/agents/atlas.ts:272-280
// Before delegation:
const wisdom = await notepadManager.getWisdomForPlan(planId);
const prompt = `
<wisdom>
${wisdom}
</wisdom>

## 1. TASK
...
`;
```

### Pattern 3: Subagent Write Directive
**What:** Inject notepad write instructions into subagent prompts
**When to use:** Automatically via hook on delegate_task
**Example:**
```typescript
// Source: oh-my-opencode/src/hooks/sisyphus-junior-notepad/constants.ts:3-28
const NOTEPAD_DIRECTIVE = `
<Work_Context>
## Notepad Location (for recording learnings)
NOTEPAD PATH: .planning/notepads/{plan-name}/
- learnings.md: Record patterns, conventions, successful approaches
- issues.md: Record problems, blockers, gotchas encountered
- decisions.md: Record architectural choices and rationales

You SHOULD append findings to notepad files after completing work.
IMPORTANT: Always APPEND to notepad files - never overwrite or use Edit tool.
</Work_Context>
`;
```

### Anti-Patterns to Avoid
- **Overwriting notepad files:** Always APPEND, never overwrite - use bash `>>` or explicit append mode
- **JSON for learning content:** JSON is harder to read/debug than Markdown
- **Parsing markdown structure:** Keep entries simple - timestamp + content, no complex parsing
- **Synchronous file locks:** Use atomic writes for indexes, but notepads can use simple appends

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file writes | Manual write+rename | Existing StateManager pattern | Race conditions, corruption |
| File existence checks | Custom retry logic | fs.existsSync + mkdir -p | Standard approach |
| Timestamp formatting | Manual Date manipulation | `new Date().toISOString()` | Consistent, sortable |
| Path joining | String concatenation | `path.join()` | Cross-platform safety |

**Key insight:** The notepad system is fundamentally simple file operations. The complexity is in the protocol (when to read, when to write, what format), not the implementation.

## Common Pitfalls

### Pitfall 1: Edit Tool Overwrites
**What goes wrong:** Subagent uses Edit tool on notepad, replacing content
**Why it happens:** Edit is the default tool for file modification
**How to avoid:** Explicitly instruct "APPEND only - never use Edit tool"
**Warning signs:** Notepad files getting shorter, missing older entries

### Pitfall 2: Stale Wisdom
**What goes wrong:** Orchestrator reads notepad once at start, misses updates from parallel tasks
**Why it happens:** Caching or early reading
**How to avoid:** Read notepad IMMEDIATELY before each delegation
**Warning signs:** Same mistakes repeated across parallel tasks

### Pitfall 3: Path Confusion
**What goes wrong:** Plan name vs plan ID vs phase mixing
**Why it happens:** Multiple naming schemes coexist
**How to avoid:** Use plan ID consistently (e.g., `03-01-PLAN`)
**Warning signs:** Empty notepads, "file not found" errors

### Pitfall 4: No Merge on Plan Complete
**What goes wrong:** Plan-level learnings never reach _project/
**Why it happens:** Merge step forgotten or skipped
**How to avoid:** Trigger merge in plan completion event handler
**Warning signs:** _project/ files never grow, cross-plan knowledge lost

### Pitfall 5: Wisdom Injection Too Large
**What goes wrong:** Full notepad injected, eating context window
**Why it happens:** Naive "read all, inject all" approach
**How to avoid:** Summarize or select relevant entries, cap at ~500-1000 tokens
**Warning signs:** Context exhaustion warnings, truncated prompts

## Code Examples

Verified patterns from reference implementations:

### Initialize Notepad Structure
```typescript
// Source: Pattern from oh-my-opencode atlas.ts:247-257
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export function initPlanNotepad(planId: string, baseDir: string = '.planning'): void {
  const notepadDir = join(baseDir, 'notepads', planId);

  if (!existsSync(notepadDir)) {
    mkdirSync(notepadDir, { recursive: true });
  }

  // Initialize empty files if they don't exist
  const files = ['learnings.md', 'decisions.md', 'issues.md'];
  for (const file of files) {
    const filePath = join(notepadDir, file);
    if (!existsSync(filePath)) {
      writeFileSync(filePath, `# ${file.replace('.md', '').charAt(0).toUpperCase() + file.slice(1, -3)}\n\n`);
    }
  }
}
```

### Add Learning Entry
```typescript
// Source: Pattern from oh-my-claudecode notepad/index.ts:265-296
import { appendFileSync } from 'fs';
import { join } from 'path';

export interface LearningEntry {
  taskId: string;
  content: string;
  pattern?: string;      // File:lines reference
  tags?: string[];
}

export function addLearning(planId: string, entry: LearningEntry, baseDir: string = '.planning'): boolean {
  const filePath = join(baseDir, 'notepads', planId, 'learnings.md');
  const timestamp = new Date().toISOString();

  const markdown = `
## ${timestamp} | Task: ${entry.taskId}

${entry.content}

${entry.pattern ? `**Pattern found:** \`${entry.pattern}\`\n` : ''}
${entry.tags?.length ? `**Tags:** ${entry.tags.join(', ')}` : ''}

---
`;

  try {
    appendFileSync(filePath, markdown);
    return true;
  } catch {
    return false;
  }
}
```

### Read Wisdom for Injection
```typescript
// Source: Pattern from oh-my-opencode atlas.ts:272-280
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface WisdomSummary {
  learnings: string[];
  decisions: string[];
  issues: string[];
  tokenEstimate: number;
}

export function getWisdomForPlan(planId: string, baseDir: string = '.planning'): WisdomSummary | null {
  const notepadDir = join(baseDir, 'notepads', planId);

  if (!existsSync(notepadDir)) {
    return null;
  }

  const result: WisdomSummary = {
    learnings: [],
    decisions: [],
    issues: [],
    tokenEstimate: 0,
  };

  // Read each file and extract recent entries
  for (const category of ['learnings', 'decisions', 'issues'] as const) {
    const filePath = join(notepadDir, `${category}.md`);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8');
      const entries = extractRecentEntries(content, 5); // Last 5 entries
      result[category] = entries;
      result.tokenEstimate += content.length / 4; // Rough token estimate
    }
  }

  return result;
}

function extractRecentEntries(content: string, limit: number): string[] {
  // Split by ## timestamp headers, take last N
  const sections = content.split(/\n## \d{4}-\d{2}-\d{2}/).filter(s => s.trim());
  return sections.slice(-limit);
}
```

### Format Wisdom for Prompt
```typescript
// Source: Pattern from oh-my-opencode atlas.ts prompt structure
export function formatWisdomForPrompt(wisdom: WisdomSummary | null, maxTokens: number = 1000): string {
  if (!wisdom || wisdom.tokenEstimate === 0) {
    return '';
  }

  // Prioritize: issues > decisions > learnings (most actionable first)
  const sections: string[] = [];

  if (wisdom.issues.length > 0) {
    sections.push(`### Known Issues\n${wisdom.issues.slice(0, 3).join('\n')}`);
  }

  if (wisdom.decisions.length > 0) {
    sections.push(`### Decisions Made\n${wisdom.decisions.slice(0, 3).join('\n')}`);
  }

  if (wisdom.learnings.length > 0) {
    sections.push(`### Learnings\n${wisdom.learnings.slice(0, 3).join('\n')}`);
  }

  const formatted = sections.join('\n\n');

  // Truncate if over token limit (rough estimate)
  if (formatted.length / 4 > maxTokens) {
    return formatted.slice(0, maxTokens * 4) + '\n[...truncated]';
  }

  return formatted;
}
```

### Merge to Project Level
```typescript
// Source: Pattern inspired by oh-my-opencode notepad system
import { readdirSync, readFileSync, appendFileSync } from 'fs';
import { join } from 'path';

export function mergePlanToProject(planId: string, baseDir: string = '.planning'): void {
  const planDir = join(baseDir, 'notepads', planId);
  const projectDir = join(baseDir, 'notepads', '_project');

  // Ensure project dir exists
  mkdirSync(projectDir, { recursive: true });

  // Merge each category
  for (const category of ['learnings', 'decisions', 'issues']) {
    const sourceFile = join(planDir, `${category}.md`);
    const targetFile = join(projectDir, `${category}.md`);

    if (existsSync(sourceFile)) {
      const content = readFileSync(sourceFile, 'utf-8');

      // Add plan header before appending
      const header = `\n\n# From: ${planId}\n\n`;
      appendFileSync(targetFile, header + content);
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No cross-task learning | Notepad wisdom accumulation | oh-my-opencode v1.0 | Prevents repeated mistakes |
| Session-scoped memory | File-based persistence | 2025 | Survives restarts, compaction |
| JSON config files | Markdown for content | Common practice | Human readable/editable |

**Deprecated/outdated:**
- `<remember>` tags: Not reliable across session compaction
- In-memory caching: Lost on restart

## Open Questions

Things that couldn't be fully resolved:

1. **Automatic Summary Generation**
   - What we know: _project/summary.md should auto-generate
   - What's unclear: Frequency (per plan? daily?) and format
   - Recommendation: Generate on merge, simple bullet points

2. **Wisdom Token Budget**
   - What we know: Can't inject entire notepad
   - What's unclear: Optimal size limit per category
   - Recommendation: Start with 1000 tokens total, tune based on experience

3. **Cross-Phase Learning Relevance**
   - What we know: Phase 1 learnings may not apply to Phase 5
   - What's unclear: How to filter relevance
   - Recommendation: Include all _project/ wisdom, let subagent filter

## Sources

### Primary (HIGH confidence)
- `references/oh-my-opencode/src/agents/atlas.ts` - Notepad protocol, wisdom injection pattern
- `references/oh-my-opencode/src/hooks/sisyphus-junior-notepad/constants.ts` - Subagent directive
- `references/oh-my-opencode/src/hooks/atlas/index.ts` - File guard, continuation patterns
- `references/oh-my-opencode/docs/guide/understanding-orchestration-system.md` - Wisdom accumulation docs
- `references/oh-my-claudecode/src/hooks/notepad/index.ts` - Alternative API pattern
- `references/oh-my-claudecode/src/__tests__/notepad.test.ts` - Test patterns

### Secondary (MEDIUM confidence)
- Project structure from ROADMAP.md Phase 12 description (user-defined)
- Prior decision: Use `.planning/` not `.ultraplan/` (07-01)

### Tertiary (LOW confidence)
- Token budget recommendations (based on general practice, not measured)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - uses only Node.js built-ins and existing patterns
- Architecture: HIGH - follows proven oh-my-opencode pattern exactly
- Pitfalls: HIGH - documented from reference implementations
- Token budgets: LOW - needs tuning in practice

**Research date:** 2026-01-27
**Valid until:** 60 days (stable patterns, no external API dependencies)
