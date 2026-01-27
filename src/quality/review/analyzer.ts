/**
 * Review Analyzer
 *
 * Core review engine implementing 2-stage review process:
 * Stage 1: Spec compliance via type checking
 * Stage 2: Code quality via checklist analysis
 */

import { readFileSync } from 'fs';
import type {
  ReviewResult,
  ReviewIssue,
  ReviewOptions,
  ReviewSummary,
  ReviewRecommendation,
  ChecklistItem,
  ReviewChecklist,
} from './types.js';
import { DEFAULT_CHECKLIST } from './checklist.js';
import { analyzeFile, type CodeMetrics } from '../ast/index.js';
import { runDiagnostics } from '../lsp/index.js';

/**
 * Run 2-stage code review on files
 *
 * Stage 1: Spec compliance (via LSP diagnostics - type errors = spec failure)
 * Stage 2: Code quality (via checklist analysis)
 *
 * @param files - Array of file paths to review
 * @param options - Review configuration options
 * @returns Complete review result with issues and recommendation
 */
export async function runReview(
  files: string[],
  options?: ReviewOptions
): Promise<ReviewResult> {
  const start = Date.now();
  const issues: ReviewIssue[] = [];
  const checklist: ReviewChecklist = {
    security: [...DEFAULT_CHECKLIST.security, ...(options?.checklist?.security ?? [])],
    quality: [...DEFAULT_CHECKLIST.quality, ...(options?.checklist?.quality ?? [])],
    performance: [...DEFAULT_CHECKLIST.performance, ...(options?.checklist?.performance ?? [])],
    bestPractices: [...DEFAULT_CHECKLIST.bestPractices, ...(options?.checklist?.bestPractices ?? [])],
  };

  // Stage 1: Spec Compliance (type errors from diagnostics)
  const stage1Passed = await checkSpecCompliance(files, issues);

  // Stage 2: Code Quality (only if stage 1 passes, or run anyway for full report)
  const stage2Passed = await checkCodeQuality(files, checklist, issues, options);

  const summary = calculateSummary(issues, files.length);
  const recommendation = determineRecommendation(summary, stage1Passed);

  return {
    success: true,
    recommendation,
    stage1Passed,
    stage2Passed,
    issues: options?.maxIssues ? issues.slice(0, options.maxIssues) : issues,
    summary,
    duration: Date.now() - start,
  };
}

/**
 * Stage 1: Check spec compliance via type checking
 *
 * Uses LSP diagnostics to find type errors which indicate
 * spec compliance failures.
 *
 * @param files - Files to check
 * @param issues - Array to append issues to
 * @returns true if no type errors found
 */
export async function checkSpecCompliance(
  files: string[],
  issues: ReviewIssue[]
): Promise<boolean> {
  // Use LSP diagnostics to check for type errors
  const dir = process.cwd();
  const result = await runDiagnostics(dir, { type: 'auto' });

  // Filter to only files we're reviewing
  const fileSet = new Set(files.map(f => f.replace(/^\.\//, '')));

  for (const diag of result.diagnostics) {
    if (fileSet.has(diag.file) || fileSet.size === 0) {
      if (diag.severity === 'error') {
        issues.push({
          severity: 'CRITICAL',
          category: 'spec-compliance',
          file: diag.file,
          line: diag.line,
          column: diag.column,
          code: `TS${diag.code}`,
          description: diag.message,
          fix: 'Fix type error to match specification',
        });
      }
    }
  }

  return result.summary.errorCount === 0;
}

/**
 * Stage 2: Check code quality via checklist
 *
 * Runs pattern-based checks and metrics analysis against
 * the review checklist.
 *
 * @param files - Files to check
 * @param checklist - Review checklist to apply
 * @param issues - Array to append issues to
 * @param options - Review options
 * @returns true if no high or critical issues found
 */
export async function checkCodeQuality(
  files: string[],
  checklist: ReviewChecklist,
  issues: ReviewIssue[],
  options?: ReviewOptions
): Promise<boolean> {
  let hasHighOrCritical = false;

  for (const filePath of files) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const analysis = await analyzeFile(filePath);

      // Run pattern-based checks
      for (const category of ['security', 'quality', 'performance', 'bestPractices'] as const) {
        for (const check of checklist[category]) {
          const found = runCheck(check, filePath, content, analysis.metrics);
          issues.push(...found);
          if (found.some(i => i.severity === 'CRITICAL' || i.severity === 'HIGH')) {
            hasHighOrCritical = true;
          }
        }
      }

      // Metrics-based checks
      if (options?.includeMetrics !== false) {
        const metricsIssues = checkMetrics(filePath, analysis.metrics);
        issues.push(...metricsIssues);
        if (metricsIssues.some(i => i.severity === 'CRITICAL' || i.severity === 'HIGH')) {
          hasHighOrCritical = true;
        }
      }
    } catch (error) {
      // Skip files that can't be analyzed
      // Could add warning issue here if needed
    }
  }

  return !hasHighOrCritical;
}

/**
 * Run a single checklist item check
 *
 * @param check - Checklist item to run
 * @param file - File path
 * @param content - File content
 * @param metrics - Code metrics
 * @returns Array of issues found
 */
function runCheck(
  check: ChecklistItem,
  file: string,
  content: string,
  metrics: CodeMetrics
): ReviewIssue[] {
  const issues: ReviewIssue[] = [];

  // Pattern-based check
  if (check.pattern) {
    const regex = new RegExp(check.pattern, 'gi');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      regex.lastIndex = 0; // Reset regex state
      const match = regex.exec(line);

      if (match) {
        issues.push({
          severity: check.severity,
          category: check.category,
          file,
          line: i + 1,
          code: check.code,
          description: check.description,
          fix: check.fixTemplate,
          snippet: line.trim(),
        });
      }
    }
  }

  return issues;
}

