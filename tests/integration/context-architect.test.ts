/**
 * Context Architect E2E Integration Tests
 *
 * Tests the v3.0 Context Architect pattern:
 * - Context collection from .planning files
 * - Context injection for different agent roles
 * - Context compaction for fresh-start
 * - Hints integration (AI decides, not rules)
 * - Wisdom integration
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestWorkspace, cleanupWorkspace } from '../helpers/temp-dir.js';

// Context module imports
import {
  collectProjectContext,
  collectPhaseContext,
  collectTaskContext,
  collectContext,
} from '@/context/collector.js';
import {
  compactContext,
  saveContextSnapshot,
  restoreContext,
  formatCompactedContext,
} from '@/context/compactor.js';
import {
  injectWorkerContext,
  injectOrchestratorContext,
  injectPlannerContext,
  injectExecutorContext,
  injectArchitectContext,
  injectCriticContext,
  injectContext,
  formatInjectedContext,
} from '@/context/injector.js';

// Hints module imports
import {
  suggestComplexity,
  suggestRoute,
  getTaskHints,
} from '@/hints/index.js';

// Prompts module imports
import {
  generateWorkerPrompt,
  generateOrchestratorPrompt,
} from '@/prompts/index.js';

// ============================================================================
// Test State
// ============================================================================

let testWorkspace: string;

beforeEach(() => {
  testWorkspace = createTestWorkspace();
  // Setup .planning directory structure
  setupPlanningStructure(testWorkspace);
});

afterEach(() => {
  cleanupWorkspace(testWorkspace);
});

/**
 * Setup a realistic .planning structure for testing
 */
function setupPlanningStructure(workspace: string): void {
  const planningDir = join(workspace, '.planning');
  mkdirSync(planningDir, { recursive: true });

  // Create PROJECT.md
  const projectMd = `---
name: Test Project
version: 1.0.0
core_value: "Test the Context Architect pattern"
---

# Test Project

## Overview

This is a test project for validating the Context Architect pattern.

## What This Is

A project to test context collection and injection.

## Requirements

### Validated
- Context collection works
- Context injection works

### Active
- Integration testing
`;

  writeFileSync(join(planningDir, 'PROJECT.md'), projectMd);

  // Create ROADMAP.md
  const roadmapMd = `# Roadmap

## Phase 1: Foundation

- [ ] Setup project structure
- [ ] Create core modules

## Phase 2: Features

- [ ] Add context collection
- [ ] Add context injection
`;

  writeFileSync(join(planningDir, 'ROADMAP.md'), roadmapMd);

  // Create REQUIREMENTS.md
  const requirementsMd = `# Requirements

## Functional
- Must collect context from files
- Must inject context into prompts

## Non-Functional
- Must be efficient
- Must handle missing files gracefully
`;

  writeFileSync(join(planningDir, 'REQUIREMENTS.md'), requirementsMd);

  // Create phase directory
  const phaseDir = join(planningDir, 'phases', '01-foundation');
  mkdirSync(phaseDir, { recursive: true });

  // Create research file
  const researchMd = `# Phase 1 Research

## Findings

- Context Architect pattern improves modularity
- AI should make final decisions
`;

  writeFileSync(join(phaseDir, '01-RESEARCH.md'), researchMd);

  // Create plan file
  const planMd = `---
phase: "01-foundation"
plan: 1
wave: 1
task_states: {}
---

# Plan 01-01: Setup Foundation

## Objective

Setup the project foundation.

## Tasks

### Wave 1

#### Task 1: Create project structure
- **Files**: package.json, tsconfig.json
- **Action**: Initialize the project
- **Verify**: npm run build
- **Done**: Build passes
`;

  writeFileSync(join(phaseDir, '01-01-PLAN.md'), planMd);

  // Create summary file
  const summaryMd = `# Summary 01-01

## Completed Tasks

1. Created project structure
2. Verified build passes
`;

  writeFileSync(join(phaseDir, '01-01-SUMMARY.md'), summaryMd);
}

// ============================================================================
// Test Suite: Context Collection
// ============================================================================

