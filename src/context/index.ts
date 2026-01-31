/**
 * Context Module
 *
 * Re-exports all context utilities including:
 * - Context collection (v3.0 - Context Architect)
 * - Context injection (v3.0 - Context Architect)
 * - Context compaction (v3.0 - Context Architect)
 * - Token estimation (Wave 1 - Plan 10-01)
 * - Cumulative tracking (Wave 1 - Plan 10-01)
 * - Usage analysis (Wave 1 - Plan 10-01)
 * - Threshold detection (Wave 2 - Plan 10-02)
 * - Context monitoring (Wave 2 - Plan 10-02)
 * - Checkpoint return structures (Wave 1 - Plan 10-03)
 */

// ============================================================================
// Context Architect v3.0
// ============================================================================

// Context collection from project files
export * from './collector.js';

// Context injection into agent prompts
export * from './injector.js';

// Context compaction for fresh-start
export * from './compactor.js';

// ============================================================================
// Core Types and Constants
// ============================================================================

// Types and constants
export * from './types.js';

// Token estimation and tracking
export * from './estimator.js';

// Threshold detection and actions
export * from './thresholds.js';

// Context monitor with state persistence
export * from './monitor.js';

// Checkpoint and handoff structures
export * from './checkpoint-return.js';
