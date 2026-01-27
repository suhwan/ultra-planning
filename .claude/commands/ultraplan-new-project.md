---
name: ultraplan:new-project
description: Initialize a new Ultra Planner project with Research → Plan → Ralplan verification flow
allowed-tools: Read, Write, Glob, Grep, Bash, Task
---

# /ultraplan:new-project

Initialize a new Ultra Planner project with full Research → Plan → Ralplan verification flow.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│  /ultraplan-new-project                                      │
│                                                              │
│  1. RESEARCH — 프로젝트 도메인 리서치                         │
│  2. PLAN — 인터뷰 + PROJECT.md, ROADMAP.md 생성              │
│  3. RALPLAN — Architect + Critic 합의까지 검증               │
└─────────────────────────────────────────────────────────────┘
```

## Usage

```
/ultraplan:new-project [description] [--skip-research]
```

**Examples:**
```
/ultraplan:new-project                           # Full flow with research
/ultraplan:new-project for a task manager        # With project hint
/ultraplan:new-project --skip-research           # Skip research step
```

**Flags:**
- `--skip-research` — Skip the research phase (faster, less informed)

## Step 1: Check Existing State

```bash
# Check if .planning directory exists
ls -la .planning/

# Check if PROJECT.md exists
ls -la .planning/PROJECT.md
```

**Decision Matrix:**

| Condition | Action |
|-----------|--------|
| `.planning/` exists AND `PROJECT.md` exists | Warn: "Project already initialized." STOP. |
| `.planning/` exists OR `PROJECT.md` exists | Ask: "Partial initialization. Continue?" |
| Neither exists | Proceed to Step 2 |

## Step 2: Research Phase

**Skip if `--skip-research` flag is set.**

```javascript
Task(
  subagent_type="ultraplan-researcher",
  model="opus",
  prompt="""
## Mode
PROJECT-RESEARCH (for new project initialization)

## Project Hint
${user_description_or_directory_name}

## Environment
Current directory: ${pwd}
Directory name: ${basename}

## Existing Code
${brownfield_or_greenfield}

## Instructions
1. Investigate codebase (if brownfield)
2. Research domain and technologies
3. Identify patterns, risks, unknowns
4. Write findings to .planning/research/PROJECT-RESEARCH.md

## Output
Return RESEARCH COMPLETE or RESEARCH BLOCKED
"""
)
```

**Handle Research Result:**

| Result | Action |
|--------|--------|
| RESEARCH COMPLETE | Proceed to Step 3 |
| RESEARCH BLOCKED | Show blockers, offer: 1) Provide info, 2) Skip research, 3) Abort |

## Step 3: Planner Interview + Document Generation

```javascript
Task(
  subagent_type="ultraplan-planner",
  model="opus",
  prompt="""
## Mode
NEW-PROJECT (full interview flow)

## Project Hint
${user_description_or_directory_name}

## Research Findings
${research_content}  // from Step 2

## Environment
Current directory: ${pwd}
Directory name: ${basename}
Existing Code: ${brownfield_or_greenfield}

## Instructions
1. Begin interview - ask ONE question at a time using AskUserQuestion tool
2. After 5-7 questions or user says "make the plan", generate documents
3. Write PROJECT.md, ROADMAP.md, STATE.md to .planning/
4. Display summary

Begin now with your first question.
"""
)
```

## Step 4: Consensus Loop (Architect + Critic)

**Ralplan-style verification: Documents must satisfy BOTH agents.**

```
┌──────────────────────────────────────────────────────────────┐
│                    CONSENSUS LOOP                            │
│                                                              │
│   ┌─────────┐    ┌───────────┐    ┌────────┐                │
│   │ Planner │───▶│ Architect │───▶│ Critic │                │
│   └─────────┘    └───────────┘    └────────┘                │
│        ▲                               │                     │
│        │         NOT SATISFIED         │                     │
│        └───────────────────────────────┘                     │
│                                                              │
│   Loop until: Architect APPROVED + Critic SATISFIED          │
│   Max iterations: 5                                          │
└──────────────────────────────────────────────────────────────┘
```

**Step 4a: Architect Review**

```javascript
Task(
  subagent_type="ultraplan-architect",
  model="opus",
  prompt="""
## Mode
PROJECT-REVIEW (verify PROJECT.md and ROADMAP.md)

## Documents to Review
${PROJECT_MD_CONTENT}
${ROADMAP_MD_CONTENT}

## Review Checklist

### PROJECT.md Quality
- [ ] Clear goal statement
- [ ] Requirements have REQ-XX IDs
- [ ] Constraints documented
- [ ] Scope boundaries defined

### ROADMAP.md Quality
- [ ] Phases derived goal-backward
- [ ] Dependencies form valid DAG
- [ ] Success criteria are observable
- [ ] Estimates are reasonable

## Output
Return:
- `## PROJECT REVIEW: APPROVED` — pass to Critic
- `## PROJECT REVIEW: ISSUES FOUND` — back to Planner
"""
)
```

**Step 4b: Critic Review (only if Architect APPROVED)**

```javascript
Task(
  subagent_type="ultraplan-critic",
  model="opus",
  prompt="""
## Mode
PROJECT-CRITIQUE (challenge project assumptions)

## Documents to Critique
${PROJECT_MD_CONTENT}
${ROADMAP_MD_CONTENT}

## Architect Assessment
${ARCHITECT_RESULT}

## Your Role
Challenge what Architect might have missed:
- Are requirements realistic?
- Are there hidden risks?
- Is the scope achievable?
- Are estimates too optimistic?

## Output
Return:
- `## CRITIC VERDICT: SATISFIED` — consensus reached
- `## CRITIC VERDICT: NOT SATISFIED` — back to Planner
"""
)
```

**Step 4c: Planner Revision (if not satisfied)**

```javascript
Task(
  subagent_type="ultraplan-planner",
  model="opus",
  prompt="""
## Mode
PROJECT-REVISION (address feedback)

## Current Documents
${PROJECT_MD_CONTENT}
${ROADMAP_MD_CONTENT}

## Feedback to Address

### From Architect:
${ARCHITECT_ISSUES}

### From Critic:
${CRITIC_CONCERNS}

## Instructions
1. Address each concern
2. Update PROJECT.md and/or ROADMAP.md
3. Respond to questions explicitly

Return revised documents.
"""
)
```

**Consensus Loop Logic:**

```python
iteration = 0
MAX_ITERATIONS = 5

