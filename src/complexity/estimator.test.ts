/**
 * Complexity Estimator Tests
 */

import { describe, it, expect } from 'vitest';
import {
  estimateComplexity,
  getModelForComplexity,
  batchEstimate,
  COMPLEXITY_MODEL_MAP,
} from './index.js';

describe('estimateComplexity', () => {
  it('should reduce complexity for simple tasks with low complexity keywords', () => {
    const result = estimateComplexity({
      taskDescription: 'Fix typo in config file',
    });

    // "fix typo" and "config" are low complexity keywords
    // Base is 3, each keyword -0.5, so should be 2
    expect(result.complexity.level).toBeLessThanOrEqual(3);
    expect(result.recommendedModel).toBeDefined();
  });

  it('should estimate medium complexity for standard tasks', () => {
    const result = estimateComplexity({
      taskDescription: 'Add validation to user registration form',
      files: ['src/components/Form.tsx'],
    });

    // Single file reduces by 0.5, no high/low keywords match strongly
    expect(result.complexity.level).toBeGreaterThanOrEqual(2);
    expect(result.complexity.level).toBeLessThanOrEqual(4);
  });

  it('should estimate high complexity for refactoring tasks', () => {
    const result = estimateComplexity({
      taskDescription: 'Refactor authentication system to use JWT tokens',
      files: [
        'src/auth/index.ts',
        'src/auth/jwt.ts',
        'src/auth/middleware.ts',
        'src/auth/types.ts',
      ],
    });

    // "refactor" and "authentication" are high keywords, auth files add more
    expect(result.complexity.level).toBeGreaterThanOrEqual(4);
    expect(result.recommendedModel).toBe('opus');
  });

  it('should detect architecture keywords', () => {
    const result = estimateComplexity({
      taskDescription: 'Design new microservices architecture',
    });

    // "architecture" is a high complexity keyword
    expect(result.complexity.level).toBeGreaterThanOrEqual(3);
  });

  it('should account for file count', () => {
    const singleFile = estimateComplexity({
      taskDescription: 'Update function',
      files: ['src/utils.ts'],
    });

    const multiFile = estimateComplexity({
      taskDescription: 'Update function',
      files: ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts', 'src/e.ts'],
    });

    expect(multiFile.complexity.level).toBeGreaterThan(singleFile.complexity.level);
  });
});

describe('getModelForComplexity', () => {
  it('should return haiku for level 1-2', () => {
    expect(getModelForComplexity(1)).toBe('haiku');
    expect(getModelForComplexity(2)).toBe('haiku');
  });

  it('should return sonnet for level 3-4', () => {
    expect(getModelForComplexity(3)).toBe('sonnet');
    expect(getModelForComplexity(4)).toBe('sonnet');
  });

  it('should return opus for level 5', () => {
    expect(getModelForComplexity(5)).toBe('opus');
  });
});

describe('batchEstimate', () => {
  it('should estimate multiple tasks', () => {
    const tasks = [
      { name: 'task1', action: 'Fix typo' },
      { name: 'task2', action: 'Refactor authentication' },
      { name: 'task3', action: 'Add button' },
    ];

    const results = batchEstimate(tasks);

    expect(results.size).toBe(3);
    expect(results.has('task1')).toBe(true);
    expect(results.has('task2')).toBe(true);
    expect(results.has('task3')).toBe(true);
  });
});

describe('COMPLEXITY_MODEL_MAP', () => {
  it('should have mapping for all levels', () => {
    expect(COMPLEXITY_MODEL_MAP[1]).toBeDefined();
    expect(COMPLEXITY_MODEL_MAP[2]).toBeDefined();
    expect(COMPLEXITY_MODEL_MAP[3]).toBeDefined();
    expect(COMPLEXITY_MODEL_MAP[4]).toBeDefined();
    expect(COMPLEXITY_MODEL_MAP[5]).toBeDefined();
  });
});
