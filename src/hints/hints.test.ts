/**
 * Hints Module Tests
 */

import { describe, it, expect } from 'vitest';
import {
  suggestComplexity,
  quickSuggestComplexity,
  batchSuggestComplexity,
  suggestModelForComplexity,
  suggestRoute,
  quickSuggestRoute,
  suggestRouteFromComplexity,
  listCategories,
  getTaskHints,
} from './index.js';

describe('Complexity Hints', () => {
  describe('suggestComplexity', () => {
    it('should always return isHint: true', () => {
      const result = suggestComplexity({ taskDescription: 'Add a button' });

      expect(result.isHint).toBe(true);
    });

    it('should return valid complexity level (1-5)', () => {
      const result = suggestComplexity({ taskDescription: 'Refactor the entire architecture' });

      expect(result.level).toBeGreaterThanOrEqual(1);
      expect(result.level).toBeLessThanOrEqual(5);
    });

    it('should suggest higher complexity for refactoring keywords', () => {
      const simple = suggestComplexity({ taskDescription: 'Fix typo in README' });
      const complex = suggestComplexity({ taskDescription: 'Refactor authentication system' });

      expect(complex.level).toBeGreaterThan(simple.level);
    });

    it('should suggest lower complexity for simple keywords', () => {
      const result = suggestComplexity({ taskDescription: 'Update config constant' });

      expect(result.level).toBeLessThanOrEqual(3);
    });

    it('should include factors in the result', () => {
      const result = suggestComplexity({
        taskDescription: 'Migrate database schema',
        files: ['schema.ts', 'migrations/001.sql'],
      });

      expect(result.factors.length).toBeGreaterThan(0);
    });

    it('should have confidence < 1 (hints are uncertain)', () => {
      const result = suggestComplexity({ taskDescription: 'Add a function' });

      expect(result.confidence).toBeLessThan(1);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should include human-readable reason', () => {
      const result = suggestComplexity({ taskDescription: 'Update API endpoint' });

      expect(result.reason).toBeTruthy();
      expect(typeof result.reason).toBe('string');
    });

    it('should suggest model based on level', () => {
      const low = suggestComplexity({ taskDescription: 'Fix typo' });
      const high = suggestComplexity({ taskDescription: 'Refactor entire architecture' });

      expect(['haiku', 'sonnet', 'opus']).toContain(low.suggestedModel);
      expect(['haiku', 'sonnet', 'opus']).toContain(high.suggestedModel);
    });
  });

  describe('quickSuggestComplexity', () => {
    it('should return lower confidence than full estimate', () => {
      const full = suggestComplexity({ taskDescription: 'Add a feature' });
      const quick = quickSuggestComplexity('Add a feature');

      expect(quick.confidence).toBeLessThan(full.confidence);
    });

    it('should include "Quick estimate" in reason', () => {
      const result = quickSuggestComplexity('Update config');

      expect(result.reason).toContain('Quick estimate');
    });
  });

  describe('batchSuggestComplexity', () => {
    it('should process multiple tasks', () => {
      const tasks = [
        { name: 'task1', action: 'Add button' },
        { name: 'task2', action: 'Refactor module' },
      ];

      const results = batchSuggestComplexity(tasks);

      expect(results.size).toBe(2);
      expect(results.get('task1')?.isHint).toBe(true);
      expect(results.get('task2')?.isHint).toBe(true);
    });
  });

  describe('suggestModelForComplexity', () => {
    it('should always return isHint: true', () => {
      const result = suggestModelForComplexity(3);

      expect(result.isHint).toBe(true);
    });

    it('should suggest haiku for low complexity', () => {
      expect(suggestModelForComplexity(1).model).toBe('haiku');
      expect(suggestModelForComplexity(2).model).toBe('haiku');
    });

    it('should suggest sonnet for medium complexity', () => {
      expect(suggestModelForComplexity(3).model).toBe('sonnet');
      expect(suggestModelForComplexity(4).model).toBe('sonnet');
    });

    it('should suggest opus for high complexity', () => {
      expect(suggestModelForComplexity(5).model).toBe('opus');
    });
  });
});

