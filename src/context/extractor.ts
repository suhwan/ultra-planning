/**
 * Core Info Extractor
 *
 * Extracts essential information from STATE.md, ROADMAP.md, and notepads
 * for compact context injection into subagents. Provides the minimal
 * context needed for intelligent task execution without full file loads.
 *
 * Part of the Context Architect pattern - lean context extraction.
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// ============================================================================
// Types
// ============================================================================

/**
 * Core information extracted from planning artifacts.
 * Designed to be compact yet sufficient for subagent context.
 */
export interface CoreInfo {
  // Architecture & Decisions
  /** Key architectural decisions from STATE.md Decisions section */
  architectureDecisions: string[];
  /** Important file/module references from STATE.md Key References */
  keyReferences: string[];

  // Issues & Blockers
  /** Unresolved issues from notepads/issues or STATE.md Blockers */
  unresolvedIssues: string[];
  /** Pending todos from STATE.md Pending Todos section */
  pendingTodos: string[];

  // Current Progress
  /** Current phase information */
  currentPhase: { number: number; name: string; status: string };
  /** Current active plan if any */
  currentPlan: { id: string; objective: string } | null;
  /** Progress metrics from STATE.md or ROADMAP.md */
  progressMetrics: { completed: number; total: number; percent: number };

  // Learnings (most recent)
  /** Recent learnings from notepads (limited to 5) */
  recentLearnings: string[];
}

/**
 * Progress information parsed from ROADMAP.md
 */
interface ProgressInfo {
  currentPhase: { number: number; name: string; status: string };
  completed: number;
  total: number;
  percent: number;
}

/**
 * Wisdom information loaded from notepad directory
 */
