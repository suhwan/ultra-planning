/**
 * Context Compactor
 *
 * Compresses context for fresh-start scenarios.
 * Saves and restores context snapshots via Notepad.
 *
 * Part of the Context Architect pattern - enables context preservation
 * across conversation resets.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { CollectedContext, collectContext, estimateContextTokens } from './collector.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Compacted context summary
 */
export interface CompactedContext {
  /** Unique snapshot identifier */
  snapshotId: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Current project state summary */
  projectSummary: string;
  /** Current phase state */
  phaseState: PhaseState;
  /** Active task information */
  activeTask?: ActiveTaskState;
  /** Key decisions made */
  decisions: string[];
  /** Known issues */
  issues: string[];
  /** Learnings accumulated */
  learnings: string[];
  /** Progress statistics */
  progress: ProgressState;
  /** Estimated tokens in original context */
  originalTokens: number;
  /** Estimated tokens in compacted form */
  compactedTokens: number;
}

/**
 * Phase execution state
 */
export interface PhaseState {
  phaseNumber: number;
  phaseName: string;
  totalPlans: number;
  completedPlans: number;
  currentPlan?: string;
}

/**
 * Active task state
 */
export interface ActiveTaskState {
  planId: string;
  taskId: string;
  wave: number;
  status: 'pending' | 'in_progress' | 'blocked';
  blockers?: string[];
}

/**
 * Progress statistics
 */
export interface ProgressState {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  percentComplete: number;
}

/**
 * Compaction options
 */
export interface CompactionOptions {
  /** Include detailed decisions (default: true) */
  includeDecisions?: boolean;
  /** Include issues (default: true) */
  includeIssues?: boolean;
  /** Include learnings (default: true) */
  includeLearnings?: boolean;
  /** Maximum summary length in chars (default: 2000) */
  maxSummaryLength?: number;
  /** Planning directory path */
  planningDir?: string;
}

/**
 * Snapshot storage options
 */
