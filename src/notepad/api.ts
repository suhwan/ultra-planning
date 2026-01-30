/**
 * Notepad Write API - Functions for adding entries to notepads
 *
 * Provides addLearning, addDecision, addIssue functions that append
 * timestamped entries to notepad files.
 */

import { appendFileSync, existsSync } from 'fs';
import { NotepadManager } from './manager.js';
import {
  LearningEntry,
  DecisionEntry,
  IssueEntry,
  NotepadConfig,
  DEFAULT_NOTEPAD_CONFIG,
} from './types.js';

/**
 * Format a notepad entry as markdown
 *
 * @param timestamp - ISO 8601 timestamp
 * @param taskId - Task identifier
 * @param content - Entry content
 * @param extra - Additional fields to include
 * @returns Formatted markdown string
 */
function formatEntry(
  timestamp: string,
  taskId: string,
  content: string,
  extra: Record<string, unknown> = {}
): string {
  const lines: string[] = [
    `## ${timestamp} | Task: ${taskId}`,
    '',
    content,
    '',
  ];

  // Add extra fields
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        if (value.length > 0) {
          lines.push(`**${key}:** ${value.join(', ')}`);
        }
      } else if (value !== '') {
        lines.push(`**${key}:** ${value}`);
      }
    }
  }

  lines.push('', '---', '');
  return lines.join('\n');
}

/**
 * Add a learning entry to the plan's notepad
 *
 * Appends a timestamped learning entry to the plan's learnings.md file.
 * Creates the notepad directory if it doesn't exist.
 *
 * @param planId - Plan identifier (e.g., "03-01")
 * @param entry - Learning entry data (taskId, content required)
 * @param config - Optional config override
 * @returns true if written successfully, false otherwise
 *
 * @example
 * ```typescript
 * addLearning('03-01', {
 *   taskId: '03-01-02',
 *   content: 'Zod 3.23 requires .pipe() for transform chains',
 *   pattern: 'src/validation.ts:45-60',
 *   tags: ['zod', 'validation']
 * });
 * ```
 */
export function addLearning(
  planId: string,
  entry: Omit<LearningEntry, 'timestamp'>,
  config: Partial<NotepadConfig> = {}
): boolean {
  const manager = new NotepadManager({ ...DEFAULT_NOTEPAD_CONFIG, ...config });
  const filePath = manager.getNotepadPath(planId, 'learnings');

  // Ensure notepad exists
  if (!existsSync(filePath)) {
    manager.initPlanNotepad(planId);
  }

  const timestamp = new Date().toISOString();
  const markdown = formatEntry(timestamp, entry.taskId, entry.content, {
    'Pattern found': entry.pattern,
    'Learning type': entry.learningType,
    Priority: entry.priority,
    Tags: entry.tags,
  });

  try {
    appendFileSync(filePath, markdown, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Add a decision entry to the plan's notepad
 *
 * Appends a timestamped decision entry to the plan's decisions.md file.
 * Creates the notepad directory if it doesn't exist.
 *
 * @param planId - Plan identifier (e.g., "03-01")
 * @param entry - Decision entry data (taskId, content, rationale required)
 * @param config - Optional config override
 * @returns true if written successfully, false otherwise
 *
 * @example
 * ```typescript
 * addDecision('03-01', {
 *   taskId: '03-01-02',
 *   content: 'Use appendFileSync instead of streaming',
 *   rationale: 'Simpler API, entries are small, no need for streams',
 *   alternatives: ['createWriteStream', 'fs.promises.appendFile']
 * });
 * ```
 */
export function addDecision(
  planId: string,
  entry: Omit<DecisionEntry, 'timestamp'>,
  config: Partial<NotepadConfig> = {}
): boolean {
  const manager = new NotepadManager({ ...DEFAULT_NOTEPAD_CONFIG, ...config });
  const filePath = manager.getNotepadPath(planId, 'decisions');

  // Ensure notepad exists
  if (!existsSync(filePath)) {
    manager.initPlanNotepad(planId);
  }

  const timestamp = new Date().toISOString();
  const markdown = formatEntry(timestamp, entry.taskId, entry.content, {
    Rationale: entry.rationale,
    Alternatives: entry.alternatives,
    Tags: entry.tags,
  });

  try {
    appendFileSync(filePath, markdown, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Add an issue entry to the plan's notepad
 *
 * Appends a timestamped issue entry to the plan's issues.md file.
 * Creates the notepad directory if it doesn't exist.
 *
 * @param planId - Plan identifier (e.g., "03-01")
 * @param entry - Issue entry data (taskId, content, severity, status required)
 * @param config - Optional config override
 * @returns true if written successfully, false otherwise
 *
 * @example
 * ```typescript
 * addIssue('03-01', {
 *   taskId: '03-01-02',
 *   content: 'Race condition when parallel writes to same file',
 *   severity: 'high',
 *   status: 'workaround',
 *   workaround: 'Use file locks or sequential writes'
 * });
 * ```
 */
export function addIssue(
  planId: string,
  entry: Omit<IssueEntry, 'timestamp'>,
  config: Partial<NotepadConfig> = {}
): boolean {
  const manager = new NotepadManager({ ...DEFAULT_NOTEPAD_CONFIG, ...config });
  const filePath = manager.getNotepadPath(planId, 'issues');

  // Ensure notepad exists
  if (!existsSync(filePath)) {
    manager.initPlanNotepad(planId);
  }

  const timestamp = new Date().toISOString();
  const markdown = formatEntry(timestamp, entry.taskId, entry.content, {
    Severity: entry.severity,
    Status: entry.status,
    Workaround: entry.workaround,
    Tags: entry.tags,
  });

  try {
    appendFileSync(filePath, markdown, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Add a learning entry to the project-level notepad
 *
 * @param entry - Learning entry data
 * @param config - Optional config override
 * @returns true if written successfully
 */
export function addProjectLearning(
  entry: Omit<LearningEntry, 'timestamp'>,
  config: Partial<NotepadConfig> = {}
): boolean {
  const manager = new NotepadManager({ ...DEFAULT_NOTEPAD_CONFIG, ...config });
  const filePath = manager.getProjectNotepadPath('learnings.md');

  // Ensure project notepad exists
  if (!existsSync(filePath)) {
    manager.initProjectNotepad();
  }

  const timestamp = new Date().toISOString();
  const markdown = formatEntry(timestamp, entry.taskId, entry.content, {
    'Pattern found': entry.pattern,
    'Learning type': entry.learningType,
    Priority: entry.priority,
    Tags: entry.tags,
  });

  try {
    appendFileSync(filePath, markdown, 'utf-8');
    return true;
  } catch {
    return false;
  }
}
