# Retry Loop Protocol

## Overview

When task execution or verification fails, the retry loop provides structured recovery:
1. Capture failure details
2. Inject feedback into retry prompt
3. Re-execute with accumulated context
4. Escalate to user after max retries

**Design Principle:** Each retry attempt should be SMARTER than the previous one by including specific failure context that helps the executor avoid the same mistake.

## Retry Loop Constants

| Constant | Value | Rationale |
|----------|-------|-----------|
| MAX_RETRIES | 3 | Balance between persistence and token cost |
| RETRY_DELAY | 0 | Immediate retry (no rate limiting needed for Tasks API) |
| ESCALATION_THRESHOLD | 3 | After 3 failures, human likely needed |

## RETRY LOOP PROTOCOL

### Loop Flow Diagram

```
[Task Execution]
       |
       v
[Verification] ──pass──> [Mark Complete]
       |
     fail
       |
       v
[Capture Failure] ──> [Increment retry_count]
       |
       v
{retry_count > MAX_RETRIES?}
       |              |
      yes             no
       |              |
       v              v
[Escalate to User]  [Inject Feedback]
                          |
                          v
                    [Re-Execute Task]
                          |
                          └──> [Verification] ...
```

## Retry Triggers

A retry is triggered when:

| Trigger | Source | Example |
|---------|--------|---------|
| Verification command fails | <verify> exit code != 0 | `npm test` returns exit code 1 |
| Executor reports failure | Result YAML status: failure | Syntax error during edit |
| Verification timeout | Command exceeds timeout | Test hangs for >2 minutes |
| Done criteria unmet | Architect verification fails | "Tests pass but coverage <80%" |

A retry is NOT triggered when:

| Condition | Handling |
|-----------|----------|
| Task is blocked | Route to blocker resolution, not retry |
| Task XML is malformed | Report parsing error, do not retry |
| Permission denied | Escalate immediately (cannot fix automatically) |
| User-requested abort | Respect cancellation |

## Failure Feedback Capture

When a task fails, capture these details:

### Failure Record Schema

```yaml
failure_record:
  attempt: 1  # which retry attempt (1, 2, 3)
  timestamp: "2026-01-26T14:30:00Z"
  failure_type: "verification_failed"  # execution_error | verification_failed | timeout | architect_rejected

  # From executor result
  executor_output:
    status: "failure"
    files_modified: ["src/domain/PlannerId.ts"]
    verification:
      command: "npm test -- PlannerId"
      exit_code: 1
      output_summary: "1 passed, 2 failed"
    error: "Cannot find module 'uuid'"

  # Analysis
  root_cause_guess: "Missing dependency"
  suggested_fix: "Run npm install uuid"

  # Context for next attempt
  files_state:
    - path: "src/domain/PlannerId.ts"
      status: "partially_modified"
      lines_changed: 15
```

### Failure Types

| Type | Description | Common Causes |
|------|-------------|---------------|
| execution_error | Executor failed during action | Syntax error, missing import, wrong path |
| verification_failed | <verify> command returned non-zero | Test failure, lint error, type error |
| timeout | Command exceeded time limit | Infinite loop, network hang |
| architect_rejected | Architect verification failed | Incomplete implementation, missing edge case |

## Feedback Injection Format

### RETRY CONTEXT Block

Previous failure feedback is injected into the executor prompt using a `<retry_context>` block:

```xml
<retry_context attempt="2" max_attempts="3">
  <previous_failures>
    <failure attempt="1">
      <type>verification_failed</type>
      <timestamp>2026-01-26T14:30:00Z</timestamp>
      <error_summary>
        npm test -- PlannerId returned exit code 1
        1 passed, 2 failed
      </error_summary>
      <error_details>
        FAIL tests/PlannerId.test.ts
        - InvalidPlannerIdError not thrown for empty string
        - InvalidPlannerIdError not thrown for null
      </error_details>
      <files_affected>
        - src/domain/PlannerId.ts (partially modified)
      </files_affected>
      <suggested_fix>
        Add validation for empty string and null inputs in PlannerId constructor
      </suggested_fix>
    </failure>
  </previous_failures>

  <accumulated_learnings>
    - uuid.validate() returns false for empty string but does not throw
    - Constructor must explicitly check for null/undefined before UUID validation
  </accumulated_learnings>

  <instruction>
    This is retry attempt 2 of 3.
    Review the previous failure(s) above.
    Address the specific issues before re-executing.
    If you believe the task is impossible, report status: blocked.
  </instruction>
</retry_context>
```

### Injection Placement

The retry context is injected BEFORE the task XML:

```
[Executor System Prompt]
[RETRY CONTEXT BLOCK]  <-- Injected here
[Task XML]
```

This ensures the executor sees failure context BEFORE reading the task, allowing it to plan around known issues.

## Retry Counter Tracking

### State File Location

Retry state is tracked in `.ultraplan/state/retry-state.json`:

