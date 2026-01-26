# Phase 2: Core Planning - Research

**Researched:** 2026-01-26
**Domain:** Planner Agent Design for Claude Code Skill System
**Confidence:** HIGH

## Summary

Phase 2 implements the Planner agent that generates PROJECT.md, ROADMAP.md, and PLAN.md documents from user input. This is NOT a code project - the Planner agent is a prompt-based system implemented as a Markdown file (`.claude/agents/ultraplan-planner.md`) that orchestrates document generation through an interview-style workflow.

Research confirms that the standard approach for planning agents combines:
- Interview-style requirements gathering (single question at a time, preference-focused)
- Context-aware questioning (use explore agents for codebase facts, ask users only about preferences)
- Goal-backward methodology for deriving must-haves from outcomes
- Template-driven document generation using Phase 1 templates
- Explicit phase transitions (interview -> analysis -> generation -> review)

The Planner agent uses Opus model for complex reasoning about project decomposition and requirement analysis.

**Primary recommendation:** Implement the Planner agent following the oh-my-claudecode planner pattern, adapted for Ultra Planner's document hierarchy (PROJECT -> ROADMAP -> PLAN).

## Standard Stack

This is a prompt engineering project. The "stack" is the agent architecture.

### Core

| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| Planner Agent | `.claude/agents/ultraplan-planner.md` | Main planning prompt | Claude Code subagent pattern |
| PROJECT.md Template | `.claude/skills/ultraplan/templates/project.md` | Project definition generation | Phase 1 artifact |
| ROADMAP.md Template | `.claude/skills/ultraplan/templates/roadmap.md` | Phase decomposition generation | Phase 1 artifact |
| PLAN.md Template | `.claude/skills/ultraplan/templates/plan.md` | Task breakdown generation | Phase 1 artifact |
| STATE.md Template | `.claude/skills/ultraplan/templates/state.md` | Progress tracking | Phase 1 artifact |

### Supporting

| Component | Location | Purpose | When to Use |
|-----------|----------|---------|-------------|
| Schema Reference | `.claude/skills/ultraplan/references/schemas.md` | YAML/XML validation | During document generation |
| State Protocol | `.claude/skills/ultraplan/references/state-protocol.md` | State update rules | After document changes |
| Config | `.ultraplan/config.json` | Runtime settings | Mode, depth preferences |

### Model Selection

| Role | Model | Why |
|------|-------|-----|
| Planner | Opus | Complex reasoning for project decomposition, requirement analysis |
| Document Writer | Opus | Strategic decisions about phase structure |
| User Interview | Opus | Nuanced understanding of user intent |

**Source:** oh-my-claudecode agent tier patterns, GSD gsd-planner.md agent

## Architecture Patterns

### Recommended Agent Structure

```
.claude/
├── agents/
│   └── ultraplan-planner.md    # Main planner agent
├── skills/
│   └── ultraplan/
│       ├── SKILL.md            # Entry point with commands
│       ├── templates/          # Phase 1 templates
│       └── references/         # Schemas and protocols
└── commands/
    └── ultraplan-new-project.md  # Invokes planner
```

### Pattern 1: Interview-First Workflow

**What:** Gather requirements through structured questioning before generating documents.

**When to use:** Always for initial project setup; can be skipped for detailed requests.

**Example workflow:**
```
1. User runs /ultraplan:new-project
2. Planner classifies request (trivial/refactor/build/mid-sized)
3. Planner asks single preference questions (NOT codebase facts)
4. User provides answers
5. Planner generates documents
6. User reviews and approves
```

**Source:** oh-my-claudecode planner.md, GSD gsd-planner.md

### Pattern 2: Single Question Protocol

**What:** Ask ONE question at a time, wait for response, then ask next question informed by answer.

**When to use:** All interview interactions.

**Why:** Multiple questions get partial answers. Single questions get thoughtful responses.

**Example:**
```markdown
BAD:
"What's the scope? And the timeline? What's your priority?"

GOOD:
Q1: "What's the main goal for this project?"
[Wait for answer]
Q2: "Based on [goal], what's your timeline?"
[Wait for answer]
Q3: "Given [goal] and [timeline], what's your priority - speed or quality?"
```

