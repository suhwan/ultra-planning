# STATE.md Update Protocol

## When to Update

STATE.md is updated at these events:

| Event | Fields Updated |
|-------|----------------|
| Project initialized | All fields (initial values) |
| Phase planning started | Status -> "Planning", Current focus |
| Plan execution started | Status -> "In progress", Current plan |
| Plan completed | Progress bar, Plans completed, Metrics |
| Phase completed | Phase number, Reset current plan |
| Blocker encountered | Blockers/Concerns section |
| Decision made | Reference to PROJECT.md decision |
| Session ended | Session Continuity section |

## Progress Calculation

```
total_plans = sum(plans_in_each_phase)
completed_plans = count(SUMMARY.md files exist)
percentage = floor(completed_plans / total_plans * 100)
bar_filled = floor(percentage / 5)  # 20 chars = 5% each
progress_bar = '#' * bar_filled + '░' * (20 - bar_filled)
```

## Status Values

| Status | When |
|--------|------|
| Ready to plan | Phase directory exists, no PLAN.md yet |
| Planning | PLAN.md being created |
| In progress | Executing tasks from PLAN.md |
| Verifying | Architect/Critic reviewing |
| Complete | SUMMARY.md exists for all plans in phase |

## Deriving State from Filesystem

STATE.md should be verifiable against actual files:

- Phase N complete: `.planning/phases/NN-*/` has all SUMMARY.md files
- Plan complete: `{phase}-{plan}-SUMMARY.md` exists
- In progress: PLAN.md exists but no SUMMARY.md

If STATE.md diverges from filesystem, filesystem is source of truth.

## Session Continuity

On abnormal exit (crash, timeout, user interrupt):
1. Create `.ultraplan/state/continue.md` with:
   - Last executed task
   - Partial results
   - Next steps
2. Update STATE.md "Resume file" field

On next session start:
1. Check for continue.md
2. Offer to resume or start fresh
3. Clear continue.md after successful resume

## Task Result Events

When executor returns a result, STATE.md is updated based on the outcome:

### Success Result Updates

```
On status == "success":
  1. Increment "Plans completed" in Performance Metrics
  2. Update progress bar calculation
  3. Add duration to metrics if metadata.duration_ms present
  4. Update "Last activity" timestamp and description
  5. Check if phase complete (all tasks in phase done)
```

**Fields Updated:**
| Field | New Value |
|-------|-----------|
| Status | "In progress" (or "Complete" if phase done) |
| Last activity | "{date} - Completed {task_name}" |
| Progress | Recalculated with new completion |
| Velocity.Total plans completed | Incremented |
| By Phase table | Updated duration |

### Failure Result Updates

```
On status == "failure":
  1. Keep Status as "In progress"
  2. Add to Blockers/Concerns section
  3. Update "Last activity" with failure note
  4. Do NOT increment completed count
```

**Fields Updated:**
| Field | New Value |
|-------|-----------|
| Last activity | "{date} - Failed: {task_name}" |
| Blockers/Concerns | Add "{task_name}: {error summary}" |

### Blocked Result Updates

```
On status == "blocked":
  1. Keep Status as "In progress"
  2. Add to Blockers/Concerns with dependency info
  3. Update "Last activity" with blocked note
  4. Log for dependency reanalysis
```

**Fields Updated:**
| Field | New Value |
|-------|-----------|
| Last activity | "{date} - Blocked: {task_name}" |
| Blockers/Concerns | Add "{task_name}: {blocker reason}" |

### Progress Recalculation

After each successful task:

```
completed_tasks = count(tasks with status "success" in current plan)
total_tasks = count(all tasks in current plan)

# For phase-level progress:
completed_plans = count(SUMMARY.md files in phase)
total_plans = count(PLAN.md files in phase)
phase_percentage = floor(completed_plans / total_plans * 100)

# For project-level progress:
total_project_tasks = sum(tasks across all phases)
completed_project_tasks = sum(completed tasks across all phases)
project_percentage = floor(completed_project_tasks / total_project_tasks * 100)
```

## Gate Status Updates

STATE.md is updated at these gate events:

| Gate Event | Fields Updated |
|------------|----------------|
| Task starts execution | gate_status -> EXECUTING, gate_step -> 1 |
| Executor completes | executor_status, proceed to VERIFYING |
| Verify command runs | gate_status -> VERIFYING, gate_step -> 2 |
| Verify passes/fails | verify_status -> passed/failed |
| Architect starts | gate_status -> REVIEWING, gate_step -> 3 |
| Architect verdict | architect_status -> approved/rejected |
| Gate passes | gate_status -> APPROVED, task status -> complete |
| Gate fails | gate_status -> FAILED, increment attempt |
| Retry starts | gate_status -> EXECUTING, reset step statuses |

## Gate Status Values

| Status | Meaning |
|--------|---------|
| EXECUTING | Executor agent running task |
| VERIFYING | Running verification command |
| REVIEWING | Architect examining results |
| APPROVED | All gate steps passed |
| FAILED | One or more steps failed |
| BLOCKED | Cannot proceed (dependency) |
| SKIPPED | User bypassed gate |
