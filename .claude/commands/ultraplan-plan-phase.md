---
name: ultraplan:plan-phase
description: Generate PLAN.md files for a specific phase by invoking the Planner agent in phase-planning mode
allowed-tools: Read, Write, Glob, Grep, Bash, Task
---

# /ultraplan:plan-phase

Generate PLAN.md files for a specific phase by invoking the Planner agent in PHASE-PLANNING mode. This command breaks a phase from ROADMAP.md into 2-3 executable PLAN.md files with concrete tasks.

## Usage

```
/ultraplan:plan-phase {phase_number}
```

**Examples:**
```
/ultraplan:plan-phase 1
/ultraplan:plan-phase 02
/ultraplan:plan-phase 3
```

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

### Step 2: Load Phase Context

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

### Step 3: Spawn Planner Agent

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

```javascript
Task(
  subagent_type="ultraplan-planner",
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

## Output Location
Write PLAN.md files to: ${PHASE_DIR}/
Naming: ${phase_number}-01-PLAN.md, ${phase_number}-02-PLAN.md, etc.

## Instructions

1. **Break Phase into 2-3 Task Groups (PLAN.md files):**
   - Each PLAN.md should represent a cohesive unit of work (30-90 minutes total)
   - Group related tasks together (e.g., "Templates", "Agent Logic", "Integration")
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
   - Follow standard PLAN.md structure (see ultraplan-planner.md)
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

### Step 4: Display Summary

After Planner agent completes, show summary to user:

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
