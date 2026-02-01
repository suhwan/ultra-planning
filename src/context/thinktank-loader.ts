/**
 * ThinkTank Context Loader
 *
 * Loads EdSpark ThinkTank structure (.edspark/) for GSD Planner context injection.
 * Provides department and agent information so planners can make informed decisions.
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';

// ============================================================================
// Types
// ============================================================================

/** ThinkTank agent template */
export interface AgentTemplate {
  id: string;
  name: string;
  name_en: string;
  wave: number;
  role: string;
  personality: {
    style: string;
    approach: string;
    strength: string;
  };
  responsibilities: string[];
  model: {
    recommended: string;
    reason: string;
  };
}

/** Department context */
export interface DepartmentContext {
  department: string;
  waves: {
    wave_1: { name: string; agents: string[] };
    wave_2: { name: string; agents: string[] };
    wave_3: { name: string; agents: string[] };
  };
  agent_overrides: Record<string, {
    focus?: string[];
    design_focus?: string[];
    frameworks?: string[];
  }>;
}

/** Full ThinkTank context */
export interface ThinkTankContext {
  departments: string[];
  departmentContexts: Record<string, DepartmentContext>;
  agentTemplates: Record<string, AgentTemplate>;
  waveStructure: {
    wave_1: { name: string; agents: string[] };
    wave_2: { name: string; agents: string[] };
    wave_3: { name: string; agents: string[] };
  };
}

// ============================================================================
// Constants
// ============================================================================

const EDSPARK_DIR = '.edspark';
const THINKTANK_DIR = 'thinktank';
const TEMPLATES_DIR = 'templates';
const CONTEXTS_DIR = 'contexts';

// ============================================================================
// Loader Functions
// ============================================================================

/**
 * Check if project has ThinkTank structure
 */
export function hasThinkTankStructure(projectPath: string = process.cwd()): boolean {
  const edsparkPath = join(projectPath, EDSPARK_DIR, THINKTANK_DIR);
  return existsSync(edsparkPath);
}

/**
 * Load agent templates from .edspark/thinktank/templates/
 */
export function loadAgentTemplates(projectPath: string = process.cwd()): Record<string, AgentTemplate> {
  const templatesPath = join(projectPath, EDSPARK_DIR, THINKTANK_DIR, TEMPLATES_DIR);

  if (!existsSync(templatesPath)) {
    return {};
  }

  const templates: Record<string, AgentTemplate> = {};
  const files = readdirSync(templatesPath).filter(f => f.endsWith('.yaml'));

  for (const file of files) {
    try {
      const content = readFileSync(join(templatesPath, file), 'utf-8');
      const parsed = parseYaml(content);
      if (parsed?.agent?.id) {
        templates[parsed.agent.id] = parsed.agent;
      }
    } catch {
      // Skip invalid files
    }
  }

  return templates;
}

/**
 * Load department contexts from .edspark/thinktank/contexts/
 */
export function loadDepartmentContexts(projectPath: string = process.cwd()): Record<string, DepartmentContext> {
  const contextsPath = join(projectPath, EDSPARK_DIR, THINKTANK_DIR, CONTEXTS_DIR);

  if (!existsSync(contextsPath)) {
    return {};
  }

  const contexts: Record<string, DepartmentContext> = {};
  const departments = readdirSync(contextsPath, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const dept of departments) {
    const agentsFile = join(contextsPath, dept, 'agents.yaml');
    if (existsSync(agentsFile)) {
      try {
        const content = readFileSync(agentsFile, 'utf-8');
        contexts[dept] = parseYaml(content) as DepartmentContext;
      } catch {
        // Skip invalid files
      }
    }
  }

  return contexts;
}

/**
 * Load full ThinkTank context
 */
export function loadThinkTankContext(projectPath: string = process.cwd()): ThinkTankContext | null {
  if (!hasThinkTankStructure(projectPath)) {
    return null;
  }

  const agentTemplates = loadAgentTemplates(projectPath);
  const departmentContexts = loadDepartmentContexts(projectPath);
  const departments = Object.keys(departmentContexts);

  // Default wave structure
  const waveStructure = {
    wave_1: {
      name: '리서치',
      agents: ['data-collector', 'quant-analyst', 'qual-analyst', 'research-synthesizer']
    },
    wave_2: {
      name: '토론',
      agents: ['optimist', 'pessimist', 'realist', 'innovator', 'executor']
    },
    wave_3: {
      name: '결론',
      agents: ['synthesizer', 'report-writer', 'quality-reviewer']
    }
  };

  return {
    departments,
    departmentContexts,
    agentTemplates,
    waveStructure
  };
}

// ============================================================================
// Summary Generators (for Planner injection)
// ============================================================================

/**
 * Generate departments summary for planner
 */
