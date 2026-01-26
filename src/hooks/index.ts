/**
 * Hooks Module
 *
 * Re-exports all hook utilities including:
 * - Orchestrator enforcement (file guard, single task directive)
 * - (Future: verification reminder)
 *
 * Hooks provide soft enforcement mechanisms that guide agent behavior
 * through warnings and directives rather than hard blocking.
 *
 * @module hooks
 *
 * @example
 * // Import hooks from main module
 * import { shouldWarnOnWrite, SINGLE_TASK_DIRECTIVE } from 'ultra-planner/hooks';
 */

export * from './orchestrator/index.js';
