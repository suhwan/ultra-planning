/**
 * Plan Revision Manager
 *
 * Manages plan versioning and modification.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname, basename } from 'path';

import {
  PlanRevisionStatus,
  PlanVersion,
  VersionedPlan,
  PlanRevisionRequest,
  PlanRevisionResult,
  PlanRevisionConfig,
  DEFAULT_REVISION_CONFIG,
  RevisionReason,
} from './types.js';

// ============================================================================
// State File Management
// ============================================================================

const REVISION_STATE_DIR = '.ultraplan/state/revisions';

/**
 * Get revision state path for a plan
 */
function getRevisionStatePath(planPath: string, projectRoot: string = process.cwd()): string {
  const planName = basename(planPath, '.md');
  return join(projectRoot, REVISION_STATE_DIR, `${planName}.json`);
}

/**
 * Load versioned plan state
 */
export function loadVersionedPlan(
  planPath: string,
  projectRoot: string = process.cwd()
): VersionedPlan | null {
  const statePath = getRevisionStatePath(planPath, projectRoot);

  if (!existsSync(statePath)) {
    return null;
  }

  try {
    const data = readFileSync(statePath, 'utf-8');
    return JSON.parse(data) as VersionedPlan;
  } catch {
    return null;
  }
}

/**
 * Save versioned plan state
 */
function saveVersionedPlan(plan: VersionedPlan, projectRoot: string = process.cwd()): void {
  const statePath = getRevisionStatePath(plan.planPath, projectRoot);
  const dir = dirname(statePath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(statePath, JSON.stringify(plan, null, 2));
}

// ============================================================================
// Revision Status
// ============================================================================

/**
 * Flag a plan as needing revision
 */
export function flagPlanForRevision(
  planPath: string,
  reason: RevisionReason,
  description: string,
  options?: {
    affectedTasks?: string[];
    source?: string;
  },
  projectRoot: string = process.cwd()
): PlanRevisionStatus {
  let versionedPlan = loadVersionedPlan(planPath, projectRoot);

  if (!versionedPlan) {
    // Initialize versioned plan
    versionedPlan = {
      currentVersion: 1,
      planPath,
      versions: [{
        version: 1,
        createdAt: new Date().toISOString(),
        changeDescription: 'Initial version',
      }],
      revisionStatus: {
        revisionNeeded: false,
      },
    };
  }

  versionedPlan.revisionStatus = {
    revisionNeeded: true,
    reason,
    description,
    affectedTasks: options?.affectedTasks,
    flaggedAt: new Date().toISOString(),
    source: options?.source,
  };

  saveVersionedPlan(versionedPlan, projectRoot);

  return versionedPlan.revisionStatus;
}

/**
 * Clear revision flag
 */
export function clearRevisionFlag(
  planPath: string,
  projectRoot: string = process.cwd()
): boolean {
  const versionedPlan = loadVersionedPlan(planPath, projectRoot);

  if (!versionedPlan) {
    return false;
  }

  versionedPlan.revisionStatus = {
    revisionNeeded: false,
  };

  saveVersionedPlan(versionedPlan, projectRoot);
  return true;
}

/**
 * Check if plan needs revision
 */
export function checkRevisionNeeded(
  planPath: string,
  projectRoot: string = process.cwd()
): PlanRevisionStatus {
  const versionedPlan = loadVersionedPlan(planPath, projectRoot);

  if (!versionedPlan) {
    return { revisionNeeded: false };
  }

  return versionedPlan.revisionStatus;
}

// ============================================================================
// Plan Modification
// ============================================================================

/**
 * Create a new version of a plan
 */
export function createPlanVersion(
  planPath: string,
  changeDescription: string,
  reason: RevisionReason,
  options?: {
    tasksAdded?: string[];
    tasksRemoved?: string[];
    tasksModified?: string[];
  },
  config: PlanRevisionConfig = DEFAULT_REVISION_CONFIG,
  projectRoot: string = process.cwd()
): PlanVersion {
  let versionedPlan = loadVersionedPlan(planPath, projectRoot);
  const fullPlanPath = join(projectRoot, planPath);

  // Backup if configured
  if (config.autoBackup && existsSync(fullPlanPath)) {
    const backupDir = join(projectRoot, '.ultraplan/backups');
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }
    const backupPath = join(backupDir, `${basename(planPath)}.v${versionedPlan?.currentVersion || 1}.bak`);
    copyFileSync(fullPlanPath, backupPath);
  }

  const newVersion = (versionedPlan?.currentVersion || 0) + 1;

  const version: PlanVersion = {
    version: newVersion,
    createdAt: new Date().toISOString(),
    changeDescription,
    previousVersion: versionedPlan?.currentVersion,
    reason,
    tasksAdded: options?.tasksAdded,
    tasksRemoved: options?.tasksRemoved,
    tasksModified: options?.tasksModified,
  };

  if (!versionedPlan) {
    versionedPlan = {
      currentVersion: newVersion,
      planPath,
      versions: [version],
      revisionStatus: { revisionNeeded: false },
    };
  } else {
    versionedPlan.currentVersion = newVersion;
    versionedPlan.versions.push(version);

    // Trim history if needed
    if (versionedPlan.versions.length > config.maxVersionHistory) {
      versionedPlan.versions = versionedPlan.versions.slice(-config.maxVersionHistory);
    }

    // Clear revision flag after creating new version
    versionedPlan.revisionStatus = { revisionNeeded: false };
  }

  saveVersionedPlan(versionedPlan, projectRoot);

  return version;
}