export interface SnapshotOptions {
  /** Directory to store snapshots (default: .omc/snapshots) */
  snapshotDir?: string;
  /** Maximum snapshots to keep (default: 10) */
  maxSnapshots?: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SNAPSHOT_DIR = '.omc/snapshots';
const DEFAULT_MAX_SNAPSHOTS = 10;
const DEFAULT_PLANNING_DIR = '.planning';

// ============================================================================
// Context Compaction
// ============================================================================

/**
 * Compact context into a minimal summary
 *
 * @param ctx - Collected context to compact
 * @param options - Compaction options
 * @returns Compacted context summary
 *
 * @example
 * ```typescript
 * const ctx = collectContext({ planId: '03-02' });
 * const compacted = compactContext(ctx);
 * console.log(compacted.projectSummary);
 * ```
 */
export function compactContext(
  ctx: CollectedContext,
  options: CompactionOptions = {}
): CompactedContext {
  const {
    includeDecisions = true,
    includeIssues = true,
    includeLearnings = true,
    maxSummaryLength = 2000,
    planningDir = DEFAULT_PLANNING_DIR,
  } = options;

  const snapshotId = generateSnapshotId();
  const timestamp = new Date().toISOString();
  const originalTokens = estimateContextTokens(ctx);

  // Extract project summary
  const projectSummary = extractProjectSummary(ctx, maxSummaryLength);

  // Build phase state
  const phaseState = buildPhaseState(ctx);

  // Build active task state
  const activeTask = ctx.task?.exists ? buildActiveTaskState(ctx) : undefined;

  // Collect wisdom (decisions, issues, learnings)
  const wisdom = collectWisdom(planningDir, ctx.task?.planId);

  const compacted: CompactedContext = {
    snapshotId,
    timestamp,
    projectSummary,
    phaseState,
    activeTask,
    decisions: includeDecisions ? wisdom.decisions : [],
    issues: includeIssues ? wisdom.issues : [],
    learnings: includeLearnings ? wisdom.learnings : [],
    progress: calculateProgress(ctx),
    originalTokens,
    compactedTokens: 0, // Calculate after creation
  };

  // Calculate compacted tokens
  compacted.compactedTokens = estimateCompactedTokens(compacted);

  return compacted;
}

// ============================================================================
// Snapshot Storage
// ============================================================================

/**
 * Save context snapshot to disk
 *
 * @param compacted - Compacted context to save
 * @param options - Snapshot options
 * @returns Path to saved snapshot
 */
export function saveContextSnapshot(
  compacted: CompactedContext,
  options: SnapshotOptions = {}
): string {
  const {
    snapshotDir = DEFAULT_SNAPSHOT_DIR,
    maxSnapshots = DEFAULT_MAX_SNAPSHOTS,
  } = options;

  // Ensure directory exists
  if (!existsSync(snapshotDir)) {
    mkdirSync(snapshotDir, { recursive: true });
  }

  // Save snapshot
  const filename = `snapshot-${compacted.snapshotId}.json`;
  const filepath = join(snapshotDir, filename);
  writeFileSync(filepath, JSON.stringify(compacted, null, 2), 'utf-8');

  // Clean up old snapshots
  cleanupOldSnapshots(snapshotDir, maxSnapshots);

  return filepath;
}

/**
 * Restore context from snapshot
 *
 * @param snapshotId - Snapshot ID or 'latest'
 * @param options - Snapshot options
 * @returns Compacted context or null if not found
 */
export function restoreContext(
  snapshotId: string = 'latest',
  options: SnapshotOptions = {}
): CompactedContext | null {
  const { snapshotDir = DEFAULT_SNAPSHOT_DIR } = options;

  if (!existsSync(snapshotDir)) {
    return null;
  }

  let filepath: string;

  if (snapshotId === 'latest') {
    filepath = findLatestSnapshot(snapshotDir);
    if (!filepath) return null;
  } else {
    filepath = join(snapshotDir, `snapshot-${snapshotId}.json`);
  }

  if (!existsSync(filepath)) {
    return null;
  }

  try {
    const content = readFileSync(filepath, 'utf-8');
    return JSON.parse(content) as CompactedContext;
  } catch {
    return null;
  }
}

/**
 * List available snapshots
 */
export function listSnapshots(
  options: SnapshotOptions = {}
): Array<{ id: string; timestamp: string; filepath: string }> {
  const { snapshotDir = DEFAULT_SNAPSHOT_DIR } = options;

  if (!existsSync(snapshotDir)) {
    return [];
  }

  const { readdirSync } = require('fs');
  const files = readdirSync(snapshotDir) as string[];

  return files
    .filter((f: string) => f.startsWith('snapshot-') && f.endsWith('.json'))
    .map((f: string) => {
      const filepath = join(snapshotDir, f);
      try {
        const content = readFileSync(filepath, 'utf-8');
        const snapshot = JSON.parse(content) as CompactedContext;
        return {
          id: snapshot.snapshotId,
          timestamp: snapshot.timestamp,
          filepath,
        };
      } catch {
        return null;
      }
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// ============================================================================
// Formatting
// ============================================================================

/**
 * Format compacted context for prompt injection
 *
 * @param compacted - Compacted context
 * @returns Formatted string for fresh-start prompt
 */
export function formatCompactedContext(compacted: CompactedContext): string {
  const lines: string[] = [
    '# Session Context (Restored)',
    '',
    `**Snapshot**: ${compacted.snapshotId}`,
    `**Timestamp**: ${compacted.timestamp}`,
    '',
    '## Project Summary',
    '',
    compacted.projectSummary,
    '',
    '## Phase State',
    '',
    `- **Phase**: ${compacted.phaseState.phaseNumber} - ${compacted.phaseState.phaseName}`,
    `- **Progress**: ${compacted.phaseState.completedPlans}/${compacted.phaseState.totalPlans} plans`,
  ];

  if (compacted.phaseState.currentPlan) {
    lines.push(`- **Current**: ${compacted.phaseState.currentPlan}`);
  }

  if (compacted.activeTask) {
    lines.push('');
    lines.push('## Active Task');
    lines.push('');
    lines.push(`- **Plan ID**: ${compacted.activeTask.planId}`);
    lines.push(`- **Task ID**: ${compacted.activeTask.taskId}`);
    lines.push(`- **Wave**: ${compacted.activeTask.wave}`);
    lines.push(`- **Status**: ${compacted.activeTask.status}`);
    if (compacted.activeTask.blockers?.length) {
      lines.push(`- **Blockers**: ${compacted.activeTask.blockers.join(', ')}`);
    }
  }

  lines.push('');
  lines.push('## Progress');
  lines.push('');
  lines.push(
    `- **Tasks**: ${compacted.progress.completedTasks}/${compacted.progress.totalTasks} (${compacted.progress.percentComplete}%)`
  );
  lines.push(`- **In Progress**: ${compacted.progress.inProgressTasks}`);

  if (compacted.decisions.length > 0) {
    lines.push('');
    lines.push('## Key Decisions');
    lines.push('');
    compacted.decisions.forEach((d) => lines.push(`- ${d}`));
  }

  if (compacted.issues.length > 0) {
    lines.push('');
    lines.push('## Known Issues');
    lines.push('');
    compacted.issues.forEach((i) => lines.push(`- ${i}`));
  }

  if (compacted.learnings.length > 0) {
    lines.push('');
    lines.push('## Learnings');
    lines.push('');
    compacted.learnings.forEach((l) => lines.push(`- ${l}`));
  }

  lines.push('');
  lines.push('---');
  lines.push(
    `*Context compressed from ~${compacted.originalTokens} to ~${compacted.compactedTokens} tokens*`
  );

  return lines.join('\n');
}

/**
 * Format compacted context as markdown for notepad
 */
export function formatForNotepad(compacted: CompactedContext): string {
  return formatCompactedContext(compacted);
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateSnapshotId(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '');
  const random = Math.random().toString(36).slice(2, 6);
  return `${dateStr}-${timeStr}-${random}`;
}

function extractProjectSummary(ctx: CollectedContext, maxLength: number): string {
  if (!ctx.project?.projectMd) {
    return 'No project context available.';
  }

  const md = ctx.project.projectMd;

  // Try to extract overview section
  const overviewMatch = md.match(/## Overview\s+([\s\S]*?)(?=\n##|$)/);
  if (overviewMatch) {
    const overview = overviewMatch[1].trim();
    if (overview.length <= maxLength) {
      return overview;
    }
    return overview.slice(0, maxLength - 3) + '...';
  }

  // Fall back to first paragraph
  const firstPara = md.split('\n\n')[0];
  if (firstPara.length <= maxLength) {
    return firstPara;
  }
  return firstPara.slice(0, maxLength - 3) + '...';
}

function buildPhaseState(ctx: CollectedContext): PhaseState {
  return {
    phaseNumber: ctx.phase?.phaseNumber ?? 0,
    phaseName: ctx.phase?.phaseName ?? 'Unknown',
    totalPlans: ctx.phase?.plans.length ?? 0,
    completedPlans: ctx.phase?.summaries.length ?? 0,
    currentPlan: ctx.task?.planId,
  };
}

function buildActiveTaskState(ctx: CollectedContext): ActiveTaskState | undefined {
  if (!ctx.task?.exists) return undefined;

  return {
    planId: ctx.task.planId,
    taskId: ctx.task.taskId,
    wave: 1, // Default, would need to parse from plan
    status: 'in_progress',
  };
}

function collectWisdom(
  planningDir: string,
  planId?: string
): { decisions: string[]; issues: string[]; learnings: string[] } {
  const result = { decisions: [] as string[], issues: [] as string[], learnings: [] as string[] };

  // Try to read from notepad if available
  const notepadDir = '.omc/notepads';
  if (!existsSync(notepadDir)) {
    return result;
  }

  // Read project-level wisdom
  try {
    const decisionsPath = join(notepadDir, '_project', 'decisions.md');
    if (existsSync(decisionsPath)) {
      const content = readFileSync(decisionsPath, 'utf-8');
      result.decisions = extractListItems(content).slice(0, 5);
    }

    const issuesPath = join(notepadDir, '_project', 'issues.md');
    if (existsSync(issuesPath)) {
      const content = readFileSync(issuesPath, 'utf-8');
      result.issues = extractListItems(content).slice(0, 5);
    }

    const learningsPath = join(notepadDir, '_project', 'learnings.md');
    if (existsSync(learningsPath)) {
      const content = readFileSync(learningsPath, 'utf-8');
      result.learnings = extractListItems(content).slice(0, 5);
    }
  } catch {
    // Ignore read errors
  }

  return result;
}

function extractListItems(markdown: string): string[] {
  const lines = markdown.split('\n');
  return lines
    .filter((l) => l.trim().startsWith('- '))
    .map((l) => l.trim().slice(2).trim())
    .filter((l) => l.length > 0);
}

function calculateProgress(ctx: CollectedContext): ProgressState {
  // Estimate from phase context
  const totalPlans = ctx.phase?.plans.length ?? 0;
  const completedPlans = ctx.phase?.summaries.length ?? 0;

  // Rough estimate: each plan has ~5 tasks
  const totalTasks = totalPlans * 5;
  const completedTasks = completedPlans * 5;

  return {
    totalTasks,
    completedTasks,
    inProgressTasks: totalPlans > completedPlans ? 1 : 0,
    percentComplete: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
  };
}

function estimateCompactedTokens(compacted: CompactedContext): number {
  const formatted = formatCompactedContext(compacted);
  return Math.ceil(formatted.length / 4);
}

function findLatestSnapshot(snapshotDir: string): string {
  const snapshots = listSnapshots({ snapshotDir });
  if (snapshots.length === 0) return '';
  return snapshots[0].filepath;
}

function cleanupOldSnapshots(snapshotDir: string, maxSnapshots: number): void {
  const snapshots = listSnapshots({ snapshotDir });

  if (snapshots.length <= maxSnapshots) return;

  // Remove oldest snapshots
  const { unlinkSync } = require('fs');
  const toRemove = snapshots.slice(maxSnapshots);

  for (const snapshot of toRemove) {
    try {
      unlinkSync(snapshot.filepath);
    } catch {
      // Ignore deletion errors
    }
  }
}
