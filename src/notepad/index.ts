/**
 * Notepad Module - Learning accumulation system
 *
 * Provides functionality for subagents to record learnings, decisions,
 * and issues during task execution. Supports plan-scoped and project-level
 * wisdom accumulation.
 *
 * @example
 * ```typescript
 * import { NotepadManager, addLearning, addDecision, addIssue } from './notepad';
 *
 * // Initialize notepad for a plan
 * const manager = new NotepadManager();
 * manager.initPlanNotepad('03-01');
 *
 * // Add entries
 * addLearning('03-01', {
 *   taskId: '03-01-02',
 *   content: 'Zod 3.23 requires .pipe() for transform chains',
 *   tags: ['zod', 'validation']
 * });
 *
 * addDecision('03-01', {
 *   taskId: '03-01-02',
 *   content: 'Use appendFileSync for notepad writes',
 *   rationale: 'Simpler API, entries are small'
 * });
 *
 * addIssue('03-01', {
 *   taskId: '03-01-02',
 *   content: 'Race condition in parallel file writes',
 *   severity: 'high',
 *   status: 'workaround',
 *   workaround: 'Use sequential writes'
 * });
 * ```
 */

// Types
export {
  NotepadCategory,
  LearningType,
  NotepadEntry,
  LearningEntry,
  DecisionEntry,
  IssueEntry,
  WisdomSummary,
  NotepadConfig,
  DEFAULT_NOTEPAD_CONFIG,
  CHARS_PER_TOKEN,
  PROJECT_NOTEPAD_DIR,
} from './types.js';

// Manager
export { NotepadManager } from './manager.js';

// Write API
export {
  addLearning,
  addDecision,
  addIssue,
  addProjectLearning,
} from './api.js';

// Read API
export {
  getWisdomForPlan,
  getProjectWisdom,
  extractRecentEntries,
  readNotepadFile,
} from './reader.js';

// Injection
export {
  formatWisdomForPrompt,
  createWisdomDirective,
  hasWisdom,
} from './injector.js';

// Merge & Summary
export {
  mergePlanToProject,
  generateProjectSummary,
  mergeAllPlansToProject,
} from './merger.js';
