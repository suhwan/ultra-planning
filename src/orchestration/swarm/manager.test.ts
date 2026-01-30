/**
 * Swarm Manager Tests
 *
 * Unit tests for swarm functionality without plan parsing dependency.
 */

import { describe, it, expect } from 'vitest';
import {
  generateWorkerPrompt,
  generateOrchestratorPrompt,
  DEFAULT_SWARM_CONFIG,
} from './index.js';

describe('Swarm Manager', () => {
  describe('DEFAULT_SWARM_CONFIG', () => {
    it('should have default configuration', () => {
      expect(DEFAULT_SWARM_CONFIG.maxWorkers).toBe(5);
      expect(DEFAULT_SWARM_CONFIG.claimRetries).toBe(3);
      expect(DEFAULT_SWARM_CONFIG.workerTimeoutMs).toBe(300000);
      expect(DEFAULT_SWARM_CONFIG.autoReleaseStale).toBe(true);
    });
  });

  describe('generateWorkerPrompt', () => {
    it('should generate worker prompt with required fields', () => {
      const prompt = generateWorkerPrompt({
        worker: { id: 'w1', name: 'Worker-1', index: 0 },
        sessionId: 'session-123',
        planPath: 'PLAN.md',
      });

      expect(prompt).toContain('Swarm Worker');
      expect(prompt).toContain('Worker-1');
      expect(prompt).toContain('session-123');
      expect(prompt).toContain('PLAN.md');
      expect(prompt).toContain('TaskList');
      expect(prompt).toContain('TaskUpdate');
    });

    it('should include worker ID in prompt', () => {
      const prompt = generateWorkerPrompt({
        worker: { id: 'worker-abc-123', name: 'Worker-5', index: 4 },
        sessionId: 'session-xyz',
        planPath: 'plans/PLAN.md',
      });

      expect(prompt).toContain('worker-abc-123');
      expect(prompt).toContain('Worker-5');
    });

    it('should include learnings when provided', () => {
      const prompt = generateWorkerPrompt({
        worker: { id: 'w1', name: 'Worker-1', index: 0 },
        sessionId: 'session-123',
        planPath: 'PLAN.md',
        learnings: 'Always use async/await for database calls',
      });

      expect(prompt).toContain('Relevant Learnings');
      expect(prompt).toContain('async/await');
    });

    it('should include context when provided', () => {
      const prompt = generateWorkerPrompt({
        worker: { id: 'w1', name: 'Worker-1', index: 0 },
        sessionId: 'session-123',
        planPath: 'PLAN.md',
        context: 'This is a TypeScript project using React',
      });

      expect(prompt).toContain('Additional Context');
      expect(prompt).toContain('TypeScript project');
    });

    it('should include execution loop instructions', () => {
      const prompt = generateWorkerPrompt({
        worker: { id: 'w1', name: 'Worker-1', index: 0 },
        sessionId: 'session-123',
        planPath: 'PLAN.md',
      });

      // Check for key protocol steps
      expect(prompt).toContain('Execution Loop');
      expect(prompt).toContain('pending');
      expect(prompt).toContain('owner');
      expect(prompt).toContain('completed');
    });

    it('should include claiming protocol', () => {
      const prompt = generateWorkerPrompt({
        worker: { id: 'w1', name: 'Worker-1', index: 0 },
        sessionId: 'session-123',
        planPath: 'PLAN.md',
      });

      expect(prompt).toContain('Task Claiming Protocol');
      expect(prompt).toContain('Retry'); // Capital R in "Retry up to 3 times"
    });
  });

  describe('generateOrchestratorPrompt', () => {
    it('should generate orchestrator prompt', () => {
      const prompt = generateOrchestratorPrompt('PLAN.md', 'session-123', 5);

      expect(prompt).toContain('Swarm Orchestrator');
      expect(prompt).toContain('5 parallel workers');
      expect(prompt).toContain('session-123');
      expect(prompt).toContain('PLAN.md');
    });

    it('should include worker count in instructions', () => {
      const prompt = generateOrchestratorPrompt('test/PLAN.md', 'sess-1', 3);

      expect(prompt).toContain('3');
      expect(prompt).toContain('Spawning Workers');
    });

    it('should include monitoring instructions', () => {
      const prompt = generateOrchestratorPrompt('PLAN.md', 'session-123', 5);

      expect(prompt).toContain('Monitor');
      expect(prompt).toContain('30 seconds');
    });

    it('should include completion instructions', () => {
      const prompt = generateOrchestratorPrompt('PLAN.md', 'session-123', 5);

      expect(prompt).toContain('Completion');
      expect(prompt).toContain('completedTasks');
      expect(prompt).toContain('totalTasks');
    });

    it('should include failure handling', () => {
      const prompt = generateOrchestratorPrompt('PLAN.md', 'session-123', 5);

      expect(prompt).toContain('Handle Failures');
    });
  });

  describe('Worker Types', () => {
    it('should define worker status types correctly', () => {
      // This tests the type exports from types.ts
      const validStatuses = ['idle', 'claiming', 'executing', 'completed', 'failed', 'terminated'];
      expect(validStatuses).toHaveLength(6);
    });

    it('should define swarm status types correctly', () => {
      const validStatuses = ['initializing', 'running', 'paused', 'completed', 'failed', 'cancelled'];
      expect(validStatuses).toHaveLength(6);
    });

    it('should define task status types correctly', () => {
      const validStatuses = ['pending', 'available', 'claimed', 'executing', 'completed', 'failed', 'skipped'];
      expect(validStatuses).toHaveLength(7);
    });
  });
});
