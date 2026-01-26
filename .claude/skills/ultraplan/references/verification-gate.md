# Verification Gate Protocol

## Purpose

The verification gate is the quality control checkpoint through which every task must pass. Nothing commits without passing. This gate ensures:

- Verification commands actually run (not assumed)
- Results are captured with evidence
- Architect provides independent review
- Failures are caught before they compound

## Core Principle

**NO UNVERIFIED WORK COMMITS**

A task is NOT complete until:
1. Executor runs the task
2. Verify command returns exit code 0
3. Architect approves the implementation

All three steps must pass. Skip none.

## VERIFICATION GATE FLOW

```
┌─────────────────────────────────────────────────────────────────┐
│                     VERIFICATION GATE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐     ┌───────────────┐     ┌──────────────────┐   │
│  │ EXECUTOR │ ──> │ VERIFY COMMAND│ ──> │ ARCHITECT REVIEW │   │
│  └──────────┘     └───────────────┘     └──────────────────┘   │
│       │                   │                      │              │
│       │                   │                      │              │
│       v                   v                      v              │
│  ┌──────────┐     ┌───────────────┐     ┌──────────────────┐   │
│  │ Result:  │     │ Exit Code:    │     │ Verdict:         │   │
│  │ success/ │     │ 0 = pass      │     │ APPROVED/        │   │
│  │ failure/ │     │ !0 = fail     │     │ REJECTED         │   │
│  │ blocked  │     │               │     │                  │   │
│  └──────────┘     └───────────────┘     └──────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                      GATE OUTCOMES                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ALL PASS ──────────────> TASK COMPLETE ──> STATE UPDATE ──>   │
│                                              GIT COMMIT         │
│                                                                 │
│  ANY FAIL ──────────────> GATE FAILED ────> RETRY WITH ────>   │
│                                              FEEDBACK           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Flow States

| State | Meaning | Next Action |
|-------|---------|-------------|
| EXECUTING | Executor running task | Wait for result |
| VERIFYING | Running verify command | Check exit code |
| REVIEWING | Architect examining | Wait for verdict |
| APPROVED | Gate passed | Update STATE, commit |
| FAILED | Gate failed | Retry with feedback |
| BLOCKED | Cannot proceed | Analyze blocker |

## Step-by-Step Protocol

### Step 1: Executor Output

Executor completes and returns structured result:

```yaml
status: success | failure | blocked
task_name: "Task N: Name"
files_modified: [...]
verification:
  command: "{verify_command}"
  exit_code: {code}
  output_summary: "{summary}"
done_criteria_met: true | false
evidence: |
  {description}
error: null | "{error}"
```

**Gate Entry Conditions:**

| Executor Status | Gate Action |
|-----------------|-------------|
| `success` | Proceed to Step 2 (Verify Command) |
| `failure` | GATE FAILED - retry task |
| `blocked` | GATE BLOCKED - analyze dependencies |

### Step 2: Verify Command Check

The verification command from `<verify>` tag is the objective truth:

1. **Command was run during execution:**
   - Executor MUST have run the verify command
   - Exit code is captured in result

2. **Exit code determines pass/fail:**
   | Exit Code | Result |
   |-----------|--------|
   | 0 | PASS - proceed to Step 3 |
   | Non-zero | FAIL - gate failed |

3. **Evidence requirements:**
   - Command that was run
   - Actual output (stdout/stderr)
   - Exit code
   - Timestamp

**CRITICAL:** If executor claims success but verify exit code is non-zero, the gate FAILS. The verify command is the source of truth, not the executor's claim.

### Step 3: Architect Review

Architect agent (Opus) performs independent review:

1. **Inputs to Architect:**
   - Task XML (original requirements)
   - Executor result (files modified, evidence)
   - Verify command output

2. **Architect Checks:**
   - [ ] Files modified match `<files>` in task
   - [ ] Implementation matches `<action>` intent
   - [ ] Verify output shows actual success
   - [ ] `<done>` criteria is demonstrably met
   - [ ] No unintended side effects

3. **Architect Verdict:**
   ```yaml
   verdict: APPROVED | REJECTED
   task_name: "Task N: Name"
   confidence: HIGH | MEDIUM | LOW
   findings:
     - "Criterion X met: {evidence}"
     - "Criterion Y met: {evidence}"
   concerns: []  # or list of issues
   recommendation: "commit" | "retry" | "manual_review"
   ```

## What "Passing" Means

### Definition of PASS

A task PASSES the verification gate when ALL of these are true:

| Criterion | Evidence Required |
|-----------|-------------------|
| Executor reports success | `status: success` in result YAML |
| Verify command ran | `verification.command` is non-empty |
| Verify command passed | `verification.exit_code: 0` |
| Architect approved | `verdict: APPROVED` from architect |
| Done criteria met | `done_criteria_met: true` with evidence |

### Evidence Chain

Every passed task must have this evidence chain:

```
1. EXECUTOR EVIDENCE
   ├── Files created/modified (paths)
   ├── Actions taken (description)
   └── Verify command output (captured)

