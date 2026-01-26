/**
 * Orchestrator Enforcement Hooks
 *
 * Provides soft enforcement for orchestrator delegation patterns:
 * - File guard: Warns when orchestrator writes source files directly
 * - Single task: Directive to inject into subagent prompts
 * - Verification reminder: Shows after subagent completion
 *
 * These are SOFT enforcement (warnings/reminders), not hard blocking.
 * The orchestrator can still proceed after being warned.
 *
 * @module hooks/orchestrator
 *
 * @example
 * // File guard usage
 * import { shouldWarnOnWrite, getFileGuardWarning } from './hooks/orchestrator';
 *
 * const result = getFileGuardWarning('Write', 'src/api.ts');
 * if (result.shouldWarn) {
 *   console.log(result.warning);
 * }
 *
 * @example
 * // Single task directive usage
 * import { createSingleTaskDirective } from './hooks/orchestrator';
 *
 * const prompt = createSingleTaskDirective('Implement login endpoint');
 * // Inject into subagent prompt
 *
 * @example
 * // Verification reminder usage
 * import {
 *   createVerificationReminder,
 *   emitVerificationRequired
 * } from './hooks/orchestrator';
 *
 * // After subagent completes
 * console.log(createVerificationReminder('executor finished user model'));
 * emitVerificationRequired('executor', 'implement user model');
 */

export * from './types.js';
export * from './file-guard.js';
export * from './single-task.js';
export * from './verification.js';
