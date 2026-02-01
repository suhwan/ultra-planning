# Phase 18: Hook System - Research

**Researched:** 2026-02-01
**Domain:** Event-driven hook system for extensibility
**Confidence:** HIGH

## Summary

This research analyzes the oh-my-opencode hook system architecture to inform implementing a comprehensive hook system (35+ hooks) for ultra-planning. The oh-my-opencode codebase provides a mature, production-tested implementation with 36 hooks covering event handling, context monitoring, task continuation, error recovery, and more.

The core architecture uses a **factory pattern** where each hook is created via a `createXxxHook()` function that receives a plugin context (`PluginInput`) and returns an object mapping event types to handler functions. Hooks subscribe to Claude Code's plugin event system through specific hook points: `chat.message`, `tool.execute.before`, `tool.execute.after`, `event`, and `experimental.session.compacting`.

**Primary recommendation:** Implement a HookRegistry that manages hook lifecycle and event propagation, then port the 15 highest-priority hooks from oh-my-opencode, adapting them to use ultra-planning's existing StateManager and EventSystem infrastructure.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x | Type-safe hook definitions | Native to project |
| Node.js EventEmitter | Built-in | Base event propagation | Standard, no dependencies |
| Zod | 3.23+ | Hook config validation | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fs/path | Built-in | State file persistence | Hook state storage |
| simple-git | 3.x | Git-based checkpoints | Error recovery hooks |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom EventBus | mitt/eventemitter3 | Adds dependency, marginal benefit |
| File-based state | In-memory only | Loses persistence across sessions |
| Per-hook state files | Single state file | More granular but more I/O |

**Installation:**
```bash
# No new dependencies needed - uses existing project infrastructure
```

## Architecture Patterns

### Recommended Project Structure
```
src/hooks/
├── types.ts              # Hook interface definitions
├── registry.ts           # HookRegistry - central management
├── event-bus.ts          # Event propagation layer
├── index.ts              # Public API exports
├── core/                 # Core hook implementations
│   ├── todo-continuation-enforcer.ts
│   ├── context-window-monitor.ts
│   ├── background-notification.ts
│   ├── session-notification.ts
│   ├── session-recovery.ts
│   └── ...
├── tool/                 # Tool-related hooks
│   ├── edit-error-recovery.ts
│   ├── delegate-task-retry.ts
│   ├── tool-output-truncator.ts
│   └── ...
├── context/              # Context injection hooks
│   ├── compaction-context-injector.ts
│   ├── directory-agents-injector.ts
│   ├── keyword-detector.ts
│   └── ...
└── orchestrator/         # Existing orchestrator hooks (extend)
    ├── file-guard.ts
    ├── single-task.ts
    └── verification.ts
```

### Pattern 1: Hook Factory Pattern
**What:** Each hook is a factory function returning an event handler object
**When to use:** All hook implementations
**Example:**
```typescript
// Source: references/oh-my-opencode/src/hooks/context-window-monitor.ts
export function createContextWindowMonitorHook(ctx: PluginInput) {
  const remindedSessions = new Set<string>();

  const toolExecuteAfter = async (
    input: { tool: string; sessionID: string; callID: string },
    output: { title: string; output: string; metadata: unknown }
  ) => {
    // Hook logic here
  };

  const eventHandler = async ({ event }: { event: { type: string; properties?: unknown } }) => {
    // Event cleanup logic
  };

  return {
    "tool.execute.after": toolExecuteAfter,
    event: eventHandler,
  };
}
```

### Pattern 2: Session State Management
**What:** Track per-session state using Maps with session IDs as keys
**When to use:** Hooks that need to remember state across events
**Example:**
```typescript
// Source: references/oh-my-opencode/src/hooks/todo-continuation-enforcer.ts
interface SessionState {
  countdownTimer?: ReturnType<typeof setTimeout>;
  isRecovering?: boolean;
  abortDetectedAt?: number;
}

const sessions = new Map<string, SessionState>();

function getState(sessionID: string): SessionState {
  let state = sessions.get(sessionID);
  if (!state) {
    state = {};
    sessions.set(sessionID, state);
  }
  return state;
}
```

