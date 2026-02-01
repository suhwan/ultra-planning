/**
 * Keyword Patterns Tests
 *
 * Tests for magic keyword patterns and detection.
 */

import { describe, it, expect } from 'vitest';
import {
  AUTOPILOT_KEYWORD,
  PLAN_KEYWORD,
  ULTRAWORK_KEYWORD,
  RALPLAN_KEYWORD,
  BUILTIN_KEYWORDS,
} from './patterns.js';
import { detectKeywords, removeCodeBlocks, createKeywordProcessor } from './processor.js';

// ============================================================================
// Individual Keyword Tests
// ============================================================================

describe('AUTOPILOT_KEYWORD', () => {
  it('should have correct triggers', () => {
    expect(AUTOPILOT_KEYWORD.triggers).toContain('autopilot');
    expect(AUTOPILOT_KEYWORD.triggers).toContain('build me');
    expect(AUTOPILOT_KEYWORD.triggers).toContain('create me');
    expect(AUTOPILOT_KEYWORD.triggers).toContain('make me');
  });

  it('should have description', () => {
    expect(AUTOPILOT_KEYWORD.description).toBeTruthy();
    expect(typeof AUTOPILOT_KEYWORD.description).toBe('string');
  });

  it('should transform prompt with action', () => {
    const result = AUTOPILOT_KEYWORD.action('autopilot: build a todo app');
    expect(result).toContain('[AUTOPILOT MODE]');
    expect(result).toContain('autonomous execution');
  });

  it('should remove trigger word from prompt', () => {
    const result = AUTOPILOT_KEYWORD.action('autopilot: build a todo app');
    expect(result).toContain('build a todo app');
    // The word 'autopilot' itself should be removed
    expect(result.match(/\bautopilot\b/gi)?.length || 0).toBeLessThanOrEqual(1);
  });
});

describe('PLAN_KEYWORD', () => {
  it('should have correct triggers', () => {
    expect(PLAN_KEYWORD.triggers).toContain('plan');
    expect(PLAN_KEYWORD.triggers).toContain('plan this');
    expect(PLAN_KEYWORD.triggers).toContain('plan the');
  });

  it('should transform prompt with action', () => {
    const result = PLAN_KEYWORD.action('plan this feature implementation');
    expect(result).toContain('[PLANNING MODE]');
  });
});

describe('ULTRAWORK_KEYWORD', () => {
  it('should have correct triggers', () => {
    expect(ULTRAWORK_KEYWORD.triggers).toContain('ultrawork');
    expect(ULTRAWORK_KEYWORD.triggers).toContain('ulw');
    expect(ULTRAWORK_KEYWORD.triggers).toContain('uw');
  });

  it('should transform prompt with action', () => {
    const result = ULTRAWORK_KEYWORD.action('ulw fix all errors');
    expect(result).toContain('[ULTRAWORK MODE]');
    expect(result).toContain('parallel execution');
  });
});

describe('RALPLAN_KEYWORD', () => {
  it('should have correct triggers', () => {
    expect(RALPLAN_KEYWORD.triggers).toContain('ralplan');
    expect(RALPLAN_KEYWORD.triggers).toContain('iterative plan');
  });

  it('should transform prompt with action', () => {
    const result = RALPLAN_KEYWORD.action('ralplan the new feature');
    expect(result).toContain('[RALPLAN MODE]');
    expect(result).toContain('verification loop');
  });
});

describe('BUILTIN_KEYWORDS', () => {
  it('should contain all standard keywords', () => {
    expect(BUILTIN_KEYWORDS).toContain(AUTOPILOT_KEYWORD);
    expect(BUILTIN_KEYWORDS).toContain(PLAN_KEYWORD);
    expect(BUILTIN_KEYWORDS).toContain(ULTRAWORK_KEYWORD);
    expect(BUILTIN_KEYWORDS).toContain(RALPLAN_KEYWORD);
  });

  it('should have at least 4 built-in keywords', () => {
    expect(BUILTIN_KEYWORDS.length).toBeGreaterThanOrEqual(4);
  });
});

// ============================================================================
// removeCodeBlocks Tests
// ============================================================================

describe('removeCodeBlocks', () => {
  it('should remove fenced code blocks', () => {
    const text = 'Use the autopilot command:\n```\nautopilot run\n```\nto start.';
    const result = removeCodeBlocks(text);
    expect(result).not.toContain('```');
    expect(result).not.toContain('autopilot run');
    expect(result).toContain('Use the autopilot command:');
  });

  it('should remove inline code', () => {
    const text = 'Run `autopilot` to start the process.';
    const result = removeCodeBlocks(text);
    expect(result).not.toContain('`autopilot`');
  });

  it('should preserve text outside code blocks', () => {
    const text = 'Please autopilot this task. Here is code: `example()`. More text.';
    const result = removeCodeBlocks(text);
    expect(result).toContain('Please autopilot this task');
    expect(result).toContain('More text');
  });
});

// ============================================================================
// detectKeywords Tests
// ============================================================================

