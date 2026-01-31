/**
 * Context Module Tests
 *
 * Tests for context collection, injection, and compaction.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

import {
  // Collector
  collectProjectContext,
  collectPhaseContext,
  collectTaskContext,
  collectContext,
  estimateContextTokens,
  formatContextSummary,
  type CollectedContext,
} from './collector.js';

import {
  // Injector
  injectWorkerContext,
  injectOrchestratorContext,
  injectPlannerContext,
  injectExecutorContext,
  injectArchitectContext,
  injectCriticContext,
  injectContext,
  formatInjectedContext,
  formatInjectedSummary,
  type InjectedContext,
} from './injector.js';

import {
  // Compactor
  compactContext,
  saveContextSnapshot,
  restoreContext,
  listSnapshots,
  formatCompactedContext,
  type CompactedContext,
} from './compactor.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_DIR = '/tmp/claude/ultra-planner-context-tests';
const PLANNING_DIR = join(TEST_DIR, '.planning');
const PHASES_DIR = join(PLANNING_DIR, 'phases');
const PHASE_03_DIR = join(PHASES_DIR, '03-test-phase');
const SNAPSHOT_DIR = join(TEST_DIR, '.omc/snapshots');

const PROJECT_MD = `# Test Project

## Overview

This is a test project for context module testing.

## Goals

- Test context collection
- Test context injection
- Test context compaction
`;

const ROADMAP_MD = `# Roadmap

## Phase 1: Foundation
- [x] Setup project

## Phase 2: Core
- [ ] Implement features

## Phase 3: Test Phase
- [ ] Test feature A
- [ ] Test feature B
`;

const REQUIREMENTS_MD = `# Requirements

## Functional
- FR-001: Must collect context
- FR-002: Must inject context

## Non-Functional
- NFR-001: Must be fast
`;

const RESEARCH_MD = `# Phase 3 Research

## Summary

This phase focuses on testing.

## Key Findings

- Tests are important
- Coverage matters
`;

const PLAN_MD = `# Plan 03-01

## Tasks

### Task 03-01-01: Write tests
- Wave: 1
- Action: Create test file

### Task 03-01-02: Run tests
- Wave: 2
- Action: Execute tests
`;

const SUMMARY_MD = `# Summary 03-01

## Completed

- Created test file
- All tests pass
`;

// ============================================================================
// Setup/Teardown
// ============================================================================

function setupTestFiles() {
  // Create directories
  mkdirSync(PHASE_03_DIR, { recursive: true });
  mkdirSync(SNAPSHOT_DIR, { recursive: true });

  // Write test files
  writeFileSync(join(PLANNING_DIR, 'PROJECT.md'), PROJECT_MD);
  writeFileSync(join(PLANNING_DIR, 'ROADMAP.md'), ROADMAP_MD);
  writeFileSync(join(PLANNING_DIR, 'REQUIREMENTS.md'), REQUIREMENTS_MD);
  writeFileSync(join(PHASE_03_DIR, '03-RESEARCH.md'), RESEARCH_MD);
  writeFileSync(join(PHASE_03_DIR, '03-01-PLAN.md'), PLAN_MD);
  writeFileSync(join(PHASE_03_DIR, '03-01-SUMMARY.md'), SUMMARY_MD);
}

function cleanupTestFiles() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

// ============================================================================
// Collector Tests
// ============================================================================

describe('Context Collector', () => {
  beforeEach(() => {
    cleanupTestFiles();
    setupTestFiles();
  });

  afterEach(() => {
    cleanupTestFiles();
  });

  describe('collectProjectContext', () => {
    it('should collect PROJECT.md', () => {
      const ctx = collectProjectContext(PLANNING_DIR);

      expect(ctx.exists).toBe(true);
      expect(ctx.projectMd).toContain('Test Project');
    });

    it('should collect ROADMAP.md', () => {
      const ctx = collectProjectContext(PLANNING_DIR);

      expect(ctx.roadmapMd).toContain('Phase 3: Test Phase');
    });

    it('should collect REQUIREMENTS.md', () => {
      const ctx = collectProjectContext(PLANNING_DIR);

      expect(ctx.requirementsMd).toContain('FR-001');
    });

    it('should return exists=false for missing directory', () => {
      const ctx = collectProjectContext('/nonexistent/path');

      expect(ctx.exists).toBe(false);
      expect(ctx.projectMd).toBeUndefined();
    });
  });

  describe('collectPhaseContext', () => {
    it('should collect phase research', () => {
      const ctx = collectPhaseContext(3, PLANNING_DIR);

      expect(ctx.exists).toBe(true);
      expect(ctx.researchMd).toContain('Phase 3 Research');
    });

    it('should collect phase plans', () => {
      const ctx = collectPhaseContext(3, PLANNING_DIR);

      expect(ctx.plans.length).toBe(1);
      expect(ctx.plans[0]).toContain('Plan 03-01');
    });

    it('should collect phase summaries', () => {
      const ctx = collectPhaseContext(3, PLANNING_DIR);

      expect(ctx.summaries.length).toBe(1);
      expect(ctx.summaries[0]).toContain('Summary 03-01');
    });

    it('should return exists=false for missing phase', () => {
      const ctx = collectPhaseContext(99, PLANNING_DIR);

      expect(ctx.exists).toBe(false);
    });
  });

  describe('collectTaskContext', () => {
    it('should collect task plan', () => {
      const ctx = collectTaskContext('03-01', PLANNING_DIR);

      expect(ctx.exists).toBe(true);
      expect(ctx.planMd).toContain('Plan 03-01');
    });

    it('should collect task summary', () => {
      const ctx = collectTaskContext('03-01', PLANNING_DIR);

      expect(ctx.summaryMd).toContain('Summary 03-01');
    });

    it('should handle short plan IDs', () => {
      const ctx = collectTaskContext('3-1', PLANNING_DIR);

      // Should normalize to 03-01
      expect(ctx.planId).toBe('03-01');
    });
  });

  describe('collectContext', () => {
    it('should collect all context types', () => {
      const ctx = collectContext({
        planId: '03-01',
        includeProject: true,
        includePhase: true,
        planningDir: PLANNING_DIR,
      });

      expect(ctx.project?.exists).toBe(true);
      expect(ctx.phase?.exists).toBe(true);
      expect(ctx.task?.exists).toBe(true);
    });

    it('should respect include flags', () => {
      const ctx = collectContext({
        planId: '03-01',
        includeProject: false,
        includePhase: false,
        planningDir: PLANNING_DIR,
      });

      expect(ctx.project).toBeUndefined();
      expect(ctx.phase).toBeUndefined();
      expect(ctx.task?.exists).toBe(true);
    });
  });

  describe('estimateContextTokens', () => {
    it('should estimate tokens from context', () => {
      const ctx = collectContext({ planId: '03-01', planningDir: PLANNING_DIR });
      const tokens = estimateContextTokens(ctx);

      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('formatContextSummary', () => {
    it('should format context as summary', () => {
      const ctx = collectContext({ planId: '03-01', planningDir: PLANNING_DIR });
      const summary = formatContextSummary(ctx);

      expect(summary).toContain('Collected Context');
      expect(summary).toContain('Phase 3');
      expect(summary).toContain('Estimated Tokens');
    });
  });
});

// ============================================================================
// Injector Tests
// ============================================================================

describe('Context Injector', () => {
  let ctx: CollectedContext;

  beforeEach(() => {
    cleanupTestFiles();
    setupTestFiles();
    ctx = collectContext({ planId: '03-01', planningDir: PLANNING_DIR });
  });

  afterEach(() => {
    cleanupTestFiles();
  });

  describe('injectWorkerContext', () => {
    it('should include current task as high priority', () => {
      const injected = injectWorkerContext(ctx);

      expect(injected.role).toBe('worker');
      const taskSection = injected.sections.find((s) => s.title === 'Current Task');
      expect(taskSection).toBeDefined();
      expect(taskSection?.priority).toBe('high');
    });

    it('should include phase research as medium priority', () => {
      const injected = injectWorkerContext(ctx);

      const researchSection = injected.sections.find((s) => s.title === 'Phase Research');
      expect(researchSection).toBeDefined();
      expect(researchSection?.priority).toBe('medium');
    });

    it('should respect token limits', () => {
      const injected = injectWorkerContext(ctx, { maxTokens: 100 });

      // Should still include high priority sections
      expect(injected.sections.some((s) => s.priority === 'high')).toBe(true);
    });
  });

  describe('injectOrchestratorContext', () => {
    it('should include phase plans as high priority', () => {
      const injected = injectOrchestratorContext(ctx);

      expect(injected.role).toBe('orchestrator');
      const plansSection = injected.sections.find((s) => s.title.includes('Plans'));
      expect(plansSection).toBeDefined();
      expect(plansSection?.priority).toBe('high');
    });

    it('should include roadmap as medium priority', () => {
      const injected = injectOrchestratorContext(ctx);

      const roadmapSection = injected.sections.find((s) => s.title === 'Roadmap');
      expect(roadmapSection).toBeDefined();
      expect(roadmapSection?.priority).toBe('medium');
    });
  });

  describe('injectPlannerContext', () => {
    it('should include project as high priority', () => {
      const injected = injectPlannerContext(ctx);

      expect(injected.role).toBe('planner');
      const projectSection = injected.sections.find((s) => s.title === 'Project');
      expect(projectSection).toBeDefined();
      expect(projectSection?.priority).toBe('high');
    });

    it('should include requirements as high priority', () => {
      const injected = injectPlannerContext(ctx);

      const reqSection = injected.sections.find((s) => s.title === 'Requirements');
      expect(reqSection).toBeDefined();
      expect(reqSection?.priority).toBe('high');
    });
  });

  describe('injectExecutorContext', () => {
    it('should include task plan as high priority', () => {
      const injected = injectExecutorContext(ctx);

      expect(injected.role).toBe('executor');
      const taskSection = injected.sections.find((s) => s.title === 'Task Plan');
      expect(taskSection).toBeDefined();
      expect(taskSection?.priority).toBe('high');
    });

    it('should include task summary if available', () => {
      const injected = injectExecutorContext(ctx);

      const progressSection = injected.sections.find((s) => s.title === 'Task Progress');
      expect(progressSection).toBeDefined();
    });
  });

  describe('injectArchitectContext', () => {
    it('should include task to verify as high priority', () => {
      const injected = injectArchitectContext(ctx);

      expect(injected.role).toBe('architect');
      const taskSection = injected.sections.find((s) => s.title === 'Task to Verify');
      expect(taskSection).toBeDefined();
      expect(taskSection?.priority).toBe('high');
    });
  });

  describe('injectCriticContext', () => {
    it('should include plan to review as high priority', () => {
      const injected = injectCriticContext(ctx);

      expect(injected.role).toBe('critic');
      const planSection = injected.sections.find((s) => s.title === 'Plan to Review');
      expect(planSection).toBeDefined();
      expect(planSection?.priority).toBe('high');
    });
  });

  describe('injectContext', () => {
    it('should route to correct injector based on role', () => {
      expect(injectContext('worker', ctx).role).toBe('worker');
      expect(injectContext('orchestrator', ctx).role).toBe('orchestrator');
      expect(injectContext('planner', ctx).role).toBe('planner');
      expect(injectContext('executor', ctx).role).toBe('executor');
      expect(injectContext('architect', ctx).role).toBe('architect');
      expect(injectContext('critic', ctx).role).toBe('critic');
    });
  });

  describe('formatInjectedContext', () => {
    it('should format as XML-like context block', () => {
      const injected = injectWorkerContext(ctx);
      const formatted = formatInjectedContext(injected);

      expect(formatted).toContain('<context>');
      expect(formatted).toContain('</context>');
      expect(formatted).toContain('## Current Task');
    });

    it('should return empty string for no sections', () => {
      const injected: InjectedContext = { role: 'worker', sections: [], totalTokens: 0 };
      const formatted = formatInjectedContext(injected);

      expect(formatted).toBe('');
    });
  });

  describe('formatInjectedSummary', () => {
    it('should format as human-readable summary', () => {
      const injected = injectWorkerContext(ctx);
      const summary = formatInjectedSummary(injected);

      expect(summary).toContain('Context for worker');
      expect(summary).toContain('tokens');
    });
  });
});

// ============================================================================
// Compactor Tests
// ============================================================================

describe('Context Compactor', () => {
  let ctx: CollectedContext;

  beforeEach(() => {
    cleanupTestFiles();
    setupTestFiles();
    ctx = collectContext({ planId: '03-01', planningDir: PLANNING_DIR });
  });

  afterEach(() => {
    cleanupTestFiles();
  });

  describe('compactContext', () => {
    it('should generate snapshot ID', () => {
      const compacted = compactContext(ctx);

      expect(compacted.snapshotId).toBeTruthy();
      expect(compacted.snapshotId.length).toBeGreaterThan(10);
    });

    it('should include project summary', () => {
      const compacted = compactContext(ctx);

      expect(compacted.projectSummary).toBeTruthy();
    });

    it('should include phase state', () => {
      const compacted = compactContext(ctx);

      expect(compacted.phaseState.phaseNumber).toBe(3);
      expect(compacted.phaseState.phaseName).toContain('test-phase');
    });

    it('should include active task', () => {
      const compacted = compactContext(ctx);

      expect(compacted.activeTask).toBeDefined();
      expect(compacted.activeTask?.planId).toBe('03-01');
    });

    it('should calculate token reduction', () => {
      const compacted = compactContext(ctx);

      expect(compacted.originalTokens).toBeGreaterThan(0);
      expect(compacted.compactedTokens).toBeGreaterThan(0);
      expect(compacted.compactedTokens).toBeLessThan(compacted.originalTokens);
    });
  });

  describe('saveContextSnapshot', () => {
    it('should save snapshot to disk', () => {
      const compacted = compactContext(ctx);
      const filepath = saveContextSnapshot(compacted, { snapshotDir: SNAPSHOT_DIR });

      expect(existsSync(filepath)).toBe(true);
    });

    it('should cleanup old snapshots', () => {
      // Create multiple snapshots
      for (let i = 0; i < 5; i++) {
        const compacted = compactContext(ctx);
        saveContextSnapshot(compacted, { snapshotDir: SNAPSHOT_DIR, maxSnapshots: 3 });
      }

      const snapshots = listSnapshots({ snapshotDir: SNAPSHOT_DIR });
      expect(snapshots.length).toBeLessThanOrEqual(3);
    });
  });

  describe('restoreContext', () => {
    it('should restore saved snapshot', () => {
      const original = compactContext(ctx);
      saveContextSnapshot(original, { snapshotDir: SNAPSHOT_DIR });

      const restored = restoreContext(original.snapshotId, { snapshotDir: SNAPSHOT_DIR });

      expect(restored).not.toBeNull();
      expect(restored?.snapshotId).toBe(original.snapshotId);
    });

    it('should restore latest snapshot', () => {
      const compacted = compactContext(ctx);
      saveContextSnapshot(compacted, { snapshotDir: SNAPSHOT_DIR });

      const restored = restoreContext('latest', { snapshotDir: SNAPSHOT_DIR });

      expect(restored).not.toBeNull();
      expect(restored?.snapshotId).toBe(compacted.snapshotId);
    });

    it('should return null for missing snapshot', () => {
      const restored = restoreContext('nonexistent', { snapshotDir: SNAPSHOT_DIR });

      expect(restored).toBeNull();
    });
  });

  describe('listSnapshots', () => {
    it('should list saved snapshots', () => {
      const compacted1 = compactContext(ctx);
      const compacted2 = compactContext(ctx);
      saveContextSnapshot(compacted1, { snapshotDir: SNAPSHOT_DIR });
      saveContextSnapshot(compacted2, { snapshotDir: SNAPSHOT_DIR });

      const snapshots = listSnapshots({ snapshotDir: SNAPSHOT_DIR });

      expect(snapshots.length).toBe(2);
    });

    it('should return empty array for missing directory', () => {
      const snapshots = listSnapshots({ snapshotDir: '/nonexistent/path' });

      expect(snapshots).toEqual([]);
    });
  });

  describe('formatCompactedContext', () => {
    it('should format as markdown', () => {
      const compacted = compactContext(ctx);
      const formatted = formatCompactedContext(compacted);

      expect(formatted).toContain('# Session Context');
      expect(formatted).toContain('## Project Summary');
      expect(formatted).toContain('## Phase State');
    });

    it('should include token compression info', () => {
      const compacted = compactContext(ctx);
      const formatted = formatCompactedContext(compacted);

      expect(formatted).toContain('compressed from');
    });
  });
});
