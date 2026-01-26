/**
 * Command Keyword Triggers
 *
 * Maps natural language keywords to slash commands for unified invocation.
 */

import type { MagicKeyword } from './types.js';

/**
 * Removes trigger words from prompt
 */
function removeTriggerWords(prompt: string, triggers: string[]): string {
  let result = prompt;
  for (const trigger of triggers) {
    const regex = new RegExp(`\\b${trigger}\\b`, 'gi');
    result = result.replace(regex, '');
  }
  return result.trim();
}

/**
 * New project keyword - Initialize Ultra Planner project
 */
export const NEW_PROJECT_KEYWORD: MagicKeyword = {
  triggers: ['ultraplan new', 'new project', 'start project', 'init ultraplan'],
  description: 'Initialize new Ultra Planner project',
  action: (prompt: string) => {
    // Extract description after trigger
    const cleaned = removeTriggerWords(prompt, ['ultraplan new', 'new project', 'start project', 'init ultraplan']);
    return `[COMMAND: /ultraplan:new-project ${cleaned}]`;
  }
};

/**
 * Plan phase keyword - Plan a specific phase
 */
export const PLAN_PHASE_KEYWORD: MagicKeyword = {
  triggers: ['ultraplan plan', 'plan phase'],
  description: 'Plan a specific phase',
  action: (prompt: string) => {
    // Extract phase number
    const match = prompt.match(/phase\s*(\d+)|(\d+)/i);
    const phase = match ? match[1] || match[2] : '';
    return `[COMMAND: /ultraplan:plan-phase ${phase}]`;
  }
};

/**
 * Execute keyword - Execute a plan file
 */
export const EXECUTE_KEYWORD: MagicKeyword = {
  triggers: ['ultraplan execute', 'execute plan', 'run plan'],
  description: 'Execute a plan file',
  action: (prompt: string) => {
    // Extract plan reference (format: XX-YY)
    const match = prompt.match(/(\d+-\d+)/);
    const plan = match ? match[1] : '';
    return `[COMMAND: /ultraplan:execute ${plan}]`;
  }
};

/**
 * All command trigger keywords
 */
export const COMMAND_KEYWORDS: MagicKeyword[] = [
  NEW_PROJECT_KEYWORD,
  PLAN_PHASE_KEYWORD,
  EXECUTE_KEYWORD,
];

/**
 * Get command for keyword if matched
 *
 * @param input - User input to check for command keywords
 * @returns Command string if matched, null otherwise
 */
export function getCommandForKeyword(input: string): string | null {
  const lower = input.toLowerCase();
  for (const kw of COMMAND_KEYWORDS) {
    for (const trigger of kw.triggers) {
      if (lower.includes(trigger)) {
        return kw.action(input);
      }
    }
  }
  return null;
}