2. VERIFY EVIDENCE
   ├── Command run: {exact command}
   ├── Exit code: 0
   ├── Output: {stdout summary}
   └── Timestamp: {when run}

3. ARCHITECT EVIDENCE
   ├── Verdict: APPROVED
   ├── Confidence: HIGH/MEDIUM/LOW
   ├── Criteria checked: {list}
   └── Recommendation: commit
```

### Passing Examples

**Strong Pass (Ideal):**
```yaml
# Executor
status: success
verification:
  command: "npm test -- PlannerId"
  exit_code: 0
  output_summary: "5 tests passed"
done_criteria_met: true

# Architect
verdict: APPROVED
confidence: HIGH
findings:
  - "All 5 tests pass (verified output)"
  - "PlannerId class created with correct fields"
  - "Error handling implemented per spec"
recommendation: commit
```

**Weak Pass (Acceptable but flagged):**
```yaml
# Executor
status: success
verification:
  command: "npm run build"
  exit_code: 0
  output_summary: "Build succeeded with 3 warnings"
done_criteria_met: true

# Architect
verdict: APPROVED
confidence: MEDIUM  # Lower due to warnings
findings:
  - "Build passes"
  - "Feature implemented"
concerns:
  - "3 TypeScript warnings should be addressed"
recommendation: commit  # Still commits, but concern logged
```

### What is NOT a Pass

| Scenario | Result |
|----------|--------|
| Executor says success, verify exit code non-zero | FAIL |
| Verify passes, Architect rejects | FAIL |
| Executor success, no verify command run | FAIL |
| Architect approves without verify evidence | FAIL |
| "Tests probably pass" without running them | FAIL |

## Gate Failure Modes

### Failure Classification

| Failure Type | Trigger | Recovery |
|--------------|---------|----------|
| EXECUTION_FAILURE | Executor reports failure | Retry with feedback |
| VERIFY_FAILURE | Verify command exit != 0 | Fix and retry |
| ARCHITECT_REJECTION | Architect verdict REJECTED | Revise and retry |
| BLOCKED | Executor reports blocked | Resolve blocker |
| TIMEOUT | Step exceeds time limit | Manual intervention |
| MALFORMED | Invalid result format | Log and retry |

### Failure Mode Details

#### 1. EXECUTION_FAILURE

**Trigger:** Executor returns `status: failure`

**Evidence:**
```yaml
status: failure
task_name: "Task 3: Create PlannerId"
error: |
  Cannot find module 'uuid'
  Run `npm install uuid` first
```

**Recovery Path:**
1. Extract error message
2. Generate fix recommendation
3. Retry task with feedback appended to prompt:
   ```
   PREVIOUS ATTEMPT FAILED:
   Error: Cannot find module 'uuid'

   SUGGESTED FIX: Run `npm install uuid` first

   Please address this before retrying the task.
   ```

#### 2. VERIFY_FAILURE

**Trigger:** Verify command returns non-zero exit code

**Evidence:**
```yaml
verification:
  command: "npm test -- PlannerId"
  exit_code: 1
  output_summary: "1 passed, 2 failed"
