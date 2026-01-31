/**
 * E2E Full Scenario Test
 *
 * Tests the complete Context Architect workflow with real .planning directory:
 * 1. Context Collection (project, phase, task)
 * 2. Context Injection (worker, orchestrator, planner, executor, architect)
 * 3. Context Compaction (for fresh-start)
 * 4. Hints (complexity, routing, combined)
 * 5. Prompt Generation (worker, orchestrator)
 */

import { describe, test, expect } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';

import {
  collectProjectContext,
  collectPhaseContext,
  collectTaskContext,
  collectContext,
} from '@/context/collector.js';

import {
  compactContext,
  formatCompactedContext,
} from '@/context/compactor.js';

import {
  injectWorkerContext,
  injectOrchestratorContext,
  injectPlannerContext,
  injectExecutorContext,
  injectArchitectContext,
  formatInjectedContext,
} from '@/context/injector.js';

import {
  suggestComplexity,
  suggestRoute,
  getTaskHints,
} from '@/hints/index.js';

import {
  generateWorkerPrompt,
  generateOrchestratorPrompt,
} from '@/prompts/index.js';

// ============================================================================
// Test Configuration - Use real .planning directory
// ============================================================================

const PLANNING_DIR = '.planning';
const hasRealPlanningDir = existsSync(PLANNING_DIR);

// Skip tests if no real .planning directory
const describeWithPlanning = hasRealPlanningDir ? describe : describe.skip;

// ============================================================================
// E2E Full Scenario Tests
// ============================================================================

