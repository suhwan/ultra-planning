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
test -f .ultraplan/ROADMAP.md || echo "ERROR: ROADMAP.md not found. Run /ultraplan:new-project first."

# Check PROJECT.md exists
test -f .ultraplan/PROJECT.md || echo "ERROR: PROJECT.md not found. Run /ultraplan:new-project first."

# Validate phase number exists in ROADMAP.md
grep -q "Phase ${phase_number}:" .ultraplan/ROADMAP.md || echo "ERROR: Phase ${phase_number} not found in ROADMAP.md"
```

**Prerequisite Decision Matrix:**

| Condition | Action |
|-----------|--------|
| ROADMAP.md missing | Stop with error: "Run /ultraplan:new-project first" |
| PROJECT.md missing | Stop with error: "Run /ultraplan:new-project first" |
| Phase number not in ROADMAP.md | Stop with error: "Phase X not found in ROADMAP.md" |
| Prior phases not planned | Warn: "Prior phases not planned yet. Consider planning in sequence." Continue anyway. |
| All prerequisites met | Proceed to Step 2 |

### Step 2: Load Phase Context

Gather all context needed for planning this phase:

```bash
# Read PROJECT.md for requirements and constraints
cat .ultraplan/PROJECT.md

# Read ROADMAP.md for phase definition
cat .ultraplan/ROADMAP.md

# Read STATE.md for current progress
cat .ultraplan/STATE.md

# Check for existing PLAN.md files in this phase
ls -la .ultraplan/plans/${phase_number}-*.md 2>/dev/null
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

```javascript
Task(
  subagent_type="ultraplan-planner",
  model="opus",
  prompt="""
You are planning Phase {phase_number}: {phase_name}.

## Mode
PHASE-PLANNING (not NEW-PROJECT)

This is phase-level planning. Generate 2-3 PLAN.md files for this phase.

## Phase Goal
{phase_goal_from_roadmap}

## Success Criteria
{success_criteria_from_roadmap}

## Requirements
{requirements_from_project_md}

## Dependencies
{dependencies_from_roadmap}

## Context from PROJECT.md
{relevant_sections_from_project_md}

## Instructions

1. **Break Phase into 2-3 Task Groups (PLAN.md files):**
   - Each PLAN.md should represent a cohesive unit of work (30-90 minutes total)
   - Group related tasks together (e.g., "Templates", "Agent Logic", "Integration")
   - Name plans descriptively: {phase}-01-templates.md, {phase}-02-agent-logic.md

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
   - Location: .ultraplan/plans/{phase_number}-01-{name}.md, {phase_number}-02-{name}.md, etc.
   - Follow standard PLAN.md structure (see ultraplan-planner.md)
   - Use XML task format with name, files, action, verify, done fields

## Output

Generate files:
- .ultraplan/plans/{phase_number}-01-{descriptive_name}.md
- .ultraplan/plans/{phase_number}-02-{descriptive_name}.md
- .ultraplan/plans/{phase_number}-03-{descriptive_name}.md (if needed)

Each PLAN.md must include:
- Context section explaining purpose
- Tasks organized by waves
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
| `{phase_number}` | User input | `02` |
| `{phase_name}` | Grep from ROADMAP.md | `core-planning` |
| `{phase_goal_from_roadmap}` | Grep `Phase X: Goal` | "System can generate PROJECT.md, ROADMAP.md, PLAN.md from interview context" |
| `{success_criteria_from_roadmap}` | Grep `Phase X: Success Criteria` | Multi-line bullet list |
| `{requirements_from_project_md}` | Grep `Requirements` section | "REQ-01, REQ-02, REQ-03" |
| `{dependencies_from_roadmap}` | Grep `Phase X: Depends on` | "Phase 01" |
| `{relevant_sections_from_project_md}` | Read PROJECT.md | Full text |

**Extraction Commands:**

```bash
# Extract phase name
PHASE_NAME=$(grep -A 1 "^### Phase ${phase_number}:" .ultraplan/ROADMAP.md | tail -1 | sed 's/^**Goal**: //')

# Extract phase goal
PHASE_GOAL=$(grep "^**Goal**:" .ultraplan/ROADMAP.md | grep -A 1 "Phase ${phase_number}:")

# Extract success criteria
SUCCESS_CRITERIA=$(sed -n "/^### Phase ${phase_number}:/,/^### Phase/p" .ultraplan/ROADMAP.md | grep -A 20 "Success Criteria")

# Extract requirements
REQUIREMENTS=$(grep "Requirements: REQ-" .ultraplan/ROADMAP.md | grep "Phase ${phase_number}")
```

### Step 4: Display Summary

After Planner agent completes, show summary to user:

```markdown
Planning complete for Phase {phase_number}: {phase_name}

Generated PLAN.md files:
- .ultraplan/plans/{phase_number}-01-{name}.md ({N} tasks, {M} waves)
- .ultraplan/plans/{phase_number}-02-{name}.md ({N} tasks, {M} waves)
- .ultraplan/plans/{phase_number}-03-{name}.md ({N} tasks, {M} waves)

Total tasks: {total}
Estimated time: {estimate} (based on 15-60 min per task)

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
| Invalid phase number | `grep -q "Phase ${phase_number}:" .ultraplan/ROADMAP.md` fails | Display error: "Phase {N} not found in ROADMAP.md. Available phases: {list}". Stop. |
| Phase already planned | `ls .ultraplan/plans/${phase_number}-*.md` returns files | **Auto-proceed:** Backup existing plans to `.ultraplan/plans/backup/` and overwrite. No user confirmation needed. |
| Planner spawn failure | Task tool returns error | Display error message with details. Suggest checking agent definition exists at `.claude/agents/ultraplan-planner.md`. |
| Planner generates zero plans | No files written to `.ultraplan/plans/` | Display error: "Planner failed to generate plans. Check phase definition in ROADMAP.md is complete." Stop. |
| Permission denied writing files | Write operation fails | Display error: "No write permission in .ultraplan/plans/ directory. Check file permissions." Stop. |

**Pre-flight Permission Check:**

```bash
# Test write permission
touch .ultraplan/plans/.test-write && rm .ultraplan/plans/.test-write || {
  echo "ERROR: No write permission in .ultraplan/plans/"
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

**Plan Phase 1 (Foundation):**
```
/ultraplan:plan-phase 1
```

Output:
```
Planning complete for Phase 1: foundation

Generated PLAN.md files:
- .ultraplan/plans/01-01-directory-structure.md (3 tasks, 2 waves)
- .ultraplan/plans/01-02-document-templates.md (4 tasks, 3 waves)
- .ultraplan/plans/01-03-agent-definition.md (2 tasks, 1 wave)

Total tasks: 9
Estimated time: 4.5 hours (based on 30 min average per task)

Next: Execute plans sequentially or use /ultraplan:status to see progress.
```

**Plan Phase 2 with Prior Phase Check:**
```
/ultraplan:plan-phase 2
```

Note (if Phase 1 not complete):
```
NOTE: Phase 1 (foundation) is not marked complete in ROADMAP.md.
Planning Phase 2 anyway. Assuming dependencies are handled.
(Auto-proceeding without confirmation)
```
