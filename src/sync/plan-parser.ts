/**
 * Enhanced PLAN.md Parser for Sync
 *
 * Parses PLAN.md files and extracts task mappings for Claude Task tool synchronization.
 * Integrates with existing xml/task-parser and templates/plan infrastructure.
 */

import { readFile } from 'fs/promises';
import { basename, dirname } from 'path';
import { parsePlanMd } from '../documents/templates/plan.js';
import { parseTasksSection } from '../documents/xml/task-parser.js';
import type { Task, AutoTask } from '../documents/xml/types.js';
import type {
  TaskMapping,
  TaskToolParams,
  PlanSyncData,
  SyncConfig,
  DEFAULT_SYNC_CONFIG,
} from './types.js';

// ============================================================================
// Task ID Generation
// ============================================================================

/**
 * Generate deterministic task ID from plan coordinates
 *
 * Format: {phase}-{plan:02d}-{taskIndex:02d}
 * Example: "06-01-01" for phase 06, plan 1, task 1
 *
 * @param phase - Phase identifier (e.g., "06-claude-tasks-sync" or "06")
 * @param plan - Plan number within phase
 * @param taskIndex - 1-based task index within plan
 * @returns Deterministic task ID
 */
export function generateTaskId(
  phase: string,
  plan: number,
  taskIndex: number
): string {
  // Extract numeric part from phase (e.g., "06-claude-tasks-sync" -> "06")
  const phaseNum = phase.split('-')[0].padStart(2, '0');
  const planNum = plan.toString().padStart(2, '0');
  const taskNum = taskIndex.toString().padStart(2, '0');

  return `${phaseNum}-${planNum}-${taskNum}`;
}

// ============================================================================
// Plan Parsing
// ============================================================================

/**
 * Parse PLAN.md file for sync operations
 *
 * Reads and parses a PLAN.md file, extracting frontmatter and tasks.
 *
 * @param planPath - Absolute path to PLAN.md file
 * @returns Parsed plan data including frontmatter, tasks, and path
 * @throws Error if file cannot be read or parsed
 */
export async function parsePlanForSync(planPath: string): Promise<PlanSyncData> {
  // Read file content
  const content = await readFile(planPath, 'utf-8');

  // Parse with gray-matter (via parsePlanMd)
  const { frontmatter, content: markdownContent } = parsePlanMd(content);

  // Extract tasks from content using xml task parser
  const tasks = parseTasksSection(markdownContent);

  // Extract frontmatter fields with defaults
  const phase = String(frontmatter.phase || extractPhaseFromPath(planPath));
  const plan = typeof frontmatter.plan === 'number' ? frontmatter.plan : 1;
  const wave = typeof frontmatter.wave === 'number' ? frontmatter.wave : 1;

  return {
    frontmatter: {
      ...frontmatter,
      phase,
      plan,
      wave,
    },
    tasks,
    path: planPath,
  };
}

/**
 * Extract phase from file path as fallback
 *
 * @param planPath - Path to PLAN.md file
 * @returns Phase identifier from path
 */
function extractPhaseFromPath(planPath: string): string {
  // Expected path format: .../phases/{phase-name}/{plan}-PLAN.md
  const dirName = basename(dirname(planPath));
  return dirName;
}

// ============================================================================
// Task Mapping Extraction
// ============================================================================

/**
 * Convert parsed plan data to TaskMapping array
 *
 * Creates TaskMapping objects for each task in the plan, generating:
 * - Deterministic task IDs
 * - Task tool parameters
 * - Initial execution state
 *
 * @param planData - Parsed plan data from parsePlanForSync
 * @param config - Optional sync configuration (uses defaults if not provided)
 * @returns Array of TaskMapping objects
 */
export function extractTaskMappings(
  planData: PlanSyncData,
  config?: Partial<SyncConfig>
): TaskMapping[] {
  const { frontmatter, tasks, path } = planData;

  // Merge with default config
  const syncConfig: SyncConfig = {
    default_model: config?.default_model ?? 'sonnet',
    default_subagent: config?.default_subagent ?? 'oh-my-claudecode:executor',
    update_checkboxes: config?.update_checkboxes ?? true,
    track_in_frontmatter: config?.track_in_frontmatter ?? false,
  };

  return tasks.map((task, index) => {
    const taskIndex = index + 1; // 1-based
    const taskId = generateTaskId(frontmatter.phase, frontmatter.plan, taskIndex);

    return {
      task_id: taskId,
      plan_path: path,
      name: task.name,
      type: task.type,
      tool_params: createTaskToolParams(task, syncConfig),
      status: 'pending',
      wave: frontmatter.wave,
    };
  });
}

/**
 * Create Task tool parameters from parsed task
 *
 * @param task - Parsed task object
 * @param config - Sync configuration
 * @returns TaskToolParams ready for Task tool invocation
 */
function createTaskToolParams(
  task: Task,
  config: SyncConfig
): TaskToolParams {
  // Create brief description (max 50 chars)
  const description = truncateDescription(task.name, 50);

  // Create full prompt based on task type
  const prompt = formatTaskPrompt(task);

  // Determine subagent type based on task type
  const subagent_type = determineSubagentType(task, config);

  return {
    description,
    prompt,
    subagent_type,
    model: config.default_model,
  };
}