```

**Recovery Path:**
1. Parse test output for specific failures
2. Include failure details in retry prompt:
   ```
   VERIFICATION FAILED:
   Command: npm test -- PlannerId
   Exit code: 1

   FAILURES:
   - PlannerId should validate UUID format
   - PlannerId should reject future dates

   Please fix the failing tests and re-verify.
   ```

#### 3. ARCHITECT_REJECTION

**Trigger:** Architect returns `verdict: REJECTED`

**Evidence:**
```yaml
verdict: REJECTED
confidence: HIGH
findings:
  - "Tests pass but implementation is incomplete"
concerns:
  - "Missing error handling for edge case"
  - "Documentation not updated"
recommendation: retry
feedback: |
  Implementation passes tests but:
  1. No error handling for null input
  2. JSDoc comments missing
```

**Recovery Path:**
1. Include Architect feedback in retry prompt:
   ```
   ARCHITECT REJECTED:

   Issues found:
   1. No error handling for null input
   2. JSDoc comments missing

   Please address these concerns and re-submit.
   ```

#### 4. BLOCKED

**Trigger:** Executor returns `status: blocked`

**Evidence:**
```yaml
status: blocked
error: |
  Required file not found: src/domain/PlannerId.ts
  This task depends on Task 2 which may not be complete.
```

**Recovery Path:**
1. Identify blocking dependency
2. Check if dependency task completed
3. If not: Queue dependency task first
4. If yes: Investigate state inconsistency

#### 5. TIMEOUT

**Trigger:** Step exceeds configured time limit

**Limits:**
| Step | Default Timeout | Max Allowed |
|------|-----------------|-------------|
| Executor | 5 minutes | 15 minutes |
| Verify Command | 2 minutes | 5 minutes |
| Architect Review | 3 minutes | 10 minutes |

**Recovery Path:**
1. Mark as TIMEOUT failure
2. Log partial progress
3. Offer options:
   - Retry with extended timeout
   - Manual intervention
   - Skip with warning

#### 6. MALFORMED

**Trigger:** Result doesn't match expected schema

**Examples:**
- Missing required fields
- Invalid YAML syntax
- Status value not in [success, failure, blocked]

**Recovery Path:**
1. Log malformed result
2. Retry task (agent may have context issue)
3. If repeated: Flag for manual review

## Escalation Rules

### Automatic Retry Policy

Before escalating, automatic retry is attempted:

| Failure Type | Max Retries | Retry Delay |
|--------------|-------------|-------------|
| EXECUTION_FAILURE | 2 | Immediate |
| VERIFY_FAILURE | 2 | Immediate |
| ARCHITECT_REJECTION | 1 | Immediate |
| TIMEOUT | 1 | 30 seconds |
| MALFORMED | 2 | Immediate |

### Escalation Triggers

Escalate to manual intervention when:

| Trigger | Threshold | Escalation Action |
|---------|-----------|-------------------|
| Repeated failures | Same task fails 3x | Pause and notify user |
| Consecutive rejects | Architect rejects 2x | Show feedback, ask user |
| Timeout exhausted | 2 timeouts on same task | Offer skip or investigate |
| Systemic failure | 3+ tasks fail in wave | Halt execution, full review |

### Escalation Protocol

```
ESCALATION LEVELS:

Level 1: Automatic Retry
├── Retry with feedback
└── Continue if succeeds

Level 2: User Notification
├── Display failure summary
├── Offer: Retry / Skip / Investigate
└── Wait for user input

