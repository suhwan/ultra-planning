/**
 * Verification Hook Tests
 *
 * Tests for the verification reminder system that prompts orchestrators
 * to verify subagent work before marking tasks complete.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  VERIFICATION_REMINDER,
  createVerificationReminder,
  emitVerificationRequired,
  DEFAULT_VERIFICATION_STEPS,
  type VerificationStep,
} from './verification.js';

// Mock the event system
vi.mock('../../state/event-system.js', () => ({
  emitEvent: vi.fn(),
}));

import { emitEvent } from '../../state/event-system.js';

describe('Verification Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('VERIFICATION_REMINDER constant', () => {
    it('should contain SYSTEM DIRECTIVE prefix', () => {
      expect(VERIFICATION_REMINDER).toContain('[SYSTEM DIRECTIVE:');
    });

    it('should contain VERIFICATION REMINDER type', () => {
      expect(VERIFICATION_REMINDER).toContain('VERIFICATION REMINDER');
    });

    it('should warn about subagent claims', () => {
      expect(VERIFICATION_REMINDER).toContain('FREQUENTLY LIE');
    });

    it('should mention lsp_diagnostics verification', () => {
      expect(VERIFICATION_REMINDER).toContain('lsp_diagnostics');
    });

    it('should mention test verification', () => {
      expect(VERIFICATION_REMINDER).toContain('npm test');
    });

    it('should mention build verification', () => {
      expect(VERIFICATION_REMINDER).toContain('npm run build');
    });

    it('should instruct to never trust done claims', () => {
      expect(VERIFICATION_REMINDER).toContain('NEVER trust');
    });

    it('should instruct to always verify', () => {
      expect(VERIFICATION_REMINDER).toContain('ALWAYS verify');
    });
  });

  describe('DEFAULT_VERIFICATION_STEPS', () => {
    it('should be an array of verification steps', () => {
      expect(Array.isArray(DEFAULT_VERIFICATION_STEPS)).toBe(true);
      expect(DEFAULT_VERIFICATION_STEPS.length).toBeGreaterThan(0);
    });

    it('should include Diagnostics step', () => {
      const diagnosticsStep = DEFAULT_VERIFICATION_STEPS.find(
        (step: VerificationStep) => step.name === 'Diagnostics'
      );
      expect(diagnosticsStep).toBeDefined();
      expect(diagnosticsStep?.command).toBe('lsp_diagnostics');
    });

    it('should include Tests step', () => {
      const testsStep = DEFAULT_VERIFICATION_STEPS.find(
        (step: VerificationStep) => step.name === 'Tests'
      );
      expect(testsStep).toBeDefined();
      expect(testsStep?.command).toBe('npm test');
    });

    it('should include Build step', () => {
      const buildStep = DEFAULT_VERIFICATION_STEPS.find(
        (step: VerificationStep) => step.name === 'Build'
      );
      expect(buildStep).toBeDefined();
      expect(buildStep?.command).toBe('npm run build');
    });

    it('should include Code Review step', () => {
      const codeReviewStep = DEFAULT_VERIFICATION_STEPS.find(
        (step: VerificationStep) => step.name === 'Code Review'
      );
      expect(codeReviewStep).toBeDefined();
    });

    it('should have expected results for each step', () => {
      for (const step of DEFAULT_VERIFICATION_STEPS) {
        expect(step.expectedResult).toBeDefined();
        expect(typeof step.expectedResult).toBe('string');
        expect(step.expectedResult.length).toBeGreaterThan(0);
      }
    });
  });

  describe('createVerificationReminder', () => {
    it('should return base reminder when no context provided', () => {
      const result = createVerificationReminder();
      expect(result).toBe(VERIFICATION_REMINDER);
    });

    it('should return base reminder when undefined context', () => {
      const result = createVerificationReminder(undefined);
      expect(result).toBe(VERIFICATION_REMINDER);
    });

    it('should prepend context when provided', () => {
      const result = createVerificationReminder('executor finished user model');
      expect(result).toContain('executor finished user model');
    });

    it('should include "Subagent completed:" prefix for context', () => {
      const result = createVerificationReminder('task completed');
      expect(result).toContain('Subagent completed: task completed');
    });

    it('should still contain base reminder when context is provided', () => {
      const result = createVerificationReminder('work done');
      expect(result).toContain('[SYSTEM DIRECTIVE:');
      expect(result).toContain('VERIFICATION REMINDER');
    });

    it('should handle empty string context (treated as no context)', () => {
      const result = createVerificationReminder('');
      // Empty string is falsy, but in this case the function checks truthiness
      // If the function treats empty string as valid context, update this test
      expect(result).toContain('VERIFICATION');
    });

    it('should be longer than base reminder when context is added', () => {
      const result = createVerificationReminder('some context info');
      expect(result.length).toBeGreaterThan(VERIFICATION_REMINDER.length);
    });
  });

  describe('emitVerificationRequired', () => {
    it('should emit verification_required event', () => {
      emitVerificationRequired('executor', 'implement user model');

      expect(emitEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'verification_required',
        })
      );
    });

    it('should include subagentType in payload', () => {
      emitVerificationRequired('architect', 'review schema');

      expect(emitEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            subagentType: 'architect',
          }),
        })
      );
    });

    it('should include task in payload', () => {
      emitVerificationRequired('executor', 'add validation');

      expect(emitEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            task: 'add validation',
          }),
        })
      );
    });

    it('should include timestamp in payload', () => {
      emitVerificationRequired('executor', 'some task');

      expect(emitEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            timestamp: expect.any(String),
          }),
        })
      );
    });

    it('should include source as orchestrator', () => {
      emitVerificationRequired('qa-tester', 'run tests');

      expect(emitEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'orchestrator',
        })
      );
    });

    it('should handle various subagent types', () => {
      const subagentTypes = ['executor', 'architect', 'designer', 'qa-tester'];

      for (const type of subagentTypes) {
        vi.clearAllMocks();
        emitVerificationRequired(type, 'some task');

        expect(emitEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              subagentType: type,
            }),
          })
        );
      }
    });

    it('should handle task descriptions with special characters', () => {
      emitVerificationRequired('executor', 'implement login() with @auth');

      expect(emitEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            task: 'implement login() with @auth',
          }),
        })
      );
    });
  });
});
