# Summary: Plan 03-04 - Verification Gate Protocol

**Plan:** 03-sequential-execution/03-04
**Date:** 2026-01-26
**Status:** Complete

## Objective

Define the verification gate protocol that every task must pass before being marked complete. This ensures no unverified work is committed to the codebase, preventing broken builds and incomplete implementations.

## What Was Delivered

### Primary Artifact
- **verification-gate.md** (734 lines) - Complete verification gate protocol reference

### Updated Documentation
- **state-protocol.md** - Added gate status update events and status value definitions

## Verification Gate Protocol Overview

### Three-Step Flow
Every task passes through this gate:

```
EXECUTOR → VERIFY COMMAND → ARCHITECT REVIEW → APPROVED
```

All three steps must pass. Skip none.

### Core Components

1. **Step 1: Executor Output**
   - Executor completes task and returns structured result
   - Status: success/failure/blocked
   - Verification command must be run and exit code captured
   - Evidence of work provided

2. **Step 2: Verify Command Check**
   - Exit code 0 = pass, non-zero = fail
   - Verify command is the objective truth
   - Evidence requirements: command, output, exit code, timestamp

3. **Step 3: Architect Review**
   - Independent review by Opus-level architect
   - Checks implementation matches intent
   - Verifies done criteria demonstrably met
   - Verdict: APPROVED or REJECTED

### What "Passing" Means

A task passes when ALL are true:
- Executor reports success
- Verify command ran with exit code 0
- Architect approved with APPROVED verdict
- Done criteria met with evidence

### Gate Failure Modes

Documented 6 failure types with recovery paths:
1. **EXECUTION_FAILURE** - Retry with feedback
2. **VERIFY_FAILURE** - Fix and retry with test output
3. **ARCHITECT_REJECTION** - Revise per feedback and retry
4. **BLOCKED** - Resolve dependency blocker
5. **TIMEOUT** - Retry with extended timeout or manual intervention
6. **MALFORMED** - Log and retry

### Escalation Rules

**Automatic Retry Policy:**
- EXECUTION_FAILURE: 2 retries max
- VERIFY_FAILURE: 2 retries max
- ARCHITECT_REJECTION: 1 retry max
- TIMEOUT: 1 retry max

**Escalation Triggers:**
- Same task fails 3x → User notification
- Architect rejects 2x → Show feedback, ask user
- 2 timeouts → Offer skip or investigate
- 3+ tasks fail in wave → Halt execution for full review

### Manual Override

**Skip Verification:**
```
/ultraplan:skip-verify --task "Task 3" --reason "External dependency"
```

Requirements:
- Reason must be logged
- User attribution recorded
- Task marked `(unverified)` in STATE
- No auto-commit (manual commit required)

**Force Override (emergency only):**
```
/ultraplan:force-complete --task "Task 3" --override-all
```

Requires confirmation, full audit trail, generates warnings.

### Gate Status Indicators

Added to STATE.md for tracking:

**Gate Status Values:**
- EXECUTING - Executor running
- VERIFYING - Running verify command
- REVIEWING - Architect examining
- APPROVED - All steps passed
- FAILED - One or more steps failed
- BLOCKED - Cannot proceed (dependency)
- SKIPPED - User bypassed gate

**Status Fields:**
```yaml
gate_status: EXECUTING | VERIFYING | REVIEWING | APPROVED | FAILED
gate_step: 1 | 2 | 3
executor_status: pending | running | success | failure
verify_status: pending | running | passed | failed
architect_status: pending | reviewing | approved | rejected
attempt: 1
max_attempts: 3
```

### Integration

Gate connects to system:
```
PLAN.md → TASK QUEUE → EXECUTOR → VERIFICATION GATE
                                         ↓
STATE.md ← UPDATE ← GATE RESULT          ↓
                                         ↓
GIT COMMIT ← (if APPROVED) ──────────────┘
```

### Best Practices

**Good Verify Commands:**
```xml
<verify>npm test -- PlannerId</verify>
<verify>grep -c "export class Foo" src/Foo.ts</verify>
<verify>tsc --noEmit && npm test</verify>
```

**Bad Verify Commands:**
```xml
<verify>echo "done"</verify>          <!-- Always passes -->
<verify>npm test</verify>              <!-- Too broad -->
<verify>cat file.ts</verify>           <!-- Doesn't verify -->
```

**Good Done Criteria:**
```xml
<done>PlannerId class exists with id, createdAt, version properties; all 5 tests pass</done>
```

## State Protocol Updates

Added gate status tracking to state-protocol.md:

**Gate Events that Update STATE.md:**
- Task starts execution → gate_status: EXECUTING
- Executor completes → executor_status updated
- Verify command runs → gate_status: VERIFYING
- Verify passes/fails → verify_status updated
- Architect starts → gate_status: REVIEWING
- Architect verdict → architect_status updated
- Gate passes → gate_status: APPROVED, task: complete
- Gate fails → gate_status: FAILED, attempt++
- Retry starts → gate_status: EXECUTING, reset statuses

## Success Criteria Met

- [x] Verification gate reference file created (734 lines)
- [x] Three-step flow documented (Executor → Verify Command → Architect Review)
- [x] "Passing" definition is clear with evidence requirements
- [x] All failure modes documented with recovery paths
- [x] Escalation rules defined with thresholds
- [x] Manual override requires explicit user action and is logged
- [x] Gate status indicators defined for STATE.md
- [x] State protocol updated with gate status events
- [x] Best practices for verify commands included
- [x] At least 200 lines of documentation (734 lines delivered)

## Key Links Established

**verification-gate.md → ultraplan-executor.md**
- Via: Executor outputs trigger gate entry
- Pattern: `status: success`

**verification-gate.md → ultraplan-architect.md**
- Via: Architect performs final review step
- Pattern: `ARCHITECT REVIEW`

## Impact

This protocol ensures:
1. **No Unverified Work** - Every task must pass objective verification
2. **Evidence-Based Completion** - Claims require proof
3. **Independent Review** - Architect provides quality gate
4. **Automatic Recovery** - Failures trigger retry with feedback
5. **Manual Safety Valve** - Override mechanisms for edge cases
6. **Full Traceability** - STATE.md tracks gate progress
7. **Safe Commits** - Only APPROVED tasks commit to git

## Files Modified

- `.claude/skills/ultraplan/references/verification-gate.md` (created, 734 lines)
- `.claude/skills/ultraplan/references/state-protocol.md` (updated with gate status)

## Notes

The verification gate is the critical quality control mechanism. It prevents the common failure mode of claiming completion without actually running verification. The three-step flow (Executor → Verify → Architect) creates multiple layers of validation with objective evidence at each step.

The escalation rules ensure automatic recovery for common failures while surfacing systemic issues that need manual intervention. Manual override mechanisms exist but require explicit user action with full audit trails.

Integration with STATE.md provides real-time visibility into gate progress, making it easy to see where tasks are in the verification pipeline.

---
*Plan 03-04 Complete - Verification Gate Protocol Documented*
