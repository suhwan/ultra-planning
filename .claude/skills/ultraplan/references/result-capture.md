# Result Capture Protocol

## Overview

This document defines how executor task results are captured, validated, persisted, and used to update project state. The result capture system is the bridge between task execution and state management.

## Result YAML Schema

### Complete Schema

Executors MUST return results in this exact YAML format:

```yaml
# Required Fields
status: success | failure | blocked
task_name: "Task N: Descriptive name"
files_modified:
  - path/to/file1.ts
  - path/to/file2.ts

# Verification Block
verification:
  command: "npm test -- TestName"
  exit_code: 0
  output_summary: "Brief summary of output"

# Completion Evidence
done_criteria_met: true | false
evidence: |
  Multi-line description of what was done
  and how it satisfies acceptance criteria

# Error Information (null if no error)
error: null | "Description of what went wrong"

# Optional Metadata
metadata:
  duration_ms: 45000
  attempt: 1
  executor_id: "uuid"
```

### Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| status | enum | Yes | One of: success, failure, blocked |
| task_name | string | Yes | Must match task <name> from PLAN.md |
| files_modified | array | Yes | List of file paths touched (can be empty) |
| verification.command | string | Yes | The <verify> command that was run |
| verification.exit_code | integer | Yes | Exit code (0 = success) |
| verification.output_summary | string | Yes | Brief summary of command output |
| done_criteria_met | boolean | Yes | true only if <done> criteria verified |
| evidence | string | Yes | Explanation of how criteria was met |
| error | string/null | Yes | null if success, error details otherwise |
| metadata.duration_ms | integer | No | Execution time in milliseconds |
| metadata.attempt | integer | No | Attempt number (1 for first try) |
| metadata.executor_id | string | No | UUID of executor instance |

### Status Values

| Status | When Used | Next Action |
|--------|-----------|-------------|
| success | Task completed, verification passed | Update state, mark done |
| failure | Task attempted but verification failed | Queue retry with feedback |
| blocked | Task cannot start (missing dependency) | Analyze blocker, reorder |

## Result Validation

### Validation Rules

Before processing a result, validate:

1. **Schema Completeness**
   - All required fields present
   - No unknown fields (warn but accept)
   - Types match schema (string, integer, boolean, array)

2. **Status Consistency**
   ```
   IF status == "success":
     REQUIRE verification.exit_code == 0
     REQUIRE done_criteria_met == true
     REQUIRE error == null

   IF status == "failure":
     REQUIRE error != null
     REQUIRE done_criteria_met == false

   IF status == "blocked":
     REQUIRE error != null
     REQUIRE files_modified == []
     REQUIRE verification.command == null
   ```

3. **Task Name Matching**
   - task_name must exactly match a task in current PLAN.md
   - If no match: log warning, attempt fuzzy match

4. **File Path Validation**
   - Paths should be relative to project root
   - Warn if file in list doesn't exist after execution
   - Warn if task modified files not in its <files> list

### Validation Outcomes

| Outcome | Condition | Action |
|---------|-----------|--------|
| VALID | All rules pass | Process result |
| VALID_WITH_WARNINGS | Minor violations | Process with logged warnings |
| INVALID | Critical violations | Reject, request re-execution |

### Critical Violations

These cause INVALID outcome:
- Missing status field
- status = "success" but exit_code != 0
- status = "success" but done_criteria_met = false
- task_name doesn't match any task in PLAN.md

### Minor Violations (Warnings)

These cause VALID_WITH_WARNINGS:
- Missing optional metadata fields
- Extra unknown fields
- Files in files_modified don't exist
- Modified files not in task <files> list

## PLAN.md Status Sync

### Checkbox Update Protocol

When a task completes successfully, update PLAN.md to reflect the new status.

**Before:**
```markdown
<success_criteria>
- [ ] Task 1: Create config file
- [ ] Task 2: Add validation
- [ ] Task 3: Write tests
</success_criteria>
```

**After Task 1 Success:**
```markdown
<success_criteria>
- [x] Task 1: Create config file (completed 2026-01-26)
- [ ] Task 2: Add validation
- [ ] Task 3: Write tests
</success_criteria>
```

### Update Locations

Task status is reflected in TWO locations in PLAN.md:

1. **Success Criteria Section**
   - Checkbox list at bottom of plan
   - Format: `- [x] Task N: Name (completed YYYY-MM-DD)`

2. **Task XML Element (Optional)**
   - Add status attribute to task element
   - Format: `<task type="auto" status="completed" completed_at="ISO-8601">`

### Sync Algorithm

```
On result received:
  1. Parse PLAN.md to find matching task
  2. Locate by task_name in <success_criteria> section
  3. If status == "success":
     - Change "- [ ]" to "- [x]"
     - Append "(completed YYYY-MM-DD)"
  4. Save updated PLAN.md
  5. Verify change persisted (re-read and check)
```