```json
{
  "task_retries": {
    "03-01:task-3": {
      "task_id": "03-01:task-3",
      "task_name": "Task 3: Create InvalidPlannerIdError class",
      "retry_count": 2,
      "max_retries": 3,
      "status": "retrying",
      "failures": [
        {
          "attempt": 1,
          "timestamp": "2026-01-26T14:30:00Z",
          "failure_type": "verification_failed",
          "error_summary": "2 tests failed",
          "suggested_fix": "Add null check"
        },
        {
          "attempt": 2,
          "timestamp": "2026-01-26T14:32:00Z",
          "failure_type": "verification_failed",
          "error_summary": "1 test failed",
          "suggested_fix": "Handle empty string case"
        }
      ],
      "current_attempt": 3,
      "started_at": "2026-01-26T14:28:00Z",
      "last_attempt_at": "2026-01-26T14:32:00Z"
    }
  },
  "global_stats": {
    "total_retries": 5,
    "successful_retries": 3,
    "escalations": 1
  }
}
```

### Counter Operations

| Operation | When | Action |
|-----------|------|--------|
| Initialize | Task starts | Set retry_count=0, status="executing" |
| Increment | Verification fails | retry_count++, add failure record |
| Reset | Task succeeds | Clear task entry from retry state |
| Escalate | retry_count > MAX | Set status="escalated", notify user |

### Task ID Format

Tasks are identified by: `{phase}-{plan}:task-{n}`

Examples:
- `03-01:task-3` - Phase 03, Plan 01, Task 3
- `02-05:task-1` - Phase 02, Plan 05, Task 1

This allows tracking retries across sessions and plans.

### State Transitions

```
                    ┌─────────────┐
                    │   pending   │
                    └──────┬──────┘
                           │ task dispatched
                           v
                    ┌─────────────┐
              ┌────>│  executing  │<────┐
              │     └──────┬──────┘     │
              │            │            │
              │     ┌──────┴──────┐     │
              │     │             │     │
              │  success        fail    │
              │     │             │     │
              │     v             v     │
              │ ┌───────┐   ┌─────────┐ │
              │ │  done │   │ retrying│─┘
              │ └───────┘   └────┬────┘
              │                  │
              │           {count > MAX?}
              │                  │
              │                 yes
              │                  │
              │                  v
              │            ┌───────────┐
              └────────────│ escalated │
                   (user   └───────────┘
                   resolves)
```

### Retry Window

Retries are tracked per execution session. If a user:
1. Aborts execution
2. Restarts later
3. Same task runs again

The retry counter resets to 0 (fresh session = fresh attempts).

To carry over retry state across sessions, the `started_at` timestamp can be compared with session start time.

## Escalation Protocol

### When to Escalate

Escalate to user when ANY of:

| Condition | Reason |
|-----------|--------|
| retry_count > MAX_RETRIES | Automated recovery exhausted |
| Permission denied errors | Cannot fix without user action |
| External service unavailable | Requires environment fix |
| Conflicting requirements detected | Needs human judgment |
| Executor reports "impossible" | Task may be ill-defined |

### Escalation Message Format

When escalating, present to user:

```
## Task Escalation Required

**Task:** {task_name}
**Plan:** {phase}-{plan}
**Attempts:** {retry_count} of {max_retries}

### Failure Summary

This task has failed {retry_count} times. Automated recovery has been exhausted.

### Attempt History

| Attempt | Timestamp | Failure Type | Error |
|---------|-----------|--------------|-------|
| 1 | 2026-01-26 14:30 | verification_failed | 2 tests failed |
| 2 | 2026-01-26 14:32 | verification_failed | 1 test failed |
| 3 | 2026-01-26 14:35 | verification_failed | Edge case not handled |

### Last Error Details

```
FAIL tests/PlannerId.test.ts
  - Expected InvalidPlannerIdError to be thrown for whitespace-only input
  - Received: undefined
```

### Files Modified (Partial State)

- `src/domain/PlannerId.ts` - Modified but incomplete
- `tests/PlannerId.test.ts` - Tests added

### Suggested Actions

1. **Review task definition** - Is <done> criteria achievable?
2. **Check test expectations** - Are tests correct?
3. **Manual intervention** - Fix the specific issue
4. **Skip task** - Mark as skipped and continue
5. **Abort plan** - Stop execution entirely

---

**Your options:**
- `retry` - Try one more time (resets counter)
- `skip` - Skip this task, continue with next
- `abort` - Stop plan execution
- `fix: <instruction>` - Provide specific fix instruction
```

### Handling User Response

| Response | Action |
|----------|--------|
| `retry` | Reset retry_count to 0, re-execute task |
| `skip` | Mark task as skipped, update STATE.md, continue |
| `abort` | Stop execution, preserve partial state |
| `fix: <instruction>` | Inject instruction as priority feedback, retry |

### Fix Instruction Injection

When user provides `fix: <instruction>`, inject as high-priority context:

```xml
<retry_context attempt="4" max_attempts="4">
  <user_intervention>
    <instruction priority="high">
      User provided fix: Check for whitespace using .trim() before UUID validation
    </instruction>
    <context>
      This instruction comes from the user after automated recovery failed.
      Treat this as authoritative guidance.
    </context>
  </user_intervention>

  <previous_failures>
    <!-- Previous 3 failures included -->
  </previous_failures>
</retry_context>
```

