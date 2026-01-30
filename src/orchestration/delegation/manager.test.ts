/**
 * Delegation Manager Tests
 */

import { describe, it, expect } from 'vitest';
import {
  detectCategory,
  categoryFromComplexity,
  getCategoryConfig,
  getAgentForCategory,
  routeTask,
  routeByComplexity,
  listCategories,
  getModelForCategory,
  needsHighTierModel,
  generateExecutorLoopPrompt,
  generateHeartbeatProtocol,
} from './manager.js';
import { DELEGATION_CATEGORIES, CATEGORY_AGENTS } from './types.js';

describe('Delegation Manager', () => {
  describe('detectCategory', () => {
    it('should detect quick category', () => {
      expect(detectCategory('Find the user model')).toBe('quick');
      expect(detectCategory('Where is the config?')).toBe('quick');
      expect(detectCategory('Show me the routes')).toBe('quick');
    });

    it('should detect standard category', () => {
      expect(detectCategory('Add validation to form')).toBe('standard');
      expect(detectCategory('Create user API endpoint')).toBe('standard');
      expect(detectCategory('Implement login feature')).toBe('standard');
    });

    it('should detect complex category', () => {
      expect(detectCategory('Refactor authentication module')).toBe('complex');
      expect(detectCategory('Migrate to new database schema')).toBe('complex');
      expect(detectCategory('Restructure the codebase')).toBe('complex');
    });

    it('should detect ultrabrain category', () => {
      expect(detectCategory('Debug the race condition')).toBe('ultrabrain');
      expect(detectCategory('Investigate memory leak')).toBe('ultrabrain');
      expect(detectCategory('Architect the new system')).toBe('ultrabrain');
      expect(detectCategory('Why is this failing?')).toBe('ultrabrain');
    });

    it('should detect visual-engineering category', () => {
      expect(detectCategory('Create UI component')).toBe('visual-engineering');
      expect(detectCategory('Design the layout')).toBe('visual-engineering');
      expect(detectCategory('Style the dashboard')).toBe('visual-engineering');
    });

    it('should detect artistry category', () => {
      expect(detectCategory('Brainstorm new features')).toBe('artistry');
      expect(detectCategory('Creative solutions needed')).toBe('artistry');
      expect(detectCategory('Explore alternatives')).toBe('artistry');
    });

    it('should detect writing category', () => {
      expect(detectCategory('Document the API')).toBe('writing');
      expect(detectCategory('Write README file')).toBe('writing');
      // Note: "Add comments" has both "add" (standard) and "comment" (writing)
      // The scoring system picks the highest score
      expect(detectCategory('Explain this function in comments')).toBe('writing');
    });

    it('should default to standard for ambiguous tasks', () => {
      expect(detectCategory('do something')).toBe('standard');
    });
  });

  describe('categoryFromComplexity', () => {
    it('should map complexity levels to categories', () => {
      expect(categoryFromComplexity(1)).toBe('quick');
      expect(categoryFromComplexity(2)).toBe('standard');
      expect(categoryFromComplexity(3)).toBe('standard');
      expect(categoryFromComplexity(4)).toBe('complex');
      expect(categoryFromComplexity(5)).toBe('ultrabrain');
    });
  });

  describe('getCategoryConfig', () => {
    it('should return config for each category', () => {
      const quickConfig = getCategoryConfig('quick');
      expect(quickConfig.model.tier).toBe('haiku');
      expect(quickConfig.model.temperature).toBe(0.1);

      const ultrabrainConfig = getCategoryConfig('ultrabrain');
      expect(ultrabrainConfig.model.tier).toBe('opus');
      expect(ultrabrainConfig.model.thinkingBudget).toBe('max');
    });
  });

  describe('getAgentForCategory', () => {
    it('should return agent recommendation', () => {
      expect(getAgentForCategory('quick').agent).toBe('explore');
      expect(getAgentForCategory('standard').agent).toBe('executor');
      expect(getAgentForCategory('complex').agent).toBe('executor-high');
      expect(getAgentForCategory('ultrabrain').agent).toBe('architect');
      expect(getAgentForCategory('visual-engineering').agent).toBe('designer-high');
      expect(getAgentForCategory('writing').agent).toBe('writer');
    });
  });

  describe('routeTask', () => {
    it('should route based on description', () => {
      const result = routeTask('Find the user model');

      expect(result.category).toBe('quick');
      expect(result.agent).toBe('explore');
      expect(result.model).toBe('haiku');
    });

    it('should use preferred category', () => {
      const result = routeTask('Some task', {
        preferredCategory: 'ultrabrain',
      });

      expect(result.category).toBe('ultrabrain');
      expect(result.model).toBe('opus');
    });

    it('should force model when specified', () => {
      const result = routeTask('Simple task', {
        forceModel: 'opus',
      });

      expect(result.model).toBe('opus');
    });

    it('should use context hints', () => {
      const uiResult = routeTask('Some task', {
        contextHints: { isUI: true },
      });
      expect(uiResult.category).toBe('visual-engineering');

      const docResult = routeTask('Some task', {
        contextHints: { isDocumentation: true },
      });
      expect(docResult.category).toBe('writing');

      const debugResult = routeTask('Some task', {
        contextHints: { isDebugging: true },
      });
      expect(debugResult.category).toBe('ultrabrain');
    });
  });

  describe('routeByComplexity', () => {
    it('should route based on complexity estimation', () => {
      // "Fix typo" reduces score but base is 3, so around 2-3
      const simple = routeByComplexity('Fix typo in simple config');
      expect(simple.complexity).toBeLessThanOrEqual(3);

      // Complex refactoring with auth files should be 4+
      const complex = routeByComplexity('Refactor authentication system', [
        'src/auth/index.ts',
        'src/auth/jwt.ts',
        'src/auth/middleware.ts',
        'src/auth/types.ts',
      ]);
      expect(complex.complexity).toBeGreaterThanOrEqual(4);
    });
  });

  describe('listCategories', () => {
    it('should list all categories', () => {
      const categories = listCategories();

      expect(categories.length).toBe(7);
      expect(categories.map(c => c.category)).toContain('quick');
      expect(categories.map(c => c.category)).toContain('standard');
      expect(categories.map(c => c.category)).toContain('complex');
      expect(categories.map(c => c.category)).toContain('ultrabrain');
      expect(categories.map(c => c.category)).toContain('visual-engineering');
      expect(categories.map(c => c.category)).toContain('artistry');
      expect(categories.map(c => c.category)).toContain('writing');
    });
  });

  describe('getModelForCategory', () => {
    it('should return model for category', () => {
      expect(getModelForCategory('quick')).toBe('haiku');
      expect(getModelForCategory('standard')).toBe('sonnet');
      expect(getModelForCategory('complex')).toBe('opus');
      expect(getModelForCategory('ultrabrain')).toBe('opus');
    });
  });

  describe('needsHighTierModel', () => {
    it('should detect when high tier is needed', () => {
      expect(needsHighTierModel('Debug the race condition')).toBe(true);
      expect(needsHighTierModel('Refactor the system')).toBe(true);
      expect(needsHighTierModel('Find the file')).toBe(false);
      expect(needsHighTierModel('Add a function')).toBe(false);
    });
  });

  describe('generateExecutorLoopPrompt', () => {
    it('should generate executor loop prompt', () => {
      const prompt = generateExecutorLoopPrompt({
        workerId: 'worker-1',
        sessionId: 'session-123',
        planPath: 'PLAN.md',
      });

      expect(prompt).toContain('Autonomous Executor Loop');
      expect(prompt).toContain('worker-1');
      expect(prompt).toContain('session-123');
      expect(prompt).toContain('PLAN.md');
      expect(prompt).toContain('TaskList');
      expect(prompt).toContain('TaskUpdate');
    });

    it('should include learnings when provided', () => {
      const prompt = generateExecutorLoopPrompt({
        learnings: 'Use async/await for database calls',
      });

      expect(prompt).toContain('Relevant Learnings');
      expect(prompt).toContain('async/await');
    });
  });

  describe('generateHeartbeatProtocol', () => {
    it('should generate heartbeat protocol', () => {
      const protocol = generateHeartbeatProtocol();

      expect(protocol).toContain('Heartbeat Protocol');
      expect(protocol).toContain('30 seconds');
      expect(protocol).toContain('TaskUpdate');
    });
  });
});
