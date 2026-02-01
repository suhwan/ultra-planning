/**
 * Hook Registry
 *
 * Manages the lifecycle of hooks including registration, initialization,
 * enabling/disabling, and event dispatch. Follows the factory pattern
 * from oh-my-opencode.
 *
 * Key responsibilities:
 * - Register/unregister hook definitions
 * - Initialize hooks from factories with context
 * - Dispatch events to handlers in priority order
 * - Handle errors gracefully without breaking other hooks
 *
 * @module hooks/registry
 *
 * @example
 * import { createHookRegistry, createHookEventBus } from './hooks';
 *
 * const eventBus = createHookEventBus();
 * const registry = createHookRegistry(eventBus);
 *
 * registry.register({
 *   name: 'my-hook',
 *   enabled: true,
 *   priority: 100,
 *   factory: (ctx) => ({
 *     'chat.message': (input) => console.log(input.content)
 *   })
 * });
 *
 * registry.initialize(context);
 * await registry.dispatch('chat.message', messageInput, undefined);
 */

import type {
  HookDefinition,
  HookHandlers,
  HookContext,
  HookEventType,
  ChatMessageInput,
  ChatMessageOutput,
  ToolExecuteBeforeInput,
  ToolExecuteBeforeOutput,
  ToolExecuteAfterInput,
  ToolExecuteAfterOutput,
  EventInput,
  EventOutput,
  SessionIdleInput,
  SessionIdleOutput,
  SessionErrorInput,
  SessionErrorOutput,
  SessionDeletedInput,
  SessionDeletedOutput,
} from './types.js';
import type { HookEventBus } from './event-bus.js';

// ============================================================================
// Type Guards for Handler Inputs
// ============================================================================

type HandlerInput =
  | ChatMessageInput
  | ToolExecuteBeforeInput
  | ToolExecuteAfterInput
  | EventInput
  | SessionIdleInput
  | SessionErrorInput
  | SessionDeletedInput;

type HandlerOutput =
  | ChatMessageOutput
  | ToolExecuteBeforeOutput
  | ToolExecuteAfterOutput
  | EventOutput
  | SessionIdleOutput
  | SessionErrorOutput
  | SessionDeletedOutput
  | void;

// ============================================================================
// HookRegistry Class
// ============================================================================

/**
 * Registry for managing hooks lifecycle.
 *
 * Provides:
 * - Hook registration with unique name validation
 * - Priority-ordered initialization
 * - Event dispatch to matching handlers
 * - Enable/disable individual hooks
 * - Error isolation between hooks
 */
export class HookRegistry {
  /** Registered hook definitions by name */
  private hooks: Map<string, HookDefinition> = new Map();

  /** Instantiated hook handlers by name (after initialize()) */
  private instances: Map<string, HookHandlers> = new Map();

  /** Event bus for hook event propagation */
  private eventBus: HookEventBus;

  /** Whether the registry has been initialized */
  private initialized: boolean = false;

  /** Cached sorted hook names by priority */
  private sortedHookNames: string[] = [];