describe('detectKeywords', () => {
  it('should detect "autopilot" trigger', () => {
    const result = detectKeywords('autopilot: build a REST API');
    expect(result.hasKeywords).toBe(true);
    expect(result.detected).toContain('autopilot');
  });

  it('should detect "build me" trigger', () => {
    const result = detectKeywords('build me a dashboard');
    expect(result.hasKeywords).toBe(true);
    expect(result.detected).toContain('build me');
  });

  it('should detect "ulw" trigger', () => {
    const result = detectKeywords('ulw fix all TypeScript errors');
    expect(result.hasKeywords).toBe(true);
    expect(result.detected).toContain('ulw');
  });

  it('should detect "ultrawork" trigger', () => {
    const result = detectKeywords('ultrawork: implement feature');
    expect(result.hasKeywords).toBe(true);
    expect(result.detected).toContain('ultrawork');
  });

  it('should detect "plan this" trigger', () => {
    const result = detectKeywords('plan this API implementation');
    expect(result.hasKeywords).toBe(true);
    expect(result.detected).toContain('plan');
  });

  it('should detect "ralplan" trigger', () => {
    const result = detectKeywords('ralplan the feature');
    expect(result.hasKeywords).toBe(true);
    expect(result.detected).toContain('ralplan');
  });

  it('should be case insensitive', () => {
    expect(detectKeywords('AUTOPILOT: start').hasKeywords).toBe(true);
    expect(detectKeywords('AutoPilot build').hasKeywords).toBe(true);
    expect(detectKeywords('ULW fix errors').hasKeywords).toBe(true);
    expect(detectKeywords('RalPlan this').hasKeywords).toBe(true);
  });

  it('should return empty array for no matches', () => {
    const result = detectKeywords('just a regular prompt with no keywords');
    expect(result.hasKeywords).toBe(false);
    expect(result.detected).toEqual([]);
  });

  it('should not match partial words', () => {
    // "autopiloting" should not match "autopilot" due to word boundary
    const result = detectKeywords('autopiloting is fun');
    // This depends on implementation - the current regex uses word boundaries
    expect(result.detected.includes('autopilot')).toBe(false);
  });

  it('should not match keywords inside code blocks', () => {
    const result = detectKeywords('Run this:\n```\nautopilot start\n```\nto begin.');
    expect(result.detected).not.toContain('autopilot');
  });

  it('should not match keywords inside inline code', () => {
    const result = detectKeywords('Use the `autopilot` command');
    expect(result.detected).not.toContain('autopilot');
  });

  it('should detect multiple keywords in one message', () => {
    const result = detectKeywords('autopilot: ulw build the feature');
    expect(result.hasKeywords).toBe(true);
    expect(result.detected.length).toBeGreaterThanOrEqual(2);
  });

  it('should preserve original prompt in result', () => {
    const prompt = 'autopilot: do something';
    const result = detectKeywords(prompt);
    expect(result.originalPrompt).toBe(prompt);
  });

  it('should include cleaned prompt in result', () => {
    const prompt = 'autopilot with `code` blocks';
    const result = detectKeywords(prompt);
    expect(result.cleanedPrompt).not.toContain('`code`');
  });
});

// ============================================================================
// createKeywordProcessor Tests
// ============================================================================

describe('createKeywordProcessor', () => {
  it('should create processor function', () => {
    const processor = createKeywordProcessor();
    expect(typeof processor).toBe('function');
  });

  it('should enhance prompt with autopilot action', () => {
    const processor = createKeywordProcessor();
    const result = processor('autopilot: build a todo app');
    expect(result).toContain('[AUTOPILOT MODE]');
  });

  it('should enhance prompt with ultrawork action', () => {
    const processor = createKeywordProcessor();
    const result = processor('ulw fix errors');
    expect(result).toContain('[ULTRAWORK MODE]');
  });

  it('should support custom keywords via config', () => {
    const customKeyword = {
      triggers: ['mymode'],
      description: 'Custom mode',
      action: (prompt: string) => `[CUSTOM] ${prompt}`,
    };

    const processor = createKeywordProcessor({ custom: [customKeyword] });
    const result = processor('mymode: do something');
    expect(result).toContain('[CUSTOM]');
  });

  it('should apply multiple keyword actions if detected', () => {
    const processor = createKeywordProcessor();
    const result = processor('autopilot ulw: implement feature');
    expect(result).toContain('[AUTOPILOT MODE]');
    expect(result).toContain('[ULTRAWORK MODE]');
  });

  it('should return original prompt if no keywords detected', () => {
    const processor = createKeywordProcessor();
    const input = 'just a regular prompt';
    const result = processor(input);
    expect(result).toBe(input);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty string', () => {
    const result = detectKeywords('');
    expect(result.hasKeywords).toBe(false);
    expect(result.detected).toEqual([]);
  });

  it('should handle whitespace only', () => {
    const result = detectKeywords('   \n\t  ');
    expect(result.hasKeywords).toBe(false);
  });

  it('should handle keywords at start of string', () => {
    const result = detectKeywords('autopilot now');
    expect(result.hasKeywords).toBe(true);
    expect(result.detected).toContain('autopilot');
  });

  it('should handle keywords at end of string', () => {
    const result = detectKeywords('start autopilot');
    expect(result.hasKeywords).toBe(true);
    expect(result.detected).toContain('autopilot');
  });

  it('should handle keywords with punctuation', () => {
    const result = detectKeywords('autopilot, please');
    expect(result.hasKeywords).toBe(true);
    expect(result.detected).toContain('autopilot');
  });

  it('should handle keywords in quotes', () => {
    const result = detectKeywords('"autopilot" mode');
    expect(result.hasKeywords).toBe(true);
  });

  it('should handle multi-word triggers correctly', () => {
    const result = detectKeywords('please build me a dashboard');
    expect(result.hasKeywords).toBe(true);
    expect(result.detected).toContain('build me');
  });
});
