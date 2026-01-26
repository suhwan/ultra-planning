/**
 * Verification Reminder Module
 *
 * Provides verification reminder functionality that should be displayed
 * after subagent delegation completes. Subagents frequently claim completion
 * without actually verifying their work - this reminder prompts the orchestrator
 * to run independent verification checks before accepting claims.
 *
 * Key exports:
 * - VERIFICATION_REMINDER: Full reminder text for display
 * - createVerificationReminder: Creates reminder with optional context
 * - emitVerificationRequired: Emits event when verification is needed
 * - DEFAULT_VERIFICATION_STEPS: Programmatic list of verification steps
 *
 * @module hooks/orchestrator/verification
 *
 * @example
 * // After subagent completes
 * import {
 *   createVerificationReminder,
 *   emitVerificationRequired
 * } from './hooks/orchestrator/verification';
 *
 * // Display reminder to orchestrator
 * console.log(createVerificationReminder('executor finished user model'));
 *
 * // Track verification event
 * emitVerificationRequired('executor', 'implement user model');
 */

import { createSystemDirective, SystemDirectiveTypes } from './types.js';
import { emitEvent } from '../../state/event-system.js';

/**
 * A verification step for the orchestrator to execute.
 *
 * Each step represents a specific verification action that should be
 * performed to validate subagent work before accepting completion claims.
 */
export interface VerificationStep {
  /** Human-readable name of the verification step */
  name: string;
  /** Command or tool to run for verification */
  command: string;
  /** Expected result for successful verification */
  expectedResult: string;
}

/**
 * Default verification steps that should be run after subagent completion.
 *
 * These steps cover the most common verification needs:
 * 1. Type/lint diagnostics - Catch syntax and type errors
 * 2. Tests - Verify functionality matches requirements
 * 3. Build - Ensure code compiles and bundles correctly
 * 4. Code review - Manual review of actual changes
 */
export const DEFAULT_VERIFICATION_STEPS: VerificationStep[] = [
  {
    name: 'Diagnostics',
    command: 'lsp_diagnostics',
    expectedResult: '0 errors',
  },
  {
    name: 'Tests',
    command: 'npm test',
    expectedResult: 'All tests pass',
  },
  {
    name: 'Build',
    command: 'npm run build',
    expectedResult: 'Exit code 0',
  },
  {
    name: 'Code Review',
    command: 'Read changed files',
    expectedResult: 'Matches requirements',
  },
];

/**
 * Complete verification reminder text for display after subagent completion.
 *
 * This reminder should be shown to the orchestrator after every subagent
 * delegation returns. It emphasizes that subagent claims of completion
 * should NOT be trusted without independent verification.
 *
 * @example
 * // Display after subagent returns
 * console.log(VERIFICATION_REMINDER);
 */
export const VERIFICATION_REMINDER = `${createSystemDirective(SystemDirectiveTypes.VERIFICATION_REMINDER)}

**MANDATORY: VERIFY BEFORE ACCEPTING SUBAGENT CLAIMS**

CRITICAL: Subagents FREQUENTLY LIE about completion. They will claim "done" without:
- Running tests
- Checking for TypeScript errors
- Verifying the code actually works

**STEP 1: VERIFY WITH YOUR OWN TOOL CALLS**
1. \`lsp_diagnostics\` on changed files -> Must be CLEAN (0 errors)
2. Run tests (\`npm test\`) -> Must PASS
3. Run build/typecheck (\`npm run build\`) -> Must succeed
4. Read the actual code -> Must match requirements

**STEP 2: IF VERIFICATION FAILS**
- Resume the SAME subagent session with the ACTUAL error
- Do NOT start fresh - continue from where they left off
- Provide the exact error message they need to fix

**STEP 3: ONLY AFTER VERIFICATION PASSES**
- Update plan checkbox [x]
- Create atomic commit
- Proceed to next task

**NEVER trust "done" claims. ALWAYS verify independently.**
`;

/**
 * Creates a verification reminder with optional context about what completed.
 *
 * Use this function when you want to include information about what the
 * subagent just finished, providing context for the verification.
 *
 * @param context - Optional description of what the subagent completed
 * @returns Full verification reminder text, optionally with context prepended
 *
 * @example
 * // Without context
 * const reminder = createVerificationReminder();
 * // Returns: VERIFICATION_REMINDER
 *
 * @example
 * // With context
 * const reminder = createVerificationReminder('executor finished user model');
 * // Returns: "\nSubagent completed: executor finished user model\n\n" + VERIFICATION_REMINDER
 */
export function createVerificationReminder(context?: string): string {
  if (context) {
    return `\nSubagent completed: ${context}\n\n${VERIFICATION_REMINDER}`;
  }
  return VERIFICATION_REMINDER;
}

/**
 * Emits a verification_required event to the event system.
 *
 * This allows tracking of when verification is needed and which subagent
 * work is being verified. The event can be used for logging, metrics,
 * or triggering automated verification workflows.
 *
 * @param subagentType - Type of subagent that completed (e.g., 'executor', 'architect')
 * @param task - Description of the task the subagent was working on
 *
 * @example
 * // After executor subagent returns
 * emitVerificationRequired('executor', 'implement user authentication');
 *
 * // After architect subagent returns
 * emitVerificationRequired('architect', 'review database schema');
 */
export function emitVerificationRequired(subagentType: string, task: string): void {
  emitEvent({
    type: 'verification_required',
    payload: {
      subagentType,
      task,
      timestamp: new Date().toISOString(),
    },
    source: 'orchestrator',
  });
}
