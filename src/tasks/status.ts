/**
 * Task Status Synchronization
 *
 * Provides dual sync of task status changes to both Claude Tasks (via TaskUpdate)
 * and PLAN.md frontmatter (via status-sync module).
 *
 * This module bridges execution state changes to the visual tracking system.
 */

import type { TaskRegistry } from './registry.js';
import type { TaskUpdateParams } from './types.js';
import { updateTask } from './api.js';
import {
  markTaskInProgress as markPlanInProgress,
  markTaskComplete as markPlanComplete,
  markTaskFailed as markPlanFailed,
} from '../sync/status-sync.js';

// ============================================================================
// State Mapping
// ============================================================================

/**
 * Router execution states
 *
 * These are the internal states used during task execution.
 */
type RouterState = 'pending' | 'executing' | 'verifying' | 'done' | 'failed';

/**
 * Claude Tasks API status values
 *
 * These are the status values accepted by the Claude Tasks tool.
 */
type ClaudeTaskStatus = 'pending' | 'in_progress' | 'completed';

/**
 * State mapping from router states to Claude Tasks status
 *
 * Maps internal execution states to Claude Tasks API status values:
 * - pending: Task not yet started
 * - executing: Task actively being worked on
 * - verifying: Still in progress (verification is part of execution)
 * - done: Task completed successfully
 * - failed: Reset to pending (allows retry)
 */
const STATE_MAP: Record<RouterState, ClaudeTaskStatus> = {
  pending: 'pending',
  executing: 'in_progress',
  verifying: 'in_progress', // Still executing during verification
  done: 'completed',
  failed: 'pending', // Failed tasks reset to pending (retry possible)
};

// ============================================================================
// Types
// ============================================================================

/**
 * Result from status update operations
 *
 * Contains the TaskUpdate invocation structure plus internal ID
 * for tracking which task was updated.
 */
export interface StatusUpdateResult {
  tool: 'TaskUpdate';
  params: TaskUpdateParams;
  internalId: string;
}

// ============================================================================
// Core Sync Function
// ============================================================================

/**
 * Sync task status to Claude Tasks
 *
 * Creates TaskUpdate invocation to synchronize execution state.
 * Does NOT update PLAN.md - use the specific mark* functions for dual sync.
 *
 * @param internalId - Our task ID (e.g., "06-01-01")
 * @param state - Router execution state
 * @param registry - TaskRegistry for ID lookup
 * @param metadata - Optional metadata to include in the update
 * @returns StatusUpdateResult or null if task not registered
 *
 * @example
 * ```typescript
 * const result = syncTaskStatus('06-01-01', 'executing', registry, {
 *   startedAt: new Date().toISOString(),
 * });
 * // result.tool === 'TaskUpdate'
 * // result.params.status === 'in_progress'
 * ```
 */
export function syncTaskStatus(
  internalId: string,
  state: RouterState,
  registry: TaskRegistry,
  metadata?: Record<string, unknown>
): StatusUpdateResult | null {
  const claudeTaskId = registry.getClaudeId(internalId);
  if (!claudeTaskId) {
    console.warn(`Cannot sync status: task ${internalId} not registered`);
    return null;
  }

  const claudeStatus = STATE_MAP[state];

  const invocation = updateTask({
    taskId: claudeTaskId,
    status: claudeStatus,
    ...(state === 'executing' && { owner: 'executor' }),
    ...(metadata && { metadata }),
  });

  return {
    ...invocation,
    internalId,
  };
}

// ============================================================================
// Dual Sync Functions (Claude Tasks + PLAN.md)
// ============================================================================

/**
 * Mark task as in progress (dual sync: Claude Tasks + PLAN.md)
 *
 * Updates both:
 * 1. PLAN.md frontmatter via status-sync module
 * 2. Claude Tasks via TaskUpdate invocation
 *
 * @param internalId - Our task ID
 * @param planPath - Path to PLAN.md for status sync
 * @param registry - TaskRegistry for ID lookup
 * @param agentId - Optional agent ID for resumption tracking
 * @returns StatusUpdateResult or null if task not registered
 *
 * @example
 * ```typescript
 * const result = await markInProgress('06-01-01', '/path/to/PLAN.md', registry);
 * // PLAN.md frontmatter updated with in_progress status
 * // result contains TaskUpdate invocation for Claude Tasks
 * ```
 */
