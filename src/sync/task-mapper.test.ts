/**
 * Task Mapper Tests
 *
 * Tests for converting TaskMapping objects to Claude Task tool invocations.
 * Verifies task invocation creation, dependency tracking, and utility functions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTaskInvocation,
  createTaskInvocations,
  determineSubagentType,
  getTaskIds,
  filterByWave,
  getReadyTasks,
  type TaskInvocation,
  type DependencyMap,
} from './task-mapper.js';
import type { TaskMapping } from './types.js';

// Helper to create test TaskMappings
function createTestMapping(overrides: Partial<TaskMapping> = {}): TaskMapping {
  return {
    task_id: '06-01-01',
    plan_path: '/test/plan.md',
    name: 'Test Task',
    type: 'auto',
    tool_params: {
      description: 'Test description',
      prompt: 'Test prompt',
      subagent_type: 'oh-my-claudecode:executor',
      model: 'sonnet',
    },
    status: 'pending',
    wave: 1,
    ...overrides,
  };
}

describe('createTaskInvocation', () => {
  it('should create invocation with all required fields', () => {
    const mapping = createTestMapping();
    const invocation = createTaskInvocation(mapping);

    expect(invocation.tool_name).toBe('Task');
    expect(invocation.tool_input).toEqual(mapping.tool_params);
    expect(invocation.task_id).toBe('06-01-01');
    expect(invocation.blocked_by).toEqual([]);
  });

  it('should set tool_name to Task', () => {
    const mapping = createTestMapping();
    const invocation = createTaskInvocation(mapping);

    expect(invocation.tool_name).toBe('Task');
  });

  it('should include tool_params from mapping', () => {
    const mapping = createTestMapping({
      tool_params: {
        description: 'Custom description',
        prompt: 'Custom prompt with detailed instructions',
        subagent_type: 'custom:agent',
        model: 'opus',
      },
    });

    const invocation = createTaskInvocation(mapping);

    expect(invocation.tool_input.description).toBe('Custom description');
    expect(invocation.tool_input.prompt).toContain('Custom prompt');
    expect(invocation.tool_input.subagent_type).toBe('custom:agent');
    expect(invocation.tool_input.model).toBe('opus');
  });

  it('should set blocked_by from parameter', () => {
    const mapping = createTestMapping();
    const blockedBy = ['06-01-01', '06-01-02'];

    const invocation = createTaskInvocation(mapping, blockedBy);

    expect(invocation.blocked_by).toEqual(blockedBy);
  });

  it('should default blocked_by to empty array', () => {
    const mapping = createTestMapping();
    const invocation = createTaskInvocation(mapping);

    expect(invocation.blocked_by).toEqual([]);
  });

  it('should preserve task_id for tracking', () => {
    const mapping = createTestMapping({ task_id: '22-02-03' });
    const invocation = createTaskInvocation(mapping);

    expect(invocation.task_id).toBe('22-02-03');
  });
});

describe('createTaskInvocations', () => {
  it('should create invocations for all mappings', () => {
    const mappings: TaskMapping[] = [
      createTestMapping({ task_id: '06-01-01' }),
      createTestMapping({ task_id: '06-01-02' }),
      createTestMapping({ task_id: '06-01-03' }),
    ];
    const depMap: DependencyMap = {};

    const invocations = createTaskInvocations(mappings, depMap);

    expect(invocations.length).toBe(3);
  });

  it('should sort by wave then task_id', () => {
    const mappings: TaskMapping[] = [
      createTestMapping({ task_id: '06-02-01', wave: 2 }),
      createTestMapping({ task_id: '06-01-02', wave: 1 }),
      createTestMapping({ task_id: '06-01-01', wave: 1 }),
    ];
    const depMap: DependencyMap = {};

    const invocations = createTaskInvocations(mappings, depMap);

    expect(invocations[0].task_id).toBe('06-01-01');
    expect(invocations[1].task_id).toBe('06-01-02');
    expect(invocations[2].task_id).toBe('06-02-01');
  });

  it('should apply dependency map to invocations', () => {
    const mappings: TaskMapping[] = [
      createTestMapping({ task_id: '06-01-01', wave: 1 }),
      createTestMapping({ task_id: '06-02-01', wave: 2 }),
    ];
    const depMap: DependencyMap = {
      '06-01-01': [],
      '06-02-01': ['06-01-01'],
    };

    const invocations = createTaskInvocations(mappings, depMap);

    expect(invocations[0].blocked_by).toEqual([]);
    expect(invocations[1].blocked_by).toEqual(['06-01-01']);
  });

  it('should handle missing dependency entries', () => {
    const mappings: TaskMapping[] = [
      createTestMapping({ task_id: '06-01-01', wave: 1 }),
    ];
    const depMap: DependencyMap = {}; // No entry for 06-01-01

    const invocations = createTaskInvocations(mappings, depMap);

    expect(invocations[0].blocked_by).toEqual([]);
  });

  it('should return deterministic ordering', () => {
    const mappings: TaskMapping[] = [
      createTestMapping({ task_id: '06-01-03', wave: 1 }),
      createTestMapping({ task_id: '06-01-01', wave: 1 }),
      createTestMapping({ task_id: '06-01-02', wave: 1 }),
    ];
    const depMap: DependencyMap = {};

    const invocations1 = createTaskInvocations(mappings, depMap);
    const invocations2 = createTaskInvocations(mappings, depMap);

    expect(invocations1.map((i) => i.task_id)).toEqual(invocations2.map((i) => i.task_id));
  });
});

describe('determineSubagentType', () => {
  it('should return executor for auto tasks', () => {
    const result = determineSubagentType('auto');
    expect(result).toBe('oh-my-claudecode:executor');
  });

  it('should return verifier for human-verify checkpoints', () => {
    const result = determineSubagentType('checkpoint:human-verify');
    expect(result).toBe('oh-my-claudecode:verifier');
  });

  it('should return architect for decision checkpoints', () => {
    const result = determineSubagentType('checkpoint:decision');
    expect(result).toBe('oh-my-claudecode:architect');
  });

  it('should return executor for human-action checkpoints', () => {
    const result = determineSubagentType('checkpoint:human-action');
    expect(result).toBe('oh-my-claudecode:executor');
  });

  it('should fall back to executor for unrecognized types', () => {
    const result = determineSubagentType('checkpoint:unknown' as any);
    expect(result).toBe('oh-my-claudecode:executor');
  });
});

describe('getTaskIds', () => {
  it('should extract task IDs from invocations', () => {
    const invocations: TaskInvocation[] = [
      { tool_name: 'Task', tool_input: {} as any, task_id: '06-01-01', blocked_by: [] },
      { tool_name: 'Task', tool_input: {} as any, task_id: '06-01-02', blocked_by: [] },
      { tool_name: 'Task', tool_input: {} as any, task_id: '06-02-01', blocked_by: [] },
    ];

    const ids = getTaskIds(invocations);

    expect(ids).toEqual(['06-01-01', '06-01-02', '06-02-01']);
  });

  it('should return empty array for no invocations', () => {
    const ids = getTaskIds([]);
    expect(ids).toEqual([]);
  });

  it('should preserve order', () => {
    const invocations: TaskInvocation[] = [
      { tool_name: 'Task', tool_input: {} as any, task_id: 'z-task', blocked_by: [] },
      { tool_name: 'Task', tool_input: {} as any, task_id: 'a-task', blocked_by: [] },
    ];

    const ids = getTaskIds(invocations);

    expect(ids).toEqual(['z-task', 'a-task']);
  });
});

describe('filterByWave', () => {
  const mappings: TaskMapping[] = [
    createTestMapping({ task_id: '06-01-01', wave: 1 }),
    createTestMapping({ task_id: '06-01-02', wave: 1 }),
    createTestMapping({ task_id: '06-02-01', wave: 2 }),
    createTestMapping({ task_id: '06-03-01', wave: 3 }),
  ];

  const invocations: TaskInvocation[] = mappings.map((m) => ({
    tool_name: 'Task' as const,
    tool_input: m.tool_params,
    task_id: m.task_id,
    blocked_by: [],
  }));

  it('should filter invocations by wave number', () => {
    const wave1 = filterByWave(invocations, mappings, 1);
    expect(wave1.length).toBe(2);
    expect(wave1.map((i) => i.task_id)).toContain('06-01-01');
    expect(wave1.map((i) => i.task_id)).toContain('06-01-02');
  });

  it('should return empty for wave with no tasks', () => {
    const wave99 = filterByWave(invocations, mappings, 99);
    expect(wave99).toEqual([]);
  });

  it('should return single task waves correctly', () => {
    const wave2 = filterByWave(invocations, mappings, 2);
    expect(wave2.length).toBe(1);
    expect(wave2[0].task_id).toBe('06-02-01');
  });
});

describe('getReadyTasks', () => {
  it('should return tasks with empty blocked_by', () => {
    const invocations: TaskInvocation[] = [
      { tool_name: 'Task', tool_input: {} as any, task_id: '06-01-01', blocked_by: [] },
      { tool_name: 'Task', tool_input: {} as any, task_id: '06-01-02', blocked_by: ['06-01-01'] },
    ];

    const ready = getReadyTasks(invocations);

    expect(ready.length).toBe(1);
    expect(ready[0].task_id).toBe('06-01-01');
  });

  it('should return all tasks if none have dependencies', () => {
    const invocations: TaskInvocation[] = [
      { tool_name: 'Task', tool_input: {} as any, task_id: '06-01-01', blocked_by: [] },
      { tool_name: 'Task', tool_input: {} as any, task_id: '06-01-02', blocked_by: [] },
    ];

    const ready = getReadyTasks(invocations);

    expect(ready.length).toBe(2);
  });

  it('should return empty if all tasks have dependencies', () => {
    const invocations: TaskInvocation[] = [
      { tool_name: 'Task', tool_input: {} as any, task_id: '06-02-01', blocked_by: ['06-01-01'] },
      { tool_name: 'Task', tool_input: {} as any, task_id: '06-02-02', blocked_by: ['06-01-01'] },
    ];

    const ready = getReadyTasks(invocations);

    expect(ready).toEqual([]);
  });
});

describe('TaskInvocation interface', () => {
  it('should have correct structure', () => {
    const invocation: TaskInvocation = {
      tool_name: 'Task',
      tool_input: {
        description: 'Test',
        prompt: 'Test prompt',
        subagent_type: 'test:agent',
      },
      task_id: '06-01-01',
      blocked_by: ['06-00-01'],
    };

    expect(invocation.tool_name).toBe('Task');
    expect(invocation.tool_input).toBeDefined();
    expect(invocation.task_id).toBeDefined();
    expect(Array.isArray(invocation.blocked_by)).toBe(true);
  });
});

describe('DependencyMap interface', () => {
  it('should map task_id to array of blocking task_ids', () => {
    const depMap: DependencyMap = {
      '06-02-01': ['06-01-01', '06-01-02'],
      '06-02-02': ['06-01-01', '06-01-02'],
      '06-01-01': [],
      '06-01-02': [],
    };

    expect(depMap['06-02-01']).toEqual(['06-01-01', '06-01-02']);
    expect(depMap['06-01-01']).toEqual([]);
  });
});

describe('Integration scenarios', () => {
  it('should handle full workflow from mappings to ready tasks', () => {
    const mappings: TaskMapping[] = [
      createTestMapping({ task_id: '06-01-01', wave: 1 }),
      createTestMapping({ task_id: '06-01-02', wave: 1 }),
      createTestMapping({ task_id: '06-02-01', wave: 2 }),
    ];

    const depMap: DependencyMap = {
      '06-01-01': [],
      '06-01-02': [],
      '06-02-01': ['06-01-01', '06-01-02'],
    };

    const invocations = createTaskInvocations(mappings, depMap);
    const ready = getReadyTasks(invocations);
    const wave1 = filterByWave(invocations, mappings, 1);

    // Wave 1 tasks should be ready
    expect(ready.length).toBe(2);
    expect(wave1.length).toBe(2);

    // Wave 2 task should be blocked
    const wave2Task = invocations.find((i) => i.task_id === '06-02-01');
    expect(wave2Task?.blocked_by.length).toBe(2);
  });
});
