# Spawn Protocol: Fresh Executor Agents

## Overview

This document defines how the orchestrator spawns executor agents with fresh 200k context windows. The spawn protocol ensures:
- Zero context pollution between tasks
- Explicit model selection for cost optimization
- Structured prompt injection with task XML
- Reliable result parsing and error handling

## Core Principles

### Fresh Context Advantage

Each executor agent is spawned with a FRESH 200k context window:

| Aspect | Benefit |
|--------|---------|
| No accumulated state | Clean slate for each task |
| Full context available | Complex tasks get full attention |
| No error propagation | Previous failures don't pollute |
| Predictable behavior | Same input → same execution pattern |

### Spawn vs Direct Execution

| Approach | When to Use | Context |
|----------|-------------|---------|
| **Spawn (Task tool)** | Individual task execution | Fresh 200k |
| **Direct (no spawn)** | Status checks, reads only | Current context |

**Rule:** All code modifications MUST use spawned executors.

### Model Selection Strategy

Cost-efficient model routing based on task complexity:

| Task Type | Model | Rationale |
|-----------|-------|-----------|
| Simple file edit | `haiku` | Fast, cheap, sufficient |
| Standard implementation | `sonnet` | Balanced quality/cost (DEFAULT) |
| Complex refactoring | `opus` | Maximum reasoning power |

**Default:** Always use `sonnet` unless task explicitly requires simpler or more complex reasoning.

## Task Tool Spawning Syntax

### Basic Spawn Pattern

The orchestrator spawns executors using the Task tool with explicit parameters:

```
Task(
  subagent_type="oh-my-claudecode:ultraplan-executor",
  model="sonnet",
  prompt="<task_injection>"
)
```

### Parameter Reference

| Parameter | Required | Description |
|-----------|----------|-------------|
| `subagent_type` | YES | Agent definition path (e.g., `oh-my-claudecode:ultraplan-executor`) |
| `model` | YES | Model tier: `haiku`, `sonnet`, or `opus` |
| `prompt` | YES | The injected prompt containing task XML and context |

### CRITICAL: Always Specify Model

**NEVER rely on default model selection.** Always pass `model` explicitly:

```
# CORRECT - explicit model
Task(subagent_type="...", model="sonnet", prompt="...")

# WRONG - implicit model (unpredictable)
Task(subagent_type="...", prompt="...")
```

### Agent Type Resolution

The `subagent_type` resolves to agent definition files:

| subagent_type | Resolves To |
|---------------|-------------|
| `oh-my-claudecode:ultraplan-executor` | `.claude/agents/ultraplan-executor.md` |
| `oh-my-claudecode:ultraplan-architect` | `.claude/agents/ultraplan-architect.md` |
| `oh-my-claudecode:ultraplan-planner` | `.claude/agents/ultraplan-planner.md` |

The agent definition file provides:
- Role and identity constraints
- Input/output contract
- Execution protocol
- Constraints and anti-patterns

## Prompt Template for Task Injection

### Standard Injection Template

The orchestrator injects tasks using this template structure:

```markdown
# Task Execution Request

## Context

Project: {project_name}
Phase: {phase_number} - {phase_name}
Plan: {plan_file}
Task: {task_number} of {total_tasks}

## Project Reference

{brief_project_summary_from_PROJECT.md}

## Task to Execute

{raw_task_xml_from_plan}

## Execution Instructions

1. Parse the task XML above
2. Follow the <action> steps precisely
3. Only modify files listed in <files>
4. Run <verify> command to prove completion
5. Return structured result in YAML format

## Required Output Format

Return a YAML block with:
- status: success | failure | blocked
- task_name: The task name from XML
- files_modified: List of files you changed
- verification: Command, exit code, output summary
- done_criteria_met: true | false
- evidence: How you satisfied <done> criteria
- error: null or error description
```

### Template Variables

| Variable | Source | Example |
|----------|--------|---------|
| `{project_name}` | PROJECT.md title | "Ultra Planner" |
| `{phase_number}` | PLAN.md frontmatter | "03" |
| `{phase_name}` | ROADMAP.md phase title | "Sequential Execution" |
| `{plan_file}` | Current plan path | "03-02-PLAN.md" |
| `{task_number}` | Task sequence | "2" |
| `{total_tasks}` | Count of tasks in plan | "5" |
| `{brief_project_summary}` | First 2 paragraphs of PROJECT.md | "Ultra Planner is..." |
| `{raw_task_xml}` | Complete <task>...</task> from PLAN.md | `<task type="auto">...` |

### Minimal vs Full Context

| Context Level | Include | When to Use |
|---------------|---------|-------------|
| **Minimal** | Task XML only | Simple, isolated tasks |
| **Standard** | Task + Project summary + Phase context | Most tasks (DEFAULT) |
| **Full** | Task + Project + Dependencies + Recent results | Complex, dependent tasks |

