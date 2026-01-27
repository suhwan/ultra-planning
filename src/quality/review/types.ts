/**
 * Code Review Types
 *
 * Type definitions for code review results including issues,
 * severity levels, categories, and review outcomes.
 */

// ============================================================================
// Review Severity and Categories
// ============================================================================

/**
 * Severity level for review issues
 * - CRITICAL: Security vulnerability, data loss risk (must fix)
 * - HIGH: Bug, major code smell (should fix)
 * - MEDIUM: Minor issue, performance concern (fix when possible)
 * - LOW: Style, suggestion (consider fixing)
 */
export type ReviewSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Category of review issue
 */
export type ReviewCategory =
  | 'security'
  | 'quality'
  | 'performance'
  | 'best-practices'
  | 'spec-compliance';

// ============================================================================
// Review Issue Types
// ============================================================================

/**
 * A single issue found during code review
 */
export interface ReviewIssue {
  /** Severity level */
  severity: ReviewSeverity;
  /** Issue category */
  category: ReviewCategory;
  /** File path where issue was found */
  file: string;
  /** Line number (1-indexed) */
  line: number;
  /** Column number (optional, 1-indexed) */
  column?: number;
  /** Rule identifier (e.g., 'SEC001', 'QUAL002') */
  code: string;
  /** Human-readable description of the issue */
  description: string;
  /** Suggested fix */
  fix: string;
  /** Code snippet showing the issue (optional) */
  snippet?: string;
}

// ============================================================================
// Review Result Types
// ============================================================================

/**
 * Recommendation for review outcome
 * - APPROVE: No critical or high issues
 * - REQUEST_CHANGES: Critical or high issues found
 * - COMMENT: Medium issues only (can merge with caution)
 */
export type ReviewRecommendation = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';

/**
 * Summary of review findings grouped by severity
 */
export interface ReviewSummary {
  /** Number of CRITICAL issues */
  critical: number;
  /** Number of HIGH issues */
  high: number;
  /** Number of MEDIUM issues */
  medium: number;
  /** Number of LOW issues */
  low: number;
  /** Total issue count */
  total: number;
  /** Number of files reviewed */
  filesReviewed: number;
}

/**
 * Complete review result including stages, issues, and recommendation
 */
export interface ReviewResult {
  /** Whether review execution succeeded */
  success: boolean;
  /** Recommendation for review outcome */
  recommendation: ReviewRecommendation;
  /** Whether Stage 1 (spec compliance) passed */
  stage1Passed: boolean;
  /** Whether Stage 2 (code quality) passed */
  stage2Passed: boolean;
  /** List of all issues found */
  issues: ReviewIssue[];
  /** Summary statistics */
  summary: ReviewSummary;
  /** Review execution duration in ms */
  duration: number;
}

// ============================================================================
// Checklist Types
// ============================================================================

/**
 * A single check item in the review checklist
 */
export interface ChecklistItem {
  /** Unique code for this check */
  code: string;
  /** Severity level */
  severity: ReviewSeverity;
  /** Category */
  category: ReviewCategory;
  /** Short name */
  name: string;
  /** Description of what to check */
  description: string;
  /** Optional regex pattern to detect issue */
  pattern?: string;
  /** Template for suggested fix */
  fixTemplate: string;
}

/**
 * Complete review checklist organized by category
 */
export interface ReviewChecklist {
  /** Security checks (CRITICAL priority) */
  security: ChecklistItem[];
  /** Quality checks (HIGH priority) */
  quality: ChecklistItem[];
  /** Performance checks (MEDIUM priority) */
  performance: ChecklistItem[];
  /** Best practice checks (LOW priority) */
  bestPractices: ChecklistItem[];
}

// ============================================================================
// Review Options
// ============================================================================

/**
 * Configuration options for running a review
 */
export interface ReviewOptions {
  /** Custom checklist (merged with defaults) */
  checklist?: Partial<ReviewChecklist>;
  /** Minimum severity to report (filters out lower severity issues) */
  minSeverity?: ReviewSeverity;
  /** Whether to include metrics-based checks */
  includeMetrics?: boolean;
  /** Maximum number of issues to report (truncates if exceeded) */
  maxIssues?: number;
}
