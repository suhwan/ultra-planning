/**
 * Task ID Registry with Frontmatter Persistence
 *
 * Registry for mapping internal task IDs to Claude Task IDs.
 * Persists to PLAN.md frontmatter under `claude_task_ids` field.
 * This allows task mappings to survive session restarts.
 */

import { readFile, writeFile } from 'fs/promises';
import matter from 'gray-matter';
import type { ClaudeTaskId } from './types.js';

// ============================================================================
// TaskRegistry Class
// ============================================================================

/**
 * Registry for mapping internal task IDs to Claude Task IDs.
 *
 * Internal IDs are deterministic (e.g., "06-01-01" for phase 6, plan 1, task 1).
 * Claude IDs are assigned at runtime ("1", "2", etc.).
 *
 * Persistence is via PLAN.md frontmatter, allowing mappings to survive
 * session restarts and context window resets.
 *
 * @example
 * ```typescript
 * const registry = new TaskRegistry('/path/to/06-01-PLAN.md');
 * await registry.load();
 *
 * // Register a new mapping
 * registry.register('06-01-01', '1');
 *
 * // Look up Claude ID
 * const claudeId = registry.getClaudeId('06-01-01'); // '1'
 *
 * // Persist to frontmatter
 * await registry.save();
 * ```
 */
export class TaskRegistry {
  private registry: Map<string, string> = new Map();
  private planPath: string;

  constructor(planPath: string) {
    this.planPath = planPath;
  }

  // --------------------------------------------------------------------------
  // Core Registration Methods
  // --------------------------------------------------------------------------

  /**
   * Register a task ID mapping.
   *
   * @param internalId - Our internal task ID (e.g., "06-01-01")
   * @param claudeId - Claude's assigned task ID (e.g., "1")
   */
  register(internalId: string, claudeId: string): void {
    this.registry.set(internalId, claudeId);
  }

  /**
   * Get Claude Task ID for an internal ID.
   *
   * @param internalId - Our internal task ID
   * @returns Claude's task ID, or undefined if not registered
   */
  getClaudeId(internalId: string): string | undefined {
    return this.registry.get(internalId);
  }

  /**
   * Get internal ID for a Claude Task ID (reverse lookup).
   *
   * @param claudeId - Claude's task ID
   * @returns Our internal task ID, or undefined if not found
   */
  getInternalId(claudeId: string): string | undefined {
    for (const [internal, claude] of this.registry) {
      if (claude === claudeId) return internal;
    }
    return undefined;
  }

  /**
   * Check if an internal ID is registered.
   *
   * @param internalId - Our internal task ID
   * @returns true if registered
   */
  has(internalId: string): boolean {
    return this.registry.has(internalId);
  }

  /**
   * Get all registered mappings.
   *
   * @returns Array of ClaudeTaskId mappings
   */
  getAll(): ClaudeTaskId[] {
    return Array.from(this.registry.entries()).map(([internal, claude]) => ({
      internal,
      claude,
    }));
  }

  /**
   * Clear all registrations (for session reset).
   */
  clear(): void {
    this.registry.clear();
  }

  /**
   * Get count of registered tasks.
   */
  get size(): number {
    return this.registry.size;
  }

  /**
   * Get the plan path this registry is associated with.
   */
  get path(): string {
    return this.planPath;
  }

  // --------------------------------------------------------------------------
  // Persistence Methods
  // --------------------------------------------------------------------------

  /**
   * Load registry from PLAN.md frontmatter.
   *
   * Reads the `claude_task_ids` field from the plan's frontmatter.
   * If the file doesn't exist or can't be read, starts with an empty registry.
   */
  async load(): Promise<void> {
    try {
      const content = await readFile(this.planPath, 'utf-8');
      const parsed = matter(content);
      const claudeTaskIds = parsed.data.claude_task_ids as
        | Record<string, string>
        | undefined;

      if (claudeTaskIds) {
        this.registry = new Map(Object.entries(claudeTaskIds));
      }
    } catch {
      // File doesn't exist or can't be read - start with empty registry
      this.registry = new Map();
    }
  }

  /**
   * Save registry to PLAN.md frontmatter.
   *
   * Updates the `claude_task_ids` field in the plan's frontmatter.
   * Creates the field if it doesn't exist.
   *
   * @throws Error if file cannot be read or written
   */
  async save(): Promise<void> {
    const content = await readFile(this.planPath, 'utf-8');
    const parsed = matter(content);

    // Update frontmatter with registry
    parsed.data.claude_task_ids = Object.fromEntries(this.registry);

    const updated = matter.stringify(parsed.content, parsed.data);
    await writeFile(this.planPath, updated, 'utf-8');
  }

  /**
   * Check if registry has been modified since last load.
   * Useful for deciding whether to save.
   *
   * @returns true if registry has entries
   */
  isDirty(): boolean {
    return this.registry.size > 0;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create and optionally load a TaskRegistry.
 *
 * @param planPath - Path to the PLAN.md file
 * @param loadExisting - Whether to load existing mappings from frontmatter (default: true)
 * @returns Initialized TaskRegistry
 *
 * @example
 * ```typescript
 * // Load existing mappings
 * const registry = await createTaskRegistry('/path/to/06-01-PLAN.md');
 *
 * // Start fresh (ignore existing)
 * const freshRegistry = await createTaskRegistry('/path/to/06-01-PLAN.md', false);
 * ```
 */
export async function createTaskRegistry(
  planPath: string,
  loadExisting: boolean = true
): Promise<TaskRegistry> {
  const registry = new TaskRegistry(planPath);
  if (loadExisting) {
    await registry.load();
  }
  return registry;
}
