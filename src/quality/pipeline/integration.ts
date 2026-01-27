/**
 * Quality Pipeline Integration
 *
 * Integrates quality checks with task completion workflow.
 *
 * Note: StateManager API is synchronous and requires name in constructor.
 * EventSystem exports standalone functions, not a class.
 */

import { StateManager } from '../../state/state-manager.js';
import { emitEvent } from '../../state/event-system.js';
import type { TaskCompleteContext, QualityCheckResult, PipelineOptions } from './types.js';
import { runQualityPipeline } from './executor.js';

const QUALITY_STATE_NAME = 'quality-results';

// Type for persisted quality state
interface QualityState extends Record<string, unknown> {
  checks: QualityCheckResult[];
}

/**
 * Hook to run quality pipeline after task completion
 *
 * Usage:
 * ```typescript
 * await onTaskComplete({
 *   taskId: '09-01-01',
 *   phase: '09-code-quality',
 *   plan: 1,
 *   modifiedFiles: ['src/quality/lsp/types.ts'],
 * });
 * ```
 */
export async function onTaskComplete(
  context: TaskCompleteContext,
  options?: Partial<PipelineOptions>
): Promise<QualityCheckResult> {
  // Focus on modified files if specified
  const pipelineOptions: PipelineOptions = {
    ...options,
    files: context.modifiedFiles.length > 0 ? context.modifiedFiles : undefined,
  };

  // Run pipeline
  const pipeline = await runQualityPipeline(pipelineOptions);

  const result: QualityCheckResult = {
    context,
    pipeline,
    timestamp: new Date().toISOString(),
  };

  // Persist result
  if (options?.persistResult !== false) {
    saveQualityResult(result);
  }

  // Emit event using standalone function
  try {
    emitEvent({
      type: 'task_completed',
      source: 'quality-pipeline',
      payload: {
        taskId: context.taskId,
        phase: context.phase,
        plan: context.plan,
        qualityStatus: pipeline.status,
        summary: pipeline.summary,
      },
    });
  } catch {
    // Event emission failure is non-fatal
  }

  return result;
}

/**
 * Save quality result to state file
 *
 * Note: StateManager.write() is synchronous
 */
export function saveQualityResult(result: QualityCheckResult): void {
  const state = new StateManager<QualityState>(QUALITY_STATE_NAME);

  // Load existing results
  const existing = loadQualityResult();
  const results = existing ?? { checks: [] };

  // Add new result (keep last 50)
  results.checks.unshift(result);
  if (results.checks.length > 50) {
    results.checks = results.checks.slice(0, 50);
  }

  state.write(results);
}

/**
 * Load quality results from state
 *
 * Note: StateManager.read() is synchronous, returns StateReadResult
 */
export function loadQualityResult(): QualityState | undefined {
  const state = new StateManager<QualityState>(QUALITY_STATE_NAME);
  const result = state.read();
  return result.exists ? result.data : undefined;
}

/**
 * Get latest quality check result
 */
export function getLatestQualityResult(): QualityCheckResult | undefined {
  const results = loadQualityResult();
  return results?.checks[0];
}

/**
 * Get quality results for a specific task
 */
export function getQualityResultForTask(taskId: string): QualityCheckResult | undefined {
  const results = loadQualityResult();
  return results?.checks.find(r => r.context.taskId === taskId);
}
