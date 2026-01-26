# Technology Stack for CLI Workflow/Planning Tools

**Project:** Ultra Planner
**Researched:** 2026-01-26
**Domain:** CLI workflow orchestration for AI coding assistants
**Overall Confidence:** HIGH (based on Context7, official docs, and verified community patterns)

## Executive Summary

CLI workflow tools for Claude Code operate in a **pure Markdown ecosystem**. The standard stack is not TypeScript or Python code—it is structured Markdown with YAML frontmatter, XML-formatted prompts, and JSON state files. This is a prompt engineering project, not a traditional software engineering project.

**Key insight:** Ultra Planner should be implemented as a **CLAUDE.md skill system with supporting markdown agents**, not as compiled code. The "stack" is the prompt architecture itself.

---

## Recommended Stack

### Core Framework: CLAUDE.md Skill System

| Component | Format | Purpose | Confidence |
|-----------|--------|---------|------------|
| Orchestrator skills | `.claude/skills/*/SKILL.md` | Entry points for workflows (`/ultraplan:new-project`) | HIGH |
| Subagent definitions | `.claude/agents/*.md` | Specialized agents (planner, executor, architect, critic) | HIGH |
| Slash commands | `.claude/commands/*.md` | Quick action entry points | HIGH |
| Planning documents | `.planning/*.md` | PROJECT.md, ROADMAP.md, PLAN.md hierarchy | HIGH |
| State files | `.planning/*.json` | config.json, state tracking | HIGH |

**Why this stack:** Claude Code's native extensibility model. No build step, no dependencies, immediate iteration. This is how GSD, OMC, and official Claude plugins are built.

