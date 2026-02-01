/**
 * Registry Metadata - Load and query registry.json
 *
 * Provides metadata management for skills and agents including:
 * - Version tracking
 * - Dependencies (requires)
 * - Tags for discovery
 * - Model/tool specifications for agents
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getDefaultRegistryPath, resolveRegistryPath } from './paths.js';

// ============================================================================
// Types
// ============================================================================

/** Skill metadata in registry.json */
export interface SkillMetadata {
  file: string;
  description: string;
  tags: string[];
  requires: string[];
}

/** Agent metadata in registry.json */
export interface AgentMetadata {
  file: string;
  description: string;
  model: 'opus' | 'sonnet' | 'haiku';
  tools: string[];
  tags: string[];
}

/** Skill group (e.g., ultraplan, gsd, omc) */
export interface SkillGroup {
  version: string;
  description: string;
  items: Record<string, SkillMetadata>;
}

/** Agent group (e.g., ultraplan, gsd, omc) */
export interface AgentGroup {
  version: string;
  description: string;
  items: Record<string, AgentMetadata>;
}

/** Full registry.json structure */
export interface RegistryManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  lastUpdated: string;
  skills: Record<string, SkillGroup>;
  agents: Record<string, AgentGroup>;
}

// ============================================================================
// Loader
// ============================================================================

const REGISTRY_MANIFEST_FILE = 'registry.json';

/** Cache for loaded manifest */
let cachedManifest: RegistryManifest | null = null;
let cachedManifestPath: string | null = null;

/**
 * Load registry.json from registry path
 *
 * @param registryPath - Path to registry (default: ~/.claude/registry)
 * @returns Parsed manifest or null if not found
 */
export function loadRegistryManifest(registryPath?: string): RegistryManifest | null {
  const resolvedPath = registryPath
    ? resolveRegistryPath(registryPath)
    : getDefaultRegistryPath();

  const manifestPath = join(resolvedPath, REGISTRY_MANIFEST_FILE);

  // Return cached if same path
  if (cachedManifest && cachedManifestPath === manifestPath) {
    return cachedManifest;
  }

  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    const content = readFileSync(manifestPath, 'utf-8');
    cachedManifest = JSON.parse(content) as RegistryManifest;
    cachedManifestPath = manifestPath;
    return cachedManifest;
  } catch {
    return null;
  }
}

/**
 * Clear manifest cache (for testing)
 */
export function clearManifestCache(): void {
  cachedManifest = null;
  cachedManifestPath = null;
}

// ============================================================================
// Skill Queries
// ============================================================================

/**
 * Get all skill groups
 */
export function getSkillGroups(registryPath?: string): Record<string, SkillGroup> {
  const manifest = loadRegistryManifest(registryPath);
  return manifest?.skills ?? {};
}

/**
 * Get skill metadata by group and name
 *
 * @param group - Skill group (e.g., 'ultraplan')
 * @param name - Skill name (e.g., 'execute')
 */
export function getSkillMetadata(
  group: string,
  name: string,
  registryPath?: string
): SkillMetadata | null {
  const groups = getSkillGroups(registryPath);
  return groups[group]?.items[name] ?? null;
}

/**
 * Find skills by tag
 *
 * @param tag - Tag to search for
 * @returns Array of [group, name, metadata] tuples
 */
export function findSkillsByTag(
  tag: string,
  registryPath?: string
): Array<[string, string, SkillMetadata]> {
  const groups = getSkillGroups(registryPath);
  const results: Array<[string, string, SkillMetadata]> = [];

  for (const [groupName, group] of Object.entries(groups)) {
    for (const [skillName, metadata] of Object.entries(group.items)) {
      if (metadata.tags.includes(tag)) {
        results.push([groupName, skillName, metadata]);
      }
    }
  }

  return results;
}

/**
 * Get skill dependencies (requires)
 */
export function getSkillDependencies(
  group: string,
  name: string,
  registryPath?: string
): string[] {
  const metadata = getSkillMetadata(group, name, registryPath);
  return metadata?.requires ?? [];
}

