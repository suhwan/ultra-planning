/**
 * Fresh-Start Context Injection
 *
 * Provides utilities for preparing and injecting compacted context
 * into fresh conversation starts. Enables seamless continuation of
 * work across context resets.
 *
 * Part of Wave 2 - Plan 10-02: Fresh-Start Context Injection
 */

import { CompactedContext, restoreContext, formatCompactedContext } from './compactor.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Fresh start context with formatted prompt and instructions
 */
export interface FreshStartContext {
  /** Formatted context for prompt injection */
  prompt: string;
  /** Raw compacted context */
  compacted: CompactedContext;
  /** Resume instructions */
  instructions: string;
}

/**
 * Options for fresh-start preparation
 */
export interface FreshStartOptions {
  /** Directory containing snapshots (default: .omc/snapshots) */
  snapshotDir?: string;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Prepare context for fresh-start continuation
 *
 * Loads a context snapshot, formats it for prompt injection, and
 * generates resume instructions for the agent.
 *
 * @param snapshotId - Snapshot ID to load ('latest' for most recent)
 * @param options - Configuration options
 * @returns FreshStartContext or null if snapshot not found
 *
 * @example
 * ```typescript
 * // Use latest snapshot
 * const freshStart = prepareFreshStart();
 * if (freshStart) {
 *   console.log(freshStart.prompt);
 *   console.log(freshStart.instructions);
 * }
 *
 * // Use specific snapshot
 * const freshStart = prepareFreshStart('20250201-142536-abc1');
 * ```
 */
export function prepareFreshStart(
  snapshotId: string = 'latest',
  options?: FreshStartOptions
): FreshStartContext | null {
  const compacted = restoreContext(snapshotId, options);
  if (!compacted) return null;

  const prompt = formatCompactedContext(compacted);
  const instructions = generateResumeInstructions(compacted);

  return { prompt, compacted, instructions };
}

/**
 * Inject compacted context for orchestrator use
 *
 * Convenience function that prepares fresh-start context and returns
 * a single string suitable for injection into an agent's system prompt.
 *
 * @param snapshotId - Snapshot ID to load ('latest' for most recent)
 * @param options - Configuration options
 * @returns Formatted context string for injection
 *
 * @example
 * ```typescript
 * // Inject into orchestrator prompt
 * const contextBlock = injectCompactedContext();
 * const fullPrompt = `${systemPrompt}\n\n${contextBlock}`;
 * ```
 */
export function injectCompactedContext(
  snapshotId: string = 'latest',
  options?: FreshStartOptions
): string {
  const freshStart = prepareFreshStart(snapshotId, options);
  if (!freshStart) {
    return '# No context snapshot available\n\nStarting fresh session.';
  }

  return [
    freshStart.prompt,
    '',
    freshStart.instructions,
  ].join('\n');
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate resume instructions from compacted context
 *
 * Creates actionable instructions for the agent based on the
 * current state captured in the snapshot.
 *
 * @param compacted - Compacted context to analyze
 * @returns Formatted resume instructions
 */
function generateResumeInstructions(compacted: CompactedContext): string {
  const lines: string[] = [
    '# Resume Instructions',
    '',
  ];

  // Current phase and task info
  lines.push('## Current State');
  lines.push('');
  lines.push(`You are continuing **Phase ${compacted.phaseState.phaseNumber}: ${compacted.phaseState.phaseName}**.`);

  if (compacted.phaseState.currentPlan) {
    lines.push(`Current plan: \`${compacted.phaseState.currentPlan}\``);
  }

  if (compacted.activeTask) {
    lines.push('');
    lines.push(`**Active Task**: \`${compacted.activeTask.taskId}\` in plan \`${compacted.activeTask.planId}\``);
    lines.push(`- Wave: ${compacted.activeTask.wave}`);
    lines.push(`- Status: ${compacted.activeTask.status}`);

    if (compacted.activeTask.blockers && compacted.activeTask.blockers.length > 0) {
      lines.push('');
      lines.push('**Blockers to Address:**');
      compacted.activeTask.blockers.forEach(blocker => {
        lines.push(`- ${blocker}`);
      });
    }
  }

  // Progress summary
  lines.push('');
  lines.push('## Progress');
  lines.push('');
  lines.push(`- Overall: ${compacted.progress.percentComplete}% complete`);
  lines.push(`- Completed: ${compacted.progress.completedTasks} of ${compacted.progress.totalTasks} tasks`);
  if (compacted.progress.inProgressTasks > 0) {
    lines.push(`- In Progress: ${compacted.progress.inProgressTasks} tasks`);
  }

  // Unresolved issues
  if (compacted.issues.length > 0) {
    lines.push('');
    lines.push('## Unresolved Issues');
    lines.push('');
    lines.push('These issues were noted before context reset:');
    compacted.issues.forEach(issue => {
      lines.push(`- ${issue}`);
    });
  }

  // Next action guidance
  lines.push('');
  lines.push('## Next Actions');
  lines.push('');

  if (compacted.activeTask) {
    if (compacted.activeTask.status === 'blocked') {
      lines.push('1. **Address blockers** listed above');
      lines.push('2. Resume work on the active task');
      lines.push('3. Verify completion with tests');
    } else if (compacted.activeTask.status === 'in_progress') {
      lines.push('1. **Continue the active task** - review what was started');
      lines.push('2. Complete remaining implementation');
      lines.push('3. Verify with tests before moving on');
    } else {
      lines.push('1. **Pick up the pending task** from the plan');
      lines.push('2. Review the task requirements');
      lines.push('3. Implement and verify');
    }
  } else if (compacted.phaseState.completedPlans < compacted.phaseState.totalPlans) {
    lines.push('1. **Review the next plan** in the current phase');
    lines.push('2. Begin execution of the first wave');
    lines.push('3. Verify each task before proceeding');
  } else {
    lines.push('1. **Phase appears complete** - verify all acceptance criteria');
    lines.push('2. Run final verification tests');
    lines.push('3. Prepare for next phase if applicable');
  }

  // Reminder about decisions and learnings
  if (compacted.decisions.length > 0 || compacted.learnings.length > 0) {
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('*Review Key Decisions and Learnings above for important context.*');
  }

  return lines.join('\n');
}