**Default:** Use Standard context unless task has specific needs.

### Example: Complete Injection

```markdown
# Task Execution Request

## Context

Project: Ultra Planner
Phase: 03 - Sequential Execution
Plan: 03-02-PLAN.md
Task: 1 of 4

## Project Reference

Ultra Planner is a workflow orchestration system that generates PROJECT.md,
ROADMAP.md, and PLAN.md documents and synchronizes them with Claude Tasks
for parallel execution.

## Task to Execute

<task type="auto">
  <name>Task 1: Create spawn protocol document</name>
  <files>.claude/skills/ultraplan/references/spawn-protocol.md</files>
  <action>
Create the spawn protocol reference document with:
1. Core concepts section
2. Task tool syntax
3. Prompt injection template
  </action>
  <verify>ls -la .claude/skills/ultraplan/references/spawn-protocol.md</verify>
  <done>Spawn protocol document exists with all sections</done>
</task>

## Execution Instructions

1. Parse the task XML above
2. Follow the <action> steps precisely
3. Only modify files listed in <files>
4. Run <verify> command to prove completion
5. Return structured result in YAML format

## Required Output Format

Return a YAML block with:
- status: success | failure | blocked
- task_name: The task name from XML
- files_modified: List of files you changed
- verification: Command, exit code, output summary
- done_criteria_met: true | false
- evidence: How you satisfied <done> criteria
- error: null or error description
```

## Result Parsing Protocol

### Expected Result Format

Executors return results in YAML format:

```yaml
status: success | failure | blocked
task_name: "Task N: Description"
files_modified:
  - path/to/file1.ts
  - path/to/file2.ts
verification:
  command: "npm test -- filename"
  exit_code: 0
  output_summary: "All tests passed"
done_criteria_met: true | false
evidence: |
  Description of what was done
  and how it satisfies acceptance criteria
error: null | "Error description"
```

### Parsing Steps

The orchestrator parses results in this order:

1. **Extract YAML Block:**
   - Find content between ```yaml and ```
   - If no YAML block found, treat as parse failure

2. **Validate Required Fields:**
   - `status` must be present and valid enum
   - `task_name` must match injected task
   - `verification` must have command and exit_code

3. **Interpret Status:**

   | Status | Meaning | Orchestrator Action |
   |--------|---------|---------------------|
   | `success` | Task complete, verified | Update STATE.md, trigger Architect |
   | `failure` | Task attempted, failed | Log error, queue retry with feedback |
   | `blocked` | Cannot start task | Analyze blocker, reorder if possible |

4. **Validate Verification:**
   - `exit_code: 0` required for success status
   - Non-zero exit code with success status → treat as failure
   - Missing verification with success status → treat as unverified

### Result Validation Rules

| Field | Validation | On Failure |
|-------|------------|------------|
| `status` | Must be `success`, `failure`, or `blocked` | Parse error |
| `task_name` | Must match injected task name | Log warning, continue |
| `files_modified` | Must be array of strings | Empty array default |
| `verification.exit_code` | Must be integer | Parse error |
| `done_criteria_met` | Must be boolean | Infer from status |
| `evidence` | Should be non-empty for success | Log warning |
| `error` | Required if status is failure/blocked | Log warning |

### Parse Failure Handling

If YAML parsing fails:

```yaml
# Synthesized failure result
status: failure
task_name: "{injected_task_name}"
files_modified: []
verification:
  command: null
  exit_code: null
  output_summary: null
done_criteria_met: false
evidence: null
error: |
  Result parsing failed.
  Raw output: {first_500_chars_of_response}
  Parse error: {yaml_parse_error}
```

## Error Handling

### Error Categories

| Category | Cause | Recovery |
|----------|-------|----------|
| **Spawn Failure** | Task tool invocation failed | Retry with backoff |
| **Timeout** | Executor exceeded time limit | Force terminate, log partial |
| **Parse Error** | Result not valid YAML | Synthesize failure result |
| **Model Error** | Model unavailable/overloaded | Retry with fallback model |
| **Agent Not Found** | subagent_type invalid | Fatal error, abort plan |

### Spawn Failure Protocol

If Task tool invocation fails:

```
Attempt 1: Spawn with original parameters
  ↓ (failure)
Wait 2 seconds
  ↓
Attempt 2: Retry same parameters
  ↓ (failure)
Wait 5 seconds
  ↓
Attempt 3: Retry with model fallback (sonnet → haiku)
  ↓ (failure)
ABORT: Mark task as blocked, log error
```

### Timeout Handling

Executors have implicit timeout (from Claude Code):

| Task Complexity | Expected Duration | Timeout Action |
|-----------------|-------------------|----------------|
| Simple | < 30 seconds | Wait |
| Standard | 30s - 2 minutes | Wait |
| Complex | 2 - 5 minutes | Monitor |
| Very long | > 5 minutes | Consider splitting |

