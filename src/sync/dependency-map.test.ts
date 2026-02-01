/**
 * Dependency Map Tests
 *
 * Tests for dependency mapper that converts wave numbers to blockedBy dependencies.
 * Verifies proper task ordering based on wave-based parallelization strategy.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildDependencyMap,
  mapWaveToBlockedBy,
  getExecutionOrder,
  getWaves,
  getTasksInWave,
  hasDependencies,
  getReadyTasks,
  type DependencyMap,
} from './dependency-map.js';
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

describe('buildDependencyMap', () => {
  it('should create graph from mappings', () => {
    const mappings: TaskMapping[] = [
      createTestMapping({ task_id: '06-01-01', wave: 1 }),
      createTestMapping({ task_id: '06-01-02', wave: 1 }),
      createTestMapping({ task_id: '06-02-01', wave: 2 }),
    ];

    const depMap = buildDependencyMap(mappings);

    expect(depMap).toBeDefined();
    expect(Object.keys(depMap).length).toBe(3);
  });

  it('should have no dependencies for wave 1 tasks', () => {
    const mappings: TaskMapping[] = [
      createTestMapping({ task_id: '06-01-01', wave: 1 }),
      createTestMapping({ task_id: '06-01-02', wave: 1 }),
    ];

    const depMap = buildDependencyMap(mappings);

    expect(depMap['06-01-01']).toEqual([]);
    expect(depMap['06-01-02']).toEqual([]);
  });

  it('should have wave 1 as dependencies for wave 2 tasks', () => {
    const mappings: TaskMapping[] = [
      createTestMapping({ task_id: '06-01-01', wave: 1 }),
      createTestMapping({ task_id: '06-01-02', wave: 1 }),
      createTestMapping({ task_id: '06-02-01', wave: 2 }),
    ];

    const depMap = buildDependencyMap(mappings);

    expect(depMap['06-02-01']).toContain('06-01-01');
    expect(depMap['06-02-01']).toContain('06-01-02');
    expect(depMap['06-02-01'].length).toBe(2);
  });

  it('should have waves 1 and 2 as dependencies for wave 3 tasks', () => {
    const mappings: TaskMapping[] = [
      createTestMapping({ task_id: '06-01-01', wave: 1 }),
      createTestMapping({ task_id: '06-02-01', wave: 2 }),
      createTestMapping({ task_id: '06-03-01', wave: 3 }),
    ];

    const depMap = buildDependencyMap(mappings);

    expect(depMap['06-03-01']).toContain('06-01-01');
    expect(depMap['06-03-01']).toContain('06-02-01');
    expect(depMap['06-03-01'].length).toBe(2);
  });

  it('should handle empty mappings', () => {
    const depMap = buildDependencyMap([]);
    expect(depMap).toEqual({});
  });

  it('should handle single task', () => {
    const mappings: TaskMapping[] = [createTestMapping({ task_id: '06-01-01', wave: 1 })];

    const depMap = buildDependencyMap(mappings);

    expect(depMap['06-01-01']).toEqual([]);
  });

  it('should handle non-consecutive wave numbers', () => {
    const mappings: TaskMapping[] = [
      createTestMapping({ task_id: '06-01-01', wave: 1 }),
      createTestMapping({ task_id: '06-03-01', wave: 3 }), // Skip wave 2
    ];

    const depMap = buildDependencyMap(mappings);

    expect(depMap['06-01-01']).toEqual([]);
    expect(depMap['06-03-01']).toContain('06-01-01');
  });
});

describe('mapWaveToBlockedBy', () => {
  const mappings: TaskMapping[] = [
    createTestMapping({ task_id: '06-01-01', wave: 1 }),
    createTestMapping({ task_id: '06-01-02', wave: 1 }),
    createTestMapping({ task_id: '06-02-01', wave: 2 }),
    createTestMapping({ task_id: '06-03-01', wave: 3 }),
  ];

  it('should return empty array for wave 1', () => {
    const blockers = mapWaveToBlockedBy(1, mappings);
    expect(blockers).toEqual([]);
  });

  it('should return wave 1 tasks for wave 2', () => {
    const blockers = mapWaveToBlockedBy(2, mappings);
    expect(blockers).toContain('06-01-01');
    expect(blockers).toContain('06-01-02');
    expect(blockers.length).toBe(2);
  });

  it('should return waves 1 and 2 tasks for wave 3', () => {
    const blockers = mapWaveToBlockedBy(3, mappings);
    expect(blockers).toContain('06-01-01');
    expect(blockers).toContain('06-01-02');
    expect(blockers).toContain('06-02-01');
    expect(blockers.length).toBe(3);
  });

  it('should return all tasks for wave beyond existing', () => {
    const blockers = mapWaveToBlockedBy(10, mappings);
    expect(blockers.length).toBe(4);
  });
});

describe('getExecutionOrder', () => {
  it('should sort by wave number', () => {
    const mappings: TaskMapping[] = [
      createTestMapping({ task_id: '06-03-01', wave: 3 }),
      createTestMapping({ task_id: '06-01-01', wave: 1 }),
      createTestMapping({ task_id: '06-02-01', wave: 2 }),
    ];

    const ordered = getExecutionOrder(mappings);

    expect(ordered[0].task_id).toBe('06-01-01');
    expect(ordered[1].task_id).toBe('06-02-01');
    expect(ordered[2].task_id).toBe('06-03-01');
  });

  it('should sort by task_id within same wave', () => {
    const mappings: TaskMapping[] = [
      createTestMapping({ task_id: '06-01-03', wave: 1 }),
      createTestMapping({ task_id: '06-01-01', wave: 1 }),
      createTestMapping({ task_id: '06-01-02', wave: 1 }),
    ];

    const ordered = getExecutionOrder(mappings);

    expect(ordered[0].task_id).toBe('06-01-01');
    expect(ordered[1].task_id).toBe('06-01-02');
    expect(ordered[2].task_id).toBe('06-01-03');
  });

  it('should not mutate original array', () => {
    const mappings: TaskMapping[] = [
      createTestMapping({ task_id: '06-02-01', wave: 2 }),
      createTestMapping({ task_id: '06-01-01', wave: 1 }),
    ];

    const originalFirst = mappings[0].task_id;
    getExecutionOrder(mappings);

    expect(mappings[0].task_id).toBe(originalFirst);
  });

  it('should handle empty array', () => {
    const ordered = getExecutionOrder([]);
    expect(ordered).toEqual([]);
  });

  it('should handle single task', () => {
    const mappings: TaskMapping[] = [createTestMapping({ task_id: '06-01-01', wave: 1 })];
    const ordered = getExecutionOrder(mappings);
    expect(ordered.length).toBe(1);
    expect(ordered[0].task_id).toBe('06-01-01');
  });
});

describe('getWaves', () => {
  it('should return sorted unique wave numbers', () => {
    const mappings: TaskMapping[] = [
      createTestMapping({ wave: 3 }),
      createTestMapping({ wave: 1 }),
      createTestMapping({ wave: 2 }),
      createTestMapping({ wave: 1 }), // duplicate
    ];

    const waves = getWaves(mappings);

    expect(waves).toEqual([1, 2, 3]);
  });

  it('should return empty array for no mappings', () => {
    const waves = getWaves([]);
    expect(waves).toEqual([]);
  });

  it('should handle single wave', () => {
    const mappings: TaskMapping[] = [
      createTestMapping({ wave: 2 }),
      createTestMapping({ wave: 2 }),
    ];

    const waves = getWaves(mappings);

    expect(waves).toEqual([2]);
  });
});

describe('getTasksInWave', () => {
  const mappings: TaskMapping[] = [
    createTestMapping({ task_id: '06-01-01', wave: 1 }),
    createTestMapping({ task_id: '06-01-02', wave: 1 }),
    createTestMapping({ task_id: '06-02-01', wave: 2 }),
  ];

  it('should return tasks for specified wave', () => {
    const wave1 = getTasksInWave(mappings, 1);
    expect(wave1.length).toBe(2);
    expect(wave1.every((m) => m.wave === 1)).toBe(true);
  });

  it('should return empty for non-existent wave', () => {
    const wave99 = getTasksInWave(mappings, 99);
    expect(wave99).toEqual([]);
  });

  it('should return single task for wave with one task', () => {
    const wave2 = getTasksInWave(mappings, 2);
    expect(wave2.length).toBe(1);
    expect(wave2[0].task_id).toBe('06-02-01');
  });
});

describe('hasDependencies', () => {
  const depMap: DependencyMap = {
    '06-01-01': [],
    '06-02-01': ['06-01-01'],
  };

  it('should return false for task with no dependencies', () => {
    expect(hasDependencies('06-01-01', depMap)).toBe(false);
  });

  it('should return true for task with dependencies', () => {
    expect(hasDependencies('06-02-01', depMap)).toBe(true);
  });

  it('should return false for unknown task', () => {
    expect(hasDependencies('unknown', depMap)).toBe(false);
  });
});

describe('getReadyTasks', () => {
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

  it('should return tasks with no dependencies when none completed', () => {
    const ready = getReadyTasks(mappings, depMap, new Set());
    expect(ready.length).toBe(2);
    expect(ready.map((m) => m.task_id)).toContain('06-01-01');
    expect(ready.map((m) => m.task_id)).toContain('06-01-02');
  });

  it('should return blocked task when all dependencies completed', () => {
    const completed = new Set(['06-01-01', '06-01-02']);
    const ready = getReadyTasks(mappings, depMap, completed);

    expect(ready.length).toBe(3); // All tasks are now ready
    expect(ready.map((m) => m.task_id)).toContain('06-02-01');
  });

  it('should not return blocked task when only some dependencies completed', () => {
    const completed = new Set(['06-01-01']); // Only one of two
    const ready = getReadyTasks(mappings, depMap, completed);

    expect(ready.length).toBe(2); // Wave 1 tasks still ready
    expect(ready.map((m) => m.task_id)).not.toContain('06-02-01');
  });

  it('should handle empty mappings', () => {
    const ready = getReadyTasks([], depMap, new Set());
    expect(ready).toEqual([]);
  });

  it('should handle empty dependency map', () => {
    const ready = getReadyTasks(mappings, {}, new Set());
    expect(ready.length).toBe(3); // All tasks ready when no deps defined
  });
});

describe('DependencyMap type', () => {
  it('should allow Record<string, string[]> structure', () => {
    const depMap: DependencyMap = {
      'task-1': [],
      'task-2': ['task-1'],
      'task-3': ['task-1', 'task-2'],
    };

    expect(depMap['task-1']).toEqual([]);
    expect(depMap['task-2']).toEqual(['task-1']);
    expect(depMap['task-3'].length).toBe(2);
  });
});

describe('Integration scenarios', () => {
  it('should handle complete 3-wave execution flow', () => {
    const mappings: TaskMapping[] = [
      // Wave 1: Foundation tasks
      createTestMapping({ task_id: '06-01-01', wave: 1 }),
      createTestMapping({ task_id: '06-01-02', wave: 1 }),
      // Wave 2: Implementation tasks
      createTestMapping({ task_id: '06-02-01', wave: 2 }),
      createTestMapping({ task_id: '06-02-02', wave: 2 }),
      // Wave 3: Integration tasks
      createTestMapping({ task_id: '06-03-01', wave: 3 }),
    ];

    const depMap = buildDependencyMap(mappings);
    const order = getExecutionOrder(mappings);
    const waves = getWaves(mappings);

    // Check wave structure
    expect(waves).toEqual([1, 2, 3]);

    // Check execution order
    expect(order[0].wave).toBe(1);
    expect(order[order.length - 1].wave).toBe(3);

    // Check dependencies
    expect(depMap['06-01-01']).toEqual([]);
    expect(depMap['06-02-01'].length).toBe(2);
    expect(depMap['06-03-01'].length).toBe(4);

    // Simulate execution
    let completed = new Set<string>();

    // Initially only wave 1 ready
    let ready = getReadyTasks(mappings, depMap, completed);
    expect(ready.length).toBe(2);

    // Complete wave 1
    completed.add('06-01-01');
    completed.add('06-01-02');

    // Now wave 2 also ready
    ready = getReadyTasks(mappings, depMap, completed);
    expect(ready.length).toBe(4); // 2 + 2

    // Complete wave 2
    completed.add('06-02-01');
    completed.add('06-02-02');

    // Now wave 3 also ready
    ready = getReadyTasks(mappings, depMap, completed);
    expect(ready.length).toBe(5); // All tasks
  });
});
