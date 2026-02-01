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

## MANDATORY: Native Tasks with Dependencies

**ALWAYS use Claude Code's Native Tasks (TaskCreate/TaskUpdate) for execution tracking.**

### Task Registration Protocol

When executing a PLAN.md, register ALL tasks BEFORE execution:

```
1. Parse PLAN.md for all <task> elements
2. For each task, call TaskCreate with:
   - subject: "{plan}-{task_num}: {task_name}"
   - description: Task action summary
   - activeForm: Present continuous form

3. Set up blockedBy relationships based on waves:
   - Wave 1 tasks: No blockedBy
   - Wave 2 tasks: blockedBy = [all Wave 1 task IDs]
   - Wave 3 tasks: blockedBy = [all Wave 2 task IDs]

4. Execute tasks respecting blockedBy:
   - Only start tasks where blockedBy is empty or all completed
   - Update status to in_progress when starting
   - Update status to completed when done
```

### Example: Registering 3-Task Plan

```typescript
// Wave 1
TaskCreate({ subject: "16-01-01: Add types", ... })  // → #6

// Wave 2 (depends on Wave 1)
TaskCreate({ subject: "16-01-02: Implement monitor", ... })  // → #5
TaskUpdate({ taskId: "5", addBlockedBy: ["6"] })

// Wave 3 (depends on Wave 2)
TaskCreate({ subject: "16-01-03: Add tests", ... })  // → #7
TaskUpdate({ taskId: "7", addBlockedBy: ["5"] })
```

### Task Status Updates

| When | Action |
|------|--------|
| Task created | status: pending (default) |
| About to execute | TaskUpdate status: in_progress |
| Executor returns success | TaskUpdate status: completed |
| Executor returns failure | Keep in_progress, retry |

### Parallel Execution with blockedBy

```
TaskList shows:
#5 [pending] 16-01-02: Implement monitor [blocked by #6]
#6 [in_progress] 16-01-01: Add types
#7 [pending] 16-01-03: Add tests [blocked by #5]

When #6 completes:
#5 [pending] 16-01-02: Implement monitor  ← NOW UNBLOCKED
#6 [completed] 16-01-01: Add types
#7 [pending] 16-01-03: Add tests [blocked by #5]
```

### FORBIDDEN (Tasks)

1. **NEVER** execute tasks without registering in Native Tasks first
2. **NEVER** skip blockedBy setup for multi-wave plans
3. **NEVER** mark task completed without verification passing

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
