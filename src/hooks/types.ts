/**
 * Hook System Type Definitions
 *
 * Comprehensive type definitions for the extensible hook system following
 * oh-my-opencode patterns. This module defines:
 * - Hook event types (chat.message, tool.execute.*, session.*, event)
 * - Handler interfaces for each event type
 * - HookDefinition for registration metadata
 * - HookContext passed to hook factories
 * - HookConfig for global configuration
 *
 * Extends existing orchestrator types with additional directive types:
 * - TODO_CONTINUATION
 * - CONTEXT_WINDOW_MONITOR
 * - BACKGROUND_NOTIFICATION
 * - SESSION_RECOVERY
 *
 * @module hooks/types
 */

import type { StateManager } from '../state/state-manager.js';

/**
 * Generic state manager type for hook context.
 * Uses Record<string, unknown> as the generic parameter.
 */
export type HookStateManager = StateManager<Record<string, unknown>>;
import type { StateEvent } from '../state/types.js';
import {
  SystemDirectiveTypes as OrchestratorDirectiveTypes,
  type SystemDirectiveType as OrchestratorSystemDirectiveType,
} from './orchestrator/types.js';

// ============================================================================
// Extended System Directive Types
// ============================================================================

/**
 * Extended system directive types for the hook system.
 * Includes all orchestrator directive types plus new hook-specific ones.
 */
export const ExtendedSystemDirectiveTypes = {
  // Inherit from orchestrator types
  ...OrchestratorDirectiveTypes,
  /** Todo continuation and task completion tracking */
  TODO_CONTINUATION: 'TODO CONTINUATION',
  /** Context window monitoring and compaction triggers */
  CONTEXT_WINDOW_MONITOR: 'CONTEXT WINDOW MONITOR',
  /** Background task completion notifications */
  BACKGROUND_NOTIFICATION: 'BACKGROUND NOTIFICATION',
  /** Session recovery and state restoration */
  SESSION_RECOVERY: 'SESSION RECOVERY',
} as const;

/**
 * Type representing valid extended system directive types.
 */
export type ExtendedSystemDirectiveType =
  (typeof ExtendedSystemDirectiveTypes)[keyof typeof ExtendedSystemDirectiveTypes];

// ============================================================================
// Hook Event Types
// ============================================================================

/**
 * All supported hook event type identifiers.
 *
 * Event lifecycle:
 * - chat.message: Message lifecycle (before/after message processing)
 * - tool.execute.before: Pre-tool execution hook
 * - tool.execute.after: Post-tool execution hook
 * - event: Generic event handler for any StateEvent
 * - session.idle: Session becomes idle (no activity)
 * - session.error: Session error occurred
 * - session.deleted: Session cleanup/termination
 */
export type HookEventType =
  | 'chat.message'
  | 'tool.execute.before'
  | 'tool.execute.after'
  | 'event'
  | 'session.idle'
  | 'session.error'
  | 'session.deleted';

// ============================================================================
// Handler Input/Output Types
// ============================================================================

/**
 * Input for chat.message handler
 */
