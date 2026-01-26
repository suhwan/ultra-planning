---
phase: 05-opencode-reimplementation
plan: 03
subsystem: orchestrator-hooks
tags: [verification, events, reminder, typescript]

dependency-graph:
  requires: ["05-02"]
  provides: ["verification-reminder", "ralph-loop-events"]
  affects: ["05-04", "06-*"]

tech-stack:
  added: []
  patterns: ["event-driven-verification", "soft-enforcement"]

key-files:
  created:
    - src/hooks/orchestrator/verification.ts
  modified:
    - src/state/types.ts
    - src/hooks/orchestrator/index.ts

decisions:
  - key: "soft-enforcement-verification"
    choice: "Reminders, not blocks"
    rationale: "Orchestrator shows reminder after subagent completion; doesn't force verification"

metrics:
  duration: "~2m"
  completed: "2026-01-27"
---

# Phase 5 Plan 3: Verification Reminder Summary

**One-liner:** Verification reminder module with VERIFICATION_REMINDER constant, createVerificationReminder(), emitVerificationRequired(), and Phase 5 event types.

## What Was Built

### 1. Phase 5 Event Types (src/state/types.ts)

Extended StateEventType with new events for Ralph Loop lifecycle and verification:

```typescript
export type StateEventType =
  // ... existing events ...
  // Phase 5 additions - Ralph Loop lifecycle
  | 'ralph_loop_started'
  | 'ralph_loop_iteration'
  | 'ralph_loop_completed'
  | 'ralph_loop_failed'
  // Phase 5 additions - Orchestrator events
  | 'orchestrator_warning'
  | 'verification_required';
```

### 2. Verification Reminder Module (src/hooks/orchestrator/verification.ts)

Complete verification reminder system with:

**VERIFICATION_REMINDER constant:**
- Comprehensive checklist for orchestrator to verify subagent work
- Warns that subagents "FREQUENTLY LIE about completion"
- 4 verification steps: diagnostics, tests, build, code review
- Instructions for handling verification failure

**createVerificationReminder(context?: string):**
- Returns VERIFICATION_REMINDER text
- Optionally prepends context about what subagent completed

**emitVerificationRequired(subagentType, task):**
- Emits `verification_required` event to event system
- Tracks which subagent work needs verification

**DEFAULT_VERIFICATION_STEPS array:**
- Programmatic access to verification steps
- Each step has name, command, and expectedResult

### 3. Module Exports (src/hooks/orchestrator/index.ts)

Updated barrel exports to include verification module with updated JSDoc.

## Commits

| Commit | Description |
|--------|-------------|
| 3a0bac0 | feat(05-03): add Phase 5 event types to StateEventType |
| b56495d | feat(05-03): create verification reminder module |
| 97e892c | feat(05-03): add verification exports to orchestrator hooks |

## Verification Evidence

```
Build: npm run build - clean (0 errors)
Exports from main index:
- VERIFICATION_REMINDER: string
- createVerificationReminder: function
- emitVerificationRequired: function
- DEFAULT_VERIFICATION_STEPS: object
```

## Decisions Made

1. **Soft enforcement via reminders:** Verification reminder is displayed to orchestrator but doesn't block execution. This matches the soft enforcement pattern established in 05-02.

2. **Event-driven tracking:** Added `verification_required` event type to enable logging/metrics of verification needs without requiring immediate action.

3. **Comprehensive reminder text:** The reminder explicitly states that subagents "FREQUENTLY LIE" to ensure orchestrator takes verification seriously.

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Ready for:**
- 05-04: Ralph Loop Implementation - can now emit ralph_loop_* events and use verification reminder

**Dependencies satisfied:**
- createSystemDirective from types.ts (05-02)
- emitEvent from event-system.ts (02-02)
- StateEventType extended with Phase 5 events
