/**
 * Task Dependency Wiring
 *
 * Converts wave-based dependencies from PLAN.md to Claude Tasks blockedBy arrays.
 * Uses the sync module's dependency infrastructure to map internal task IDs
 * to Claude Task IDs via the TaskRegistry.
 *
 * Workflow:
 * 1. Parse plan to get TaskMappings (via sync module)
 * 2. Generate TaskCreate invocations sorted by wave
 * 3. Execute TaskCreates and register Claude IDs in registry
 * 4. Generate TaskUpdate invocations with blockedBy arrays
 * 5. Execute TaskUpdates to wire dependencies
 */

import type { TaskMapping } from '../sync/types.js';
import { buildDependencyMap, getExecutionOrder } from '../sync/dependency-map.js';
import { updateTask } from './api.js';
import type { TaskRegistry } from './registry.js';
import type { TaskCreateParams, TaskUpdateParams } from './types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Tool invocation result for batch operations
 *
 * Includes internal task ID for correlation between
 * TaskCreate results and TaskUpdate dependency setting.
 */
export interface TaskToolInvocation {
  tool: 'TaskCreate' | 'TaskUpdate';
  params: TaskCreateParams | TaskUpdateParams;
  /** Our internal task ID for correlation (e.g., "06-02-01") */
  internalId: string;
}

// ============================================================================
// Core Dependency Functions
// ============================================================================

/**
 * Set dependencies for a task using registry lookup.
 *
 * Converts internal task IDs to Claude Task IDs via registry,
 * then creates TaskUpdate invocation with addBlockedBy.
 *
 * @param internalId - Our task ID (e.g., "06-02-01")
 * @param internalBlockedBy - Array of internal task IDs that block this task
 * @param registry - TaskRegistry for ID mapping
 * @returns TaskUpdate invocation or null if no valid dependencies
 *
 * @example
 * ```typescript
 * const registry = await createTaskRegistry('./06-02-PLAN.md');
 * registry.register('06-01-01', '1');
 * registry.register('06-01-02', '2');
 * registry.register('06-02-01', '3');
 *
 * const invocation = setTaskDependencies(
 *   '06-02-01',  // Wave 2 task
 *   ['06-01-01', '06-01-02'],  // Blocked by Wave 1 tasks
 *   registry
 * );
 * // invocation.params.addBlockedBy === ['1', '2']
 * ```
 */
export function setTaskDependencies(
  internalId: string,
  internalBlockedBy: string[],
  registry: TaskRegistry
): TaskToolInvocation | null {
  // Get Claude Task ID for target task
  const claudeTaskId = registry.getClaudeId(internalId);
  if (!claudeTaskId) {
    console.warn(`Cannot set dependencies: task ${internalId} not registered`);
    return null;
  }

  // Map internal blockedBy IDs to Claude Task IDs
  const claudeBlockedBy = internalBlockedBy
    .map((id) => registry.getClaudeId(id))
    .filter((id): id is string => id !== undefined);

  // No valid dependencies to set
  if (claudeBlockedBy.length === 0) {
    return null;
  }

  const invocation = updateTask({
    taskId: claudeTaskId,
    addBlockedBy: claudeBlockedBy,
  });

  return {
    ...invocation,
    internalId,
  };
}

// ============================================================================
// Task Creation Generation
// ============================================================================

/**
 * Generate all task creation invocations for a plan.
 *
 * Creates TaskCreate invocations for all tasks, sorted by wave.
 * CRITICAL: Tasks must be created in wave order so that Wave N
 * tasks can reference Wave 1..N-1 tasks in their dependencies.
 *
 * @param mappings - TaskMappings from plan parser
 * @returns Array of TaskCreate invocations in wave order
 *
 * @example
 * ```typescript
 * const mappings = await parseAndExtractMappings('./06-02-PLAN.md');
 * const creates = generateTaskCreations(mappings);
 * // Creates sorted by wave: Wave 1 first, then Wave 2, etc.
 *
 * for (const create of creates) {
 *   const result = await executeTaskCreate(create);
 *   registry.register(create.internalId, result.id);
 * }
 * ```
 */
export function generateTaskCreations(
  mappings: TaskMapping[]
): TaskToolInvocation[] {
  // Sort by wave for proper creation order
  const sorted = getExecutionOrder(mappings);

  return sorted.map((mapping) => ({
    tool: 'TaskCreate' as const,
    params: {
      subject: mapping.tool_params.description.slice(0, 50),
      description: mapping.tool_params.prompt,
      activeForm: `Executing: ${mapping.tool_params.description}`,
    },
    internalId: mapping.task_id,
  }));
}

// ============================================================================
// Dependency Update Generation
// ============================================================================

/**
 * Generate all dependency updates for a plan.
 *
 * Creates TaskUpdate(addBlockedBy) invocations for tasks with dependencies.
 * MUST be called AFTER all tasks are created and registered.
 *
 * Uses buildDependencyMap from sync module to compute wave-based dependencies,
 * then maps internal IDs to Claude IDs via registry.
 *
 * @param mappings - TaskMappings from plan parser
 * @param registry - TaskRegistry with Claude Task ID mappings
 * @returns Array of TaskUpdate invocations for dependencies
 *
 * @example
 * ```typescript
 * // After all tasks created and registered:
 * const updates = generateDependencyUpdates(mappings, registry);
 *
 * for (const update of updates) {
 *   await executeTaskUpdate(update);
 * }
 * // Wave 2+ tasks now show as blocked in Claude UI
 * ```
 */
export function generateDependencyUpdates(
  mappings: TaskMapping[],
  registry: TaskRegistry
): TaskToolInvocation[] {
  // Build wave-based dependency map (internal IDs)
  const depMap = buildDependencyMap(mappings);

  const updates: TaskToolInvocation[] = [];

  for (const mapping of mappings) {
    const blockedBy = depMap[mapping.task_id] || [];

    if (blockedBy.length > 0) {
      const invocation = setTaskDependencies(
        mapping.task_id,
        blockedBy,
        registry
      );

      if (invocation) {
        updates.push(invocation);
      }
    }
  }

  return updates;
}

// ============================================================================
// Full Plan Registration Workflow
// ============================================================================

/**
 * Prepare full plan registration workflow.
 *
 * Returns both creation and dependency invocations.
 * Caller must:
 * 1. Execute all TaskCreate invocations
 * 2. Register returned IDs in registry
 * 3. Execute all TaskUpdate invocations for dependencies
 *
 * @param mappings - TaskMappings from plan parser
 * @returns Object with creates array and generateDependencies function
 *
 * @example
 * ```typescript
 * const mappings = await parseAndExtractMappings('./06-02-PLAN.md');
 * const { creates, generateDependencies } = preparePlanRegistration(mappings);
 *
 * // Step 1: Create all tasks
 * for (const create of creates) {
 *   const result = await executeTaskCreate(create);
 *   registry.register(create.internalId, result.id);
 * }
 *
 * // Step 2: Wire dependencies (after all tasks registered)
 * const updates = generateDependencies(registry);
 * for (const update of updates) {
 *   await executeTaskUpdate(update);
 * }
 * ```
 */
export function preparePlanRegistration(
  mappings: TaskMapping[]
): {
  creates: TaskToolInvocation[];
  generateDependencies: (registry: TaskRegistry) => TaskToolInvocation[];
} {
  const creates = generateTaskCreations(mappings);

  return {
    creates,
    generateDependencies: (registry: TaskRegistry) =>
      generateDependencyUpdates(mappings, registry),
  };
}
