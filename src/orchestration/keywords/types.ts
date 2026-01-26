/**
 * Magic keyword configuration
 */
export interface MagicKeyword {
  /** Trigger words that activate this keyword */
  triggers: string[];
  /** Human-readable description */
  description: string;
  /** Action to perform when keyword detected - returns enhanced prompt */
  action: (prompt: string) => string;
}

/**
 * Configuration for keyword processor
 */
export interface KeywordConfig {
  /** Custom keyword overrides (trigger -> new triggers) */
  overrides?: Record<string, string[]>;
  /** Additional custom keywords */
  custom?: MagicKeyword[];
}

/**
 * Result of keyword detection
 */
export interface KeywordDetectionResult {
  /** Keywords that were detected */
  detected: string[];
  /** Original prompt text */
  originalPrompt: string;
  /** Prompt with code blocks removed (used for detection) */
  cleanedPrompt: string;
  /** Whether any keywords were found */
  hasKeywords: boolean;
}
