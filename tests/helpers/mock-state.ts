/**
 * Mock State Factory Functions
 *
 * Creates test data for state management and planning components.
 */

import type { PlanFrontmatter } from '@/types.js';
import type { TaskDefinition } from '@/documents/types.js';

/**
 * State data interface (matching project state structure)
 */
export interface StateData {
  phase: number;
  currentPlan: string;
  status: 'active' | 'paused' | 'completed';
  lastUpdated?: string;
}

/**
 * Create mock state data with optional overrides
 *
 * @param overrides - Partial state data to override defaults
 * @returns Complete StateData object
 */
export function createMockState(overrides?: Partial<StateData>): StateData {
  return {
    phase: 1,
    currentPlan: '01-01',
    status: 'active',
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create mock plan frontmatter with optional overrides
 *
 * @param overrides - Partial frontmatter to override defaults
 * @returns Complete PlanFrontmatter object
 */
export function createMockPlanFrontmatter(
  overrides?: Partial<PlanFrontmatter>
): PlanFrontmatter {
  return {
    phase: '01-foundation',
    plan: 1,
    type: 'execute',
    wave: 1,
    depends_on: [],
    files_modified: [],
    autonomous: true,
    must_haves: {
      truths: ['Tests pass', 'Code compiles'],
      artifacts: [
        {
          path: 'src/index.ts',
          provides: 'Main entry point',
        },
      ],
    },
    ...overrides,
  };
}

/**
 * Create mock task definition with optional overrides
 *
 * @param overrides - Partial task to override defaults
 * @returns Complete TaskDefinition object
 */
export function createMockTaskDefinition(
  overrides?: Partial<TaskDefinition>
): TaskDefinition {
  return {
    type: 'auto',
    name: 'Task 1: Example task',
    files: ['src/example.ts'],
    action: 'Implement example functionality',
    verify: 'npm test',
    done: 'Tests pass and code compiles',
    ...overrides,
  };
}
