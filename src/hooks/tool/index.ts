/**
 * Tool Hooks
 *
 * Hooks for tool execution enhancement:
 * - tool-output-truncator: Limit large outputs to prevent context bloat
 * - empty-task-response-detector: Detect empty subagent responses
 * - edit-error-recovery: Recovery hints for Edit tool errors
 * - delegate-task-retry: Hints for delegation failures
 *
 * These hooks implement critical behaviors for maintaining efficient
 * agent execution and error recovery.
 *
 * @module hooks/tool
 *
 * @example
 * import {
 *   createToolOutputTruncatorHook,
 *   createEmptyTaskResponseDetectorHook,
 *   createEditErrorRecoveryHook,
 *   createDelegateTaskRetryHook,
 * } from 'ultra-planner/hooks';
 *
 * // Register hooks with the registry
 * registry.register({
 *   name: 'tool-output-truncator',
 *   enabled: true,
 *   priority: 100,
 *   factory: (ctx) => createToolOutputTruncatorHook(ctx, { maxOutputLength: 30000 }),
 * });
 */

export * from './tool-output-truncator.js';
export * from './empty-task-response-detector.js';
export * from './edit-error-recovery.js';
export * from './delegate-task-retry.js';
export * from './category-routing.js';