describe('Context Collection', () => {
  test('should collect project context from PROJECT.md', () => {
    const planningDir = join(testWorkspace, '.planning');
    const ctx = collectProjectContext(planningDir);

    expect(ctx.exists).toBe(true);
    expect(ctx.projectMd).toBeDefined();
    expect(ctx.projectMd).toContain('Test Project');
    expect(ctx.projectMd).toContain('Context Architect');
    expect(ctx.roadmapMd).toBeDefined();
    expect(ctx.roadmapMd).toContain('Foundation');
    expect(ctx.requirementsMd).toBeDefined();
  });

  test('should handle non-existent planning directory', () => {
    const ctx = collectProjectContext('/non/existent/path');

    expect(ctx.exists).toBe(false);
    expect(ctx.projectMd).toBeUndefined();
    expect(ctx.roadmapMd).toBeUndefined();
  });

  test('should collect phase context', () => {
    const planningDir = join(testWorkspace, '.planning');
    const ctx = collectPhaseContext(1, planningDir);

    expect(ctx.exists).toBe(true);
    expect(ctx.phaseNumber).toBe(1);
    expect(ctx.phaseName).toBe('01-foundation');
    expect(ctx.researchMd).toBeDefined();
    expect(ctx.researchMd).toContain('Context Architect');
    expect(ctx.plans.length).toBe(1);
    expect(ctx.summaries.length).toBe(1);
  });

  test('should collect task context', () => {
    const planningDir = join(testWorkspace, '.planning');
    const ctx = collectTaskContext('01-01', planningDir);

    expect(ctx.exists).toBe(true);
    expect(ctx.planId).toBe('01-01');
    expect(ctx.planMd).toBeDefined();
    expect(ctx.planMd).toContain('Setup Foundation');
    expect(ctx.summaryMd).toBeDefined();
  });

  test('should collect combined context', () => {
    const planningDir = join(testWorkspace, '.planning');
    const ctx = collectContext({
      planId: '01-01',
      includeProject: true,
      includePhase: true,
      planningDir,
    });

    expect(ctx.project?.exists).toBe(true);
    expect(ctx.phase?.exists).toBe(true);
    expect(ctx.task?.exists).toBe(true);
    expect(ctx.timestamp).toBeDefined();
  });
});

// ============================================================================
// Test Suite: Context Injection
// ============================================================================

describe('Context Injection', () => {
  test('should inject worker context', () => {
    const planningDir = join(testWorkspace, '.planning');
    const ctx = collectContext({ planId: '01-01', planningDir });
    const injected = injectWorkerContext(ctx);

    expect(injected.role).toBe('worker');
    expect(injected.sections.length).toBeGreaterThan(0);
    expect(injected.totalTokens).toBeGreaterThan(0);
    // Worker gets task plan
    const formatted = formatInjectedContext(injected);
    expect(formatted).toContain('context');
  });

  test('should inject orchestrator context', () => {
    const planningDir = join(testWorkspace, '.planning');
    const ctx = collectContext({ planId: '01-01', planningDir });
    const injected = injectOrchestratorContext(ctx);

    expect(injected.role).toBe('orchestrator');
    expect(injected.sections.length).toBeGreaterThan(0);
    // Orchestrator gets roadmap
    const hasRoadmap = injected.sections.some(s => s.title === 'Roadmap');
    expect(hasRoadmap).toBe(true);
  });

  test('should inject planner context', () => {
    const planningDir = join(testWorkspace, '.planning');
    const ctx = collectContext({ planId: '01-01', planningDir });
    const injected = injectPlannerContext(ctx);

    expect(injected.role).toBe('planner');
    expect(injected.sections.length).toBeGreaterThan(0);
    // Planner gets project and requirements
    const hasProject = injected.sections.some(s => s.title === 'Project');
    expect(hasProject).toBe(true);
  });

  test('should inject executor context', () => {
    const planningDir = join(testWorkspace, '.planning');
    const ctx = collectContext({ planId: '01-01', planningDir });
    const injected = injectExecutorContext(ctx);

    expect(injected.role).toBe('executor');
    expect(injected.sections.length).toBeGreaterThan(0);
    // Executor gets task plan
    const hasTaskPlan = injected.sections.some(s => s.title === 'Task Plan');
    expect(hasTaskPlan).toBe(true);
  });

  test('should inject architect context', () => {
    const planningDir = join(testWorkspace, '.planning');
    const ctx = collectContext({ planId: '01-01', planningDir });
    const injected = injectArchitectContext(ctx);

    expect(injected.role).toBe('architect');
    expect(injected.sections.length).toBeGreaterThan(0);
    // Architect gets task to verify and requirements
    const hasTask = injected.sections.some(s => s.title === 'Task to Verify');
    expect(hasTask).toBe(true);
  });

  test('should inject critic context', () => {
    const planningDir = join(testWorkspace, '.planning');
    const ctx = collectContext({ planId: '01-01', planningDir });
    const injected = injectCriticContext(ctx);

    expect(injected.role).toBe('critic');
    expect(injected.sections.length).toBeGreaterThan(0);
    // Critic gets plan to review
    const hasPlan = injected.sections.some(s => s.title === 'Plan to Review');
    expect(hasPlan).toBe(true);
  });

  test('should route to correct injector by role', () => {
    const planningDir = join(testWorkspace, '.planning');
    const ctx = collectContext({ planId: '01-01', planningDir });

    const workerInjected = injectContext('worker', ctx);
    expect(workerInjected.role).toBe('worker');

    const executorInjected = injectContext('executor', ctx);
    expect(executorInjected.role).toBe('executor');
  });
});

