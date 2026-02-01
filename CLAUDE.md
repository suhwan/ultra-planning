# Ultra Planning Project

## CRITICAL: Agent Workflow Guidelines

**This project uses a HYBRID workflow. Follow these rules STRICTLY.**

### Agent Selection (MANDATORY)

| Phase | Agent to Use | Model | NEVER Use |
|-------|--------------|-------|-----------|
| Research | `gsd-phase-researcher` | opus | - |
| Planning | `gsd-planner` | opus | - |
| Execution | `ultraplan-executor` | opus | `oh-my-claudecode:executor` |
| Verification | `ultraplan-architect` | opus | - |
| Critique | `ultraplan-critic` | opus | - |
| Build Fixes | `oh-my-claudecode:build-fixer` | sonnet | - |

### Execution Protocol

```
┌─────────────────────────────────────────────────────────────┐
│  PLAN-PHASE WORKFLOW                                        │
│                                                             │
│  1. RESEARCH: gsd-phase-researcher (opus)                   │
│  2. PLAN: gsd-planner (opus)                                │
│  3. VERIFY PLAN: ultraplan-architect + ultraplan-critic     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  EXECUTE-PLAN WORKFLOW                                      │
│                                                             │
│  For each task in PLAN.md:                                  │
│  1. EXECUTE: ultraplan-executor (opus) - single task        │
│  2. VERIFY: ultraplan-architect (opus) - verify completion  │
│  3. If verification fails → retry with feedback             │
│  4. After success → atomic commit                           │
└─────────────────────────────────────────────────────────────┘
```

### Model Tier Enforcement

**ALL code execution and planning MUST use `model: opus`**

| Task Type | Model | Rationale |
|-----------|-------|-----------|
| Code writing | opus | Quality code generation |
| Planning | opus | Strategic thinking |
| Verification | opus | Deep analysis |
| Build fixing | sonnet | Speed for simple fixes |
| Quick lookups | haiku | Token efficiency |

### FORBIDDEN

1. **NEVER** use `oh-my-claudecode:executor` for task execution
2. **NEVER** use `sonnet` model for code generation tasks
3. **NEVER** skip verification after task completion
4. **NEVER** claim completion without running verify command

---

## Unattended Execution Mode

When `/thorough all` or `/thorough from {N}` is running:

**CRITICAL: Do NOT ask user questions. Auto-decide everything.**

### Auto-Response Rules

| Situation | Automatic Decision |
|-----------|-------------------|
| Multiple implementation approaches | Choose simplest |
| Library choice | Use existing in project |
| Naming decisions | Follow existing conventions |
| y/n confirmation prompts | Always `y` |
| 3-option menus | See specific rules below |

### GSD Skill Auto-Responses

| Prompt | Auto-Response |
|--------|---------------|
| "RESEARCH BLOCKED" choices | Skip research and plan anyway |
| "Existing plans" choices | Replan from scratch |
| "Max iterations reached" choices | Force proceed |
| Any "Proceed? (y/n)" | y |
| Any "Overwrite? (y/n)" | y |

### When to Actually Stop

Only stop for:
1. Architect review failed 3x consecutively
2. Build errors unfixable after 3 attempts
3. File system errors (permission denied, disk full)
4. Missing critical dependencies that cannot be auto-installed

### Execution Flags

Use these flags to minimize interruptions:
- `--skip-verify` - Skip verification loops
- `--skip-research` - Skip research phase

### Progress Tracking

After each phase completion:
1. Update ROADMAP.md checkbox `- [ ]` to `- [x]`
2. Commit changes with message: `feat(phase-N): complete {phase-name}`
3. Automatically proceed to next phase