### Pattern 3: Event Type Handlers
**What:** Return object mapping event types to async handler functions
**When to use:** All hooks that handle multiple event types
**Example:**
```typescript
// Source: references/oh-my-opencode/src/hooks/claude-code-hooks/index.ts
return {
  // Session lifecycle
  "experimental.session.compacting": async (input, output) => { ... },

  // Message handling
  "chat.message": async (input, output) => { ... },

  // Tool execution
  "tool.execute.before": async (input, output) => { ... },
  "tool.execute.after": async (input, output) => { ... },

  // Generic events
  event: async (input) => { ... },
};
```

### Pattern 4: System Directive Injection
**What:** Inject system messages with consistent tagging for filtering
**When to use:** When hooks need to inject guidance into prompts
**Example:**
```typescript
// Source: references/oh-my-opencode/src/hooks/todo-continuation-enforcer.ts
const CONTINUATION_PROMPT = `${createSystemDirective(SystemDirectiveTypes.TODO_CONTINUATION)}

Incomplete tasks remain in your todo list. Continue working on the next pending task.

- Proceed without asking for permission
- Mark each task complete when finished
- Do not stop until all tasks are done`;
```

### Anti-Patterns to Avoid
- **Blocking hooks:** Hooks should be async and non-blocking to avoid slowing execution
- **Shared mutable state:** Each session should have isolated state
- **Missing cleanup:** Always cleanup session state on `session.deleted` event
- **Synchronous I/O:** Use async file operations for state persistence

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Event propagation | Custom pubsub | HookRegistry pattern | Standardized, testable |
| Session state | Global variables | Per-session Map | Memory isolation |
| System messages | Raw strings | createSystemDirective() | Consistent tagging |
| Timer management | setTimeout directly | Session-scoped timers with cleanup | Prevent memory leaks |
| Todo API access | Direct fetch | ctx.client.session.todo() | Proper auth, error handling |
| Toast notifications | Console.log | ctx.client.tui.showToast() | Proper UI integration |

**Key insight:** The oh-my-opencode hooks extensively use the Claude Code plugin API (`ctx.client`) for session management, todos, toasts, and prompts. Ultra-planning hooks should wrap these APIs for testability.

## Common Pitfalls

### Pitfall 1: Session Lifecycle Mismatch
**What goes wrong:** Hook state accumulates indefinitely, causing memory leaks
**Why it happens:** Forgetting to handle `session.deleted` events
**How to avoid:** Always implement cleanup in `session.deleted` handler
**Warning signs:** Memory growth over time, stale session references

### Pitfall 2: Race Conditions in Countdown Timers
**What goes wrong:** Multiple countdown timers fire for same session
**Why it happens:** Not canceling previous timer before starting new one
**How to avoid:** Store timer reference in session state, cancel before new timer
**Warning signs:** Duplicate prompts, inconsistent behavior

### Pitfall 3: Abort Detection Failures
**What goes wrong:** Hook continues work after user abort
**Why it happens:** Only checking session.error, not message abort state
**How to avoid:** Check both session.error event AND message abort state in API
**Warning signs:** Zombie continuations after user stops

### Pitfall 4: Hook Ordering Dependencies
**What goes wrong:** One hook breaks because it runs before another
**Why it happens:** Implicit dependencies between hooks
**How to avoid:** Document hook dependencies, use registry ordering
**Warning signs:** Works in some sessions, fails in others

### Pitfall 5: Context Window Token Calculation
**What goes wrong:** Premature or late context warnings
**Why it happens:** Using total cumulative tokens instead of last message tokens
**How to avoid:** Use only last assistant message's input tokens (post-compaction)
**Warning signs:** Warnings that don't match actual usage

## Code Examples

Verified patterns from official sources:

### HookRegistry Pattern
```typescript
// Recommended pattern for ultra-planning
import { StateManager } from '../state/state-manager.js';

export interface HookDefinition {
  name: string;
  enabled: boolean;
  priority: number;
  factory: (ctx: HookContext) => HookHandlers;
}

export interface HookHandlers {
  'chat.message'?: ChatMessageHandler;
  'tool.execute.before'?: ToolExecuteBeforeHandler;
  'tool.execute.after'?: ToolExecuteAfterHandler;
  event?: EventHandler;
}

export class HookRegistry {
  private hooks: Map<string, HookDefinition> = new Map();
  private instances: Map<string, HookHandlers> = new Map();

  register(hook: HookDefinition): void {
    this.hooks.set(hook.name, hook);
  }

  initialize(ctx: HookContext): void {
    const sorted = [...this.hooks.values()]
      .filter(h => h.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const hook of sorted) {
      this.instances.set(hook.name, hook.factory(ctx));
    }
  }

  async dispatch(eventType: keyof HookHandlers, input: unknown, output: unknown): Promise<void> {
    for (const [name, handlers] of this.instances) {
      const handler = handlers[eventType];
      if (handler) {
        try {
          await handler(input, output);
        } catch (error) {
          console.error(`Hook ${name} failed:`, error);
        }
      }
    }
  }
}
```

