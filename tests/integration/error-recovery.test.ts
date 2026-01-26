/**
 * Error Recovery Integration Tests
 *
 * Tests the error recovery system's ability to handle failures gracefully:
 * - Checkpoint creation and restoration
 * - Error handling and state rollback
 * - Retry logic with cooldown timers
 * - Max retries detection and loop termination
 */

import { describe, test, beforeEach, afterEach, expect } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import {
  createCheckpoint,
  rollbackToCheckpoint,
  getLatestCheckpoint,
} from '../../src/state/checkpoint.js';
import {
  handleError,
  canRetry,
  getRecoveryState,
  setRecoveryState,
  clearRecoveryState,
} from '../../src/recovery/rollback.js';
import {
  clearRalphLoopState,
  writeRalphLoopState,
  readRalphLoopState,
} from '../../src/loops/ralph/state.js';
import { pollEvents, clearEvents } from '../../src/state/event-system.js';
import {
  createRecoverableError,
  createMockRecoveryConfig,
} from '../helpers/mock-error.js';

// ============================================================================
// Test Workspace Setup
// ============================================================================

describe('Error Recovery Integration', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    // Create unique test directory
    testDir = join(tmpdir(), `ultra-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });

    // Change to test directory
    originalCwd = process.cwd();
    process.chdir(testDir);

    // Initialize git repo (required for checkpoints)
    execSync('git init', { cwd: testDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: testDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: testDir, stdio: 'ignore' });

    // Create initial commit (git requires at least one commit)
    writeFileSync(join(testDir, '.gitkeep'), '');
    execSync('git add .gitkeep', { cwd: testDir, stdio: 'ignore' });
    execSync('git commit -m "Initial commit"', { cwd: testDir, stdio: 'ignore' });

    // Create state directory
    mkdirSync(join(testDir, '.ultraplan', 'state'), { recursive: true });

    // Add state directory to git (with a placeholder file)
    writeFileSync(join(testDir, '.ultraplan', 'state', '.gitkeep'), '');
    execSync('git add .ultraplan/state/.gitkeep', { cwd: testDir, stdio: 'ignore' });
    execSync('git commit -m "Add state directory"', { cwd: testDir, stdio: 'ignore' });

    // Clear any existing state
    clearRecoveryState();
    clearRalphLoopState();
    clearEvents();
  });

  afterEach(() => {
    // Restore original directory
    process.chdir(originalCwd);

    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  // ==========================================================================
  // Test Suite: Checkpoint Recovery
  // ==========================================================================

  describe('Checkpoint Recovery', () => {
    test('should create checkpoint before execution', () => {
      // When: Create checkpoint
      const result = createCheckpoint('08-integration-testing', 2, 1, 'Before risky operation');

      // Then: Checkpoint created successfully
      expect(result.success).toBe(true);
      expect(result.checkpoint).toBeDefined();
      expect(result.checkpoint?.phase).toBe('08-integration-testing');
      expect(result.checkpoint?.plan).toBe(2);
      expect(result.checkpoint?.wave).toBe(1);
      expect(result.checkpoint?.description).toBe('Before risky operation');

      // And: Checkpoint file exists
      const checkpointIndexPath = join(testDir, '.ultraplan', 'state', 'checkpoints', 'index.json');
      expect(existsSync(checkpointIndexPath)).toBe(true);
    });

    test('should restore checkpoint on rollback', () => {
      // Given: Initial state
      const initialState = {
        testValue: 'original',
        counter: 1,
      };
      writeFileSync(
        join(testDir, '.ultraplan', 'state', 'test-state.json'),
        JSON.stringify(initialState)
      );
      execSync('git add .ultraplan/state/', { cwd: testDir, stdio: 'ignore' });
      execSync('git commit -m "Add test state"', { cwd: testDir, stdio: 'ignore' });

      // When: Create checkpoint
      const checkpointResult = createCheckpoint('08-integration-testing', 2, 1, 'Checkpoint');
      expect(checkpointResult.success).toBe(true);
      const checkpointId = checkpointResult.checkpoint!.id;

      // And: Modify state
      const modifiedState = {
        testValue: 'modified',
        counter: 99,
      };
      writeFileSync(
        join(testDir, '.ultraplan', 'state', 'test-state.json'),
        JSON.stringify(modifiedState)
      );

      // And: Rollback to checkpoint
      const rollbackResult = rollbackToCheckpoint(checkpointId);

      // Then: Rollback succeeded
      expect(rollbackResult.success).toBe(true);

      // And: State restored to original
      const restoredContent = require(join(testDir, '.ultraplan', 'state', 'test-state.json'));
      expect(restoredContent.testValue).toBe('original');
      expect(restoredContent.counter).toBe(1);
    });
  });

  // ==========================================================================
  // Test Suite: Error Handling
  // ==========================================================================

  describe('Error Handling', () => {
    test('should increment error count on handleError', () => {
      // Given: Clean state
      clearRecoveryState();

      // When: Handle first error
      const error1 = createRecoverableError('First error');
      const config = createMockRecoveryConfig();
      handleError(error1, { phase: '08-integration-testing', plan: 2 }, config);

      // Then: Error count is 1
      let state = getRecoveryState();
      expect(state.errorCount).toBe(1);
      expect(state.lastError).toBe('First error');

      // When: Handle second error
      const error2 = createRecoverableError('Second error');
      handleError(error2, { phase: '08-integration-testing', plan: 2 }, config);

      // Then: Error count is 2
      state = getRecoveryState();
      expect(state.errorCount).toBe(2);
      expect(state.lastError).toBe('Second error');
    });

    test('should emit rollback_initiated event', () => {
      // Given: Clean state
      clearRecoveryState();
      clearEvents();

      // When: Handle error
      const error = createRecoverableError('Test error');
      const config = createMockRecoveryConfig();
      handleError(error, { phase: '08-integration-testing', plan: 2 }, config);

      // Then: Event emitted
      const events = pollEvents(0);
      expect(events.events.length).toBeGreaterThan(0);

      const rollbackEvent = events.events.find((e) => e.type === 'rollback_initiated');
      expect(rollbackEvent).toBeDefined();
      expect(rollbackEvent?.payload.error).toBe('Test error');
      expect(rollbackEvent?.payload.phase).toBe('08-integration-testing');
      expect(rollbackEvent?.payload.plan).toBe(2);
    });

    test('should clear Ralph Loop state on error', () => {
      // Given: Ralph Loop state exists
      writeRalphLoopState({
        active: true,
        iteration: 5,
        maxIterations: 100,
        completionPromise: 'DONE',
        startedAt: new Date().toISOString(),
        prompt: 'Test prompt',
      });

      // Verify state exists
      expect(readRalphLoopState()).not.toBeNull();

      // When: Handle error
      const error = createRecoverableError('Test error');
      const config = createMockRecoveryConfig();
      handleError(error, { phase: '08-integration-testing', plan: 2 }, config);

      // Then: Ralph Loop state cleared
      expect(readRalphLoopState()).toBeNull();
    });
  });

  // ==========================================================================
  // Test Suite: Retry Logic
  // ==========================================================================

  describe('Retry Logic', () => {
    test('should allow retry when under max retries', () => {
      // Given: Error count below max
      clearRecoveryState();
      setRecoveryState({
        errorCount: 1,
        isRecovering: true,
        lastErrorAt: new Date().toISOString(),
        lastError: 'Test error',
        cooldownUntil: null,
      });

      const config = createMockRecoveryConfig(); // maxRetries = 2

      // Then: Retry allowed
      expect(canRetry(config)).toBe(true);
    });

    test('should block retry when max retries exceeded', () => {
      // Given: Error count at max
      clearRecoveryState();
      setRecoveryState({
        errorCount: 2, // Same as maxRetries
        isRecovering: true,
        lastErrorAt: new Date().toISOString(),
        lastError: 'Test error',
        cooldownUntil: null,
      });

      const config = createMockRecoveryConfig(); // maxRetries = 2

      // Then: Retry blocked
      expect(canRetry(config)).toBe(false);
    });

    test('should emit ralph_loop_failed when max retries exceeded', () => {
      // Given: Clean state, clear events
      clearRecoveryState();
      clearEvents();

      const config = createMockRecoveryConfig(); // maxRetries = 2

      // When: Handle errors until max retries
      handleError(
        createRecoverableError('Error 1'),
        { phase: '08-integration-testing', plan: 2 },
        config
      );
      handleError(
        createRecoverableError('Error 2'),
        { phase: '08-integration-testing', plan: 2 },
        config
      );

      // Then: ralph_loop_failed event emitted
      const events = pollEvents(0);
      const failedEvent = events.events.find((e) => e.type === 'ralph_loop_failed');

      expect(failedEvent).toBeDefined();
      expect(failedEvent?.payload.reason).toBe('max_retries');
      expect(failedEvent?.payload.errorCount).toBe(2);
    });
  });

  // ==========================================================================
  // Test Suite: Cooldown Timer
  // ==========================================================================

  describe('Cooldown Timer', () => {
    test('should block retry during cooldown', () => {
      // Given: Cooldown set to future
      clearRecoveryState();
      const futureTime = new Date(Date.now() + 10000).toISOString(); // 10 seconds from now
      setRecoveryState({
        errorCount: 1,
        isRecovering: true,
        lastErrorAt: new Date().toISOString(),
        lastError: 'Test error',
        cooldownUntil: futureTime,
      });

      const config = createMockRecoveryConfig();

      // Then: Retry blocked
      expect(canRetry(config)).toBe(false);
    });

    test('should allow retry after cooldown expires', () => {
      // Given: Cooldown set to past
      clearRecoveryState();
      const pastTime = new Date(Date.now() - 1000).toISOString(); // 1 second ago
      setRecoveryState({
        errorCount: 1,
        isRecovering: true,
        lastErrorAt: new Date().toISOString(),
        lastError: 'Test error',
        cooldownUntil: pastTime,
      });

      const config = createMockRecoveryConfig();

      // Then: Retry allowed
      expect(canRetry(config)).toBe(true);
    });
  });
});
