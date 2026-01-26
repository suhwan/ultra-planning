# Ultra Planner Router Protocol

## Overview

The Router is the central orchestrator of Ultra Planner's execution system. It coordinates the flow of tasks from PLAN.md through Executor agents to Architect verification, managing state transitions and Claude Tasks synchronization throughout.

**Core Responsibilities:**
- Parse PLAN.md and build executable task queue
- Spawn Executor agents with fresh 200k context per task
- Trigger Architect verification after each execution
- Manage state transitions (pending -> executing -> verifying -> done/failed)
- Synchronize with Claude Tasks API for session-level tracking
- Handle retry logic with failure feedback
- Update STATE.md after each task completion

**NOT Router Responsibilities:**
- Executing tasks (Executor does this)
- Verifying implementations (Architect does this)
- Planning work (Planner does this)

## State Machine

### Task States

| State | Description | Next States |
|-------|-------------|-------------|
| `pending` | Task loaded, waiting for execution | `executing` |
| `executing` | Executor agent is running the task | `verifying`, `failed` |
| `verifying` | Architect agent is reviewing completion | `done`, `failed` |
| `done` | Task verified complete, committed | (terminal) |
| `failed` | Task or verification failed | `pending` (retry) |
| `blocked` | Waiting for dependencies | `pending` |

### State Transitions

```
                    +--------------------------------------+
                    |                                      |
                    v                                      |
+---------+    +---------+    +----------+    +------+    |
| blocked |--->| pending |--->| executing|--->| done |    |
+---------+    +----+----+    +----+-----+    +------+    |
                    |              |                       |
                    |              |    +----------+       |
                    |              +--->| verifying|-------+
                    |                   +----+-----+       |
                    |                        |             |
                    |              +---------v------+      |
                    +--------------+    failed      +------+
                       (retry)     +----------------+
```

### Transition Rules

| From | To | Trigger | Action |
|------|-----|---------|--------|
| blocked | pending | Dependencies complete | Check blockedBy tasks |
| pending | executing | Task selected for execution | Spawn Executor |
| executing | verifying | Executor returns success | Spawn Architect |
| executing | failed | Executor returns failure/blocked | Log error, queue retry |
| verifying | done | Architect approves | Update STATE.md, commit |
| verifying | failed | Architect rejects | Add feedback, queue retry |
| failed | pending | Retry triggered | Increment retry count |

## Task Queue Management

### Queue Structure

The Router maintains a priority queue ordered by:
1. Wave number (lower = higher priority)
2. Task index within wave
3. Retry count (lower = higher priority for fairness)

```yaml
queue:
  - task_id: "task-1"
    wave: 0
    index: 0
    state: pending
    retry_count: 0

  - task_id: "task-2"
    wave: 0
    index: 1
    state: pending
    retry_count: 0

  - task_id: "task-3"
    wave: 1
    index: 0
    state: blocked
    blocked_by: ["task-1", "task-2"]
    retry_count: 0
```

### Queue Operations

| Operation | Description |
|-----------|-------------|
| `loadFromPlan(planPath)` | Parse PLAN.md, populate queue |
| `getNextTask()` | Return highest priority non-blocked task |
| `updateState(taskId, state)` | Transition task to new state |
| `addRetryFeedback(taskId, feedback)` | Attach Architect feedback for retry |
| `isComplete()` | True if all tasks in `done` state |
| `hasFailures()` | True if any tasks exceeded max retries |

## PLAN.md Parsing

### Parsing Process

1. **Read PLAN.md File**
   ```bash
   # Example: .planning/phases/03-sequential-execution/03-01-PLAN.md
   cat $PLAN_PATH
   ```

2. **Extract YAML Frontmatter**
   Parse the frontmatter for metadata:
   ```yaml
   phase: 03-sequential-execution
   plan: 01
   type: execute
   wave: 1
   depends_on: []
   files_modified:
     - .claude/agents/ultraplan-executor.md
   autonomous: true
   ```

3. **Extract Task XML Blocks**
   Parse all `<task>` elements from the document:
   ```xml
   <task type="auto">
     <name>Task 1: Create Executor Agent</name>
     <files>.claude/agents/ultraplan-executor.md</files>
     <action>Create the executor agent...</action>
     <verify>grep "SINGLE-TASK EXECUTOR" ...</verify>
     <done>Agent file exists with identity constraints</done>
   </task>
   ```