### Skip Handling

When task is skipped:

1. Update STATE.md:
```yaml
skipped_tasks:
  - task: "03-01:task-3"
    reason: "User escalation - automated recovery failed"
    timestamp: "2026-01-26T14:40:00Z"
```

2. Check dependencies:
   - If other tasks depend on skipped task: Warn user
   - If no dependencies: Continue normally

3. Log skip for summary:
```
[SKIPPED] Task 3: Create InvalidPlannerIdError class
  Reason: User escalation after 3 failed attempts
  Impact: Dependent tasks may fail
```

## Retry Logging

### Log File Location

Retry events are logged to `.ultraplan/logs/retry.log` (append-only):

```
[2026-01-26T14:30:00Z] [RETRY] [03-01:task-3] attempt=1 status=failed type=verification_failed
[2026-01-26T14:30:00Z] [RETRY] [03-01:task-3] error="2 tests failed: null check, empty string"
[2026-01-26T14:30:00Z] [RETRY] [03-01:task-3] suggested_fix="Add validation for null and empty"
[2026-01-26T14:30:01Z] [RETRY] [03-01:task-3] injecting_feedback attempt=2
[2026-01-26T14:32:00Z] [RETRY] [03-01:task-3] attempt=2 status=failed type=verification_failed
[2026-01-26T14:32:00Z] [RETRY] [03-01:task-3] error="1 test failed: empty string"
[2026-01-26T14:35:00Z] [RETRY] [03-01:task-3] attempt=3 status=failed type=verification_failed
[2026-01-26T14:35:01Z] [RETRY] [03-01:task-3] escalating reason="max_retries_exceeded"
[2026-01-26T14:40:00Z] [RETRY] [03-01:task-3] user_response="skip"
[2026-01-26T14:40:00Z] [RETRY] [03-01:task-3] resolved status=skipped
```

### Log Entry Types

| Type | When | Fields |
|------|------|--------|
| attempt | Each execution attempt | attempt, status, type |
| error | Failure details | error message (truncated to 200 chars) |
| suggested_fix | Fix suggestion generated | suggested fix text |
| injecting_feedback | Before retry dispatch | attempt number |
| escalating | Escalation triggered | reason |
| user_response | User responds to escalation | response type |
| resolved | Task terminates | final status |

### Structured Log (JSON)

For programmatic analysis, also write to `.ultraplan/logs/retry.jsonl`:

```json
{"timestamp":"2026-01-26T14:30:00Z","event":"attempt","task_id":"03-01:task-3","attempt":1,"status":"failed","failure_type":"verification_failed","error":"2 tests failed","duration_ms":45000}
{"timestamp":"2026-01-26T14:30:01Z","event":"feedback_injected","task_id":"03-01:task-3","attempt":2,"feedback_lines":15}
{"timestamp":"2026-01-26T14:32:00Z","event":"attempt","task_id":"03-01:task-3","attempt":2,"status":"failed","failure_type":"verification_failed","error":"1 test failed","duration_ms":42000}
{"timestamp":"2026-01-26T14:35:01Z","event":"escalated","task_id":"03-01:task-3","attempts":3,"reason":"max_retries_exceeded"}
{"timestamp":"2026-01-26T14:40:00Z","event":"resolved","task_id":"03-01:task-3","resolution":"skipped","total_attempts":3,"total_duration_ms":600000}
```

### Log Retention

| Log Type | Retention | Purpose |
|----------|-----------|---------|
| retry.log | 7 days | Human debugging |
| retry.jsonl | 30 days | Pattern analysis |
| retry-state.json | Session only | Active state |

### Debugging Commands

```bash
# View recent retries
tail -50 .ultraplan/logs/retry.log

# Count retries by task
grep "attempt=" .ultraplan/logs/retry.log | cut -d']' -f3 | sort | uniq -c

# Find escalations
grep "escalating" .ultraplan/logs/retry.log

# Analyze retry patterns (JSON)
cat .ultraplan/logs/retry.jsonl | jq 'select(.event=="resolved") | {task: .task_id, attempts: .total_attempts}'
```

### Retry Statistics

At plan completion, generate retry summary:

```
## Retry Summary for Plan 03-01

| Metric | Value |
|--------|-------|
| Total tasks | 5 |
| First-attempt success | 3 (60%) |
| Retried tasks | 2 (40%) |
| Retry success | 1 |
| Escalations | 1 |
| Skipped | 1 |

### Retry Details

| Task | Attempts | Result |
|------|----------|--------|
| Task 1 | 1 | success |
| Task 2 | 2 | success (retry worked) |
| Task 3 | 3 | skipped (escalated) |
| Task 4 | 1 | success |
| Task 5 | 1 | success |

### Common Failure Patterns

- verification_failed: 4 occurrences
- Missing edge case handling: 3 occurrences
- Import errors: 1 occurrence
```

This summary helps identify:
1. Task quality issues (tasks that always need retries)
2. Common failure patterns (for improving task definitions)
3. Execution efficiency (first-attempt success rate)
