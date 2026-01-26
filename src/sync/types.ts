/**
 * Sync Module Types
 *
 * Types for Claude Tasks synchronization - mapping PLAN.md tasks to Task tool parameters.
 * Enables bidirectional sync between planning documents and Claude execution state.
 */

import type { TaskType } from '../documents/xml/types.js';

// ============================================================================
// Task Execution State
// ============================================================================

/**
 * Task execution status values
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * Task execution state tracking
 */
export interface TaskState {
  /** Current execution status */
  status: TaskStatus;

  /** ISO timestamp when task execution started */
  started_at?: string;

  /** ISO timestamp when task execution completed */
  completed_at?: string;

  /** Agent/session ID for resumption support */
  agent_id?: string;

  /** Error message if task failed */
  error?: string;
}

// ============================================================================
// Claude Task Tool Parameters
// ============================================================================

/**
 * Model options for Claude Task tool
 */
export type TaskModel = 'sonnet' | 'opus' | 'haiku';

/**
 * Parameters for invoking Claude Task tool
 *
 * These map directly to Task tool invocation parameters.
 * See: Claude Code Task tool documentation
 */
export interface TaskToolParams {
  /** Brief task description (3-5 words, max 50 chars) */
  description: string;

  /** Full task instructions including action, verification, done criteria */
  prompt: string;

  /** Subagent type for execution (default: 'oh-my-claudecode:executor') */
  subagent_type: string;

  /** Model to use for execution */
  model?: TaskModel;
}

// ============================================================================
// Task Mapping
// ============================================================================

/**
 * Maps a PLAN.md task to Claude Task tool invocation
 *
 * Provides the bridge between planning documents and execution:
 * - task_id: Deterministic identifier for state tracking
 * - tool_params: Ready-to-use Task tool parameters
 * - status: Current execution state
 */
export interface TaskMapping {
  /** Deterministic task ID format: {phase}-{plan:02d}-{taskIndex:02d} */
  task_id: string;

  /** Path to source PLAN.md file */
  plan_path: string;

  /** Task name from PLAN.md */
  name: string;

  /** Task type (auto, checkpoint:*) */
  type: TaskType;

  /** Claude Task tool invocation parameters */
  tool_params: TaskToolParams;

  /** Current execution state */
  status: TaskState['status'];

  /** Wave number from plan frontmatter (for parallel execution) */
  wave: number;
}

// ============================================================================
// Sync Configuration
// ============================================================================

/**
 * Configuration for sync behavior
 */
export interface SyncConfig {
  /** Default model for task execution */
  default_model: TaskModel;

  /** Default subagent type for execution */
  default_subagent: string;

  /** Whether to update task checkboxes in PLAN.md */
  update_checkboxes: boolean;

  /** Whether to track task status in plan frontmatter */
  track_in_frontmatter: boolean;
}

/**
 * Default sync configuration values
 */
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  default_model: 'sonnet',
  default_subagent: 'oh-my-claudecode:executor',
  update_checkboxes: true,
  track_in_frontmatter: false,
};

// ============================================================================
// Plan Sync Data
// ============================================================================

/**
 * Parsed plan data for sync operations
 */
export interface PlanSyncData {
  /** Plan frontmatter */
  frontmatter: {
    phase: string;
    plan: number;
    wave: number;
    [key: string]: unknown;
  };

  /** Parsed tasks from the plan */
  tasks: import('../documents/xml/types.js').Task[];

  /** Path to the PLAN.md file */
  path: string;
}
