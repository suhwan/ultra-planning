---
phase: 07-cli-commands
plan: 03
subsystem: cli-commands
tags: [command, execution, router-protocol, task-sync]
requires:
  - 06-02 (Wave dependency model)
  - router.md (Router Protocol)
  - ultraplan-executor.md (Executor agent)
  - ultraplan-architect.md (Architect agent)
provides:
  - /ultraplan:execute command with full Router Protocol integration
  - Shorthand resolution for plan paths
  - Claude Tasks API synchronization
  - State management across PLAN.md, STATE.md, and Claude Tasks
affects:
  - 07-04 (May reference this command)
  - Future CLI commands (pattern to follow)
tech-stack:
  added: []
  patterns:
    - Shorthand path resolution with phase discovery
    - Wave-based task queue management
    - Multi-layer state synchronization
key-files:
  created: []
  modified:
    - .claude/commands/ultraplan-execute.md
decisions:
  - id: shorthand-resolution
    choice: "Phase directory discovery via ls -d .planning/phases/{padded}-*"
    rationale: "Handles phase name changes without hardcoding"
  - id: prerequisite-validation
    choice: "Check PLAN.md, STATE.md, and both agents before execution"
    rationale: "Fail fast with clear error messages"
  - id: unattended-mode
    choice: "Auto-retry up to 3 times, skip confirmations"
    rationale: "Enable /thorough all for batch execution"
metrics:
  duration: 3m
  completed: 2026-01-27
---

# Phase 7 Plan 03: Complete /ultraplan:execute Command Summary

Complete Router Protocol integration with task sync and full execution loop for the /ultraplan:execute command.

## One-liner

Shorthand resolution, prerequisite validation, Router Protocol execution loop, Claude Tasks sync, and comprehensive error handling for /ultraplan:execute command.

## What Was Built

### Task 1: Finalized ultraplan-execute Command
- **Added shorthand resolution**: parse_plan_path() with phase directory discovery
  - Accepts: "07-01", "07-01-PLAN.md", or full path
  - Resolves to: `.planning/phases/07-cli-commands/07-01-PLAN.md`
  - Discovers phase directory via `ls -d .planning/phases/${padded}-*`
- **Added prerequisite validation**: Checks for PLAN.md, STATE.md, and required agents
  - Validates file existence and readability
  - Provides specific error messages and suggestions
- **Documented Router Protocol execution loop**:
  - For each task: Check deps → Spawn Executor → Spawn Architect → Commit
  - Retry logic: Up to 3 times with feedback
  - Unattended mode: Auto-retry, no confirmations
- **Added progress and completion display formats**:
  - Live progress: `[=====-----] 2/5 tasks complete`
  - Completion summary: Total time, commits, files modified, must_haves verified

### Task 2: Added Task Queue and State Management
- **Task queue building section**:
  - Parse PLAN.md frontmatter and task XML
  - Derive wave from section headers
  - Build dependency map (Wave N blocked by all Wave 0..N-1)
  - Skip completed tasks on resume
- **Claude Tasks API integration**:
  - Register tasks with TaskCreate before execution
  - Map wave dependencies to blockedBy field
  - Store task_id → claude_task_id mapping
  - Enable visual tracking in Claude UI
- **State synchronization**:
  - Update PLAN.md task_states frontmatter
  - Update STATE.md progress section
  - Sync Claude Tasks status after each completion
  - Resume protocol: Read states, re-register pending tasks
- **Error handling table**:
  - 10 error types with responses and recovery strategies
  - Retry strategies for Executor/Architect failures
  - Agent spawn retry with backoff
  - Permanent failure handling

## Decisions Made

### 1. Shorthand Resolution Strategy
**Decision:** Use `ls -d .planning/phases/{padded}-*` for phase directory discovery

**Rationale:**
- Handles phase name changes without hardcoding phase names
- Supports both numbered and named phases
- Falls back gracefully with clear error messages

**Alternatives considered:**
- Hardcode phase names: Too brittle
- Require full paths only: Less user-friendly

### 2. Prerequisite Validation Approach
**Decision:** Check all prerequisites before execution starts

**Rationale:**
- Fail fast with specific error messages
- Prevents partial execution with missing dependencies
- Clear guidance for fixing issues

**Alternatives considered:**
- Validate during execution: Wastes time on long-running tasks
- Skip validation: Poor user experience on errors

### 3. Unattended Mode Design
**Decision:** Auto-retry up to 3 times, skip all confirmations