describe('Routing Hints', () => {
  describe('suggestRoute', () => {
    it('should always return isHint: true', () => {
      const result = suggestRoute({ taskDescription: 'Find the login handler' });

      expect(result.isHint).toBe(true);
    });

    it('should detect quick category for lookup keywords', () => {
      const result = suggestRoute({ taskDescription: 'Find where the error is defined' });

      expect(result.category).toBe('quick');
    });

    it('should detect writing category for documentation', () => {
      const result = suggestRoute({
        taskDescription: 'Document the API',
        contextHints: { isDocumentation: true },
      });

      expect(result.category).toBe('writing');
    });

    it('should detect visual-engineering for UI work', () => {
      const result = suggestRoute({
        taskDescription: 'Create a button component',
        contextHints: { isUI: true },
      });

      expect(result.category).toBe('visual-engineering');
    });

    it('should detect ultrabrain for debugging', () => {
      const result = suggestRoute({
        taskDescription: 'Debug the race condition',
        contextHints: { isDebugging: true },
      });

      expect(result.category).toBe('ultrabrain');
    });

    it('should include alternatives', () => {
      const result = suggestRoute({ taskDescription: 'Add a new feature' });

      expect(result.alternatives).toBeDefined();
      expect(Array.isArray(result.alternatives)).toBe(true);
    });

    it('should have confidence < 1', () => {
      const result = suggestRoute({ taskDescription: 'Update the config' });

      expect(result.confidence).toBeLessThan(1);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should include suggestion message in reason', () => {
      const result = suggestRoute({ taskDescription: 'Implement feature' });

      expect(result.reason).toContain('suggestion');
    });
  });

  describe('quickSuggestRoute', () => {
    it('should return lower confidence', () => {
      const full = suggestRoute({ taskDescription: 'Add a feature' });
      const quick = quickSuggestRoute('Add a feature');

      expect(quick.confidence).toBeLessThan(full.confidence);
    });
  });

  describe('suggestRouteFromComplexity', () => {
    it('should map low complexity to quick', () => {
      const result = suggestRouteFromComplexity(1);

      expect(result.category).toBe('quick');
    });

    it('should map medium complexity to standard', () => {
      const result = suggestRouteFromComplexity(3);

      expect(result.category).toBe('standard');
    });

    it('should map high complexity to complex or ultrabrain', () => {
      const complex = suggestRouteFromComplexity(4);
      const ultra = suggestRouteFromComplexity(5);

      expect(complex.category).toBe('complex');
      expect(ultra.category).toBe('ultrabrain');
    });
  });

  describe('listCategories', () => {
    it('should list all categories', () => {
      const categories = listCategories();

      expect(categories.length).toBeGreaterThan(0);
      expect(categories.find(c => c.category === 'quick')).toBeDefined();
      expect(categories.find(c => c.category === 'standard')).toBeDefined();
      expect(categories.find(c => c.category === 'ultrabrain')).toBeDefined();
    });

    it('should include agent and model for each', () => {
      const categories = listCategories();

      for (const cat of categories) {
        expect(cat.agent).toBeTruthy();
        expect(['haiku', 'sonnet', 'opus']).toContain(cat.model);
      }
    });
  });
});

describe('Combined Hints', () => {
  describe('getTaskHints', () => {
    it('should return complexity, routing, and model hints', () => {
      const result = getTaskHints({ taskDescription: 'Implement new feature' });

      expect(result.complexity).toBeDefined();
      expect(result.complexity?.isHint).toBe(true);

      expect(result.routing).toBeDefined();
      expect(result.routing?.isHint).toBe(true);

      expect(result.model).toBeDefined();
      expect(result.model?.isHint).toBe(true);
    });

    it('should include helpful message', () => {
      const result = getTaskHints({ taskDescription: 'Add a button' });

      expect(result.message).toBeTruthy();
      expect(result.message).toContain('Ultra Planner Hints');
      expect(result.message).toContain('judgment');
    });

    it('should work with context hints', () => {
      const result = getTaskHints({
        taskDescription: 'Create login page',
        contextHints: { isUI: true },
      });

      expect(result.routing?.category).toBe('visual-engineering');
    });

    it('should work with file information', () => {
      const result = getTaskHints({
        taskDescription: 'Update schema',
        files: ['schema.ts', 'migrations/001.ts'],
      });

      expect(result.complexity?.factors).toBeDefined();
      expect(result.complexity!.factors.length).toBeGreaterThan(0);
    });
  });
});

describe('Hint Philosophy', () => {
  it('all hints should indicate they are suggestions', () => {
    const complexity = suggestComplexity({ taskDescription: 'test' });
    const routing = suggestRoute({ taskDescription: 'test' });
    const model = suggestModelForComplexity(3);

    // isHint should always be true
    expect(complexity.isHint).toBe(true);
    expect(routing.isHint).toBe(true);
    expect(model.isHint).toBe(true);

    // Confidence should never be 1.0 (certainty)
    expect(complexity.confidence).toBeLessThan(1);
    expect(routing.confidence).toBeLessThan(1);
  });

  it('reasons should encourage AI judgment', () => {
    const complexity = suggestComplexity({ taskDescription: 'Add feature' });
    const routing = suggestRoute({ taskDescription: 'Add feature' });

    // Reasons should mention suggestion/judgment
    expect(
      complexity.reason.toLowerCase().includes('suggestion') ||
      complexity.reason.toLowerCase().includes('judgment') ||
      complexity.reason.toLowerCase().includes('adjust')
    ).toBe(true);

    expect(
      routing.reason.toLowerCase().includes('suggestion') ||
      routing.reason.toLowerCase().includes('judgment') ||
      routing.reason.toLowerCase().includes('choose')
    ).toBe(true);
  });
});
