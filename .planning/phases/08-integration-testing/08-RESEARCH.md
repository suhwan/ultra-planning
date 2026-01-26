# Phase 8: 통합 테스트 (Integration Testing) - Research

**Researched:** 2026-01-27
**Domain:** TypeScript E2E integration testing for CLI workflows
**Confidence:** HIGH

## Summary

Integration testing for TypeScript CLI projects requires testing complete workflows end-to-end, including file system operations, state management, and error recovery. The standard approach uses Vitest as the test runner with temporary directory isolation for each test. E2E tests validate the full workflow from command invocation through state changes to file outputs, while error recovery tests verify rollback and retry mechanisms work correctly.

For this Ultra Planner system, integration tests must validate:
1. Complete workflow: /ultraplan:new-project → plan-phase → execute
2. File-based state synchronization (PLAN.md ↔ Tasks API)
3. Error recovery with Git rollback and checkpoint restoration
4. Ralph Loop completion detection and retry logic
5. Document generation (PROJECT.md, ROADMAP.md, PLAN.md)

The key challenge is testing stateful workflows that span multiple modules (state/, documents/, orchestration/, sync/, recovery/) without creating actual Claude Code sessions. Tests use temporary directories, mock state files, and verify file outputs rather than invoking real APIs.

**Primary recommendation:** Use Vitest with temporary directory fixtures, test.extend() for shared setup, and verify complete workflows by checking generated files and state transitions.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^2.0.0 | Test runner | Native ESM support, fast, TypeScript-first, already in package.json |
| @types/node | ^22.0.0 | Node.js types | Type safety for fs, path, os modules used in tests |
| node:fs | Built-in | File operations | Standard Node.js module for file I/O |
| node:os | Built-in | Temp directories | tmpdir() for isolated test environments |
| node:path | Built-in | Path manipulation | Platform-independent path handling |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| simple-git | ^3.30.0 | Git operations | Already in project, needed for testing git rollback |
| zod | ^3.23.0 | Schema validation | Already in project, validate document structure in tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vitest | jest | Jest has better ecosystem but slower ESM support, Vitest chosen for speed |
| Real file system | memfs | memfs faster but misses real fs edge cases, using real tmpdir for accuracy |
| Playwright | N/A | Playwright is for browser E2E, not applicable to CLI testing |

**Installation:**
```bash
# Already installed
npm install vitest @types/node --save-dev
```

## Architecture Patterns

### Recommended Test Structure
```
tests/
├── integration/              # E2E workflow tests
│   ├── workflow.test.ts      # Full /ultraplan:* command flows
│   ├── error-recovery.test.ts # Rollback + retry scenarios
│   └── fixtures/             # Shared test setup
│       ├── temp-dir.ts       # Temporary directory management
│       └── mock-state.ts     # State file factories
└── helpers/                  # Test utilities
    ├── file-assertions.ts    # Verify file contents
    └── state-builders.ts     # Build test state objects
```

### Pattern 1: Temporary Directory Isolation
**What:** Each test gets a unique temporary directory, cleaned up automatically after test completion.
**When to use:** All tests that create/modify files (state files, PLAN.md, PROJECT.md, etc.)
**Example:**
```typescript
// Source: Vitest official docs + oh-my-opencode patterns
import { describe, test, beforeEach, afterEach, expect } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('workflow integration', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `ultra-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('should generate PROJECT.md', () => {
    // Test uses testDir, auto-cleaned after
  });
});
```

### Pattern 2: Fixture-Based Setup with test.extend()
**What:** Define reusable test fixtures that initialize complex state automatically.
**When to use:** Tests that need pre-configured state, mock files, or shared test data.
**Example:**
```typescript
// Source: Vitest Test Context docs
import { test as base } from 'vitest';
import { createTestWorkspace } from './fixtures/workspace';

const test = base.extend<{ workspace: string }>({
  workspace: async ({}, use) => {
    const dir = createTestWorkspace();
    await use(dir);
    cleanupWorkspace(dir);
  }
});