Level 3: Execution Halt
├── Stop all task execution
├── Save state for resume
├── Require explicit user command to continue
```

## Manual Override

### When to Skip Gate

Gate can be skipped ONLY with explicit user override:

```
/ultraplan:skip-verify --task "Task 3" --reason "External dependency"
```

**Skip Conditions:**
| Condition | Allowed | Reason |
|-----------|---------|--------|
| Verify command unavailable | Yes | External service down |
| Time pressure | USER RISK | User accepts responsibility |
| Known false negative | Yes | Test bug, not code bug |
| "Tests take too long" | NO | Not a valid skip reason |
| "Looks good to me" | NO | Gate exists to prevent this |

### Skip Requirements

When gate is skipped:
1. **Reason logged:** Must document why
2. **User attribution:** Records who approved skip
3. **Warning in STATE:** Task marked with `(unverified)` flag
4. **No auto-commit:** Manual commit required

```yaml
# STATE.md entry for skipped verification
tasks:
  - name: "Task 3: Create PlannerId"
    status: complete (unverified)
    skip_reason: "External API rate limit exceeded"
    skipped_by: "user"
    skipped_at: "2026-01-26T14:30:00Z"
    requires_manual_commit: true
```

### Force Override

For complete gate bypass (emergency only):

```
/ultraplan:force-complete --task "Task 3" --override-all
```

**Force Override:**
- Bypasses ALL gate checks
- Requires confirmation: "This bypasses quality checks. Type 'OVERRIDE' to confirm"
- Logged with full audit trail
- Task marked `(forced)` in STATE
- Generates warning in SUMMARY

**STRONG RECOMMENDATION:** Never use force override. If you need it, the task or verification needs fixing, not bypassing.

## Gate Status Indicators

### Task-Level Status

Each task in STATE.md includes gate status:

```yaml
# STATE.md task status format
current_task:
  name: "Task 3: Create PlannerId"
  phase: "03-sequential-execution"
  plan: "03-01"

  # Gate status indicators
  gate_status: EXECUTING | VERIFYING | REVIEWING | APPROVED | FAILED | BLOCKED | SKIPPED
  gate_step: 1 | 2 | 3  # Current step (executor/verify/architect)

  # Step details
  executor_status: pending | running | success | failure | blocked
  verify_status: pending | running | passed | failed | skipped
  architect_status: pending | reviewing | approved | rejected

  # Timing
  started_at: "2026-01-26T14:00:00Z"
  last_step_at: "2026-01-26T14:02:30Z"

  # Retry tracking
  attempt: 1  # Current attempt number
  max_attempts: 3
  previous_failures: []  # List of failure reasons
```

### Visual Status Bar

STATE.md displays gate progress visually:

```
## Current Task: Task 3: Create PlannerId

