---
phase: 05-opencode-reimplementation
plan: 01
subsystem: loops
tags: [ralph-loop, persistence, state, detection]
dependency-graph:
  requires: [02-state-management]
  provides: [ralph-loop-state, completion-detection, continuation-prompt]
  affects: [05-02-orchestrator-hooks]
tech-stack:
  added: []
  patterns: [file-based-state-persistence, promise-tag-detection]
key-files:
  created:
    - src/loops/ralph/types.ts
    - src/loops/ralph/state.ts
    - src/loops/ralph/detection.ts
    - src/loops/ralph/index.ts
    - src/loops/index.ts
  modified:
    - src/index.ts
decisions:
  - decision: "No session ID tracking - use state file existence"
    rationale: "Claude Code sessions don't have stable IDs across restarts"
  - decision: "Case-insensitive and whitespace-tolerant pattern matching"
    rationale: "Flexibility in completion tag format reduces false negatives"
  - decision: "Mode registry integration with 'executing' mode"
    rationale: "Prevents concurrent Ralph Loops and conflicts with other modes"
metrics:
  duration: 3m
  completed: 2026-01-27
---

# Phase 5 Plan 1: Ralph Loop State Persistence Summary

Ralph Loop module with file-based state persistence, completion detection via `<promise>TAG</promise>` pattern, and continuation prompt generation using existing StateManager.

## Objective

Enable the orchestrator to track multi-iteration task execution with completion detection, allowing tasks to continue until they're truly done (via `<promise>DONE</promise>` output) or max iterations reached.

## What Was Built

### Core Components

1. **types.ts** - Type definitions and constants
   - `RalphLoopState` interface with all required fields
   - `RalphLoopConfig` interface for optional overrides
   - Constants: `DEFAULT_MAX_ITERATIONS` (100), `DEFAULT_COMPLETION_PROMISE` ('DONE')

2. **state.ts** - State persistence via StateManager
   - `readRalphLoopState()` - Returns null when file doesn't exist
   - `writeRalphLoopState()` - Atomic writes to `.ultraplan/state/ralph-loop.json`
   - `clearRalphLoopState()` - Removes state file for clean shutdown
   - `incrementIteration()` - Returns new state with incremented counter

3. **detection.ts** - Completion detection
   - `detectCompletion(text, promise)` - Case-insensitive, whitespace-tolerant
   - `escapeRegex()` - Safely escapes regex special characters
   - `COMPLETION_TAG_PATTERN` - Generic pattern for any promise tag

4. **index.ts** - Module entry with lifecycle functions
   - `startRalphLoop(prompt, config?)` - Creates state and registers mode
   - `endRalphLoop()` - Clears state and unregisters mode
   - `isRalphLoopActive()` - Checks if loop is active
   - `buildContinuationPrompt(state)` - Generates continuation message

### Integration Points

| Component | How Ralph Loop Uses It |
|-----------|------------------------|
| StateManager | File-based state persistence at `.ultraplan/state/ralph-loop.json` |
| ModeRegistry | Registers as 'executing' mode with `{ mode: 'ralph-loop' }` metadata |
| canStartMode | Prevents starting if another exclusive mode is active |

## Decisions Made

1. **No session ID tracking** - Claude Code sessions don't have stable IDs across restarts. State file existence is the primary signal for loop continuation.

2. **Case-insensitive pattern matching** - `<promise>DONE</promise>`, `<Promise>done</Promise>`, and `<PROMISE> DONE </PROMISE>` all match. Reduces false negatives from formatting variations.

3. **Mode registry integration** - Ralph Loop uses 'executing' mode from the mode registry. This prevents concurrent loops and conflicts with planning/verifying modes.

4. **Continuation prompt template** - Includes iteration count, max iterations, promise tag, and original task. Clear system directive format for easy identification.

## Verification Results

| Check | Result |
|-------|--------|
| Build passes | Yes - `npm run build` succeeds |
| Exports available | Yes - All functions exported from main index |
| State persistence | Yes - StateManager integration works |
| Detection accuracy | Yes - All test cases pass |
| Mode registry | Yes - startMode/endMode integration works |

## Deviations from Plan

None - plan executed exactly as written.

## Files Changed

### Created
- `src/loops/ralph/types.ts` - 120 lines
- `src/loops/ralph/state.ts` - 111 lines
- `src/loops/ralph/detection.ts` - 89 lines
- `src/loops/ralph/index.ts` - 214 lines
- `src/loops/index.ts` - 11 lines

### Modified
- `src/index.ts` - Added loops module export

## Commits

| Hash | Message |
|------|---------|
| 32e5a74 | feat(05-01): create Ralph Loop types and constants |
| 6fcaa9f | feat(05-01): implement state persistence and completion detection |
| ede39a3 | feat(05-01): create Ralph Loop module with continuation prompt |

## Next Phase Readiness

**Ready for:** 05-02 (Orchestrator Enforcement Hooks)

**Dependencies satisfied:**
- Ralph Loop state management complete
- Mode registry integration working
- All functions exported from main index

**Blockers:** None
