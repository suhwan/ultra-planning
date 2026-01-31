/**
 * Project Configuration Types
 *
 * Extended configuration for Ultra Planner projects including
 * registry settings for cross-project skill/agent sharing.
 */

import type { RegistryConfig } from '../registry/types.js';

/**
 * Model routing profile configuration
 */
export interface ModelRoutingProfile {
  /** Profile description */
  description: string;
  /** Model routing by task type */
  routing: {
    research: 'opus' | 'sonnet' | 'haiku';
    planning: 'opus' | 'sonnet' | 'haiku';
    execution: 'opus' | 'sonnet' | 'haiku';
    verification: 'opus' | 'sonnet' | 'haiku';
    simple_tasks: 'opus' | 'sonnet' | 'haiku';
  };
  /** Agent tier selection */
  agents: {
    'build-fixer': string;
    'security-reviewer': string;
    'code-reviewer': string;
  };
}

/**
 * Execution settings
 */
export interface ExecutionSettings {
  /** Automatically fix build errors */
  autoFixBuildErrors: boolean;
  /** Run security review automatically */
  autoSecurityReview: boolean;
  /** Run code review automatically */
  autoCodeReview: boolean;
  /** Maximum build fix attempts */
  maxBuildFixAttempts: number;
  /** Enable TDD mode */
  enableTDD: boolean;
}

/**
 * Verification settings
 */
export interface VerificationSettings {
  /** Maximum ralplan iterations */
  ralplanMaxIterations: number;
  /** Architect leniency (0-1) */
  architectLeniency: number;
  /** Require security pass before completion */
  requireSecurityPass: boolean;
}

/**
 * Registry settings for cross-project sharing
 */
export interface RegistrySettings {
  /** Path to global registry (default: ~/registry) */
  registry?: string;
  /** Selection patterns for agents and skills */
  use?: {
    /** Glob patterns for agent selection */
    agents?: string[];
    /** Glob patterns for skill selection */
    skills?: string[];
  };
}

/**
 * Complete project configuration
 */
export interface ProjectConfig {
  /** Config version */
  version: string;
  /** Execution mode (interactive, batch, autopilot) */
  mode: 'interactive' | 'batch' | 'autopilot';
  /** Planning depth */
  depth: 'quick' | 'standard' | 'comprehensive';
  /** Enable parallelization */
  parallelization: boolean;
  /** Maximum parallel workers */
  max_workers: number;
  /** Commit planning docs */
  commit_docs: boolean;

  /** Active model profile name */
  modelProfile: string;
  /** Available model profiles */
  profiles: Record<string, ModelRoutingProfile>;

  /** Execution settings */
  execution: ExecutionSettings;

  /** Verification settings */
  verification: VerificationSettings;

  /** Registry settings (optional, new in v4) */
  registry?: RegistrySettings;
}

/**
 * Convert RegistrySettings to RegistryConfig for use with registries
 */
export function toRegistryConfig(settings?: RegistrySettings): RegistryConfig | undefined {
  if (!settings) {
    return undefined;
  }

  return {
    registry: settings.registry,
    use: settings.use,
  };
}

/**
 * Default registry settings
 */
export const DEFAULT_REGISTRY_SETTINGS: RegistrySettings = {
  registry: '~/registry',
  use: {
    agents: ['*'],
    skills: ['*'],
  },
};
