# Plan 03-06 Summary: Retry Loop with Failure Feedback

**Status:** Complete
**Phase:** 03-sequential-execution
**Date:** 2026-01-26

## Objective Achieved

Created complete retry loop protocol specification with structured failure feedback injection at `/home/ubuntu/code/ultra-planning/.claude/skills/ultraplan/references/retry-protocol.md`.

## Deliverables

### 1. Retry Protocol Document (498 lines)

**File:** `.claude/skills/ultraplan/references/retry-protocol.md`

**Contents:**

#### Core Protocol
- **Retry Loop Flow**: Execution → Verification → Failure Capture → Retry/Escalate
- **Constants**: MAX_RETRIES=3, immediate retry (no delay), escalation threshold
- **Loop Diagram**: ASCII flow showing all decision points

#### Retry Triggers
- **When to Retry**: Verification fails, executor reports failure, timeout, architect rejection
- **When NOT to Retry**: Blocked tasks, malformed XML, permission errors, user abort
- Clear differentiation between retriable vs. non-retriable failures

#### Failure Feedback System
- **Failure Record Schema**: YAML format capturing attempt, timestamp, failure type, executor output
- **Failure Types**: execution_error, verification_failed, timeout, architect_rejected
- **RETRY CONTEXT Block**: XML format for injecting feedback into executor prompt
- **Injection Placement**: Before task XML in executor prompt for early awareness

#### Counter Tracking
- **State File**: `.ultraplan/state/retry-state.json` with per-task retry tracking
- **Counter Operations**: Initialize, increment, reset, escalate
- **Task ID Format**: `{phase}-{plan}:task-{n}` for cross-session tracking
- **State Transitions**: pending → executing → done/retrying/escalated diagram

#### Escalation Protocol
- **Escalation Triggers**: Max retries exceeded, permission denied, external service unavailable, conflicting requirements, executor reports impossible
- **Escalation Message**: User-friendly format with attempt history, error details, suggested actions
- **User Response Handling**: retry (reset counter), skip (mark skipped), abort (stop), fix (inject instruction)
- **Skip Handling**: STATE.md updates, dependency impact warnings

#### Logging System
- **retry.log**: Human-readable append-only log with timestamps and events
- **retry.jsonl**: Structured JSON log for programmatic analysis
- **Log Entry Types**: attempt, error, suggested_fix, injecting_feedback, escalating, user_response, resolved
- **Retention Policy**: 7 days (text), 30 days (JSON), session only (state)
- **Debugging Commands**: tail, grep, jq queries for pattern analysis
- **Retry Statistics**: Plan completion summary with success rates, common patterns

## Key Design Decisions

### 1. Smart Retry with Context
Each retry attempt receives accumulated failure context, preventing repeated mistakes from the same root cause.

### 2. Three-Strike Rule
Balance between persistence (giving automation a chance) and token efficiency (escalating when truly stuck).

### 3. Immediate Retry
No artificial delays - Tasks API has no rate limits, so retry immediately after failure capture.

### 4. User-Friendly Escalation
Escalation messages provide full context and actionable options (retry/skip/abort/fix) rather than just "it failed."

### 5. Dual Logging
Human-readable text logs for debugging + structured JSON for pattern analysis and metrics.

## Integration Points

### Links to Other Components

1. **Executor Agent** (`ultraplan-executor.md`)
   - Receives `<retry_context>` block in prompt
   - Must check for retry context before execution
   - Can report status: blocked for impossible tasks

2. **State Protocol** (`state-protocol.md`)
   - Retry state stored in `.ultraplan/state/retry-state.json`
   - Follows standard state file patterns
   - Counter tracking via retry_count field

3. **Verification Protocol** (`verification-protocol.md`)
   - Verification failures trigger retry loop
   - Exit codes and output captured for feedback
   - Architect verification results feed into retry decision

4. **Task Queue** (future implementation)
   - Retrying tasks re-enter queue with priority
   - Retry state affects scheduling decisions
   - Escalated tasks block dependent tasks

## Examples

### Example 1: Verification Failure with Successful Retry

```
Attempt 1: PlannerId validation fails 2 tests
  → Capture: Missing null check
  → Inject: "Add null validation before UUID check"
  → Retry

Attempt 2: Success
  → All tests pass
  → Clear retry state
```

### Example 2: Max Retries with Escalation

