# Ultra Planner 워크플로우 + Claude 순정 기능 통합 맵

각 시나리오별 현재 구현 vs Claude 순정 기능 대체 가능 영역을 분석합니다.

---

## 시나리오 1: `/ultraplan:new-project`

### 현재 워크플로우

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ /ultraplan:new-project                                                       │
│                                                                              │
│  Step 1: CHECK EXISTING STATE                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ • ls .planning/PROJECT.md                                           │    │
│  │ • 이미 존재하면 WARN + STOP                                          │    │
│  │                                                                     │    │
│  │ [현재 구현] Bash + 조건 분기                                         │    │
│  │ [대체 가능] 없음 (단순 파일 체크)                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                               │                                              │
│                               ▼                                              │
│  Step 2: RESEARCH PHASE                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ • Task(subagent_type="ultraplan-researcher")                        │    │
│  │ • 도메인 + 기술 스택 조사                                             │    │
│  │ • 출력: .planning/research/PROJECT-RESEARCH.md                      │    │
│  │                                                                     │    │
│  │ [현재 구현] Custom ultraplan-researcher agent                       │    │
│  │ [대체 가능] Claude 순정 "Explore" agent로 대체 가능                   │    │
│  │            BUT: 커스텀 출력 포맷 필요하면 유지                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                               │                                              │
│                               ▼                                              │
│  Step 3: PLANNER INTERVIEW                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ • Task(subagent_type="ultraplan-planner")                           │    │
│  │ • AskUserQuestion으로 5-7개 질문                                     │    │
│  │ • 출력: PROJECT.md, ROADMAP.md, STATE.md                            │    │
│  │                                                                     │    │
│  │ [현재 구현] Custom ultraplan-planner agent                          │    │
│  │ [대체 가능] Claude 순정 "Plan" agent 부분 활용 가능                   │    │
│  │            BUT: 한글 인터뷰 + 특정 문서 포맷 필요하면 유지             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                               │                                              │
│                               ▼                                              │
│  Step 4: RALPLAN CONSENSUS LOOP                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                                                                     │    │
│  │  ┌──────────┐    ┌───────────┐    ┌────────┐                       │    │
│  │  │ Planner  │───▶│ Architect │───▶│ Critic │                       │    │
│  │  └──────────┘    └───────────┘    └────────┘                       │    │
│  │       ▲                               │                             │    │
│  │       │         NOT SATISFIED         │                             │    │
│  │       └───────────────────────────────┘                             │    │
│  │                                                                     │    │
│  │ [현재 구현] src/orchestration/ralplan/orchestrator.ts               │    │
│  │            3개 Agent 순차 호출 + 상태 관리                           │    │
│  │                                                                     │    │
│  │ [대체 가능] ⭐ TeammateTool로 병렬화 가능!                            │    │
│  │            Team("ralplan") → Architect + Critic 동시 스폰            │    │
│  │            Inbox로 결과 수집 → 합의 판단                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                               │                                              │
│                               ▼                                              │
│  Step 5: OUTPUT SUMMARY                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ • 생성된 문서 요약                                                   │    │
│  │ • 다음 단계 안내                                                     │    │
│  │                                                                     │    │
│  │ [현재 구현] 텍스트 출력                                              │    │
│  │ [대체 가능] 없음                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 대체 권장 사항

| 단계 | 현재 | 권장 | 이유 |
|------|------|------|------|
| Research | ultraplan-researcher | **유지** | 커스텀 출력 포맷 |
| Planner | ultraplan-planner | **유지** | 한글 인터뷰, 특정 문서 구조 |
| Ralplan | 순차 Task() 호출 | ⭐ **TeammateTool** | Architect+Critic 병렬 실행 가능 |
| State | src/state/state-manager.ts | **유지** | 파일 기반 상태 관리 더 견고 |

---

## 시나리오 2: `/ultraplan:plan-phase N`

