/**
 * Session Lifecycle Hooks
 *
 * Hooks for session management:
 * - session-notification: Desktop/system notifications on idle/error
 * - auto-slash-command: Slash command detection and routing
 *
 * These hooks manage session-level behaviors and provide
 * event-driven notifications for external systems.
 *
 * @module hooks/session
 *
 * @example
 * import {
 *   createSessionNotificationHook,
 *   createAutoSlashCommandHook,
 *   parseSlashCommand,
 * } from 'ultra-planner/hooks';
 *
 * // Register hooks with the registry
 * registry.register({
 *   name: 'session-notification',
 *   enabled: true,
 *   priority: 200,  // Run late for monitoring
 *   factory: (ctx) => createSessionNotificationHook(ctx, { idleTimeoutMs: 60000 }),
 * });
 *
 * // Parse a slash command manually
 * const parsed = parseSlashCommand('/oh-my-claudecode:help');
 * // { command: 'oh-my-claudecode:help', namespace: 'oh-my-claudecode', name: 'help', ... }
 */

export * from './session-notification.js';
export * from './auto-slash-command.js';
