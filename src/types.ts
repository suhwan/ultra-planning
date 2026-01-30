/**
 * Ultra Planner Core Types
 *
 * Type definitions for the orchestration system.
 * Based on patterns from oh-my-claudecode mode-registry.
 */

// ============================================================================
// Execution Modes
// ============================================================================

/** Execution mode states */
export type ExecutionMode =
  | 'idle'
  | 'planning'
  | 'executing'
  | 'verifying'
  | 'paused'
  | 'error';

// ============================================================================
// Plan Types
// ============================================================================

/** Plan status values */
export type PlanStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/** PLAN.md frontmatter schema */
export interface PlanFrontmatter {
  phase: string;
  plan: number;
  type: 'execute' | 'tdd';
  wave: number;
  depends_on: string[];
  files_modified: string[];
  autonomous: boolean;
  must_haves: MustHaves;
}

/** Verification requirements */
export interface MustHaves {
  truths: string[];
  artifacts: Artifact[];
  key_links?: KeyLink[];
}

export interface Artifact {
  path: string;
  provides: string;
  contains?: string;
  exports?: string[];
  min_lines?: number;
}

export interface KeyLink {
  from: string;
  to: string;
  via: string;
  pattern?: string;
}

// ============================================================================
// State Types
// ============================================================================

/** Basic session state for .ultraplan/state/session.json (legacy format) */
export interface BasicSessionState {
  active_plan: string | null;
  started_at: string;
  session_id: string;
  phase: string;
  plan: number;
  mode: ExecutionMode;
}

/** Project config for .ultraplan/config.json */
export interface ProjectConfig {
  version: string;
  mode: 'interactive' | 'autopilot';
  depth: 'quick' | 'standard' | 'comprehensive';
  parallelization: boolean;
  max_workers: number;
  commit_docs: boolean;
  model_profile: 'quality' | 'balanced' | 'budget';
}

// ============================================================================
// Progress Types
// ============================================================================

/** Progress tracking */
export interface PlanProgress {
  total: number;
  completed: number;
  is_complete: boolean;
}

export interface PhaseProgress {
  phase: string;
  plans_total: number;
  plans_completed: number;
  status: 'not_started' | 'in_progress' | 'completed';
}

export interface ProjectProgress {
  phases: PhaseProgress[];
  overall_percentage: number;
}
