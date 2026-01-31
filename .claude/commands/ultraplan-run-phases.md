---
name: ultraplan:run-phases
description: Execute phases sequentially from N to end using ultraplan (plan-phase + execute). Auto /clear between phases.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task, TaskCreate, TaskUpdate, TaskList, Skill
---

# /ultraplan:run-phases

기존 프로젝트의 Phase들을 ultraplan으로 순차 실행합니다. 각 Phase 완료 후 자동 /clear.

## Usage

```bash
/ultraplan:run-phases from {N}    # Phase N부터 끝까지 실행
/ultraplan:run-phases all         # 모든 미완료 Phase 실행
/ultraplan:run-phases {N}         # 단일 Phase만 실행
```

## Execution Flow

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ULTRAPLAN ► RUN-PHASES: from {N}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For each Phase:

  ═══ Phase {N}: {phase_name} ═══

  [1/4] Check existing plans...
        → PLAN.md exists? Skip to execute : Run plan-phase

  [2/4] Plan Phase (if needed)...
        /ultraplan:plan-phase {N} --skip-verify
        → Research (skip if exists)
        → Generate PLAN.md files
        → Ralplan consensus (1 iteration for speed)

  [3/4] Execute Phase...
        /ultraplan:execute {phase}
        → Parse PLAN.md → Claude Tasks
        → Wave-based execution
        → Executor + Architect verification loop

  [4/4] Cleanup & Progress...
        → Update ROADMAP.md checkbox [x]
        → Commit: "feat(phase-{N}): complete {phase_name}"
        → /clear (context reset for next phase)
        → Proceed to Phase {N+1}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Behavior

### Step 1: Parse Arguments and Find Phases

```bash
# Read ROADMAP.md to get phase list
cat .planning/ROADMAP.md

# Find uncompleted phases (- [ ] pattern)
grep -n "^\- \[ \] \*\*Phase" .planning/ROADMAP.md

# Determine execution range based on argument:
# - "from {N}": Phase N to last phase
# - "all": First uncompleted to last
# - "{N}": Only Phase N
```

### Step 2: For Each Phase - Check Plans

```bash
# Check if PLAN.md files exist for this phase
PHASE_DIR=$(ls -d .planning/phases/*-* 2>/dev/null | grep -E "^.planning/phases/0?${N}-")

if ls ${PHASE_DIR}/*-PLAN.md 2>/dev/null | head -1; then
  echo "Plans exist, skip to execution"
else
  echo "No plans, run plan-phase"
fi
```

### Step 3: Plan Phase (if needed)

```javascript
// Only if PLAN.md doesn't exist
Skill({
  skill: "ultraplan-plan-phase",
  args: `${phaseNumber} --skip-verify`  // Skip extra verification for speed
})
```

**Unattended Mode Rules:**
- `--skip-verify`: Skip extra Ralplan iterations
- `--skip-research`: Skip if RESEARCH.md exists
- Auto-answer all prompts (see rules below)

### Step 4: Execute Phase

```javascript
Skill({
  skill: "ultraplan-execute",
  args: `${phaseNumber}`
})
```

**Execution includes:**
- Parse PLAN.md files for the phase
- Register tasks in Claude Tasks API
- Wave-based parallel execution
- Executor + Architect verification loop
- Atomic commits per task

### Step 5: Update Progress

```bash
# Update ROADMAP.md checkbox
sed -i "s/- \[ \] \*\*Phase ${N}:/- [x] **Phase ${N}:/" .planning/ROADMAP.md

# Commit the phase completion
git add -A
git commit -m "feat(phase-${N}): complete ${phase_name}

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 6: Clear Context and Continue

```javascript
// Clear context for next phase (critical for long sessions)
// This prevents context overflow
Bash({ command: "echo 'Phase ${N} complete. Clearing context...'" })

// The orchestrator should invoke /clear here
// Then resume with next phase
```

**Context Management:**
- Each phase completion triggers /clear
- Next phase starts with fresh 200k context
- Essential state preserved in:
  - .planning/STATE.md
  - ROADMAP.md checkboxes
  - Git commits

## Unattended Mode Auto-Decisions

| Prompt | Auto-Response |
|--------|---------------|
| "RESEARCH BLOCKED" | Skip research and plan anyway |
| "Existing plans found" | Use existing plans |
| "Max iterations reached" | Force proceed |
| "Proceed? (y/n)" | y |
| "Overwrite? (y/n)" | y |
| Architect REJECTED 3x | Force approve with warning |
| Build error | Auto-fix up to 3 attempts |
| Test failure | Auto-fix up to 3 attempts |

## Output Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ULTRAPLAN ► RUN-PHASES: from 13
 Phases: 13, 14, 15, 16
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

═══ Phase 13: Central Registry ═══
[1/4] Plans exist ✓ (13-01~04-PLAN.md)
[2/4] Skipping plan-phase ✓
[3/4] Executing... ⏳
      → Wave 1: 13-01 (3 tasks)
      → Wave 2: 13-02, 13-03 (6 tasks parallel)
      → Wave 3: 13-04 (4 tasks)
      → All tasks complete ✓
[4/4] Cleanup ✓
      → ROADMAP.md updated
      → Committed: feat(phase-13): complete Central Registry
      → /clear triggered

═══ Phase 14: Artifact Pattern ═══
[1/4] No plans found
[2/4] Running plan-phase... ⏳
      → Research complete ✓
      → PLAN.md generated ✓
[3/4] Executing... ⏳
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 COMPLETE ✓

 Phases completed: 13, 14, 15, 16
 Total tasks: 52
 Total commits: 52
 Total time: ~2 hours
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Error Recovery

### Build/Test Failures
```
1. build-fixer agent attempts fix (up to 3x)
2. If still failing: log error, continue to next task
3. At phase end: report skipped tasks
```

### Phase Failure
```
1. Log detailed error to .planning/phases/{N}/ERROR.md
2. Commit partial progress
3. Continue to next phase (unless critical)
4. At end: report failed phases
```

### Context Overflow
```
1. Auto /clear triggered at 80% context
2. Resume from last completed task
3. State preserved in .planning/STATE.md
```

## Resume After Interruption

Session interrupted? Just run again:

```bash
/ultraplan:run-phases from 13
```

It will:
1. Check ROADMAP.md for completed phases (skip them)
2. Check each phase for completed tasks (skip them)
3. Resume from first incomplete task

## Examples

### Execute Phase 13-16
```bash
/ultraplan:run-phases from 13
```

### Execute all uncompleted phases
```bash
/ultraplan:run-phases all
```

### Execute single phase
```bash
/ultraplan:run-phases 14
```

## Related Commands

| Command | Purpose |
|---------|---------|
| `/ultraplan:plan-phase N` | Plan single phase |
| `/ultraplan:execute N` | Execute single phase |
| `/ultraplan:run-phases from N` | **Plan + Execute from N to end** |
| `/ultraplan:status` | Check current progress |

---
*Ultra Planner v4.0 - Sequential Phase Execution with Auto-Clear*

ARGUMENTS: from 13
