/**
 * Plan Change Handling Template
 *
 * Templates for handling plan changes during execution.
 * Ensures workers and orchestrators stay in sync with evolving plans.
 */

/**
 * Plan change detection protocol for workers
 */
export const WORKER_PLAN_CHANGE_PROTOCOL = `
## Plan Change Detection (Worker)

**IMPORTANT**: Plans can change during execution. Always verify before executing.

### Before Executing a Task

\`\`\`
1. Read the current PLAN.md file
2. Find your claimed task in the plan
3. If task NOT FOUND:
   - Mark as completed: TaskUpdate(taskId, status: "completed", metadata: { skipped: true, reason: "removed from plan" })
   - Log: "Task [id] no longer in plan, skipping"
   - Move to next task
4. If task MODIFIED:
   - Use the NEW description from PLAN.md
   - Log the change for record
5. If task unchanged:
   - Proceed with execution
\`\`\`

### During Long Tasks

For tasks taking > 5 minutes:
- Re-check PLAN.md periodically
- If task was removed mid-execution:
  - Complete current atomic change
  - Report partial progress
  - Mark as completed with partial: true

### Reporting Changes

When you detect a plan change:
\`\`\`
mcp__ultra-planner__add_issue(planId, {
  taskId: "affected-task",
  content: "Plan changed: task removed/modified",
  severity: "low",
  status: "resolved"
});
\`\`\`
`;

/**
 * Plan change detection protocol for orchestrators
 */
export const ORCHESTRATOR_PLAN_CHANGE_PROTOCOL = `
## Plan Change Detection (Orchestrator)

**IMPORTANT**: Monitor for plan changes and keep workers in sync.

### Monitoring Cycle

Every monitoring interval (30 seconds):

\`\`\`
1. PARSE: Read and parse current PLAN.md
2. COMPARE: Compare with active TaskList
3. SYNC: Handle differences

For NEW tasks in plan but not in TaskList:
  - TaskCreate({ subject, description })

For REMOVED tasks (in TaskList but not in plan):
  - If status == "pending":
      TaskUpdate(taskId, status: "completed", metadata: { skipped: true })
  - If status == "in_progress":
      Log warning, let worker complete or timeout

For MODIFIED tasks:
  - If status == "pending":
      TaskUpdate(taskId, description: newDescription)
  - If status == "in_progress":
      Cannot modify mid-execution, will apply on retry
\`\`\`

### Notifying Workers

Workers self-check plans, but orchestrator can also:
1. Track plan version/hash
2. Broadcast plan change event (via metadata)
3. Workers check for broadcast on next heartbeat

### Version Tracking

If available in PLAN.md frontmatter:
\`\`\`yaml
---
version: 3
updated_at: 2024-01-31T12:00:00Z
---
\`\`\`

Use version to quickly detect changes without full diff.
`;

/**
 * Generate plan change handling snippet
 */
export function generatePlanChangeCheck(taskId: string): string {
  return `
## Plan Change Check for ${taskId}

Before executing:
1. Read PLAN.md
2. Find task ${taskId}
3. If not found → skip
4. If found → use latest description
`;
}