### 현재 워크플로우

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ /ultraplan:plan-phase 1                                                      │
│                                                                              │
│  Step 1: VALIDATE PREREQUISITES                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ • test -f .planning/ROADMAP.md                                      │    │
│  │ • test -f .planning/PROJECT.md                                      │    │
│  │ • grep "Phase 1:" .planning/ROADMAP.md                              │    │
│  │                                                                     │    │
│  │ [현재 구현] Bash 스크립트                                            │    │
│  │ [대체 가능] 없음                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                               │                                              │
│                               ▼                                              │
│  Step 2: PHASE RESEARCH                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ • Task(subagent_type="ultraplan-researcher")                        │    │
│  │ • Phase에 필요한 기술/API 조사                                       │    │
│  │ • 출력: .planning/phases/01-{name}/01-RESEARCH.md                   │    │
│  │                                                                     │    │
│  │ [현재 구현] Custom ultraplan-researcher                             │    │
│  │ [대체 가능] ⭐ TeammateTool로 여러 Research 병렬 가능                 │    │
│  │            예: API docs, codebase patterns, best practices 동시 조사 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                               │                                              │
│                               ▼                                              │
│  Step 3: LOAD CONTEXT                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ • Read PROJECT.md, ROADMAP.md, STATE.md                             │    │
│  │ • Extract phase goal, success criteria, dependencies                │    │
│  │                                                                     │    │
│  │ [현재 구현] src/sync/plan-parser.ts                                 │    │
│  │ [대체 가능] 없음 (파싱 로직 유지 필요)                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                               │                                              │
│                               ▼                                              │
│  Step 4: PLANNER GENERATES PLAN.md                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ • Task(subagent_type="ultraplan-planner", mode="PHASE-PLANNING")    │    │
│  │ • Phase를 2-3개 PLAN.md로 분할                                       │    │
│  │ • Wave 할당, 의존성 계산                                             │    │
│  │                                                                     │    │
│  │ [현재 구현] Custom ultraplan-planner                                │    │
│  │ [대체 가능] 부분적으로 Claude "Plan" agent 활용 가능                  │    │
│  │            BUT: XML task 포맷, Wave 시스템 필요하면 유지              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                               │                                              │
│                               ▼                                              │
│  Step 5: RALPLAN CONSENSUS LOOP                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ (시나리오 1과 동일)                                                  │    │
│  │                                                                     │    │
│  │ [현재 구현] src/orchestration/ralplan/                              │    │
│  │ [대체 가능] ⭐ TeammateTool로 병렬화                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                               │                                              │
│                               ▼                                              │
│  Step 6: REGISTER TASKS (NEW!)                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ • PLAN.md의 Task들을 Claude Tasks API에 등록                        │    │
│  │ • Wave → blockedBy 매핑                                             │    │
│  │                                                                     │    │
│  │ [현재 구현] src/sync/task-mapper.ts (구조체 생성만)                  │    │
│  │ [대체 가능] ⭐⭐ Claude Tasks API 직접 사용!                          │    │
│  │            TaskCreate(), TaskUpdate(addBlockedBy)                   │    │
│  │            기존 MCP 도구 대신 순정 도구 사용                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 대체 권장 사항

| 단계 | 현재 | 권장 | 이유 |
|------|------|------|------|
| Research | 단일 researcher | ⭐ **TeammateTool** | 여러 리서치 병렬 |
| Planner | ultraplan-planner | **유지** | XML task, Wave 시스템 |
| Ralplan | 순차 호출 | ⭐ **TeammateTool** | 병렬 검증 |
| Task 등록 | MCP generate_task_creates | ⭐⭐ **Claude Tasks API** | 순정 기능이 더 효율적 |

---

## 시나리오 3: `/ultraplan:execute 01-01`

