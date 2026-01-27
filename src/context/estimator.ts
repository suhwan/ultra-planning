/**
 * Token Estimation and Context Tracking
 *
 * Implementation of token estimation using text.length / 4 pattern
 * and cumulative context tracking for subagent sessions.
 */

import {
  CHARS_PER_TOKEN,
  CLAUDE_DEFAULT_CONTEXT_LIMIT,
  WARNING_THRESHOLD,
  CRITICAL_THRESHOLD,
  type ContextConfig,
  type ContextState,
  type ContextUsageResult,
  type ThresholdStatus,
  type ContextAction,
} from './types.js';

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Estimate token count from text length using 1 token ≈ 4 chars approximation.
 *
 * @param text - Text content to estimate
 * @returns Estimated token count (rounded up)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Get the applicable context limit based on environment settings.
 *
 * @returns Context limit in tokens (1M if ANTHROPIC_1M_CONTEXT set, otherwise 200K)
 */
export function getContextLimit(): number {
  return process.env.ANTHROPIC_1M_CONTEXT
    ? 1_000_000
    : CLAUDE_DEFAULT_CONTEXT_LIMIT;
}

// ============================================================================
// Usage Analysis
// ============================================================================

/**
 * Analyze cumulative context usage against thresholds.
 *
 * @param cumulativeChars - Total characters tracked
 * @param config - Optional configuration for limits and thresholds
 * @returns Usage analysis with threshold status and recommended action
 */
export function analyzeContextUsage(
  cumulativeChars: number,
  config?: ContextConfig,
): ContextUsageResult {
  const limit = config?.contextLimit ?? getContextLimit();
  const warningThreshold = config?.warningThreshold ?? WARNING_THRESHOLD;
  const criticalThreshold = config?.criticalThreshold ?? CRITICAL_THRESHOLD;

  const totalTokens = Math.ceil(cumulativeChars / CHARS_PER_TOKEN);
  const usageRatio = totalTokens / limit;

  const isCritical = usageRatio >= criticalThreshold;
  const isWarning = usageRatio >= warningThreshold;

  let action: ContextAction = 'none';
  if (isCritical) {
    action = 'force_return';
  } else if (isWarning) {
    action = 'prepare_handoff';
  }

  return {
    totalTokens,
    usageRatio,
    isWarning,
    isCritical,
    action,
  };
}

// ============================================================================
// Context Tracker
// ============================================================================

/**
 * Tracker for cumulative context monitoring across tool calls.
 */
export interface ContextTracker {
  /** Add content to cumulative tracking */
  trackContent(text: string): void;
  /** Get current context state for persistence */
  getState(): ContextState;
  /** Analyze current usage against thresholds */
  getUsage(): ContextUsageResult;
  /** Reset cumulative tracking */
  reset(): void;
}

/**
 * Create a context tracker for a subagent session.
 *
 * @param sessionId - Unique identifier for this subagent session
 * @param config - Optional configuration for limits and thresholds
 * @returns Context tracker instance
 */
export function createContextTracker(
  sessionId: string,
  config?: ContextConfig,
): ContextTracker {
  let cumulativeChars = 0;

  const tracker: ContextTracker = {
    trackContent(text: string): void {
      cumulativeChars += text.length;
    },

    getState(): ContextState {
      const usage = analyzeContextUsage(cumulativeChars, config);

      let thresholdStatus: ThresholdStatus = 'normal';
      if (usage.isCritical) {
        thresholdStatus = 'critical';
      } else if (usage.isWarning) {
        thresholdStatus = 'warning';
      }

      return {
        sessionId,
        cumulativeChars,
        estimatedTokens: usage.totalTokens,
        usageRatio: usage.usageRatio,
        thresholdStatus,
        lastUpdated: new Date().toISOString(),
      };
    },

    getUsage(): ContextUsageResult {
      return analyzeContextUsage(cumulativeChars, config);
    },

    reset(): void {
      cumulativeChars = 0;
    },
  };

  return tracker;
}
