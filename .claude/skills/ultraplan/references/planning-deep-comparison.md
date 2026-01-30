# Planning 시스템 심층 비교: Ultra Planner vs Claude 순정

## 현재 Ultra Planner Planning 워크플로우

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    ULTRA PLANNER - PLANNING WORKFLOW                            │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ 1. RESEARCHER (ultraplan-researcher)                                    │   │
│  │    • Opus 모델                                                          │   │
│  │    • 도메인/기술 스택 조사                                               │   │
│  │    • Output: RESEARCH.md                                                │   │
│  └────────────────────────────────────┬────────────────────────────────────┘   │
│                                       │                                         │
│                                       ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ 2. PLANNER (ultraplan-planner) — 1,700+ lines                           │   │
│  │    • Opus 모델                                                          │   │
│  │    • 한글 인터뷰 (AskUserQuestion 사용)                                  │   │
│  │    • Goal-Backward 방법론                                               │   │
│  │    • Output: PROJECT.md, ROADMAP.md, STATE.md                           │   │
│  │    • (Phase Planning 시) Output: PLAN.md with XML tasks                 │   │
│  └────────────────────────────────────┬────────────────────────────────────┘   │
│                                       │                                         │
│                                       ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ 3. RALPLAN CONSENSUS LOOP                                               │   │
│  │                                                                         │   │
│  │    ┌──────────┐    ┌───────────┐    ┌────────┐                         │   │
│  │    │ Planner  │───▶│ Architect │───▶│ Critic │                         │   │
│  │    └──────────┘    └───────────┘    └────────┘                         │   │
│  │         ▲                               │                               │   │
│  │         │       NOT SATISFIED           │                               │   │
│  │         └───────────────────────────────┘                               │   │
│  │                                                                         │   │
│  │    • 최대 5회 반복 (src/orchestration/ralplan/orchestrator.ts)          │   │
│  │    • Architect: APPROVED / ISSUES FOUND                                │   │
│  │    • Critic: SATISFIED / NOT SATISFIED                                  │   │
│  │    • 강제 승인: maxIterations 도달 시                                   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Planner Agent 비교

### Ultra Planner (ultraplan-planner.md)

**특징 (1,700+ lines):**

| 기능 | 구현 내용 |
|------|----------|
| **언어** | 모든 응답 한글 (강제) |
| **인터뷰** | AskUserQuestion 도구로 구조화된 선택지 |
| **질문 방식** | ONE question at a time (필수) |
| **방법론** | Goal-Backward (목표에서 역방향 유도) |
| **문서 템플릿** | PROJECT.md, ROADMAP.md, STATE.md, PLAN.md |
| **Task 포맷** | XML (`<task><name><files><action><verify><done></task>`) |
| **Wave 시스템** | 의존성 기반 병렬 실행 그룹화 |
| **must_haves** | truths, artifacts, key_links 3요소 |
| **REQ-XX** | 요구사항 ID 체계 |

**코드 예시 (인터뷰):**
```javascript
// AskUserQuestion 사용 (필수)
AskUserQuestion({
  questions: [{
    question: "어떤 종류의 프로젝트인가요?",
    header: "프로젝트 유형",
    options: [
      {label: "REST API", description: "HTTP 엔드포인트가 있는 백엔드 API"},
      {label: "CLI 도구", description: "커맨드라인 애플리케이션"},
      ...
    ],
    multiSelect: false
  }]
})
```

### Claude "Plan" 내장 Agent

**특징:**
```javascript
Task({
  subagent_type: "Plan",  // 내장 타입
  description: "Design implementation",
  prompt: "Plan the architecture for..."
})
```

| 기능 | 내장 지원 |
|------|----------|
| **언어** | 영어 기본 (한글 프롬프트 가능) |
| **인터뷰** | ❌ 없음 (단일 프롬프트) |
| **질문 방식** | ❌ 인터뷰 없음 |
| **방법론** | 일반적 (프롬프트 의존) |
| **문서 템플릿** | ❌ 없음 |
| **Task 포맷** | ❌ 없음 |
| **Wave 시스템** | ❌ 없음 |
| **must_haves** | ❌ 없음 |
| **도구 접근** | Read-only (Read, Glob, Grep) |

### 비교 결론

