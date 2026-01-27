/**
 * Review Reporter
 *
 * Formats review results into human-readable markdown reports.
 * Generates summaries with issues grouped by severity.
 */

import type { ReviewResult, ReviewIssue, ReviewSeverity } from './types.js';

/**
 * Generate markdown review report
 *
 * Creates a formatted markdown document with review summary,
 * stage results, severity breakdown, and detailed issue list.
 *
 * @param result - Review result to format
 * @returns Markdown formatted report
 */
export function generateReport(result: ReviewResult): string {
  const lines: string[] = [];

  // Header
  lines.push('# Code Review Report');
  lines.push('');

  // Summary section
  lines.push('## Summary');
  lines.push('');
  lines.push(`**Files Reviewed:** ${result.summary.filesReviewed}`);
  lines.push(`**Total Issues:** ${result.summary.total}`);
  lines.push(`**Duration:** ${result.duration}ms`);
  lines.push('');

  // Stage status
  lines.push('## Review Stages');
  lines.push('');
  lines.push(`- **Stage 1 (Spec Compliance):** ${result.stage1Passed ? '✓ PASS' : '✗ FAIL'}`);
  lines.push(`- **Stage 2 (Code Quality):** ${result.stage2Passed ? '✓ PASS' : '✗ FAIL'}`);
  lines.push('');

  // By severity
  lines.push('## Issues by Severity');
  lines.push('');
  lines.push(`- **CRITICAL:** ${result.summary.critical} (must fix before merge)`);
  lines.push(`- **HIGH:** ${result.summary.high} (should fix before merge)`);
  lines.push(`- **MEDIUM:** ${result.summary.medium} (consider fixing)`);
  lines.push(`- **LOW:** ${result.summary.low} (optional)`);
  lines.push('');

  // Recommendation
  lines.push('## Recommendation');
  lines.push('');
  lines.push(`**${result.recommendation}**`);
  lines.push('');

  if (result.recommendation === 'APPROVE') {
    lines.push('Code meets quality standards and is ready to merge.');
  } else if (result.recommendation === 'REQUEST_CHANGES') {
    lines.push('Critical or high severity issues must be addressed before merging.');
  } else {
    lines.push('Medium severity issues detected. Review and merge at your discretion.');
  }
  lines.push('');

  // Issues list
  if (result.issues.length > 0) {
    lines.push('## Issues');
    lines.push('');

    // Group by severity
    for (const severity of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const) {
      const severityIssues = result.issues.filter(i => i.severity === severity);
      if (severityIssues.length > 0) {
        lines.push(`### ${severity}`);
        lines.push('');
        for (const issue of severityIssues) {
          lines.push(formatIssue(issue));
          lines.push('');
        }
      }
    }
  } else {
    lines.push('## Issues');
    lines.push('');
    lines.push('No issues found. Great work!');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format a single issue for display
 *
 * @param issue - Review issue to format
 * @returns Formatted issue string
 */
export function formatIssue(issue: ReviewIssue): string {
  const lines: string[] = [];

  // Issue header
  lines.push(`**[${issue.code}] ${issue.description}**`);
  lines.push('');

  // Location
  const location = issue.column
    ? `${issue.file}:${issue.line}:${issue.column}`
    : `${issue.file}:${issue.line}`;
  lines.push(`**Location:** \`${location}\``);
  lines.push(`**Category:** ${issue.category}`);
  lines.push('');

  // Code snippet if available
  if (issue.snippet) {
    lines.push('**Code:**');
    lines.push('```typescript');
    lines.push(issue.snippet);
    lines.push('```');
    lines.push('');
  }

  // Fix suggestion
  lines.push(`**Fix:** ${issue.fix}`);

  return lines.join('\n');
}

/**
 * Count review issues by severity
 *
 * @param issues - Array of review issues
 * @returns Object with count for each severity level
 */
export function countReviewIssuesBySeverity(issues: ReviewIssue[]): Record<ReviewSeverity, number> {
  return {
    CRITICAL: issues.filter(i => i.severity === 'CRITICAL').length,
    HIGH: issues.filter(i => i.severity === 'HIGH').length,
    MEDIUM: issues.filter(i => i.severity === 'MEDIUM').length,
    LOW: issues.filter(i => i.severity === 'LOW').length,
  };
}

/**
 * Format severity counts as a summary string
 *
 * @param counts - Severity counts object
 * @returns Human-readable summary string
 */
export function formatSeveritySummary(counts: Record<ReviewSeverity, number>): string {
  const parts: string[] = [];

  if (counts.CRITICAL > 0) {
    parts.push(`${counts.CRITICAL} critical`);
  }
  if (counts.HIGH > 0) {
    parts.push(`${counts.HIGH} high`);
  }
  if (counts.MEDIUM > 0) {
    parts.push(`${counts.MEDIUM} medium`);
  }
  if (counts.LOW > 0) {
    parts.push(`${counts.LOW} low`);
  }

  return parts.length > 0 ? parts.join(', ') : 'no issues';
}
