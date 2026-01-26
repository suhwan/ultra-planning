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
 * - Convert task mappings to Task tool invocations
 * - Build wave-based dependency maps for parallel execution
 *
 * @module sync
 */

// ============================================================================
// Types
// ============================================================================

export type {
  TaskMapping,
  TaskState,
  TaskToolParams,
  TaskStatus,
  TaskModel,
  SyncConfig,
  PlanSyncData,
} from './types.js';

export { DEFAULT_SYNC_CONFIG } from './types.js';

// ============================================================================
// Plan Parser
// ============================================================================

export {
  parsePlanForSync,
  extractTaskMappings,
  generateTaskId,
  formatTaskPrompt,
  parseAndExtractMappings,
  findTaskById,
  filterTasksByStatus,
} from './plan-parser.js';

// ============================================================================
// Task Mapper
// ============================================================================

export type { TaskInvocation } from './task-mapper.js';

export {
  createTaskInvocation,
  createTaskInvocations,
  determineSubagentType,
  getTaskIds,
  filterByWave,
  getReadyTasks as getReadyTaskInvocations,
} from './task-mapper.js';

// ============================================================================
// Dependency Mapping
// ============================================================================

export type { DependencyMap } from './dependency-map.js';

export {
  buildDependencyMap,
  mapWaveToBlockedBy,
  getExecutionOrder,
  getWaves,
  getTasksInWave,
  hasDependencies,
  getReadyTasks as getReadyTaskMappings,
} from './dependency-map.js';

// ============================================================================
// Status Sync
// ============================================================================

export {
  getTaskStates,
  updateTaskStatus,
  markTaskComplete,
  markTaskFailed,
  markTaskInProgress,
  updateContentCheckbox,
} from './status-sync.js';
