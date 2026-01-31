/**
 * Ultra Planner 스킬 레지스트리
 *
 * YAML 기반 스킬 정의서 로드 + 오케스트레이터 매칭
 * 에이전트 호출 전 자동으로 관련 스킬을 프롬프트에 주입
 */

import matter from 'gray-matter';
import * as fs from 'fs';
import * as path from 'path';

// Simple YAML parser using gray-matter's engine
function parseYaml(content: string): unknown {
  // gray-matter can parse YAML via its internal engine
  // We wrap content in frontmatter format to leverage it
  const result = matter(`---\n${content}\n---`);
  return result.data;
}

// 스킬 정의 타입
export interface SkillDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  use_cases: string[];
  triggers: {
    input_types?: string[];
    error_patterns?: string[];
    auto_trigger?: string[];
    sensitive_files?: string[];
    keywords?: {
      high?: string[];
      medium?: string[];
      low?: string[];
    };
  };
  capabilities: string[];
  outputs: Array<{
    type: string;
    format: string;
  }>;
  prompt_template: string;
  context: {
    agents: string[];
    phases?: string[];
    trigger_events?: string[];
  };
  model_routing?: {
    default: string;
    if_simple?: string;
    if_complex?: string;
    if_quick_scan?: string;
  };
  synergies: string[];
}

// 스킬 매칭 결과
export interface SkillMatch {
  skill: SkillDefinition;
  score: number;
  matchReasons: string[];
}

// 스킬 인덱스 타입
interface SkillIndex {
  version: string;
  categories: Record<
    string,
    {
      name: string;
      description: string;
      skills: string[];
    }
  >;
  relationships: Record<
    string,
    {
      leads_to?: string[];
      combines_with?: string[];
      requires?: string[];
    }
  >;
  auto_selection: Record<string, Record<string, string[]>>;
  agent_defaults: Record<
    string,
    {
      auto_inject: string[];
      available: string[];
    }
  >;
}

// 스킬 인젝션 결과
export interface SkillInjection {
  agentId: string;
  skills: SkillDefinition[];
  enhancedPrompt: string;
  modelOverride?: string;
}

/**
 * 스킬 레지스트리 클래스
 */
export class SkillRegistry {
  private skills: Map<string, SkillDefinition> = new Map();
  private index: SkillIndex | null = null;
  private skillsDir: string;

  constructor(skillsDir?: string) {
    this.skillsDir =
      skillsDir ||
      path.join(process.cwd(), '.ultraplan/skills');
    this.loadSkills();
  }

  /**
   * 모든 스킬 YAML 파일 로드
   */
  private loadSkills(): void {
    if (!fs.existsSync(this.skillsDir)) {
      console.warn(`Skills directory not found: ${this.skillsDir}`);
      return;
    }

    // 인덱스 로드
    const indexPath = path.join(this.skillsDir, '_index.yaml');
    if (fs.existsSync(indexPath)) {
      const indexContent = fs.readFileSync(indexPath, 'utf-8');
      this.index = parseYaml(indexContent) as SkillIndex;
    }

    // 스킬 파일들 로드
    const files = fs.readdirSync(this.skillsDir);
    for (const file of files) {
      if (file.endsWith('.yaml') && !file.startsWith('_')) {
        const filePath = path.join(this.skillsDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const skill = parseYaml(content) as SkillDefinition;
          this.skills.set(skill.id, skill);
        } catch (error) {
          console.warn(`Failed to load skill: ${file}`, error);
        }
      }
    }
  }

  /**
   * 컨텍스트 기반 스킬 매칭
   */
  matchSkills(
    context: {
      request?: string;
      agentId?: string;
      phase?: string;
      triggerEvent?: string;
      inputTypes?: string[];
      errorPatterns?: string[];
    },
    options: {
      maxResults?: number;
    } = {}
  ): SkillMatch[] {
    const matches: SkillMatch[] = [];
    const requestLower = context.request?.toLowerCase() || '';

    for (const skill of this.skills.values()) {
      const matchReasons: string[] = [];
      let score = 0;

      // 1. 트리거 이벤트 매칭 (가장 중요)
      if (
        context.triggerEvent &&
        skill.context.trigger_events?.includes(context.triggerEvent)
      ) {
        score += 60;
        matchReasons.push(`트리거 이벤트: ${context.triggerEvent}`);
      }

      // 2. 에러 패턴 매칭
      if (context.errorPatterns?.length && skill.triggers.error_patterns) {
        for (const error of context.errorPatterns) {
          for (const pattern of skill.triggers.error_patterns) {
            if (new RegExp(pattern, 'i').test(error)) {
              score += 50;
              matchReasons.push(`에러 패턴 매칭: ${pattern}`);
              break;
            }
          }
        }
      }

      // 3. 입력 타입 매칭
      if (context.inputTypes?.length) {
        const inputMatch = context.inputTypes.some((type) =>
          skill.triggers.input_types?.includes(type)
        );
        if (inputMatch) {
          score += 40;
          matchReasons.push(`입력 타입: ${context.inputTypes.join(', ')}`);
        }
      }

      // 4. 에이전트 컨텍스트 매칭
      if (context.agentId && skill.context.agents.includes(context.agentId)) {
        score += 20;
        matchReasons.push(`에이전트 매칭: ${context.agentId}`);
      }

      // 5. Phase 매칭
      if (context.phase && skill.context.phases?.includes(context.phase)) {
        score += 10;
        matchReasons.push(`Phase 매칭: ${context.phase}`);
      }

      // 6. 키워드 매칭
      const keywords = skill.triggers.keywords;
      if (keywords && requestLower) {
        for (const kw of keywords.high || []) {
          if (requestLower.includes(kw.toLowerCase())) {
            score += 30;
            matchReasons.push(`고신뢰 키워드: "${kw}"`);
          }
        }
        for (const kw of keywords.medium || []) {
          if (requestLower.includes(kw.toLowerCase())) {
            score += 15;
            matchReasons.push(`중신뢰 키워드: "${kw}"`);
          }
        }
        for (const kw of keywords.low || []) {
          if (requestLower.includes(kw.toLowerCase())) {
            score += 5;
            matchReasons.push(`저신뢰 키워드: "${kw}"`);
          }
        }
      }

      // 점수가 있으면 결과에 추가
      if (score > 0) {
        matches.push({ skill, score, matchReasons });
      }
    }

    // 점수순 정렬
    matches.sort((a, b) => b.score - a.score);

    // 시너지 스킬 추가
    const topMatches = matches.slice(0, options.maxResults || 5);
    this.addSynergySkills(topMatches);

    return topMatches.slice(0, options.maxResults || 5);
  }

