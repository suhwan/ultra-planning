/**
 * Pipeline Manager - Simplified for Context Architect Pattern
 *
 * Provides pipeline definitions, presets, and prompt generation support.
 * State management is delegated to Claude Code's native Task API.
 *
 * @module pipeline
 */

import {
  Pipeline,
  PipelineStage,
  PipelinePreset,
  PipelineConfig,
  PIPELINE_PRESETS,
  DEFAULT_PIPELINE_CONFIG,
} from './types.js';

// Re-export PIPELINE_PRESETS for convenience
export { PIPELINE_PRESETS };

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
// Prompt Generation
// ============================================================================

/**
 * Build prompt for a stage
 */
export function buildStagePrompt(stage: PipelineStage, input: string): string {
  return stage.promptTemplate.replaceAll('{input}', input);
}

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

Execute stages sequentially using Claude Code's Task tool:

\`\`\`
For each stage:
1. Build the prompt: buildStagePrompt(stage, previousOutput)
2. Execute with Task:
   Task(
     subagent_type: "oh-my-claudecode:{agent}",
     model: "{model}",
     prompt: "{stage prompt}"
   )
3. Capture output for next stage
4. Continue until all stages complete
\`\`\`

## Stage Details

${pipeline.stages.map((s, i) => `
### Stage ${i + 1}: ${s.name}
- **Agent**: ${s.agent}
- **Model**: ${s.model || 'default'}
- **Prompt Template**: ${s.promptTemplate.slice(0, 50)}...
${s.parallel ? '- **Mode**: Parallel (can run with other parallel stages)' : ''}
`).join('')}

## Error Handling

If stopOnFailure is true and a stage fails:
1. Report the error with context
2. Mark pipeline as failed
3. Suggest retry options

## Begin

${pipeline.initialInput
  ? `Initial input:\n${pipeline.initialInput}\n\nStart by executing Stage 1.`
  : 'Start by executing Stage 1 with the provided input.'}
`;
}

/**
 * Generate a simple stage execution prompt
 */
export function generateStagePrompt(
  stage: PipelineStage,
  input: string,
  stageNumber: number,
  totalStages: number
): string {
  return `# Pipeline Stage ${stageNumber}/${totalStages}: ${stage.name}

## Your Task

${buildStagePrompt(stage, input)}

## Context

- You are stage ${stageNumber} of ${totalStages} in a pipeline
- Your output will be passed to the next stage
- Focus on your specific task, don't try to do everything

## Output

Provide clear, structured output that the next stage can use.
`;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * List available presets
 */
export function listPresets(): Array<{
  name: PipelinePreset;
  description: string;
  stageCount: number;
}> {
  return Object.values(PIPELINE_PRESETS).map(p => ({
    name: p.name,
    description: p.description,
    stageCount: p.stages.length,
  }));
}

/**
 * Get parallel stages that can run together
 */
export function getParallelGroups(pipeline: Pipeline): PipelineStage[][] {
  const groups: PipelineStage[][] = [];
  let currentGroup: PipelineStage[] = [];

  for (const stage of pipeline.stages) {
    if (stage.parallel) {
      currentGroup.push(stage);
    } else {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
      }
      groups.push([stage]);
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Estimate pipeline duration
 */
export function estimatePipelineDuration(
  pipeline: Pipeline,
  avgStageMinutes: number = 5
): {
  estimatedMinutes: number;
  hasParallelStages: boolean;
} {
  const parallelGroups = getParallelGroups(pipeline);
  const hasParallelStages = parallelGroups.some(g => g.length > 1);

  // Each group runs sequentially, parallel stages within a group run together
  const estimatedMinutes = parallelGroups.length * avgStageMinutes;

  return { estimatedMinutes, hasParallelStages };
}

/**
 * Generate a session ID for pipeline execution
 */
export function generatePipelineSessionId(): string {
  return `pipeline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create pipeline configuration with defaults
 */
export function createPipelineConfig(options: Partial<PipelineConfig> = {}): PipelineConfig {
  return { ...DEFAULT_PIPELINE_CONFIG, ...options };
}

// ============================================================================
// DEPRECATED: State Management Functions
// ============================================================================
// These functions have been removed in v3.0 following the Context Architect pattern.
// State management is now handled by Claude Code's native Task API.
//
// Removed functions:
// - initializePipeline() - Use TaskCreate for each stage
// - startPipeline() - Use Task tool directly
// - recordStageResult() - Use TaskUpdate
// - getCurrentStage() - Track in orchestrator prompt
// - getPipelineStatus() - Use TaskList
// - pausePipeline() - Not needed with Task-based execution
// - resumePipeline() - Not needed with Task-based execution
// - cancelPipeline() - Use TaskStop if needed
//
// See: https://docs.anthropic.com/claude-code/task-api