// ============================================================================
// Test Suite: Context Compaction
// ============================================================================

describe('Context Compaction', () => {
  test('should compact context for fresh-start', () => {
    const planningDir = join(testWorkspace, '.planning');
    const ctx = collectContext({ planId: '01-01', planningDir });
    const compacted = compactContext(ctx, { planningDir });

    expect(compacted.snapshotId).toBeDefined();
    expect(compacted.timestamp).toBeDefined();
    expect(compacted.projectSummary).toBeDefined();
    expect(compacted.phaseState.phaseNumber).toBe(1);
    expect(compacted.originalTokens).toBeGreaterThan(0);
    expect(compacted.compactedTokens).toBeGreaterThan(0);
    expect(compacted.compactedTokens).toBeLessThanOrEqual(compacted.originalTokens);
  });

  test('should save and restore context snapshot', () => {
    const planningDir = join(testWorkspace, '.planning');
    const snapshotDir = join(testWorkspace, '.omc', 'snapshots');

    const ctx = collectContext({ planId: '01-01', planningDir });
    const compacted = compactContext(ctx, { planningDir });

    // Save snapshot
    const filepath = saveContextSnapshot(compacted, { snapshotDir });
    expect(existsSync(filepath)).toBe(true);

    // Restore snapshot
    const restored = restoreContext(compacted.snapshotId, { snapshotDir });
    expect(restored).not.toBeNull();
    expect(restored?.snapshotId).toBe(compacted.snapshotId);
    expect(restored?.projectSummary).toBe(compacted.projectSummary);
  });

  test('should restore latest snapshot', () => {
    const planningDir = join(testWorkspace, '.planning');
    const snapshotDir = join(testWorkspace, '.omc', 'snapshots');

    // Create multiple snapshots
    const ctx = collectContext({ planId: '01-01', planningDir });
    const compacted1 = compactContext(ctx, { planningDir });
    saveContextSnapshot(compacted1, { snapshotDir });

    // Create another snapshot
    const compacted2 = compactContext(ctx, { planningDir });
    saveContextSnapshot(compacted2, { snapshotDir });

    // Restore latest - should get one of the snapshots
    const restored = restoreContext('latest', { snapshotDir });
    expect(restored).not.toBeNull();
    // Should be one of the two snapshots (timing may cause either to be "latest")
    expect([compacted1.snapshotId, compacted2.snapshotId]).toContain(restored?.snapshotId);
    expect(restored?.projectSummary).toBeDefined();
  });

  test('should format compacted context for prompts', () => {
    const planningDir = join(testWorkspace, '.planning');
    const ctx = collectContext({ planId: '01-01', planningDir });
    const compacted = compactContext(ctx, { planningDir });
    const formatted = formatCompactedContext(compacted);

    expect(formatted).toContain('# Session Context (Restored)');
    expect(formatted).toContain('## Project Summary');
    expect(formatted).toContain('## Phase State');
    expect(formatted).toContain('## Progress');
    expect(formatted).toContain('tokens');
  });
});

// ============================================================================
// Test Suite: Hints Integration
// ============================================================================

describe('Hints Integration', () => {
  test('should provide complexity hints with isHint flag', () => {
    const hint = suggestComplexity({
      taskDescription: 'Add user authentication with OAuth',
      files: ['auth.ts', 'middleware.ts', 'routes.ts'],
    });

    expect(hint.isHint).toBe(true);
    expect(hint.level).toBeGreaterThan(0);
    expect(hint.level).toBeLessThanOrEqual(5);
    expect(hint.confidence).toBeGreaterThanOrEqual(0);
    expect(hint.confidence).toBeLessThanOrEqual(1);
  });

  test('should provide routing hints with isHint flag', () => {
    const hint = suggestRoute({
      taskDescription: 'Debug race condition in cache',
      isDebugging: true,
    });

    expect(hint.isHint).toBe(true);
    expect(hint.agent).toBeDefined();
    expect(hint.model).toBeDefined();
    expect(hint.confidence).toBeGreaterThanOrEqual(0);
  });

  test('should get all task hints in one call', () => {
    const hints = getTaskHints({
      taskDescription: 'Implement user registration form',
      files: ['UserForm.tsx', 'api.ts'],
    });

    expect(hints.complexity).toBeDefined();
    expect(hints.complexity.isHint).toBe(true);
    expect(hints.routing).toBeDefined();
    expect(hints.routing.isHint).toBe(true);
    expect(hints.model).toBeDefined();
    expect(hints.message).toContain('Ultra Planner Hints');
  });

  test('hints should NOT be rules - AI decides', () => {
    // High complexity task
    const complexHint = suggestComplexity({
      taskDescription: 'Simple typo fix',
      files: ['readme.md'],
    });

    // Even if our hint says one thing, AI can override
    // The isHint flag indicates this is a suggestion, not a rule
    expect(complexHint.isHint).toBe(true);

    // The message should indicate AI has final authority
    const hints = getTaskHints({
      taskDescription: 'Simple task',
    });
    expect(hints.message).toContain('judgment');
    expect(hints.message).toContain('final authority');
  });
});

