/**
 * File Guard - Orchestrator Write Warning System
 *
 * Provides soft enforcement to warn orchestrators when they attempt to
 * directly modify source files. Orchestrators should delegate implementation
 * work to subagents instead of making direct changes.
 *
 * This is SOFT enforcement - warnings inform but do not block.
 * The orchestrator can still proceed after being warned.
 *
 * Allowed paths (no warning):
 * - .ultraplan/ - Planning state and configuration
 * - .planning/ - Planning documents
 * - CLAUDE.md - User instructions
 * - AGENTS.md - AI documentation
 *
 * @module hooks/orchestrator/file-guard
 */

import {
  createSystemDirective,
  SystemDirectiveTypes,
  type FileGuardResult,
} from './types.js';

/**
 * Tools that perform write operations and should be guarded.
 * These tools can modify file contents directly.
 */
export const WRITE_TOOLS = [
  'Write',
  'Edit',
  'write',
  'edit',
  'MultiEdit',
] as const;

/**
 * Allowed path prefixes that do not trigger warnings.
 * These paths are acceptable for direct orchestrator modification.
 */
export const ALLOWED_PATHS = [
  '.ultraplan/',
  '.planning/',
  'CLAUDE.md',
  'AGENTS.md',
] as const;

/**
 * Checks if a tool/path combination should trigger a warning.
 *
 * Returns true if:
 * 1. The tool is a write tool (Write, Edit, etc.)
 * 2. The file path does NOT include any allowed path prefix
 *
 * @param tool - The tool name being used
 * @param filePath - The target file path
 * @returns True if warning should be shown, false otherwise
 *
 * @example
 * shouldWarnOnWrite('Write', 'src/api.ts'); // true - source file
 * shouldWarnOnWrite('Write', '.planning/PLAN.md'); // false - planning file
 * shouldWarnOnWrite('Read', 'src/api.ts'); // false - not a write tool
 */
export function shouldWarnOnWrite(tool: string, filePath: string): boolean {
  // Not a write tool - no warning needed
  if (!WRITE_TOOLS.includes(tool as (typeof WRITE_TOOLS)[number])) {
    return false;
  }

  // Check if path is in allowed list
  const isAllowedPath = ALLOWED_PATHS.some((prefix) =>
    filePath.includes(prefix)
  );

  // Warn if not in allowed paths
  return !isAllowedPath;
}

/**
 * Gets a file guard result with warning message if applicable.
 *
 * @param tool - The tool name being used
 * @param filePath - The target file path
 * @returns FileGuardResult with shouldWarn flag and optional warning text
 *
 * @example
 * const result = getFileGuardWarning('Write', 'src/models/user.ts');
 * if (result.shouldWarn) {
 *   console.log(result.warning); // Shows delegation warning
 * }
 */
export function getFileGuardWarning(
  tool: string,
  filePath: string
): FileGuardResult {
  const shouldWarn = shouldWarnOnWrite(tool, filePath);

  if (!shouldWarn) {
    return {
      shouldWarn: false,
      path: filePath,
      tool,
    };
  }

  const warning = `${createSystemDirective(SystemDirectiveTypes.DELEGATION_REQUIRED)}

**STOP. YOU ARE VIOLATING ORCHESTRATOR PROTOCOL.**

You are attempting to directly modify: ${filePath}

As an ORCHESTRATOR, you MUST:
1. DELEGATE all implementation work via subagents
2. VERIFY the work done by subagents
3. COORDINATE - you orchestrate, you don't implement

**Allowed exceptions:**
- .ultraplan/ and .planning/ directories (planning docs)
- CLAUDE.md and AGENTS.md (configuration files)

If this is verification/fix work, delegate it to an executor subagent.`;

  return {
    shouldWarn: true,
    path: filePath,
    tool,
    warning,
  };
}
