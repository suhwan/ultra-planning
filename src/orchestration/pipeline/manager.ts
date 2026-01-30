/**
 * Pipeline Manager
 *
 * Manages sequential agent chaining with data passing between stages.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';

import {
  Pipeline,
  PipelineStage,
  PipelineState,
  PipelineStatus,
  StageResult,
  PipelinePreset,
  PipelineConfig,
  PIPELINE_PRESETS,
  DEFAULT_PIPELINE_CONFIG,
} from './types.js';

// Re-export PIPELINE_PRESETS for convenience
export { PIPELINE_PRESETS };

// ============================================================================
// State File Management
// ============================================================================

const PIPELINE_STATE_DIR = '.ultraplan/state/pipeline';

/**
 * Get pipeline state path
 */
function getPipelineStatePath(sessionId: string, projectRoot: string = process.cwd()): string {
  return join(projectRoot, PIPELINE_STATE_DIR, `${sessionId}.json`);
}

/**
 * Load pipeline state
 */
export function loadPipelineState(
  sessionId: string,
  projectRoot: string = process.cwd()
): PipelineState | null {
  const statePath = getPipelineStatePath(sessionId, projectRoot);

  if (!existsSync(statePath)) {
    return null;
  }

  try {
    const data = readFileSync(statePath, 'utf-8');
    return JSON.parse(data) as PipelineState;
  } catch {
    return null;
  }
}

/**
 * Save pipeline state
 */
