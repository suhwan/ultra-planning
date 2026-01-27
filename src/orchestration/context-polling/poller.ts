/**
 * Context Polling - Orchestrator functions for monitoring subagent state
 *
 * Implements polling logic for detecting checkpoint readiness and stale
 * heartbeats in subagent state files.
 */

import { StateManager } from '../../state/state-manager.js';
import { StateLocation } from '../../state/types.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import type {
  PollResult,
  PollingLoopConfig,
  PollingLoopHandle,
  SubagentStatus,
} from './types.js';
import {
  POLL_INTERVAL_MS,
  STALE_THRESHOLD_MS,
  SUBAGENT_STATE_DIR,
} from './types.js';
import type { CheckpointReturn } from '../../context/checkpoint-return.js';

// ============================================================================
// Subagent State Interface (for reading state files)
// ============================================================================

/** State structure expected in subagent state files */
interface SubagentStateFile {
  agentId: string;
  active: boolean;
  lastHeartbeat: string;
  usageRatio?: number;
  thresholdStatus?: 'normal' | 'warning' | 'critical';
  checkpoint?: CheckpointReturn;
  [key: string]: unknown;
}

// ============================================================================
// Core Polling Functions
// ============================================================================

/**
 * Poll a single subagent's state file
 *
 * Reads the state file and determines the agent's current status based on:
 * - File existence
 * - Active flag
 * - Heartbeat freshness
 * - Checkpoint presence
 *
 * @param agentId - Unique identifier of the subagent
 * @returns Poll result with status and relevant data
 */
export function pollSubagent(agentId: string): PollResult {
  // Create state manager for subagent state file
  const manager = new StateManager<SubagentStateFile>(
    `${SUBAGENT_STATE_DIR}/${agentId}`,
    StateLocation.LOCAL
  );

  // Read state file
  const result = manager.read();

  // File doesn't exist
  if (!result.exists || !result.data) {
    return {
      agentId,
      status: 'not_found' as SubagentStatus,
    };
  }

  const state = result.data;

  // Check if agent marked as inactive
  if (!state.active) {
    return {
      agentId,
      status: 'completed' as SubagentStatus,
    };
  }

  // Check heartbeat age
  try {
    const lastHeartbeat = new Date(state.lastHeartbeat).getTime();
    const age = Date.now() - lastHeartbeat;

    if (age > STALE_THRESHOLD_MS) {
      return {
        agentId,
        status: 'stale' as SubagentStatus,
        lastHeartbeat: state.lastHeartbeat,
      };
    }
  } catch (error) {
    // Invalid timestamp - treat as stale
    return {
      agentId,
      status: 'stale' as SubagentStatus,
      lastHeartbeat: state.lastHeartbeat,
      error: 'Invalid lastHeartbeat timestamp',
    };
  }

  // Check for checkpoint
  if (state.checkpoint) {
    return {
      agentId,
      status: 'checkpoint_ready' as SubagentStatus,
      checkpoint: state.checkpoint,
      contextUsage: state.usageRatio,
      thresholdStatus: state.thresholdStatus,
      lastHeartbeat: state.lastHeartbeat,
    };
  }

  // Active and normal
  return {
    agentId,
    status: 'active' as SubagentStatus,
    contextUsage: state.usageRatio,
    thresholdStatus: state.thresholdStatus,
    lastHeartbeat: state.lastHeartbeat,
  };
}

/**
 * Poll multiple subagents
 *
 * @param agentIds - Array of agent identifiers to poll
 * @returns Array of poll results, one per agent
 */
export function pollAllSubagents(agentIds: string[]): PollResult[] {
  return agentIds.map((agentId) => pollSubagent(agentId));
}

/**
 * List all active subagent IDs from state directory
 *
 * Scans the subagents directory and returns agent IDs based on state files.
 * Filters out .tmp files.
 *
 * @returns Array of agent IDs (filenames without .json extension)
 */
export function listActiveSubagents(): string[] {
  try {
    const stateDir = join(process.cwd(), '.ultraplan', 'state', SUBAGENT_STATE_DIR);
    const files = readdirSync(stateDir);

    return files
      .filter((file) => file.endsWith('.json') && !file.endsWith('.tmp'))
      .map((file) => file.replace(/\.json$/, ''));
  } catch (error) {
    // Directory doesn't exist or permission denied
    return [];
  }
}

// ============================================================================
// Polling Loop
// ============================================================================

/**
 * Start a polling loop to monitor subagent states
 *
 * Creates an interval that periodically polls all agents and invokes
 * callbacks for checkpoint_ready and stale statuses.
 *
 * @param agentIds - Array of agent IDs to monitor
 * @param config - Optional configuration with callbacks and intervals
 * @returns Handle for controlling the polling loop
 */
export function startPollingLoop(
  agentIds: string[],
  config?: PollingLoopConfig
): PollingLoopHandle {
  const intervalMs = config?.intervalMs ?? POLL_INTERVAL_MS;
  const staleThresholdMs = config?.staleThresholdMs ?? STALE_THRESHOLD_MS;

  let isRunning = true;
  let lastPollTime: Date | null = null;

  // Poll function
  const poll = () => {
    if (!isRunning) {
      return;
    }

    lastPollTime = new Date();
    const results = pollAllSubagents(agentIds);

    // Process results and invoke callbacks
    for (const result of results) {
      try {
        if (result.status === 'checkpoint_ready' && result.checkpoint) {
          config?.onCheckpointReady?.(result.agentId, result.checkpoint);
        } else if (result.status === 'stale') {
          config?.onStale?.(result.agentId);
        } else if (result.error) {
          config?.onError?.(result.agentId, new Error(result.error));
        }
      } catch (error) {
        // Callback threw error - invoke error callback
        if (error instanceof Error) {
          config?.onError?.(result.agentId, error);
        }
      }
    }
  };

  // Start interval
  const interval = setInterval(poll, intervalMs);

  // Poll immediately on start
  poll();

  // Return handle
  return {
    stop: () => {
      isRunning = false;
      clearInterval(interval);
    },
    isRunning: () => isRunning,
    getLastPollTime: () => lastPollTime,
  };
}

/**
 * Stop a polling loop
 *
 * Convenience function for calling handle.stop().
 *
 * @param handle - Polling loop handle to stop
 */
export function stopPollingLoop(handle: PollingLoopHandle): void {
  handle.stop();
}
