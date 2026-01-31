# Ultra Planner v3.0

> **"실행하지 않는다. 맥락을 설계한다."**
> (Don't execute, design context.)

Ultra Planner는 Claude Code를 위한 **Context Architect**입니다. GSD(Get Shit Done), OMC(oh-my-claudecode), OpenCode의 패턴을 통합하여 계획-실행 오케스트레이션을 제공합니다.

## Features

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **Context Architect** | 맥락 수집, 주입, 압축 - Claude Code가 실행 |
| **Research → Plan → Ralplan** | 리서치 후 계획, Architect + Critic 합의까지 검증 |
| **인터뷰 기반 계획** | Planner 에이전트가 질문하고 계획 수립 |
| **병렬 실행** | Wave 기반 태스크 병렬 처리 (Swarm 패턴) |
| **Hints (AI Decides)** | 규칙이 아닌 힌트 - AI가 최종 결정 |
| **Wisdom 축적** | 학습, 결정, 이슈 기록 - 세션 간 지속 |
| **Fresh-Start 지원** | 20,000 → 200 토큰 압축으로 컨텍스트 보존 |

### v3.0 Changes (Context Architect Pattern)

```
┌─────────────────────────────────────────────────────────────┐
│                    Context Architect Pattern                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Ultra Planner                    Claude Code               │
│   ─────────────                    ──────────                │
│   • Context Collection      →      • Task Execution          │
│   • Context Injection       →      • State Management        │
│   • Hints (isHint: true)    →      • File Operations         │
│   • Prompt Generation       →      • Build/Test              │
│   • Wisdom Accumulation     →      • Parallel Workers        │
│                                                              │
│   "We suggest, AI decides"         "Native is optimal"       │
└─────────────────────────────────────────────────────────────┘
```

## Installation

### 1. 의존성 설치

```bash
cd ultra-planning
npm install
npm run build
```

### 2. MCP 서버 설정

`~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "ultra-planner": {
      "command": "node",
      "args": ["/path/to/ultra-planning/dist/mcp-server.js"]
    }
  }
}
```

### 3. 스킬/커맨드 설치 (선택)

```bash
# 전역 설치
mkdir -p ~/.claude/commands ~/.claude/skills
ln -sf /path/to/ultra-planning/.claude/commands/* ~/.claude/commands/
ln -sf /path/to/ultra-planning/.claude/skills/* ~/.claude/skills/

# 또는 프로젝트별 설치
cp -r /path/to/ultra-planning/.claude /your/project/
```

## Workflows

### /ultraplan:new-project

새 프로젝트 초기화 - Research → Plan → Ralplan 검증 플로우:

```
/ultraplan:new-project [description] [--skip-research]
```

```
┌─────────────────────────────────────────────────────────────┐
│  1. RESEARCH — 4개 병렬 에이전트로 도메인 리서치             │
│     • Tech Researcher: 기술 스택, 라이브러리                 │
│     • Pattern Researcher: 아키텍처 패턴                      │
│     • Integration Researcher: 외부 연동                      │
│     • Risk Researcher: 리스크 분석                          │
│                                                              │
│  2. PLAN — 인터뷰 기반 계획                                  │
│     • PROJECT.md 생성                                        │
│     • ROADMAP.md 생성                                        │
│     • Phase 분할                                             │
│                                                              │
│  3. RALPLAN — 합의 검증                                      │
│     • Architect 검토                                         │
│     • Critic 검토                                            │
│     • 80% 이상 통과시 승인                                   │
└─────────────────────────────────────────────────────────────┘
```

### /ultraplan:plan-phase

특정 Phase 계획 생성:

```
/ultraplan:plan-phase [phase-number]
```

```
┌─────────────────────────────────────────────────────────────┐
│  1. Phase Research — 구현 방법 리서치                        │
│  2. Plan Generation — PLAN.md 생성                          │
│  3. Ralplan Verification — Architect + Critic 검증           │
│  4. Task Breakdown — Wave 기반 태스크 분할                   │
└─────────────────────────────────────────────────────────────┘
```

### /ultraplan:execute

Phase 실행:

```
/ultraplan:execute [phase-number] [--parallel N]
```

```
┌─────────────────────────────────────────────────────────────┐
│  Wave-based Execution                                        │
│                                                              │
│  Wave 1: [Task A] [Task B] [Task C]  ← 병렬 실행             │
│              ↓                                               │
│  Wave 2: [Task D] [Task E]           ← Wave 1 완료 후        │
│              ↓                                               │
│  Wave 3: [Task F]                    ← Wave 2 완료 후        │
│                                                              │
│  • Executor 에이전트가 태스크 실행                           │
│  • Architect 에이전트가 검증                                 │
│  • 실패시 자동 재시도 (Ralph Loop)                           │
└─────────────────────────────────────────────────────────────┘
```

### /thorough

GSD 플랜 생성 + Architect 검토 + 병렬 실행 자동화:

```
/thorough all              # 모든 Phase 실행
/thorough from 3           # Phase 3부터 실행
```

## Scenario Flows (상세 시나리오)

### 시나리오 1: 새 프로젝트 시작 (`/ultraplan:new-project`)

```
사용자: "TODO 앱 만들어줘"
         ↓
┌─────────────────────────────────────────────────────────────┐
│ 1. Research Phase (4개 병렬 에이전트)                         │
├─────────────────────────────────────────────────────────────┤
│  ├── gsd-project-researcher (domain)     → DOMAIN.md        │
│  ├── gsd-project-researcher (ecosystem)  → ECOSYSTEM.md     │
│  ├── gsd-project-researcher (patterns)   → PATTERNS.md      │
│  └── gsd-project-researcher (risks)      → RISKS.md         │
│                     ↓                                        │
│  gsd-research-synthesizer                → SUMMARY.md        │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Planning Phase                                            │
├─────────────────────────────────────────────────────────────┤
│  gsd-roadmapper:                                             │
│    - 요구사항 분석                                            │
│    - 단계(Phase) 분할                                         │
│    - 성공 기준 정의                                           │
│         ↓                                                    │
│  생성 파일:                                                   │
│    .planning/PROJECT.md      ← 프로젝트 개요                  │
│    .planning/REQUIREMENTS.md ← 요구사항                       │
│    .planning/ROADMAP.md      ← 단계별 계획                    │
└─────────────────────────────────────────────────────────────┘
         ↓
결과: .planning/ 디렉토리 구조 생성 완료
```

### 시나리오 2: 단계 계획 (`/ultraplan:plan-phase 1`)

```
사용자: "/ultraplan:plan-phase 1"
         ↓
┌─────────────────────────────────────────────────────────────┐
│ 1. Context Collection (collector.ts)                         │
├─────────────────────────────────────────────────────────────┤
│  collectContext({                                            │
│    planId: '01-01',                                          │
│    includeProject: true,                                     │
│    includePhase: true                                        │
│  })                                                          │
│         ↓                                                    │
│  수집:                                                        │
│    - PROJECT.md (프로젝트 비전)                               │
│    - REQUIREMENTS.md (요구사항)                               │
│    - ROADMAP.md (전체 로드맵)                                 │
│    - 이전 Phase SUMMARY.md (있으면)                           │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Research (gsd-phase-researcher)                           │
├─────────────────────────────────────────────────────────────┤
│  - 구현 방법 조사                                             │
│  - 기술 선택 분석                                             │
│  - 의존성 파악                                                │
│         ↓                                                    │
│  생성: .planning/phases/01-setup/RESEARCH.md                 │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Planning (gsd-planner)                                    │
├─────────────────────────────────────────────────────────────┤
│  Context Injection (injector.ts):                            │
│    injectPlannerContext(ctx) → {                             │
│      sections: [Project, Requirements, Roadmap, Research],   │
│      totalTokens: ~5000                                      │
│    }                                                         │
│         ↓                                                    │
│  태스크 분해:                                                 │
│    - Wave 1: 병렬 실행 가능한 태스크들                         │
│    - Wave 2: Wave 1 완료 후 실행할 태스크들                    │
│    - ...                                                     │
│         ↓                                                    │
│  생성: .planning/phases/01-setup/01-01-PLAN.md               │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Verification (gsd-plan-checker)                           │
├─────────────────────────────────────────────────────────────┤
│  체크리스트:                                                  │
│    ✓ goalsAligned: Phase 목표와 일치?                        │
│    ✓ tasksAtomic: 태스크가 원자적?                           │
│    ✓ dependenciesClear: 의존성 명확?                         │
│    ✓ waveStructure: Wave 구조 올바름?                        │
│    ✓ verifiable: 검증 가능?                                  │
│         ↓                                                    │
│  80% 이상 통과 → APPROVED                                    │
│  미만 → REJECTED (수정 후 재검토)                             │
└─────────────────────────────────────────────────────────────┘
         ↓
결과: 01-01-PLAN.md 생성 완료
```

### 시나리오 3: 실행 (`/ultraplan:execute`)

```
사용자: "/ultraplan:execute"
         ↓
┌─────────────────────────────────────────────────────────────┐
│ 1. Task Loading (parse_plan, get_execution_order)            │
├─────────────────────────────────────────────────────────────┤
│  PLAN.md 파싱:                                               │
│    - Wave 1: [task-01, task-02, task-03]                    │
│    - Wave 2: [task-04, task-05]                             │
│                                                              │
│  의존성 맵 구축 (build_dependency_map):                       │
│    task-04 blockedBy: [task-01, task-02, task-03]           │
│    task-05 blockedBy: [task-01, task-02, task-03]           │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Wave 1 Execution (병렬)                                   │
├─────────────────────────────────────────────────────────────┤
│  Context Injection for Workers:                              │
│    injectWorkerContext(ctx) → {                              │
│      sections: [Task, Plan, Learnings],                      │
│      totalTokens: ~2000                                      │
│    }                                                         │
│         ↓                                                    │
│  병렬 실행:                                                   │
│    ├── Worker 1 (task-01): npm init -y                      │
│    ├── Worker 2 (task-02): tsconfig.json 생성               │
│    └── Worker 3 (task-03): .eslintrc 설정                   │
│         ↓                                                    │
│  각 Worker 완료 시:                                           │
│    - Architect 검증 (injectArchitectContext)                 │
│    - 통과 → complete_swarm_task                              │
│    - 실패 → 수정 후 재검증                                    │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Wave 2 Execution (Wave 1 완료 후)                         │
├─────────────────────────────────────────────────────────────┤
│  병렬 실행:                                                   │
│    ├── Worker 1 (task-04): Vitest 설정                      │
│    └── Worker 2 (task-05): src/ 구조 생성                   │
│         ↓                                                    │
│  Wisdom 기록 (during execution):                             │
│    add_learning("vitest는 vite.config에서 test 설정 필요")   │
│    add_decision("src/index.ts를 진입점으로 사용")             │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Phase Completion                                          │
├─────────────────────────────────────────────────────────────┤
│  complete_phase(1, "Project Setup"):                         │
│    - Git tag: ultraplan-phase-1-complete                    │
│    - Checkpoint 생성                                         │
│         ↓                                                    │
│  Verification (gsd-verifier):                                │
│    - Phase 목표 달성 확인                                     │
│    - 생성: VERIFICATION.md                                   │
│         ↓                                                    │
│  Summary 생성:                                                │
│    - .planning/phases/01-setup/01-01-SUMMARY.md             │
│    - Wisdom merge to project level                           │
└─────────────────────────────────────────────────────────────┘
         ↓
결과: Phase 1 완료, ROADMAP.md 체크박스 업데이트
```

### 시나리오 4: Thorough 모드 (`/thorough all`)

```
사용자: "/thorough all"
         ↓
┌─────────────────────────────────────────────────────────────┐
│ 완전 자동화 모드 (사용자 입력 없음)                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Phase 1 ─────────────────────────────────────────────────  │
│    ├── /gsd:plan-phase 1                                    │
│    ├── /gsd:execute-phase 1                                 │
│    ├── Architect 검증                                        │
│    ├── Git commit: "feat(phase-1): complete Project Setup"  │
│    └── ROADMAP.md 체크박스 업데이트                          │
│         ↓                                                    │
│  Phase 2 ─────────────────────────────────────────────────  │
│    ├── /gsd:plan-phase 2                                    │
│    ├── /gsd:execute-phase 2                                 │
│    ├── Architect 검증                                        │
│    ├── Git commit: "feat(phase-2): complete Core Domain"    │
│    └── ROADMAP.md 체크박스 업데이트                          │
│         ↓                                                    │
│  ... (모든 Phase 반복) ...                                   │
│         ↓                                                    │
│  Phase N (마지막) ────────────────────────────────────────  │
│    ├── /gsd:plan-phase N                                    │
│    ├── /gsd:execute-phase N                                 │
│    ├── Architect 검증                                        │
│    ├── Git commit: "feat(phase-N): complete Final Phase"    │
│    └── ROADMAP.md 모든 체크박스 완료                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         ↓
결과: 전체 프로젝트 완료, 모든 Phase 커밋됨
```

**자동 결정 규칙:**
| 상황 | 자동 결정 |
|------|----------|
| 구현 방법 선택 | 가장 단순한 방법 |
| 라이브러리 선택 | 프로젝트 기존 것 사용 |
| y/n 확인 | 항상 y |
| 3개 이상 멈춤 | 중단 |

### 시나리오 5: Fresh Start (컨텍스트 복구)

```
상황: 대화 컨텍스트 초과 또는 새 세션 시작
         ↓
┌─────────────────────────────────────────────────────────────┐
│ 1. Context Compaction (compactor.ts)                         │
├─────────────────────────────────────────────────────────────┤
│  compactContext(ctx):                                        │
│    입력: ~20,000 tokens                                      │
│         ↓                                                    │
│    압축:                                                      │
│      - 프로젝트 요약 (1문장)                                  │
│      - 현재 Phase 상태                                        │
│      - 진행 중인 태스크                                       │
│      - 중요 결정사항                                          │
│      - 학습 내용                                              │
│      - 미해결 이슈                                            │
│         ↓                                                    │
│    출력: ~150 tokens (99% 압축)                              │
│                                                              │
│  saveContextSnapshot(compacted):                             │
│    → .ultraplan/snapshots/{id}.json                         │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Context Restoration (새 세션)                             │
├─────────────────────────────────────────────────────────────┤
│  restoreContext(snapshotId):                                 │
│    ← .ultraplan/snapshots/{id}.json                         │
│         ↓                                                    │
│  formatCompactedContext(restored):                           │
│    """                                                       │
│    ## Session Context (Restored)                             │
│                                                              │
│    ### Project Summary                                       │
│    Ultra Planner v3.0 - Context Architect 패턴 구현          │
│                                                              │
│    ### Phase State                                           │
│    Phase 7/7: Integration Testing                            │
│    Status: in_progress                                       │
│    Progress: 80%                                             │
│                                                              │
│    ### Current Work                                          │
│    - Task 01-07-03: E2E 테스트 작성                          │
│                                                              │
│    ### Key Decisions                                         │
│    - isHint 패턴으로 AI 결정권 보장                           │
│                                                              │
│    ~150 tokens (compressed from ~20,000)                    │
│    """                                                       │
└─────────────────────────────────────────────────────────────┘
         ↓
결과: 새 세션에서 컨텍스트 복구 완료, 작업 계속
```

### 시나리오 6: Hints 사용 (AI 결정 지원)

```
에이전트: "이 태스크 어떻게 처리할까?"
         ↓
┌─────────────────────────────────────────────────────────────┐
│ getTaskHints() 호출                                          │
├─────────────────────────────────────────────────────────────┤
│  입력:                                                        │
│    taskDescription: "OAuth 인증 구현"                        │
│    files: ["auth.ts", "middleware.ts", "routes.ts"]         │
│         ↓                                                    │
│  suggestComplexity():                                        │
│    {                                                         │
│      isHint: true,  ← AI가 최종 결정                         │
│      level: 4,                                               │
│      category: "feature",                                    │
│      confidence: 0.75                                        │
│    }                                                         │
│         ↓                                                    │
│  suggestRoute():                                             │
│    {                                                         │
│      isHint: true,  ← AI가 최종 결정                         │
│      agent: "executor-high",                                 │
│      model: "opus",                                          │
│      confidence: 0.80                                        │
│    }                                                         │
│         ↓                                                    │
│  출력:                                                        │
│    """                                                       │
│    ═══ Ultra Planner Hints ═══                              │
│    These are SUGGESTIONS only.                               │
│    Use your judgment to decide.                              │
│                                                              │
│    Complexity: 4/5 (75% confidence)                         │
│    Agent: executor-high                                      │
│    Model: opus                                               │
│    """                                                       │
└─────────────────────────────────────────────────────────────┘
         ↓
AI: Hints 참고하여 최종 결정 (executor-high/opus 또는 다른 선택)
```

### 전체 아키텍처 흐름도

```
┌─────────────────────────────────────────────────────────────────┐
│                    Ultra Planner v3.0                            │
│                  "Context Architect Pattern"                     │
│              실행하지 않는다. 맥락을 설계한다.                      │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Context   │      │    Hints    │      │   Prompts   │
│   Module    │      │   Module    │      │   Module    │
├─────────────┤      ├─────────────┤      ├─────────────┤
│ collector   │      │ complexity  │      │ worker      │
│ injector    │      │ routing     │      │ orchestrator│
│ compactor   │      │ model       │      │             │
└──────┬──────┘      └──────┬──────┘      └──────┬──────┘
       │                    │                    │
       └────────────────────┼────────────────────┘
                            ▼
              ┌─────────────────────────┐
              │      MCP Server         │
              │     (70+ Tools)         │
              ├─────────────────────────┤
              │ Context:                │
              │   collect_*, inject_*   │
              │ Hints:                  │
              │   suggest_*, get_hints  │
              │ Wisdom:                 │
              │   add_*, get_wisdom     │
              │ Orchestration:          │
              │   swarm_*, pipeline_*   │
              └───────────┬─────────────┘
                          ▼
              ┌─────────────────────────┐
              │   GSD/OMC Integration   │
              ├─────────────────────────┤
              │ /thorough all           │
              │ /gsd:plan-phase         │
              │ /gsd:execute-phase      │
              │ /oh-my-claudecode:*     │
              └─────────────────────────┘
```

---

## Architecture

```
ultra-planning/
├── src/
│   ├── context/              # Context Architect (v3.0 Core)
│   │   ├── collector.ts      # .planning에서 맥락 수집
│   │   ├── injector.ts       # 역할별 맥락 주입
│   │   ├── compactor.ts      # Fresh-start용 압축
│   │   ├── estimator.ts      # 토큰 추정
│   │   ├── thresholds.ts     # 임계값 감지
│   │   └── monitor.ts        # 컨텍스트 모니터링
│   │
│   ├── hints/                # AI 힌트 (규칙 아님)
│   │   ├── complexity.ts     # 복잡도 힌트 (isHint: true)
│   │   ├── routing.ts        # 라우팅 힌트 (isHint: true)
│   │   └── types.ts          # 힌트 타입 정의
│   │
│   ├── prompts/              # 프롬프트 생성
│   │   ├── worker.ts         # 워커 프롬프트
│   │   ├── orchestrator.ts   # 오케스트레이터 프롬프트
│   │   ├── executor.ts       # 실행 루프 프롬프트
│   │   └── templates/        # 재사용 템플릿
│   │
│   ├── notepad/              # Wisdom 축적
│   │   ├── manager.ts        # 노트패드 관리
│   │   ├── learnings.ts      # 학습 기록
│   │   ├── decisions.ts      # 결정 기록
│   │   └── issues.ts         # 이슈 기록
│   │
│   ├── orchestration/        # 오케스트레이션
│   │   ├── swarm/            # Swarm 패턴 (프롬프트 생성만)
│   │   ├── pipeline/         # Pipeline 패턴 (프리셋 정의만)
│   │   ├── delegation/       # 태스크 라우팅
│   │   ├── verdicts/         # Architect/Critic 판정
│   │   ├── deviation/        # 일탈 처리
│   │   ├── revision/         # 계획 수정
│   │   └── spike/            # 불확실성 탐색
│   │
│   ├── sync/                 # Claude Code 동기화
│   │   ├── plan-parser.ts    # PLAN.md 파싱
│   │   ├── task-creation.ts  # TaskCreate 생성
│   │   ├── progress.ts       # 진행률 계산
│   │   └── status-sync.ts    # 상태 동기화
│   │
│   ├── documents/            # 문서 생성
│   │   └── templates/        # PROJECT, ROADMAP, PLAN 템플릿
│   │
│   ├── complexity/           # 복잡도 추정 (레거시)
│   ├── state/                # 상태 관리
│   └── mcp-server.ts         # MCP 서버 (70+ 도구)
│
├── .claude/
│   ├── commands/             # 슬래시 커맨드
│   │   ├── ultraplan-new-project.md
│   │   ├── ultraplan-plan-phase.md
│   │   ├── ultraplan-execute.md
│   │   └── fresh-start.md
│   │
│   ├── skills/               # 스킬 정의
│   │   ├── ultraplan/        # Ultra Plan 스킬
│   │   ├── thorough/         # Thorough 모드
│   │   └── fresh-start/      # Fresh-start 스킬
│   │
│   └── agents/               # 에이전트 정의
│
├── .planning/                # 프로젝트 계획 (생성됨)
│   ├── PROJECT.md
│   ├── ROADMAP.md
│   ├── REQUIREMENTS.md
│   ├── STATE.md
│   ├── phases/
│   └── notepads/
│
└── tests/                    # 테스트
    └── integration/          # E2E 테스트
```

## MCP Tools (70+)

### Context Tools (v3.0)
| Tool | Description |
|------|-------------|
| `collect_project_context` | PROJECT.md, ROADMAP.md, REQUIREMENTS.md 수집 |
| `collect_phase_context` | 페이즈 리서치 및 계획 수집 |
| `collect_task_context` | 특정 PLAN.md 수집 |
| `compress_context` | Fresh-start용 압축 (99% 압축률) |
| `restore_context` | 스냅샷에서 복원 |

### Hint Tools (v3.0)
| Tool | Description |
|------|-------------|
| `suggest_complexity` | 복잡도 힌트 (isHint: true) |
| `suggest_route` | 라우팅 힌트 (isHint: true) |
| `get_task_hints` | 모든 힌트 통합 |

### Plan Sync Tools
| Tool | Description |
|------|-------------|
| `parse_plan` | PLAN.md 파싱 |
| `extract_task_mappings` | 태스크 매핑 추출 |
| `generate_task_creates` | TaskCreate 생성 |
| `get_execution_order` | Wave 순서 계산 |
| `build_dependency_map` | 의존성 맵 생성 |
| `calculate_progress` | 진행률 계산 |

### Wisdom Tools
| Tool | Description |
|------|-------------|
| `add_learning` | 학습 기록 |
| `add_decision` | 결정 기록 |
| `add_issue` | 이슈 기록 |
| `get_wisdom` | 축적된 지혜 조회 |
| `create_wisdom_directive` | 서브에이전트용 디렉티브 |
| `has_wisdom` | 지혜 존재 확인 |
| `merge_plan_to_project` | 플랜 지혜 → 프로젝트 병합 |
| `generate_project_summary` | 프로젝트 요약 생성 |
| `init_plan_notepad` | 플랜별 노트패드 초기화 |

### Complexity Tools
| Tool | Description |
|------|-------------|
| `estimate_task_complexity` | 태스크 복잡도 추정 (1-5) |
| `get_model_for_complexity` | 복잡도별 모델 추천 |
| `batch_estimate_complexity` | 배치 복잡도 추정 |

### Verdict Tools
| Tool | Description |
|------|-------------|
| `evaluate_architect_checklist` | Architect 체크리스트 평가 |
| `evaluate_critic_checklist` | Critic 체크리스트 평가 |
| `get_approval_threshold` | 승인 임계값 (80%) |

### Session Tools
| Tool | Description |
|------|-------------|
| `create_session` | 세션 생성 |
| `get_session` | 세션 조회 |
| `list_sessions` | 세션 목록 |
| `claim_task_for_session` | 태스크 클레임 |
| `complete_session` | 세션 완료 |

### Revision Tools
| Tool | Description |
|------|-------------|
| `flag_plan_for_revision` | 계획 수정 플래그 |
| `check_revision_needed` | 수정 필요 확인 |
| `complete_plan_revision` | 수정 완료 |
| `get_plan_version_history` | 버전 히스토리 |

### Deviation Tools
| Tool | Description |
|------|-------------|
| `report_deviation` | 일탈 보고 |
| `get_deviations` | 일탈 목록 |
| `get_pending_approvals` | 대기 중 승인 |
| `submit_deviation_verdict` | 일탈 판정 |
| `get_deviation_stats` | 일탈 통계 |
| `has_unresolved_level3` | Level 3 일탈 확인 |

### Spike Tools
| Tool | Description |
|------|-------------|
| `create_spike` | 스파이크 생성 |
| `assess_uncertainty` | 불확실성 평가 |
| `complete_spike` | 스파이크 완료 |
| `get_pending_spikes` | 대기 중 스파이크 |
| `get_spike_stats` | 스파이크 통계 |

### Rollback Tools
| Tool | Description |
|------|-------------|
| `complete_phase` | Phase 완료 + 체크포인트 |
| `list_phase_tags` | Phase 태그 목록 |
| `preview_rollback` | 롤백 미리보기 |
| `selective_rollback` | 선택적 롤백 |
| `rollback_to_phase` | Phase로 롤백 |
| `get_rollback_targets` | 롤백 대상 목록 |

### Prompt Tools
| Tool | Description |
|------|-------------|
| `generate_worker_prompt` | 워커 프롬프트 생성 |
| `generate_swarm_orchestrator_prompt` | Swarm 오케스트레이터 프롬프트 |
| `generate_pipeline_orchestrator_prompt` | Pipeline 오케스트레이터 프롬프트 |
| `generate_executor_loop_prompt` | 실행 루프 프롬프트 |

### Pipeline Tools
| Tool | Description |
|------|-------------|
| `create_pipeline_preset` | 프리셋 파이프라인 생성 |
| `parse_pipeline_string` | 파이프라인 문자열 파싱 |
| `list_pipeline_presets` | 프리셋 목록 (review, implement, debug, research, refactor, security) |

### Delegation Tools
| Tool | Description |
|------|-------------|
| `detect_task_category` | 태스크 카테고리 감지 |
| `route_task` | 태스크 라우팅 |
| `route_by_complexity` | 복잡도 기반 라우팅 |
| `list_delegation_categories` | 카테고리 목록 |

## .planning Directory

프로젝트 초기화 후 생성되는 구조:

```
.planning/
├── PROJECT.md              # 프로젝트 정의
│   ├── name, version, core_value
│   ├── Requirements (Validated/Active/OutOfScope)
│   ├── Context, Constraints
│   └── Key Decisions
│
├── ROADMAP.md              # 페이즈 로드맵
│   ├── Phase 1: Foundation
│   ├── Phase 2: Core Features
│   └── Phase N: ...
│
├── REQUIREMENTS.md         # 상세 요구사항
├── STATE.md                # 현재 상태
│
├── phases/
│   ├── 01-foundation/
│   │   ├── 01-RESEARCH.md      # 페이즈 리서치
│   │   ├── 01-01-PLAN.md       # 플랜 1
│   │   ├── 01-01-SUMMARY.md    # 플랜 1 요약
│   │   └── 01-02-PLAN.md       # 플랜 2
│   │
│   └── 02-core/
│       └── ...
│
├── research/               # 프로젝트 리서치
│   ├── TECH-STACK.md
│   ├── PATTERNS.md
│   └── SUMMARY.md
│
└── notepads/
    └── _project/
        ├── learnings.md    # 축적된 학습
        ├── decisions.md    # 축적된 결정
        └── issues.md       # 축적된 이슈
```

## Testing

```bash
# 전체 테스트
npm test

# E2E 시나리오 테스트
npm test -- tests/integration/e2e-full-scenario.test.ts

# 특정 모듈 테스트
npm test -- src/context/
npm test -- src/hints/
```

**테스트 결과:**
```
Test Files  11 passed (11)
     Tests  247 passed (247)
```

## Integration with GSD/OMC

Ultra Planner는 GSD(Get Shit Done)와 OMC(oh-my-claudecode) 패턴을 통합:

### GSD 통합
- `/thorough` - GSD 스타일 자동 실행
- Atomic commits per task
- Phase completion with checkpoints
- Deviation handling (Level 1-3)

### OMC 통합
- `oh-my-claudecode:executor` 에이전트 지원
- `oh-my-claudecode:architect` 검증 지원
- Delegation categories (quick, standard, complex, ultrabrain, visual-engineering, artistry, writing)

## Version History

### v3.0 - Context Architect Pattern (Current)
- Context collection, injection, compaction
- Hints with `isHint: true` (AI decides, not rules)
- Removed state management (Claude Code handles)
- Simplified swarm/pipeline to prompt generation only
- 247 tests (11 test files)

### v2.0 - Multi-agent Orchestration
- Swarm pattern for parallel execution
- Pipeline pattern with 6 presets
- Deviation handling
- Spike phase for uncertainty
- Complexity estimation

### v1.0 - Foundation
- Basic planning workflow
- PLAN.md format
- Wave-based execution

## Philosophy

> **"Claude Code는 계속 발전한다. 우리는 발전을 따라가는 게 아니라, 발전 위에 올라타는 것이다."**

Ultra Planner는 Claude Code의 **"기억"과 "지혜"** 역할을 합니다:
- 컨텍스트를 수집하고 주입
- 힌트를 제공하되 결정은 AI에게
- 지혜를 축적하여 세션 간 지속
- 실행은 항상 Claude Code의 네이티브 기능으로

## License

MIT

---

*Made with Ultra Planner v3.0 - Context Architect*
