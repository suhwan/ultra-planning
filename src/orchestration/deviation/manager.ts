/**
 * Deviation Manager
 *
 * Manages executor deviations from plan.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import { randomUUID } from 'crypto';

import {
  DeviationLevel,
  DeviationType,
  DeviationReport,
  DeviationStatus,
  DeviationState,
  DeviationStats,
  DeviationConfig,
  DeviationLevelRules,
  ArchitectDeviationVerdict,
  DEFAULT_DEVIATION_CONFIG,
  DEFAULT_DEVIATION_RULES,
} from './types.js';

import { flagPlanForRevision } from '../revision/manager.js';

// ============================================================================
// State File Management
// ============================================================================

const DEVIATION_STATE_DIR = '.ultraplan/state/deviations';
const DEVIATION_MD_PATH = 'DEVIATION.md';

/**
 * Get deviation state path for a plan
 */
function getDeviationStatePath(planPath: string, projectRoot: string = process.cwd()): string {
  const planName = basename(planPath, '.md');
  return join(projectRoot, DEVIATION_STATE_DIR, `${planName}.json`);
}

/**
 * Load deviation state
 */
export function loadDeviationState(
  planPath: string,
  projectRoot: string = process.cwd()
): DeviationState | null {
  const statePath = getDeviationStatePath(planPath, projectRoot);

  if (!existsSync(statePath)) {
    return null;
  }

  try {
    const data = readFileSync(statePath, 'utf-8');
    return JSON.parse(data) as DeviationState;
  } catch {
    return null;
  }
}

/**
 * Save deviation state
 */
