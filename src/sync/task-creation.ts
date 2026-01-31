/**
 * Task Creation Utilities
 *
 * Generates TaskCreate invocations from plan mappings.
 * Part of the sync module for PLAN.md to Claude Tasks conversion.
 */

import type { TaskMapping } from './types.js';
import { getExecutionOrder } from './dependency-map.js';

// ============================================================================
// Types
// ============================================================================

/**
 * TaskCreate invocation parameters
 */
export interface TaskCreateInvocation {
  tool: 'TaskCreate';
  params: {
    subject: string;
    description: string;
    activeForm: string;
  };
  /** Internal task ID for correlation (e.g., "06-02-01") */
  internalId: string;
  /** Wave number for execution ordering */
  wave: number;
}

// ============================================================================
// Generation Functions
// ============================================================================

/**
 * Generate TaskCreate invocations from plan mappings.
 *
 * Creates invocations sorted by wave for proper execution order.
 * Each invocation includes the internal ID for correlation with
 * Claude Task IDs after creation.
 *
 * @param mappings - TaskMappings from plan parser
 * @returns Array of TaskCreate invocations in wave order
 *
 * @example
 * ```typescript
 * const mappings = extractTaskMappings(planData);
 * const creates = generateTaskCreations(mappings);
 *
 * // Creates are sorted by wave: Wave 1 first, then Wave 2, etc.
 * for (const create of creates) {
 *   console.log(`Create task ${create.internalId} (Wave ${create.wave})`);
 *   // Use TaskCreate tool with create.params
 * }
 * ```
 */
export function generateTaskCreations(
  mappings: TaskMapping[]
): TaskCreateInvocation[] {
  // Sort by wave for proper creation order
  const sorted = getExecutionOrder(mappings);

  return sorted.map((mapping) => ({
    tool: 'TaskCreate' as const,
    params: {
      subject: truncate(mapping.tool_params.description, 50),
      description: mapping.tool_params.prompt,
      activeForm: `Executing: ${truncate(mapping.tool_params.description, 40)}`,
    },
    internalId: mapping.task_id,
    wave: mapping.wave,
  }));
}

/**
 * Group task creations by wave.
 *
 * Returns an object mapping wave numbers to their task invocations.
 * Useful for wave-by-wave execution.
 *
 * @param invocations - TaskCreate invocations
 * @returns Object mapping wave number to invocations
 */
export function groupByWave(
  invocations: TaskCreateInvocation[]
): Record<number, TaskCreateInvocation[]> {
  const groups: Record<number, TaskCreateInvocation[]> = {};

  for (const inv of invocations) {
    if (!groups[inv.wave]) {
      groups[inv.wave] = [];
    }
    groups[inv.wave].push(inv);
  }

  return groups;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Truncate string to max length with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
