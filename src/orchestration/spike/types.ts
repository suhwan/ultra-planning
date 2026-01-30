/**
 * Spike Phase Types
 *
 * Types for handling tasks with high uncertainty through proof-of-concept exploration.
 */

// ============================================================================
// Uncertainty Levels
// ============================================================================

/**
 * Uncertainty level (0-10)
 * - 0-3: Low uncertainty, proceed normally
 * - 4-6: Medium uncertainty, consider spike if complex
 * - 7-10: High uncertainty, spike required before main task
 */
export type UncertaintyLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** Threshold above which spike is automatically triggered */
export const SPIKE_THRESHOLD: UncertaintyLevel = 7;

/** Uncertainty categories */
export type UncertaintyCategory =
  | 'technical'       // Unknown technical approach
  | 'integration'     // Unknown how components integrate
  | 'performance'     // Unknown if performance targets achievable
  | 'feasibility'     // Unknown if feature is possible
  | 'dependency'      // Unknown external dependency behavior
  | 'api'             // Unknown API design/contract
  | 'data'            // Unknown data structure/format
  | 'scope';          // Unknown full scope of work

// ============================================================================
// Spike Task
// ============================================================================

/** Spike task definition */
export interface SpikeTask {
  /** Unique spike ID */
  id: string;
  /** Original task ID this spike is for */
  originalTaskId: string;
  /** Plan path */
  planPath: string;
  /** Spike objective - what question to answer */
  objective: string;
  /** Time-box in minutes */
  timeBoxMinutes: number;
  /** Uncertainty category */
  category: UncertaintyCategory;
  /** Uncertainty level (0-10) */
  uncertaintyLevel: UncertaintyLevel;
  /** Questions to answer */
  questions: string[];
  /** Constraints for the spike */
  constraints?: string[];
  /** Created timestamp */
  createdAt: string;
  /** Status */
  status: SpikeStatus;
  /** Result (if completed) */
  result?: SpikeResult;
}

/** Spike status */
export type SpikeStatus =
  | 'pending'      // Not started
  | 'in_progress'  // Being executed
  | 'completed'    // Finished with findings
  | 'failed'       // Could not complete
  | 'skipped';     // Manually skipped

/** Spike result */
export interface SpikeResult {
  /** Whether spike was successful */
  success: boolean;
  /** Key findings */
  findings: string[];
  /** Recommended approach based on spike */
  recommendedApproach?: string;
  /** Whether original task should proceed */
  proceedWithTask: boolean;
  /** Plan modifications needed */
  planModifications?: PlanModificationSuggestion[];
  /** Completion timestamp */
  completedAt: string;
  /** Time spent in minutes */
  timeSpentMinutes: number;
}

/** Suggested plan modification from spike */
export interface PlanModificationSuggestion {
  /** Type of modification */
  type: 'add_task' | 'remove_task' | 'modify_task' | 'add_dependency' | 'change_approach';
  /** Task ID affected (for modify/remove) */
  taskId?: string;
  /** Description of the change */
  description: string;
  /** New task details (for add) */
  newTask?: {
    name: string;
    action: string;
    wave?: number;
  };
  /** Rationale for the change */
  rationale: string;
}

// ============================================================================
// Spike State
// ============================================================================

/** Spike state for a plan */
export interface SpikeState {
  /** Plan path */
  planPath: string;
  /** All spikes for this plan */
  spikes: SpikeTask[];
  /** Summary statistics */
  stats: SpikeStats;
  /** Last updated */
  lastUpdated: string;
}

/** Spike statistics */
export interface SpikeStats {
  /** Total spikes created */
  total: number;
  /** By status */
  byStatus: Record<SpikeStatus, number>;
  /** Success rate (completed spikes that proceeded) */
  successRate?: number;
  /** Average time spent */
  avgTimeMinutes?: number;
  /** Plan modifications triggered */
  modificationsTriggered: number;
}

// ============================================================================
// Configuration
// ============================================================================

/** Spike configuration */
export interface SpikeConfig {
  /** Uncertainty threshold for auto-spike (default: 7) */
  autoSpikeThreshold: UncertaintyLevel;
  /** Default time-box in minutes (default: 30) */
  defaultTimeBoxMinutes: number;
  /** Whether to pause execution when spike needed */
  pauseOnSpike: boolean;
  /** Whether to auto-trigger plan revision on spike findings */
  autoTriggerRevision: boolean;
}

/** Default spike configuration */
export const DEFAULT_SPIKE_CONFIG: SpikeConfig = {
  autoSpikeThreshold: 7,
  defaultTimeBoxMinutes: 30,
  pauseOnSpike: true,
  autoTriggerRevision: true,
};

// ============================================================================
// Task Extension
// ============================================================================

/** Task metadata extension for uncertainty */
export interface TaskUncertaintyMetadata {
  /** Uncertainty level (0-10) */
  uncertainty: UncertaintyLevel;
  /** Uncertainty category */
  category?: UncertaintyCategory;
  /** Why this task is uncertain */
  reason?: string;
  /** Whether spike was created */
  spikeCreated?: boolean;
  /** Spike ID if created */
  spikeId?: string;
}
