/**
 * Compaction Context Injector Hook
 *
 * Injects critical context during session compaction to preserve
 * important state information when the context window is reduced.
 *
 * Features:
 * - Configurable context sections (decisions, progress, tasks)
 * - Event-driven injection during compaction
 * - Preserves critical state information
 *
 * @module hooks/context/compaction-context-injector
 */

import type { HookContext, HookHandlers, EventInput, EventOutput } from '../types.js';
import { ExtendedSystemDirectiveTypes } from '../types.js';
import { SYSTEM_DIRECTIVE_PREFIX } from '../orchestrator/types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration options for the compaction context injector.
 */
export interface CompactionContextInjectorOptions {
  /** Include preserved decisions from STATE.md (default: true) */
  includeDecisions?: boolean;
  /** Include current progress from ROADMAP.md (default: true) */
  includeProgress?: boolean;
  /** Include pending tasks from PLAN.md (default: true) */
  includePendingTasks?: boolean;
  /** Custom context sections to inject */
  customSections?: string[];
}

// ============================================================================
// Constants
// ============================================================================

const HOOK_NAME = 'compaction-context-injector';

/**
 * Create a system directive for compaction context.
 */
function createCompactionDirective(): string {
  return `${SYSTEM_DIRECTIVE_PREFIX} - COMPACTION CONTEXT]`;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a compaction context injector hook.
 *
 * This hook monitors session compaction events and injects
 * critical context to preserve important state information.
 *
 * @param ctx - Hook context with state manager and event emitter
 * @param options - Configuration options
 * @returns HookHandlers with event handler
 *
 * @example
 * const hook = createCompactionContextInjectorHook(ctx, {
 *   includeDecisions: true,
 *   includeProgress: true,
 *   includePendingTasks: true,
 * });
 */
export function createCompactionContextInjectorHook(
  ctx: HookContext,
  options: CompactionContextInjectorOptions = {}
): HookHandlers {
  const {
    includeDecisions = true,
    includeProgress = true,
    includePendingTasks = true,
    customSections = [],
  } = options;

  /**
   * Build the context injection content.
   */
  function buildContextContent(): string {
    const sections: string[] = [];

    if (includeDecisions) {
      sections.push(`[Preserved Decisions]
Key architectural decisions and patterns are documented in STATE.md.
Read STATE.md to restore context on important decisions made.`);
    }

    if (includeProgress) {
      sections.push(`[Current Progress]
Check ROADMAP.md for current phase and plan status.
Use the progress table to determine which tasks are complete.`);
    }

    if (includePendingTasks) {
      sections.push(`[Pending Tasks]
Continue execution from the current task in PLAN.md.
Tasks marked with [ ] are pending, [x] are complete.`);
    }

    // Add custom sections
    for (const section of customSections) {
      sections.push(section);
    }

    return sections.join('\n\n');
  }

  /**
   * Handler for compaction events.
   */
  async function eventHandler(input: EventInput): Promise<EventOutput | void> {
    const { event, sessionId } = input;

    // Handle compaction events
    if (event.type === 'session_compacting' || event.type === 'context_compacting') {
      const contextContent = buildContextContent();

      if (contextContent) {
        // Emit event with context to inject
        ctx.emitEvent({
          type: 'compaction_context_available',
          payload: {
            sessionId,
            directive: createCompactionDirective(),
            content: contextContent,
          },
          source: `hook:${HOOK_NAME}`,
        });
      }

      return { handled: true };
    }

    return { handled: false };
  }

  return {
    event: eventHandler,
  };
}

/**
 * Exported system directive types extension for compaction.
 */
export const CompactionDirectiveTypes = {
  COMPACTION_CONTEXT: 'COMPACTION CONTEXT',
} as const;
