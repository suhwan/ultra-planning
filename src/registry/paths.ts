/**
 * Registry Path Resolution - Cross-platform path utilities
 *
 * Handles ~ expansion and platform-specific path resolution.
 * Based on StateManager pattern but extended for registry paths.
 */

import { homedir } from 'os';
import { join, isAbsolute, resolve } from 'path';
import { existsSync } from 'fs';
import { DEFAULT_REGISTRY_DIR, SKILLS_SUBDIR, AGENTS_SUBDIR } from './types.js';

/**
 * Expand tilde (~) in path to user home directory
 *
 * @param inputPath - Path that may contain ~
 * @returns Absolute path with ~ expanded
 */
export function expandTilde(inputPath: string): string {
  if (inputPath.startsWith('~/')) {
    return join(homedir(), inputPath.slice(2));
  }
  if (inputPath === '~') {
    return homedir();
  }
  return inputPath;
}

/**
 * Resolve registry path to absolute path
 *
 * Handles:
 * - ~ expansion (~/registry -> /home/user/registry)
 * - Absolute paths (passed through)
 * - Relative paths (resolved from cwd)
 *
 * @param configPath - Registry path from config (may be ~, relative, or absolute)
 * @returns Absolute path to registry directory
 */
export function resolveRegistryPath(configPath: string): string {
  // Handle tilde expansion
  const expanded = expandTilde(configPath);

  // If absolute, return as-is
  if (isAbsolute(expanded)) {
    return expanded;
  }

  // Relative path - resolve from cwd
  return resolve(process.cwd(), expanded);
}

/**
 * Get default global registry path
 *
 * @returns Absolute path to ~/registry
 */
export function getDefaultRegistryPath(): string {
  return join(homedir(), DEFAULT_REGISTRY_DIR);
}

/**
 * Get skills directory within a registry path
 *
 * @param registryPath - Base registry path
 * @returns Absolute path to skills directory
 */
export function getSkillsPath(registryPath: string): string {
  return join(resolveRegistryPath(registryPath), SKILLS_SUBDIR);
}

/**
 * Get agents directory within a registry path
 *
 * @param registryPath - Base registry path
 * @returns Absolute path to agents directory
 */
export function getAgentsPath(registryPath: string): string {
  return join(resolveRegistryPath(registryPath), AGENTS_SUBDIR);
}

/**
 * Check if a registry path exists and is accessible
 *
 * @param registryPath - Registry path to check
 * @returns Whether the path exists
 */
export function registryExists(registryPath: string): boolean {
  return existsSync(resolveRegistryPath(registryPath));
}

/**
 * Check if skills directory exists in registry
 *
 * @param registryPath - Base registry path
 * @returns Whether skills directory exists
 */
export function skillsExist(registryPath: string): boolean {
  return existsSync(getSkillsPath(registryPath));
}

/**
 * Check if agents directory exists in registry
 *
 * @param registryPath - Base registry path
 * @returns Whether agents directory exists
 */
export function agentsExist(registryPath: string): boolean {
  return existsSync(getAgentsPath(registryPath));
}
