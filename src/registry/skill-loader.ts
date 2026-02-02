/**
 * Skill Loader - Multi-source skill loading with load order
 *
 * Loads skills from global registry first (lower loadOrder), then local
 * project (higher loadOrder). Local skills override global skills with same ID.
 *
 * v2.0: 카테고리 하위 폴더 + SKILL.md frontmatter 지원
 *   - flat YAML: skills/build-fix.yaml (기존)
 *   - 카테고리 YAML: skills/quality/build-fix.yaml (글로벌 레지스트리)
 *   - 스킬 폴더 + skill.yaml: skills/design-ui/design-audit/skill.yaml (하이브리드)
 *   - 스킬 폴더 + SKILL.md: skills/design-ui/design-audit/SKILL.md (fallback)
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, basename } from 'path';
import matter from 'gray-matter';
import type { SkillDefinition } from '../skills/skill-registry.js';
import type { RegistrySource, RegistryConfig } from './types.js';
import {
  resolveRegistryPath,
  getDefaultRegistryPath,
  getSkillsPath,
} from './paths.js';

/**
 * Simple YAML parser using gray-matter's engine
 */
function parseYaml(content: string): unknown {
  const result = matter(`---\n${content}\n---`);
  return result.data;
}

/**
 * Get skill source directories with load ordering
 *
 * Sources are ordered by loadOrder (ascending - lower numbers loaded first):
 * - Global registry (loadOrder 1): ~/registry/skills/ - loaded first, can be overridden
 * - Local project (loadOrder 2): .ultraplan/skills/ - loaded last, overrides global
 *
 * @param config - Registry configuration
 * @returns Array of registry sources, ordered by loadOrder (ascending)
 */
export function getSkillSources(config?: RegistryConfig): RegistrySource[] {
  const sources: RegistrySource[] = [];

  // Global registry - loaded first (loadOrder 1), can be overridden
  const globalRegistryPath = config?.registry
    ? resolveRegistryPath(config.registry)
    : getDefaultRegistryPath();

  const globalSkillsPath = getSkillsPath(globalRegistryPath);

  if (existsSync(globalRegistryPath)) {
    if (existsSync(globalSkillsPath)) {
      sources.push({
        path: globalSkillsPath,
        loadOrder: 1, // Loaded first, can be overridden
        isGlobal: true,
      });
    } else {
      // Registry exists but skills/ subdirectory doesn't
      console.warn(
        `Registry directory exists but skills/ subdirectory not found: ${globalSkillsPath}`
      );
    }
  }

  // Local project skills - loaded last (loadOrder 2), overrides global
  const localPath = join(process.cwd(), '.ultraplan/skills');
  if (existsSync(localPath)) {
    sources.push({
      path: localPath,
      loadOrder: 2, // Loaded last, overrides earlier
      isGlobal: false,
    });
  }

  // Sort by loadOrder ascending (lower number = loaded first)
  return sources.sort((a, b) => a.loadOrder - b.loadOrder);
}

/**
 * Check if a skill ID matches selection patterns
 *
 * Supports glob-like patterns:
 * - "thinktank/*" matches "thinktank/risk-analysis", "thinktank/market-research"
 * - "development/build-fix" matches exactly
 * - "*" matches everything
 *
 * @param skillId - Skill ID to check (e.g., "thinktank/risk-analysis")
 * @param patterns - Array of selection patterns
 * @returns Whether the skill matches any pattern
 */
export function matchesSelectionPattern(
  skillId: string,
  patterns: string[] | undefined
): boolean {
  // If no patterns specified, include all skills
  if (!patterns || patterns.length === 0) {
    return true;
  }

  return patterns.some((pattern) => {
    // Wildcard pattern
    if (pattern === '*') {
      return true;
    }

    // Category wildcard: "thinktank/*"
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      return skillId.startsWith(prefix + '/') || skillId === prefix;
    }

    // Exact match or suffix match
    return skillId === pattern || skillId.endsWith('/' + pattern);
  });
}

/**
 * Load skill from YAML file
 *
 * @param filePath - Path to skill YAML file
 * @returns Parsed skill definition or null on error
 */
function loadSkillFile(filePath: string): SkillDefinition | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return parseYaml(content) as SkillDefinition;
  } catch (error) {
    console.warn(`Failed to load skill: ${filePath}`, error);
    return null;
  }
}

/**
 * Load skill from SKILL.md frontmatter (fallback)
 *
 * SKILL.md의 YAML frontmatter에서 기본 메타데이터 추출.
 * skill.yaml이 없는 폴더에서 최소한의 매칭 정보를 제공.
 *
 * @param skillMdPath - Path to SKILL.md file
 * @param skillId - Skill ID (folder name)
 * @returns Partial skill definition or null
 */