### Matching Rules

| Result task_name | PLAN.md task reference | Match? |
|------------------|------------------------|--------|
| "Task 1: Create file" | "Task 1: Create file" | Yes (exact) |
| "Task 1: Create file" | "Task 1: Create configuration file" | Yes (prefix) |
| "Create file" | "Task 1: Create file" | No (missing "Task N:") |

### Failure Handling

If task cannot be found in PLAN.md:
1. Log warning with task_name searched
2. Do NOT fail the result processing
3. Add note to logs for manual review
4. Continue with STATE.md update

### Concurrency Safety

If multiple executors run (parallel mode):
1. Use file locking before PLAN.md edit
2. Re-read PLAN.md before each update
3. Retry on conflict (up to 3 times)
4. Log all conflicts for debugging

## Result Persistence

### Log Directory Structure

All results are persisted to `.ultraplan/logs/` for audit and debugging:

```
.ultraplan/
└── logs/
    ├── executions/
    │   ├── 2026-01-26/
    │   │   ├── 03-01-task-01-success.yaml
    │   │   ├── 03-01-task-02-failure.yaml
    │   │   └── 03-01-task-02-success.yaml  # retry succeeded
    │   └── 2026-01-27/
    │       └── ...
    ├── summary/
    │   ├── daily-2026-01-26.json
    │   └── daily-2026-01-27.json
    └── current-session.json
```

### Execution Log Format

Each task result is saved to:
`logs/executions/{YYYY-MM-DD}/{plan-id}-task-{N}-{status}.yaml`

**Example: `03-01-task-01-success.yaml`**
```yaml
# Result metadata
logged_at: "2026-01-26T10:30:45Z"
plan_id: "03-01"
task_index: 1
session_id: "abc123"

# Original result (preserved exactly)
result:
  status: success
  task_name: "Task 1: Create executor agent"
  files_modified:
    - .claude/agents/ultraplan-executor.md
  verification:
    command: "grep 'model: sonnet' .claude/agents/ultraplan-executor.md"
    exit_code: 0
    output_summary: "Pattern found"
  done_criteria_met: true
  evidence: "Created executor agent with Sonnet model and execution protocol"
  error: null
  metadata:
    duration_ms: 32000
    attempt: 1
```

### Session Log Format

`logs/current-session.json` tracks the active session:

```json
{
  "session_id": "abc123",
  "started_at": "2026-01-26T10:00:00Z",
  "plan_id": "03-01",
  "tasks": [
    {
      "task_name": "Task 1: Create executor agent",
      "status": "success",
      "attempts": 1,
      "completed_at": "2026-01-26T10:30:45Z",
      "duration_ms": 32000
    },
    {
      "task_name": "Task 2: Add execution protocol",
      "status": "in_progress",
      "attempts": 1,
      "started_at": "2026-01-26T10:31:00Z"
    }
  ],
  "last_updated": "2026-01-26T10:31:00Z"
}
```

### Persistence Protocol

```
On result received:
  1. Generate filename: {plan-id}-task-{N}-{status}.yaml
  2. Create date directory if not exists
  3. Write result YAML with metadata header
  4. Update current-session.json
  5. Verify file written (file exists and size > 0)
```

### Log Rotation

- Execution logs: Keep 30 days, then archive to `.ultraplan/logs/archive/`
- Session logs: Keep current + last 10 sessions
- Daily summaries: Keep indefinitely (small files)

## Metrics Tracking

### Captured Metrics

| Metric | Source | Aggregation |
|--------|--------|-------------|
| Task duration | metadata.duration_ms | Average, min, max per plan |
| Success rate | status field | Percentage per plan/phase |
| Retry count | metadata.attempt | Total retries per task |
| Verification time | Inferred from duration | Separate from execution |
| Files touched | files_modified length | Count per task |

### Metrics Storage

Daily summary stored in `logs/summary/daily-{YYYY-MM-DD}.json`:

```json
{
  "date": "2026-01-26",
  "tasks_executed": 15,
  "tasks_succeeded": 12,
  "tasks_failed": 2,
  "tasks_blocked": 1,
  "total_retries": 3,
  "success_rate": 0.80,
  "total_duration_ms": 450000,
  "average_duration_ms": 30000,
  "by_plan": {
    "03-01": {
      "tasks": 5,
      "succeeded": 5,
      "failed": 0,
      "duration_ms": 150000
    },
    "03-02": {
      "tasks": 10,
      "succeeded": 7,
      "failed": 2,
      "blocked": 1,
      "duration_ms": 300000
    }
  },
  "files_modified_count": 42
}
```

### Metrics Calculation

