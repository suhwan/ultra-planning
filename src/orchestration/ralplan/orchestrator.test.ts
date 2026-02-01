/**
 * Ralplan Orchestrator Tests
 *
 * Tests for the ralplan loop orchestration including state transitions and consensus logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  shouldForceApproval,
  getNextPhase,
  handleCriticVerdict,
  getLoopSummary,
} from './orchestrator.js';
import type { RalplanState, RalplanPhase } from './types.js';
import * as stateModule from './state.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockState(overrides: Partial<RalplanState> = {}): RalplanState {
  return {
    active: true,
    mode: 'ralplan',
    iteration: 1,
    maxIterations: 5,
    planPath: '.ultraplan/plans/current.md',
    currentPhase: 'planner_planning',
    startedAt: new Date().toISOString(),
    taskDescription: 'Test task',
    ...overrides,
  };
}

// ============================================================================
// shouldForceApproval Tests
// ============================================================================

describe('shouldForceApproval', () => {
  it('should return false when iteration is less than maxIterations', () => {
    const state = createMockState({ iteration: 3, maxIterations: 5 });
    expect(shouldForceApproval(state)).toBe(false);
  });

  it('should return true when iteration equals maxIterations', () => {
    const state = createMockState({ iteration: 5, maxIterations: 5 });
    expect(shouldForceApproval(state)).toBe(true);
  });

  it('should return true when iteration exceeds maxIterations', () => {
    const state = createMockState({ iteration: 6, maxIterations: 5 });
    expect(shouldForceApproval(state)).toBe(true);
  });

  it('should handle maxIterations of 1', () => {
    const state = createMockState({ iteration: 1, maxIterations: 1 });
    expect(shouldForceApproval(state)).toBe(true);
  });
});

// ============================================================================
// getNextPhase Tests - State Machine Transitions
// ============================================================================

describe('getNextPhase', () => {
  it('should transition from planner_planning to critic_review', () => {
    expect(getNextPhase('planner_planning')).toBe('critic_review');
  });

  it('should transition from architect_consultation to critic_review', () => {
    expect(getNextPhase('architect_consultation')).toBe('critic_review');
  });

  it('should transition from critic_review to handling_verdict', () => {
    expect(getNextPhase('critic_review')).toBe('handling_verdict');
  });

  it('should transition from handling_verdict with OKAY to complete', () => {
    expect(getNextPhase('handling_verdict', 'OKAY')).toBe('complete');
  });

  it('should transition from handling_verdict with REJECT to planner_planning', () => {
    expect(getNextPhase('handling_verdict', 'REJECT')).toBe('planner_planning');
  });

  it('should stay in handling_verdict when no verdict provided', () => {
    expect(getNextPhase('handling_verdict')).toBe('handling_verdict');
  });

  it('should stay in complete (terminal state)', () => {
    expect(getNextPhase('complete')).toBe('complete');
    expect(getNextPhase('complete', 'OKAY')).toBe('complete');
    expect(getNextPhase('complete', 'REJECT')).toBe('complete');
  });
});

// ============================================================================
// handleCriticVerdict Tests
// ============================================================================

describe('handleCriticVerdict', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return no active session message when state is null', () => {
    vi.spyOn(stateModule, 'getRalplanState').mockReturnValue(null);

    const result = handleCriticVerdict('OKAY');

    expect(result.nextPhase).toBe('complete');
    expect(result.forced).toBe(false);
    expect(result.message).toBe('No active Ralplan session');
  });

  it('should force approval when max iterations reached with OKAY verdict', () => {
    const state = createMockState({ iteration: 5, maxIterations: 5 });
    vi.spyOn(stateModule, 'getRalplanState').mockReturnValue(state);

    const result = handleCriticVerdict('OKAY');

    expect(result.nextPhase).toBe('complete');
    expect(result.forced).toBe(true);
    expect(result.message).toContain('Maximum iterations');
    expect(result.message).toContain('approved with reservations');
  });

  it('should force approval when max iterations reached with REJECT verdict', () => {
    const state = createMockState({ iteration: 5, maxIterations: 5 });
    vi.spyOn(stateModule, 'getRalplanState').mockReturnValue(state);

    const result = handleCriticVerdict('REJECT', 'Still has issues');

    expect(result.nextPhase).toBe('complete');
    expect(result.forced).toBe(true);
    expect(result.message).toContain('Maximum iterations');
  });

  it('should complete normally with OKAY verdict below max iterations', () => {
    const state = createMockState({ iteration: 2, maxIterations: 5 });
    vi.spyOn(stateModule, 'getRalplanState').mockReturnValue(state);
    vi.spyOn(stateModule, 'advanceIteration').mockReturnValue(true);

    const result = handleCriticVerdict('OKAY');

    expect(result.nextPhase).toBe('complete');
    expect(result.forced).toBe(false);
    expect(result.message).toContain('approved by Critic');
    expect(result.message).toContain('2 iteration(s)');
  });

  it('should continue to planner_planning with REJECT verdict', () => {
    const state = createMockState({ iteration: 2, maxIterations: 5 });
    vi.spyOn(stateModule, 'getRalplanState').mockReturnValue(state);
    vi.spyOn(stateModule, 'advanceIteration').mockReturnValue(true);

    const result = handleCriticVerdict('REJECT', 'Needs more detail');

    expect(result.nextPhase).toBe('planner_planning');
    expect(result.forced).toBe(false);
    expect(result.message).toContain('rejected');
    expect(result.message).toContain('iteration 3/5');
    expect(result.message).toContain('Needs more detail');
  });

  it('should include feedback in rejection message', () => {
    const state = createMockState({ iteration: 1, maxIterations: 5 });
    vi.spyOn(stateModule, 'getRalplanState').mockReturnValue(state);
    vi.spyOn(stateModule, 'advanceIteration').mockReturnValue(true);

    const feedback = 'The plan lacks error handling';
    const result = handleCriticVerdict('REJECT', feedback);

    expect(result.message).toContain(feedback);
  });

  it('should handle missing feedback in rejection', () => {
    const state = createMockState({ iteration: 1, maxIterations: 5 });
    vi.spyOn(stateModule, 'getRalplanState').mockReturnValue(state);
    vi.spyOn(stateModule, 'advanceIteration').mockReturnValue(true);

    const result = handleCriticVerdict('REJECT');

    expect(result.message).toContain('No feedback provided');
  });
});

// ============================================================================
// getLoopSummary Tests
// ============================================================================

describe('getLoopSummary', () => {
  it('should return formatted summary with iteration and phase', () => {
    const state = createMockState({
      iteration: 3,
      maxIterations: 5,
      currentPhase: 'critic_review',
    });

    const summary = getLoopSummary(state);

    expect(summary).toBe('Ralplan iteration 3/5 - critic review');
  });

  it('should replace underscores with spaces in phase name', () => {
    const state = createMockState({
      iteration: 1,
      maxIterations: 3,
      currentPhase: 'planner_planning',
    });

    const summary = getLoopSummary(state);

    expect(summary).toBe('Ralplan iteration 1/3 - planner planning');
  });

  it('should handle handling_verdict phase', () => {
    const state = createMockState({
      iteration: 2,
      maxIterations: 5,
      currentPhase: 'handling_verdict',
    });

    const summary = getLoopSummary(state);

    expect(summary).toBe('Ralplan iteration 2/5 - handling verdict');
  });

  it('should handle complete phase', () => {
    const state = createMockState({
      iteration: 4,
      maxIterations: 5,
      currentPhase: 'complete',
    });

    const summary = getLoopSummary(state);

    expect(summary).toBe('Ralplan iteration 4/5 - complete');
  });

  it('should handle architect_consultation phase', () => {
    const state = createMockState({
      iteration: 2,
      maxIterations: 5,
      currentPhase: 'architect_consultation',
    });

    const summary = getLoopSummary(state);

    expect(summary).toBe('Ralplan iteration 2/5 - architect consultation');
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Orchestrator Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should complete full approve flow', () => {
    // Simulate: planner_planning -> critic_review -> handling_verdict -> complete
    const state = createMockState({
      iteration: 1,
      maxIterations: 5,
      currentPhase: 'planner_planning',
    });

    // Phase transitions
    const phase1 = getNextPhase(state.currentPhase);
    expect(phase1).toBe('critic_review');

    const phase2 = getNextPhase(phase1);
    expect(phase2).toBe('handling_verdict');

    const phase3 = getNextPhase(phase2, 'OKAY');
    expect(phase3).toBe('complete');
  });

  it('should complete full rejection cycle', () => {
    // Simulate: planner_planning -> critic_review -> handling_verdict -> planner_planning
    const state = createMockState({
      iteration: 1,
      maxIterations: 5,
      currentPhase: 'planner_planning',
    });

    const phase1 = getNextPhase(state.currentPhase);
    expect(phase1).toBe('critic_review');

    const phase2 = getNextPhase(phase1);
    expect(phase2).toBe('handling_verdict');

    const phase3 = getNextPhase(phase2, 'REJECT');
    expect(phase3).toBe('planner_planning');

    // Back to start of cycle
    const phase4 = getNextPhase(phase3);
    expect(phase4).toBe('critic_review');
  });

  it('should force complete after max iterations of rejections', () => {
    const state = createMockState({
      iteration: 5,
      maxIterations: 5,
      currentPhase: 'handling_verdict',
    });

    vi.spyOn(stateModule, 'getRalplanState').mockReturnValue(state);

    // Even with REJECT, should force complete
    const result = handleCriticVerdict('REJECT', 'Still not good enough');

    expect(result.nextPhase).toBe('complete');
    expect(result.forced).toBe(true);
  });
});
