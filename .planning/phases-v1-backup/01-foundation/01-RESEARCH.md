# Phase 1: Foundation - Research

**Researched:** 2026-01-26
**Domain:** Claude Code Skill System - Document-Driven Workflow
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundational document hierarchy and state management for Ultra Planner. This is NOT a traditional software project - it is a **Claude Code skill system** implemented as structured Markdown documents, YAML frontmatter, and XML task structures. There is no JavaScript/TypeScript runtime code to write; the "code" is the prompt architecture itself.

The research confirms that Ultra Planner should follow the established patterns from GSD (Get-Shit-Done) and align with Claude Code's native skill system. The standard approach uses:
- `.ultraplan/` directory for state and config (mirroring GSD's `.planning/`)
- Markdown documents with YAML frontmatter for metadata
- XML tags for task structure within PLAN.md files
- JSON for configuration files (machine-readable, no parse ambiguity)
- STATE.md for progress tracking (human-readable, git-diffable)

**Primary recommendation:** Implement Phase 1 as pure Markdown/YAML/JSON files following GSD's proven document hierarchy patterns, adapted for the `.ultraplan/` namespace.

## Standard Stack

This is a declarative skill system, not a runtime application. The "stack" is the prompt architecture.

### Core

| Component | Format | Purpose | Why Standard |
|-----------|--------|---------|--------------|
| SKILL.md | Markdown + YAML frontmatter | Skill entry point | Claude Code native format |
| Agent definitions | `.claude/agents/*.md` | Subagent prompts | Claude Code subagent pattern |
| Document templates | Markdown + YAML + XML | PROJECT/ROADMAP/PLAN/STATE | GSD proven patterns |
| Config files | JSON | Machine-readable settings | No parse ambiguity, tooling support |
| State tracking | Markdown | Human-readable progress | Git-diffable, session-resumable |

### Directory Structure

| Location | Purpose | When Used |
|----------|---------|-----------|
| `.claude/skills/ultraplan/` | Main skill entry point | User invokes `/ultraplan:*` |
| `.claude/agents/ultraplan-*.md` | Agent definitions | Subagent spawning |
| `.claude/commands/ultraplan-*.md` | Slash command shortcuts | Quick actions |
| `.ultraplan/` | Project-specific state | Per-project runtime |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSON config | YAML config | YAML is more human-readable but has parse edge cases; JSON is safer for machine reading |
| STATE.md | state.json | Markdown is git-diffable and human-editable; JSON requires tooling to read |
| XML task tags | Markdown structure | XML provides explicit boundaries; Markdown headers can be ambiguous |
| `.ultraplan/` | `.planning/` | `.ultraplan/` distinguishes from GSD; allows coexistence |

## Architecture Patterns

### Recommended Directory Structure

```
.ultraplan/                        # Runtime state (per-project)
├── config.json                    # Project configuration
├── state/                         # Execution state
│   └── session.json               # Active session state
└── logs/                          # Execution logs (optional)

.claude/
├── skills/
│   └── ultraplan/
│       ├── SKILL.md               # Main entry point
│       ├── references/
│       │   ├── checkpoints.md     # Checkpoint patterns
│       │   └── patterns.md        # Common patterns
│       └── templates/
│           ├── project.md         # PROJECT.md template
│           ├── roadmap.md         # ROADMAP.md template
│           ├── plan.md            # PLAN.md template
│           └── state.md           # STATE.md template
├── agents/
│   ├── ultraplan-planner.md       # Planner agent
│   ├── ultraplan-executor.md      # Executor agent
│   ├── ultraplan-architect.md     # Architect agent
│   └── ultraplan-critic.md        # Critic agent
└── commands/
    ├── new-project.md             # /ultraplan:new-project
    └── status.md                  # /ultraplan:status

PROJECT.md                         # Generated in project root
ROADMAP.md                         # Generated in project root
STATE.md                           # Generated in project root
```

**Source:** [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills), [GSD directory structure](verified in local GSD installation)

### Pattern 1: YAML Frontmatter for Document Metadata

**What:** Machine-readable metadata at the top of Markdown documents between `---` delimiters.

**When to use:** All planning documents (PROJECT.md, ROADMAP.md, PLAN.md, STATE.md).

**Example:**
```yaml
---
phase: 01-foundation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths:
    - "Directory structure exists"
  artifacts:
    - path: ".ultraplan/config.json"
      provides: "Project configuration"
---
```

**Source:** [YAML Frontmatter Documentation](https://jekyllrb.com/docs/front-matter/), GSD PLAN.md templates

### Pattern 2: XML Task Structure

**What:** Task definitions using XML tags for explicit boundaries.

**When to use:** PLAN.md task sections.

**Why XML:** Claude is trained on XML-structured prompts. XML tags prevent confusion between instructions, context, and examples. Enables reliable parsing for state tracking.

**Example:**
```xml
<tasks>

<task type="auto">
  <name>Task 1: Create directory structure</name>
  <files>.ultraplan/config.json</files>
  <action>
    Create .ultraplan/ directory with config.json containing default settings.
    Use JSON format for machine readability.
  </action>
  <verify>ls -la .ultraplan/ && cat .ultraplan/config.json | jq .</verify>
  <done>.ultraplan/config.json exists with valid JSON</done>
</task>

</tasks>
```

**Source:** [Anthropic Prompt Engineering - XML Tags](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/use-xml-tags)

### Pattern 3: Progressive Disclosure

**What:** Load information in stages as needed, not upfront.

**When to use:** Skill organization, document references.

**Example:**
```markdown
# SKILL.md (always loaded - minimal)

## Quick Reference
Basic commands...

## Advanced Features
See [references/advanced.md](references/advanced.md)

## Templates
See [templates/](templates/) directory
```

**Source:** [Claude Skills Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)

### Pattern 4: STATE.md Progress Tracking

**What:** Human-readable state file with visual progress indicators.

**When to use:** Always maintain in project root.

**Example:**
```markdown
# Project State

## Current Position

Phase: 1 of 7 (Foundation)
Plan: 01 of 05
Status: In progress
Last activity: 2026-01-26 - Created directory structure

Progress: [██░░░░░░░░░░░░░░░░░░] 10%

## Session Continuity

Last session: 2026-01-26 14:30
Stopped at: Task 2 of 01-01-PLAN.md
Resume file: .ultraplan/state/continue.md
```

**Source:** GSD STATE.md template (verified in `/home/ubuntu/.claude/get-shit-done/templates/state.md`)

### Anti-Patterns to Avoid

- **Building a "framework":** Don't create TypeScript/Python code that generates prompts. SKILL.md IS the code.
- **Complex state machines:** Let Claude handle transitions naturally through document presence (PLAN.md exists = planned, SUMMARY.md exists = completed).
- **Monolithic agent prompts:** Keep each agent focused on one responsibility. Use progressive disclosure for reference material.
- **Time-sensitive instructions:** Don't include dates or versions that will become stale.

## Don't Hand-Roll

Problems that look simple but should use established patterns:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Progress visualization | Custom ASCII art logic | Standard progress bar format | GSD has proven format that works across sessions |
| Config parsing | Custom parser | JSON with standard format | JSON has no parse ambiguity, jq for validation |
| Task dependencies | DAG scheduler | Wave-based grouping | Wave system is simpler, sufficient for 5-worker limit |
| State persistence | Custom file format | Markdown + JSON split | Markdown for human, JSON for machine |
| Frontmatter validation | Custom validator | YAML parser + schema | Standard YAML parsers handle edge cases |

**Key insight:** This is a prompt engineering project. The value is in the prompt quality, not tooling. Use the simplest file formats that work.

## Common Pitfalls

### Pitfall 1: Treating This Like a Code Project

**What goes wrong:** Developer instinct to write TypeScript/Python code for "the system." Creates build steps, adds complexity, fights Claude Code's native model.

**Why it happens:** Traditional software development habits.

**How to avoid:** Remember: SKILL.md files ARE the code. The prompts are the implementation. No build step, no dependencies.

**Warning signs:** Wanting to "generate" prompts, creating npm packages, adding tsconfig.json.

### Pitfall 2: Configuration File Sprawl

**What goes wrong:** Config lives in multiple places (.ultraplan/, ~/.config/, CLAUDE.md, .env). Users don't know which applies.

**Why it happens:** Adding config options incrementally without central design.

**How to avoid:**
- Single canonical location: `.ultraplan/config.json`
- Clear precedence: project > user > defaults
- One format: JSON for machine-readable config
- Add `--show-config` equivalent via `/ultraplan:status`

**Warning signs:** Multiple config files with overlapping options.

### Pitfall 3: State/Document Divergence

**What goes wrong:** STATE.md shows one status, actual directory state shows another. Documents become stale.

**Why it happens:** Manual updates, incomplete automation, crash recovery gaps.

**How to avoid:**
- Treat STATE.md as derived from filesystem state
- Verify against actual files: SUMMARY.md exists = plan complete
- Add staleness indicators with timestamps
- Implement reconciliation on session start

**Warning signs:** Users manually editing STATE.md, "it says done but files don't exist."

### Pitfall 4: XML Parsing Edge Cases

**What goes wrong:** XML tags in code examples get confused with task structure. Nested XML breaks parsing.

**Why it happens:** XML is used both for structure AND shown in examples.

**How to avoid:**
- Use code blocks for XML examples within tasks
- Escape or use CDATA for XML content in examples
- Keep task XML structure flat (no deeply nested custom tags)
- Test with code that contains XML

**Warning signs:** Tasks getting truncated, code examples disappearing.

### Pitfall 5: Progress Bar Calculation Errors

**What goes wrong:** Progress shows wrong percentage, visual doesn't match number.

**Why it happens:** Off-by-one errors, inconsistent counting of phases vs plans.

**How to avoid:**
- Clear formula: `progress = completed_plans / total_plans_across_all_phases`
- Standard character count for bar (20 chars)
- Round consistently (Math.floor for pessimistic)
- Include both visual and percentage

**Warning signs:** 100% shown before actually done, progress going backwards.

## Code Examples

### Document Templates

#### PROJECT.md Template
```markdown
# {Project Name}

## What This Is

{One paragraph description}

## Core Value

**{One-liner that captures the essential value proposition}**

## Requirements

### Active

- [ ] **REQ-01**: {Requirement description}
- [ ] **REQ-02**: {Requirement description}

### Out of Scope

- {Explicitly excluded feature} - {Reason}

## Context

{Technical context, constraints, decisions}

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| {Decision} | {Why} | Pending |

---
*Last updated: {date}*
```

#### ROADMAP.md Template
```markdown
# Roadmap: {Project Name}

## Overview

{2-3 sentence summary of the journey}

## Phases

- [ ] **Phase 1: {Name}** - {One-line description}
- [ ] **Phase 2: {Name}** - {One-line description}

## Phase Details

### Phase 1: {Name}
**Goal**: {Outcome, not tasks}
**Depends on**: {Prior phases or "Nothing"}
**Requirements**: {REQ-IDs mapped to this phase}
**Success Criteria** (what must be TRUE):
  1. {Observable truth}
  2. {Observable truth}
**Plans**: TBD (estimated N plans)

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. {Name} | 0/N | Not started | - |

---
*Roadmap created: {date}*
```

#### STATE.md Template
```markdown
# Project State

## Current Position

Phase: 1 of N ({Phase Name})
Plan: 0 of M
Status: Ready to plan
Last activity: {date} - Project initialized

Progress: [░░░░░░░░░░░░░░░░░░░░] 0%

## Session Continuity

Last session: {date time}
Stopped at: {Description}
Resume file: None

---
*State tracking initialized: {date}*
```

#### config.json Template
```json
{
  "version": "1.0.0",
  "mode": "interactive",
  "depth": "standard",
  "parallelization": true,
  "max_workers": 5,
  "commit_docs": true,
  "model_profile": "balanced",
  "workflow": {
    "auto_verify": true,
    "auto_commit": true
  }
}
```

### SKILL.md Frontmatter Example
```yaml
---
name: ultraplan-new-project
description: Initialize a new Ultra Planner project with PROJECT.md, ROADMAP.md, and STATE.md. Use when starting a new project or when the user says "new project", "start planning", or "initialize ultraplan".
disable-model-invocation: true
allowed-tools: Read, Write, Bash, Glob
---
```

**Source:** [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom commands folder | Skills with frontmatter | Claude Code 2025 | Unified skill discovery, frontmatter control |
| Flat document structure | Hierarchical with phases | GSD 2025 | Better organization, parallel execution |
| JSON-only state | Markdown + JSON hybrid | GSD 2025 | Human-readable state, machine-readable config |
| Manual wave assignment | Frontmatter-based waves | GSD 2025 | Pre-computed parallelization |

**Deprecated/outdated:**
- `.claude/commands/` alone: Still works but skills are recommended for new development
- Inline state in documents: Extracted to STATE.md for single source of truth

## Open Questions

1. **Claude Tasks API Integration**
   - What we know: Phase 2.5 will investigate Tasks API feasibility
   - What's unclear: Exact API capabilities, rate limits, sync mechanisms
   - Recommendation: Foundation phase should NOT assume Tasks API details. Design documents to be self-sufficient.

2. **Conflict with Existing .planning/**
   - What we know: GSD uses .planning/, Ultra Planner uses .ultraplan/
   - What's unclear: Can they coexist? Should they?
   - Recommendation: Keep separate namespaces. Document coexistence as supported but not tested.

3. **Skill Invocation Control**
   - What we know: `disable-model-invocation: true` prevents auto-trigger
   - What's unclear: Best pattern for commands that should sometimes auto-trigger
   - Recommendation: Start with explicit invocation only, add auto-detection in Phase 6.

## Sources

### Primary (HIGH confidence)

- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills) - Official skill structure, frontmatter fields, directory organization
- [Claude Skills Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) - Progressive disclosure, context management, size limits
- [Anthropic Prompt Engineering - XML Tags](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/use-xml-tags) - XML for task structure

### Secondary (MEDIUM confidence)

- GSD System (`/home/ubuntu/.claude/agents/gsd-*.md`) - Proven document hierarchy, agent patterns, templates
- GSD Templates (`/home/ubuntu/.claude/get-shit-done/templates/`) - STATE.md, PLAN.md, SUMMARY.md formats
- Project existing research (`.planning/research/STACK.md`, `ARCHITECTURE.md`) - Prior decisions

### Tertiary (LOW confidence)

- [YAML Frontmatter in Markdown](https://jekyllrb.com/docs/front-matter/) - General YAML frontmatter patterns
- [GitHub YAML Frontmatter](https://docs.github.com/en/contributing/writing-for-github-docs/using-yaml-frontmatter) - Validation patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Based on official Claude Code docs and proven GSD patterns
- Architecture: HIGH - Verified against official skills documentation and existing implementations
- Pitfalls: MEDIUM - Based on GSD experience and general best practices research

**Research date:** 2026-01-26
**Valid until:** 2026-02-26 (30 days - stable domain, established patterns)
