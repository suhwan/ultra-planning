/**
 * Pipeline Manager Tests - Simplified for Context Architect Pattern
 *
 * Tests pipeline creation, presets, and prompt generation.
 * State management is delegated to Claude Code's Task API.
 */

import { describe, it, expect } from 'vitest';
import {
  createPipelineFromPreset,
  createCustomPipeline,
  parsePipelineString,
  buildStagePrompt,
  listPresets,
  generatePipelineOrchestratorPrompt,
  generateStagePrompt,
  getParallelGroups,
  estimatePipelineDuration,
  generatePipelineSessionId,
  createPipelineConfig,
  PIPELINE_PRESETS,
} from './manager.js';
import { DEFAULT_PIPELINE_CONFIG } from './types.js';

describe('Pipeline Creation', () => {
  describe('createPipelineFromPreset', () => {
    it('should create review pipeline', () => {
      const pipeline = createPipelineFromPreset('review');

      expect(pipeline.name).toBe('review');
      expect(pipeline.stages.length).toBe(4);
      expect(pipeline.stages[0].name).toBe('explore');
      expect(pipeline.stages[1].name).toBe('analyze');
      expect(pipeline.stages[2].name).toBe('critique');
      expect(pipeline.stages[3].name).toBe('fix');
    });

    it('should create implement pipeline', () => {
      const pipeline = createPipelineFromPreset('implement');

      expect(pipeline.name).toBe('implement');
      expect(pipeline.stages.length).toBe(3);
    });

    it('should create debug pipeline', () => {
      const pipeline = createPipelineFromPreset('debug');

      expect(pipeline.name).toBe('debug');
      expect(pipeline.stages.length).toBe(3);
    });

    it('should include initial input when provided', () => {
      const pipeline = createPipelineFromPreset('debug', 'Fix the login bug');

      expect(pipeline.initialInput).toBe('Fix the login bug');
    });

    it('should set stopOnFailure to true by default', () => {
      const pipeline = createPipelineFromPreset('review');

      expect(pipeline.stopOnFailure).toBe(true);
    });
  });

  describe('parsePipelineString', () => {
    it('should parse simple pipeline string', () => {
      const pipeline = parsePipelineString('explore:haiku -> architect:opus');

      expect(pipeline.stages.length).toBe(2);
      expect(pipeline.stages[0].agent).toBe('explore');
      expect(pipeline.stages[0].model).toBe('haiku');
      expect(pipeline.stages[1].agent).toBe('architect');
      expect(pipeline.stages[1].model).toBe('opus');
    });

    it('should parse pipeline with three stages', () => {
      const pipeline = parsePipelineString('explore:haiku -> architect:opus -> executor:sonnet');

      expect(pipeline.stages.length).toBe(3);
    });

    it('should parse pipeline with custom name', () => {
      const pipeline = parsePipelineString(
        'executor:sonnet -> qa-tester:sonnet',
        'My Pipeline'
      );

      expect(pipeline.name).toBe('My Pipeline');
    });

    it('should assign default prompt templates', () => {
      const pipeline = parsePipelineString('explore:haiku -> architect:opus');

      expect(pipeline.stages[0].promptTemplate).toBe('{input}');
      expect(pipeline.stages[1].promptTemplate).toContain('{input}');
    });
  });

  describe('createCustomPipeline', () => {
    it('should create custom pipeline with all options', () => {
      const pipeline = createCustomPipeline(
        'Custom',
        'My custom pipeline',
        [
          { name: 'step1', agent: 'explore', promptTemplate: '{input}' },
          { name: 'step2', agent: 'executor', promptTemplate: 'Do: {input}' },
        ],
        { initialInput: 'Start here', stopOnFailure: false, timeoutMs: 60000 }
      );

      expect(pipeline.name).toBe('Custom');
      expect(pipeline.description).toBe('My custom pipeline');
      expect(pipeline.stages.length).toBe(2);
      expect(pipeline.initialInput).toBe('Start here');
      expect(pipeline.stopOnFailure).toBe(false);
      expect(pipeline.timeoutMs).toBe(60000);
    });

    it('should default stopOnFailure to true', () => {
      const pipeline = createCustomPipeline('Test', 'Test', []);

      expect(pipeline.stopOnFailure).toBe(true);
    });
  });
});