### Todo Continuation Enforcer Core Logic
```typescript
// Source: references/oh-my-opencode/src/hooks/todo-continuation-enforcer.ts
function getIncompleteCount(todos: Todo[]): number {
  return todos.filter(t =>
    t.status !== "completed" && t.status !== "cancelled"
  ).length;
}

function startCountdown(
  sessionID: string,
  incompleteCount: number,
  total: number,
): void {
  const state = getState(sessionID);
  cancelCountdown(sessionID);  // Cancel any existing

  let secondsRemaining = COUNTDOWN_SECONDS;  // 2 seconds
  showCountdownToast(secondsRemaining, incompleteCount);
  state.countdownStartedAt = Date.now();

  state.countdownInterval = setInterval(() => {
    secondsRemaining--;
    if (secondsRemaining > 0) {
      showCountdownToast(secondsRemaining, incompleteCount);
    }
  }, 1000);

  state.countdownTimer = setTimeout(() => {
    cancelCountdown(sessionID);
    injectContinuation(sessionID, incompleteCount, total);
  }, COUNTDOWN_SECONDS * 1000);
}
```

### Context Window Monitor Core Logic
```typescript
// Source: references/oh-my-opencode/src/hooks/context-window-monitor.ts
const ANTHROPIC_ACTUAL_LIMIT = 200_000;  // Default
const CONTEXT_WARNING_THRESHOLD = 0.70;

const toolExecuteAfter = async (input, output) => {
  const { sessionID } = input;
  if (remindedSessions.has(sessionID)) return;

  const messages = await ctx.client.session.messages({
    path: { id: sessionID },
  });

  const assistantMessages = messages
    .filter((m) => m.info.role === "assistant");

  const lastAssistant = assistantMessages[assistantMessages.length - 1];
  if (lastAssistant.providerID !== "anthropic") return;

  // Use only last message's input tokens (post-compaction accurate)
  const lastTokens = lastAssistant.tokens;
  const totalInputTokens = (lastTokens?.input ?? 0) + (lastTokens?.cache?.read ?? 0);

  const actualUsagePercentage = totalInputTokens / ANTHROPIC_ACTUAL_LIMIT;
  if (actualUsagePercentage < CONTEXT_WARNING_THRESHOLD) return;

  remindedSessions.add(sessionID);
  output.output += `\n\n${CONTEXT_REMINDER}`;
};
```

### Background Notification Pattern
```typescript
// Source: references/oh-my-opencode/src/hooks/background-notification/index.ts
export function createBackgroundNotificationHook(manager: BackgroundManager) {
  const eventHandler = async ({ event }: EventInput) => {
    manager.handleEvent(event);
  };

  return {
    event: eventHandler,
  };
}
```

## Priority Hooks for Implementation

Based on analysis of oh-my-opencode hooks and ultra-planning requirements:

### Priority 1: Core (Must Have)
| Hook | Purpose | Complexity |
|------|---------|------------|
| todo-continuation-enforcer | Auto-continue on incomplete tasks | HIGH |
| context-window-monitor | Token usage tracking and warnings | MEDIUM |
| session-recovery | Recover from transient errors | MEDIUM |
| background-notification | Notify on background task completion | LOW |

### Priority 2: Tool Enhancement
| Hook | Purpose | Complexity |
|------|---------|------------|
| edit-error-recovery | Guide recovery from Edit tool errors | LOW |
| delegate-task-retry | Provide fix hints for delegation errors | LOW |
| tool-output-truncator | Limit large tool outputs | LOW |
| empty-task-response-detector | Detect empty subagent responses | LOW |

### Priority 3: Context Injection
| Hook | Purpose | Complexity |
|------|---------|------------|
| compaction-context-injector | Inject context during compaction | MEDIUM |
| keyword-detector | Detect magic keywords (autopilot, plan, etc.) | MEDIUM |
| directory-agents-injector | Inject AGENTS.md content | LOW |

