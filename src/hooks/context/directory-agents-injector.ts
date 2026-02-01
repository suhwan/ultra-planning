/**
 * Directory Agents Injector Hook
 *
 * Injects AGENTS.md content for directory context when operating
 * on files. This provides agents with codebase-specific guidance.
 *
 * Features:
 * - Automatic AGENTS.md discovery in parent directories
 * - Caching for performance
 * - Event emission for orchestrator injection
 * - Configurable search depth
 *
 * @module hooks/context/directory-agents-injector
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import type { HookContext, HookHandlers, ToolExecuteBeforeInput, ToolExecuteBeforeOutput } from '../types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration options for the directory agents injector.
 */
export interface DirectoryAgentsInjectorOptions {
  /** Search parent directories for AGENTS.md (default: true) */
  searchParents?: boolean;
  /** Maximum depth to search (default: 3) */
  maxDepth?: number;
  /** Tools to apply injection for (default: Read, Write, Edit) */
  applicableTools?: string[];
  /** Maximum content preview length for events (default: 500) */
  contentPreviewLength?: number;
}

// ============================================================================
// Constants
// ============================================================================

const HOOK_NAME = 'directory-agents-injector';

/** Default tools that trigger AGENTS.md lookup */
const DEFAULT_APPLICABLE_TOOLS = ['Read', 'Write', 'Edit'];

/** Default maximum search depth */
const DEFAULT_MAX_DEPTH = 3;

/** Default content preview length */
const DEFAULT_CONTENT_PREVIEW_LENGTH = 500;

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a directory agents injector hook.
 *
 * This hook monitors file operation tools and finds relevant
 * AGENTS.md files to provide context for the operation.
 *
 * @param ctx - Hook context with state manager and event emitter
 * @param options - Configuration options
 * @returns HookHandlers with tool.execute.before handler
 *
 * @example
 * const hook = createDirectoryAgentsInjectorHook(ctx, {
 *   searchParents: true,
 *   maxDepth: 5,
 * });
 */
export function createDirectoryAgentsInjectorHook(
  ctx: HookContext,
  options: DirectoryAgentsInjectorOptions = {}
): HookHandlers {
  const {
    searchParents = true,
    maxDepth = DEFAULT_MAX_DEPTH,
    applicableTools = DEFAULT_APPLICABLE_TOOLS,
    contentPreviewLength = DEFAULT_CONTENT_PREVIEW_LENGTH,
  } = options;

  /** Cache for AGENTS.md content by directory */
  const agentsCache = new Map<string, string | null>();

  /**
   * Find AGENTS.md file in directory or parent directories.
   *
   * @param dir - Starting directory
   * @param depth - Current search depth
   * @returns AGENTS.md content or null if not found
   */
  function findAgentsMd(dir: string, depth: number = 0): string | null {
    // Check depth limit
    if (depth > maxDepth) {
      return null;
    }

    // Check cache
    const cached = agentsCache.get(dir);
    if (cached !== undefined) {
      return cached;
    }

    // Check for AGENTS.md in current directory
    const agentsPath = join(dir, 'AGENTS.md');
    try {
      if (existsSync(agentsPath)) {
        const content = readFileSync(agentsPath, 'utf-8');
        agentsCache.set(dir, content);
        return content;
      }
    } catch {
      // Ignore read errors, try parent
    }

    // Search parent if allowed
    if (searchParents) {
      const parent = dirname(dir);
      // Stop at filesystem root
      if (parent !== dir) {
        const parentResult = findAgentsMd(parent, depth + 1);
        agentsCache.set(dir, parentResult);
        return parentResult;
      }
    }

    // Not found
    agentsCache.set(dir, null);
    return null;
  }

  /**
   * Extract file path from tool parameters.
   *
   * @param params - Tool parameters
   * @returns File path or null
   */
  function extractFilePath(params: Record<string, unknown>): string | null {
    // Common parameter names for file paths
    const pathKeys = ['path', 'file_path', 'filePath', 'file'];
    for (const key of pathKeys) {
      const value = params[key];
      if (typeof value === 'string') {
        return value;
      }
    }
    return null;
  }

  /**
   * Handler for tool.execute.before events.
   * Finds and emits AGENTS.md context for file operations.
   */
  async function toolExecuteBeforeHandler(
    input: ToolExecuteBeforeInput
  ): Promise<ToolExecuteBeforeOutput | void> {
    const { toolName, params, sessionId } = input;

    // Only process applicable tools
    if (!applicableTools.includes(toolName)) {
      return;
    }

    // Extract file path from parameters
    const filePath = extractFilePath(params);
    if (!filePath) {
      return;
    }

    // Get directory from file path
    const dir = dirname(filePath);

    // Find AGENTS.md
    const agentsContent = findAgentsMd(dir);
    if (!agentsContent) {
      return;
    }

    // Emit event with context
    ctx.emitEvent({
      type: 'agents_context_available',
      payload: {
        sessionId,
        directory: dir,
        filePath,
        contentPreview: agentsContent.slice(0, contentPreviewLength),
        fullContentLength: agentsContent.length,
      },
      source: `hook:${HOOK_NAME}`,
    });

    // Don't block or modify the tool execution
    return;
  }

  return {
    'tool.execute.before': toolExecuteBeforeHandler,
  };
}

/**
 * Clear the AGENTS.md cache.
 * Useful for testing or when files have changed.
 */
export function clearAgentsCache(): void {
  // Note: In practice, this would need access to the hook instance's cache
  // This is exported for potential external cache management
  console.log(`[${HOOK_NAME}] Cache clear requested (external management)`);
}
