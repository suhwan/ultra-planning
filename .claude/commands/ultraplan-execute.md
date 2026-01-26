---
name: ultraplan:execute
description: Execute tasks from a PLAN.md file with Executor/Architect verification loop
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task
---

# /ultraplan:execute

Execute a plan file using the Router protocol.

## Usage

```
/ultraplan:execute {plan_path}
/ultraplan:execute 03-01
/ultraplan:execute .planning/phases/03-sequential-execution/03-01-PLAN.md
```

## Arguments

| Argument | Description | Example |
|----------|-------------|---------|
| `plan_path` | Plan file path or shorthand | `03-01`, `03-01-PLAN.md`, full path |

## Shorthand Resolution

The command accepts multiple input formats and resolves them to full paths:

| Input | Resolved Path |
|-------|---------------|
| `07-01` | `.planning/phases/07-cli-commands/07-01-PLAN.md` |
| `07-01-PLAN.md` | `.planning/phases/07-cli-commands/07-01-PLAN.md` |
| Full path | Used as-is if exists |

**Resolution Algorithm:**

```bash
parse_plan_path() {
  local input="$1"

  # If full path exists, use it
  if [[ -f "$input" ]]; then
    echo "$input"
    return
  fi

  # Extract phase and plan from shorthand (e.g., "07-01")
  local phase=$(echo "$input" | cut -d'-' -f1)
  local plan_num=$(echo "$input" | cut -d'-' -f2 | sed 's/-PLAN.md//')

  # Pad phase number
  local padded=$(printf "%02d" "$phase")

  # Find phase directory
  local phase_dir=$(ls -d .planning/phases/${padded}-* 2>/dev/null | head -1)

  if [[ -z "$phase_dir" ]]; then
    echo "ERROR: Phase directory not found for phase $phase"
    return 1
  fi

  # Construct full path
  echo "${phase_dir}/${padded}-${plan_num}-PLAN.md"
}
```

## Behavior

When user runs `/ultraplan:execute {plan}`:

### 1. Validate Prerequisites

Before execution, verify all required components:

**Required Files:**
- [ ] PLAN.md file exists at resolved path
- [ ] PLAN.md has valid YAML frontmatter
- [ ] PLAN.md contains at least one `<task>` element
- [ ] STATE.md exists at `.planning/STATE.md`
- [ ] STATE.md is readable and has current position

**Required Agents:**
- [ ] `.claude/agents/ultraplan-executor.md` exists
- [ ] `.claude/agents/ultraplan-architect.md` exists

**Validation Commands:**

```bash
# Check plan file
if [[ ! -f "$PLAN_PATH" ]]; then
  echo "ERROR: Plan not found: $PLAN_PATH"
  exit 1
fi

# Check for tasks
if ! grep -q "<task" "$PLAN_PATH"; then
  echo "ERROR: No tasks found in $PLAN_PATH"
  exit 1
fi

# Check STATE.md
if [[ ! -f ".planning/STATE.md" ]]; then
  echo "ERROR: STATE.md not found at .planning/STATE.md"
  exit 1
fi

# Check agents
for agent in ultraplan-executor ultraplan-architect; do
  if [[ ! -f ".claude/agents/${agent}.md" ]]; then
    echo "ERROR: Missing agent: .claude/agents/${agent}.md"
    echo "Suggestion: Create agent files before execution"
    exit 1
  fi
done
```

**Error Messages:**

If validation fails, show specific error:
```
ERROR: Cannot execute plan

Missing: .claude/agents/ultraplan-architect.md
Suggestion: Create required agent files before execution
```

### 2. Load Plan and Build Queue

1. Parse PLAN.md frontmatter and task XML
2. Build task queue ordered by wave
3. Check for completed tasks (skip if already done)
4. Register pending tasks in Claude Tasks API

Display queue preview:
```
Plan: 03-01-PLAN.md
Tasks: 5 (0 complete, 5 pending)

Queue:
  Wave 0:
    [ ] Task 1: Create Executor Agent
    [ ] Task 2: Add Execution Protocol
  Wave 1:
    [ ] Task 3: Add Result Reporting
    [ ] Task 4: Add Constraints
  Wave 2:
    [ ] Task 5: Add Example Walkthrough

Proceed with execution? (yes/no)
```

### 3. Execute Router Protocol

Follow the execution loop from Router Protocol (`.claude/skills/ultraplan/references/router.md`):

**Main Execution Loop:**

