/**
 * Context Polling - Public API
 *
 * Orchestrator-side polling utilities for monitoring subagent state files,
 * detecting checkpoint readiness, and handling stale heartbeats.
 */

// Export polling functions
export {
  pollSubagent,
  pollAllSubagents,
  startPollingLoop,
  stopPollingLoop,
  listActiveSubagents,
} from './poller.js';

// Export all types
export type {
  SubagentStatus,
  PollResult,
  PollingLoopConfig,
  PollingLoopHandle,
} from './types.js';

// Export constants
export {
  POLL_INTERVAL_MS,
  STALE_THRESHOLD_MS,
  SUBAGENT_STATE_DIR,
} from './types.js';
