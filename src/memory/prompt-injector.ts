/**
 * Prompt Injector - Format wisdom for subagent prompts
 *
 * Formats long-term wisdom into injectable prompt blocks with priority ordering.
 * Priority: issues > decisions > learnings (most actionable first)
 */

import { LongTermMemory, MemoryConfig, DEFAULT_MEMORY_CONFIG } from './types.js';

const CHARS_PER_TOKEN = 4;

/**
 * Format long-term wisdom into injectable prompt block
 * Priority: issues > decisions > learnings (most actionable first)
 */
export function formatWisdomBlock(
  memory: LongTermMemory | null,
  maxTokens: number = 1000
): string {
  if (!memory) {
    return '';
  }

  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const sections: string[] = [];

  // Issues first (blockers/warnings)
  if (memory.issues.length > 0) {
    const issueText = memory.issues.slice(0, 5).map(i => `- ${i}`).join('\n');
    sections.push(`### Known Issues\n${issueText}`);
  }

  // Decisions (architectural context)
  if (memory.decisions.length > 0) {
    const decisionText = memory.decisions.slice(0, 5).map(d => `- ${d}`).join('\n');
    sections.push(`### Key Decisions\n${decisionText}`);
  }

  // Learnings (patterns and knowledge)
  if (memory.learnings.length > 0) {
    const learningText = memory.learnings.slice(0, 5).map(l => `- ${l}`).join('\n');
    sections.push(`### Accumulated Knowledge\n${learningText}`);
  }

  // Patterns (code references)
  if (memory.patterns.length > 0) {
    const patternText = memory.patterns.slice(0, 3).map(p => `- \`${p}\``).join('\n');
    sections.push(`### Useful Patterns\n${patternText}`);
  }

  let formatted = sections.join('\n\n');

  // Truncate if over budget
  if (formatted.length > maxChars) {
    formatted = formatted.slice(0, maxChars - 20) + '\n\n[...truncated]';
  }

  return formatted;
}

export class WisdomPromptInjector {
  private config: MemoryConfig;

  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
  }

  /**
   * Create full wisdom directive for subagent prompts
   * Includes wisdom + instructions for recording new learnings
   */
  createInjectionBlock(
    longTermMemory: LongTermMemory | null,
    currentPlanId: string | null = null
  ): string {
    const wisdomBlock = formatWisdomBlock(longTermMemory, this.config.maxWisdomTokens);

    if (!wisdomBlock && !currentPlanId) {
      return '';
    }

    const parts: string[] = ['<project-wisdom>'];

    if (wisdomBlock) {
      parts.push('## Accumulated Project Wisdom');
      parts.push('');
      parts.push(wisdomBlock);
      parts.push('');
    }

    // Instructions for recording new wisdom
    parts.push('## Recording New Wisdom');
    parts.push('');
    parts.push(`WISDOM PATH: ${this.config.baseDir}/${this.config.wisdomDir}/`);
    parts.push('');
    parts.push('After completing work, record significant findings:');
    parts.push('- learnings.md: Patterns, techniques, gotchas');
    parts.push('- decisions.md: Architectural choices with rationale');
    parts.push('- issues.md: Problems encountered and solutions');
    parts.push('');
    parts.push('Format: ## YYYY-MM-DDTHH:MM:SSZ | Task: {taskId}');
    parts.push('');
    parts.push('</project-wisdom>');

    return parts.join('\n');
  }

  /**
   * Estimate tokens for a wisdom block
   */
  estimateTokens(memory: LongTermMemory | null): number {
    if (!memory) return 0;
    return memory.tokenEstimate;
  }
}