function savePipelineState(state: PipelineState, projectRoot: string = process.cwd()): void {
  const statePath = getPipelineStatePath(state.sessionId, projectRoot);
  const dir = dirname(statePath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

// ============================================================================
// Pipeline Creation
// ============================================================================

/**
 * Create a pipeline from a preset
 */
export function createPipelineFromPreset(
  preset: PipelinePreset,
  initialInput?: string
): Pipeline {
  const presetConfig = PIPELINE_PRESETS[preset];

  return {
    name: presetConfig.name,
    description: presetConfig.description,
    stages: [...presetConfig.stages],
    initialInput,
    stopOnFailure: true,
  };
}

/**
 * Create a custom pipeline
 */
export function createCustomPipeline(
  name: string,
  description: string,
  stages: PipelineStage[],
  options?: {
    initialInput?: string;
    stopOnFailure?: boolean;
    timeoutMs?: number;
  }
): Pipeline {
  return {
    name,
    description,
    stages,
    initialInput: options?.initialInput,
    stopOnFailure: options?.stopOnFailure ?? true,
    timeoutMs: options?.timeoutMs,
  };
}

/**
 * Parse a pipeline definition string
 * Format: "agent1:model1 -> agent2:model2 -> agent3:model3"
 */
export function parsePipelineString(
  pipelineStr: string,
  name: string = 'Custom Pipeline'
): Pipeline {
  const stages: PipelineStage[] = [];
  const parts = pipelineStr.split('->').map(p => p.trim());

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const [agent, model] = part.split(':').map(s => s.trim());

    stages.push({
      name: `stage-${i + 1}`,
      agent: agent as PipelineStage['agent'],
      model: model as PipelineStage['model'],
      promptTemplate: i === 0 ? '{input}' : 'Continue with:\n{input}',
    });
  }

  return {
    name,
    description: `Custom pipeline: ${pipelineStr}`,
    stages,
    stopOnFailure: true,
  };
}

// ============================================================================
// Pipeline Initialization
// ============================================================================

/**
 * Initialize a pipeline for execution
 */
export function initializePipeline(
  pipeline: Pipeline,
  projectRoot: string = process.cwd()
): PipelineState {
  const sessionId = randomUUID();

  const state: PipelineState = {
    pipeline,
    sessionId,
    currentStage: 0,
    results: [],
    status: 'pending',
    startedAt: new Date().toISOString(),
    lastOutput: pipeline.initialInput,
  };

  savePipelineState(state, projectRoot);

  return state;
}

// ============================================================================
// Stage Execution
// ============================================================================

/**
 * Build prompt for a stage
 */
export function buildStagePrompt(stage: PipelineStage, input: string): string {
  return stage.promptTemplate.replace('{input}', input);
}

/**
 * Record stage result
 */
export function recordStageResult(
  sessionId: string,
  result: StageResult,
  projectRoot: string = process.cwd()
): PipelineState | null {
  const state = loadPipelineState(sessionId, projectRoot);
  if (!state) return null;

  state.results.push(result);

  if (result.success) {
    state.lastOutput = result.output;
    state.currentStage++;

    // Check if pipeline is complete
    if (state.currentStage >= state.pipeline.stages.length) {
      state.status = 'completed';
      state.completedAt = new Date().toISOString();
    }
  } else if (state.pipeline.stopOnFailure) {
    state.status = 'failed';
    state.completedAt = new Date().toISOString();
  } else {
    // Continue to next stage even on failure
    state.currentStage++;
    if (state.currentStage >= state.pipeline.stages.length) {
      state.status = 'completed';
      state.completedAt = new Date().toISOString();
    }
  }

  savePipelineState(state, projectRoot);

  return state;
}

/**
 * Get current stage to execute
 */
export function getCurrentStage(
  sessionId: string,
  projectRoot: string = process.cwd()
): { stage: PipelineStage; input: string } | null {
  const state = loadPipelineState(sessionId, projectRoot);
  if (!state) return null;
  if (state.status !== 'running' && state.status !== 'pending') return null;
  if (state.currentStage >= state.pipeline.stages.length) return null;

  const stage = state.pipeline.stages[state.currentStage];
  const input = state.lastOutput || '';

  return { stage, input };
}

/**
 * Get parallel stages that can run together
 */
export function getParallelStages(
  sessionId: string,
  projectRoot: string = process.cwd()
): { stages: PipelineStage[]; input: string } | null {
  const state = loadPipelineState(sessionId, projectRoot);
  if (!state) return null;
  if (state.status !== 'running' && state.status !== 'pending') return null;

  const parallelStages: PipelineStage[] = [];
  let idx = state.currentStage;

  // Collect consecutive parallel stages
  while (idx < state.pipeline.stages.length) {
    const stage = state.pipeline.stages[idx];
    if (stage.parallel) {
      parallelStages.push(stage);
      idx++;
    } else if (parallelStages.length === 0) {
      // First non-parallel stage - just return it
      parallelStages.push(stage);
      break;
    } else {
      // End of parallel group
      break;
    }
  }

  return {
    stages: parallelStages,
    input: state.lastOutput || '',
  };
}

// ============================================================================
// Pipeline Control
// ============================================================================

/**
 * Start pipeline execution
 */
export function startPipeline(
  sessionId: string,
  projectRoot: string = process.cwd()
): boolean {
  const state = loadPipelineState(sessionId, projectRoot);
  if (!state) return false;

  state.status = 'running';
  savePipelineState(state, projectRoot);

  return true;
}

/**
 * Pause pipeline execution
 */
export function pausePipeline(
  sessionId: string,
  projectRoot: string = process.cwd()
): boolean {
  const state = loadPipelineState(sessionId, projectRoot);
  if (!state) return false;

  state.status = 'paused';
  savePipelineState(state, projectRoot);

  return true;
}

/**
 * Resume pipeline execution
 */
export function resumePipeline(
  sessionId: string,
  projectRoot: string = process.cwd()
): boolean {
  const state = loadPipelineState(sessionId, projectRoot);
  if (!state || state.status !== 'paused') return false;

  state.status = 'running';
  savePipelineState(state, projectRoot);

  return true;
}

/**
 * Cancel pipeline execution
 */
export function cancelPipeline(
  sessionId: string,
  projectRoot: string = process.cwd()
): boolean {
  const state = loadPipelineState(sessionId, projectRoot);
  if (!state) return false;

  state.status = 'cancelled';
  state.completedAt = new Date().toISOString();
  savePipelineState(state, projectRoot);

  return true;
}

/**
 * Get pipeline status
 */
export function getPipelineStatus(
  sessionId: string,
  projectRoot: string = process.cwd()
): {
  status: PipelineStatus;
  currentStage: number;
  totalStages: number;
  results: StageResult[];
} | null {
  const state = loadPipelineState(sessionId, projectRoot);
  if (!state) return null;

  return {
    status: state.status,
    currentStage: state.currentStage,
    totalStages: state.pipeline.stages.length,
    results: state.results,
  };
}

/**
 * Get full pipeline state
 */
export function getPipelineState(
  sessionId: string,
  projectRoot: string = process.cwd()
): PipelineState | null {
  return loadPipelineState(sessionId, projectRoot);
}

// ============================================================================
// Prompt Generation
// ============================================================================

/**
 * Generate orchestrator prompt for pipeline execution
 */
export function generatePipelineOrchestratorPrompt(
  pipeline: Pipeline,
  sessionId: string
): string {
  const stageList = pipeline.stages
    .map((s, i) => `${i + 1}. ${s.name} (${s.agent}${s.model ? `:${s.model}` : ''})`)
    .join('\n');

  return `# Pipeline Orchestrator: ${pipeline.name}

${pipeline.description}

## Session
- **Session ID**: ${sessionId}

## Pipeline Stages
${stageList}

## Execution Protocol

For each stage:

1. Get current stage info from getPipelineStatus
2. Build the stage prompt using buildStagePrompt
3. Execute using Task tool:
   \`\`\`
   Task(
     subagent_type: "oh-my-claudecode:{agent}",
     model: "{model}",
     prompt: "{stage prompt}"
   )
   \`\`\`
4. Record result using recordStageResult
5. Continue to next stage

## Stage Execution

Execute stages sequentially, passing output from each stage as input to the next.

If a stage has \`parallel: true\`, execute it concurrently with other parallel stages.

## Error Handling

If stopOnFailure is true and a stage fails:
1. Record the failure
2. Mark pipeline as failed
3. Report the error

## Begin

Start by calling startPipeline, then execute the first stage.
`;
}

/**
 * List available presets
 */
export function listPresets(): Array<{ name: PipelinePreset; description: string }> {
  return Object.values(PIPELINE_PRESETS).map(p => ({
    name: p.name,
    description: p.description,
  }));
}
