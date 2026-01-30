/**
 * Executor Deviation Types
 *
 * Types for handling executor deviations from plan.
 */

// ============================================================================
// Deviation Levels
// ============================================================================

/**
 * Deviation severity levels
 * - Level 1: Minor deviation, log only (DEVIATION.md)
 * - Level 2: Moderate deviation, requires Architect quick approval
 * - Level 3: Major deviation, triggers plan modification
 */
export type DeviationLevel = 1 | 2 | 3;

/** Deviation type categories */
export type DeviationType =
  | 'file_addition'        // Added files not in plan
  | 'file_modification'    // Modified unexpected files
  | 'approach_change'      // Different implementation approach
  | 'dependency_addition'  // Added new dependencies
  | 'scope_expansion'      // Task scope grew
  | 'scope_reduction'      // Task scope reduced
  | 'blocker_workaround'   // Worked around a blocker
  | 'performance_tradeoff' // Made performance vs other tradeoff
  | 'other';               // Other deviation

// ============================================================================
// Deviation Report
// ============================================================================

/** A single deviation report */
export interface DeviationReport {
  /** Unique ID for the deviation */
  id: string;
  /** Task ID that deviated */
  taskId: string;
  /** Deviation level (1-3) */
  level: DeviationLevel;
  /** Type of deviation */
  type: DeviationType;
  /** Description of what was different */
  description: string;
  /** Original plan expectation */
  planned: string;
  /** What actually happened */
  actual: string;
  /** Why the deviation was necessary */
  reason: string;
  /** Files affected by deviation */
  affectedFiles?: string[];
  /** Impact assessment */
  impact?: string;
  /** When the deviation was reported */
  reportedAt: string;
  /** Current status */
  status: DeviationStatus;
  /** Architect verdict (for Level 2) */
  architectVerdict?: ArchitectDeviationVerdict;
  /** Plan revision triggered (for Level 3) */
  revisionTriggered?: boolean;
}

/** Deviation status */
export type DeviationStatus =
  | 'reported'           // Just reported
  | 'pending_approval'   // Waiting for Architect (Level 2)
  | 'approved'           // Approved by Architect
  | 'rejected'           // Rejected by Architect
  | 'revision_pending'   // Plan revision in progress (Level 3)
  | 'resolved';          // Fully resolved

/** Architect's verdict on a Level 2 deviation */
export interface ArchitectDeviationVerdict {
  /** Whether approved */
  approved: boolean;
  /** Reasoning */
  reasoning: string;
  /** Any conditions */
  conditions?: string[];
  /** When verdict was given */
  verdictAt: string;
}

// ============================================================================
// Deviation Rules
// ============================================================================

/** Rules for determining deviation level */
export interface DeviationLevelRules {
  /** Types that are always Level 1 */
  level1Types: DeviationType[];
  /** Types that are always Level 3 */
  level3Types: DeviationType[];
  /** File count threshold for escalation */
  fileCountThreshold: number;
  /** Keywords in reason that suggest Level 3 */
  level3Keywords: string[];
}

/** Default deviation level rules */
export const DEFAULT_DEVIATION_RULES: DeviationLevelRules = {
  level1Types: ['file_modification', 'performance_tradeoff'],
  level3Types: ['scope_expansion', 'blocker_workaround'],
  fileCountThreshold: 5,
  level3Keywords: ['blocker', 'impossible', 'fundamental', 'architecture', 'redesign'],
};

// ============================================================================
// Deviation State
// ============================================================================

/** Deviation state for a plan/session */
export interface DeviationState {
  /** Plan path */
  planPath: string;
  /** Session ID (if applicable) */
  sessionId?: string;
  /** All deviations */
  deviations: DeviationReport[];
  /** Summary stats */
  stats: DeviationStats;
  /** Last updated */
  lastUpdated: string;
}

/** Deviation statistics */
export interface DeviationStats {
  /** Total deviations */
  total: number;
  /** By level */
  byLevel: Record<DeviationLevel, number>;
  /** By status */
  byStatus: Record<DeviationStatus, number>;
  /** Approval rate for Level 2 */
  level2ApprovalRate?: number;
  /** Revisions triggered */
  revisionsTriggered: number;
}

// ============================================================================
// Configuration
// ============================================================================

/** Deviation handling configuration */
export interface DeviationConfig {
  /** Whether to auto-approve Level 1 deviations */
  autoApproveLevel1: boolean;
  /** Timeout for Level 2 approval (ms) */
  level2ApprovalTimeout: number;
  /** Whether to pause on Level 3 */
  pauseOnLevel3: boolean;
  /** Custom level rules */
  levelRules: DeviationLevelRules;
}

/** Default deviation configuration */
export const DEFAULT_DEVIATION_CONFIG: DeviationConfig = {
  autoApproveLevel1: true,
  level2ApprovalTimeout: 300000, // 5 minutes
  pauseOnLevel3: true,
  levelRules: DEFAULT_DEVIATION_RULES,
};
