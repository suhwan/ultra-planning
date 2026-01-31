/**
 * E2E Full Scenario Test
 *
 * Tests the complete Context Architect workflow:
 * 1. Context Collection (project, phase, task)
 * 2. Context Injection (worker, orchestrator, planner)
 * 3. Context Compaction (for fresh-start)
 * 4. Hints (complexity, routing)
 * 5. Prompt Generation
 */

import { describe, test, expect, beforeAll } from 'vitest';
import {
  collectProjectContext,
  collectPhaseContext,
  collectTaskContext,
  collectContext,
} from '../src/context/collector.js';

import {
  compactContext,
  formatCompactedContext,
} from '../src/context/compactor.js';

import {
  injectWorkerContext,
  injectOrchestratorContext,
  injectPlannerContext,
  injectExecutorContext,
  injectArchitectContext,
  formatInjectedContext,
} from '../src/context/injector.js';

import {
  suggestComplexity,
  suggestRoute,
  getTaskHints,
} from '../src/hints/index.js';

import {
  generateWorkerPrompt,
  generateOrchestratorPrompt,
} from '../src/prompts/index.js';

// ============================================================================
// Test Configuration
// ============================================================================

const PLANNING_DIR = '.planning';
const TEST_PHASE = 10; // Phase 10 from actual project
const TEST_PLAN_ID = '10-01';

// ============================================================================
// Test Runner
// ============================================================================