### Priority 4: Session Management
| Hook | Purpose | Complexity |
|------|---------|------------|
| session-notification | Desktop notification on idle | LOW |
| ralph-loop | Persistence loop management | HIGH |
| auto-slash-command | Detect and execute slash commands | MEDIUM |

### Priority 5: Advanced (Nice to Have)
| Hook | Purpose | Complexity |
|------|---------|------------|
| anthropic-context-window-limit-recovery | Recover from context overflow | HIGH |
| thinking-block-validator | Validate thinking blocks | LOW |
| rules-injector | Inject custom rules | MEDIUM |

## Integration Points with Existing Code

### StateManager Integration
```typescript
// Use existing state management for hook state persistence
import { StateManager, StateLocation } from '../state/state-manager.js';

class TodoContinuationEnforcerHook {
  private stateManager = new StateManager<EnforcerState>(
    'hooks/todo-continuation',
    StateLocation.LOCAL
  );
}
```

### EventSystem Integration
```typescript
// Use existing event system for cross-hook communication
import { emitEvent } from '../state/event-system.js';

// In hook implementation
emitEvent({
  type: 'context_threshold_reached',
  payload: { level: 'warning', usageRatio: 0.72 },
  source: 'hook:context-window-monitor'
});
```

### ContextMonitor Integration
```typescript
// Existing monitor can be enhanced with hook events
import { ContextMonitor } from '../context/monitor.js';

// Hook can subscribe to monitor's threshold events
monitor.on('threshold', (level, action) => {
  // Inject warning into current session
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monolithic hook file | Modular per-hook files | oh-my-opencode 3.x | Better maintainability |
| Sync event handlers | Async handlers | Plugin API update | Non-blocking execution |
| Global state | Session-scoped state | Best practice | Memory isolation |
| Hard blocking | Soft warnings | Design principle | Better UX |

**Deprecated/outdated:**
- Synchronous hook handlers: All handlers should be async
- Global hook state: Each session needs isolated state
- Direct file writes for state: Use StateManager pattern

## Risk Assessment

### Technical Risks
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Hook ordering issues | MEDIUM | HIGH | Document dependencies, use priority ordering |
| Memory leaks | MEDIUM | MEDIUM | Session cleanup handlers, testing |
| Performance degradation | LOW | MEDIUM | Async handlers, efficient algorithms |

### Integration Risks
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Conflicts with existing hooks | LOW | HIGH | Namespace isolation, registry pattern |
| API compatibility | LOW | MEDIUM | Version checking, graceful degradation |

## Open Questions

Things that couldn't be fully resolved:

1. **Claude Code Plugin API Availability**
   - What we know: oh-my-opencode uses ctx.client for session, tui, todos
   - What's unclear: Full API surface available in ultra-planning context
   - Recommendation: Create wrapper interfaces for testability and compatibility

2. **Hook Configuration Storage**
   - What we know: oh-my-opencode uses config files
   - What's unclear: Preferred location for ultra-planning (.ultraplan vs .planning)
   - Recommendation: Follow existing config conventions in project

3. **Background Task Integration**
   - What we know: oh-my-opencode has BackgroundManager
   - What's unclear: Whether Phase 21's BackgroundManager will be available
   - Recommendation: Define interface now, implement integration later

## Sources

### Primary (HIGH confidence)
- `references/oh-my-opencode/src/hooks/index.ts` - 36 hook exports analyzed
- `references/oh-my-opencode/src/hooks/claude-code-hooks/index.ts` - Core hook patterns
- `references/oh-my-opencode/src/hooks/todo-continuation-enforcer.ts` - Complex hook example
- `references/oh-my-opencode/src/hooks/context-window-monitor.ts` - Context monitoring
- `references/oh-my-opencode/src/hooks/ralph-loop/index.ts` - Persistence loop

### Secondary (MEDIUM confidence)
- `references/oh-my-opencode/src/index.ts` - Plugin integration pattern
- `src/hooks/orchestrator/` - Existing ultra-planning hook infrastructure
- `src/state/state-manager.ts` - State persistence pattern to reuse

### Tertiary (LOW confidence)
- Claude Code Plugin API documentation - Inferred from usage patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses existing project infrastructure
- Architecture: HIGH - Based on production oh-my-opencode code
- Pitfalls: HIGH - Documented in real implementations
- Integration: MEDIUM - Some API details unclear

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - stable patterns)
