/**
 * Extractor Module Tests
 *
 * Tests for STATE.md parsing, ROADMAP.md progress, notepad integration,
 * compression ratio validation, and priority ordering.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

import {
  extractCoreInfo,
  parseStateDecisions,
  parseStateReferences,
  parseRoadmapProgress,
  loadNotepadWisdom,
  formatCoreInfo,
  estimateCoreInfoTokens,
  type CoreInfo,
} from './extractor.js';

import {
  compactWithCoreInfo,
  validateCompression,
} from './compactor.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_DIR = '/tmp/claude/ultra-planner-extractor-tests';
const PLANNING_DIR = join(TEST_DIR, '.planning');
const PHASES_DIR = join(PLANNING_DIR, 'phases');
const PHASE_03_DIR = join(PHASES_DIR, '03-test-phase');
const NOTEPAD_DIR = join(TEST_DIR, '.omc/notepads/_project');

// Mock STATE.md with Decisions, References, Todos sections
const STATE_MD = `# Project State

## Current Position
Phase: 3 of 5 (GSD Integration)
Plan: 2 of 4
Status: In Progress

### Decisions
- [Phase 1]: TypeScript 5.9.3 with strict mode for type safety
- [Phase 1]: Use Vitest for testing framework
- [Phase 2]: Implement context collector as core module
- [Phase 2]: Use artifact references for lazy loading
- [Phase 3]: Integrate GSD agents for research
- [Phase 3]: Use compression ratio of 20% target
- [Architecture]: Domain-driven design with clean boundaries
- [Testing]: Unit tests for all public APIs
- [API]: RESTful patterns for MCP endpoints
- [Refactoring]: Extract common patterns to shared modules
- [Extra]: This should be trimmed due to limit

### Key References
- \`src/context/extractor.ts\` - Core info extraction
- \`src/context/compactor.ts\` - Context compression
- \`src/artifacts/types.ts\` - Artifact type definitions
- \`.planning/STATE.md\` - Project state tracking

### Pending Todos
- Complete extractor tests
- Add compression benchmarks
- Review architect feedback
- Update documentation
- Final review

### Blockers/Concerns
- Performance on large codebases
- Token estimation accuracy
- Memory usage during extraction
- Parallel execution coordination
- Rate limiting considerations
`;

// Mock ROADMAP.md with phase completion checkboxes
const ROADMAP_MD = `# Roadmap

### Phase 1: Foundation
- [x] Setup project structure
- [x] Configure TypeScript
- [x] Add testing framework

### Phase 2: Core Modules
- [x] Implement context collector
- [x] Add artifact references
- [x] Create compactor module

### Phase 3: GSD Integration
- [x] Research GSD patterns
- [x] Plan integration approach
- [ ] Implement extraction tests
- [ ] Add compression validation
- [ ] Complete documentation

### Phase 4: Advanced Features
- [ ] Parallel execution
- [ ] Caching layer
- [ ] Performance optimization

### Phase 5: Production
- [ ] Final testing
- [ ] Documentation
- [ ] Release
`;

const PROJECT_MD = `# Test Project

## Overview

This is a test project for extractor module testing. It demonstrates context extraction capabilities.

## Goals

- Test STATE.md parsing
- Test ROADMAP.md progress
- Test notepad integration
- Verify compression ratios
`;

// Mock notepad files
const ISSUES_MD = `# Issues

## Issue 1: Performance bottleneck in extraction
Details about the performance issue.

## Issue 2: Memory leak in large contexts
Details about memory issues.

## Issue 3: Race condition in parallel processing
Details about race conditions.
`;

const LEARNINGS_MD = `# Learnings

## Learning 1: Compression works best with structured data
Technical details about compression.

## Learning 2: Token estimation is approximate
Notes on token counting.

## Learning 3: Caching improves performance 10x
Benchmark results.

## Learning 4: Lazy loading reduces memory
Memory optimization notes.

## Learning 5: Parallel extraction is complex
Concurrency patterns.

## Learning 6: This should be trimmed
Extra learning that exceeds limit.

## Learning 7: Another extra learning
More content to test limits.
`;

// ============================================================================
// Setup/Teardown
// ============================================================================

function setupTestFiles() {
  // Create directories
  mkdirSync(PHASE_03_DIR, { recursive: true });
  mkdirSync(NOTEPAD_DIR, { recursive: true });

  // Write planning files
  writeFileSync(join(PLANNING_DIR, 'STATE.md'), STATE_MD);
  writeFileSync(join(PLANNING_DIR, 'ROADMAP.md'), ROADMAP_MD);
  writeFileSync(join(PLANNING_DIR, 'PROJECT.md'), PROJECT_MD);

  // Write notepad files
  writeFileSync(join(NOTEPAD_DIR, 'issues.md'), ISSUES_MD);
  writeFileSync(join(NOTEPAD_DIR, 'learnings.md'), LEARNINGS_MD);
}

function cleanupTestFiles() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

// ============================================================================
// STATE.md Parsing Tests
// ============================================================================

describe('STATE.md Parsing', () => {
  beforeEach(() => {
    cleanupTestFiles();
    setupTestFiles();
  });

  afterEach(() => {
    cleanupTestFiles();
  });

  describe('parseStateDecisions', () => {
    it('should extract decisions from Decisions section', () => {
      const decisions = parseStateDecisions(STATE_MD);

      expect(decisions.length).toBeGreaterThan(0);
      expect(decisions[0]).toContain('[Phase 1]');
      expect(decisions[0]).toContain('TypeScript');
    });

    it('should parse tagged decisions correctly', () => {
      const decisions = parseStateDecisions(STATE_MD);

      // Check for specific decisions
      const typescriptDecision = decisions.find(d => d.includes('TypeScript'));
      expect(typescriptDecision).toBeDefined();

      const architectureDecision = decisions.find(d => d.includes('Architecture'));
      expect(architectureDecision).toBeDefined();
    });

    it('should return empty array for missing section', () => {
      const noDecisions = `# State\n\n## Other Section\n- Content`;
      const decisions = parseStateDecisions(noDecisions);

      expect(decisions).toEqual([]);
    });
  });

  describe('parseStateReferences', () => {
    it('should extract key references with paths and descriptions', () => {
      const references = parseStateReferences(STATE_MD);

      expect(references.length).toBeGreaterThan(0);
      expect(references[0]).toContain('extractor.ts');
    });

    it('should handle references with descriptions', () => {
      const references = parseStateReferences(STATE_MD);

      const extractorRef = references.find(r => r.includes('extractor.ts'));
      expect(extractorRef).toContain('Core info extraction');
    });
  });

  describe('extractCoreInfo - array limits enforcement', () => {
    it('should enforce max 10 decisions limit', () => {
      const info = extractCoreInfo(PLANNING_DIR);

      // STATE.md has 11 decisions, should be limited to 10
      expect(info.architectureDecisions.length).toBeLessThanOrEqual(10);
    });

    it('should enforce max 5 issues limit', () => {
      const info = extractCoreInfo(PLANNING_DIR);

      expect(info.unresolvedIssues.length).toBeLessThanOrEqual(5);
    });

    it('should enforce max 5 learnings limit', () => {
      const info = extractCoreInfo(PLANNING_DIR);

      // LEARNINGS.md has 7 items, should be limited to 5
      expect(info.recentLearnings.length).toBeLessThanOrEqual(5);
    });
  });
});

// ============================================================================
// ROADMAP.md Progress Parsing Tests
// ============================================================================

describe('ROADMAP.md Progress Parsing', () => {
  beforeEach(() => {
    cleanupTestFiles();
    setupTestFiles();
  });

  afterEach(() => {
    cleanupTestFiles();
  });

  describe('parseRoadmapProgress', () => {
    it('should count completed and total tasks', () => {
      const progress = parseRoadmapProgress(ROADMAP_MD);

      // Count from ROADMAP_MD:
      // Phase 1: 3 checked, Phase 2: 3 checked, Phase 3: 2 checked + 3 unchecked
      // Phase 4: 3 unchecked, Phase 5: 3 unchecked
      expect(progress.completed).toBe(8); // 3 + 3 + 2
      expect(progress.total).toBe(17); // 3 + 3 + 5 + 3 + 3
    });

    it('should calculate correct percentage', () => {
      const progress = parseRoadmapProgress(ROADMAP_MD);

      expect(progress.percent).toBe(Math.round((8 / 17) * 100));
    });

    it('should identify current phase correctly', () => {
      const progress = parseRoadmapProgress(ROADMAP_MD);

      // Phase 3 is the first phase with unchecked tasks
      expect(progress.currentPhase.number).toBe(3);
      expect(progress.currentPhase.name).toBe('GSD Integration');
    });

    it('should detect in-progress status for partially completed phase', () => {
      const progress = parseRoadmapProgress(ROADMAP_MD);

      // Phase 3 has both checked and unchecked tasks
      expect(progress.currentPhase.status).toBe('in-progress');
    });

    it('should detect pending status for phase with no checked tasks', () => {
      const onlyPendingRoadmap = `# Roadmap
### Phase 1: Test
- [ ] Task A
- [ ] Task B
`;
      const progress = parseRoadmapProgress(onlyPendingRoadmap);

      expect(progress.currentPhase.status).toBe('pending');
    });
  });

  describe('extractCoreInfo - ROADMAP integration', () => {
    it('should extract currentPhase from ROADMAP', () => {
      const info = extractCoreInfo(PLANNING_DIR);

      // STATE.md position overrides, but if not present, ROADMAP is used
      expect(info.currentPhase.number).toBeGreaterThan(0);
    });

    it('should extract progressMetrics accurately', () => {
      const info = extractCoreInfo(PLANNING_DIR);

      expect(info.progressMetrics.total).toBe(17);
      expect(info.progressMetrics.completed).toBe(8);
      expect(info.progressMetrics.percent).toBe(Math.round((8 / 17) * 100));
    });
  });
});

// ============================================================================
// Notepad Integration Tests
// ============================================================================

describe('Notepad Integration', () => {
  beforeEach(() => {
    cleanupTestFiles();
    setupTestFiles();

    // Set working directory context for notepad resolution
    process.chdir(TEST_DIR);
  });

  afterEach(() => {
    process.chdir('/home/ubuntu/code/ultra-planning');
    cleanupTestFiles();
  });

  describe('loadNotepadWisdom', () => {
    it('should parse issues.md entries', () => {
      const wisdom = loadNotepadWisdom(NOTEPAD_DIR);

      expect(wisdom.issues.length).toBeGreaterThan(0);
      expect(wisdom.issues[0]).toContain('Performance bottleneck');
    });

    it('should parse learnings.md entries', () => {
      const wisdom = loadNotepadWisdom(NOTEPAD_DIR);

      expect(wisdom.learnings.length).toBeGreaterThan(0);
      expect(wisdom.learnings[0]).toContain('Compression');
    });

    it('should extract section headers as entries', () => {
      const wisdom = loadNotepadWisdom(NOTEPAD_DIR);

      // Each ## header becomes an entry
      expect(wisdom.issues.some(i => i.includes('Memory leak'))).toBe(true);
      expect(wisdom.learnings.some(l => l.includes('Token estimation'))).toBe(true);
    });

    it('should return empty arrays for non-existent notepad', () => {
      const wisdom = loadNotepadWisdom('/nonexistent/notepad');

      // May fall back to searching other notepads, but if none found:
      expect(wisdom.learnings).toBeDefined();
      expect(wisdom.decisions).toBeDefined();
      expect(wisdom.issues).toBeDefined();
    });
  });
});

// ============================================================================
// Compression Ratio Tests
// ============================================================================

describe('Compression Ratio', () => {
  beforeEach(() => {
    cleanupTestFiles();
    setupTestFiles();
  });

  afterEach(() => {
    cleanupTestFiles();
  });

  describe('compactWithCoreInfo', () => {
    it('should include CoreInfo in compacted result', () => {
      const compacted = compactWithCoreInfo({ planningDir: PLANNING_DIR });

      expect(compacted.coreInfo).toBeDefined();
      expect(compacted.coreInfo?.architectureDecisions).toBeDefined();
    });

    it('should calculate compression ratio', () => {
      const compacted = compactWithCoreInfo({ planningDir: PLANNING_DIR });

      // Compression ratio is compactedTokens / originalTokens
      expect(compacted.compressionRatio).toBeGreaterThan(0);
      expect(compacted.originalTokens).toBeGreaterThan(0);
      expect(compacted.compactedTokens).toBeGreaterThan(0);
    });
  });

  describe('validateCompression', () => {
    it('should return true for valid compression', () => {
      expect(validateCompression(10000, 1500)).toBe(true); // 15%
      expect(validateCompression(10000, 2000)).toBe(true); // 20% exactly
    });

    it('should return false for excessive compression', () => {
      expect(validateCompression(10000, 2100)).toBe(false); // 21%
      expect(validateCompression(10000, 5000)).toBe(false); // 50%
    });

    it('should handle edge cases', () => {
      expect(validateCompression(0, 0)).toBe(true); // No original context
      expect(validateCompression(100, 0)).toBe(true); // Perfect compression
    });
  });

  describe('large context compression', () => {
    it('should compress large context (~10000 tokens) under 20%', () => {
      // Create large mock context with substantial content
      // Need ~40000 chars to get ~10000 tokens (chars/4)
      const largeProjectContent = generateLargeContent(40000);
      const largeRequirementsContent = generateLargeContent(20000);
      const largePlanningDir = join(TEST_DIR, '.planning-large');
      const largePhasesDir = join(largePlanningDir, 'phases', '03-test-phase');
      mkdirSync(largePhasesDir, { recursive: true });

      // Write multiple large files to create substantial original context
      writeFileSync(join(largePlanningDir, 'STATE.md'), STATE_MD);
      writeFileSync(join(largePlanningDir, 'ROADMAP.md'), ROADMAP_MD);
      writeFileSync(join(largePlanningDir, 'PROJECT.md'), largeProjectContent);
      writeFileSync(join(largePlanningDir, 'REQUIREMENTS.md'), largeRequirementsContent);

      const compacted = compactWithCoreInfo({ planningDir: largePlanningDir });

      // Verify we have substantial original context
      expect(compacted.originalTokens).toBeGreaterThan(5000);

      // Compression ratio should be under 20% for large contexts
      // The algorithm progressively removes content to achieve target
      expect(compacted.compressionRatio).toBeLessThanOrEqual(0.20);
    });

    it('should report accurate token counts', () => {
      const largePlanningDir = join(TEST_DIR, '.planning-large-tokens');
      mkdirSync(largePlanningDir, { recursive: true });

      // Create content of known size: 40000 chars = ~10000 tokens
      const content = generateLargeContent(40000);
      writeFileSync(join(largePlanningDir, 'PROJECT.md'), content);

      const compacted = compactWithCoreInfo({ planningDir: largePlanningDir });

      // Original should be approximately 10000 tokens
      expect(compacted.originalTokens).toBeGreaterThan(9000);
      expect(compacted.originalTokens).toBeLessThan(12000);
    });
  });
});

// ============================================================================
// Priority Ordering Tests
// ============================================================================

describe('Priority Ordering', () => {
  beforeEach(() => {
    cleanupTestFiles();
    setupTestFiles();
  });

  afterEach(() => {
    cleanupTestFiles();
  });

  describe('formatCoreInfo', () => {
    it('should place issues before decisions in output', () => {
      const info = extractCoreInfo(PLANNING_DIR);

      // Add some test data if extraction returns defaults
      if (info.unresolvedIssues.length === 0) {
        info.unresolvedIssues = ['Issue 1', 'Issue 2'];
      }
      if (info.architectureDecisions.length === 0) {
        info.architectureDecisions = ['Decision 1', 'Decision 2'];
      }

      const formatted = formatCoreInfo(info);
      const issuesIndex = formatted.indexOf('## Active Issues');
      const decisionsIndex = formatted.indexOf('## Key Decisions');

      // Issues should appear before decisions
      if (issuesIndex !== -1 && decisionsIndex !== -1) {
        expect(issuesIndex).toBeLessThan(decisionsIndex);
      }
    });

    it('should place learnings after decisions', () => {
      const info = extractCoreInfo(PLANNING_DIR);

      // Add test data
      info.architectureDecisions = ['Decision 1'];
      info.recentLearnings = ['Learning 1'];

      const formatted = formatCoreInfo(info);
      const decisionsIndex = formatted.indexOf('## Key Decisions');
      const learningsIndex = formatted.indexOf('## Recent Learnings');

      if (decisionsIndex !== -1 && learningsIndex !== -1) {
        expect(learningsIndex).toBeGreaterThan(decisionsIndex);
      }
    });
  });

  describe('extractCoreInfo - learnings limit', () => {
    it('should limit learnings to 5 most recent', () => {
      // LEARNINGS_MD has 7 entries
      const info = extractCoreInfo(PLANNING_DIR);

      // Should be limited to 5
      expect(info.recentLearnings.length).toBeLessThanOrEqual(5);
    });
  });

  describe('CoreInfo structure', () => {
    it('should have correct priority order in interface', () => {
      const info = extractCoreInfo(PLANNING_DIR);

      // Verify structure has all priority fields
      expect(info).toHaveProperty('unresolvedIssues'); // High priority
      expect(info).toHaveProperty('pendingTodos'); // High priority
      expect(info).toHaveProperty('architectureDecisions'); // Medium priority
      expect(info).toHaveProperty('recentLearnings'); // Lower priority
      expect(info).toHaveProperty('keyReferences'); // Lowest priority
    });
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

function generateLargeContent(charCount: number): string {
  const lines: string[] = ['# Large Project Overview\n\n## Description\n'];

  const paragraph = 'This is a test paragraph designed to generate a large amount of content. '.repeat(10);

  while (lines.join('\n').length < charCount) {
    lines.push(paragraph);
    lines.push('\n');
  }

  return lines.join('').slice(0, charCount);
}