export function generateDepartmentsSummary(context: ThinkTankContext): string {
  const lines: string[] = ['## Available Departments', ''];

  const deptDescriptions: Record<string, string> = {
    strategy: '사업검토, 시장분석, 경쟁분석, 전략수립',
    marketing: '시장조사, 포지셔닝, 브랜딩, 캠페인',
    sales: '고객분석, 영업전략, 파이프라인',
    development: '기술검토, 아키텍처, 구현, 테스트',
    operations: '프로세스, 효율화, 자동화, 품질관리',
    finance: 'ROI분석, 비용분석, 예산, 투자검토',
    design: 'UI/UX, 브랜드 아이덴티티, 마케팅 에셋'
  };

  for (const dept of context.departments) {
    const desc = deptDescriptions[dept] || '(설명 없음)';
    lines.push(`- **${dept}**: ${desc}`);
  }

  return lines.join('\n');
}

/**
 * Generate agents summary for planner
 */
export function generateAgentsSummary(context: ThinkTankContext): string {
  const lines: string[] = ['## ThinkTank Agents (12명)', ''];

  // Wave 1
  lines.push('### Wave 1: 리서치 (병렬)');
  for (const agentId of context.waveStructure.wave_1.agents) {
    const template = context.agentTemplates[agentId];
    if (template) {
      lines.push(`- **${template.name}** (${agentId}): ${template.role.split('\n')[0]}`);
    }
  }
  lines.push('');

  // Wave 2
  lines.push('### Wave 2: 토론 (병렬)');
  for (const agentId of context.waveStructure.wave_2.agents) {
    const template = context.agentTemplates[agentId];
    if (template) {
      lines.push(`- **${template.name}** (${agentId}): ${template.role.split('\n')[0]}`);
    }
  }
  lines.push('');

  // Wave 3
  lines.push('### Wave 3: 결론 (순차)');
  for (const agentId of context.waveStructure.wave_3.agents) {
    const template = context.agentTemplates[agentId];
    if (template) {
      lines.push(`- **${template.name}** (${agentId}): ${template.role.split('\n')[0]}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate execution flow summary
 */
export function generateExecutionFlowSummary(): string {
  return `## Execution Flow

\`\`\`
CEO 요청
    │
    ▼
부서 선택 (strategy/marketing/sales/development/operations/finance/design)
    │
    ▼
Wave 1: 리서치 (4명 병렬) → 30-60분
    │
    ▼
Wave 2: 토론 (5명 병렬) → 60-90분
    │
    ▼
Wave 3: 결론 (3명 순차) → 45-75분
    │
    ▼
CEO 보고
\`\`\``;
}

/**
 * Generate full planner context injection
 */
export function generatePlannerContext(projectPath: string = process.cwd()): string | null {
  const context = loadThinkTankContext(projectPath);

  if (!context) {
    return null;
  }

  const sections = [
    '# EdSpark ThinkTank Context',
    '',
    generateDepartmentsSummary(context),
    '',
    generateAgentsSummary(context),
    '',
    generateExecutionFlowSummary(),
    '',
    '## Planning Guidelines',
    '',
    '1. **부서 선택**: 요청 내용에 맞는 부서 선택 (복수 가능)',
    '2. **Wave 순서 준수**: Wave 1 → 2 → 3 순서로 실행',
    '3. **병렬 실행**: Wave 1, 2는 에이전트 병렬 실행',
    '4. **순차 실행**: Wave 3는 순차 실행 (synthesizer → report-writer → quality-reviewer)',
    '5. **부서별 특화**: 각 부서의 agent_overrides 참고하여 에이전트 행동 조정'
  ];

  return sections.join('\n');
}

/**
 * Generate department-specific context
 */
export function generateDepartmentContext(
  department: string,
  projectPath: string = process.cwd()
): string | null {
  const context = loadThinkTankContext(projectPath);

  if (!context || !context.departmentContexts[department]) {
    return null;
  }

  const deptContext = context.departmentContexts[department];
  const lines: string[] = [
    `# ${department.toUpperCase()} Department Context`,
    '',
    '## Agent Specializations',
    ''
  ];

  for (const [agentId, override] of Object.entries(deptContext.agent_overrides || {})) {
    const template = context.agentTemplates[agentId];
    const agentName = template?.name || agentId;

    lines.push(`### ${agentName} (${agentId})`);

    if (override.focus) {
      lines.push('**Focus:**');
      for (const item of override.focus) {
        lines.push(`- ${item}`);
      }
    }

    if (override.design_focus) {
      lines.push('**Design Focus:**');
      for (const item of override.design_focus) {
        lines.push(`- ${item}`);
      }
    }

    if (override.frameworks) {
      lines.push('**Frameworks:**');
      for (const item of override.frameworks) {
        lines.push(`- ${item}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}
