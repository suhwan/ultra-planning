/**
 * Notepad Reader - Functions for extracting wisdom from notepad files
 *
 * Provides reading and parsing functionality to extract accumulated
 * wisdom from plan-level and project-level notepads.
 */

import { readFileSync, existsSync } from 'fs';
import { NotepadManager } from './manager.js';
import {
  WisdomSummary,
  NotepadCategory,
  NotepadConfig,
  DEFAULT_NOTEPAD_CONFIG,
  CHARS_PER_TOKEN,
  PROJECT_NOTEPAD_DIR,
} from './types.js';

/**
 * Read raw content from a notepad file
 *
 * @param planId - Plan identifier
 * @param category - Notepad category
 * @param config - Optional config override
 * @returns File content or null if not found
 */
export function readNotepadFile(
  planId: string,
  category: NotepadCategory,
  config: Partial<NotepadConfig> = {}
): string | null {
  const manager = new NotepadManager({ ...DEFAULT_NOTEPAD_CONFIG, ...config });
  const filePath = manager.getNotepadPath(planId, category);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Extract recent entries from markdown content
 * Entries are delimited by `## YYYY-MM-DDTHH:MM:SSZ | Task:` timestamp headers
 *
 * @param content - Raw markdown content
 * @param limit - Maximum entries to extract
 * @returns Array of entry content strings
 */
export function extractRecentEntries(content: string, limit: number = 5): string[] {
  if (!content || content.trim() === '') {
    return [];
  }

  // Split by ## timestamp headers (ISO format: YYYY-MM-DDTHH:MM:SS)
  // Pattern matches: ## 2026-01-27T14:30:00.000Z | Task: ...
  const sections = content.split(/\n(?=## \d{4}-\d{2}-\d{2}T)/);

  // Filter out header-only sections (the initial # Title header)
  // and take last N entries (most recent)
  const entries = sections
    .filter(s => s.trim() && s.includes('| Task:')) // Must have task marker
    .slice(-limit);

  return entries;
}

/**
 * Get wisdom summary for a plan
 * Reads all three category files and extracts recent entries
 *
 * @param planId - Plan identifier
 * @param config - Optional config override
 * @returns WisdomSummary or null if notepad doesn't exist
 */
export function getWisdomForPlan(
  planId: string,
  config: Partial<NotepadConfig> = {}
): WisdomSummary | null {
  const fullConfig = { ...DEFAULT_NOTEPAD_CONFIG, ...config };
  const manager = new NotepadManager(fullConfig);

  if (!manager.notepadExists(planId)) {
    return null;
  }

  const result: WisdomSummary = {
    learnings: [],
    decisions: [],
    issues: [],
    tokenEstimate: 0,
  };

  // Read each category
  const categories: NotepadCategory[] = ['learnings', 'decisions', 'issues'];
  for (const category of categories) {
    const content = readNotepadFile(planId, category, fullConfig);
    if (content) {
      const entries = extractRecentEntries(content, fullConfig.maxEntriesPerCategory);
      result[category] = entries;
      // Add token estimate for this content
      result.tokenEstimate += Math.ceil(entries.join('').length / CHARS_PER_TOKEN);
    }
  }

  return result;
}

/**
 * Get wisdom from project-level notepad
 * Used for cross-plan knowledge
 *
 * @param config - Optional config override
 * @returns WisdomSummary or null if doesn't exist
 */
export function getProjectWisdom(
  config: Partial<NotepadConfig> = {}
): WisdomSummary | null {
  // Project notepad uses special "_project" planId
  return getWisdomForPlan(PROJECT_NOTEPAD_DIR, config);
}
