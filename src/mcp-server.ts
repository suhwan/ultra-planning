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
import { generateTaskCreations } from './tasks/dependencies.js';
import { calculateProgress, formatProgress } from './tasks/progress.js';
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
