/**
 * Error Injection Utilities for Testing Recovery Scenarios
 *
 * Provides helpers for creating test errors and simulating failures
 * during integration testing of the error recovery system.
 */

import type { RecoveryConfig } from '../../src/recovery/types.js';

/**
 * Create a recoverable error for testing
 *
 * @param message - Error message
 * @returns Error instance marked as recoverable
 */
export function createRecoverableError(message: string): Error {
  const error = new Error(message);
  (error as any).recoverable = true;
  return error;
}

/**
 * Create a fatal error for testing
 *
 * @param message - Error message
 * @returns Error instance marked as fatal/non-recoverable
 */
export function createFatalError(message: string): Error {
  const error = new Error(message);
  (error as any).fatal = true;
  return error;
}

/**
 * Simulate a failure by executing a function then throwing an error
 *
 * Useful for testing mid-execution failures where some work completes
 * before the error occurs.
 *
 * @param fn - Function to execute before throwing
 * @param error - Error to throw after execution
 */
export async function simulateFailure(
  fn: () => Promise<void>,
  error: Error
): Promise<void> {
  await fn();
  throw error;
}

/**
 * Mock recovery configuration with short durations for fast tests
 *
 * Uses 100ms cooldown and 2 max retries to keep tests fast while
 * still validating the recovery logic.
 */
export interface MockRecoveryConfig extends RecoveryConfig {
  cooldownMs: 100;
  maxRetries: 2;
}

/**
 * Create a mock recovery configuration for testing
 *
 * @returns Recovery config with short cooldown and low retry count
 */
export function createMockRecoveryConfig(): MockRecoveryConfig {
  return {
    cooldownMs: 100,
    maxRetries: 2,
    rollbackOnError: true,
  };
}
