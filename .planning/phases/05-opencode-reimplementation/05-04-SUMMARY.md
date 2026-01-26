---
phase: 05
plan: 04
subsystem: recovery
tags: [error-handling, rollback, checkpoint, cooldown, state-management]

dependencies:
  requires: ["05-01", "02-01", "02-02", "02-04"]
  provides: ["recovery-module", "error-handling", "cooldown-timer"]
  affects: ["05-03", "06-01", "06-02"]

tech-stack:
  added: []
  patterns: ["cooldown-timer", "checkpoint-rollback", "state-recovery"]

key-files:
  created:
    - src/recovery/types.ts
    - src/recovery/rollback.ts
    - src/recovery/index.ts
  modified:
    - src/index.ts

decisions:
  - id: "05-04-01"
    title: "Default cooldown 5 seconds"
    choice: "5000ms default cooldown period"
    rationale: "Balances allowing transient issues to resolve without excessive delay"
  - id: "05-04-02"
    title: "Max 3 retries default"
    choice: "3 retry attempts before giving up"
    rationale: "After 3 failures, issue is likely not transient"
  - id: "05-04-03"
    title: "State-only rollback"
    choice: "Only roll back .ultraplan/state/, never source code"
    rationale: "Uses existing CheckpointManager which enforces this"

metrics:
  duration: "3m"
  completed: "2026-01-27"
---

# Phase 5 Plan 4: Error Recovery Module Summary

**One-liner:** Error recovery with Git rollback, cooldown timer, and Ralph Loop state clearing for resilient task execution

## What Was Built

The recovery module provides error handling with checkpoint rollback integration for Ralph Loop execution. When errors occur:

1. **Error state tracked** - errorCount incremented, lastError recorded
2. **Max retries checked** - Emits `ralph_loop_failed` if exceeded
3. **State rolled back** - Restores `.ultraplan/state/` to last checkpoint
4. **Ralph Loop cleared** - Allows fresh retry
5. **Cooldown set** - Prevents rapid retry loops

### Core Exports

```typescript
// Types
export interface RecoveryState { isRecovering, lastErrorAt, errorCount, lastError, cooldownUntil }
export interface RecoveryConfig { cooldownMs?, maxRetries?, rollbackOnError? }
export interface RecoveryResult { success, canRetry, retryAfter, action, error? }

// Constants
export const DEFAULT_COOLDOWN_MS = 5000;  // 5 seconds
export const DEFAULT_MAX_RETRIES = 3;
export const RECOVERY_STATE_FILE = 'recovery';

// Functions
export function getRecoveryState(): RecoveryState;
export function setRecoveryState(state: Partial<RecoveryState>): boolean;
export function clearRecoveryState(): boolean;
export function canRetry(config?: RecoveryConfig): boolean;
export function handleError(error: Error, context: { phase: string; plan: number }, config?: RecoveryConfig): RecoveryResult;
```

### Integration Points

| From | To | Via |
|------|-----|-----|
| recovery/rollback.ts | state/checkpoint.ts | getLatestCheckpoint, rollbackToCheckpoint |
| recovery/rollback.ts | loops/ralph/state.ts | clearRalphLoopState |
| recovery/rollback.ts | state/event-system.ts | emitEvent (ralph_loop_failed, rollback_initiated) |

## Task Execution

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create recovery types and constants | b945ead | src/recovery/types.ts |
| 2 | Implement recovery logic with checkpoint rollback | 97e892c | src/recovery/rollback.ts |
| 3 | Create recovery module exports | 9e39c9d | src/recovery/index.ts, src/index.ts |

## Verification Results

- Build: `npm run build` exits with code 0
- Exports: All 8 functions/constants accessible from main index
- State management: get/set/clear work correctly
- Cooldown: Respects cooldownUntil and expires correctly
- Max retries: Enforces DEFAULT_MAX_RETRIES (3)
- Rollback: Calls getLatestCheckpoint and rollbackToCheckpoint
- Ralph Loop: Calls clearRalphLoopState
- Events: ralph_loop_failed and rollback_initiated emitted

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

### 05-04-01: Default cooldown 5 seconds
- **Context:** How long to wait before allowing retry
- **Options:** 1s (too short), 5s (balanced), 30s (too long)
- **Choice:** 5000ms
- **Rationale:** Allows transient network/rate-limit issues to resolve without excessive delay

### 05-04-02: Max 3 retries default
- **Context:** How many failures before giving up
- **Options:** 1 (too aggressive), 3 (balanced), 10 (too persistent)
- **Choice:** 3 retries
- **Rationale:** After 3 failures, issue is likely not transient

### 05-04-03: State-only rollback
- **Context:** What to restore on error
- **Choice:** Only `.ultraplan/state/`, never source code
- **Rationale:** Existing CheckpointManager already enforces this via git checkout --path

## Next Phase Readiness

**Unblocks:**
- 05-03 (Orchestrator hooks) - Can use handleError for error recovery
- 06-xx (Phase 6) - Recovery module ready for integration

**Dependencies satisfied:**
- 05-01 (Ralph Loop state): clearRalphLoopState function available
- 02-01 (State manager): StateManager used for persistence
- 02-02 (Event system): emitEvent for recovery events
- 02-04 (Checkpoint): getLatestCheckpoint, rollbackToCheckpoint

**State file location:**
- `.ultraplan/state/recovery.json`
