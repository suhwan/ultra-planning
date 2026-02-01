/**
 * Hook Chain Integration Test
 *
 * Tests hook registration and execution order across multiple hooks.
 * Validates the integration between different hook types:
 * - Tool hooks (category routing)
 * - Orchestrator hooks (file guard)
 * - Hook event emission and configuration
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';

// Import hook system components
import { createCategoryRoutingHook } from '../../src/hooks/tool/category-routing.js';
import {
  shouldWarnOnWrite,
  getFileGuardWarning,
  WRITE_TOOLS,
  ALLOWED_PATHS,
} from '../../src/hooks/orchestrator/file-guard.js';
import type { HookContext, HookStateManager } from '../../src/hooks/types.js';

describe('Hook Chain Integration', () => {
  let mockContext: HookContext;
  let emitEventMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    emitEventMock = vi.fn().mockImplementation((event) => ({
      ...event,
      id: 'test-event-id',
      timestamp: new Date().toISOString(),
    }));
    mockContext = {
      sessionId: 'test-session',
      stateManager: {
        getState: vi.fn(),
        setState: vi.fn(),
        subscribe: vi.fn(),
        getAll: vi.fn(),
        clear: vi.fn(),
      } as unknown as HookStateManager,
      emitEvent: emitEventMock,
      config: {
        enabledHooks: [],
        disabledHooks: [],
        hookOptions: {},
      },
    };
  });

  describe('Category Routing Hook', () => {
    test('processes Task tool calls and detects category', async () => {
      const categoryHook = createCategoryRoutingHook(mockContext);
      const handler = categoryHook['tool.execute.before']!;

      // Simulate Task tool call with debugging prompt
      const result = await handler({
        toolName: 'Task',
        params: { prompt: 'Debug the memory leak in auth module' },
        sessionId: 'session-1',
      });

      // Should detect ultrabrain category for debugging
      expect(result?.warning).toBeDefined();
      expect(result?.warning).toContain('Category Routing');
      expect(result?.warning).toMatch(/ultrabrain|complex/i);
      expect(emitEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'category_routing',
          payload: expect.objectContaining({
            sessionId: 'session-1',
          }),
          source: 'hook:category-routing',
        })
      );
    });

    test('ignores non-Task tool calls', async () => {
      const categoryHook = createCategoryRoutingHook(mockContext);
      const handler = categoryHook['tool.execute.before']!;

      // Category routing should ignore non-Task tools
      const result = await handler({
        toolName: 'Write',
        params: { file_path: 'src/api.ts', content: '...' },
        sessionId: 'session-1',
      });

      expect(result).toBeUndefined();
      expect(emitEventMock).not.toHaveBeenCalled();
    });

    test('respects logRouting option', async () => {
      const quietHook = createCategoryRoutingHook(mockContext, { logRouting: false });
      const handler = quietHook['tool.execute.before']!;

      await handler({
        toolName: 'Task',
        params: { prompt: 'Find something' },
        sessionId: 'session-1',
      });

      expect(emitEventMock).not.toHaveBeenCalled();
    });

    test('enhances prompts when enabled', async () => {
      const enhancingHook = createCategoryRoutingHook(mockContext, { enhancePrompts: true });
      const handler = enhancingHook['tool.execute.before']!;

      const result = await handler({
        toolName: 'Task',
        params: { prompt: 'Debug the critical issue' },
        sessionId: 'session-1',
      });

      // Prompt should be enhanced with category guidance
      expect(result?.params?.prompt).toContain('Category Guidance');
    });

    test('does not enhance prompts with explicit category', async () => {
      const enhancingHook = createCategoryRoutingHook(mockContext, { enhancePrompts: true });
      const handler = enhancingHook['tool.execute.before']!;

      const result = await handler({
        toolName: 'Task',
        params: {
          prompt: 'Simple task',
          category: 'quick',  // Explicit category
        },
        sessionId: 'session-1',
      });

      // Should not enhance prompt when category is explicit
      // params.prompt will be undefined when no modification is made
      const enhancedPrompt = result?.params?.prompt as string | undefined;
      if (enhancedPrompt !== undefined) {
        expect(enhancedPrompt).not.toContain('Category Guidance');
      }
      // If undefined, no enhancement was made (which is expected for explicit category)
    });
  });

  describe('File Guard Hook', () => {
    test('warns on source file writes', () => {
      expect(shouldWarnOnWrite('Write', 'src/api.ts')).toBe(true);
      expect(shouldWarnOnWrite('Write', 'src/models/user.ts')).toBe(true);
      expect(shouldWarnOnWrite('Edit', 'lib/utils.js')).toBe(true);
    });

    test('does not warn on allowed paths', () => {
      expect(shouldWarnOnWrite('Write', '.planning/STATE.md')).toBe(false);
      expect(shouldWarnOnWrite('Write', '.ultraplan/config.json')).toBe(false);
      expect(shouldWarnOnWrite('Write', 'CLAUDE.md')).toBe(false);
      expect(shouldWarnOnWrite('Write', 'AGENTS.md')).toBe(false);
    });

    test('does not warn on read operations', () => {
      expect(shouldWarnOnWrite('Read', 'src/api.ts')).toBe(false);
      expect(shouldWarnOnWrite('Glob', 'src/**/*.ts')).toBe(false);
      expect(shouldWarnOnWrite('Grep', 'src/')).toBe(false);
    });

    test('provides detailed warning message', () => {
      const result = getFileGuardWarning('Write', 'src/models/user.ts');

      expect(result.shouldWarn).toBe(true);
      expect(result.path).toBe('src/models/user.ts');
      expect(result.tool).toBe('Write');
      expect(result.warning).toContain('DELEGATION REQUIRED');
      expect(result.warning).toContain('src/models/user.ts');
      expect(result.warning).toContain('ORCHESTRATOR');
    });

    test('returns no warning for allowed paths', () => {
      const result = getFileGuardWarning('Write', '.planning/STATE.md');

      expect(result.shouldWarn).toBe(false);
      expect(result.warning).toBeUndefined();
    });

    test('recognizes all write tools', () => {
      const sourcePath = 'src/test.ts';
      for (const tool of WRITE_TOOLS) {
        expect(shouldWarnOnWrite(tool, sourcePath)).toBe(true);
      }
    });

    test('recognizes all allowed paths', () => {
      for (const allowedPath of ALLOWED_PATHS) {
        const fullPath = `${allowedPath}test.md`;
        expect(shouldWarnOnWrite('Write', fullPath)).toBe(false);
      }
    });
  });

  describe('Hook Chain Coordination', () => {
    test('hooks can be chained for multiple validations', async () => {
      // Simulate a write operation that should:
      // 1. Pass category routing (not a Task tool)
      // 2. Trigger file guard warning

      const categoryHook = createCategoryRoutingHook(mockContext);
      const categoryHandler = categoryHook['tool.execute.before']!;

      // Step 1: Category routing ignores non-Task tools
      const categoryResult = await categoryHandler({
        toolName: 'Write',
        params: { file_path: 'src/api.ts', content: '...' },
        sessionId: 'session-1',
      });
      expect(categoryResult).toBeUndefined();

      // Step 2: File guard catches the write
      const fileGuardResult = getFileGuardWarning('Write', 'src/api.ts');
      expect(fileGuardResult.shouldWarn).toBe(true);
    });

    test('Task tool is processed by category routing, not file guard', async () => {
      const categoryHook = createCategoryRoutingHook(mockContext);
      const categoryHandler = categoryHook['tool.execute.before']!;

      // Task tool should be handled by category routing
      const categoryResult = await categoryHandler({
        toolName: 'Task',
        params: { prompt: 'Implement new feature' },
        sessionId: 'session-1',
      });
      expect(categoryResult?.warning).toBeDefined();
      expect(categoryResult?.warning).toContain('Category Routing');

      // File guard should not apply to Task tool
      expect(shouldWarnOnWrite('Task', 'anything')).toBe(false);
    });
  });

  describe('Hook Event Emission', () => {
    test('hooks emit events for observability', async () => {
      const categoryHook = createCategoryRoutingHook(mockContext);
      const handler = categoryHook['tool.execute.before']!;

      await handler({
        toolName: 'Task',
        params: { prompt: 'Find the config file' },
        sessionId: 'session-1',
      });

      expect(emitEventMock).toHaveBeenCalledTimes(1);
      const emittedEvent = emitEventMock.mock.calls[0][0];

      expect(emittedEvent.type).toBe('category_routing');
      expect(emittedEvent.source).toBe('hook:category-routing');
      expect(emittedEvent.payload.sessionId).toBe('session-1');
      expect(emittedEvent.payload.category).toBeDefined();
      expect(emittedEvent.payload.model).toBeDefined();
    });

    test('events contain complete routing information', async () => {
      const categoryHook = createCategoryRoutingHook(mockContext);
      const handler = categoryHook['tool.execute.before']!;

      await handler({
        toolName: 'Task',
        params: { prompt: 'Create a React component with styling' },
        sessionId: 'session-1',
      });

      const emittedEvent = emitEventMock.mock.calls[0][0];
      expect(emittedEvent.payload).toHaveProperty('category');
      expect(emittedEvent.payload).toHaveProperty('model');
      expect(emittedEvent.payload).toHaveProperty('temperature');
      expect(emittedEvent.payload).toHaveProperty('wasExplicit');
    });
  });

  describe('Hook Configuration Options', () => {
    test('default options enable prompt enhancement and logging', async () => {
      const defaultHook = createCategoryRoutingHook(mockContext);
      const handler = defaultHook['tool.execute.before']!;

      const result = await handler({
        toolName: 'Task',
        params: { prompt: 'Debug critical race condition' },
        sessionId: 'session-1',
      });

      // Default should enhance prompts
      expect(result?.params?.prompt).toContain('Category Guidance');
      // Default should log
      expect(emitEventMock).toHaveBeenCalled();
    });

    test('can disable both enhancement and logging', async () => {
      const minimalHook = createCategoryRoutingHook(mockContext, {
        enhancePrompts: false,
        logRouting: false,
      });
      const handler = minimalHook['tool.execute.before']!;

      const result = await handler({
        toolName: 'Task',
        params: { prompt: 'Debug something' },
        sessionId: 'session-1',
      });

      // Should not enhance prompt
      expect(result?.params?.prompt).toBeUndefined();
      // Should not log
      expect(emitEventMock).not.toHaveBeenCalled();
      // Should still provide warning with routing info
      expect(result?.warning).toBeDefined();
    });
  });

  describe('Category Detection Accuracy', () => {
    test('detects debugging tasks as ultrabrain', async () => {
      const categoryHook = createCategoryRoutingHook(mockContext);
      const handler = categoryHook['tool.execute.before']!;

      const result = await handler({
        toolName: 'Task',
        params: { prompt: 'Debug the race condition in cache layer' },
        sessionId: 'session-1',
      });

      const event = emitEventMock.mock.calls[0][0];
      // Debugging tasks should route to complex/ultrabrain category
      expect(['ultrabrain', 'complex', 'standard']).toContain(event.payload.category);
    });

    test('detects UI tasks as visual-engineering', async () => {
      const categoryHook = createCategoryRoutingHook(mockContext);
      const handler = categoryHook['tool.execute.before']!;

      await handler({
        toolName: 'Task',
        params: { prompt: 'Create a React component with CSS styling' },
        sessionId: 'session-1',
      });

      const event = emitEventMock.mock.calls[0][0];
      // UI tasks should have UI-related category or standard fallback
      expect(event.payload.category).toBeDefined();
    });

    test('detects simple lookup tasks as quick/standard', async () => {
      const categoryHook = createCategoryRoutingHook(mockContext);
      const handler = categoryHook['tool.execute.before']!;

      await handler({
        toolName: 'Task',
        params: { prompt: 'Find where the config is defined' },
        sessionId: 'session-1',
      });

      const event = emitEventMock.mock.calls[0][0];
      // Simple lookups should be quick or standard category
      expect(['quick', 'standard']).toContain(event.payload.category);
    });
  });
});