/**
 * List all skills with their metadata
 */
export function listAllSkills(
  registryPath?: string
): Array<{ group: string; name: string; metadata: SkillMetadata }> {
  const groups = getSkillGroups(registryPath);
  const results: Array<{ group: string; name: string; metadata: SkillMetadata }> = [];

  for (const [groupName, group] of Object.entries(groups)) {
    for (const [skillName, metadata] of Object.entries(group.items)) {
      results.push({ group: groupName, name: skillName, metadata });
    }
  }

  return results;
}

// ============================================================================
// Agent Queries
// ============================================================================

/**
 * Get all agent groups
 */
export function getAgentGroups(registryPath?: string): Record<string, AgentGroup> {
  const manifest = loadRegistryManifest(registryPath);
  return manifest?.agents ?? {};
}

/**
 * Get agent metadata by group and name
 *
 * @param group - Agent group (e.g., 'ultraplan')
 * @param name - Agent name (e.g., 'executor')
 */
export function getAgentMetadata(
  group: string,
  name: string,
  registryPath?: string
): AgentMetadata | null {
  const groups = getAgentGroups(registryPath);
  return groups[group]?.items[name] ?? null;
}

/**
 * Find agents by tag
 *
 * @param tag - Tag to search for
 * @returns Array of [group, name, metadata] tuples
 */
export function findAgentsByTag(
  tag: string,
  registryPath?: string
): Array<[string, string, AgentMetadata]> {
  const groups = getAgentGroups(registryPath);
  const results: Array<[string, string, AgentMetadata]> = [];

  for (const [groupName, group] of Object.entries(groups)) {
    for (const [agentName, metadata] of Object.entries(group.items)) {
      if (metadata.tags.includes(tag)) {
        results.push([groupName, agentName, metadata]);
      }
    }
  }

  return results;
}

/**
 * Find agents by model tier
 *
 * @param model - Model tier ('opus', 'sonnet', 'haiku')
 */
export function findAgentsByModel(
  model: 'opus' | 'sonnet' | 'haiku',
  registryPath?: string
): Array<[string, string, AgentMetadata]> {
  const groups = getAgentGroups(registryPath);
  const results: Array<[string, string, AgentMetadata]> = [];

  for (const [groupName, group] of Object.entries(groups)) {
    for (const [agentName, metadata] of Object.entries(group.items)) {
      if (metadata.model === model) {
        results.push([groupName, agentName, metadata]);
      }
    }
  }

  return results;
}

/**
 * Get agent tools
 */
export function getAgentTools(
  group: string,
  name: string,
  registryPath?: string
): string[] {
  const metadata = getAgentMetadata(group, name, registryPath);
  return metadata?.tools ?? [];
}

/**
 * List all agents with their metadata
 */
export function listAllAgents(
  registryPath?: string
): Array<{ group: string; name: string; metadata: AgentMetadata }> {
  const groups = getAgentGroups(registryPath);
  const results: Array<{ group: string; name: string; metadata: AgentMetadata }> = [];

  for (const [groupName, group] of Object.entries(groups)) {
    for (const [agentName, metadata] of Object.entries(group.items)) {
      results.push({ group: groupName, name: agentName, metadata });
    }
  }

  return results;
}

// ============================================================================
// Registry Info
// ============================================================================

/**
 * Get registry version info
 */
export function getRegistryInfo(registryPath?: string): {
  name: string;
  version: string;
  lastUpdated: string;
  skillCount: number;
  agentCount: number;
} | null {
  const manifest = loadRegistryManifest(registryPath);
  if (!manifest) return null;

  let skillCount = 0;
  let agentCount = 0;

  for (const group of Object.values(manifest.skills)) {
    skillCount += Object.keys(group.items).length;
  }

  for (const group of Object.values(manifest.agents)) {
    agentCount += Object.keys(group.items).length;
  }

  return {
    name: manifest.name,
    version: manifest.version,
    lastUpdated: manifest.lastUpdated,
    skillCount,
    agentCount,
  };
}
