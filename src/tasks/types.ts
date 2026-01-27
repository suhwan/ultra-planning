/**
 * Claude Tasks API Type Definitions
 *
 * Types for interacting with Claude's Task tool system.
 * These types model the Claude Tasks API for creating, updating, and tracking tasks.
 */

// ============================================================================
// Task ID Mapping
// ============================================================================

/**
 * ClaudeTaskId - mapping between our ID and Claude's ID
 *
 * Our internal IDs are deterministic (e.g., "06-01-01"),
 * while Claude assigns sequential IDs ("1", "2", etc.)
 */
export interface ClaudeTaskId {
  /** Our format: "06-01-01" (phase-plan-task) */
  internal: string;
  /** Claude's format: "1", "2", etc. (assigned at runtime) */
  claude: string;
}

// ============================================================================
// Task Creation
// ============================================================================

/**
 * TaskCreate parameters (what we send to Claude)
 */
export interface TaskCreateParams {
  /** Task title (max ~50 chars for display) */
  subject: string;
  /** Full task description */
  description: string;
  /** Spinner text during execution */
  activeForm?: string;
}

/**
 * TaskCreate result (what Claude returns)
 */
export interface TaskCreateResult {
  /** Claude's assigned task ID */
  id: string;
  /** Task title */
  subject: string;
  /** Current task status */
  status: 'pending' | 'in_progress' | 'completed';
}

// ============================================================================
// Task Updates
// ============================================================================

/**
 * TaskUpdate parameters for modifying existing tasks
 */
export interface TaskUpdateParams {
  /** Claude's task ID to update */
  taskId: string;
  /** Optional owner assignment */
  owner?: string;
  /** Optional status change */
  status?: 'pending' | 'in_progress' | 'completed';
  /** Optional blockers to add */
  addBlockedBy?: string[];
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Task Listing
// ============================================================================

/**
 * TaskList entry from TaskList query
 */
export interface TaskListEntry {
  /** Claude's task ID */
  id: string;
  /** Task title */
  subject: string;
  /** Current task status */
  status: 'pending' | 'in_progress' | 'completed';
  /** Task IDs that block this task */
  blockedBy?: string[];
  /** Task owner (agent ID) */
  owner?: string;
}

// ============================================================================
// Tool Invocation Types
// ============================================================================

/**
 * TaskCreate tool invocation structure
 *
 * This is what we generate for the orchestrator to invoke the TaskCreate tool.
 */
export interface TaskCreateInvocation {
  tool: 'TaskCreate';
  params: TaskCreateParams;
}

/**
 * TaskUpdate tool invocation structure
 */
export interface TaskUpdateInvocation {
  tool: 'TaskUpdate';
  params: TaskUpdateParams;
}
