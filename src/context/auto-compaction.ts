/**
 * Auto-Compaction Manager
 *
 * Manages automatic context compaction when usage thresholds are reached.
 * Triggers compaction, saves snapshots, and tracks state to prevent
 * multiple triggers within a single session.
 *
 * Part of Wave 2 - Plan 10-02: Threshold Detection + Auto-Compaction
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { compactWithCoreInfo, CompactedContext } from './compactor.js';
import { collectContext } from './collector.js';
import type { StateEventType } from '../state/types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for creating an AutoCompactionManager
 */
export interface AutoCompactionOptions {
  /** Path to planning directory (default: '.planning') */
  planningDir?: string;
  /** Path to snapshot directory (default: '.omc/snapshots') */
  snapshotDir?: string;
}

/**
 * Result of a compaction trigger
 */
export interface CompactionResult {
  /** Whether compaction was triggered */
  triggered: boolean;
  /** Path to saved snapshot (if triggered) */
  snapshotPath: string | null;
  /** The compacted context (if triggered) */
  compactedContext: CompactedContext | null;
  /** Error message (if failed) */
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PLANNING_DIR = '.planning';
const DEFAULT_SNAPSHOT_DIR = '.omc/snapshots';
const DEFAULT_THRESHOLD = 0.80;

// ============================================================================
// AutoCompactionManager
// ============================================================================

/**
 * Manages automatic context compaction based on usage thresholds.
 *
 * The manager tracks whether compaction has been triggered in the current
 * session to prevent multiple compactions. Once triggered, it will not
 * trigger again until reset() is called.
 *
 * @example
 * ```typescript
 * const manager = new AutoCompactionManager();
 *
 * // Check if we should trigger compaction
 * const usageRatio = 0.85; // 85% context usage
 * if (manager.shouldTrigger(usageRatio)) {
 *   const snapshotPath = manager.trigger('03-02');
 *   console.log(`Snapshot saved to: ${snapshotPath}`);
 * }
 * ```
 */
export class AutoCompactionManager {
  private triggered: boolean = false;
  private snapshotPath: string | null = null;
  private lastCompactedContext: CompactedContext | null = null;

  /**
   * Create a new AutoCompactionManager
   *
   * @param planningDir - Path to planning directory
   * @param snapshotDir - Path to snapshot directory
   */
  constructor(
    private planningDir: string = DEFAULT_PLANNING_DIR,
    private snapshotDir: string = DEFAULT_SNAPSHOT_DIR
  ) {}

  /**
   * Check if auto-compaction should be triggered
   *
   * @param usageRatio - Current context usage ratio (0.0 to 1.0)
   * @param threshold - Threshold ratio to trigger compaction (default: 0.80)
   * @returns true if compaction should be triggered
   *
   * @example
   * ```typescript
   * const manager = new AutoCompactionManager();
   * if (manager.shouldTrigger(0.85, 0.80)) {
   *   // Trigger compaction
   * }
   * ```
   */
  shouldTrigger(usageRatio: number, threshold: number = DEFAULT_THRESHOLD): boolean {
    return !this.triggered && usageRatio >= threshold;
  }

  /**
   * Trigger auto-compaction
   *
   * Collects current context, compacts it with core info extraction,
   * and saves a snapshot to disk. Throws an error if compaction has
   * already been triggered this session.
   *
   * @param currentPlanId - Optional current plan ID for context
   * @returns Path to the saved snapshot
   * @throws Error if already triggered this session
   *
   * @example
   * ```typescript
   * const manager = new AutoCompactionManager();
   * try {
   *   const snapshotPath = manager.trigger('03-02');
   *   console.log(`Saved to: ${snapshotPath}`);
   * } catch (err) {
   *   console.log('Already triggered');
   * }
   * ```
   */
  trigger(currentPlanId?: string): string {
    if (this.triggered) {
      throw new Error('Auto-compaction already triggered this session');
    }

    // 1. Compact context with core info extraction
    const compacted = compactWithCoreInfo({
      planningDir: this.planningDir,
      includeDecisions: true,
      includeIssues: true,
      includeLearnings: true,
    });

    // 2. Add plan ID to the compacted context if provided
    if (currentPlanId && compacted.activeTask) {
      compacted.activeTask.planId = currentPlanId;
    }

    // 3. Save snapshot to file
    this.snapshotPath = this.saveSnapshot(compacted);
    this.lastCompactedContext = compacted;
    this.triggered = true;

    return this.snapshotPath;
  }

