/**
 * Magic Keywords Module
 *
 * Detects special keywords in prompts and enhances them with mode-specific instructions.
 * Strips code blocks before matching to prevent false positives.
 */

export * from './types.js';
export * from './patterns.js';
export * from './processor.js';
