/**
 * Sync Module
 *
 * Claude Tasks synchronization for PLAN.md documents.
 * Provides bidirectional mapping between planning documents and Claude Task tool execution.
 *
 * Key features:
 * - Parse PLAN.md files and extract task mappings
 * - Generate deterministic task IDs for state tracking
 * - Create Task tool invocation parameters
 * - Track task execution state
 *
 * @module sync
 */

// Re-export all types
export type {
  TaskMapping,
  TaskState,
  TaskToolParams,
  TaskStatus,
  TaskModel,
  SyncConfig,
  PlanSyncData,
} from './types.js';

// Re-export default config
export { DEFAULT_SYNC_CONFIG } from './types.js';

// Re-export parser functions
export {
  parsePlanForSync,
  extractTaskMappings,
  generateTaskId,
  formatTaskPrompt,
  parseAndExtractMappings,
  findTaskById,
  filterTasksByStatus,
} from './plan-parser.js';
