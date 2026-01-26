---
phase: 02-state-management
plan: 02
subsystem: state
tags: [jsonl, event-queue, file-system, crypto, uuid]

# Dependency graph
requires:
  - phase: 02-01
    provides: StateManager, types, STATE_DIR constant
provides:
  - emitEvent() - append events to JSONL with UUID and timestamp
  - pollEvents() - read events from specific line number
  - rotateEventsIfNeeded() - rotate when exceeds 1000 lines
  - clearEvents() - delete event file
  - getEventFilePath() - get absolute path to events.jsonl
affects: [02-core-planning, 03-execution, orchestrator]

# Tech tracking
tech-stack:
  added: [crypto.randomUUID for event IDs]
  patterns: [append-only JSONL for event queue, line-based polling, synchronous I/O for predictability]

key-files:
  created: [src/state/event-system.ts]
  modified: []

key-decisions:
  - "Used synchronous fs operations for predictability in agent context"
  - "JSONL append pattern with writeFileSync flag 'a' for atomic appends"
  - "Line-based polling enables efficient incremental reads"
  - "Event rotation at 1000 lines prevents unbounded growth"

patterns-established:
  - "Event structure: id (UUID), timestamp (ISO 8601), type, source, payload"
  - "Polling returns events array, lastLine, hasMore for efficient tracking"
  - "Rotation creates timestamped backup files (events.{timestamp}.jsonl)"

# Metrics
duration: 15min
completed: 2026-01-26
---

# Phase 02-02: Event System Summary

**JSONL-based event queue with UUID events, line-based polling, and automatic rotation at 1000 lines**

## Performance

- **Duration:** 15 min
- **Started:** 2026-01-26T23:04:00Z
- **Completed:** 2026-01-26T23:19:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Implemented append-only JSONL event queue for inter-agent communication
- Event emission with automatic UUID and ISO timestamp generation
- Line-based polling for efficient incremental event reads
- Automatic event file rotation at 1000-line threshold

## Files Created/Modified
- `src/state/event-system.ts` - File-based event queue (176 lines)
  - `getEventFilePath()` - Returns path to events.jsonl
  - `emitEvent()` - Appends events with UUID and timestamp
  - `pollEvents()` - Reads events from line number onwards
  - `rotateEventsIfNeeded()` - Rotates file when threshold exceeded
  - `clearEvents()` - Deletes event file

## Decisions Made

**Synchronous I/O:** Used synchronous fs operations (readFileSync, writeFileSync) instead of async for predictability in agent contexts where async coordination is complex.

**Append pattern:** Used `writeFileSync(path, data, { flag: 'a' })` instead of appendFileSync for consistency with other state manager patterns and explicit flag control.

**Line-based polling:** Split by newlines and return events from specified line number onwards, enabling efficient incremental reads without re-parsing entire file.

**Rotation strategy:** Move to timestamped backup file when threshold exceeded, rather than truncation, preserving event history for debugging.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation was straightforward. The synchronous file operations work well for the append-only pattern, and the line-based polling is efficient for incremental reads.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Event system ready for orchestrator integration
- Can be used by mode registry (02-03) to emit mode change events
- Can be used by checkpoint manager (02-04) to emit checkpoint events
- Provides foundation for inter-agent communication in execution phase

## Technical Details

### Event Structure
```typescript
interface StateEvent {
  id: string;           // UUID via crypto.randomUUID()
  timestamp: string;    // ISO 8601
  type: StateEventType; // 'plan_started', 'task_completed', etc.
  source: string;       // e.g., 'orchestrator', 'agent:executor'
  payload: Record<string, unknown>;
}
```

### Event Types Supported
- plan_started, plan_completed, plan_failed
- task_started, task_completed, task_failed
- checkpoint_created, rollback_initiated
- mode_changed

### File Format
- Location: `.ultraplan/state/events.jsonl`
- Format: One JSON object per line
- Rotation: Moved to `events.{ISO-timestamp}.jsonl` when exceeds 1000 lines

### Polling Pattern
```typescript
// Initial poll
const result1 = pollEvents(0);
console.log(result1.events);  // All events
const nextLine = result1.lastLine;

// Subsequent polls
const result2 = pollEvents(nextLine);
console.log(result2.events);  // Only new events
```

---
*Phase: 02-state-management*
*Plan: 02*
*Completed: 2026-01-26*
