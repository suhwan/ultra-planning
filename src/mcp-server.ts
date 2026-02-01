#!/usr/bin/env node
/**
 * Ultra Planner MCP Server
 *
 * Exposes the TypeScript library functions as MCP tools
 * so Claude Code can actually use the implemented code.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import our library functions
import { parsePlanForSync, extractTaskMappings } from './sync/plan-parser.js';
import { buildDependencyMap, getExecutionOrder } from './sync/dependency-map.js';
import { generateTaskCreations } from './sync/task-creation.js';
import { calculateProgress, formatProgress } from './sync/progress.js';
import {
  addLearning,
  addDecision,
  addIssue,
  NotepadManager,
} from './notepad/index.js';
import {
  getWisdomForPlan,
  createWisdomDirective,
  hasWisdom,
} from './notepad/index.js';
import {
  mergePlanToProject,
  generateProjectSummary,
} from './notepad/index.js';
import { estimateTokens } from './context/estimator.js';
import {
  hasThinkTankStructure,
  loadThinkTankContext,
  generatePlannerContext,
  generateDepartmentContext,
} from './context/thinktank-loader.js';

// Import complexity functions
import {
  estimateComplexity,
  getModelForComplexity,
  batchEstimate,
  COMPLEXITY_MODEL_MAP,
  COMPLEXITY_DESCRIPTIONS,
} from './complexity/index.js';

// Import verdict functions
import {
  createArchitectVerdict,
  createCriticVerdict,
  calculateArchitectPassPercentage,
  calculateCriticPassPercentage,
  APPROVAL_THRESHOLD,
  formatChecklist,
  ARCHITECT_ITEM_NAMES,
  CRITIC_ITEM_NAMES,
} from './orchestration/verdicts/index.js';

// Import session functions
import {
  getSessionManager,
  createSession,
  getSession,
  DEFAULT_SESSION_RULES,
} from './state/session/index.js';

// Import revision functions
import {
  flagPlanForRevision,
  clearRevisionFlag,
  checkRevisionNeeded,
  createPlanVersion,
  getPlanVersionHistory,
  getCurrentPlanVersion,
  requestPlanRevision,
  completePlanRevision,
} from './orchestration/revision/index.js';

// Import deviation functions
import {
  reportDeviation,
  getDeviations,
  getDeviationsByLevel,
  getPendingApprovals,
  getDeviationStats,
  submitArchitectVerdict,
  resolveDeviation,
  determineDeviationLevel,
  hasUnresolvedLevel3,
} from './orchestration/deviation/index.js';

// Import spike functions
import {
  createSpike,
  startSpike,
  completeSpike,
  skipSpike,
  getSpikes,
  getSpike,
  getPendingSpikes,
  getSpikeForTask,
  getSpikeStats,
  hasPendingSpikes,
  assessUncertainty,
  needsSpike,
  autoCreateSpikeIfNeeded,
} from './orchestration/spike/index.js';

// Import checkpoint and rollback functions
import {
  tagPhaseComplete,
  listPhaseTags,
  getPhaseTagCommit,
  completePhase,
  listCheckpoints,
} from './state/checkpoint.js';

import {
  selectiveRollback,
  previewRollback,
  rollbackToPhase,
  getAvailableRollbackTargets,
} from './recovery/rollback.js';

// Import swarm functions (simplified - prompt generation only)
import {
  generateWorkerPrompt,
  generateOrchestratorPrompt,
} from './orchestration/swarm/index.js';

// Import pipeline functions (simplified - preset and parsing only)
import {
  createPipelineFromPreset,
  parsePipelineString,
  buildStagePrompt,
  listPresets as listPipelinePresets,
  generatePipelineOrchestratorPrompt,
  generatePipelineSessionId,
} from './orchestration/pipeline/index.js';

// Import hints functions (v3.0 - Context Architect)
import {
  suggestComplexity,
  suggestRoute,
  getTaskHints,
} from './hints/index.js';

// Import context functions (v3.0 - Context Architect)
import {
  collectProjectContext,
  collectPhaseContext,
  collectTaskContext,
  collectContext,
  compactContext,
  saveContextSnapshot,
  restoreContext,
  formatCompactedContext,
} from './context/index.js';

// Import delegation functions
import {
  detectCategory,
  routeTask,
  routeByComplexity,
  listCategories,
  getModelForCategory,
  needsHighTierModel,
  generateExecutorLoopPrompt,
  generateHeartbeatProtocol,
} from './orchestration/delegation/index.js';

// Import skills functions (v3.1 - Dynamic Skill Injection)
import {
  getSkillRegistry,
  injectSkills,
  needsSkillInjection,
  injectSpecificSkills,
  analyzeContext,
} from './skills/index.js';

// ============================================================================
// Server Setup
// ============================================================================

const server = new Server(
  {
    name: 'ultra-planner',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ============================================================================
// Tool Definitions
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // === Plan Parsing ===
      {
        name: 'parse_plan',
        description:
          'Parse a PLAN.md file and extract tasks with their metadata. Returns frontmatter, tasks array, and file path.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            path: {
              type: 'string',
              description: 'Path to PLAN.md file (absolute or relative)',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'extract_task_mappings',
        description:
          'Convert parsed plan to TaskMapping array with task IDs, tool params, and wave info. Use after parse_plan.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            path: {
              type: 'string',
              description: 'Path to PLAN.md file',
            },
          },
          required: ['path'],
        },
      },

      // === Task Creation ===
      {
        name: 'generate_task_creates',
        description:
          'Generate TaskCreate tool invocations for all tasks in a plan, sorted by wave order.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            path: {
              type: 'string',
              description: 'Path to PLAN.md file',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'get_execution_order',
        description:
          'Get tasks sorted by wave for proper execution order (Wave 1 first, then Wave 2, etc).',
        inputSchema: {
          type: 'object' as const,
          properties: {
            path: {
              type: 'string',
              description: 'Path to PLAN.md file',
            },
          },
          required: ['path'],
        },
      },

      // === Dependencies ===
      {
        name: 'build_dependency_map',
        description:
          'Build wave-based dependency map. Tasks in Wave N are blocked by ALL tasks in Waves 1..N-1.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            path: {
              type: 'string',
              description: 'Path to PLAN.md file',
            },
          },
          required: ['path'],
        },
      },

      // === Progress ===
      {
        name: 'calculate_progress',
        description:
          'Calculate progress statistics from a task list. Returns total, completed, pending, inProgress counts and percentage.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  status: { type: 'string' },
                },
              },
              description: 'Array of task objects with id and status',
            },
          },
          required: ['tasks'],
        },
      },

      // === Notepad: Write ===
      {
        name: 'add_learning',
        description:
          'Add a learning entry to the plan notepad. Records patterns, conventions, successful approaches.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            planId: {
              type: 'string',
              description: 'Plan identifier (e.g., "03-01")',
            },
            taskId: {
              type: 'string',
              description: 'Task identifier (e.g., "03-01-02")',
            },
            content: {
              type: 'string',
              description: 'Learning content',
            },
            pattern: {
              type: 'string',
              description: 'Optional file:lines reference (e.g., "src/utils.ts:45-60")',
            },
            learningType: {
              type: 'string',
              enum: ['pattern', 'convention', 'gotcha', 'discovery', 'avoid', 'prefer'],
              description: 'Learning type: pattern (reusable), convention (project style), gotcha (non-obvious), discovery (new info), avoid (anti-pattern), prefer (recommended approach)',
            },
            priority: {
              type: 'number',
              description: 'Priority 1-5 (higher = more important)',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional tags for categorization',
            },
          },
          required: ['planId', 'taskId', 'content'],
        },
      },
      {
        name: 'add_decision',
        description:
          'Add a decision entry to the plan notepad. Records architectural choices and rationales.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            planId: { type: 'string', description: 'Plan identifier' },
            taskId: { type: 'string', description: 'Task identifier' },
            content: { type: 'string', description: 'Decision content' },
            rationale: { type: 'string', description: 'Why this decision was made' },
            alternatives: {
              type: 'array',
              items: { type: 'string' },
              description: 'Alternatives considered',
            },
          },
          required: ['planId', 'taskId', 'content', 'rationale'],
        },
      },
      {
        name: 'add_issue',
        description:
          'Add an issue entry to the plan notepad. Records problems, blockers, gotchas.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            planId: { type: 'string', description: 'Plan identifier' },
            taskId: { type: 'string', description: 'Task identifier' },
            content: { type: 'string', description: 'Issue description' },
            severity: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
              description: 'Issue severity',
            },
            status: {
              type: 'string',
              enum: ['open', 'workaround', 'resolved'],
              description: 'Issue status',
            },
            workaround: { type: 'string', description: 'Optional workaround' },
          },
          required: ['planId', 'taskId', 'content', 'severity', 'status'],
        },
      },

      // === Notepad: Read ===
      {
        name: 'get_wisdom',
        description:
          'Get accumulated wisdom for a plan. Returns learnings, decisions, issues with token estimate.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            planId: {
              type: 'string',
              description: 'Plan identifier (e.g., "03-01") or "_project" for project-level',
            },
          },
          required: ['planId'],
        },
      },
      {
        name: 'create_wisdom_directive',
        description:
          'Create full wisdom directive for subagent prompts. Includes plan + project wisdom and notepad instructions.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            planId: { type: 'string', description: 'Current plan identifier' },
          },
          required: ['planId'],
        },
      },
      {
        name: 'has_wisdom',
        description: 'Quick check if there is any wisdom to inject for a plan.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            planId: { type: 'string', description: 'Plan identifier' },
          },
          required: ['planId'],
        },
      },

      // === Notepad: Merge ===
      {
        name: 'merge_plan_to_project',
        description:
          'Merge plan notepad content to project-level files. Call when a plan completes.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            planId: { type: 'string', description: 'Plan identifier to merge' },
          },
          required: ['planId'],
        },
      },
      {
        name: 'generate_project_summary',
        description:
          'Generate project-level summary.md with statistics and highlights from accumulated wisdom.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },

      // === Context Monitoring ===
      {
        name: 'estimate_tokens',
        description: 'Estimate token count for text. Uses chars/4 heuristic.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            text: { type: 'string', description: 'Text to estimate' },
          },
          required: ['text'],
        },
      },
      {
        name: 'check_context_threshold',
        description:
          'Check if context usage exceeds thresholds. Returns current usage and whether prepare/return thresholds are exceeded.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            currentTokens: { type: 'number', description: 'Current token usage' },
            maxTokens: {
              type: 'number',
              description: 'Maximum tokens (default: 200000)',
            },
          },
          required: ['currentTokens'],
        },
      },

      // === Notepad Init ===
      {
        name: 'init_plan_notepad',
        description: 'Initialize notepad directory for a plan. Creates learnings.md, decisions.md, issues.md.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            planId: { type: 'string', description: 'Plan identifier' },
          },
          required: ['planId'],
        },
      },

      // === Complexity Estimation ===
      {
        name: 'estimate_task_complexity',
        description: 'Estimate complexity for a task. Returns level (1-5), recommended model, and reasoning.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            taskDescription: {
              type: 'string',
              description: 'Task description/action to estimate',
            },
            files: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional list of files to be modified',
            },
            dependencies: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional list of task dependencies',
            },
          },
          required: ['taskDescription'],
        },
      },
      {
        name: 'get_model_for_complexity',
        description: 'Get recommended model (haiku/sonnet/opus) for a complexity level.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            level: {
              type: 'number',
              description: 'Complexity level (1-5)',
            },
          },
          required: ['level'],
        },
      },
      {
        name: 'batch_estimate_complexity',
        description: 'Estimate complexity for multiple tasks at once.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  action: { type: 'string' },
                  files: { type: 'array', items: { type: 'string' } },
                },
              },
              description: 'Array of tasks with name, action, and optional files',
            },
          },
          required: ['tasks'],
        },
      },

      // === Verdict Evaluation ===
      {
        name: 'evaluate_architect_checklist',
        description: 'Evaluate Architect checklist and determine verdict (APPROVED/REJECTED/NEEDS_REVISION). 80% pass = APPROVED.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            taskId: { type: 'string', description: 'Task ID being verified' },
            checklist: {
              type: 'object',
              properties: {
                codeCompiles: { type: 'boolean' },
                testsPass: { type: 'boolean' },
                requirementsMet: { type: 'boolean' },
                noRegressions: { type: 'boolean' },
                codeQuality: { type: 'boolean' },
              },
              description: 'Checklist results',
            },
            issues: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional issues found',
            },
            suggestions: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional suggestions',
            },
          },
          required: ['taskId', 'checklist'],
        },
      },
      {
        name: 'evaluate_critic_checklist',
        description: 'Evaluate Critic checklist and determine verdict (OKAY/REJECT). 80% pass = OKAY.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            planPath: { type: 'string', description: 'Path to plan being reviewed' },
            checklist: {
              type: 'object',
              properties: {
                goalsAligned: { type: 'boolean' },
                tasksAtomic: { type: 'boolean' },
                dependenciesClear: { type: 'boolean' },
                verifiable: { type: 'boolean' },
                waveStructure: { type: 'boolean' },
              },
              description: 'Checklist results',
            },
            justification: { type: 'string', description: 'Reasoning for verdict' },
            iteration: { type: 'number', description: 'Optional Ralplan iteration number' },
            improvements: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional improvements needed',
            },
          },
          required: ['planPath', 'checklist', 'justification'],
        },
      },
      {
        name: 'get_approval_threshold',
        description: 'Get the approval threshold percentage for verdicts.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },

      // === Session Management ===
      {
        name: 'create_session',
        description: 'Create a new isolated session for agent execution.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            name: { type: 'string', description: 'Human-readable session name' },
            parentSessionId: { type: 'string', description: 'Parent session ID for nested sessions' },
            mode: { type: 'string', description: 'Execution mode' },
            agentRole: { type: 'string', description: 'Agent role (planner, executor, architect, critic)' },
            activePlan: { type: 'string', description: 'Path to active plan' },
          },
          required: [],
        },
      },
      {
        name: 'get_session',
        description: 'Get session state by ID.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            sessionId: { type: 'string', description: 'Session ID' },
          },
          required: ['sessionId'],
        },
      },
      {
        name: 'list_sessions',
        description: 'List all active sessions.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      {
        name: 'claim_task_for_session',
        description: 'Claim a task for a session (prevents other sessions from claiming).',
        inputSchema: {
          type: 'object' as const,
          properties: {
            sessionId: { type: 'string', description: 'Session ID' },
            taskId: { type: 'string', description: 'Task ID to claim' },
          },
          required: ['sessionId', 'taskId'],
        },
      },
      {
        name: 'complete_session',
        description: 'Mark a session as complete with results.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            sessionId: { type: 'string', description: 'Session ID' },
            status: { type: 'string', enum: ['success', 'failed', 'timeout', 'cancelled'] },
            verdict: { type: 'object', description: 'Optional verdict object' },
            learnings: { type: 'array', items: { type: 'string' }, description: 'Optional learnings' },
            error: { type: 'string', description: 'Error message if failed' },
          },
          required: ['sessionId', 'status'],
        },
      },

      // === Plan Revision ===
      {
        name: 'flag_plan_for_revision',
        description: 'Flag a plan as needing revision.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            planPath: { type: 'string', description: 'Path to plan file' },
            reason: {
              type: 'string',
              enum: ['deviation_level_3', 'spike_discovery', 'blocker_found', 'scope_change', 'dependency_discovered', 'manual_request'],
              description: 'Reason for revision',
            },
            description: { type: 'string', description: 'Description of needed changes' },
            affectedTasks: { type: 'array', items: { type: 'string' }, description: 'Tasks affected' },
            source: { type: 'string', description: 'Source of request' },
          },
          required: ['planPath', 'reason', 'description'],
        },
      },
      {
        name: 'check_revision_needed',
        description: 'Check if a plan needs revision.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            planPath: { type: 'string', description: 'Path to plan file' },
          },
          required: ['planPath'],
        },
      },
      {
        name: 'complete_plan_revision',
        description: 'Complete a plan revision after Planner has modified it.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            planPath: { type: 'string', description: 'Path to plan file' },
            changeDescription: { type: 'string', description: 'Summary of changes made' },
            tasksAdded: { type: 'array', items: { type: 'string' }, description: 'Tasks added' },
            tasksRemoved: { type: 'array', items: { type: 'string' }, description: 'Tasks removed' },
            tasksModified: { type: 'array', items: { type: 'string' }, description: 'Tasks modified' },
          },
          required: ['planPath', 'changeDescription'],
        },
      },
      {
        name: 'get_plan_version_history',
        description: 'Get version history for a plan.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            planPath: { type: 'string', description: 'Path to plan file' },
          },
          required: ['planPath'],
        },
      },

      // === Deviation Management ===
      {
        name: 'report_deviation',
        description: 'Report an executor deviation from plan. Auto-determines level (1-3) based on type and severity.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            planPath: { type: 'string', description: 'Path to plan file' },
            taskId: { type: 'string', description: 'Task ID that deviated' },
            type: {
              type: 'string',
              enum: ['file_addition', 'file_modification', 'approach_change', 'dependency_addition', 'scope_expansion', 'scope_reduction', 'blocker_workaround', 'performance_tradeoff', 'other'],
              description: 'Type of deviation',
            },
            description: { type: 'string', description: 'What was different' },
            planned: { type: 'string', description: 'What was planned' },
            actual: { type: 'string', description: 'What actually happened' },
            reason: { type: 'string', description: 'Why deviation was necessary' },
            affectedFiles: { type: 'array', items: { type: 'string' }, description: 'Files affected' },
            impact: { type: 'string', description: 'Impact assessment' },
            level: { type: 'number', description: 'Override auto-determined level (1-3)' },
          },
          required: ['planPath', 'taskId', 'type', 'description', 'planned', 'actual', 'reason'],
        },
      },
      {
        name: 'get_deviations',
        description: 'Get all deviations for a plan.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            planPath: { type: 'string', description: 'Path to plan file' },
            level: { type: 'number', description: 'Filter by level (1-3)' },
          },
          required: ['planPath'],
        },
      },
      {
        name: 'get_pending_approvals',
        description: 'Get Level 2 deviations pending Architect approval.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            planPath: { type: 'string', description: 'Path to plan file' },
          },
          required: ['planPath'],
        },
      },
      {
        name: 'submit_deviation_verdict',
        description: 'Submit Architect verdict for a Level 2 deviation.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            planPath: { type: 'string', description: 'Path to plan file' },
            deviationId: { type: 'string', description: 'Deviation ID' },
            approved: { type: 'boolean', description: 'Whether approved' },
            reasoning: { type: 'string', description: 'Reasoning for verdict' },
            conditions: { type: 'array', items: { type: 'string' }, description: 'Conditions if approved' },
          },
          required: ['planPath', 'deviationId', 'approved', 'reasoning'],
        },
      },
      {
        name: 'get_deviation_stats',
        description: 'Get deviation statistics for a plan.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            planPath: { type: 'string', description: 'Path to plan file' },
          },
          required: ['planPath'],
        },
      },
      {
        name: 'has_unresolved_level3',
        description: 'Check if plan has unresolved Level 3 deviations (blocks execution).',
        inputSchema: {
          type: 'object' as const,
          properties: {
            planPath: { type: 'string', description: 'Path to plan file' },
          },
          required: ['planPath'],
        },
      },

      // === Spike Management ===
      {
        name: 'create_spike',
        description: 'Create a spike task for high-uncertainty work. Spikes are time-boxed explorations before main task.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            planPath: { type: 'string', description: 'Path to plan file' },
            originalTaskId: { type: 'string', description: 'Task ID this spike is for' },
            objective: { type: 'string', description: 'What question to answer' },
            questions: { type: 'array', items: { type: 'string' }, description: 'Questions to answer during spike' },
            category: {
              type: 'string',
              enum: ['technical', 'integration', 'performance', 'feasibility', 'dependency', 'api', 'data', 'scope'],
              description: 'Uncertainty category',
            },
            uncertaintyLevel: { type: 'number', description: 'Uncertainty level (0-10)' },
            timeBoxMinutes: { type: 'number', description: 'Time limit in minutes (default: 30)' },
          },
          required: ['planPath', 'originalTaskId', 'objective', 'questions'],
        },
      },
      {
        name: 'assess_uncertainty',
        description: 'Assess task uncertainty based on description and context.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            taskDescription: { type: 'string', description: 'Task description to assess' },
            isNewTechnology: { type: 'boolean', description: 'Using unfamiliar technology' },
            hasExternalDependency: { type: 'boolean', description: 'Has external dependency' },
            isPerformanceCritical: { type: 'boolean', description: 'Performance is critical' },
            hasUnknownScope: { type: 'boolean', description: 'Scope is unclear' },
            requiresResearch: { type: 'boolean', description: 'Research needed' },
          },
          required: ['taskDescription'],
        },
      },
      {
        name: 'complete_spike',
        description: 'Complete a spike with findings and recommendations.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            planPath: { type: 'string', description: 'Path to plan file' },
            spikeId: { type: 'string', description: 'Spike ID' },
            success: { type: 'boolean', description: 'Whether spike was successful' },
            findings: { type: 'array', items: { type: 'string' }, description: 'Key findings' },
            recommendedApproach: { type: 'string', description: 'Recommended approach based on spike' },
            proceedWithTask: { type: 'boolean', description: 'Should original task proceed' },
            timeSpentMinutes: { type: 'number', description: 'Time spent on spike' },
            planModifications: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['add_task', 'remove_task', 'modify_task', 'add_dependency', 'change_approach'] },
                  description: { type: 'string' },
                  rationale: { type: 'string' },
                },
              },
              description: 'Suggested plan modifications',
            },
          },
          required: ['planPath', 'spikeId', 'success', 'findings', 'proceedWithTask', 'timeSpentMinutes'],
        },
      },
      {
        name: 'get_pending_spikes',
        description: 'Get pending spikes for a plan.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            planPath: { type: 'string', description: 'Path to plan file' },
          },
          required: ['planPath'],
        },
      },
      {
        name: 'get_spike_stats',
        description: 'Get spike statistics for a plan.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            planPath: { type: 'string', description: 'Path to plan file' },
          },
          required: ['planPath'],
        },
      },

      // === Phase Completion & Tagging ===
      {
        name: 'complete_phase',
        description: 'Mark a phase as complete with checkpoint and git tag.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            phaseNumber: { type: 'number', description: 'Phase number' },
            phaseName: { type: 'string', description: 'Phase name/description' },
          },
          required: ['phaseNumber', 'phaseName'],
        },
      },
      {
        name: 'list_phase_tags',
        description: 'List all phase completion tags.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },

      // === Advanced Rollback ===
      {
        name: 'preview_rollback',
        description: 'Preview what files would change if rolling back to a checkpoint.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            checkpointId: { type: 'string', description: 'Checkpoint ID' },
          },
          required: ['checkpointId'],
        },
      },
      {
        name: 'selective_rollback',
        description: 'Perform selective rollback with fine-grained control over what gets rolled back.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            checkpointId: { type: 'string', description: 'Checkpoint ID' },
            rollbackState: { type: 'boolean', description: 'Rollback state files (default: true)' },
            rollbackSource: { type: 'boolean', description: 'Rollback source files (default: false)' },
            sourcePatterns: { type: 'array', items: { type: 'string' }, description: 'Source patterns to rollback' },
            dryRun: { type: 'boolean', description: 'Preview without making changes' },
          },
          required: ['checkpointId'],
        },
      },
      {
        name: 'rollback_to_phase',
        description: 'Rollback to a specific phase completion point.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            phaseNumber: { type: 'number', description: 'Phase number to rollback to' },
            rollbackSource: { type: 'boolean', description: 'Also rollback source files (default: false)' },
            dryRun: { type: 'boolean', description: 'Preview without making changes' },
          },
          required: ['phaseNumber'],
        },
      },
      {
        name: 'get_rollback_targets',
        description: 'Get available checkpoints and phase tags for rollback.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },

      // === Swarm Prompts (v3.0 - prompt generation only, state via Claude Code Task API) ===
      {
        name: 'generate_worker_prompt',
        description: 'Generate prompt for a swarm worker agent.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            sessionId: { type: 'string', description: 'Swarm session ID' },
            workerId: { type: 'string', description: 'Worker ID' },
            workerName: { type: 'string', description: 'Worker name' },
            planPath: { type: 'string', description: 'Path to plan' },
            learnings: { type: 'string', description: 'Relevant learnings to inject' },
            context: { type: 'string', description: 'Additional context' },
          },
          required: ['sessionId', 'workerId', 'workerName', 'planPath'],
        },
      },
      {
        name: 'generate_swarm_orchestrator_prompt',
        description: 'Generate prompt for the swarm orchestrator.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            planPath: { type: 'string', description: 'Path to plan' },
            sessionId: { type: 'string', description: 'Swarm session ID' },
            workerCount: { type: 'number', description: 'Number of workers' },
          },
          required: ['planPath', 'sessionId', 'workerCount'],
        },
      },

      // === Pipeline (v3.0 - preset/parsing only, state via Claude Code Task API) ===
      {
        name: 'create_pipeline_preset',
        description: 'Create a pipeline from a built-in preset (review, implement, debug, research, refactor, security).',
        inputSchema: {
          type: 'object' as const,
          properties: {
            preset: {
              type: 'string',
              enum: ['review', 'implement', 'debug', 'research', 'refactor', 'security'],
              description: 'Preset name',
            },
            initialInput: { type: 'string', description: 'Initial input for first stage' },
          },
          required: ['preset'],
        },
      },
      {
        name: 'parse_pipeline_string',
        description: 'Parse a pipeline definition string like "explore:haiku -> architect:opus -> executor:sonnet".',
        inputSchema: {
          type: 'object' as const,
          properties: {
            pipelineStr: { type: 'string', description: 'Pipeline definition string' },
            name: { type: 'string', description: 'Pipeline name' },
          },
          required: ['pipelineStr'],
        },
      },
      {
        name: 'list_pipeline_presets',
        description: 'List available pipeline presets.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      {
        name: 'generate_pipeline_orchestrator_prompt',
        description: 'Generate prompt for pipeline orchestrator.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            pipeline: { type: 'object', description: 'Pipeline object from create_pipeline_preset or parse_pipeline_string' },
          },
          required: ['pipeline'],
        },
      },

      // === Context Collection (v3.0) ===
      {
        name: 'collect_project_context',
        description: 'Collect project context from PROJECT.md, ROADMAP.md, REQUIREMENTS.md.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            planningDir: { type: 'string', description: 'Path to .planning directory (default: .planning)' },
          },
          required: [],
        },
      },
      {
        name: 'collect_phase_context',
        description: 'Collect phase context including research and plans.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            phaseNumber: { type: 'number', description: 'Phase number (e.g., 3)' },
            planningDir: { type: 'string', description: 'Path to .planning directory' },
          },
          required: ['phaseNumber'],
        },
      },
      {
        name: 'collect_task_context',
        description: 'Collect task context from a specific PLAN.md.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            planId: { type: 'string', description: 'Plan identifier (e.g., "03-01")' },
            planningDir: { type: 'string', description: 'Path to .planning directory' },
          },
          required: ['planId'],
        },
      },
      {
        name: 'compress_context',
        description: 'Compress context into a minimal summary for fresh-start scenarios.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            planId: { type: 'string', description: 'Current plan ID' },
            planningDir: { type: 'string', description: 'Path to .planning directory' },
            saveSnapshot: { type: 'boolean', description: 'Whether to save snapshot to disk' },
          },
          required: [],
        },
      },
      {
        name: 'restore_context',
        description: 'Restore context from a saved snapshot.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            snapshotId: { type: 'string', description: 'Snapshot ID or "latest"' },
          },
          required: [],
        },
      },

      // === ThinkTank Context (EdSpark Integration) ===
      {
        name: 'get_thinktank_context',
        description: 'Get ThinkTank context for GSD Planner injection. Returns departments, agents, and execution flow summary if .edspark/thinktank/ exists.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            projectPath: { type: 'string', description: 'Project path (default: current directory)' },
          },
          required: [],
        },
      },
      {
        name: 'get_department_context',
        description: 'Get department-specific context with agent specializations for a specific department.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            department: { type: 'string', description: 'Department name (e.g., design, strategy, development)' },
            projectPath: { type: 'string', description: 'Project path (default: current directory)' },
          },
          required: ['department'],
        },
      },
      {
        name: 'has_thinktank',
        description: 'Check if project has ThinkTank structure (.edspark/thinktank/).',
        inputSchema: {
          type: 'object' as const,
          properties: {
            projectPath: { type: 'string', description: 'Project path (default: current directory)' },
          },
          required: [],
        },
      },

      // === Hints (v3.0 - suggestions, AI decides) ===
      {
        name: 'suggest_complexity',
        description: 'Get complexity hint for a task. Returns isHint: true with suggested level, model, and confidence. AI makes final decision.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            taskDescription: { type: 'string', description: 'Task description' },
            files: { type: 'array', items: { type: 'string' }, description: 'Files to be modified' },
            dependencies: { type: 'array', items: { type: 'string' }, description: 'Task dependencies' },
          },
          required: ['taskDescription'],
        },
      },
      {
        name: 'suggest_route',
        description: 'Get routing hint for a task. Returns isHint: true with suggested agent, model, and confidence. AI makes final decision.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            taskDescription: { type: 'string', description: 'Task description' },
            isUI: { type: 'boolean', description: 'Context: is UI work' },
            isDocumentation: { type: 'boolean', description: 'Context: is documentation' },
            isDebugging: { type: 'boolean', description: 'Context: is debugging' },
            isArchitecture: { type: 'boolean', description: 'Context: is architecture' },
          },
          required: ['taskDescription'],
        },
      },
      {
        name: 'get_task_hints',
        description: 'Get all hints (complexity, routing, model) for a task in one call.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            taskDescription: { type: 'string', description: 'Task description' },
            files: { type: 'array', items: { type: 'string' }, description: 'Files to be modified' },
          },
          required: ['taskDescription'],
        },
      },

      // === Delegation / Task Routing ===
      {
        name: 'detect_task_category',
        description: 'Detect delegation category from task description. Categories: quick, standard, complex, ultrabrain, visual-engineering, artistry, writing.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            taskDescription: { type: 'string', description: 'Task description to categorize' },
          },
          required: ['taskDescription'],
        },
      },
      {
        name: 'route_task',
        description: 'Route a task to appropriate agent and model based on description or hints.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            taskDescription: { type: 'string', description: 'Task description' },
            preferredCategory: {
              type: 'string',
              enum: ['quick', 'standard', 'complex', 'ultrabrain', 'visual-engineering', 'artistry', 'writing'],
              description: 'Override auto-detection with preferred category',
            },
            forceModel: {
              type: 'string',
              enum: ['haiku', 'sonnet', 'opus'],
              description: 'Force a specific model tier',
            },
            isUI: { type: 'boolean', description: 'Context hint: is UI work' },
            isDocumentation: { type: 'boolean', description: 'Context hint: is documentation' },
            isDebugging: { type: 'boolean', description: 'Context hint: is debugging' },
            isArchitecture: { type: 'boolean', description: 'Context hint: is architecture' },
          },
          required: ['taskDescription'],
        },
      },
      {
        name: 'route_by_complexity',
        description: 'Route task using complexity estimation (file count, dependencies, keywords).',
        inputSchema: {
          type: 'object' as const,
          properties: {
            taskDescription: { type: 'string', description: 'Task description' },
            files: { type: 'array', items: { type: 'string' }, description: 'Files to be modified' },
          },
          required: ['taskDescription'],
        },
      },
      {
        name: 'list_delegation_categories',
        description: 'List all delegation categories with descriptions.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      {
        name: 'generate_executor_loop_prompt',
        description: 'Generate autonomous executor loop prompt for continuous task execution.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            workerId: { type: 'string', description: 'Worker ID' },
            sessionId: { type: 'string', description: 'Session ID' },
            planPath: { type: 'string', description: 'Path to plan' },
            learnings: { type: 'string', description: 'Relevant learnings to inject' },
          },
          required: [],
        },
      },

      // === Skills (v3.1 - Dynamic Skill Injection) ===
      {
        name: 'match_skills',
        description: 'Match skills based on context (request, agent, phase, trigger event, input types, error patterns). Returns matched skills with scores.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            request: { type: 'string', description: 'User request or task description' },
            agentId: { type: 'string', description: 'Target agent ID' },
            phase: { type: 'string', description: 'Current phase (research, planning, execution, verification)' },
            triggerEvent: { type: 'string', description: 'Trigger event (build_error, execution_complete, image_input, etc.)' },
            inputTypes: {
              type: 'array',
              items: { type: 'string' },
              description: 'Input types (image, screenshot, mockup, diagram, etc.)',
            },
            errorPatterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'Error messages to match against skill triggers',
            },
            maxResults: { type: 'number', description: 'Maximum number of results (default: 5)' },
          },
          required: [],
        },
      },
      {
        name: 'inject_skills',
        description: 'Analyze context and inject matched skills into agent prompt. Returns enhanced prompt with skill templates.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            agentId: { type: 'string', description: 'Target agent ID (required)' },
            basePrompt: { type: 'string', description: 'Base prompt to enhance (required)' },
            request: { type: 'string', description: 'User request' },
            phase: { type: 'string', description: 'Current phase' },
            triggerEvent: { type: 'string', description: 'Trigger event' },
            attachments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  path: { type: 'string' },
                },
              },
              description: 'Attachments with type and optional path',
            },
            errors: {
              type: 'array',
              items: { type: 'string' },
              description: 'Error messages',
            },
            tddMode: { type: 'boolean', description: 'Enable TDD mode' },
            securityReview: { type: 'boolean', description: 'Enable security review' },
            codeReview: { type: 'boolean', description: 'Enable code review' },
          },
          required: ['agentId', 'basePrompt'],
        },
      },
      {
        name: 'inject_specific_skills',
        description: 'Force inject specific skills by ID into agent prompt.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            skillIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Skill IDs to inject (required)',
            },
            agentId: { type: 'string', description: 'Target agent ID (required)' },
            basePrompt: { type: 'string', description: 'Base prompt to enhance (required)' },
          },
          required: ['skillIds', 'agentId', 'basePrompt'],
        },
      },
      {
        name: 'needs_skill_injection',
        description: 'Quick check if skill injection is needed based on context.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            agentId: { type: 'string', description: 'Target agent ID' },
            basePrompt: { type: 'string', description: 'Base prompt' },
            attachments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  path: { type: 'string' },
                },
              },
            },
            errors: { type: 'array', items: { type: 'string' } },
            tddMode: { type: 'boolean' },
          },
          required: ['agentId', 'basePrompt'],
        },
      },
      {
        name: 'list_skills',
        description: 'List all available skills with their metadata.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            category: { type: 'string', description: 'Filter by category (optional)' },
          },
          required: [],
        },
      },
      {
        name: 'get_skill',
        description: 'Get a specific skill by ID.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            skillId: { type: 'string', description: 'Skill ID' },
          },
          required: ['skillId'],
        },
      },
      {
        name: 'get_auto_selected_skills',
        description: 'Get skills auto-selected for a specific event with conditions.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            event: { type: 'string', description: 'Event name (e.g., "on_build_error", "on_execution_complete")' },
            conditions: {
              type: 'array',
              items: { type: 'string' },
              description: 'Conditions to check (e.g., "type_error", "code_review_enabled")',
            },
          },
          required: ['event'],
        },
      },
    ],
  };
});

// ============================================================================
// Tool Handlers
// ============================================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Ensure args is defined
  const safeArgs = args || {};

  try {
    switch (name) {
      // === Plan Parsing ===
      case 'parse_plan': {
        const planData = await parsePlanForSync(safeArgs.path as string);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(planData, null, 2) }],
        };
      }

      case 'extract_task_mappings': {
        const planData = await parsePlanForSync(safeArgs.path as string);
        const mappings = extractTaskMappings(planData);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(mappings, null, 2) }],
        };
      }

      // === Task Creation ===
      case 'generate_task_creates': {
        const planData = await parsePlanForSync(safeArgs.path as string);
        const mappings = extractTaskMappings(planData);
        const creates = generateTaskCreations(mappings);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(creates, null, 2) }],
        };
      }

      case 'get_execution_order': {
        const planData = await parsePlanForSync(safeArgs.path as string);
        const mappings = extractTaskMappings(planData);
        const ordered = getExecutionOrder(mappings);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(ordered, null, 2) }],
        };
      }

      // === Dependencies ===
      case 'build_dependency_map': {
        const planData = await parsePlanForSync(safeArgs.path as string);
        const mappings = extractTaskMappings(planData);
        const depMap = buildDependencyMap(mappings);
        // depMap is already Record<string, string[]>
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(depMap, null, 2) }],
        };
      }

      // === Progress ===
      case 'calculate_progress': {
        const tasks = safeArgs.tasks as Array<{ id: string; status: string }>;
        const stats = calculateProgress(
          tasks.map((t) => ({
            id: t.id,
            subject: '',
            status: t.status as 'pending' | 'in_progress' | 'completed',
          }))
        );
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ ...stats, formatted: formatProgress(stats) }, null, 2),
          }],
        };
      }

      // === Notepad: Write ===
      case 'add_learning': {
        const success = addLearning(safeArgs.planId as string, {
          taskId: safeArgs.taskId as string,
          content: safeArgs.content as string,
          pattern: safeArgs.pattern as string | undefined,
          learningType: safeArgs.learningType as 'pattern' | 'convention' | 'gotcha' | 'discovery' | 'avoid' | 'prefer' | undefined,
          priority: safeArgs.priority as number | undefined,
          tags: safeArgs.tags as string[] | undefined,
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success }) }],
        };
      }

      case 'add_decision': {
        const success = addDecision(safeArgs.planId as string, {
          taskId: safeArgs.taskId as string,
          content: safeArgs.content as string,
          rationale: safeArgs.rationale as string,
          alternatives: safeArgs.alternatives as string[] | undefined,
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success }) }],
        };
      }

      case 'add_issue': {
        const success = addIssue(safeArgs.planId as string, {
          taskId: safeArgs.taskId as string,
          content: safeArgs.content as string,
          severity: safeArgs.severity as 'low' | 'medium' | 'high' | 'critical',
          status: safeArgs.status as 'open' | 'workaround' | 'resolved',
          workaround: safeArgs.workaround as string | undefined,
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success }) }],
        };
      }

      // === Notepad: Read ===
      case 'get_wisdom': {
        const wisdom = getWisdomForPlan(safeArgs.planId as string);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(wisdom, null, 2) }],
        };
      }

      case 'create_wisdom_directive': {
        const directive = createWisdomDirective(safeArgs.planId as string);
        return {
          content: [{ type: 'text' as const, text: directive }],
        };
      }

      case 'has_wisdom': {
        const result = hasWisdom(safeArgs.planId as string);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ hasWisdom: result }) }],
        };
      }

      // === Notepad: Merge ===
      case 'merge_plan_to_project': {
        const results = mergePlanToProject(safeArgs.planId as string);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }],
        };
      }

      case 'generate_project_summary': {
        const success = generateProjectSummary();
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success }) }],
        };
      }

      // === Context Monitoring ===
      case 'estimate_tokens': {
        const tokens = estimateTokens(safeArgs.text as string);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ tokens }) }],
        };
      }

      case 'check_context_threshold': {
        const current = safeArgs.currentTokens as number;
        const max = (safeArgs.maxTokens as number) || 200000;
        const percentage = (current / max) * 100;
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              currentTokens: current,
              maxTokens: max,
              percentage: percentage.toFixed(1),
              prepareThresholdExceeded: percentage >= 70,
              returnThresholdExceeded: percentage >= 85,
            }),
          }],
        };
      }

      // === Notepad Init ===
      case 'init_plan_notepad': {
        const manager = new NotepadManager();
        const success = manager.initPlanNotepad(safeArgs.planId as string);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success }) }],
        };
      }

      // === Complexity Estimation ===
      case 'estimate_task_complexity': {
        const result = estimateComplexity({
          taskDescription: safeArgs.taskDescription as string,
          files: safeArgs.files as string[] | undefined,
          dependencies: safeArgs.dependencies as string[] | undefined,
        });
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              ...result,
              levelDescription: COMPLEXITY_DESCRIPTIONS[result.complexity.level],
            }, null, 2),
          }],
        };
      }

      case 'get_model_for_complexity': {
        const level = safeArgs.level as number;
        if (level < 1 || level > 5) {
          throw new Error('Complexity level must be between 1 and 5');
        }
        const model = getModelForComplexity(level as 1 | 2 | 3 | 4 | 5);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              level,
              model,
              description: COMPLEXITY_DESCRIPTIONS[level as 1 | 2 | 3 | 4 | 5],
            }),
          }],
        };
      }

      case 'batch_estimate_complexity': {
        const tasks = safeArgs.tasks as Array<{ name: string; action: string; files?: string[] }>;
        const results = batchEstimate(tasks);
        const output: Record<string, unknown> = {};
        for (const [name, result] of results) {
          output[name] = {
            ...result,
            levelDescription: COMPLEXITY_DESCRIPTIONS[result.complexity.level],
          };
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
        };
      }

      // === Verdict Evaluation ===
      case 'evaluate_architect_checklist': {
        const checklist = safeArgs.checklist as {
          codeCompiles: boolean;
          testsPass: boolean;
          requirementsMet: boolean;
          noRegressions: boolean;
          codeQuality: boolean;
        };
        const verdict = createArchitectVerdict(
          safeArgs.taskId as string,
          checklist,
          {
            issues: safeArgs.issues as string[] | undefined,
            suggestions: safeArgs.suggestions as string[] | undefined,
          }
        );
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              ...verdict,
              checklistFormatted: formatChecklist(checklist, ARCHITECT_ITEM_NAMES),
              approvalThreshold: APPROVAL_THRESHOLD,
            }, null, 2),
          }],
        };
      }

      case 'evaluate_critic_checklist': {
        const checklist = safeArgs.checklist as {
          goalsAligned: boolean;
          tasksAtomic: boolean;
          dependenciesClear: boolean;
          verifiable: boolean;
          waveStructure: boolean;
        };
        const verdict = createCriticVerdict(
          safeArgs.planPath as string,
          checklist,
          safeArgs.justification as string,
          {
            iteration: safeArgs.iteration as number | undefined,
            improvements: safeArgs.improvements as string[] | undefined,
          }
        );
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              ...verdict,
              checklistFormatted: formatChecklist(checklist, CRITIC_ITEM_NAMES),
              approvalThreshold: APPROVAL_THRESHOLD,
            }, null, 2),
          }],
        };
      }

      case 'get_approval_threshold': {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              threshold: APPROVAL_THRESHOLD,
              description: `${APPROVAL_THRESHOLD}% of checklist items must pass for approval`,
            }),
          }],
        };
      }

      // === Session Management ===
      case 'create_session': {
        const session = createSession({
          name: safeArgs.name as string | undefined,
          parentSessionId: safeArgs.parentSessionId as string | undefined,
          mode: safeArgs.mode as 'idle' | 'planning' | 'executing' | 'verifying' | 'paused' | 'error' | undefined,
          agentRole: safeArgs.agentRole as 'planner' | 'executor' | 'architect' | 'critic' | undefined,
          activePlan: safeArgs.activePlan as string | undefined,
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(session, null, 2) }],
        };
      }

      case 'get_session': {
        const session = getSession(safeArgs.sessionId as string);
        if (!session) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Session not found' }) }],
            isError: true,
          };
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(session, null, 2) }],
        };
      }

      case 'list_sessions': {
        const manager = getSessionManager();
        const sessions = manager.listActiveSessions();
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              count: sessions.length,
              sessions: sessions.map(s => ({
                id: s.sessionId.id,
                name: s.sessionId.name,
                mode: s.mode,
                agentRole: s.agentRole,
                claimedTasks: s.claimedTasks.length,
                startedAt: s.startedAt,
              })),
            }, null, 2),
          }],
        };
      }

      case 'claim_task_for_session': {
        const manager = getSessionManager();
        const success = manager.claimTask(
          safeArgs.sessionId as string,
          safeArgs.taskId as string
        );
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ success, taskId: safeArgs.taskId }),
          }],
        };
      }

      case 'complete_session': {
        const manager = getSessionManager();
        const result = manager.completeSession(safeArgs.sessionId as string, {
          status: safeArgs.status as 'success' | 'failed' | 'timeout' | 'cancelled',
          verdict: safeArgs.verdict as unknown,
          learnings: safeArgs.learnings as string[] | undefined,
          error: safeArgs.error as string | undefined,
        });
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Session not found' }) }],
            isError: true,
          };
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      }

      // === Plan Revision ===
      case 'flag_plan_for_revision': {
        const status = flagPlanForRevision(
          safeArgs.planPath as string,
          safeArgs.reason as 'deviation_level_3' | 'spike_discovery' | 'blocker_found' | 'scope_change' | 'dependency_discovered' | 'manual_request',
          safeArgs.description as string,
          {
            affectedTasks: safeArgs.affectedTasks as string[] | undefined,
            source: safeArgs.source as string | undefined,
          }
        );
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(status, null, 2) }],
        };
      }

      case 'check_revision_needed': {
        const status = checkRevisionNeeded(safeArgs.planPath as string);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(status, null, 2) }],
        };
      }

      case 'complete_plan_revision': {
        const result = completePlanRevision(
          safeArgs.planPath as string,
          safeArgs.changeDescription as string,
          {
            tasksAdded: safeArgs.tasksAdded as string[] | undefined,
            tasksRemoved: safeArgs.tasksRemoved as string[] | undefined,
            tasksModified: safeArgs.tasksModified as string[] | undefined,
          }
        );
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'get_plan_version_history': {
        const history = getPlanVersionHistory(safeArgs.planPath as string);
        const currentVersion = getCurrentPlanVersion(safeArgs.planPath as string);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ currentVersion, versions: history }, null, 2),
          }],
        };
      }

      // === Deviation Management ===
      case 'report_deviation': {
        const report = reportDeviation(
          safeArgs.planPath as string,
          safeArgs.taskId as string,
          safeArgs.type as 'file_addition' | 'file_modification' | 'approach_change' | 'dependency_addition' | 'scope_expansion' | 'scope_reduction' | 'blocker_workaround' | 'performance_tradeoff' | 'other',
          safeArgs.description as string,
          safeArgs.planned as string,
          safeArgs.actual as string,
          safeArgs.reason as string,
          {
            affectedFiles: safeArgs.affectedFiles as string[] | undefined,
            impact: safeArgs.impact as string | undefined,
            level: safeArgs.level as 1 | 2 | 3 | undefined,
          }
        );
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(report, null, 2) }],
        };
      }

      case 'get_deviations': {
        const level = safeArgs.level as number | undefined;
        let deviations;
        if (level) {
          deviations = getDeviationsByLevel(safeArgs.planPath as string, level as 1 | 2 | 3);
        } else {
          deviations = getDeviations(safeArgs.planPath as string);
        }
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ count: deviations.length, deviations }, null, 2),
          }],
        };
      }

      case 'get_pending_approvals': {
        const pending = getPendingApprovals(safeArgs.planPath as string);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ count: pending.length, pending }, null, 2),
          }],
        };
      }

      case 'submit_deviation_verdict': {
        const result = submitArchitectVerdict(
          safeArgs.planPath as string,
          safeArgs.deviationId as string,
          safeArgs.approved as boolean,
          safeArgs.reasoning as string,
          safeArgs.conditions as string[] | undefined
        );
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Deviation not found' }) }],
            isError: true,
          };
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'get_deviation_stats': {
        const stats = getDeviationStats(safeArgs.planPath as string);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(stats || { total: 0, byLevel: {}, byStatus: {}, revisionsTriggered: 0 }, null, 2),
          }],
        };
      }

      case 'has_unresolved_level3': {
        const hasUnresolved = hasUnresolvedLevel3(safeArgs.planPath as string);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ hasUnresolvedLevel3: hasUnresolved }),
          }],
        };
      }

      // === Spike Management ===
      case 'create_spike': {
        const spike = createSpike(
          safeArgs.planPath as string,
          safeArgs.originalTaskId as string,
          safeArgs.objective as string,
          safeArgs.questions as string[],
          {
            category: safeArgs.category as 'technical' | 'integration' | 'performance' | 'feasibility' | 'dependency' | 'api' | 'data' | 'scope' | undefined,
            uncertaintyLevel: safeArgs.uncertaintyLevel as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | undefined,
            timeBoxMinutes: safeArgs.timeBoxMinutes as number | undefined,
          }
        );
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(spike, null, 2) }],
        };
      }

      case 'assess_uncertainty': {
        const assessment = assessUncertainty(
          safeArgs.taskDescription as string,
          {
            isNewTechnology: safeArgs.isNewTechnology as boolean | undefined,
            hasExternalDependency: safeArgs.hasExternalDependency as boolean | undefined,
            isPerformanceCritical: safeArgs.isPerformanceCritical as boolean | undefined,
            hasUnknownScope: safeArgs.hasUnknownScope as boolean | undefined,
            requiresResearch: safeArgs.requiresResearch as boolean | undefined,
          }
        );
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              ...assessment,
              needsSpike: needsSpike(assessment.uncertainty),
            }, null, 2),
          }],
        };
      }

      case 'complete_spike': {
        const spike = completeSpike(
          safeArgs.planPath as string,
          safeArgs.spikeId as string,
          {
            success: safeArgs.success as boolean,
            findings: safeArgs.findings as string[],
            recommendedApproach: safeArgs.recommendedApproach as string | undefined,
            proceedWithTask: safeArgs.proceedWithTask as boolean,
            timeSpentMinutes: safeArgs.timeSpentMinutes as number,
            planModifications: safeArgs.planModifications as Array<{
              type: 'add_task' | 'remove_task' | 'modify_task' | 'add_dependency' | 'change_approach';
              description: string;
              rationale: string;
            }> | undefined,
          }
        );
        if (!spike) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Spike not found' }) }],
            isError: true,
          };
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(spike, null, 2) }],
        };
      }

      case 'get_pending_spikes': {
        const pending = getPendingSpikes(safeArgs.planPath as string);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ count: pending.length, spikes: pending }, null, 2),
          }],
        };
      }

      case 'get_spike_stats': {
        const stats = getSpikeStats(safeArgs.planPath as string);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(stats || { total: 0, byStatus: {}, modificationsTriggered: 0 }, null, 2),
          }],
        };
      }

      // === Phase Completion & Tagging ===
      case 'complete_phase': {
        const result = completePhase(
          safeArgs.phaseNumber as number,
          safeArgs.phaseName as string
        );
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'list_phase_tags': {
        const tags = listPhaseTags();
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ count: tags.length, tags }, null, 2),
          }],
        };
      }

      // === Advanced Rollback ===
      case 'preview_rollback': {
        const preview = previewRollback(safeArgs.checkpointId as string);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(preview, null, 2) }],
        };
      }

      case 'selective_rollback': {
        const result = selectiveRollback(
          safeArgs.checkpointId as string,
          {
            rollbackState: (safeArgs.rollbackState as boolean) ?? true,
            rollbackSource: (safeArgs.rollbackSource as boolean) ?? false,
            sourcePatterns: safeArgs.sourcePatterns as string[] | undefined,
            dryRun: safeArgs.dryRun as boolean | undefined,
          }
        );
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'rollback_to_phase': {
        const result = rollbackToPhase(
          safeArgs.phaseNumber as number,
          {
            rollbackSource: safeArgs.rollbackSource as boolean | undefined,
            dryRun: safeArgs.dryRun as boolean | undefined,
          }
        );
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'get_rollback_targets': {
        const targets = getAvailableRollbackTargets();
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              checkpointCount: targets.checkpoints.length,
              phaseTagCount: targets.phaseTags.length,
              ...targets,
            }, null, 2),
          }],
        };
      }

      // === Swarm Prompts (v3.0 - prompt generation only) ===
      case 'generate_worker_prompt': {
        const prompt = generateWorkerPrompt({
          worker: {
            id: safeArgs.workerId as string,
            name: safeArgs.workerName as string,
            index: 0,
          },
          sessionId: safeArgs.sessionId as string,
          planPath: safeArgs.planPath as string,
          learnings: safeArgs.learnings as string | undefined,
          context: safeArgs.context as string | undefined,
        });
        return {
          content: [{ type: 'text' as const, text: prompt }],
        };
      }

      case 'generate_swarm_orchestrator_prompt': {
        const prompt = generateOrchestratorPrompt(
          safeArgs.planPath as string,
          safeArgs.sessionId as string,
          safeArgs.workerCount as number
        );
        return {
          content: [{ type: 'text' as const, text: prompt }],
        };
      }

      // === Pipeline (v3.0 - preset/parsing only) ===
      case 'create_pipeline_preset': {
        const pipeline = createPipelineFromPreset(
          safeArgs.preset as 'review' | 'implement' | 'debug' | 'research' | 'refactor' | 'security',
          safeArgs.initialInput as string | undefined
        );
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(pipeline, null, 2) }],
        };
      }

      case 'parse_pipeline_string': {
        const pipeline = parsePipelineString(
          safeArgs.pipelineStr as string,
          safeArgs.name as string | undefined
        );
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(pipeline, null, 2) }],
        };
      }

      case 'list_pipeline_presets': {
        const presets = listPipelinePresets();
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(presets, null, 2) }],
        };
      }

      case 'generate_pipeline_orchestrator_prompt': {
        const pipeline = safeArgs.pipeline as { name: string; stages: Array<{ name: string }>; description?: string };
        if (!pipeline) {
          throw new Error('Pipeline object is required');
        }
        const sessionId = generatePipelineSessionId();
        const prompt = generatePipelineOrchestratorPrompt(pipeline as any, sessionId);
        return {
          content: [{ type: 'text' as const, text: prompt }],
        };
      }

      // === Context Collection (v3.0) ===
      case 'collect_project_context': {
        const ctx = collectProjectContext(safeArgs.planningDir as string | undefined);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({
            exists: ctx.exists,
            hasProject: !!ctx.projectMd,
            hasRoadmap: !!ctx.roadmapMd,
            hasRequirements: !!ctx.requirementsMd,
            projectPreview: ctx.projectMd?.slice(0, 500),
          }, null, 2) }],
        };
      }

      case 'collect_phase_context': {
        const ctx = collectPhaseContext(
          safeArgs.phaseNumber as number,
          safeArgs.planningDir as string | undefined
        );
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({
            exists: ctx.exists,
            phaseNumber: ctx.phaseNumber,
            phaseName: ctx.phaseName,
            hasResearch: !!ctx.researchMd,
            planCount: ctx.plans.length,
            summaryCount: ctx.summaries.length,
          }, null, 2) }],
        };
      }

      case 'collect_task_context': {
        const ctx = collectTaskContext(
          safeArgs.planId as string,
          safeArgs.planningDir as string | undefined
        );
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({
            exists: ctx.exists,
            planId: ctx.planId,
            hasPlan: !!ctx.planMd,
            hasSummary: !!ctx.summaryMd,
            planPath: ctx.planPath,
          }, null, 2) }],
        };
      }

      case 'compress_context': {
        const ctx = collectContext({
          planId: safeArgs.planId as string | undefined,
          planningDir: safeArgs.planningDir as string | undefined,
        });
        const compacted = compactContext(ctx, {
          planningDir: safeArgs.planningDir as string | undefined,
        });

        if (safeArgs.saveSnapshot) {
          const filepath = saveContextSnapshot(compacted);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({
              snapshotId: compacted.snapshotId,
              filepath,
              originalTokens: compacted.originalTokens,
              compactedTokens: compacted.compactedTokens,
              compressionRatio: (compacted.compactedTokens / compacted.originalTokens * 100).toFixed(1) + '%',
            }, null, 2) }],
          };
        }

        return {
          content: [{ type: 'text' as const, text: formatCompactedContext(compacted) }],
        };
      }

      case 'restore_context': {
        const restored = restoreContext(safeArgs.snapshotId as string || 'latest');
        if (!restored) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Snapshot not found' }) }],
            isError: true,
          };
        }
        return {
          content: [{ type: 'text' as const, text: formatCompactedContext(restored) }],
        };
      }

      // === Hints (v3.0 - suggestions, AI decides) ===
      case 'suggest_complexity': {
        const hint = suggestComplexity({
          taskDescription: safeArgs.taskDescription as string,
          files: safeArgs.files as string[] | undefined,
          dependencies: safeArgs.dependencies as string[] | undefined,
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(hint, null, 2) }],
        };
      }

      case 'suggest_route': {
        const hint = suggestRoute({
          taskDescription: safeArgs.taskDescription as string,
          contextHints: {
            isUI: safeArgs.isUI as boolean | undefined,
            isDocumentation: safeArgs.isDocumentation as boolean | undefined,
            isDebugging: safeArgs.isDebugging as boolean | undefined,
            isArchitecture: safeArgs.isArchitecture as boolean | undefined,
          },
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(hint, null, 2) }],
        };
      }

      case 'get_task_hints': {
        const hints = getTaskHints({
          taskDescription: safeArgs.taskDescription as string,
          files: safeArgs.files as string[] | undefined,
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(hints, null, 2) }],
        };
      }

      // === Delegation / Task Routing ===
      case 'detect_task_category': {
        const category = detectCategory(safeArgs.taskDescription as string);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ category }),
          }],
        };
      }

      case 'route_task': {
        const result = routeTask(
          safeArgs.taskDescription as string,
          {
            preferredCategory: safeArgs.preferredCategory as 'quick' | 'standard' | 'complex' | 'ultrabrain' | 'visual-engineering' | 'artistry' | 'writing' | undefined,
            forceModel: safeArgs.forceModel as 'haiku' | 'sonnet' | 'opus' | undefined,
            contextHints: {
              isUI: safeArgs.isUI as boolean | undefined,
              isDocumentation: safeArgs.isDocumentation as boolean | undefined,
              isDebugging: safeArgs.isDebugging as boolean | undefined,
              isArchitecture: safeArgs.isArchitecture as boolean | undefined,
            },
          }
        );
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'route_by_complexity': {
        const result = routeByComplexity(
          safeArgs.taskDescription as string,
          safeArgs.files as string[] | undefined
        );
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'list_delegation_categories': {
        const categories = listCategories();
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(categories, null, 2) }],
        };
      }

      case 'generate_executor_loop_prompt': {
        const prompt = generateExecutorLoopPrompt({
          workerId: safeArgs.workerId as string | undefined,
          sessionId: safeArgs.sessionId as string | undefined,
          planPath: safeArgs.planPath as string | undefined,
          learnings: safeArgs.learnings as string | undefined,
        });
        return {
          content: [{ type: 'text' as const, text: prompt }],
        };
      }

      // === Skills (v3.1 - Dynamic Skill Injection) ===
      case 'match_skills': {
        const registry = getSkillRegistry();
        const matches = registry.matchSkills(
          {
            request: safeArgs.request as string | undefined,
            agentId: safeArgs.agentId as string | undefined,
            phase: safeArgs.phase as string | undefined,
            triggerEvent: safeArgs.triggerEvent as string | undefined,
            inputTypes: safeArgs.inputTypes as string[] | undefined,
            errorPatterns: safeArgs.errorPatterns as string[] | undefined,
          },
          {
            maxResults: safeArgs.maxResults as number | undefined,
          }
        );
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(matches.map((m: { skill: { id: string; name: string; model_routing?: unknown }; score: number; matchReasons: string[] }) => ({
              skillId: m.skill.id,
              skillName: m.skill.name,
              score: m.score,
              matchReasons: m.matchReasons,
              modelRouting: m.skill.model_routing,
            })), null, 2),
          }],
        };
      }

      case 'inject_skills': {
        const result = injectSkills({
          agentId: safeArgs.agentId as string,
          basePrompt: safeArgs.basePrompt as string,
          context: {
            request: safeArgs.request as string | undefined,
            phase: safeArgs.phase as string | undefined,
            triggerEvent: safeArgs.triggerEvent as string | undefined,
            attachments: safeArgs.attachments as Array<{ type: string; path?: string }> | undefined,
            errors: safeArgs.errors as string[] | undefined,
            flags: {
              tddMode: safeArgs.tddMode as boolean | undefined,
              securityReview: safeArgs.securityReview as boolean | undefined,
              codeReview: safeArgs.codeReview as boolean | undefined,
            },
          },
        });
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              agentId: result.agentId,
              skillCount: result.skills.length,
              skillIds: result.skills.map((s: { id: string }) => s.id),
              skillNames: result.skills.map((s: { name: string }) => s.name),
              modelOverride: result.modelOverride,
              analysis: result.analysis,
              enhancedPrompt: result.enhancedPrompt,
            }, null, 2),
          }],
        };
      }

      case 'inject_specific_skills': {
        const result = injectSpecificSkills(
          safeArgs.skillIds as string[],
          safeArgs.agentId as string,
          safeArgs.basePrompt as string
        );
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              agentId: result.agentId,
              skillCount: result.skills.length,
              skillIds: result.skills.map((s: { id: string }) => s.id),
              modelOverride: result.modelOverride,
              enhancedPrompt: result.enhancedPrompt,
            }, null, 2),
          }],
        };
      }

      case 'needs_skill_injection': {
        const needed = needsSkillInjection({
          agentId: safeArgs.agentId as string,
          basePrompt: safeArgs.basePrompt as string,
          context: {
            attachments: safeArgs.attachments as Array<{ type: string; path?: string }> | undefined,
            errors: safeArgs.errors as string[] | undefined,
            flags: {
              tddMode: safeArgs.tddMode as boolean | undefined,
            },
          },
        });
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ needsInjection: needed }),
          }],
        };
      }

      case 'list_skills': {
        const registry = getSkillRegistry();
        const category = safeArgs.category as string | undefined;
        const skills = category
          ? registry.getSkillsByCategory(category)
          : registry.getAllSkills();
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(skills.map((s: { id: string; name: string; version: string; description: string; capabilities: string[]; context: { agents: string[] }; synergies: string[] }) => ({
              id: s.id,
              name: s.name,
              version: s.version,
              description: s.description,
              capabilities: s.capabilities,
              agents: s.context.agents,
              synergies: s.synergies,
            })), null, 2),
          }],
        };
      }

      case 'get_skill': {
        const registry = getSkillRegistry();
        const skill = registry.getSkill(safeArgs.skillId as string);
        if (!skill) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ error: `Skill not found: ${safeArgs.skillId}` }),
            }],
            isError: true,
          };
        }
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(skill, null, 2),
          }],
        };
      }

      case 'get_auto_selected_skills': {
        const registry = getSkillRegistry();
        const skillIds = registry.getAutoSelectedSkills(
          safeArgs.event as string,
          safeArgs.conditions as string[] | undefined
        );
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ event: safeArgs.event, skillIds }),
          }],
        };
      }

      // === ThinkTank Context (EdSpark Integration) ===
      case 'get_thinktank_context': {
        const projectPath = safeArgs.projectPath as string | undefined;
        const context = generatePlannerContext(projectPath);
        if (!context) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                error: 'No ThinkTank structure found',
                hint: 'This project does not have .edspark/thinktank/ directory',
              }),
            }],
            isError: true,
          };
        }
        return {
          content: [{
            type: 'text' as const,
            text: context,
          }],
        };
      }

      case 'get_department_context': {
        const department = safeArgs.department as string;
        const projectPath = safeArgs.projectPath as string | undefined;
        const context = generateDepartmentContext(department, projectPath);
        if (!context) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                error: `Department not found: ${department}`,
                hint: 'Check .edspark/thinktank/contexts/ for available departments',
              }),
            }],
            isError: true,
          };
        }
        return {
          content: [{
            type: 'text' as const,
            text: context,
          }],
        };
      }

      case 'has_thinktank': {
        const projectPath = safeArgs.projectPath as string | undefined;
        const hasStructure = hasThinkTankStructure(projectPath);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ hasThinkTank: hasStructure }),
          }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ error: errorMessage }) }],
      isError: true,
    };
  }
});

// ============================================================================
// Server Start
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Ultra Planner MCP Server started');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
