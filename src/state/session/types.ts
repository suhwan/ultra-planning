/**
 * Session Isolation Types
 *
 * Defines session-scoped state management for agent isolation.
 */

import type { ExecutionMode } from '../../types.js';
import type { AgentRole } from '../../agents/types.js';

// ============================================================================
// Session Identification
// ============================================================================

/** Session identifier */
export interface SessionId {
  /** UUID for the session */
  id: string;
  /** Session creation timestamp (ISO 8601) */
  createdAt: string;
  /** Parent session ID (for nested spawns) */
  parentSessionId?: string;
  /** Session name for human readability */
  name?: string;
}

// ============================================================================
// Session State
// ============================================================================

/** Session-scoped state */
export interface SessionState {
  /** Session identifier */
  sessionId: SessionId;
  /** Active mode */
  mode: ExecutionMode;
  /** Current plan path being worked on */
  activePlan?: string;
  /** Tasks claimed by this session */
  claimedTasks: string[];
  /** Agent role in this session */
  agentRole?: AgentRole;
  /** Session start time */
  startedAt: string;
  /** Last activity timestamp */
  lastActivityAt: string;
  /** Session metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Session Configuration
// ============================================================================

/** What context to pass to spawned agents */
export type ContextPassMode = 'plan_only' | 'plan_and_state' | 'minimal' | 'full';

/** Session isolation rules */
export interface SessionIsolationRules {
  /** What context to pass to spawned agents */
  contextToPass: ContextPassMode;
  /** What results to collect from agent */
  resultsToCollect: SessionResultType[];
  /** Timeout for spawned session (ms) */
  timeoutMs: number;
  /** Whether to propagate learnings */
  propagateLearnings: boolean;
  /** Maximum nesting depth */
  maxNestingDepth: number;
}

/** Types of results to collect from session */
export type SessionResultType =
  | 'verdict'
  | 'learnings'
  | 'metrics'
  | 'files_modified'
  | 'error';

// ============================================================================
// Session Result
// ============================================================================

/** Result from a completed session */
export interface SessionResult {
  /** Session ID */
  sessionId: string;
  /** Completion status */
  status: 'success' | 'failed' | 'timeout' | 'cancelled';
  /** When session completed */
  completedAt: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Verdict (if applicable) */
  verdict?: unknown;
  /** Learnings discovered */
  learnings?: string[];
  /** Metrics collected */
  metrics?: SessionMetrics;
  /** Files modified */
  filesModified?: string[];
  /** Error message (if failed) */
  error?: string;
}

/** Session execution metrics */
export interface SessionMetrics {
  /** Number of tool calls */
  toolCalls: number;
  /** Number of files read */
  filesRead: number;
  /** Number of files written */
  filesWritten: number;
  /** Estimated tokens used */
  tokensUsed: number;
}

// ============================================================================
// Defaults
// ============================================================================

/** Default session isolation rules */
export const DEFAULT_SESSION_RULES: SessionIsolationRules = {
  contextToPass: 'plan_only',
  resultsToCollect: ['verdict', 'learnings'],
  timeoutMs: 300000, // 5 minutes
  propagateLearnings: true,
  maxNestingDepth: 3,
};

/** Session state directory */
export const SESSION_STATE_DIR = '.ultraplan/state/sessions';
