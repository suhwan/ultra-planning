/**
 * Hook System
 *
 * Comprehensive hook infrastructure for extensibility:
 * - Core hooks: continuation, context monitoring, notifications, recovery
 * - Tool hooks: output truncation, error recovery, retry hints
 * - Context hooks: compaction injection, keyword detection, agents injection
 * - Session hooks: notifications, slash commands
 * - Orchestrator hooks: file guard, single task, verification
 *
 * The hook system follows oh-my-opencode patterns:
 * - Factory pattern: createXxxHook() functions
 * - Priority-ordered dispatch: lower priority runs first
 * - Event-driven: hooks respond to chat, tool, and session events
 *
 * @module hooks
 *
 * @example
 * // Create hook infrastructure
 * import {
 *   createHookRegistry,
 *   createHookEventBus,
 *   type HookDefinition
 * } from 'ultra-planner/hooks';
 *
 * const eventBus = createHookEventBus();
 * const registry = createHookRegistry(eventBus);
 *
 * // Register a custom hook
 * const myHook: HookDefinition = {
 *   name: 'my-hook',
 *   enabled: true,
 *   priority: 100,
 *   factory: (ctx) => ({
 *     'tool.execute.before': (input) => {
 *       console.log(`Tool ${input.toolName} executing`);
 *     }
 *   })
 * };
 * registry.register(myHook);
 *
 * // Initialize with context
 * registry.initialize({
 *   sessionId: 'session-123',
 *   stateManager,
 *   emitEvent,
 *   config: { enabledHooks: [], disabledHooks: [], hookOptions: {} }
 * });
 *
 * @example
 * // Tool hooks for error recovery
 * import {
 *   createToolOutputTruncatorHook,
 *   createEditErrorRecoveryHook,
 * } from 'ultra-planner/hooks';
 *
 * @example
 * // Context hooks for keyword detection
 * import {
 *   createKeywordDetectorHook,
 *   createDirectoryAgentsInjectorHook,
 * } from 'ultra-planner/hooks';
 *
 * @example
 * // Session hooks for notifications
 * import {
 *   createSessionNotificationHook,
 *   createAutoSlashCommandHook,
 *   parseSlashCommand,
 * } from 'ultra-planner/hooks';
 *
 * @example
 * // Legacy orchestrator imports still work
 * import { shouldWarnOnWrite, SINGLE_TASK_DIRECTIVE } from 'ultra-planner/hooks';
 */

// Core hook system
export * from './types.js';
export * from './registry.js';
export * from './event-bus.js';

// Hook categories
export * from './core/index.js';
export * from './tool/index.js';
export * from './context/index.js';
export * from './session/index.js';

// Existing orchestrator hooks (backward compatible)
export * from './orchestrator/index.js';
