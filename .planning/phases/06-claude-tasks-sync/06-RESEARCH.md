# Phase 6: Claude Tasks Sync - Research

**Researched:** 2026-01-27
**Domain:** File-Task bidirectional synchronization
**Confidence:** MEDIUM

## Summary

This phase implements bidirectional synchronization between PLAN.md documents and Claude Code's Task tool API. The research reveals that Claude Code uses a Task tool for subagent delegation, not a traditional REST API for task management. Tasks in Claude Code are invoked through tool calls with structured parameters.

The standard approach is to:
1. Parse PLAN.md XML tasks into structured objects (already implemented in Phase 3)
2. Transform PLAN.md tasks into Task tool invocations
3. Track task state through file-based markers (checkboxes, status fields)
4. Implement watchers or polling for status synchronization

**Primary recommendation:** Use file-based state tracking with PLAN.md as source of truth, mapping XML tasks to Task tool parameters, and implementing checkbox updates through regex replacement.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| gray-matter | 4.0.3 | YAML frontmatter parsing | Already in use, industry standard for markdown metadata |
| Zod | 3.23 | Runtime validation | Already in use, ensures type safety for task schemas |
| chokidar | latest | File watching (if needed) | Most popular Node.js file watcher, cross-platform |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| uuid | 13.0.0 | Task ID generation | Already in use, needed for unique task identifiers |
| simple-git | 3.30.0 | Git state tracking | Already in use, can detect file changes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| File watching | Polling | Simpler but less efficient, acceptable for prototype |
| Regex replacement | AST-based editing | More robust but overkill for checkbox updates |

**Installation:**
```bash
npm install chokidar
npm install -D @types/chokidar
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── sync/                    # Synchronization logic
│   ├── plan-to-task.ts     # PLAN.md → Task tool
│   ├── task-to-plan.ts     # Task status → PLAN.md
│   ├── dependency-map.ts   # Wave → blockedBy conversion
│   └── types.ts            # Sync-specific types
├── documents/              # Existing (Phase 3)
│   ├── xml/                # Task parser/generator
│   └── templates/          # PLAN.md generator
└── state/                  # Existing (Phase 2)
    └── manager.ts          # File-based state
```

### Pattern 1: Parse-Transform-Invoke
**What:** Convert PLAN.md XML tasks to Task tool invocations
**When to use:** When PLAN.md is created or modified
**Example:**
```typescript
// Source: Research findings + existing Phase 3 code
import { parseTasksSection } from '../documents/xml/task-parser.js';
import type { AutoTask } from '../documents/xml/types.js';

interface TaskToolParams {
  description: string;
  prompt: string;
  subagent_type: string;
  model?: 'sonnet' | 'opus' | 'haiku';
}

function convertTaskToToolParams(task: AutoTask): TaskToolParams {
  return {
    description: task.name.slice(0, 50), // 3-5 word description
    prompt: `${task.action}\n\nVerify: ${task.verify}\nDone: ${task.done}`,
    subagent_type: 'oh-my-claudecode:executor',
    model: 'sonnet' // Default model
  };
}
```

### Pattern 2: File-Based State Tracking
**What:** Track task completion state in PLAN.md checkboxes and frontmatter
**When to use:** For persisting task status without external database
**Example:**
```typescript
// Track task status in frontmatter
interface PlanTaskState {
  task_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  started_at?: string;
  completed_at?: string;
}

// Update checkbox in content
function updateTaskCheckbox(
  content: string,
  taskName: string,
  completed: boolean
): string {
  const regex = new RegExp(
    `(<task type="auto">\\s*<name>${escapeRegex(taskName)}</name>)`,
    'i'
  );
  // Mark in frontmatter or add marker comment
  return content; // Updated content
}
```

### Pattern 3: Wave-to-Dependency Mapping
**What:** Convert PLAN.md wave dependencies to Task tool blockedBy
**When to use:** When creating tasks with execution order constraints
**Example:**
```typescript
interface WaveDependency {
  wave: number;
  depends_on: string[];
}

function mapWaveToBlockedBy(
  currentTask: AutoTask,
  allTasks: AutoTask[],
  waveDeps: WaveDependency
): string[] {
  // Tasks in earlier waves block this task
  return allTasks
    .filter(t => getWave(t) < waveDeps.wave)
    .map(t => generateTaskId(t));
}
```

