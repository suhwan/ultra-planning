# Learnings: 02-04 New Project Command

## Command Definition Structure

Command files in `.claude/commands/` follow this pattern:

```yaml
---
name: skill-name:command-name
description: Brief description
allowed-tools: Read, Write, Glob, Grep, Bash, Task
---
```

Key points:
- Command name uses colon separator (e.g., `ultraplan:new-project`)
- `allowed-tools` must include `Task` when spawning agents
- Markdown content after frontmatter documents the command behavior

## Task Tool Invocation Pattern

To spawn an agent via Task tool:

```
Task(
  subagent_type="agent-name",
  model="opus|sonnet|haiku",
  prompt="""
[Multi-line prompt with context]
"""
)
```

Important:
- `subagent_type` references the agent definition file name (without .md)
- Model selection determines capability/cost tradeoff
- Prompt should include mode, context, and clear instructions

## Context Gathering Before Delegation

Before spawning agents, gather context with bash commands:

```bash
pwd                    # Current directory
basename $(pwd)        # Directory name
ls src/ lib/ app/      # Detect existing code
cat README.md          # Extract project info
```

This enables rich context in the agent prompt.

## Pre-flight Checks Pattern

Commands that modify files should check:

1. **Existing state** - Does work already exist?
2. **Permissions** - Can we write to the directory?
3. **Prerequisites** - Are dependencies met?

Use decision matrices to document branching logic.

## Documentation Depth

Command documentation should include:

- Step-by-step process flow
- Decision matrices for conditional logic
- Error handling tables
- Context assembly details
- Usage examples

Aim for 100+ lines for complex commands that spawn agents.

## Skill Directory Structure

Skill definitions reference:
- `commands/` - Command entry points
- `agents/` - Agent definitions
- `skills/` - Skill metadata and templates

Update skill SKILL.md to reflect all three directories in the structure diagram.
