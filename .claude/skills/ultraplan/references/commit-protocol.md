# Atomic Commit Protocol

## Overview

Each completed task triggers an atomic git commit AFTER passing the verification gate. This creates:
- Clean audit trail for every change
- Task-level rollback capability
- Git bisect support for debugging
- Clear history for session resumption

**Requirement:** EXEC-05 (Atomic commit - each task completion triggers immediate commit)

## Commit Trigger Conditions

A commit is triggered when ALL of the following are true:

| Condition | Check |
|-----------|-------|
| Task executed | Executor reported completion |
| Verification passed | `<verify>` command returned exit code 0 |
| Architect approved | Verification gate passed |
| Files modified | At least one file in `<files>` was changed |

**CRITICAL:** Never commit before Architect approval. The verification gate is the commit trigger.

### Trigger Flow

```
Executor completes task
        │
        ▼
Runs <verify> command
        │
        ▼
  Exit code 0? ──NO──► Retry loop (no commit)
        │
       YES
        ▼
Architect verifies
        │
        ▼
  Approved? ──NO──► Retry with feedback (no commit)
        │
       YES
        ▼
  ┌─────────────────┐
  │ TRIGGER COMMIT  │
  └─────────────────┘
        │
        ▼
Update STATE.md with commit hash
```

### No-Commit Scenarios

Do NOT commit when:
- Task failed verification
- Architect rejected the work
- No files were actually modified
- Task was blocked (never executed)
- User explicitly disabled auto-commit in config

## Commit Message Format

### Convention

Commit messages follow Conventional Commits format with Ultra Planner extensions:

```
<type>(<phase>-<plan>): <task-description>

<body>

Plan: <phase>/<plan-number>
Task: <task-number>
Files: <file-count> modified
```

### Components

| Component | Description | Example |
|-----------|-------------|---------|
| type | Change type | feat, fix, refactor, docs, test |
| phase | Phase identifier | 03 |
| plan | Plan number | 08 |
| task-description | Brief summary | implement commit protocol |
| body | Optional details | What was done and why |
| Plan | Full plan reference | 03-sequential-execution/03-08 |
| Task | Task number from PLAN.md | 2 |
| Files | Count of modified files | 3 modified |

### Type Selection

| Type | When to Use |
|------|-------------|
| `feat` | New functionality added |
| `fix` | Bug or error corrected |
| `refactor` | Code restructured without behavior change |
| `docs` | Documentation only changes |
| `test` | Test additions or modifications |
| `chore` | Maintenance tasks (deps, config) |

### Examples

**Feature task:**
```
feat(03-08): implement atomic commit protocol

Create commit-protocol.md with trigger conditions,
message format, and rollback procedures.

Plan: 03-sequential-execution/03-08
Task: 1
Files: 1 modified
```

**Bug fix task:**
```
fix(02-03): correct wave dependency calculation

Wave assignment was incorrectly counting self-references.
Fixed dependency graph traversal to skip self.

Plan: 02-core-planning/02-03
Task: 4
Files: 2 modified
```

**Refactoring task:**
```
refactor(03-01): simplify executor result parsing

Consolidated three parsing functions into single parser.
No behavior change, improved maintainability.

Plan: 03-sequential-execution/03-01
Task: 3
Files: 1 modified
```

### Message Generation

The commit message is generated from task context:

```
type = infer_from_action(task.action)
phase = current_phase.number
plan = current_plan.number
description = task.name.replace("Task N: ", "").lower()
files_count = len(task.files_modified)

message = f"{type}({phase}-{plan:02d}): {description}\n\n{body}\n\nPlan: {phase_name}/{plan_file}\nTask: {task.number}\nFiles: {files_count} modified"
```

## Git Commands

### Commit Sequence

After verification gate passes, execute this sequence:

