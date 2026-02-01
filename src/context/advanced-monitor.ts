/**
 * AdvancedContextMonitor - Enhanced monitoring with auto-compaction detection
 *
 * Extends the base ContextMonitor with additional threshold tracking:
 * - Warning at 70% (prepare handoff)
 * - Auto-compaction at 80% (trigger compaction)
 * - Critical at 85% (force return)
 */

import { randomUUID } from 'crypto';
import { StateManager } from '../state/state-manager.js';
import { StateLocation } from '../state/types.js';
import { emitEvent } from '../state/event-system.js';
import { createContextTracker, type ContextTracker } from './estimator.js';
import {
  detectThreshold,
  getThresholdAction,
  shouldEmitEvent,
  type ThresholdLevel,
  type ThresholdAction,
} from './thresholds.js';
import {
  AUTO_COMPACTION_THRESHOLD,
  type ContextConfig,
} from './types.js';
import { type SubagentContextState } from './monitor.js';

// ============================================================================
// Advanced State Types
// ============================================================================

/**
 * Advanced context state with auto-compaction tracking
 *
 * Extends SubagentContextState with additional compaction-specific fields
 */
export interface AdvancedContextState extends SubagentContextState {
  /** Whether auto-compaction has been triggered this session */
  autoCompactionTriggered: boolean;
  /** Auto-compaction threshold ratio */
  autoCompactionThreshold: number;
}

/**
 * Extended configuration for advanced monitoring
 */
export interface AdvancedContextConfig extends ContextConfig {
  /** Auto-compaction threshold ratio (default: 0.80) */
  autoCompactionThreshold?: number;
}

// ============================================================================
// AdvancedContextMonitor Class
// ============================================================================

/**
 * Advanced context monitor with auto-compaction detection
 *
 * Provides enhanced monitoring capabilities:
 * - Three-threshold system: warning (70%), auto_compact (80%), critical (85%)
 * - Automatic compaction triggering at 80%
 * - Session-level tracking to prevent repeated compaction triggers
 * - Event emission for orchestrator coordination
 */
export class AdvancedContextMonitor {
  private readonly agentId: string;
  private readonly sessionId: string;
  private readonly config: Required<AdvancedContextConfig>;
  private readonly stateManager: StateManager<AdvancedContextState>;
  private readonly tracker: ContextTracker;
  private previousThresholdLevel: ThresholdLevel;
  private tasksCompleted: number;
  private tasksTotal: number;
  private currentTask?: string;
  private autoCompactionTriggered: boolean;

  /**
   * Create a new advanced context monitor
   *
   * @param agentId - Unique identifier for this agent
   * @param config - Optional configuration for limits and thresholds
   */
  constructor(agentId: string, config?: AdvancedContextConfig) {
    this.agentId = agentId;
    this.sessionId = randomUUID();
    this.previousThresholdLevel = 'normal';
    this.tasksCompleted = 0;
    this.tasksTotal = 0;
    this.autoCompactionTriggered = false;

    // Apply default config values
    this.config = {
      contextLimit: config?.contextLimit ?? 200_000,
      warningThreshold: config?.warningThreshold ?? 0.70,
      criticalThreshold: config?.criticalThreshold ?? 0.85,
      autoCompactionThreshold: config?.autoCompactionThreshold ?? AUTO_COMPACTION_THRESHOLD,
    };

    // Create state manager for subagent-specific state
    this.stateManager = new StateManager<AdvancedContextState>(
      `subagents/${agentId}`,
      StateLocation.LOCAL,
    );

    // Create internal context tracker
    this.tracker = createContextTracker(this.sessionId, this.config);
  }

  /**
   * Start monitoring session
   *
   * Initializes state file with active=true and heartbeat
   */
  start(): void {
    const now = new Date().toISOString();
    const initialState = this.tracker.getState();

    const state: AdvancedContextState = {
      agentId: this.agentId,
      sessionId: this.sessionId,
      active: true,
      startedAt: now,
      lastHeartbeat: now,
      cumulativeChars: initialState.cumulativeChars,
      estimatedTokens: initialState.estimatedTokens,
      usageRatio: initialState.usageRatio,
      thresholdStatus: initialState.thresholdStatus,
      tasksCompleted: this.tasksCompleted,
      tasksTotal: this.tasksTotal,
      autoCompactionTriggered: this.autoCompactionTriggered,
      autoCompactionThreshold: this.config.autoCompactionThreshold,
    };

    if (this.currentTask) {
      state.currentTask = this.currentTask;
    }

    this.stateManager.write(state);
  }

  /**
   * Check if auto-compaction should be triggered
   *
   * Returns true if usage is at or above 80% and compaction
   * has not yet been triggered this session.
   *
   * @returns Whether auto-compaction should be triggered
   */
  checkAutoCompaction(): boolean {
    if (this.autoCompactionTriggered) {
      return false;
    }

    const usage = this.tracker.getUsage();
    return usage.usageRatio >= this.config.autoCompactionThreshold;
  }

  /**
   * Trigger auto-compaction
   *
   * Marks compaction as triggered for this session and emits
   * the context_auto_compaction_triggered event.
   */
  triggerAutoCompaction(): void {
    if (this.autoCompactionTriggered) {
      return; // Already triggered this session
    }

    this.autoCompactionTriggered = true;
    const usage = this.tracker.getUsage();

    // Emit auto-compaction event
    emitEvent({
      type: 'context_auto_compaction_triggered',
      payload: {
        agentId: this.agentId,
        sessionId: this.sessionId,
        usageRatio: usage.usageRatio,
        threshold: this.config.autoCompactionThreshold,
        estimatedTokens: usage.totalTokens,
      },
      source: `agent:${this.agentId}`,
    });

    // Update state file
    this.updateStateFile();
  }