function saveDeviationState(state: DeviationState, projectRoot: string = process.cwd()): void {
  const statePath = getDeviationStatePath(state.planPath, projectRoot);
  const dir = dirname(statePath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  state.lastUpdated = new Date().toISOString();
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

/**
 * Initialize empty deviation state
 */
function initDeviationState(planPath: string, sessionId?: string): DeviationState {
  return {
    planPath,
    sessionId,
    deviations: [],
    stats: {
      total: 0,
      byLevel: { 1: 0, 2: 0, 3: 0 },
      byStatus: {
        reported: 0,
        pending_approval: 0,
        approved: 0,
        rejected: 0,
        revision_pending: 0,
        resolved: 0,
      },
      revisionsTriggered: 0,
    },
    lastUpdated: new Date().toISOString(),
  };
}

// ============================================================================
// Level Determination
// ============================================================================

/**
 * Determine deviation level based on rules
 */
export function determineDeviationLevel(
  type: DeviationType,
  reason: string,
  affectedFiles: string[] = [],
  rules: DeviationLevelRules = DEFAULT_DEVIATION_RULES
): DeviationLevel {
  // Check if type is always Level 3
  if (rules.level3Types.includes(type)) {
    return 3;
  }

  // Check for Level 3 keywords in reason
  const reasonLower = reason.toLowerCase();
  for (const keyword of rules.level3Keywords) {
    if (reasonLower.includes(keyword.toLowerCase())) {
      return 3;
    }
  }

  // Check if type is always Level 1
  if (rules.level1Types.includes(type)) {
    return 1;
  }

  // Check file count threshold
  if (affectedFiles.length >= rules.fileCountThreshold) {
    return 3;
  }

  // Default to Level 2
  return 2;
}

// ============================================================================
// Deviation Reporting
// ============================================================================

/**
 * Report a deviation
 */
export function reportDeviation(
  planPath: string,
  taskId: string,
  type: DeviationType,
  description: string,
  planned: string,
  actual: string,
  reason: string,
  options?: {
    affectedFiles?: string[];
    impact?: string;
    sessionId?: string;
    level?: DeviationLevel; // Override auto-determined level
  },
  config: DeviationConfig = DEFAULT_DEVIATION_CONFIG,
  projectRoot: string = process.cwd()
): DeviationReport {
  // Load or init state
  let state = loadDeviationState(planPath, projectRoot);
  if (!state) {
    state = initDeviationState(planPath, options?.sessionId);
  }

  // Determine level
  const level = options?.level ?? determineDeviationLevel(
    type,
    reason,
    options?.affectedFiles,
    config.levelRules
  );

  // Determine initial status
  let status: DeviationStatus = 'reported';
  if (level === 1 && config.autoApproveLevel1) {
    status = 'resolved';
  } else if (level === 2) {
    status = 'pending_approval';
  } else if (level === 3) {
    status = 'revision_pending';
  }

  // Create report
  const report: DeviationReport = {
    id: randomUUID(),
    taskId,
    level,
    type,
    description,
    planned,
    actual,
    reason,
    affectedFiles: options?.affectedFiles,
    impact: options?.impact,
    reportedAt: new Date().toISOString(),
    status,
    revisionTriggered: level === 3,
  };

  // Add to state
  state.deviations.push(report);

  // Update stats
  state.stats.total++;
  state.stats.byLevel[level]++;
  state.stats.byStatus[status]++;
  if (level === 3) {
    state.stats.revisionsTriggered++;
  }

  // Save state
  saveDeviationState(state, projectRoot);

  // Append to DEVIATION.md
  appendToDeviationMd(report, projectRoot);

  // Trigger plan revision for Level 3
  if (level === 3 && config.pauseOnLevel3) {
    flagPlanForRevision(
      planPath,
      'deviation_level_3',
      `Level 3 deviation in task ${taskId}: ${description}`,
      { affectedTasks: [taskId], source: `deviation:${report.id}` },
      projectRoot
    );
  }

  return report;
}

/**
 * Append deviation to DEVIATION.md
 */
function appendToDeviationMd(report: DeviationReport, projectRoot: string = process.cwd()): void {
  const mdPath = join(projectRoot, DEVIATION_MD_PATH);

  const entry = `
## Deviation ${report.id.slice(0, 8)}

- **Task**: ${report.taskId}
- **Level**: ${report.level}
- **Type**: ${report.type}
- **Status**: ${report.status}
- **Time**: ${report.reportedAt}

### Description
${report.description}

### Planned vs Actual
- **Planned**: ${report.planned}
- **Actual**: ${report.actual}

### Reason
${report.reason}

${report.affectedFiles?.length ? `### Affected Files\n${report.affectedFiles.map(f => `- ${f}`).join('\n')}` : ''}

${report.impact ? `### Impact\n${report.impact}` : ''}

---
`;

  // Create header if file doesn't exist
  if (!existsSync(mdPath)) {
    const header = `# Deviation Log

This file tracks executor deviations from the plan.

**Legend:**
- Level 1: Minor deviation (logged only)
- Level 2: Moderate deviation (requires approval)
- Level 3: Major deviation (triggers plan revision)

---
`;
    writeFileSync(mdPath, header);
  }

  appendFileSync(mdPath, entry);
}

// ============================================================================
// Architect Approval (Level 2)
// ============================================================================

/**
 * Submit Architect verdict for a Level 2 deviation
 */
export function submitArchitectVerdict(
  planPath: string,
  deviationId: string,
  approved: boolean,
  reasoning: string,
  conditions?: string[],
  projectRoot: string = process.cwd()
): DeviationReport | null {
  const state = loadDeviationState(planPath, projectRoot);
  if (!state) return null;

  const deviation = state.deviations.find(d => d.id === deviationId);
  if (!deviation) return null;

  if (deviation.level !== 2) {
    throw new Error(`Deviation ${deviationId} is Level ${deviation.level}, not Level 2`);
  }

  // Update verdict
  deviation.architectVerdict = {
    approved,
    reasoning,
    conditions,
    verdictAt: new Date().toISOString(),
  };

  // Update status
  const oldStatus = deviation.status;
  deviation.status = approved ? 'approved' : 'rejected';

  // Update stats
  state.stats.byStatus[oldStatus]--;
  state.stats.byStatus[deviation.status]++;

  // Calculate approval rate
  const level2Deviations = state.deviations.filter(d => d.level === 2);
  const approvedCount = level2Deviations.filter(d => d.status === 'approved').length;
  const resolvedCount = level2Deviations.filter(d =>
    d.status === 'approved' || d.status === 'rejected'
  ).length;
  state.stats.level2ApprovalRate = resolvedCount > 0 ? approvedCount / resolvedCount : undefined;

  saveDeviationState(state, projectRoot);

  return deviation;
}

// ============================================================================
// Deviation Queries
// ============================================================================

/**
 * Get all deviations for a plan
 */
export function getDeviations(
  planPath: string,
  projectRoot: string = process.cwd()
): DeviationReport[] {
  const state = loadDeviationState(planPath, projectRoot);
  return state?.deviations || [];
}

/**
 * Get deviations by level
 */
export function getDeviationsByLevel(
  planPath: string,
  level: DeviationLevel,
  projectRoot: string = process.cwd()
): DeviationReport[] {
  const deviations = getDeviations(planPath, projectRoot);
  return deviations.filter(d => d.level === level);
}

/**
 * Get deviations by status
 */
export function getDeviationsByStatus(
  planPath: string,
  status: DeviationStatus,
  projectRoot: string = process.cwd()
): DeviationReport[] {
  const deviations = getDeviations(planPath, projectRoot);
  return deviations.filter(d => d.status === status);
}

/**
 * Get pending Level 2 deviations
 */
export function getPendingApprovals(
  planPath: string,
  projectRoot: string = process.cwd()
): DeviationReport[] {
  return getDeviationsByStatus(planPath, 'pending_approval', projectRoot);
}

/**
 * Get deviation statistics
 */
export function getDeviationStats(
  planPath: string,
  projectRoot: string = process.cwd()
): DeviationStats | null {
  const state = loadDeviationState(planPath, projectRoot);
  return state?.stats || null;
}

/**
 * Get deviation by ID
 */
export function getDeviation(
  planPath: string,
  deviationId: string,
  projectRoot: string = process.cwd()
): DeviationReport | null {
  const deviations = getDeviations(planPath, projectRoot);
  return deviations.find(d => d.id === deviationId) || null;
}

// ============================================================================
// Status Updates
// ============================================================================

/**
 * Mark a deviation as resolved
 */
export function resolveDeviation(
  planPath: string,
  deviationId: string,
  projectRoot: string = process.cwd()
): boolean {
  const state = loadDeviationState(planPath, projectRoot);
  if (!state) return false;

  const deviation = state.deviations.find(d => d.id === deviationId);
  if (!deviation) return false;

  const oldStatus = deviation.status;
  deviation.status = 'resolved';

  state.stats.byStatus[oldStatus]--;
  state.stats.byStatus.resolved++;

  saveDeviationState(state, projectRoot);
  return true;
}

/**
 * Check if plan has unresolved Level 3 deviations
 */
export function hasUnresolvedLevel3(
  planPath: string,
  projectRoot: string = process.cwd()
): boolean {
  const level3 = getDeviationsByLevel(planPath, 3, projectRoot);
  return level3.some(d => d.status !== 'resolved');
}
