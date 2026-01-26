---
phase: 07-cli-commands
plan: 01
subsystem: command-infrastructure
tags: [cli, commands, keywords, triggers]
dependencies:
  requires: []
  provides: [/ultraplan:new-project command, keyword-to-command mapping]
  affects: [07-02, 07-03]
tech-stack:
  added: []
  patterns: [keyword detection, command routing]
key-files:
  created: [src/orchestration/keywords/command-triggers.ts]
  modified: [.claude/commands/ultraplan-new-project.md]
decisions:
  - id: DIR-NAMING
    choice: Use .planning/ not .ultraplan/ for all directory references
    rationale: Consistency with existing project structure
metrics:
  duration: 2.4 minutes
  completed: 2026-01-26
---

# Phase 07 Plan 01: /ultraplan:new-project Command + Keyword Triggers Summary

**One-liner:** Finalized /ultraplan:new-project command with .planning/ directory structure, Task tool invocation format, and keyword-to-command mapping for natural language triggers.

## What Was Built

### 1. Updated /ultraplan:new-project Command

**File:** `.claude/commands/ultraplan-new-project.md`

**Changes Made:**
- Fixed all directory references from `.ultraplan/` to `.planning/`
- Added complete Task tool invocation format with template variables
- Added unattended mode support for `/thorough` automation
- Added comprehensive error handling (agent missing, partial initialization)
- Added pre-flight checks including agent definition verification
- Documented proper directory structure and agent configuration

**Key Features:**
- Validates existing state before spawning planner
- Detects brownfield vs greenfield projects
- Extracts user description from command arguments
- Gathers context (pwd, directory name, README hints)
- Spawns ultraplan-planner agent with complete context
- Handles errors gracefully with recovery options

### 2. Command Keyword Trigger Mapping

**File:** `src/orchestration/keywords/command-triggers.ts`

**Features:**
- `NEW_PROJECT_KEYWORD`: Maps "ultraplan new", "new project", etc. to `/ultraplan:new-project`
- `PLAN_PHASE_KEYWORD`: Maps "ultraplan plan", "plan phase" to `/ultraplan:plan-phase`
- `EXECUTE_KEYWORD`: Maps "ultraplan execute", "execute plan" to `/ultraplan:execute`
- `getCommandForKeyword()`: Orchestrator function for keyword detection
- Reuses `MagicKeyword` type from existing patterns.ts
- Extracts parameters from natural language (phase numbers, plan references)

## Technical Implementation

### Task Tool Invocation Format

```javascript
Task(
  subagent_type="ultraplan-planner",
  model="opus",
  prompt=`You are helping the user start a new project.

## Mode
NEW-PROJECT (full interview flow)

## Project Hint
${userDescription || directoryName}

## Environment
Current directory: ${pwd}
Directory name: ${directoryName}

## Existing Code
${brownfieldOrGreenfield}

## README Context
${readmeHint}

## Instructions
1. Begin interview - ask ONE question at a time
2. After 5-7 questions or user says "make the plan", generate documents
3. Display summary and wait for explicit approval

Begin now with your first question.`
)
```

### Keyword Detection Example

User says: "ultraplan new project for a task manager"

1. `getCommandForKeyword()` detects "ultraplan new"
2. Extracts description: "for a task manager"
3. Returns: `[COMMAND: /ultraplan:new-project for a task manager]`
4. Command executes with user description

## Verification Results

### Build Check
```bash
npx tsc --noEmit
```
**Result:** ✓ Clean compilation, no errors

### Artifact Check
- ✓ `.claude/commands/ultraplan-new-project.md` updated with .planning/ paths
- ✓ `src/orchestration/keywords/command-triggers.ts` created
- ✓ All must_haves truths verified

### Integration Check
- ✓ Command uses correct .planning/ directory structure
- ✓ Keywords map to command correctly
- ✓ Task tool invocation format is properly structured
- ✓ TypeScript types align with existing patterns.ts

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Use .planning/ not .ultraplan/ | Consistency with existing project structure | All paths updated throughout command |
| Add unattended mode support | Enable /thorough automation | Commands can auto-proceed without prompts |
| Add agent verification check | Prevent spawn failures | Pre-flight check ensures agent exists |
| Extract description from args | Enable descriptive project initialization | Users can provide context inline |

## Key Files

### Created
- `src/orchestration/keywords/command-triggers.ts` - Keyword to command mapping

### Modified
- `.claude/commands/ultraplan-new-project.md` - Complete command definition

## Next Phase Readiness

### Blockers
None

### Concerns
None

### Dependencies Satisfied
- Command references correct directory structure (.planning/)
- Agent definition exists (.claude/agents/ultraplan-planner.md)
- TypeScript types available (src/orchestration/keywords/types.ts)

### Ready For
- **07-02:** /ultraplan:plan-phase command (can use same keyword pattern)
- **07-03:** /ultraplan:execute command (can use same keyword pattern)
- **Integration:** Commands can be invoked via slash or natural language

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Finalize ultraplan-new-project command | 4ec658a | .claude/commands/ultraplan-new-project.md |
| 2 | Create command keyword trigger mapping | 4f667ea | src/orchestration/keywords/command-triggers.ts |

## Performance

**Duration:** 2.4 minutes
**Tasks:** 2/2 completed
**Commits:** 2

## Usage Examples

### Via Slash Command
```
/ultraplan:new-project for a REST API
```

### Via Natural Language
```
ultraplan new project for a task manager
```

```
new project for a dashboard with charts
```

### Unattended Mode
```
/thorough /ultraplan:new-project for a todo app
```

All trigger keywords automatically route to the proper command with context preserved.
