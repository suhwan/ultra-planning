/**
 * Central Registry Module
 *
 * Provides cross-project skill/agent sharing via global and local registries.
 *
 * Directory structure:
 * ~/.claude/registry/   # Global registry (git repo)
 *   registry.json       # Metadata manifest
 *   agents/             # Agent definitions
 *     ultraplan/        # Ultraplan agents
 *   skills/             # Skill definitions
 *     ultraplan/        # Ultraplan skills
 * .claude/              # Local project overrides
 *   agents/             # Project-specific agents
 *   skills/             # Project-specific skills
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

// Metadata loader
export type {
  SkillMetadata,
  AgentMetadata,
  SkillGroup,
  AgentGroup,
  RegistryManifest,
} from './metadata.js';

export {
  loadRegistryManifest,
  clearManifestCache,
  getSkillGroups,
  getSkillMetadata,
  findSkillsByTag,
  getSkillDependencies,
  listAllSkills,
  getAgentGroups,
  getAgentMetadata,
  findAgentsByTag,
  findAgentsByModel,
  getAgentTools,
  listAllAgents,
  getRegistryInfo,
} from './metadata.js';
