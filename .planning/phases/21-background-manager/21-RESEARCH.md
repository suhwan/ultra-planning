# Phase 21: Background Manager - Research

**Researched:** 2026-02-01
**Domain:** Background task management, concurrency control, parent session notification
**Confidence:** HIGH

## Summary

This research investigates background task management for parallel execution with model-based concurrency limits, task queue management, and parent session notifications. The oh-my-opencode reference provides a production-ready implementation that can be adapted for ultra-planning.

The reference implementation (`references/oh-my-opencode/src/features/background-agent/`) provides a complete solution with:
- `BackgroundManager` class for task lifecycle management
- `ConcurrencyManager` class for model-based rate limiting
- Stability detection for auto-completion (3+ stable polls)
- Parent session notification system

**Primary recommendation:** Adapt the oh-my-opencode BackgroundManager pattern with simplified integration into the existing ultra-planning orchestration infrastructure, leveraging existing hooks and event systems.

## Current State Analysis

### Existing Background/Parallel Infrastructure

| Component | Location | Purpose | Relevance |
|-----------|----------|---------|-----------|
| Ultrapilot | `src/orchestration/ultrapilot/` | Parallel worker coordination | HIGH - File ownership, worker spawn/complete |
| Swarm | `src/orchestration/swarm/` | Task pool with atomic claiming | MEDIUM - Worker identity, parallel patterns |
| EcoMode | `src/orchestration/ecomode/` | Model-tiered concurrency | HIGH - Has concurrent limits per model |
| Mode Registry | `src/state/mode-registry.ts` | Mutual exclusion | MEDIUM - Prevents mode conflicts |
| Hook System | `src/hooks/` | Event-driven extensibility | HIGH - Integration point for notifications |
| Event Bus | `src/hooks/event-bus.ts` | Pub/sub for hooks | HIGH - Notification dispatch |
| StateManager | `src/state/state-manager.ts` | Type-safe file persistence | HIGH - State storage pattern |

### Existing Concurrency Limits (EcoMode)

From `src/orchestration/ecomode/types.ts`:
```typescript
export const MODEL_CONCURRENT_LIMITS: Record<ModelTier, number> = {
  haiku: 5,   // Fast, cheap - can run many
  sonnet: 3,  // Balanced
  opus: 2,    // Expensive - limit concurrent
};
```

### Existing Hooks for Background Notifications

From `src/hooks/core/background-notification.ts`:
- Already has `BackgroundNotificationOptions` with batch window
- `CompletedTask` interface for tracking completions
- `BackgroundTasksNotificationPayload` for batch events
- `createBackgroundNotificationHook` factory
- `formatNotificationMessage` helper

## Reference Implementation Analysis

### ConcurrencyManager (HIGH confidence)

**Source:** `references/oh-my-opencode/src/features/background-agent/concurrency.ts`

Key features:
- Model/provider-based concurrency limits
- Queue with settled-flag pattern for double-resolution prevention
- Supports Infinity for unlimited concurrency
- Clean cancellation with `cancelWaiters()`

```typescript
interface QueueEntry {
  resolve: () => void
  rawReject: (error: Error) => void
  settled: boolean
}

class ConcurrencyManager {
  getConcurrencyLimit(model: string): number
  async acquire(model: string): Promise<void>
  release(model: string): void
  cancelWaiters(model: string): void
  clear(): void
}
```

**Configuration hierarchy:**
1. Model-specific limit (`modelConcurrency[model]`)
2. Provider limit (`providerConcurrency[provider]`)
3. Default limit (`defaultConcurrency`)
4. Fallback: 5

### BackgroundManager (HIGH confidence)

**Source:** `references/oh-my-opencode/src/features/background-agent/manager.ts`

Key features:
- Task states: `pending` -> `running` -> `completed|error|cancelled`
- Queue-based task launching with concurrency control
- Stability detection: 3 consecutive stable polls = complete
- Session validation before completion
- Parent session notifications with batch support
- Process cleanup on shutdown

**Critical constants:**
```typescript
const TASK_TTL_MS = 30 * 60 * 1000              // 30 min TTL
const MIN_STABILITY_TIME_MS = 10 * 1000         // 10s before stability detection
const DEFAULT_STALE_TIMEOUT_MS = 180_000        // 3 min stale timeout
const MIN_RUNTIME_BEFORE_STALE_MS = 30_000      // 30s before stale check
```