```
FOR each task in queue (ordered by wave):

  1. Check dependencies: Skip if blockedBy tasks incomplete

  2. Spawn Executor:
     Task(
       subagent_type="ultraplan-executor",
       model="sonnet",
       prompt="Execute task: {task_xml}"
     )

  3. On Executor success -> Spawn Architect:
     Task(
       subagent_type="ultraplan-architect",
       model="opus",
       prompt="Verify task completion: {task_xml}\n\nExecutor result: {result}"
     )

  4. On Architect APPROVED:
     - Mark task complete in STATE.md
     - Sync Claude Tasks to 'completed'
     - Commit changes (atomic per-task commit)
     - Unblock dependent tasks

  5. On failure (Executor or Architect):
     - Retry up to 3 times with feedback
     - If max retries exceeded: prompt user for action
```

**Retry Logic:**

| Retry Count | Action |
|-------------|--------|
| 1-2 | Auto-retry with previous failure feedback |
| 3 (max) | Prompt user: retry, skip, or abort |

**Unattended Mode:**

When executing in unattended mode (auto-proceed):
- Skip "Proceed? (y/n)" confirmations
- Auto-retry on failures (up to max)
- Only stop for permanent failures after 3 retries

### 4. Progress Display

During execution, show live progress:

```
Executing: 03-01-PLAN.md
=======================================

[=====-----] 2/5 tasks complete

Current: Task 3: Add Result Reporting
  Status: Executing...
  Elapsed: 45s

Completed:
  [x] Task 1: Create Executor Agent (1m 23s)
  [x] Task 2: Add Execution Protocol (2m 05s)

Pending:
  [ ] Task 4: Add Constraints
  [ ] Task 5: Add Example Walkthrough
```

### 5. Completion Summary

After all tasks complete, display comprehensive summary:

```
Plan Execution Complete
=======================================

Plan: 07-01-PLAN.md
Status: SUCCESS

Results:
  [x] Task 1: Create Executor Agent (1m 23s)
  [x] Task 2: Add Execution Protocol (2m 05s)
  [x] Task 3: Add Result Reporting (1m 45s)
  [x] Task 4: Add Constraints (1m 12s)
  [x] Task 5: Add Example Walkthrough (2m 30s)

Total Time: 8m 55s
Commits: 5

Files Modified:
  - .claude/agents/ultraplan-executor.md

must_haves Verified:
  [x] Executor agent exists as valid Claude subagent
  [x] Agent uses Sonnet model
  [x] Agent reports structured results
  [x] Agent follows single-task pattern

STATE.md Updated:
  Progress: [██████████] 23/28 plans complete (82%)
  Last activity: 2026-01-27 - Completed 07-01-PLAN.md

Next Steps:
  /ultraplan:execute 07-02  (next plan in phase)
  /ultraplan:status         (view overall progress)
```

## Error Handling

| Error | Response |
|-------|----------|
| Plan file not found | "Plan not found: {path}. Check path and try again." |
| No tasks in plan | "No executable tasks found in {plan}." |
| Executor agent missing | "Missing .claude/agents/ultraplan-executor.md. Run /ultraplan:init." |
| Task permanently failed | "Task failed after 3 retries. Options: /retry, /skip, /abort" |
| All tasks blocked | "All remaining tasks are blocked. Check dependencies." |

## Options

| Flag | Description |
|------|-------------|
| `--dry-run` | Show queue without executing |
| `--from {task}` | Start from specific task |
| `--skip-verification` | Skip Architect verification (not recommended) |
| `--verbose` | Show detailed agent output |

## Agent Integration

### Executor Spawning

```
Task(
  subagent_type="ultraplan-executor",
  model="sonnet",
  prompt="Execute task from PLAN.md..."
)
```

See: `.claude/agents/ultraplan-executor.md`

### Architect Spawning

```
Task(
  subagent_type="ultraplan-architect",
  model="opus",
  prompt="Verify task completion..."
)
```

See: `.claude/agents/ultraplan-architect.md`

## Related Commands

| Command | Purpose |
|---------|---------|
| `/ultraplan:status` | View current execution state |
| `/ultraplan:plan-phase` | Create new plan from phase |
| `/ultraplan:retry {task}` | Retry a failed task |
| `/ultraplan:skip {task}` | Skip a blocked task |
| `/ultraplan:abort` | Stop execution |

## Protocol References

- Router Protocol: `.claude/skills/ultraplan/references/router.md`
- Result Capture: `.claude/skills/ultraplan/references/result-capture.md`
- Retry Protocol: `.claude/skills/ultraplan/references/retry-protocol.md`
- Commit Protocol: `.claude/skills/ultraplan/references/commit-protocol.md`
