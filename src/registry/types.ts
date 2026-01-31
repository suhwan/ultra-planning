/**
 * Registry Types - Central registry for cross-project skill/agent sharing
 */

/**
 * Registry source with load ordering
 *
 * loadOrder determines which sources can override others:
 * - Lower number = loaded earlier = can be overridden by later sources
 * - Higher number = loaded later = overrides earlier sources
 *
 * Example:
 * - Global (loadOrder: 1) loaded first, can be overridden
 * - Local (loadOrder: 2) loaded last, overrides global
 */
export interface RegistrySource {
  /** Absolute path to the registry directory */
  path: string;
  /** Load order (lower = loaded first = can be overridden, higher = loaded last = overrides) */
  loadOrder: number;
  /** Whether this is the global registry */
  isGlobal: boolean;
}

/** Configuration for registry paths and skill/agent selection */
export interface RegistryConfig {
  /** Path to global registry (default: ~/registry) */
  registry?: string;
  /** Skill/agent selection patterns */
  use?: {
    /** Glob patterns for agent selection (e.g., ["thinktank/*", "development/executor"]) */
    agents?: string[];
    /** Glob patterns for skill selection (e.g., ["thinktank/*", "development/build-fix"]) */
    skills?: string[];
  };
}

/** Skill selection result after pattern matching */
export interface SkillSelection {
  /** Skill ID that matched */
  skillId: string;
  /** Pattern that matched */
  matchedPattern: string;
  /** Source registry (global or local) */
  source: RegistrySource;
}

/** Agent selection result after pattern matching */
export interface AgentSelection {
  /** Agent ID that matched */
  agentId: string;
  /** Pattern that matched */
  matchedPattern: string;
  /** Source registry (global or local) */
  source: RegistrySource;
}

/** Default registry path relative to home directory */
export const DEFAULT_REGISTRY_DIR = 'registry';

/** Skills subdirectory within registry */
export const SKILLS_SUBDIR = 'skills';

/** Agents subdirectory within registry */
export const AGENTS_SUBDIR = 'agents';