/**
 * Check code metrics against thresholds
 *
 * @param file - File path
 * @param metrics - Code metrics
 * @returns Array of metric-based issues
 */
function checkMetrics(file: string, metrics: CodeMetrics): ReviewIssue[] {
  const issues: ReviewIssue[] = [];

  // Large function check
  if (metrics.maxFunctionSize > 50) {
    issues.push({
      severity: 'HIGH',
      category: 'quality',
      file,
      line: 1,
      code: 'QUAL001',
      description: `Function "${metrics.largestFunction}" has ${metrics.maxFunctionSize} lines (max recommended: 50)`,
      fix: 'Split into smaller functions with single responsibility',
    });
  }

  // Large file check
  if (metrics.totalLines > 800) {
    issues.push({
      severity: 'MEDIUM',
      category: 'quality',
      file,
      line: 1,
      code: 'QUAL004',
      description: `File has ${metrics.totalLines} lines (max recommended: 800)`,
      fix: 'Consider splitting into multiple modules by responsibility',
    });
  }

  // Complexity check
  if (metrics.complexity > 20) {
    issues.push({
      severity: 'HIGH',
      category: 'quality',
      file,
      line: 1,
      code: 'QUAL005',
      description: `File has cyclomatic complexity of ${metrics.complexity} (max recommended: 20)`,
      fix: 'Reduce complexity by extracting nested logic into functions',
    });
  }

  return issues;
}

/**
 * Calculate summary statistics from issues
 *
 * @param issues - Array of all issues found
 * @param fileCount - Number of files reviewed
 * @returns Summary statistics
 */
function calculateSummary(issues: ReviewIssue[], fileCount: number): ReviewSummary {
  return {
    critical: issues.filter(i => i.severity === 'CRITICAL').length,
    high: issues.filter(i => i.severity === 'HIGH').length,
    medium: issues.filter(i => i.severity === 'MEDIUM').length,
    low: issues.filter(i => i.severity === 'LOW').length,
    total: issues.length,
    filesReviewed: fileCount,
  };
}

/**
 * Determine review recommendation based on summary and stage results
 *
 * @param summary - Review summary statistics
 * @param stage1Passed - Whether spec compliance passed
 * @returns Review recommendation
 */
function determineRecommendation(
  summary: ReviewSummary,
  stage1Passed: boolean
): ReviewRecommendation {
  // Stage 1 failure or critical/high issues = request changes
  if (!stage1Passed || summary.critical > 0 || summary.high > 0) {
    return 'REQUEST_CHANGES';
  }

  // Medium issues only = comment (can merge with caution)
  if (summary.medium > 0) {
    return 'COMMENT';
  }

  // No significant issues = approve
  return 'APPROVE';
}
