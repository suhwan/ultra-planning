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