**Source:** oh-my-claudecode planner.md (MANDATORY: Single Question at a Time section)

### Pattern 3: Question Type Classification

**What:** Classify questions to determine if they should be asked to user or gathered from codebase.

| Question Type | Ask User? | Example |
|---------------|-----------|---------|
| Codebase fact | NO - use explore | "What patterns exist?" |
| Preference | YES | "Speed vs quality priority?" |
| Requirement | YES | "What's the deadline?" |
| Scope | YES | "Should this include feature X?" |
| Constraint | YES | "Any performance requirements?" |
| Risk tolerance | YES | "How much refactoring acceptable?" |

**When to use:** Before asking ANY question.

**Source:** oh-my-claudecode planner.md (Context-Aware Interview Mode section)

### Pattern 4: Goal-Backward Document Generation

**What:** Derive requirements from outcomes, not tasks.

**When to use:** When generating must_haves and success criteria.

**Process:**
1. State the goal (outcome, not task)
2. Ask: "What must be TRUE for this goal to be achieved?"
3. List observable truths (3-7)
4. For each truth: "What must EXIST?"
5. For each artifact: "What must be CONNECTED?"

**Example:**
```
Goal: "Working chat interface"

Truths:
- User can see existing messages
- User can send a message
- Messages persist across refresh

Artifacts:
- src/components/Chat.tsx (message list rendering)
- src/app/api/chat/route.ts (message CRUD)
- Message type definition

Key Links:
- Chat.tsx -> /api/chat via fetch
- API route -> database via prisma
```

**Source:** GSD gsd-planner.md (goal_backward section)

### Pattern 5: Phase Decomposition Logic

**What:** Break project into phases with clear dependencies and success criteria.

**When to use:** When generating ROADMAP.md.

**Rules:**
1. Each phase has a single clear GOAL (outcome, not tasks)
2. Dependencies form a directed acyclic graph
3. Critical path identifies key risk points
4. Success criteria are observable truths, not tasks
5. Phases can be inserted (decimal numbering: 2.5 between 2 and 3)

**Source:** Current ROADMAP.md structure, GSD roadmapper patterns

### Anti-Patterns to Avoid

- **Asking codebase facts to users:** Use explore agents, not user questions
- **Multiple questions at once:** Decision fatigue, partial answers
- **Task-shaped goals:** "Build X" instead of "X works for users"
- **Generating documents without review:** User must approve before execution
- **Starting implementation:** Planner ONLY plans, never executes

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phase decomposition | Custom algorithm | Goal-backward methodology | Proven pattern from GSD |
| Task sizing | Intuition | 2-3 tasks max per plan | Context budget rules (50% target) |
| Wave assignment | Manual ordering | Pre-computed from dependencies | Wave system handles parallelism |
| Requirement classification | Free-form | Question type classification | Prevents asking wrong questions |
| Document structure | Custom format | Phase 1 templates | Consistency, validation |

**Key insight:** The Planner agent's value is in the interview quality and strategic decomposition, not in custom document formats.

## Common Pitfalls

### Pitfall 1: Planner Tries to Implement

**What goes wrong:** Planner writes code or executes tasks instead of creating plans.

**Why it happens:** User says "build X" and planner interprets as implementation request.

**How to avoid:**
- Explicit identity constraint: "YOU ARE NOT AN IMPLEMENTER"
- All action verbs interpreted as "create plan for X"
- FORBIDDEN ACTIONS list: writing code, editing source, running implementation
- Only outputs: questions, plans saved to files

**Warning signs:** Planner reading source files to modify them, running npm commands.

**Source:** oh-my-claudecode planner.md (CRITICAL IDENTITY section)

### Pitfall 2: Asking Codebase Facts to Users

**What goes wrong:** Planner asks "Where is auth implemented?" instead of using explore agent.

**Why it happens:** Easier to ask user than spawn subagent.

**How to avoid:**
- Question classification before every question
- If question is about codebase, use explore agent first
- Only ask users about preferences, requirements, scope, constraints

**Warning signs:** User answering questions about file locations, patterns, existing code.

### Pitfall 3: Question Dumping

