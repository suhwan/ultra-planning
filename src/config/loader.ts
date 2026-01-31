/**
 * Config Loader - Load and parse project configuration
 *
 * Reads .ultraplan/config.json and provides typed access to settings.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { RegistryConfig } from '../registry/types.js';
import {
  type ProjectConfig,
  type RegistrySettings,
  toRegistryConfig,
  DEFAULT_REGISTRY_SETTINGS,
} from './types.js';

/** Config file path relative to project root */
const CONFIG_FILE = '.ultraplan/config.json';

/** Cached config instance */
let cachedConfig: ProjectConfig | null = null;

/**
 * Load project configuration from .ultraplan/config.json
 *
 * @param projectRoot - Project root directory (default: cwd)
 * @returns Parsed project config or null if not found
 */
export function loadProjectConfig(projectRoot?: string): ProjectConfig | null {
  const root = projectRoot || process.cwd();
  const configPath = join(root, CONFIG_FILE);

  if (!existsSync(configPath)) {
    console.warn(`Config file not found: ${configPath}`);
    return null;
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content) as ProjectConfig;
    cachedConfig = config;
    return config;
  } catch (error) {
    console.warn(`Failed to load config: ${configPath}`, error);
    return null;
  }
}

/**
 * Get cached config or load if not cached
 *
 * @param projectRoot - Project root directory
 * @returns Cached or loaded config
 */
export function getProjectConfig(projectRoot?: string): ProjectConfig | null {
  if (cachedConfig) {
    return cachedConfig;
  }
  return loadProjectConfig(projectRoot);
}

/**
 * Get registry configuration from project config
 *
 * Returns RegistryConfig suitable for SkillRegistry/AgentRegistry.
 * Falls back to defaults if no registry settings in config.
 *
 * @param projectRoot - Project root directory
 * @returns RegistryConfig or undefined
 */
export function getRegistryConfig(projectRoot?: string): RegistryConfig | undefined {
  const config = getProjectConfig(projectRoot);

  if (config?.registry) {
    return toRegistryConfig(config.registry);
  }

  // Check if global registry exists, use defaults if so
  const defaultGlobalPath = join(homedir(), 'registry');
  if (existsSync(defaultGlobalPath)) {
    return toRegistryConfig(DEFAULT_REGISTRY_SETTINGS);
  }

  return undefined;
}

/**
 * Get registry settings from config
 *
 * @param projectRoot - Project root directory
 * @returns Registry settings or defaults
 */
export function getRegistrySettings(projectRoot?: string): RegistrySettings {
  const config = getProjectConfig(projectRoot);
  return config?.registry || DEFAULT_REGISTRY_SETTINGS;
}

/**
 * Clear config cache (for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}

/**
 * Check if project has registry configuration
 */
export function hasRegistryConfig(projectRoot?: string): boolean {
  const config = getProjectConfig(projectRoot);
  return !!config?.registry;
}
