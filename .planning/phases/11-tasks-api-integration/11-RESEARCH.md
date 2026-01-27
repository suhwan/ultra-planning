# Phase 11: Tasks API 실제 연동 - Research

**Researched:** 2026-01-27
**Domain:** Claude Code Tasks API integration (TaskCreate, TaskUpdate, TaskList)
**Confidence:** HIGH

## Summary

This phase implements real integration with Claude Code's Tasks API to provide visual task tracking during plan execution. Phase 6 built the infrastructure (task-mapper.ts, dependency-map.ts, plan-parser.ts) that transforms PLAN.md tasks into Task tool invocation structures, but the actual API calls were not implemented. This phase completes the integration by invoking TaskCreate, TaskUpdate, and TaskList at the appropriate points in the execution workflow.

The standard approach is to:
1. Call TaskCreate for each task when a PLAN.md is loaded for execution
2. Use addBlockedBy to establish wave-based dependencies (wave N blocked by all wave N-1 tasks)
3. Call TaskUpdate to synchronize status changes (pending -> in_progress -> completed)
4. Use TaskList for progress visualization and monitoring

**Primary recommendation:** Extend the existing sync module with actual API call wrappers that invoke TaskCreate/TaskUpdate/TaskList, using the already-built TaskInvocation structures from task-mapper.ts. Store Claude Task IDs in PLAN.md frontmatter for session-to-session correlation.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Claude Tasks API | Built-in | Task management within Claude Code | Native tool, no external dependency |
| gray-matter | 4.0.3 | YAML frontmatter parsing for ID storage | Already in use, standard for markdown metadata |
| Existing sync module | N/A | TaskInvocation structures, dependency maps | Built in Phase 6, provides foundation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | 3.23 | Validation of API responses | Validate TaskCreate returns, ensure task ID format |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Frontmatter ID storage | In-memory map | Simpler but loses mapping on session restart |
| Sync on each state change | Batch sync at plan completion | Loses real-time visibility but more efficient |

**Installation:**
```bash
# No new packages needed - uses existing dependencies
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── sync/                        # Existing (Phase 6)
│   ├── types.ts                 # TaskMapping, TaskState types
│   ├── plan-parser.ts           # PLAN.md parsing
│   ├── task-mapper.ts           # TaskInvocation creation
│   ├── dependency-map.ts        # Wave -> blockedBy mapping
│   ├── status-sync.ts           # PLAN.md status updates
│   └── index.ts                 # Module exports
├── tasks/                       # NEW - Claude Tasks API wrappers
│   ├── api.ts                   # TaskCreate, TaskUpdate, TaskList wrappers
│   ├── registry.ts              # Task ID -> Claude Task ID mapping
│   └── index.ts                 # Module exports
└── orchestration/               # Existing
    └── router/                  # Router uses tasks/api.ts
```

### Pattern 1: Task Registration on Plan Load
**What:** When /ultraplan:execute loads a PLAN.md, register all tasks with TaskCreate before execution begins
**When to use:** At plan execution start, before any task is executed
**Example:**
```typescript
// Source: Gist kieranklaassen/4f2aba89594a4aea4ad64d753984b2ea
// Based on existing task-mapper.ts patterns

import { createTaskInvocations, buildDependencyMap } from '../sync/index.js';

interface ClaudeTaskId {
  internal: string;      // "06-01-01" (our ID)
  claude: string;        // "1", "2", etc (Claude's ID)
}

async function registerTasksInClaudeTasks(
  invocations: TaskInvocation[],
  registry: Map<string, string>
): Promise<void> {
  for (const invocation of invocations) {
    // Convert blockedBy internal IDs to Claude Task IDs
    const claudeBlockedBy = invocation.blocked_by
      .map(id => registry.get(id))
      .filter((id): id is string => id !== undefined);

    // Create task in Claude Tasks
    const result = await TaskCreate({
      subject: invocation.tool_input.description,
      description: invocation.tool_input.prompt,
      activeForm: `Executing ${invocation.tool_input.description}`,
      ...(claudeBlockedBy.length > 0 && {
        // Note: blockedBy set via TaskUpdate after creation
      })
    });

    // Store mapping
    registry.set(invocation.task_id, result.id);

    // Set dependencies after creation
    if (claudeBlockedBy.length > 0) {
      await TaskUpdate({
        taskId: result.id,
        addBlockedBy: claudeBlockedBy
      });
    }
  }
}
```

