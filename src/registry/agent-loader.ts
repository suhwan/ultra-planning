/**
 * Agent Loader - Multi-source agent loading with load order
 *
 * Loads agent definitions from global registry first (lower loadOrder),
 * then local project (higher loadOrder). Local agents override global.
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import type { RegistrySource, RegistryConfig } from './types.js';
import { getDefaultRegistryPath, getAgentsPath, resolveRegistryPath } from './paths.js';

// Simple YAML parser using gray-matter's engine
function parseYaml(content: string): unknown {
  const result = matter(`---\n${content}\n---`);
  return result.data;
}

/**
 * Agent definition from YAML file
 *
 * Represents metadata about an agent, not the agent implementation.
 * Used for agent discovery, routing, and configuration.
 */
export interface AgentDefinition {
  /** Unique agent identifier (e.g., "thinktank/optimist") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Version string */
  version: string;
  /** Description of agent's purpose */
  description: string;
  /** Agent category (e.g., "thinktank", "development", "analysis") */
  category?: string;
  /** Model routing preferences */
  model_routing?: {
    default: 'opus' | 'sonnet' | 'haiku';
    if_simple?: 'opus' | 'sonnet' | 'haiku';
    if_complex?: 'opus' | 'sonnet' | 'haiku';
  };
  /** Agent capabilities */
  capabilities?: string[];
  /** System prompt template */
  prompt_template?: string;
  /** Context requirements */
  context?: {
    /** Required skills */
    skills?: string[];
    /** Required agents (dependencies) */
    agents?: string[];
  };
  /** Persona traits (for ThinkTank-style agents) */
  persona?: {
    role: string;
    perspective: string;
    communication_style?: string;
  };
}

/**
 * Get agent source directories with load ordering
 *
 * Sources are ordered by loadOrder (ascending - lower numbers loaded first):
 * - Global registry (loadOrder 1): ~/registry/agents/ - loaded first, can be overridden
 * - Local project (loadOrder 2): .ultraplan/agents/ - loaded last, overrides global
 *
 * @param config - Registry configuration
 * @returns Array of registry sources, ordered by loadOrder (ascending)
 */
export function getAgentSources(config?: RegistryConfig): RegistrySource[] {
  const sources: RegistrySource[] = [];

  // Global registry - loaded first (loadOrder 1), can be overridden
  const globalRegistryPath = config?.registry
    ? resolveRegistryPath(config.registry)
    : getDefaultRegistryPath();

  const globalAgentsPath = getAgentsPath(globalRegistryPath);

  if (existsSync(globalRegistryPath)) {
    if (existsSync(globalAgentsPath)) {
      sources.push({
        path: globalAgentsPath,
        loadOrder: 1, // Loaded first, can be overridden
        isGlobal: true,
      });
    } else {
      // Registry exists but agents/ subdirectory doesn't
      console.warn(
        `Registry directory exists but agents/ subdirectory not found: ${globalAgentsPath}`
      );
    }
  }

  // Local project agents - loaded last (loadOrder 2), overrides global
  const localPath = join(process.cwd(), '.ultraplan/agents');
  if (existsSync(localPath)) {
    sources.push({
      path: localPath,
      loadOrder: 2, // Loaded last, overrides earlier
      isGlobal: false,
    });
  }

  // Sort by loadOrder ascending (lower number = loaded first)
  return sources.sort((a, b) => a.loadOrder - b.loadOrder);
}

/**
 * Check if an agent ID matches selection patterns
 *
 * @param agentId - Agent ID to check
 * @param patterns - Selection patterns
 * @returns Whether the agent matches
 */
export function matchesAgentPattern(
  agentId: string,
  patterns: string[] | undefined
): boolean {
  if (!patterns || patterns.length === 0) {
    return true;
  }

  return patterns.some((pattern) => {
    if (pattern === '*') return true;
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      return agentId.startsWith(prefix + '/') || agentId === prefix;
    }
    return agentId === pattern || agentId.endsWith('/' + pattern);
  });
}

/**
 * Load agent from YAML file
 */
function loadAgentFile(filePath: string): AgentDefinition | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return parseYaml(content) as AgentDefinition;
  } catch (error) {
    console.warn(`Failed to load agent: ${filePath}`, error);
    return null;
  }
}

/**
 * Load agents from a single directory
 */
function loadAgentsFromDirectory(
  dirPath: string,
  selectionPatterns?: string[]
): Map<string, AgentDefinition> {
  const agents = new Map<string, AgentDefinition>();

  if (!existsSync(dirPath)) {
    return agents;
  }

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    let validYamlCount = 0;

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.yaml') && !entry.name.startsWith('_')) {
        // Direct YAML file in agents/
        const filePath = join(dirPath, entry.name);
        const agent = loadAgentFile(filePath);
        if (agent && matchesAgentPattern(agent.id, selectionPatterns)) {
          agents.set(agent.id, agent);
          validYamlCount++;
        }
      } else if (entry.isDirectory() && !entry.name.startsWith('_')) {
        // Subdirectory (e.g., agents/thinktank/)
        const subDir = join(dirPath, entry.name);
        const subFiles = readdirSync(subDir);

        for (const file of subFiles) {
          if (file.endsWith('.yaml') && !file.startsWith('_')) {
            const filePath = join(subDir, file);
            const agent = loadAgentFile(filePath);
            if (agent && matchesAgentPattern(agent.id, selectionPatterns)) {
              agents.set(agent.id, agent);
              validYamlCount++;
            }
          }
        }
      }
    }

    // Log warning if directory exists but has no valid YAML files
    if (validYamlCount === 0) {
      console.warn(
        `Agents directory exists but contains no valid YAML files: ${dirPath}`
      );
    }
  } catch (error) {
    console.warn(`Failed to read agents directory: ${dirPath}`, error);
  }

  return agents;
}

/**
 * Load agents from multiple sources with load order-based merging
 *
 * Agents are loaded from sources in loadOrder (ascending).
 * Later sources (higher loadOrder) override earlier sources.
 *
 * @param sources - Registry sources ordered by loadOrder
 * @param selectionPatterns - Patterns to filter agents
 * @returns Merged map of agent ID to agent definition
 */
export function loadAgentsFromSources(
  sources: RegistrySource[],
  selectionPatterns?: string[]
): Map<string, AgentDefinition> {
  const mergedAgents = new Map<string, AgentDefinition>();

  for (const source of sources) {
    const directoryAgents = loadAgentsFromDirectory(
      source.path,
      selectionPatterns
    );

    for (const [id, agent] of directoryAgents) {
      mergedAgents.set(id, agent);
    }
  }

  return mergedAgents;
}

/**
 * Load agent index from directory
 */
export function loadAgentIndex(dirPath: string): unknown | null {
  const indexPath = join(dirPath, '_index.yaml');

  if (!existsSync(indexPath)) {
    return null;
  }

  try {
    const content = readFileSync(indexPath, 'utf-8');
    return parseYaml(content);
  } catch (error) {
    console.warn(`Failed to load agent index: ${indexPath}`, error);
    return null;
  }
}