export interface ChatMessageInput {
  /** The message role (user, assistant, system) */
  role: 'user' | 'assistant' | 'system';
  /** The message content */
  content: string;
  /** Session identifier */
  sessionId: string;
  /** Optional message metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Output from chat.message handler (can modify message)
 */
export interface ChatMessageOutput {
  /** Optionally modified content */
  content?: string;
  /** Whether to continue processing (default true) */
  continue?: boolean;
  /** Additional content to inject */
  inject?: string;
}

/**
 * Input for tool.execute.before handler
 */
export interface ToolExecuteBeforeInput {
  /** Tool name being executed */
  toolName: string;
  /** Tool parameters */
  params: Record<string, unknown>;
  /** Session identifier */
  sessionId: string;
}

/**
 * Output from tool.execute.before handler
 */
export interface ToolExecuteBeforeOutput {
  /** Optionally modified parameters */
  params?: Record<string, unknown>;
  /** Whether to block execution */
  block?: boolean;
  /** Warning message to display */
  warning?: string;
}

/**
 * Input for tool.execute.after handler
 */
export interface ToolExecuteAfterInput {
  /** Tool name that was executed */
  toolName: string;
  /** Tool parameters used */
  params: Record<string, unknown>;
  /** Tool execution result */
  result: unknown;
  /** Whether tool execution succeeded */
  success: boolean;
  /** Session identifier */
  sessionId: string;
  /** Execution duration in milliseconds */
  durationMs?: number;
}

/**
 * Output from tool.execute.after handler
 */
export interface ToolExecuteAfterOutput {
  /** Optionally modified result */
  result?: unknown;
  /** Additional content to inject after result */
  inject?: string;
}

/**
 * Input for generic event handler
 */
export interface EventInput {
  /** The state event */
  event: StateEvent;
  /** Session identifier */
  sessionId: string;
}

/**
 * Output from generic event handler
 */
export interface EventOutput {
  /** Whether event was handled */
  handled?: boolean;
  /** Additional actions to trigger */
  actions?: Array<{ type: string; payload: Record<string, unknown> }>;
}

/**
 * Input for session.idle handler
 */
export interface SessionIdleInput {
  /** Session identifier */
  sessionId: string;
  /** Time since last activity in milliseconds */
  idleDurationMs: number;
  /** Last activity timestamp */
  lastActivityAt: string;
}

/**
 * Output from session.idle handler
 */
export interface SessionIdleOutput {
  /** Whether to keep session alive */
  keepAlive?: boolean;
  /** Action to take */
  action?: 'continue' | 'prompt' | 'suspend';
}

/**
 * Input for session.error handler
 */
export interface SessionErrorInput {
  /** Session identifier */
  sessionId: string;
  /** Error message */
  error: string;
  /** Error code (if available) */
  code?: string;
  /** Stack trace (if available) */
  stack?: string;
  /** Whether error is recoverable */
  recoverable: boolean;
}

/**
 * Output from session.error handler
 */
export interface SessionErrorOutput {
  /** Whether error was handled */
  handled?: boolean;
  /** Recovery action to take */
  recovery?: 'retry' | 'abort' | 'ignore';
  /** Notification to display */
  notification?: string;
}

/**
 * Input for session.deleted handler
 */
export interface SessionDeletedInput {
  /** Session identifier */
  sessionId: string;
  /** Reason for deletion */
  reason: 'user' | 'timeout' | 'error' | 'system';
  /** Session duration in milliseconds */
  sessionDurationMs?: number;
}

/**
 * Output from session.deleted handler (cleanup confirmations)
 */
export interface SessionDeletedOutput {
  /** Cleanup actions performed */
  cleanedUp?: string[];
}

// ============================================================================
// Handler Function Types
// ============================================================================

/**
 * Handler for chat.message events
 */
export type ChatMessageHandler = (
  input: ChatMessageInput
) => Promise<ChatMessageOutput | void> | ChatMessageOutput | void;

/**
 * Handler for tool.execute.before events
 */
export type ToolExecuteBeforeHandler = (
  input: ToolExecuteBeforeInput
) => Promise<ToolExecuteBeforeOutput | void> | ToolExecuteBeforeOutput | void;

/**
 * Handler for tool.execute.after events
 */
export type ToolExecuteAfterHandler = (
  input: ToolExecuteAfterInput
) => Promise<ToolExecuteAfterOutput | void> | ToolExecuteAfterOutput | void;

/**
 * Handler for generic event events
 */
export type EventHandler = (input: EventInput) => Promise<EventOutput | void> | EventOutput | void;

/**
 * Handler for session.idle events
 */
export type SessionIdleHandler = (
  input: SessionIdleInput
) => Promise<SessionIdleOutput | void> | SessionIdleOutput | void;

/**
 * Handler for session.error events
 */
export type SessionErrorHandler = (
  input: SessionErrorInput
) => Promise<SessionErrorOutput | void> | SessionErrorOutput | void;

/**
 * Handler for session.deleted events
 */
export type SessionDeletedHandler = (
  input: SessionDeletedInput
) => Promise<SessionDeletedOutput | void> | SessionDeletedOutput | void;

// ============================================================================
// HookHandlers Interface
// ============================================================================

/**
 * Map of event types to their handler functions.
 *
 * A hook can implement any subset of these handlers. The registry
 * will call the appropriate handler when the corresponding event occurs.
 *
 * @example
 * const handlers: HookHandlers = {
 *   'chat.message': async (input) => {
 *     console.log('Message:', input.content);
 *     return { continue: true };
 *   },
 *   'tool.execute.before': (input) => {
 *     if (input.toolName === 'Write') {
 *       return { warning: 'Consider delegation' };
 *     }
 *   }
 * };
 */
export interface HookHandlers {
  /** Handler for chat message events */
  'chat.message'?: ChatMessageHandler;
  /** Handler for pre-tool execution */
  'tool.execute.before'?: ToolExecuteBeforeHandler;
  /** Handler for post-tool execution */
  'tool.execute.after'?: ToolExecuteAfterHandler;
  /** Handler for generic state events */
  event?: EventHandler;
  /** Handler for session idle detection */
  'session.idle'?: SessionIdleHandler;
  /** Handler for session errors */
  'session.error'?: SessionErrorHandler;
  /** Handler for session deletion/cleanup */
  'session.deleted'?: SessionDeletedHandler;
}

// ============================================================================
// Hook Configuration
// ============================================================================

/**
 * Global hook configuration.
 *
 * Controls which hooks are enabled/disabled and provides
 * hook-specific configuration options.
 */
export interface HookConfig {
  /**
   * Whitelist of hook names that are enabled.
   * If empty, all hooks are enabled by default.
   */
  enabledHooks: string[];

