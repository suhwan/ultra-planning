/**
 * Review Checklists
 *
 * Default checklist definitions for security, quality, performance,
 * and best practice checks used in code review.
 */

import type { ChecklistItem, ReviewChecklist } from './types.js';

// ============================================================================
// Security Checks (CRITICAL Priority)
// ============================================================================

/**
 * Security-focused checks that identify potential vulnerabilities
 */
export const SECURITY_CHECKS: ChecklistItem[] = [
  {
    code: 'SEC001',
    severity: 'CRITICAL',
    category: 'security',
    name: 'Hardcoded Credentials',
    description: 'API keys, passwords, or tokens hardcoded in source',
    pattern: '(api_key|apiKey|password|secret|token)\\s*[=:]\\s*["\'][^"\']+["\']',
    fixTemplate: 'Move to environment variable: process.env.{NAME}',
  },
  {
    code: 'SEC002',
    severity: 'CRITICAL',
    category: 'security',
    name: 'SQL Injection Risk',
    description: 'String concatenation in SQL queries',
    pattern: 'query\\s*\\(\\s*[`"\'].*\\$\\{',
    fixTemplate: 'Use parameterized queries with placeholders',
  },
  {
    code: 'SEC003',
    severity: 'CRITICAL',
    category: 'security',
    name: 'Command Injection Risk',
    description: 'User input passed to exec/spawn without sanitization',
    pattern: 'exec\\s*\\([^)]*\\$\\{',
    fixTemplate: 'Use execFile with argument array instead of shell string',
  },
  {
    code: 'SEC004',
    severity: 'HIGH',
    category: 'security',
    name: 'Missing Input Validation',
    description: 'User input used without validation',
    fixTemplate: 'Add input validation and sanitization',
  },
];

// ============================================================================
// Quality Checks (HIGH Priority)
// ============================================================================

/**
 * Code quality checks for maintainability and reliability
 */
export const QUALITY_CHECKS: ChecklistItem[] = [
  {
    code: 'QUAL001',
    severity: 'HIGH',
    category: 'quality',
    name: 'Large Function',
    description: 'Function exceeds 50 lines',
    fixTemplate: 'Split into smaller, focused functions with single responsibility',
  },
  {
    code: 'QUAL002',
    severity: 'HIGH',
    category: 'quality',
    name: 'Console.log Statement',
    description: 'Debug console.log left in code',
    pattern: 'console\\.log\\(',
    fixTemplate: 'Remove or replace with proper logging framework',
  },
  {
    code: 'QUAL003',
    severity: 'HIGH',
    category: 'quality',
    name: 'Missing Error Handling',
    description: 'Async operation without try/catch',
    fixTemplate: 'Wrap async operations in try/catch block',
  },
  {
    code: 'QUAL004',
    severity: 'MEDIUM',
    category: 'quality',
    name: 'Large File',
    description: 'File exceeds 800 lines',
    fixTemplate: 'Consider splitting into multiple modules by responsibility',
  },
  {
    code: 'QUAL005',
    severity: 'HIGH',
    category: 'quality',
    name: 'Deep Nesting',
    description: 'Code nested deeper than 4 levels',
    fixTemplate: 'Extract nested logic into separate functions',
  },
  {
    code: 'QUAL006',
    severity: 'MEDIUM',
    category: 'quality',
    name: 'Code Duplication',
    description: 'Similar code repeated in multiple places',
    fixTemplate: 'Extract common logic into shared function',
  },
];

// ============================================================================
// Performance Checks (MEDIUM Priority)
// ============================================================================

/**
 * Performance-focused checks for optimization opportunities
 */
export const PERFORMANCE_CHECKS: ChecklistItem[] = [
  {
    code: 'PERF001',
    severity: 'MEDIUM',
    category: 'performance',
    name: 'Nested Loops',
    description: 'O(n^2) complexity from nested loops',
    fixTemplate: 'Consider using Map/Set for O(n) lookup or optimize algorithm',
  },
  {
    code: 'PERF002',
    severity: 'MEDIUM',
    category: 'performance',
    name: 'Synchronous File I/O',
    description: 'Using synchronous file operations (readFileSync, etc.)',
    pattern: '(readFileSync|writeFileSync|existsSync)',
    fixTemplate: 'Use async versions (readFile, writeFile, access) with await',
  },
  {
    code: 'PERF003',
    severity: 'LOW',
    category: 'performance',
    name: 'Missing Memoization',
    description: 'Expensive computation without caching',
    fixTemplate: 'Add memoization or caching for repeated calculations',
  },
];

// ============================================================================
// Best Practice Checks (LOW Priority)
// ============================================================================

/**
 * Best practice checks for code style and conventions
 */
export const BEST_PRACTICE_CHECKS: ChecklistItem[] = [
  {
    code: 'BP001',
    severity: 'LOW',
    category: 'best-practices',
    name: 'Magic Number',
    description: 'Unexplained numeric literal',
    fixTemplate: 'Extract to named constant with descriptive name',
  },
  {
    code: 'BP002',
    severity: 'LOW',
    category: 'best-practices',
    name: 'TODO Without Ticket',
    description: 'TODO comment without issue reference',
    pattern: '//\\s*TODO(?!.*#\\d)',
    fixTemplate: 'Add ticket reference: TODO(#123): description',
  },
  {
    code: 'BP003',
    severity: 'LOW',
    category: 'best-practices',
    name: 'Missing JSDoc',
    description: 'Public API function without documentation',
    fixTemplate: 'Add JSDoc comment explaining purpose, params, and return value',
  },
  {
    code: 'BP004',
    severity: 'LOW',
    category: 'best-practices',
    name: 'Poor Variable Naming',
    description: 'Variable named with single letter or unclear abbreviation',
    pattern: '(const|let|var)\\s+(x|tmp|data|val)\\s*=',
    fixTemplate: 'Use descriptive name that explains purpose',
  },
];

// ============================================================================
// Default Checklist
// ============================================================================

/**
 * Complete default checklist combining all check categories
 */
export const DEFAULT_CHECKLIST: ReviewChecklist = {
  security: SECURITY_CHECKS,
  quality: QUALITY_CHECKS,
  performance: PERFORMANCE_CHECKS,
  bestPractices: BEST_PRACTICE_CHECKS,
};
