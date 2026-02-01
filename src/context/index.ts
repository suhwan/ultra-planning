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
export type { ProjectContextArtifacts } from './collector.js';
export {
  collectProjectContextAsArtifacts,
  collectPhaseContextAsArtifacts,
  collectContextAsArtifacts,
} from './collector.js';

// Context injection into agent prompts
export * from './injector.js';

// Context compaction for fresh-start
export * from './compactor.js';

// Core info extraction from planning artifacts
export { extractCoreInfo, CoreInfo, formatCoreInfo, estimateCoreInfoTokens } from './extractor.js';

// Re-export compactWithCoreInfo explicitly for clarity
export { compactWithCoreInfo, validateCompression } from './compactor.js';

// Fresh-start context preparation and injection
export { prepareFreshStart, injectCompactedContext } from './fresh-start.js';
export type { FreshStartContext, FreshStartOptions } from './fresh-start.js';

// Auto-compaction manager
export { AutoCompactionManager, createAutoCompactionManager } from './auto-compaction.js';
export type { AutoCompactionOptions, CompactionResult } from './auto-compaction.js';

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

// Advanced context monitor with auto-compaction detection
export * from './advanced-monitor.js';

// Checkpoint and handoff structures
export * from './checkpoint-return.js';

// ============================================================================
// ThinkTank Context (EdSpark Integration)
// ============================================================================

// ThinkTank context loader for GSD Planner injection
export {
  hasThinkTankStructure,
  loadThinkTankContext,
  loadAgentTemplates,
  loadDepartmentContexts,
  generatePlannerContext,
  generateDepartmentContext,
  generateDepartmentsSummary,
  generateAgentsSummary,
  generateExecutionFlowSummary,
} from './thinktank-loader.js';

export type {
  ThinkTankContext,
  AgentTemplate,
  DepartmentContext,
} from './thinktank-loader.js';
