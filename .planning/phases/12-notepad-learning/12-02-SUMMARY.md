---
phase: 12-notepad-learning
plan: 02
status: complete
started: 2026-01-27T03:47:00Z
completed: 2026-01-27T03:50:00Z
duration: ~3m
subsystem: notepad
tags: [reader, injector, wisdom, prompt-injection]

dependency-graph:
  requires: ["12-01"]
  provides: ["notepad-read-api", "wisdom-injection"]
  affects: ["12-03"]

tech-stack:
  added: []
  patterns: ["WisdomSummary extraction", "priority-ordered formatting", "token-budget management"]

key-files:
  created:
    - src/notepad/reader.ts
    - src/notepad/injector.ts
  modified:
    - src/notepad/index.ts

decisions:
  - id: "entry-parsing"
    choice: "Split by ISO timestamp headers with regex"
    rationale: "Reliable delimiter for append-only markdown entries"
  - id: "priority-order"
    choice: "issues > decisions > learnings"
    rationale: "Most actionable first - blockers and context before patterns"
  - id: "token-split"
    choice: "Half budget each for plan and project wisdom"
    rationale: "Fair allocation when both exist"

metrics:
  tasks: 3
  commits: 3
  files-created: 2
  files-modified: 1
  lines-added: ~270
---

# Phase 12 Plan 02: Notepad Reader & Injector Summary

**One-liner:** Wisdom extraction and prompt injection with priority ordering and token budget management.

## What Was Built

### src/notepad/reader.ts
Reading and parsing functions for extracting wisdom from notepad files:
- `readNotepadFile(planId, category, config)` - Read raw markdown content
- `extractRecentEntries(content, limit)` - Parse timestamp-delimited entries
- `getWisdomForPlan(planId, config)` - Extract WisdomSummary from all categories
- `getProjectWisdom(config)` - Access project-level wisdom

### src/notepad/injector.ts
Formatting functions for prompt injection:
- `formatWisdomForPrompt(wisdom, maxTokens)` - Format with priority order
- `createWisdomDirective(planId, config)` - Full directive with write instructions
- `hasWisdom(planId, config)` - Quick existence check

### Key Implementation Details

1. **Entry Parsing**: Splits markdown by `## YYYY-MM-DDTHH:MM:SSZ | Task:` headers
2. **Priority Order**: Issues (blockers) > Decisions (context) > Learnings (patterns)
3. **Token Budget**: Uses CHARS_PER_TOKEN (4) constant, splits budget 50/50 for plan/project
4. **Write Instructions**: Includes APPEND-only warning in directive (prevents Edit tool usage)

## Commits

| Hash | Message |
|------|---------|
| c6975a1 | feat(12-02): create notepad reader module |
| 91441c0 | feat(12-02): create wisdom injector module |
| d85ed44 | feat(12-02): export reader and injector from notepad module |

## Verification Results

- [x] npx tsc --noEmit - All files compile
- [x] npm run build - Project builds successfully
- [x] Manual test - addLearning, getWisdomForPlan, formatWisdomForPrompt work correctly

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria Checklist

- [x] src/notepad/reader.ts exports getWisdomForPlan, extractRecentEntries
- [x] src/notepad/injector.ts exports formatWisdomForPrompt, createWisdomDirective
- [x] getWisdomForPlan returns WisdomSummary with tokenEstimate
- [x] formatWisdomForPrompt respects maxTokens budget
- [x] createWisdomDirective includes notepad write instructions
- [x] npm run build passes

## Next Phase Readiness

Plan 12-03 can proceed. Reader and injector are ready for:
- Orchestrator integration (pre-delegation wisdom injection)
- Propagation hooks in orchestrator spawn functions
