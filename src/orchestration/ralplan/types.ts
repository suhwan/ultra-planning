/**
 * Ralplan execution phases
 */
export type RalplanPhase =
  | 'planner_planning'      // Planner creating/refining plan
  | 'architect_consultation' // Optional Architect input
  | 'critic_review'         // Critic reviewing plan
  | 'handling_verdict'      // Processing OKAY/REJECT
  | 'complete';             // Loop finished

/**
 * Ralplan critic verdict type (simple alias)
 * @see CriticVerdict in verdicts module for full interface
 */
export type RalplanCriticVerdict = 'OKAY' | 'REJECT';

/**
 * Critic review result
 */
export interface CriticReviewResult {
  verdict: RalplanCriticVerdict;
  justification: string;
  improvements?: string[];
}

/**
 * Configuration for Ralplan session
 */
export interface RalplanConfig {
  /** Maximum iterations before forced approval (default: 5) */
  maxIterations?: number;
  /** Path to store the plan file */
  planPath?: string;
  /** Whether to consult Architect on rejection */
  consultArchitectOnReject?: boolean;
}

/**
 * Complete Ralplan session state
 */
export interface RalplanState extends Record<string, unknown> {
  /** Whether ralplan is active */
  active: boolean;
  /** Mode identifier */
  mode: 'ralplan';
  /** Current iteration number (1-indexed) */
  iteration: number;
  /** Maximum allowed iterations */
  maxIterations: number;
  /** Path to the plan being reviewed */
  planPath: string;
  /** Current phase in the loop */
  currentPhase: RalplanPhase;
  /** When session started (ISO 8601) */
  startedAt: string;
  /** Original task description */
  taskDescription: string;
  /** Last critic verdict (if any) */
  lastVerdict?: RalplanCriticVerdict;
  /** Last critic feedback (if rejected) */
  lastFeedback?: string;
  /** Whether approval was forced (max iterations reached) */
  forcedApproval?: boolean;
  /** When session completed (ISO 8601) */
  completedAt?: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_RALPLAN_CONFIG: Required<RalplanConfig> = {
  maxIterations: 5,
  planPath: '.ultraplan/plans/current.md',
  consultArchitectOnReject: true,
};
