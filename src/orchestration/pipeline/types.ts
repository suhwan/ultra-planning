/**
 * Pipeline Pattern Types
 *
 * Types for sequential agent chaining with data passing between stages.
 * Uses native Claude Code Task tool for stage execution.
 */

// ============================================================================
// Stage Types
// ============================================================================

/** Model tier for a stage (imported from delegation, not re-exported to avoid conflicts) */
import type { ModelTier } from '../delegation/types.js';
// ModelTier is used internally but not re-exported to avoid conflict with delegation/types.js
export type { ModelTier as PipelineModelTier };

/** Agent type for a stage */
export type AgentType =
  | 'explore'
  | 'explore-medium'
  | 'explore-high'
  | 'executor'
  | 'executor-low'
  | 'executor-high'
  | 'architect'
  | 'architect-low'
  | 'architect-medium'
  | 'planner'
  | 'critic'
  | 'designer'
  | 'designer-low'
  | 'designer-high'
  | 'writer'
  | 'researcher'
  | 'researcher-low'
  | 'qa-tester'
  | 'qa-tester-high'
  | 'build-fixer'
  | 'build-fixer-low'
  | 'security-reviewer'
  | 'security-reviewer-low'
  | 'tdd-guide'
  | 'tdd-guide-low'
  | 'scientist'
  | 'scientist-low'
  | 'scientist-high';

/** Pipeline stage definition */
export interface PipelineStage {
  /** Stage name */
  name: string;
  /** Agent type to use */
  agent: AgentType;
  /** Model tier (overrides agent default) */
  model?: ModelTier;
  /** Stage prompt template (use {input} for previous stage output) */
  promptTemplate: string;
  /** Input transformation function name */
  inputTransform?: string;
  /** Output extraction pattern (regex or jq-like) */
  outputExtract?: string;
  /** Whether this stage can run in parallel with others */
  parallel?: boolean;
  /** Condition to skip this stage */
  skipIf?: string;
  /** Timeout in ms */
  timeoutMs?: number;
}

/** Stage execution result */
export interface StageResult {
  /** Stage name */
  stageName: string;
  /** Whether stage succeeded */
  success: boolean;
  /** Stage output */
  output?: string;
  /** Structured data extracted */
  data?: unknown;
  /** Error message if failed */
  error?: string;
  /** Execution time in ms */
  executionTimeMs: number;
  /** Whether stage was skipped */
  skipped?: boolean;
  /** Skip reason */
  skipReason?: string;
}

// ============================================================================
// Pipeline Types
// ============================================================================

/** Pipeline definition */
export interface Pipeline {
  /** Pipeline name */
  name: string;
  /** Pipeline description */
  description: string;
  /** Stages to execute */
  stages: PipelineStage[];
  /** Initial input for first stage */
  initialInput?: string;
  /** Whether to stop on first failure */
  stopOnFailure: boolean;
  /** Global timeout in ms */
  timeoutMs?: number;
}

/** Pipeline execution state */
export interface PipelineState {
  /** Pipeline being executed */
  pipeline: Pipeline;
  /** Session ID */
  sessionId: string;
  /** Current stage index */
  currentStage: number;
  /** Results from each stage */
  results: StageResult[];
  /** Overall status */
  status: PipelineStatus;
  /** Started timestamp */
  startedAt: string;
  /** Completed timestamp */
  completedAt?: string;
  /** Last output (passed to next stage) */
  lastOutput?: string;
}

/** Pipeline status */
export type PipelineStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

// ============================================================================
// Built-in Presets
// ============================================================================

/** Pipeline preset names */
export type PipelinePreset =
  | 'review'      // explore → architect → critic → executor
  | 'implement'   // planner → executor → tdd-guide
  | 'debug'       // explore → architect → build-fixer
  | 'research'    // researcher + explore (parallel) → architect → writer
  | 'refactor'    // explore → architect-medium → executor-high → qa-tester
  | 'security';   // explore → security-reviewer → executor → security-reviewer-low

/** Preset configuration */
export interface PipelinePresetConfig {
  /** Preset name */
  name: PipelinePreset;
  /** Preset description */
  description: string;
  /** Stage definitions */
  stages: PipelineStage[];
}

// ============================================================================
// Built-in Preset Definitions
// ============================================================================

