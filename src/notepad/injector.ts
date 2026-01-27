/**
 * Notepad Injector - Wisdom formatting for prompt injection
 *
 * Provides functions to format accumulated wisdom into injectable
 * prompt blocks for subagent delegation.
 */

import {
  WisdomSummary,
  NotepadConfig,
  DEFAULT_NOTEPAD_CONFIG,
  CHARS_PER_TOKEN,
} from './types.js';
import { getWisdomForPlan, getProjectWisdom } from './reader.js';

/**
 * Format wisdom summary as injectable prompt block
 * Prioritizes: issues > decisions > learnings (most actionable first)
 *
 * @param wisdom - Wisdom summary to format
 * @param maxTokens - Maximum tokens for output (default from config)
 * @returns Formatted markdown string or empty if no wisdom
 */
export function formatWisdomForPrompt(
  wisdom: WisdomSummary | null,
  maxTokens: number = DEFAULT_NOTEPAD_CONFIG.maxTokenBudget
): string {
  if (!wisdom || wisdom.tokenEstimate === 0) {
    return '';
  }

  const sections: string[] = [];
  const maxChars = maxTokens * CHARS_PER_TOKEN;

  // Priority order: issues first (blockers), then decisions, then learnings
  if (wisdom.issues.length > 0) {
    const issueText = wisdom.issues.slice(0, 3).join('\n\n');
    sections.push(`### Known Issues & Blockers\n${issueText}`);
  }

  if (wisdom.decisions.length > 0) {
    const decisionText = wisdom.decisions.slice(0, 3).join('\n\n');
    sections.push(`### Decisions Made\n${decisionText}`);
  }

  if (wisdom.learnings.length > 0) {
    const learningText = wisdom.learnings.slice(0, 3).join('\n\n');
    sections.push(`### Learnings & Patterns\n${learningText}`);
  }

  let formatted = sections.join('\n\n');

  // Truncate if over budget
  if (formatted.length > maxChars) {
    formatted = formatted.slice(0, maxChars - 20) + '\n\n[...truncated]';
  }

  return formatted;
}

/**
 * Create the full wisdom directive for subagent prompts
 * Combines plan-level and project-level wisdom with notepad write instructions
 *
 * @param planId - Current plan identifier
 * @param config - Optional config override
 * @returns Full directive string to inject into prompt
 */
export function createWisdomDirective(
  planId: string,
  config: Partial<NotepadConfig> = {}
): string {
  const fullConfig = { ...DEFAULT_NOTEPAD_CONFIG, ...config };
  const halfBudget = Math.floor(fullConfig.maxTokenBudget / 2);

  // Get both plan-level and project-level wisdom
  const planWisdom = getWisdomForPlan(planId, fullConfig);
  const projectWisdom = getProjectWisdom(fullConfig);

  const planSection = formatWisdomForPrompt(planWisdom, halfBudget);
  const projectSection = formatWisdomForPrompt(projectWisdom, halfBudget);

  // Build directive
  const parts: string[] = ['<wisdom>'];

  if (projectSection) {
    parts.push('## Project-Level Knowledge');
    parts.push(projectSection);
    parts.push('');
  }

  if (planSection) {
    parts.push('## Current Plan Knowledge');
    parts.push(planSection);
    parts.push('');
  }

  // Add notepad write instructions
  parts.push('## Notepad Location (for recording learnings)');
  parts.push(`NOTEPAD PATH: ${fullConfig.baseDir}/notepads/${planId}/`);
  parts.push('- learnings.md: Record patterns, conventions, successful approaches');
  parts.push('- issues.md: Record problems, blockers, gotchas encountered');
  parts.push('- decisions.md: Record architectural choices and rationales');
  parts.push('');
  parts.push('You SHOULD append findings to notepad files after completing work.');
  parts.push('IMPORTANT: Always APPEND to notepad files - never overwrite or use Edit tool.');

  parts.push('</wisdom>');

  return parts.join('\n');
}

/**
 * Quick check if there's any wisdom to inject
 * Use this to skip injection overhead when notepad is empty
 *
 * @param planId - Plan identifier
 * @param config - Optional config override
 * @returns true if wisdom exists
 */
export function hasWisdom(
  planId: string,
  config: Partial<NotepadConfig> = {}
): boolean {
  const planWisdom = getWisdomForPlan(planId, config);
  const projectWisdom = getProjectWisdom(config);

  return (
    (planWisdom !== null && planWisdom.tokenEstimate > 0) ||
    (projectWisdom !== null && projectWisdom.tokenEstimate > 0)
  );
}