  /**
   * Create a new HookRegistry.
   *
   * @param eventBus - Event bus for hook event propagation
   */
  constructor(eventBus: HookEventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Register a hook definition.
   *
   * @param hook - The hook definition to register
   * @throws Error if a hook with the same name is already registered
   *
   * @example
   * registry.register({
   *   name: 'file-guard',
   *   enabled: true,
   *   priority: 50,
   *   factory: (ctx) => ({
   *     'tool.execute.before': (input) => {
   *       if (input.toolName === 'Write') {
   *         return { warning: 'Consider delegating' };
   *       }
   *     }
   *   })
   * });
   */
  register(hook: HookDefinition): void {
    if (this.hooks.has(hook.name)) {
      throw new Error(`Hook "${hook.name}" is already registered`);
    }

    this.hooks.set(hook.name, hook);
    this.invalidateSortCache();
  }

  /**
   * Unregister a hook by name.
   *
   * Also removes the hook instance if initialized.
   *
   * @param name - Name of the hook to unregister
   * @returns True if hook was found and removed, false otherwise
   */
  unregister(name: string): boolean {
    const existed = this.hooks.delete(name);
    this.instances.delete(name);
    this.invalidateSortCache();
    return existed;
  }

  /**
   * Enable a registered hook.
   *
   * @param name - Name of the hook to enable
   * @returns True if hook was found and enabled
   */
  enable(name: string): boolean {
    const hook = this.hooks.get(name);
    if (!hook) {
      return false;
    }

    hook.enabled = true;
    return true;
  }

  /**
   * Disable a registered hook.
   *
   * Disabled hooks will not receive events.
   *
   * @param name - Name of the hook to disable
   * @returns True if hook was found and disabled
   */
  disable(name: string): boolean {
    const hook = this.hooks.get(name);
    if (!hook) {
      return false;
    }

    hook.enabled = false;
    return true;
  }

  /**
   * Check if a hook is enabled.
   *
   * @param name - Name of the hook to check
   * @returns True if hook exists and is enabled
   */
  isEnabled(name: string): boolean {
    const hook = this.hooks.get(name);
    return hook?.enabled ?? false;
  }

  /**
   * Get list of all registered hook names.
   *
   * @returns Array of registered hook names
   */
  getRegisteredHooks(): string[] {
    return Array.from(this.hooks.keys());
  }

  /**
   * Get list of enabled hook names in priority order.
   *
   * @returns Array of enabled hook names sorted by priority
   */
  getEnabledHooks(): string[] {
    return this.getSortedHookNames().filter((name) => this.isEnabled(name));
  }

  /**
   * Initialize all enabled hooks by calling their factories.
   *
   * Hooks are initialized in priority order (lower values first).
   * Hook-specific options are extracted from ctx.config.hookOptions.
   *
   * @param ctx - Context to pass to hook factories
   *
   * @example
   * registry.initialize({
   *   sessionId: 'session-123',
   *   stateManager: stateManager,
   *   emitEvent: emitEvent,
   *   config: { enabledHooks: [], disabledHooks: [], hookOptions: {} }
   * });
   */
  initialize(ctx: HookContext): void {
    // Clear existing instances
    this.instances.clear();

    // Get hooks sorted by priority
    const sortedNames = this.getSortedHookNames();

    for (const name of sortedNames) {
      const hook = this.hooks.get(name);
      if (!hook) continue;

      // Skip disabled hooks
      if (!hook.enabled) continue;

      // Check against config whitelist/blacklist
      if (!this.isHookEnabledByConfig(name, ctx.config)) continue;

      try {
        // Create hook-specific context with options
        const hookCtx: HookContext = {
          ...ctx,
          options: (ctx.config.hookOptions[name] as Record<string, unknown>) || {},
        };

        // Call factory to create handlers
        const handlers = hook.factory(hookCtx);
        this.instances.set(name, handlers);
      } catch (error) {
        // Log error but continue with other hooks
        console.error(`[HookRegistry] Failed to initialize hook "${name}":`, error);
      }
    }

    this.initialized = true;
  }

  /**
   * Dispatch an event to all matching handlers.
   *
   * Iterates through hook instances in priority order and calls
   * the matching handler if it exists. Errors in one hook do not
   * prevent other hooks from running.
   *
   * @param eventType - Type of event to dispatch
   * @param input - Input data for the event
   * @param _output - Output data (for after-events, currently unused)
   * @returns Collected outputs from all handlers
   *
   * @example
   * const outputs = await registry.dispatch(
   *   'chat.message',
   *   { role: 'user', content: 'Hello', sessionId: 's1' },
   *   undefined
   * );
   */
  async dispatch(
    eventType: keyof HookHandlers,
    input: HandlerInput,
    _output?: unknown
  ): Promise<HandlerOutput[]> {
    if (!this.initialized) {
      console.error('[HookRegistry] Registry not initialized. Call initialize() first.');
      return [];
    }

    const outputs: HandlerOutput[] = [];
    const sortedNames = this.getSortedHookNames();

    for (const name of sortedNames) {
      // Skip if hook is not enabled
      if (!this.isEnabled(name)) continue;

      const handlers = this.instances.get(name);
      if (!handlers) continue;

      const handler = handlers[eventType];
      if (!handler) continue;

      try {
        // Call the handler with appropriate input type
        const result = await this.callHandler(eventType, handler, input);
        if (result !== undefined) {
          outputs.push(result);
        }
      } catch (error) {
        // Log error but continue with other hooks
        console.error(`[HookRegistry] Error in hook "${name}" for event "${eventType}":`, error);
      }
    }

    // Notify event bus of dispatch completion
    this.eventBus.dispatch(`hook:${eventType}:complete`, { inputs: input, outputs });

    return outputs;
  }

  /**
   * Get hook definition by name.
   *
   * @param name - Name of the hook
   * @returns Hook definition or undefined if not found
   */
  getHook(name: string): HookDefinition | undefined {
    return this.hooks.get(name);
  }

  /**
   * Check if registry has been initialized.
   *
   * @returns True if initialize() has been called
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Reset the registry to uninitialized state.
   *
   * Clears all instances but keeps registrations.
   */
  reset(): void {
    this.instances.clear();
    this.initialized = false;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Get hook names sorted by priority (cached).
   */
  private getSortedHookNames(): string[] {
    if (this.sortedHookNames.length === 0) {
      const entries = Array.from(this.hooks.entries());
      entries.sort((a, b) => a[1].priority - b[1].priority);
      this.sortedHookNames = entries.map(([name]) => name);
    }
    return this.sortedHookNames;
  }

  /**
   * Invalidate the sorted hooks cache.
   */
  private invalidateSortCache(): void {
    this.sortedHookNames = [];
  }

  /**
   * Check if hook is enabled by config whitelist/blacklist.
   */
  private isHookEnabledByConfig(
    name: string,
    config: { enabledHooks: string[]; disabledHooks: string[] }
  ): boolean {
    // Blacklist takes precedence
    if (config.disabledHooks.includes(name)) {
      return false;
    }

    // If whitelist is empty, all hooks are enabled
    if (config.enabledHooks.length === 0) {
      return true;
    }

    // Otherwise, hook must be in whitelist
    return config.enabledHooks.includes(name);
  }

  /**
   * Call a handler with the appropriate input type.
   */
  private async callHandler(
    eventType: keyof HookHandlers,
    handler: HookHandlers[keyof HookHandlers],
    input: HandlerInput
  ): Promise<HandlerOutput> {
    // Type-safe handler invocation
    switch (eventType) {
      case 'chat.message':
        return (handler as HookHandlers['chat.message'])!(input as ChatMessageInput);
      case 'tool.execute.before':
        return (handler as HookHandlers['tool.execute.before'])!(input as ToolExecuteBeforeInput);
      case 'tool.execute.after':
        return (handler as HookHandlers['tool.execute.after'])!(input as ToolExecuteAfterInput);
      case 'event':
        return (handler as HookHandlers['event'])!(input as EventInput);
      case 'session.idle':
        return (handler as HookHandlers['session.idle'])!(input as SessionIdleInput);
      case 'session.error':
        return (handler as HookHandlers['session.error'])!(input as SessionErrorInput);
      case 'session.deleted':
        return (handler as HookHandlers['session.deleted'])!(input as SessionDeletedInput);
      default:
        return undefined;
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new HookRegistry instance.
 *
 * Factory function following oh-my-opencode patterns.
 *
 * @param eventBus - Event bus for hook event propagation
 * @returns New HookRegistry instance
 *
 * @example
 * import { createHookRegistry, createHookEventBus } from './hooks';
 *
 * const eventBus = createHookEventBus();
 * const registry = createHookRegistry(eventBus);
 */
export function createHookRegistry(eventBus: HookEventBus): HookRegistry {
  return new HookRegistry(eventBus);
}
