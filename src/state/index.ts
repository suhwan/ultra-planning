/**
 * State Management Module
 *
 * Re-exports all state utilities including:
 * - Core state manager (Wave 1 - Plan 02-01)
 * - Event system (Wave 2 - Plan 02-02)
 * - Mode registry (Wave 2 - Plan 02-03)
 * - Checkpoint manager (Wave 2 - Plan 02-04)
 */

// Core state utilities (Wave 1 - implemented)
export * from './types.js';
export * from './state-manager.js';

// Event system (Wave 2 - Plan 02-02)
export * from './event-system.js';

// Mode registry (Wave 2 - Plan 02-03)
export * from './mode-registry.js';

// Checkpoint manager (Wave 2 - Plan 02-04)
export * from './checkpoint.js';
