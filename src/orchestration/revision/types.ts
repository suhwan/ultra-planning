/**
 * Plan Revision Types
 *
 * Types for living document version management and plan modification.
 */

// ============================================================================
// Revision Status
// ============================================================================

/** Reasons a plan revision is needed */
export type RevisionReason =
  | 'deviation_level_3'      // Executor major deviation
  | 'spike_discovery'        // Spike task found new info
  | 'blocker_found'          // Blocking issue discovered
  | 'scope_change'           // Requirements changed
  | 'dependency_discovered'  // New dependency found
  | 'manual_request';        // User requested revision

/** Plan revision status */
export interface PlanRevisionStatus {
  /** Whether revision is needed */
  revisionNeeded: boolean;
  /** Reason for revision (if needed) */
  reason?: RevisionReason;
  /** Description of what needs to change */
  description?: string;
  /** Tasks affected by the revision */
  affectedTasks?: string[];
  /** When revision was flagged */
  flaggedAt?: string;
  /** Source of the revision request */
  source?: string;
}

// ============================================================================
// Plan Version
// ============================================================================

/** Plan version metadata */
export interface PlanVersion {
  /** Version number (1, 2, 3...) */
  version: number;
  /** When this version was created */
  createdAt: string;
  /** What changed in this version */
  changeDescription: string;
  /** Previous version number (for history) */
  previousVersion?: number;
  /** Revision reason */
  reason?: RevisionReason;
  /** Tasks added in this version */
  tasksAdded?: string[];
  /** Tasks removed in this version */
  tasksRemoved?: string[];
  /** Tasks modified in this version */
  tasksModified?: string[];
}

/** Plan with version history */
export interface VersionedPlan {
  /** Current version number */
  currentVersion: number;
  /** Path to the plan file */
  planPath: string;
  /** Version history */
  versions: PlanVersion[];
  /** Revision status */
  revisionStatus: PlanRevisionStatus;
}

// ============================================================================
// Revision Request
// ============================================================================

/** Request to revise a plan */
export interface PlanRevisionRequest {
  /** Path to the plan */
  planPath: string;
  /** Reason for revision */
  reason: RevisionReason;
  /** Description of needed changes */
  description: string;
  /** Specific tasks to modify */
  tasksToModify?: string[];
  /** New tasks to add */
  tasksToAdd?: Array<{
    name: string;
    action: string;
    afterTask?: string; // Insert after this task
  }>;
  /** Tasks to remove */
  tasksToRemove?: string[];
  /** Source of request (task ID, agent, etc.) */
  source: string;
}

/** Result of a plan revision */
export interface PlanRevisionResult {
  /** Whether revision succeeded */
  success: boolean;
  /** New version number */
  newVersion?: number;
  /** Summary of changes */
  changesSummary?: string;
  /** Tasks affected */
  affectedTasks?: string[];
  /** Error message (if failed) */
  error?: string;
}

// ============================================================================
// Configuration
// ============================================================================

/** Plan revision configuration */
export interface PlanRevisionConfig {
  /** Whether to auto-backup before revision */
  autoBackup: boolean;
  /** Maximum versions to keep in history */
  maxVersionHistory: number;
  /** Whether to require approval for revision */
  requireApproval: boolean;
}

/** Default revision configuration */
export const DEFAULT_REVISION_CONFIG: PlanRevisionConfig = {
  autoBackup: true,
  maxVersionHistory: 10,
  requireApproval: false, // Can be enabled for Detailed mode
};