4. **Build Task Objects**
   Convert each XML task to an internal task object:
   ```yaml
   task:
     id: "03-01-task-1"
     plan_file: "03-01-PLAN.md"
     name: "Task 1: Create Executor Agent"
     type: "auto"
     files:
       - ".claude/agents/ultraplan-executor.md"
     action: |
       Create the executor agent...
     verify: 'grep "SINGLE-TASK EXECUTOR" ...'
     done: "Agent file exists with identity constraints"
     wave: 0  # Derived from position in PLAN.md
     state: pending
     retry_count: 0
     feedback: null
   ```

### Wave Derivation from PLAN.md

PLAN.md organizes tasks under wave headers:
```markdown
### Wave 0 (Parallel Execution)
<task>...</task>
<task>...</task>

### Wave 1 (Depends on Wave 0)
<task>...</task>
```

**Wave Assignment Rules:**
| Pattern | Wave Assignment |
|---------|-----------------|
| `### Wave N` header | Tasks below get wave = N |
| No wave header | Assume wave = 0 |
| `depends_on` in frontmatter | Plan-level dependency, not task-level |

### Task ID Generation

Format: `{plan_id}-task-{index}`

Examples:
- `03-01-task-1` (Phase 3, Plan 1, Task 1)
- `03-01-task-2` (Phase 3, Plan 1, Task 2)
- `03-07-task-3` (Phase 3, Plan 7, Task 3)

### Dependency Resolution

**Intra-plan Dependencies:**
Tasks in Wave N are blocked by all tasks in Wave 0..N-1 within the same plan.

**Inter-plan Dependencies:**
Plans with `depends_on: ["03-01"]` are blocked until plan 03-01 is complete.

```yaml
# Example: 03-07-PLAN.md
depends_on: ["03-01", "03-03"]

# Tasks in 03-07 are blocked until:
# - All tasks in 03-01-PLAN.md are done
# - All tasks in 03-03-PLAN.md are done
```

## Agent Spawning Protocol

### Executor Spawning

When a task transitions to `executing`:

1. **Prepare Task Context**
   ```yaml
   executor_context:
     task_xml: |
       <task type="auto">
         <name>Task 1: Create PlannerId class</name>
         <files>src/domain/PlannerId.ts</files>
         <action>Create the class with...</action>
         <verify>npm test -- PlannerId</verify>
         <done>PlannerId class exists with validation</done>
       </task>
     retry_count: 0
     previous_feedback: null  # Or Architect feedback if retry
   ```

2. **Spawn Executor via Task Tool**
   ```
   Task(
     subagent_type="ultraplan-executor",
     model="sonnet",
     prompt="""
   You are executing this task:

   {task_xml}

   Retry count: {retry_count}
   {previous_feedback_if_any}

   Execute the task and return a structured YAML result.
   """
   )
   ```

3. **Capture Executor Result**
   ```yaml
   # Expected Executor Output
   status: success | failure | blocked
   task_name: "Task 1: Create PlannerId class"
   files_modified:
     - src/domain/PlannerId.ts
   verification:
     command: "npm test -- PlannerId"
     exit_code: 0
     output_summary: "All 3 tests passed"
   done_criteria_met: true
   evidence: |
     Created PlannerId class with validation...
   error: null
   ```

4. **Process Executor Result**
   | Status | Action |
   |--------|--------|
   | success | Transition to `verifying`, spawn Architect |
   | failure | Transition to `failed`, queue for retry |
   | blocked | Transition to `blocked`, update blockers |

### Architect Spawning

When a task transitions to `verifying`:

1. **Prepare Verification Context**
   ```yaml
   architect_context:
     task_xml: |
       <task>...</task>
     executor_result:
       status: success
       files_modified: [...]
       evidence: "..."
     must_haves:
       truths: [...]
       artifacts: [...]
       key_links: [...]
   ```

2. **Spawn Architect via Task Tool**
   ```
   Task(
     subagent_type="ultraplan-architect",
     model="opus",
     prompt="""
   Verify this task completion:

   ## Task
   {task_xml}

   ## Executor Result
   {executor_result}

   ## must_haves to Verify
   {must_haves}

   Verify that:
   1. All files in <files> were actually modified
   2. <verify> command passes
   3. <done> criteria is satisfied
   4. Relevant must_haves are addressed

   Return APPROVED or REJECTED with detailed rationale.
   """
   )
   ```

