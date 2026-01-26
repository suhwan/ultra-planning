---
phase: 06-claude-tasks-sync
plan: 2
subsystem: sync
status: complete
tags: [task-mapping, dependency-resolution, wave-orchestration, claude-tasks]
completed: 2026-01-26

requires:
  - 06-01 (sync types and plan parser)

provides:
  - TaskInvocation interface for Task tool invocations
  - Task mapper: TaskMapping to Task tool conversion
  - Dependency mapper: Wave to blockedBy resolution
  - Execution order sorting

affects:
  - 06-03 (will use task-mapper and dependency-map for orchestration)

tech-stack:
  added: []
  patterns:
    - Wave-based dependency graph construction
    - Deterministic task ordering (wave -> plan -> task)
    - Parallel execution readiness detection

key-files:
  created:
    - src/sync/task-mapper.ts
    - src/sync/dependency-map.ts
  modified:
    - src/sync/index.ts

decisions:
  - name: Wave dependency model
    rationale: Tasks in wave N blocked by ALL tasks in waves 1..N-1
    alternatives: [per-task dependency specification]
    chosen: Wave-based for simplicity and parallel execution patterns

  - name: Subagent type mapping
    rationale: Auto tasks -> executor, checkpoint types -> specialized agents
    alternatives: [single executor for all, user-specified per task]
    chosen: Type-based mapping for consistent behavior

  - name: Separate getReadyTasks functions
    rationale: Different signatures for TaskMapping vs TaskInvocation
    alternatives: [single polymorphic function]
    chosen: Separate functions with aliases to avoid ambiguity

metrics:
  duration: ~4min
---

# Phase 6 Plan 2: Task Mapper and Dependency Mapping Summary

**One-liner:** TaskMapping to Task tool invocation conversion with wave-based dependency resolution

## What Was Built

### Task Mapper (src/sync/task-mapper.ts)

**Purpose:** Convert parsed TaskMappings into executable Task tool invocations

**Key Components:**

1. **TaskInvocation Interface**
   - `tool_name: 'Task'` - Claude Task tool identifier
   - `tool_input: TaskToolParams` - Ready-to-use parameters
   - `task_id: string` - For state tracking
   - `blocked_by: string[]` - Wave dependency resolution

2. **Conversion Functions**
   - `createTaskInvocation(mapping, blockedBy)` - Single task conversion
   - `createTaskInvocations(mappings, dependencyMap)` - Batch conversion with sorting
   - Returns array sorted by wave, then task_id

3. **Subagent Type Determination**
   - `determineSubagentType(taskType)` - Maps task types to subagents
   - 'auto' → executor
   - 'checkpoint:human-verify' → verifier
   - 'checkpoint:decision' → architect
   - 'checkpoint:human-action' → executor

4. **Utility Functions**
   - `getTaskIds(invocations)` - Extract task IDs
   - `filterByWave(invocations, mappings, wave)` - Filter by wave
   - `getReadyTasks(invocations)` - Get tasks with no blockers

### Dependency Mapper (src/sync/dependency-map.ts)

**Purpose:** Build wave-based dependency graphs for parallel execution

**Key Components:**

1. **DependencyMap Type**
   - `Record<string, string[]>` - task_id → blocking task_ids
   - Represents "must complete before" relationships

2. **Dependency Graph Construction**
   - `buildDependencyMap(allMappings)` - Complete dependency graph
   - Wave 1 tasks: empty blockedBy
   - Wave N tasks: blocked by ALL tasks from waves 1..N-1

3. **Single Task Lookup**
   - `mapWaveToBlockedBy(taskWave, allMappings)` - Get blockers for specific wave
   - Returns array of task IDs from earlier waves

4. **Execution Order**
   - `getExecutionOrder(mappings)` - Sort by wave, plan, task index
   - Deterministic ordering for sequential execution

5. **Utility Functions**
   - `getWaves(mappings)` - Extract unique wave numbers
   - `getTasksInWave(mappings, wave)` - Filter by wave
   - `hasDependencies(taskId, dependencyMap)` - Check if task has blockers
   - `getReadyTasks(mappings, dependencyMap, completed)` - Find executable tasks