interface WisdomInfo {
  learnings: string[];
  decisions: string[];
  issues: string[];
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PLANNING_DIR = '.planning';
const NOTEPAD_DIR = '.omc/notepads';

/** Maximum items per category to prevent context bloat */
const LIMITS = {
  decisions: 10,
  references: 10,
  issues: 5,
  todos: 5,
  learnings: 5,
};

// ============================================================================
// Main Extraction Function
// ============================================================================

/**
 * Extract core information from planning artifacts.
 *
 * @param planningDir - Path to .planning directory (default: .planning)
 * @returns CoreInfo with extracted data, empty arrays for missing sections
 *
 * @example
 * ```typescript
 * const info = extractCoreInfo('.planning');
 * console.log(info.currentPhase); // { number: 3, name: 'GSD Integration', status: 'in-progress' }
 * ```
 */
export function extractCoreInfo(planningDir: string = DEFAULT_PLANNING_DIR): CoreInfo {
  // Initialize with defaults
  const result: CoreInfo = {
    architectureDecisions: [],
    keyReferences: [],
    unresolvedIssues: [],
    pendingTodos: [],
    currentPhase: { number: 0, name: 'Unknown', status: 'unknown' },
    currentPlan: null,
    progressMetrics: { completed: 0, total: 0, percent: 0 },
    recentLearnings: [],
  };

  // Parse STATE.md
  const statePath = join(planningDir, 'STATE.md');
  if (existsSync(statePath)) {
    const stateMd = readFileSync(statePath, 'utf-8');
    result.architectureDecisions = parseStateDecisions(stateMd).slice(0, LIMITS.decisions);
    result.keyReferences = parseStateReferences(stateMd).slice(0, LIMITS.references);
    result.pendingTodos = parseStateTodos(stateMd).slice(0, LIMITS.todos);
    result.unresolvedIssues = parseStateBlockers(stateMd).slice(0, LIMITS.issues);

    // Extract current position from STATE.md
    const position = parseStatePosition(stateMd);
    if (position.phaseNumber > 0) {
      result.currentPhase = {
        number: position.phaseNumber,
        name: position.phaseName,
        status: position.status,
      };
    }
    if (position.planId) {
      result.currentPlan = {
        id: position.planId,
        objective: position.planStatus,
      };
    }
  }

  // Parse ROADMAP.md for progress metrics
  const roadmapV2Path = join(planningDir, 'ROADMAP-v2.md');
  const roadmapPath = join(planningDir, 'ROADMAP.md');
  const roadmapFile = existsSync(roadmapV2Path) ? roadmapV2Path : roadmapPath;

  if (existsSync(roadmapFile)) {
    const roadmapMd = readFileSync(roadmapFile, 'utf-8');
    const progressInfo = parseRoadmapProgress(roadmapMd);
    result.progressMetrics = {
      completed: progressInfo.completed,
      total: progressInfo.total,
      percent: progressInfo.percent,
    };
    // Use roadmap phase info if STATE.md didn't provide it
    if (result.currentPhase.number === 0) {
      result.currentPhase = progressInfo.currentPhase;
    }
  }

  // Load notepad wisdom
  const projectNotepadDir = join(NOTEPAD_DIR, '_project');
  const wisdom = loadNotepadWisdom(projectNotepadDir);

  // Merge notepad issues with STATE.md blockers
  if (wisdom.issues.length > 0) {
    const allIssues = [...result.unresolvedIssues, ...wisdom.issues];
    result.unresolvedIssues = [...new Set(allIssues)].slice(0, LIMITS.issues);
  }

  // Add learnings from notepad
  result.recentLearnings = wisdom.learnings.slice(0, LIMITS.learnings);

  // Apply priority ordering: issues (actionable) > decisions (context) > learnings (patterns)
  // This is already reflected in the interface order, but we ensure arrays are sorted by recency

  return result;
}

// ============================================================================
// STATE.md Parsing Functions
// ============================================================================

/**
 * Parse decisions from STATE.md Decisions section.
 * Extracts lines starting with "- [" which indicate tagged decisions.
 */
export function parseStateDecisions(stateMd: string): string[] {
  const decisions: string[] = [];

  // Find Decisions section
  const decisionsMatch = stateMd.match(/### Decisions\n([\s\S]*?)(?=\n###|\n---|\n##|$)/);
  if (!decisionsMatch) return decisions;

  const section = decisionsMatch[1];
  const lines = section.split('\n');

  for (const line of lines) {
    // Match lines like "- [Phase 1]: TypeScript 5.9.3..."
    const match = line.match(/^- \[([^\]]+)\]: (.+)$/);
    if (match) {
      decisions.push(`[${match[1]}] ${match[2]}`);
    }
  }

  return decisions;
}

/**
 * Parse key references from STATE.md Key References section.
 * Extracts file paths and their descriptions.
 */
export function parseStateReferences(stateMd: string): string[] {
  const references: string[] = [];

  // Find Key References section
  const refsMatch = stateMd.match(/### Key References\n([\s\S]*?)(?=\n###|\n---|\n##|$)/);
  if (!refsMatch) return references;

  const section = refsMatch[1];
  const lines = section.split('\n');

  for (const line of lines) {
    // Match lines like "- `path/to/file` - description"
    const match = line.match(/^- `([^`]+)`(?: - (.+))?$/);
    if (match) {
      const ref = match[2] ? `${match[1]} - ${match[2]}` : match[1];
      references.push(ref);
    }
  }

  return references;
}

/**
 * Parse pending todos from STATE.md Pending Todos section.
 */
function parseStateTodos(stateMd: string): string[] {
  const todos: string[] = [];

  // Find Pending Todos section
  const todosMatch = stateMd.match(/### Pending Todos\n([\s\S]*?)(?=\n###|\n---|\n##|$)/);
  if (!todosMatch) return todos;

  const section = todosMatch[1];
  const lines = section.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip "None" or empty lines
    if (!trimmed || trimmed.toLowerCase().includes('none')) continue;
    // Match list items
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      todos.push(trimmed.slice(2));
    }
  }

  return todos;
}

/**
 * Parse blockers/concerns from STATE.md Blockers section.
 */
function parseStateBlockers(stateMd: string): string[] {
  const blockers: string[] = [];

  // Find Blockers/Concerns section
  const blockersMatch = stateMd.match(/### Blockers\/Concerns\n([\s\S]*?)(?=\n###|\n---|\n##|$)/);
  if (!blockersMatch) return blockers;

  const section = blockersMatch[1];
  const lines = section.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip "None" or empty lines
    if (!trimmed || trimmed.toLowerCase() === 'none') continue;
    // Match list items
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      blockers.push(trimmed.slice(2));
    }
  }

  return blockers;
}

/**
 * Parse current position from STATE.md Current Position section.
 */
function parseStatePosition(stateMd: string): {
  phaseNumber: number;
  phaseName: string;
  planId: string;
  status: string;
  planStatus: string;
} {
  const result = {
    phaseNumber: 0,
    phaseName: 'Unknown',
    planId: '',
    status: 'unknown',
    planStatus: '',
  };

  // Find Current Position section
  const posMatch = stateMd.match(/## Current Position\n([\s\S]*?)(?=\n##|$)/);
  if (!posMatch) return result;

  const section = posMatch[1];

  // Parse "Phase: N of M (name)"
  const phaseMatch = section.match(/Phase:\s*(\d+)\s*of\s*\d+\s*\(([^)]+)\)/);
  if (phaseMatch) {
    result.phaseNumber = parseInt(phaseMatch[1], 10);
    result.phaseName = phaseMatch[2];
  }

  // Parse "Plan: N of M"
  const planMatch = section.match(/Plan:\s*(\d+)\s*of\s*(\d+)/);
  if (planMatch) {
    const paddedPhase = String(result.phaseNumber).padStart(2, '0');
    const paddedPlan = String(parseInt(planMatch[1], 10)).padStart(2, '0');
    result.planId = `${paddedPhase}-${paddedPlan}`;
  }

  // Parse "Status: value"
  const statusMatch = section.match(/Status:\s*(.+)/);
  if (statusMatch) {
    result.status = statusMatch[1].trim().toLowerCase();
    result.planStatus = statusMatch[1].trim();
  }

  return result;
}

// ============================================================================
// ROADMAP.md Parsing Functions
// ============================================================================

/**
 * Parse progress information from ROADMAP.md.
 * Extracts phase structure and completion status.
 */
export function parseRoadmapProgress(roadmapMd: string): ProgressInfo {
  const result: ProgressInfo = {
    currentPhase: { number: 0, name: 'Unknown', status: 'unknown' },
    completed: 0,
    total: 0,
    percent: 0,
  };

  // Count total tasks from task markers: "- [ ]" and "- [x]"
  const uncheckedTasks = (roadmapMd.match(/- \[ \]/g) || []).length;
  const checkedTasks = (roadmapMd.match(/- \[x\]/gi) || []).length;

  result.total = uncheckedTasks + checkedTasks;
  result.completed = checkedTasks;
  result.percent = result.total > 0 ? Math.round((result.completed / result.total) * 100) : 0;

  // Find current phase (first phase with unchecked tasks)
  // Look for Phase headers: "### Phase N: name"
  const phaseMatches = roadmapMd.matchAll(/### Phase (\d+)[:\s]+([^\n]+)/g);
  let currentPhaseNumber = 0;
  let currentPhaseName = 'Unknown';

  for (const match of phaseMatches) {
    const phaseNum = parseInt(match[1], 10);
    const phaseName = match[2].trim();

    // Get section content until next phase or end
    const startIdx = match.index! + match[0].length;
    const nextPhaseMatch = roadmapMd.slice(startIdx).match(/### Phase \d+/);
    const endIdx = nextPhaseMatch ? startIdx + nextPhaseMatch.index! : roadmapMd.length;
    const phaseSection = roadmapMd.slice(startIdx, endIdx);

    // Check if this phase has unchecked tasks
    const hasUnchecked = /- \[ \]/.test(phaseSection);
    const hasChecked = /- \[x\]/i.test(phaseSection);

    if (hasUnchecked) {
      currentPhaseNumber = phaseNum;
      currentPhaseName = phaseName;
      result.currentPhase = {
        number: phaseNum,
        name: phaseName,
        status: hasChecked ? 'in-progress' : 'pending',
      };
      break;
    }
  }

  // If no unchecked phases found, project is complete
  if (currentPhaseNumber === 0 && result.completed === result.total && result.total > 0) {
    result.currentPhase.status = 'complete';
  }

  return result;
}

// ============================================================================
// Notepad Parsing Functions
// ============================================================================

/**
 * Load wisdom from a notepad directory.
 * Reads learnings.md, decisions.md, and issues.md if they exist.
 *
 * @param notepadDir - Path to notepad directory (e.g., .omc/notepads/_project)
 */
export function loadNotepadWisdom(notepadDir: string): WisdomInfo {
  const result: WisdomInfo = {
    learnings: [],
    decisions: [],
    issues: [],
  };

  if (!existsSync(notepadDir)) {
    // Try to find any notepad directories and load from the most recent
    const notepadsRoot = NOTEPAD_DIR;
    if (existsSync(notepadsRoot)) {
      const dirs = readdirSync(notepadsRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort()
        .reverse(); // Most recent first (assuming date-based or sequential naming)

      // Load from each notepad directory, collecting unique entries
      for (const dir of dirs.slice(0, 3)) {
        // Check last 3 notepads
        const dirPath = join(notepadsRoot, dir);
        const wisdom = loadSingleNotepadDir(dirPath);
        result.learnings.push(...wisdom.learnings);
        result.decisions.push(...wisdom.decisions);
        result.issues.push(...wisdom.issues);
      }

      // Deduplicate
      result.learnings = [...new Set(result.learnings)];
      result.decisions = [...new Set(result.decisions)];
      result.issues = [...new Set(result.issues)];
    }
    return result;
  }

  return loadSingleNotepadDir(notepadDir);
}

/**
 * Load wisdom from a single notepad directory.
 */
function loadSingleNotepadDir(notepadDir: string): WisdomInfo {
  const result: WisdomInfo = {
    learnings: [],
    decisions: [],
    issues: [],
  };

  // Load learnings.md
  const learningsPath = join(notepadDir, 'learnings.md');
  if (existsSync(learningsPath)) {
    result.learnings = parseNotepadEntries(readFileSync(learningsPath, 'utf-8'));
  }

  // Load decisions.md
  const decisionsPath = join(notepadDir, 'decisions.md');
  if (existsSync(decisionsPath)) {
    result.decisions = parseNotepadEntries(readFileSync(decisionsPath, 'utf-8'));
  }

  // Load issues.md
  const issuesPath = join(notepadDir, 'issues.md');
  if (existsSync(issuesPath)) {
    result.issues = parseNotepadEntries(readFileSync(issuesPath, 'utf-8'));
  }

  return result;
}

/**
 * Parse entries from a notepad markdown file.
 * Extracts section headers (## ...) as entry summaries.
 */
function parseNotepadEntries(content: string): string[] {
  const entries: string[] = [];

  // Match ## headers as entry titles
  const headerMatches = content.matchAll(/^## (.+)$/gm);
  for (const match of headerMatches) {
    const header = match[1].trim();
    // Skip file title headers (like "# Learnings: ...")
    if (!header.startsWith('#')) {
      entries.push(header);
    }
  }

  return entries;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format CoreInfo as a compact string for context injection.
 */
export function formatCoreInfo(info: CoreInfo): string {
  const lines: string[] = ['# Core Context'];

  // Current Progress
  lines.push('');
  lines.push('## Progress');
  lines.push(
    `Phase ${info.currentPhase.number}: ${info.currentPhase.name} (${info.currentPhase.status})`
  );
  if (info.currentPlan) {
    lines.push(`Current Plan: ${info.currentPlan.id} - ${info.currentPlan.objective}`);
  }
  lines.push(
    `Progress: ${info.progressMetrics.completed}/${info.progressMetrics.total} (${info.progressMetrics.percent}%)`
  );

  // Issues (most actionable - shown first)
  if (info.unresolvedIssues.length > 0) {
    lines.push('');
    lines.push('## Active Issues');
    for (const issue of info.unresolvedIssues) {
      lines.push(`- ${issue}`);
    }
  }

  // Pending Todos
  if (info.pendingTodos.length > 0) {
    lines.push('');
    lines.push('## Pending Todos');
    for (const todo of info.pendingTodos) {
      lines.push(`- ${todo}`);
    }
  }

  // Decisions (architectural context)
  if (info.architectureDecisions.length > 0) {
    lines.push('');
    lines.push('## Key Decisions');
    for (const decision of info.architectureDecisions) {
      lines.push(`- ${decision}`);
    }
  }

  // Learnings (patterns)
  if (info.recentLearnings.length > 0) {
    lines.push('');
    lines.push('## Recent Learnings');
    for (const learning of info.recentLearnings) {
      lines.push(`- ${learning}`);
    }
  }

  // References (for lookup)
  if (info.keyReferences.length > 0) {
    lines.push('');
    lines.push('## Key References');
    for (const ref of info.keyReferences) {
      lines.push(`- ${ref}`);
    }
  }

  return lines.join('\n');
}

/**
 * Estimate token count for CoreInfo (using chars/4 approximation).
 */
export function estimateCoreInfoTokens(info: CoreInfo): number {
  const formatted = formatCoreInfo(info);
  return Math.ceil(formatted.length / 4);
}
