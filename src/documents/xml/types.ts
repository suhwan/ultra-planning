/**
 * XML Task Format Types
 *
 * Types for generating and parsing task XML within PLAN.md documents.
 * Supports all GSD task variations (auto, checkpoint:*).
 */

// ============================================================================
// Task Type Identifiers
// ============================================================================

/**
 * Task type identifiers matching GSD format
 */
export type TaskType =
  | 'auto'
  | 'checkpoint:human-verify'
  | 'checkpoint:decision'
  | 'checkpoint:human-action';

// ============================================================================
// Base Task Fields
// ============================================================================

/**
 * Base fields shared by all tasks
 */
interface BaseTask {
  /** Task type identifier */
  type: TaskType;

  /** Task name (appears in <name> element) */
  name: string;
}

// ============================================================================
// Autonomous Tasks
// ============================================================================

/**
 * Autonomous task that Claude executes independently
 */
export interface AutoTask extends BaseTask {
  type: 'auto';

  /** Files this task modifies (comma-separated in XML) */
  files: string[];

  /** Specific implementation details */
  action: string;

  /** Command or check to prove it worked */
  verify: string;

  /** Measurable acceptance criteria */
  done: string;
}

// ============================================================================
// Checkpoint Tasks
// ============================================================================

/**
 * Human verification checkpoint
 * User verifies behavior visually/functionally
 */
export interface HumanVerifyTask extends BaseTask {
  type: 'checkpoint:human-verify';

  /** Gate behavior (always blocking for checkpoints) */
  gate: 'blocking';

  /** What Claude built */
  whatBuilt: string;

  /** How user should verify it */
  howToVerify: string;

  /** Signal to resume execution */
  resumeSignal: string;
}

/**
 * Decision checkpoint option
 */
export interface DecisionOption {
  /** Option identifier */
  id: string;

  /** Option name */
  name: string;

  /** Benefits of this option */
  pros: string;

  /** Tradeoffs of this option */
  cons: string;
}

/**
 * Decision checkpoint
 * User chooses between implementation options
 */
export interface DecisionTask extends BaseTask {
  type: 'checkpoint:decision';

  /** Gate behavior (always blocking for checkpoints) */
  gate: 'blocking';

  /** What needs deciding */
  decision: string;

  /** Why this decision matters */
  context: string;

  /** Available options */
  options: DecisionOption[];

  /** Signal to resume execution */
  resumeSignal: string;
}

/**
 * Human action checkpoint (rare)
 * User must perform manual action Claude cannot automate
 */
export interface HumanActionTask extends BaseTask {
  type: 'checkpoint:human-action';

  /** Gate behavior (always blocking for checkpoints) */
  gate: 'blocking';

  /** Action that must be performed */
  action: string;

  /** Instructions for performing the action */
  instructions: string;

  /** Signal to resume execution */
  resumeSignal: string;
}

// ============================================================================
// Union Types
// ============================================================================

/**
 * Union type for all checkpoint tasks
 */
export type CheckpointTask = HumanVerifyTask | DecisionTask | HumanActionTask;

/**
 * Union type for all task types
 */
export type Task = AutoTask | CheckpointTask;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if task is autonomous
 */
export function isAutoTask(task: Task): task is AutoTask {
  return task.type === 'auto';
}

/**
 * Check if task is a checkpoint
 */
export function isCheckpointTask(task: Task): task is CheckpointTask {
  return task.type.startsWith('checkpoint:');
}

/**
 * Check if task is human-verify checkpoint
 */
export function isHumanVerifyTask(task: Task): task is HumanVerifyTask {
  return task.type === 'checkpoint:human-verify';
}

/**
 * Check if task is decision checkpoint
 */
export function isDecisionTask(task: Task): task is DecisionTask {
  return task.type === 'checkpoint:decision';
}

/**
 * Check if task is human-action checkpoint
 */
export function isHumanActionTask(task: Task): task is HumanActionTask {
  return task.type === 'checkpoint:human-action';
}
