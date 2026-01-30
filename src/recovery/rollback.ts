/**
 * Error Recovery with Git Rollback Integration
 *
 * Provides error handling with checkpoint rollback and cooldown timer.
 * When errors occur during Ralph Loop execution:
 * 1. Increment error count and record error
 * 2. Check if max retries exceeded
 * 3. Roll back state files to last checkpoint (if available)
 * 4. Clear Ralph Loop state to allow retry
 * 5. Set cooldown timer before retry allowed
 * 6. Emit events for tracking
 *
 * IMPORTANT: Only rolls back .ultraplan/state/ directory, never source code.
 */

import { StateManager, StateLocation, emitEvent } from '../state/index.js';
import {
  getLatestCheckpoint,
  rollbackToCheckpoint,
  listCheckpoints,
  execGit,
  isGitRepo,
} from '../state/checkpoint.js';
import { clearRalphLoopState } from '../loops/ralph/state.js';
import {
  RecoveryState,
  RecoveryConfig,
  RecoveryResult,
  DEFAULT_COOLDOWN_MS,
  DEFAULT_MAX_RETRIES,
  RECOVERY_STATE_FILE,
} from './types.js';
import type { Checkpoint } from '../state/types.js';

// ============================================================================
// Default State
// ============================================================================

/**
 * Default recovery state when no state file exists
 */
const DEFAULT_RECOVERY_STATE: RecoveryState = {
  isRecovering: false,
  lastErrorAt: null,
  errorCount: 0,
  lastError: null,
  cooldownUntil: null,
};

// ============================================================================
// State Manager Instance
// ============================================================================

/**
 * State manager instance for recovery state
 *
 * Uses LOCAL location so state is project-specific.
 * Path: .ultraplan/state/recovery.json
 */
const recoveryManager = new StateManager<RecoveryState>(
  RECOVERY_STATE_FILE,
  StateLocation.LOCAL
);

// ============================================================================
// State Operations
// ============================================================================

/**
 * Get current recovery state
 *
 * Returns the current recovery state from disk, or default state if
 * the state file doesn't exist.
 *
 * @returns Current recovery state
 *
 * @example
 * ```typescript
 * const state = getRecoveryState();
 * if (state.isRecovering) {
 *   console.log(`Recovering from error: ${state.lastError}`);
 * }
 * ```
 */
export function getRecoveryState(): RecoveryState {
  const result = recoveryManager.read();
  if (!result.exists || !result.data) {
    return { ...DEFAULT_RECOVERY_STATE };
  }
  return result.data;
}

/**
 * Update recovery state
 *
 * Merges partial state with existing state and persists to disk.
 *
 * @param state - Partial state to merge
 * @returns True if write succeeded
 *
 * @example
 * ```typescript
 * setRecoveryState({ errorCount: 0, isRecovering: false });
 * ```
 */
export function setRecoveryState(state: Partial<RecoveryState>): boolean {
  const current = getRecoveryState();
  const merged: RecoveryState = { ...current, ...state };
  return recoveryManager.write(merged).success;
}

/**
 * Clear recovery state by deleting the state file
 *
 * Call this when:
 * - Recovery completes successfully
 * - Manual reset requested
 * - Starting fresh
 *
 * @returns True if deletion succeeded (or file didn't exist)
 *
 * @example
 * ```typescript
 * // After successful retry
 * clearRecoveryState();
 * ```
 */
export function clearRecoveryState(): boolean {
  return recoveryManager.clear();
}

// ============================================================================
// Recovery Logic
// ============================================================================

/**
 * Check if retry is allowed
 *
 * Returns true if:
 * - Error count is below max retries
 * - Cooldown period has passed (if any)
 *
 * @param config - Optional recovery configuration
 * @returns True if retry is allowed
 *
 * @example
 * ```typescript
 * if (canRetry()) {
 *   // Safe to retry the operation
 *   executeTask();
 * } else {
 *   // Must wait or give up
 *   console.log('Retry not allowed');
 * }
 * ```
 */
