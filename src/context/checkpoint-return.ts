/**
 * CheckpointReturn - Structured data for graceful subagent handoff
 *
 * When a subagent reaches critical threshold, it returns this structure
 * to enable seamless continuation by the next agent.
 */

/**
 * Size threshold for checkpoint data warning (~1000 tokens)
 */
export const CHECKPOINT_SIZE_WARNING = 4000;

/**
 * Completed item status
 */
export interface CompletedItem {
  /** Path to completed file */
  file: string;
  /** Completion status */
  status: 'done' | 'partial';
  /** Test status if applicable */
  tests?: 'passed' | 'skipped' | 'failed';
  /** Optional implementation notes */
  notes?: string;
}

/**
 * Remaining item for continuation
 */
export interface RemainingItem {
  /** Path to file that needs work */
  file: string;
  /** Description of what needs to be done */
  description: string;
  /** Reference pattern for guidance (e.g., "utils.ts:15-30 error handling") */
  referencePattern?: string;
  /** Execution priority */
  priority?: 'high' | 'normal' | 'low';
}

/**
 * Context preserved for handoff
 */
export interface HandoffContext {
  /** Key architectural decisions made */
  decisions: string[];
  /** Code patterns to follow */
  patterns: string[];
  /** Issues encountered (optional) */
  issues?: string[];
  /** All files touched for dependency tracking */
  filesModified: string[];
}

/**
 * Complete checkpoint return structure
 */
export interface CheckpointReturn {
  /** Items completed by this subagent */
  completed: CompletedItem[];
  /** Items remaining for next subagent */
  remaining: RemainingItem[];
  /** Preserved context for continuation */
  context: HandoffContext;
  /** ISO timestamp of checkpoint creation */
  createdAt: string;
  /** Source agent identifier */
  agentId: string;
  /** Reason for checkpoint creation */
  reason: 'threshold_critical' | 'task_complete' | 'error';
}

/**
 * Builder for fluent checkpoint construction
 */
export class CheckpointReturnBuilder {
  private completed: CompletedItem[] = [];
  private remaining: RemainingItem[] = [];
  private context: HandoffContext = {
    decisions: [],
    patterns: [],
    filesModified: [],
  };
  private agentId: string;
  private reason: CheckpointReturn['reason'];

  /**
   * Create a new checkpoint builder
   *
   * @param agentId - Identifier of the agent creating this checkpoint
   * @param reason - Reason for checkpoint creation
   */
  constructor(agentId: string, reason: CheckpointReturn['reason']) {
    this.agentId = agentId;
    this.reason = reason;
  }

  /**
   * Add a completed item
   *
   * @param item - Completed item to add
   * @returns This builder for chaining
   */
  addCompleted(item: CompletedItem): this {
    this.completed.push(item);
    return this;
  }

  /**
   * Add a remaining item
   *
   * @param item - Remaining item to add
   * @returns This builder for chaining
   */
  addRemaining(item: RemainingItem): this {
    this.remaining.push(item);
    return this;
  }

  /**
   * Add an architectural decision
   *
   * @param decision - Decision description
   * @returns This builder for chaining
   */
  addDecision(decision: string): this {
    this.context.decisions.push(decision);
    return this;
  }

  /**
   * Add a code pattern
   *
   * @param pattern - Pattern description
   * @returns This builder for chaining
   */
  addPattern(pattern: string): this {
    this.context.patterns.push(pattern);
    return this;
  }

  /**
   * Add an issue encountered
   *
   * @param issue - Issue description
   * @returns This builder for chaining
   */
  addIssue(issue: string): this {
    if (!this.context.issues) {
      this.context.issues = [];
    }
    this.context.issues.push(issue);
    return this;
  }

  /**
   * Add a modified file (deduplicated)
   *
   * @param file - File path
   * @returns This builder for chaining
   */
  addFileModified(file: string): this {
    if (!this.context.filesModified.includes(file)) {
      this.context.filesModified.push(file);
    }
    return this;
  }

  /**
   * Build the final checkpoint return structure
   *
   * Logs a warning if the checkpoint exceeds size threshold.
   *
   * @returns Complete checkpoint return structure
   */
  build(): CheckpointReturn {
    const checkpoint: CheckpointReturn = {
      completed: this.completed,
      remaining: this.remaining,
      context: this.context,
      createdAt: new Date().toISOString(),
      agentId: this.agentId,
      reason: this.reason,
    };

    // Validate size and warn if needed
    const validation = validateCheckpointSize(checkpoint);
    if (validation.warning) {
      console.warn(`[CheckpointReturn] ${validation.warning}`);
    }

    return checkpoint;
  }
}

/**
 * Validation result for checkpoint size
 */
export interface CheckpointSizeValidation {
  /** Whether size is acceptable */
  valid: boolean;
  /** Size in characters */
  size: number;
  /** Warning message if oversized */
  warning?: string;
}

/**
 * Validate checkpoint size and generate warnings
 *
 * @param checkpoint - Checkpoint to validate
 * @returns Validation result with size and optional warning
 */
export function validateCheckpointSize(
  checkpoint: CheckpointReturn
): CheckpointSizeValidation {
  const serialized = JSON.stringify(checkpoint);
  const size = serialized.length;
  const valid = size <= CHECKPOINT_SIZE_WARNING;

  if (!valid) {
    return {
      valid: false,
      size,
      warning: `Checkpoint size (${size} chars) exceeds recommended threshold (${CHECKPOINT_SIZE_WARNING} chars). Consider reducing context data.`,
    };
  }

  return {
    valid: true,
    size,
  };
}
