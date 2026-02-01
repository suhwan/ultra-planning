# Ultra Planning v4.0 - Complete Architecture & Workflow

> **Context Architect Pattern**: Ultra Planner는 코드를 직접 실행하지 않습니다.
> 컨텍스트를 설계하고, 상태를 관리하며, 실행은 전문 에이전트에게 위임합니다.

---

## 목차

1. [시스템 개요](#1-시스템-개요)
2. [핵심 구성요소](#2-핵심-구성요소)
3. [레지스트리 시스템](#3-레지스트리-시스템)
4. [컨텍스트 시스템](#4-컨텍스트-시스템)
5. [워크플로우: 계획 단계](#5-워크플로우-계획-단계)
6. [워크플로우: 실행 단계](#6-워크플로우-실행-단계)
7. [병렬 처리 시스템](#7-병렬-처리-시스템)
8. [태스크 관리](#8-태스크-관리)
9. [GSD 통합](#9-gsd-통합)
10. [OMC 통합](#10-omc-통합)
11. [스킬 & 페르소나 시스템](#11-스킬--페르소나-시스템)
12. [ThinkTank 통합 (EdSpark)](#12-thinktank-통합-edspark)
13. [MCP 도구 레퍼런스](#13-mcp-도구-레퍼런스)

---

## 1. 시스템 개요

### 1.1 Ultra Planner란?

Ultra Planner는 **문서 기반 워크플로우 오케스트레이터**입니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                      ULTRA PLANNER                               │
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │ Context  │   │  Skills  │   │  Tasks   │   │  State   │     │
│  │ Architect│   │ Registry │   │  Sync    │   │ Manager  │     │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘     │
│       │              │              │              │            │
│       └──────────────┴──────────────┴──────────────┘            │
│                              │                                   │
│                      ┌───────┴───────┐                          │
│                      │   MCP Server   │                          │
│                      │   (70+ tools)  │                          │
│                      └───────┬───────┘                          │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │    Claude Code       │
                    │  (Task Tool 호출)    │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
   ┌────┴────┐           ┌────┴────┐           ┌────┴────┐
   │ Executor │           │Architect│           │ Planner │
   │  Agent   │           │  Agent  │           │  Agent  │
   └──────────┘           └──────────┘           └──────────┘
```

### 1.2 핵심 원칙

| 원칙 | 설명 |
|------|------|
| **Context Architect** | 직접 실행하지 않고 컨텍스트를 설계 |
| **Document-Driven** | PROJECT.md, ROADMAP.md, PLAN.md가 진실의 원천 |
| **Wave-Based Parallelism** | 같은 Wave의 태스크는 파일 충돌 없이 병렬 실행 |
| **Verification Loop** | Executor 작업 후 Architect가 독립적으로 검증 |
| **Skill Injection** | 컨텍스트에 따라 에이전트 프롬프트에 스킬 자동 주입 |

### 1.3 레이어 구조

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 7: Commands (CLI Interface)                           │
│   /ultraplan:new-project, /ultraplan:plan-phase, etc.       │
├─────────────────────────────────────────────────────────────┤
│ Layer 6: MCP Server (Tool Exposure)                         │
│   70+ tools via Model Context Protocol                      │
├─────────────────────────────────────────────────────────────┤
│ Layer 5: Orchestration                                      │
│   Delegation, Ralplan, Swarm, Pipeline, Deviations          │
├─────────────────────────────────────────────────────────────┤
│ Layer 4: Skills                                             │
│   Skill Registry, Context Matching, Prompt Injection        │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Context                                            │
│   Collection, Injection, Compaction, ThinkTank              │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Sync                                               │
│   Plan Parsing, Task Mapping, Dependency Graph              │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: State                                              │
│   Session Management, Mode Registry, Events                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 핵심 구성요소

### 2.1 디렉토리 구조

```
ultra-planning/
├── src/
│   ├── mcp-server.ts          # MCP 서버 (모든 도구 노출)
│   ├── context/               # 컨텍스트 시스템
│   │   ├── collector.ts       # PROJECT.md, ROADMAP.md 수집
│   │   ├── injector.ts        # 에이전트 프롬프트에 주입
│   │   ├── compactor.ts       # 컨텍스트 압축 (fresh-start)
│   │   ├── thinktank-loader.ts # EdSpark ThinkTank 로더
│   │   └── estimator.ts       # 토큰 추정
│   ├── registry/              # 레지스트리 시스템
│   │   ├── skill-loader.ts    # 스킬 로딩
│   │   ├── agent-loader.ts    # 에이전트 로딩
│   │   └── metadata.ts        # registry.json 쿼리
│   ├── skills/                # 스킬 시스템
│   │   ├── skill-registry.ts  # 스킬 레지스트리
│   │   └── skill-injector.ts  # 스킬 매칭 및 주입
│   ├── sync/                  # 동기화 시스템
│   │   ├── plan-parser.ts     # PLAN.md 파싱
│   │   ├── dependency-map.ts  # Wave 기반 의존성
│   │   └── task-creation.ts   # TaskCreate 생성
│   ├── orchestration/         # 오케스트레이션
│   │   ├── delegation/        # 태스크 라우팅
│   │   ├── ralplan/           # 계획 합의 루프
│   │   ├── swarm/             # N-에이전트 협업
│   │   └── pipeline/          # 순차 에이전트 체인
│   ├── notepad/               # 학습 기록 시스템
│   │   ├── manager.ts         # 노트패드 관리
│   │   └── injector.ts        # 지혜 주입
│   └── state/                 # 상태 관리
│       ├── session/           # 세션 관리
│       └── mode-registry.ts   # 실행 모드 추적
├── .claude/
│   ├── commands/              # 로컬 커맨드 (스킬)
│   ├── agents/                # 로컬 에이전트
│   └── skills/                # 로컬 스킬 정의
└── docs/                      # 문서
```

### 2.2 핵심 파일들

| 파일 | 역할 |
|------|------|
| `src/mcp-server.ts` | 70+ MCP 도구 노출, Claude Code 인터페이스 |
| `src/context/collector.ts` | PROJECT.md, ROADMAP.md, PLAN.md 수집 |
| `src/sync/plan-parser.ts` | PLAN.md → TaskMapping[] 변환 |
| `src/skills/skill-registry.ts` | 스킬 매칭 및 프롬프트 주입 |
| `src/orchestration/delegation/manager.ts` | 태스크 복잡도 분류 및 모델 라우팅 |

---

## 3. 레지스트리 시스템

### 3.1 글로벌 레지스트리

```
~/.claude/registry/              # Git 저장소로 관리
├── registry.json                # 메타데이터 매니페스트
├── README.md                    # 사용법
├── skills/                      # 스킬 정의
│   └── ultraplan/               # Ultra Planner 스킬들
│       ├── execute.md
│       ├── plan-phase.md
│       ├── new-project.md
│       └── ...
└── agents/                      # 에이전트 정의
    └── ultraplan/               # Ultra Planner 에이전트들
        ├── executor.md
        ├── architect.md
        ├── planner.md
        └── ...
```

### 3.2 로컬 오버라이드

```
project/.claude/                 # 프로젝트별 오버라이드
├── commands/                    # 스킬/커맨드 (로컬)
├── agents/                      # 에이전트 (로컬)
└── skills/                      # 스킬 정의 (로컬)
```

### 3.3 로딩 순서 및 머지

```
1. Global Registry (~/.claude/registry/)    loadOrder: 1
2. Local Project (.claude/)                 loadOrder: 2 (오버라이드)

머지 전략: Last-Wins
- 같은 ID의 스킬/에이전트 → 로컬이 글로벌 대체
- 인덱스 카테고리 → 로컬이 글로벌 카테고리 대체
```

### 3.4 registry.json 구조

```json
{
  "name": "claude-registry",
  "version": "1.0.0",
  "description": "Global skills and agents registry for Claude Code",
  "skills": {
    "ultraplan": {
      "version": "4.0.0",
      "description": "Ultra Planning workflow skills",
      "items": {
        "execute": {
          "file": "skills/ultraplan/execute.md",
          "description": "Execute tasks from PLAN.md with Router Protocol",
          "tags": ["execution", "verification"],
          "requires": ["plan-phase"]
        }
      }
    }
  },
  "agents": {
    "ultraplan": {
      "version": "4.0.0",
      "description": "Ultra Planning specialized agents",
      "items": {
        "executor": {
          "file": "agents/ultraplan/executor.md",
          "description": "Single-task executor with fresh 200k context",
          "model": "opus",
          "tools": ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
          "tags": ["execution", "implementation"]
        }
      }
    }
  }
}
```

### 3.5 심볼릭 링크

Claude Code가 자동 발견할 수 있도록 심볼릭 링크 생성:

```bash
~/.claude/agents -> ~/.claude/registry/agents
~/.claude/commands -> ~/.claude/registry/skills
```

---

## 4. 컨텍스트 시스템

### 4.1 컨텍스트 수집 (Context Collection)

```
                    collect_project_context()
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    PROJECT.md          ROADMAP.md           STATE.md
    (요구사항)           (페이즈)            (진행상태)
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                             ▼
                    ProjectContextArtifacts
                    {
                      project: string,
                      roadmap: string,
                      state: string,
                      requirements: string[]
                    }
```

### 4.2 컨텍스트 주입 (Context Injection)

```typescript
// 에이전트 프롬프트에 컨텍스트 주입
function injectContext(prompt: string, artifacts: ProjectContextArtifacts): string {
  return `
# Project Context
${artifacts.project}

# Current Phase
${artifacts.roadmap}

# Progress
${artifacts.state}

---
${prompt}
`;
}
```

### 4.3 컨텍스트 압축 (Fresh-Start)

컨텍스트가 80% 임계값에 도달하면:

```
┌─────────────────────────────────────────────────────────────┐
│                    CONTEXT COMPACTION                        │
│                                                              │
│  Original Context (180k tokens)                              │
│       │                                                      │
│       ▼                                                      │
│  extractCoreInfo()                                           │
│  ├── Current goal                                            │
│  ├── Active task ID                                          │
│  ├── Recent learnings (last 5)                               │
│  ├── Critical decisions                                      │
│  └── Blocking issues                                         │
│       │                                                      │
│       ▼                                                      │
│  Compacted Context (15k tokens) ─────────────────────────►  │
│       │                                                      │
│       ▼                                                      │
│  saveContextSnapshot() → .planning/state/snapshots/          │
│                                                              │
│  New session starts with compacted context                   │
└─────────────────────────────────────────────────────────────┘
```

### 4.4 ThinkTank 컨텍스트 (EdSpark)

EdSpark 프로젝트의 ThinkTank 구조 로드:

```
.edspark/thinktank/
├── templates/              # 12개 에이전트 템플릿
│   ├── data-collector.yaml
│   ├── optimist.yaml
│   ├── pessimist.yaml
│   └── ...
└── contexts/               # 7개 부서 컨텍스트
    ├── strategy/
    ├── marketing/
    ├── development/
    └── ...
```

**MCP 도구로 주입:**

```typescript
// GSD Planner에 ThinkTank 컨텍스트 주입
const context = generatePlannerContext();
// → "# EdSpark ThinkTank Context
//    ## Available Departments
//    - strategy: 사업검토, 시장분석...
//    ## ThinkTank Agents (12명)
//    ### Wave 1: 리서치 (병렬)
//    - 데이터 수집가 (data-collector): ...
//    ..."
```

---

## 5. 워크플로우: 계획 단계

### 5.1 전체 계획 흐름

```
User: "/ultraplan:new-project" 또는 "/ultraplan:plan-phase 3"
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│  STEP 1: RESEARCH (gsd-project-researcher / gsd-phase-researcher)
│                                                               │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐        │
│  │  Context7   │   │  WebSearch  │   │  Codebase   │        │
│  │ (라이브러리)│   │ (공식 문서) │   │   (패턴)    │        │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘        │
│         └─────────────────┼─────────────────┘                │
│                           ▼                                   │
│                    RESEARCH.md 생성                           │
│  ├── Standard Stack (버전 포함)                               │
│  ├── Architecture Patterns                                    │
│  ├── Don't Hand-Roll (기존 솔루션)                           │
│  └── Common Pitfalls                                         │
└───────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│  STEP 2: PLANNING (gsd-planner)                               │
│                                                               │
│  Input:                                                       │
│  ├── PROJECT.md (요구사항)                                    │
│  ├── ROADMAP.md (페이즈 정의)                                 │
│  ├── RESEARCH.md (도메인 지식)                                │
│  └── ThinkTank Context (있는 경우)                            │
│                                                               │
│  Process:                                                     │
│  ├── Goal-Backward Methodology                                │
│  │   └── 목표에서 역방향으로 필요조건 도출                    │
│  ├── Logical Context-Based Task Grouping                      │
│  │   └── 관련 태스크를 컨텍스트별로 그룹화                    │
│  └── Wave Assignment                                          │
│       └── 파일 충돌 없는 태스크끼리 같은 Wave                 │
│                                                               │
│  Output:                                                      │
│  ├── {phase}-01-{name}.md                                     │
│  ├── {phase}-02-{name}.md                                     │
│  └── {phase}-03-{name}.md (필요시)                            │
└───────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│  STEP 3: RALPLAN CONSENSUS LOOP                               │
│                                                               │
│         ┌─────────┐                                           │
│         │ Planner │◄──────────────────────────┐              │
│         └────┬────┘                           │              │
│              │ PLAN.md                        │              │
│              ▼                                │              │
│         ┌─────────┐                           │              │
│         │Architect│                           │              │
│         └────┬────┘                           │              │
│              │                                │              │
│    ┌─────────┴─────────┐                      │              │
│    │                   │                      │              │
│ APPROVED          ISSUES FOUND ───────────────┘              │
│    │                                                          │
│    ▼                                                          │
│ ┌─────────┐                                                   │
│ │ Critic  │                                                   │
│ └────┬────┘                                                   │
│      │                                                        │
│  ┌───┴───┐                                                    │
│  │       │                                                    │
│ SATISFIED  NOT SATISFIED ─────────────────────┘              │
│  │                                                            │
│  ▼                                                            │
│ CONSENSUS REACHED! (최대 5회 반복)                            │
└───────────────────────────────────────────────────────────────┘
```

### 5.2 PLAN.md 구조

```markdown
---
phase: "03"
plan: "03-01"
type: "mcp-tools"
wave: 1
depends_on: ["02-02"]
files_modified:
  - src/mcp-server.ts
  - src/tools/new-tool.ts
autonomous: true
---

# Plan 03-01: MCP Tools Implementation

## Context
이 플랜은 Phase 3의 첫 번째 작업 그룹입니다...

## must_haves

### truths (관찰 가능한 조건)
- MCP 서버가 새 도구를 노출함
- 도구 호출 시 올바른 응답 반환

### artifacts (생성될 파일)
- src/tools/new-tool.ts
- src/mcp-server.ts (수정)

### key_links (핵심 통합)
- new-tool.ts → mcp-server.ts (import)

## Tasks

### Wave 1

<task type="implementation" id="03-01-01">
  <name>Create new-tool.ts</name>
  <files>src/tools/new-tool.ts</files>
  <action>
    Create new-tool.ts with:
    - Function signature: newTool(params: NewToolParams): NewToolResult
    - Input validation
    - Error handling
  </action>
  <verify>
    npm run build
    grep "newTool" src/tools/new-tool.ts
  </verify>
  <done>
    - [ ] File exists at src/tools/new-tool.ts
    - [ ] Function exported
    - [ ] Build passes
  </done>
</task>

### Wave 2

<task type="integration" id="03-01-02">
  <name>Register tool in MCP server</name>
  <files>src/mcp-server.ts</files>
  <needs>03-01-01</needs>
  <action>
    Add tool definition and handler to mcp-server.ts
  </action>
  <verify>
    npm run build
  </verify>
  <done>
    - [ ] Tool registered in ListToolsRequestSchema
    - [ ] Handler in CallToolRequestSchema
    - [ ] Build passes
  </done>
</task>
```

---

## 6. 워크플로우: 실행 단계

### 6.1 전체 실행 흐름

```
User: "/ultraplan:execute 03-01"
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│  STEP 1: PLAN PARSING                                         │
│                                                               │
│  parsePlanForSync("03-01-PLAN.md")                            │
│       │                                                       │
│       ├── frontmatter 추출                                    │
│       │   { phase, plan, wave, depends_on, files_modified }   │
│       │                                                       │
│       └── tasks 추출 (XML 파싱)                               │
│           [{ id, name, files, action, verify, done, needs }]  │
│                                                               │
│  extractTaskMappings()                                        │
│       │                                                       │
│       └── TaskMapping[]                                       │
│           { taskId, wave, status, toolParams, blockedBy }     │
└───────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│  STEP 2: DEPENDENCY MAPPING                                   │
│                                                               │
│  buildDependencyMap()                                         │
│                                                               │
│  Wave 1: [03-01-01, 03-01-02]  ← blockedBy: []               │
│  Wave 2: [03-01-03, 03-01-04]  ← blockedBy: [01, 02]         │
│  Wave 3: [03-01-05]            ← blockedBy: [01, 02, 03, 04]  │
│                                                               │
│  ※ Wave N의 태스크는 Wave 0..N-1의 모든 태스크에 blocked     │
└───────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│  STEP 3: CLAUDE TASKS 등록                                    │
│                                                               │
│  generateTaskCreations() → TaskCreate[] 호출                  │
│                                                               │
│  TaskCreate({                                                 │
│    subject: "03-01-01: Create new-tool.ts",                   │
│    description: "...",                                        │
│    activeForm: "Creating new-tool.ts"                         │
│  })                                                           │
│                                                               │
│  TaskUpdate({                                                 │
│    taskId: "03-01-02",                                        │
│    addBlockedBy: ["03-01-01"]                                 │
│  })                                                           │
└───────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│  STEP 4: WAVE-BASED EXECUTION LOOP                            │
│                                                               │
│  FOR each wave in order:                                      │
│    │                                                          │
│    │  ┌─────────────────────────────────────────────────┐    │
│    │  │ Wave N의 unblocked 태스크들 (병렬 실행 가능)    │    │
│    │  │                                                 │    │
│    │  │  Task A ──┬──► Executor ──► Architect ──► ✓    │    │
│    │  │           │                                     │    │
│    │  │  Task B ──┼──► Executor ──► Architect ──► ✓    │    │
│    │  │           │                                     │    │
│    │  │  Task C ──┴──► Executor ──► Architect ──► ✓    │    │
│    │  └─────────────────────────────────────────────────┘    │
│    │                                                          │
│    └──► Wave 완료 → 다음 Wave unblock                        │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 6.2 Executor → Architect 검증 루프

```
┌─────────────────────────────────────────────────────────────────┐
│                    VERIFICATION LOOP                             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  EXECUTOR (opus, 200k fresh context)                      │   │
│  │                                                           │   │
│  │  1. Read task context                                     │   │
│  │  2. Execute <action>                                      │   │
│  │  3. Run <verify> commands                                 │   │
│  │  4. Check <done> criteria                                 │   │
│  │  5. Return YAML result:                                   │   │
│  │     status: complete | partial | blocked                  │   │
│  │     files_modified: [...]                                 │   │
│  │     verification_output: "..."                            │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         │                                        │
│                         ▼                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ARCHITECT (opus, READ-ONLY)                              │   │
│  │                                                           │   │
│  │  ※ Edit, Write, Bash(위험) 도구 없음!                    │   │
│  │                                                           │   │
│  │  1. Parse <done> criteria                                 │   │
│  │  2. Independent verification (직접 확인)                  │   │
│  │  3. Code review                                           │   │
│  │  4. Checklist 평가:                                       │   │
│  │     - [ ] Requirements met                                │   │
│  │     - [ ] Code compiles                                   │   │
│  │     - [ ] Tests pass                                      │   │
│  │     - [ ] No regressions                                  │   │
│  │     - [ ] Code quality                                    │   │
│  │  5. Return verdict:                                       │   │
│  │     APPROVED (80%+ pass) | REJECTED                       │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         │                                        │
│          ┌──────────────┴──────────────┐                        │
│          │                             │                        │
│       APPROVED                      REJECTED                    │
│          │                             │                        │
│          ▼                             ▼                        │
│    ┌───────────┐               ┌───────────────┐               │
│    │ Complete  │               │ Retry (max 3) │               │
│    ├───────────┤               │ or            │               │
│    │ Git commit│               │ build-fixer   │               │
│    │ Unblock   │               └───────┬───────┘               │
│    └───────────┘                       │                        │
│                                        └──► Back to Executor    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. 병렬 처리 시스템

### 7.1 Wave 기반 병렬화

```
PLAN.md 태스크 구조:

### Wave 1 (병렬 실행 가능)
- Task A: src/a.ts 수정
- Task B: src/b.ts 수정
- Task C: src/c.ts 수정

  ※ 파일이 겹치지 않으므로 동시 실행 가능

### Wave 2 (Wave 1 완료 후)
- Task D: src/a.ts, src/b.ts 사용
  needs: [A, B]

### Wave 3 (Wave 2 완료 후)
- Task E: 전체 통합
  needs: [D]
```

### 7.2 병렬 실행 옵션

| 모드 | 설명 | 사용 시점 |
|------|------|----------|
| **UltraWork** | 최대 병렬화 (동시 5 태스크) | "ulw", "ultrawork", "fast" |
| **EcoMode** | 토큰 효율적 병렬화 (Haiku 우선) | "eco", "ecomode", "budget" |
| **Swarm** | N개 에이전트 협업 | "swarm 5:executor" |
| **Pipeline** | 순차 에이전트 체인 | "pipeline explore→architect→executor" |
| **Ultrapilot** | 파일 소유권 분할 병렬 | "ultrapilot", "parallel build" |

### 7.3 UltraWork 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                      ULTRAWORK MODE                              │
│                                                                  │
│  Wave 1: [T1, T2, T3, T4, T5]                                   │
│                                                                  │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │             5 CONCURRENT WORKERS                         │  │
│    │                                                          │  │
│    │  Worker 1 ─► T1 ─► Executor ─► Architect ─► ✓           │  │
│    │  Worker 2 ─► T2 ─► Executor ─► Architect ─► ✓           │  │
│    │  Worker 3 ─► T3 ─► Executor ─► Architect ─► ✓           │  │
│    │  Worker 4 ─► T4 ─► Executor ─► Architect ─► ✓           │  │
│    │  Worker 5 ─► T5 ─► Executor ─► Architect ─► ✓           │  │
│    │                                                          │  │
│    └─────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│                    Wave 1 Complete                               │
│                              │                                   │
│                              ▼                                   │
│  Wave 2: [T6, T7] ← Now unblocked                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.4 EcoMode 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                       ECOMODE                                    │
│                                                                  │
│  Model Routing by Complexity:                                    │
│                                                                  │
│  Task Complexity    Model      Concurrent                        │
│  ─────────────────────────────────────────                       │
│  Level 1-2 (간단)   Haiku      최대 5개                          │
│  Level 3 (보통)     Sonnet     최대 3개                          │
│  Level 4-5 (복잡)   Opus       최대 2개                          │
│                                                                  │
│  Token Budget Enforcement:                                       │
│  - 불필요한 컨텍스트 최소화                                      │
│  - 간단한 태스크는 낮은 모델로 처리                              │
│  - 복잡한 태스크만 Opus 사용                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. 태스크 관리

### 8.1 PLAN.md → Claude Tasks 매핑

```typescript
// PLAN.md XML 태스크
<task type="implementation" id="03-01-01">
  <name>Create new-tool.ts</name>
  <files>src/tools/new-tool.ts</files>
  <action>Create the tool...</action>
  <verify>npm run build</verify>
  <done>
    - [ ] File exists
    - [ ] Build passes
  </done>
</task>

// → TaskMapping 변환
{
  taskId: "03-01-01",
  wave: 1,
  status: "pending",
  toolParams: {
    subject: "03-01-01: Create new-tool.ts",
    description: "Create the tool...",
    activeForm: "Creating new-tool.ts"
  },
  blockedBy: []
}

// → Claude Tasks API 호출
TaskCreate({
  subject: "03-01-01: Create new-tool.ts",
  description: "...",
  activeForm: "Creating new-tool.ts"
})
```

### 8.2 태스크 상태 흐름

```
          pending
             │
             ▼
        in_progress ◄─────────────┐
             │                    │
             ▼                    │
   ┌─────────────────┐            │
   │  Executor 실행   │            │
   └────────┬────────┘            │
            │                     │
            ▼                     │
   ┌─────────────────┐            │
   │ Architect 검증   │            │
   └────────┬────────┘            │
            │                     │
     ┌──────┴──────┐              │
     │             │              │
  APPROVED      REJECTED ─────────┘
     │
     ▼
  completed
```

### 8.3 의존성 관리

```typescript
// buildDependencyMap() 결과
{
  "03-01-01": { wave: 1, blockedBy: [] },
  "03-01-02": { wave: 1, blockedBy: [] },
  "03-01-03": { wave: 2, blockedBy: ["03-01-01", "03-01-02"] },
  "03-01-04": { wave: 2, blockedBy: ["03-01-01", "03-01-02"] },
  "03-01-05": { wave: 3, blockedBy: ["03-01-01", "03-01-02", "03-01-03", "03-01-04"] }
}

// Wave N의 태스크는 Wave 0..N-1의 모든 태스크에 의존
```

---

## 9. GSD 통합

### 9.1 GSD란?

**GSD (Get Stuff Done)**: 체계적인 프로젝트 계획 및 실행 방법론

### 9.2 GSD 에이전트

| 에이전트 | 역할 | 사용 시점 |
|----------|------|----------|
| `gsd-project-researcher` | 프로젝트 도메인 리서치 | `/gsd:new-project` 초기 |
| `gsd-phase-researcher` | 페이즈별 기술 리서치 | `/gsd:plan-phase` 전 |
| `gsd-planner` | PLAN.md 생성, Goal-Backward | `/gsd:plan-phase` |
| `gsd-executor` | 태스크 실행, 원자적 커밋 | `/gsd:execute-phase` |
| `gsd-verifier` | 페이즈 목표 달성 검증 | 페이즈 완료 시 |
| `gsd-codebase-mapper` | 코드베이스 분석 | `/gsd:map-codebase` |

### 9.3 GSD 커맨드

```bash
# 프로젝트 초기화
/gsd:new-project          # 새 프로젝트 시작, PROJECT.md 생성

# 페이즈 계획
/gsd:plan-phase {N}       # 페이즈 N의 PLAN.md 생성
/gsd:discuss-phase {N}    # 페이즈 컨텍스트 수집 (질문)

# 실행
/gsd:execute-phase {N}    # 페이즈 N 실행
/gsd:quick {task}         # 빠른 태스크 실행

# 상태 관리
/gsd:progress             # 진행 상황 확인
/gsd:resume-work          # 이전 세션 재개
/gsd:pause-work           # 작업 중단 (컨텍스트 저장)

# 마일스톤
/gsd:new-milestone        # 새 마일스톤 시작
/gsd:audit-milestone      # 마일스톤 완료 감사
/gsd:complete-milestone   # 마일스톤 아카이브
```

### 9.4 GSD 워크플로우

```
┌─────────────────────────────────────────────────────────────────┐
│                     GSD WORKFLOW                                 │
│                                                                  │
│  1. /gsd:new-project                                            │
│     │                                                            │
│     ├── gsd-project-researcher (도메인 리서치)                   │
│     ├── Interview (요구사항 수집)                                │
│     └── PROJECT.md, ROADMAP.md 생성                              │
│                                                                  │
│  2. /gsd:plan-phase {N}                                         │
│     │                                                            │
│     ├── gsd-phase-researcher (기술 리서치)                       │
│     ├── gsd-planner (Goal-Backward)                              │
│     └── PLAN.md 생성                                             │
│                                                                  │
│  3. /gsd:execute-phase {N}                                      │
│     │                                                            │
│     ├── Wave-based 실행                                          │
│     ├── Atomic commits                                           │
│     └── gsd-verifier (완료 검증)                                 │
│                                                                  │
│  4. /gsd:progress → 다음 페이즈 또는 마일스톤                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. OMC 통합

### 10.1 OMC란?

**OMC (oh-my-claudecode)**: 지능형 멀티 에이전트 오케스트레이션 시스템

### 10.2 OMC 핵심 원칙

```
RULE 1: 항상 전문 에이전트에게 위임
RULE 2: 패턴 감지 시 해당 스킬 호출
RULE 3: 직접 코드 변경 금지 → executor에게 위임
RULE 4: Architect 검증 없이 완료 선언 금지
```

### 10.3 OMC 에이전트 (32개)

| 도메인 | LOW (Haiku) | MEDIUM (Sonnet) | HIGH (Opus) |
|--------|-------------|-----------------|-------------|
| **분석** | `architect-low` | `architect-medium` | `architect` |
| **실행** | `executor-low` | `executor` | `executor-high` |
| **탐색** | `explore` | `explore-medium` | `explore-high` |
| **리서치** | `researcher-low` | `researcher` | - |
| **프론트엔드** | `designer-low` | `designer` | `designer-high` |
| **문서** | `writer` | - | - |
| **비주얼** | - | `vision` | - |
| **기획** | - | - | `planner` |
| **비평** | - | - | `critic` |
| **사전분석** | - | - | `analyst` |
| **테스트** | - | `qa-tester` | `qa-tester-high` |
| **보안** | `security-reviewer-low` | - | `security-reviewer` |
| **빌드** | `build-fixer-low` | `build-fixer` | - |
| **TDD** | `tdd-guide-low` | `tdd-guide` | - |
| **코드리뷰** | `code-reviewer-low` | - | `code-reviewer` |
| **데이터** | `scientist-low` | `scientist` | `scientist-high` |

### 10.4 OMC 스킬

| 스킬 | 트리거 | 설명 |
|------|--------|------|
| `autopilot` | "autopilot", "build me" | 완전 자율 실행 |
| `ralph` | "don't stop", "must complete" | 완료까지 지속 |
| `ultrawork` | "ulw", "ultrawork" | 최대 병렬화 |
| `ecomode` | "eco", "ecomode" | 토큰 효율 병렬화 |
| `plan` | "plan this", "plan the" | 계획 세션 |
| `ralplan` | "ralplan" | 반복 계획 합의 |
| `analyze` | "analyze", "debug" | 깊은 분석 |
| `deepsearch` | "search", "find" | 코드베이스 탐색 |
| `frontend-ui-ux` | UI/컴포넌트 컨텍스트 | UI 감각 (자동) |
| `git-master` | git/commit 컨텍스트 | Git 전문 (자동) |
| `tdd` | "tdd", "test first" | TDD 워크플로우 |

### 10.5 OMC + Ultra Planner 통합

```
┌─────────────────────────────────────────────────────────────────┐
│                  OMC + ULTRA PLANNER                             │
│                                                                  │
│  User: "build me a task manager"                                │
│         │                                                        │
│         ▼                                                        │
│  OMC: autopilot 스킬 감지                                        │
│         │                                                        │
│         ▼                                                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ AUTOPILOT MODE                                             │  │
│  │                                                            │  │
│  │  1. explore agent → 코드베이스 분석                        │  │
│  │  2. planner agent → 계획 수립                              │  │
│  │       └── Ultra Planner MCP 도구 사용                      │  │
│  │           ├── collect_project_context()                    │  │
│  │           ├── generate PLAN.md                             │  │
│  │           └── ralplan consensus                            │  │
│  │  3. ultrawork → 병렬 실행                                  │  │
│  │       └── parse_plan() → task mappings                     │  │
│  │       └── build_dependency_map() → waves                   │  │
│  │       └── executor agents (병렬)                           │  │
│  │  4. architect → 검증                                       │  │
│  │  5. 완료 보고                                              │  │
│  │                                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. 스킬 & 페르소나 시스템

### 11.1 스킬 정의 (YAML)

```yaml
# ~/.claude/registry/skills/ultraplan/execute.yaml
id: ultraplan-execute
name: Execute Plan
version: "4.0.0"

triggers:
  keywords:
    - "execute"
    - "run plan"
    - "실행"
  input_types: []
  error_patterns: []
  agents:
    - "executor"
    - "architect"

capabilities:
  - "Parse PLAN.md into TaskMappings"
  - "Build wave-based dependency map"
  - "Execute tasks with verification loop"
  - "Track progress and handle deviations"

context:
  requires_files:
    - "PLAN.md"
  agents:
    - "ultraplan-executor"
    - "ultraplan-architect"

prompt_template: |
  You are executing tasks from PLAN.md using the Router Protocol.

  1. Parse plan: mcp__ultra-planner__parse_plan
  2. Extract mappings: mcp__ultra-planner__extract_task_mappings
  3. Build dependencies: mcp__ultra-planner__build_dependency_map
  4. For each wave:
     - Execute unblocked tasks in parallel
     - Verify with Architect
     - Commit on success

model_override: opus
```

### 11.2 스킬 매칭

```typescript
// skill-injector.ts
function matchSkills(context: PromptContext): SkillMatch[] {
  const scores: SkillMatch[] = [];

  for (const skill of registry.getAllSkills()) {
    let score = 0;

    // 키워드 매칭 (5-30점)
    if (containsKeywords(context.prompt, skill.triggers.keywords)) {
      score += 30;
    }

    // 트리거 이벤트 (60점)
    if (skill.triggers.events?.includes(context.triggerEvent)) {
      score += 60;
    }

    // 에러 패턴 (50점)
    if (matchesErrorPatterns(context.errors, skill.triggers.error_patterns)) {
      score += 50;
    }

    // 입력 타입 (40점)
    if (matchesInputTypes(context.inputTypes, skill.triggers.input_types)) {
      score += 40;
    }

    // 에이전트 컨텍스트 (20점)
    if (skill.context.agents?.includes(context.agentId)) {
      score += 20;
    }

    if (score > 0) {
      scores.push({ skill, score });
    }
  }

  return scores.sort((a, b) => b.score - a.score);
}
```

### 11.3 스킬 주입

```typescript
// 에이전트 프롬프트에 스킬 주입
function injectSkillsForAgent(
  basePrompt: string,
  context: PromptContext
): EnhancedPrompt {
  const matches = matchSkills(context);
  const topSkills = matches.slice(0, 3);

  let enhancedPrompt = basePrompt;
  let modelOverride: string | undefined;

  for (const { skill } of topSkills) {
    if (skill.prompt_template) {
      enhancedPrompt = `${skill.prompt_template}\n\n${enhancedPrompt}`;
    }

    // 가장 높은 모델 우선
    if (skill.model_override) {
      modelOverride = higherModel(modelOverride, skill.model_override);
    }
  }

  return { prompt: enhancedPrompt, modelOverride };
}
```

### 11.4 Delegation Categories

태스크 복잡도에 따른 자동 라우팅:

| Category | Model | Temperature | Thinking | 사용 예 |
|----------|-------|-------------|----------|---------|
| `quick` | Haiku | 0.1 | low | 간단한 조회, 기본 작업 |
| `standard` | Sonnet | 0.3 | medium | 일반 구현, 리팩토링 |
| `complex` | Opus | 0.3 | high | 복잡한 디버깅, 아키텍처 |
| `ultrabrain` | Opus | 0.3 | max | 깊은 추론, 설계 |
| `visual-engineering` | Opus | 0.7 | high | UI/UX, 디자인 시스템 |
| `artistry` | Sonnet | 0.9 | medium | 창의적 솔루션 |
| `writing` | Sonnet | 0.5 | medium | 문서, 기술 문서 |

---

## 12. ThinkTank 통합 (EdSpark)

### 12.1 ThinkTank 구조

```
.edspark/thinktank/
├── templates/                    # 12개 에이전트 템플릿
│   ├── data-collector.yaml       # Wave 1: 리서치
│   ├── quant-analyst.yaml
│   ├── qual-analyst.yaml
│   ├── research-synthesizer.yaml
│   ├── optimist.yaml             # Wave 2: 토론
│   ├── pessimist.yaml
│   ├── realist.yaml
│   ├── innovator.yaml
│   ├── executor.yaml
│   ├── synthesizer.yaml          # Wave 3: 결론
│   ├── report-writer.yaml
│   └── quality-reviewer.yaml
└── contexts/                     # 7개 부서 컨텍스트
    ├── strategy/agents.yaml      # 사업검토, 시장분석
    ├── marketing/agents.yaml     # 시장조사, 포지셔닝
    ├── sales/agents.yaml         # 고객분석, 영업전략
    ├── development/agents.yaml   # 기술검토, 아키텍처
    ├── operations/agents.yaml    # 프로세스, 자동화
    ├── finance/agents.yaml       # ROI분석, 예산
    └── design/agents.yaml        # UI/UX, 브랜딩
```

### 12.2 ThinkTank 실행 흐름

```
CEO 요청
    │
    ▼
부서 선택 (strategy/marketing/sales/development/operations/finance/design)
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Wave 1: 리서치 (4명 병렬)                                       │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐│
│  │데이터 수집가│  │정량 분석가 │  │정성 분석가 │  │리서치 종합 ││
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘│
│                                                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Wave 2: 토론 (5명 병렬)                                         │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────┐│
│  │ 낙관론자 │  │ 비관론자 │  │ 현실주의 │  │ 혁신가   │  │실행자││
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────┘│
│                                                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Wave 3: 결론 (3명 순차)                                         │
│                                                                  │
│  종합가 ──► 보고서 작성자 ──► 품질 검토자                        │
│                                                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
                      CEO 보고
```

### 12.3 컨텍스트 주입

```typescript
// GSD Planner가 ThinkTank 프로젝트에서 계획 시:

// 1. ThinkTank 구조 확인
const hasThinkTank = hasThinkTankStructure();  // true

// 2. 컨텍스트 로드
const context = generatePlannerContext();
/*
# EdSpark ThinkTank Context

## Available Departments
- **strategy**: 사업검토, 시장분석, 경쟁분석, 전략수립
- **marketing**: 시장조사, 포지셔닝, 브랜딩, 캠페인
- **development**: 기술검토, 아키텍처, 구현, 테스트
...

## ThinkTank Agents (12명)

### Wave 1: 리서치 (병렬)
- **데이터 수집가** (data-collector): 정량/정성 데이터 수집
- **정량 분석가** (quant-analyst): 수치 데이터 분석
...

### Wave 2: 토론 (병렬)
- **낙관론자** (optimist): 기회와 가능성 탐색
- **비관론자** (pessimist): 리스크와 장애물 식별
...

## Execution Flow
Wave 1: 리서치 (4명 병렬) → 30-60분
Wave 2: 토론 (5명 병렬) → 60-90분
Wave 3: 결론 (3명 순차) → 45-75분

## Planning Guidelines
1. 부서 선택: 요청 내용에 맞는 부서 선택 (복수 가능)
2. Wave 순서 준수: Wave 1 → 2 → 3 순서로 실행
3. 병렬 실행: Wave 1, 2는 에이전트 병렬 실행
*/

// 3. Planner 프롬프트에 주입
const plannerPrompt = `
${context}

---

Now plan the following request:
${userRequest}
`;
```

---

## 13. MCP 도구 레퍼런스

### 13.1 Plan Parsing

| Tool | 설명 |
|------|------|
| `parse_plan` | PLAN.md 파일 파싱, frontmatter + tasks 추출 |
| `extract_task_mappings` | TaskMapping[] 배열 생성 |
| `generate_task_creates` | TaskCreate 도구 호출 파라미터 생성 |
| `get_execution_order` | Wave 순서대로 태스크 정렬 |
| `build_dependency_map` | Wave 기반 blockedBy 맵 생성 |
| `calculate_progress` | 진행률 통계 계산 |

### 13.2 Context

| Tool | 설명 |
|------|------|
| `collect_project_context` | PROJECT.md, ROADMAP.md 수집 |
| `collect_phase_context` | 페이즈별 컨텍스트 수집 |
| `collect_task_context` | PLAN.md 태스크 컨텍스트 수집 |
| `compress_context` | 컨텍스트 압축 (fresh-start) |
| `restore_context` | 스냅샷에서 컨텍스트 복원 |
| `get_thinktank_context` | ThinkTank 컨텍스트 로드 |
| `get_department_context` | 부서별 컨텍스트 로드 |
| `has_thinktank` | ThinkTank 구조 존재 여부 |

### 13.3 Skills

| Tool | 설명 |
|------|------|
| `match_skills` | 컨텍스트에 매칭되는 스킬 찾기 |
| `inject_skills` | 프롬프트에 스킬 주입 |
| `needs_skill_injection` | 스킬 주입 필요 여부 |
| `list_skills` | 모든 스킬 목록 |
| `get_skill` | 특정 스킬 조회 |

### 13.4 Routing & Complexity

| Tool | 설명 |
|------|------|
| `suggest_complexity` | 복잡도 힌트 (AI가 최종 결정) |
| `suggest_route` | 라우팅 힌트 |
| `get_task_hints` | 복잡도 + 라우팅 힌트 |
| `detect_task_category` | 태스크 카테고리 감지 |
| `route_task` | 에이전트/모델 라우팅 |
| `route_by_complexity` | 복잡도 기반 라우팅 |
| `estimate_task_complexity` | 복잡도 레벨 추정 |
| `get_model_for_complexity` | 복잡도별 권장 모델 |

### 13.5 Verdicts

| Tool | 설명 |
|------|------|
| `evaluate_architect_checklist` | Architect 체크리스트 평가 |
| `evaluate_critic_checklist` | Critic 체크리스트 평가 |
| `get_approval_threshold` | 승인 임계값 (80%) |

### 13.6 Sessions

| Tool | 설명 |
|------|------|
| `create_session` | 새 세션 생성 |
| `get_session` | 세션 상태 조회 |
| `list_sessions` | 활성 세션 목록 |
| `claim_task_for_session` | 세션에 태스크 할당 |
| `complete_session` | 세션 완료 |

### 13.7 Notepad (Wisdom)

| Tool | 설명 |
|------|------|
| `add_learning` | 학습 기록 추가 |
| `add_decision` | 결정 기록 추가 |
| `add_issue` | 이슈 기록 추가 |
| `get_wisdom` | 플랜 지혜 조회 |
| `create_wisdom_directive` | 에이전트용 지혜 지시문 |
| `has_wisdom` | 지혜 존재 여부 |
| `init_plan_notepad` | 플랜 노트패드 초기화 |
| `merge_plan_to_project` | 플랜 지혜를 프로젝트로 병합 |

### 13.8 Deviations & Spikes

| Tool | 설명 |
|------|------|
| `report_deviation` | 계획 이탈 보고 |
| `get_deviations` | 이탈 목록 조회 |
| `get_pending_approvals` | 승인 대기 이탈 |
| `submit_deviation_verdict` | 이탈 승인/거부 |
| `create_spike` | 불확실성 스파이크 생성 |
| `complete_spike` | 스파이크 완료 |
| `assess_uncertainty` | 불확실성 평가 |

### 13.9 Rollback & Checkpoints

| Tool | 설명 |
|------|------|
| `complete_phase` | 페이즈 완료 체크포인트 |
| `list_phase_tags` | 페이즈 태그 목록 |
| `preview_rollback` | 롤백 미리보기 |
| `selective_rollback` | 선택적 롤백 |
| `rollback_to_phase` | 페이즈로 롤백 |
| `get_rollback_targets` | 롤백 대상 목록 |

---

## 부록: 용어집

| 용어 | 정의 |
|------|------|
| **Context Architect** | 직접 실행하지 않고 컨텍스트를 설계하는 패턴 |
| **Wave** | 병렬 실행 가능한 태스크 그룹 (파일 충돌 없음) |
| **Ralplan** | Planner + Architect + Critic 합의 루프 |
| **Goal-Backward** | 목표에서 역방향으로 필요조건 도출 |
| **Fresh-Start** | 컨텍스트 압축 후 새 세션 시작 |
| **TaskMapping** | PLAN.md 태스크 → Claude Tasks 매핑 |
| **Skill Injection** | 컨텍스트 기반 프롬프트 강화 |
| **Delegation Category** | 태스크 복잡도 분류 (quick/standard/complex/...) |
| **ThinkTank** | EdSpark의 12명 에이전트 토론 시스템 |
| **Notepad** | 플랜별 학습/결정/이슈 기록 시스템 |

---

*문서 버전: 4.0.0*
*최종 업데이트: 2026-02-01*