### Pattern 2: Status Synchronization
**What:** Update Claude Tasks status when task state changes
**When to use:** On every state transition (pending -> in_progress -> completed/failed)
**Example:**
```typescript
// Source: Router protocol + GitHub issue anthropics/claude-code#20797

type RouterState = 'pending' | 'executing' | 'verifying' | 'done' | 'failed';
type ClaudeTaskStatus = 'pending' | 'in_progress' | 'completed';

const STATE_MAP: Record<RouterState, ClaudeTaskStatus> = {
  pending: 'pending',
  executing: 'in_progress',
  verifying: 'in_progress',
  done: 'completed',
  failed: 'pending',  // Failed tasks reset to pending with metadata
};

async function syncTaskStatus(
  taskId: string,
  state: RouterState,
  registry: Map<string, string>,
  metadata?: Record<string, unknown>
): Promise<void> {
  const claudeTaskId = registry.get(taskId);
  if (!claudeTaskId) return;

  await TaskUpdate({
    taskId: claudeTaskId,
    status: STATE_MAP[state],
    ...(metadata && { metadata }),
  });
}
```

### Pattern 3: Progress Visualization
**What:** Use TaskList to display current execution progress
**When to use:** Periodically during execution, on user request, or at plan completion
**Example:**
```typescript
// Source: ClaudeLog mechanics/task-agent-tools

interface TaskListEntry {
  id: string;
  subject: string;
  status: 'pending' | 'in_progress' | 'completed';
  blockedBy?: string[];
  owner?: string;
}

async function getExecutionProgress(): Promise<{
  total: number;
  completed: number;
  inProgress: number;
  blocked: number;
}> {
  const tasks = await TaskList();

  return {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    blocked: tasks.filter(t => t.blockedBy && t.blockedBy.length > 0).length,
  };
}

// Display format from TaskList output:
// #1 [completed] Task 1: Create domain models
// #2 [in_progress] Task 2: Add validation (owner: executor)
// #3 [pending] Task 3: Integration [blocked by #1, #2]
```

### Anti-Patterns to Avoid
- **Polling TaskList for state changes:** Too expensive, use state transitions instead
- **Re-registering tasks on resume:** Check frontmatter for existing Claude Task IDs first
- **Ignoring session boundaries:** Claude Tasks are session-scoped; plan for session restarts
- **Blocking execution on API failures:** Tasks API errors should warn, not fail execution

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Task ID generation | Custom ID scheme | Existing generateTaskId() from plan-parser.ts | Already deterministic, sortable format |
| Dependency calculation | Manual wave tracking | buildDependencyMap() from dependency-map.ts | Already handles wave-to-blockedBy conversion |
| Task invocation structure | Custom objects | TaskInvocation from task-mapper.ts | Already typed, tested, ready for use |
| Status persistence | In-memory only | updateTaskStatus() from status-sync.ts | Already persists to PLAN.md frontmatter |

**Key insight:** Phase 6 built the complete transformation layer (PLAN.md -> TaskInvocation). Phase 11 only needs thin wrappers that call the actual Claude Tools API with those structures.

## Common Pitfalls

### Pitfall 1: Session Boundary Loss
**What goes wrong:** Claude Tasks disappear on session end/restart, losing task tracking
**Why it happens:** Claude Tasks are session-scoped, stored in `~/.claude/tasks/{sessionId}/`
**How to avoid:**
- PLAN.md is Source of Truth (frontmatter task_states)
- On session resume, re-register incomplete tasks from PLAN.md
- Store Claude Task IDs in frontmatter for correlation
**Warning signs:** Tasks showing as "completed" in PLAN.md but not visible in TaskList

### Pitfall 2: Context Clear Orphans Tasks
**What goes wrong:** "Clear context" creates new session, old tasks become invisible
**Why it happens:** Claude Code issue #20797 - tasks remain in old session directory
**How to avoid:**
- Store minimal state in Claude Tasks, full state in PLAN.md
- Re-register from PLAN.md on any session change detection
- Use TaskList to detect orphan state (empty list when tasks expected)
**Warning signs:** TaskList returns empty despite execution in progress

### Pitfall 3: Dependency Registration Order
**What goes wrong:** TaskUpdate(addBlockedBy) fails because referenced task doesn't exist yet
**Why it happens:** Creating tasks and setting dependencies in wrong order
**How to avoid:**
- Create ALL tasks first (Wave 1, then Wave 2, etc.)
- Set dependencies AFTER all tasks exist
- Use stored registry to map internal IDs to Claude Task IDs
**Warning signs:** "Task not found" errors when setting blockedBy