3. **Capture Architect Result**
   ```yaml
   # Expected Architect Output
   verdict: APPROVED | REJECTED
   confidence: high | medium | low
   checks:
     files_verified: true
     verify_command_passed: true
     done_criteria_met: true
     must_haves_addressed: true
   rationale: |
     All acceptance criteria verified...
   issues: []  # Empty if approved
   suggestions: []  # Optional improvements
   ```

4. **Process Architect Result**
   | Verdict | Action |
   |---------|--------|
   | APPROVED | Transition to `done`, update STATE.md, trigger commit |
   | REJECTED | Transition to `failed` with Architect feedback, queue retry |

### Fresh Context Guarantee

**CRITICAL:** Each agent spawn gets a FRESH 200k context window.

```
Orchestrator Context (may be polluted)
         |
         +-- Task Tool --> Executor (Fresh 200k context)
         |                     |
         |                     +-- Returns result
         |
         +-- Task Tool --> Architect (Fresh 200k context)
                               |
                               +-- Returns verdict
```

**Benefits:**
- No context pollution between tasks
- Full context available for complex tasks
- Clean slate prevents accumulated errors
- Parallel execution possible (different context windows)

## Claude Tasks API Integration

### Overview

The Router synchronizes with Claude Tasks API for session-level task tracking. PLAN.md remains the Source of Truth, with Claude Tasks providing real-time visibility during execution.

**Integration Points:**
1. Plan load: Register tasks in Claude Tasks
2. State transition: Update Claude Tasks status
3. Session resume: Reload from PLAN.md

### Task Registration (Plan Load)

When loading a PLAN.md, register each task in Claude Tasks:

```javascript
// For each task parsed from PLAN.md
TaskCreate({
  subject: task.name,  // "Task 1: Create PlannerId class"
  description: `${task.action}\n\n**Acceptance:** ${task.done}`,
  activeForm: `Executing ${task.name}`,
  metadata: {
    planFile: "03-01-PLAN.md",
    taskIndex: 0,
    wave: 0,
    files: task.files.join(", "),
    verify: task.verify,
    taskId: task.id  // "03-01-task-1"
  }
})
```

### Dependency Mapping

Wave-based dependencies map to Claude Tasks `blockedBy`:

```javascript
// Wave 1 tasks are blocked by Wave 0 tasks
const wave0TaskIds = tasks
  .filter(t => t.wave === 0)
  .map(t => t.claudeTaskId);

// When creating Wave 1 tasks
TaskCreate({
  subject: wave1Task.name,
  addBlockedBy: wave0TaskIds,  // ["1", "2", "3"]
  metadata: { wave: 1, ... }
})
```

**Result in TaskList:**
```
#1 [pending] Task 1: Create domain models
#2 [pending] Task 2: Create templates
#3 [pending] Task 3: Implement validation [blocked by #1]
#4 [pending] Task 4: Create renderer [blocked by #2]
#5 [pending] Task 5: Integration [blocked by #3, #4]
```

### State Synchronization

Update Claude Tasks on every state transition:

| Router State | Claude Tasks Action |
|--------------|---------------------|
| pending | TaskUpdate(status: "pending") |
| executing | TaskUpdate(status: "in_progress") |
| verifying | TaskUpdate(status: "in_progress") |
| done | TaskUpdate(status: "completed") |
| failed | TaskUpdate(status: "pending") with retry metadata |

```javascript
// On transition to executing
TaskUpdate({
  taskId: task.claudeTaskId,
  status: "in_progress",
  metadata: {
    ...task.metadata,
    startedAt: new Date().toISOString()
  }
})

// On transition to done
TaskUpdate({
  taskId: task.claudeTaskId,
  status: "completed",
  metadata: {
    ...task.metadata,
    completedAt: new Date().toISOString(),
    evidence: executorResult.evidence
  }
})
```

### Session Persistence Strategy

Claude Tasks are session-scoped (disappear on session end). PLAN.md is the persistent source of truth.

**Session Start:**
1. Read PLAN.md to get all tasks
2. Check each task's completion status in PLAN.md
3. Register only incomplete tasks in Claude Tasks
4. Resume execution from last incomplete task

**Session End:**
1. All task states already persisted to PLAN.md
2. Claude Tasks automatically cleared
3. No data loss (PLAN.md is complete)

