/**
 * Prompts Module Tests
 */

import { describe, it, expect } from 'vitest';
import {
  generateWorkerPrompt,
  generateWorkerPromptString,
  generateOrchestratorPrompt,
  generateOrchestratorPromptString,
  generateExecutorLoopPrompt,
  generateExecutorLoopPromptString,
  generateHeartbeatProtocol,
} from './index.js';

describe('Worker Prompts', () => {
  it('should generate worker prompt with all fields', () => {
    const result = generateWorkerPrompt({
      worker: { id: 'worker-1', name: 'Worker-1', index: 0 },
      sessionId: 'session-123',
      planPath: 'PLAN.md',
      learnings: 'Use async/await for DB calls',
    });

    expect(result.prompt).toContain('Worker-1');
    expect(result.prompt).toContain('worker-1');
    expect(result.prompt).toContain('session-123');
    expect(result.prompt).toContain('PLAN.md');
    expect(result.prompt).toContain('Use async/await for DB calls');
    expect(result.modelHint).toBeDefined();
    expect(result.modelHint?.isHint).toBe(true);
  });

  it('should include TaskList/TaskUpdate instructions', () => {
    const result = generateWorkerPrompt({
      worker: { id: 'w1', name: 'W1', index: 0 },
    });

    expect(result.prompt).toContain('TaskList');
    expect(result.prompt).toContain('TaskUpdate');
  });

  it('should include plan change detection protocol', () => {
    const result = generateWorkerPrompt({
      worker: { id: 'w1', name: 'W1', index: 0 },
    });

    expect(result.prompt).toContain('Plan Change Detection');
    expect(result.prompt).toContain('PLAN.md');
  });

  it('should include model selection guide', () => {
    const result = generateWorkerPrompt({
      worker: { id: 'w1', name: 'W1', index: 0 },
    });

    expect(result.prompt).toContain('Model Selection');
    expect(result.prompt).toContain('Haiku');
    expect(result.prompt).toContain('Sonnet');
    expect(result.prompt).toContain('Opus');
  });

  it('should include decision recording instructions', () => {
    const result = generateWorkerPrompt({
      worker: { id: 'w1', name: 'W1', index: 0 },
    });

    expect(result.prompt).toContain('add_decision');
    expect(result.prompt).toContain('add_learning');
  });

  it('should return string for backward compatibility', () => {
    const result = generateWorkerPromptString({
      worker: { id: 'w1', name: 'W1', index: 0 },
    });

    expect(typeof result).toBe('string');
    expect(result).toContain('W1');
  });
});

describe('Orchestrator Prompts', () => {
  it('should generate orchestrator prompt with all fields', () => {
    const result = generateOrchestratorPrompt({
      planPath: 'PLAN.md',
      workerCount: 5,
      sessionId: 'session-123',
    });

    expect(result.prompt).toContain('PLAN.md');
    expect(result.prompt).toContain('5');
    expect(result.prompt).toContain('session-123');
    expect(result.modelHint).toBeDefined();
  });

  it('should include worker spawning instructions', () => {
    const result = generateOrchestratorPrompt({
      planPath: 'PLAN.md',
      workerCount: 3,
    });

    expect(result.prompt).toContain('Spawn');
    expect(result.prompt).toContain('Task(');
    expect(result.prompt).toContain('run_in_background');
  });

  it('should include monitoring protocol', () => {
    const result = generateOrchestratorPrompt({
      planPath: 'PLAN.md',
      workerCount: 3,
    });

    expect(result.prompt).toContain('Monitor');
    expect(result.prompt).toContain('TaskList');
    expect(result.prompt).toContain('progress');
  });

  it('should include plan change detection', () => {
    const result = generateOrchestratorPrompt({
      planPath: 'PLAN.md',
      workerCount: 3,
    });

    expect(result.prompt).toContain('Plan Change');
    expect(result.prompt).toContain('TaskCreate');
  });

  it('should return string for backward compatibility', () => {
    const result = generateOrchestratorPromptString('PLAN.md', 'session', 3);

    expect(typeof result).toBe('string');
    expect(result).toContain('PLAN.md');
  });
});

describe('Executor Loop Prompts', () => {
  it('should generate executor loop prompt', () => {
    const result = generateExecutorLoopPrompt({
      workerId: 'executor-1',
      sessionId: 'session-123',
      planPath: 'PLAN.md',
    });

    expect(result.prompt).toContain('executor-1');
    expect(result.prompt).toContain('session-123');
    expect(result.prompt).toContain('PLAN.md');
    expect(result.prompt).toContain('Autonomous Executor Loop');
  });

  it('should include claiming protocol', () => {
    const result = generateExecutorLoopPrompt({});

    expect(result.prompt).toContain('CLAIM');
    expect(result.prompt).toContain('TaskUpdate');
    expect(result.prompt).toContain('owner');
  });

  it('should include verification step', () => {
    const result = generateExecutorLoopPrompt({});

    expect(result.prompt).toContain('VERIFY');
    expect(result.prompt).toContain('PLAN.md');
  });

  it('should include learnings if provided', () => {
    const result = generateExecutorLoopPrompt({
      learnings: 'Always validate input',
    });

    expect(result.prompt).toContain('Always validate input');
  });

  it('should return string for backward compatibility', () => {
    const result = generateExecutorLoopPromptString({
      workerId: 'e1',
    });

    expect(typeof result).toBe('string');
    expect(result).toContain('e1');
  });
});

describe('Heartbeat Protocol', () => {
  it('should generate heartbeat protocol', () => {
    const protocol = generateHeartbeatProtocol();

    expect(protocol).toContain('Heartbeat');
    expect(protocol).toContain('30 seconds');
    expect(protocol).toContain('TaskUpdate');
  });
});

describe('Model Hints', () => {
  it('should suggest opus for complex context', () => {
    const result = generateWorkerPrompt({
      worker: { id: 'w1', name: 'W1', index: 0 },
      context: {
        wisdom: 'This involves refactoring the architecture',
      },
    });

    expect(result.modelHint?.tier).toBe('opus');
    expect(result.modelHint?.isHint).toBe(true);
  });

  it('should suggest sonnet by default', () => {
    const result = generateWorkerPrompt({
      worker: { id: 'w1', name: 'W1', index: 0 },
    });

    expect(result.modelHint?.tier).toBe('sonnet');
  });

  it('should always mark as hint', () => {
    const result = generateWorkerPrompt({
      worker: { id: 'w1', name: 'W1', index: 0 },
    });

    expect(result.modelHint?.isHint).toBe(true);
  });
});
