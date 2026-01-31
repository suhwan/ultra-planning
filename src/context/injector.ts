/**
 * Context Injector
 *
 * Injects collected context into agent prompts.
 * Each agent type gets tailored context relevant to its role.
 *
 * Part of the Context Architect pattern - provides context, not execution.
 */

import type { CollectedContext, ProjectContext, PhaseContext, TaskContext } from './collector.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Agent role for context injection
 */
export type AgentRole =
  | 'worker'
  | 'orchestrator'
  | 'planner'
  | 'executor'
  | 'architect'
  | 'critic';

/**
 * Injected context for agent consumption
 */
export interface InjectedContext {
  role: AgentRole;
  sections: ContextSection[];
  totalTokens: number;
}

/**
 * Context section with content
 */
export interface ContextSection {
  title: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
  tokens: number;
}

/**
 * Injection options
 */
export interface InjectionOptions {
  /** Maximum tokens to include (default: 50000) */
  maxTokens?: number;
  /** Include project overview (default: true) */
  includeProject?: boolean;
  /** Include phase research (default: true) */
  includePhaseResearch?: boolean;
  /** Include previous summaries (default: false) */
  includeSummaries?: boolean;
  /** Custom sections to prepend */
  customSections?: ContextSection[];
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_TOKENS = 50000;

// ============================================================================
// Worker Context
// ============================================================================

/**
 * Inject context for worker agents
 *
 * Workers get:
 * - Current task plan (high priority)
 * - Phase research (medium priority)
 * - Project overview (low priority)
 *
 * @param ctx - Collected context
 * @param options - Injection options
 * @returns Injected context with sections
 */
export function injectWorkerContext(
  ctx: CollectedContext,
  options: InjectionOptions = {}
): InjectedContext {
  const sections: ContextSection[] = [];
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

  // High priority: Current task
  if (ctx.task?.planMd) {
    sections.push({
      title: 'Current Task',
      content: ctx.task.planMd,
      priority: 'high',
      tokens: estimateTokens(ctx.task.planMd),
    });
  }

  // Medium priority: Phase research
  if (options.includePhaseResearch !== false && ctx.phase?.researchMd) {
    sections.push({
      title: 'Phase Research',
      content: ctx.phase.researchMd,
      priority: 'medium',
      tokens: estimateTokens(ctx.phase.researchMd),
    });
  }

  // Low priority: Project overview
  if (options.includeProject !== false && ctx.project?.projectMd) {
    sections.push({
      title: 'Project Overview',
      content: extractOverview(ctx.project.projectMd, 2000),
      priority: 'low',
      tokens: 500, // Approximate after extraction
    });
  }

  // Prepend custom sections
  if (options.customSections) {
    sections.unshift(...options.customSections);
  }

  return createInjectedContext('worker', sections, maxTokens);
}

// ============================================================================
// Orchestrator Context
// ============================================================================

/**
 * Inject context for orchestrator agents
 *
 * Orchestrators get:
 * - All phase plans (high priority)
 * - Roadmap (medium priority)
 * - Project requirements (medium priority)
 *
 * @param ctx - Collected context
 * @param options - Injection options
 * @returns Injected context with sections
 */
export function injectOrchestratorContext(
  ctx: CollectedContext,
  options: InjectionOptions = {}
): InjectedContext {
  const sections: ContextSection[] = [];
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

  // High priority: Phase plans
  if (ctx.phase?.plans.length) {
    const plansContent = ctx.phase.plans.join('\n\n---\n\n');
    sections.push({
      title: `Phase ${ctx.phase.phaseNumber} Plans`,
      content: plansContent,
      priority: 'high',
      tokens: estimateTokens(plansContent),
    });
  }

  // Medium priority: Roadmap
  if (ctx.project?.roadmapMd) {
    sections.push({
      title: 'Roadmap',
      content: ctx.project.roadmapMd,
      priority: 'medium',
      tokens: estimateTokens(ctx.project.roadmapMd),
    });
  }

  // Medium priority: Requirements
  if (ctx.project?.requirementsMd) {
    sections.push({
      title: 'Requirements',
      content: ctx.project.requirementsMd,
      priority: 'medium',
      tokens: estimateTokens(ctx.project.requirementsMd),
    });
  }

  // Low priority: Previous summaries
  if (options.includeSummaries && ctx.phase?.summaries.length) {
    const summariesContent = ctx.phase.summaries.join('\n\n---\n\n');
    sections.push({
      title: 'Previous Summaries',
      content: summariesContent,
      priority: 'low',
      tokens: estimateTokens(summariesContent),
    });
  }

  // Prepend custom sections
  if (options.customSections) {
    sections.unshift(...options.customSections);
  }

  return createInjectedContext('orchestrator', sections, maxTokens);
}

// ============================================================================
// Planner Context
// ============================================================================

/**
 * Inject context for planner agents
 *
 * Planners get:
 * - Project overview (high priority)
 * - Requirements (high priority)
 * - Roadmap (high priority)
 * - Research (medium priority)
 *
 * @param ctx - Collected context
 * @param options - Injection options
 * @returns Injected context with sections
 */
export function injectPlannerContext(
  ctx: CollectedContext,
  options: InjectionOptions = {}
): InjectedContext {
  const sections: ContextSection[] = [];
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

  // High priority: Project overview
  if (ctx.project?.projectMd) {
    sections.push({
      title: 'Project',
      content: ctx.project.projectMd,
      priority: 'high',
      tokens: estimateTokens(ctx.project.projectMd),
    });
  }

  // High priority: Requirements
  if (ctx.project?.requirementsMd) {
    sections.push({
      title: 'Requirements',
      content: ctx.project.requirementsMd,
      priority: 'high',
      tokens: estimateTokens(ctx.project.requirementsMd),
    });
  }

  // High priority: Roadmap
  if (ctx.project?.roadmapMd) {
    sections.push({
      title: 'Roadmap',
      content: ctx.project.roadmapMd,
      priority: 'high',
      tokens: estimateTokens(ctx.project.roadmapMd),
    });
  }

  // Medium priority: Research
  if (ctx.phase?.researchMd) {
    sections.push({
      title: 'Research',
      content: ctx.phase.researchMd,
      priority: 'medium',
      tokens: estimateTokens(ctx.phase.researchMd),
    });
  }

  // Prepend custom sections
  if (options.customSections) {
    sections.unshift(...options.customSections);
  }

  return createInjectedContext('planner', sections, maxTokens);
}

// ============================================================================
// Executor Context
// ============================================================================

/**
 * Inject context for executor agents
 *
 * Executors get:
 * - Current task (high priority)
 * - Task summary if exists (high priority)
 * - Minimal project context (low priority)
 *
 * @param ctx - Collected context
 * @param options - Injection options
 * @returns Injected context with sections
 */
export function injectExecutorContext(
  ctx: CollectedContext,
  options: InjectionOptions = {}
): InjectedContext {
  const sections: ContextSection[] = [];
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

  // High priority: Current task
  if (ctx.task?.planMd) {
    sections.push({
      title: 'Task Plan',
      content: ctx.task.planMd,
      priority: 'high',
      tokens: estimateTokens(ctx.task.planMd),
    });
  }

  // High priority: Task summary (for continuation)
  if (ctx.task?.summaryMd) {
    sections.push({
      title: 'Task Progress',
      content: ctx.task.summaryMd,
      priority: 'high',
      tokens: estimateTokens(ctx.task.summaryMd),
    });
  }

  // Low priority: Minimal project context
  if (options.includeProject !== false && ctx.project?.projectMd) {
    sections.push({
      title: 'Project',
      content: extractOverview(ctx.project.projectMd, 1000),
      priority: 'low',
      tokens: 250,
    });
  }

  // Prepend custom sections
  if (options.customSections) {
    sections.unshift(...options.customSections);
  }

  return createInjectedContext('executor', sections, maxTokens);
}

// ============================================================================
// Architect Context
// ============================================================================

/**
 * Inject context for architect agents (verification)
 *
 * Architects get:
 * - Task plan (high priority)
 * - Requirements (high priority)
 * - Project overview (medium priority)
 *
 * @param ctx - Collected context
 * @param options - Injection options
 * @returns Injected context with sections
 */
export function injectArchitectContext(
  ctx: CollectedContext,
  options: InjectionOptions = {}
): InjectedContext {
  const sections: ContextSection[] = [];
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

  // High priority: Task plan (what to verify)
  if (ctx.task?.planMd) {
    sections.push({
      title: 'Task to Verify',
      content: ctx.task.planMd,
      priority: 'high',
      tokens: estimateTokens(ctx.task.planMd),
    });
  }

  // High priority: Requirements (verification criteria)
  if (ctx.project?.requirementsMd) {
    sections.push({
      title: 'Requirements',
      content: ctx.project.requirementsMd,
      priority: 'high',
      tokens: estimateTokens(ctx.project.requirementsMd),
    });
  }

  // Medium priority: Project context
  if (ctx.project?.projectMd) {
    sections.push({
      title: 'Project',
      content: ctx.project.projectMd,
      priority: 'medium',
      tokens: estimateTokens(ctx.project.projectMd),
    });
  }

  // Prepend custom sections
  if (options.customSections) {
    sections.unshift(...options.customSections);
  }

  return createInjectedContext('architect', sections, maxTokens);
}

// ============================================================================
// Critic Context
// ============================================================================

/**
 * Inject context for critic agents (plan review)
 *
 * Critics get:
 * - Plan to review (high priority)
 * - Requirements (high priority)
 * - Roadmap (high priority)
 *
 * @param ctx - Collected context
 * @param options - Injection options
 * @returns Injected context with sections
 */
export function injectCriticContext(
  ctx: CollectedContext,
  options: InjectionOptions = {}
): InjectedContext {
  const sections: ContextSection[] = [];
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

  // High priority: Plan to review
  if (ctx.task?.planMd) {
    sections.push({
      title: 'Plan to Review',
      content: ctx.task.planMd,
      priority: 'high',
      tokens: estimateTokens(ctx.task.planMd),
    });
  }

  // High priority: Requirements
  if (ctx.project?.requirementsMd) {
    sections.push({
      title: 'Requirements',
      content: ctx.project.requirementsMd,
      priority: 'high',
      tokens: estimateTokens(ctx.project.requirementsMd),
    });
  }

  // High priority: Roadmap
  if (ctx.project?.roadmapMd) {
    sections.push({
      title: 'Roadmap',
      content: ctx.project.roadmapMd,
      priority: 'high',
      tokens: estimateTokens(ctx.project.roadmapMd),
    });
  }

  // Prepend custom sections
  if (options.customSections) {
    sections.unshift(...options.customSections);
  }

  return createInjectedContext('critic', sections, maxTokens);
}

// ============================================================================
// Generic Injection
// ============================================================================

/**
 * Inject context for any agent role
 *
 * @param role - Agent role
 * @param ctx - Collected context
 * @param options - Injection options
 * @returns Injected context with sections
 */
export function injectContext(
  role: AgentRole,
  ctx: CollectedContext,
  options: InjectionOptions = {}
): InjectedContext {
  switch (role) {
    case 'worker':
      return injectWorkerContext(ctx, options);
    case 'orchestrator':
      return injectOrchestratorContext(ctx, options);
    case 'planner':
      return injectPlannerContext(ctx, options);
    case 'executor':
      return injectExecutorContext(ctx, options);
    case 'architect':
      return injectArchitectContext(ctx, options);
    case 'critic':
      return injectCriticContext(ctx, options);
    default:
      return injectWorkerContext(ctx, options);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create injected context with token limits
 */
function createInjectedContext(
  role: AgentRole,
  sections: ContextSection[],
  maxTokens: number
): InjectedContext {
  // Sort by priority (high first)
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...sections].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  // Apply token limits
  const included: ContextSection[] = [];
  let totalTokens = 0;

  for (const section of sorted) {
    if (totalTokens + section.tokens <= maxTokens) {
      included.push(section);
      totalTokens += section.tokens;
    } else if (section.priority === 'high') {
      // Always include high priority, even if over limit
      included.push(section);
      totalTokens += section.tokens;
    }
  }

  return { role, sections: included, totalTokens };
}

/**
 * Estimate tokens from text
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Extract overview section from markdown
 */
function extractOverview(markdown: string, maxChars: number): string {
  // Get first section (up to first ## heading after initial content)
  const lines = markdown.split('\n');
  const overviewLines: string[] = [];
  let inFirstSection = true;
  let charCount = 0;

  for (const line of lines) {
    if (line.startsWith('## ') && overviewLines.length > 0) {
      // Stop at next major section
      break;
    }

    if (charCount + line.length > maxChars) {
      overviewLines.push('...');
      break;
    }

    overviewLines.push(line);
    charCount += line.length + 1;
  }

  return overviewLines.join('\n');
}

// ============================================================================
// Formatting
// ============================================================================

/**
 * Format injected context for prompt inclusion
 *
 * @param injected - Injected context
 * @returns Formatted string for prompt
 */
export function formatInjectedContext(injected: InjectedContext): string {
  if (injected.sections.length === 0) {
    return '';
  }

  const parts: string[] = ['<context>'];

  for (const section of injected.sections) {
    parts.push(`\n## ${section.title}\n`);
    parts.push(section.content);
  }

  parts.push('\n</context>');

  return parts.join('\n');
}

/**
 * Format injected context summary
 */
export function formatInjectedSummary(injected: InjectedContext): string {
  const lines: string[] = [`Context for ${injected.role}:`];

  for (const section of injected.sections) {
    lines.push(`  - ${section.title} (${section.priority}, ~${section.tokens} tokens)`);
  }

  lines.push(`Total: ~${injected.totalTokens} tokens`);

  return lines.join('\n');
}
