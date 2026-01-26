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

| Input | Resolved Path |
|-------|---------------|
| `03-01` | `.planning/phases/03-sequential-execution/03-01-PLAN.md` |
| `02-03-PLAN.md` | `.planning/phases/02-core-planning/02-03-PLAN.md` |
| `03-07` | `.planning/phases/03-sequential-execution/03-07-PLAN.md` |

## Behavior

When user runs `/ultraplan:execute {plan}`:

### 1. Validate Prerequisites

```
Check:
- [ ] PLAN.md file exists
- [ ] PLAN.md has valid frontmatter
- [ ] PLAN.md has <task> elements
- [ ] STATE.md exists and is readable
- [ ] Required agents exist:
      - .claude/agents/ultraplan-executor.md
      - .claude/agents/ultraplan-architect.md
```

If validation fails:
```
ERROR: Cannot execute plan

Missing: .claude/agents/ultraplan-architect.md
Suggestion: Run /ultraplan:init-agents first
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

Follow Router Protocol from `.claude/skills/ultraplan/references/router.md`:

1. **For each task in queue:**
   a. Transition to `executing`
   b. Spawn Executor agent (Sonnet)
   c. Capture result

2. **On Executor success:**
   a. Transition to `verifying`
   b. Spawn Architect agent (Opus)
   c. Capture verdict

3. **On Architect APPROVED:**
   a. Transition to `done`
   b. Update STATE.md
   c. Commit changes
   d. Unblock dependent tasks

4. **On failure (Executor or Architect):**
   a. Add feedback to task
   b. Retry (up to 3 times)
   c. If max retries: prompt user

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

After all tasks complete:

```
Plan Execution Complete
=======================================

Plan: 03-01-PLAN.md
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

Next:
  /ultraplan:execute 03-02  (next plan)
  /ultraplan:status         (view progress)
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