**Resume Protocol:**
```yaml
# On session resume:
1. Read STATE.md for current phase/plan
2. Read active PLAN.md
3. Find tasks marked incomplete
4. Register in Claude Tasks
5. Continue execution
```

### Conflict Detection

If PLAN.md is manually edited during execution:

1. **Detection:** Compare PLAN.md task count with Claude Tasks
2. **Resolution:**
   - PLAN.md is Source of Truth
   - Reload from PLAN.md
   - Re-register Claude Tasks
   - Warn user about discrepancy

## Execution Loop

### Main Loop Algorithm

```
FUNCTION executeAllTasks(planPath):
    queue = loadFromPlan(planPath)
    registerClaudeTasks(queue)

    WHILE NOT queue.isComplete():
        task = queue.getNextTask()

        IF task IS NULL:
            IF queue.hasBlockedTasks():
                WAIT for dependency completion
            ELSE:
                BREAK  # All remaining tasks failed max retries

        // Execute task
        updateState(task.id, "executing")
        syncClaudeTask(task.id, "in_progress")

        executorResult = spawnExecutor(task)

        IF executorResult.status == "success":
            // Verify with Architect
            updateState(task.id, "verifying")

            architectResult = spawnArchitect(task, executorResult)

            IF architectResult.verdict == "APPROVED":
                updateState(task.id, "done")
                syncClaudeTask(task.id, "completed")
                updateStateFile(task)
                triggerCommit(task)
                unblockDependents(task.id)
            ELSE:
                handleFailure(task, architectResult.issues)
        ELSE:
            handleFailure(task, executorResult.error)

    RETURN queue.getSummary()
```

### Pseudocode Flow

```
+--------------------------------------------------------------+
|                     EXECUTION LOOP                            |
+--------------------------------------------------------------+
|  1. Load PLAN.md into task queue                              |
|  2. Register tasks in Claude Tasks API                        |
|                                                               |
|  +---------------------------------------------------------+  |
|  |  WHILE queue has incomplete tasks:                       |  |
|  |                                                          |  |
|  |    task = get next non-blocked task                      |  |
|  |    IF no task available:                                 |  |
|  |       wait or exit                                       |  |
|  |                                                          |  |
|  |    +-------------------------------------------------+   |  |
|  |    |  EXECUTE PHASE                                  |   |  |
|  |    |  - Spawn Executor(task)                         |   |  |
|  |    |  - Capture result                               |   |  |
|  |    +-------------------------------------------------+   |  |
|  |                       |                                   |  |
|  |            +----------+----------+                       |  |
|  |            v                      v                       |  |
|  |       [success]              [failure]                    |  |
|  |            |                      |                       |  |
|  |    +-------v-------+        +----v----+                  |  |
|  |    | VERIFY PHASE  |        |  RETRY  |                  |  |
|  |    | Spawn         |        |  QUEUE  |                  |  |
|  |    | Architect     |        +---------+                  |  |
|  |    +-------+-------+                                     |  |
|  |            |                                              |  |
|  |     +------+------+                                      |  |
|  |     v              v                                      |  |
|  | [APPROVED]    [REJECTED]                                 |  |
|  |     |              |                                      |  |
|  |  +--v--+      +---v----+                                 |  |
|  |  |DONE |      | RETRY  |                                 |  |
|  |  |Commit|     | w/     |                                 |  |
|  |  +-----+     |feedback |                                 |  |
|  |              +---------+                                  |  |
|  +---------------------------------------------------------+  |
|                                                               |
|  3. Update STATE.md with final summary                        |
|  4. Report execution results                                  |
+--------------------------------------------------------------+
```

## Retry Logic

### Retry Configuration

```yaml
retry_config:
  max_retries: 3
  backoff_strategy: none  # Immediate retry
  feedback_required: true  # Architect feedback on retry
```

### Retry Trigger Conditions

| Condition | Retry? | Action |
|-----------|--------|--------|
| Executor returns `failure` | Yes | Retry with error info |
| Executor returns `blocked` | No | Move to blocked state, wait for deps |
| Architect returns `REJECTED` | Yes | Retry with Architect feedback |
| Max retries exceeded | No | Mark as `failed_permanent`, continue |
| Task timeout (10 min) | Yes | Kill and retry |

### Feedback Injection

When retrying, inject previous failure feedback:

