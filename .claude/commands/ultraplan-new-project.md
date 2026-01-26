---
name: ultraplan:new-project
description: Initialize a new Ultra Planner project with PROJECT.md, ROADMAP.md, and STATE.md
allowed-tools: Read, Write, Glob, Grep, Bash, Task
---

# /ultraplan:new-project

Initialize a new Ultra Planner project by spawning the Planner agent for interview-driven planning.

## Step 1: Check Existing State

**Before spawning the Planner agent, check for existing planning files:**

```bash
# Check if .planning directory exists
ls -la .planning/

# Check if PROJECT.md exists
ls -la .planning/PROJECT.md

# Check if ROADMAP.md exists
ls -la .planning/ROADMAP.md
```

**Decision Matrix:**

| Condition | Action |
|-----------|--------|
| `.planning/` exists AND `PROJECT.md` exists | Warn user: "Project already initialized. Use /ultraplan:status or edit PROJECT.md directly." STOP. |
| `.planning/` exists OR `PROJECT.md` exists | Ask user: "Partial initialization detected. Continue anyway?" If yes, proceed. If no, STOP. |
| Neither exists | Proceed to Step 2 |

**Unattended Mode:**
When running in `/thorough` mode or with `--auto-proceed` flag, skip confirmations and automatically proceed with initialization.

## Step 2: Spawn Planner Agent

**Invoke the ultraplan-planner agent via Task tool:**

```
Task(
  subagent_type="ultraplan-planner",
  model="opus",
  prompt="""
You are helping the user start a new project.

## Mode
NEW-PROJECT (full interview flow)

## Project Hint
{user_description_or_directory_name}

## Environment
Current directory: {pwd}
Directory name: {basename of pwd}

## Existing Code
{brownfield or greenfield detection}

## Instructions
1. Begin interview - ask ONE question at a time
2. After 5-7 questions or user says "make the plan", generate documents
3. Display summary and wait for explicit approval

Begin now with your first question.
"""
)
```

**Context Assembly:**

Before spawning, gather context to populate the prompt template:

```bash
# Get current directory
pwd

# Get directory basename
basename $(pwd)

# Detect brownfield vs greenfield
if ls src/ lib/ app/ 2>/dev/null | grep -q .; then
  echo "BROWNFIELD: Existing source code detected"
else
  echo "GREENFIELD: Starting from scratch"
fi

# Check for README.md with project description
if [ -f README.md ]; then
  head -n 5 README.md
fi
```

**User Description Extraction:**

If user provided description like "/ultraplan:new-project for a task manager", extract "for a task manager" as the project hint.

If no description provided, use directory name as initial hint.

## Step 3: Context Assembly Details

**Information to gather before spawning Planner:**

| Data | Command | Example Output |
|------|---------|---------------|
| Current directory | `pwd` | `/home/user/my-project` |
| Directory name | `basename $(pwd)` | `my-project` |
| Project type | `ls src/ lib/ app/` | Files found = brownfield, None = greenfield |
| Existing README | `cat README.md` (if exists) | Extract project description |

**Template Variable Replacement:**

```
{pwd} → /home/user/my-project
{basename of pwd} → my-project
{user_description_or_directory_name} → "for a task manager" OR "my-project"
{brownfield or greenfield detection} → "BROWNFIELD: Found src/ with 23 TypeScript files" OR "GREENFIELD: No existing source code"
{readme_hint} → First few lines from README.md if exists, or "None"
```

**Compiled Prompt Example:**

```
You are helping the user start a new project.

## Mode
NEW-PROJECT (full interview flow)

## Project Hint
for a task manager

## Environment
Current directory: /home/user/task-app
Directory name: task-app

## Existing Code
BROWNFIELD: Found src/ with 12 TypeScript files

## README Context
A simple task management application for personal productivity...

## Instructions
1. Begin interview - ask ONE question at a time
2. After 5-7 questions or user says "make the plan", generate documents
3. Display summary and wait for explicit approval

Begin now with your first question.
```

## Step 4: Exit Conditions

**Success:**
- Planner agent completes interview
- Planner generates PROJECT.md, ROADMAP.md, STATE.md
- User approves the plan
- Command exits with success message

**Failure:**
| Failure Condition | Action |
|------------------|--------|
| User cancels during interview | Stop Planner, inform user, exit gracefully |
| File write permission denied | Report error, suggest running with appropriate permissions |
| Planner agent errors | Display error, suggest retrying or reporting issue |

## Step 5: Error Handling

**Pre-flight Checks:**

```bash
# Check write permissions
touch .planning-test && rm .planning-test || echo "ERROR: No write permission in current directory"

# Check if git repository (optional warning)
git rev-parse --git-dir 2>/dev/null && echo "INFO: Git repository detected"

# Verify agent definition exists
if [ ! -f .claude/agents/ultraplan-planner.md ]; then
  echo "ERROR: ultraplan-planner agent not found at .claude/agents/ultraplan-planner.md"
  exit 1
fi
```

**Error Table:**

| Error | Detection | Recovery |
|-------|----------|---------|
| No write permission | `touch` test fails | Inform user, suggest `sudo` or changing directory |
| Already initialized | `.planning/` exists + `PROJECT.md` exists | Ask user to confirm overwrite or use different command |
| Planner spawn failure | Task tool returns error | Display error message, check agent definition exists |
| Interview interrupted | User sends cancellation signal | Clean up partial files, inform user |
| Agent definition missing | `.claude/agents/ultraplan-planner.md` not found | Display error, suggest running setup or checking installation |
| Partial initialization | Only some files exist | In unattended mode: clean up and start fresh. In interactive mode: ask user |

## Next Steps After Completion

After successful initialization:
1. Review generated .planning/PROJECT.md for accuracy
2. Edit .planning/ROADMAP.md to adjust milestone ordering if needed
3. Run `/ultraplan:status` to see project state
4. Use `/ultraplan:plan-phase 1` to create first phase plans
5. Use `/ultraplan:execute 01-01` to begin first phase execution

## Implementation Notes

**Directory Structure:**
- All planning files are stored in `.planning/` directory (not `.ultraplan/`)
- Use `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`
- Phase plans stored in `.planning/phases/XX-name/`
- State files in `.planning/state/`

**Agent Configuration:**
- Agent definition: `.claude/agents/ultraplan-planner.md`
- Must use `subagent_type="ultraplan-planner"` when spawning via Task tool
- Model: Always use `opus` for strategic planning tasks

**Task Tool Invocation Format:**
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

## Usage Examples

**Simple invocation:**
```
/ultraplan:new-project
```

**With project description:**
```
/ultraplan:new-project for a REST API that manages tasks
```

**In existing codebase:**
```
/ultraplan:new-project to refactor authentication system
```

**Unattended mode (auto-proceed):**
```
/thorough /ultraplan:new-project for a dashboard
```
