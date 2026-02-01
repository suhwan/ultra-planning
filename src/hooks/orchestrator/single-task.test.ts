/**
 * Single Task Hook Tests
 *
 * Tests for the single-task directive that instructs subagents
 * to refuse multi-task requests.
 */

import { describe, it, expect } from 'vitest';
import {
  SINGLE_TASK_DIRECTIVE,
  createSingleTaskDirective,
} from './single-task.js';

describe('Single Task Hook', () => {
  describe('SINGLE_TASK_DIRECTIVE constant', () => {
    it('should contain SYSTEM DIRECTIVE prefix', () => {
      expect(SINGLE_TASK_DIRECTIVE).toContain('[SYSTEM DIRECTIVE:');
    });

    it('should contain SINGLE TASK ONLY type', () => {
      expect(SINGLE_TASK_DIRECTIVE).toContain('SINGLE TASK ONLY');
    });

    it('should instruct to refuse multi-task requests', () => {
      expect(SINGLE_TASK_DIRECTIVE).toContain('REFUSE');
    });

    it('should instruct to demand single-task clarity', () => {
      expect(SINGLE_TASK_DIRECTIVE).toContain('DEMAND');
    });

    it('should contain atomic task reference', () => {
      expect(SINGLE_TASK_DIRECTIVE).toContain('atomic task');
    });

    it('should provide a template response for rejection', () => {
      expect(SINGLE_TASK_DIRECTIVE).toContain('I refuse to proceed');
    });

    it('should emphasize single-task requirement', () => {
      expect(SINGLE_TASK_DIRECTIVE).toContain('ONE');
    });

    it('should mention single file/change/verification', () => {
      expect(SINGLE_TASK_DIRECTIVE).toContain('One file');
      expect(SINGLE_TASK_DIRECTIVE).toContain('One change');
      expect(SINGLE_TASK_DIRECTIVE).toContain('One verification');
    });
  });

  describe('createSingleTaskDirective', () => {
    it('should return base directive when no task description provided', () => {
      const result = createSingleTaskDirective();
      expect(result).toBe(SINGLE_TASK_DIRECTIVE);
    });

    it('should return base directive when undefined task description', () => {
      const result = createSingleTaskDirective(undefined);
      expect(result).toBe(SINGLE_TASK_DIRECTIVE);
    });

    it('should append task description when provided', () => {
      const result = createSingleTaskDirective('Implement the login API endpoint');
      expect(result).toContain('Implement the login API endpoint');
    });

    it('should include "Your single task:" prefix for task description', () => {
      const result = createSingleTaskDirective('Create user model');
      expect(result).toContain('Your single task: Create user model');
    });

    it('should still contain base directive when task description is provided', () => {
      const result = createSingleTaskDirective('Fix the bug');
      expect(result).toContain('[SYSTEM DIRECTIVE:');
      expect(result).toContain('SINGLE TASK ONLY');
    });

    it('should handle empty string task description', () => {
      const result = createSingleTaskDirective('');
      // Empty string is falsy, so should return base directive
      expect(result).toBe(SINGLE_TASK_DIRECTIVE);
    });

    it('should handle task description with special characters', () => {
      const taskWithSpecialChars = 'Implement login() with @decorator and $variable';
      const result = createSingleTaskDirective(taskWithSpecialChars);
      expect(result).toContain(taskWithSpecialChars);
    });

    it('should handle multi-line task description', () => {
      const multilineTask = 'Task line 1\nTask line 2';
      const result = createSingleTaskDirective(multilineTask);
      expect(result).toContain(multilineTask);
    });

    it('should be longer than base directive when task is appended', () => {
      const result = createSingleTaskDirective('Add validation logic');
      expect(result.length).toBeGreaterThan(SINGLE_TASK_DIRECTIVE.length);
    });
  });
});