async function runE2EScenario() {
  console.log('='.repeat(60));
  console.log('E2E Full Scenario Test - Context Architect v3.0');
  console.log('='.repeat(60));
  console.log('');

  let passed = 0;
  let failed = 0;

  // -------------------------------------------------------------------------
  // 1. Context Collection Tests
  // -------------------------------------------------------------------------
  console.log('## 1. Context Collection\n');

  // 1.1 Project Context
  try {
    const projectCtx = collectProjectContext(PLANNING_DIR);
    console.log(`✓ collectProjectContext()`);
    console.log(`  - exists: ${projectCtx.exists}`);
    console.log(`  - PROJECT.md: ${projectCtx.projectMd ? 'Yes' : 'No'}`);
    console.log(`  - ROADMAP.md: ${projectCtx.roadmapMd ? 'Yes' : 'No'}`);
    console.log(`  - REQUIREMENTS.md: ${projectCtx.requirementsMd ? 'Yes' : 'No'}`);
    passed++;
  } catch (e) {
    console.log(`✗ collectProjectContext() - ${e}`);
    failed++;
  }

  // 1.2 Phase Context
  try {
    const phaseCtx = collectPhaseContext(TEST_PHASE, PLANNING_DIR);
    console.log(`\n✓ collectPhaseContext(${TEST_PHASE})`);
    console.log(`  - exists: ${phaseCtx.exists}`);
    console.log(`  - phaseName: ${phaseCtx.phaseName}`);
    console.log(`  - RESEARCH.md: ${phaseCtx.researchMd ? 'Yes' : 'No'}`);
    console.log(`  - plans: ${phaseCtx.plans.length}`);
    console.log(`  - summaries: ${phaseCtx.summaries.length}`);
    passed++;
  } catch (e) {
    console.log(`✗ collectPhaseContext() - ${e}`);
    failed++;
  }

  // 1.3 Task Context
  try {
    const taskCtx = collectTaskContext(TEST_PLAN_ID, PLANNING_DIR);
    console.log(`\n✓ collectTaskContext('${TEST_PLAN_ID}')`);
    console.log(`  - exists: ${taskCtx.exists}`);
    console.log(`  - planId: ${taskCtx.planId}`);
    console.log(`  - PLAN.md: ${taskCtx.planMd ? 'Yes' : 'No'}`);
    console.log(`  - SUMMARY.md: ${taskCtx.summaryMd ? 'Yes' : 'No'}`);
    passed++;
  } catch (e) {
    console.log(`✗ collectTaskContext() - ${e}`);
    failed++;
  }

  // 1.4 Combined Context
  try {
    const combinedCtx = collectContext({
      planId: TEST_PLAN_ID,
      includeProject: true,
      includePhase: true,
      planningDir: PLANNING_DIR,
    });
    console.log(`\n✓ collectContext() - Combined`);
    console.log(`  - project.exists: ${combinedCtx.project?.exists}`);
    console.log(`  - phase.exists: ${combinedCtx.phase?.exists}`);
    console.log(`  - task.exists: ${combinedCtx.task?.exists}`);
    passed++;
  } catch (e) {
    console.log(`✗ collectContext() - ${e}`);
    failed++;
  }

  // -------------------------------------------------------------------------
  // 2. Context Injection Tests
  // -------------------------------------------------------------------------
  console.log('\n## 2. Context Injection\n');

  const ctx = collectContext({
    planId: TEST_PLAN_ID,
    includeProject: true,
    includePhase: true,
    planningDir: PLANNING_DIR,
  });

  const roles = [
    { name: 'worker', fn: injectWorkerContext },
    { name: 'orchestrator', fn: injectOrchestratorContext },
    { name: 'planner', fn: injectPlannerContext },
    { name: 'executor', fn: injectExecutorContext },
    { name: 'architect', fn: injectArchitectContext },
  ];

  for (const { name, fn } of roles) {
    try {
      const injected = fn(ctx);
      const formatted = formatInjectedContext(injected);
      console.log(`✓ inject${name.charAt(0).toUpperCase() + name.slice(1)}Context()`);
      console.log(`  - role: ${injected.role}`);
      console.log(`  - sections: ${injected.sections.length}`);
      console.log(`  - totalTokens: ${injected.totalTokens}`);
      console.log(`  - formatted length: ${formatted.length} chars`);
      passed++;
    } catch (e) {
      console.log(`✗ inject${name}Context() - ${e}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // 3. Context Compaction Tests
  // -------------------------------------------------------------------------
  console.log('\n## 3. Context Compaction\n');

  try {
    const compacted = compactContext(ctx, { planningDir: PLANNING_DIR });
    const formatted = formatCompactedContext(compacted);
    console.log(`✓ compactContext()`);
    console.log(`  - snapshotId: ${compacted.snapshotId}`);
    console.log(`  - originalTokens: ${compacted.originalTokens}`);
    console.log(`  - compactedTokens: ${compacted.compactedTokens}`);
    console.log(`  - compression: ${((1 - compacted.compactedTokens / compacted.originalTokens) * 100).toFixed(1)}%`);
    console.log(`  - phaseState: Phase ${compacted.phaseState.phaseNumber}`);
    console.log(`  - decisions: ${compacted.decisions.length}`);
    console.log(`  - learnings: ${compacted.learnings.length}`);
    console.log(`  - issues: ${compacted.issues.length}`);
    passed++;
  } catch (e) {
    console.log(`✗ compactContext() - ${e}`);
    failed++;
  }

  // -------------------------------------------------------------------------
  // 4. Hints Tests
  // -------------------------------------------------------------------------
  console.log('\n## 4. Hints (AI Suggestions)\n');

  const testTasks = [
    { desc: 'Fix typo in README', files: ['README.md'] },
    { desc: 'Add user authentication with OAuth', files: ['auth.ts', 'middleware.ts', 'routes.ts'] },
    { desc: 'Refactor database layer with new ORM', files: ['db/index.ts', 'db/models/', 'migrations/'] },
  ];

  for (const task of testTasks) {
    try {
      const complexity = suggestComplexity({
        taskDescription: task.desc,
        files: task.files,
      });
      console.log(`✓ suggestComplexity('${task.desc.slice(0, 30)}...')`);
      console.log(`  - isHint: ${complexity.isHint}`);
      console.log(`  - level: ${complexity.level}`);
      console.log(`  - category: ${complexity.category}`);
      console.log(`  - confidence: ${(complexity.confidence * 100).toFixed(0)}%`);
      passed++;
    } catch (e) {
      console.log(`✗ suggestComplexity() - ${e}`);
      failed++;
    }
  }

  // Routing hint
  try {
    const routing = suggestRoute({
      taskDescription: 'Debug race condition in cache layer',
      contextHints: { isDebugging: true },
    });
    console.log(`\n✓ suggestRoute(debugging task)`);
    console.log(`  - isHint: ${routing.isHint}`);
    console.log(`  - agent: ${routing.agent}`);
    console.log(`  - model: ${routing.model}`);
    console.log(`  - confidence: ${(routing.confidence * 100).toFixed(0)}%`);
    passed++;
  } catch (e) {
    console.log(`✗ suggestRoute() - ${e}`);
    failed++;
  }

  // Combined hints
  try {
    const hints = getTaskHints({
      taskDescription: 'Implement user dashboard with charts',
      files: ['Dashboard.tsx', 'Charts.tsx', 'api.ts'],
    });
    console.log(`\n✓ getTaskHints()`);
    console.log(`  - complexity.level: ${hints.complexity?.level}`);
    console.log(`  - routing.agent: ${hints.routing?.agent}`);
    console.log(`  - model.tier: ${hints.model?.tier}`);
    console.log(`  - message length: ${hints.message.length} chars`);
    passed++;
  } catch (e) {
    console.log(`✗ getTaskHints() - ${e}`);
    failed++;
  }

  // -------------------------------------------------------------------------
  // 5. Prompt Generation Tests
  // -------------------------------------------------------------------------
  console.log('\n## 5. Prompt Generation\n');

  // Worker prompt
  try {
    const workerPrompt = generateWorkerPrompt({
      worker: { id: 'w1', name: 'Test Worker', index: 0 },
      planPath: '.planning/phases/10-context-management/10-01-PLAN.md',
      learnings: 'Test learnings context',
    });
    console.log(`✓ generateWorkerPrompt()`);
    console.log(`  - prompt length: ${workerPrompt.prompt.length} chars`);
    console.log(`  - contains worker name: ${workerPrompt.prompt.includes('Test Worker')}`);
    passed++;
  } catch (e) {
    console.log(`✗ generateWorkerPrompt() - ${e}`);
    failed++;
  }

  // Orchestrator prompt
  try {
    const orchestratorPrompt = generateOrchestratorPrompt({
      planPath: '.planning/phases/10-context-management/10-01-PLAN.md',
      workerCount: 3,
    });
    console.log(`\n✓ generateOrchestratorPrompt()`);
    console.log(`  - prompt length: ${orchestratorPrompt.prompt.length} chars`);
    console.log(`  - contains worker count: ${orchestratorPrompt.prompt.includes('3')}`);
    passed++;
  } catch (e) {
    console.log(`✗ generateOrchestratorPrompt() - ${e}`);
    failed++;
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n' + '='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`✓ Passed: ${passed}`);
  console.log(`✗ Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  console.log('');

  if (failed > 0) {
    process.exit(1);
  }
}

// Run
runE2EScenario().catch(console.error);
