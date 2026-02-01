/**
 * Threshold Detection and Action Determination
 *
 * Pure functions for detecting threshold levels and determining
 * appropriate actions based on context usage ratios.
 */

import {
  WARNING_THRESHOLD,
  CRITICAL_THRESHOLD,
  AUTO_COMPACTION_THRESHOLD,
  type ContextConfig,
} from './types.js';

// ============================================================================
// Threshold Types
// ============================================================================

/** Threshold level classification */
export type ThresholdLevel = 'normal' | 'warning' | 'auto_compact' | 'critical';

/** Action to take based on threshold level */
export interface ThresholdAction {
  /** Current threshold level */
  level: ThresholdLevel;
  /** Recommended action */
  action: 'none' | 'prepare_handoff' | 'auto_compact' | 'force_return';
  /** Human-readable explanation */
  message: string;
}

// ============================================================================
// Threshold Detection
// ============================================================================

/**
 * Detect threshold level based on usage ratio
 *
 * @param usageRatio - Current usage ratio (0.0 to 1.0+)
 * @param config - Optional configuration for threshold values
 * @returns Threshold level classification
 */
export function detectThreshold(
  usageRatio: number,
  config?: ContextConfig,
): ThresholdLevel {
  const criticalThreshold = config?.criticalThreshold ?? CRITICAL_THRESHOLD;
  const autoCompactionThreshold = config?.autoCompactionThreshold ?? AUTO_COMPACTION_THRESHOLD;
  const warningThreshold = config?.warningThreshold ?? WARNING_THRESHOLD;

  if (usageRatio >= criticalThreshold) {
    return 'critical';
  } else if (usageRatio >= autoCompactionThreshold) {
    return 'auto_compact';
  } else if (usageRatio >= warningThreshold) {
    return 'warning';
  } else {
    return 'normal';
  }
}

/**
 * Get threshold action for a given level
 *
 * @param level - Threshold level
 * @returns Action specification with message
 */
export function getThresholdAction(level: ThresholdLevel): ThresholdAction {
  switch (level) {
    case 'critical':
      return {
        level: 'critical',
        action: 'force_return',
        message: 'Context critical (85%+) - initiating checkpoint return',
      };
    case 'auto_compact':
      return {
        level: 'auto_compact',
        action: 'auto_compact',
        message: 'Context at 80% - triggering auto-compaction',
      };
    case 'warning':
      return {
        level: 'warning',
        action: 'prepare_handoff',
        message: 'Context warning (70%+) - complete current task, prepare clean handoff',
      };
    case 'normal':
      return {
        level: 'normal',
        action: 'none',
        message: 'Context normal',
      };
  }
}

/**
 * Determine if a threshold level change should trigger an event
 *
 * Prevents duplicate events when threshold remains at the same level.
 *
 * @param previousLevel - Previous threshold level
 * @param currentLevel - Current threshold level
 * @returns Whether to emit an event
 */
export function shouldEmitEvent(
  previousLevel: ThresholdLevel,
  currentLevel: ThresholdLevel,
): boolean {
  return previousLevel !== currentLevel;
}
