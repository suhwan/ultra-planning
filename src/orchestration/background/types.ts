/**
 * Background Manager Types
 *
 * Type definitions for background task management with model-based concurrency control,
 * task queuing, stability detection, and parent session notifications.
 *
 * @module orchestration/background
 */

import type { ModelTier } from '../../complexity/types.js';
import { MODEL_CONCURRENT_LIMITS } from '../ecomode/types.js';

// ============================================================================
// Task Status
// ============================================================================

/**
 * Background task lifecycle status.
 *
 * Flow: pending -> running -> completed | error | cancelled
 */
export type BackgroundTaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'error'
  | 'cancelled';

// ============================================================================
// Progress Tracking
// ============================================================================

/**
 * Task progress information for monitoring and stability detection.
 */
export interface TaskProgress {
  /** Number of tool calls made by the task */
  toolCalls: number;
  /** Name of the last tool used */
  lastTool?: string;
  /** Timestamp of last update */
  lastUpdate: Date;
  /** Last message content (for debugging) */
  lastMessage?: string;
  /** Timestamp of last message */
  lastMessageAt?: Date;
}

// ============================================================================
// Background Task
// ============================================================================

/**
 * Background task definition.
 *
 * Represents a task running in a child session with tracking for
 * parent notification and stability-based completion detection.
 */
export interface BackgroundTask {
  /** Unique task identifier (UUID) */
  id: string;
  /** Child session ID (set when task starts) */
  sessionId?: string;
  /** Parent session that launched this task */
  parentSessionId: string;
  /** Message ID in parent session that triggered this task */
  parentMessageId: string;
  /** Human-readable task description */
  description: string;
  /** Prompt sent to the child session */
  prompt: string;
  /** Agent type for the child session */
  agent: string;
  /** Current task status */
  status: BackgroundTaskStatus;
  /** When task was added to queue */
  queuedAt?: Date;
  /** When task started execution */
  startedAt?: Date;
  /** When task completed/errored/cancelled */
  completedAt?: Date;
  /** Result output from task completion */
  result?: string;
  /** Error message if task failed */
  error?: string;
  /** Progress tracking for monitoring */
  progress?: TaskProgress;
  /** Key for concurrency limiting (model tier) */
  concurrencyKey?: string;
  /** Last message count for stability detection */
  lastMsgCount?: number;
  /** Consecutive stable poll count for completion detection */
  stablePolls?: number;
}

// ============================================================================
// Launch Input
// ============================================================================

/**
 * Input for launching a new background task.
 */
export interface LaunchInput {
  /** Human-readable task description */
  description: string;
  /** Prompt to send to child session */
  prompt: string;
  /** Agent type for the child session */
  agent: string;
  /** Parent session ID for tracking */
  parentSessionId: string;
  /** Parent message ID for tracking */
  parentMessageId: string;
  /** Model tier for concurrency limiting (optional, inferred from agent if not provided) */
  model?: ModelTier;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Background manager configuration.
 */
export interface BackgroundConfig {
  /** Concurrency limits per model tier */
  modelConcurrency?: Record<string, number>;
  /** Default concurrency limit if model not specified */
  defaultConcurrency?: number;
  /** Polling interval in milliseconds for stability detection */
  pollingIntervalMs?: number;
  /** Number of stable polls required before completion (default: 3) */
  stabilityThreshold?: number;
  /** Milliseconds to batch notifications (default: 1000) */
  notificationBatchWindow?: number;
  /** Maximum notifications per batch before immediate flush (default: 5) */
  notificationMaxBatch?: number;
  /** Minimum milliseconds before stability detection activates (default: 10000) */
  minStabilityTimeMs?: number;
  /** Milliseconds before task is considered stale (default: 180000 = 3 min) */
  staleTimeoutMs?: number;
  /** Minimum runtime before stale check (default: 30000 = 30 sec) */
  minRuntimeBeforeStaleMs?: number;
  /** Task TTL in milliseconds (default: 1800000 = 30 min) */
  taskTtlMs?: number;
}

/**
 * Default background manager configuration.
 *
 * Uses MODEL_CONCURRENT_LIMITS from ecomode for model-based limits:
 * - haiku: 5 concurrent tasks
 * - sonnet: 3 concurrent tasks
 * - opus: 2 concurrent tasks
 */
export const DEFAULT_BACKGROUND_CONFIG: Required<BackgroundConfig> = {
  modelConcurrency: { ...MODEL_CONCURRENT_LIMITS },
  defaultConcurrency: 3,
  pollingIntervalMs: 2000,
  stabilityThreshold: 3,
  notificationBatchWindow: 1000,
  notificationMaxBatch: 5,
  minStabilityTimeMs: 10_000,
  staleTimeoutMs: 180_000,
  minRuntimeBeforeStaleMs: 30_000,
  taskTtlMs: 30 * 60 * 1000,
};

// ============================================================================
// State Persistence
// ============================================================================

/**
 * Serializable background task for state persistence.
 * Dates are serialized as ISO strings.
 */
export interface SerializedBackgroundTask extends Omit<BackgroundTask, 'queuedAt' | 'startedAt' | 'completedAt' | 'progress'> {
  queuedAt?: string;
  startedAt?: string;
  completedAt?: string;
  progress?: {
    toolCalls: number;
    lastTool?: string;
    lastUpdate: string;
    lastMessage?: string;
    lastMessageAt?: string;
  };
}

/**
 * Background manager state for persistence.
 */
export interface BackgroundState {
  /** All tasks indexed by ID */
  tasks: Record<string, SerializedBackgroundTask>;
  /** Active task count per concurrency key */
  activeCount: Record<string, number>;
  /** Last state update timestamp (ISO string) */
  lastUpdated: string;
}

/**
 * Create initial empty background state.
 */
export function createInitialBackgroundState(): BackgroundState {
  return {
    tasks: {},
    activeCount: {},
    lastUpdated: new Date().toISOString(),
  };
}
