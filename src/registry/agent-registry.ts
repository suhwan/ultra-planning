/**
 * Agent Registry - Central registry for agent definitions
 *
 * Loads agent YAML definitions from global and local registries.
 * Similar pattern to SkillRegistry but for agent metadata.
 */

import type { RegistryConfig } from './types.js';
import {
  type AgentDefinition,
  getAgentSources,
  loadAgentsFromSources,
  loadAgentIndex,
} from './agent-loader.js';

/** Agent index structure */
interface AgentIndex {
  version: string;
  categories: Record<
    string,
    {
      name: string;
      description: string;
      agents: string[];
    }
  >;
  relationships?: Record<
    string,
    {
      works_with?: string[];
      requires?: string[];
    }
  >;
}

/**
 * Agent Registry Class
 */
export class AgentRegistry {
  private agents: Map<string, AgentDefinition> = new Map();
  private index: AgentIndex | null = null;
  private config: RegistryConfig | undefined;

  constructor(config?: RegistryConfig) {
    this.config = config;
    this.loadAgents();
  }

  /**
   * Load agents from registry sources
   */
  private loadAgents(): void {
    const sources = getAgentSources(this.config);

    if (sources.length === 0) {
      console.warn('No agent sources found');
      return;
    }

    // Load agents with selection patterns
    const patterns = this.config?.use?.agents;
    this.agents = loadAgentsFromSources(sources, patterns);

    // Load and merge indexes
    for (const source of sources) {
      const index = loadAgentIndex(source.path);
      if (index && !this.index) {
        this.index = index as AgentIndex;
      } else if (index && this.index) {
        this.mergeIndex(index as AgentIndex);
      }
    }

    console.log(`Loaded ${this.agents.size} agents from ${sources.length} source(s)`);
  }

  /**
   * Merge agent index from another source.
   *
   * NOTE: This is "last-wins" merging. If both global and local define
   * the same category key, local completely replaces global's category.
   * This is intentional - local overrides should fully replace global
   * definitions for the same key, not merge them additively.
   */
  private mergeIndex(newIndex: AgentIndex): void {
    if (!this.index) {
      this.index = newIndex;
      return;
    }

    if (newIndex.categories) {
      this.index.categories = {
        ...this.index.categories,
        ...newIndex.categories,
      };
    }

    if (newIndex.relationships) {
      this.index.relationships = {
        ...this.index.relationships,
        ...newIndex.relationships,
      };
    }
  }

  /**
   * Get agent by ID
   */
  getAgent(id: string): AgentDefinition | undefined {
    return this.agents.get(id);
  }

  /**
   * Get all agents
   */
  getAllAgents(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by category
   */
  getAgentsByCategory(category: string): AgentDefinition[] {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.category === category
    );
  }

  /**
   * Check if agent exists
   */
  hasAgent(id: string): boolean {
    return this.agents.has(id);
  }

  /**
   * Get agent IDs
   */
  getAgentIds(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Get agents from category in index
   */
  getIndexedAgentsByCategory(category: string): AgentDefinition[] {
    if (!this.index?.categories[category]) {
      return [];
    }
    return this.index.categories[category].agents
      .map((id) => this.agents.get(id))
      .filter((a): a is AgentDefinition => a !== undefined);
  }

  /**
   * Get agents that work with the given agent
   */
  getRelatedAgents(agentId: string): AgentDefinition[] {
    const relationships = this.index?.relationships?.[agentId];
    if (!relationships?.works_with) {
      return [];
    }
    return relationships.works_with
      .map((id) => this.agents.get(id))
      .filter((a): a is AgentDefinition => a !== undefined);
  }
}

// Singleton instance and config tracking
let registryInstance: AgentRegistry | null = null;
let registryInstanceConfig: RegistryConfig | undefined = undefined;

/**
 * Serialize config for comparison
 */
function serializeConfig(config: RegistryConfig | undefined): string {
  if (config === undefined) return 'undefined';
  return JSON.stringify(config);
}

/**
 * Get singleton AgentRegistry instance
 *
 * @param config - Registry configuration
 * @returns Singleton AgentRegistry instance
 * @throws Error if called with different config than existing instance
 */
export function getAgentRegistry(config?: RegistryConfig): AgentRegistry {
  if (!registryInstance) {
    registryInstance = new AgentRegistry(config);
    registryInstanceConfig = config;
    return registryInstance;
  }

  // Check for config mismatch
  const existingConfigStr = serializeConfig(registryInstanceConfig);
  const newConfigStr = serializeConfig(config);

  if (existingConfigStr !== newConfigStr) {
    throw new Error(
      `AgentRegistry singleton config mismatch. ` +
      `Existing config: ${existingConfigStr}, ` +
      `New config: ${newConfigStr}. ` +
      `Call resetAgentRegistry() first to reinitialize with new config.`
    );
  }

  return registryInstance;
}

/**
 * Reset singleton registry instance
 *
 * Call this to clear the cached instance before reinitializing with new config.
 * Useful for testing or when config needs to change at runtime.
 */
export function resetAgentRegistry(): void {
  registryInstance = null;
  registryInstanceConfig = undefined;
}

// Re-export AgentDefinition for convenience
export type { AgentDefinition };
