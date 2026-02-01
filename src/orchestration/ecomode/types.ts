/**
 * EcoMode Types
 *
 * Token-efficient parallel execution with complexity-based model routing.
 */

import type { ComplexityLevel, ModelTier } from '../../complexity/types.js';

// ============================================================================
// Concurrent Limits
// ============================================================================

/** Maximum concurrent tasks per model tier */
export const MODEL_CONCURRENT_LIMITS: Record<ModelTier, number> = {
  haiku: 5,   // Fast, cheap - can run many
  sonnet: 3,  // Balanced
  opus: 2,    // Expensive - limit concurrent
};

// ============================================================================
// Worker Types
// ============================================================================

export interface EcoModeWorker {
  id: string;
  taskId: string;
  model: ModelTier;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  tokensUsed?: number;
  error?: string;
}

// ============================================================================
// Task Types
// ============================================================================

export interface EcoModeTask {
  id: string;
  name: string;
  action: string;
  files: string[];
  complexity: ComplexityLevel;
  recommendedModel: ModelTier;
  status: 'pending' | 'running' | 'completed' | 'failed';
  workerId?: string;
  result?: {
    success: boolean;
    output?: string;
    error?: string;
    tokensUsed?: number;
  };
}

// ============================================================================
// Session Types
// ============================================================================

export interface EcoModeConfig {
  maxConcurrent: Record<ModelTier, number>;
  planPath?: string;
}

export const DEFAULT_ECOMODE_CONFIG: EcoModeConfig = {
  maxConcurrent: { ...MODEL_CONCURRENT_LIMITS },
};

export interface EcoModeState {
  sessionId: string;
  planPath?: string;
  config: EcoModeConfig;
  tasks: EcoModeTask[];
  workers: EcoModeWorker[];
  status: 'initializing' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  stats: EcoModeStats;
}

export interface EcoModeStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  runningTasks: number;
  pendingTasks: number;
  byModel: Record<ModelTier, {
    total: number;
    completed: number;
    running: number;
    tokensUsed: number;
  }>;
  totalTokensUsed: number;
  estimatedTokensSaved: number;
}
