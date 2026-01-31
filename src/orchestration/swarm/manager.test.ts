/**
 * Swarm Manager Tests - Simplified for Context Architect Pattern
 *
 * Tests configuration, worker generation, and prompt generation.
 * State management is delegated to Claude Code's Task API.
 */

import { describe, it, expect } from 'vitest';
import {
  createSwarmConfig,
  recommendWorkerCount,
  generateWorkerIds,
  generateWorkerPrompt,
  generateOrchestratorPrompt,
  estimateSwarmDuration,
  generateSessionId,
} from './manager.js';
import { DEFAULT_SWARM_CONFIG } from './types.js';

describe('Swarm Configuration', () => {
  describe('createSwarmConfig', () => {
    it('should return defaults when no options provided', () => {
      const config = createSwarmConfig();

      expect(config.maxWorkers).toBe(DEFAULT_SWARM_CONFIG.maxWorkers);
      expect(config.claimRetries).toBe(DEFAULT_SWARM_CONFIG.claimRetries);
    });

    it('should override defaults with provided options', () => {
      const config = createSwarmConfig({ maxWorkers: 3 });

      expect(config.maxWorkers).toBe(3);
      expect(config.claimRetries).toBe(DEFAULT_SWARM_CONFIG.claimRetries);
    });
  });

  describe('recommendWorkerCount', () => {
    it('should recommend 1 worker for 3 or fewer tasks', () => {
      expect(recommendWorkerCount(1)).toBe(1);
      expect(recommendWorkerCount(2)).toBe(1);
      expect(recommendWorkerCount(3)).toBe(1);
    });

    it('should recommend proportional workers for more tasks', () => {
      expect(recommendWorkerCount(6)).toBe(2);
      expect(recommendWorkerCount(9)).toBe(3);
    });

    it('should cap at max workers', () => {
      expect(recommendWorkerCount(100)).toBe(DEFAULT_SWARM_CONFIG.maxWorkers);
    });
  });

  describe('DEFAULT_SWARM_CONFIG', () => {
    it('should have default configuration', () => {
      expect(DEFAULT_SWARM_CONFIG.maxWorkers).toBe(5);
      expect(DEFAULT_SWARM_CONFIG.claimRetries).toBe(3);
      expect(DEFAULT_SWARM_CONFIG.workerTimeoutMs).toBe(300000);
      expect(DEFAULT_SWARM_CONFIG.autoReleaseStale).toBe(true);
    });
  });
});

describe('Worker Identity Generation', () => {
  describe('generateWorkerIds', () => {
    it('should generate requested number of workers', () => {
      const workers = generateWorkerIds(3);

      expect(workers.length).toBe(3);
    });

    it('should assign sequential indices', () => {
      const workers = generateWorkerIds(3);

      expect(workers[0].index).toBe(0);
      expect(workers[1].index).toBe(1);
      expect(workers[2].index).toBe(2);
    });

    it('should assign readable names', () => {
      const workers = generateWorkerIds(2);

      expect(workers[0].name).toBe('Worker-1');
      expect(workers[1].name).toBe('Worker-2');
    });

    it('should include session ID in worker IDs when provided', () => {
      const workers = generateWorkerIds(2, 'test-session');

      expect(workers[0].id).toContain('test-session');
      expect(workers[1].id).toContain('test-session');
    });
  });
});

describe('Prompt Generation', () => {
  describe('generateWorkerPrompt', () => {
    it('should include worker identity', () => {
      const prompt = generateWorkerPrompt({
        worker: { id: 'worker-1', name: 'Worker-1', index: 0 },
      });

      expect(prompt).toContain('Worker-1');
      expect(prompt).toContain('worker-1');
    });

    it('should include session ID when provided', () => {
      const prompt = generateWorkerPrompt({
        worker: { id: 'w1', name: 'W1', index: 0 },
        sessionId: 'session-123',
      });

      expect(prompt).toContain('session-123');
    });

    it('should include plan path when provided', () => {
      const prompt = generateWorkerPrompt({
        worker: { id: 'w1', name: 'W1', index: 0 },
        planPath: 'PLAN.md',
      });

      expect(prompt).toContain('PLAN.md');
    });

    it('should include TaskList/TaskUpdate instructions', () => {
      const prompt = generateWorkerPrompt({
        worker: { id: 'w1', name: 'W1', index: 0 },
      });

      expect(prompt).toContain('TaskList');
      expect(prompt).toContain('TaskUpdate');
    });

    it('should include learnings when provided', () => {
      const prompt = generateWorkerPrompt({
        worker: { id: 'w1', name: 'W1', index: 0 },
        learnings: 'Always validate input',
      });

      expect(prompt).toContain('Always validate input');
    });

    it('should include context when provided', () => {
      const prompt = generateWorkerPrompt({
        worker: { id: 'w1', name: 'W1', index: 0 },
        context: 'This is a TypeScript project',
      });

      expect(prompt).toContain('TypeScript project');
    });

    it('should include execution loop instructions', () => {
      const prompt = generateWorkerPrompt({
        worker: { id: 'w1', name: 'W1', index: 0 },
      });

      expect(prompt).toContain('Execution Loop');
      expect(prompt).toContain('pending');
      expect(prompt).toContain('owner');
      expect(prompt).toContain('completed');
    });

    it('should include claiming protocol', () => {
      const prompt = generateWorkerPrompt({
        worker: { id: 'w1', name: 'W1', index: 0 },
      });

      expect(prompt).toContain('Task Claiming Protocol');
      expect(prompt).toContain('Retry');
    });
  });

  describe('generateOrchestratorPrompt', () => {
    it('should include plan path and session', () => {
      const prompt = generateOrchestratorPrompt('PLAN.md', 'session-123', 3);

      expect(prompt).toContain('PLAN.md');
      expect(prompt).toContain('session-123');
    });

    it('should include worker count', () => {
      const prompt = generateOrchestratorPrompt('PLAN.md', 'session', 5);

      expect(prompt).toContain('5');
    });

    it('should include Task tool instructions', () => {
      const prompt = generateOrchestratorPrompt('PLAN.md', 'session', 3);

      expect(prompt).toContain('Task(');
      expect(prompt).toContain('run_in_background');
    });

    it('should include monitoring instructions', () => {
      const prompt = generateOrchestratorPrompt('PLAN.md', 'session', 3);

      expect(prompt).toContain('Monitor');
      expect(prompt).toContain('TaskList');
    });
  });
});

describe('Utility Functions', () => {
  describe('estimateSwarmDuration', () => {
    it('should estimate duration for single worker', () => {
      const result = estimateSwarmDuration(10, 1, 5);

      expect(result.estimatedMinutes).toBe(50);
      expect(result.parallel).toBe(false);
    });

    it('should estimate reduced duration for multiple workers', () => {
      const result = estimateSwarmDuration(10, 5, 5);

      expect(result.estimatedMinutes).toBe(10);
      expect(result.parallel).toBe(true);
    });
  });

  describe('generateSessionId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();

      expect(id1).not.toBe(id2);
    });

    it('should start with "swarm-"', () => {
      const id = generateSessionId();

      expect(id).toMatch(/^swarm-/);
    });
  });
});
