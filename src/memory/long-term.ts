/**
 * LongTermMemoryManager - Persistent wisdom storage
 *
 * Manages the .planning/wisdom/ directory for persistent learnings,
 * decisions, issues, and patterns that survive across sessions.
 */

import { mkdirSync, existsSync, writeFileSync, readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { LongTermMemory, MemoryLayer, MemoryConfig, DEFAULT_MEMORY_CONFIG } from './types.js';

/** Characters per token estimate (from notepad/types.ts) */
const CHARS_PER_TOKEN = 4;

/** Wisdom file categories */
type WisdomCategory = 'learnings' | 'decisions' | 'issues' | 'patterns';

/**
 * Manages long-term memory (persistent wisdom)
 *
 * Long-term memory persists across sessions in the wisdom directory.
 * It stores learnings, decisions, issues, and patterns.
 */
export class LongTermMemoryManager {
  private readonly config: MemoryConfig;
  private memory: LongTermMemory | null = null;

  /**
   * Create a new LongTermMemoryManager
   *
   * @param config - Optional partial config to override defaults
   */
  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
  }

  /**
   * Get the wisdom directory path
   *
   * @returns Absolute path to wisdom directory
   */
  getWisdomDir(): string {
    return join(this.config.baseDir, this.config.wisdomDir);
  }

  /**
   * Get path to a specific wisdom file
   *
   * @param category - Wisdom category
   * @returns Absolute path to wisdom file
   */
  getWisdomPath(category: WisdomCategory): string {
    return join(this.getWisdomDir(), `${category}.md`);
  }

  /**
   * Initialize the wisdom directory structure
   *
   * Creates wisdom/ directory with learnings.md, decisions.md,
   * issues.md, and patterns.md files.
   *
   * @returns true if initialization succeeded
   */
  initWisdomDir(): boolean {
    const wisdomDir = this.getWisdomDir();

    try {
      // Create directory if it doesn't exist
      if (!existsSync(wisdomDir)) {
        mkdirSync(wisdomDir, { recursive: true });
      }

      // Initialize category files with headers
      const categories: WisdomCategory[] = ['learnings', 'decisions', 'issues', 'patterns'];
      for (const category of categories) {
        const filePath = this.getWisdomPath(category);
        if (!existsSync(filePath)) {
          const title = category.charAt(0).toUpperCase() + category.slice(1);
          const header = `# ${title}\n\nPersistent wisdom captured across sessions.\n\n`;
          writeFileSync(filePath, header, 'utf-8');
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load wisdom from all category files
   *
   * @returns Loaded long-term memory
   */
  loadWisdom(): LongTermMemory {
    // Ensure wisdom directory exists
    if (!existsSync(this.getWisdomDir())) {
      this.initWisdomDir();
    }

    const learnings = this.loadCategory('learnings');
    const decisions = this.loadCategory('decisions');
    const issues = this.loadCategory('issues');
    const patterns = this.loadCategory('patterns');

    // Calculate token estimate
    const allContent = [...learnings, ...decisions, ...issues, ...patterns].join('\n');
    const tokenEstimate = Math.ceil(allContent.length / CHARS_PER_TOKEN);

    this.memory = {
      layer: MemoryLayer.LongTerm,
      learnings,
      decisions,
      issues,
      patterns,
      tokenEstimate,
    };

    return { ...this.memory };
  }

  /**
   * Append a learning to the learnings file
   *
   * @param content - Learning content
   * @param timestamp - Optional ISO timestamp (defaults to now)
   */
  appendLearning(content: string, timestamp?: string): void {
    this.appendEntry('learnings', content, timestamp);
    this.invalidateCache();
  }

  /**
   * Append a decision to the decisions file
   *
   * @param content - Decision content
   * @param timestamp - Optional ISO timestamp (defaults to now)
   */
  appendDecision(content: string, timestamp?: string): void {
    this.appendEntry('decisions', content, timestamp);
    this.invalidateCache();
  }

  /**
   * Append an issue to the issues file
   *
   * @param content - Issue content
   * @param timestamp - Optional ISO timestamp (defaults to now)
   */
  appendIssue(content: string, timestamp?: string): void {
    this.appendEntry('issues', content, timestamp);
    this.invalidateCache();
  }

  /**
   * Append a pattern to the patterns file
   *
   * @param content - Pattern content
   * @param timestamp - Optional ISO timestamp (defaults to now)
   */
  appendPattern(content: string, timestamp?: string): void {
    this.appendEntry('patterns', content, timestamp);
    this.invalidateCache();
  }

  /**
   * Get a formatted wisdom summary for prompt injection
   *
   * @param maxTokens - Maximum tokens for the summary (default: config value)
   * @returns Formatted wisdom string
   */
  getWisdomSummary(maxTokens?: number): string {
    const budget = maxTokens ?? this.config.maxWisdomTokens;
    const maxChars = budget * CHARS_PER_TOKEN;

    // Load wisdom if not cached
    if (!this.memory) {
      this.loadWisdom();
    }

    if (!this.memory) {
      return '';
    }

    // Build summary with priority ordering
    const sections: string[] = [];
    let charCount = 0;

    // Patterns first (most actionable)
    if (this.memory.patterns.length > 0) {
      const patternsSection = this.formatSection('Patterns', this.memory.patterns);
      if (charCount + patternsSection.length <= maxChars) {
        sections.push(patternsSection);
        charCount += patternsSection.length;
      }
    }

    // Learnings second
    if (this.memory.learnings.length > 0) {
      const learningsSection = this.formatSection('Learnings', this.memory.learnings);
      if (charCount + learningsSection.length <= maxChars) {
        sections.push(learningsSection);
        charCount += learningsSection.length;
      }
    }

    // Decisions third
    if (this.memory.decisions.length > 0) {
      const decisionsSection = this.formatSection('Decisions', this.memory.decisions);
      if (charCount + decisionsSection.length <= maxChars) {
        sections.push(decisionsSection);
        charCount += decisionsSection.length;
      }
    }

    // Issues last
    if (this.memory.issues.length > 0) {
      const issuesSection = this.formatSection('Issues', this.memory.issues);
      if (charCount + issuesSection.length <= maxChars) {
        sections.push(issuesSection);
        charCount += issuesSection.length;
      }
    }

    if (sections.length === 0) {
      return '';
    }

    return `## Project Wisdom\n\n${sections.join('\n\n')}`;
  }

  /**
   * Get current long-term memory
   *
   * @returns Current memory or null if not loaded
   */
  getMemory(): LongTermMemory | null {
    return this.memory ? { ...this.memory } : null;
  }

  /**
   * Check if wisdom directory exists
   *
   * @returns true if wisdom directory exists
   */
  wisdomExists(): boolean {
    return existsSync(this.getWisdomDir());
  }

  /**
   * Load entries from a category file
   *
   * @private
   * @param category - Wisdom category
   * @returns Array of entry strings
   */
  private loadCategory(category: WisdomCategory): string[] {
    const filePath = this.getWisdomPath(category);

    if (!existsSync(filePath)) {
      return [];
    }

    try {
      const content = readFileSync(filePath, 'utf-8');

      // Parse entries (lines starting with - )
      const entries = content
        .split('\n')
        .filter(line => line.startsWith('- '))
        .map(line => line.slice(2).trim());

      return entries;
    } catch {
      return [];
    }
  }

  /**
   * Append an entry to a category file
   *
   * @private
   * @param category - Wisdom category
   * @param content - Entry content
   * @param timestamp - Optional ISO timestamp
   */
  private appendEntry(category: WisdomCategory, content: string, timestamp?: string): void {
    const filePath = this.getWisdomPath(category);

    // Ensure file exists
    if (!existsSync(filePath)) {
      this.initWisdomDir();
    }

    const ts = timestamp ?? new Date().toISOString();
    const entry = `- [${ts}] ${content}\n`;

    try {
      appendFileSync(filePath, entry, 'utf-8');
    } catch {
      // Silently ignore append errors
    }
  }

  /**
   * Format a section for the wisdom summary
   *
   * @private
   * @param title - Section title
   * @param entries - Section entries
   * @returns Formatted section string
   */
  private formatSection(title: string, entries: string[]): string {
    const items = entries.map(e => `- ${e}`).join('\n');
    return `### ${title}\n${items}`;
  }

  /**
   * Invalidate the cached memory to force reload
   *
   * @private
   */
  private invalidateCache(): void {
    this.memory = null;
  }
}
