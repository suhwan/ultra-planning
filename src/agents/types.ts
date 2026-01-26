/**
 * Agent configuration types for ultra-planning workflows
 *
 * Defines the structure for agent roles, configurations, and prompts.
 * Supports dynamic prompt composition during planning workflows.
 */

/** Agent role identifiers */
export type AgentRole = 'planner' | 'executor' | 'architect' | 'critic';

/** Agent metadata for spawning */
export interface AgentConfig {
  /** Unique agent identifier */
  name: string;

  /** Human-readable description of agent's purpose */
  description: string;

  /** Role category for this agent */
  role: AgentRole;

  /** Tools this agent requires for operation */
  tools: string[];

  /** Suggested model tier for optimal performance */
  suggestedModel?: 'opus' | 'sonnet' | 'haiku';

  /** Color identifier for UI/logging */
  color?: string;
}

/** Named section within agent prompt */
export interface AgentPromptSection {
  /** Section identifier (e.g., 'role', 'philosophy') */
  name: string;

  /** XML tag name for wrapping this section */
  tag: string;

  /** Markdown content of this section */
  content: string;
}

/** Structured agent prompt with metadata and composition */
export interface AgentPrompt {
  /** Agent configuration metadata */
  config: AgentConfig;

  /** Ordered list of prompt sections */
  sections: AgentPromptSection[];

  /** Generate complete prompt string with all sections */
  getFullPrompt(): string;
}
