# Architectural Decisions: 03-05 Result Capture

## Date
2026-01-26

## Context
Designing the result capture and state update system for executor task results.

---

## Decision 1: YAML Format for Results

### Decision
Use YAML format for executor result output instead of JSON.

### Rationale
- YAML supports multi-line strings naturally (evidence field)
- More readable for humans during debugging
- Comments allowed for documentation
- JSON-compatible (subset of YAML)
- Native support in many tools

### Alternatives Considered
- **JSON**: More universal, but multi-line strings awkward
- **Plain text**: Human-friendly but not machine-parseable
- **Custom format**: Flexible but requires parser development

### Implications
- Executors must output valid YAML
- Orchestrator needs YAML parser
- Log files are human-readable
- Easy to add fields without breaking parser

---

## Decision 2: Three-Tier Validation System

### Decision
Implement VALID, VALID_WITH_WARNINGS, INVALID validation outcomes.

### Rationale
- Strict validation blocks bad data (INVALID)
- Lenient on non-critical issues (VALID_WITH_WARNINGS)
- Enables evolution without breaking changes
- Logs warnings for debugging
- Balances safety and flexibility

### Alternatives Considered
- **Binary (valid/invalid)**: Too strict, blocks minor issues
- **No validation**: Too risky, allows bad state
- **Warning-only**: No way to reject truly invalid data

### Implications
- Validation logic has three code paths
- Warnings must be logged and reviewable
- Tests need cases for all three outcomes
- Documentation must explain each level

---

## Decision 3: Status Enum with Three Values

### Decision
Use `status: success | failure | blocked` enum.

### Rationale
- **success**: Task complete, verification passed
- **failure**: Task attempted but failed, can retry
- **blocked**: Task cannot start, dependency issue

Clear semantic distinction enables different orchestration behaviors:
- success → update state, next task
- failure → retry with feedback
- blocked → reorder tasks, analyze dependencies

### Alternatives Considered
- **Binary (success/failure)**: Doesn't distinguish blocked from failed attempt
- **More statuses**: Added complexity without clear value
- **Error codes**: Less clear than named statuses

### Implications
- Orchestrator has three distinct code paths
- STATE.md updates differ per status
- Retry logic only for failure, not blocked
- Logs track all three outcomes separately

---

## Decision 4: Checkbox Format with Completion Dates

### Decision
Update PLAN.md checkboxes with format: `- [x] Task N: Name (completed YYYY-MM-DD)`

### Rationale
- Visual progress indicator in PLAN.md
- Completion dates provide timeline
- Human-readable without parsing
- Git-friendly (line-based diffs)
- Standard markdown checkbox syntax

### Alternatives Considered
- **Status in frontmatter**: Not visible in rendered markdown
- **Separate status file**: Requires two files to understand progress
- **No dates**: Can't reconstruct timeline
- **ISO-8601 timestamps**: Too precise, clutters display

### Implications
- Sync algorithm must parse markdown checkboxes
- Date format must be consistent (YYYY-MM-DD)
- Concurrency handling needed for parallel execution
- PLAN.md becomes source of truth for task completion

---

## Decision 5: Dated Log Directories

### Decision
Organize logs by date: `logs/executions/{YYYY-MM-DD}/{plan-task-status}.yaml`

