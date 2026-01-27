# Phase 10-02 Summary: Threshold Detection and ContextMonitor

**Status:** ✅ COMPLETE
**Date:** 2026-01-27
**Wave:** 2
**Dependencies:** 10-01

## Objectives Achieved

Implemented threshold detection logic and ContextMonitor class with state persistence for subagent context monitoring.

## Deliverables

### 1. Threshold Detection (`src/context/thresholds.ts`)

**Exports:**
- `ThresholdLevel` type: `'normal' | 'warning' | 'critical'`
- `ThresholdAction` interface: level, action, message
- `detectThreshold(usageRatio, config?)`: Classifies usage into threshold levels
- `getThresholdAction(level)`: Maps levels to actions with messages
- `shouldEmitEvent(previousLevel, currentLevel)`: Detects level changes

**Thresholds:**
- Normal: < 70% usage → `'none'` action
- Warning: 70-84.9% usage → `'prepare_handoff'` action
- Critical: ≥ 85% usage → `'force_return'` action

**Messages:**
- Normal: "Context normal"
- Warning: "Context warning (70%+) - complete current task, prepare clean handoff"
- Critical: "Context critical (85%+) - initiating checkpoint return"

### 2. ContextMonitor Class (`src/context/monitor.ts`)

**Features:**
- Integrates `ContextTracker` with `StateManager` for persistence
- Persists state to `.ultraplan/state/subagents/{agentId}.json`
- Emits `context_threshold_reached` events on level changes
- Tracks task progress (tasksCompleted, tasksTotal, currentTask)
- Heartbeat mechanism for stale detection

**API:**
```typescript
class ContextMonitor {
  start(): void
  trackContent(text: string): ThresholdAction
  updateHeartbeat(): void
  setCurrentTask(task: string): void
  completeTask(): void
  getState(): SubagentContextState
  getThresholdAction(): ThresholdAction
  stop(): void
}
```

**State Schema:**
```typescript
interface SubagentContextState {
  agentId: string
  sessionId: string
  active: boolean
  startedAt: string
  lastHeartbeat: string
  cumulativeChars: number
  estimatedTokens: number
  usageRatio: number
  thresholdStatus: ThresholdLevel
  currentTask?: string
  tasksCompleted: number
  tasksTotal: number
}
```

**Factory Function:**
- `createContextMonitor(agentId, config?)`: Creates monitor instances

### 3. Event System Integration

**New Event Type:**
- Added `'context_threshold_reached'` to `StateEventType` in `src/state/types.ts`

**Event Payload:**
```typescript
{
  type: 'context_threshold_reached',
  payload: {
    agentId: string,
    level: ThresholdLevel,
    usageRatio: number,
    action: 'none' | 'prepare_handoff' | 'force_return'
  },
  source: `agent:${agentId}`
}
```

### 4. Module Exports (`src/context/index.ts`)

Updated to export:
- All threshold types and functions from `thresholds.ts`
- `ContextMonitor`, `createContextMonitor`, `SubagentContextState` from `monitor.ts`

## Key Design Decisions

### 1. Pure Threshold Functions
Threshold detection logic is implemented as pure functions, separate from stateful monitoring. This enables:
- Easy testing
- Reusability
- Clear separation of concerns

### 2. StateManager Integration
ContextMonitor uses `StateManager<SubagentContextState>` for atomic file persistence:
- Follows existing state management patterns
- Uses tmp + rename for atomic writes
- State location: `LOCAL` (.ultraplan/state/subagents/)

### 3. Event Deduplication
`shouldEmitEvent()` prevents duplicate events when threshold remains constant:
- Only emits when level changes (normal→warning, warning→critical, etc.)
- Reduces event noise

### 4. Heartbeat Pattern
`lastHeartbeat` field enables orchestrator to detect stale agents:
- Updated on every `trackContent()` and `updateHeartbeat()` call
- Can be used to implement timeout detection

## Integration Points

### Dependencies Used
| Module | Usage |
|--------|-------|
| `createContextTracker` | Internal cumulative tracking |
| `StateManager` | File-based persistence |
| `emitEvent` | Threshold event emission |
| `StateLocation` | State location enum |

### Provides For
| Consumer | What It Provides |
|----------|------------------|
| Subagents | ContextMonitor instances for self-monitoring |
| Orchestrator | State files at `.ultraplan/state/subagents/{agentId}.json` |
| Event subscribers | `context_threshold_reached` events |

## Verification

### Build Verification
```bash
$ npx tsc --noEmit
✓ No errors

$ npm run build
✓ Build successful
```

### Expected Behaviors
1. ✅ Monitor creates state file on `start()`
2. ✅ `trackContent()` returns appropriate `ThresholdAction`
3. ✅ Threshold transitions emit events (no duplicates)
4. ✅ Heartbeat updates on content tracking
5. ✅ Task progress tracked (completed/total)

## Files Modified

```
src/context/thresholds.ts          [NEW] - Threshold detection logic
src/context/monitor.ts             [NEW] - ContextMonitor class
src/context/index.ts               [UPDATED] - Added exports
src/state/types.ts                 [UPDATED] - Added event type
```

## Next Steps

This plan enables:
- **10-03**: Checkpoint return structures for handoff data
- **10-04**: Orchestrator polling integration
- Subagents can now self-monitor and trigger handoff actions

## Notes

- ContextMonitor is designed for single-agent use (one instance per subagent)
- State files are agent-scoped (`subagents/{agentId}.json`)
- Events are emitted to global `.ultraplan/state/events.jsonl`
- Orchestrator can poll both state files and events for monitoring