### 현재 워크플로우

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ /ultraplan:execute 01-01                                                     │
│                                                                              │
│  Step 1: RESOLVE PLAN PATH                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ • "01-01" → ".planning/phases/01-core/01-01-PLAN.md"                │    │
│  │                                                                     │    │
│  │ [현재 구현] Bash 경로 해석                                           │    │
│  │ [대체 가능] 없음                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                               │                                              │
│                               ▼                                              │
│  Step 2: PARSE PLAN + BUILD QUEUE                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ • gray-matter로 frontmatter 파싱                                    │    │
│  │ • XML task 블록 추출                                                │    │
│  │ • Wave 기반 의존성 맵 생성                                           │    │
│  │                                                                     │    │
│  │ [현재 구현] src/sync/plan-parser.ts                                 │    │
│  │            src/sync/dependency-map.ts                               │    │
│  │ [대체 가능] 파싱은 유지, 의존성은 Claude Tasks로 이관 가능            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                               │                                              │
│                               ▼                                              │
│  Step 3: REGISTER TASKS IN CLAUDE TASKS                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 현재:                                                               │    │
│  │ • MCP tool: mcp__ultra-planner__generate_task_creates()             │    │
│  │ • 구조체 생성 → Orchestrator가 TaskCreate 호출                       │    │
│  │                                                                     │    │
│  │ [현재 구현] 2단계 (MCP → Claude)                                     │    │
│  │ [대체 가능] ⭐⭐ 직접 TaskCreate() 호출!                               │    │
│  │                                                                     │    │
│  │ 권장:                                                               │    │
│  │ for (const task of parsedTasks) {                                   │    │
│  │   TaskCreate({                                                      │    │
│  │     subject: task.name,                                             │    │
│  │     description: task.action,                                       │    │
│  │     activeForm: `Executing ${task.name}`,                           │    │
│  │     metadata: { wave: task.wave, files: task.files }                │    │
│  │   });                                                               │    │
│  │ }                                                                   │    │
│  │                                                                     │    │
│  │ // Wave 의존성 설정                                                  │    │
│  │ TaskUpdate({ taskId: "3", addBlockedBy: ["1", "2"] });              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                               │                                              │
│                               ▼                                              │
│  Step 4: EXECUTION LOOP                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 현재 (순차 실행):                                                    │    │
│  │ for (task of queue) {                                               │    │
│  │   Task(subagent_type="ultraplan-executor", prompt=task)             │    │
│  │   await result;                                                     │    │
│  │   Task(subagent_type="ultraplan-architect", prompt=verify)          │    │
│  │   await verification;                                               │    │
│  │   commitAtomically();                                               │    │
│  │ }                                                                   │    │
│  │                                                                     │    │
│  │ [현재 구현] 순차 Executor → Architect                                │    │
│  │ [대체 가능] ⭐⭐⭐ TeammateTool + Claude Tasks = SWARM!                │    │
│  │                                                                     │    │
│  │ 권장 (Swarm 실행):                                                   │    │
│  │ // 1. 팀 생성                                                        │    │
│  │ Teammate({ operation: "spawnTeam", team_name: "exec-01-01" })       │    │
│  │                                                                     │    │
│  │ // 2. Executor Swarm 스폰 (5워커)                                    │    │
│  │ for (i of [1,2,3,4,5]) {                                            │    │
│  │   Task({                                                            │    │
│  │     team_name: "exec-01-01",                                        │    │
│  │     name: `executor-${i}`,                                          │    │
│  │     subagent_type: "ultraplan-executor",                            │    │
│  │     prompt: SWARM_EXECUTOR_PROMPT,                                  │    │
│  │     run_in_background: true                                         │    │
│  │   })                                                                │    │
│  │ }                                                                   │    │
│  │                                                                     │    │
│  │ // 3. Executor들이 TaskList() → 클레임 → 실행 → 완료                 │    │
│  │ // 4. Wave 의존성 자동 언블록 (Claude Tasks가 관리)                   │    │
│  │ // 5. Architect가 완료 알림 받고 검증                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                               │                                              │
│                               ▼                                              │
│  Step 5: ATOMIC COMMIT                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ • 각 Task 완료마다 git commit                                        │    │
│  │                                                                     │    │
│  │ [현재 구현] src/git/commit.ts (simple-git)                          │    │
│  │ [대체 가능] 없음 (유지 필요)                                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                               │                                              │
│                               ▼                                              │
│  Step 6: SYNC STATE                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 현재:                                                               │    │
│  │ • PLAN.md frontmatter task_states 업데이트                          │    │
│  │ • STATE.md progress 업데이트                                        │    │
│  │ • MCP tool로 상태 동기화                                             │    │
│  │                                                                     │    │
│  │ [현재 구현] src/sync/status-sync.ts                                 │    │
│  │ [대체 가능] ⭐ Claude Tasks 상태를 Source of Truth로!                 │    │
│  │                                                                     │    │
│  │ 권장:                                                               │    │
│  │ // Claude Tasks가 실시간 상태 관리                                   │    │
│  │ TaskUpdate({ taskId, status: "completed" })                         │    │
│  │                                                                     │    │
│  │ // 세션 종료 시 또는 주기적으로 PLAN.md에 백업                        │    │
│  │ syncTaskStatesToPlanMd(planPath);                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 대체 권장 사항

