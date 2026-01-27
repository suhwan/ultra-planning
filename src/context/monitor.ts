/**
 * ContextMonitor - Integrated tracking with state persistence
 *
 * Combines context tracking, threshold detection, and file-based
 * state persistence for subagent context monitoring.
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
import type { ContextConfig } from './types.js';

// ============================================================================
// Subagent State Types
// ============================================================================

/**
 * Subagent context state for file persistence
 *
 * Extends Record<string, unknown> to satisfy StateManager constraint
 */
export interface SubagentContextState extends Record<string, unknown> {
  /** Unique agent identifier */
  agentId: string;
  /** Unique session identifier */
  sessionId: string;
  /** Whether agent is currently active */
  active: boolean;
  /** When agent session started (ISO 8601) */
  startedAt: string;
  /** Last heartbeat timestamp (ISO 8601) */
  lastHeartbeat: string;
  /** Cumulative characters tracked */
  cumulativeChars: number;
  /** Estimated token count */
  estimatedTokens: number;
  /** Current usage ratio */
  usageRatio: number;
  /** Current threshold status */
  thresholdStatus: ThresholdLevel;
  /** Current task description */
  currentTask?: string;
  /** Number of tasks completed */
  tasksCompleted: number;
  /** Total number of tasks */
  tasksTotal: number;
}

// ============================================================================
// ContextMonitor Class
// ============================================================================

/**
 * Context monitor with integrated tracking and state persistence
 *
 * Provides a unified interface for subagents to:
 * - Track cumulative context usage
 * - Detect threshold crossings
 * - Persist state to file for orchestrator polling
 * - Emit events on threshold changes
 */
export class ContextMonitor {
  private readonly agentId: string;
  private readonly sessionId: string;
  private readonly config: Required<ContextConfig>;
  private readonly stateManager: StateManager<SubagentContextState>;
  private readonly tracker: ContextTracker;
  private previousThresholdLevel: ThresholdLevel;
  private tasksCompleted: number;
  private tasksTotal: number;
  private currentTask?: string;

  /**
   * Create a new context monitor
   *
   * @param agentId - Unique identifier for this agent
   * @param config - Optional configuration for limits and thresholds
   */
  constructor(agentId: string, config?: ContextConfig) {
    this.agentId = agentId;
    this.sessionId = randomUUID();
    this.previousThresholdLevel = 'normal';
    this.tasksCompleted = 0;
    this.tasksTotal = 0;

    // Apply default config values
    this.config = {
      contextLimit: config?.contextLimit ?? 200_000,
      warningThreshold: config?.warningThreshold ?? 0.70,
      criticalThreshold: config?.criticalThreshold ?? 0.85,
    };

    // Create state manager for subagent-specific state
    this.stateManager = new StateManager<SubagentContextState>(
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

    const state: SubagentContextState = {
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
    };

    if (this.currentTask) {
      state.currentTask = this.currentTask;
    }

    this.stateManager.write(state);
  }

  /**
   * Track content and update state
   *
   * Adds content to cumulative tracking, updates state file,
   * and emits events on threshold changes.
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
    const action = getThresholdAction(currentLevel);

    // Emit event if threshold changed
    if (shouldEmitEvent(this.previousThresholdLevel, currentLevel)) {
      emitEvent({
        type: 'context_threshold_reached',
        payload: {
          agentId: this.agentId,
          level: currentLevel,
          usageRatio: trackerState.usageRatio,
          action: action.action,
        },
        source: `agent:${this.agentId}`,
      });
    }

    // Update previous level
    this.previousThresholdLevel = currentLevel;

    // Update state file
    this.updateStateFile();

    return action;
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
   * Get current context state
   *
   * @returns Current subagent context state
   */
  getState(): SubagentContextState {
    const trackerState = this.tracker.getState();
    const now = new Date().toISOString();

    const state: SubagentContextState = {
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
    };

    if (this.currentTask) {
      state.currentTask = this.currentTask;
    }

    return state;
  }

  /**
   * Get threshold action for current usage level
   *
   * @returns Threshold action recommendation
   */
  getThresholdAction(): ThresholdAction {
    const usage = this.tracker.getUsage();
    const level = detectThreshold(usage.usageRatio, this.config);
    return getThresholdAction(level);
  }

  /**
   * Stop monitoring session
   *
   * Sets active=false in state file
   */
  stop(): void {
    const state = this.getState();
    state.active = false;
    this.stateManager.write(state);
  }

  /**
   * Update state file with current data
   *
   * @private
   */
  private updateStateFile(): void {
    const state = this.getState();
    this.stateManager.write(state);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a context monitor for a subagent
 *
 * @param agentId - Unique identifier for the agent
 * @param config - Optional configuration for limits and thresholds
 * @returns Context monitor instance
 */
export function createContextMonitor(
  agentId: string,
  config?: ContextConfig,
): ContextMonitor {
  return new ContextMonitor(agentId, config);
}
