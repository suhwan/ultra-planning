---
name: ultraplan:status
description: Show current Ultra Planner project state including phase progress, current plan, and session continuity information. Use anytime to check where you are in the project.
disable-model-invocation: true
allowed-tools: Read, Bash, Glob
---

# /ultraplan:status

Display current project state and progress.

## What This Shows

1. Current phase and plan
2. Visual progress bar
3. Recent activity
4. Session continuity (where you left off)
5. Any blockers or pending decisions

## Usage

```
/ultraplan:status
```

## Output Format

```
Ultra Planner Status
====================

Project: {project_name}
Phase: {N} of {M} ({phase_name})
Plan: {X} of {Y}

Progress: [####░░░░░░░░░░░░░░░░] 20%

Last Activity: {date} - {description}

Session: {status}
Resume: {continue_file_or_none}

Blockers: {count}
Pending: {decisions_count}
```

## Data Sources

- `.ultraplan/config.json` - Project name, settings
- `STATE.md` - Progress, session continuity
- `ROADMAP.md` - Phase count, current phase details

## Error Conditions

| Condition | Message |
|-----------|---------|
| No .ultraplan/ | "Not an Ultra Planner project. Run /ultraplan:new-project first." |
| No STATE.md | "STATE.md not found. Project may be corrupted." |
| Stale state | "Warning: STATE.md may be out of sync with filesystem." |
