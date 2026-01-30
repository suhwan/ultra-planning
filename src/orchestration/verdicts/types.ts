/**
 * Agent Verdict Types
 *
 * Defines verdict structures for Architect and Critic agents.
 * Based on architect-verdict.schema.yaml and critic-verdict.schema.yaml.
 */

// ============================================================================
// Common Types
// ============================================================================

/** Timestamp in ISO 8601 format */
export type ISOTimestamp = string;

// ============================================================================
// Architect Verdict
// ============================================================================

/** Architect verdict values */
export type ArchitectVerdictType = 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION';

/** Architect verification checklist */
export interface ArchitectChecklist {
  /** Code compiles without errors */
  codeCompiles: boolean;
  /** All relevant tests pass */
  testsPass: boolean;
  /** Task requirements are fulfilled */
  requirementsMet: boolean;
  /** No regression in existing functionality */
  noRegressions: boolean;
  /** Code follows project standards */
  codeQuality: boolean;
}

/** Evidence supporting the verdict */
export interface ArchitectEvidence {
  /** Build command output */
  buildOutput?: string;
  /** Test command output */
  testOutput?: string;
  /** Files reviewed for code quality */
  filesReviewed?: string[];
}

/** Architect verification verdict */
export interface ArchitectVerdict {
  /** Overall verdict */
  verdict: ArchitectVerdictType;
  /** Verification timestamp */
  timestamp: ISOTimestamp;
  /** Task ID that was verified */
  taskId: string;
  /** Checklist results */
  checklist: ArchitectChecklist;
  /** Pass percentage (80% = APPROVED) */
  passPercentage: number;
  /** Issues found (if any) */
  issues?: string[];
  /** Suggestions for improvement */
  suggestions?: string[];
  /** Evidence supporting the verdict */
  evidence?: ArchitectEvidence;
}

// ============================================================================
// Critic Verdict
// ============================================================================

/** Critic verdict values */
export type CriticVerdictType = 'OKAY' | 'REJECT';

/** Critic review checklist */
export interface CriticChecklist {
  /** Tasks align with phase/project goals */
  goalsAligned: boolean;
  /** Each task is atomic (single commit worthy) */
  tasksAtomic: boolean;
  /** Task dependencies are explicit and correct */
  dependenciesClear: boolean;
  /** Each task has clear "done" criteria */
  verifiable: boolean;
  /** Wave assignments enable parallel execution */
  waveStructure: boolean;
}

/** Critic review verdict */
export interface CriticVerdict {
  /** Overall verdict */
  verdict: CriticVerdictType;
  /** Review timestamp */
  timestamp: ISOTimestamp;
  /** Plan path reviewed */
  planPath: string;
  /** Current Ralplan iteration */
  iteration?: number;
  /** Checklist results */
  checklist: CriticChecklist;
  /** Pass percentage (80% = OKAY) */
  passPercentage: number;
  /** Justification for verdict */
  justification: string;
  /** Improvements needed (if REJECT) */
  improvements?: string[];
  /** Positive aspects of the plan */
  strengths?: string[];
}

// ============================================================================
// Checklist Utilities
// ============================================================================

/** Default approval threshold (80%) */
export const APPROVAL_THRESHOLD = 80;

/** Architect checklist item names */
export const ARCHITECT_CHECKLIST_ITEMS: (keyof ArchitectChecklist)[] = [
  'codeCompiles',
  'testsPass',
  'requirementsMet',
  'noRegressions',
  'codeQuality',
];

/** Critic checklist item names */
export const CRITIC_CHECKLIST_ITEMS: (keyof CriticChecklist)[] = [
  'goalsAligned',
  'tasksAtomic',
  'dependenciesClear',
  'verifiable',
  'waveStructure',
];
