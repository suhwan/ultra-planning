/**
 * Ralph Loop Completion Detection
 *
 * Detects task completion via `<promise>TAG</promise>` pattern in assistant output.
 * Case-insensitive and whitespace-tolerant matching.
 *
 * Based on patterns from oh-my-opencode Ralph Loop implementation.
 */

// ============================================================================
// Pattern Constants
// ============================================================================

/**
 * Generic pattern to match any promise tag
 *
 * Used for detecting presence of any completion tag.
 * Flags: i = case-insensitive, s = dotall (. matches newline)
 */
export const COMPLETION_TAG_PATTERN = /<promise>(.*?)<\/promise>/is;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Escape special regex characters in a string
 *
 * Prevents injection attacks and ensures literal matching of promise tags.
 *
 * @param str - String to escape
 * @returns Escaped string safe for use in RegExp
 *
 * @example
 * ```typescript
 * escapeRegex('DONE') // => 'DONE'
 * escapeRegex('task.complete') // => 'task\\.complete'
 * escapeRegex('(finished)') // => '\\(finished\\)'
 * ```
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// Detection Function
// ============================================================================

/**
 * Detect completion promise in text
 *
 * Searches for `<promise>TAG</promise>` pattern where TAG matches the
 * expected completion promise. Matching is:
 * - Case-insensitive (DONE, done, Done all match)
 * - Whitespace-tolerant (`<promise> DONE </promise>` matches)
 *
 * IMPORTANT: Only check assistant output text, NOT user messages.
 * This prevents false positives from detecting the completion tag in
 * instructions (like "output <promise>DONE</promise> when finished").
 *
 * @param text - Text to search (should be assistant output only)
 * @param promise - The completion promise tag to match (e.g., "DONE")
 * @returns True if completion tag is found
 *
 * @example
 * ```typescript
 * // Basic match
 * detectCompletion('<promise>DONE</promise>', 'DONE') // => true
 *
 * // Whitespace tolerance
 * detectCompletion('<promise> DONE </promise>', 'DONE') // => true
 *
 * // Case insensitivity
 * detectCompletion('<Promise>done</Promise>', 'DONE') // => true
 *
 * // No match
 * detectCompletion('Task completed successfully', 'DONE') // => false
 *
 * // Wrong tag
 * detectCompletion('<promise>COMPLETE</promise>', 'DONE') // => false
 * ```
 */
export function detectCompletion(text: string, promise: string): boolean {
  // Build pattern with escaped promise tag
  // Allow whitespace around the tag for flexibility
  const pattern = new RegExp(
    `<promise>\\s*${escapeRegex(promise)}\\s*</promise>`,
    'is' // i = case-insensitive, s = dotall
  );
  return pattern.test(text);
}
