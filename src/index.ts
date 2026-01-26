/**
 * Ultra Planner - Document-driven workflow orchestration
 *
 * Entry point for the ultra-planner package.
 * Re-exports all public types and utilities.
 */

// Core types
export * from './types.js';

// State management module
export * from './state/index.js';

// Git integration module
export * from './git/index.js';

// Documents module
export * from './documents/index.js';

// Agents module
export * from './agents/index.js';

// Orchestration module
export * from './orchestration/index.js';

// Hooks module
export * from './hooks/index.js';

// Loops module (persistent execution patterns)
export * from './loops/index.js';

// Recovery module (error handling with rollback)
export * from './recovery/index.js';

// Placeholder export to make the module valid
export const VERSION = '0.1.0';