| 항목 | Ultra Planner | Claude Plan |
|------|---------------|-------------|
| **인터뷰 흐름** | ✅ 상세 (5-7 질문) | ❌ 없음 |
| **한글 지원** | ✅ 네이티브 | ⚠️ 프롬프트 의존 |
| **문서 표준화** | ✅ 엄격한 템플릿 | ❌ 자유 형식 |
| **Task 구조** | ✅ XML 스키마 | ❌ 없음 |
| **Goal-Backward** | ✅ 명시적 | ❌ 없음 |
| **설정 복잡도** | 높음 (1,700 lines) | 없음 |

**결론: ultraplan-planner 유지 (대체 불가)**

---

## 2. Architect Agent 비교

### Ultra Planner (ultraplan-architect.md)

**특징 (~700 lines):**

| 기능 | 구현 내용 |
|------|----------|
| **역할** | Verification Gatekeeper |
| **모델** | Opus |
| **도구** | Read-only (Read, Glob, Grep, Bash) |
| **입력** | Task XML + Executor Result YAML |
| **출력** | APPROVED / REJECTED + 상세 피드백 |
| **검증 프로토콜** | 4단계 (Criteria 이해 → 독립 검증 → 코드 리뷰 → 증거 매칭) |
| **PLAN-REVIEW 모드** | 실행 전 Plan 검토 |

**출력 포맷:**
```yaml
verdict: APPROVED | REJECTED
task_name: "Task N: Descriptive name"
verification_checks:
  - check: "Files exist"
    result: pass | fail
    details: "..."
done_assessment: |
  Detailed analysis...
feedback: |
  Actionable feedback...
confidence: high | medium | low
```

### Claude 순정 검증 패턴

Claude에는 **내장 Architect agent가 없음**. 대신:

**일반 Task로 검증:**
```javascript
Task({
  subagent_type: "general-purpose",
  model: "opus",
  prompt: "Verify the following task was completed correctly..."
})
```

**출력:** 자유 형식 (표준화 없음)

### 비교 결론

| 항목 | ultraplan-architect | Claude 일반 검증 |
|------|---------------------|------------------|
| **구조화된 입출력** | ✅ YAML 스키마 | ❌ 자유 형식 |
| **검증 체크리스트** | ✅ 4단계 프로토콜 | ❌ 없음 |
| **PLAN-REVIEW 모드** | ✅ 있음 | ❌ 없음 |
| **Actionable 피드백** | ✅ 템플릿화 | ⚠️ 품질 일정치 않음 |
| **READ-ONLY 강제** | ✅ 도구 제한 | ❌ 설정 필요 |

**결론: ultraplan-architect 유지 (대체 불가)**

---

## 3. Critic Agent 비교

### Ultra Planner (ultraplan-critic.md)

**특징 (~260 lines):**

| 기능 | 구현 내용 |
|------|----------|
| **역할** | Devil's Advocate |
| **모델** | Opus |
| **도구** | Read-only (Read, Glob, Grep) |
| **출력** | SATISFIED / NOT SATISFIED |
| **비평 카테고리** | Assumptions, Risks, Coverage Gaps, Feasibility |
| **심각도** | low / medium / high |

**독특한 가치:**
- Planner와 Architect의 **groupthink 방지**
- 실행 전 **리스크 식별**
- **가정(assumptions) 도전**

### Claude 순정

**내장 Critic agent 없음.**

일반 Task로 비평:
```javascript
Task({
  subagent_type: "general-purpose",
  prompt: "Critique this plan and find weaknesses..."
})
```

### 비교 결론

| 항목 | ultraplan-critic | Claude 일반 비평 |
|------|------------------|------------------|
| **전용 역할** | ✅ Devil's Advocate | ❌ 범용 |
| **구조화된 출력** | ✅ SATISFIED/NOT SATISFIED | ❌ 자유 형식 |
| **비평 카테고리** | ✅ 4가지 체계 | ❌ 없음 |
| **심각도 분류** | ✅ low/medium/high | ❌ 없음 |
| **Consensus 프로토콜** | ✅ 명확한 기준 | ❌ 없음 |

**결론: ultraplan-critic 유지 (Claude에 없는 기능)**

---

## 4. Ralplan Loop 비교

### Ultra Planner 현재 구현

**src/orchestration/ralplan/orchestrator.ts:**
```typescript
// 순차 실행 (현재)
while (iteration < MAX_ITERATIONS) {
    const architectResult = await Task(architect);  // 대기
    if (architectResult === "ISSUES FOUND") {
        await Task(planner, feedback);  // 대기
        continue;
    }

    const criticResult = await Task(critic);  // 대기
    if (criticResult === "SATISFIED") {
        break;  // 합의 도달
    }

    await Task(planner, feedback);  // 대기
}
```

