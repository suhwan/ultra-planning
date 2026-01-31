/**
 * Prompts Module Types
 *
 * Type definitions for prompt generation in the Context Architect pattern.
 * Prompts guide Claude Code execution without managing state.
 */

import type { ArtifactReference, ArtifactCollection } from '../artifacts/types.js';

/**
 * Worker configuration for prompt generation
 */
export interface WorkerConfig {
  /** Unique worker identifier */
  id: string;
  /** Human-readable worker name */
  name: string;
  /** Worker index (0-based) */
  index: number;
}

/**
 * Context to inject into prompts
 */
export interface PromptContext {
  /** Project-level context (PROJECT.md summary) */
  project?: string;
  /** Current phase context (ROADMAP.md) */
  phase?: string;
  /** Accumulated wisdom (learnings, decisions) */
  wisdom?: string;
  /** Current plan context (PLAN.md) */
  plan?: string;
  /** Additional context */
  extra?: Record<string, string>;
  /** Artifact references (new, efficient approach) */
  artifacts?: ArtifactReference[];
  /** Artifact collections (grouped references) */
  artifactCollections?: ArtifactCollection[];
}

/**
 * Artifact-based prompt context (new approach)
 */
export interface ArtifactPromptContext {
  /** Project-level artifact references */
  project?: ArtifactCollection;
  /** Phase-specific artifact references */
  phase?: ArtifactCollection;
  /** Wisdom artifact references */
  wisdom?: ArtifactCollection;
  /** Plan artifact references */
  plan?: ArtifactCollection;
  /** Additional artifact collections */
  extra?: ArtifactCollection[];
}

/**
 * Worker prompt configuration
 */
export interface WorkerPromptConfig {
  /** Worker information */
  worker: WorkerConfig;
  /** Session ID for coordination */
  sessionId?: string;
  /** Path to current plan */
  planPath?: string;
  /** Suggested model (hint, not enforced) */
  suggestedModel?: 'haiku' | 'sonnet' | 'opus';
  /** Context to inject */
  context?: PromptContext;
  /** Accumulated learnings */
  learnings?: string;
}

/**
 * Orchestrator prompt configuration
 */
export interface OrchestratorPromptConfig {
  /** Path to plan file */
  planPath: string;
  /** Number of workers to coordinate */
  workerCount: number;
  /** Session ID for coordination */
  sessionId?: string;
  /** Context to inject */
  context?: PromptContext;
}

/**
 * Executor loop prompt configuration
 */
export interface ExecutorLoopPromptConfig {
  /** Worker ID (optional) */
  workerId?: string;
  /** Session ID */
  sessionId?: string;
  /** Path to plan */
  planPath?: string;
  /** Accumulated learnings */
  learnings?: string;
  /** Context to inject */
  context?: PromptContext;
}

/**
 * Pipeline stage prompt configuration
 */
export interface PipelinePromptConfig {
  /** Pipeline name */
  pipelineName: string;
  /** Current stage name */
  currentStage: string;
  /** Stage agent type */
  agent: string;
  /** Input from previous stage */
  input: string;
  /** Context to inject */
  context?: PromptContext;
}

/**
 * Planner prompt configuration
 */
export interface PlannerPromptConfig {
  /** Phase number to plan */
  phaseNumber: number;
  /** Phase name/description */
  phaseName: string;
  /** Research context if available */
  research?: string;
  /** Project context */
  context?: PromptContext;
}

/**
 * Model selection hint (not enforced)
 */
export interface ModelHint {
  /** Suggested model tier */
  tier: 'haiku' | 'sonnet' | 'opus';
  /** Reason for suggestion */
  reason: string;
  /** Confidence level (0-1) */
  confidence: number;
  /** Note that this is a hint */
  isHint: true;
}

/**
 * Prompt generation result
 */
export interface GeneratedPrompt {
  /** The generated prompt text */
  prompt: string;
  /** Model hint if applicable */
  modelHint?: ModelHint;
  /** Metadata about the prompt */
  metadata?: Record<string, unknown>;
}
