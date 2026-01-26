/**
 * Checkpoint Manager - Git-based state checkpoint system
 *
 * Enables recovery from failed operations by creating git commits as
 * checkpoint markers. The orchestrator can rollback to a previous
 * checkpoint when errors occur during plan execution.
 *
 * IMPORTANT: Only affects .ultraplan/state/ directory, never resets source code.
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { StateManager } from './state-manager.js';
import { StateLocation } from './types.js';
import type {
  Checkpoint,
  CheckpointCreateResult,
  RollbackResult,
  CHECKPOINT_DIR,
  CHECKPOINT_RETAIN_COUNT,
} from './types.js';

// Constants from types.ts
const CHECKPOINT_INDEX_FILE = 'checkpoints/index';
const RETAIN_COUNT = 10; // CHECKPOINT_RETAIN_COUNT from types.ts

/** Index structure storing all checkpoints */
interface CheckpointIndex extends Record<string, unknown> {
  checkpoints: Checkpoint[];
}

// State manager for checkpoint index persistence
const checkpointIndexManager = new StateManager<CheckpointIndex>(
  CHECKPOINT_INDEX_FILE,
  StateLocation.LOCAL
);

/**
 * Check if current directory is a git repository
 *
 * @returns true if .git directory exists
 */
export function isGitRepo(): boolean {
  return existsSync(join(process.cwd(), '.git'));
}

/**
 * Execute a git command safely with proper error handling
 *
 * @param args - Git command arguments (without 'git' prefix)
 * @returns Command output as string
 * @throws Error if git command fails
 */