// ============================================================================
// Test Suite: E2E Context Architect Flow
// ============================================================================

describe('E2E Context Architect Flow', () => {
  test('should complete full flow: collect -> inject -> hint -> prompt', () => {
    const planningDir = join(testWorkspace, '.planning');

    // 1. Collect context
    const ctx = collectContext({
      planId: '01-01',
      includeProject: true,
      includePhase: true,
      planningDir,
    });

    expect(ctx.project?.exists).toBe(true);
    expect(ctx.phase?.exists).toBe(true);
    expect(ctx.task?.exists).toBe(true);

    // 2. Inject context for worker role
    const injected = injectWorkerContext(ctx);
    const formattedContext = formatInjectedContext(injected);
    expect(formattedContext.length).toBeGreaterThan(0);

    // 3. Get hints for the task
    const hints = getTaskHints({
      taskDescription: 'Implement context collection module',
      files: ['collector.ts'],
    });
    expect(hints.complexity).toBeDefined();
    expect(hints.routing).toBeDefined();

    // 4. Generate worker prompt with context
    const promptResult = generateWorkerPrompt({
      worker: {
        id: 'worker-1',
        name: 'Context Worker',
        index: 0,
      },
      planPath: join(planningDir, 'phases', '01-foundation', '01-01-PLAN.md'),
      learnings: formattedContext,
    });

    // Verify prompt includes context
    expect(promptResult.prompt).toContain('Context Worker');
    expect(promptResult.prompt.length).toBeGreaterThan(100);
  });

  test('should handle fresh-start scenario', () => {
    const planningDir = join(testWorkspace, '.planning');
    const snapshotDir = join(testWorkspace, '.omc', 'snapshots');

    // 1. Collect and compact context (before reset)
    const ctx = collectContext({ planId: '01-01', planningDir });
    const compacted = compactContext(ctx, { planningDir });
    saveContextSnapshot(compacted, { snapshotDir });

    // 2. Simulate fresh-start (conversation reset)
    // In real scenario, all context would be lost here

    // 3. Restore context
    const restored = restoreContext('latest', { snapshotDir });
    expect(restored).not.toBeNull();

    // 4. Inject restored context
    const formatted = formatCompactedContext(restored!);
    expect(formatted).toContain('Session Context (Restored)');
    expect(formatted).toContain(restored!.projectSummary);

    // 5. Can continue working with restored context
    expect(restored!.phaseState.phaseNumber).toBe(1);
    expect(restored!.activeTask?.planId).toBe('01-01');
  });

  test('orchestrator flow with multiple agents', () => {
    const planningDir = join(testWorkspace, '.planning');

    // 1. Collect full context
    const ctx = collectContext({
      planId: '01-01',
      includeProject: true,
      includePhase: true,
      planningDir,
    });

    // 2. Generate orchestrator prompt
    const orchestratorPromptResult = generateOrchestratorPrompt({
      planPath: join(planningDir, 'phases', '01-foundation', '01-01-PLAN.md'),
      workerCount: 3,
    });

    // Check the prompt property, not the object
    expect(orchestratorPromptResult.prompt).toContain('Orchestrator');
    expect(orchestratorPromptResult.prompt).toContain('worker');

    // 3. Generate prompts for each worker with different roles
    const roles = ['worker', 'executor', 'architect'] as const;
    const injectedContexts = roles.map(role => injectContext(role, ctx));

    // Each role should have different context
    expect(injectedContexts[0].role).toBe('worker');
    expect(injectedContexts[1].role).toBe('executor');
    expect(injectedContexts[2].role).toBe('architect');

    // All should have valid sections and tokens
    injectedContexts.forEach(injected => {
      expect(injected.sections.length).toBeGreaterThan(0);
      expect(injected.totalTokens).toBeGreaterThan(0);
    });
  });
});
