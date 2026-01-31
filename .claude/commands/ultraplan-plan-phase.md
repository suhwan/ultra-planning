---
name: ultraplan:plan-phase
description: Generate PLAN.md files for a specific phase by invoking the Planner agent in phase-planning mode
allowed-tools: Read, Write, Glob, Grep, Bash, Task
---

# /ultraplan:plan-phase

Generate PLAN.md files for a specific phase by invoking the Planner agent in PHASE-PLANNING mode. This command breaks a phase from ROADMAP.md into 2-3 executable PLAN.md files with concrete tasks.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│  /ultraplan-plan-phase {N}                                   │
│                                                              │
│  1. RESEARCH — Phase 도메인 리서치                           │
│  2. PLAN — PLAN.md 파일들 생성                               │
│  3. RALPLAN — Architect + Critic 합의까지 검증               │
└─────────────────────────────────────────────────────────────┘
```

## Usage

```
/ultraplan:plan-phase {phase_number} [--skip-research] [--skip-verify]
```

**Examples:**
```
/ultraplan:plan-phase 1                          # Full flow (research + verify)
/ultraplan:plan-phase 02                         # Same, padded phase number
/ultraplan:plan-phase 3 --skip-research          # Skip research step
/ultraplan:plan-phase 3 --skip-verify            # Skip Ralplan verification
/ultraplan:plan-phase 3 --skip-research --skip-verify  # Fastest (plan only)
```

**Flags:**
- `--skip-research` — Skip the research phase (faster, less informed)
- `--skip-verify` — Skip the Ralplan consensus loop (faster, less thorough)

## Behavior

### Step 1: Validate Prerequisites

Check that all requirements are met before planning:

```bash
# Check ROADMAP.md exists
test -f .planning/ROADMAP.md || echo "ERROR: ROADMAP.md not found. Run /ultraplan:new-project first."

# Check PROJECT.md exists
test -f .planning/PROJECT.md || echo "ERROR: PROJECT.md not found. Run /ultraplan:new-project first."