export function execGit(args: string[]): string {
  try {
    return execSync(`git ${args.join(' ')}`, {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    throw new Error(
      `Git command failed: git ${args.join(' ')}\n${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get the state directory path
 *
 * @returns Absolute path to .ultraplan/state/
 */
function getStateDirPath(): string {
  return join(process.cwd(), '.ultraplan', 'state');
}

/**
 * Capture current state snapshot by reading all JSON files in state directory
 *
 * @returns Record mapping filenames to their parsed JSON content
 */
function captureStateSnapshot(): Record<string, unknown> {
  const stateDirPath = getStateDirPath();
  const snapshot: Record<string, unknown> = {};

  if (!existsSync(stateDirPath)) {
    return snapshot;
  }

  try {
    const files = readdirSync(stateDirPath);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = join(stateDirPath, file);
        try {
          const content = readFileSync(filePath, 'utf-8');
          snapshot[file] = JSON.parse(content);
        } catch {
          // Skip files that can't be read or parsed
          continue;
        }
      }
    }
  } catch {
    // If directory can't be read, return empty snapshot
    return snapshot;
  }

  return snapshot;
}

/**
 * Load checkpoint index from state file
 *
 * @returns Checkpoint index (empty if doesn't exist)
 */
function loadCheckpointIndex(): CheckpointIndex {
  const result = checkpointIndexManager.read();
  return result.exists && result.data ? result.data : { checkpoints: [] };
}

/**
 * Save checkpoint index to state file
 *
 * @param index - Checkpoint index to save
 * @returns Whether save succeeded
 */
function saveCheckpointIndex(index: CheckpointIndex): boolean {
  return checkpointIndexManager.write(index).success;
}

/**
 * Create a checkpoint by creating a git commit with state snapshot
 *
 * Creates a git commit containing only .ultraplan/state/ files and saves
 * checkpoint metadata to the index. Does NOT affect source code.
 *
 * @param phase - Phase identifier (e.g., '02-state-management')
 * @param plan - Plan number within phase
 * @param wave - Wave number within plan
 * @param description - Human-readable checkpoint description
 * @returns Result with checkpoint object if successful
 */
export function createCheckpoint(
  phase: string,
  plan: number,
  wave: number,
  description: string
): CheckpointCreateResult {
  // Verify git repo exists
  if (!isGitRepo()) {
    return {
      success: false,
      error: 'Not a git repository',
    };
  }

  try {
    // Stage .ultraplan/state/ files
    // Use -- to ensure path is treated as path, not ref
    try {
      execGit(['add', '.ultraplan/state/']);
    } catch (error) {
      // If add fails because directory doesn't exist, that's okay
      // We'll create an empty commit
    }

    // Capture current state snapshot before commit
    const stateSnapshot = captureStateSnapshot();

    // Create commit with descriptive message
    const commitMessage = `checkpoint(${phase}/${plan}): ${description}`;
    try {
      execGit(['commit', '-m', commitMessage, '--allow-empty']);
    } catch (error) {
      // If commit fails, it might be because there's nothing to commit
      // In that case, we still create a checkpoint with --allow-empty
      // If this also fails, propagate the error
      return {
        success: false,
        error: `Failed to create commit: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    // Get commit hash
    const commitHash = execGit(['rev-parse', 'HEAD']);

    // Create checkpoint object
    const checkpoint: Checkpoint = {
      id: randomUUID(),
      commitHash,
      createdAt: new Date().toISOString(),
      phase,
      plan,
      wave,
      description,
      stateSnapshot,
    };

    // Load index, add checkpoint, save
    const index = loadCheckpointIndex();
    index.checkpoints.push(checkpoint);

    if (!saveCheckpointIndex(index)) {
      return {
        success: false,
        error: 'Failed to save checkpoint index',
      };
    }

    return {
      success: true,
      checkpoint,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Roll back to a previous checkpoint by restoring state files
 *
 * Restores .ultraplan/state/ directory to the state at the checkpoint commit.
 * Does NOT use `git reset --hard` to avoid affecting source code.
 *
 * @param checkpointId - UUID of the checkpoint to restore
 * @returns Result with checkpoint and files restored count if successful
 */
export function rollbackToCheckpoint(checkpointId: string): RollbackResult {
  // Verify git repo exists
  if (!isGitRepo()) {
    return {
      success: false,
      error: 'Not a git repository',
    };
  }

  // Load checkpoint from index
  const index = loadCheckpointIndex();
  const checkpoint = index.checkpoints.find((cp) => cp.id === checkpointId);

  if (!checkpoint) {
    return {
      success: false,
      error: `Checkpoint not found: ${checkpointId}`,
    };
  }

  try {
    // Restore state files from checkpoint commit
    // Use git checkout <commit> -- <path> to restore specific directory
    // This does NOT change HEAD or affect working tree outside the specified path
    execGit(['checkout', checkpoint.commitHash, '--', '.ultraplan/state/']);

    // Count restored files (approximate from snapshot)
    const filesRestored = Object.keys(checkpoint.stateSnapshot).length;

    return {
      success: true,
      rolledBackTo: checkpoint,
      filesRestored,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * List all available checkpoints
 *
 * @returns Array of checkpoints sorted by creation time (newest first)
 */
export function listCheckpoints(): Checkpoint[] {
  const index = loadCheckpointIndex();
  // Sort by createdAt descending (newest first)
  return [...index.checkpoints].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Prune old checkpoints, keeping only the most recent ones
 *
 * Removes checkpoints beyond CHECKPOINT_RETAIN_COUNT, keeping the newest.
 *
 * @returns Number of checkpoints pruned
 */
export function pruneOldCheckpoints(): number {
  const index = loadCheckpointIndex();

  // Sort by createdAt descending
  const sorted = [...index.checkpoints].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Keep only the most recent RETAIN_COUNT
  const toKeep = sorted.slice(0, RETAIN_COUNT);
  const pruneCount = sorted.length - toKeep.length;

  if (pruneCount > 0) {
    index.checkpoints = toKeep;
    saveCheckpointIndex(index);
  }

  return pruneCount;
}

/**
 * Get the most recent checkpoint
 *
 * @returns Latest checkpoint or undefined if none exist
 */
export function getLatestCheckpoint(): Checkpoint | undefined {
  const checkpoints = listCheckpoints();
  return checkpoints.length > 0 ? checkpoints[0] : undefined;
}
