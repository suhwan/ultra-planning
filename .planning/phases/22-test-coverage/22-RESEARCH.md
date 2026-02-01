# Phase 22: Test Coverage - Research

**Researched:** 2026-02-01
**Domain:** TypeScript Testing with Vitest
**Confidence:** HIGH

## Summary

The Ultra Planning project currently has minimal test coverage with only 9 test files in `src/` and 4 integration tests in `tests/`. The goal is to expand to 90+ test files covering all major modules. The project uses Vitest (v2.0+) as the test framework with proper configuration already in place.

**Current State:**
- 9 unit test files in `src/` (covering ~4% of modules)
- 4 integration test files in `tests/integration/`
- 3 test helper files in `tests/helpers/`
- 201 source files total, 116+ functional modules needing tests

**Primary recommendation:** Prioritize core modules (documents, orchestration, state, sync) first, then expand to supporting modules using established test patterns from existing tests and oh-my-opencode reference.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^2.0.0 | Test framework | Already configured, modern ESM support |
| @vitest/coverage-v8 | ^2.0.0 | Code coverage | Native V8 coverage, accurate for TypeScript |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vitest/ui | ^2.0.0 | Test UI | Interactive debugging |
| happy-dom | latest | DOM simulation | If any DOM tests needed |

### Already Available in Project
| Library | Purpose |
|---------|---------|
| vitest | Already in devDependencies |
| typescript | Type checking |

**Installation (add for coverage):**
```bash
npm install -D @vitest/coverage-v8
```

## Current Test Coverage Status

### Files WITH Tests (9 total in src/)

| Test File | Module | Coverage Status |
|-----------|--------|-----------------|
| `src/complexity/estimator.test.ts` | complexity | Full |
| `src/context/context.test.ts` | context | Partial |
| `src/context/advanced-monitor.test.ts` | context | Partial |
| `src/context/extractor.test.ts` | context | Partial |
| `src/hints/hints.test.ts` | hints | Partial |
| `src/prompts/prompts.test.ts` | prompts | Partial |
| `src/orchestration/delegation/manager.test.ts` | orchestration | Partial |
| `src/orchestration/swarm/manager.test.ts` | orchestration | Partial |
| `src/orchestration/pipeline/manager.test.ts` | orchestration | Partial |

### Integration Tests (4 in tests/)

| Test File | Purpose |
|-----------|---------|
| `tests/integration/context-architect.test.ts` | Context collection/injection E2E |
| `tests/integration/e2e-full-scenario.test.ts` | Full workflow scenario |
| `tests/integration/workflow.test.ts` | Workflow integration |
| `tests/integration/error-recovery.test.ts` | Error recovery paths |

### Modules WITHOUT Tests (Priority Order)

| Priority | Module | Source Files | Reason for Priority |
|----------|--------|--------------|---------------------|
| P0 | documents | 6 | Core XML/task parsing, critical path |
| P0 | orchestration | 20 (17 untested) | Workflow coordination, high complexity |
| P0 | state | 5 | Session/mode management, critical |
| P0 | sync | 6 | Plan/task synchronization |
| P1 | hooks | 18 | Orchestration hooks, complex logic |
| P1 | memory | 7 | Memory/notepad operations |
| P1 | quality | 10 | AST analysis, LSP integration |
| P1 | prompts | 7 (6 untested) | Prompt generation |
| P2 | agents | 4 | Agent prompt definitions |
| P2 | context | 12 (9 untested) | Context collection (partial) |
| P2 | notepad | 5 | Wisdom persistence |
| P2 | registry | 5 | Hook/agent registry |
| P3 | loops | 2 | Ralph loop detection |
| P3 | git | 1 | Commit operations |
| P3 | recovery | 1 | Error recovery |
| P3 | skills | 2 | Skill definitions |
| P3 | config | 1 | Configuration |
| P3 | artifacts | 1 | Artifact tracking |

## Architecture Patterns

### Recommended Test Structure
```
src/
├── module/
│   ├── feature.ts
│   └── feature.test.ts      # Co-located unit test
│
tests/
├── integration/
│   └── module.test.ts       # Integration tests
├── helpers/
│   ├── mock-state.ts        # Reusable mocks
│   ├── mock-error.ts        # Error factories
│   └── temp-dir.ts          # File system helpers
└── e2e/
    └── scenario.test.ts     # End-to-end tests
```

### Pattern 1: Unit Test Structure (from existing tests)
**What:** Co-located test files with describe/it blocks
**When to use:** All unit tests for individual modules
**Example:**
```typescript
// Source: src/complexity/estimator.test.ts
import { describe, it, expect } from 'vitest';
import { estimateComplexity, getModelForComplexity } from './index.js';

describe('estimateComplexity', () => {
  it('should reduce complexity for simple tasks', () => {
    const result = estimateComplexity({
      taskDescription: 'Fix typo in config file',
    });
    expect(result.complexity.level).toBeLessThanOrEqual(3);
  });
});
```