**What goes wrong:** Planner asks 5 questions at once, user answers 2 partially.

**Why it happens:** Trying to be "efficient" with context.

**How to avoid:**
- MANDATORY: Single question at a time
- Wait for response before next question
- Build next question on previous answer

**Warning signs:** User giving incomplete answers, confusion about which question to answer.

### Pitfall 4: Task-Shaped Goals

**What goes wrong:** Phase goals are tasks ("Build auth") not outcomes ("Users can log in").

**Why it happens:** Thinking forward (what to do) instead of backward (what must be true).

**How to avoid:**
- Goal-backward methodology
- Goals are outcomes from USER perspective
- Success criteria are observable truths
- Test: Can a user verify this by using the product?

**Warning signs:** Goals starting with verbs (build, create, implement) instead of states (works, exists, returns).

### Pitfall 5: Missing Review Step

**What goes wrong:** Planner generates documents and immediately proceeds to execution.

**Why it happens:** Trying to be helpful by continuing automatically.

**How to avoid:**
- Explicit confirmation phase after document generation
- Display plan summary with key deliverables
- Wait for user to say "proceed" or "adjust"
- NEVER spawn executors without explicit confirmation

**Warning signs:** Planner telling user "starting implementation now" without asking.

## Code Examples

### Planner Agent Frontmatter

```yaml
---
name: ultraplan-planner
description: Strategic planning agent that generates PROJECT.md, ROADMAP.md, and PLAN.md through interview-style consultation
model: opus
tools: Read, Write, Glob, Grep, Bash
---
```

### Interview Phase Structure

```markdown
# PHASE 1: INTERVIEW MODE (DEFAULT)

## Step 0: Intent Classification

| Intent | Signal | Interview Focus |
|--------|--------|-----------------|
| **Simple** | Clear feature, 1-2 files | Minimal: Confirm scope |
| **Mid-sized** | Multi-file feature | Boundary: Deliverables, exclusions |
| **Complex** | System-wide change | Discovery: Explore patterns first |
| **New Project** | Greenfield | Full: Requirements, constraints, tech |

## Step 1: Context Gathering

Before asking user questions:
1. Check for existing project context (.ultraplan/, PROJECT.md)
2. If codebase exists, use explore to understand patterns
3. Only ask users about preferences, not facts

## Step 2: Single-Question Interview

For each preference question:
1. Ask ONE question
2. Wait for response
3. Build next question on answer
4. Continue until requirements clear

Question categories:
- Scope: "Should this include X?"
- Priority: "Speed vs quality?"
- Constraint: "Any deadlines?"
- Risk: "How much refactoring acceptable?"
```

### Document Generation Flow

```markdown
# PHASE 2: DOCUMENT GENERATION

Triggered when user says: "make the plan", "create project", "generate documents"

## Step 1: Generate PROJECT.md

Using template from `.claude/skills/ultraplan/templates/project.md`:
1. Fill {project_name} from interview
2. Fill {one_paragraph_description} from stated goals
3. Fill requirements from gathered scope
4. Fill constraints from stated limitations
5. Write to `PROJECT.md` in project root

## Step 2: Generate ROADMAP.md

Using template from `.claude/skills/ultraplan/templates/roadmap.md`:
1. Decompose project into phases using goal-backward
2. Each phase gets: Goal, Dependencies, Requirements, Success Criteria
3. Estimate plans per phase (2-3 tasks each)
4. Write to `ROADMAP.md` in project root

## Step 3: Generate Initial STATE.md

Using template from `.claude/skills/ultraplan/templates/state.md`:
1. Set current phase to 1
2. Set status to "Ready to plan"
3. Initialize progress bar at 0%
4. Write to `STATE.md` in project root
```

### Review and Approval Flow

```markdown
# PHASE 3: REVIEW AND APPROVAL

After documents generated, ALWAYS:

## Display Summary
```
## Project Summary

**PROJECT.md created:** [path]
**ROADMAP.md created:** [path]
**Phases:** [N] phases with [M] estimated plans

**Key Deliverables:**
1. [Phase 1 outcome]
2. [Phase 2 outcome]
...

---

**Does this capture your project correctly?**

