/**
 * Background Manager Tests
 *
 * Comprehensive unit tests for the background task management module including:
 * - ConcurrencyManager: Model-tiered concurrent limits
 * - StabilityDetector: Idle detection and stale handling
 * - BackgroundManager: Task lifecycle management
 *
 * @module orchestration/background
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BackgroundManager,
  getBackgroundManager,
  resetBackgroundManager,
  ConcurrencyManager,
  StabilityDetector,
  createStabilityDetector,
} from './index.js';
import type { BackgroundTask, LaunchInput } from './types.js';

// ============================================================================
// ConcurrencyManager Tests
// ============================================================================

describe('ConcurrencyManager', () => {
  let manager: ConcurrencyManager;

  beforeEach(() => {
    manager = new ConcurrencyManager({
      modelConcurrency: { opus: 2, sonnet: 3, haiku: 5 },
      defaultConcurrency: 3,
    });
  });

  describe('getConcurrencyLimit', () => {
    it('returns configured limit for known models', () => {
      expect(manager.getConcurrencyLimit('opus')).toBe(2);
      expect(manager.getConcurrencyLimit('sonnet')).toBe(3);
      expect(manager.getConcurrencyLimit('haiku')).toBe(5);
    });

    it('returns default for unknown models', () => {
      expect(manager.getConcurrencyLimit('unknown')).toBe(3);
    });

    it('returns Infinity for 0 limit (unlimited)', () => {
      const unlimitedManager = new ConcurrencyManager({
        modelConcurrency: { test: 0 },
        defaultConcurrency: 3,
      });
      expect(unlimitedManager.getConcurrencyLimit('test')).toBe(Infinity);
    });
  });

  describe('acquire/release', () => {
    it('acquires slots up to limit', async () => {
      await manager.acquire('opus');
      await manager.acquire('opus');
      expect(manager.getCount('opus')).toBe(2);
    });

    it('blocks when at limit', async () => {
      await manager.acquire('opus');
      await manager.acquire('opus');

      let resolved = false;
      const promise = manager.acquire('opus').then(() => {
        resolved = true;
      });

      // Should not resolve immediately
      await new Promise((r) => setTimeout(r, 10));
      expect(resolved).toBe(false);

      // Release one slot
      manager.release('opus');

      // Now should resolve
      await promise;
      expect(resolved).toBe(true);
    });

    it('releases slots correctly', async () => {
      await manager.acquire('opus');
      expect(manager.getCount('opus')).toBe(1);

      manager.release('opus');
      expect(manager.getCount('opus')).toBe(0);
    });

    it('does not go negative on release', () => {
      manager.release('opus');
      expect(manager.getCount('opus')).toBe(0);
    });

    it('handles multiple models independently', async () => {
      await manager.acquire('opus');
      await manager.acquire('sonnet');
      await manager.acquire('haiku');

      expect(manager.getCount('opus')).toBe(1);
      expect(manager.getCount('sonnet')).toBe(1);
      expect(manager.getCount('haiku')).toBe(1);
    });
  });

  describe('cancelWaiters', () => {
    it('rejects waiting acquires', async () => {
      await manager.acquire('opus');
      await manager.acquire('opus');

      const promise = manager.acquire('opus');

      manager.cancelWaiters('opus');

      await expect(promise).rejects.toThrow('cancelled');
    });

    it('does not affect already acquired slots', async () => {
      await manager.acquire('opus');
      expect(manager.getCount('opus')).toBe(1);

      manager.cancelWaiters('opus');
      expect(manager.getCount('opus')).toBe(1);
    });
  });

  describe('clear', () => {
    it('resets all counts and queues', async () => {
      await manager.acquire('opus');
      await manager.acquire('sonnet');

      manager.clear();

      expect(manager.getCount('opus')).toBe(0);
      expect(manager.getCount('sonnet')).toBe(0);
    });
  });

  describe('getQueueLength', () => {
    it('returns queue length for model', async () => {
      await manager.acquire('opus');
      await manager.acquire('opus');

      // Queue two waiters
      manager.acquire('opus').catch(() => {});
      manager.acquire('opus').catch(() => {});

      expect(manager.getQueueLength('opus')).toBe(2);

      // Cleanup
      manager.cancelWaiters('opus');
    });

    it('returns 0 for empty queue', () => {
      expect(manager.getQueueLength('opus')).toBe(0);
    });
  });
});

// ============================================================================
// StabilityDetector Tests
// ============================================================================

describe('StabilityDetector', () => {
  let detector: StabilityDetector;

  beforeEach(() => {
    detector = createStabilityDetector({
      minStabilityTimeMs: 100, // Fast for tests
      stabilityThreshold: 3,
      staleTimeoutMs: 500,
      minRuntimeBeforeStaleMs: 50,
      taskTtlMs: 1000,
    });
  });

  const createTask = (overrides?: Partial<BackgroundTask>): BackgroundTask => ({
    id: 'test-task',
    parentSessionId: 'parent-1',
    parentMessageId: 'msg-1',
    description: 'Test task',
    prompt: 'Test prompt',
    agent: 'executor',
    status: 'running',
    startedAt: new Date(Date.now() - 200), // Started 200ms ago
    progress: {
      toolCalls: 0,
      lastUpdate: new Date(),
    },
    ...overrides,
  });

  describe('poll', () => {
    it('returns continue for non-running tasks', async () => {
      const task = createTask({ status: 'pending' });
      const result = await detector.poll(task);
      expect(result.action).toBe('continue');
    });

    it('returns continue for tasks below min stability time', async () => {
      const task = createTask({ startedAt: new Date() }); // Just started
      const result = await detector.poll(task);
      expect(result.action).toBe('continue');
    });

    it('returns expired for tasks beyond TTL', async () => {
      const task = createTask({
        startedAt: new Date(Date.now() - 2000), // Started 2s ago (> 1s TTL)
      });
      const result = await detector.poll(task);
      expect(result.action).toBe('expired');
      expect(result.reason).toContain('TTL');
    });

    it('returns stale for tasks with no progress', async () => {
      const task = createTask({
        startedAt: new Date(Date.now() - 200),
        progress: {
          toolCalls: 0,
          lastUpdate: new Date(Date.now() - 600), // No update for 600ms (> 500ms stale)
        },
      });
      const result = await detector.poll(task);
      expect(result.action).toBe('stale');
      expect(result.reason).toContain('No progress');
    });

    it('detects stability after threshold polls with message provider', async () => {
      const task = createTask();
      detector.setMessageCountProvider(async () => 5); // Always return 5

      // First poll - sets baseline (lastMsgCount = 5, stablePolls = 0)
      await detector.poll(task);
      expect(task.lastMsgCount).toBe(5);
      expect(task.stablePolls).toBe(0);

      // Second poll - count matches, increment stablePolls to 1
      await detector.poll(task);
      expect(task.stablePolls).toBe(1);

      // Third poll - stablePolls = 2
      await detector.poll(task);
      expect(task.stablePolls).toBe(2);

      // Fourth poll - triggers completion (3 stable polls)
      const result = await detector.poll(task);
      expect(result.action).toBe('complete');
      expect(result.reason).toContain('stable for 3 polls');
    });

    it('resets stability when count changes', async () => {
      const task = createTask();
      let count = 5;
      detector.setMessageCountProvider(async () => count);

      // First poll - sets baseline
      await detector.poll(task);
      expect(task.lastMsgCount).toBe(5);
      expect(task.stablePolls).toBe(0);

      // Second and third polls - stable (stablePolls = 1, then 2)
      await detector.poll(task);
      expect(task.stablePolls).toBe(1);
      await detector.poll(task);
      expect(task.stablePolls).toBe(2);

      // Count changes - resets stability
      count = 6;
      await detector.poll(task);
      expect(task.stablePolls).toBe(0);
      expect(task.lastMsgCount).toBe(6);
    });

    it('completes when session not found (null from provider)', async () => {
      const task = createTask();
      detector.setMessageCountProvider(async () => null);

      const result = await detector.poll(task);
      expect(result.action).toBe('complete');
      expect(result.reason).toContain('terminated');
    });

    it('continues without message provider', async () => {
      const task = createTask();
      // No provider set

      const result = await detector.poll(task);
      expect(result.action).toBe('continue');
    });
  });

  describe('resetStability', () => {
    it('clears stability tracking', () => {
      const task = createTask({
        stablePolls: 2,
        lastMsgCount: 10,
      });

      detector.resetStability(task);

      expect(task.stablePolls).toBe(0);
      expect(task.lastMsgCount).toBeUndefined();
    });
  });

  describe('getConfig', () => {
    it('returns copy of config', () => {
      const config = detector.getConfig();

      expect(config.minStabilityTimeMs).toBe(100);
      expect(config.stabilityThreshold).toBe(3);
      expect(config.staleTimeoutMs).toBe(500);
      expect(config.minRuntimeBeforeStaleMs).toBe(50);
      expect(config.taskTtlMs).toBe(1000);
    });

    it('uses default values when not specified', () => {
      const defaultDetector = createStabilityDetector();
      const config = defaultDetector.getConfig();

      expect(config.minStabilityTimeMs).toBe(10_000);
      expect(config.stabilityThreshold).toBe(3);
      expect(config.staleTimeoutMs).toBe(180_000);
      expect(config.minRuntimeBeforeStaleMs).toBe(30_000);
      expect(config.taskTtlMs).toBe(30 * 60 * 1000);
    });
  });
});

// ============================================================================
// BackgroundManager Tests
// ============================================================================

describe('BackgroundManager', () => {
  let manager: BackgroundManager;

  beforeEach(() => {
    resetBackgroundManager();
    manager = new BackgroundManager({
      modelConcurrency: { opus: 2, sonnet: 3, haiku: 5 },
      pollingIntervalMs: 100,
    });
  });

  afterEach(() => {
    manager.clear();
  });

  const createInput = (overrides?: Partial<LaunchInput>): LaunchInput => ({
    description: 'Test task',
    prompt: 'Test prompt',
    agent: 'executor',
    parentSessionId: 'parent-1',
    parentMessageId: 'msg-1',
    model: 'sonnet',
    ...overrides,
  });

  describe('launch', () => {
    it('creates task and transitions to running when slot available', async () => {
      const task = await manager.launch(createInput());
      // Tasks immediately transition to running when concurrency slots are available
      // Wait for queue processing
      await new Promise((r) => setTimeout(r, 10));
      expect(task.status).toBe('running');
      expect(task.id).toMatch(/^bg-/);
    });

    it('assigns concurrency key from model', async () => {
      const task = await manager.launch(createInput({ model: 'opus' }));
      expect(task.concurrencyKey).toBe('opus');
    });

    it('defaults to sonnet if no model specified', async () => {
      const task = await manager.launch(createInput({ model: undefined }));
      expect(task.concurrencyKey).toBe('sonnet');
    });

    it('stores task description and prompt', async () => {
      const task = await manager.launch(
        createInput({
          description: 'Fix all bugs',
          prompt: 'Please fix bugs in src/',
        }),
      );
      expect(task.description).toBe('Fix all bugs');
      expect(task.prompt).toBe('Please fix bugs in src/');
    });
  });

  describe('completeTask', () => {
    it('marks task as completed', async () => {
      const task = await manager.launch(createInput());
      // Wait for queue processing
      await new Promise((r) => setTimeout(r, 10));
      expect(task.status).toBe('running');

      const result = manager.completeTask(task.id, 'Success');
      expect(result).toBe(true);
      expect(task.status).toBe('completed');
      expect(task.result).toBe('Success');
      expect(task.completedAt).toBeDefined();
    });

    it('rejects already completed tasks', async () => {
      const task = await manager.launch(createInput());
      await new Promise((r) => setTimeout(r, 10));
      manager.completeTask(task.id, 'Done');
      // Try to complete again
      const result = manager.completeTask(task.id, 'Again');
      expect(result).toBe(false);
    });

    it('returns false for non-existent task', () => {
      const result = manager.completeTask('non-existent', 'Success');
      expect(result).toBe(false);
    });
  });

  describe('failTask', () => {
    it('marks task as error', async () => {
      const task = await manager.launch(createInput());
      await new Promise((r) => setTimeout(r, 10));
      expect(task.status).toBe('running');

      const result = manager.failTask(task.id, 'Something went wrong');
      expect(result).toBe(true);
      expect(task.status).toBe('error');
      expect(task.error).toBe('Something went wrong');
    });

    it('rejects already failed tasks', async () => {
      const task = await manager.launch(createInput());
      await new Promise((r) => setTimeout(r, 10));
      manager.failTask(task.id, 'First error');
      // Try to fail again
      const result = manager.failTask(task.id, 'Second error');
      expect(result).toBe(false);
    });
  });

  describe('cancelTask', () => {
    it('cancels running task', async () => {
      const task = await manager.launch(createInput());
      await new Promise((r) => setTimeout(r, 10));
      expect(task.status).toBe('running');

      const result = manager.cancelTask(task.id);
      expect(result).toBe(true);
      expect(task.status).toBe('cancelled');
    });

    it('rejects already completed tasks', async () => {
      const task = await manager.launch(createInput());
      await new Promise((r) => setTimeout(r, 10));
      manager.completeTask(task.id, 'Done');

      const result = manager.cancelTask(task.id);
      expect(result).toBe(false);
    });

    it('rejects already cancelled tasks', async () => {
      const task = await manager.launch(createInput());
      await new Promise((r) => setTimeout(r, 10));
      manager.cancelTask(task.id);

      const result = manager.cancelTask(task.id);
      expect(result).toBe(false);
    });
  });

  describe('getTasksByStatus', () => {
    it('filters by status', async () => {
      await manager.launch(createInput());
      await manager.launch(createInput());
      // Wait for queue processing
      await new Promise((r) => setTimeout(r, 10));

      const running = manager.getTasksByStatus('running');
      expect(running.length).toBe(2);

      const pending = manager.getTasksByStatus('pending');
      expect(pending.length).toBe(0);
    });
  });

  describe('getTasksForParent', () => {
    it('filters by parent session', async () => {
      await manager.launch(createInput({ parentSessionId: 'parent-1' }));
      await manager.launch(createInput({ parentSessionId: 'parent-2' }));
      await new Promise((r) => setTimeout(r, 10));

      const parent1Tasks = manager.getTasksForParent('parent-1');
      expect(parent1Tasks.length).toBe(1);
      expect(parent1Tasks[0].parentSessionId).toBe('parent-1');
    });
  });

  describe('getAllTasks', () => {
    it('returns all tasks', async () => {
      await manager.launch(createInput());
      await manager.launch(createInput());
      await manager.launch(createInput());

      const all = manager.getAllTasks();
      expect(all.length).toBe(3);
    });
  });

  describe('getRunningTasks', () => {
    it('returns only running tasks', async () => {
      const task1 = await manager.launch(createInput());
      const task2 = await manager.launch(createInput());
      await new Promise((r) => setTimeout(r, 10));

      // Both tasks should be running
      const running = manager.getRunningTasks();
      expect(running.length).toBe(2);

      // Complete one task
      manager.completeTask(task1.id, 'Done');

      const stillRunning = manager.getRunningTasks();
      expect(stillRunning.length).toBe(1);
      expect(stillRunning[0].id).toBe(task2.id);
    });
  });

  describe('callbacks', () => {
    it('calls onComplete callback', async () => {
      const callback = vi.fn();
      manager.onComplete(callback);

      const task = await manager.launch(createInput());
      await new Promise((r) => setTimeout(r, 10));
      manager.completeTask(task.id, 'Done');

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ id: task.id }));
    });

    it('calls onStart callback', async () => {
      const callback = vi.fn();
      manager.onStart(callback);

      // Launch a task - callback should be called when task transitions to running
      const task = await manager.launch(createInput());
      await new Promise((r) => setTimeout(r, 10));

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ id: task.id }));
    });
  });

  describe('updateProgress', () => {
    it('updates progress for running task', async () => {
      const task = await manager.launch(createInput());
      await new Promise((r) => setTimeout(r, 10));
      expect(task.status).toBe('running');

      const result = manager.updateProgress(task.id, {
        toolCalls: 5,
        lastTool: 'read_file',
      });

      expect(result).toBe(true);
      expect(task.progress?.toolCalls).toBe(5);
      expect(task.progress?.lastTool).toBe('read_file');
    });

    it('rejects completed tasks', async () => {
      const task = await manager.launch(createInput());
      await new Promise((r) => setTimeout(r, 10));
      manager.completeTask(task.id, 'Done');

      const result = manager.updateProgress(task.id, { toolCalls: 1 });
      expect(result).toBe(false);
    });
  });

  describe('polling', () => {
    it('starts and stops polling', () => {
      manager.startPolling(50);
      // Polling is started
      manager.stopPolling();
      // Polling is stopped
    });

    it('does not start duplicate polling', () => {
      manager.startPolling(50);
      manager.startPolling(50); // Should be no-op
      manager.stopPolling();
    });
  });

  describe('setMessageCountProvider', () => {
    it('accepts message count provider', () => {
      manager.setMessageCountProvider(async (_taskId: string) => 10);
      // Should not throw
    });
  });

  describe('clear', () => {
    it('clears all state', async () => {
      await manager.launch(createInput());
      await manager.launch(createInput());
      manager.startPolling();

      manager.clear();

      expect(manager.getAllTasks().length).toBe(0);
    });
  });

  describe('getConcurrencyManager', () => {
    it('returns concurrency manager instance', () => {
      const cm = manager.getConcurrencyManager();
      expect(cm).toBeInstanceOf(ConcurrencyManager);
    });
  });
});

// ============================================================================
// Singleton Tests
// ============================================================================

describe('BackgroundManager Singleton', () => {
  beforeEach(() => {
    resetBackgroundManager();
  });

  afterEach(() => {
    resetBackgroundManager();
  });

  it('getBackgroundManager returns same instance', () => {
    const m1 = getBackgroundManager();
    const m2 = getBackgroundManager();
    expect(m1).toBe(m2);
  });

  it('resetBackgroundManager creates new instance', () => {
    const m1 = getBackgroundManager();
    resetBackgroundManager();
    const m2 = getBackgroundManager();
    expect(m1).not.toBe(m2);
  });
});