Gate Progress: [####----] Step 2/3

[x] Step 1: Executor    - SUCCESS (14:00:15)
[~] Step 2: Verify      - RUNNING (14:02:30)
[ ] Step 3: Architect   - PENDING

Status: VERIFYING
```

### Status Transitions

```
PENDING ──> EXECUTING ──> VERIFYING ──> REVIEWING ──> APPROVED
                │              │             │
                v              v             v
              FAILED        FAILED       REJECTED
                │              │             │
                └──────────────┴─────────────┘
                               │
                               v
                         RETRY (back to EXECUTING)
```

### Aggregate Status

STATE.md shows aggregate gate statistics:

```yaml
# STATE.md gate statistics
gate_stats:
  total_tasks: 12
  passed: 8
  failed: 1
  in_progress: 1
  pending: 2

  # Pass rate
  pass_rate: "89%"  # passed / (passed + failed)

  # Average attempts
  avg_attempts: 1.3

  # Current gate
  current_gate:
    task: "Task 9: Integration tests"
    status: VERIFYING
    attempt: 1
```

### Failure Log

STATE.md includes recent failures for debugging:

```yaml
# STATE.md failure log
recent_failures:
  - task: "Task 5: Create validation"
    attempt: 1
    failure_type: VERIFY_FAILURE
    error: "Test timeout: async operation exceeded 5000ms"
    recovered: true
    resolution: "Added async timeout configuration"

  - task: "Task 7: Add error handling"
    attempt: 2
    failure_type: ARCHITECT_REJECTION
    error: "Missing edge case handling"
    recovered: true
    resolution: "Added null check per Architect feedback"
```

## Integration with Other Components

### How Gate Connects to System

```
┌─────────────────────────────────────────────────────────────┐
│                    ULTRA PLANNER SYSTEM                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PLAN.md ──> TASK QUEUE ──> EXECUTOR ──> VERIFICATION GATE │
│                                              │              │
│                                              v              │
│  STATE.md <── UPDATE <── GATE RESULT ────────┤              │
│                                              │              │
│                                              v              │
│  GIT COMMIT <── (if APPROVED) ───────────────┘              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Gate Responsibility |
|-----------|---------------------|
| Orchestrator | Invokes gate, handles results |
| Executor | Produces gate input (Step 1) |
| Verify Command | Objective truth check (Step 2) |
| Architect | Independent review (Step 3) |
| STATE.md | Records gate status |
| Git | Commits only APPROVED tasks |

### Gate Timing

Typical gate duration:

| Step | Typical | Max Allowed |
|------|---------|-------------|
| Executor | 30s - 3min | 15 min |
| Verify | 5s - 30s | 5 min |
| Architect | 10s - 1min | 10 min |
| **Total** | 1 - 5 min | 30 min |

## Best Practices

### Writing Good Verify Commands

**DO:**
```xml
<verify>npm test -- PlannerId</verify>          <!-- Specific test -->
<verify>grep -c "export class Foo" src/Foo.ts</verify>  <!-- Existence check -->
<verify>tsc --noEmit && npm test</verify>       <!-- Build + test -->
```

**DON'T:**
```xml
<verify>echo "done"</verify>           <!-- Always passes, proves nothing -->
<verify>npm test</verify>               <!-- Too broad, slow -->
<verify>cat file.ts</verify>            <!-- Shows file, doesn't verify -->
```

### Setting Good Done Criteria

**DO:**
```xml
<done>PlannerId class exists with id, createdAt, version properties; all 5 tests pass</done>
```

**DON'T:**
```xml
<done>Task complete</done>              <!-- Too vague -->
<done>It works</done>                   <!-- No measurable criteria -->
```

### Architect Review Tips

Architect should focus on:
1. **Does verify output match claims?** (Not just exit code 0)
2. **Are all `<done>` criteria actually met?** (Evidence required)
3. **Any unintended side effects?** (Scope creep check)
4. **Would this be safe to commit?** (Final sanity check)

### Handling Flaky Tests

If verify command is flaky (intermittent failures):
1. Do NOT skip verification
2. Fix the flaky test (better solution)
3. If unfixable: Run verify 2x, pass if either succeeds
4. Log flakiness in STATE.md concerns

## Reference

### Gate Result Schema

```yaml
# Complete gate result after all steps
gate_result:
  task: "Task N: Name"

  # Step results
  executor:
    status: success
    files_modified: [...]
    evidence: "..."

  verify:
    command: "npm test -- Name"
    exit_code: 0
    output: "5 tests passed"

  architect:
    verdict: APPROVED
    confidence: HIGH
    findings: [...]

  # Final outcome
  outcome: PASSED | FAILED
  duration_ms: 45000
  timestamp: "2026-01-26T14:05:00Z"

  # Post-gate actions
  commit_sha: "abc123"  # If approved and committed
  state_updated: true
```

### Quick Reference Table

| Question | Answer |
|----------|--------|
| What triggers gate? | Executor completes task |
| What does gate check? | Verify exit code + Architect approval |
| What if verify fails? | Retry with feedback |
| What if Architect rejects? | Retry with Architect feedback |
| Can I skip gate? | Only with explicit override + logged reason |
| What commits? | Only APPROVED tasks |
| Where is status? | STATE.md gate_status field |

---
*Verification Gate Protocol v1.0*
*Last updated: 2026-01-26*