**Rationale:**
- Enables `/thorough all` batch execution
- Balances automation with safety (max 3 retries)
- Only stops for permanent failures

**Alternatives considered:**
- Always prompt: Breaks batch execution
- Unlimited retries: Could loop forever

## Technical Implementation

### Shorthand Resolution Algorithm
```bash
parse_plan_path() {
  # 1. Try as-is if full path
  # 2. Extract phase and plan numbers
  # 3. Pad phase number (07)
  # 4. Discover phase directory
  # 5. Construct full path
}
```

### Task Queue Structure
- Ordered by: wave (ASC), index (ASC)
- Dependencies: Wave N blocked by all Wave 0..N-1
- Resume: Skip tasks with state='done' in frontmatter

### State Synchronization Layers
1. **PLAN.md frontmatter**: task_states map (source of truth)
2. **STATE.md**: Progress bar, last activity
3. **Claude Tasks**: Visual tracking (session-scoped)

### Error Recovery Flow
```
Executor/Architect Failure
  → Retry 1: Add feedback, retry
  → Retry 2: Add detailed feedback, retry
  → Retry 3 (max): Prompt user [r/s/a]
```

## Files Modified

### .claude/commands/ultraplan-execute.md
- **Before**: 220 lines, basic structure with placeholders
- **After**: 487 lines, complete Router Protocol integration
- **Changes**:
  - Added shorthand resolution (38 lines)
  - Expanded prerequisite validation (42 lines)
  - Documented task queue building (52 lines)
  - Added Claude Tasks integration (63 lines)
  - Added state synchronization (31 lines)
  - Expanded error handling (41 lines)

## Verification

### Shorthand Resolution
```bash
# ✓ Verified parse_plan_path() function documented
grep -A 20 "parse_plan_path()" .claude/commands/ultraplan-execute.md
```

### Execution Loop
```bash
# ✓ Verified Router Protocol execution loop documented
grep -A 15 "Main Execution Loop" .claude/commands/ultraplan-execute.md
```

### State Synchronization
```bash
# ✓ Verified state sync sections present
grep "Claude Tasks Registration\|State Synchronization" .claude/commands/ultraplan-execute.md
```

### Error Handling
```bash
# ✓ Verified comprehensive error table
grep -A 10 "Comprehensive error handling" .claude/commands/ultraplan-execute.md
```

## Integration Points

### With Router Protocol
- References `.claude/skills/ultraplan/references/router.md`
- Implements execution loop from Router Protocol
- Follows state machine transitions

### With Executor Agent
- Spawns via Task tool: `subagent_type="ultraplan-executor"`
- Passes task XML and retry feedback
- Captures structured YAML result

### With Architect Agent
- Spawns via Task tool: `subagent_type="ultraplan-architect"`
- Passes task XML and executor result
- Captures APPROVED/REJECTED verdict

### With Claude Tasks API
- TaskCreate for registration
- TaskUpdate for status sync
- Maps wave dependencies to blockedBy

### With STATE.md
- Reads current position on start
- Updates progress after each task
- Records last activity timestamp

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Blockers:** None

**Recommendations for 07-04:**
1. Reference this command as pattern for other CLI commands
2. Use same shorthand resolution approach
3. Follow same prerequisite validation pattern

**Concerns:** None

## Lessons Learned

### What Worked Well
1. **Shorthand resolution with phase discovery**: Flexible and resilient to phase name changes
2. **Multi-layer state sync**: PLAN.md as source of truth, Claude Tasks for visibility
3. **Comprehensive error handling**: Clear recovery strategies for each error type

### What Could Be Improved
- Consider caching phase directory lookups for repeated executions
- Add progress estimation based on historical task durations

### Patterns to Reuse
- Prerequisite validation with specific error messages
- Wave-based dependency resolution
- Three-tier state synchronization (PLAN.md → STATE.md → Claude Tasks)

## References

- Router Protocol: `.claude/skills/ultraplan/references/router.md`
- Executor Agent: `.claude/agents/ultraplan-executor.md`
- Architect Agent: `.claude/agents/ultraplan-architect.md`
- Wave Dependency Model: Decision from 06-02

## Commits

1. `4ec658a` - feat(07-03): finalize ultraplan-execute command
2. `650b4c0` - feat(07-03): add task queue and state management sections

---

*Summary completed: 2026-01-27*
*Total duration: 3 minutes*
*Status: SUCCESS*