export const PIPELINE_PRESETS: Record<PipelinePreset, PipelinePresetConfig> = {
  review: {
    name: 'review',
    description: 'Code review pipeline: explore → analyze → critique → fix',
    stages: [
      {
        name: 'explore',
        agent: 'explore',
        model: 'haiku',
        promptTemplate: 'Find all relevant files for: {input}',
      },
      {
        name: 'analyze',
        agent: 'architect',
        model: 'opus',
        promptTemplate: 'Analyze the code found:\n{input}\n\nIdentify issues, patterns, and improvement areas.',
      },
      {
        name: 'critique',
        agent: 'critic',
        model: 'opus',
        promptTemplate: 'Review this analysis:\n{input}\n\nProvide actionable feedback.',
      },
      {
        name: 'fix',
        agent: 'executor',
        model: 'sonnet',
        promptTemplate: 'Implement these improvements:\n{input}',
      },
    ],
  },

  implement: {
    name: 'implement',
    description: 'Feature implementation: plan → execute → test',
    stages: [
      {
        name: 'plan',
        agent: 'planner',
        model: 'opus',
        promptTemplate: 'Create an implementation plan for: {input}',
      },
      {
        name: 'execute',
        agent: 'executor',
        model: 'sonnet',
        promptTemplate: 'Implement according to this plan:\n{input}',
      },
      {
        name: 'test',
        agent: 'tdd-guide',
        model: 'sonnet',
        promptTemplate: 'Write tests for the implementation:\n{input}',
      },
    ],
  },

  debug: {
    name: 'debug',
    description: 'Debug pipeline: explore → analyze → fix',
    stages: [
      {
        name: 'explore',
        agent: 'explore-medium',
        model: 'sonnet',
        promptTemplate: 'Find code related to this issue: {input}',
      },
      {
        name: 'analyze',
        agent: 'architect',
        model: 'opus',
        promptTemplate: 'Analyze the root cause of:\n{input}',
      },
      {
        name: 'fix',
        agent: 'build-fixer',
        model: 'sonnet',
        promptTemplate: 'Fix the issue based on this analysis:\n{input}',
      },
    ],
  },

  research: {
    name: 'research',
    description: 'Research pipeline: research + explore → synthesize → document',
    stages: [
      {
        name: 'research-external',
        agent: 'researcher',
        model: 'sonnet',
        promptTemplate: 'Research external resources about: {input}',
        parallel: true,
      },
      {
        name: 'explore-codebase',
        agent: 'explore-medium',
        model: 'sonnet',
        promptTemplate: 'Find relevant code for: {input}',
        parallel: true,
      },
      {
        name: 'synthesize',
        agent: 'architect',
        model: 'opus',
        promptTemplate: 'Synthesize findings:\n{input}',
      },
      {
        name: 'document',
        agent: 'writer',
        model: 'haiku',
        promptTemplate: 'Document the findings:\n{input}',
      },
    ],
  },

  refactor: {
    name: 'refactor',
    description: 'Refactoring pipeline: explore → plan → execute → verify',
    stages: [
      {
        name: 'explore',
        agent: 'explore-medium',
        model: 'sonnet',
        promptTemplate: 'Understand the code to refactor: {input}',
      },
      {
        name: 'plan',
        agent: 'architect-medium',
        model: 'sonnet',
        promptTemplate: 'Create a refactoring plan:\n{input}',
      },
      {
        name: 'execute',
        agent: 'executor-high',
        model: 'opus',
        promptTemplate: 'Execute the refactoring:\n{input}',
      },
      {
        name: 'verify',
        agent: 'qa-tester',
        model: 'sonnet',
        promptTemplate: 'Verify the refactoring:\n{input}',
      },
    ],
  },

  security: {
    name: 'security',
    description: 'Security review: explore → audit → fix → re-audit',
    stages: [
      {
        name: 'explore',
        agent: 'explore',
        model: 'haiku',
        promptTemplate: 'Find security-relevant code: {input}',
      },
      {
        name: 'audit',
        agent: 'security-reviewer',
        model: 'opus',
        promptTemplate: 'Perform security audit:\n{input}',
      },
      {
        name: 'fix',
        agent: 'executor',
        model: 'sonnet',
        promptTemplate: 'Fix security issues:\n{input}',
      },
      {
        name: 're-audit',
        agent: 'security-reviewer-low',
        model: 'haiku',
        promptTemplate: 'Verify fixes:\n{input}',
      },
    ],
  },
};

// ============================================================================
// Configuration
// ============================================================================

/** Pipeline configuration */
export interface PipelineConfig {
  /** Default timeout per stage in ms */
  defaultStageTimeoutMs: number;
  /** Overall pipeline timeout in ms */
  pipelineTimeoutMs: number;
  /** Whether to stop on first failure */
  stopOnFailure: boolean;
  /** Whether to run parallel stages concurrently */
  enableParallel: boolean;
}

/** Default pipeline configuration */
export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  defaultStageTimeoutMs: 300000, // 5 minutes
  pipelineTimeoutMs: 1800000,   // 30 minutes
  stopOnFailure: true,
  enableParallel: true,
};
