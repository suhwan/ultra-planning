/**
 * Complexity Estimator
 *
 * Estimates task complexity based on various signals.
 * Uses heuristics for quick estimation without LLM calls.
 */

import {
  ComplexityLevel,
  ComplexityCategory,
  ModelTier,
  TaskComplexity,
  ComplexityEstimationInput,
  ComplexityEstimationResult,
  COMPLEXITY_MODEL_MAP,
  LEVEL_MINUTES_MAP,
} from './types.js';

// ============================================================================
// Complexity Signals
// ============================================================================

/** Keywords indicating higher complexity */
const HIGH_COMPLEXITY_KEYWORDS = [
  'refactor',
  'architecture',
  'redesign',
  'migrate',
  'rewrite',
  'optimize',
  'performance',
  'security',
  'authentication',
  'authorization',
  'database schema',
  'api design',
  'state management',
  'concurrent',
  'async',
  'race condition',
];

/** Keywords indicating lower complexity */
const LOW_COMPLEXITY_KEYWORDS = [
  'rename',
  'update',
  'fix typo',
  'add comment',
  'config',
  'constant',
  'import',
  'export',
  'lint',
  'format',
  'simple',
  'straightforward',
];

/** File patterns indicating complexity */
const COMPLEX_FILE_PATTERNS = [
  /schema\.(ts|prisma|sql)/i,
  /migration/i,
  /middleware/i,
  /auth/i,
  /security/i,
  /core\//i,
  /engine\//i,
];

// ============================================================================
// Estimation Functions
// ============================================================================

/**
 * Estimate complexity from task description and context
 */
export function estimateComplexity(
  input: ComplexityEstimationInput
): ComplexityEstimationResult {
  const factors: string[] = [];
  let score = 3; // Start at standard

  const description = input.taskDescription.toLowerCase();

  // Check for high complexity keywords
  for (const keyword of HIGH_COMPLEXITY_KEYWORDS) {
    if (description.includes(keyword.toLowerCase())) {
      score += 0.5;
      factors.push(`High complexity keyword: "${keyword}"`);
    }
  }

  // Check for low complexity keywords
  for (const keyword of LOW_COMPLEXITY_KEYWORDS) {
    if (description.includes(keyword.toLowerCase())) {
      score -= 0.5;
      factors.push(`Low complexity keyword: "${keyword}"`);
    }
  }

  // File count factor
  if (input.files) {
    const fileCount = input.files.length;
    if (fileCount === 1) {
      score -= 0.5;
      factors.push('Single file change');
    } else if (fileCount >= 5) {
      score += 1;
      factors.push(`Multiple files (${fileCount})`);
    } else if (fileCount >= 3) {
      score += 0.5;
      factors.push(`Several files (${fileCount})`);
    }

    // Check for complex file patterns
    for (const file of input.files) {
      for (const pattern of COMPLEX_FILE_PATTERNS) {
        if (pattern.test(file)) {
          score += 0.5;
          factors.push(`Complex file pattern: ${file}`);
          break;
        }
      }
    }
  }

  // Dependency factor
  if (input.dependencies && input.dependencies.length > 0) {
    if (input.dependencies.length >= 3) {
      score += 0.5;
      factors.push(`Multiple dependencies (${input.dependencies.length})`);
    }
  }

  // Clamp score to valid range
  const level = Math.max(1, Math.min(5, Math.round(score))) as ComplexityLevel;

  // Determine category
  const category = levelToCategory(level);

  // Calculate confidence based on number of factors
  const confidence = Math.min(0.9, 0.5 + factors.length * 0.1);

  // Get estimated minutes
  const minuteRange = LEVEL_MINUTES_MAP[level];
  const estimatedMinutes = Math.round((minuteRange.min + minuteRange.max) / 2);

  const complexity: TaskComplexity = {
    level,
    estimatedMinutes,
    category,
    rationale: factors.join('; '),
  };

  return {
    complexity,
    recommendedModel: COMPLEXITY_MODEL_MAP[level],
    confidence,
    factors,
  };
}

/**
 * Convert complexity level to category
 */
export function levelToCategory(level: ComplexityLevel): ComplexityCategory {
  switch (level) {
    case 1:
    case 2:
      return 'quick';
    case 3:
      return 'standard';
    case 4:
      return 'complex';
    case 5:
      return 'architectural';
  }
}

/**
 * Get recommended model for a complexity level
 */
export function getModelForComplexity(level: ComplexityLevel): ModelTier {
  return COMPLEXITY_MODEL_MAP[level];
}

/**
 * Quick complexity check from task name only
 */
export function quickEstimate(taskName: string): ComplexityLevel {
  const result = estimateComplexity({ taskDescription: taskName });
  return result.complexity.level;
}

/**
 * Batch estimate complexity for multiple tasks
 */
export function batchEstimate(
  tasks: Array<{ name: string; action: string; files?: string[] }>
): Map<string, ComplexityEstimationResult> {
  const results = new Map<string, ComplexityEstimationResult>();

  for (const task of tasks) {
    const result = estimateComplexity({
      taskDescription: `${task.name}: ${task.action}`,
      files: task.files,
    });
    results.set(task.name, result);
  }

  return results;
}