test('generates roadmap', async ({ workspace }) => {
  // workspace fixture auto-created and cleaned up
});
```

### Pattern 3: Mock State Files for Testing
**What:** Create known-good state files programmatically rather than reading from real system.
**When to use:** Testing state transitions, checkpoint restoration, error recovery.
**Example:**
```typescript
// Source: Project pattern from Phase 5 (state management)
function createMockState(overrides?: Partial<StateData>): StateData {
  return {
    phase: 1,
    currentPlan: '01-01',
    status: 'active',
    checkpoints: [],
    ...overrides
  };
}

function writeMockState(dir: string, state: StateData): void {
  const stateFile = join(dir, '.ultraplan', 'state.json');
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
}
```

### Pattern 4: E2E Workflow Testing
**What:** Test complete flows from user input → execution → file outputs → state changes.
**When to use:** Validating the entire system works together correctly.
**Example:**
```typescript
// Source: Integration testing patterns from research
test('full workflow: new-project -> plan-phase -> execute', async () => {
  // Given: Fresh workspace
  const workspace = createTestWorkspace();

  // When: Run new-project command
  await newProject(workspace, {
    name: 'Todo API',
    description: 'Simple REST API'
  });

  // Then: PROJECT.md exists with correct content
  expect(existsSync(join(workspace, '.planning', 'PROJECT.md'))).toBe(true);
  const project = readProjectFile(workspace);
  expect(project.metadata.name).toBe('Todo API');

  // When: Plan first phase
  await planPhase(workspace, { phase: 1 });

  // Then: PLAN.md files generated
  expect(existsSync(join(workspace, '.planning', 'phases', '01-foundation', '01-01-PLAN.md'))).toBe(true);
});
```

### Pattern 5: Error Recovery Testing
**What:** Inject failures, verify rollback mechanisms, test retry logic.
**When to use:** Testing Phase 5 recovery module, checkpoint restoration, Git rollback.
**Example:**
```typescript
// Source: Error recovery best practices + Phase 5 requirements
test('should rollback state on execution failure', async () => {
  // Given: Checkpoint created before execution
  const checkpoint = await createCheckpoint(workspace);

  // When: Execution fails
  const error = new Error('Simulated failure');
  await executeWithMockFailure(workspace, error);

  // Then: State rolled back to checkpoint
  const currentState = readState(workspace);
  expect(currentState.phase).toBe(checkpoint.state.phase);
  expect(currentState.currentPlan).toBe(checkpoint.state.currentPlan);

  // And: Retry count incremented
  expect(currentState.retries).toBe(1);
  expect(currentState.lastError).toContain('Simulated failure');
});
```

### Anti-Patterns to Avoid
- **Shared test directories:** Never reuse directories across tests — causes test interference
- **Testing with real Claude API:** Mock all external API calls — integration tests should be fast and repeatable
- **No cleanup:** Always clean up temp directories in afterEach — prevents disk space leaks
- **Hardcoded paths:** Use path.join() for all paths — ensures cross-platform compatibility
- **Testing implementation details:** Test behavior (files created, state changed) not internal function calls

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Temporary directories | Manual mkdtemp logic | `tmpdir() + Date.now()` | Standard Node.js pattern, auto-cleanup easier |
| File assertions | String comparison | Zod schema validation | Already in project, validates structure not just strings |
| Async test setup | Custom promises | test.extend() fixtures | Vitest handles initialization/cleanup automatically |
| Mock state builders | Manual object creation | Factory functions | Centralized defaults, easy overrides, type-safe |

**Key insight:** Integration tests are complex enough without adding custom infrastructure. Use built-in Node.js modules and Vitest features rather than building test utilities from scratch.

## Common Pitfalls

### Pitfall 1: Test Interference from Shared State
**What goes wrong:** Tests fail intermittently because they share directories or state files, causing race conditions or stale data.
**Why it happens:** Tests run in parallel by default in Vitest. Shared directories mean concurrent writes to same files.
**How to avoid:** Use unique temporary directories per test with `tmpdir() + Date.now() + Math.random()`.
**Warning signs:** Tests pass individually but fail in suite, "ENOENT" or "EEXIST" errors, random failures.

### Pitfall 2: Forgetting Cleanup Leads to Disk Exhaustion
**What goes wrong:** Hundreds of test directories accumulate in /tmp, eventually filling disk.
**Why it happens:** afterEach cleanup skipped or crashes before reaching cleanup code.
**How to avoid:** Always use try-finally or afterEach with force:true. Consider beforeEach validation that temp dir is empty.
**Warning signs:** /tmp grows over time, CI fails with "No space left on device".

### Pitfall 3: Testing Internal Implementation Instead of Behavior
**What goes wrong:** Tests break when refactoring internals, even though behavior is correct.
**Why it happens:** Tests check internal function calls or private state instead of public outputs.
**How to avoid:** Test outputs (files created, state changes) not internals. If you import a function just to spy on it, rethink the test.
**Warning signs:** Every refactor breaks tests, tests import unexported functions, tests know too much about module structure.

### Pitfall 4: Hardcoded Paths Break on Windows
**What goes wrong:** Tests pass on macOS/Linux but fail on Windows due to backslash vs forward slash.
**Why it happens:** String concatenation for paths: `dir + '/file.txt'` instead of `join(dir, 'file.txt')`.
**How to avoid:** Always use path.join() for path construction. Never hardcode slashes.
**Warning signs:** CI failures on Windows runners, path errors with backslashes.

### Pitfall 5: Async Test Timing Issues
**What goes wrong:** Test checks file existence before async operation completes, gets false negative.
**Why it happens:** Forgot await, or operation completes in background after test finishes.
**How to avoid:** Always await async operations. Use Vitest's async test support. Add timeouts if testing eventual consistency.
**Warning signs:** Tests sometimes pass, sometimes fail. Adding setTimeout makes test pass.

## Code Examples

Verified patterns from official sources:

### Creating Isolated Test Workspace
```typescript
// Source: Node.js tmpdir() + oh-my-opencode pattern
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export function createTestWorkspace(): string {
  const testDir = join(tmpdir(), `ultra-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(testDir, { recursive: true });
  return testDir;
}

export function cleanupWorkspace(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}
```

### Testing State Management
```typescript
// Source: Phase 2 state manager + Vitest patterns
import { describe, test, beforeEach, afterEach, expect } from 'vitest';
import { StateManager } from '@/state/state-manager';

describe('StateManager integration', () => {
  let workspace: string;
  let stateManager: StateManager;

  beforeEach(() => {
    workspace = createTestWorkspace();
    stateManager = new StateManager(workspace);
  });

  afterEach(() => {
    cleanupWorkspace(workspace);
  });

  test('should persist and restore state', async () => {
    // Given: Initial state
    const state = { phase: 1, currentPlan: '01-01', status: 'active' };

    // When: Write state
    await stateManager.writeState(state);

    // Then: Can read back
    const restored = await stateManager.readState();
    expect(restored).toEqual(state);
  });
});
```

### Testing Document Generation
```typescript
// Source: Phase 3 document templates + integration testing patterns
test('should generate PROJECT.md with correct structure', async () => {
  // Given: Project metadata
  const metadata = {
    name: 'Todo API',
    description: 'Simple REST API for todos',
    created: new Date().toISOString()
  };

  // When: Generate document
  const generator = new ProjectGenerator(workspace);
  await generator.generate(metadata);

  // Then: File exists
  const projectPath = join(workspace, '.planning', 'PROJECT.md');
  expect(existsSync(projectPath)).toBe(true);

  // And: Content valid
  const content = readFileSync(projectPath, 'utf-8');
  const parsed = parseProjectDocument(content);

  expect(parsed.metadata.name).toBe('Todo API');
  expect(parsed.metadata.description).toContain('REST API');
});
```

### Testing Error Recovery
```typescript
// Source: Phase 5 recovery module patterns
test('should restore checkpoint after error', async () => {
  // Given: Checkpoint exists
  const checkpoint = await createCheckpoint(workspace);

  // When: Modify state then trigger rollback
  await stateManager.writeState({ phase: 2, currentPlan: '02-01', status: 'active' });
  await rollbackToCheckpoint(workspace, checkpoint.id);

  // Then: State restored
  const restored = await stateManager.readState();
  expect(restored.phase).toBe(checkpoint.state.phase);
  expect(restored.currentPlan).toBe(checkpoint.state.currentPlan);
});
```

### Testing Git Operations
```typescript
// Source: simple-git + Phase 3 atomic commits
import simpleGit from 'simple-git';

test('should create atomic commit after task completion', async () => {
  // Given: Git repo initialized
  const git = simpleGit(workspace);
  await git.init();
  await git.addConfig('user.name', 'Test');
  await git.addConfig('user.email', 'test@example.com');

  // When: Complete task triggers commit
  await completeTask(workspace, {
    phase: 1,
    plan: '01-01',
    description: 'Setup TypeScript'
  });

  // Then: Commit created
  const log = await git.log();
  expect(log.latest?.message).toContain('feat(01-01)');
  expect(log.latest?.message).toContain('Setup TypeScript');
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest | Vitest | 2023 | 10-20× faster test execution, native ESM support |
| beforeEach variables | test.extend() fixtures | 2024 | Better type safety, automatic cleanup |
| Manual mock file system | Real tmpdir with cleanup | 2025 | Tests catch real fs edge cases |
| String assertions | Zod schema validation | Current | Validates structure not just content |

**Deprecated/outdated:**
- jest.mock() for ES modules: Vitest's vi.mock() handles ESM correctly
- @testing-library for CLI: Only needed for browser/React testing, not applicable here
- mocha: Replaced by Vitest for TypeScript projects

## Open Questions

Things that couldn't be fully resolved:

1. **How to test Claude Tasks API synchronization without real API?**
   - What we know: Need to mock Task tool invocations
   - What's unclear: Best pattern for simulating Task lifecycle (pending → complete)
   - Recommendation: Create mock Task interface that tracks state changes in-memory

2. **Should E2E tests run actual git operations?**
   - What we know: Real git tests edge cases, but slower
   - What's unclear: Whether speed vs accuracy tradeoff worth it
   - Recommendation: Use real git (simple-git already in project), tests still fast enough (<1s per test)

3. **How to test Ralph Loop completion detection?**
   - What we know: Uses <promise>TAG</promise> detection in transcript
   - What's unclear: How to simulate transcript files without Claude Code session
   - Recommendation: Write mock transcript files with tool_result entries containing promise tags

## Sources

### Primary (HIGH confidence)
- Vitest Official Documentation: https://vitest.dev/guide/
- Node.js fs module: https://nodejs.org/api/fs.html
- Node.js os.tmpdir(): https://nodejs.org/api/os.html#ostmpdir
- Vitest Test Context: https://vitest.dev/guide/test-context
- Vitest Test API: https://vitest.dev/api/

### Secondary (MEDIUM confidence)
- [End-to-end Testing - Tools and Frameworks Guide for 2026](https://bugbug.io/blog/test-automation/end-to-end-testing/)
- [Testing in 2026: Jest, React Testing Library, and Full Stack Testing Strategies](https://www.nucamp.co/blog/testing-in-2026-jest-react-testing-library-and-full-stack-testing-strategies)
- [Vitest Mocking the File System](https://vitest.dev/guide/mocking/file-system)
- [Unit Testing with Vitest | CS4530, Spring 2026](https://neu-se.github.io/CS4530-Spring-2026/tutorials/week1-unit-testing)
- [A Beginner's Guide to Unit Testing with Vitest](https://betterstack.com/community/guides/testing/vitest-explained/)

### Tertiary (LOW confidence)
- [Testing File System Code: Mocking, Stubbing, and Test Patterns](https://dev.to/rezmoss/testing-file-system-code-mocking-stubbing-and-test-patterns-99-1fkh)
- Error recovery patterns: Temporal.io, Argo Workflows retry documentation

### Project Reference
- oh-my-opencode test patterns: /references/oh-my-opencode/src/hooks/ralph-loop/index.test.ts
- oh-my-opencode background agent tests: /references/oh-my-opencode/src/features/background-agent/manager.test.ts

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Vitest already in package.json, Node.js fs/os/path are built-in
- Architecture: HIGH - Patterns verified from Vitest docs and oh-my-opencode reference tests
- Pitfalls: HIGH - Common issues documented in multiple sources + oh-my-opencode test suite

**Research date:** 2026-01-27
**Valid until:** 2026-02-27 (30 days - testing patterns stable)