**Stability detection algorithm:**
```typescript
// From pollRunningTasks():
if (task.lastMsgCount === currentMsgCount) {
  task.stablePolls = (task.stablePolls ?? 0) + 1
  if (task.stablePolls >= 3) {
    // Verify session is idle
    // Verify session has output
    // Check for incomplete todos
    await this.tryCompleteTask(task, "stability detection")
  }
} else {
  task.stablePolls = 0
}
```

### BackgroundTask Type (HIGH confidence)

**Source:** `references/oh-my-opencode/src/features/background-agent/types.ts`

```typescript
export type BackgroundTaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "error"
  | "cancelled"

export interface TaskProgress {
  toolCalls: number
  lastTool?: string
  lastUpdate: Date
  lastMessage?: string
  lastMessageAt?: Date
}

export interface BackgroundTask {
  id: string
  sessionID?: string
  parentSessionID: string
  parentMessageID: string
  description: string
  prompt: string
  agent: string
  status: BackgroundTaskStatus
  queuedAt?: Date
  startedAt?: Date
  completedAt?: Date
  result?: string
  error?: string
  progress?: TaskProgress
  concurrencyKey?: string
  concurrencyGroup?: string
  lastMsgCount?: number
  stablePolls?: number
}
```

## Standard Stack

The implementation should use existing ultra-planning infrastructure with minimal new dependencies.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| uuid | ^9.0.0 | Task ID generation | Already used in ultrapilot |
| StateManager | internal | State persistence | Existing pattern |
| HookEventBus | internal | Notification dispatch | Existing infrastructure |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| MODE_REGISTRY | internal | Conflict prevention | Mutual exclusion |
| EcoMode limits | internal | Default concurrency | Model-based limits |

## Architecture Patterns

### Recommended Project Structure
```
src/orchestration/background/
├── types.ts           # BackgroundTask, TaskProgress, Status types
├── concurrency.ts     # ConcurrencyManager class
├── manager.ts         # BackgroundManager class
├── state.ts           # State persistence functions
├── index.ts           # Public exports
└── manager.test.ts    # Unit tests
```

### Pattern 1: Queue-Based Task Launch

**What:** Tasks enter a queue and wait for concurrency slot before starting
**When to use:** All background task launches

```typescript
async launch(input: LaunchInput): Promise<BackgroundTask> {
  // 1. Create task with status="pending"
  const task = createPendingTask(input);

  // 2. Add to queue by concurrency key
  const key = getConcurrencyKey(input);
  enqueue(key, { task, input });

  // 3. Trigger processing (fire-and-forget)
  processQueue(key);

  return task;
}

async processQueue(key: string) {
  if (isProcessing(key)) return;
  setProcessing(key, true);

  while (hasQueuedItems(key)) {
    await concurrencyManager.acquire(key);
    const item = dequeue(key);
    await startTask(item);
  }

  setProcessing(key, false);
}
```

### Pattern 2: Stability Detection Loop

**What:** Poll running tasks, detect when message count stabilizes
**When to use:** Background task completion detection

```typescript
async pollRunningTasks() {
  for (const task of runningTasks) {
    const msgCount = await getSessionMessageCount(task.sessionId);

    if (msgCount === task.lastMsgCount) {
      task.stablePolls = (task.stablePolls ?? 0) + 1;

      if (task.stablePolls >= 3 && isSessionIdle(task.sessionId)) {
        await completeTask(task);
      }
    } else {
      task.stablePolls = 0;
      task.lastMsgCount = msgCount;
    }
  }
}
```

### Pattern 3: Parent Session Notification

**What:** Notify parent session when background tasks complete
**When to use:** Task completion (individual or batch)

```typescript
async notifyParentSession(task: BackgroundTask) {
  // Track pending tasks per parent
  pendingByParent.get(task.parentSessionId).delete(task.id);

  const allComplete = pendingByParent.get(task.parentSessionId).size === 0;

  const notification = allComplete
    ? formatBatchCompleteNotification(task.parentSessionId)
    : formatIndividualNotification(task);

  // Emit via event bus for hook consumption
  eventBus.dispatch('background_task_completed', {
    taskId: task.id,
    sessionId: task.sessionId,
    parentSessionId: task.parentSessionId,
    status: task.status,
    allComplete,
  });
}
```

