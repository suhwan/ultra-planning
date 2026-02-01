/**
 * Auto Slash Command Hook
 *
 * Detects and emits events for slash commands in user messages.
 * This enables automatic command processing and routing.
 *
 * Features:
 * - Slash command pattern detection
 * - Support for namespaced commands (e.g., /namespace:command)
 * - Event emission for command routing
 * - Argument extraction
 *
 * @module hooks/session/auto-slash-command
 */

import type { HookContext, HookHandlers, ChatMessageInput, ChatMessageOutput } from '../types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Parsed slash command structure.
 */
export interface ParsedSlashCommand {
  /** Full command string (e.g., 'oh-my-claudecode:help') */
  command: string;
  /** Namespace if present (e.g., 'oh-my-claudecode') */
  namespace?: string;
  /** Command name without namespace (e.g., 'help') */
  name: string;
  /** Arguments after the command */
  args: string;
  /** Full original command including slash */
  fullCommand: string;
}

/**
 * Configuration options for the auto slash command hook.
 */
export interface AutoSlashCommandOptions {
  /** Allowed namespaces (if empty, all are allowed) */
  allowedNamespaces?: string[];
  /** Commands to ignore */
  ignoredCommands?: string[];
}

// ============================================================================
// Constants
// ============================================================================

const HOOK_NAME = 'auto-slash-command';

/**
 * Pattern for slash commands.
 * Matches: /command, /command args, /namespace:command, /namespace:command args
 */
const SLASH_COMMAND_PATTERN = /^\/([a-zA-Z][a-zA-Z0-9-]*(?::[a-zA-Z][a-zA-Z0-9-]*)?)\s*(.*)?$/;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse a slash command string.
 *
 * @param input - The input string to parse
 * @returns Parsed command or null if not a valid command
 */
export function parseSlashCommand(input: string): ParsedSlashCommand | null {
  const trimmed = input.trim();
  const match = trimmed.match(SLASH_COMMAND_PATTERN);

  if (!match) {
    return null;
  }

  const [fullCommand, commandPart, args] = match;
  const colonIndex = commandPart.indexOf(':');

  if (colonIndex > 0) {
    return {
      command: commandPart,
      namespace: commandPart.slice(0, colonIndex),
      name: commandPart.slice(colonIndex + 1),
      args: args?.trim() || '',
      fullCommand: fullCommand,
    };
  }

  return {
    command: commandPart,
    name: commandPart,
    args: args?.trim() || '',
    fullCommand: fullCommand,
  };
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an auto slash command hook.
 *
 * This hook monitors chat messages for slash commands and emits
 * events for command routing.
 *
 * @param ctx - Hook context with state manager and event emitter
 * @param options - Configuration options
 * @returns HookHandlers with chat.message handler
 *
 * @example
 * const hook = createAutoSlashCommandHook(ctx, {
 *   allowedNamespaces: ['oh-my-claudecode', 'ultraplan'],
 * });
 */
export function createAutoSlashCommandHook(
  ctx: HookContext,
  options: AutoSlashCommandOptions = {}
): HookHandlers {
  const {
    allowedNamespaces = [],
    ignoredCommands = [],
  } = options;

  /**
   * Handler for chat.message events.
   * Detects slash commands and emits events.
   */
  async function chatMessageHandler(
    input: ChatMessageInput
  ): Promise<ChatMessageOutput | void> {
    const { role, content, sessionId } = input;

    // Only process user messages
    if (role !== 'user') {
      return;
    }

    // Parse potential slash command
    const parsed = parseSlashCommand(content);
    if (!parsed) {
      return;
    }

    // Check if command is ignored
    if (ignoredCommands.includes(parsed.command) || ignoredCommands.includes(parsed.name)) {
      return;
    }

    // Check namespace if restrictions apply
    if (allowedNamespaces.length > 0 && parsed.namespace) {
      if (!allowedNamespaces.includes(parsed.namespace)) {
        return;
      }
    }

    // Emit slash command detected event
    ctx.emitEvent({
      type: 'slash_command_detected',
      payload: {
        sessionId,
        command: parsed.command,
        namespace: parsed.namespace,
        name: parsed.name,
        args: parsed.args,
        fullCommand: parsed.fullCommand,
      },
      source: `hook:${HOOK_NAME}`,
    });

    // Return continuation signal (don't modify message)
    return { continue: true };
  }

  return {
    'chat.message': chatMessageHandler,
  };
}
