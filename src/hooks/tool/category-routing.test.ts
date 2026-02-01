/**
 * Category Routing Hook Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCategoryRoutingHook } from './category-routing.js';
import type { HookContext, ToolExecuteBeforeInput } from '../types.js';

describe('Category Routing Hook', () => {
  let ctx: HookContext;
  let emitEventMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    emitEventMock = vi.fn();
    ctx = {
      sessionId: 'test-session',
      stateManager: {} as any,
      emitEvent: emitEventMock,
      config: {
        enabledHooks: [],
        disabledHooks: [],
        hookOptions: {},
      },
    };
  });

  describe('createCategoryRoutingHook', () => {
    it('should return tool.execute.before handler', () => {
      const handlers = createCategoryRoutingHook(ctx);
      expect(handlers['tool.execute.before']).toBeDefined();
    });

    it('should ignore non-Task tools', async () => {
      const handlers = createCategoryRoutingHook(ctx);
      const handler = handlers['tool.execute.before']!;

      const result = await handler({
        toolName: 'Read',
        params: { file_path: '/test' },
        sessionId: 'session-1',
      });

      expect(result).toBeUndefined();
      expect(emitEventMock).not.toHaveBeenCalled();
    });

    it('should detect ultrabrain category for debugging prompts', async () => {
      const handlers = createCategoryRoutingHook(ctx);
      const handler = handlers['tool.execute.before']!;

      const result = await handler({
        toolName: 'Task',
        params: { prompt: 'Debug the race condition in auth' },
        sessionId: 'session-1',
      });

      expect(result?.warning).toContain('ultrabrain');
      expect(result?.warning).toContain('opus');
      expect(emitEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'category_routing',
          payload: expect.objectContaining({
            category: 'ultrabrain',
            model: 'opus',
          }),
        })
      );
    });

    it('should detect quick category for lookup prompts', async () => {
      const handlers = createCategoryRoutingHook(ctx);
      const handler = handlers['tool.execute.before']!;

      const result = await handler({
        toolName: 'Task',
        params: { prompt: 'Find the user model file' },
        sessionId: 'session-1',
      });

      expect(result?.warning).toContain('quick');
      expect(result?.warning).toContain('haiku');
    });

    it('should respect explicit category', async () => {
      const handlers = createCategoryRoutingHook(ctx);
      const handler = handlers['tool.execute.before']!;

      const result = await handler({
        toolName: 'Task',
        params: {
          prompt: 'Simple task',
          category: 'ultrabrain',
        },
        sessionId: 'session-1',
      });

      expect(result?.warning).toContain('ultrabrain');
      expect(emitEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            category: 'ultrabrain',
            wasExplicit: true,
          }),
        })
      );
    });

    it('should enhance prompts when enabled and not explicit', async () => {
      const handlers = createCategoryRoutingHook(ctx, { enhancePrompts: true });
      const handler = handlers['tool.execute.before']!;

      const result = await handler({
        toolName: 'Task',
        params: { prompt: 'Debug the issue' },
        sessionId: 'session-1',
      });

      // ultrabrain has prompt enhancement
      expect(result?.params?.prompt).toContain('Category Guidance');
      expect(result?.params?.prompt).toContain('Root cause analysis');
    });

    it('should not enhance prompts when disabled', async () => {
      const handlers = createCategoryRoutingHook(ctx, { enhancePrompts: false });
      const handler = handlers['tool.execute.before']!;

      const result = await handler({
        toolName: 'Task',
        params: { prompt: 'Debug the issue' },
        sessionId: 'session-1',
      });

      expect(result?.params).toBeUndefined();
    });

    it('should not enhance prompts when explicit category is provided', async () => {
      const handlers = createCategoryRoutingHook(ctx, { enhancePrompts: true });
      const handler = handlers['tool.execute.before']!;

      const result = await handler({
        toolName: 'Task',
        params: { prompt: 'Debug the issue', category: 'ultrabrain' },
        sessionId: 'session-1',
      });

      // When explicit category is provided, prompt is not enhanced
      expect(result?.params).toBeUndefined();
    });

    it('should include thinking tokens in routing hint', async () => {
      const handlers = createCategoryRoutingHook(ctx);
      const handler = handlers['tool.execute.before']!;

      const result = await handler({
        toolName: 'Task',
        params: { prompt: 'Debug complex issue' },
        sessionId: 'session-1',
      });

      expect(result?.warning).toContain('thinking=');
      expect(result?.warning).toContain('tokens');
    });

    it('should not log when logRouting is false', async () => {
      const handlers = createCategoryRoutingHook(ctx, { logRouting: false });
      const handler = handlers['tool.execute.before']!;

      await handler({
        toolName: 'Task',
        params: { prompt: 'Do something' },
        sessionId: 'session-1',
      });

      expect(emitEventMock).not.toHaveBeenCalled();
    });

    it('should skip if no prompt to analyze', async () => {
      const handlers = createCategoryRoutingHook(ctx);
      const handler = handlers['tool.execute.before']!;

      const result = await handler({
        toolName: 'Task',
        params: {},
        sessionId: 'session-1',
      });

      expect(result).toBeUndefined();
      expect(emitEventMock).not.toHaveBeenCalled();
    });

    it('should use description if prompt is not provided', async () => {
      const handlers = createCategoryRoutingHook(ctx);
      const handler = handlers['tool.execute.before']!;

      const result = await handler({
        toolName: 'Task',
        params: { description: 'Find the config file' },
        sessionId: 'session-1',
      });

      expect(result?.warning).toContain('quick');
      expect(result?.warning).toContain('haiku');
    });

    it('should include model temperature in routing hint', async () => {
      const handlers = createCategoryRoutingHook(ctx);
      const handler = handlers['tool.execute.before']!;

      const result = await handler({
        toolName: 'Task',
        params: { prompt: 'Debug the issue' },
        sessionId: 'session-1',
      });

      expect(result?.warning).toContain('temp=');
    });

    it('should emit category_routing event with full payload', async () => {
      const handlers = createCategoryRoutingHook(ctx);
      const handler = handlers['tool.execute.before']!;

      await handler({
        toolName: 'Task',
        params: { prompt: 'Debug the memory leak' },
        sessionId: 'session-1',
      });

      expect(emitEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'category_routing',
          source: 'hook:category-routing',
          payload: expect.objectContaining({
            sessionId: 'session-1',
            category: 'ultrabrain',
            model: 'opus',
            temperature: expect.any(Number),
            thinkingBudget: 'max',
            thinkingTokens: expect.any(Number),
            wasExplicit: false,
          }),
        })
      );
    });
  });
});
