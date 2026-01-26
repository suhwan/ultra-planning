/**
 * Temporary Directory Helpers for Testing
 *
 * Creates and cleans up isolated test workspaces.
 */

import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Create a unique temporary workspace directory
 *
 * @returns Absolute path to the created temporary directory
 */
export function createTestWorkspace(): string {
  const uniqueId = `ultra-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const workspaceDir = join(tmpdir(), uniqueId);

  mkdirSync(workspaceDir, { recursive: true });

  return workspaceDir;
}

/**
 * Remove a workspace directory and all its contents
 *
 * @param dir - Absolute path to the directory to remove
 */
export function cleanupWorkspace(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors (directory may not exist)
    console.warn(`Failed to cleanup workspace ${dir}:`, error);
  }
}
