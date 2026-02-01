/**
 * Context Window Monitor Hook
 *
 * Tracks token usage per session and emits warnings at configurable thresholds.
 * Integrates with existing ContextMonitor infrastructure for tracking and
 * threshold detection.
 *
 * Events:
 * - tool.execute.after: Checks context usage after each tool execution
 * - event: Handles session cleanup on session.deleted
 *
 * Thresholds:
 * - Warning (70%): Prepare for handoff
 * - Critical (85%): Force return
 * - Auto-compaction (80%): Trigger compaction
 *
 * @module hooks/core/context-window-monitor-hook
 */

import { SYSTEM_DIRECTIVE_PREFIX } from '../orchestrator/types.js';
import { ExtendedSystemDirectiveTypes } from '../types.js';
import type { HookContext, HookHandlers, ToolExecuteAfterInput, EventInput } from '../types.js';
import { emitEvent } from '../../state/event-system.js';
import { createContextTracker, type ContextTracker } from '../../context/estimator.js';
import {
  detectThreshold,
  getThresholdAction,
  shouldEmitEvent,
  type ThresholdLevel,
} from '../../context/thresholds.js';
import {
  CLAUDE_DEFAULT_CONTEXT_LIMIT,
  WARNING_THRESHOLD,
  CRITICAL_THRESHOLD,
  AUTO_COMPACTION_THRESHOLD,
} from '../../context/types.js';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Options for the context window monitor hook.
 */
export interface ContextWindowMonitorOptions {
  /** Maximum context limit in tokens (default: 200,000) */
  contextLimit?: number;
  /** Warning threshold ratio (default: 0.70) */
  warningThreshold?: number;
  /** Critical threshold ratio (default: 0.85) */
  criticalThreshold?: number;
  /** Auto-compaction threshold ratio (default: 0.80) */
  autoCompactionThreshold?: number;
}

// ============================================================================
// Session State
// ============================================================================

/**
 * Per-session monitoring state.
 */
interface SessionMonitorState {
  /** Has warning threshold been triggered? */
  warned: boolean;
  /** Has critical threshold been triggered? */
  critical: boolean;
  /** Last known token count */
  lastTokenCount: number;
  /** Previous threshold level for change detection */
  previousLevel: ThresholdLevel;
  /** Context tracker for this session */
  tracker: ContextTracker;
}

// ============================================================================
// Warning Messages
// ============================================================================

/**
 * Create directive string for context window monitor messages.
 */
function createContextMonitorDirective(): string {
  return `${SYSTEM_DIRECTIVE_PREFIX} - ${ExtendedSystemDirectiveTypes.CONTEXT_WINDOW_MONITOR}]`;
}

/**
 * Format warning message for the 70% threshold.
 */
function formatWarningMessage(usage: { ratio: number; tokens: number; limit: number }): string {
  const usedPct = (usage.ratio * 100).toFixed(1);
  const usedTokens = usage.tokens.toLocaleString();
  const limitTokens = usage.limit.toLocaleString();

  return `${createContextMonitorDirective()}

Context window usage is high. Consider:
- Completing current task before starting new ones
- Preparing checkpoint for handoff if needed
- Avoiding large file reads unless necessary

[Context Status: ${usedPct}% used (${usedTokens}/${limitTokens} tokens)]`;
}

/**
 * Format critical message for the 85% threshold.
 */
function formatCriticalMessage(usage: { ratio: number; tokens: number; limit: number }): string {
  const usedPct = (usage.ratio * 100).toFixed(1);

  return `${createContextMonitorDirective()}

CRITICAL: Context window nearly full. You should:
- Complete current task immediately
- Create checkpoint for next agent
- Do NOT start new tasks

[Context Status: ${usedPct}% used - HANDOFF RECOMMENDED]`;
}

// ============================================================================
// Hook Factory
// ============================================================================

/**
 * Create a context window monitor hook.
 *
 * Tracks token usage per session and emits warnings at configurable thresholds.
 * Integrates with existing ContextMonitor infrastructure.
 *
 * @param ctx - Hook context with session info and state manager
 * @param options - Optional configuration for thresholds
 * @returns Hook handlers for tool.execute.after and event
 *
 * @example
 * const hook = createContextWindowMonitorHook(ctx, {
 *   warningThreshold: 0.65,  // Warn earlier at 65%
 *   criticalThreshold: 0.80, // Critical at 80%
 * });
 */
