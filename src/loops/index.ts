/**
 * Loops Module
 *
 * Persistent execution patterns for Claude Code.
 *
 * Available loops:
 * - Ralph Loop: Continues until `<promise>TAG</promise>` detected or max iterations
 */

// Ralph Loop - persistent task execution
export * from './ralph/index.js';
