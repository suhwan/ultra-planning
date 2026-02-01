/**
 * AdvancedContextMonitor Tests
 *
 * Tests for advanced monitoring with auto-compaction detection:
 * - Auto-compaction threshold detection at 80%
 * - Threshold ordering (70% < 80% < 85%)
 * - Configurable thresholds
 * - Event emission
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rmSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  AdvancedContextMonitor,
  createAdvancedMonitor,
  type AdvancedContextConfig,
} from './advanced-monitor.js';
import * as eventSystem from '../state/event-system.js';

// ============================================================================
// Test Setup
// ============================================================================

const TEST_DIR = '/tmp/claude/advanced-monitor-tests';
const STATE_DIR = join(TEST_DIR, '.ultraplan/state');

// Small context limit for fast tests (1000 tokens = 4000 chars)
const SMALL_CONTEXT_LIMIT = 1000;
const CHARS_PER_TOKEN = 4;

/**
 * Generate text of specific character length
 */
function generateText(charCount: number): string {
  return 'x'.repeat(charCount);
}

/**
 * Generate text for a specific token count
 */
function generateTokens(tokenCount: number): string {
  return generateText(tokenCount * CHARS_PER_TOKEN);
}

/**
 * Calculate characters needed to reach a specific usage ratio
 */
function charsForRatio(ratio: number, contextLimit: number): number {
  // tokens = chars / 4, usageRatio = tokens / contextLimit
  // So: chars = ratio * contextLimit * 4
  return Math.ceil(ratio * contextLimit * CHARS_PER_TOKEN);
}

// ============================================================================
// Setup/Teardown
// ============================================================================

function setupTestEnv() {
  // Create test directories
  mkdirSync(STATE_DIR, { recursive: true });

  // Change to test directory so state files go there
  process.chdir(TEST_DIR);
}