export function canRetry(config?: RecoveryConfig): boolean {
  const state = getRecoveryState();
  const maxRetries = config?.maxRetries ?? DEFAULT_MAX_RETRIES;

  // Check if we've exceeded max retries
  if (state.errorCount >= maxRetries) {
    return false;
  }

  // Check if we're still in cooldown
  if (state.cooldownUntil) {
    const cooldownEnd = Date.parse(state.cooldownUntil);
    if (Date.now() < cooldownEnd) {
      return false;
    }
  }

  return true;
}

/**
 * Handle an error during execution
 *
 * Performs recovery actions:
 * 1. Increment error count and record error
 * 2. Check if max retries exceeded (emit ralph_loop_failed if so)
 * 3. Roll back state to last checkpoint (if configured)
 * 4. Clear Ralph Loop state to allow retry
 * 5. Set cooldown timer
 * 6. Emit rollback_initiated event
 *
 * @param error - The error that occurred
 * @param context - Execution context (phase and plan)
 * @param config - Optional recovery configuration
 * @returns Recovery result indicating what action was taken
 *
 * @example
 * ```typescript
 * try {
 *   executeTask();
 * } catch (error) {
 *   const result = handleError(error as Error, { phase: '05', plan: 1 });
 *   if (result.canRetry) {
 *     console.log(`Retry after: ${result.retryAfter}`);
 *   } else {
 *     console.log('Max retries exceeded, giving up');
 *   }
 * }
 * ```
 */
export function handleError(
  error: Error,
  context: { phase: string; plan: number },
  config?: RecoveryConfig
): RecoveryResult {
  const state = getRecoveryState();
  const maxRetries = config?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const cooldownMs = config?.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const rollbackOnError = config?.rollbackOnError !== false; // Default true

  // Update error state
  const newErrorCount = state.errorCount + 1;
  const now = new Date().toISOString();

  setRecoveryState({
    lastErrorAt: now,
    errorCount: newErrorCount,
    lastError: error.message,
    isRecovering: true,
  });

  // Check if we've exceeded max retries
  if (newErrorCount >= maxRetries) {
    // Emit ralph_loop_failed event
    emitEvent({
      type: 'ralph_loop_failed',
      payload: {
        error: error.message,
        phase: context.phase,
        plan: context.plan,
        reason: 'max_retries',
        errorCount: newErrorCount,
      },
      source: 'recovery',
    });

    return {
      success: false,
      canRetry: false,
      retryAfter: null,
      action: 'max_retries_exceeded',
      error: `Max retries (${maxRetries}) exceeded`,
    };
  }

  // Calculate cooldown end time
  const cooldownEnd = new Date(Date.now() + cooldownMs).toISOString();

  // Roll back state if configured
  let rollbackSucceeded = false;
  let action: RecoveryResult['action'] = 'cooldown_set';

  if (rollbackOnError) {
    const checkpoint = getLatestCheckpoint();

    if (checkpoint) {
      const rollbackResult = rollbackToCheckpoint(checkpoint.id);

      if (rollbackResult.success) {
        rollbackSucceeded = true;
        action = 'rolled_back';
      }
      // If rollback fails, continue with recovery anyway
    } else {
      // No checkpoint available
      action = 'no_checkpoint';
    }
  }

  // Clear Ralph Loop state to allow retry
  clearRalphLoopState();

  // Set cooldown
  setRecoveryState({
    cooldownUntil: cooldownEnd,
    isRecovering: true,
  });

  // Emit rollback_initiated event
  emitEvent({
    type: 'rollback_initiated',
    payload: {
      error: error.message,
      phase: context.phase,
      plan: context.plan,
      retryAfter: cooldownEnd,
      rollbackSucceeded,
      errorCount: newErrorCount,
    },
    source: 'recovery',
  });

  return {
    success: true,
    canRetry: true,
    retryAfter: cooldownEnd,
    action,
  };
}

