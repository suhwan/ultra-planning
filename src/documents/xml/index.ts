/**
 * XML Task Format Module
 *
 * Utilities for generating and parsing task XML within PLAN.md documents.
 */

// Type exports
export type {
  Task,
  TaskType,
  AutoTask,
  CheckpointTask,
  HumanVerifyTask,
  DecisionTask,
  HumanActionTask,
  DecisionOption,
} from './types.js';

// Type guard exports
export {
  isAutoTask,
  isCheckpointTask,
  isHumanVerifyTask,
  isDecisionTask,
  isHumanActionTask,
} from './types.js';

// Generator exports
export { escapeXml, generateTaskXml, generateTasksSection } from './task-generator.js';

// Parser exports
export { unescapeXml, parseTaskXml, parseTasksSection } from './task-parser.js';
