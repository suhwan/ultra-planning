---
name: ultraplan:new-project
description: Initialize a new Ultra Planner project. Creates .ultraplan/ directory, PROJECT.md, ROADMAP.md skeleton, and STATE.md. Use when starting a new project or migrating an existing codebase to Ultra Planner.
disable-model-invocation: true
allowed-tools: Read, Write, Bash, Glob
---

# /ultraplan:new-project

Initialize a new Ultra Planner project.

## What This Does

1. Creates `.ultraplan/` directory structure
2. Creates `config.json` with default settings
3. Prompts for project description
4. Generates `PROJECT.md` with requirements structure
5. Generates `ROADMAP.md` skeleton (phases TBD)
6. Creates `STATE.md` for progress tracking

## Usage

```
/ultraplan:new-project
```

Then describe your project when prompted.

## Prerequisites

- No existing `.ultraplan/` directory (will warn if exists)
- Write access to project root

## Generated Files

| File | Description |
|------|-------------|
| `.ultraplan/config.json` | Project configuration |
| `PROJECT.md` | Project definition with requirements |
| `ROADMAP.md` | Phase breakdown (skeleton) |
| `STATE.md` | Progress tracking |

## Templates Used

- @.claude/skills/ultraplan/templates/project.md
- @.claude/skills/ultraplan/templates/roadmap.md
- @.claude/skills/ultraplan/templates/state.md

## Next Steps

After initialization:
1. Review and edit PROJECT.md requirements
2. Run `/ultraplan:plan` to generate ROADMAP phases (Phase 2)
3. Run `/ultraplan:status` to check progress