**특징:**
- 순차 실행 (Architect → Critic → Planner 반복)
- 한 번에 하나의 Agent만 실행
- 상태 관리: `getRalplanState()`, `advanceIteration()`

### TeammateTool 병렬화 (가능)

```javascript
// 팀 생성
Teammate({ operation: "spawnTeam", team_name: "ralplan-review" })

// Architect + Critic 동시 스폰
Task({
  team_name: "ralplan-review",
  name: "architect",
  subagent_type: "ultraplan-architect",
  prompt: "Review plans...",
  run_in_background: true
})

Task({
  team_name: "ralplan-review",
  name: "critic",
  subagent_type: "ultraplan-critic",
  prompt: "Critique plans...",
  run_in_background: true
})

// Inbox에서 결과 수집
const inbox = await readInbox("team-lead");
// → Architect, Critic 결과 동시 수신

// 합의 판단
if (architect.approved && critic.satisfied) {
  consensus = true;
}
```

### 비교

| 항목 | 현재 (순차) | TeammateTool (병렬) |
|------|------------|---------------------|
| **실행 시간** | ~100% | ~50% (절반) |
| **구현 복잡도** | 낮음 | 높음 (Inbox 관리) |
| **디버깅** | 쉬움 (순차) | 어려움 (비동기) |
| **에러 처리** | 단순 | 복잡 |
| **피드백 흐름** | 명확 | 수동 병합 필요 |

### 결론

| 모드 | 권장 접근법 |
|------|------------|
| **MVP (속도 우선)** | ⭐ TeammateTool 병렬화 |
| **Detailed (품질 우선)** | ⭐ 현재 순차 방식 유지 |

**이유:**
- Detailed 모드에서는 Architect 피드백을 Critic이 참고해야 함
- MVP 모드에서는 속도가 중요하므로 동시 실행 후 결과 병합

---

## 5. Interview System 비교

### Ultra Planner (AskUserQuestion)

```javascript
// 구조화된 선택지 질문 (클릭 가능 UI)
AskUserQuestion({
  questions: [{
    question: "어떤 종류의 프로젝트인가요?",
    header: "프로젝트 유형",
    options: [
      {label: "REST API", description: "설명..."},
      {label: "CLI 도구", description: "설명..."},
    ],
    multiSelect: false
  }]
})
```

**장점:**
- 클릭 가능한 UI
- 일관된 응답 포맷
- 빠른 사용자 응답
- 다중 선택 지원

### Claude 순정 질문

```javascript
// 자유 형식 질문
Task({
  prompt: "What type of project is this? (REST API, CLI, Web App, Library)"
})
```

**또는 Orchestrator가 직접:**
```
사용자에게: "어떤 종류의 프로젝트인가요?"
```

**단점:**
- 텍스트 입력 필요
- 파싱 필요
- 오타/변형 처리 필요

### 결론

| 항목 | AskUserQuestion | 자유 텍스트 |
|------|-----------------|-------------|
| **UX** | ✅ 클릭 UI | ❌ 타이핑 |
| **응답 일관성** | ✅ 표준화 | ❌ 파싱 필요 |
| **속도** | ✅ 빠름 | ⚠️ 느림 |
| **유연성** | ⚠️ 2-4 옵션 제한 | ✅ 무제한 |

**결론: AskUserQuestion 유지 (Claude 순정 기능이지만 Ultra Planner가 잘 활용)**

---

## 6. 문서 템플릿 비교

### Ultra Planner 문서 체계

| 문서 | 목적 | 섹션 |
|------|------|------|
| **PROJECT.md** | 요구사항/제약조건 | Goal, REQ-XX, Constraints, Out of Scope |
| **ROADMAP.md** | Phase 구조 | Phase 목록, Dependencies (DAG), Progress |
| **STATE.md** | 진행 상황 | Current Position, Metrics, Session Continuity |
| **PLAN.md** | 실행 계획 | Tasks (XML), Waves, must_haves |

### Claude 순정

**문서 템플릿 없음.**

Planner가 자유 형식으로 출력.

### 결론

**Ultra Planner 문서 체계 유지 (Claude에 없는 기능)**

---

## 7. Task 포맷 비교

### Ultra Planner XML Task

