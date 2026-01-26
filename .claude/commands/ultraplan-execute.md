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

**Building Task Queue:**

1. **Parse PLAN.md frontmatter and task XML:**
   ```bash
   # Extract frontmatter
   phase=$(grep "^phase:" $PLAN_PATH | cut -d: -f2 | tr -d ' ')
   plan=$(grep "^plan:" $PLAN_PATH | cut -d: -f2 | tr -d ' ')

   # Extract task XML blocks
   # Parse <task> elements with wave assignments
   ```

2. **Extract tasks with wave assignments:**
   - Parse task XML blocks sequentially
   - Derive wave from section headers (### Wave N)
   - If no wave header, assign wave = 0

3. **Build dependency map from waves:**
   - Wave 0 tasks: No dependencies (blockedBy = [])
   - Wave N tasks: Blocked by ALL tasks in waves 0..N-1
   - Sort by wave, then by task index

4. **Check for completed tasks:**
   - Read task_states from PLAN.md frontmatter (if exists)
   - Skip tasks already marked 'done'
   - Resume from last incomplete task

**Queue Preview:**

Display queue before execution:
```
Plan: 07-01-PLAN.md
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

Dependencies:
  - Task 3 blocked by: Task 1, Task 2
  - Task 4 blocked by: Task 1, Task 2
  - Task 5 blocked by: Task 3, Task 4

Proceed with execution? (yes/no)
```

### 2a. Claude Tasks Registration

Before execution, register tasks in Claude Tasks API for visual tracking:

**Registration Process:**

For each task in queue:

```javascript
// Create task in Claude Tasks
TaskCreate({
  subject: task.name,  // "Task 1: Create Executor Agent"
  description: `${task.action}\n\n**Acceptance:** ${task.done}`,
  activeForm: `Executing ${task.name}`,
  metadata: {
    planFile: "07-01-PLAN.md",
    taskIndex: 0,
    wave: 0,
    files: task.files.join(", "),
    verify: task.verify,
    taskId: task.id  // "07-01-01"
  },
  blockedBy: wave_dependency_task_ids  // Claude Task IDs from previous waves
})

// Store mapping
task_mappings[task.id] = claude_task_id
```

**Dependency Mapping:**

Wave-based dependencies map to Claude Tasks `blockedBy`:

```javascript
// Wave 1 tasks blocked by all Wave 0 tasks
const wave0TaskIds = tasks
  .filter(t => t.wave === 0)
  .map(t => task_mappings[t.id]);

// When creating Wave 1 tasks
TaskCreate({
  subject: wave1Task.name,
  blockedBy: wave0TaskIds,  // ["1", "2"]
  metadata: { wave: 1, ... }
})
```

**Benefits:**
- Visual task tracking during execution
- Dependency visualization in Claude UI
- Session-level progress persistence
- Real-time status updates

**Result in TaskList:**

```
#1 [pending] Task 1: Create Executor Agent
#2 [pending] Task 2: Add Execution Protocol
#3 [pending] Task 3: Add Result Reporting [blocked by #1, #2]
#4 [pending] Task 4: Add Constraints [blocked by #1, #2]
#5 [pending] Task 5: Add Example [blocked by #3, #4]
```

### 2b. State Synchronization

After each task completion, synchronize multiple state layers:

**Update Sequence:**

1. **Update PLAN.md frontmatter** (task_states field):
   ```yaml
   task_states:
     "07-01-01": done
     "07-01-02": done
     "07-01-03": executing
   ```

2. **Update STATE.md** (progress section):
   ```markdown
   Progress: [██████▓░░░] 79% (22/28 plans complete)
   Last activity: 2026-01-27 - Completed 07-01 Task 1
   ```

3. **Sync Claude Tasks status**:
   ```javascript
   TaskUpdate({
     taskId: claude_task_id,
     status: "completed",
     metadata: {
       ...task.metadata,
       completedAt: new Date().toISOString(),
       evidence: executorResult.evidence
     }
   })
   ```

**On Resume (if execution interrupted):**

1. Read task_states from PLAN.md frontmatter
2. Skip tasks already marked 'done'
3. Re-register only pending tasks in Claude Tasks
4. Continue from last incomplete task

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

Comprehensive error handling for all failure modes:

| Error | Response | Recovery |
|-------|----------|----------|
| **Plan file not found** | "Plan not found: {path}. Check path." | Fix path and retry |
| **No tasks in plan** | "No executable tasks found in {plan}." | Add tasks to PLAN.md |
| **Invalid task XML** | "Parse error at line {N}: {error}" | Fix XML syntax |
| **Agent spawn failure** | "Failed to spawn {agent}. Retrying..." | Retry spawn 3 times, then abort |
| **Executor failed 3x** | "Task failed after 3 retries. Options: /retry, /skip, /abort" | Prompt user for action |
| **Architect rejected 3x** | "Verification failed 3 times. Options: /retry, /skip, /abort" | Prompt user for action |
| **All tasks blocked** | "All remaining tasks blocked. Check dependencies." | Review dependency graph |
| **Commit failed** | "Git commit failed: {error}. Work is saved, commit manually." | Continue execution, warn user |
| **STATE.md write failed** | "Cannot update STATE.md: {error}" | Abort execution |
| **Claude Tasks API error** | "Task sync failed: {error}. Continuing without sync." | Continue execution, warn user |

**Error Recovery Strategies:**

**Executor/Architect Failures:**
```
Retry 1: Add failure feedback, retry immediately
Retry 2: Add detailed feedback, retry immediately
Retry 3 (max): Prompt user:
  - [r] Retry one more time
  - [s] Skip task and continue
  - [a] Abort execution
```

**Agent Spawn Failures:**
```
Attempt 1-3: Retry spawn with backoff (0s, 5s, 10s)
After 3 failures: Abort with error message
```

**Permanent Failures:**
When task exceeds max retries, mark as failed_permanent:
- Task remains in 'failed' state
- Dependent tasks remain blocked
- User must manually resolve or skip

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