// ============================================================================
// Advanced Rollback Functions
// ============================================================================

/** Options for selective rollback */
export interface SelectiveRollbackOptions {
  /** Whether to rollback state files (.ultraplan/state/) */
  rollbackState: boolean;
  /** Whether to rollback source code */
  rollbackSource: boolean;
  /** Specific files/patterns to rollback (if rollbackSource is true) */
  sourcePatterns?: string[];
  /** Files/patterns to exclude from rollback */
  excludePatterns?: string[];
  /** Dry run - show what would change without actually changing */
  dryRun?: boolean;
}

/** Result of selective rollback */
export interface SelectiveRollbackResult {
  success: boolean;
  stateFilesRolledBack?: number;
  sourceFilesRolledBack?: number;
  filesChanged?: string[];
  error?: string;
}

/**
 * Perform selective rollback to a checkpoint
 *
 * Allows fine-grained control over what gets rolled back:
 * - State files only (safe, no source code changes)
 * - Source files only (dangerous, use with caution)
 * - Both state and source files
 * - Specific file patterns
 *
 * @param checkpointId - Checkpoint ID to rollback to
 * @param options - Rollback options
 * @returns Detailed rollback result
 */
export function selectiveRollback(
  checkpointId: string,
  options: SelectiveRollbackOptions
): SelectiveRollbackResult {
  if (!isGitRepo()) {
    return { success: false, error: 'Not a git repository' };
  }

  // Find checkpoint
  const checkpoints = listCheckpoints();
  const checkpoint = checkpoints.find(cp => cp.id === checkpointId);

  if (!checkpoint) {
    return { success: false, error: `Checkpoint not found: ${checkpointId}` };
  }

  const filesChanged: string[] = [];
  let stateFilesRolledBack = 0;
  let sourceFilesRolledBack = 0;

  try {
    // Rollback state files if requested
    if (options.rollbackState) {
      if (options.dryRun) {
        // Show what would change
        const diff = execGit(['diff', '--name-only', checkpoint.commitHash, '--', '.ultraplan/state/']);
        if (diff) {
          filesChanged.push(...diff.split('\n').filter(Boolean));
          stateFilesRolledBack = filesChanged.length;
        }
      } else {
        const result = rollbackToCheckpoint(checkpointId);
        if (result.success) {
          stateFilesRolledBack = result.filesRestored || 0;
        }
      }
    }

    // Rollback source files if requested
    if (options.rollbackSource) {
      const patterns = options.sourcePatterns || ['src/', 'lib/'];
      const excludes = options.excludePatterns || ['.ultraplan/', 'node_modules/', '.git/'];

      for (const pattern of patterns) {
        // Skip excluded patterns
        if (excludes.some(ex => pattern.startsWith(ex))) continue;

        if (options.dryRun) {
          try {
            const diff = execGit(['diff', '--name-only', checkpoint.commitHash, '--', pattern]);
            if (diff) {
              const files = diff.split('\n').filter(Boolean);
              filesChanged.push(...files);
              sourceFilesRolledBack += files.length;
            }
          } catch {
            // Pattern might not exist in checkpoint
          }
        } else {
          try {
            execGit(['checkout', checkpoint.commitHash, '--', pattern]);
            // Count files changed
            const diff = execGit(['diff', '--name-only', 'HEAD', checkpoint.commitHash, '--', pattern]);
            if (diff) {
              sourceFilesRolledBack += diff.split('\n').filter(Boolean).length;
            }
          } catch {
            // Pattern might not exist in checkpoint
          }
        }
      }
    }

    return {
      success: true,
      stateFilesRolledBack,
      sourceFilesRolledBack,
      filesChanged: options.dryRun ? filesChanged : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Preview what would be rolled back
 *
 * Shows files that differ between current state and checkpoint.
 *
 * @param checkpointId - Checkpoint ID
 * @returns List of files that would change
 */
export function previewRollback(checkpointId: string): {
  stateFiles: string[];
  sourceFiles: string[];
  error?: string;
} {
  if (!isGitRepo()) {
    return { stateFiles: [], sourceFiles: [], error: 'Not a git repository' };
  }

  const checkpoints = listCheckpoints();
  const checkpoint = checkpoints.find(cp => cp.id === checkpointId);

  if (!checkpoint) {
    return { stateFiles: [], sourceFiles: [], error: `Checkpoint not found: ${checkpointId}` };
  }

  try {
    // Get state file changes
    let stateFiles: string[] = [];
    try {
      const stateDiff = execGit(['diff', '--name-only', checkpoint.commitHash, '--', '.ultraplan/state/']);
      stateFiles = stateDiff ? stateDiff.split('\n').filter(Boolean) : [];
    } catch {
      // No state changes
    }

    // Get source file changes
    let sourceFiles: string[] = [];
    try {
      const sourceDiff = execGit(['diff', '--name-only', checkpoint.commitHash, '--', 'src/']);
      sourceFiles = sourceDiff ? sourceDiff.split('\n').filter(Boolean) : [];
    } catch {
      // No source changes
    }

    return { stateFiles, sourceFiles };
  } catch (error) {
    return {
      stateFiles: [],
      sourceFiles: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Rollback to a specific phase tag
 *
 * Rolls back to the commit marked with phase-N-complete tag.
 *
 * @param phaseNumber - Phase number to rollback to
 * @param options - Rollback options
 * @returns Rollback result
 */
export function rollbackToPhase(
  phaseNumber: number,
  options: Partial<SelectiveRollbackOptions> = {}
): SelectiveRollbackResult {
  const opts: SelectiveRollbackOptions = {
    rollbackState: true,
    rollbackSource: false,
    ...options,
  };
  if (!isGitRepo()) {
    return { success: false, error: 'Not a git repository' };
  }

  const tagName = `phase-${phaseNumber}-complete`;

  try {
    // Get commit for phase tag
    const commitHash = execGit(['rev-parse', tagName]);

    // Find checkpoint with this commit
    const checkpoints = listCheckpoints();
    const checkpoint = checkpoints.find(cp => cp.commitHash === commitHash);

    if (checkpoint) {
      return selectiveRollback(checkpoint.id, opts);
    }

    // No checkpoint, but tag exists - create a pseudo-rollback
    if (opts.rollbackSource) {
      const patterns = opts.sourcePatterns || ['src/'];
      let sourceFilesRolledBack = 0;

      for (const pattern of patterns) {
        if (opts.dryRun) {
          const diff = execGit(['diff', '--name-only', commitHash, '--', pattern]);
          if (diff) {
            sourceFilesRolledBack += diff.split('\n').filter(Boolean).length;
          }
        } else {
          execGit(['checkout', commitHash, '--', pattern]);
          const diff = execGit(['diff', '--name-only', 'HEAD', commitHash, '--', pattern]);
          if (diff) {
            sourceFilesRolledBack += diff.split('\n').filter(Boolean).length;
          }
        }
      }

      return { success: true, sourceFilesRolledBack };
    }

    return { success: true, stateFilesRolledBack: 0 };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get available rollback targets
 *
 * Returns checkpoints and phase tags that can be rolled back to.
 *
 * @returns Available rollback targets
 */
export function getAvailableRollbackTargets(): {
  checkpoints: Checkpoint[];
  phaseTags: { tag: string; commit: string }[];
} {
  const checkpoints = isGitRepo() ? listCheckpoints() : [];

  let phaseTags: { tag: string; commit: string }[] = [];
  if (isGitRepo()) {
    try {
      const tags = execGit(['tag', '-l', 'phase-*-complete']);
      if (tags) {
        phaseTags = tags.split('\n').filter(Boolean).map(tag => ({
          tag,
          commit: execGit(['rev-parse', tag]),
        }));
      }
    } catch {
      // No tags
    }
  }

  return { checkpoints, phaseTags };
}
