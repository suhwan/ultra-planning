/**
 * Orchestration module - Multi-agent coordination and workflow orchestration
 *
 * Provides tools for coordinating multiple agents and tracking their work.
 */

// Ultrapilot module - parallel worker coordination
export * from './ultrapilot/index.js';

// Keywords module - magic keyword detection and prompt enhancement
export * from './keywords/index.js';

// Ralplan module - iterative plan refinement loop
export * from './ralplan/index.js';

// Verdicts module - agent verdict types and checklist logic
export * from './verdicts/index.js';

// Revision module - plan versioning and modification
export * from './revision/index.js';

// Deviation module - executor deviation handling
export * from './deviation/index.js';

// Spike module - high-uncertainty task handling
export * from './spike/index.js';

// Swarm module - parallel worker coordination with task claiming
export * from './swarm/index.js';

// Pipeline module - sequential agent chaining (v3.0 simplified)
// State management delegated to Claude Code, only prompt generation retained
export {
  // Types (renamed to avoid conflicts with quality/pipeline types)
  type Pipeline,
  type PipelineState,
  type PipelineConfig,
  type PipelinePreset,
  type PipelinePresetConfig,
  type AgentType,
  type PipelineModelTier,
  // Rename conflicting types
  type PipelineStage as AgentPipelineStage,
  type StageResult as AgentStageResult,
  type PipelineStatus as AgentPipelineStatus,
  // Constants
  PIPELINE_PRESETS,
  DEFAULT_PIPELINE_CONFIG,
  // Functions (prompt generation only)
  createPipelineFromPreset,
  createCustomPipeline,
  parsePipelineString,
  buildStagePrompt,
  getParallelGroups,
  generatePipelineOrchestratorPrompt,
  generateStagePrompt,
  listPresets,
  estimatePipelineDuration,
  generatePipelineSessionId,
  createPipelineConfig,
} from './pipeline/index.js';

// Delegation module - task routing based on complexity
export * from './delegation/index.js';