### Pattern 2: Integration Test with Fixtures (from existing tests)
**What:** Tests requiring file system setup/teardown
**When to use:** Tests involving file operations, context collection
**Example:**
```typescript
// Source: tests/integration/context-architect.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createTestWorkspace, cleanupWorkspace } from '../helpers/temp-dir.js';

let testWorkspace: string;

beforeEach(() => {
  testWorkspace = createTestWorkspace();
  setupPlanningStructure(testWorkspace);
});

afterEach(() => {
  cleanupWorkspace(testWorkspace);
});

describe('Context Collection', () => {
  test('should collect project context', () => {
    const ctx = collectProjectContext(join(testWorkspace, '.planning'));
    expect(ctx.exists).toBe(true);
  });
});
```

### Pattern 3: Mock State Pattern (from test helpers)
**What:** Factory functions for creating test data
**When to use:** State management, planning component tests
**Example:**
```typescript
// Source: tests/helpers/mock-state.ts
export function createMockState(overrides?: Partial<StateData>): StateData {
  return {
    phase: 1,
    currentPlan: '01-01',
    status: 'active',
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}
```

### Pattern 4: Given-When-Then Comments (from oh-my-opencode reference)
**What:** Structured test comments for clarity
**When to use:** Complex test scenarios
**Example:**
```typescript
// Source: references/oh-my-opencode/src/features/background-agent/manager.test.ts
test("should return direct children only when no nested tasks", () => {
  // #given
  const taskB = createMockTask({
    id: "task-b",
    sessionID: "session-b",
    parentSessionID: "session-a",
  })
  manager.addTask(taskB)

  // #when
  const result = manager.getAllDescendantTasks("session-a")

  // #then
  expect(result).toHaveLength(1)
  expect(result[0].id).toBe("task-b")
})
```

### Anti-Patterns to Avoid
- **Mocking external APIs inline:** Use centralized mock factories instead
- **Large test files:** Split by logical groupings (max ~300 lines)
- **Testing implementation details:** Test behavior, not internal state
- **Skipping cleanup:** Always use afterEach for file system cleanup

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Temp directories | Manual mkdirSync | `createTestWorkspace()` helper | Already handles cleanup |
| Mock state | Inline objects | `createMockState()` factory | Consistent defaults |
| Mock errors | Manual Error() | `createMockError()` factory | Typed error simulation |
| Coverage reports | Manual counting | vitest --coverage | Accurate V8 coverage |

**Key insight:** The project already has test helpers - use them rather than recreating patterns.

## Common Pitfalls

### Pitfall 1: ESM Import Extensions
**What goes wrong:** Tests fail with "cannot find module"
**Why it happens:** Vitest requires `.js` extensions in imports for ESM
**How to avoid:** Always use `.js` extension in imports: `import { x } from './module.js'`
**Warning signs:** "ERR_MODULE_NOT_FOUND" errors

### Pitfall 2: Async Test Cleanup
**What goes wrong:** File system tests leave artifacts
**Why it happens:** afterEach not properly awaited or errors during cleanup
**How to avoid:** Use try/finally in cleanup, handle errors silently
**Warning signs:** Test pollution, flaky tests

### Pitfall 3: Path Alias Resolution
**What goes wrong:** `@/` imports fail in tests
**Why it happens:** Vitest config missing alias configuration
**How to avoid:** vitest.config.ts already has alias configured - use it
**Warning signs:** "Cannot resolve '@/context'" errors

### Pitfall 4: Parallel Test Interference
**What goes wrong:** Tests pass individually, fail together
**Why it happens:** Shared state between tests, file system conflicts
**How to avoid:** Use unique directories per test, reset singletons in beforeEach
**Warning signs:** Random test failures, order-dependent results

## Test File Creation Guide

### Files to Create (Priority Order)

#### P0: Core Modules (Must Have - Week 1)

**documents/ (6 files)**
```
src/documents/validation/schemas.test.ts
src/documents/xml/task-parser.test.ts
src/documents/xml/task-generator.test.ts
src/documents/templates/plan.test.ts
src/documents/templates/roadmap.test.ts
src/documents/templates/project.test.ts
```

**orchestration/ (17 files needed)**
```
src/orchestration/ralplan/orchestrator.test.ts
src/orchestration/ralplan/state.test.ts
src/orchestration/ultrapilot/coordinator.test.ts
src/orchestration/ultrapilot/ownership.test.ts
src/orchestration/ultrapilot/state.test.ts
src/orchestration/keywords/patterns.test.ts
src/orchestration/keywords/processor.test.ts
src/orchestration/keywords/command-triggers.test.ts
src/orchestration/context-polling/poller.test.ts
src/orchestration/verdicts/checklist.test.ts
src/orchestration/revision/manager.test.ts
src/orchestration/deviation/manager.test.ts
```

**state/ (5 files)**
```
src/state/mode-registry.test.ts
src/state/event-system.test.ts
src/state/state-manager.test.ts
src/state/session/manager.test.ts
```

**sync/ (6 files)**
```
src/sync/plan-parser.test.ts
src/sync/task-mapper.test.ts
src/sync/dependency-map.test.ts
src/sync/status-sync.test.ts
```

#### P1: Supporting Modules (Week 2)

