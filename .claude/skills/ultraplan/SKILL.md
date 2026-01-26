---
name: ultraplan
description: Document-driven workflow orchestration system. Creates PROJECT.md, ROADMAP.md, and PLAN.md with automatic Claude Tasks synchronization. Use /ultraplan:new-project to start, /ultraplan:status to check progress.
disable-model-invocation: true
allowed-tools: Read, Write, Bash, Glob, Grep, Task
---

# Ultra Planner

Document-driven workflow orchestration for Claude Code.

## Commands

| Command | Description |
|---------|-------------|
| `/ultraplan:new-project` | Initialize new project with PROJECT.md, ROADMAP.md |
| `/ultraplan:status` | Show current project state and progress |

## Quick Start

1. Run `/ultraplan:new-project` to initialize
2. Describe your project when prompted
3. Review generated PROJECT.md and ROADMAP.md
4. Run `/ultraplan:status` to see progress

## Directory Structure

```
.ultraplan/                 # Runtime state
├── config.json             # Project configuration
├── state/                  # Session state
└── logs/                   # Execution logs

PROJECT.md                  # Project definition
ROADMAP.md                  # Phase breakdown
STATE.md                    # Progress tracking
```

## Configuration

Edit `.ultraplan/config.json` to customize:

- `mode`: "interactive" (default) or "autopilot"
- `depth`: "quick", "standard", or "comprehensive"
- `parallelization.max_workers`: 1-5 (default 5)

## References

- [Document Templates](templates/) - PROJECT, ROADMAP, PLAN, STATE templates
- [Schemas](references/schemas.md) - YAML frontmatter and XML task schemas
- [State Protocol](references/state-protocol.md) - When and how STATE.md updates

---
*Ultra Planner v1.0.0*
