/**
 * Orchestrator Enforcement Hook Types
 *
 * Type definitions for orchestrator enforcement mechanisms including:
 * - System directive prefix and types for consistent message marking
 * - File guard result types for write operation warnings
 * - Utility functions for directive creation and detection
 *
 * These hooks implement SOFT enforcement - they provide warnings and
 * directives but do not block operations. The orchestrator can still
 * proceed after being warned.
 *
 * @module hooks/orchestrator/types
 */

/**
 * System directive prefix used to mark injected system messages.
 * All system-injected prompts, warnings, and reminders should use this prefix
 * for consistent filtering and identification.
 *
 * @example
 * const directive = `${SYSTEM_DIRECTIVE_PREFIX} - RALPH LOOP]`;
 * // Result: "[SYSTEM DIRECTIVE: ULTRA-PLANNING - RALPH LOOP]"
 */
export const SYSTEM_DIRECTIVE_PREFIX = '[SYSTEM DIRECTIVE: ULTRA-PLANNING';

/**
 * Enumeration of system directive types used throughout the orchestration system.
 *
 * - RALPH_LOOP: Marks Ralph Loop continuation/persistence messages
 * - DELEGATION_REQUIRED: Warning when orchestrator attempts direct file modification
 * - SINGLE_TASK_ONLY: Directive for subagents to enforce single-task execution
 * - VERIFICATION_REMINDER: Reminder to verify subagent work before marking complete
 */
export const SystemDirectiveTypes = {
  /** Ralph Loop persistence and continuation messages */
  RALPH_LOOP: 'RALPH LOOP',
  /** Warning for direct file modification by orchestrator */
  DELEGATION_REQUIRED: 'DELEGATION REQUIRED',
  /** Directive for subagents to accept only single tasks */
  SINGLE_TASK_ONLY: 'SINGLE TASK ONLY',
  /** Reminder to verify subagent work */
  VERIFICATION_REMINDER: 'VERIFICATION REMINDER',
} as const;

/**
 * Type representing valid system directive types.
 * Derived from SystemDirectiveTypes values.
 */
export type SystemDirectiveType =
  (typeof SystemDirectiveTypes)[keyof typeof SystemDirectiveTypes];

/**
 * Result from file guard check operation.
 *
 * This interface describes the outcome of checking whether a file write
 * operation should trigger a warning to the orchestrator.
 */
export interface FileGuardResult {
  /** Whether a warning should be displayed to the orchestrator */
  shouldWarn: boolean;
  /** The file path being checked */
  path: string;
  /** The tool being used (Write, Edit, etc.) */
  tool: string;
  /** Warning message text if shouldWarn is true */
  warning?: string;
}

/**
 * Creates a formatted system directive string.
 *
 * @param type - The type of system directive to create
 * @returns Formatted directive string with prefix and type
 *
 * @example
 * createSystemDirective(SystemDirectiveTypes.RALPH_LOOP);
 * // Returns: "[SYSTEM DIRECTIVE: ULTRA-PLANNING - RALPH LOOP]"
 *
 * @example
 * createSystemDirective(SystemDirectiveTypes.DELEGATION_REQUIRED);
 * // Returns: "[SYSTEM DIRECTIVE: ULTRA-PLANNING - DELEGATION REQUIRED]"
 */
export function createSystemDirective(type: SystemDirectiveType): string {
  return `${SYSTEM_DIRECTIVE_PREFIX} - ${type}]`;
}

/**
 * Checks if a text string starts with a system directive.
 *
 * Useful for filtering out system-injected messages from regular
 * user or assistant messages.
 *
 * @param text - The text to check
 * @returns True if the text starts with the system directive prefix
 *
 * @example
 * isSystemDirective('[SYSTEM DIRECTIVE: ULTRA-PLANNING - RALPH LOOP]...');
 * // Returns: true
 *
 * @example
 * isSystemDirective('Regular user message');
 * // Returns: false
 */
export function isSystemDirective(text: string): boolean {
  return text.trimStart().startsWith(SYSTEM_DIRECTIVE_PREFIX);
}
