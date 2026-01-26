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
 * Autopilot keyword - Full autonomous execution
 */
export const AUTOPILOT_KEYWORD: MagicKeyword = {
  triggers: ['autopilot', 'build me', 'create me', 'make me'],
  description: 'Full autonomous execution from idea to working code',
  action: (prompt: string) => {
    const cleanPrompt = removeTriggerWords(prompt, ['autopilot']);
    return `[AUTOPILOT MODE] Full autonomous execution activated. I will plan, implement, test, and verify the complete solution with minimal user intervention.\n\n${cleanPrompt}`;
  }
};

/**
 * Plan keyword - Planning session with interview workflow
 */
export const PLAN_KEYWORD: MagicKeyword = {
  triggers: ['plan', 'plan this', 'plan the'],
  description: 'Planning session with interview workflow',
  action: (prompt: string) => {
    const cleanPrompt = removeTriggerWords(prompt, ['plan']);
    return `[PLANNING MODE] Start planning interview workflow. I will gather requirements and create a comprehensive work plan.\n\n${cleanPrompt}`;
  }
};

/**
 * Ultrawork keyword - Maximum parallel execution
 */
export const ULTRAWORK_KEYWORD: MagicKeyword = {
  triggers: ['ultrawork', 'ulw', 'uw'],
  description: 'Maximum parallel execution mode',
  action: (prompt: string) => {
    const cleanPrompt = removeTriggerWords(prompt, ['ultrawork', 'ulw', 'uw']);
    return `[ULTRAWORK MODE] Maximum precision mode activated. I will leverage parallel execution and orchestrate specialized agents for optimal performance.\n\n${cleanPrompt}`;
  }
};

/**
 * Ralplan keyword - Iterative planning with verification
 */
export const RALPLAN_KEYWORD: MagicKeyword = {
  triggers: ['ralplan', 'iterative plan'],
  description: 'Iterative planning with Planner+Architect+Critic',
  action: (prompt: string) => {
    const cleanPrompt = removeTriggerWords(prompt, ['ralplan', 'iterative plan']);
    return `[RALPLAN MODE] Iterative verification loop activated. I will create a plan, verify with Architect and Critic, and iterate until consensus is reached.\n\n${cleanPrompt}`;
  }
};

/**
 * All built-in magic keywords
 */
export const BUILTIN_KEYWORDS: MagicKeyword[] = [
  AUTOPILOT_KEYWORD,
  PLAN_KEYWORD,
  ULTRAWORK_KEYWORD,
  RALPLAN_KEYWORD
];
