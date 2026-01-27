/**
 * Quality Pipeline Executor
 *
 * Orchestrates: LSP diagnostics -> AST analysis -> Code review
 */

import type {
  PipelineResult,
  PipelineOptions,
  PipelineStage,
  PipelineStatus,
  StageResult,
  PipelineSummary,
} from './types.js';
import { runDiagnostics, type DiagnosticResult } from '../lsp/index.js';
import { analyzeDirectory, type FileAnalysis } from '../ast/index.js';
import { runReview, type ReviewResult } from '../review/index.js';

/**
 * Run the full quality pipeline
 *
 * Flow:
 * 1. LSP Diagnostics - Check for type errors
 * 2. AST Analysis - Extract code structure and metrics
 * 3. Code Review - Run checklist-based quality review
 *
 * By default, fails fast if LSP finds errors.
 */
export async function runQualityPipeline(
  options?: PipelineOptions
): Promise<PipelineResult> {
  const startTime = Date.now();
  const dir = options?.directory ?? process.cwd();
  const skipStages = new Set(options?.skip ?? []);
  const failOnLsp = options?.failOnLspErrors ?? true;
  const failOnCritical = options?.failOnCritical ?? true;

  const stages: PipelineResult['stages'] = {};
  let failedAt: PipelineStage | undefined;
  let overallStatus: PipelineStatus = 'passed';

  // Stage 1: LSP Diagnostics
  if (!skipStages.has('lsp')) {
    const lspResult = await runStage('lsp', async () => {
      return runDiagnostics(dir, { type: 'auto', timeout: options?.stageTimeout });
    });

    stages.lsp = lspResult;

    // Check fail-fast condition
    if (lspResult.status === 'failed') {
      failedAt = 'lsp';
      overallStatus = 'failed';
    } else if (failOnLsp && lspResult.data && lspResult.data.summary.errorCount > 0) {
      failedAt = 'lsp';
      overallStatus = 'failed';
      stages.lsp.status = 'failed';
    }
  }

  // Stage 2: AST Analysis (skip if LSP failed and failFast)
  if (!skipStages.has('ast') && !failedAt) {
    const astResult = await runStage('ast', async () => {
      return analyzeDirectory(dir, {
        extensions: ['.ts', '.tsx'],
        exclude: ['node_modules', 'dist', '.git'],
      });
    });

    stages.ast = astResult;

    if (astResult.status === 'failed') {
      failedAt = 'ast';
      overallStatus = 'failed';
    }
  }

  // Stage 3: Code Review (skip if earlier stages failed)
  if (!skipStages.has('review') && !failedAt) {
    const files = options?.files ?? (stages.ast?.data?.map(a => a.file) ?? []);

    const reviewResult = await runStage('review', async () => {
      return runReview(files, { includeMetrics: true });
    });

    stages.review = reviewResult;

    if (reviewResult.status === 'failed') {
      failedAt = 'review';
      overallStatus = 'failed';
    } else if (failOnCritical && reviewResult.data) {
      if (reviewResult.data.recommendation === 'REQUEST_CHANGES') {
        failedAt = 'review';
        overallStatus = 'failed';
        stages.review.status = 'failed';
      }
    }
  }

  const summary = calculateSummary(stages);

  return {
    status: overallStatus,
    passed: overallStatus === 'passed',
    failedAt,
    stages,
    totalDuration: Date.now() - startTime,
    summary,
  };
}

/**
 * Run a single pipeline stage with error handling
 */
export async function runStage<T>(
  stage: PipelineStage,
  fn: () => Promise<T>
): Promise<StageResult<T>> {
  const start = Date.now();

  try {
    const data = await fn();
    return {
      stage,
      status: 'passed',
      data,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      stage,
      status: 'failed',
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Calculate pipeline summary from stage results
 */
function calculateSummary(stages: PipelineResult['stages']): PipelineSummary {
  const errors = stages.lsp?.data?.summary.errorCount ?? 0;
  const warnings = stages.lsp?.data?.summary.warningCount ?? 0;
  const reviewIssues = stages.review?.data?.summary.total ?? 0;
  const filesAnalyzed = stages.ast?.data?.length ?? 0;

  let recommendation: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
  if (errors > 0 || (stages.review?.data?.summary.critical ?? 0) > 0) {
    recommendation = 'FAIL';
  } else if (warnings > 0 || (stages.review?.data?.summary.high ?? 0) > 0) {
    recommendation = 'WARN';
  }

  return {
    errors,
    warnings,
    reviewIssues,
    filesAnalyzed,
    recommendation,
  };
}
