/**
 * Document Configuration Types
 *
 * Types for generating GSD planning documents (PROJECT.md, ROADMAP.md, PLAN.md).
 */

import type { PlanFrontmatter } from '../types.js';

// Re-export types that are used in document generation
export type { Artifact, KeyLink, MustHaves } from '../types.js';

// ============================================================================
// PROJECT.md Configuration
// ============================================================================

/**
 * Configuration for generating PROJECT.md
 */
export interface ProjectDocumentConfig {
  /** Project name */
  name: string;

  /** Current accurate description (2-3 sentences) */
  description: string;

  /** The ONE thing that matters most */
  coreValue: string;

  /** Requirements sections */
  requirements: {
    /** Shipped and confirmed valuable */
    validated: string[];

    /** Current scope being built */
    active: string[];

    /** Explicit boundaries (with reasoning) */
    outOfScope: Array<{ item: string; reason: string }>;
  };

  /** Background information that informs implementation */
  context: string;

  /** Hard limits on implementation choices */
  constraints: Array<{
    type: string;
    description: string;
    reason: string;
  }>;

  /** Significant choices that affect future work */
  keyDecisions: Array<{
    decision: string;
    rationale: string;
    outcome: 'good' | 'revisit' | 'pending';
  }>;

  /** Last update metadata */
  lastUpdated?: {
    date: string;
    trigger: string;
  };
}

// ============================================================================
// ROADMAP.md Configuration
// ============================================================================

/**
 * Configuration for generating ROADMAP.md
 */
export interface RoadmapConfig {
  /** Project name */
  projectName: string;

  /** One paragraph describing the journey */
  overview: string;

  /** List of phases */
  phases: PhaseConfig[];

  /** Optional milestone groupings (for post-v1.0) */
  milestones?: MilestoneConfig[];
}

/**
 * Phase configuration
 */
export interface PhaseConfig {
  /** Phase number (can be decimal like 2.1 for insertions) */
  number: string;

  /** Phase name */
  name: string;

  /** What this phase delivers */
  goal: string;

  /** Phase dependencies (phase numbers) */
  dependsOn: string[];

  /** Requirements this phase addresses */
  requirements?: string[];

  /** Observable behaviors from user perspective */
  successCriteria: string[];

  /** List of plans in this phase */
  plans: PlanSummary[];

  /** Phase status */
  status: 'not_started' | 'in_progress' | 'completed' | 'deferred';

  /** Completion date (if completed) */
  completedDate?: string;

  /** INSERTED marker for decimal phases */
  inserted?: boolean;
}

/**
 * Plan summary (for roadmap listing)
 */
export interface PlanSummary {
  /** Plan ID (e.g., "01-01") */
  id: string;

  /** Brief description */
  description: string;

  /** Completion status */
  completed: boolean;
}

/**
 * Milestone configuration (for post-v1.0 roadmaps)
 */
export interface MilestoneConfig {
  /** Milestone version (e.g., "v1.0") */
  version: string;

  /** Milestone name */
  name: string;

  /** Phase numbers included */
  phases: string[];

  /** Milestone status */
  status: 'shipped' | 'in_progress' | 'planned';

  /** Ship date (if shipped) */
  shippedDate?: string;
}

// ============================================================================
// PLAN.md Document
// ============================================================================

/**
 * Complete PLAN.md document (frontmatter + content)
 */
export interface PlanDocument {
  /** YAML frontmatter */
  frontmatter: PlanFrontmatter;

  /** Markdown content (objective, context, tasks, verification, etc.) */
  content: string;
}

/**
 * Task definition for PLAN.md
 */
export interface TaskDefinition {
  /** Task type */
  type: 'auto' | 'checkpoint:decision' | 'checkpoint:human-verify' | 'checkpoint:human-action';

  /** Task name */
  name: string;

  /** Files this task touches */
  files?: string[];

  /** Specific implementation details */
  action?: string;

  /** Command or check to prove it worked */
  verify?: string;

  /** Measurable acceptance criteria */
  done?: string;

  /** Checkpoint-specific fields */
  checkpoint?: {
    decision?: string;
    context?: string;
    options?: Array<{
      id: string;
      name: string;
      pros: string;
      cons: string;
    }>;
    whatBuilt?: string;
    howToVerify?: string;
    resumeSignal?: string;
    gate?: 'blocking' | 'non-blocking';
  };
}

/**
 * Plan content structure (parsed from markdown)
 */
export interface PlanContent {
  /** Objective section */
  objective: {
    description: string;
    purpose: string;
    output: string;
  };

  /** Context references */
  context: string[];

  /** Execution context references */
  executionContext?: string[];

  /** Tasks */
  tasks: TaskDefinition[];

  /** Verification checklist */
  verification: string[];

  /** Success criteria */
  successCriteria: string[];

  /** Output instructions */
  output: string;
}
