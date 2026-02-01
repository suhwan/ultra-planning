/**
 * Wisdom Extractor - Analyzes agent output text for extractable wisdom
 *
 * Extracts learnings, decisions, issues, and patterns from agent output.
 * Uses conservative extraction patterns - false negatives are preferred
 * over false positives.
 */

// ============================================================================
// Types
// ============================================================================

/** Result of wisdom extraction from text */
export interface WisdomExtraction {
  /** Technical discoveries and patterns learned */
  learnings: string[];
  /** Architectural and design decisions made */
  decisions: string[];
  /** Known issues and workarounds discovered */
  issues: string[];
  /** Code references and recognized patterns */
  patterns: string[];
  /** Confidence score 0-1, higher = more confident extraction */
  confidence: number;
}

// ============================================================================
// Extraction Patterns
// ============================================================================

/** Patterns that indicate a learning or discovery */
const LEARNING_MARKERS: RegExp[] = [
  /(?:learned|discovered|found out|realized|noticed)[:.]?\s*(.+)/gi,
  /(?:pattern|approach|technique)[:.]?\s*(.+)/gi,
  /(?:tip|trick|gotcha|note)[:.]?\s*(.+)/gi,
];

/** Patterns that indicate a decision was made */
const DECISION_MARKERS: RegExp[] = [
  /(?:decided|chose|selected|picked)[:.]?\s*(.+)/gi,
  /(?:using|will use|went with)[:.]?\s*(.+)/gi,
  /(?:because|since|rationale)[:.]?\s*(.+)/gi,
];

/** Patterns that indicate an issue or problem */
const ISSUE_MARKERS: RegExp[] = [
  /(?:issue|problem|bug|error|failed|broken)[:.]?\s*(.+)/gi,
  /(?:workaround|fix|solution)[:.]?\s*(.+)/gi,
  /(?:warning|caution|careful)[:.]?\s*(.+)/gi,
];

/** Patterns for code references and recognized patterns */
const PATTERN_MARKERS: RegExp[] = [
  /(?:file|path)[:.]?\s*`([^`]+)`/g, // Code references like `src/foo.ts:10-20`
  /(?:pattern found|see also|reference)[:.]?\s*(.+)/gi,
];

// ============================================================================
// Extraction Functions
// ============================================================================

/**
 * Extract matches from text using multiple regex patterns
 *
 * @param text - Text to search for matches
 * @param patterns - Array of regex patterns with capture groups
 * @returns Array of unique matched strings (deduplicated)
 */
function extractMatches(text: string, patterns: RegExp[]): string[] {
  const matches: string[] = [];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    // Create fresh regex instance to reset lastIndex
    const regex = new RegExp(pattern.source, pattern.flags);

    while ((match = regex.exec(text)) !== null) {
      const content = match[1]?.trim();
      // Filter by reasonable length: not too short (noise), not too long (paragraphs)
      if (content && content.length > 10 && content.length < 500) {
        matches.push(content);
      }
    }
  }

  // Deduplicate using Set
  return [...new Set(matches)];
}

/**
 * Extract wisdom from agent output text
 *
 * Analyzes text for learnings, decisions, issues, and patterns using
 * conservative pattern matching. Prioritizes precision over recall.
 *
 * @param text - Agent output text to analyze
 * @returns WisdomExtraction with categorized findings and confidence score
 *
 * @example
 * ```typescript
 * const output = "Discovered that the API requires auth headers. Using JWT tokens.";
 * const wisdom = extractWisdom(output);
 * // { learnings: ["that the API requires auth headers"], decisions: ["JWT tokens"], ... }
 * ```
 */
export function extractWisdom(text: string): WisdomExtraction {
  const result: WisdomExtraction = {
    learnings: [],
    decisions: [],
    issues: [],
    patterns: [],
    confidence: 0,
  };

  // Extract each category using pattern matching
  result.learnings = extractMatches(text, LEARNING_MARKERS);
  result.decisions = extractMatches(text, DECISION_MARKERS);
  result.issues = extractMatches(text, ISSUE_MARKERS);
  result.patterns = extractMatches(text, PATTERN_MARKERS);

  // Calculate confidence based on total extraction count
  // More extractions = higher confidence (capped at 1.0)
  const total =
    result.learnings.length +
    result.decisions.length +
    result.issues.length +
    result.patterns.length;
  result.confidence = Math.min(total / 10, 1);

  return result;
}