describeWithPlanning('E2E Full Scenario - Context Architect v3.0', () => {
  // -------------------------------------------------------------------------
  // 1. Context Collection
  // -------------------------------------------------------------------------
  describe('1. Context Collection', () => {
    test('should collect project context from real .planning', () => {
      const ctx = collectProjectContext(PLANNING_DIR);

      expect(ctx.exists).toBe(true);
      expect(ctx.projectMd).toBeDefined();
      expect(ctx.projectMd).toContain('Ultra Planner');
      expect(ctx.roadmapMd).toBeDefined();
      expect(ctx.requirementsMd).toBeDefined();
    });

    test('should collect phase context', () => {
      // Find an existing phase
      const ctx = collectPhaseContext(10, PLANNING_DIR);

      expect(ctx.exists).toBe(true);
      expect(ctx.phaseNumber).toBe(10);
      expect(ctx.phaseName).toContain('10');
      expect(ctx.plans.length).toBeGreaterThanOrEqual(0);
    });

    test('should collect task context', () => {
      const ctx = collectTaskContext('10-01', PLANNING_DIR);

      // May or may not exist depending on project state
      if (ctx.exists) {
        expect(ctx.planId).toBe('10-01');
        expect(ctx.planMd).toBeDefined();
      }
    });

    test('should collect combined context', () => {
      const ctx = collectContext({
        planId: '10-01',
        includeProject: true,
        includePhase: true,
        planningDir: PLANNING_DIR,
      });

      expect(ctx.project?.exists).toBe(true);
      expect(ctx.timestamp).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Context Injection
  // -------------------------------------------------------------------------
  describe('2. Context Injection', () => {
    const ctx = collectContext({
      planId: '10-01',
      includeProject: true,
      includePhase: true,
      planningDir: PLANNING_DIR,
    });

    test('should inject worker context', () => {
      const injected = injectWorkerContext(ctx);

      expect(injected.role).toBe('worker');
      expect(injected.sections.length).toBeGreaterThan(0);
      expect(injected.totalTokens).toBeGreaterThan(0);

      const formatted = formatInjectedContext(injected);
      expect(formatted).toContain('<context>');
    });

    test('should inject orchestrator context', () => {
      const injected = injectOrchestratorContext(ctx);

      expect(injected.role).toBe('orchestrator');
      expect(injected.sections.length).toBeGreaterThan(0);
    });

    test('should inject planner context', () => {
      const injected = injectPlannerContext(ctx);

      expect(injected.role).toBe('planner');
      // Planner should get project and requirements
      const hasProject = injected.sections.some(s => s.title === 'Project');
      expect(hasProject).toBe(true);
    });

    test('should inject executor context', () => {
      const injected = injectExecutorContext(ctx);

      expect(injected.role).toBe('executor');
      expect(injected.totalTokens).toBeGreaterThan(0);
    });

    test('should inject architect context', () => {
      const injected = injectArchitectContext(ctx);

      expect(injected.role).toBe('architect');
      // Architect should get requirements for verification
      const hasRequirements = injected.sections.some(s => s.title === 'Requirements');
      expect(hasRequirements).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Context Compaction
  // -------------------------------------------------------------------------
  describe('3. Context Compaction', () => {
    test('should compact context for fresh-start', () => {
      const ctx = collectContext({
        planId: '10-01',
        includeProject: true,
        includePhase: true,
        planningDir: PLANNING_DIR,
      });

      const compacted = compactContext(ctx, { planningDir: PLANNING_DIR });

      expect(compacted.snapshotId).toBeDefined();
      expect(compacted.timestamp).toBeDefined();
      expect(compacted.projectSummary).toBeDefined();
      expect(compacted.originalTokens).toBeGreaterThan(0);
      expect(compacted.compactedTokens).toBeGreaterThan(0);
      // Compression should reduce size
      expect(compacted.compactedTokens).toBeLessThanOrEqual(compacted.originalTokens);
    });

    test('should format compacted context for prompts', () => {
      const ctx = collectContext({
        planId: '10-01',
        planningDir: PLANNING_DIR,
      });

      const compacted = compactContext(ctx, { planningDir: PLANNING_DIR });
      const formatted = formatCompactedContext(compacted);

      expect(formatted).toContain('Session Context (Restored)');
      expect(formatted).toContain('Project Summary');
      expect(formatted).toContain('Phase State');
      expect(formatted).toContain('tokens');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Hints (AI decides, not rules)
  // -------------------------------------------------------------------------
  describe('4. Hints (AI Suggestions)', () => {
    test('should suggest complexity with isHint flag', () => {
      const hint = suggestComplexity({
        taskDescription: 'Fix typo in README',
        files: ['README.md'],
      });

      expect(hint.isHint).toBe(true);
      expect(hint.level).toBeGreaterThanOrEqual(1);
      expect(hint.level).toBeLessThanOrEqual(5);
      expect(hint.category).toBeDefined();
      expect(hint.confidence).toBeGreaterThanOrEqual(0);
      expect(hint.confidence).toBeLessThanOrEqual(1);
    });

    test('should suggest higher complexity for multi-file tasks', () => {
      const simpleHint = suggestComplexity({
        taskDescription: 'Fix typo',
        files: ['README.md'],
      });

      const complexHint = suggestComplexity({
        taskDescription: 'Refactor authentication with OAuth',
        files: ['auth.ts', 'middleware.ts', 'routes.ts', 'config.ts', 'types.ts'],
      });

      expect(complexHint.level).toBeGreaterThanOrEqual(simpleHint.level);
    });

    test('should suggest routing with isHint flag', () => {
      const hint = suggestRoute({
        taskDescription: 'Debug race condition in cache',
        contextHints: { isDebugging: true },
      });

      expect(hint.isHint).toBe(true);
      expect(hint.agent).toBeDefined();
      expect(hint.model).toBeDefined();
      expect(hint.confidence).toBeGreaterThanOrEqual(0);
    });

    test('should get all hints in one call', () => {
      const hints = getTaskHints({
        taskDescription: 'Implement user dashboard with charts',
        files: ['Dashboard.tsx', 'Charts.tsx', 'api.ts'],
      });

      expect(hints.complexity?.isHint).toBe(true);
      expect(hints.routing?.isHint).toBe(true);
      expect(hints.model?.tier).toBeDefined();
      expect(hints.message).toContain('Ultra Planner Hints');
      expect(hints.message).toContain('judgment');
    });
  });

  // -------------------------------------------------------------------------
  // 5. Prompt Generation
  // -------------------------------------------------------------------------
  describe('5. Prompt Generation', () => {
    test('should generate worker prompt', () => {
      const result = generateWorkerPrompt({
        worker: { id: 'w1', name: 'Test Worker', index: 0 },
        planPath: '.planning/phases/10-context-management/10-01-PLAN.md',
        learnings: '## Learnings\n- Context is important',
      });

      expect(result.prompt).toContain('Test Worker');
      expect(result.prompt.length).toBeGreaterThan(100);
    });

    test('should generate orchestrator prompt', () => {
      const result = generateOrchestratorPrompt({
        planPath: '.planning/phases/10-context-management/10-01-PLAN.md',
        workerCount: 3,
      });

      expect(result.prompt).toContain('3');
      expect(result.prompt).toContain('worker');
      expect(result.prompt.length).toBeGreaterThan(100);
    });

    test('should include context in generated prompts', () => {
      const ctx = collectContext({
        planId: '10-01',
        planningDir: PLANNING_DIR,
      });

      const injected = injectWorkerContext(ctx);
      const formatted = formatInjectedContext(injected);

      const result = generateWorkerPrompt({
        worker: { id: 'w1', name: 'Context Worker', index: 0 },
        learnings: formatted,
      });

      // If context was injected, it should appear in learnings section
      if (formatted.length > 0) {
        expect(result.prompt.length).toBeGreaterThan(formatted.length);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 6. Full E2E Flow
  // -------------------------------------------------------------------------
  describe('6. Full E2E Flow', () => {
    test('should complete: collect -> inject -> compact -> hint -> prompt', () => {
      // 1. Collect context
      const ctx = collectContext({
        planId: '10-01',
        includeProject: true,
        includePhase: true,
        planningDir: PLANNING_DIR,
      });
      expect(ctx.project?.exists).toBe(true);

      // 2. Inject context for worker
      const injected = injectWorkerContext(ctx);
      expect(injected.sections.length).toBeGreaterThan(0);

      // 3. Compact context (for potential fresh-start)
      const compacted = compactContext(ctx, { planningDir: PLANNING_DIR });
      expect(compacted.snapshotId).toBeDefined();

      // 4. Get hints for the task
      const hints = getTaskHints({
        taskDescription: 'Implement context management module',
        files: ['collector.ts', 'injector.ts', 'compactor.ts'],
      });
      expect(hints.complexity?.isHint).toBe(true);
      expect(hints.routing?.isHint).toBe(true);

      // 5. Generate worker prompt with context
      const formatted = formatInjectedContext(injected);
      const prompt = generateWorkerPrompt({
        worker: { id: 'w1', name: 'Context Module Worker', index: 0 },
        planPath: '.planning/phases/10-context-management/10-01-PLAN.md',
        learnings: formatted,
      });
      expect(prompt.prompt).toContain('Context Module Worker');

      // End-to-end flow complete!
      console.log('\n✅ Full E2E Flow Complete:');
      console.log(`   - Context collected: ${ctx.project?.exists ? 'Yes' : 'No'}`);
      console.log(`   - Sections injected: ${injected.sections.length}`);
      console.log(`   - Tokens compacted: ${compacted.originalTokens} → ${compacted.compactedTokens}`);
      console.log(`   - Hints: Level ${hints.complexity?.level}, ${hints.routing?.agent}`);
      console.log(`   - Prompt length: ${prompt.prompt.length} chars`);
    });
  });
});
