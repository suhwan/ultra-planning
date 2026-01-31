/**
 * Prompts Module
 *
 * Centralized prompt generation for the Context Architect pattern.
 * Generates prompts that guide Claude Code execution without managing state.
 *
 * @module prompts
 */

// Types
export type {
  WorkerConfig,
  PromptContext,
  WorkerPromptConfig,
  OrchestratorPromptConfig,
  ExecutorLoopPromptConfig,
  PipelinePromptConfig,
  PlannerPromptConfig,
  ModelHint,
  GeneratedPrompt,
} from './types.js';

// Worker prompts
export {
  generateWorkerPrompt,
  generateWorkerPromptString,
} from './worker.js';

// Orchestrator prompts
export {
  generateOrchestratorPrompt,
  generateOrchestratorPromptString,
} from './orchestrator.js';

// Executor prompts
export {
  generateExecutorLoopPrompt,
  generateExecutorLoopPromptString,
  generateHeartbeatProtocol,
} from './executor.js';

// Templates
export * from './templates/index.js';