  /**
   * Blacklist of hook names that are disabled.
   * Takes precedence over enabledHooks.
   */
  disabledHooks: string[];

  /**
   * Hook-specific configuration options.
   * Keys are hook names, values are hook-specific config.
   */
  hookOptions: Record<string, unknown>;
}

/**
 * Create a default hook configuration with all hooks enabled.
 */
export function createDefaultHookConfig(): HookConfig {
  return {
    enabledHooks: [],
    disabledHooks: [],
    hookOptions: {},
  };
}

// ============================================================================
// Hook Context
// ============================================================================

/**
 * Context provided to hook factories.
 *
 * Contains all dependencies and utilities a hook needs
 * to perform its functions.
 */
export interface HookContext {
  /** Current session identifier */
  sessionId: string;

  /** State manager for reading/writing persistent state */
  stateManager: HookStateManager;

  /**
   * Function to emit events to the event system.
   * Used for inter-hook and cross-system communication.
   */
  emitEvent: (event: Omit<StateEvent, 'id' | 'timestamp'>) => StateEvent;

  /** Global hook configuration */
  config: HookConfig;

  /**
   * Hook-specific options extracted from config.hookOptions[hookName].
   * Provides type-safe access to hook configuration.
   */
  options?: Record<string, unknown>;
}

// ============================================================================
// Hook Definition
// ============================================================================

/**
 * Hook factory function type.
 *
 * Factory pattern allows lazy initialization of hooks and
 * provides context for hook configuration.
 *
 * @example
 * const factory: HookFactory = (ctx) => ({
 *   'chat.message': async (input) => {
 *     // Use ctx.stateManager, ctx.emitEvent, etc.
 *     return { continue: true };
 *   }
 * });
 */
export type HookFactory = (ctx: HookContext) => HookHandlers;

/**
 * Complete definition for a hook.
 *
 * Contains all metadata needed to register, configure,
 * and instantiate a hook.
 *
 * @example
 * const myHook: HookDefinition = {
 *   name: 'my-custom-hook',
 *   enabled: true,
 *   priority: 100,
 *   factory: (ctx) => ({
 *     'tool.execute.before': (input) => {
 *       console.log(`Tool ${input.toolName} starting`);
 *     }
 *   })
 * };
 */
export interface HookDefinition {
  /**
   * Unique identifier for the hook.
   * Used for enabling/disabling and configuration lookup.
   */
  name: string;

  /**
   * Whether the hook is enabled.
   * Disabled hooks are not initialized or called.
   */
  enabled: boolean;

  /**
   * Execution priority (lower values run first).
   * Default: 100. Range: 0-1000 recommended.
   *
   * Common priority bands:
   * - 0-49: Critical system hooks (security, validation)
   * - 50-99: Pre-processing hooks
   * - 100-149: Standard hooks (default)
   * - 150-199: Post-processing hooks
   * - 200+: Logging and monitoring hooks
   */
  priority: number;

  /**
   * Factory function that creates the hook handlers.
   * Called once during initialization with the HookContext.
   */
  factory: HookFactory;

  /**
   * Optional human-readable description.
   */
  description?: string;

  /**
   * Optional tags for categorization.
   */
  tags?: string[];
}

/**
 * Listener function type for HookEventBus subscriptions.
 */
export type HookEventListener = (payload: unknown) => void | Promise<void>;

// ============================================================================
// Re-exports for convenience
// ============================================================================

// Re-export orchestrator types for backward compatibility
export { OrchestratorDirectiveTypes as SystemDirectiveTypes };
export type { OrchestratorSystemDirectiveType as SystemDirectiveType };