while iteration < MAX_ITERATIONS:
    architect_result = spawn_architect_review()

    if architect_result == "ISSUES FOUND":
        iteration += 1
        spawn_planner_revision(architect_issues)
        continue

    critic_result = spawn_critic_review()

    if critic_result == "SATISFIED":
        # CONSENSUS REACHED!
        proceed_to_step_5()
        break

    iteration += 1
    spawn_planner_revision(critic_concerns)

if iteration >= MAX_ITERATIONS:
    ask_user: "Force proceed or manual fix?"
```

## Step 5: Display Summary

```markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ULTRAPLAN ► PROJECT INITIALIZED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Project:** {project_name}
**Core Value:** {core_value_statement}

Documents Created:
  ✓ .planning/PROJECT.md
  ✓ .planning/ROADMAP.md
  ✓ .planning/STATE.md

Phases: {N} phases planned
Research: {Completed | Skipped}
Verification: Architect ✓ Critic ✓

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Plan Phase 1** — create detailed execution plans

/ultraplan-plan-phase 1

───────────────────────────────────────────────────────────────
```

## Error Handling

| Error | Detection | Recovery |
|-------|----------|---------|
| No write permission | `touch` test fails | Suggest changing directory |
| Already initialized | PROJECT.md exists | Warn and stop |
| Research blocked | Researcher returns BLOCKED | Offer skip option |
| Consensus not reached | 5 iterations exceeded | Ask user to proceed or fix |
| Agent spawn failure | Task returns error | Display error, suggest retry |

## Directory Structure Created

```
.planning/
├── PROJECT.md          # Requirements, constraints, scope
├── ROADMAP.md          # Phase structure, dependencies
├── STATE.md            # Progress tracking
├── config.json         # Configuration
├── research/           # Research documents
│   └── PROJECT-RESEARCH.md
├── phases/             # Phase directories (created later)
└── state/              # State files
```