```yaml
# Executor prompt on retry
You are executing this task (Retry #{retry_count}):

{task_xml}

## Previous Attempt Failed

**Reason:** {failure_reason}

**Architect Feedback:**
{architect_feedback}

**Specific Issues:**
- {issue_1}
- {issue_2}

Please address these issues in your execution.
```

### Retry State Tracking

```yaml
task:
  id: "03-01-task-3"
  state: pending  # Reset to pending for retry
  retry_count: 2
  retry_history:
    - attempt: 1
      result: failure
      reason: "Tests failed"
      feedback: "Missing null check in validation"
    - attempt: 2
      result: rejected
      reason: "Architect rejected"
      feedback: "Edge case not handled: version = 0"
```

### Max Retry Exceeded Handling

When a task exceeds max retries:

1. **Mark as Failed Permanent**
   ```yaml
   task:
     state: failed_permanent
     retry_count: 3
     final_error: "Exceeded max retries (3)"
   ```

2. **Notify User**
   ```
   TASK FAILED PERMANENTLY
   =======================
   Task: Task 3: Implement validation
   Attempts: 3
   Last Error: Edge case not handled

   Options:
   - /ultraplan:retry 03-01-task-3  (manual retry)
   - /ultraplan:skip 03-01-task-3   (skip and continue)
   - /ultraplan:abort               (stop execution)
   ```

3. **Block Dependents**
   Tasks depending on this task remain blocked until resolved.

## STATE.md Update Protocol

### Update Triggers

STATE.md is updated on:
1. Task completion (done state)
2. Plan completion (all tasks done)
3. Phase completion (all plans done)
4. Failure that requires user attention

### Update Content

**Per-Task Update:**
```yaml
# Update STATE.md with:
current_task:
  plan: "03-01-PLAN.md"
  task: "Task 3: Implement validation"
  status: completed
  completed_at: "2026-01-26T14:30:00Z"

progress:
  phase_3:
    total_tasks: 15
    completed: 7
    in_progress: 0
    pending: 8

last_activity: "2026-01-26T14:30:00Z - Completed Task 3"
```

**Progress Bar Update:**
```markdown
## Current Position

Phase: 03 of 07 (Sequential Execution)
Plan: 03-01-PLAN.md (5/5 tasks complete)
Status: In Progress

Progress: [=====-----] 47% (7/15 tasks in phase)
```

### STATE.md Write Protocol

1. **Read Current STATE.md**
   ```bash
   cat .planning/STATE.md
   ```

2. **Parse YAML/Markdown Sections**
   - Current Position section
   - Performance Metrics section
   - Accumulated Context section

3. **Update Relevant Fields**
   - Increment completed count
   - Update progress bar
   - Add to last activity log
   - Update performance metrics

4. **Write Atomically**
   ```bash
   # Write to temp file first
   echo "$updated_content" > .planning/STATE.md.tmp
   mv .planning/STATE.md.tmp .planning/STATE.md
   ```

## Commit Protocol

### Per-Task Commit

After each task is verified complete:

1. **Stage Modified Files**
   ```bash
   # Stage only files listed in task.files
   git add src/domain/PlannerId.ts
   git add tests/PlannerId.test.ts
   # Also stage STATE.md update
   git add .planning/STATE.md
   ```

2. **Generate Commit Message**
   Format: `{type}({scope}): {task_name}`

   ```
   feat(domain): Create PlannerId class with validation

   - Added PlannerId class with id, createdAt, version
   - Implemented UUID validation
   - Added InvalidPlannerIdError for failures
   - All 3 tests passing

   Task: 03-01-PLAN.md Task 1
   Verified by: Architect (ultraplan-architect)
   ```

3. **Commit**
   ```bash
   git commit -m "$commit_message"
   ```

### Commit Type Mapping

| Task Action | Commit Type |
|-------------|-------------|
| Create new file | `feat` |
| Add functionality | `feat` |
| Fix bug | `fix` |
| Refactor existing | `refactor` |
| Add tests | `test` |
| Update docs | `docs` |
| Update config | `chore` |

### Commit Scope Derivation

Derive scope from task files:

| File Pattern | Scope |
|--------------|-------|
| `src/domain/*` | `domain` |
| `src/render/*` | `render` |
| `tests/*` | `test` |
| `.claude/agents/*` | `agents` |
| `.claude/commands/*` | `commands` |
| `.claude/skills/*` | `skills` |
| `.planning/*` | `planning` |