**hooks/ (18 files)**
```
src/hooks/orchestrator/file-guard.test.ts
src/hooks/orchestrator/single-task.test.ts
src/hooks/orchestrator/verification.test.ts
```

**memory/ (7 files)**
```
src/memory/notepad-manager.test.ts
src/memory/wisdom-reader.test.ts
...
```

**quality/ (10 files)**
```
src/quality/lsp/diagnostics.test.ts
src/quality/lsp/parser.test.ts
src/quality/ast/analyzer.test.ts
src/quality/ast/metrics.test.ts
src/quality/ast/patterns.test.ts
src/quality/review/analyzer.test.ts
src/quality/review/reporter.test.ts
src/quality/review/checklist.test.ts
src/quality/pipeline/executor.test.ts
src/quality/pipeline/integration.test.ts
```

#### P2: Remaining Modules (Week 3)

**agents/ (4 files)**
```
src/agents/prompts/planner.test.ts
src/agents/prompts/critic.test.ts
src/agents/prompts/architect.test.ts
src/agents/prompts/executor.test.ts
```

**context/ (9 more files)**
```
src/context/collector.test.ts      # Expand existing
src/context/compactor.test.ts
src/context/injector.test.ts
src/context/checkpoint-return.test.ts
src/context/estimator.test.ts
```

**notepad/ (5 files)**
```
src/notepad/manager.test.ts
src/notepad/reader.test.ts
src/notepad/injector.test.ts
src/notepad/merger.test.ts
```

**registry/ (5 files)**
```
src/registry/agent-registry.test.ts
src/registry/hook-registry.test.ts
src/registry/skill-registry.test.ts
```

#### P3: Edge Modules (Week 4)

**loops/, git/, recovery/, skills/, config/, artifacts/ (~8 files)**

### E2E Tests to Add (5+ total)

```
tests/e2e/
├── plan-execution.test.ts       # Full plan execution flow
├── phase-transition.test.ts     # Phase completion transitions
├── error-recovery.test.ts       # Error handling scenarios
├── context-restoration.test.ts  # Fresh-start context restoration
├── multi-agent-workflow.test.ts # Orchestrator + workers flow
```

## Code Examples

### Example: Document XML Parser Test
```typescript
// src/documents/xml/task-parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseTaskXML, extractTasks } from './task-parser.js';

describe('parseTaskXML', () => {
  it('should parse task with all fields', () => {
    const xml = `<task wave="1" type="auto">
      <name>Implement feature</name>
      <files>src/feature.ts</files>
      <action>Create the feature module</action>
      <verify>npm test</verify>
      <done>All tests pass</done>
    </task>`;

    const task = parseTaskXML(xml);

    expect(task.wave).toBe(1);
    expect(task.type).toBe('auto');
    expect(task.name).toBe('Implement feature');
    expect(task.files).toEqual(['src/feature.ts']);
  });

  it('should handle missing optional fields', () => {
    const xml = `<task wave="1">
      <name>Simple task</name>
      <action>Do something</action>
    </task>`;

    const task = parseTaskXML(xml);

    expect(task.wave).toBe(1);
    expect(task.type).toBe('auto'); // default
    expect(task.files).toEqual([]);
  });
});
```

### Example: State Manager Test
```typescript
// src/state/state-manager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager } from './state-manager.js';

describe('StateManager', () => {
  let manager: StateManager;

  beforeEach(() => {
    manager = new StateManager();
  });

  describe('mode transitions', () => {
    it('should transition from idle to active', () => {
      expect(manager.getCurrentMode()).toBe('idle');

      manager.transitionTo('active');

      expect(manager.getCurrentMode()).toBe('active');
    });

    it('should reject invalid transitions', () => {
      manager.transitionTo('active');

      expect(() => manager.transitionTo('idle')).toThrow();
    });
  });
});
```

## Vitest Configuration

Current configuration is appropriate. Suggested additions for coverage:

```typescript
// vitest.config.ts (add coverage)
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['references/**/*', 'node_modules/**/*'],
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/**/types.ts',
        'src/**/index.ts',
      ],
      thresholds: {
        global: {
          statements: 70,
          branches: 70,
          functions: 70,
          lines: 70,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
```

## CI Integration

Add to package.json scripts:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ci": "vitest run --coverage --reporter=verbose"
  }
}
```

## Summary Statistics

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Test files in src/ | 9 | 90+ | 81+ |
| Integration tests | 4 | 10+ | 6+ |
| E2E tests | 1 | 5+ | 4+ |
| Coverage % | ~5% | 70%+ | 65%+ |
| Modules with tests | 4/20 | 20/20 | 16 |

## Sources

### Primary (HIGH confidence)
- Vitest documentation (Context7) - Test patterns, coverage configuration
- Project existing tests (`src/**/*.test.ts`) - Current patterns used
- `vitest.config.ts` - Current configuration

### Secondary (MEDIUM confidence)
- oh-my-opencode reference tests - Additional test patterns
- `tests/helpers/` - Existing helper utilities

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Vitest already configured and working
- Architecture: HIGH - Patterns extracted from existing tests
- File list: HIGH - Direct file system analysis
- Priority order: MEDIUM - Based on module criticality assessment

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (stable testing patterns)