# Validate phase number exists in ROADMAP.md
grep -q "Phase ${phase_number}:" .planning/ROADMAP.md || echo "ERROR: Phase ${phase_number} not found in ROADMAP.md"
```

**Prerequisite Decision Matrix:**

| Condition | Action |
|-----------|--------|
| ROADMAP.md missing | Stop with error: "Run /ultraplan:new-project first" |
| PROJECT.md missing | Stop with error: "Run /ultraplan:new-project first" |
| Phase number not in ROADMAP.md | Stop with error: "Phase X not found in ROADMAP.md" |
| Prior phases not planned | **Auto-proceed:** Warn but continue (unattended mode) |
| All prerequisites met | Proceed to Step 2 |

### Step 2: Research Phase

**Skip if `--skip-research` flag is set OR if RESEARCH.md already exists.**

```bash
# Check for existing research
ls "${PHASE_DIR}"/*-RESEARCH.md 2>/dev/null
```

**If RESEARCH.md exists:** Display "Using existing research" and skip to Step 3.

**If RESEARCH.md missing:**

**Uses GSD Phase Researcher for comprehensive phase research with Context7 support.**

```javascript
Task(
  subagent_type="gsd-phase-researcher",
  model="opus",
  prompt="""
## Phase
Phase ${phase_number}: ${PHASE_GOAL}

## Phase Context from ROADMAP.md
${PHASE_DESCRIPTION}

## Success Criteria
${SUCCESS_CRITERIA}

## Instructions
1. Investigate existing codebase for relevant patterns
2. Research technologies/APIs needed for this phase using Context7
3. Apply source hierarchy: Context7 → Official Docs → WebSearch
4. Identify standard stack, patterns, and pitfalls
5. Write RESEARCH.md with sections:
   - Standard Stack (libraries with versions)
   - Architecture Patterns
   - Don't Hand-Roll (existing solutions to use)
   - Common Pitfalls
   - Code Examples
6. Write findings to ${PHASE_DIR}/${phase_number}-RESEARCH.md

## Output
Return RESEARCH COMPLETE or RESEARCH BLOCKED
"""
)
```

**Handle Research Result:**

| Result | Action |
|--------|--------|
| RESEARCH COMPLETE | Proceed to Step 3 |
| RESEARCH BLOCKED | Show blockers, offer: 1) Provide info, 2) Skip research, 3) Abort |

### Step 3: Load Phase Context

Gather all context needed for planning this phase:

```bash
# Read PROJECT.md for requirements and constraints
cat .planning/PROJECT.md

# Read ROADMAP.md for phase definition
cat .planning/ROADMAP.md

# Read STATE.md for current progress
cat .planning/STATE.md

# Find phase directory with zero-padded or unpadded names
PADDED_PHASE=$(printf "%02d" ${phase_number})
PHASE_DIR=$(ls -d .planning/phases/${PADDED_PHASE}-* .planning/phases/${phase_number}-* 2>/dev/null | head -1)

# Check for existing PLAN.md files in this phase
ls -la ${PHASE_DIR}/*.md 2>/dev/null
```

**Context Assembly:**

| Information | Source | Use |
|-------------|--------|-----|
| Phase goal | ROADMAP.md `Phase X: Goal` section | Derive must_haves and tasks |
| Success criteria | ROADMAP.md `Phase X: Success Criteria` | Validate plan completeness |
| Requirements | PROJECT.md `Requirements` section | Map to tasks |
| Dependencies | ROADMAP.md `Phase X: Depends on` | Check prerequisite phases |
| Existing plans | `.ultraplan/plans/` directory | Avoid duplicate work |

### Step 4: Spawn Planner Agent

Invoke the ultraplan-planner agent in PHASE-PLANNING mode:

```bash
# Extract phase information
PHASE_GOAL=$(sed -n "/^### Phase ${phase_number}:/,/^### Phase/p" .planning/ROADMAP.md | \
  grep "^**Goal**:" | sed 's/^**Goal**: //')

# Extract success criteria
SUCCESS=$(sed -n "/^### Phase ${phase_number}:/,/^### Phase/p" .planning/ROADMAP.md | \
  sed -n '/^**Success Criteria/,/^**Plans/p' | head -n -1)

# Extract dependencies
DEPENDS=$(sed -n "/^### Phase ${phase_number}:/,/^### Phase/p" .planning/ROADMAP.md | \
  grep "^**Depends on**:" | sed 's/^**Depends on**: //')

# Read PROJECT.md context
PROJECT_CONTEXT=$(cat .planning/PROJECT.md)
```

**Uses GSD Planner for logical context-based task division.**

```javascript
Task(
  subagent_type="gsd-planner",
  model="opus",
  prompt="""
You are planning Phase ${phase_number}: ${PHASE_GOAL}

## Mode
PHASE-PLANNING (not NEW-PROJECT)

This is phase-level planning. Generate 2-3 PLAN.md files for this phase.

## Phase Definition
**Goal:** ${PHASE_GOAL}
**Depends on:** ${DEPENDS}

## Success Criteria
${SUCCESS}

## Context from PROJECT.md
${PROJECT_CONTEXT}

## Research Findings (if available)
${RESEARCH_CONTENT}

## Output Location
Write PLAN.md files to: ${PHASE_DIR}/
Naming: ${phase_number}-01-PLAN.md, ${phase_number}-02-PLAN.md, etc.

## Instructions

1. **Break Phase into 2-3 Task Groups (PLAN.md files):**
   - Apply logical context-based task grouping
   - Each PLAN.md should represent a cohesive unit of work (30-90 minutes total)
   - Group related tasks together by context (e.g., "Templates", "Agent Logic", "Integration")
   - Name plans descriptively: ${phase_number}-01-{name}.md, ${phase_number}-02-{name}.md

2. **Apply Task Decomposition:**
   - Each task should take 15-60 minutes for an implementer
   - Use imperative language directed at implementer
   - Include specific file paths, not patterns
   - Provide concrete acceptance criteria

3. **Compute Wave Assignments:**
   - Group tasks by dependency level
   - Ensure tasks in same wave have non-overlapping file ownership
   - Use dependency graph (needs/creates) to determine waves

4. **Derive must_haves using Goal-Backward Methodology:**
   - Start with phase goal from ROADMAP.md
   - Work backward: "What must be TRUE for this goal to be achieved?"
   - Derive: truths (observable conditions), artifacts (specific file paths), key_links (critical integrations)

5. **Write PLAN.md files:**
   - Location: ${PHASE_DIR}/${phase_number}-01-{name}.md, ${phase_number}-02-{name}.md, etc.
   - Follow standard PLAN.md structure
   - Use XML task format with name, files, action, verify, done fields

## Output

Generate files:
- ${PHASE_DIR}/${phase_number}-01-{descriptive_name}.md
- ${PHASE_DIR}/${phase_number}-02-{descriptive_name}.md
- ${PHASE_DIR}/${phase_number}-03-{descriptive_name}.md (if needed)

Each PLAN.md must include:
- Frontmatter with phase, plan, type, wave, depends_on, files_modified, autonomous
- Context section explaining purpose
- Tasks organized by waves using <task> XML elements
- must_haves section (truths, artifacts, key_links)
- Verification checklist

## Quality Checklist

Before finalizing:
- [ ] Logical context-based task grouping applied
- [ ] Each task is 15-60 minutes (not too small, not too large)
- [ ] Tasks use imperative language ("Create X", "Implement Y")
- [ ] File paths are specific, not patterns
- [ ] Wave assignments prevent file conflicts
- [ ] must_haves derived from phase goal using goal-backward
- [ ] Verification steps are concrete and testable

Begin planning now.
"""
)
```

**Template Variable Replacement:**

| Variable | Extraction Method | Example |
|----------|-------------------|---------|
| `${phase_number}` | User input | `02` |
| `${PHASE_GOAL}` | sed from ROADMAP.md | "System can generate PROJECT.md, ROADMAP.md, PLAN.md from interview context" |
| `${SUCCESS}` | sed from ROADMAP.md | Multi-line bullet list |
| `${DEPENDS}` | sed from ROADMAP.md | "Phase 01" |
| `${PROJECT_CONTEXT}` | cat PROJECT.md | Full text |
| `${PHASE_DIR}` | ls with pattern matching | `.planning/phases/07-cli-commands` |

**Extraction Commands:**

These are executed in Step 2 before spawning the Planner agent (see Step 3 code block above).

### Step 5: Consensus Loop (Planner → Architect → Critic)

**Ralplan-style verification: Plans must satisfy ALL THREE agents before execution.**

```
┌──────────────────────────────────────────────────────────────┐
│                    CONSENSUS LOOP                            │
│                                                              │
│   ┌─────────┐    ┌───────────┐    ┌────────┐                │
│   │ Planner │───▶│ Architect │───▶│ Critic │                │
│   └─────────┘    └───────────┘    └────────┘                │
│        ▲                               │                     │
│        │         NOT SATISFIED         │                     │
│        └───────────────────────────────┘                     │
│                                                              │
│   Loop until: Architect APPROVED + Critic SATISFIED          │
│   Max iterations: 5                                          │
└──────────────────────────────────────────────────────────────┘
```

**Step 4a: Architect Review**

```javascript
Task(
  subagent_type="ultraplan-architect",
  model="opus",
  prompt="""
You are reviewing PLAN.md files for Phase ${phase_number}.

## Mode
PLAN-REVIEW (verify plans before execution)

## Plans to Review
${PLANS_CONTENT}

## Phase Goal
${PHASE_GOAL}

## Success Criteria
${SUCCESS}

## Review Checklist

### 1. Task Quality
- [ ] Each task is 15-60 minutes
- [ ] Imperative language ("Create X", "Implement Y")
- [ ] Specific file paths, not patterns
- [ ] Concrete, unambiguous action steps

### 2. Wave Assignments
- [ ] No file conflicts in same wave
- [ ] Correct dependencies between waves

### 3. must_haves
- [ ] Derived from phase goal (goal-backward)
- [ ] User-observable truths
- [ ] Specific artifact paths
- [ ] Critical integration key_links

### 4. Completeness
- [ ] All ROADMAP.md success criteria addressed
- [ ] No implementation gaps

## Output

Return:
- `## PLAN REVIEW: APPROVED` — pass to Critic
- `## PLAN REVIEW: ISSUES FOUND` — back to Planner
"""
)
```

**Step 4b: Critic Review (only if Architect APPROVED)**

```javascript
Task(
  subagent_type="ultraplan-critic",
  model="opus",
  prompt="""
You are critiquing PLAN.md files for Phase ${phase_number}.

## Mode
PLAN-CRITIQUE (challenge assumptions, find risks)

## Plans to Critique
${PLANS_CONTENT}

## Architect Assessment
${ARCHITECT_RESULT}

## Your Role
Challenge what Architect might have missed:
- Question assumptions
- Identify risks and edge cases
- Check feasibility of estimates
- Find coverage gaps

## Output

Return:
- `## CRITIC VERDICT: SATISFIED` — consensus reached, proceed to execution
- `## CRITIC VERDICT: NOT SATISFIED` — back to Planner with concerns
"""
)
```

**Step 4c: Planner Revision (if Architect or Critic not satisfied)**

```javascript
Task(
  subagent_type="gsd-planner",
  model="opus",
  prompt="""
## Mode
PLAN-REVISION (address feedback from Architect/Critic)

## Current Plans
${PLANS_CONTENT}

## Feedback to Address

### From Architect:
${ARCHITECT_ISSUES}

### From Critic:
${CRITIC_CONCERNS}

## Instructions
1. Address each concern listed above
2. Make targeted updates (don't rewrite from scratch)
3. Respond to Critic's questions explicitly
4. Update must_haves if needed
5. Maintain logical context-based task grouping

Return revised PLAN.md files.
"""
)
```

**Consensus Loop Logic:**

```python
iteration = 0
MAX_ITERATIONS = 5

while iteration < MAX_ITERATIONS:
    # Step 4a: Architect reviews
    architect_result = spawn_architect_review()

    if architect_result == "ISSUES FOUND":
        iteration += 1
        spawn_planner_revision(architect_issues)
        continue  # Back to Architect

    # Step 4b: Critic reviews (only if Architect approved)
    critic_result = spawn_critic_review()

    if critic_result == "SATISFIED":
        # CONSENSUS REACHED!
        proceed_to_step_5()
        break

    if critic_result == "NOT SATISFIED":
        iteration += 1
        spawn_planner_revision(critic_concerns)
        continue  # Back to Architect → Critic

# Max iterations reached
if iteration >= MAX_ITERATIONS:
    display_remaining_issues()
    ask_user: "Force proceed or manual fix?"
```

**Consensus States:**

| Architect | Critic | Result |
|-----------|--------|--------|
| APPROVED | SATISFIED | ✅ Consensus! Proceed to Step 5 |
| APPROVED | NOT SATISFIED | ↩️ Back to Planner |
| ISSUES FOUND | (not called) | ↩️ Back to Planner |

### Step 6: Display Summary

After consensus reached (Architect APPROVED + Critic SATISFIED), show summary:

```markdown
Planning complete for Phase {phase_number}: {phase_name}

Generated PLAN.md files:
- ${PHASE_DIR}/{phase_number}-01-{name}.md ({N} tasks, {M} waves)
- ${PHASE_DIR}/{phase_number}-02-{name}.md ({N} tasks, {M} waves)
- ${PHASE_DIR}/{phase_number}-03-{name}.md ({N} tasks, {M} waves)

Total tasks: {total}
Estimated time: {estimate} (based on 15-60 min per task)

## After Plan Generation

Tasks from generated PLAN.md files are registered in Claude Tasks API
for execution tracking. Use `/ultraplan:execute {plan}` to begin execution.

Next: Execute plans sequentially or use /ultraplan:status to see progress.
```

**Summary Data Collection:**

```bash
# Count tasks per plan
TASK_COUNT=$(grep -c "<task type=" .ultraplan/plans/${phase_number}-*.md)

# Count waves per plan
WAVE_COUNT=$(grep -c "### Wave" .ultraplan/plans/${phase_number}-*.md)

# Estimate time (30 min average per task)
ESTIMATE=$((TASK_COUNT * 30))
```

## Error Handling

| Error Condition | Detection Method | Recovery Action |
|----------------|------------------|-----------------|
| ROADMAP.md missing | `test -f .ultraplan/ROADMAP.md` fails | Display error: "Run /ultraplan:new-project first to initialize project planning." Stop. |
| PROJECT.md missing | `test -f .ultraplan/PROJECT.md` fails | Display error: "Run /ultraplan:new-project first to initialize project planning." Stop. |
| Invalid phase number | `grep -q "Phase ${phase_number}:" .planning/ROADMAP.md` fails | Display error: "Phase {N} not found in ROADMAP.md. Available phases: {list}". Stop. |
| Phase already planned | `ls ${PHASE_DIR}/${phase_number}-*.md` returns files | **Auto-proceed:** Backup existing plans to `${PHASE_DIR}/backup/` and overwrite. No user confirmation needed. |
| Planner spawn failure | Task tool returns error | Display error message with details. Suggest checking agent definition exists at `.claude/agents/ultraplan-planner.md`. |
| Planner generates zero plans | No files written to `.ultraplan/plans/` | Display error: "Planner failed to generate plans. Check phase definition in ROADMAP.md is complete." Stop. |
| Permission denied writing files | Write operation fails | Display error: "No write permission in .ultraplan/plans/ directory. Check file permissions." Stop. |

**Pre-flight Permission Check:**

```bash
# Test write permission
touch ${PHASE_DIR}/.test-write && rm ${PHASE_DIR}/.test-write || {
  echo "ERROR: No write permission in ${PHASE_DIR}/"
  exit 1
}
```

## Next Steps After Completion

After successful plan generation:

1. **Review Generated Plans:**
   - Read each PLAN.md file to verify tasks are clear and actionable
   - Check that wave assignments make sense (dependencies satisfied)
   - Verify must_haves are derived from phase goal

2. **Execute Plans Sequentially:**
   - Start with {phase_number}-01.md
   - Complete all tasks before moving to {phase_number}-02.md
   - Use /ultraplan:status to track progress

3. **Update STATE.md:**
   - STATE.md automatically updates as plans complete
   - Check "Current Position" section for progress

4. **Validate Phase Completion:**
   - After all plans in phase complete, verify success criteria from ROADMAP.md
   - Run verification commands from PLAN.md files
   - Check must_haves truths are observable

## Examples

**Plan Phase 7 (CLI Commands):**
```
/ultraplan:plan-phase 7
```

Output:
```
Planning complete for Phase 7: CLI/슬래시 커맨드

Generated PLAN.md files:
- .planning/phases/07-cli-commands/07-01-PLAN.md (3 tasks, 2 waves)
- .planning/phases/07-cli-commands/07-02-PLAN.md (2 tasks, 1 wave)
- .planning/phases/07-cli-commands/07-03-PLAN.md (4 tasks, 3 waves)

Total tasks: 9
Estimated time: 4.5 hours (based on 30 min average per task)

## After Plan Generation

Tasks from generated PLAN.md files are registered in Claude Tasks API
for execution tracking. Use `/ultraplan:execute {plan}` to begin execution.

Next: Execute plans sequentially or use /ultraplan:status to see progress.
```

**Plan Phase 8 with Prior Phase Check:**
```
/ultraplan:plan-phase 8
```

Note (if Phase 7 not complete):
```
NOTE: Phase 7 (CLI/슬래시 커맨드) is not marked complete in ROADMAP.md.
Planning Phase 8 anyway. Assuming dependencies are handled.
(Auto-proceeding without confirmation)
```
