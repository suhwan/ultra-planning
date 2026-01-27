/**
 * NotepadManager - Directory initialization and path management
 *
 * Manages notepad directory structure and initialization.
 * Based on patterns from StateManager in src/state/state-manager.ts.
 */

import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  NotepadConfig,
  DEFAULT_NOTEPAD_CONFIG,
  NotepadCategory,
  PROJECT_NOTEPAD_DIR,
} from './types.js';

/**
 * Manages notepad directory structure and initialization
 */
export class NotepadManager {
  private readonly config: NotepadConfig;

  /**
   * Create a new NotepadManager
   *
   * @param config - Optional partial config to override defaults
   */
  constructor(config: Partial<NotepadConfig> = {}) {
    this.config = { ...DEFAULT_NOTEPAD_CONFIG, ...config };
  }

  /**
   * Get path to a plan's notepad directory
   *
   * @param planId - Plan identifier (e.g., "03-01")
   * @returns Absolute path to plan notepad directory
   */
  getPlanNotepadDir(planId: string): string {
    return join(this.config.baseDir, 'notepads', planId);
  }

  /**
   * Get path to project-level notepad directory
   *
   * @returns Absolute path to project notepad directory
   */
  getProjectNotepadDir(): string {
    return join(this.config.baseDir, 'notepads', PROJECT_NOTEPAD_DIR);
  }

  /**
   * Get path to specific notepad file
   *
   * @param planId - Plan identifier
   * @param category - Notepad category (learnings, decisions, issues)
   * @returns Absolute path to notepad file
   */
  getNotepadPath(planId: string, category: NotepadCategory): string {
    return join(this.getPlanNotepadDir(planId), `${category}.md`);
  }

  /**
   * Get path to project-level notepad file
   *
   * @param filename - File name (e.g., "learnings.md", "patterns.md")
   * @returns Absolute path to project notepad file
   */
  getProjectNotepadPath(filename: string): string {
    return join(this.getProjectNotepadDir(), filename);
  }

  /**
   * Initialize notepad directory for a plan
   * Creates directory and empty category files if they don't exist
   *
   * @param planId - Plan identifier
   * @returns true if initialization succeeded, false otherwise
   */
  initPlanNotepad(planId: string): boolean {
    const notepadDir = this.getPlanNotepadDir(planId);

    try {
      // Create directory if it doesn't exist
      if (!existsSync(notepadDir)) {
        mkdirSync(notepadDir, { recursive: true });
      }

      // Initialize category files with headers
      const categories: NotepadCategory[] = ['learnings', 'decisions', 'issues'];
      for (const category of categories) {
        const filePath = join(notepadDir, `${category}.md`);
        if (!existsSync(filePath)) {
          const title = category.charAt(0).toUpperCase() + category.slice(1);
          const header = `# ${title}\n\n`;
          writeFileSync(filePath, header, 'utf-8');
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Initialize project-level notepad directory
   *
   * @returns true if initialization succeeded, false otherwise
   */
  initProjectNotepad(): boolean {
    const projectDir = this.getProjectNotepadDir();

    try {
      // Create directory if it doesn't exist
      if (!existsSync(projectDir)) {
        mkdirSync(projectDir, { recursive: true });
      }

      // Project level has additional files
      const files = [
        'learnings.md',
        'decisions.md',
        'issues.md',
        'patterns.md',
        'summary.md',
      ];
      for (const file of files) {
        const filePath = join(projectDir, file);
        if (!existsSync(filePath)) {
          const name = file.replace('.md', '');
          const title = name.charAt(0).toUpperCase() + name.slice(1);
          const header = `# Project ${title}\n\n`;
          writeFileSync(filePath, header, 'utf-8');
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if notepad exists for a plan
   *
   * @param planId - Plan identifier
   * @returns true if notepad directory exists
   */
  notepadExists(planId: string): boolean {
    return existsSync(this.getPlanNotepadDir(planId));
  }

  /**
   * Check if project notepad exists
   *
   * @returns true if project notepad directory exists
   */
  projectNotepadExists(): boolean {
    return existsSync(this.getProjectNotepadDir());
  }

  /**
   * Get the base directory configuration
   *
   * @returns Base directory path
   */
  getBaseDir(): string {
    return this.config.baseDir;
  }

  /**
   * Get the full configuration
   *
   * @returns Current notepad configuration
   */
  getConfig(): NotepadConfig {
    return { ...this.config };
  }
}