### Rationale
- Natural chronological organization
- Easy to find logs by date
- Bounded directory size (one day's worth)
- Simple retention policy (delete old dates)
- Multiple results for same task visible (retry pattern)

### Alternatives Considered
- **Flat directory**: Too many files, hard to browse
- **By plan ID**: Loses chronological view
- **Single log file**: Hard to parse, unbounded growth
- **Database**: Overkill for audit trail

### Implications
- Directory creation on first task of day
- Retention script deletes old directories
- Log viewer must handle dated structure
- Retries visible as multiple files

---

## Decision 6: Multi-Level Metrics Aggregation

### Decision
Track metrics at task, plan, phase, and project levels.

### Rationale
- Different views for different needs:
  - Task: debugging specific execution
  - Plan: understanding plan complexity
  - Phase: tracking phase progress
  - Project: overall health
- Aggregate data reduces query overhead
- Trend analysis at plan level

### Alternatives Considered
- **Task-level only**: Requires aggregation on every query
- **Project-level only**: Loses granular insight
- **Real-time calculation**: Too slow for dashboards
- **Single level**: Can't zoom in/out

### Implications
- Daily summaries include per-plan breakdowns
- STATE.md shows phase and project metrics
- Metrics API has methods for each level
- Storage overhead for aggregates

---

## Decision 7: 30-Day Log Retention

### Decision
Keep execution logs for 30 days, then archive.

### Rationale
- 30 days covers typical sprint cycles
- Balances storage vs. audit needs
- Daily summaries kept indefinitely (small)
- Archive available for deep investigation

### Alternatives Considered
- **Forever**: Unbounded storage growth
- **7 days**: May lose important debugging info
- **90 days**: Storage overhead without clear value
- **No retention**: Lose audit trail

### Implications
- Automated cleanup script runs daily
- Archive directory for old logs
- Compressed archives to save space
- Metrics summaries never deleted

---

## Decision 8: Evidence as Multi-Line String

### Decision
Include `evidence` field as multi-line YAML string in result.

### Rationale
- Human-readable explanation of work done
- Maps to `<done>` criteria in task
- Supports debugging and auditing
- Enables manual verification
- Complements structured fields

### Alternatives Considered
- **No evidence**: Hard to understand what happened
- **Structured evidence**: Over-engineering, not human-friendly
- **Evidence in logs only**: Requires log lookup
- **Evidence in STATE.md only**: Loses context per task

### Implications
- Executors must write clear evidence
- Evidence reviewed during failures
- Logged with full result
- Searchable for debugging

---

## Decision 9: Optional Metadata Block

### Decision
Add optional `metadata` block with duration_ms, attempt, executor_id.

### Rationale
- Duration enables performance tracking
- Attempt number tracks retry count
- Executor ID supports debugging parallel execution
- Optional: doesn't break if missing

### Alternatives Considered
- **All required**: Breaks if executor doesn't provide
- **No metadata**: Loses valuable debugging info
- **Separate metadata file**: Hard to correlate
- **More fields**: Risk of over-engineering

### Implications
- Metrics use duration_ms when present
- Retry logic uses attempt number
- Parallel debugging uses executor_id
- Validation allows missing metadata

---

## Decision 10: File Locking for Concurrency

### Decision
Use file locking before PLAN.md edits in parallel execution.

### Rationale
- Prevents concurrent write conflicts
- Re-read before update catches changes
- Retry on conflict (up to 3 times)
- Log conflicts for debugging

### Alternatives Considered
- **No locking**: Risk of corrupted PLAN.md
- **Atomic renames**: Requires temp file, complex
- **Database**: Overkill for single file
- **Optimistic locking**: Can lose updates

### Implications
- Locking mechanism needed (flock or similar)
- Retry logic with exponential backoff
- Conflict logs for monitoring
- Performance impact minimal (short critical section)

---

## Summary of Key Tradeoffs

| Decision | Tradeoff | Chosen Balance |
|----------|----------|----------------|
| YAML format | Readability vs. universality | Readability wins |
| Validation levels | Strictness vs. flexibility | Three tiers balances both |
| Status values | Simplicity vs. expressiveness | Three statuses sufficient |
| Checkbox dates | Clutter vs. information | Dates add value |
| Log organization | Flat vs. hierarchical | Date hierarchy wins |
| Metrics levels | Storage vs. query speed | Pre-aggregate for speed |
| Retention period | Storage vs. audit | 30 days balances both |
| Evidence field | Structure vs. readability | Readability wins |
| Metadata optional | Completeness vs. flexibility | Flexibility wins |
| Concurrency | Complexity vs. safety | Safety worth complexity |

---

**Decision Authority:** Plan 03-05 execution
**Review Date:** After implementation feedback
**Status:** Approved and documented