function loadSkillFromMarkdown(skillMdPath: string, skillId: string): SkillDefinition | null {
  try {
    const content = readFileSync(skillMdPath, 'utf-8');
    const { data: frontmatter, content: body } = matter(content);

    if (!frontmatter || (!frontmatter.name && !frontmatter.id)) {
      return null;
    }

    // frontmatter에서 triggers 파싱 (description에 "Triggers:" 패턴이 있으면 추출)
    const keywords: { high?: string[]; medium?: string[]; low?: string[] } = {};
    if (frontmatter.triggers) {
      // skill.yaml 스타일 triggers가 frontmatter에 있으면 그대로 사용
      return parseYaml(
        `---\n${readFileSync(skillMdPath, 'utf-8').split('---')[1]}\n---`
      ) as SkillDefinition;
    }

    // description에서 키워드 추출
    const desc = (frontmatter.description || '') as string;
    const triggerMatch = desc.match(/Triggers?:\s*(.+)/i);
    if (triggerMatch) {
      const triggerWords = triggerMatch[1]
        .split(/[,"""]/g)
        .map((w: string) => w.trim().replace(/^["']|["']$/g, ''))
        .filter((w: string) => w.length > 2);
      if (triggerWords.length > 0) {
        keywords.high = triggerWords.slice(0, 5);
        keywords.medium = triggerWords.slice(5, 10);
      }
    }

    // 본문 첫 500자를 prompt_template으로 사용
    const promptTemplate = body.trim().slice(0, 2000);

    // agents 추출: frontmatter.agents 또는 본문에서 agent 이름 추출
    const agents: string[] = [];
    if (frontmatter.agents) {
      agents.push(...(Array.isArray(frontmatter.agents) ? frontmatter.agents : [frontmatter.agents]));
    }

    return {
      id: (frontmatter.id || frontmatter.name || skillId) as string,
      name: (frontmatter.name || skillId) as string,
      version: (frontmatter.version || '1.0') as string,
      description: desc,
      use_cases: (frontmatter.use_cases || []) as string[],
      triggers: {
        keywords: Object.keys(keywords).length > 0 ? keywords : undefined,
        input_types: frontmatter.input_types as string[] | undefined,
        error_patterns: frontmatter.error_patterns as string[] | undefined,
        auto_trigger: frontmatter.auto_trigger as string[] | undefined,
        sensitive_files: frontmatter.sensitive_files as string[] | undefined,
      },
      capabilities: (frontmatter.capabilities || []) as string[],
      outputs: (frontmatter.outputs || []) as Array<{ type: string; format: string }>,
      prompt_template: promptTemplate,
      context: {
        agents: agents,
        phases: frontmatter.phases as string[] | undefined,
        trigger_events: frontmatter.trigger_events as string[] | undefined,
      },
      model_routing: frontmatter.model_routing as SkillDefinition['model_routing'],
      synergies: (frontmatter.synergies || []) as string[],
    };
  } catch (error) {
    console.warn(`Failed to load SKILL.md: ${skillMdPath}`, error);
    return null;
  }
}

/**
 * Load skills from a skill folder (폴더 안에 skill.yaml 또는 SKILL.md)
 *
 * 우선순위:
 * 1. skill.yaml (완전한 정의 — 머신용)
 * 2. SKILL.md frontmatter (fallback — 기본 메타만)
 *
 * @param folderPath - Skill folder path
 * @param skillId - Skill ID (folder name)
 * @returns Loaded skill or null
 */
function loadSkillFromFolder(folderPath: string, skillId: string): SkillDefinition | null {
  // 1순위: skill.yaml (하이브리드 — 머신용 매칭 메타데이터)
  const yamlPath = join(folderPath, 'skill.yaml');
  if (existsSync(yamlPath)) {
    const skill = loadSkillFile(yamlPath);
    if (skill) {
      // skill.yaml에 id가 없으면 폴더명 사용
      if (!skill.id) skill.id = skillId;
      return skill;
    }
  }

  // 2순위: SKILL.md frontmatter (fallback)
  const mdPath = join(folderPath, 'SKILL.md');
  if (existsSync(mdPath)) {
    return loadSkillFromMarkdown(mdPath, skillId);
  }

  return null;
}

/**
 * Load skills from a single directory (v2: 카테고리 + 폴더 지원)
 *
 * 디렉토리 구조를 자동 감지:
 *
 * Flat (로컬 프로젝트):
 *   skills/build-fix.yaml → 바로 읽음
 *
 * Categorized (글로벌 레지스트리):
 *   skills/quality/build-fix.yaml → 카테고리 안 YAML
 *   skills/quality/code-review/SKILL.md → 카테고리 안 폴더
 *   skills/design-ui/design-audit/skill.yaml → 카테고리 안 폴더 (하이브리드)
 *
 * @param dirPath - Directory containing skills
 * @param selectionPatterns - Patterns to filter skills
 * @returns Map of skill ID to skill definition
 */
function loadSkillsFromDirectory(
  dirPath: string,
  selectionPatterns?: string[]
): Map<string, SkillDefinition> {
  const skills = new Map<string, SkillDefinition>();

  if (!existsSync(dirPath)) {
    return skills;
  }

  try {
    const entries = readdirSync(dirPath);

    for (const entry of entries) {
      if (entry.startsWith('_') || entry.startsWith('.')) continue;

      const entryPath = join(dirPath, entry);
      const stat = statSync(entryPath);

      if (!stat.isDirectory()) {
        // 파일: .yaml이면 바로 로드 (flat 구조)
        if (entry.endsWith('.yaml')) {
          const skill = loadSkillFile(entryPath);
          if (skill && matchesSelectionPattern(skill.id, selectionPatterns)) {
            skills.set(skill.id, skill);
          }
        }
        continue;
      }

      // 디렉토리: 카테고리인지 스킬 폴더인지 판별
      // 스킬 폴더 = skill.yaml 또는 SKILL.md가 있음
      // 카테고리 폴더 = 그 외 (하위에 .yaml 또는 스킬 폴더가 있음)
      const isSkillFolder =
        existsSync(join(entryPath, 'skill.yaml')) ||
        existsSync(join(entryPath, 'SKILL.md'));

      if (isSkillFolder) {
        // 스킬 폴더 → 직접 로드
        const skill = loadSkillFromFolder(entryPath, entry);
        if (skill && matchesSelectionPattern(skill.id, selectionPatterns)) {
          skills.set(skill.id, skill);
        }
      } else {
        // 카테고리 폴더 → 재귀 탐색 (1단계만)
        const categoryEntries = readdirSync(entryPath);
        for (const catEntry of categoryEntries) {
          if (catEntry.startsWith('_') || catEntry.startsWith('.')) continue;

          const catEntryPath = join(entryPath, catEntry);
          const catStat = statSync(catEntryPath);

          if (catStat.isDirectory()) {
            // 카테고리 내 스킬 폴더
            const skill = loadSkillFromFolder(catEntryPath, catEntry);
            if (skill && matchesSelectionPattern(skill.id, selectionPatterns)) {
              skills.set(skill.id, skill);
            }
          } else if (catEntry.endsWith('.yaml') && !catEntry.startsWith('_')) {
            // 카테고리 내 YAML 파일
            const skill = loadSkillFile(catEntryPath);
            if (skill && matchesSelectionPattern(skill.id, selectionPatterns)) {
              skills.set(skill.id, skill);
            }
          }
        }
      }
    }

    if (skills.size === 0) {
      console.warn(
        `Skills directory exists but no skills found: ${dirPath}`
      );
    } else {
      console.log(`Loaded ${skills.size} skills from ${dirPath}`);
    }
  } catch (error) {
    console.warn(`Failed to read skills directory: ${dirPath}`, error);
  }

  return skills;
}

/**
 * Load skills from multiple sources with load order-based merging
 *
 * Skills are loaded from sources in loadOrder (ascending).
 * Later sources (higher loadOrder) override earlier sources.
 *
 * @param sources - Registry sources ordered by loadOrder
 * @param selectionPatterns - Patterns to filter skills
 * @returns Merged map of skill ID to skill definition
 */
export function loadSkillsFromSources(
  sources: RegistrySource[],
  selectionPatterns?: string[]
): Map<string, SkillDefinition> {
  const mergedSkills = new Map<string, SkillDefinition>();

  // Load in loadOrder (ascending): global first (1), then local (2)
  // This means local skills will override global skills with same ID
  for (const source of sources) {
    const directorySkills = loadSkillsFromDirectory(
      source.path,
      selectionPatterns
    );

    // Merge - later entries override earlier (last write wins)
    for (const [id, skill] of directorySkills) {
      mergedSkills.set(id, skill);
    }
  }

  return mergedSkills;
}

/**
 * Load skill index from directory
 *
 * Also checks parent directory for index (레지스트리 루트의 _index.yaml)
 *
 * @param dirPath - Directory containing _index.yaml
 * @returns Parsed index or null
 */
export function loadSkillIndex(dirPath: string): unknown | null {
  const indexPath = join(dirPath, '_index.yaml');

  if (existsSync(indexPath)) {
    try {
      const content = readFileSync(indexPath, 'utf-8');
      return parseYaml(content);
    } catch (error) {
      console.warn(`Failed to load skill index: ${indexPath}`, error);
    }
  }

  return null;
}
