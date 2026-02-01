/**
 * Wisdom Collector - Orchestrates wisdom flow from agent output to long-term storage
 *
 * Wraps extraction + storage. The orchestrator calls collectFromAgentOutput
 * after each subagent completes work.
 */

import { LongTermMemoryManager } from './long-term.js';
import { extractWisdom, WisdomExtraction } from './extractor.js';
import { MemoryConfig } from './types.js';

// ============================================================================
// Types
// ============================================================================

/** Result of a collection operation */
export interface CollectionResult {
  /** Extracted wisdom from the agent output */
  extracted: WisdomExtraction;
  /** Counts of items stored by category */
  stored: {
    learnings: number;
    decisions: number;
    issues: number;
    patterns: number;
  };
  /** Items skipped due to confidence threshold */
  skipped: number;
}

// ============================================================================
// WisdomCollector
// ============================================================================

/**
 * Orchestrates wisdom collection from agent output to long-term storage
 *
 * Usage:
 * ```typescript
 * const collector = new WisdomCollector();
 * const result = collector.collectFromAgentOutput(agentOutput, "task-123");
 * console.log(`Stored ${result.stored.learnings} learnings`);
 * ```
 */
export class WisdomCollector {
  private longTermManager: LongTermMemoryManager;
  private minConfidence: number;

  /**
   * Create a new WisdomCollector
   *
   * @param config - Optional partial config to override defaults
   * @param minConfidence - Minimum confidence threshold for storing (default: 0.3)
   */
  constructor(
    config: Partial<MemoryConfig> = {},
    minConfidence: number = 0.3
  ) {
    this.longTermManager = new LongTermMemoryManager(config);
    this.minConfidence = minConfidence;
  }

  /**
   * Collect wisdom from agent output
   *
   * Called after subagent completes work. Extracts wisdom from the output
   * and stores it in long-term memory if confidence exceeds threshold.
   *
   * @param agentOutput - Raw output text from the agent
   * @param taskId - Task identifier for timestamp/tracking
   * @returns CollectionResult with extraction and storage details
   */
  collectFromAgentOutput(
    agentOutput: string,
    taskId: string
  ): CollectionResult {
    const extracted = extractWisdom(agentOutput);

    const result: CollectionResult = {
      extracted,
      stored: { learnings: 0, decisions: 0, issues: 0, patterns: 0 },
      skipped: 0,
    };

    // Skip if confidence too low
    if (extracted.confidence < this.minConfidence) {
      result.skipped =
        extracted.learnings.length +
        extracted.decisions.length +
        extracted.issues.length +
        extracted.patterns.length;
      return result;
    }

    // Store each category
    // Note: appendX methods don't return success/failure, they silently handle errors
    // We count all attempted stores as successful since errors are silently ignored
    for (const learning of extracted.learnings) {
      this.longTermManager.appendLearning(learning, taskId);
      result.stored.learnings++;
    }

    for (const decision of extracted.decisions) {
      this.longTermManager.appendDecision(decision, taskId);
      result.stored.decisions++;
    }

    for (const issue of extracted.issues) {
      this.longTermManager.appendIssue(issue, taskId);
      result.stored.issues++;
    }

    for (const pattern of extracted.patterns) {
      this.longTermManager.appendPattern(pattern, taskId);
      result.stored.patterns++;
    }

    return result;
  }

  /**
   * Batch collect from multiple outputs (e.g., at plan completion)
   *
   * @param outputs - Array of task outputs with their IDs
   * @returns Array of CollectionResult for each output
   */
  collectFromMultipleOutputs(
    outputs: Array<{ taskId: string; output: string }>
  ): CollectionResult[] {
    return outputs.map(({ taskId, output }) =>
      this.collectFromAgentOutput(output, taskId)
    );
  }
}
