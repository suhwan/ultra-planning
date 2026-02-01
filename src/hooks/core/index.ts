/**
 * Core Hooks
 *
 * Essential hooks for agent orchestration:
 * - todo-continuation-enforcer: Auto-continue on incomplete tasks
 * - context-window-monitor: Token usage tracking and warnings
 * - background-notification: Task completion alerts with batching
 * - session-recovery: Error recovery with retry logic
 *
 * These hooks implement critical behaviors from oh-my-opencode
 * that ensure agents complete their work without premature stopping.
 *
 * @module hooks/core
 *
 * @example
 * import {
 *   createTodoContinuationEnforcerHook,
 *   createContextWindowMonitorHook,
 *   createBackgroundNotificationHook,
 *   createSessionRecoveryHook,
 * } from 'ultra-planner/hooks';
 *
 * // Auto-continue on incomplete tasks
 * const todoContinuationHook = createTodoContinuationEnforcerHook(ctx, {
 *   countdownSeconds: 2,
 *   skipAgents: ['prometheus'],
 * });
 *
 * // Track context window usage
 * const contextMonitorHook = createContextWindowMonitorHook(ctx, {
 *   warningThreshold: 0.70,
 * });
 *
 * // Batch background task notifications
 * const notificationHook = createBackgroundNotificationHook(ctx, {
 *   batchWindow: 1000,
 *   maxBatchSize: 5,
 * });
 *
 * // Handle session errors with retry logic
 * const recoveryHook = createSessionRecoveryHook(ctx, {
 *   maxRetries: 3,
 *   recoverableErrors: ['RateLimitError', 'TimeoutError'],
 * });
 */

export * from './todo-continuation-enforcer.js';
export * from './context-window-monitor-hook.js';
export * from './background-notification.js';
export * from './session-recovery.js';