export async function markInProgress(
  internalId: string,
  planPath: string,
  registry: TaskRegistry,
  agentId?: string
): Promise<StatusUpdateResult | null> {
  // Update PLAN.md
  await markPlanInProgress(planPath, internalId, agentId);

  // Generate Claude Tasks update
  return syncTaskStatus(internalId, 'executing', registry, {
    startedAt: new Date().toISOString(),
    ...(agentId && { agentId }),
  });
}

/**
 * Mark task as completed (dual sync: Claude Tasks + PLAN.md)
 *
 * Updates both:
 * 1. PLAN.md frontmatter via status-sync module
 * 2. Claude Tasks via TaskUpdate invocation
 *
 * @param internalId - Our task ID
 * @param planPath - Path to PLAN.md for status sync
 * @param registry - TaskRegistry for ID lookup
 * @param evidence - Optional completion evidence (e.g., test output)
 * @returns StatusUpdateResult or null if task not registered
 *
 * @example
 * ```typescript
 * const result = await markCompleted('06-01-01', '/path/to/PLAN.md', registry);
 * // PLAN.md frontmatter updated with completed status
 * // result contains TaskUpdate invocation for Claude Tasks
 * ```
 */
export async function markCompleted(
  internalId: string,
  planPath: string,
  registry: TaskRegistry,
  evidence?: string
): Promise<StatusUpdateResult | null> {
  // Update PLAN.md
  await markPlanComplete(planPath, internalId);

  // Generate Claude Tasks update
  return syncTaskStatus(internalId, 'done', registry, {
    completedAt: new Date().toISOString(),
    ...(evidence && { evidence }),
  });
}

/**
 * Mark task as failed (dual sync: Claude Tasks + PLAN.md)
 *
 * Updates both:
 * 1. PLAN.md frontmatter via status-sync module
 * 2. Claude Tasks via TaskUpdate invocation (resets to pending for retry)
 *
 * @param internalId - Our task ID
 * @param planPath - Path to PLAN.md for status sync
 * @param registry - TaskRegistry for ID lookup
 * @param error - Error message describing the failure
 * @returns StatusUpdateResult or null if task not registered
 *
 * @example
 * ```typescript
 * const result = await markFailed('06-01-01', '/path/to/PLAN.md', registry, 'Build failed');
 * // PLAN.md frontmatter updated with failed status and error
 * // result contains TaskUpdate invocation (status: pending for retry)
 * ```
 */
export async function markFailed(
  internalId: string,
  planPath: string,
  registry: TaskRegistry,
  error: string
): Promise<StatusUpdateResult | null> {
  // Update PLAN.md
  await markPlanFailed(planPath, internalId, error);

  // Generate Claude Tasks update (reset to pending for retry)
  return syncTaskStatus(internalId, 'failed', registry, {
    failedAt: new Date().toISOString(),
    error,
    retryable: true,
  });
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Check registration status for multiple tasks
 *
 * Useful for verifying which tasks are registered before bulk operations.
 *
 * @param internalIds - Array of task IDs to check
 * @param registry - TaskRegistry for ID lookup
 * @returns Map of internal ID -> boolean (true if registered)
 *
 * @example
 * ```typescript
 * const status = checkRegistrationStatus(['06-01-01', '06-01-02'], registry);
 * // status.get('06-01-01') === true if registered
 * ```
 */
export function checkRegistrationStatus(
  internalIds: string[],
  registry: TaskRegistry
): Map<string, boolean> {
  const status = new Map<string, boolean>();
  for (const id of internalIds) {
    status.set(id, registry.has(id));
  }
  return status;
}
