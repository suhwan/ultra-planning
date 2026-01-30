/**
 * Pipeline Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import {
  createPipelineFromPreset,
  createCustomPipeline,
  parsePipelineString,
  initializePipeline,
  buildStagePrompt,
  recordStageResult,
  getCurrentStage,
  startPipeline,
  pausePipeline,
  getPipelineStatus,
  listPresets,
  generatePipelineOrchestratorPrompt,
  PIPELINE_PRESETS,
} from './manager.js';

const TEST_DIR = '/tmp/claude/pipeline-test';

describe('Pipeline Manager', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

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

    it('should include initial input', () => {
      const pipeline = createPipelineFromPreset('debug', 'Fix the login bug');

      expect(pipeline.initialInput).toBe('Fix the login bug');
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

    it('should parse pipeline with custom name', () => {
      const pipeline = parsePipelineString(
        'executor:sonnet -> qa-tester:sonnet',
        'My Pipeline'
      );

      expect(pipeline.name).toBe('My Pipeline');
    });
  });

  describe('createCustomPipeline', () => {
    it('should create custom pipeline', () => {
      const pipeline = createCustomPipeline(
        'Custom',
        'My custom pipeline',
        [
          { name: 'step1', agent: 'explore', promptTemplate: '{input}' },
          { name: 'step2', agent: 'executor', promptTemplate: 'Do: {input}' },
        ],
        { initialInput: 'Start here' }
      );

      expect(pipeline.name).toBe('Custom');
      expect(pipeline.stages.length).toBe(2);
      expect(pipeline.initialInput).toBe('Start here');
    });
  });

  describe('Pipeline Execution', () => {
    it('should initialize pipeline', () => {
      const pipeline = createPipelineFromPreset('review', 'Review authentication');
      const state = initializePipeline(pipeline, TEST_DIR);

      expect(state.sessionId).toBeDefined();
      expect(state.status).toBe('pending');
      expect(state.currentStage).toBe(0);
      expect(state.lastOutput).toBe('Review authentication');
    });

    it('should get current stage', () => {
      const pipeline = createPipelineFromPreset('review', 'Test input');
      const state = initializePipeline(pipeline, TEST_DIR);

      const current = getCurrentStage(state.sessionId, TEST_DIR);

      expect(current).not.toBeNull();
      expect(current!.stage.name).toBe('explore');
      expect(current!.input).toBe('Test input');
    });

    it('should build stage prompt', () => {
      const stage = {
        name: 'test',
        agent: 'explore' as const,
        promptTemplate: 'Find files for: {input}',
      };

      const prompt = buildStagePrompt(stage, 'authentication');

      expect(prompt).toBe('Find files for: authentication');
    });

    it('should record stage result and advance', () => {
      const pipeline = createPipelineFromPreset('review', 'Test');
      const initState = initializePipeline(pipeline, TEST_DIR);
      startPipeline(initState.sessionId, TEST_DIR);

      const result = recordStageResult(
        initState.sessionId,
        {
          stageName: 'explore',
          success: true,
          output: 'Found files: a.ts, b.ts',
          executionTimeMs: 1000,
        },
        TEST_DIR
      );

      expect(result).not.toBeNull();
      expect(result!.currentStage).toBe(1);
      expect(result!.lastOutput).toBe('Found files: a.ts, b.ts');
    });

    it('should complete pipeline after all stages', () => {
      const pipeline = createPipelineFromPreset('debug', 'Fix bug');
      const state = initializePipeline(pipeline, TEST_DIR);
      startPipeline(state.sessionId, TEST_DIR);

      // Complete all stages
      for (let i = 0; i < pipeline.stages.length; i++) {
        recordStageResult(
          state.sessionId,
          {
            stageName: pipeline.stages[i].name,
            success: true,
            output: `Stage ${i + 1} output`,
            executionTimeMs: 100,
          },
          TEST_DIR
        );
      }

      const status = getPipelineStatus(state.sessionId, TEST_DIR);
      expect(status!.status).toBe('completed');
    });

    it('should fail pipeline on stage failure when stopOnFailure is true', () => {
      const pipeline = createPipelineFromPreset('review', 'Test');
      const state = initializePipeline(pipeline, TEST_DIR);
      startPipeline(state.sessionId, TEST_DIR);

      recordStageResult(
        state.sessionId,
        {
          stageName: 'explore',
          success: false,
          error: 'Something went wrong',
          executionTimeMs: 500,
        },
        TEST_DIR
      );

      const status = getPipelineStatus(state.sessionId, TEST_DIR);
      expect(status!.status).toBe('failed');
    });
  });

  describe('Pipeline Control', () => {
    it('should start pipeline', () => {
      const pipeline = createPipelineFromPreset('review');
      const state = initializePipeline(pipeline, TEST_DIR);

      const started = startPipeline(state.sessionId, TEST_DIR);
      expect(started).toBe(true);

      const status = getPipelineStatus(state.sessionId, TEST_DIR);
      expect(status!.status).toBe('running');
    });

    it('should pause pipeline', () => {
      const pipeline = createPipelineFromPreset('review');
      const state = initializePipeline(pipeline, TEST_DIR);
      startPipeline(state.sessionId, TEST_DIR);

      const paused = pausePipeline(state.sessionId, TEST_DIR);
      expect(paused).toBe(true);

      const status = getPipelineStatus(state.sessionId, TEST_DIR);
      expect(status!.status).toBe('paused');
    });
  });

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
  });

  describe('generatePipelineOrchestratorPrompt', () => {
    it('should generate orchestrator prompt', () => {
      const pipeline = createPipelineFromPreset('review');
      const prompt = generatePipelineOrchestratorPrompt(pipeline, 'session-123');

      expect(prompt).toContain('Pipeline Orchestrator');
      expect(prompt).toContain('session-123');
      expect(prompt).toContain('explore');
      expect(prompt).toContain('analyze');
    });
  });
});