```bash
# Step 1: Stage only the files from task <files>
git add path/to/file1.ts path/to/file2.ts

# Step 2: Verify staging is correct
git status --porcelain

# Step 3: Create commit with formatted message
git commit -m "$(cat <<'EOF'
feat(03-08): implement atomic commit protocol

Create commit-protocol.md with trigger conditions,
message format, and rollback procedures.

Plan: 03-sequential-execution/03-08
Task: 1
Files: 1 modified
EOF
)"

# Step 4: Capture commit hash for STATE.md
COMMIT_HASH=$(git rev-parse --short HEAD)
echo "Committed: $COMMIT_HASH"
```

### Staging Rules

| Rule | Rationale |
|------|-----------|
| Stage only task files | Prevent unrelated changes from sneaking in |
| No `git add -A` | Explicit file list prevents accidents |
| No `git add .` | Same as above |
| Verify before commit | Catch staging errors before they're permanent |

### Pre-Commit Checks

Before creating the commit:

```bash
# Check for staged files
STAGED=$(git diff --cached --name-only)
if [ -z "$STAGED" ]; then
    echo "ERROR: No files staged for commit"
    exit 1
fi

# Check for unstaged changes in task files
for file in $TASK_FILES; do
    if git diff --name-only | grep -q "$file"; then
        echo "WARNING: $file has unstaged changes"
    fi
done

# Check for untracked task files
for file in $TASK_FILES; do
    if ! git ls-files --error-unmatch "$file" 2>/dev/null; then
        if [ -f "$file" ]; then
            echo "INFO: $file is new, will be added"
        fi
    fi
done
```

### Config-Based Behavior

Check `.ultraplan/config.json` for commit settings:

```json
{
  "workflow": {
    "auto_commit": true,
    "commit_docs": true
  }
}
```

| Setting | true | false |
|---------|------|-------|
| auto_commit | Commit after each task | Only commit on user request |
| commit_docs | Include .md files in commits | Skip documentation changes |

If `auto_commit: false`, log the pending commit but don't execute:

```yaml
pending_commit:
  task: "Task 3: Implement validation"
  files:
    - src/validation.ts
  message: "feat(03-08): implement validation"
  status: pending_user_commit
```

## Rollback Protocol

### When to Rollback

Rollback may be needed when:
- Later task discovers previous task broke something
- User requests undo of specific task
- Integration test fails after multiple tasks
- Architect rejects work in subsequent review

### Rollback Strategies

#### Strategy 1: Revert Single Task

For reverting the most recent task:

```bash
# Revert the last commit (creates new commit)
git revert HEAD --no-edit

# Or, if you need to revert with custom message
git revert HEAD -m "revert(03-08): undo task 3 - validation broke auth"
```

#### Strategy 2: Revert Specific Task

For reverting a task from earlier in the sequence:

```bash
# Find the commit hash from STATE.md
TASK_COMMIT="abc1234"

# Revert that specific commit
git revert $TASK_COMMIT --no-edit

# Note: This may cause conflicts if later commits depend on it
```

#### Strategy 3: Reset to Checkpoint

For reverting multiple tasks (use with caution):

```bash
# Find the last known-good commit
CHECKPOINT="def5678"

# Soft reset (keeps changes as uncommitted)
git reset --soft $CHECKPOINT

# Hard reset (discards all changes) - DANGEROUS
git reset --hard $CHECKPOINT
```

### Rollback Decision Matrix

| Scenario | Strategy | Impact |
|----------|----------|--------|
| Last task broke tests | Revert HEAD | Low - clean undo |
| Task 3 of 5 has bug | Revert specific | Medium - may conflict |
| Multiple tasks broken | Reset to checkpoint | High - lose all work since |
| Need to redo approach | Reset soft + retry | Medium - keeps code visible |

### Conflict Resolution

When reverting causes conflicts:

1. **Identify conflict files:**
   ```bash
   git status | grep "both modified"
   ```

2. **Analyze the conflict:**
   - Original change (task being reverted)
   - Dependent change (later task)

