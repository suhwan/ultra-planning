/**
 * Ultra Planner 스킬 인젝터
 *
 * 오케스트레이터가 에이전트 호출 전에 사용
 * 컨텍스트 분석 → 스킬 매칭 → 프롬프트 인젝션
 */

import {
  getSkillRegistry,
  type SkillMatch,
  type SkillInjection,
} from './skill-registry.js';
import { getRegistryConfig } from '../config/loader.js';

// 컨텍스트 분석 결과
export interface ContextAnalysis {
  hasImage: boolean;
  hasError: boolean;
  errorPatterns: string[];
  inputTypes: string[];
  detectedEvents: string[];
  complexity: 'simple' | 'moderate' | 'complex';
}

// 인젝션 요청
export interface InjectionRequest {
  agentId: string;
  basePrompt: string;
  context: {
    request?: string;
    phase?: string;
    triggerEvent?: string;
    attachments?: Array<{ type: string; path?: string }>;
    errors?: string[];
    flags?: {
      tddMode?: boolean;
      securityReview?: boolean;
      codeReview?: boolean;
    };
  };
}

// 인젝션 결과
export interface InjectionResult extends SkillInjection {
  analysis: ContextAnalysis;
  matchedSkills: SkillMatch[];
}

/**
 * 컨텍스트 분석
 */
export function analyzeContext(request: InjectionRequest): ContextAnalysis {
  const { context } = request;

  // 입력 타입 감지
  const inputTypes: string[] = [];
  if (context.attachments) {
    for (const att of context.attachments) {
      inputTypes.push(att.type);
      if (att.path?.includes('mockup') || att.path?.includes('design')) {
        inputTypes.push('mockup', 'design_file');
      }
      if (att.path?.includes('screenshot')) {
        inputTypes.push('screenshot');
      }
      if (att.path?.includes('diagram')) {
        inputTypes.push('diagram');
      }
    }
  }

  // 에러 패턴 감지
  const errorPatterns: string[] = context.errors || [];
  const hasError = errorPatterns.length > 0;

  // 이벤트 감지
  const detectedEvents: string[] = [];
  if (context.triggerEvent) {
    detectedEvents.push(context.triggerEvent);
  }
  if (context.flags?.tddMode) {
    detectedEvents.push('tdd_mode_enabled');
  }
  if (hasError) {
    detectedEvents.push('build_error');
  }
  if (inputTypes.some((t) => ['image', 'screenshot', 'mockup'].includes(t))) {
    detectedEvents.push('image_input');
  }

  // 복잡도 추정
  let complexity: ContextAnalysis['complexity'] = 'simple';
  if (inputTypes.length > 0 || hasError) {
    complexity = 'moderate';
  }
  if (inputTypes.length > 1 || errorPatterns.length > 2) {
    complexity = 'complex';
  }

  return {
    hasImage: inputTypes.some((t) =>
      ['image', 'screenshot', 'mockup', 'diagram'].includes(t)
    ),
    hasError,
    errorPatterns,
    inputTypes: [...new Set(inputTypes)],
    detectedEvents,
    complexity,
  };
}

/**
 * 스킬 인젝션 수행
 */
export function injectSkills(request: InjectionRequest): InjectionResult {
  const registryConfig = getRegistryConfig();
  const registry = getSkillRegistry(registryConfig);
  const analysis = analyzeContext(request);
  const { context } = request;

  // 1. 자동 선택 규칙에서 스킬 가져오기
  const autoSelectedIds: string[] = [];
  for (const event of analysis.detectedEvents) {
    const conditions: string[] = [];

    // 조건 추가
    if (analysis.hasImage && analysis.inputTypes.includes('mockup')) {
      conditions.push('contains_ui');
    }
    if (context.flags?.codeReview) {
      conditions.push('code_review_enabled');
    }

    const eventSkills = registry.getAutoSelectedSkills(
      `on_${event}`,
      conditions
    );
    autoSelectedIds.push(...eventSkills);
  }

  // 2. 컨텍스트 기반 스킬 매칭
  const matchedSkills = registry.matchSkills({
    request: context.request,
    agentId: request.agentId,
    phase: context.phase,
    triggerEvent: context.triggerEvent,
    inputTypes: analysis.inputTypes,
    errorPatterns: analysis.errorPatterns,
  });

  // 3. 자동 선택된 스킬 추가 (아직 없는 경우)
  const existingIds = new Set(matchedSkills.map((m: SkillMatch) => m.skill.id));
  for (const skillId of autoSelectedIds) {
    if (!existingIds.has(skillId)) {
      const skill = registry.getSkill(skillId);
      if (skill) {
        matchedSkills.push({
          skill,
          score: 40, // 자동 선택 기본 점수
          matchReasons: ['자동 선택 규칙에 의해 추가됨'],
        });
      }
    }
  }

  // 4. 에이전트에 인젝션
  const injection = registry.injectSkillsForAgent(
    request.agentId,
    matchedSkills,
    request.basePrompt
  );

  return {
    ...injection,
    analysis,
    matchedSkills,
  };
}

/**
 * 스킬이 필요한지 빠르게 체크
 */
export function needsSkillInjection(request: InjectionRequest): boolean {
  const analysis = analyzeContext(request);
  return (
    analysis.hasImage ||
    analysis.hasError ||
    analysis.detectedEvents.length > 0 ||
    request.context.flags?.tddMode === true
  );
}

/**
 * 특정 스킬 강제 인젝션
 */
export function injectSpecificSkills(
  skillIds: string[],
  agentId: string,
  basePrompt: string
): SkillInjection {
  const registryConfig = getRegistryConfig();
  const registry = getSkillRegistry(registryConfig);

  const skills = skillIds
    .map((id) => registry.getSkill(id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined);

  const matches: SkillMatch[] = skills.map((skill) => ({
    skill,
    score: 100,
    matchReasons: ['명시적 인젝션'],
  }));

  return registry.injectSkillsForAgent(agentId, matches, basePrompt);
}

// Export types
export type { SkillMatch, SkillInjection };
