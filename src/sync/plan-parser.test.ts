/**
 * Plan Parser Tests
 *
 * Tests for PLAN.md parsing for sync operations.
 * Verifies task ID generation, plan parsing, and task mapping extraction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateTaskId,
  parsePlanForSync,
  extractTaskMappings,
  formatTaskPrompt,
  parseAndExtractMappings,
  findTaskById,
  filterTasksByStatus,
} from './plan-parser.js';
import type { TaskMapping, PlanSyncData } from './types.js';
import type { AutoTask, CheckpointHumanVerifyTask, CheckpointDecisionTask } from '../documents/xml/types.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

// Mock parsePlanMd
vi.mock('../documents/templates/plan.js', () => ({
  parsePlanMd: vi.fn(),
}));

// Mock parseTasksSection
vi.mock('../documents/xml/task-parser.js', () => ({
  parseTasksSection: vi.fn(),
}));

import { readFile } from 'fs/promises';
import { parsePlanMd } from '../documents/templates/plan.js';
import { parseTasksSection } from '../documents/xml/task-parser.js';

describe('generateTaskId', () => {
  it('should generate correct format: {phase}-{plan:02d}-{taskIndex:02d}', () => {
    const id = generateTaskId('06', 1, 1);
    expect(id).toBe('06-01-01');
  });

  it('should handle phase with name (extract numeric prefix)', () => {
    const id = generateTaskId('06-claude-tasks-sync', 2, 3);
    expect(id).toBe('06-02-03');
  });

  it('should pad single digits correctly', () => {
    const id = generateTaskId('1', 2, 3);
    expect(id).toBe('01-02-03');
  });

  it('should handle double-digit values', () => {
    const id = generateTaskId('12', 10, 15);
    expect(id).toBe('12-10-15');
  });

  it('should preserve two-digit phase numbers', () => {
    const id = generateTaskId('22', 1, 1);
    expect(id).toBe('22-01-01');
  });

  it('should handle phase with complex name', () => {
    const id = generateTaskId('22-test-coverage', 2, 5);
    expect(id).toBe('22-02-05');
  });
});

describe('parsePlanForSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract frontmatter fields (phase, plan, wave)', async () => {
    vi.mocked(readFile).mockResolvedValue('mocked content');
    vi.mocked(parsePlanMd).mockReturnValue({
      frontmatter: { phase: '06', plan: 2, wave: 1 },
      content: '<tasks></tasks>',
    });
    vi.mocked(parseTasksSection).mockReturnValue([]);

    const result = await parsePlanForSync('/test/path/06-02-PLAN.md');

    expect(result.frontmatter.phase).toBe('06');
    expect(result.frontmatter.plan).toBe(2);
    expect(result.frontmatter.wave).toBe(1);
  });

  it('should extract tasks array using parseTasksSection', async () => {
    const mockTasks: AutoTask[] = [
      { type: 'auto', name: 'Task 1', files: [], action: 'Do something', verify: 'npm test', done: 'Done' },
    ];

    vi.mocked(readFile).mockResolvedValue('mocked content');
    vi.mocked(parsePlanMd).mockReturnValue({
      frontmatter: { phase: '06', plan: 1, wave: 1 },
      content: '<tasks></tasks>',
    });
    vi.mocked(parseTasksSection).mockReturnValue(mockTasks);

    const result = await parsePlanForSync('/test/path/06-01-PLAN.md');

    expect(result.tasks).toEqual(mockTasks);
    expect(parseTasksSection).toHaveBeenCalled();
  });

  it('should return correct path', async () => {
    vi.mocked(readFile).mockResolvedValue('mocked content');
    vi.mocked(parsePlanMd).mockReturnValue({
      frontmatter: { phase: '06', plan: 1, wave: 1 },
      content: '',
    });
    vi.mocked(parseTasksSection).mockReturnValue([]);

    const testPath = '/test/path/06-01-PLAN.md';
    const result = await parsePlanForSync(testPath);

    expect(result.path).toBe(testPath);
  });

  it('should use defaults for missing optional fields', async () => {
    vi.mocked(readFile).mockResolvedValue('mocked content');
    vi.mocked(parsePlanMd).mockReturnValue({
      frontmatter: {}, // No phase, plan, wave specified
      content: '',
    });
    vi.mocked(parseTasksSection).mockReturnValue([]);

    const result = await parsePlanForSync('/test/phases/my-phase/01-PLAN.md');

    expect(result.frontmatter.plan).toBe(1);
    expect(result.frontmatter.wave).toBe(1);
  });

  it('should throw on file read error', async () => {
    vi.mocked(readFile).mockRejectedValue(new Error('File not found'));

    await expect(parsePlanForSync('/nonexistent/path.md')).rejects.toThrow('File not found');
  });
});

describe('extractTaskMappings', () => {
  it('should create TaskMapping for each task', () => {
    const planData: PlanSyncData = {
      frontmatter: { phase: '06', plan: 1, wave: 1 },
      tasks: [
        { type: 'auto', name: 'Task 1', files: [], action: 'Action 1', verify: 'test', done: 'Done' } as AutoTask,
        { type: 'auto', name: 'Task 2', files: [], action: 'Action 2', verify: 'test', done: 'Done' } as AutoTask,
      ],
      path: '/test/plan.md',
    };

    const mappings = extractTaskMappings(planData);

    expect(mappings.length).toBe(2);
  });

  it('should generate deterministic task IDs', () => {
    const planData: PlanSyncData = {
      frontmatter: { phase: '06', plan: 2, wave: 1 },
      tasks: [
        { type: 'auto', name: 'Task 1', files: [], action: 'Action', verify: 'test', done: 'Done' } as AutoTask,
      ],
      path: '/test/plan.md',
    };

    const mappings = extractTaskMappings(planData);

    expect(mappings[0].task_id).toBe('06-02-01');
  });

  it('should include wave from frontmatter', () => {
    const planData: PlanSyncData = {
      frontmatter: { phase: '06', plan: 1, wave: 3 },
      tasks: [
        { type: 'auto', name: 'Task 1', files: [], action: 'Action', verify: 'test', done: 'Done' } as AutoTask,
      ],
      path: '/test/plan.md',
    };

    const mappings = extractTaskMappings(planData);

    expect(mappings[0].wave).toBe(3);
  });

  it('should set initial status to pending', () => {
    const planData: PlanSyncData = {
      frontmatter: { phase: '06', plan: 1, wave: 1 },
      tasks: [
        { type: 'auto', name: 'Task 1', files: [], action: 'Action', verify: 'test', done: 'Done' } as AutoTask,
      ],
      path: '/test/plan.md',
    };

    const mappings = extractTaskMappings(planData);

    expect(mappings[0].status).toBe('pending');
  });

  it('should apply sync config defaults', () => {
    const planData: PlanSyncData = {
      frontmatter: { phase: '06', plan: 1, wave: 1 },
      tasks: [
        { type: 'auto', name: 'Task 1', files: [], action: 'Action', verify: 'test', done: 'Done' } as AutoTask,
      ],
      path: '/test/plan.md',
    };

    const mappings = extractTaskMappings(planData);

    expect(mappings[0].tool_params.model).toBe('sonnet'); // default model
    expect(mappings[0].tool_params.subagent_type).toBe('oh-my-claudecode:executor'); // default subagent
  });

  it('should use custom config when provided', () => {
    const planData: PlanSyncData = {
      frontmatter: { phase: '06', plan: 1, wave: 1 },
      tasks: [
        { type: 'auto', name: 'Task 1', files: [], action: 'Action', verify: 'test', done: 'Done' } as AutoTask,
      ],
      path: '/test/plan.md',
    };

    const mappings = extractTaskMappings(planData, {
      default_model: 'opus',
      default_subagent: 'custom:executor',
    });

    expect(mappings[0].tool_params.model).toBe('opus');
    expect(mappings[0].tool_params.subagent_type).toBe('custom:executor');
  });
});

describe('formatTaskPrompt', () => {
  it('should format auto task with all sections', () => {
    const task: AutoTask = {
      type: 'auto',
      name: 'Implement feature',
      files: ['src/feature.ts', 'tests/feature.test.ts'],
      action: 'Create the feature implementation',
      verify: 'npm test -- feature',
      done: 'Feature works correctly',
    };

    const prompt = formatTaskPrompt(task);

    expect(prompt).toContain('# Implement feature');
    expect(prompt).toContain('## Files');
    expect(prompt).toContain('src/feature.ts');
    expect(prompt).toContain('## Action');
    expect(prompt).toContain('Create the feature implementation');
    expect(prompt).toContain('## Verification');
    expect(prompt).toContain('npm test -- feature');
    expect(prompt).toContain('## Done Criteria');
    expect(prompt).toContain('Feature works correctly');
  });

  it('should format checkpoint:human-verify task', () => {
    const task: CheckpointHumanVerifyTask = {
      type: 'checkpoint:human-verify',
      name: 'Verify UI looks correct',
      whatBuilt: 'New dashboard layout',
      howToVerify: 'Check the layout renders correctly',
      resumeSignal: 'User confirms UI is correct',
    };

    const prompt = formatTaskPrompt(task);

    expect(prompt).toContain('# Verify UI looks correct');
    expect(prompt).toContain('Type: checkpoint:human-verify');
    expect(prompt).toContain('## What Was Built');
    expect(prompt).toContain('New dashboard layout');
    expect(prompt).toContain('## How to Verify');
    expect(prompt).toContain('Check the layout renders correctly');
    expect(prompt).toContain('## Resume Signal');
    expect(prompt).toContain('User confirms UI is correct');
  });

  it('should format checkpoint:decision task with options', () => {
    const task: CheckpointDecisionTask = {
      type: 'checkpoint:decision',
      name: 'Choose database',
      decision: 'Which database to use',
      context: 'Need a database for user data',
      options: [
        { id: 'A', name: 'PostgreSQL', pros: 'Reliable', cons: 'Complex setup' },
        { id: 'B', name: 'SQLite', pros: 'Simple', cons: 'Limited concurrency' },
      ],
    };

    const prompt = formatTaskPrompt(task);

    expect(prompt).toContain('# Choose database');
    expect(prompt).toContain('Type: checkpoint:decision');
    expect(prompt).toContain('## Decision');
    expect(prompt).toContain('Which database to use');
    expect(prompt).toContain('## Context');
    expect(prompt).toContain('Need a database for user data');
    expect(prompt).toContain('## Options');
    expect(prompt).toContain('### A: PostgreSQL');
    expect(prompt).toContain('Pros: Reliable');
    expect(prompt).toContain('Cons: Complex setup');
    expect(prompt).toContain('### B: SQLite');
  });

  it('should handle auto task with empty files', () => {
    const task: AutoTask = {
      type: 'auto',
      name: 'Task without files',
      files: [],
      action: 'Do something',
      verify: 'npm test',
      done: 'Done',
    };

    const prompt = formatTaskPrompt(task);

    expect(prompt).toContain('# Task without files');
    expect(prompt).not.toContain('## Files');
  });
});

describe('parseAndExtractMappings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should work end-to-end as convenience function', async () => {
    const mockTasks: AutoTask[] = [
      { type: 'auto', name: 'Task 1', files: [], action: 'Action 1', verify: 'test', done: 'Done' },
      { type: 'auto', name: 'Task 2', files: [], action: 'Action 2', verify: 'test', done: 'Done' },
    ];

    vi.mocked(readFile).mockResolvedValue('mocked content');
    vi.mocked(parsePlanMd).mockReturnValue({
      frontmatter: { phase: '06', plan: 1, wave: 1 },
      content: '<tasks></tasks>',
    });
    vi.mocked(parseTasksSection).mockReturnValue(mockTasks);

    const mappings = await parseAndExtractMappings('/test/path/06-01-PLAN.md');

    expect(mappings.length).toBe(2);
    expect(mappings[0].task_id).toBe('06-01-01');
    expect(mappings[1].task_id).toBe('06-01-02');
  });

  it('should return correct number of mappings', async () => {
    const mockTasks: AutoTask[] = [
      { type: 'auto', name: 'Task 1', files: [], action: 'Action', verify: 'test', done: 'Done' },
      { type: 'auto', name: 'Task 2', files: [], action: 'Action', verify: 'test', done: 'Done' },
      { type: 'auto', name: 'Task 3', files: [], action: 'Action', verify: 'test', done: 'Done' },
    ];

    vi.mocked(readFile).mockResolvedValue('mocked content');
    vi.mocked(parsePlanMd).mockReturnValue({
      frontmatter: { phase: '06', plan: 1, wave: 1 },
      content: '',
    });
    vi.mocked(parseTasksSection).mockReturnValue(mockTasks);

    const mappings = await parseAndExtractMappings('/test/plan.md');

    expect(mappings.length).toBe(3);
  });
});

describe('findTaskById', () => {
  const mappings: TaskMapping[] = [
    {
      task_id: '06-01-01',
      plan_path: '/test/plan.md',
      name: 'Task 1',
      type: 'auto',
      tool_params: { description: 'Task 1', prompt: '', subagent_type: 'test' },
      status: 'pending',
      wave: 1,
    },
    {
      task_id: '06-01-02',
      plan_path: '/test/plan.md',
      name: 'Task 2',
      type: 'auto',
      tool_params: { description: 'Task 2', prompt: '', subagent_type: 'test' },
      status: 'completed',
      wave: 1,
    },
  ];

  it('should return correct mapping by task ID', () => {
    const result = findTaskById(mappings, '06-01-01');
    expect(result).toBeDefined();
    expect(result?.name).toBe('Task 1');
  });

  it('should return undefined for unknown ID', () => {
    const result = findTaskById(mappings, '99-99-99');
    expect(result).toBeUndefined();
  });

  it('should find second task correctly', () => {
    const result = findTaskById(mappings, '06-01-02');
    expect(result?.name).toBe('Task 2');
    expect(result?.status).toBe('completed');
  });
});

describe('filterTasksByStatus', () => {
  const mappings: TaskMapping[] = [
    {
      task_id: '06-01-01',
      plan_path: '/test/plan.md',
      name: 'Task 1',
      type: 'auto',
      tool_params: { description: 'Task 1', prompt: '', subagent_type: 'test' },
      status: 'pending',
      wave: 1,
    },
    {
      task_id: '06-01-02',
      plan_path: '/test/plan.md',
      name: 'Task 2',
      type: 'auto',
      tool_params: { description: 'Task 2', prompt: '', subagent_type: 'test' },
      status: 'completed',
      wave: 1,
    },
    {
      task_id: '06-01-03',
      plan_path: '/test/plan.md',
      name: 'Task 3',
      type: 'auto',
      tool_params: { description: 'Task 3', prompt: '', subagent_type: 'test' },
      status: 'pending',
      wave: 2,
    },
  ];

  it('should filter by pending status', () => {
    const result = filterTasksByStatus(mappings, 'pending');
    expect(result.length).toBe(2);
    expect(result.every((m) => m.status === 'pending')).toBe(true);
  });

  it('should filter by completed status', () => {
    const result = filterTasksByStatus(mappings, 'completed');
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Task 2');
  });

  it('should return empty array for status with no matches', () => {
    const result = filterTasksByStatus(mappings, 'failed');
    expect(result).toEqual([]);
  });

  it('should filter in_progress status', () => {
    const mappingsWithInProgress: TaskMapping[] = [
      ...mappings,
      {
        task_id: '06-01-04',
        plan_path: '/test/plan.md',
        name: 'Task 4',
        type: 'auto',
        tool_params: { description: 'Task 4', prompt: '', subagent_type: 'test' },
        status: 'in_progress',
        wave: 2,
      },
    ];

    const result = filterTasksByStatus(mappingsWithInProgress, 'in_progress');
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Task 4');
  });
});

describe('Task ID Format', () => {
  it('should produce consistent IDs across function calls', () => {
    const id1 = generateTaskId('06', 1, 1);
    const id2 = generateTaskId('06', 1, 1);
    expect(id1).toBe(id2);
  });

  it('should produce unique IDs for different tasks', () => {
    const id1 = generateTaskId('06', 1, 1);
    const id2 = generateTaskId('06', 1, 2);
    const id3 = generateTaskId('06', 2, 1);
    expect(new Set([id1, id2, id3]).size).toBe(3);
  });

  it('should sort correctly when used as strings', () => {
    const ids = [
      generateTaskId('06', 2, 1),
      generateTaskId('06', 1, 10),
      generateTaskId('06', 1, 2),
      generateTaskId('06', 1, 1),
    ];

    const sorted = [...ids].sort();
    expect(sorted).toEqual(['06-01-01', '06-01-02', '06-01-10', '06-02-01']);
  });
});