```xml
<task type="auto">
  <name>Task 3: Implement PlannerId validation</name>
  <files>src/domain/PlannerId.ts, tests/PlannerId.test.ts</files>
  <action>
Create the PlannerId class with:
1. Constructor validation for UUID format
2. Date validation (not in future)
3. Version validation (positive integer)
  </action>
  <verify>npm test -- PlannerId && npm run type-check</verify>
  <done>PlannerId class exists with full validation, all tests pass</done>
</task>
```

**장점:**
- 파싱 용이 (XML)
- 명확한 필드 분리
- 자동화 가능 (MCP parse_plan)
- Wave 할당과 연동

### Claude Tasks API

```javascript
TaskCreate({
  subject: "Implement PlannerId validation",
  description: "Create PlannerId class with validation...",
  activeForm: "Implementing PlannerId...",
  metadata: {
    files: ["src/domain/PlannerId.ts"],
    verify: "npm test -- PlannerId"
  }
})
```

**장점:**
- 실시간 UI 표시
- 의존성 자동 관리 (blockedBy)
- 상태 추적 내장

### 결론

| 용도 | 권장 |
|------|------|
| **Plan 문서 저장** | ⭐ XML Task (영속성) |
| **실행 시 등록** | ⭐ Claude Tasks API (실시간) |

**통합 방식:**
1. PLAN.md에 XML Task 저장 (영속)
2. 실행 시 XML → Claude Tasks API 변환 (실시간)

---

## 종합 비교표

| 컴포넌트 | Ultra Planner | Claude 순정 | 권장 |
|----------|---------------|-------------|------|
| **Planner Agent** | ✅ 상세 인터뷰, 한글, 템플릿 | ❌ 범용 Plan | **Ultra Planner** |
| **Architect Agent** | ✅ 구조화된 검증 | ❌ 없음 | **Ultra Planner** |
| **Critic Agent** | ✅ Devil's Advocate | ❌ 없음 | **Ultra Planner** |
| **Ralplan Loop** | 순차 실행 | TeammateTool 병렬 | **모드별 선택** |
| **Interview** | ✅ AskUserQuestion | 자유 텍스트 | **Ultra Planner** |
| **문서 템플릿** | ✅ PROJECT/ROADMAP/PLAN | ❌ 없음 | **Ultra Planner** |
| **Task 포맷** | ✅ XML 스키마 | Claude Tasks | **하이브리드** |
| **Task 등록** | MCP 도구 | ✅ TaskCreate | **Claude Tasks** |
| **의존성** | MCP + 수동 | ✅ addBlockedBy | **Claude Tasks** |
| **상태 추적** | 파일 기반 | ✅ 실시간 | **하이브리드** |

---

## 최종 권장 아키텍처

### Planning Phase

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         PLANNING (유지: Ultra Planner)                          │
│                                                                                 │
│  ultraplan-researcher → ultraplan-planner → Ralplan Loop                        │
│                         (AskUserQuestion)    (Architect + Critic)               │
│                                                                                 │
│  Output: PROJECT.md, ROADMAP.md, PLAN.md (XML tasks)                           │
│                                                                                 │
│  ⚠️ Claude 순정으로 대체 불가 (한글, 인터뷰, 템플릿, must_haves 등)              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Execution Phase

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         EXECUTION (통합: Claude 순정)                            │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ 1. Parse PLAN.md (MCP parse_plan)                                       │   │
│  │    → XML tasks 추출                                                     │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                         │
│                                       ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ 2. Register Tasks (Claude Tasks API) ◀── ⭐ 순정 사용                    │   │
│  │    TaskCreate() + TaskUpdate(addBlockedBy)                              │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                         │
│                                       ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ 3. Execute (MVP: TeammateTool Swarm / Detailed: 순차)                   │   │
│  │    ultraplan-executor (5워커) + ultraplan-architect (검증)              │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                         │
│                                       ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ 4. State Sync (하이브리드)                                               │   │
│  │    • 실시간: Claude Tasks (TaskUpdate status)                           │   │
│  │    • 영속: PLAN.md frontmatter 백업                                     │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 검증 필요 항목

| 항목 | 테스트 방법 | 우려사항 |
|------|------------|----------|
| TeammateTool Ralplan 병렬화 | Architect+Critic 동시 스폰 | 결과 병합 복잡도 |
| Claude Tasks 대규모 등록 | 50+ tasks 등록 | 성능/지연 |
| Inbox 메시지 신뢰성 | 장시간 실행 | 메시지 유실 |
| 하이브리드 상태 동기화 | Tasks ↔ PLAN.md | 불일치 |

---
*Last updated: 2026-01-30*