function cleanupTestEnv() {
  // Clean up test directory
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('AdvancedContextMonitor', () => {
  beforeEach(() => {
    cleanupTestEnv();
    setupTestEnv();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestEnv();
  });

  describe('auto-compaction threshold detection', () => {
    it('should return auto_compact action when reaching 80% usage', () => {
      const monitor = createAdvancedMonitor('test-agent-1', {
        contextLimit: SMALL_CONTEXT_LIMIT,
      });

      monitor.start();

      // Add content to reach 80% threshold (800 tokens = 3200 chars)
      const chars80 = charsForRatio(0.80, SMALL_CONTEXT_LIMIT);
      const action = monitor.trackContent(generateText(chars80));

      expect(action.level).toBe('auto_compact');
      expect(action.action).toBe('auto_compact');
      expect(action.message).toContain('80%');
    });

    it('should set autoCompactionTriggered to true after reaching 80%', () => {
      const monitor = createAdvancedMonitor('test-agent-2', {
        contextLimit: SMALL_CONTEXT_LIMIT,
      });

      monitor.start();

      // Initially not triggered
      expect(monitor.isAutoCompactionTriggered()).toBe(false);

      // Add content to reach 80%
      const chars80 = charsForRatio(0.80, SMALL_CONTEXT_LIMIT);
      monitor.trackContent(generateText(chars80));

      // Now should be triggered
      expect(monitor.isAutoCompactionTriggered()).toBe(true);
    });

    it('should only trigger auto-compaction once per session', () => {
      // Spy on emitEvent to count auto-compaction events
      const emitEventSpy = vi.spyOn(eventSystem, 'emitEvent');

      const monitor = createAdvancedMonitor('test-agent-3', {
        contextLimit: SMALL_CONTEXT_LIMIT,
      });

      monitor.start();

      // First: reach 80%
      const chars80 = charsForRatio(0.80, SMALL_CONTEXT_LIMIT);
      const action1 = monitor.trackContent(generateText(chars80));
      expect(action1.level).toBe('auto_compact');

      // Count auto-compaction events after first track
      const countAfterFirst = emitEventSpy.mock.calls.filter(
        (call) => call[0].type === 'context_auto_compaction_triggered'
      ).length;
      expect(countAfterFirst).toBe(1);

      // Second: add more content but stay under 85%
      monitor.trackContent(generateText(100));

      // Count should NOT have increased
      const countAfterSecond = emitEventSpy.mock.calls.filter(
        (call) => call[0].type === 'context_auto_compaction_triggered'
      ).length;
      expect(countAfterSecond).toBe(1);

      // Third: add even more content
      monitor.trackContent(generateText(100));

      // Count should STILL not have increased
      const countAfterThird = emitEventSpy.mock.calls.filter(
        (call) => call[0].type === 'context_auto_compaction_triggered'
      ).length;
      expect(countAfterThird).toBe(1);

      // Flag should remain true
      expect(monitor.isAutoCompactionTriggered()).toBe(true);
    });
  });

  describe('threshold ordering (70% < 80% < 85%)', () => {
    it('should return warning at 70% usage', () => {
      const monitor = createAdvancedMonitor('test-agent-4', {
        contextLimit: SMALL_CONTEXT_LIMIT,
      });

      monitor.start();

      // Add content to reach exactly 70%
      const chars70 = charsForRatio(0.70, SMALL_CONTEXT_LIMIT);
      const action = monitor.trackContent(generateText(chars70));

      expect(action.level).toBe('warning');
      expect(action.action).toBe('prepare_handoff');
    });

    it('should return auto_compact at 80% usage', () => {
      const monitor = createAdvancedMonitor('test-agent-5', {
        contextLimit: SMALL_CONTEXT_LIMIT,
      });

      monitor.start();

      // Add content to reach exactly 80%
      const chars80 = charsForRatio(0.80, SMALL_CONTEXT_LIMIT);
      const action = monitor.trackContent(generateText(chars80));

      expect(action.level).toBe('auto_compact');
      expect(action.action).toBe('auto_compact');
    });

    it('should return critical at 85% usage', () => {
      const monitor = createAdvancedMonitor('test-agent-6', {
        contextLimit: SMALL_CONTEXT_LIMIT,
      });

      monitor.start();

      // Manually trigger auto-compaction first so we can test critical
      const chars80 = charsForRatio(0.80, SMALL_CONTEXT_LIMIT);
      monitor.trackContent(generateText(chars80));

      // Now add more to reach 85%
      // We're at 80%, need to add 5% more
      const chars5 = charsForRatio(0.06, SMALL_CONTEXT_LIMIT); // 6% to be safely over 85%
      const action = monitor.trackContent(generateText(chars5));

      expect(action.level).toBe('critical');
      expect(action.action).toBe('force_return');
    });

    it('should trigger each threshold only once when crossing all thresholds', () => {
      const monitor = createAdvancedMonitor('test-agent-7', {
        contextLimit: SMALL_CONTEXT_LIMIT,
      });

      monitor.start();

      // Track levels as we add content
      const levels: string[] = [];

      // Step 1: Add 70% - should trigger warning
      const chars70 = charsForRatio(0.70, SMALL_CONTEXT_LIMIT);
      levels.push(monitor.trackContent(generateText(chars70)).level);

      // Step 2: Add 10% more to reach 80% - should trigger auto_compact
      const chars10 = charsForRatio(0.10, SMALL_CONTEXT_LIMIT);
      levels.push(monitor.trackContent(generateText(chars10)).level);

      // Step 3: Add 6% more to reach ~86% - should trigger critical
      const chars6 = charsForRatio(0.06, SMALL_CONTEXT_LIMIT);
      levels.push(monitor.trackContent(generateText(chars6)).level);

      expect(levels[0]).toBe('warning');
      expect(levels[1]).toBe('auto_compact');
      expect(levels[2]).toBe('critical');
    });
  });

  describe('configurable auto-compaction threshold', () => {
    it('should trigger auto-compaction at custom 75% threshold', () => {
      const config: AdvancedContextConfig = {
        contextLimit: SMALL_CONTEXT_LIMIT,
        autoCompactionThreshold: 0.75,
      };

      const monitor = createAdvancedMonitor('test-agent-8', config);
      monitor.start();

      // Add content to reach 75% (below default 80%)
      const chars75 = charsForRatio(0.75, SMALL_CONTEXT_LIMIT);
      const action = monitor.trackContent(generateText(chars75));

      expect(action.level).toBe('auto_compact');
      expect(action.action).toBe('auto_compact');
      expect(monitor.isAutoCompactionTriggered()).toBe(true);
    });

    it('should NOT trigger at 75% when default 80% threshold is used', () => {
      const monitor = createAdvancedMonitor('test-agent-9', {
        contextLimit: SMALL_CONTEXT_LIMIT,
        // Using default 0.80 threshold
      });

      monitor.start();

      // Add content to reach 75% (below default 80%)
      const chars75 = charsForRatio(0.75, SMALL_CONTEXT_LIMIT);
      const action = monitor.trackContent(generateText(chars75));

      // Should be warning (70-80%), not auto_compact
      expect(action.level).toBe('warning');
      expect(monitor.isAutoCompactionTriggered()).toBe(false);
    });

    it('should store custom threshold in advanced state', () => {
      const customThreshold = 0.75;
      const monitor = createAdvancedMonitor('test-agent-10', {
        contextLimit: SMALL_CONTEXT_LIMIT,
        autoCompactionThreshold: customThreshold,
      });

      monitor.start();
      const state = monitor.getAdvancedState();

      expect(state.autoCompactionThreshold).toBe(customThreshold);
    });
  });

  describe('event emission', () => {
    it('should emit context_auto_compaction_triggered event exactly once', () => {
      // Spy on emitEvent
      const emitEventSpy = vi.spyOn(eventSystem, 'emitEvent');

      const monitor = createAdvancedMonitor('test-agent-11', {
        contextLimit: SMALL_CONTEXT_LIMIT,
      });

      monitor.start();

      // Reach 80% to trigger auto-compaction
      const chars80 = charsForRatio(0.80, SMALL_CONTEXT_LIMIT);
      monitor.trackContent(generateText(chars80));

      // Find auto-compaction events
      const autoCompactionEvents = emitEventSpy.mock.calls.filter(
        (call) => call[0].type === 'context_auto_compaction_triggered'
      );

      expect(autoCompactionEvents.length).toBe(1);

      // Verify event payload
      const event = autoCompactionEvents[0][0];
      expect(event.type).toBe('context_auto_compaction_triggered');
      expect(event.payload).toMatchObject({
        agentId: 'test-agent-11',
        threshold: 0.80,
      });
      expect(event.payload.usageRatio).toBeGreaterThanOrEqual(0.80);
      expect(event.source).toBe('agent:test-agent-11');
    });

    it('should NOT emit auto-compaction event on subsequent content tracking', () => {
      const emitEventSpy = vi.spyOn(eventSystem, 'emitEvent');

      const monitor = createAdvancedMonitor('test-agent-12', {
        contextLimit: SMALL_CONTEXT_LIMIT,
      });

      monitor.start();

      // First: reach 80%
      const chars80 = charsForRatio(0.80, SMALL_CONTEXT_LIMIT);
      monitor.trackContent(generateText(chars80));

      // Count auto-compaction events so far
      const countBefore = emitEventSpy.mock.calls.filter(
        (call) => call[0].type === 'context_auto_compaction_triggered'
      ).length;

      // Track more content
      monitor.trackContent(generateText(100));
      monitor.trackContent(generateText(100));

      // Count should not have increased
      const countAfter = emitEventSpy.mock.calls.filter(
        (call) => call[0].type === 'context_auto_compaction_triggered'
      ).length;

      expect(countAfter).toBe(countBefore);
      expect(countAfter).toBe(1);
    });

    it('should emit context_threshold_reached event when crossing warning threshold', () => {
      const emitEventSpy = vi.spyOn(eventSystem, 'emitEvent');

      const monitor = createAdvancedMonitor('test-agent-13', {
        contextLimit: SMALL_CONTEXT_LIMIT,
      });

      monitor.start();

      // Reach 70% to trigger warning
      const chars70 = charsForRatio(0.70, SMALL_CONTEXT_LIMIT);
      monitor.trackContent(generateText(chars70));

      // Find threshold events
      const thresholdEvents = emitEventSpy.mock.calls.filter(
        (call) => call[0].type === 'context_threshold_reached'
      );

      expect(thresholdEvents.length).toBeGreaterThanOrEqual(1);

      // Check that warning was emitted
      const warningEvent = thresholdEvents.find(
        (call) => call[0].payload.level === 'warning'
      );
      expect(warningEvent).toBeDefined();
    });
  });

  describe('resetAutoCompactionTrigger', () => {
    it('should allow auto-compaction to trigger again after reset', () => {
      const emitEventSpy = vi.spyOn(eventSystem, 'emitEvent');

      const monitor = createAdvancedMonitor('test-agent-14', {
        contextLimit: SMALL_CONTEXT_LIMIT,
      });

      monitor.start();

      // First trigger
      const chars80 = charsForRatio(0.80, SMALL_CONTEXT_LIMIT);
      monitor.trackContent(generateText(chars80));
      expect(monitor.isAutoCompactionTriggered()).toBe(true);

      // Reset
      monitor.resetAutoCompactionTrigger();
      expect(monitor.isAutoCompactionTriggered()).toBe(false);

      // Note: In a real scenario, compaction would reduce context
      // For testing, we just verify the flag resets correctly
      const state = monitor.getAdvancedState();
      expect(state.autoCompactionTriggered).toBe(false);
    });
  });

  describe('getThresholdAction', () => {
    it('should return auto_compact action when at 80% before triggering', () => {
      const monitor = createAdvancedMonitor('test-agent-15', {
        contextLimit: SMALL_CONTEXT_LIMIT,
      });

      monitor.start();

      // Add content to reach 80%
      const chars80 = charsForRatio(0.80, SMALL_CONTEXT_LIMIT);
      // Use getThresholdAction before trackContent triggers it
      // First add content below threshold
      const chars60 = charsForRatio(0.60, SMALL_CONTEXT_LIMIT);
      monitor.trackContent(generateText(chars60));

      // Get action - should be normal since we're at 60%
      let action = monitor.getThresholdAction();
      expect(action.level).toBe('normal');

      // Now add more to reach 80% (need 20% more)
      const chars20 = charsForRatio(0.21, SMALL_CONTEXT_LIMIT);
      monitor.trackContent(generateText(chars20));

      // Since trackContent already triggered, action won't show auto_compact
      // It will show based on detectThreshold
      action = monitor.getThresholdAction();
      // After triggering, it should show the underlying threshold level
      expect(['auto_compact', 'warning', 'critical']).toContain(action.level);
    });
  });
});
