# Plan 18-02 Summary: Todo Continuation Enforcer Hook

## Status: COMPLETE

## Completed Tasks

### Task 1: Todo continuation enforcer implementation (src/hooks/core/todo-continuation-enforcer.ts)
- Created `createTodoContinuationEnforcerHook` factory function
- Implemented per-session state tracking with `Map<sessionId, SessionState>`
- Session state includes: countdownTimer, countdownInterval, isRecovering, countdownStartedAt, abortDetectedAt
- 2-second countdown timer with configurable duration
- Background task awareness via optional `backgroundTaskChecker` function
- Abort detection to prevent unwanted continuation after user cancels
- Grace period (500ms) to avoid cancelling countdown on injected continuation messages
- Todo counting: filters out 'completed' and 'cancelled' status
- Continuation prompt uses `[SYSTEM DIRECTIVE: ULTRA-PLANNING - TODO CONTINUATION]` format
- Event handlers for: session_idle, session_error, session_deleted, message_updated, tool_execute_before, tool_execute_after, task_started, task_completed, task_failed

### Task 2: Core hooks barrel export (src/hooks/core/index.ts, src/hooks/index.ts)
- Updated `src/hooks/core/index.ts` to export both todo-continuation-enforcer and context-window-monitor-hook
- Updated `src/hooks/index.ts` comment to reflect new core hooks
- Directory structure:
```
src/hooks/
├── types.ts              # Hook type definitions
├── registry.ts           # HookRegistry class
├── event-bus.ts          # HookEventBus class
├── index.ts              # Main exports
├── core/                 # Core hook implementations
│   ├── todo-continuation-enforcer.ts  # NEW
│   ├── context-window-monitor-hook.ts
│   └── index.ts
└── orchestrator/         # Existing orchestrator hooks
    ├── types.ts
    ├── file-guard.ts
    ├── single-task.ts
    ├── verification.ts
    └── index.ts
```

### Additional Work: State event types
- Added new StateEventType values to `src/state/types.ts`:
  - `session_idle`: Session becomes idle
  - `session_error`: Session error occurred
  - `todo_continuation`: Continuation prompt ready for injection
  - `message_updated`: Message was updated
  - `tool_execute_before`: Before tool execution
  - `tool_execute_after`: After tool execution

## Verification Results

### Build
```
npm run build
> tsc
(exit code 0 - no errors)
```

### Hook Instantiation
```javascript
const hook = createTodoContinuationEnforcerHook(ctx, {
  countdownSeconds: 2,
  skipAgents: ['prometheus', 'compaction']
});

// Hook created successfully: [ 'event', 'session.idle', 'session.error', 'session.deleted' ]
// Has event handler: function
// Has session.idle handler: function
// Has session.error handler: function
// Has session.deleted handler: function
// Factory export available: true
```

## Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/core/todo-continuation-enforcer.ts` | Created | Todo continuation enforcer hook implementation |
| `src/hooks/core/index.ts` | Modified | Added export for todo-continuation-enforcer |
| `src/hooks/index.ts` | Modified | Updated comment to reflect core hooks |
| `src/state/types.ts` | Modified | Added new StateEventType values for hook events |

## Key Exports

```typescript
// Factory function
export { createTodoContinuationEnforcerHook } from './hooks';

// Configuration type
export type { TodoContinuationEnforcerOptions } from './hooks';

// Control interface
export type { TodoContinuationEnforcerControls } from './hooks';
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `countdownSeconds` | number | 2 | Seconds before auto-continuation |
| `skipAgents` | string[] | ['prometheus', 'compaction'] | Agents to skip continuation |
| `checkBackgroundTasks` | boolean | true | Whether to check for background tasks |
| `backgroundTaskChecker` | function | undefined | Custom function to check running tasks |
| `todoGetter` | function | undefined | Custom function to get todos |
| `promptInjector` | function | undefined | Custom function to inject prompts |

## Event Handlers

| Handler | Trigger | Behavior |
|---------|---------|----------|
| `event` | Generic state events | Routes to specific handlers |
| `session.idle` | Session becomes idle | Check todos, start countdown if incomplete |
| `session.error` | Session error | Detect aborts, cancel countdown |
| `session.deleted` | Session cleanup | Remove session state |

## Architecture Notes

1. **Factory Pattern**: Uses `createTodoContinuationEnforcerHook()` factory function following oh-my-opencode patterns

2. **Session Isolation**: Each session has independent state via Map<sessionId, SessionState>

3. **Countdown Logic**:
   - On session.idle: Check for incomplete todos
   - If incomplete: Start 2-second countdown
   - User/assistant activity: Cancel countdown
   - Countdown complete: Inject continuation prompt

4. **Abort Detection**: Prevents unwanted continuation when user manually stops agent:
   - Detects abort via session.error (MessageAbortedError, AbortError)
   - 3-second window after abort ignores idle events

5. **Event System Integration**: Emits `todo_continuation` event when no promptInjector is configured, allowing orchestrator to handle injection

## Next Steps

Plan 18-03 will add additional core hooks:
- BackgroundNotificationHook
- SessionRecoveryHook
