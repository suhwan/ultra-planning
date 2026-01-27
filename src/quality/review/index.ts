/**
 * Code Review Module
 *
 * Automated code review with 2-stage process:
 * - Stage 1: Spec compliance via type checking
 * - Stage 2: Code quality via checklist analysis
 *
 * @example
 * ```typescript
 * import { runReview, generateReport } from './quality/review/index.js';
 *
 * const result = await runReview(['src/file.ts']);
 * console.log(generateReport(result));
 * ```
 */

export * from './types.js';
export * from './checklist.js';
export * from './analyzer.js';
export * from './reporter.js';