| 단계 | 현재 | 권장 | 이유 |
|------|------|------|------|
| Plan 파싱 | MCP parse_plan | **유지** | XML 파싱 로직 필요 |
| Task 등록 | MCP generate_task_creates | ⭐⭐ **Claude Tasks** | 직접 TaskCreate 호출 |
| 의존성 | MCP build_dependency_map | ⭐⭐ **Claude Tasks** | addBlockedBy 사용 |
| 실행 루프 | 순차 Task() 호출 | ⭐⭐⭐ **TeammateTool Swarm** | 5x 병렬 실행 |
| 상태 관리 | PLAN.md frontmatter | ⭐ **Claude Tasks** | 실시간 상태 + 백업 |
| Git 커밋 | simple-git | **유지** | Atomic commit 로직 |

---

## 통합 아키텍처 제안

### Before (현재)

```
┌─────────────────────────────────────────────────────────────┐
│                    현재 Ultra Planner                        │
│                                                             │
│  Orchestrator (Claude)                                      │
│       │                                                     │
│       ├─── MCP Server ─── parse_plan()                      │
│       │                   extract_task_mappings()           │
│       │                   generate_task_creates()           │
│       │                   build_dependency_map()            │
│       │                                                     │
│       ├─── Task() ─── ultraplan-researcher (순차)           │
│       │              ultraplan-planner (순차)               │
│       │              ultraplan-architect (순차)             │
│       │              ultraplan-executor (순차)              │
│       │                                                     │
│       └─── State Files ─── .ultraplan/state/*.json          │
│                           PLAN.md frontmatter               │
│                           STATE.md                          │
└─────────────────────────────────────────────────────────────┘
```

### After (Claude 순정 기능 통합)

```
┌─────────────────────────────────────────────────────────────┐
│               Ultra Planner + Claude Native                  │
│                                                             │
│  Orchestrator (Claude)                                      │
│       │                                                     │
│       ├─── MCP Server ─── parse_plan() (파싱만)             │
│       │                   add_learning/decision/issue()     │
│       │                   get_wisdom()                      │
│       │                                                     │
│       ├─── Claude Tasks API ◀── ⭐ NEW!                      │
│       │       TaskCreate()      태스크 등록                  │
│       │       TaskUpdate()      상태 + 의존성                │
│       │       TaskList()        진행 상황                    │
│       │       TaskGet()         상세 조회                    │
│       │                                                     │
│       ├─── TeammateTool ◀── ⭐⭐ NEW!                         │
│       │       spawnTeam()       팀 생성                      │
│       │       Task(team, bg)    워커 스폰                    │
│       │       write()           팀원 통신                    │
│       │       cleanup()         정리                        │
│       │                                                     │
│       ├─── Task() ─── ultraplan-planner (커스텀 유지)        │
│       │              ultraplan-executor (Swarm용)           │
│       │              ultraplan-architect (Monitor용)        │
│       │                                                     │
│       └─── State Files ─── PLAN.md (백업용)                 │
│                           STATE.md (요약용)                  │
│                           .omc/notepads/ (학습)             │
└─────────────────────────────────────────────────────────────┘
```

---

## 기능별 책임 분리

### Claude Tasks API 담당

