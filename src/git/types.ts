/** Conventional commit types */
export type CommitType =
  | 'feat'     // New feature
  | 'fix'      // Bug fix
  | 'test'     // Tests
  | 'refactor' // Code restructuring
  | 'perf'     // Performance
  | 'chore'    // Maintenance
  | 'docs'     // Documentation
  | 'style';   // Formatting

/** Input for atomic task commit */
export interface TaskCommitInput {
  type: CommitType;
  /** Phase identifier (e.g., '03') */
  phase: string;
  /** Plan number (e.g., '01') */
  plan: string;
  /** Brief description of what was done */
  description: string;
  /** Bullet points for commit body */
  bulletPoints: string[];
  /** Files to stage (exact paths) */
  files: string[];
}

/** Result of commit operation */
export interface CommitResult {
  success: boolean;
  /** Git commit hash (if successful) */
  hash?: string;
  /** Error message (if failed) */
  error?: string;
}

/** Git status summary */
export interface GitStatusSummary {
  modified: string[];
  created: string[];
  deleted: string[];
  staged: string[];
  notStaged: string[];
}