### Anti-Patterns to Avoid

- **Direct completion without validation:** Always check session has output before marking complete
- **Synchronous slot release:** Always release concurrency slots before async operations to prevent leaks
- **Ignoring stale tasks:** Implement TTL and stale detection to clean up stuck tasks
- **Polling without minimum runtime:** Wait MIN_STABILITY_TIME before stability detection kicks in

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrency limiting | Semaphore from scratch | Queue with acquire/release | Edge cases: cancellation, double-resolution |
| Task ID generation | `Date.now()` | uuid v4 with prefix | Collision prevention |
| State persistence | Raw JSON read/write | StateManager class | Atomic writes, error handling |
| Event notification | Direct function calls | HookEventBus | Decoupling, testability |
| Process cleanup | Manual handlers | registerProcessCleanup pattern | Signal handling, shutdown order |

**Key insight:** The reference implementation handles many edge cases (stale tasks, double-resolution, process signals) that are easy to miss in a custom solution.

## Common Pitfalls

### Pitfall 1: Double Completion Race

**What goes wrong:** Multiple code paths complete the same task
**Why it happens:** session.idle event fires while polling also detects completion
**How to avoid:** Use atomic status check before completion
```typescript
async tryCompleteTask(task, source) {
  if (task.status !== "running") {
    return false;  // Already completed by another path
  }
  task.status = "completed";  // Atomic mark
  // ... rest of completion logic
}
```
**Warning signs:** Task appears in multiple completion logs

### Pitfall 2: Concurrency Slot Leak

**What goes wrong:** Slots never released, queue starves
**Why it happens:** Error thrown between acquire and release
**How to avoid:** Release BEFORE any async notification
```typescript
// BAD: release after notification
await notifyParent(task);
concurrencyManager.release(key);

// GOOD: release before notification
concurrencyManager.release(key);
await notifyParent(task);  // Can fail, slot already released
```
**Warning signs:** Tasks stay in pending state indefinitely

### Pitfall 3: Early Completion on Session.Idle

**What goes wrong:** Task marked complete before any work done
**Why it happens:** session.idle fires immediately for new session
**How to avoid:** Require minimum elapsed time and validate output
```typescript
const elapsedMs = Date.now() - task.startedAt.getTime();
if (elapsedMs < MIN_IDLE_TIME_MS) {
  return;  // Too early, ignore idle
}

const hasOutput = await validateSessionHasOutput(sessionId);
if (!hasOutput) {
  return;  // No output yet, wait
}
```
**Warning signs:** Tasks complete with 0 tool calls, empty results

### Pitfall 4: Stale Task Accumulation

**What goes wrong:** Memory grows as stuck tasks never cleaned
**Why it happens:** Task stuck in running state, no completion triggered
**How to avoid:** Implement TTL and periodic pruning
```typescript
if (Date.now() - task.startedAt.getTime() > TASK_TTL_MS) {
  task.status = "error";
  task.error = "Task timed out";
  concurrencyManager.release(task.concurrencyKey);
  tasks.delete(task.id);
}
```
**Warning signs:** High memory usage, growing task count

## Code Examples

### ConcurrencyManager Usage

```typescript
// Source: Adapted from reference implementation
const manager = new ConcurrencyManager({
  modelConcurrency: {
    "opus": 2,
    "sonnet": 3,
    "haiku": 5,
  },
  defaultConcurrency: 3,
});

// Acquire slot (blocks if at limit)
await manager.acquire("opus");

try {
  // Do work...
} finally {
  // Always release
  manager.release("opus");
}
```

### BackgroundManager Integration

```typescript
// Source: Pattern from reference, adapted for ultra-planning
import { createHookEventBus } from '../hooks/event-bus';
import { StateManager } from '../state/state-manager';

const eventBus = createHookEventBus();
const stateManager = new StateManager<BackgroundState>('background-state');

const manager = new BackgroundManager({
  concurrencyConfig: {
    modelConcurrency: MODEL_CONCURRENT_LIMITS,
    defaultConcurrency: 3,
  },
  pollingIntervalMs: 2000,
  stabilityThreshold: 3,
  onTaskComplete: (task) => {
    eventBus.dispatch('background_task_completed', {
      taskId: task.id,
      status: task.status,
    });
  },
});
```

### Integration with Existing Hooks