  /**
   * Trigger auto-compaction with full result
   *
   * Same as trigger() but returns a full CompactionResult with
   * the compacted context included.
   *
   * @param currentPlanId - Optional current plan ID for context
   * @returns CompactionResult with snapshot path and context
   */
  triggerWithResult(currentPlanId?: string): CompactionResult {
    if (this.triggered) {
      return {
        triggered: false,
        snapshotPath: this.snapshotPath,
        compactedContext: this.lastCompactedContext,
        error: 'Auto-compaction already triggered this session',
      };
    }

    try {
      const snapshotPath = this.trigger(currentPlanId);
      return {
        triggered: true,
        snapshotPath,
        compactedContext: this.lastCompactedContext,
      };
    } catch (err) {
      return {
        triggered: false,
        snapshotPath: null,
        compactedContext: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Get the path to the last saved snapshot
   *
   * @returns Snapshot path or null if not triggered
   */
  getSnapshotPath(): string | null {
    return this.snapshotPath;
  }

  /**
   * Get the last compacted context
   *
   * @returns CompactedContext or null if not triggered
   */
  getCompactedContext(): CompactedContext | null {
    return this.lastCompactedContext;
  }

  /**
   * Check if compaction has been triggered this session
   *
   * @returns true if already triggered
   */
  hasTriggered(): boolean {
    return this.triggered;
  }

  /**
   * Reset the manager state
   *
   * Clears the triggered flag and snapshot path, allowing
   * compaction to be triggered again. Use this when starting
   * a new session or after a fresh-start.
   */
  reset(): void {
    this.triggered = false;
    this.snapshotPath = null;
    this.lastCompactedContext = null;
  }

  /**
   * Save compacted context to a snapshot file
   *
   * @param compacted - The compacted context to save
   * @returns Path to the saved snapshot file
   */
  private saveSnapshot(compacted: CompactedContext): string {
    // Ensure snapshot directory exists
    if (!existsSync(this.snapshotDir)) {
      mkdirSync(this.snapshotDir, { recursive: true });
    }

    // Generate filename with snapshot ID
    const filename = `snapshot-${compacted.snapshotId}.json`;
    const filepath = join(this.snapshotDir, filename);

    // Write snapshot to file
    writeFileSync(filepath, JSON.stringify(compacted, null, 2), 'utf-8');

    return filepath;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an AutoCompactionManager instance
 *
 * Factory function for creating AutoCompactionManager with optional
 * configuration.
 *
 * @param options - Configuration options
 * @returns AutoCompactionManager instance
 *
 * @example
 * ```typescript
 * // Use defaults
 * const manager = createAutoCompactionManager();
 *
 * // Custom directories
 * const manager = createAutoCompactionManager({
 *   planningDir: '.custom-planning',
 *   snapshotDir: '.custom-snapshots',
 * });
 * ```
 */
export function createAutoCompactionManager(
  options?: AutoCompactionOptions
): AutoCompactionManager {
  return new AutoCompactionManager(
    options?.planningDir,
    options?.snapshotDir
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an event payload for context auto-compaction trigger
 *
 * Used to emit a 'context_auto_compaction_triggered' event when
 * auto-compaction is triggered.
 *
 * @param snapshotPath - Path to the saved snapshot
 * @param usageRatio - Context usage ratio that triggered compaction
 * @param threshold - Threshold that was exceeded
 * @returns Event payload for state event system
 */
export function createAutoCompactionEventPayload(
  snapshotPath: string,
  usageRatio: number,
  threshold: number
): Record<string, unknown> {
  return {
    snapshotPath,
    usageRatio,
    threshold,
    triggeredAt: new Date().toISOString(),
  };
}
