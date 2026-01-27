/**
 * Code Metrics Calculation
 *
 * Calculates code quality metrics from parsed AST structures including
 * line counts, function sizes, and complexity estimates.
 */

import type { CodeStructure, CodeMetrics } from './types.js';

/**
 * Calculate code metrics from file content and structure
 *
 * @param content - Raw file content
 * @param structure - Parsed code structure
 * @returns Calculated metrics
 */
export function calculateMetrics(content: string, structure: CodeStructure): CodeMetrics {
  const lines = content.split('\n');
  const totalLines = lines.length;

  // Count non-blank, non-comment lines (simple heuristic)
  const codeLines = lines.filter(l => {
    const trimmed = l.trim();
    return trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*');
  }).length;

  // Calculate function size statistics
  const functionSizes = structure.functions.map(f => f.lineCount);
  const maxFunctionSize = Math.max(0, ...functionSizes);
  const avgFunctionSize = functionSizes.length > 0
    ? functionSizes.reduce((a, b) => a + b, 0) / functionSizes.length
    : 0;

  // Find largest function
  const largestFunction = maxFunctionSize > 0
    ? structure.functions.find(f => f.lineCount === maxFunctionSize)?.name ?? null
    : null;

  return {
    totalLines,
    codeLines,
    functionCount: structure.functions.length,
    classCount: structure.classes.length,
    exportCount: structure.exports.length,
    importCount: structure.imports.length,
    avgFunctionSize: Math.round(avgFunctionSize * 10) / 10,
    maxFunctionSize,
    largestFunction,
    complexity: calculateComplexity(structure),
  };
}

/**
 * Calculate cyclomatic complexity estimate
 *
 * This is a simplified estimate that counts structural elements.
 * For accurate complexity, use a dedicated tool like eslint-plugin-complexity.
 *
 * @param structure - Parsed code structure
 * @returns Complexity estimate
 */
export function calculateComplexity(structure: CodeStructure): number {
  // Base complexity: 1 per function + 1 per class
  // This is a rough estimate without full AST branch analysis
  return structure.functions.length + structure.classes.length;
}
