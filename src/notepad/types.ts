/**
 * Notepad Types - Type definitions for the learning system
 *
 * Defines structures for notepad entries, categories, and wisdom injection.
 * Based on patterns from oh-my-opencode notepad system.
 */

// ============================================================================
// Notepad Categories
// ============================================================================

/** Notepad category types */
export type NotepadCategory = 'learnings' | 'decisions' | 'issues';

// ============================================================================
// Entry Types
// ============================================================================

/** Base notepad entry */
export interface NotepadEntry {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Task identifier (e.g., "03-01-02") */
  taskId: string;
  /** Entry content */
  content: string;
  /** Optional tags for categorization */
  tags?: string[];
}

/** Learning entry with pattern reference */
export interface LearningEntry extends NotepadEntry {
  /** File:lines reference (e.g., "src/utils.ts:45-60") */
  pattern?: string;
}

/** Decision entry with rationale */
export interface DecisionEntry extends NotepadEntry {
  /** Reasoning behind the decision */
  rationale: string;
  /** Alternative approaches considered */
  alternatives?: string[];
}

/** Issue entry with severity and status */
export interface IssueEntry extends NotepadEntry {
  /** Issue severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Current issue status */
  status: 'open' | 'workaround' | 'resolved';
  /** Temporary workaround if available */
  workaround?: string;
}

// ============================================================================
// Wisdom Types
// ============================================================================

/** Wisdom summary for prompt injection */
export interface WisdomSummary {
  /** Recent learnings */
  learnings: string[];
  /** Recent decisions */
  decisions: string[];
  /** Recent issues */
  issues: string[];
  /** Estimated token count for budget management */
  tokenEstimate: number;
}

// ============================================================================
// Configuration
// ============================================================================

/** Notepad configuration options */
export interface NotepadConfig {
  /** Base directory for notepads (default: '.planning') */
  baseDir: string;
  /** Maximum entries per category for wisdom extraction */
  maxEntriesPerCategory: number;
  /** Maximum token budget for prompt injection */
  maxTokenBudget: number;
}

/** Default notepad configuration */
export const DEFAULT_NOTEPAD_CONFIG: NotepadConfig = {
  baseDir: '.planning',
  maxEntriesPerCategory: 5,
  maxTokenBudget: 1000,
};

// ============================================================================
// Constants
// ============================================================================

/** Characters per token estimate */
export const CHARS_PER_TOKEN = 4;

/** Project-level notepad directory name */
export const PROJECT_NOTEPAD_DIR = '_project';