export function createContextWindowMonitorHook(
  ctx: HookContext,
  options: ContextWindowMonitorOptions = {},
): HookHandlers {
  // Apply defaults
  const config = {
    contextLimit: options.contextLimit ?? CLAUDE_DEFAULT_CONTEXT_LIMIT,
    warningThreshold: options.warningThreshold ?? WARNING_THRESHOLD,
    criticalThreshold: options.criticalThreshold ?? CRITICAL_THRESHOLD,
    autoCompactionThreshold: options.autoCompactionThreshold ?? AUTO_COMPACTION_THRESHOLD,
  };

  // Session state storage
  const sessionStates = new Map<string, SessionMonitorState>();

  /**
   * Get or create session state.
   */
  function getState(sessionId: string): SessionMonitorState {
    let state = sessionStates.get(sessionId);
    if (!state) {
      state = {
        warned: false,
        critical: false,
        lastTokenCount: 0,
        previousLevel: 'normal',
        tracker: createContextTracker(sessionId, config),
      };
      sessionStates.set(sessionId, state);
    }
    return state;
  }

  /**
   * Emit threshold event to the event system.
   */
  function emitThresholdEvent(
    level: 'warning' | 'critical',
    sessionId: string,
    usage: { ratio: number; tokens: number },
  ): void {
    emitEvent({
      type: 'context_threshold_hook',
      payload: {
        level,
        sessionId,
        usageRatio: usage.ratio,
        tokens: usage.tokens,
      },
      source: 'hook:context-window-monitor',
    });
  }

  /**
   * Handler for tool.execute.after - check context usage after each tool execution.
   */
  const toolExecuteAfter = async (input: ToolExecuteAfterInput): Promise<{ inject?: string } | void> => {
    const { sessionId, result } = input;
    const state = getState(sessionId);

    // Track the result content if it's a string
    if (typeof result === 'string') {
      state.tracker.trackContent(result);
    } else if (result && typeof result === 'object' && 'output' in result) {
      const output = (result as { output?: unknown }).output;
      if (typeof output === 'string') {
        state.tracker.trackContent(output);
      }
    }

    // Get current usage
    const usage = state.tracker.getUsage();
    const currentLevel = detectThreshold(usage.usageRatio, config);
    const usageInfo = {
      ratio: usage.usageRatio,
      tokens: usage.totalTokens,
      limit: config.contextLimit,
    };

    // Update last token count
    state.lastTokenCount = usage.totalTokens;

    // Check for threshold level changes and emit events
    if (shouldEmitEvent(state.previousLevel, currentLevel)) {
      if (currentLevel === 'critical' || currentLevel === 'warning') {
        emitThresholdEvent(
          currentLevel === 'critical' ? 'critical' : 'warning',
          sessionId,
          { ratio: usage.usageRatio, tokens: usage.totalTokens },
        );
      }
    }

    // Check thresholds and inject warnings (only once per threshold)
    let inject: string | undefined;

    if (usage.usageRatio >= config.criticalThreshold && !state.critical) {
      state.critical = true;
      state.warned = true; // Also mark warned since critical > warning
      inject = formatCriticalMessage(usageInfo);
    } else if (usage.usageRatio >= config.warningThreshold && !state.warned) {
      state.warned = true;
      inject = formatWarningMessage(usageInfo);
    }

    // Update previous level
    state.previousLevel = currentLevel;

    if (inject) {
      return { inject };
    }
  };

  /**
   * Handler for generic events - clean up session state on deletion.
   */
  const eventHandler = async (input: EventInput): Promise<void> => {
    const { event } = input;

    if (event.type === 'session_deleted') {
      // Clean up session state
      const payload = event.payload as Record<string, unknown> | undefined;
      const sessionInfo = payload?.info as { id?: string } | undefined;
      const sessionId = sessionInfo?.id ?? input.sessionId;

      if (sessionId) {
        sessionStates.delete(sessionId);
      }
    }
  };

  return {
    'tool.execute.after': toolExecuteAfter,
    event: eventHandler,
  };
}
