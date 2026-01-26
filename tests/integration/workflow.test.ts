/**
 * E2E Workflow Integration Tests
 *
 * Tests the complete Ultra Planner workflow from project initialization
 * through plan execution, validating all major modules work together.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createTestWorkspace, cleanupWorkspace } from '../helpers/temp-dir.js';
import {
  createMockState,
  createMockPlanFrontmatter,
  createMockTaskDefinition,
} from '../helpers/mock-state.js';
import { StateManager } from '@/state/state-manager.js';
import { StateLocation } from '@/state/types.js';
import { generateProjectMd } from '@/documents/templates/project.js';
import { generateRoadmapMd } from '@/documents/templates/roadmap.js';
import {
  generateCompletePlanMd,
  parsePlanMd,
  extractTasksFromContent,
} from '@/documents/templates/plan.js';
import {
  markTaskInProgress,
  markTaskComplete,
  getTaskStates,
} from '@/sync/status-sync.js';
import { generateTaskId } from '@/sync/plan-parser.js';
import matter from 'gray-matter';
import type { ProjectDocumentConfig, RoadmapConfig } from '@/documents/types.js';

// ============================================================================
// Test State
// ============================================================================

let testWorkspace: string;

beforeEach(() => {
  testWorkspace = createTestWorkspace();
});

afterEach(() => {
  cleanupWorkspace(testWorkspace);
});

// ============================================================================
// Test Suite: State Management Integration
// ============================================================================

describe('State Management Integration', () => {
  test('should persist and read state via StateManager', () => {
    // Create StateManager with custom cwd
    const originalCwd = process.cwd();
    process.chdir(testWorkspace);

    const stateManager = new StateManager('session', StateLocation.LOCAL);
    const mockState = createMockState({ phase: 2, currentPlan: '02-03' });

    // Write state
    const writeResult = stateManager.write(mockState);
    expect(writeResult.success).toBe(true);

    // Read state back
    const readResult = stateManager.read();
    expect(readResult.exists).toBe(true);
    expect(readResult.data).toEqual(mockState);

    // Restore cwd
    process.chdir(originalCwd);
  });

  test('should create and restore checkpoints', () => {
    const originalCwd = process.cwd();
    process.chdir(testWorkspace);

    const stateManager = new StateManager('session', StateLocation.LOCAL);
    const initialState = createMockState({ phase: 1, status: 'active' });
    stateManager.write(initialState);

    // Create checkpoint by reading state
    const checkpoint = stateManager.read();
    expect(checkpoint.data).toEqual(initialState);

    // Modify state
    const modifiedState = createMockState({ phase: 2, status: 'paused' });
    stateManager.write(modifiedState);

    // Verify modified
    const modified = stateManager.read();
    expect(modified.data).toEqual(modifiedState);

    // Restore checkpoint
    if (checkpoint.data) {
      stateManager.write(checkpoint.data);
    }

    // Verify restored
    const restored = stateManager.read();
    expect(restored.data).toEqual(initialState);

    process.chdir(originalCwd);
  });
});

// ============================================================================
// Test Suite: Document Generation Integration
// ============================================================================

describe('Document Generation Integration', () => {
  test('should generate valid PROJECT.md', () => {
    const projectConfig: ProjectDocumentConfig = {
      name: 'Test Todo API',
      description: 'A simple REST API for managing todo items with authentication.',
      coreValue: 'Reliable task management with secure user isolation',
      requirements: {
        validated: ['User registration and login'],
        active: ['Todo CRUD operations', 'Task filtering'],
        outOfScope: [
          {
            item: 'Real-time collaboration',
            reason: 'Adds WebSocket complexity; defer to v2',
          },
        ],
      },
      context: 'Building a learning project to understand REST API patterns.',
      constraints: [
        {
          type: 'Technical',
          description: 'Must use Node.js 20+',
          reason: 'Native fetch API required',
        },
      ],
      keyDecisions: [
        {
          decision: 'Use JWT for authentication',
          rationale: 'Stateless, scales horizontally',
          outcome: 'good',
        },
      ],
    };

    const markdown = generateProjectMd(projectConfig);

    // Parse with gray-matter
    const parsed = matter(markdown);

    // Validate frontmatter exists
    expect(parsed.data).toBeDefined();
    expect(parsed.data.name).toBe('Test Todo API');
    expect(parsed.data.core_value).toBe(
      'Reliable task management with secure user isolation'
    );

    // Validate content sections
    expect(parsed.content).toContain('## What This Is');
    expect(parsed.content).toContain('## Requirements');
    expect(parsed.content).toContain('### Validated');
    expect(parsed.content).toContain('### Active');
    expect(parsed.content).toContain('### Out of Scope');
  });

  test('should generate valid PLAN.md with tasks', () => {
    const frontmatter = createMockPlanFrontmatter({
      phase: '01-foundation',
      plan: 1,
      wave: 1,
    });

    const tasks = [
      createMockTaskDefinition({
        name: 'Task 1: Setup project structure',
        files: ['package.json', 'tsconfig.json'],
        action: 'Initialize Node.js project with TypeScript',
        verify: 'npm run build',
        done: 'Project compiles without errors',
      }),
      createMockTaskDefinition({
        name: 'Task 2: Create state manager',
        files: ['src/state/state-manager.ts'],
        action: 'Implement file-based state persistence',
        verify: 'npm test',
        done: 'State manager tests pass',
      }),
    ];

    const markdown = generateCompletePlanMd(frontmatter, {
      objective: {
        description: 'Setup project foundation',
        purpose: 'Establish baseline infrastructure',
        output: 'Working TypeScript project with state management',
      },
      context: ['.planning/PROJECT.md', '.planning/ROADMAP.md'],
      tasks,
      verification: ['npm run build succeeds', 'npm test passes'],
      successCriteria: ['Project structure exists', 'State manager works'],
      output: 'After completion, create SUMMARY.md',
    });

    // Parse with gray-matter
    const parsed = parsePlanMd(markdown);

    // Validate frontmatter
    expect(parsed.frontmatter.phase).toBe('01-foundation');
    expect(parsed.frontmatter.plan).toBe(1);
    expect(parsed.frontmatter.wave).toBe(1);

    // Extract and validate tasks
    const extractedTasks = extractTasksFromContent(parsed.content);
    expect(extractedTasks).toHaveLength(2);
    expect(extractedTasks[0].name).toBe('Task 1: Setup project structure');
    expect(extractedTasks[1].name).toBe('Task 2: Create state manager');
  });
});

// ============================================================================
// Test Suite: Task Sync Integration
// ============================================================================

describe('Task Sync Integration', () => {
  test('should update task status in PLAN.md frontmatter', async () => {
    // Create PLAN.md in temp workspace
    const planPath = join(testWorkspace, 'PLAN.md');
    const frontmatter = createMockPlanFrontmatter();
    const tasks = [createMockTaskDefinition()];

    const markdown = generateCompletePlanMd(frontmatter, {
      objective: {
        description: 'Test objective',
        purpose: 'Test purpose',
        output: 'Test output',
      },
      context: [],
      tasks,
      verification: [],
      successCriteria: [],
      output: 'Test',
    });

    writeFileSync(planPath, markdown, 'utf-8');

    // Mark task in progress
    const taskId = '01-01-01';
    await markTaskInProgress(planPath, taskId, 'test-agent');

    // Read and verify
    let taskStates = await getTaskStates(planPath);
    expect(taskStates[taskId]).toBeDefined();
    expect(taskStates[taskId].status).toBe('in_progress');
    expect(taskStates[taskId].agent_id).toBe('test-agent');
    expect(taskStates[taskId].started_at).toBeDefined();

    // Mark task complete
    await markTaskComplete(planPath, taskId);

    // Read and verify completion
    taskStates = await getTaskStates(planPath);
    expect(taskStates[taskId].status).toBe('completed');
    expect(taskStates[taskId].completed_at).toBeDefined();
  });

  test('should generate task IDs in correct format', () => {
    const taskId1 = generateTaskId('06-claude-tasks-sync', 2, 1);
    expect(taskId1).toBe('06-02-01');

    const taskId2 = generateTaskId('01-foundation', 1, 5);
    expect(taskId2).toBe('01-01-05');

    const taskId3 = generateTaskId('08', 3, 12);
    expect(taskId3).toBe('08-03-12');
  });
});

// ============================================================================
// Test Suite: Full Workflow Simulation
// ============================================================================

describe('Full Workflow Simulation', () => {
  test('should simulate complete workflow: init -> plan -> execute', async () => {
    // 1. Create PROJECT.md
    const projectPath = join(testWorkspace, '.planning', 'PROJECT.md');
    mkdirSync(join(testWorkspace, '.planning'), { recursive: true });

    const projectConfig: ProjectDocumentConfig = {
      name: 'Todo API Workflow Test',
      description: 'Complete workflow simulation for testing',
      coreValue: 'Validate E2E workflow',
      requirements: {
        validated: [],
        active: ['Test workflow'],
        outOfScope: [],
      },
      context: 'Testing context',
      constraints: [],
      keyDecisions: [],
    };

    const projectMd = generateProjectMd(projectConfig);
    writeFileSync(projectPath, projectMd, 'utf-8');
    expect(readFileSync(projectPath, 'utf-8')).toBe(projectMd);

    // 2. Create ROADMAP.md
    const roadmapPath = join(testWorkspace, '.planning', 'ROADMAP.md');
    const roadmapConfig: RoadmapConfig = {
      projectName: 'Todo API Workflow Test',
      overview: 'Single phase test roadmap',
      phases: [
        {
          number: '1',
          name: 'Foundation',
          goal: 'Setup project',
          dependsOn: [],
          successCriteria: ['Project initialized'],
          plans: [
            {
              id: '01-01',
              description: 'Initialize structure',
              completed: false,
            },
          ],
          status: 'in_progress',
        },
      ],
    };

    const roadmapMd = generateRoadmapMd(roadmapConfig);
    writeFileSync(roadmapPath, roadmapMd, 'utf-8');
    expect(readFileSync(roadmapPath, 'utf-8')).toBe(roadmapMd);

    // 3. Create STATE.md
    const statePath = join(testWorkspace, '.planning', 'STATE.md');
    const stateContent = `# Project State

## Current Position

Phase: 1 of 1 (Foundation)
Plan: 1 of 1
Status: In progress

## Decisions

None yet.
`;
    writeFileSync(statePath, stateContent, 'utf-8');

    // 4. Generate PLAN.md for phase 1
    const planDir = join(testWorkspace, '.planning', 'phases', '01-foundation');
    mkdirSync(planDir, { recursive: true });
    const planPath = join(planDir, '01-01-PLAN.md');

    const frontmatter = createMockPlanFrontmatter({
      phase: '01-foundation',
      plan: 1,
    });

    const tasks = [
      createMockTaskDefinition({
        name: 'Task 1: Create entry point',
        files: ['src/index.ts'],
      }),
    ];

    const planMd = generateCompletePlanMd(frontmatter, {
      objective: {
        description: 'Initialize project',
        purpose: 'Setup foundation',
        output: 'Working project',
      },
      context: ['@.planning/PROJECT.md'],
      tasks,
      verification: ['Build passes'],
      successCriteria: ['Structure exists'],
      output: 'Create SUMMARY.md',
    });

    writeFileSync(planPath, planMd, 'utf-8');

    // 5. Simulate task execution by updating task states
    const taskId = generateTaskId('01-foundation', 1, 1);
    await markTaskInProgress(planPath, taskId);
    await markTaskComplete(planPath, taskId);

    // 6. Verify all files exist with correct structure
    expect(readFileSync(projectPath, 'utf-8')).toContain('Todo API Workflow Test');
    expect(readFileSync(roadmapPath, 'utf-8')).toContain('Foundation');
    expect(readFileSync(statePath, 'utf-8')).toContain('Phase: 1 of 1');
    expect(readFileSync(planPath, 'utf-8')).toContain('Task 1: Create entry point');

    // Verify task state was tracked
    const taskStates = await getTaskStates(planPath);
    expect(taskStates[taskId]).toBeDefined();
    expect(taskStates[taskId].status).toBe('completed');
  });
});