### Pitfall 4: Assuming HTTP API
**What goes wrong:** Trying to make HTTP requests to create/update tasks
**Why it happens:** "Tasks API" sounds like REST endpoint
**How to avoid:** TaskCreate/TaskUpdate/TaskList are Claude Code tool calls, not HTTP
**Warning signs:** Looking for API endpoints, authentication, HTTP libraries

### Pitfall 5: Concurrent Modification
**What goes wrong:** Multiple agents updating same task state simultaneously
**Why it happens:** Parallel execution (Ultrapilot) with shared task registry
**How to avoid:**
- Each task has single owner agent
- Use file locking for registry updates
- Serialize state writes to PLAN.md
**Warning signs:** Race conditions, lost updates, inconsistent state

## Code Examples

Verified patterns from official sources:

### TaskCreate API
```typescript
// Source: Gist kieranklaassen/4f2aba89594a4aea4ad64d753984b2ea

interface TaskCreateParams {
  subject: string;        // Task title (required)
  description: string;    // Full description (required)
  activeForm?: string;    // Spinner text during in_progress
  // Note: blockedBy cannot be set at creation time, use TaskUpdate
}

// Returns: { id: "1", subject: "...", status: "pending", ... }

// Example:
TaskCreate({
  subject: "Task 1: Create domain models",
  description: "Create PlannerId class with validation.\n\nAcceptance: Class exists with all properties",
  activeForm: "Creating domain models..."
})
```

### TaskUpdate API
```typescript
// Source: Gist kieranklaassen/4f2aba89594a4aea4ad64d753984b2ea

interface TaskUpdateParams {
  taskId: string;                           // Target task ID (required)
  owner?: string;                           // Agent claiming task
  status?: 'pending' | 'in_progress' | 'completed';
  addBlockedBy?: string[];                  // Task IDs blocking this task
  addBlocks?: string[];                     // Task IDs this task blocks
  metadata?: Record<string, unknown>;       // Custom data storage
}

// Example - Set dependencies:
TaskUpdate({
  taskId: "2",
  addBlockedBy: ["1"]   // Task #2 waits for Task #1
})

// Example - Start execution:
TaskUpdate({
  taskId: "1",
  status: "in_progress",
  owner: "executor"
})

// Example - Complete:
TaskUpdate({
  taskId: "1",
  status: "completed",
  metadata: {
    completedAt: new Date().toISOString(),
    evidence: "All tests passed"
  }
})
```

### TaskList API
```typescript
// Source: Gist kieranklaassen/4f2aba89594a4aea4ad64d753984b2ea

// No parameters required
TaskList()

// Returns array of task objects:
// [
//   { id: "1", subject: "...", status: "completed", ... },
//   { id: "2", subject: "...", status: "in_progress", owner: "executor", ... },
//   { id: "3", subject: "...", status: "pending", blockedBy: ["1", "2"], ... }
// ]

// Display format in Claude UI:
// #1 [completed] Task 1: Create domain models
// #2 [in_progress] Task 2: Add validation (owner: executor)
// #3 [pending] Task 3: Integration [blocked by #1, #2]
```