```
Attempt 1: Import error
  → Fix: Add missing import

Attempt 2: Type error
  → Fix: Correct type annotations

Attempt 3: Edge case failure
  → Escalate to user with full history

User Response: fix: "Use .trim() before validation"
  → Inject user fix as high-priority
  → Retry (counter reset)

Attempt 4: Success
```

## Testing Strategy

### Unit Tests Needed
- [ ] Retry counter increment/reset logic
- [ ] Failure record capture and formatting
- [ ] XML feedback injection builder
- [ ] State file read/write operations
- [ ] User response parser

### Integration Tests Needed
- [ ] End-to-end retry loop with mock executor
- [ ] Escalation flow with user interaction
- [ ] Log file writing and rotation
- [ ] Retry statistics calculation

### Edge Cases to Test
- [ ] Retry during session restart
- [ ] Multiple tasks retrying simultaneously
- [ ] Corrupted retry state file recovery
- [ ] User abort during retry
- [ ] Network timeout vs code failure distinction

## Metrics to Track

### Success Metrics
- **First-Attempt Success Rate**: % of tasks passing on first try
- **Retry Success Rate**: % of retries that succeed before escalation
- **Escalation Rate**: % of tasks requiring user intervention
- **Average Retries per Failed Task**: Efficiency of retry logic

### Quality Metrics
- **Common Failure Patterns**: Top reasons for retries (guides task improvement)
- **Retry Time Cost**: Token usage per retry attempt
- **User Response Time**: How long users take to resolve escalations

## Next Steps

### Immediate
1. Implement retry state manager (read/write retry-state.json)
2. Build feedback injection logic (generate `<retry_context>` XML)
3. Add retry loop to executor dispatcher

### Near-term
4. Implement escalation UI (format messages, parse responses)
5. Add retry logging (text + JSON writers)
6. Create retry statistics aggregator

### Future Enhancements
- Adaptive MAX_RETRIES based on task complexity
- ML-based failure prediction
- Automatic fix suggestions using patterns from successful retries
- Cross-project retry pattern sharing

## Files Created

```
.claude/skills/ultraplan/references/retry-protocol.md (498 lines, 16KB)
```

## Verification Results

All verification checks passed:
- ✓ RETRY LOOP PROTOCOL section exists
- ✓ MAX_RETRIES constant documented
- ✓ Retry triggers specified
- ✓ RETRY CONTEXT block format defined
- ✓ Feedback injection format complete
- ✓ previous_failures element documented (4 occurrences)
- ✓ retry_count tracking specified (10 occurrences)
- ✓ retry-state.json schema defined (2 references)
- ✓ State transitions diagram included
- ✓ Escalation protocol complete
- ✓ Escalation message format provided
- ✓ User response handling specified
- ✓ Retry logging documented
- ✓ retry.log format defined (5 references)
- ✓ retry.jsonl structured log specified (3 references)
- ✓ Retry statistics summary format included
- ✓ Document length: 498 lines (exceeds 180-line minimum)

## Success Criteria Checklist

- [x] Reference document created at `.claude/skills/ultraplan/references/retry-protocol.md`
- [x] Retry loop flow documented with diagram
- [x] Retry trigger conditions defined (when to retry vs escalate)
- [x] Feedback injection format specified with `<retry_context>` XML block
- [x] Feedback placement rule: BEFORE task XML in prompt
- [x] Retry counter tracking with state file schema
- [x] State transitions documented (pending → executing → done/retrying/escalated)
- [x] Escalation protocol with user message format
- [x] User response handling (retry, skip, abort, fix)
- [x] Skip handling with dependency impact warning
- [x] Retry logging to .ultraplan/logs/retry.log
- [x] Structured JSON log to .ultraplan/logs/retry.jsonl
- [x] Debugging commands documented
- [x] Retry statistics summary format
- [x] At least 180 lines of specification content (498 lines delivered)

## Conclusion

The retry loop protocol provides a complete specification for intelligent failure recovery. The system captures failure context, injects structured feedback into retry attempts, tracks retry state across tasks, escalates gracefully when automation cannot succeed, and logs comprehensively for debugging and pattern analysis.

Key strengths:
- **Smart retries**: Each attempt is informed by previous failures
- **User-friendly escalation**: Clear context and actionable options
- **Comprehensive logging**: Both human-readable and machine-parseable
- **Flexible recovery**: Supports user intervention and fix injection
- **Metrics-driven**: Statistics reveal task quality issues

This protocol is ready for implementation in the sequential execution engine.
