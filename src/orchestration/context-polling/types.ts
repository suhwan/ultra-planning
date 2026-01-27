/**
 * Context Polling Types - Orchestrator-side polling for subagent state
 *
 * Type definitions for polling subagent state files to detect checkpoint
 * readiness and stale heartbeats.
 */

import type { CheckpointReturn } from '../../context/checkpoint-return.js';

// ============================================================================
// Constants
// ============================================================================

/** Polling interval - check subagent states every 5 seconds */
export const POLL_INTERVAL_MS = 5000;

/** Stale threshold - heartbeat older than 1 minute is considered stale */
export const STALE_THRESHOLD_MS = 60 * 1000;

/** Subagent state directory relative to STATE_DIR */
export const SUBAGENT_STATE_DIR = 'subagents';

// ============================================================================
// Status Types
// ============================================================================

/** Status of a subagent based on state file polling */
export type SubagentStatus =
  | 'active' // Running normally, heartbeat fresh
  | 'stale' // Heartbeat older than threshold
  | 'checkpoint_ready' // Has checkpoint data
  | 'not_found' // State file doesn't exist
  | 'completed'; // Finished (active=false)

// ============================================================================
// Result Types
// ============================================================================

/** Result of polling a single subagent */
export interface PollResult {
  /** Agent identifier */
  agentId: string;
  /** Current status based on polling */
  status: SubagentStatus;
  /** Context usage ratio if active (0.0 to 1.0+) */
  contextUsage?: number;
  /** Threshold status if active */
  thresholdStatus?: 'normal' | 'warning' | 'critical';
  /** Checkpoint data if checkpoint_ready */
  checkpoint?: CheckpointReturn;
  /** Last heartbeat timestamp (ISO) if available */
  lastHeartbeat?: string;
  /** Error message if polling failed */
  error?: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

/** Configuration for polling loop */
export interface PollingLoopConfig {
  /** Polling interval in milliseconds (default: POLL_INTERVAL_MS) */
  intervalMs?: number;
  /** Stale threshold in milliseconds (default: STALE_THRESHOLD_MS) */
  staleThresholdMs?: number;
  /** Callback when checkpoint is ready */
  onCheckpointReady?: (agentId: string, checkpoint: CheckpointReturn) => void;
  /** Callback when heartbeat is stale */
  onStale?: (agentId: string) => void;
  /** Callback when polling encounters error */
  onError?: (agentId: string, error: Error) => void;
}

/** Handle for managing polling loop */
export interface PollingLoopHandle {
  /** Stop the polling loop */
  stop(): void;
  /** Check if loop is currently running */
  isRunning(): boolean;
  /** Get timestamp of last poll (null if never polled) */
  getLastPollTime(): Date | null;
}