  /**
   * 시너지 스킬 추가
   */
  private addSynergySkills(matches: SkillMatch[]): void {
    const existingIds = new Set(matches.map((m) => m.skill.id));

    for (const match of [...matches]) {
      for (const synergyId of match.skill.synergies || []) {
        if (!existingIds.has(synergyId)) {
          const synergySkill = this.skills.get(synergyId);
          if (synergySkill) {
            matches.push({
              skill: synergySkill,
              score: 15,
              matchReasons: [`시너지 스킬 (${match.skill.name}에서 추천)`],
            });
            existingIds.add(synergyId);
          }
        }
      }
    }
  }

  /**
   * 자동 선택 규칙 적용
   */
  getAutoSelectedSkills(event: string, conditions: string[] = []): string[] {
    if (!this.index?.auto_selection) return [];

    const eventRules = this.index.auto_selection[event];
    if (!eventRules) return [];

    const selectedSkills: string[] = [];

    // always 스킬 추가
    if (eventRules.always) {
      selectedSkills.push(...eventRules.always);
    }

    // 조건부 스킬 추가
    for (const condition of conditions) {
      const conditionKey = `if_${condition}`;
      if (eventRules[conditionKey]) {
        selectedSkills.push(...eventRules[conditionKey]);
      }
      const addKey = `add_${condition}`;
      if (eventRules[addKey]) {
        selectedSkills.push(...eventRules[addKey]);
      }
    }

    return [...new Set(selectedSkills)];
  }

  /**
   * 에이전트에 스킬 인젝션
   */
  injectSkillsForAgent(
    agentId: string,
    matchedSkills: SkillMatch[],
    basePrompt: string
  ): SkillInjection {
    // 해당 에이전트에 적용 가능한 스킬 필터링
    const applicableSkills = matchedSkills
      .filter((m) => m.skill.context.agents.includes(agentId))
      .map((m) => m.skill);

    if (applicableSkills.length === 0) {
      return {
        agentId,
        skills: [],
        enhancedPrompt: basePrompt,
      };
    }

    // 프롬프트 생성
    const skillSections = applicableSkills
      .map((s) => s.prompt_template)
      .join('\n\n---\n\n');

    const enhancedPrompt = `${basePrompt}

---
# 인젝션된 스킬 (${applicableSkills.length}개)

${skillSections}`;

    // 모델 오버라이드 결정 (가장 높은 모델 사용)
    const modelPriority = { opus: 3, sonnet: 2, haiku: 1 };
    let modelOverride: string | undefined;
    let maxPriority = 0;

    for (const skill of applicableSkills) {
      const model = skill.model_routing?.default;
      if (model && modelPriority[model as keyof typeof modelPriority] > maxPriority) {
        maxPriority = modelPriority[model as keyof typeof modelPriority];
        modelOverride = model;
      }
    }

    return {
      agentId,
      skills: applicableSkills,
      enhancedPrompt,
      modelOverride,
    };
  }

  /**
   * 스킬 ID로 조회
   */
  getSkill(id: string): SkillDefinition | undefined {
    return this.skills.get(id);
  }

  /**
   * 모든 스킬 목록
   */
  getAllSkills(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /**
   * 에이전트 기본 스킬 조회
   */
  getAgentDefaultSkills(agentId: string): {
    autoInject: string[];
    available: string[];
  } {
    const defaults = this.index?.agent_defaults?.[agentId];
    return {
      autoInject: defaults?.auto_inject || [],
      available: defaults?.available || [],
    };
  }

  /**
   * 카테고리별 스킬 조회
   */
  getSkillsByCategory(category: string): SkillDefinition[] {
    if (!this.index?.categories[category]) {
      return [];
    }
    return this.index.categories[category].skills
      .map((id) => this.skills.get(id))
      .filter((s): s is SkillDefinition => s !== undefined);
  }
}

// 싱글톤 인스턴스
let registryInstance: SkillRegistry | null = null;

export function getSkillRegistry(skillsDir?: string): SkillRegistry {
  if (!registryInstance) {
    registryInstance = new SkillRegistry(skillsDir);
  }
  return registryInstance;
}

// 레지스트리 리셋 (테스트용)
export function resetSkillRegistry(): void {
  registryInstance = null;
}