  /**
   * Track content and update state
   *
   * Adds content to cumulative tracking, updates state file,
   * and emits events on threshold changes. Also checks for
   * auto-compaction threshold.
   *
   * @param text - Content to track
   * @returns Threshold action for current level
   */
  trackContent(text: string): ThresholdAction {
    // Add to internal tracker
    this.tracker.trackContent(text);

    // Get current state from tracker
    const trackerState = this.tracker.getState();
    const currentLevel = detectThreshold(trackerState.usageRatio, this.config);

    // Check for auto-compaction threshold (between warning and critical)
    if (this.checkAutoCompaction()) {
      this.triggerAutoCompaction();

      return {
        level: 'auto_compact',
        action: 'auto_compact',
        message: 'Context at 80% - triggering auto-compaction',
      };
    }

    const baseAction = getThresholdAction(currentLevel);

    // Emit event if threshold changed
    if (shouldEmitEvent(this.previousThresholdLevel, currentLevel)) {
      emitEvent({
        type: 'context_threshold_reached',
        payload: {
          agentId: this.agentId,
          level: currentLevel,
          usageRatio: trackerState.usageRatio,
          action: baseAction.action,
        },
        source: `agent:${this.agentId}`,
      });
    }

    // Update previous level
    this.previousThresholdLevel = currentLevel;

    // Update state file
    this.updateStateFile();

    return {
      level: baseAction.level,
      action: baseAction.action,
      message: baseAction.message,
    };
  }

  /**
   * Update heartbeat timestamp
   *
   * Refreshes the lastHeartbeat field to indicate agent is still active
   */
  updateHeartbeat(): void {
    this.updateStateFile();
  }

  /**
   * Set current task description
   *
   * @param task - Description of current task
   */
  setCurrentTask(task: string): void {
    this.currentTask = task;
    this.updateStateFile();
  }

  /**
   * Mark a task as completed
   *
   * Increments tasksCompleted counter
   */
  completeTask(): void {
    this.tasksCompleted++;
    this.updateStateFile();
  }

  /**
   * Get current advanced context state
   *
   * @returns Current advanced subagent context state
   */
  getAdvancedState(): AdvancedContextState {
    const trackerState = this.tracker.getState();
    const now = new Date().toISOString();

    const state: AdvancedContextState = {
      agentId: this.agentId,
      sessionId: this.sessionId,
      active: true,
      startedAt: this.stateManager.read().data?.startedAt ?? now,
      lastHeartbeat: now,
      cumulativeChars: trackerState.cumulativeChars,
      estimatedTokens: trackerState.estimatedTokens,
      usageRatio: trackerState.usageRatio,
      thresholdStatus: trackerState.thresholdStatus,
      tasksCompleted: this.tasksCompleted,
      tasksTotal: this.tasksTotal,
      autoCompactionTriggered: this.autoCompactionTriggered,
      autoCompactionThreshold: this.config.autoCompactionThreshold,
    };

    if (this.currentTask) {
      state.currentTask = this.currentTask;
    }

    return state;
  }

  /**
   * Get current context state (compatibility with base monitor)
   *
   * @returns Current subagent context state
   */
  getState(): SubagentContextState {
    return this.getAdvancedState();
  }

  /**
   * Get threshold action for current usage level
   *
   * Includes auto-compaction check in the action determination.
   *
   * @returns Threshold action recommendation
   */
  getThresholdAction(): ThresholdAction {
    const usage = this.tracker.getUsage();

    // Check auto-compaction first (80%)
    if (this.checkAutoCompaction()) {
      return {
        level: 'auto_compact',
        action: 'auto_compact',
        message: 'Context at 80% - auto-compaction available',
      };
    }

    const level = detectThreshold(usage.usageRatio, this.config);
    const baseAction = getThresholdAction(level);

    return {
      level: baseAction.level,
      action: baseAction.action,
      message: baseAction.message,
    };
  }

  /**
   * Reset auto-compaction trigger flag
   *
   * Called after successful compaction to allow future triggers
   * if usage climbs back to 80%.
   */
  resetAutoCompactionTrigger(): void {
    this.autoCompactionTriggered = false;
    this.updateStateFile();
  }

  /**
   * Check if auto-compaction has been triggered this session
   *
   * @returns Whether compaction has been triggered
   */
  isAutoCompactionTriggered(): boolean {
    return this.autoCompactionTriggered;
  }

  /**
   * Stop monitoring session
   *
   * Sets active=false in state file
   */
  stop(): void {
    const state = this.getAdvancedState();
    state.active = false;
    this.stateManager.write(state);
  }

  /**
   * Update state file with current data
   *
   * @private
   */
  private updateStateFile(): void {
    const state = this.getAdvancedState();
    this.stateManager.write(state);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an advanced context monitor for a subagent
 *
 * @param agentId - Unique identifier for the agent
 * @param config - Optional configuration for limits and thresholds
 * @returns Advanced context monitor instance
 */
export function createAdvancedMonitor(
  agentId: string,
  config?: AdvancedContextConfig,
): AdvancedContextMonitor {
  return new AdvancedContextMonitor(agentId, config);
}