### Anti-Patterns to Avoid
- **Bidirectional live sync:** Too complex, race conditions. Use PLAN.md as source of truth, update on completion only
- **Database-backed task storage:** Adds complexity without benefit for file-based workflow
- **Real-time task status polling:** Wasteful, event-driven or manual trigger is sufficient

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom regex parser | gray-matter | Already in use, handles edge cases (triple-dash delimiters, YAML escaping) |
| File watching | setTimeout polling loop | chokidar | Cross-platform, handles rename/move, debouncing built-in |
| XML escaping | Manual string replace | Existing escapeXml in task-generator.ts | Already handles all XML entities correctly |
| Task ID generation | Timestamp-based IDs | uuid package | Already in use, collision-resistant, sortable |

**Key insight:** The task parsing/generation infrastructure from Phase 3 already handles the hard parts (XML escaping, task structure validation). Phase 6 adds thin coordination layer, not full rewrite.

## Common Pitfalls

### Pitfall 1: Assuming Task Tool is a REST API
**What goes wrong:** Trying to make HTTP requests to create/update tasks
**Why it happens:** "Tasks API" sounds like a REST endpoint
**How to avoid:** Task tool is invoked through Claude Code's tool system, not external API. Tasks are created by Claude calling the Task tool with structured JSON parameters.
**Warning signs:** Looking for API endpoints, authentication tokens, HTTP libraries

### Pitfall 2: Overcomplicating Bidirectional Sync
**What goes wrong:** Building real-time sync with conflict resolution, operational transforms
**Why it happens:** "Bidirectional" suggests complex CRDT/OT algorithms
**How to avoid:** PLAN.md is source of truth for task definitions. Task status flows one-way back to PLAN.md. No concurrent writes to reconcile.
**Warning signs:** Implementing diff algorithms, vector clocks, last-write-wins logic

### Pitfall 3: Wave Dependencies as DAG Solver
**What goes wrong:** Implementing topological sort, circular dependency detection
**Why it happens:** Dependencies sound like general DAG problem
**How to avoid:** Waves are already linearized in PLAN.md (wave 1 before wave 2). Simple filter: tasks in lower wave numbers block tasks in higher waves.
**Warning signs:** Graph traversal algorithms, cycle detection, Tarjan's algorithm

### Pitfall 4: Parsing PLAN.md Content Without Frontmatter
**What goes wrong:** Regex matching breaks when frontmatter changes
**Why it happens:** Treating PLAN.md as plain text instead of structured document
**How to avoid:** Always parse with gray-matter first to separate frontmatter from content. Parse XML tasks from content section only.
**Warning signs:** Single regex matching across entire file, fragile line number tracking

### Pitfall 5: Synchronous File Updates During Task Execution
**What goes wrong:** Frequent writes during task execution cause file system thrashing, git conflicts
**Why it happens:** Updating PLAN.md on every status change
**How to avoid:** Batch updates, write only on task completion or explicit checkpoint. Use in-memory state for intermediate status.
**Warning signs:** Write on every status transition, millisecond-level update frequency

## Code Examples

Verified patterns from official sources:

### Task Tool Invocation
```typescript
// Source: https://code.claude.com/docs/en/sub-agents
// Task tool schema from research

interface TaskToolInvocation {
  tool_name: 'Task';
  tool_input: {
    description: string;      // 3-5 word summary
    prompt: string;           // Full task instructions
    subagent_type: string;    // Agent identifier (e.g., 'oh-my-claudecode:executor')
    model?: 'sonnet' | 'opus' | 'haiku';  // Optional model override
  };
}

// Convert AutoTask to Task tool invocation
function createTaskInvocation(task: AutoTask): TaskToolInvocation {
  return {
    tool_name: 'Task',
    tool_input: {
      description: task.name.slice(0, 50),
      prompt: formatTaskPrompt(task),
      subagent_type: determineSubagentType(task),
      model: 'sonnet'
    }
  };
}

function formatTaskPrompt(task: AutoTask): string {
  return `
# ${task.name}

## Files
${task.files.join(', ')}

## Action
${task.action}

## Verification
${task.verify}

## Completion Criteria
${task.done}
  `.trim();
}
```

