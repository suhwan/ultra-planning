---
phase: 05-opencode-reimplementation
plan: 02
subsystem: hooks
tags: [orchestrator, enforcement, delegation, soft-enforcement]
dependency-graph:
  requires: []
  provides:
    - orchestrator-file-guard
    - single-task-directive
    - system-directive-utilities
  affects:
    - 05-03 (will use hooks)
    - 05-04 (may extend hooks)
tech-stack:
  added: []
  patterns:
    - soft-enforcement-via-warnings
    - prompt-injection-for-behavior
key-files:
  created:
    - src/hooks/orchestrator/types.ts
    - src/hooks/orchestrator/file-guard.ts
    - src/hooks/orchestrator/single-task.ts
    - src/hooks/orchestrator/index.ts
    - src/hooks/index.ts
  modified:
    - src/index.ts
decisions:
  - id: soft-enforcement
    choice: Warnings only, not blocking
    rationale: Orchestrator may need small fixes during verification
  - id: allowed-paths
    choice: ".ultraplan/, .planning/, CLAUDE.md, AGENTS.md"
    rationale: These are planning/config files appropriate for direct modification
metrics:
  duration: 3m
  completed: 2026-01-27
---

# Phase 5 Plan 2: Orchestrator Enforcement Hooks Summary

**One-liner:** Soft enforcement hooks for orchestrator delegation pattern with file guard warnings and single-task directive injection

## What Was Built

Implemented the orchestrator enforcement hooks module that provides soft enforcement mechanisms to guide orchestrator behavior:

1. **System Directive Utilities** (`types.ts`)
   - `SYSTEM_DIRECTIVE_PREFIX` constant for consistent message marking
   - `SystemDirectiveTypes` with RALPH_LOOP, DELEGATION_REQUIRED, SINGLE_TASK_ONLY, VERIFICATION_REMINDER
   - `createSystemDirective()` function to format directive strings
   - `isSystemDirective()` function to detect directive messages
   - `FileGuardResult` interface for file guard results

2. **File Guard** (`file-guard.ts`)
   - `WRITE_TOOLS` constant: Write, Edit, write, edit, MultiEdit
   - `ALLOWED_PATHS` constant: .ultraplan/, .planning/, CLAUDE.md, AGENTS.md
   - `shouldWarnOnWrite()` function to check if warning needed
   - `getFileGuardWarning()` function returning full warning message with directive

3. **Single Task Directive** (`single-task.ts`)
   - `SINGLE_TASK_DIRECTIVE` constant for subagent prompt injection
   - `createSingleTaskDirective()` function with optional task description

4. **Module Exports** (`index.ts` files)
   - All hook functions exported from `src/hooks/orchestrator/index.ts`
   - Re-exported from `src/hooks/index.ts`
   - Available from main `src/index.ts`

## Key Design Decisions

1. **Soft Enforcement**: Warnings inform but do not block. The orchestrator can still proceed after being warned, which is necessary for verification/fix scenarios.

2. **Allowed Paths**: `.ultraplan/`, `.planning/`, `CLAUDE.md`, and `AGENTS.md` do not trigger warnings as these are appropriate for direct orchestrator modification.

3. **Prompt Injection Pattern**: Since Claude Code lacks tool hooks, behavior is guided through directive text injection rather than API interception.

## Verification Results

All checks passed:
- Build succeeds with exit code 0
- All 10 hook functions accessible from main index
- File guard correctly identifies source files vs allowed paths
- System directive utilities work correctly
- Single task directive available for subagent injection

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | ea942ef | Create orchestrator hook types and system directive utilities |
| 2 | ff33fce | Implement file guard and single-task directive |
| 3 | 3e1d1f9 | Create hooks module exports |

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Ready for Phase 5 Plan 3 (Ralph Loop implementation). The system directive utilities created here will be used by the Ralph Loop for continuation prompt marking.

**Prerequisites satisfied:**
- System directive prefix available for Ralph Loop messages
- StateManager already exists from Phase 2 for loop state persistence