3. **Resolution options:**
   | Option | When |
   |--------|------|
   | Accept revert | Later task doesn't need the change |
   | Accept current | Keep later task's version |
   | Manual merge | Combine both changes appropriately |

4. **After resolution:**
   ```bash
   git add <resolved-files>
   git revert --continue
   ```

### State Recovery

After rollback, update STATE.md:

```markdown
## Task Log

| Task | Status | Commit | Rolled Back |
|------|--------|--------|-------------|
| Task 1 | Complete | abc1234 | - |
| Task 2 | Complete | def5678 | - |
| Task 3 | Reverted | ghi9012 | jkl3456 |
```

Include:
- Original commit hash
- Revert commit hash
- Reason for rollback
- Any manual interventions needed

## STATE.md Integration

### Task Log Format

STATE.md maintains a commit log for all completed tasks:

```markdown
## Execution Log

### Phase 3: Sequential Execution

| Plan | Task | Status | Commit | Timestamp |
|------|------|--------|--------|-----------|
| 03-01 | Task 1 | Complete | `a1b2c3d` | 2026-01-26 14:30 |
| 03-01 | Task 2 | Complete | `e4f5g6h` | 2026-01-26 14:45 |
| 03-01 | Task 3 | Failed | - | 2026-01-26 15:00 |
| 03-01 | Task 3 | Complete | `i7j8k9l` | 2026-01-26 15:15 |
```

### Log Entry Fields

| Field | Source | Purpose |
|-------|--------|---------|
| Plan | Current plan identifier | Traceability |
| Task | Task name from XML | Identification |
| Status | Executor result | Progress tracking |
| Commit | `git rev-parse --short HEAD` | Audit trail |
| Timestamp | Current time | Timeline |

### Update Protocol

After successful commit:

1. **Read current STATE.md**
2. **Find Execution Log section** (create if missing)
3. **Append new row:**
   ```markdown
   | 03-08 | Task 1 | Complete | `abc1234` | 2026-01-26 16:00 |
   ```
4. **Update progress metrics:**
   - Increment completed tasks count
   - Recalculate progress percentage
   - Update progress bar

### Failed Task Logging

For failed tasks (no commit):

```markdown
| 03-08 | Task 2 | Failed | - | 2026-01-26 16:15 |
```

Followed by retry:

```markdown
| 03-08 | Task 2 | Complete | `def5678` | 2026-01-26 16:30 |
```

### Rollback Logging

When a task is rolled back:

```markdown
| 03-08 | Task 2 | Reverted | `ghi9012` | 2026-01-26 17:00 |
```

Note: Revert commit hash goes in Commit column for traceability.

### Session Continuity

STATE.md commit log enables session recovery:

1. **On session start:** Read last commit hash from log
2. **Verify git state:** `git log --oneline -1` matches expected
3. **If mismatch:** Warn user, offer sync options
4. **Resume:** Continue from last logged complete task

### Example Full Log

```markdown
## Execution Log

### Phase 3: Sequential Execution

**Plan 03-01: Executor Agent Definition**

| Task | Description | Status | Commit | Time |
|------|-------------|--------|--------|------|
| 1 | Create frontmatter | Complete | `a1b2c3d` | 14:30 |
| 2 | Add execution protocol | Complete | `e4f5g6h` | 14:45 |
| 3 | Add result reporting | Complete | `i7j8k9l` | 15:00 |
| 4 | Add constraints | Complete | `m0n1o2p` | 15:15 |
| 5 | Add example | Complete | `q3r4s5t` | 15:30 |

**Plan 03-08: Atomic Commit Protocol**

| Task | Description | Status | Commit | Time |
|------|-------------|--------|--------|------|
| 1 | Create reference doc | Complete | `u6v7w8x` | 16:00 |
| 2 | Define message format | In Progress | - | - |

**Summary:**
- Tasks completed: 6
- Tasks in progress: 1
- Tasks failed: 0
- Last commit: `u6v7w8x`
```
