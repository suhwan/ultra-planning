/**
 * Memory Module - Three-layer memory system
 *
 * Exports all memory types and managers for the working, short-term,
 * and long-term memory layers.
 *
 * Also includes wisdom extraction, collection, session loading, and
 * prompt injection utilities for cross-session knowledge persistence.
 */

// ============================================================================
// Types
// ============================================================================

export {
  MemoryLayer,
  WorkingMemory,
  ShortTermMemory,
  LongTermMemory,
  MemoryConfig,
  MemorySnapshot,
  DEFAULT_MEMORY_CONFIG,
} from './types.js';

// ============================================================================
// Managers
// ============================================================================

export { WorkingMemoryManager } from './working.js';
export { ShortTermMemoryManager } from './short-term.js';
export { LongTermMemoryManager } from './long-term.js';

// ============================================================================
// Extraction and Collection (15-02)
// ============================================================================

export { extractWisdom, type WisdomExtraction } from './extractor.js';
export { WisdomCollector, type CollectionResult } from './collector.js';

// ============================================================================
// Session and Injection (15-03)
// ============================================================================

export { SessionWisdomLoader, type SessionContext } from './session-loader.js';
export { WisdomPromptInjector, formatWisdomBlock } from './prompt-injector.js';

// Import for createMemorySnapshot
import { WorkingMemoryManager } from './working.js';
import { ShortTermMemoryManager } from './short-term.js';
import { LongTermMemoryManager } from './long-term.js';
import { MemorySnapshot, MemoryConfig, DEFAULT_MEMORY_CONFIG } from './types.js';

/** Characters per token estimate */
const CHARS_PER_TOKEN = 4;

/**
 * Create a unified memory snapshot combining all three layers
 *
 * @param config - Optional memory configuration
 * @returns MemorySnapshot with all available layers
 */
export function createMemorySnapshot(config: Partial<MemoryConfig> = {}): MemorySnapshot {
  const mergedConfig = { ...DEFAULT_MEMORY_CONFIG, ...config };

  // Initialize managers
  const workingManager = new WorkingMemoryManager();
  const shortTermManager = new ShortTermMemoryManager(mergedConfig);
  const longTermManager = new LongTermMemoryManager(mergedConfig);

  // Load each layer
  const working = workingManager.getCurrentTask();

  let shortTerm = null;
  try {
    shortTerm = shortTermManager.loadFromState();
  } catch {
    // Silently handle load errors
  }

  let longTerm = null;
  try {
    longTerm = longTermManager.loadWisdom();
  } catch {
    // Silently handle load errors
  }

  // Calculate total tokens
  let totalTokens = 0;

  if (working) {
    const workingStr = JSON.stringify(working.taskContext);
    totalTokens += Math.ceil(workingStr.length / CHARS_PER_TOKEN);
  }

  if (shortTerm) {
    const shortTermStr = [
      ...shortTerm.decisions,
      ...shortTerm.pendingTodos,
      ...shortTerm.blockers,
    ].join('\n');
    totalTokens += Math.ceil(shortTermStr.length / CHARS_PER_TOKEN);
  }

  if (longTerm) {
    totalTokens += longTerm.tokenEstimate;
  }

  return {
    working,
    shortTerm,
    longTerm,
    totalTokens,
  };
}

// ============================================================================
// Convenience Functions
// ============================================================================

// Import for initializeMemorySystem
import { SessionWisdomLoader } from './session-loader.js';
import { WisdomCollector } from './collector.js';
import { WisdomPromptInjector } from './prompt-injector.js';

/**
 * Initialize the complete memory system for orchestrator startup
 *
 * Provides a single entry point that:
 * 1. Creates and initializes SessionWisdomLoader (loads persistent memory)
 * 2. Creates WisdomCollector (for extracting wisdom from agent outputs)
 * 3. Creates WisdomPromptInjector (for formatting wisdom into prompts)
 *
 * @param config - Optional memory configuration
 * @returns Object containing sessionLoader, collector, and injector
 *
 * @example
 * ```typescript
 * const { sessionLoader, collector, injector } = initializeMemorySystem();
 *
 * // Use sessionLoader to get loaded wisdom
 * const context = sessionLoader.getSessionContext();
 *
 * // Use injector to create prompt blocks
 * const block = injector.createInjectionBlock(context?.longTermMemory);
 *
 * // Use collector after agent completes
 * const result = collector.collectFromAgentOutput(agentOutput, taskId);
 * ```
 */
export function initializeMemorySystem(
  config: Partial<MemoryConfig> = {}
): {
  sessionLoader: SessionWisdomLoader;
  collector: WisdomCollector;
  injector: WisdomPromptInjector;
} {
  const sessionLoader = new SessionWisdomLoader(config);
  const collector = new WisdomCollector(config);
  const injector = new WisdomPromptInjector(config);

  // Initialize session (loads all persistent memory)
  sessionLoader.initSession();

  return { sessionLoader, collector, injector };
}
