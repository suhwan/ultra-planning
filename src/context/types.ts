/**
 * Context Monitoring Types
 *
 * Type definitions for token estimation, cumulative context tracking,
 * and threshold management. Enables subagents to monitor their own
 * context window usage.
 */

// ============================================================================
// Constants
// ============================================================================

/** Standard approximation: 1 token ≈ 4 characters */
export const CHARS_PER_TOKEN = 4;

/** Claude default context window limit (200K tokens) */
export const CLAUDE_DEFAULT_CONTEXT_LIMIT = 200_000;

/** Warning threshold - prepare handoff at 70% */
export const WARNING_THRESHOLD = 0.70;

/** Critical threshold - force return at 85% */
export const CRITICAL_THRESHOLD = 0.85;

// ============================================================================
// Configuration Types
// ============================================================================

/** Configuration for context monitoring */
export interface ContextConfig {
  /** Maximum context limit in tokens (default: 200K, can be 1M) */
  contextLimit?: number;
  /** Warning threshold ratio (default: 0.70) */
  warningThreshold?: number;
  /** Critical threshold ratio (default: 0.85) */
  criticalThreshold?: number;
}

// ============================================================================
// State Types
// ============================================================================

/** Threshold status categories */
export type ThresholdStatus = 'normal' | 'warning' | 'critical';

/** Action to take based on threshold status */
export type ContextAction = 'none' | 'prepare_handoff' | 'force_return';

/** Context state for file persistence */
export interface ContextState {
  /** Unique session identifier for this subagent */
  sessionId: string;
  /** Total characters tracked across all content */
  cumulativeChars: number;
  /** Estimated token count (chars / 4) */
  estimatedTokens: number;
  /** Usage ratio (tokens / limit) */
  usageRatio: number;
  /** Current threshold status */
  thresholdStatus: ThresholdStatus;
  /** ISO 8601 timestamp of last update */
  lastUpdated: string;
}

// ============================================================================
// Result Types
// ============================================================================

/** Result of analyzing context usage */
export interface ContextUsageResult {
  /** Total estimated tokens consumed */
  totalTokens: number;
  /** Usage ratio (0.0 to 1.0+) */
  usageRatio: number;
  /** Whether warning threshold exceeded */
  isWarning: boolean;
  /** Whether critical threshold exceeded */
  isCritical: boolean;
  /** Recommended action based on thresholds */
  action: ContextAction;
}