/**
 * Truncate task name to description length limit
 *
 * @param name - Task name
 * @param maxLength - Maximum length (default 50)
 * @returns Truncated description
 */
function truncateDescription(name: string, maxLength: number = 50): string {
  // Remove "Task N:" prefix if present
  const cleanName = name.replace(/^Task\s+\d+:\s*/i, '');

  if (cleanName.length <= maxLength) {
    return cleanName;
  }

  return cleanName.substring(0, maxLength - 3) + '...';
}

/**
 * Determine appropriate subagent type for task
 *
 * @param task - Parsed task
 * @param config - Sync configuration
 * @returns Subagent type string
 */
function determineSubagentType(task: Task, config: SyncConfig): string {
  // Checkpoint tasks use a different subagent or require special handling
  if (task.type.startsWith('checkpoint:')) {
    // Checkpoint tasks are handled by the executor but with checkpoint awareness
    return config.default_subagent;
  }

  return config.default_subagent;
}

// ============================================================================
// Task Prompt Formatting
// ============================================================================

/**
 * Format task into full prompt for Task tool
 *
 * Creates a comprehensive prompt including:
 * - Task name/title
 * - Files to modify
 * - Action/implementation details
 * - Verification command
 * - Done criteria
 *
 * @param task - Parsed task object
 * @returns Formatted prompt string
 */
export function formatTaskPrompt(task: Task): string {
  if (task.type === 'auto') {
    return formatAutoTaskPrompt(task);
  }

  // Handle checkpoint tasks
  return formatCheckpointPrompt(task);
}

/**
 * Format autonomous task prompt
 *
 * @param task - Auto task object
 * @returns Formatted prompt
 */
function formatAutoTaskPrompt(task: AutoTask): string {
  const sections: string[] = [];

  // Title
  sections.push(`# ${task.name}`);

  // Files
  if (task.files && task.files.length > 0) {
    sections.push('## Files');
    sections.push(task.files.join(', '));
  }

  // Action
  if (task.action) {
    sections.push('## Action');
    sections.push(task.action);
  }

  // Verification
  if (task.verify) {
    sections.push('## Verification');
    sections.push(task.verify);
  }

  // Done Criteria
  if (task.done) {
    sections.push('## Done Criteria');
    sections.push(task.done);
  }

  return sections.join('\n\n');
}

/**
 * Format checkpoint task prompt
 *
 * @param task - Checkpoint task object
 * @returns Formatted prompt
 */
function formatCheckpointPrompt(task: Task): string {
  const sections: string[] = [];

  sections.push(`# ${task.name}`);
  sections.push(`Type: ${task.type}`);

  switch (task.type) {
    case 'checkpoint:human-verify':
      sections.push('## What Was Built');
      sections.push((task as any).whatBuilt || 'N/A');
      sections.push('## How to Verify');
      sections.push((task as any).howToVerify || 'N/A');
      sections.push('## Resume Signal');
      sections.push((task as any).resumeSignal || 'N/A');
      break;

    case 'checkpoint:decision':
      sections.push('## Decision');
      sections.push((task as any).decision || 'N/A');
      sections.push('## Context');
      sections.push((task as any).context || 'N/A');
      if ((task as any).options) {
        sections.push('## Options');
        for (const opt of (task as any).options) {
          sections.push(`### ${opt.id}: ${opt.name}`);
          sections.push(`Pros: ${opt.pros}`);
          sections.push(`Cons: ${opt.cons}`);
        }
      }
      break;

    case 'checkpoint:human-action':
      sections.push('## Action Required');
      sections.push((task as any).action || 'N/A');
      sections.push('## Instructions');
      sections.push((task as any).instructions || 'N/A');
      break;
  }

  return sections.join('\n\n');
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Parse PLAN.md and extract task mappings in one call
 *
 * Convenience function combining parsePlanForSync and extractTaskMappings.
 *
 * @param planPath - Absolute path to PLAN.md file
 * @param config - Optional sync configuration
 * @returns Array of TaskMapping objects
 */
export async function parseAndExtractMappings(
  planPath: string,
  config?: Partial<SyncConfig>
): Promise<TaskMapping[]> {
  const planData = await parsePlanForSync(planPath);
  return extractTaskMappings(planData, config);
}

/**
 * Get task mapping by ID
 *
 * @param mappings - Array of task mappings
 * @param taskId - Task ID to find
 * @returns TaskMapping or undefined if not found
 */
export function findTaskById(
  mappings: TaskMapping[],
  taskId: string
): TaskMapping | undefined {
  return mappings.find((m) => m.task_id === taskId);
}

/**
 * Get tasks by status
 *
 * @param mappings - Array of task mappings
 * @param status - Status to filter by
 * @returns Filtered task mappings
 */
export function filterTasksByStatus(
  mappings: TaskMapping[],
  status: TaskMapping['status']
): TaskMapping[] {
  return mappings.filter((m) => m.status === status);
}
