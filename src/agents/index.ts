/**
 * Agents module
 *
 * Provides agent configuration types and prompt management for
 * orchestrating specialized planning and execution workflows.
 */

// Re-export types explicitly to avoid conflicts
export type { AgentRole, AgentConfig, AgentPromptSection, AgentPrompt } from './types.js';

// Re-export planner agent
export { PLANNER_PROMPT, getPlannerPrompt, PLANNER_CONFIG, PLANNER_SECTIONS } from './prompts/planner.js';

// Re-export architect agent
export { ARCHITECT_PROMPT, getArchitectPrompt, ARCHITECT_CONFIG, ARCHITECT_SECTIONS } from './prompts/architect.js';

// Re-export critic agent
export { CRITIC_PROMPT, getCriticPrompt, CRITIC_CONFIG, CRITIC_SECTIONS } from './prompts/critic.js';