/**
 * Get version history for a plan
 */
export function getPlanVersionHistory(
  planPath: string,
  projectRoot: string = process.cwd()
): PlanVersion[] {
  const versionedPlan = loadVersionedPlan(planPath, projectRoot);
  return versionedPlan?.versions || [];
}

/**
 * Get current version number
 */
export function getCurrentPlanVersion(
  planPath: string,
  projectRoot: string = process.cwd()
): number {
  const versionedPlan = loadVersionedPlan(planPath, projectRoot);
  return versionedPlan?.currentVersion || 1;
}

// ============================================================================
// High-Level Revision API
// ============================================================================

/**
 * Request a plan revision
 */
export function requestPlanRevision(
  request: PlanRevisionRequest,
  projectRoot: string = process.cwd()
): PlanRevisionResult {
  try {
    // Flag the plan
    flagPlanForRevision(
      request.planPath,
      request.reason,
      request.description,
      {
        affectedTasks: request.tasksToModify,
        source: request.source,
      },
      projectRoot
    );

    // Note: Actual plan content modification would be done by the Planner agent
    // This just creates the revision request and tracking

    return {
      success: true,
      changesSummary: `Plan flagged for revision: ${request.description}`,
      affectedTasks: request.tasksToModify,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Complete a plan revision (after Planner has modified the plan)
 */
export function completePlanRevision(
  planPath: string,
  changeDescription: string,
  options?: {
    tasksAdded?: string[];
    tasksRemoved?: string[];
    tasksModified?: string[];
  },
  projectRoot: string = process.cwd()
): PlanRevisionResult {
  const status = checkRevisionNeeded(planPath, projectRoot);

  if (!status.revisionNeeded) {
    return {
      success: false,
      error: 'Plan is not flagged for revision',
    };
  }

  const version = createPlanVersion(
    planPath,
    changeDescription,
    status.reason || 'manual_request',
    options,
    DEFAULT_REVISION_CONFIG,
    projectRoot
  );

  return {
    success: true,
    newVersion: version.version,
    changesSummary: changeDescription,
    affectedTasks: [
      ...(options?.tasksAdded || []),
      ...(options?.tasksModified || []),
    ],
  };
}
