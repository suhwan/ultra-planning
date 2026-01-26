/**
 * StateManager - Generic file-based state persistence
 *
 * Provides type-safe read/write/update operations for JSON state files.
 * Based on patterns from oh-my-claudecode StateManager.
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import {
  StateLocation,
  StateReadResult,
  StateWriteResult,
  STATE_DIR,
} from './types.js';

/**
 * Generic state manager for typed file-based persistence
 *
 * @template T - The type of state data being managed
 */
export class StateManager<T extends Record<string, unknown>> {
  private readonly name: string;
  private readonly location: StateLocation;

  /**
   * Create a new state manager
   *
   * @param name - State file name (without .json extension)
   * @param location - Storage location (local or global)
   */
  constructor(name: string, location: StateLocation = StateLocation.LOCAL) {
    this.name = name;
    this.location = location;
  }

  /**
   * Read state from file
   *
   * @returns State read result with exists flag and optional data
   */
  read(): StateReadResult<T> {
    const path = this.getPath();

    if (!existsSync(path)) {
      return { exists: false };
    }

    try {
      const content = readFileSync(path, 'utf-8');
      const data = JSON.parse(content) as T;
      return {
        exists: true,
        data,
        foundAt: path,
      };
    } catch (error) {
      // If parse fails, treat as non-existent
      return {
        exists: false,
        foundAt: path,
      };
    }
  }

  /**
   * Write state to file
   *
   * Uses atomic write pattern (write to .tmp then rename) to prevent corruption.
   *
   * @param data - State data to write
   * @returns Write result with success status and path
   */
  write(data: T): StateWriteResult {
    const path = this.getPath();
    const tmpPath = path + '.tmp';

    try {
      // Ensure directory exists
      const dir = dirname(path);
      mkdirSync(dir, { recursive: true });

      // Write to temp file first
      writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');

      // Atomic rename
      renameSync(tmpPath, path);

      return {
        success: true,
        path,
      };
    } catch (error) {
      return {
        success: false,
        path,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Update state atomically using an updater function
   *
   * Reads current state, applies updater, and writes result.
   *
   * @param updater - Function that takes current state and returns new state
   * @returns Whether update succeeded
   */
  update(updater: (current: T | undefined) => T): boolean {
    const current = this.read().data;
    const updated = updater(current);
    return this.write(updated).success;
  }

  /**
   * Clear state by deleting the file
   *
   * @returns Whether deletion succeeded (true if file didn't exist)
   */
  clear(): boolean {
    const path = this.getPath();

    if (!existsSync(path)) {
      return true;
    }

    try {
      unlinkSync(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get absolute path to the state file
   *
   * @private
   * @returns Absolute path based on name and location
   */
  private getPath(): string {
    if (this.location === StateLocation.GLOBAL) {
      // Global state in home directory
      const home = process.env.HOME || process.env.USERPROFILE || '';
      return join(home, STATE_DIR, `${this.name}.json`);
    } else {
      // Local state in project directory
      return join(process.cwd(), STATE_DIR, `${this.name}.json`);
    }
  }
}