### Rollback on Failure

If commit fails or needs reverting:

```bash
# Identify commit by task marker
git log --oneline | grep "Task: 03-01-PLAN.md Task 1"

# Revert if needed
git revert <commit_hash> --no-commit
git commit -m "revert(domain): Rollback PlannerId - verification failed"
```

## Error Handling

### Error Categories

| Category | Examples | Response |
|----------|----------|----------|
| **Parse Errors** | Invalid XML, missing fields | Abort with clear error message |
| **Execution Errors** | Task fails, tests fail | Retry with feedback |
| **Verification Errors** | Architect rejects | Retry with detailed feedback |
| **System Errors** | Disk full, permission denied | Abort with system error |
| **Timeout Errors** | Task exceeds 10 minutes | Kill and retry |

### Parse Error Handling

```yaml
# If PLAN.md parsing fails:
error:
  type: parse_error
  file: "03-01-PLAN.md"
  line: 45
  message: "Invalid XML: missing closing </task> tag"
  action: abort
  user_message: |
    Cannot parse PLAN.md at line 45.
    Error: Missing closing </task> tag.

    Please fix the plan file and retry.
```

### Execution Error Recovery

```yaml
# If Executor fails:
on_executor_failure:
  - log_error_to_task
  - increment_retry_count
  - if retry_count < max_retries:
      - inject_failure_feedback
      - transition_to_pending
      - requeue_task
  - else:
      - transition_to_failed_permanent
      - prompt_user_for_action
```

### Verification Error Recovery

```yaml
# If Architect rejects:
on_architect_rejection:
  - extract_issues_from_verdict
  - create_feedback_block
  - log_rejection_to_task
  - increment_retry_count
  - if retry_count < max_retries:
      - inject_architect_feedback
      - transition_to_pending
      - requeue_task
  - else:
      - transition_to_failed_permanent
      - prompt_user_for_action
```

### Timeout Handling

```yaml
# Task timeout configuration
timeout_config:
  executor_timeout_ms: 600000  # 10 minutes
  architect_timeout_ms: 300000  # 5 minutes

on_timeout:
  - kill_running_agent
  - log_timeout_error
  - treat_as_failure
  - follow_retry_logic
```

## Edge Cases

### Partial Plan Completion

If execution is interrupted mid-plan:

1. **STATE.md preserved:** Completed tasks are recorded
2. **Resume capability:** Re-run /ultraplan:execute to continue
3. **Claude Tasks cleared:** Re-register pending tasks on resume

```
Resume Detection:
- Read STATE.md for last completed task
- Skip tasks already marked done in PLAN.md
- Start execution from next pending task
```

### Empty Wave

If a wave has no tasks (after filtering):

```yaml
# Skip empty waves gracefully
if wave.tasks.length == 0:
    log("Wave {wave.number} is empty, skipping")
    unblock_next_wave()
    continue
```

### Circular Dependencies

If dependency analysis reveals cycles:

```yaml
# Detect on plan load
cycles = detectCycles(dependencyGraph)
if cycles.length > 0:
    abort_with_error:
      type: circular_dependency
      message: |
        Circular dependency detected:
        Task A -> Task B -> Task C -> Task A

        Please resolve in PLAN.md before execution.
```

### Concurrent Modification

If PLAN.md is modified during execution:

```yaml
# On each task completion, verify PLAN.md hasn't changed
on_task_complete:
  - current_hash = hash(PLAN.md)
  - if current_hash != original_hash:
      - warn_user: "PLAN.md modified during execution"
      - offer_options:
          - reload: "Reload PLAN.md and continue"
          - ignore: "Continue with original plan"
          - abort: "Stop execution"
```

### Agent Spawn Failure

If Task tool fails to spawn agent:

```yaml
on_spawn_failure:
  - log_error
  - retry_spawn(max_attempts=3)
  - if still_failing:
      - abort_with_error:
          message: "Cannot spawn agent. Check system resources."
```

### Git Commit Failure

If commit fails after task completion:

```yaml
on_commit_failure:
  - log_commit_error
  - task_remains_done: true  # Work is complete
  - warn_user: "Commit failed. Manual commit recommended."
  - continue_execution: true  # Don't block next tasks
```

---

*Router Protocol Document v1.0.0*
*Last updated: 2026-01-26*