If timeout occurs:
1. Log partial progress if available
2. Synthesize blocked result with timeout error
3. Queue task for retry OR escalate to user

### Model Fallback Chain

When primary model fails:

```
opus → sonnet → haiku → ABORT
sonnet → haiku → ABORT
haiku → ABORT
```

**Note:** Fallback only for transient errors (overload, rate limit).
Capability errors (task too complex for haiku) should NOT fallback.

### Error Result Format

All errors produce a structured result:

```yaml
status: blocked
task_name: "{task_name}"
files_modified: []
verification:
  command: null
  exit_code: null
  output_summary: null
done_criteria_met: false
evidence: null
error: |
  Error category: {category}
  Error message: {message}
  Retry count: {attempts}

  Suggested action: {suggestion}
```

### Suggested Actions by Error

| Error Category | Suggested Action |
|----------------|------------------|
| Spawn Failure | "Retry later or check Claude Code status" |
| Timeout | "Split task into smaller units or increase complexity allowance" |
| Parse Error | "Review executor agent definition for output format compliance" |
| Model Error | "Wait for model availability or try different model tier" |
| Agent Not Found | "Verify agent definition file exists at expected path" |

## Complete Spawn Flow Example

### Scenario

Orchestrator needs to execute Task 3 from 03-02-PLAN.md.

### Step 1: Extract Task from Plan

Orchestrator reads the PLAN.md and extracts:

```xml
<task type="auto">
  <name>Task 3: Add Prompt Template for Task Injection</name>
  <files>.claude/skills/ultraplan/references/spawn-protocol.md</files>
  <action>
Add the prompt template section for injecting tasks into executors...
  </action>
  <verify>grep -c "Prompt Template" .claude/skills/ultraplan/references/spawn-protocol.md</verify>
  <done>Prompt template section complete with variables and example injection</done>
</task>
```

### Step 2: Build Injection Prompt

Orchestrator constructs the full prompt:

```markdown
# Task Execution Request

## Context

Project: Ultra Planner
Phase: 03 - Sequential Execution
Plan: 03-02-PLAN.md
Task: 3 of 6

## Project Reference

Ultra Planner is a document-driven workflow orchestration system...

## Task to Execute

<task type="auto">
  <name>Task 3: Add Prompt Template for Task Injection</name>
  ...
</task>

## Execution Instructions
...
```

### Step 3: Invoke Task Tool

Orchestrator calls:

```
Task(
  subagent_type="oh-my-claudecode:ultraplan-executor",
  model="sonnet",
  prompt="{constructed_injection_prompt}"
)
```

### Step 4: Executor Executes

Executor (in fresh 200k context):
1. Parses the task XML
2. Reads existing file (context gathering)
3. Adds the new section
4. Runs verify command
5. Returns result

### Step 5: Parse Result

Orchestrator receives:

```yaml
status: success
task_name: "Task 3: Add Prompt Template for Task Injection"
files_modified:
  - .claude/skills/ultraplan/references/spawn-protocol.md
verification:
  command: "grep -c \"Prompt Template\" .claude/skills/ultraplan/references/spawn-protocol.md"
  exit_code: 0
  output_summary: "3 matches found"
done_criteria_met: true
evidence: |
  Added Prompt Template section with:
  - Standard injection template with all variables
  - Template variable reference table
  - Minimal/Standard/Full context levels
  - Complete example injection
error: null
```

### Step 6: Update State

Orchestrator:
1. Validates result (status: success, exit_code: 0)
2. Updates STATE.md with completed task
3. Optionally triggers Architect verification
4. Proceeds to next task in wave

### Step 7: Handle Next Task (or Wave)

If more tasks in current wave: Spawn next executor
If wave complete: Check dependencies, start next wave
If plan complete: Mark plan done, update ROADMAP.md progress

## Spawn Protocol Checklist

Before spawning, verify:

- [ ] Task XML is complete (name, files, action, verify, done)
- [ ] Model parameter is explicitly set
- [ ] subagent_type resolves to valid agent file
- [ ] Injection prompt includes all required sections
- [ ] Result parsing is ready to handle all status types

After spawning, verify:

- [ ] Result YAML was parsed successfully
- [ ] Status is one of: success, failure, blocked
- [ ] Verification exit code matches status claim
- [ ] Files modified match task <files> list
- [ ] Evidence supports done_criteria_met claim

## Summary

The spawn protocol ensures reliable, isolated task execution:

1. **Extract** task XML from PLAN.md
2. **Build** injection prompt with context
3. **Spawn** executor with explicit model
4. **Execute** in fresh 200k context
5. **Parse** structured YAML result
6. **Validate** result against expectations
7. **Update** state and proceed

Each step has defined inputs, outputs, and error handling. The protocol is designed for reliability over speed - every task execution is verified before state updates.
