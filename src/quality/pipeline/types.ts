/**
 * Quality Pipeline Types
 *
 * Types for orchestrating LSP -> AST -> Review quality checks.
 */

import type { DiagnosticResult } from '../lsp/types.js';
import type { FileAnalysis } from '../ast/types.js';
import type { ReviewResult } from '../review/types.js';

// ============================================================================
// Pipeline Stage Types
// ============================================================================

export type PipelineStage = 'lsp' | 'ast' | 'review';

export type PipelineStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export interface StageResult<T> {
  stage: PipelineStage;
  status: PipelineStatus;
  data?: T;
  duration: number;
  error?: string;
}

// ============================================================================
// Pipeline Result Types
// ============================================================================

export interface PipelineResult {
  /** Overall pipeline status */
  status: PipelineStatus;

  /** Whether all stages passed */
  passed: boolean;

  /** Stage that caused failure (if any) */
  failedAt?: PipelineStage;

  /** Individual stage results */
  stages: {
    lsp?: StageResult<DiagnosticResult>;
    ast?: StageResult<FileAnalysis[]>;
    review?: StageResult<ReviewResult>;
  };

  /** Total pipeline duration (ms) */
  totalDuration: number;

  /** Summary for quick reference */
  summary: PipelineSummary;
}

export interface PipelineSummary {
  errors: number;
  warnings: number;
  reviewIssues: number;
  filesAnalyzed: number;
  recommendation: 'PASS' | 'WARN' | 'FAIL';
}

// ============================================================================
// Pipeline Options
// ============================================================================

export interface PipelineOptions {
  /** Directory to analyze (default: current working directory) */
  directory?: string;

  /** Files to focus on (if empty, analyze all) */
  files?: string[];

  /** Skip stages */
  skip?: PipelineStage[];

  /** Fail fast on LSP errors (default: true) */
  failOnLspErrors?: boolean;

  /** Fail fast on critical review issues (default: true) */
  failOnCritical?: boolean;

  /** Timeout per stage in ms (default: 60000) */
  stageTimeout?: number;

  /** Save result to state file (default: true) */
  persistResult?: boolean;
}

// ============================================================================
// Task Integration Types
// ============================================================================

export interface TaskCompleteContext {
  /** Task identifier */
  taskId: string;

  /** Phase identifier */
  phase: string;

  /** Plan number */
  plan: number;

  /** Files modified by the task */
  modifiedFiles: string[];
}

export interface QualityCheckResult {
  /** Context of the triggering task */
  context: TaskCompleteContext;

  /** Pipeline execution result */
  pipeline: PipelineResult;

  /** Timestamp of check */
  timestamp: string;
}