### Module Exports Update (src/sync/index.ts)

**Changes:**

- Organized exports by category with section headers
- Added TaskInvocation type export
- Added DependencyMap type export
- Added task-mapper function exports
- Added dependency-map function exports
- Aliased conflicting `getReadyTasks` functions:
  - `getReadyTaskInvocations` (from task-mapper)
  - `getReadyTaskMappings` (from dependency-map)

## Technical Architecture

### Wave Dependency Model

**Rule:** Tasks in wave N are blocked by ALL tasks in waves 1 through N-1

**Example:**
```
Wave 1: [06-01-01, 06-01-02] → blockedBy: []
Wave 2: [06-02-01, 06-02-02] → blockedBy: ['06-01-01', '06-01-02']
Wave 3: [06-03-01] → blockedBy: ['06-01-01', '06-01-02', '06-02-01', '06-02-02']
```

**Benefits:**
- Simple to reason about
- Enables maximum parallelism within waves
- Ensures all prerequisites complete before next wave

### Execution Flow

```
1. Parse PLAN.md → TaskMapping[]
2. buildDependencyMap(mappings) → DependencyMap
3. createTaskInvocations(mappings, depMap) → TaskInvocation[]
4. getReadyTasks() → Execute tasks with blockedBy: []
5. Mark completed → Update blockedBy for remaining tasks
6. Repeat until all complete
```

### Type Safety

- All types exported from module root
- No circular dependencies between task-mapper and dependency-map
- Forward type declaration for DependencyMap in task-mapper
- TaskType imported from xml/types (not sync/types)

## Integration Points

### From Plan 06-01
- Uses `TaskMapping` from types.ts
- Uses `TaskToolParams` from types.ts
- Builds on `extractTaskMappings` output

### For Plan 06-03
- Provides `TaskInvocation` for orchestrator
- Provides `buildDependencyMap` for dependency tracking
- Provides `getExecutionOrder` for sequential fallback
- Provides `getReadyTasks` for parallel execution

## Testing Verification

All files compile successfully:
```bash
npx tsc --noEmit --skipLibCheck \
  src/sync/task-mapper.ts \
  src/sync/dependency-map.ts \
  src/sync/index.ts
```

No circular dependency issues detected.

## File Statistics

- `src/sync/task-mapper.ts`: 203 lines (required: 50+) ✓
- `src/sync/dependency-map.ts`: 237 lines (required: 40+) ✓
- Both files exceed minimum requirements

## Key Exports Summary

### Types
- `TaskInvocation` - Ready-to-execute Task tool call
- `DependencyMap` - task_id → blocking task_ids

### Task Mapper Functions
- `createTaskInvocation` - Single task conversion
- `createTaskInvocations` - Batch conversion with sorting
- `determineSubagentType` - Task type → subagent mapping

### Dependency Functions
- `buildDependencyMap` - Complete dependency graph
- `mapWaveToBlockedBy` - Single wave lookup
- `getExecutionOrder` - Deterministic task sorting

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Ready for 06-03:** All required components implemented and exported.

**What's available:**
- ✓ Task to invocation conversion
- ✓ Wave dependency resolution
- ✓ Execution order determination
- ✓ Ready task detection

**Plan 06-03 can now:**
- Import `createTaskInvocations` to generate invocations
- Use `buildDependencyMap` for dependency tracking
- Call `getReadyTasks` to find executable tasks
- Execute tasks in proper dependency order

## Commits

- `d29dd1a` - feat(06-02): implement task mapper
- `5a6f8bb` - feat(06-02): implement wave dependency mapper
- `aa096f2` - feat(06-02): update sync module exports

## Success Metrics

- ✓ TaskInvocation matches Claude Task tool schema
- ✓ createTaskInvocations produces correctly ordered invocations
- ✓ buildDependencyMap correctly computes blockedBy from waves
- ✓ Wave 1 tasks have empty blockedBy
- ✓ Higher waves block on all lower waves
- ✓ All functions are type-safe with no compilation errors
- ✓ No circular dependencies between modules
