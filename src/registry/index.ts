/**
 * Central Registry Module
 *
 * Provides cross-project skill/agent sharing via global and local registries.
 *
 * Directory structure:
 * ~/registry/           # Global registry
 *   agents/             # Agent YAML definitions
 *   skills/             # Skill YAML definitions
 * .ultraplan/           # Local project overrides
 *   skills/             # Project-specific skills (override global)
 */

// Types
export type {
  RegistrySource,
  RegistryConfig,
  SkillSelection,
  AgentSelection,
} from './types.js';

export {
  DEFAULT_REGISTRY_DIR,
  SKILLS_SUBDIR,
  AGENTS_SUBDIR,
} from './types.js';

// Path utilities
export {
  expandTilde,
  resolveRegistryPath,
  getDefaultRegistryPath,
  getSkillsPath,
  getAgentsPath,
  registryExists,
  skillsExist,
  agentsExist,
} from './paths.js';

// Agent loader
export {
  type AgentDefinition,
  getAgentSources,
  loadAgentsFromSources,
  matchesAgentPattern,
  loadAgentIndex,
} from './agent-loader.js';

// Agent registry
export {
  AgentRegistry,
  getAgentRegistry,
  resetAgentRegistry,
} from './agent-registry.js';

// Skill loader
export {
  getSkillSources,
  loadSkillsFromSources,
  matchesSelectionPattern,
  loadSkillIndex,
} from './skill-loader.js';
