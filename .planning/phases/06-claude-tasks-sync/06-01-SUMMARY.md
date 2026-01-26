---
phase: 06-claude-tasks-sync
plan: 1
subsystem: sync
tags: [typescript, parsing, task-tool, claude-tasks]

dependency-graph:
  requires: [03-gsd-integration]
  provides: [sync-module-types, plan-parser-sync, task-id-generation]
  affects: [06-02, 06-03]

tech-stack:
  added: []
  patterns: [type-driven-design, deterministic-ids, module-exports]

key-files:
  created:
    - src/sync/types.ts
    - src/sync/plan-parser.ts
    - src/sync/index.ts
  modified: []

decisions:
  - id: task-id-format
    decision: "Task IDs use format {phase}-{plan:02d}-{task:02d} (e.g., 06-01-01)"
    rationale: "Deterministic, human-readable, sortable, and matches plan structure"
  - id: default-subagent
    decision: "Default subagent is oh-my-claudecode:executor for all task types"
    rationale: "Executor handles both auto and checkpoint tasks with appropriate awareness"

metrics:
  duration: ~4m
  completed: 2026-01-27
---

# Phase 6 Plan 1: Sync Module Types and Plan Parser Summary

**One-liner:** TypeScript sync module with deterministic task ID generation and PLAN.md parser integration for Claude Task tool synchronization.

## What Was Built

### Types (src/sync/types.ts)

Comprehensive TypeScript interfaces for sync module:

- **TaskMapping**: Maps PLAN.md task to Task tool params with deterministic ID
- **TaskState**: Tracks execution status (pending/in_progress/completed/failed)
- **TaskToolParams**: Claude Task tool invocation parameters (description, prompt, subagent, model)
- **SyncConfig**: Configuration for sync behavior (default model, checkboxes, frontmatter tracking)
- **PlanSyncData**: Parsed plan data structure for sync operations

### Plan Parser (src/sync/plan-parser.ts)

Enhanced parser that bridges PLAN.md to Task tool:

- **generateTaskId(phase, plan, taskIndex)**: Creates deterministic IDs like "06-01-01"
- **parsePlanForSync(planPath)**: Reads and parses PLAN.md with frontmatter extraction
- **extractTaskMappings(planData, config?)**: Converts parsed tasks to TaskMapping objects
- **formatTaskPrompt(task)**: Creates full prompt combining action/verify/done fields

Integration points:
- Imports `parsePlanMd` from `documents/templates/plan.ts`
- Imports `parseTasksSection` from `documents/xml/task-parser.ts`

### Module Index (src/sync/index.ts)

Clean public API with JSDoc documentation:
- Re-exports all types
- Re-exports all functions
- Provides default config

## Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create sync module types | 4e5df05 | src/sync/types.ts |
| 2 | Implement enhanced PLAN.md parser | 2b59bf3 | src/sync/plan-parser.ts |
| 3 | Create sync module index | 90cb1e3 | src/sync/index.ts |

## Decisions Made

1. **Task ID Format**: `{phase}-{plan:02d}-{task:02d}` - deterministic, sortable, matches plan structure
2. **Default Subagent**: `oh-my-claudecode:executor` for all task types
3. **Spread Order**: Frontmatter spread before overrides to allow defaults with explicit values

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- [x] src/sync/types.ts exists with all interfaces (155 lines)
- [x] src/sync/plan-parser.ts exists with parser functions (370 lines)
- [x] src/sync/index.ts exists with re-exports (39 lines)
- [x] npx tsc --noEmit passes for all sync/ files
- [x] Imports resolve correctly to existing infrastructure

## Next Phase Readiness

Ready for 06-02 (State Bridge):
- TaskMapping type provides the structure for state synchronization
- PlanSyncData provides parsed plan data for tracking
- generateTaskId enables deterministic state file naming

No blockers identified.