### Checkbox State Update
```typescript
// Update task completion checkbox in PLAN.md content
function updateTaskCompletion(
  planContent: string,
  taskName: string,
  completed: boolean
): string {
  const escapedName = taskName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Find task XML and mark status
  // Option 1: Add status attribute to task element
  const taskRegex = new RegExp(
    `(<task type="auto"[^>]*)(>\\s*<name>${escapedName}</name>)`,
    'i'
  );

  const statusAttr = completed ? ' status="completed"' : ' status="pending"';

  return planContent.replace(taskRegex, `$1${statusAttr}$2`);
}

// Alternative: Use frontmatter for state tracking
interface PlanWithTaskState extends PlanDocument {
  frontmatter: PlanFrontmatter & {
    task_states?: Record<string, TaskState>;
  };
}

interface TaskState {
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  started_at?: string;
  completed_at?: string;
  error?: string;
}
```

### Wave to BlockedBy Mapping
```typescript
// Convert wave dependencies to blockedBy task IDs
function calculateBlockedBy(
  currentPlan: PlanDocument,
  allPlansInPhase: PlanDocument[]
): string[] {
  const currentWave = currentPlan.frontmatter.wave;

  // Find all tasks in earlier waves (same phase)
  const blockingPlans = allPlansInPhase.filter(
    p => p.frontmatter.wave < currentWave
  );

  // Generate task IDs for blocking plans
  return blockingPlans.map(p => generatePlanTaskId(p));
}

function generatePlanTaskId(plan: PlanDocument): string {
  // Use phase + plan number as stable ID
  return `${plan.frontmatter.phase}-${String(plan.frontmatter.plan).padStart(2, '0')}`;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Todos (in-memory) | Tasks (persistent) | Jan 2026 | Tasks persist across sessions, can be tracked/resumed |
| Manual task tracking | Task tool with subagents | 2025-2026 | Structured delegation, context isolation |
| Plain text tasks | XML-structured tasks | Phase 3 (implemented) | Machine-parseable, type-safe |

**Deprecated/outdated:**
- TodoWrite/TodoRead tools: Replaced by Tasks feature in 2026 update
- In-memory task lists: Tasks now persist in session state

## Open Questions

Things that couldn't be fully resolved:

1. **Task Status Notifications**
   - What we know: Task tool doesn't expose status callbacks or webhooks
   - What's unclear: How to detect task completion without polling PLAN.md or git status
   - Recommendation: Use file watcher on PLAN.md, or implement explicit "sync status" command

2. **Concurrent Plan Execution**
   - What we know: Multiple plans can run in parallel (Ultrapilot pattern from Phase 4)
   - What's unclear: How to prevent multiple agents from writing to same PLAN.md simultaneously
   - Recommendation: File locking with .lock files, or state-managed execution queue

3. **Task Resumption After Failure**
   - What we know: Subagents can be resumed by agent ID
   - What's unclear: How to map PLAN.md tasks to subagent IDs for resumption
   - Recommendation: Store agent_id in frontmatter task_states when task starts

## Sources

### Primary (HIGH confidence)
- Claude Code official documentation - Subagents: https://code.claude.com/docs/en/sub-agents
- Claude Code official documentation - Common Workflows: https://code.claude.com/docs/en/common-workflows
- Existing project code - Phase 3 XML task parser: src/documents/xml/task-parser.ts
- Existing project code - PLAN.md template generator: src/documents/templates/plan.ts

### Secondary (MEDIUM confidence)
- [Claude Code Tasks Are Here](https://medium.com/@joe.njenga/claude-code-tasks-are-here-new-update-turns-claude-code-todos-to-tasks-a0be00e70847) - Tasks feature overview (Jan 2026)
- [Claude Code Background Tasks](https://apidog.com/blog/claude-code-background-tasks/) - Architecture patterns
- [ClaudeLog Task Agent Tools](https://claudelog.com/mechanics/task-agent-tools/) - Task tool mechanics

### Tertiary (LOW confidence)
- WebSearch: "Claude Code Task tool subagent API reference 2026" - General patterns, needs verification with official docs
- WebSearch: "bidirectional sync file state patterns typescript 2026" - Generic patterns, not Claude-specific

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - gray-matter already in use, well-documented
- Architecture: MEDIUM - Pattern is clear but implementation details need validation
- Pitfalls: HIGH - Based on official docs clarifying common misconceptions

**Research date:** 2026-01-27
**Valid until:** 2026-02-27 (30 days - stable domain)
