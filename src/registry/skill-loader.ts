/**
 * Skill Loader - Multi-source skill loading with load order
 *
 * Loads skills from global registry first (lower loadOrder), then local
 * project (higher loadOrder). Local skills override global skills with same ID.
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import type { SkillDefinition } from '../skills/skill-registry.js';
import type { RegistrySource, RegistryConfig } from './types.js';
import {
  resolveRegistryPath,
  getDefaultRegistryPath,
  getSkillsPath,
} from './paths.js';

/**
 * Simple YAML parser using gray-matter's engine
 */
function parseYaml(content: string): unknown {
  const result = matter(`---\n${content}\n---`);
  return result.data;
}

/**
 * Get skill source directories with load ordering
 *
 * Sources are ordered by loadOrder (ascending - lower numbers loaded first):
 * - Global registry (loadOrder 1): ~/registry/skills/ - loaded first, can be overridden
 * - Local project (loadOrder 2): .ultraplan/skills/ - loaded last, overrides global
 *
 * @param config - Registry configuration
 * @returns Array of registry sources, ordered by loadOrder (ascending)
 */
export function getSkillSources(config?: RegistryConfig): RegistrySource[] {
  const sources: RegistrySource[] = [];

  // Global registry - loaded first (loadOrder 1), can be overridden
  const globalRegistryPath = config?.registry
    ? resolveRegistryPath(config.registry)
    : getDefaultRegistryPath();

  const globalSkillsPath = getSkillsPath(globalRegistryPath);

  if (existsSync(globalRegistryPath)) {
    if (existsSync(globalSkillsPath)) {
      sources.push({
        path: globalSkillsPath,
        loadOrder: 1, // Loaded first, can be overridden
        isGlobal: true,
      });
    } else {
      // Registry exists but skills/ subdirectory doesn't
      console.warn(
        `Registry directory exists but skills/ subdirectory not found: ${globalSkillsPath}`
      );
    }
  }

  // Local project skills - loaded last (loadOrder 2), overrides global
  const localPath = join(process.cwd(), '.ultraplan/skills');
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
 * Check if a skill ID matches selection patterns
 *
 * Supports glob-like patterns:
 * - "thinktank/*" matches "thinktank/risk-analysis", "thinktank/market-research"
 * - "development/build-fix" matches exactly
 * - "*" matches everything
 *
 * @param skillId - Skill ID to check (e.g., "thinktank/risk-analysis")
 * @param patterns - Array of selection patterns
 * @returns Whether the skill matches any pattern
 */
export function matchesSelectionPattern(
  skillId: string,
  patterns: string[] | undefined
): boolean {
  // If no patterns specified, include all skills
  if (!patterns || patterns.length === 0) {
    return true;
  }

  return patterns.some((pattern) => {
    // Wildcard pattern
    if (pattern === '*') {
      return true;
    }

    // Category wildcard: "thinktank/*"
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      return skillId.startsWith(prefix + '/') || skillId === prefix;
    }

    // Exact match or suffix match
    return skillId === pattern || skillId.endsWith('/' + pattern);
  });
}

/**
 * Load skill from YAML file
 *
 * @param filePath - Path to skill YAML file
 * @returns Parsed skill definition or null on error
 */
function loadSkillFile(filePath: string): SkillDefinition | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return parseYaml(content) as SkillDefinition;
  } catch (error) {
    console.warn(`Failed to load skill: ${filePath}`, error);
    return null;
  }
}

/**
 * Load skills from a single directory
 *
 * @param dirPath - Directory containing skill YAML files
 * @param selectionPatterns - Patterns to filter skills
 * @returns Map of skill ID to skill definition
 */
function loadSkillsFromDirectory(
  dirPath: string,
  selectionPatterns?: string[]
): Map<string, SkillDefinition> {
  const skills = new Map<string, SkillDefinition>();

  if (!existsSync(dirPath)) {
    return skills;
  }

  try {
    const files = readdirSync(dirPath);
    let validYamlCount = 0;

    for (const file of files) {
      if (file.endsWith('.yaml') && !file.startsWith('_')) {
        const filePath = join(dirPath, file);
        const skill = loadSkillFile(filePath);

        if (skill && matchesSelectionPattern(skill.id, selectionPatterns)) {
          skills.set(skill.id, skill);
          validYamlCount++;
        }
      }
    }

    // Log warning if directory exists but has no valid YAML files
    if (validYamlCount === 0) {
      console.warn(
        `Skills directory exists but contains no valid YAML files: ${dirPath}`
      );
    }
  } catch (error) {
    console.warn(`Failed to read skills directory: ${dirPath}`, error);
  }

  return skills;
}

/**
 * Load skills from multiple sources with load order-based merging
 *
 * Skills are loaded from sources in loadOrder (ascending).
 * Later sources (higher loadOrder) override earlier sources.
 *
 * @param sources - Registry sources ordered by loadOrder
 * @param selectionPatterns - Patterns to filter skills
 * @returns Merged map of skill ID to skill definition
 */
export function loadSkillsFromSources(
  sources: RegistrySource[],
  selectionPatterns?: string[]
): Map<string, SkillDefinition> {
  const mergedSkills = new Map<string, SkillDefinition>();

  // Load in loadOrder (ascending): global first (1), then local (2)
  // This means local skills will override global skills with same ID
  for (const source of sources) {
    const directorySkills = loadSkillsFromDirectory(
      source.path,
      selectionPatterns
    );

    // Merge - later entries override earlier (last write wins)
    for (const [id, skill] of directorySkills) {
      mergedSkills.set(id, skill);
    }
  }

  return mergedSkills;
}

/**
 * Load skill index from directory
 *
 * @param dirPath - Directory containing _index.yaml
 * @returns Parsed index or null
 */
export function loadSkillIndex(dirPath: string): unknown | null {
  const indexPath = join(dirPath, '_index.yaml');

  if (!existsSync(indexPath)) {
    return null;
  }

  try {
    const content = readFileSync(indexPath, 'utf-8');
    return parseYaml(content);
  } catch (error) {
    console.warn(`Failed to load skill index: ${indexPath}`, error);
    return null;
  }
}