Options:
- "proceed" - Start planning Phase 1
- "adjust [X]" - Modify specific aspect
- "restart" - Start over with fresh interview
```

## Wait for Confirmation

NEVER proceed to PLAN.md generation without explicit user approval.
```

### PLAN.md Generation (Per Phase)

```markdown
# PHASE 4: PLAN GENERATION (after review approval)

For each phase, generate PLAN.md files:

## Step 1: Goal-Backward Derivation

From phase goal, derive:
- truths: Observable behaviors (3-7)
- artifacts: Specific files that must exist
- key_links: Critical connections

## Step 2: Task Decomposition

Break into 2-3 tasks maximum:
- Each task: 15-60 minutes Claude execution time
- Specific files, specific actions, specific verification
- Avoid tasks touching same file (conflict prevention)

## Step 3: Wave Assignment

- Wave 1: Tasks with no dependencies
- Wave 2: Tasks depending only on Wave 1
- Wave N: max(dependency waves) + 1

## Step 4: Write PLAN.md

Using template from `.claude/skills/ultraplan/templates/plan.md`:
- Fill YAML frontmatter (phase, plan, wave, depends_on, files_modified)
- Fill must_haves from goal-backward
- Fill XML tasks from decomposition
- Write to `.planning/phases/XX-name/XX-NN-PLAN.md`
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct document generation | Interview-first workflow | OMC/GSD 2025 | Better requirement capture |
| Multiple questions | Single question protocol | OMC 2025 | Better answer quality |
| Ask users everything | Codebase-aware questioning | OMC 2025 | Reduced user burden |
| Task-forward planning | Goal-backward methodology | GSD 2025 | Clearer success criteria |
| Manual review | Structured confirmation | OMC 2025 | Explicit approval gate |

**Current best practices:**
- Interview then generate (not generate then fix)
- Single question at a time with options
- Classify questions (codebase fact vs user preference)
- Goal-backward for must-haves derivation
- Explicit user confirmation before proceeding

## Open Questions

1. **Plan Detail Level for Phase 2**
   - What we know: Phase 2 generates ROADMAP.md with phase outlines
   - What's unclear: Should Phase 2 also generate detailed PLAN.md for each phase?
   - Recommendation: Generate ROADMAP.md with phase summaries; detailed PLAN.md generation happens when user starts each phase (just-in-time planning). This keeps plans fresh and allows for learning from earlier phases.

2. **Multiple Document Generation Order**
   - What we know: PROJECT.md, ROADMAP.md, STATE.md need to be generated
   - What's unclear: Should user review each separately or all at once?
   - Recommendation: Generate all three, present summary, single review point. User can request adjustments to specific documents.

3. **Integration with Claude Tasks (Phase 4)**
   - What we know: Phase 4 will sync PLAN.md with Claude Tasks
   - What's unclear: How this affects Planner agent behavior
   - Recommendation: Phase 2 Planner should not assume Tasks API. Generate standard documents; Phase 4 adds sync layer.

## Sources

### Primary (HIGH confidence)

- oh-my-claudecode planner agent (`~/.claude/plugins/cache/omc/oh-my-claudecode/3.5.8/agents/planner.md`) - Interview workflow, single question protocol, identity constraints
- GSD planner agent (`~/.claude/agents/gsd-planner.md`) - Goal-backward methodology, task breakdown, wave assignment
- Phase 1 templates (local) - Document structure for PROJECT, ROADMAP, PLAN, STATE

### Secondary (MEDIUM confidence)

- oh-my-claudecode plan skill (`~/.claude/plugins/cache/omc/oh-my-claudecode/3.5.8/skills/plan/SKILL.md`) - Planning modes, interview vs direct
- GSD roadmapper patterns (`~/.claude/agents/gsd-roadmapper.md`) - Phase decomposition logic

### Tertiary (LOW confidence)

- General prompt engineering best practices - Question design, progressive disclosure

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Based on proven OMC and GSD patterns
- Architecture: HIGH - Verified against existing planner implementations
- Pitfalls: HIGH - Explicitly documented in OMC planner agent

**Research date:** 2026-01-26
**Valid until:** 2026-02-26 (30 days - stable domain, established patterns)
