/**
 * State Management Types
 *
 * Type definitions for file-based state persistence, event system,
 * mode registry, and checkpoint management.
 *
 * Based on patterns from oh-my-claudecode mode-registry.
 */

import type { ExecutionMode } from '../types.js';

// ============================================================================
// Core State Types (for StateManager)
// ============================================================================

/** State storage location */
export enum StateLocation {
  /** Local project state: .ultraplan/state/{name}.json */
  LOCAL = 'local',
  /** Global user state: ~/.ultraplan/state/{name}.json */
  GLOBAL = 'global',
}

/** Result of reading state from file */
export interface StateReadResult<T = unknown> {
  /** Whether the state file exists */
  exists: boolean;
  /** Parsed state data (undefined if file doesn't exist) */
  data?: T;
  /** Absolute path where state was found */
  foundAt?: string;
}

/** Result of writing state to file */
export interface StateWriteResult {
  /** Whether write succeeded */
  success: boolean;
  /** Absolute path where state was written */
  path: string;
  /** Error message if write failed */
  error?: string;
}

/** Result of clearing state files */
export interface StateClearResult {
  /** Paths of state files successfully removed */
  removed: string[];
  /** Paths that didn't exist */
  notFound: string[];
  /** Errors encountered during removal */
  errors: Array<{ path: string; error: string }>;
}

/** State directory path relative to project root */
export const STATE_DIR = '.ultraplan/state';

/** Threshold for considering a marker file stale (1 hour) */
export const STALE_MARKER_THRESHOLD_MS = 60 * 60 * 1000;

// ============================================================================
// Event Types (for Plan 02-02 - Event System)
// ============================================================================

/** Event emitted to the state event queue */
export interface StateEvent {
  /** Unique event identifier (UUID) */
  id: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Event type identifier */
  type: StateEventType;
  /** Event-specific payload data */
  payload: Record<string, unknown>;
  /** Source of the event (e.g., 'orchestrator', 'agent:executor') */
  source: string;
}

/** Supported event types */
export type StateEventType =
  | 'plan_started'
  | 'plan_completed'
  | 'plan_failed'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'checkpoint_created'
  | 'rollback_initiated'
  | 'mode_changed'
  // Phase 5 additions - Ralph Loop lifecycle
  | 'ralph_loop_started'
  | 'ralph_loop_iteration'
  | 'ralph_loop_completed'
  | 'ralph_loop_failed'
  // Phase 5 additions - Orchestrator events
  | 'orchestrator_warning'
  | 'verification_required'
  // Phase 10 additions - Context monitoring
  | 'context_threshold_reached'
  | 'context_auto_compaction_triggered'
  // Phase 18 additions - Hook system (core events)
  | 'context_threshold_hook'
  | 'session_deleted'
  | 'session_idle'
  | 'session_error'
  | 'todo_continuation'
  | 'message_updated'
  | 'tool_execute_before'
  | 'tool_execute_after'
  // Phase 18 additions - Background notification events
  | 'background_task_completed'
  | 'background_tasks_notification'
  // Phase 18 additions - Session recovery events
  | 'session_recovery_attempt'
  | 'session_recovery_failed'
  | 'session_recovery_success'
  // Phase 18 additions - Tool hooks events
  | 'delegate_task_retry'
  | 'edit_error_recovery'
  | 'empty_task_response'
  | 'tool_output_truncated'
  // Phase 18 additions - Context hooks events
  | 'keywords_detected'
  | 'compaction_context_available'
  | 'agents_context_available'
  | 'session_compacting'
  | 'context_compacting'
  // Phase 18 additions - Session hooks events
  | 'session_idle_notification'
  | 'session_error_notification'
  | 'slash_command_detected'
  // Phase 20 additions - Category routing
  | 'category_routing';

/** Result of polling events from the event file */
export interface EventPollResult {
  /** Events read since last poll */
  events: StateEvent[];
  /** Line number of last event read */
  lastLine: number;
  /** Whether more events may be available */
  hasMore: boolean;
}

/** Event file name (append-only JSONL) */
export const EVENT_FILE = 'events.jsonl';

/** Maximum lines before event file rotation */
export const EVENT_FILE_MAX_LINES = 1000;

// ============================================================================
// Mode Types (for Plan 02-03 - Mode Registry)
// ============================================================================

/** Configuration for an execution mode */
export interface ModeConfig {
  /** Display name for the mode */
  name: string;
  /** Primary state file path (relative to .ultraplan/state/) */
  stateFile: string;
  /** Alternative/marker file path */
  markerFile?: string;
  /** Property to check in JSON state for active status */
  activeProperty?: string;
  /** Whether mode has global state */
  hasGlobalState?: boolean;
}

/** Current status of an execution mode */
export interface ModeStatus {
  /** The execution mode */
  mode: ExecutionMode;
  /** Whether the mode is currently active */
  active: boolean;
  /** Absolute path to the state file */
  stateFilePath: string;
  /** When the mode was started (ISO 8601) */
  startedAt?: string;
  /** Additional mode-specific metadata */
  metadata?: Record<string, unknown>;
}

/** Result of checking whether a mode can start */
export interface CanStartResult {
  /** Whether the mode is allowed to start */
  allowed: boolean;
  /** Mode blocking this mode from starting (if any) */
  blockedBy?: ExecutionMode;
  /** Human-readable message explaining the result */
  message?: string;
}

/** State data stored in mode-specific state files */
export interface ModeStateData extends Record<string, unknown> {
  /** Whether the mode is active */
  active: boolean;
  /** When the mode was started (ISO 8601) */
  startedAt: string;
  /** Process ID of the mode owner */
  pid?: number;
  /** Additional mode-specific metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Checkpoint Types (for Plan 02-04 - Checkpoint Manager)
// ============================================================================

/** A checkpoint representing a recoverable state */
export interface Checkpoint {
  /** Unique checkpoint identifier (UUID) */
  id: string;
  /** Git commit hash of the checkpoint */
  commitHash: string;
  /** When checkpoint was created (ISO 8601) */
  createdAt: string;
  /** Phase identifier */
  phase: string;
  /** Plan number within phase */
  plan: number;
  /** Wave number within plan */
  wave: number;
  /** Human-readable description */
  description: string;
  /** Snapshot of state files at checkpoint time */
  stateSnapshot: Record<string, unknown>;
}

/** Result of creating a checkpoint */
export interface CheckpointCreateResult {
  /** Whether checkpoint creation succeeded */
  success: boolean;
  /** The created checkpoint (if successful) */
  checkpoint?: Checkpoint;
  /** Error message (if failed) */
  error?: string;
}

/** Result of rolling back to a checkpoint */
export interface RollbackResult {
  /** Whether rollback succeeded */
  success: boolean;
  /** The checkpoint that was rolled back to */
  rolledBackTo?: Checkpoint;
  /** Number of files restored */
  filesRestored?: number;
  /** Error message (if failed) */
  error?: string;
}

/** Checkpoint directory path relative to project root */
export const CHECKPOINT_DIR = '.ultraplan/checkpoints';

/** Number of checkpoints to retain before pruning */
export const CHECKPOINT_RETAIN_COUNT = 10;
