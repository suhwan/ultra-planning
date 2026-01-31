/**
 * Complexity Hints
 *
 * Suggests complexity levels based on heuristics.
 * These are hints for AI decision-making, not enforced rules.
 */

import {
  ComplexityHint,
  ComplexitySuggestionInput,
  ComplexityLevel,
  ComplexityCategory,
  ModelTier,
  HIGH_COMPLEXITY_KEYWORDS,
  LOW_COMPLEXITY_KEYWORDS,
  COMPLEXITY_MODEL_REFERENCE,
} from './types.js';

// ============================================================================
// File Pattern References
// ============================================================================

/**
 * File patterns that often indicate complexity (reference only)
 */
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
// Complexity Suggestion
// ============================================================================

/**
 * Suggest complexity level based on task description and context.
 *
 * IMPORTANT: This is a hint. AI makes the final decision based on
 * actual context and understanding of the task.
 */
export function suggestComplexity(input: ComplexitySuggestionInput): ComplexityHint {
  const factors: string[] = [];
  let score = 3; // Start at standard

  const description = input.taskDescription.toLowerCase();

  // Check for high complexity keywords
  for (const keyword of HIGH_COMPLEXITY_KEYWORDS) {
    if (description.includes(keyword.toLowerCase())) {
      score += 0.5;
      factors.push(`High complexity signal: "${keyword}"`);
    }
  }

  // Check for low complexity keywords
  for (const keyword of LOW_COMPLEXITY_KEYWORDS) {
    if (description.includes(keyword.toLowerCase())) {
      score -= 0.5;
      factors.push(`Low complexity signal: "${keyword}"`);
    }
  }

  // File count factor
  if (input.files) {
    const fileCount = input.files.length;
    if (fileCount === 1) {
      score -= 0.5;
      factors.push('Single file (simpler scope)');
    } else if (fileCount >= 5) {
      score += 1;
      factors.push(`Multiple files (${fileCount}) suggest broader scope`);
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
  const category = levelToCategory(level);
  const suggestedModel = COMPLEXITY_MODEL_REFERENCE[level];

  // Calculate confidence based on number of factors
  // Lower confidence because AI should verify
  const confidence = Math.min(0.7, 0.3 + factors.length * 0.1);

  return {
    isHint: true,
    level,
    category,
    suggestedModel,
    factors,
    confidence,
    reason: generateReason(level, factors),
  };
}

/**
 * Quick complexity suggestion from task name only.
 * Lower confidence due to limited input.
 */
export function quickSuggestComplexity(taskName: string): ComplexityHint {
  const hint = suggestComplexity({ taskDescription: taskName });
  // Lower confidence for quick estimates
  return {
    ...hint,
    confidence: Math.max(0.2, hint.confidence - 0.2),
    reason: `Quick estimate: ${hint.reason}`,
  };
}

/**
 * Batch suggest complexity for multiple tasks
 */
export function batchSuggestComplexity(
  tasks: Array<{ name: string; action: string; files?: string[] }>
): Map<string, ComplexityHint> {
  const results = new Map<string, ComplexityHint>();

  for (const task of tasks) {
    const hint = suggestComplexity({
      taskDescription: `${task.name}: ${task.action}`,
      files: task.files,
    });
    results.set(task.name, hint);
  }

  return results;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert complexity level to category
 */
function levelToCategory(level: ComplexityLevel): ComplexityCategory {
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
 * Generate human-readable reason
 */
function generateReason(level: ComplexityLevel, factors: string[]): string {
  const levelDescriptions: Record<ComplexityLevel, string> = {
    1: 'This appears to be a trivial task',
    2: 'This appears to be a simple task',
    3: 'This appears to be standard complexity',
    4: 'This appears to be a complex task',
    5: 'This appears to be an architectural task',
  };

  const base = levelDescriptions[level];

  if (factors.length === 0) {
    return `${base}. No strong signals detected - use your judgment.`;
  }

  return `${base} based on: ${factors.slice(0, 3).join(', ')}. ` +
    'This is a suggestion - adjust based on your understanding of the task.';
}

// ============================================================================
// Model Suggestion
// ============================================================================

/**
 * Suggest model based on complexity level.
 *
 * IMPORTANT: This is a hint. AI chooses based on actual task needs.
 */
export function suggestModelForComplexity(level: ComplexityLevel): {
  model: ModelTier;
  isHint: true;
  reason: string;
} {
  const model = COMPLEXITY_MODEL_REFERENCE[level];

  const reasons: Record<ModelTier, string> = {
    haiku: 'Fast and efficient for simple tasks',
    sonnet: 'Balanced for standard work',
    opus: 'Deep reasoning for complex tasks',
  };

  return {
    model,
    isHint: true,
    reason: `Suggesting ${model} for complexity level ${level}. ${reasons[model]}`,
  };
}