**Source:** [Claude Code Docs - Sub-agents](https://code.claude.com/docs/en/sub-agents), [Anthropic Engineering Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)

### Document Architecture

| Document | Location | Purpose | Format |
|----------|----------|---------|--------|
| PROJECT.md | `.planning/PROJECT.md` | Single source of truth for project definition | Markdown with sections |
| ROADMAP.md | `.planning/ROADMAP.md` | Phase structure and dependencies | Markdown with phase lists |
| PLAN.md | `.planning/phases/XX-name/XX-NN-PLAN.md` | Executable phase plans | YAML frontmatter + XML tasks |
| STATE.md | `.planning/STATE.md` | Session state and progress | Markdown with structured sections |
| SUMMARY.md | `.planning/phases/XX-name/XX-NN-SUMMARY.md` | Execution results | YAML frontmatter + Markdown |
| config.json | `.planning/config.json` | Planning configuration | JSON |

**Why this structure:** Follows GSD's proven document hierarchy. Each document type serves a specific purpose in the plan-execute-verify cycle.

**Source:** GSD planner/executor agent patterns (verified in `/home/ubuntu/.claude/agents/gsd-*.md`)

### Prompt Architecture: XML + YAML Hybrid

| Element | Use | Format |
|---------|-----|--------|
| Frontmatter | Metadata, dependencies, wave assignments | YAML between `---` delimiters |
| Task structure | Executable instructions | XML tags (`<task>`, `<action>`, `<verify>`, `<done>`) |
| Sections | Document organization | Markdown headers |
| Context references | File inclusion | `@path/to/file.md` notation |

**Example PLAN.md structure:**

```markdown
---
phase: 01-foundation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [src/types.ts, src/config.ts]
autonomous: true
must_haves:
  truths:
    - "Types compile without errors"
  artifacts:
    - path: "src/types.ts"
      provides: "Core type definitions"
---

<objective>
Create foundation types and configuration.
Purpose: Enable type-safe development across all features.
Output: Type definitions, config schema.
</objective>

<context>
@.planning/PROJECT.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create type definitions</name>
  <files>src/types.ts</files>
  <action>Define Project, Phase, Plan, Task interfaces with proper TypeScript types.</action>
  <verify>npx tsc --noEmit</verify>
  <done>Types compile, exports available</done>
</task>

</tasks>
```

**Why XML for tasks:** Claude is trained on XML-structured prompts. XML tags prevent confusion between instructions, context, and examples. Enables easy parsing for state tracking.

**Source:** [Anthropic Prompt Engineering - XML Tags](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/use-xml-tags)

### Subagent System

| Agent | Role | Model Tier | Tools |
|-------|------|------------|-------|
| `ultraplan-planner` | Creates PLAN.md files | Opus (complex reasoning) | Read, Write, Bash, Glob, Grep |
| `ultraplan-executor` | Executes plans atomically | Sonnet (balanced) | Read, Write, Edit, Bash, Glob, Grep |
| `ultraplan-architect` | Verification, architecture decisions | Opus (complex reasoning) | Read, Glob, Grep |
| `ultraplan-critic` | Plan review, gap detection | Opus (complex reasoning) | Read, Glob, Grep |

**Agent definition format:**

```markdown
---
name: ultraplan-executor
description: Executes phase plans with atomic commits, deviation handling, and checkpoint protocols.
tools: Read, Write, Edit, Bash, Glob, Grep
model: sonnet
---

<role>
You are an Ultra Planner executor. You execute PLAN.md files atomically...
</role>

<execution_flow>
...
</execution_flow>
```

**Why this agent set:** Mirrors GSD's proven 4-agent architecture. Planner/Executor separation enables parallel planning while maintaining execution focus.

**Source:** GSD agent system, OMC 32-agent architecture (subset for v1)

### Parallel Execution Pattern

| Pattern | Implementation | Max Workers |
|---------|---------------|-------------|
| Task tool batching | `Task(subagent_type=...)` with parallel prompts | 5-10 concurrent |
| Wave-based execution | Plans grouped by `wave` field, all Wave N plans run in parallel | 5 (Claude Code limit) |
| File ownership | `files_modified` frontmatter prevents conflicts | N/A |

**Execution model:**

```
Wave 1: [plan-01, plan-02] → parallel (no dependencies)
Wave 2: [plan-03] → after Wave 1 (depends_on: [01, 02])
Wave 3: [plan-04, plan-05] → parallel (both depend on 03)
```

**Why waves:** Enables automatic parallelization without complex scheduling. Orchestrator reads wave numbers from frontmatter and batches accordingly.

**Source:** OMC Ultrapilot pattern, GSD dependency graph system

### State Management

| State Type | Location | Format | Purpose |
|------------|----------|--------|---------|
| Planning config | `.planning/config.json` | JSON | Workflow preferences |
| Project state | `.planning/STATE.md` | Markdown | Current position, decisions, todos |
| Session state | `.ultraplan/state/*.json` | JSON | Active workflows, checkpoints |

**STATE.md structure:**

```markdown
# Project State

## Current Position

Phase: 2 of 5 (Authentication)
Plan: 01 of 03
Status: In progress
Last activity: 2026-01-26 - Completed 01-03-PLAN.md

Progress: [████████░░░░░░░░░░░░] 40%

## Accumulated Decisions

| Decision | Made In | Rationale |
|----------|---------|-----------|
| Use jose for JWT | Phase 01 | Edge runtime compatible |

## Session Continuity

Last session: 2026-01-26 14:30
Stopped at: Task 2 of 01-02-PLAN.md
Resume file: .planning/phases/02-auth/01-02-PLAN.md
```

**Why Markdown for state:** Human-readable, git-diffable, no parse errors. JSON only for structured config that agents read programmatically.

**Source:** GSD STATE.md pattern, OMC notepad wisdom system

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Recommended |
|----------|-------------|-------------|---------------------|
| Runtime | Markdown/YAML/XML prompts | TypeScript compiled agents | Adds build step, loses iteration speed, fights Claude Code's native model |
| State format | Markdown + JSON | SQLite | Overkill for file-based workflows, harder to debug |
| Task format | XML tags | JSON schema | XML better for nested task hierarchies, Claude performs better with XML |
| Agent system | Claude Code subagents | External orchestrator | Native integration, no context switching overhead |
| Parallelization | Wave-based batching | Explicit DAG scheduler | Wave system is simpler, sufficient for 5-worker limit |

---

## Anti-Patterns to Avoid

### 1. Building a "Framework"

**What it looks like:** Creating TypeScript/Python code that "generates" prompts or "manages" agents.

**Why it fails:**
- Adds compilation/build step that slows iteration
- Creates indirection between prompt and execution
- Fights Claude Code's native extensibility model
- GSD and OMC are pure Markdown—no build step

**Instead:** Write the prompts directly. SKILL.md files ARE the code.

### 2. Complex State Machines

**What it looks like:** Building explicit state machine logic for workflow transitions.

**Why it fails:**
- Claude handles state transitions naturally through context
- Explicit state machines duplicate what Claude already does
- Hard to debug when state and context diverge

**Instead:** Use document states (PLAN.md exists = planned, SUMMARY.md exists = completed). Let Claude infer transitions from document presence.

### 3. Tight Coupling Between Plans

**What it looks like:** Plans that reference implementation details of other plans, excessive `depends_on` chains.

**Why it fails:**
- Kills parallelization
- Creates fragile sequential chains
- One failure blocks everything

**Instead:** Vertical slices with minimal dependencies. Each plan should be as independent as possible.

### 4. Monolithic Agent Prompts

**What it looks like:** Single huge SKILL.md or agent prompt trying to do everything.

**Why it fails:**
- Context window pressure
- Claude quality degrades past 50% context
- Hard to maintain and iterate

**Instead:** Focused agents (planner, executor, architect, critic). Each does one thing well.

### 5. Human-Action Checkpoints for Automatable Tasks

**What it looks like:** `checkpoint:human-action` for deploying, running tests, creating files.

**Why it fails:**
- Breaks flow
- Creates unnecessary user interruption
- Claude can do these via CLI/API

**Instead:** Automate everything possible. `checkpoint:human-verify` only for things requiring human judgment (visual UI, subjective quality).

---

## Implementation Patterns

### Pattern 1: Fresh Subagent per Phase

```markdown
# In orchestrator skill:

For each plan in wave:
  Task(subagent_type="ultraplan:executor", prompt="Execute @plan-path")
  # Fresh context, no accumulated cruft
```

**Why:** Prevents context accumulation. Each plan gets clean 200K window.

### Pattern 2: Atomic Commits per Task

```bash
# After each task completion:
git add specific-files.ts
git commit -m "feat(01-02): implement user authentication

- Add JWT token generation
- Add password hashing
- Add login endpoint"
```

**Why:** Enables git bisect, clean revert, task-level traceability.

### Pattern 3: Goal-Backward Must-Haves

```yaml
must_haves:
  truths:
    - "User can log in with valid credentials"
    - "Invalid credentials return 401"
  artifacts:
    - path: "src/api/auth/login.ts"
      exports: ["POST"]
  key_links:
    - from: "src/api/auth/login.ts"
      to: "prisma.user"
      pattern: "prisma\\.user\\.findUnique"
```

**Why:** Defines success from user perspective, enables verification to check actual behavior not just file existence.

### Pattern 4: Context Windowing

```markdown
# In PLAN.md context section:

<context>
@.planning/PROJECT.md          # Always needed
@.planning/ROADMAP.md          # Phase context
# Only reference SUMMARY if this plan uses outputs from prior plan:
# @.planning/phases/01-foundation/01-01-SUMMARY.md
</context>
```

**Why:** Minimizes context usage. Only load what's needed for this specific plan.

---

## MCP Integration (Optional v2)

| MCP Server | Purpose | When to Add |
|------------|---------|-------------|
| Context7 | Documentation lookup | If research features needed |
| GitHub | PR/issue integration | If git workflow automation needed |
| Puppeteer | Visual testing | If UI verification needed |

**Note:** v1 should NOT include MCP dependencies. Keep it pure CLAUDE.md/agent system first.

---

## File Structure

```
.claude/
├── skills/
│   └── ultraplan/
│       ├── SKILL.md              # Main entry point
│       ├── references/
│       │   ├── checkpoints.md
│       │   └── patterns.md
│       └── templates/
│           ├── plan.md
│           └── summary.md
├── agents/
│   ├── ultraplan-planner.md
│   ├── ultraplan-executor.md
│   ├── ultraplan-architect.md
│   └── ultraplan-critic.md
├── commands/
│   ├── new-project.md            # /ultraplan:new-project
│   ├── plan-phase.md             # /ultraplan:plan-phase
│   └── execute-phase.md          # /ultraplan:execute-phase
└── CLAUDE.md                     # System integration

.planning/                        # Created per-project
├── PROJECT.md
├── ROADMAP.md
├── STATE.md
├── config.json
└── phases/
    └── 01-foundation/
        ├── 01-01-PLAN.md
        └── 01-01-SUMMARY.md

.ultraplan/                       # Runtime state
└── state/
    └── session.json
```

---

## Verification Checklist

Before implementation, verify:

- [ ] SKILL.md frontmatter schema matches Claude Code expectations
- [ ] Agent markdown format matches subagent documentation
- [ ] XML task format parses correctly in test prompts
- [ ] Wave-based parallelization works with Task tool batching
- [ ] STATE.md format supports session resume

---

## Sources

**Official Documentation:**
- [Claude Code Docs - Create Custom Subagents](https://code.claude.com/docs/en/sub-agents)
- [Claude Code Docs - Common Workflows](https://code.claude.com/docs/en/common-workflows)
- [Anthropic - Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Anthropic - Use XML Tags](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/use-xml-tags)

**Verified Community Patterns:**
- GSD (Get Shit Done) system - `/home/ubuntu/.claude/agents/gsd-*.md`
- OMC (Oh My Claude Code) - `/home/ubuntu/.claude/CLAUDE.md`
- [claude-code-workflows](https://github.com/shinpr/claude-code-workflows) - Spec-driven development patterns
- [claude-code-spec-workflow](https://github.com/Pimzino/claude-code-spec-workflow) - Requirements to implementation flow

**Architecture References:**
- [Microsoft Azure AI Agent Design Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) - Sequential and concurrent orchestration
- [Claude Code Multi-Agent Parallel Coding](https://medium.com/@codecentrevibe/claude-code-multi-agent-parallel-coding-83271c4675fa) - Task tool parallelization
- [Builder.io CLAUDE.md Guide](https://www.builder.io/blog/claude-md-guide) - Document structure patterns