```
┌─────────────────────────────────────────────┐
│ Claude Tasks API                            │
├─────────────────────────────────────────────┤
│ ✅ 태스크 등록 (TaskCreate)                  │
│ ✅ 의존성 관리 (addBlockedBy)                │
│ ✅ 상태 추적 (pending→in_progress→completed) │
│ ✅ 자동 언블록 (의존 태스크 완료 시)          │
│ ✅ 소유권 관리 (owner 필드)                  │
│ ✅ 실시간 진행 상황 (TaskList)               │
└─────────────────────────────────────────────┘
```

### TeammateTool 담당

```
┌─────────────────────────────────────────────┐
│ TeammateTool                                │
├─────────────────────────────────────────────┤
│ ✅ 병렬 워커 스폰 (Executor Swarm)           │
│ ✅ 백그라운드 실행 (run_in_background)       │
│ ✅ 팀원 간 통신 (Inbox 메시지)               │
│ ✅ Ralplan 병렬화 (Architect + Critic 동시)  │
│ ✅ Research 병렬화 (여러 소스 동시 조사)      │
│ ✅ Graceful shutdown                        │
└─────────────────────────────────────────────┘
```

### MCP Server 담당 (유지)

```
┌─────────────────────────────────────────────┐
│ MCP Server (축소된 역할)                     │
├─────────────────────────────────────────────┤
│ ✅ PLAN.md 파싱 (XML task 추출)             │
│ ✅ Notepad 학습 시스템                       │
│ ✅ 컨텍스트 추정                             │
│ ❌ Task 등록 → Claude Tasks로 이관          │
│ ❌ 의존성 맵 → Claude Tasks로 이관          │
│ ❌ 진행률 계산 → Claude Tasks로 이관        │
└─────────────────────────────────────────────┘
```

### Custom Agents 담당 (유지)

```
┌─────────────────────────────────────────────┐
│ Custom Agents (유지 이유)                    │
├─────────────────────────────────────────────┤
│ ultraplan-planner:                          │
│   ✅ 한글 인터뷰                             │
│   ✅ PROJECT/ROADMAP/PLAN.md 특정 포맷       │
│   ✅ XML task 구조 생성                      │
│   ✅ Wave 할당 로직                          │
│                                             │
│ ultraplan-executor:                         │
│   ✅ Task 실행 표준 프로토콜                  │
│   ✅ Atomic commit 통합                      │
│   ✅ Swarm 루프 로직                         │
│                                             │
│ ultraplan-architect:                        │
│   ✅ 검증 체크리스트                         │
│   ✅ MVP/Detailed 관용도 조절                │
│   ✅ Monitor 루프 로직                       │
│                                             │
│ ultraplan-researcher:                       │
│   ✅ RESEARCH.md 특정 포맷                   │
│   ✅ 병렬 리서치 조율                        │
└─────────────────────────────────────────────┘
```

---

## 마이그레이션 우선순위

### Phase 1: 즉시 적용 (저위험)

1. **execute 시 Claude Tasks API 사용**
   - TaskCreate로 직접 등록
   - TaskUpdate로 의존성 설정
   - MCP generate_task_creates 제거

2. **진행 상황을 Claude Tasks로 관리**
   - TaskList()로 실시간 조회
   - PLAN.md는 세션 종료 시 백업용

### Phase 2: 병렬화 (중위험)

3. **execute에 Executor Swarm 적용**
   - TeammateTool로 5워커 스폰
   - 순차 실행 → 병렬 실행

4. **Ralplan에 TeammateTool 적용**
   - Architect + Critic 동시 스폰
   - Inbox로 결과 수집

### Phase 3: 전체 통합 (선택)

5. **Research 병렬화**
   - 여러 researcher 동시 스폰
   - 결과 병합

6. **all-plan MVP 모드**
   - 전체 Swarm 실행

---

## 참고: 유지해야 할 이유

| 컴포넌트 | 유지 이유 |
|----------|----------|
| MCP parse_plan | XML task 파싱은 커스텀 로직 필요 |
| ultraplan-planner | 한글 인터뷰, 특정 문서 포맷 |
| Notepad 시스템 | 학습 축적은 Claude Tasks에 없음 |
| Git commit | Atomic commit은 별도 로직 필요 |
| PLAN.md/STATE.md | 세션 간 영속성, 사람이 읽을 수 있음 |

---
*Last updated: 2026-01-30*
