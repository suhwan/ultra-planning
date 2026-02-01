/**
 * Sync Pipeline Integration Test
 *
 * Tests the complete flow from PLAN.md parsing to Task tool parameter generation.
 * Validates end-to-end sync pipeline functionality including:
 * - PLAN.md parsing with frontmatter extraction
 * - Task extraction from XML task blocks
 * - Task mapping generation with deterministic IDs
 * - Checkpoint task handling
 * - Progress tracking across multiple tasks
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createTestWorkspace, cleanupWorkspace } from '../helpers/temp-dir.js';

// Import sync pipeline functions
import {
  parsePlanForSync,
  extractTaskMappings,
  generateTaskId,
  formatTaskPrompt,
  calculateProgress,
  formatProgress,
  isAllComplete,
  getReadyTasks,
} from '../../src/sync/index.js';

describe('Sync Pipeline Integration', () => {
  let testDir: string;
  let planPath: string;

  beforeEach(() => {
    // Create unique temp directory for each test
    testDir = createTestWorkspace();
    planPath = join(testDir, '01-01-PLAN.md');
  });

  afterEach(() => {
    // Clean up temp directory
    cleanupWorkspace(testDir);
  });

  describe('PLAN.md Parsing', () => {
    test('parses PLAN.md and generates task mappings', async () => {
      // Create test PLAN.md
      const planContent = `---
phase: 01-test
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/feature.ts
autonomous: true
must_haves:
  truths:
    - "Feature works"
  artifacts:
    - path: src/feature.ts
      provides: "Test feature"
---

<objective>
Test objective for the sync pipeline integration test.
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Create feature</name>
  <files>src/feature.ts</files>
  <action>Create the feature implementation</action>
  <verify>npm test</verify>
  <done>Feature created and tests pass</done>
</task>

<task type="auto">
  <name>Task 2: Add tests</name>
  <files>src/feature.test.ts</files>
  <action>Add tests for feature</action>
  <verify>npm test</verify>
  <done>Tests pass</done>
</task>
</tasks>
`;

      writeFileSync(planPath, planContent);

      // Parse plan
      const planData = await parsePlanForSync(planPath);

      // Verify frontmatter extraction
      expect(planData.frontmatter.phase).toBe('01-test');
      expect(planData.frontmatter.plan).toBe(1);
      expect(planData.frontmatter.wave).toBe(1);

      // Verify tasks extracted
      expect(planData.tasks).toHaveLength(2);
      expect(planData.tasks[0].name).toContain('Create feature');
      expect(planData.tasks[1].name).toContain('Add tests');

      // Extract task mappings
      const mappings = extractTaskMappings(planData);

      // Verify mapping generation
      expect(mappings).toHaveLength(2);
      expect(mappings[0].task_id).toBe('01-01-01');
      expect(mappings[1].task_id).toBe('01-01-02');

      // Verify tool params
      expect(mappings[0].tool_params.prompt).toContain('Create feature');
      expect(mappings[0].tool_params.subagent_type).toBeDefined();
      expect(mappings[0].status).toBe('pending');
      expect(mappings[0].wave).toBe(1);
    });

    test('handles checkpoint tasks correctly', async () => {
      const planContent = `---
phase: 02-test
plan: 1
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: false
must_haves:
  truths:
    - "UI verified"
  artifacts: []
---

<tasks>
<task type="checkpoint:human-verify" gate="blocking">
  <what-built>New UI component</what-built>
  <how-to-verify>Check the component renders correctly</how-to-verify>
  <resume-signal>Type "approved"</resume-signal>
</task>
</tasks>
`;

      writeFileSync(planPath, planContent);

      const planData = await parsePlanForSync(planPath);

      expect(planData.tasks).toHaveLength(1);
      expect(planData.tasks[0].type).toBe('checkpoint:human-verify');

      const mappings = extractTaskMappings(planData);
      expect(mappings[0].type).toBe('checkpoint:human-verify');
      expect(mappings[0].tool_params.prompt).toContain('What Was Built');
    });

    test('generates deterministic task IDs across runs', async () => {
      const planContent = `---
phase: 06-sync
plan: 3
type: execute
wave: 2
depends_on: ["06-02"]
files_modified: []
autonomous: true
must_haves:
  truths: []
  artifacts: []
---

<tasks>
<task type="auto">
  <name>Task 1: Feature A</name>
  <files>a.ts</files>
  <action>Do A</action>
  <verify>test</verify>
  <done>A done</done>
</task>
</tasks>
`;

      writeFileSync(planPath, planContent);

      // Parse twice
      const planData1 = await parsePlanForSync(planPath);
      const planData2 = await parsePlanForSync(planPath);

      const mappings1 = extractTaskMappings(planData1);
      const mappings2 = extractTaskMappings(planData2);

      // Task IDs should be identical
      expect(mappings1[0].task_id).toBe(mappings2[0].task_id);
      expect(mappings1[0].task_id).toBe('06-03-01');
    });

    test('extracts phase from path when not in frontmatter', async () => {
      // Create a more realistic path structure
      const phasesDir = join(testDir, '.planning', 'phases', '05-feature');
      mkdirSync(phasesDir, { recursive: true });
      const nestedPlanPath = join(phasesDir, '05-02-PLAN.md');

      const planContent = `---
plan: 2
type: execute
wave: 1
---

<tasks>
<task type="auto">
  <name>Task 1: Test</name>
  <files>test.ts</files>
  <action>Test action</action>
  <verify>npm test</verify>
  <done>Done</done>
</task>
</tasks>
`;

      writeFileSync(nestedPlanPath, planContent);

      const planData = await parsePlanForSync(nestedPlanPath);

      // Should extract phase from directory name
      expect(planData.frontmatter.phase).toBe('05-feature');
    });
  });

  describe('Task ID Generation', () => {
    test('generates IDs with correct format', () => {
      expect(generateTaskId('01-foundation', 1, 1)).toBe('01-01-01');
      expect(generateTaskId('06-sync', 2, 3)).toBe('06-02-03');
      expect(generateTaskId('15-advanced', 10, 12)).toBe('15-10-12');
    });

    test('pads single digit values', () => {
      expect(generateTaskId('5', 3, 7)).toBe('05-03-07');
    });

    test('handles phase with suffix', () => {
      expect(generateTaskId('22-test-coverage', 4, 2)).toBe('22-04-02');
    });
  });

  describe('Task Prompt Formatting', () => {
    test('formats auto task prompts with all sections', async () => {
      const planContent = `---
phase: 01-test
plan: 1
wave: 1
---

<tasks>
<task type="auto">
  <name>Task 1: Comprehensive task</name>
  <files>src/main.ts, src/utils.ts</files>
  <action>
1. Read the existing file
2. Make modifications
3. Add error handling
  </action>
  <verify>npm run test && npm run typecheck</verify>
  <done>All tests pass and no type errors</done>
</task>
</tasks>
`;

      writeFileSync(planPath, planContent);
      const planData = await parsePlanForSync(planPath);
      const task = planData.tasks[0];

      const prompt = formatTaskPrompt(task);

      expect(prompt).toContain('# Task 1: Comprehensive task');
      expect(prompt).toContain('## Files');
      expect(prompt).toContain('src/main.ts');
      expect(prompt).toContain('## Action');
      expect(prompt).toContain('Make modifications');
      expect(prompt).toContain('## Verification');
      expect(prompt).toContain('npm run test');
      expect(prompt).toContain('## Done Criteria');
      expect(prompt).toContain('All tests pass');
    });
  });

  describe('Progress Tracking Integration', () => {
    test('calculates progress for multiple tasks', async () => {
      const planContent = `---
phase: 01-test
plan: 1
wave: 1
---

<tasks>
<task type="auto">
  <name>Task 1: First</name>
  <files>a.ts</files>
  <action>Do A</action>
  <verify>test</verify>
  <done>A done</done>
</task>
<task type="auto">
  <name>Task 2: Second</name>
  <files>b.ts</files>
  <action>Do B</action>
  <verify>test</verify>
  <done>B done</done>
</task>
<task type="auto">
  <name>Task 3: Third</name>
  <files>c.ts</files>
  <action>Do C</action>
  <verify>test</verify>
  <done>C done</done>
</task>
</tasks>
`;

      writeFileSync(planPath, planContent);
      const planData = await parsePlanForSync(planPath);
      const mappings = extractTaskMappings(planData);

      // Initially all pending
      const initialProgress = calculateProgress(mappings);
      expect(initialProgress.total).toBe(3);
      expect(initialProgress.pending).toBe(3);
      expect(initialProgress.completed).toBe(0);
      expect(isAllComplete(mappings)).toBe(false);

      // Mark first task complete
      mappings[0].status = 'completed';
      const partialProgress = calculateProgress(mappings);
      expect(partialProgress.completed).toBe(1);
      expect(partialProgress.pending).toBe(2);
      expect(partialProgress.percentComplete).toBeCloseTo(33.33, 0);

      // Mark all complete
      mappings[1].status = 'completed';
      mappings[2].status = 'completed';
      expect(isAllComplete(mappings)).toBe(true);

      const finalProgress = calculateProgress(mappings);
      expect(finalProgress.percentComplete).toBe(100);
    });

    test('formats progress for display', async () => {
      const planContent = `---
phase: 01-test
plan: 1
wave: 1
---

<tasks>
<task type="auto">
  <name>Task 1: Test</name>
  <files>a.ts</files>
  <action>Do</action>
  <verify>test</verify>
  <done>Done</done>
</task>
<task type="auto">
  <name>Task 2: Test2</name>
  <files>b.ts</files>
  <action>Do</action>
  <verify>test</verify>
  <done>Done</done>
</task>
</tasks>
`;

      writeFileSync(planPath, planContent);
      const planData = await parsePlanForSync(planPath);
      const mappings = extractTaskMappings(planData);

      mappings[0].status = 'completed';
      const progress = calculateProgress(mappings);
      const formatted = formatProgress(progress);

      expect(formatted).toContain('1');
      expect(formatted).toContain('2');
      expect(formatted).toContain('50');
    });

    test('identifies ready tasks for execution', async () => {
      const planContent = `---
phase: 01-test
plan: 1
wave: 1
---

<tasks>
<task type="auto">
  <name>Task 1: Ready</name>
  <files>a.ts</files>
  <action>Do A</action>
  <verify>test</verify>
  <done>A done</done>
</task>
<task type="auto">
  <name>Task 2: Also Ready</name>
  <files>b.ts</files>
  <action>Do B</action>
  <verify>test</verify>
  <done>B done</done>
</task>
</tasks>
`;

      writeFileSync(planPath, planContent);
      const planData = await parsePlanForSync(planPath);
      const mappings = extractTaskMappings(planData);

      // All tasks should be ready initially (pending and same wave)
      const readyTasks = getReadyTasks(mappings);
      expect(readyTasks).toHaveLength(2);

      // Mark first as in_progress
      mappings[0].status = 'in_progress';
      const stillReady = getReadyTasks(mappings);
      expect(stillReady).toHaveLength(1);
      expect(stillReady[0].task_id).toBe('01-01-02');
    });
  });

  describe('Multi-Wave Task Handling', () => {
    test('preserves wave information through pipeline', async () => {
      const wave1Content = `---
phase: 10-multiwave
plan: 1
wave: 1
---

<tasks>
<task type="auto">
  <name>Task 1: Wave 1 Task</name>
  <files>wave1.ts</files>
  <action>Wave 1 work</action>
  <verify>test</verify>
  <done>Done</done>
</task>
</tasks>
`;

      writeFileSync(planPath, wave1Content);
      const planData = await parsePlanForSync(planPath);
      const mappings = extractTaskMappings(planData);

      expect(mappings[0].wave).toBe(1);
      expect(mappings[0].task_id).toBe('10-01-01');
    });
  });
});
