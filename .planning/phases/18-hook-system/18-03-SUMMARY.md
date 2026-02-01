# Plan 18-03 Summary: Context Window Monitor Hook

## Status: COMPLETE

## Completed Tasks

### Task 1: Context window monitor hook implementation (src/hooks/core/context-window-monitor-hook.ts)
- Created context window monitor hook following oh-my-opencode patterns
- Implemented `ContextWindowMonitorOptions` interface with configurable thresholds:
  - `contextLimit`: Default 200,000 tokens
  - `warningThreshold`: Default 0.70 (70%)
  - `criticalThreshold`: Default 0.85 (85%)
  - `autoCompactionThreshold`: Default 0.80 (80%)
- Implemented per-session state tracking with `SessionMonitorState`:
  - `warned`: Whether warning threshold triggered
  - `critical`: Whether critical threshold triggered
  - `lastTokenCount`: Last known token count
  - `previousLevel`: For change detection
  - `tracker`: ContextTracker instance
- Integrated with existing context infrastructure:
  - Uses `createContextTracker` from `context/estimator.ts`
  - Uses `detectThreshold`, `shouldEmitEvent` from `context/thresholds.ts`
  - Uses threshold constants from `context/types.ts`
- Implemented system directive format for warning messages:
  - Warning at 70%: Prepare for handoff guidance
  - Critical at 85%: Force return/handoff recommendation
- Event handlers:
  - `tool.execute.after`: Tracks content, checks thresholds, injects warnings
  - `event`: Handles `session_deleted` for session cleanup
- Event emission on threshold crossings via `emitEvent`

### Task 2: Update core hooks index (src/hooks/core/index.ts)
- Updated barrel export to include context-window-monitor-hook
- Both hooks now importable from `src/hooks`:
  - `createTodoContinuationEnforcerHook`
  - `createContextWindowMonitorHook`

### Additional Fixes
- Added new event types to StateEventType in `src/state/types.ts`:
  - `context_threshold_hook`
  - `session_deleted`
  - `session_idle`
  - `session_error`
  - `hook:todo_continuation`
  - `message_updated`
  - `tool_execute_before`
  - `tool_execute_after`
- Fixed todo-continuation-enforcer.ts to use underscored event types instead of dotted notation

## Verification Results

### Build
```
npm run build
> tsc
(exit code 0 - no errors)
```

### Tests
```
npm test
Test Files  13 passed (13)
Tests       292 passed (292)
```

### Import Verification
```javascript
const hooks = require('./dist/hooks/index.js');

// Context window monitor hook
createContextWindowMonitorHook exists: true
Hook created successfully: true
Has tool.execute.after handler: true
Has event handler: true

// Todo continuation enforcer
createTodoContinuationEnforcerHook exists: true
TodoHook created successfully: true
Has event handler: true
```

## Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/core/context-window-monitor-hook.ts` | Created | Context window monitoring hook implementation |
| `src/hooks/core/index.ts` | Modified | Updated exports for both core hooks |
| `src/hooks/index.ts` | Modified | Added core hooks barrel export |
| `src/state/types.ts` | Modified | Added new StateEventType values |
| `src/hooks/core/todo-continuation-enforcer.ts` | Modified | Fixed event type comparisons |

## Key Exports

```typescript
// From src/hooks/core/context-window-monitor-hook.ts
export interface ContextWindowMonitorOptions {
  contextLimit?: number;
  warningThreshold?: number;
  criticalThreshold?: number;
  autoCompactionThreshold?: number;
}

export function createContextWindowMonitorHook(
  ctx: HookContext,
  options?: ContextWindowMonitorOptions
): HookHandlers;
```

## Architecture Notes

1. **Integration with Existing Infrastructure**: Hook uses existing `ContextTracker` and threshold detection rather than reimplementing

2. **Per-Session Tracking**: Each session maintains its own state via Map, cleaned up on session deletion

3. **One-Time Warnings**: Warning and critical thresholds only trigger once per session to avoid spam

4. **Event-Driven**: Threshold crossings emit `context_threshold_hook` events for orchestrator awareness

5. **System Directive Format**: Uses `ExtendedSystemDirectiveTypes.CONTEXT_WINDOW_MONITOR` for consistent message identification

## Event Flow

```
tool.execute.after
       ↓
Track content via ContextTracker
       ↓
Check usage ratio against thresholds
       ↓
If threshold crossed: emit event + inject warning message
       ↓
Update session state (warned/critical flags)
```

## Next Steps

Plan 18-04 will build additional hooks:
- BackgroundNotificationHook
- SessionRecoveryHook
