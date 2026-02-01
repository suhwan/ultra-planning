/**
 * Memory Types - Type definitions for the three-layer memory system
 *
 * Defines structures for working, short-term, and long-term memory layers.
 * Memory layers provide context at different scopes:
 * - Working: Current task (volatile)
 * - Short-term: Project session (STATE.md)
 * - Long-term: Persistent wisdom (wisdom/)
 */

// ============================================================================
// Memory Layers
// ============================================================================

/** Memory layer identifiers */
export enum MemoryLayer {
  Working = 'working',      // Volatile, current task only
  ShortTerm = 'short-term', // Project lifetime (STATE.md)
  LongTerm = 'long-term',   // Persistent (wisdom/)
}

// ============================================================================
// Layer Types
// ============================================================================

/** Working memory: current PLAN.md task state */
export interface WorkingMemory {
  layer: MemoryLayer.Working;
  /** Current plan identifier (e.g., "15-01") */
  currentPlan: string | null;
  /** Current task identifier (e.g., "15-01-02") */
  currentTask: string | null;
  /** Task-specific context data */
  taskContext: Record<string, unknown>;
  /** Always true - cleared on completion */
  volatile: true;
}

/** Short-term memory: session and project state */
export interface ShortTermMemory {
  layer: MemoryLayer.ShortTerm;
  /** Unique session identifier */
  sessionId: string;
  /** Decisions from STATE.md */
  decisions: string[];
  /** Pending todo items */
  pendingTodos: string[];
  /** Current blockers */
  blockers: string[];
  /** Phase progress tracking */
  phaseProgress: {
    phase: number;
    plan: number;
    status: string;
  };
}

/** Long-term memory: persistent wisdom */
export interface LongTermMemory {
  layer: MemoryLayer.LongTerm;
  /** Learnings from past tasks */
  learnings: string[];
  /** Architectural decisions */
  decisions: string[];
  /** Known issues and workarounds */
  issues: string[];
  /** Recognized patterns */
  patterns: string[];
  /** Estimated token count */
  tokenEstimate: number;
}

// ============================================================================
// Configuration
// ============================================================================

/** Memory system configuration options */
export interface MemoryConfig {
  /** Base directory for memory storage (default: '.planning') */
  baseDir: string;
  /** Wisdom directory name (default: 'wisdom') */
  wisdomDir: string;
  /** Maximum token budget for wisdom injection (default: 2000) */
  maxWisdomTokens: number;
}

/** Default memory configuration */
export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  baseDir: '.planning',
  wisdomDir: 'wisdom',
  maxWisdomTokens: 2000,
};

// ============================================================================
// Unified Memory Snapshot
// ============================================================================

/** Unified memory snapshot for context assembly */
export interface MemorySnapshot {
  /** Current working memory (or null if no active task) */
  working: WorkingMemory | null;
  /** Short-term session memory (or null if not loaded) */
  shortTerm: ShortTermMemory | null;
  /** Long-term wisdom memory (or null if not loaded) */
  longTerm: LongTermMemory | null;
  /** Total estimated tokens across all layers */
  totalTokens: number;
}