```
On result received:
  1. Read current daily summary (or create new)
  2. Increment appropriate counters based on status
  3. Add duration to totals if present
  4. Recalculate averages and rates
  5. Write updated summary

Success Rate = tasks_succeeded / tasks_executed
Average Duration = total_duration_ms / tasks_with_duration
```

### STATE.md Metrics Section

Metrics are surfaced in STATE.md Performance Metrics:

```markdown
## Performance Metrics

**Velocity:**
- Total plans completed: 12
- Average duration: 28 minutes
- Total execution time: 5h 36m

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 5/5 | 2h 10m | 26m |
| 2 | 7/7 | 3h 26m | 29m |
| 3 | 0/8 | - | - |

**Recent Trend:**
- Last 5 plans: 25m, 32m, 28m, 22m, 31m
- Trend: Stable
```

### Trend Analysis

```
Trend is calculated from last 5 plan durations:
- "Improving" if average of last 2 < average of first 3
- "Declining" if average of last 2 > average of first 3 by >20%
- "Stable" otherwise
```

### Metrics API (Conceptual)

Functions for metrics access (to be implemented):

```
getTaskMetrics(planId, taskIndex) -> TaskMetrics
getPlanMetrics(planId) -> PlanMetrics
getPhaseMetrics(phaseId) -> PhaseMetrics
getProjectMetrics() -> ProjectMetrics
getDailyMetrics(date) -> DailyMetrics
getTrend(windowSize) -> TrendAnalysis
```

## Complete Flow Example

### Scenario

Executor completes Task 2 of Plan 03-01 successfully.

### Step 1: Executor Returns Result

```yaml
status: success
task_name: "Task 2: Add execution protocol section"
files_modified:
  - .claude/agents/ultraplan-executor.md
verification:
  command: "grep -c 'Step 1: Parse Task XML' .claude/agents/ultraplan-executor.md"
  exit_code: 0
  output_summary: "1 match found"
done_criteria_met: true
evidence: |
  Added 4-step execution protocol:
  - Step 1: Parse Task XML
  - Step 2: Pre-Execution Checks
  - Step 3: Execute Action
  - Step 4: Run Verification
error: null
metadata:
  duration_ms: 28500
  attempt: 1
  executor_id: "exec-789"
```

### Step 2: Validate Result

```
✓ Schema complete: All required fields present
✓ Status consistent: success with exit_code=0 and done_criteria_met=true
✓ Task name match: Found "Task 2: Add execution protocol" in 03-01-PLAN.md
✓ Files exist: .claude/agents/ultraplan-executor.md exists

Result: VALID
```

### Step 3: Update PLAN.md

**Before:**
```markdown
<success_criteria>
- [x] Task 1: Create executor agent (completed 2026-01-26)
- [ ] Task 2: Add execution protocol section
- [ ] Task 3: Add result reporting section
</success_criteria>
```

**After:**
```markdown
<success_criteria>
- [x] Task 1: Create executor agent (completed 2026-01-26)
- [x] Task 2: Add execution protocol section (completed 2026-01-26)
- [ ] Task 3: Add result reporting section
</success_criteria>
```

### Step 4: Update STATE.md

**Changed fields:**
```yaml
Last activity: "2026-01-26 - Completed Task 2: Add execution protocol"
Velocity.Total plans completed: 2  # incremented
By Phase.Phase 3.Total: "57m"     # added 28.5m
Progress: [##░░░░░░░░░░░░░░░░░░] 10%  # recalculated
```

### Step 5: Persist to Logs

**File created:** `.ultraplan/logs/executions/2026-01-26/03-01-task-02-success.yaml`

```yaml
logged_at: "2026-01-26T14:32:15Z"
plan_id: "03-01"
task_index: 2
session_id: "sess-456"

result:
  status: success
  task_name: "Task 2: Add execution protocol section"
  # ... full result preserved
```

**Session log updated:** `.ultraplan/logs/current-session.json`

```json
{
  "session_id": "sess-456",
  "tasks": [
    {"task_name": "Task 1...", "status": "success", ...},
    {"task_name": "Task 2: Add execution protocol section", "status": "success", "completed_at": "2026-01-26T14:32:15Z", "duration_ms": 28500}
  ]
}
```

### Step 6: Update Metrics

**Daily summary updated:** `.ultraplan/logs/summary/daily-2026-01-26.json`

```json
{
  "date": "2026-01-26",
  "tasks_executed": 2,
  "tasks_succeeded": 2,
  "success_rate": 1.0,
  "total_duration_ms": 60500,
  "average_duration_ms": 30250
}
```

### Step 7: Signal Next Task

Orchestrator receives signal that Task 2 is complete.
If Task 3 has no blockers, it is dispatched to next executor.

---

*Result capture protocol complete.*
*Document version: 1.0.0*
*Last updated: 2026-01-26*
