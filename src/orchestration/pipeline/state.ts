/**
 * Pipeline State Management
 *
 * File-based state persistence for sequential agent chaining.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type {
  Pipeline,
  PipelineState,
  PipelineStatus,
  StageResult,
} from './types.js';

const STATE_DIR = '.omc/state';
const STATE_FILE = 'pipeline-state.json';

function getStatePath(): string {
  return join(process.cwd(), STATE_DIR, STATE_FILE);
}

function ensureStateDir(): void {
  const dir = join(process.cwd(), STATE_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function loadState(): PipelineState | null {
  const path = getStatePath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function saveState(state: PipelineState): void {
  ensureStateDir();
  writeFileSync(getStatePath(), JSON.stringify(state, null, 2));
}

function generateSessionId(): string {
  return `pipeline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Initialize a pipeline session
 */
export function initPipelineSession(pipeline: Pipeline): PipelineState | null {
  const existing = loadState();
  if (existing && existing.status === 'running') {
    return null; // Already active
  }

  const state: PipelineState = {
    pipeline,
    sessionId: generateSessionId(),
    currentStage: 0,
    results: [],
    status: 'pending',
    startedAt: new Date().toISOString(),
    lastOutput: pipeline.initialInput,
  };

  saveState(state);
  return state;
}

/**
 * Start a pipeline stage
 */
export function startPipelineStage(stageIndex: number): {
  stage: Pipeline['stages'][0];
  input: string;
} | null {
  const state = loadState();
  if (!state) return null;
  if (stageIndex >= state.pipeline.stages.length) return null;

  state.currentStage = stageIndex;
  state.status = 'running';
  saveState(state);

  const stage = state.pipeline.stages[stageIndex];
  const input = state.lastOutput || state.pipeline.initialInput || '';

  // Replace {input} placeholder in prompt template
  const prompt = stage.promptTemplate.replace('{input}', input);

  return {
    stage: { ...stage, promptTemplate: prompt },
    input,
  };
}

/**
 * Complete a pipeline stage with output
 */
export function completePipelineStage(
  stageIndex: number,
  result: {
    success: boolean;
    output?: string;
    data?: unknown;
    error?: string;
    executionTimeMs?: number;
  }
): PipelineState | null {
  const state = loadState();
  if (!state) return null;

  const stage = state.pipeline.stages[stageIndex];
  if (!stage) return null;

  const stageResult: StageResult = {
    stageName: stage.name,
    success: result.success,
    output: result.output,
    data: result.data,
    error: result.error,
    executionTimeMs: result.executionTimeMs || 0,
  };

  state.results[stageIndex] = stageResult;

  if (result.success && result.output) {
    state.lastOutput = result.output;
  }

  // Check if pipeline should stop
  if (!result.success && state.pipeline.stopOnFailure) {
    state.status = 'failed';
    state.completedAt = new Date().toISOString();
  } else if (stageIndex >= state.pipeline.stages.length - 1) {
    // Last stage completed
    state.status = 'completed';
    state.completedAt = new Date().toISOString();
  }

  saveState(state);
  return state;
}

/**
 * Get input for a specific stage (previous stage's output)
 */
export function getStageInput(stageIndex: number): string | null {
  const state = loadState();
  if (!state) return null;

  if (stageIndex === 0) {
    return state.pipeline.initialInput || '';
  }

  const prevResult = state.results[stageIndex - 1];
  if (prevResult && prevResult.success && prevResult.output) {
    return prevResult.output;
  }

  return state.lastOutput || '';
}

/**
 * Get current pipeline state
 */
export function getPipelineState(): PipelineState | null {
  return loadState();
}

/**
 * End pipeline session
 */
export function endPipelineSession(status?: PipelineStatus): boolean {
  const state = loadState();
  if (!state) return false;

  state.status = status || 'completed';
  state.completedAt = new Date().toISOString();
  saveState(state);
  return true;
}

/**
 * Get next stage to execute
 */
export function getNextStage(): {
  index: number;
  stage: Pipeline['stages'][0];
  input: string;
} | null {
  const state = loadState();
  if (!state) return null;
  if (state.status === 'completed' || state.status === 'failed') return null;

  // Find next uncompleted stage
  let nextIndex = 0;
  for (let i = 0; i < state.pipeline.stages.length; i++) {
    if (!state.results[i] || !state.results[i].success) {
      nextIndex = i;
      break;
    }
  }

  if (nextIndex >= state.pipeline.stages.length) return null;

  const stage = state.pipeline.stages[nextIndex];
  const input = nextIndex === 0
    ? (state.pipeline.initialInput || '')
    : (state.results[nextIndex - 1]?.output || state.lastOutput || '');

  return { index: nextIndex, stage, input };
}