### Wave-to-BlockedBy Full Example
```typescript
// Source: Existing dependency-map.ts + task-mapper.ts

import {
  parseAndExtractMappings,
  buildDependencyMap,
  createTaskInvocations
} from '../sync/index.js';

async function registerPlanTasks(planPath: string): Promise<Map<string, string>> {
  // 1. Parse PLAN.md and extract task mappings
  const mappings = await parseAndExtractMappings(planPath);

  // 2. Build wave-based dependency map
  const depMap = buildDependencyMap(mappings);

  // 3. Create task invocations with blockedBy arrays
  const invocations = createTaskInvocations(mappings, depMap);

  // 4. Register in Claude Tasks (sorted by wave)
  const registry = new Map<string, string>();

  for (const invocation of invocations) {
    // Create task
    const result = await TaskCreate({
      subject: invocation.tool_input.description,
      description: invocation.tool_input.prompt,
      activeForm: `Executing ${invocation.tool_input.description}`
    });

    registry.set(invocation.task_id, result.id);

    // Set dependencies (map internal IDs to Claude IDs)
    if (invocation.blocked_by.length > 0) {
      const claudeBlockedBy = invocation.blocked_by
        .map(id => registry.get(id))
        .filter((id): id is string => id !== undefined);

      if (claudeBlockedBy.length > 0) {
        await TaskUpdate({
          taskId: result.id,
          addBlockedBy: claudeBlockedBy
        });
      }
    }
  }

  return registry;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TodoWrite/TodoRead | Tasks API | Jan 2026 | Persistent tasks, dependencies, visual tracking |
| Manual checkbox tracking | Automatic sync | Phase 6 | status-sync.ts handles PLAN.md updates |
| No dependency visualization | blockedBy in TaskList | Jan 2026 | Clear dependency visibility |

**Deprecated/outdated:**
- TodoWrite/TodoRead: Replaced by Tasks in January 2026 update
- In-memory task lists: Tasks now persist within session

## Open Questions

Things that couldn't be fully resolved:

1. **TaskGet availability**
   - What we know: TaskGet(taskId) returns full task details
   - What's unclear: Exact return schema, error handling for invalid IDs
   - Recommendation: Use TaskList for bulk operations, TaskGet only for single-task details

2. **Metadata size limits**
   - What we know: metadata field accepts arbitrary key-value data
   - What's unclear: Maximum size, nested object depth limits
   - Recommendation: Keep metadata minimal (planFile, wave, taskIndex, timestamps)

3. **Concurrent task updates**
   - What we know: Multiple agents can run in parallel (Ultrapilot)
   - What's unclear: Race condition handling in Claude Tasks backend
   - Recommendation: Each task owned by single agent, serialize registry updates

4. **Session detection**
   - What we know: Sessions have unique IDs, tasks stored per session
   - What's unclear: How to detect session change programmatically
   - Recommendation: Check TaskList on execution start, re-register if empty but PLAN.md has tasks

## Sources

### Primary (HIGH confidence)
- [Claude Code Swarm Orchestration Skill](https://gist.github.com/kieranklaassen/4f2aba89594a4aea4ad64d753984b2ea) - Complete TaskCreate/TaskUpdate/TaskList schemas
- [Claude Code Sub-agents Documentation](https://code.claude.com/docs/en/sub-agents) - Task tool schema, subagent patterns
- Existing codebase: `src/sync/task-mapper.ts` - TaskInvocation structure
- Existing codebase: `src/sync/dependency-map.ts` - Wave-to-blockedBy mapping
- Router Protocol: `.claude/skills/ultraplan/references/router.md` - Integration patterns

### Secondary (MEDIUM confidence)
- [Claude Code Tasks Are Here](https://medium.com/@joe.njenga/claude-code-tasks-are-here-new-update-turns-claude-code-todos-to-tasks-a0be00e70847) - Tasks feature overview
- [GitHub Issue #20797](https://github.com/anthropics/claude-code/issues/20797) - Session orphan tasks issue

### Tertiary (LOW confidence)
- [ClaudeLog Task Agent Tools](https://claudelog.com/mechanics/task-agent-tools/) - General patterns (limited API details)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Claude Tasks is built-in, existing sync module provides foundation
- Architecture: HIGH - Clear integration points defined in router.md and execute command
- Pitfalls: HIGH - Session boundaries and dependency order well-documented

**Research date:** 2026-01-27
**Valid until:** 2026-02-27 (30 days - stable domain, Tasks API is mature)

---

## Implementation Notes for Planner

### Prior Decisions to Honor
- **[06-01]**: Task ID format `{phase}-{plan:02d}-{task:02d}` - deterministic and sortable
- **[06-02]**: Wave dependency model - tasks in wave N blocked by ALL tasks in waves 1..N-1

### Integration Points
1. **Plan Load** (`/ultraplan:execute` command): Register tasks with TaskCreate
2. **Task Start**: TaskUpdate(status: "in_progress")
3. **Task Complete**: TaskUpdate(status: "completed")
4. **Task Fail**: TaskUpdate with retry metadata
5. **Progress Query**: TaskList for visualization

### Files to Modify/Create
- NEW: `src/tasks/api.ts` - TaskCreate/Update/List wrappers
- NEW: `src/tasks/registry.ts` - Internal ID to Claude Task ID mapping
- MODIFY: `.claude/commands/ultraplan-execute.md` - Document Tasks integration
- MODIFY: Router implementation (orchestration) - Use tasks/api.ts

### Key Constraint
- TaskCreate does not accept blockedBy parameter directly
- Must create task first, then TaskUpdate to add blockedBy
- This means Wave 1 tasks must be created before Wave 2 dependencies can be set