```typescript
// Leverage existing background-notification.ts hook
import { createBackgroundNotificationHook } from '../hooks/core/background-notification';

const notificationHook = createBackgroundNotificationHook(hookContext, {
  batchWindow: 1000,
  maxBatchSize: 5,
});

// Subscribe to manager events
eventBus.subscribe('background_task_completed', (payload) => {
  notificationHook.event({
    event: {
      type: 'background_task_completed',
      payload,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      source: 'background-manager',
    },
    sessionId: payload.parentSessionId,
  });
});
```

## Integration Points

### With Ultrapilot

Ultrapilot currently manages parallel workers with file ownership. BackgroundManager can provide:
- Concurrency limiting (replace simple worker count)
- Stability detection (replace manual completion tracking)
- Task queue (replace synchronous spawn)

```typescript
// In ultrapilot/coordinator.ts
import { getBackgroundManager } from '../background';

export async function spawnWorker(task, files) {
  const manager = getBackgroundManager();
  return manager.launch({
    description: task,
    prompt: buildWorkerPrompt(task, files),
    agent: 'executor',
    model: determineModel(task),
    parentSessionID: getCurrentSessionId(),
  });
}
```

### With Swarm

Swarm uses Claude Code's Task API for state. BackgroundManager can:
- Manage worker lifecycle independently
- Provide consistent notification pattern
- Handle concurrency across swarm workers

### With Existing Notification Hook

The existing `background-notification.ts` hook provides batching. BackgroundManager should:
- Emit `background_task_completed` events
- Let hook handle batching logic
- Not duplicate batching functionality

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct worker spawn | Queue + concurrency | Now | Better rate limiting |
| Manual completion check | Stability detection | Now | Automatic completion |
| Synchronous notify | Event-based + batching | Phase 18 (hooks) | Decoupled notification |

**Deprecated/outdated:**
- Direct session.prompt for notification: Use event bus instead for hook integration

## Open Questions

1. **Integration with Claude Code Native Tasks**
   - What we know: Swarm uses TaskCreate/TaskUpdate for state tracking
   - What's unclear: Should BackgroundManager also use Native Tasks or stay file-based?
   - Recommendation: Start with file-based (matches reference), add Native Task integration later if needed

2. **Parent Session Notification Mechanism**
   - What we know: Reference uses OpenCode client API for session.prompt
   - What's unclear: How to inject notifications in ultra-planning's context
   - Recommendation: Use existing hook system's event bus, let hooks handle injection

3. **Concurrency Key Granularity**
   - What we know: Reference uses `providerID/modelID` format
   - What's unclear: Should ultra-planning use same granularity?
   - Recommendation: Use model tier (haiku/sonnet/opus) to match EcoMode limits

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/orchestration/background/types.ts` | BackgroundTask, TaskProgress, Status, Config types |
| `src/orchestration/background/concurrency.ts` | ConcurrencyManager class |
| `src/orchestration/background/manager.ts` | BackgroundManager class |
| `src/orchestration/background/state.ts` | State persistence helpers |
| `src/orchestration/background/index.ts` | Public API exports |
| `src/orchestration/background/manager.test.ts` | Unit tests |

### Files to Modify

| File | Change |
|------|--------|
| `src/orchestration/index.ts` | Add background module export |
| `src/orchestration/ultrapilot/coordinator.ts` | Optional: Integrate with BackgroundManager |
| `src/hooks/core/background-notification.ts` | Possibly extend for new event types |

## Sources

### Primary (HIGH confidence)
- `references/oh-my-opencode/src/features/background-agent/manager.ts` - Full implementation reference
- `references/oh-my-opencode/src/features/background-agent/concurrency.ts` - Concurrency pattern
- `references/oh-my-opencode/src/features/background-agent/types.ts` - Type definitions

### Secondary (MEDIUM confidence)
- `src/orchestration/ecomode/types.ts` - MODEL_CONCURRENT_LIMITS reference
- `src/hooks/core/background-notification.ts` - Existing notification pattern
- `src/state/state-manager.ts` - State persistence pattern

### Tertiary (LOW confidence)
- N/A - All findings verified against source code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Based on existing project patterns
- Architecture: HIGH - Directly from production reference implementation
- Pitfalls: HIGH - Documented in reference code comments and patterns

**Research date:** 2026-02-01
**Valid until:** 60 days (stable patterns, internal infrastructure)