describe('Prompt Generation', () => {
  describe('buildStagePrompt', () => {
    it('should replace {input} placeholder', () => {
      const stage = {
        name: 'test',
        agent: 'explore' as const,
        promptTemplate: 'Find files for: {input}',
      };

      const prompt = buildStagePrompt(stage, 'authentication');

      expect(prompt).toBe('Find files for: authentication');
    });

    it('should handle multiple placeholders', () => {
      const stage = {
        name: 'test',
        agent: 'explore' as const,
        promptTemplate: 'First: {input}, Second: {input}',
      };

      const prompt = buildStagePrompt(stage, 'test');

      expect(prompt).toBe('First: test, Second: test');
    });
  });

  describe('generatePipelineOrchestratorPrompt', () => {
    it('should include pipeline name and description', () => {
      const pipeline = createPipelineFromPreset('review');
      const prompt = generatePipelineOrchestratorPrompt(pipeline, 'session-123');

      expect(prompt).toContain('Pipeline Orchestrator: review');
      expect(prompt).toContain(pipeline.description);
    });

    it('should include session ID', () => {
      const pipeline = createPipelineFromPreset('review');
      const prompt = generatePipelineOrchestratorPrompt(pipeline, 'session-123');

      expect(prompt).toContain('session-123');
    });

    it('should list all stages', () => {
      const pipeline = createPipelineFromPreset('review');
      const prompt = generatePipelineOrchestratorPrompt(pipeline, 'session');

      expect(prompt).toContain('explore');
      expect(prompt).toContain('analyze');
      expect(prompt).toContain('critique');
      expect(prompt).toContain('fix');
    });

    it('should include Task tool instructions', () => {
      const pipeline = createPipelineFromPreset('review');
      const prompt = generatePipelineOrchestratorPrompt(pipeline, 'session');

      expect(prompt).toContain('Task(');
      expect(prompt).toContain('subagent_type');
    });
  });

  describe('generateStagePrompt', () => {
    it('should include stage number and total', () => {
      const stage = {
        name: 'test',
        agent: 'explore' as const,
        promptTemplate: 'Find: {input}',
      };

      const prompt = generateStagePrompt(stage, 'test input', 2, 5);

      expect(prompt).toContain('Stage 2/5');
      expect(prompt).toContain('test');
    });

    it('should include context about pipeline position', () => {
      const stage = {
        name: 'analyze',
        agent: 'architect' as const,
        promptTemplate: 'Analyze: {input}',
      };

      const prompt = generateStagePrompt(stage, 'data', 1, 3);

      expect(prompt).toContain('stage 1 of 3');
      expect(prompt).toContain('next stage');
    });
  });
});

describe('Utility Functions', () => {
  describe('listPresets', () => {
    it('should list all presets', () => {
      const presets = listPresets();

      expect(presets.length).toBe(6);
      expect(presets.map(p => p.name)).toContain('review');
      expect(presets.map(p => p.name)).toContain('implement');
      expect(presets.map(p => p.name)).toContain('debug');
      expect(presets.map(p => p.name)).toContain('research');
      expect(presets.map(p => p.name)).toContain('refactor');
      expect(presets.map(p => p.name)).toContain('security');
    });

    it('should include stage counts', () => {
      const presets = listPresets();
      const review = presets.find(p => p.name === 'review');

      expect(review?.stageCount).toBe(4);
    });
  });

  describe('getParallelGroups', () => {
    it('should group sequential stages separately', () => {
      const pipeline = createPipelineFromPreset('review');
      const groups = getParallelGroups(pipeline);

      // Review pipeline has no parallel stages, so each is its own group
      expect(groups.length).toBe(4);
      expect(groups.every(g => g.length === 1)).toBe(true);
    });

    it('should group parallel stages together', () => {
      const pipeline = createPipelineFromPreset('research');
      const groups = getParallelGroups(pipeline);

      // Research has 2 parallel stages at the start
      expect(groups[0].length).toBe(2);
    });
  });

  describe('estimatePipelineDuration', () => {
    it('should estimate duration based on stage count', () => {
      const pipeline = createPipelineFromPreset('review');
      const result = estimatePipelineDuration(pipeline, 5);

      // 4 stages, 5 minutes each = 20 minutes (no parallel)
      expect(result.estimatedMinutes).toBe(20);
      expect(result.hasParallelStages).toBe(false);
    });

    it('should detect parallel stages', () => {
      const pipeline = createPipelineFromPreset('research');
      const result = estimatePipelineDuration(pipeline, 5);

      expect(result.hasParallelStages).toBe(true);
    });
  });

  describe('generatePipelineSessionId', () => {
    it('should generate unique IDs', () => {
      const id1 = generatePipelineSessionId();
      const id2 = generatePipelineSessionId();

      expect(id1).not.toBe(id2);
    });

    it('should start with "pipeline-"', () => {
      const id = generatePipelineSessionId();

      expect(id).toMatch(/^pipeline-/);
    });
  });

  describe('createPipelineConfig', () => {
    it('should return defaults when no options provided', () => {
      const config = createPipelineConfig();

      expect(config.defaultStageTimeoutMs).toBe(DEFAULT_PIPELINE_CONFIG.defaultStageTimeoutMs);
      expect(config.stopOnFailure).toBe(DEFAULT_PIPELINE_CONFIG.stopOnFailure);
    });

    it('should override defaults with provided options', () => {
      const config = createPipelineConfig({ stopOnFailure: false });

      expect(config.stopOnFailure).toBe(false);
      expect(config.enableParallel).toBe(DEFAULT_PIPELINE_CONFIG.enableParallel);
    });
  });
});

describe('PIPELINE_PRESETS', () => {
  it('should define all presets', () => {
    expect(PIPELINE_PRESETS.review).toBeDefined();
    expect(PIPELINE_PRESETS.implement).toBeDefined();
    expect(PIPELINE_PRESETS.debug).toBeDefined();
    expect(PIPELINE_PRESETS.research).toBeDefined();
    expect(PIPELINE_PRESETS.refactor).toBeDefined();
    expect(PIPELINE_PRESETS.security).toBeDefined();
  });

  it('should have valid stages in each preset', () => {
    for (const [name, preset] of Object.entries(PIPELINE_PRESETS)) {
      expect(preset.stages.length).toBeGreaterThan(0);
      for (const stage of preset.stages) {
        expect(stage.name).toBeTruthy();
        expect(stage.agent).toBeTruthy();
        expect(stage.promptTemplate).toContain('{input}');
      }
    }
  });
});
