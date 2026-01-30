# Ultra Planning - 플랜 단계 개선 로드맵

*임시 저장: 2026-01-30*

---

## Part 1: 현존 최고가 되기 위한 부족한 부분

### 🔴 CRITICAL (필수 해결)

#### 1. 복잡도 추정 없음

```
현재: Task 나열만
필요: 각 Task의 예상 시간/난이도/토큰 비용 추정

<task wave="1">
  <name>Create API</name>
  <complexity>
    <time>30min</time>
    <difficulty>medium</difficulty>
    <tokens>~15k</tokens>
    <risk>low</risk>
  </complexity>
  <action>...</action>
</task>

영향:
- 현실적 일정 계획 불가
- 리소스 배분 최적화 불가
- MVP vs Detailed 모드 구분 기준 모호

해결책:
- Planner가 각 Task 생성 시 complexity 메타데이터 필수 추가
- 추정 기반: 파일 수, 변경 범위, 외부 의존성
```

#### 2. 의존성 분석 수동

```
현재: Planner가 수동으로 wave="1", wave="2" 지정
필요: 자동 의존성 그래프 생성

Task A (models)
  │
  ▼
Task B (service) ──┐
  │               │
  ▼               ▼
Task C (API)   Task D (CLI)

자동 산출:
- Critical Path: A→B→C
- 병렬 가능: C ∥ D
- 최소 소요: 3 waves

영향:
- 병렬화 최적화 불가
- 크리티컬 패스 파악 불가
- Swarm 실행 시 비효율

해결책:
- Task의 <files>와 import 분석으로 자동 의존성 추론
- DAG 생성 → 자동 Wave 할당
- Claude Tasks의 addBlockedBy 자동 매핑
```

#### 3. 리스크 관리 부재

```
현재: RESEARCH.md에서 리스크 언급만
필요: RISK-REGISTER.md

| ID   | Risk     | Impact | Prob |
|------|----------|--------|------|
| R-01 | API변경  | HIGH   | MED  |
| R-02 | 성능     | MED    | LOW  |

완화 전략:
- R-01: API 버전 고정
- R-02: 벤치마크 Task 추가

모니터링:
- 각 Phase 시작 시 리스크 재평가
- 새로운 리스크 자동 등록

영향:
- 프로젝트 실패 예측 불가
- 예방적 조치 불가
- 문제 발생 시 대응 지연

해결책:
- Critic 역할 확장: 리스크 식별 → 리스크 레지스터 생성
- ROADMAP.md에 Phase별 리스크 체크포인트 추가
- 실행 중 리스크 현실화 시 자동 알림
```

#### 4. 에이전트 간 강결합

```
현재:
ultraplan-architect.md: "Executor 출력 형식 기대..."
ultraplan-planner.md: "Critic 판정 형식 기대..."

필요:
shared/contracts/
├── executor-output.schema
├── architect-verdict.schema
└── critic-verdict.schema

각 에이전트는 스키마만 참조
→ 인터페이스 변경은 스키마만
→ 구현 독립성 보장

영향:
- 유지보수 어려움
- 새 에이전트 추가 시 기존 코드 파악 필요
- 버전 불일치 오류

해결책:
- Interface Contract 파일 분리
- 에이전트별 입출력 스키마 정의
- 런타임 스키마 검증 추가
```

---

### 🟡 IMPORTANT (품질 향상)

#### 5. 인터뷰 질문 고정적

```
현재: 표준 5-7개 질문 (모든 프로젝트 동일)
필요:
- 프로젝트 타입별 동적 질문
  ├── CLI → CLI 특화 질문
  ├── API → API 특화 질문
  └── UI → UI 특화 질문
- 동적 후속 질문
  "API 인증 필요" 응답 → "어떤 인증 방식?" 후속 질문
- 적응형 깊이
  - 초보자: 상세 설명 포함
  - 전문가: 핵심만

해결책:
- 프로젝트 타입별 질문 트리 구현
- 이전 답변 기반 동적 후속 질문
- 사용자 전문성 레벨 감지
```

#### 6. Ralplan 종료 조건 약함

```
현재:
- Architect: "APPROVED" (주관적)
- Critic: "SATISFIED" (주관적)

필요: 객관적 체크리스트:
□ 모든 REQ-XX가 Task에 매핑
□ 모든 Task에 verify 기준 존재
□ Wave 의존성 논리적 정합성
□ 추정 시간 합계 < 제한
□ 리스크 커버리지 100%
□ 테스트 전략 정의됨

체크리스트 통과 시에만 승인

해결책:
- 정량적 승인 기준 정의
- Architect/Critic에게 체크리스트 검증 의무화
- 불합격 항목 구체적 피드백 필수
```

#### 7. 요구사항 추적성 없음

```
현재:
PROJECT.md: REQ-01, REQ-02...
PLAN.md: Task 01, Task 02...
→ REQ ↔ Task 연결 불명확

필요: TRACEABILITY-MATRIX.md
| REQ   | Tasks    | Tests   |
|-------|----------|---------|
| REQ-01| T-01,T-02| UT-01   |
| REQ-02| T-03,T-04| UT-02,03|

커버리지: 100%
미매핑 REQ: 없음
미테스트 Task: 없음

해결책:
- Task XML에 <covers>REQ-01,REQ-02</covers> 필드 추가
- Planner가 Traceability Matrix 자동 생성
- 누락된 요구사항 자동 경고
```

#### 8. 테스트 전략 계획 없음

```
현재: 실행 단계에서 알아서...
필요: TEST-STRATEGY.md (계획 단계에서)

## 테스트 레벨
- Unit: 핵심 비즈니스 로직
- Integration: API 엔드포인트
- E2E: 주요 유저 플로우

## 커버리지 목표
- 코드: 80%
- 분기: 70%

## 테스트 Task 매핑
- T-01 → UT-01, UT-02
- T-03 → IT-01

해결책:
- Planner가 PLAN.md 생성 시 TEST-STRATEGY.md도 함께 생성
- 각 Task의 테스트 Task를 쌍으로 생성
- 테스트 커버리지 목표를 승인 기준에 포함
```

#### 9. Goal-Backward 미구현

```
현재: README에 언급만 ("Goal-Backward 방법론 사용")
실제: 순방향 Task 나열

필요: 실제 역산 알고리즘

[최종 목표]
    ↓ 무엇이 필요?
[선행 조건들]
    ↓ 이를 위해?
[더 선행 조건들]
    ↓
[시작점]

예시:
"프로덕션 배포" 목표 →
← "테스트 통과" 필요 →
← "기능 구현" 필요 →
← "설계" 필요 →
← "요구사항" 필요

해결책:
- Planner 프롬프트에 Goal-Backward 단계 명시적 추가
- 목표 → 선행조건 역산 템플릿 제공
- must_haves를 목표 기반으로 자동 도출
```

---

### 🟢 STRUCTURAL (구조 개선)

#### 10. 명령어 파일 복잡도

```
현재: ultraplan-new-project.md = 1,700+ lines
     (오케스트레이션 + 포맷팅 + 상태관리 혼재)

필요:
├── commands/
│   └── ultraplan-new-project.md (200 lines, 진입점만)
├── skills/ultraplan/
│   ├── orchestration/
│   │   └── new-project-flow.md
│   ├── formatting/
│   │   └── progress-display.md
│   └── state/
│       └── state-transitions.md
```

#### 11. 상태 분산

```
현재:
├── PLAN.md frontmatter (task_states)
├── STATE.md (진행 상황)
├── Claude Tasks (런타임 상태)
└── .ultraplan/state/*.json

필요:
└── 단일 진실의 원천 (Single Source of Truth)
    → Claude Tasks를 Primary로
    → STATE.md는 Human-Readable View로
    → 동기화 프로토콜 정의
```

#### 12. 하드코딩된 상수 분산

```
현재:
- types.ts: maxIterations: 5
- router.md: retry: 3
- 여러 곳: timeout: 10min

필요:
.ultraplan/config.json:
{
  "ralplan": { "maxIterations": 5 },
  "execution": { "maxRetries": 3, "timeout": "10min" },
  "planning": { "maxQuestions": 7 }
}
```

---

## Part 2: 패러다임 충돌 분석

### 두 가지 철학

```
Orchestrator (중앙 집중)          Swarm (분산 자율)
────────────────────────          ────────────────────

      ┌───────────┐                   ┌───┐ ←──→ ┌───┐
      │Orchestrator│                  │ A │      │ B │
      └─────┬─────┘                   └───┘      └───┘
        ┌───┼───┐                        ↖      ↗
        ▼   ▼   ▼                         ┌───┐
      ┌───┬───┬───┐                       │ C │
      │ A │ B │ C │                       └───┘
      └───┴───┴───┘

• 모든 걸 알고 제어               • 에이전트끼리 직접 소통
• "다음은 Architect"              • 스스로 누가 할지 결정
• 결과 받아서 판단                • 중앙 없이 협업
```

### Swarm vs Ralplan 적합성

```
❌ Swarm은 Ralplan과 안 맞음

Ralplan 요구사항:
• 엄격한 순서 필요 (Planner → Architect → Critic)
• 합의 조건 체크 필요 (APPROVED + SATISFIED)
• Max 5회 제어 필요
• 강제 승인 로직 필요

→ 자율 협업하면 무한 루프 가능
→ 규칙 어기면 품질 보증 안 됨
→ 중앙 제어가 필수
```

### Claude Code 도구 비교

| 도구 | 존재 여부 | 특징 | Ralplan 적합? |
|------|-----------|------|---------------|
| Task Tool | ✅ 있음 | 서브에이전트 스폰, 병렬 가능 | ✅ 적합! |
| Task Tool 병렬 | ✅ 가능 | 자연어 지시로 병렬 실행 | ✅ 적합! |
| TeammateTool | ❌ 없음 | 이 이름의 별도 도구 없음 | - |
| Swarm | ⚠️ 확인필요 | 자율 협업 개념 | ❌ Ralplan과 안 맞음 |
| Tasks API | ✅ 있음 | 상태 관리 + 의존성 | ✅ 상태 저장용 |

#### Task Tool 병렬 실행 방법

```
┌─────────────────────────────────────────────────────────────────┐
│  "TeammateTool"이라는 별도 도구는 없음                         │
│                                                                 │
│  하지만 Task Tool로 병렬 실행 가능!                            │
│                                                                 │
│  방법 1: 자연어 지시                                           │
│  ───────────────────                                           │
│  "Run Architect and Critic in parallel"                        │
│  → Claude가 알아서 동시에 Task 호출                            │
│                                                                 │
│  방법 2: 순차 지시                                             │
│  ───────────────────                                           │
│  "First run Architect, then run Critic"                        │
│  → 순서대로 실행                                               │
│                                                                 │
│  핵심: Claude가 자연어 맥락 보고 판단                          │
│  - "병렬로" / "동시에" / "in parallel" → 병렬 실행             │
│  - "먼저" / "그 다음" / "then" → 순차 실행                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 최종 도구 매핑

| 단계 | 특성 | 적합한 도구 |
|------|------|-------------|
| **RALPLAN** | 엄격한 프로토콜, 합의 필수, 제어 필요 | Orchestrator + Task Tool (병렬) + Tasks API |
| **EXECUTE** | 독립적 작업, 자율 가능 | Task Tool (다중) + Tasks API |

### 수정된 Ralplan 흐름

```
                   ┌─────────────────┐
                   │  ORCHESTRATOR   │  ← 중앙 제어 (필수)
                   │  (Main Agent)   │
                   └────────┬────────┘
                            │
    ┌───────────────────────┼───────────────────────┐
    │                       │                       │
    ▼                       ▼                       ▼
┌───────────┐        ┌─────────────┐         ┌───────────┐
│  Planner  │        │  Task Tool  │         │ Tasks API │
│           │        │   (병렬)    │         │           │
│ Task Tool │        │  ┌───────┐  │         │ 상태 저장  │
│ (순차)    │        │  │Archit.│  │         │ 체크포인트 │
└───────────┘        │  └───────┘  │         └───────────┘
                     │  ┌───────┐  │
                     │  │Critic │  │
                     │  └───────┘  │
                     └─────────────┘

흐름:
1. Planner 호출 (Task tool, 순차)
   → Plan 생성

2. Architect + Critic 병렬 호출 (Task tool, 병렬)
   "Run Architect and Critic in parallel on this plan"
   → 두 결과 동시에 받음

3. Orchestrator가 결과 판단 (APPROVED && SATISFIED?)

4. Tasks API로 상태 저장 (iteration, phase, verdict)

5. 조건 불충족 → 1로 돌아감 (max 5회)

시간 절약: Architect(30s) + Critic(30s) = 60s
          → 병렬: max(30s, 30s) = 30s (50% 절약!)
```

### 수정된 Execute 흐름

```
                    ┌─────────────┐
                    │    Tasks    │  ← 작업 큐 + 의존성
                    │   (Claude)  │
                    └──────┬──────┘
                           │
                           │ blockedBy 자동 관리
                           │
    ┌──────────────────────┼──────────────────────┐
    │                      │                      │
    ▼                      ▼                      ▼
┌───────────┐        ┌───────────┐        ┌───────────┐
│Executor-1 │        │Executor-2 │        │Executor-3 │
│           │        │           │        │           │
│ Task 클레임│        │ Task 클레임│        │ Task 클레임│
│ 독립 실행  │        │ 독립 실행  │        │ 독립 실행  │
│ 완료 보고  │        │ 완료 보고  │        │ 완료 보고  │
└───────────┘        └───────────┘        └───────────┘
    │                      │                      │
    └──────────────────────┼──────────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Architect  │  ← 검증 (완료된 Task만)
                    │  (Monitor)  │
                    └─────────────┘

특성:
- 에이전트끼리 직접 소통 없음 (Tasks 통해서만)
- 각자 독립적으로 Task 가져가서 작업
- 파일 충돌 없음 (Task가 파일 소유권 관리)
- Swarm 적합!
```

### 제어 필요성 스펙트럼

```
높은 제어 필요 ◄─────────────────────────────────► 낮은 제어 필요

┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Ralplan │    │Research │    │ Verify  │    │ Execute │
│         │    │         │    │         │    │         │
│ 순서 엄격│    │ 순서 유연│    │ 병렬 OK │    │ 완전 독립│
│ 합의 필수│    │ 합의 불필│    │         │    │         │
│ 반복 제어│    │         │    │         │    │         │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
     │              │              │              │
     ▼              ▼              ▼              ▼
Orchestrator   Task Tool      Task Tool     Task Tool
+ Task Tool    (병렬 가능)    (병렬 가능)   (다중 독립)
```

---

## Part 3: 우선순위 매트릭스

```
                영향도
          낮음         높음
     ┌──────────┬──────────┐
낮   │ 10.복잡도 │ 5.인터뷰  │
음   │ 11.상태   │ 6.종료조건│
노   │ 12.상수   │ 7.추적성  │
력   ├──────────┼──────────┤
높   │ 4.결합    │ 1.복잡도  │
음   │ 8.테스트  │ 2.의존성  │
     │ 9.역산    │ 3.리스크  │
     └──────────┴──────────┘

우선순위: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12
```

---

## Part 4: 개선 로드맵 제안

```
Phase 1: 핵심 기능 (🔴 Critical)
├── 1.1 Task Complexity 메타데이터 추가
├── 1.2 자동 의존성 분석 구현
├── 1.3 Risk Register 시스템 구현
└── 1.4 Agent Interface Contract 분리

Phase 2: 품질 향상 (🟡 Important)
├── 2.1 동적 인터뷰 시스템
├── 2.2 객관적 Ralplan 종료 기준
├── 2.3 Traceability Matrix
└── 2.4 Test Strategy 자동 생성

Phase 3: 구조 개선 (🟢 Structural)
├── 3.1 명령어 파일 분리
├── 3.2 상태 통합
└── 3.3 설정 중앙화
```

---

## Part 5: Orchestrator 고도화 분석

### 현재 구현 상태

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR 현재 상태 vs 필요 기능                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   구현됨 ✅                     │   미구현 ❌                               │
│   ───────────────────────────── │ ─────────────────────────────────────────│
│                                 │                                          │
│   • 상태 머신 (5 phases)        │ • Task Tool 병렬 호출 (병렬 검토)        │
│   • shouldForceApproval()       │ • Tasks API 통합 (체크포인트)            │
│   • handleCriticVerdict()       │ • 객관적 검증 체크리스트                  │
│   • getNextPhase()              │ • 반복 히스토리 저장                      │
│   • StateManager 연동           │ • 이벤트/훅 시스템                        │
│   • Mode Registry 연동          │ • 메트릭 추적 (시간, 토큰)               │
│   • Config 병합                 │ • 다중 Reviewer 지원                     │
│   • 강제 승인 로직              │ • 중단점 복구 (robust resume)            │
│                                 │ • 피드백 누적 분석                        │
│                                 │                                          │
│   복잡도: ~250 lines            │ 필요 추가: ~500+ lines                   │
│                                 │                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 고도화 필요 항목

#### 5.1 Task Tool 병렬 호출 (병렬 검토)

```
┌─────────────────────────────────────────────────────────────────┐
│  ❌ TeammateTool이라는 별도 도구는 없음                        │
│  ✅ 하지만 Task Tool로 병렬 실행 가능!                         │
└─────────────────────────────────────────────────────────────────┘

// 현재: 순차 호출
await callPlanner(plan);
await callArchitect(plan);  // 기다림
await callCritic(plan);     // 기다림

// 필요: 병렬 호출 (자연어 지시)
"Run Architect and Critic in parallel on this plan"
→ Claude가 알아서 동시에 Task 호출
→ 두 결과 동시에 받음

// 시간 절약
순차: Architect(30s) + Critic(30s) = 60s
병렬: max(30s, 30s) = 30s (50% 절약!)
```

#### 5.2 Tasks API 통합

```typescript
// 현재: 커스텀 상태 파일
stateManager.write(state);  // .ultraplan/state/ralplan-state.json

// 필요: Claude Tasks로 체크포인트
TaskCreate({
  subject: "Ralplan Iteration 2/5",
  description: "Critic review pending",
  metadata: {
    iteration: 2,
    phase: 'critic_review',
    planPath: '...'
  }
});
// → 재개 시 Tasks에서 상태 복원
// → UI에서 진행 상황 표시
```

#### 5.3 객관적 검증 체크리스트

```typescript
// 현재: 주관적 verdict
type CriticVerdict = 'OKAY' | 'REJECT';

// 필요: 체크리스트 기반
interface ObjectiveChecklist {
  allReqsMapped: boolean;        // □ REQ → Task 매핑 완료
  allTasksHaveVerify: boolean;   // □ 모든 Task에 verify 존재
  waveDepsValid: boolean;        // □ Wave 의존성 정합
  risksCovered: boolean;         // □ 리스크 커버리지 100%
  testStrategyDefined: boolean;  // □ 테스트 전략 정의
}

interface CriticResult {
  verdict: CriticVerdict;
  checklist: ObjectiveChecklist;
  passRate: number;  // 예: 4/5 = 80%
  justification: string;
}

// 승인 조건: passRate >= threshold (예: 80%)
```

#### 5.4 반복 히스토리 저장

```typescript
// 현재: 마지막 verdict만
interface RalplanState {
  lastVerdict?: CriticVerdict;
  lastFeedback?: string;
}

// 필요: 전체 히스토리
interface RalplanState {
  history: IterationRecord[];
}

interface IterationRecord {
  iteration: number;
  phase: RalplanPhase;
  architectVerdict?: ArchitectVerdict;
  criticVerdict?: CriticVerdict;
  feedback?: string;
  duration: number;  // ms
  tokensUsed: number;
  planSnapshot?: string;  // 그 시점의 계획
}

// → 왜 실패했는지 추적 가능
// → 패턴 분석 (항상 같은 이유로 실패?)
// → 개선 방향 도출
```

#### 5.5 이벤트/훅 시스템

```typescript
// 필요: 외부 모니터링 연동
interface OrchestratorEvents {
  onIterationStart: (iteration: number) => void;
  onPlannerComplete: (result: PlannerResult) => void;
  onReviewStart: (type: 'architect' | 'critic') => void;
  onVerdictReceived: (verdict: VerdictResult) => void;
  onIterationComplete: (result: IterationResult) => void;
  onForcedApproval: (reason: string) => void;
  onComplete: (summary: CompleteSummary) => void;
}

// 사용 예: HUD 업데이트
orchestrator.on('onIterationStart', (iter) => {
  updateStatusLine(`Ralplan ${iter}/${max} 진행 중...`);
});
```

#### 5.6 메트릭 추적

```typescript
// 필요: 성능 분석용 메트릭
interface RalplanMetrics {
  totalDuration: number;
  iterationDurations: number[];
  tokensPerIteration: number[];
  totalTokens: number;
  plannerTime: number;
  reviewTime: number;
  feedbackLength: number[];  // 피드백 크기 추적
}

// → 토큰 비용 최적화
// → 병목 지점 파악
// → MVP vs Detailed 모드 비교
```

#### 5.7 피드백 누적 분석

```typescript
// 필요: 반복되는 피드백 패턴 감지
interface FeedbackAnalysis {
  commonIssues: string[];      // 자주 나오는 문제
  resolvedIssues: string[];    // 해결된 문제
  persistentIssues: string[];  // 해결 안 된 문제 (3회 이상)
}

// Planner에게 전달:
// "이전 반복에서 '테스트 전략 없음'이 3회 지적됨.
//  이번에 반드시 해결하세요."
```

### Orchestrator 고도화 우선순위

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR 고도화 우선순위                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Priority 1 (패러다임 정합)                                                │
│   ├── 5.1 Task Tool 병렬 호출 (Architect+Critic 병렬)                      │
│   └── 5.2 Tasks API 통합 (체크포인트)                                       │
│                                                                             │
│   Priority 2 (품질 보증)                                                    │
│   ├── 5.3 객관적 체크리스트 기반 검증                                       │
│   └── 5.4 반복 히스토리 + 피드백 분석                                       │
│                                                                             │
│   Priority 3 (관찰성)                                                       │
│   ├── 5.5 이벤트/훅 시스템                                                  │
│   └── 5.6 메트릭 추적                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 6: Moltbot에서 배울 점

### 핵심 패턴

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MOLTBOT 패턴 → ULTRA PLANNING 적용                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Moltbot 패턴              │  Ultra Planning 적용                          │
│   ───────────────────────── │ ──────────────────────────────────────────── │
│                             │                                              │
│   1. Session 격리           │  에이전트별 독립 컨텍스트                      │
│   2. Fire-and-forget/Wait   │  상황별 동기/비동기 선택                       │
│   3. Announce Step          │  결과 자동 전달 패턴                          │
│   4. Skills 플러그인         │  도메인 로직 모듈화                           │
│                             │                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.1 Session 격리 (Independent Context)

```
현재 문제:
┌─────────────────────────────────────────────────────────────────┐
│  Planner 호출 → Architect 호출 → Critic 호출                    │
│                                                                 │
│  모든 에이전트가 같은 컨텍스트 공유                              │
│  → 이전 에이전트의 "오염"이 다음에 영향                          │
│  → Architect가 Planner의 사고 과정을 보고 편향될 수 있음         │
└─────────────────────────────────────────────────────────────────┘

Moltbot 방식:
┌─────────────────────────────────────────────────────────────────┐
│  각 에이전트는 독립된 세션                                       │
│                                                                 │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐                     │
│  │Planner  │    │Architect│    │ Critic  │                     │
│  │Session 1│    │Session 2│    │Session 3│                     │
│  └────┬────┘    └────┬────┘    └────┬────┘                     │
│       │              │              │                           │
│       ▼              ▼              ▼                           │
│  [Plan만 전달]   [Plan만 전달]  [Plan만 전달]                    │
│                                                                 │
│  → 순수하게 Plan만 보고 판단                                    │
│  → 편향 없는 독립적 검토                                        │
└─────────────────────────────────────────────────────────────────┘

적용 방법:
- Task(subagent_type="...", prompt="Plan만 포함")
- 이전 에이전트의 reasoning은 전달하지 않음
- 필요한 컨텍스트만 선별적으로 전달
```

### 6.2 Fire-and-forget vs Wait

```
┌─────────────────────────────────────────────────────────────────┐
│  상황별 동기/비동기 선택                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  WAIT (결과 필요)           │  FIRE-AND-FORGET (결과 불필요)    │
│  ─────────────────────────  │  ─────────────────────────────── │
│                             │                                   │
│  • Planner → Plan 필요      │  • 로깅/알림                      │
│  • Architect → Verdict 필요 │  • 메트릭 기록                    │
│  • Critic → Feedback 필요   │  • 백업 저장                      │
│                             │  • 외부 시스템 알림               │
│                             │                                   │
│  await Task(...)            │  Task(..., run_in_background:true)│
│                             │  // 결과 안 기다림                 │
│                             │                                   │
└─────────────────────────────────────────────────────────────────┘

적용 예시:
```typescript
// Ralplan에서 적용
async function ralplanIteration() {
  // WAIT: 결과 필요
  const plan = await callPlanner(context);

  // FIRE-AND-FORGET: 로깅 (결과 불필요)
  logIterationStart(iteration);  // 비동기, 안 기다림

  // WAIT: 병렬이지만 둘 다 결과 필요
  const [arch, critic] = await teammateTool([...]);

  // FIRE-AND-FORGET: 메트릭 저장 (결과 불필요)
  saveMetrics({ duration, tokens });  // 비동기, 안 기다림

  return handleVerdict(arch, critic);
}
```

### 6.3 Announce Step (결과 자동 전달)

```
┌─────────────────────────────────────────────────────────────────┐
│  현재: 결과를 명시적으로 전달해야 함                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  const planResult = await callPlanner();                        │
│  const archResult = await callArchitect(planResult);  // 수동    │
│  const criticResult = await callCritic(planResult);   // 수동    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Moltbot 방식: Announce Step                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  orchestrator.announce('plan_ready', planResult);               │
│  // → 구독한 모든 에이전트에게 자동 전달                         │
│                                                                 │
│  // Architect는 'plan_ready' 이벤트 구독                        │
│  // Critic도 'plan_ready' 이벤트 구독                           │
│  // → 자동으로 Plan 받음                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

적용:
```typescript
// 이벤트 기반 결과 전달
interface OrchestratorAnnouncements {
  'plan_ready': { plan: string; iteration: number };
  'review_complete': { architect: Verdict; critic: Verdict };
  'iteration_done': { approved: boolean; iteration: number };
}

// 사용
orchestrator.announce('plan_ready', { plan, iteration: 2 });

// 구독자들이 자동으로 받음
architect.on('plan_ready', async ({ plan }) => {
  return await review(plan);
});
```

### 6.4 Skills 플러그인 (도메인 로직 모듈화)

```
┌─────────────────────────────────────────────────────────────────┐
│  현재: 모든 로직이 orchestrator.ts에 혼재                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  orchestrator.ts (250+ lines)                                   │
│  ├── 상태 머신 로직                                             │
│  ├── 강제 승인 로직                                             │
│  ├── 피드백 처리 로직                                           │
│  └── ... 모든 것                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Moltbot 방식: Skills로 분리                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  orchestrator/                                                  │
│  ├── core.ts              # 핵심 상태 머신만 (~100 lines)       │
│  ├── skills/                                                    │
│  │   ├── forced-approval.ts   # 강제 승인 스킬                  │
│  │   ├── feedback-analysis.ts # 피드백 분석 스킬                │
│  │   ├── metrics-tracking.ts  # 메트릭 추적 스킬                │
│  │   ├── checklist-validation.ts # 체크리스트 검증 스킬         │
│  │   └── history-recording.ts # 히스토리 기록 스킬              │
│  └── plugins/                                                   │
│      ├── slack-notifier.ts    # Slack 알림 플러그인             │
│      └── dashboard-sync.ts    # 대시보드 동기화 플러그인        │
│                                                                 │
│  // 플러그인 등록                                               │
│  orchestrator.use(forcedApprovalSkill);                         │
│  orchestrator.use(feedbackAnalysisSkill);                       │
│  orchestrator.use(slackNotifierPlugin);                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Moltbot 패턴 적용 우선순위

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MOLTBOT 패턴 적용 우선순위                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Priority 1 (즉시 적용 가능)                                               │
│   ├── 6.2 Fire-and-forget vs Wait (로깅/메트릭에 적용)                     │
│   └── 6.1 Session 격리 (Task 호출 시 컨텍스트 분리)                        │
│                                                                             │
│   Priority 2 (구조 변경 필요)                                               │
│   ├── 6.3 Announce Step (이벤트 시스템 구축 필요)                          │
│   └── 6.4 Skills 플러그인 (파일 구조 재편 필요)                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 7: 통합 개선 로드맵

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ULTRA PLANNING 통합 개선 로드맵                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Phase 1: 기반 정립 (1-2주)                                                 │
│  ├── 1.1 Task Complexity 메타데이터 추가                                   │
│  ├── 1.2 Agent Interface Contract 분리                                     │
│  ├── 5.1 Task Tool 병렬 호출 (병렬 검토)                                   │
│  ├── 5.2 Tasks API 통합 (체크포인트)                                       │
│  └── 6.1 Session 격리 적용                                                 │
│                                                                             │
│  Phase 2: 품질 강화 (2-3주)                                                 │
│  ├── 1.3 자동 의존성 분석                                                   │
│  ├── 2.1 Risk Register 시스템                                              │
│  ├── 5.3 객관적 체크리스트 기반 검증                                       │
│  ├── 6.2 Fire-and-forget vs Wait 패턴                                      │
│  └── 6.3 Announce Step 이벤트 시스템                                       │
│                                                                             │
│  Phase 3: 고급 기능 (3-4주)                                                 │
│  ├── 2.2 동적 인터뷰 시스템                                                │
│  ├── 2.3 Traceability Matrix                                               │
│  ├── 5.4 반복 히스토리 + 피드백 분석                                       │
│  ├── 5.5 이벤트/훅 시스템                                                  │
│  └── 6.4 Skills 플러그인 구조                                              │
│                                                                             │
│  Phase 4: 최적화 (4주+)                                                    │
│  ├── 3.1 명령어 파일 분리                                                   │
│  ├── 3.2 상태 통합 (Claude Tasks Primary)                                  │
│  ├── 5.6 메트릭 추적                                                       │
│  └── Goal-Backward 실제 구현                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 8: 근본적 약점 - "Plan은 진리가 아니다"

### 현재의 문제

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    "No plan survives first contact with reality"            │
│                              - Helmuth von Moltke                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Ultra Planning 현재 가정:                                                 │
│                                                                             │
│   ┌─────────┐     ┌─────────┐     ┌─────────┐                              │
│   │  Plan   │ ──► │ Execute │ ──► │ Verify  │                              │
│   │ (진리)  │     │(따르기만)│     │(Plan대로?)│                             │
│   └─────────┘     └─────────┘     └─────────┘                              │
│        │                                                                    │
│        └─── Plan이 완벽하다고 가정                                          │
│             Executor는 Plan을 그대로 실행만                                 │
│             Verification = "Plan대로 했나?"                                 │
│                                                                             │
│   문제점:                                                                   │
│   • 실행 중 발견한 더 좋은 방법 무시                                        │
│   • 예상치 못한 장애물에 유연하게 대응 못함                                 │
│   • Task 간 학습 전파 없음 (같은 실수 반복)                                 │
│   • 불확실성 높은 부분을 미리 검증 안 함                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 개선 방향

#### 8.1 Plan을 Living Document로

```
현재:
┌─────────────────────────────────────────────────────────────────┐
│  PLAN.md 생성 → 잠금 → 실행 → 완료                              │
│                                                                 │
│  Plan은 한번 만들면 변경 불가                                   │
│  변경하려면 전체 Ralplan 다시 돌려야 함                         │
└─────────────────────────────────────────────────────────────────┘

필요:
┌─────────────────────────────────────────────────────────────────┐
│  PLAN.md 생성 → 실행 → 피드백 → 수정 → 실행 → ...              │
│                                                                 │
│  Living Document:                                               │
│  • 실행 중 Task 추가/수정/삭제 가능                             │
│  • 변경 이력 추적 (왜 바꿨는지)                                 │
│  • 변경 시 영향받는 Task 자동 표시                              │
│                                                                 │
│  PLAN.md:                                                       │
│  ```yaml                                                        │
│  version: 3  # Plan 버전                                        │
│  changes:                                                       │
│    - v2: "Task 5 추가 (API 인증 필요 발견)"                     │
│    - v3: "Task 3 방식 변경 (더 나은 라이브러리 발견)"           │
│  ```                                                            │
└─────────────────────────────────────────────────────────────────┘
```

#### 8.2 Executor에게 Deviation 권한

```
현재:
┌─────────────────────────────────────────────────────────────────┐
│  Executor: "Plan에 axios 쓰라고 했으니 axios 씀"                │
│            (실제론 fetch가 더 적합해도)                         │
│                                                                 │
│  → 맹목적 Plan 추종                                             │
│  → 더 나은 방법 무시                                            │
└─────────────────────────────────────────────────────────────────┘

필요:
┌─────────────────────────────────────────────────────────────────┐
│  Executor에게 Deviation 권한 부여                               │
│                                                                 │
│  3단계 자율성:                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Level 1: Minor Deviation (보고만)                       │   │
│  │ - 라이브러리 버전 변경                                   │   │
│  │ - 파일 위치 미세 조정                                    │   │
│  │ → 실행 후 DEVIATION.md에 기록                           │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ Level 2: Moderate Deviation (승인 후 진행)              │   │
│  │ - 다른 라이브러리 사용                                   │   │
│  │ - 구현 방식 변경                                         │   │
│  │ → Architect 빠른 승인 후 진행                           │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ Level 3: Major Deviation (Plan 수정 필요)               │   │
│  │ - 새로운 Task 필요                                       │   │
│  │ - 기존 Task 삭제/대체                                    │   │
│  │ → Plan 수정 프로세스 트리거                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Executor 판단 기준:                                            │
│  "Plan의 <done> 기준을 충족하면서 더 나은 방법이 있다면,       │
│   그 방법을 선택해도 된다"                                      │
└─────────────────────────────────────────────────────────────────┘

```typescript
// Executor output에 deviation 섹션 추가
interface ExecutorResult {
  success: boolean;
  filesModified: string[];
  deviation?: {
    level: 1 | 2 | 3;
    description: string;
    rationale: string;      // 왜 이렇게 했는지
    originalApproach: string;
    newApproach: string;
    benefitGained: string;  // 얻은 이점
  };
}
```

#### 8.3 학습 전파 (Task 간 Notepad 공유)

```
현재:
┌─────────────────────────────────────────────────────────────────┐
│  Task 1 실패: "moment.js deprecated, dayjs 사용해야 함"         │
│       ↓                                                         │
│  Task 2 실패: "moment.js deprecated..." (같은 실수 반복)        │
│       ↓                                                         │
│  Task 3 실패: "moment.js deprecated..." (또 반복)               │
│                                                                 │
│  → Task 간 학습 공유 없음                                       │
│  → 같은 실수 N번 반복                                           │
└─────────────────────────────────────────────────────────────────┘

필요:
┌─────────────────────────────────────────────────────────────────┐
│  실행 중 학습 전파 시스템                                       │
│                                                                 │
│  Task 1 실패 → LEARNINGS.md 기록:                              │
│  ```markdown                                                    │
│  ## [LEARN-001] moment.js 사용 금지                            │
│  - 발견: Task 1 실행 중                                         │
│  - 원인: moment.js deprecated since 2020                       │
│  - 대안: dayjs 또는 date-fns 사용                               │
│  - 영향 범위: 날짜 처리하는 모든 Task                           │
│  ```                                                            │
│                                                                 │
│  Task 2 시작 시:                                                │
│  - LEARNINGS.md 자동 주입                                       │
│  - "moment.js 사용하지 말 것" 이미 알고 시작                    │
│                                                                 │
│  ┌─────────┐    ┌─────────────┐    ┌─────────┐                 │
│  │ Task 1  │───►│ LEARNINGS   │───►│ Task 2  │                 │
│  │         │    │ (공유 지식)  │    │         │                 │
│  └─────────┘    └─────────────┘    └─────────┘                 │
│                       │                                         │
│                       ▼                                         │
│                 ┌─────────┐                                     │
│                 │ Task 3  │ (이미 알고 시작)                    │
│                 └─────────┘                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

학습 유형:
- AVOID: 피해야 할 것 (deprecated 라이브러리)
- PREFER: 선호해야 할 것 (더 나은 패턴)
- GOTCHA: 주의할 것 (숨겨진 함정)
- DISCOVERY: 발견한 것 (예상과 다른 구조)
```

#### 8.4 Spike Phase 추가 (불확실성 탐색)

```
현재:
┌─────────────────────────────────────────────────────────────────┐
│  Plan → Execute (바로 실행)                                     │
│                                                                 │
│  불확실성이 높아도 일단 Plan대로 실행                          │
│  → 중간에 "이 방식 안 되는데?" 발견                            │
│  → 전체 Plan 무효화                                            │
│  → 시간 낭비                                                    │
└─────────────────────────────────────────────────────────────────┘

필요:
┌─────────────────────────────────────────────────────────────────┐
│  Spike Phase: 불확실성 먼저 해소                                │
│                                                                 │
│  PLAN 단계에서:                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Task 분석 → 불확실성 점수 (0-10)                        │   │
│  │                                                          │   │
│  │ 불확실성 높은 경우 (>=7):                                │   │
│  │ - 처음 쓰는 기술                                         │   │
│  │ - 외부 API 의존                                          │   │
│  │ - 성능 요구사항 까다로움                                 │   │
│  │ - 요구사항 모호                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  SPIKE PHASE (Wave 0):                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 불확실성 높은 Task → Spike Task 자동 생성               │   │
│  │                                                          │   │
│  │ Spike Task 목표:                                         │   │
│  │ - "이 방식이 가능한가?" 빠르게 검증                      │   │
│  │ - 작은 PoC로 위험 요소 확인                              │   │
│  │ - 결과에 따라 Plan 조정                                  │   │
│  │                                                          │   │
│  │ 예시:                                                    │   │
│  │ Task: "Stripe 결제 연동"                                │   │
│  │ Spike: "Stripe API 호출 성공 확인 (10분 타임박스)"      │   │
│  │        → 성공: 본 Task 진행                              │   │
│  │        → 실패: Plan 수정 (다른 결제 서비스 검토)        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  실행 순서:                                                     │
│  Wave 0 (Spike) → Plan 재검토 → Wave 1 → Wave 2 → ...         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

```xml
<!-- Task XML에 uncertainty 필드 추가 -->
<task wave="1">
  <name>Stripe 결제 연동</name>
  <uncertainty>8</uncertainty>  <!-- 0-10, 높을수록 불확실 -->
  <uncertainty_reasons>
    - 처음 사용하는 API
    - 문서가 최신 아닐 수 있음
    - 테스트 환경 설정 복잡
  </uncertainty_reasons>
  <spike>
    <required>true</required>
    <timebox>15min</timebox>
    <goal>API 키 설정 + 테스트 결제 성공</goal>
    <success_criteria>checkout.session 생성 성공</success_criteria>
    <failure_action>plan_revision</failure_action>
  </spike>
  ...
</task>
```

### 요약: "Plan은 지도, 실행은 여정"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PLAN = 지도, EXECUTION = 여정                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   "지도는 영토가 아니다" (Alfred Korzybski)                                 │
│                                                                             │
│   Plan의 역할:                                                              │
│   ✓ 전체 방향 제시                                                         │
│   ✓ 주요 체크포인트 정의                                                   │
│   ✓ 의존성 관계 파악                                                       │
│   ✗ 모든 상세를 미리 결정 (불가능)                                         │
│   ✗ 변경 불허 (비현실적)                                                   │
│                                                                             │
│   올바른 접근:                                                              │
│   ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐             │
│   │  Plan   │ ◄──►│ Spike   │ ◄──►│ Execute │ ◄──►│  Learn  │             │
│   │(방향제시)│     │(검증)    │     │(적응실행)│     │(학습전파)│             │
│   └─────────┘     └─────────┘     └─────────┘     └─────────┘             │
│        │                                                │                   │
│        └────────────────────────────────────────────────┘                   │
│                         피드백 루프                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 9: 비판적 재검토 - 과설계 vs 실용성

### 전체 평가

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    개선안 비판적 평가                                        │
├─────────────┬────────────────┬───────────────────────────────────────────────┤
│    영역     │      평가      │                   이유                        │
├─────────────┼────────────────┼───────────────────────────────────────────────┤
│ 문제 진단   │ ✅ 90% 정확    │ 실제 약점을 잘 포착                           │
├─────────────┼────────────────┼───────────────────────────────────────────────┤
│ 해결책 방향 │ ⚠️ 60% 적절   │ 40%는 과설계 우려                             │
├─────────────┼────────────────┼───────────────────────────────────────────────┤
│ 우선순위    │ ⚠️ 재조정 필요│ 영향도 vs 노력 재평가 필요                    │
├─────────────┼────────────────┼───────────────────────────────────────────────┤
│ 실현 가능성 │ ❓ 검증 필요   │ 일부 Claude 제약 존재                         │
├─────────────┼────────────────┼───────────────────────────────────────────────┤
│ 누락        │ 🆕 3개 발견    │ Plan 수정, Spike Phase, 롤백 전략            │
└─────────────┴────────────────┴───────────────────────────────────────────────┘
```

### 🟢 동의하는 개선점 (유지)

#### 1. Task Complexity 메타데이터 (Critical #1)
```
✅ 매우 중요

단, 단순화:
<task>
  <complexity>medium</complexity>  <!-- low/medium/high만 -->
  <files>2-3</files>               <!-- 파일 수로 추정 -->
</task>

시간/토큰 추정은 부정확해서 오히려 해로움
→ 단순 3단계 분류가 실용적
```

#### 2. 자동 의존성 분석 (Critical #2)
```
✅ 핵심 개선점

MCP tool로 구현:
analyze_dependencies(planPath) → { dag, criticalPath, waves }
```

#### 3. Agent Interface Contract (Critical #4)
```
✅ 유지보수성 핵심

schemas/ 폴더 분리:
schemas/
├── executor-result.schema.yaml
├── architect-verdict.schema.yaml
└── critic-verdict.schema.yaml
```

#### 4. Ralplan 객관적 종료 조건 (Important #6)
```
✅ 현재 가장 약한 부분

체크리스트 방식:
□ 모든 REQ가 Task에 매핑됨
□ 모든 Task에 verify 존재
□ Wave 의존성 유효
→ 80%+ 체크 시 PASS
```

#### 5. Session 격리 (Moltbot #6.1)
```
✅ 즉시 적용 가능

적용:
- Architect에게 Plan만 전달 (Planner의 사고과정 X)
- Critic에게 Plan만 전달 (Architect의 verdict X)
```

---

### 🟡 과설계 우려 항목 (축소 또는 제거)

#### 1. Risk Register 시스템 (Critical #3)
```
⚠️ 과설계

문제:
- RISK-REGISTER.md + 완화 전략 + 모니터링 = 오버헤드
- 리스크 대부분 실행 중 발견됨
- 계획 단계에서 예측 불가능한 게 더 많음

대안:
- RESEARCH.md에 "주의사항" 섹션 추가 정도로 충분
- 별도 파일/시스템은 과함
```

#### 2. Traceability Matrix (Important #7)
```
⚠️ 과설계

문제:
- REQ-01 → T-01, T-02 → UT-01 추적?
- 엔터프라이즈급 프로젝트에나 필요
- 대부분 프로젝트는 요구사항 10개 미만

대안:
- Task XML에 <covers>REQ-01</covers> 추가 정도로 충분
- 별도 TRACEABILITY-MATRIX.md는 과함
```

#### 3. 동적 인터뷰 시스템 (Important #5)
```
⚠️ 복잡도 대비 효과 낮음

문제:
- 프로젝트 타입별 질문 트리 = 구현/유지보수 비용 높음
- Planner가 컨텍스트 보고 알아서 질문 조절
- LLM의 강점이 바로 이런 적응력

대안:
- Planner prompt에 "상황에 맞게 질문 조절" 지시
- 고정 트리보다 LLM 판단에 맡김
```

#### 4. Test Strategy 자동 생성 (Important #8)
```
⚠️ 실행 단계와 중복

문제:
- 계획 단계에서 TEST-STRATEGY.md 생성해도 실행 시 달라짐
- "Unit 80%" 정해봤자 의미 없음
- 테스트 전략은 코드 구조 보고 결정

대안:
- Task별 <verify> 태그로 충분
- 전체 전략은 실행 단계에서 Executor가 판단
```

#### 5. 이벤트/훅 시스템 (Orchestrator #5.5)
```
⚠️ 현시점에서 불필요

문제:
- onIterationStart, onVerdictReceived 등 = 외부 모니터링 연동할 게 없음
- Claude Code는 자체 UI가 충분
- Slack/대시보드 연동은 나중 문제

대안:
- 먼저 핵심 기능 완성
- 이벤트 시스템은 필요 시 추가
```

---

### 🔴 재검토 필요 항목

#### 1. Task Tool 병렬 호출 (Orchestrator #5.1)
```
✅ 확인 완료

결론:
- TeammateTool이라는 별도 도구는 ❌ 없음
- 하지만 Task Tool로 병렬 실행 ✅ 가능!

방법:
- 자연어로 "Run Architect and Critic in parallel"
- Claude가 알아서 동시에 Task 호출
- 두 결과 동시에 받음

시간 절약: 50% (30s+30s → max 30s)
```

#### 2. Swarm vs Orchestrator 분석 (Part 2)
```
❓ 실제 구현과 괴리

문서에서: "Swarm은 Ralplan과 안 맞음"

핵심 질문:
- Claude Code의 Swarm이 정확히 무엇인지?
- Ultra Planning에서 말하는 Swarm과 같은지?
- 용어 정리 필요
```

#### 3. 상태 통합 (Structural #11)
```
❓ Claude Tasks를 Primary로?

우려:
- Claude Tasks는 세션 종료 시 휘발
- 파일 기반 상태가 더 안정적

재검토:
- STATE.md를 Primary로 유지 ✅
- Claude Tasks는 런타임 view로만 사용
```

---

### 🆕 누락된 개선점 (추가 필요)

#### 1. Plan 수정 메커니즘
```
현재: Plan 작성 → 그대로 실행 (수정 불가)
필요: 실행 중 Plan 수정 허용

Executor가 "이 접근은 안 됨" 발견 시:
→ 현재: 실패 보고 → 재시도 (같은 방법으로)
→ 필요: Plan 수정 요청 → Planner가 대안 제시

구현:
- Executor output에 plan_revision_needed 플래그
- Orchestrator가 감지 → Planner 호출
- 영향받는 Task만 재계획
```

#### 2. Spike/Prototype Phase
```
불확실성 높은 기술 검증 단계 필요

예: "이 라이브러리가 우리 요구사항 만족하는지?"
→ 계획 전에 작은 PoC로 확인
→ 확인 후 본격 계획

이미 Part 8에서 제안됨 (8.4 Spike Phase)
→ 우선순위 상향 필요
```

#### 3. 롤백 전략
```
Phase 2 실패 시 Phase 1로 돌아가는 방법?
현재: 없음

필요:
- Git checkpoint per phase (git tag phase-1-complete)
- 롤백 명령어 (/ultraplan:rollback phase-1)
- 상태 복원 프로토콜
```

---

### 수정된 우선순위 제안

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    수정된 개선 우선순위                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Phase 1: 핵심 품질 (1주)                                                   │
│  ├── ✅ Task Complexity (low/medium/high만)                                │
│  ├── ✅ Agent Interface Contract 분리                                      │
│  ├── ✅ 객관적 Ralplan 체크리스트                                          │
│  └── ✅ Session 격리 적용                                                  │
│                                                                             │
│  Phase 2: 자동화 + 적응성 (2주)                                             │
│  ├── ✅ 자동 의존성 분석 (MCP tool)                                        │
│  ├── ✅ 병렬 Task 호출 (Architect + Critic)                               │
│  ├── 🆕 Plan 수정 메커니즘                                                 │
│  └── 🆕 Spike Phase (불확실성 검증)                                        │
│                                                                             │
│  Phase 3: 안정성 (3주)                                                      │
│  ├── 🆕 Phase별 Git checkpoint                                             │
│  ├── 🆕 롤백 전략                                                          │
│  ├── ✅ 학습 전파 (LEARNINGS.md)                                           │
│  └── ✅ Deviation 권한 (Level 1/2/3)                                       │
│                                                                             │
│  Phase 4: 선택적 (필요 시에만)                                              │
│  ├── ⚠️ 리스크 체크 (RESEARCH.md 섹션으로 축소)                            │
│  ├── ⚠️ Traceability (<covers> 태그로 축소)                               │
│  ├── ⚠️ 동적 인터뷰 (prompt 지시로 대체)                                   │
│  └── ⚠️ 이벤트 시스템 (외부 연동 시에만)                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 핵심 메시지

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   "Planning 단계를 완벽하게 만들려 하지 말고,                               │
│    실행 중 적응할 수 있는 구조를 만들어라."                                 │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   과설계 함정:                                                              │
│   ┌─────────────────────────────────────────────────────────┐              │
│   │  "계획을 더 정교하게 하면 실행이 쉬워질 것"              │              │
│   │            ↓                                             │              │
│   │  실제로는: 계획에 시간 다 쓰고, 실행 때 어차피 바뀜       │              │
│   └─────────────────────────────────────────────────────────┘              │
│                                                                             │
│   올바른 접근:                                                              │
│   ┌─────────────────────────────────────────────────────────┐              │
│   │  "계획은 80%만, 나머지 20%는 실행 중 채워라"             │              │
│   │            ↓                                             │              │
│   │  Plan 수정 메커니즘 + Spike + 롤백 = 적응형 시스템       │              │
│   └─────────────────────────────────────────────────────────┘              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 문서 요약 (Quick Reference)

### 최종 문서 구조

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    planning-improvements.md 전체 구조                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Part 1: 현존 최고가 되기 위한 부족한 부분                                  │
│  ├── 🔴 CRITICAL (1-4): 복잡도, 의존성, 리스크, 결합                        │
│  ├── 🟡 IMPORTANT (5-9): 인터뷰, 종료조건, 추적성, 테스트, 역산             │
│  └── 🟢 STRUCTURAL (10-12): 파일복잡도, 상태분산, 상수분산                  │
│                                                                             │
│  Part 2: 패러다임 충돌 분석                                                 │
│  ├── Orchestrator vs Swarm 철학 비교                                       │
│  ├── Claude Code 도구 비교 (Task Tool, Task Tool 병렬, Tasks API)          │
│  └── 최종 도구 매핑 (Ralplan → Orchestrator, Execute → Swarm)              │
│                                                                             │
│  Part 3: 우선순위 매트릭스                                                  │
│  └── 영향도 × 노력 기반 우선순위 정렬                                       │
│                                                                             │
│  Part 4: 개선 로드맵 제안 (원래 버전)                                       │
│  └── Phase 1-3 단계별 작업 목록                                             │
│                                                                             │
│  Part 5: Orchestrator 고도화 분석                                           │
│  ├── 현재 구현 vs 필요 기능 비교                                            │
│  └── 7개 고도화 항목 (TeammateTool, Tasks API, 체크리스트, 히스토리 등)    │
│                                                                             │
│  Part 6: Moltbot에서 배울 점                                                │
│  ├── Session 격리                                                           │
│  ├── Fire-and-forget vs Wait                                               │
│  ├── Announce Step                                                          │
│  └── Skills 플러그인                                                        │
│                                                                             │
│  Part 7: 통합 개선 로드맵                                                   │
│  └── Phase 1-4 통합 일정                                                    │
│                                                                             │
│  Part 8: 근본적 약점 - "Plan은 진리가 아니다"                               │
│  ├── 8.1 Living Document                                                    │
│  ├── 8.2 Deviation 권한 (Level 1/2/3)                                       │
│  ├── 8.3 학습 전파 (LEARNINGS.md)                                           │
│  └── 8.4 Spike Phase (불확실성 검증)                                        │
│                                                                             │
│  Part 9: 비판적 재검토 - 과설계 vs 실용성                                   │
│  ├── 🟢 유지 항목 (5개)                                                     │
│  ├── 🟡 과설계 우려 항목 (5개)                                              │
│  ├── 🔴 재검토 필요 항목 (3개)                                              │
│  ├── 🆕 누락된 개선점 (3개)                                                 │
│  └── 수정된 우선순위                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 핵심 분류 결과

| 분류 | 항목 | 처리 |
|------|------|------|
| 🟢 **유지** | Complexity, 의존성분석, Contract, 체크리스트, Session격리 | 그대로 진행 |
| 🟡 **축소** | Risk, Traceability, 동적인터뷰, TestStrategy, 이벤트시스템 | 단순화 또는 제거 |
| 🔴 **검증** | ~~TeammateTool~~ ✅확인됨, Swarm정의, 상태통합 | Swarm/상태만 확인 필요 |
| 🆕 **추가** | Plan수정 메커니즘, Spike Phase, 롤백 전략 | 새로 추가 |

### 수정된 우선순위 (최종)

```
Phase 1 (1주): 핵심 품질
├── ✅ Task Complexity (low/medium/high)
├── ✅ Agent Interface Contract 분리
├── ✅ 객관적 Ralplan 체크리스트
└── ✅ Session 격리 적용

Phase 2 (2주): 자동화 + 적응성
├── ✅ 자동 의존성 분석 (MCP tool)
├── ✅ Task Tool 병렬 호출 (Architect + Critic) - 자연어 지시로 가능!
├── 🆕 Plan 수정 메커니즘
└── 🆕 Spike Phase (불확실성 검증)

Phase 3 (3주): 안정성
├── 🆕 Phase별 Git checkpoint
├── 🆕 롤백 전략
├── ✅ 학습 전파 (LEARNINGS.md)
└── ✅ Deviation 권한 (Level 1/2/3)

Phase 4 (선택적): 필요 시에만
├── ⚠️ 리스크 체크 (RESEARCH.md 섹션으로 축소)
├── ⚠️ Traceability (<covers> 태그로 축소)
├── ⚠️ 동적 인터뷰 (prompt 지시로 대체)
└── ⚠️ 이벤트 시스템 (외부 연동 시에만)
```

### 핵심 메시지

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   "Planning 단계를 완벽하게 만들려 하지 말고,                               │
│    실행 중 적응할 수 있는 구조를 만들어라."                                 │
│                                                                             │
│   계획 80% + 실행 중 적응 20% = 적응형 시스템                               │
│                                                                             │
│   핵심 3요소:                                                               │
│   1. Plan 수정 메커니즘 (실행 중 변경 허용)                                 │
│   2. Spike Phase (불확실성 먼저 검증)                                       │
│   3. 롤백 전략 (실패 시 복구)                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 10: Ultra Planning v2.0 최종 로드맵

### "완벽한 플래너"란?

```
┌─────────────────────────────────────────────────────────────────┐
│                    "완벽한 플래너"의 조건                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ✅ 어떤 프로젝트든 계획 가능                                  │
│   ✅ 계획이 실행 중 깨져도 적응 가능                            │
│   ✅ 실패해도 복구 가능                                         │
│   ✅ 반복할수록 더 좋아짐 (학습)                                │
│   ✅ 사람 개입 최소화                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Ultra Planning v2.0 로드맵

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ULTRA PLANNING v2.0 로드맵                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Week 1: 핵심 품질 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  ├── □ Task Complexity (low/medium/high) 메타데이터                        │
│  ├── □ Agent Interface Contract (schemas/ 분리)                            │
│  ├── □ 객관적 Ralplan 체크리스트 (80% pass = APPROVED)                     │
│  ├── □ Session 격리 (Plan만 전달, reasoning 제외)                          │
│  └── □ Task Tool 병렬 실행 (Architect + Critic)                            │
│                                                                             │
│  Week 2: 적응성 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  ├── □ Plan 수정 메커니즘 (Living Document)                                │
│  ├── □ Executor Deviation 권한 (Level 1/2/3)                               │
│  ├── □ LEARNINGS.md (Task 간 학습 전파)                                    │
│  └── □ 자동 의존성 분석 (DAG + Critical Path)                              │
│                                                                             │
│  Week 3: 안정성 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  ├── □ Spike Phase (불확실성 >= 7 → PoC 먼저)                              │
│  ├── □ Phase별 Git checkpoint                                              │
│  ├── □ 롤백 명령어 (/ultraplan rollback phase-1)                           │
│  └── □ 상태 복원 프로토콜                                                   │
│                                                                             │
│  Week 4: 검증 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  ├── □ 실제 프로젝트 3개 테스트                                            │
│  ├── □ 실패 케이스 분석                                                     │
│  ├── □ 피드백 반영                                                          │
│  └── □ 문서화 완료                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 구현 시작 옵션

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    구현 시작 옵션                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [A] Week 1부터 순서대로 구현 시작                                        │
│       → Task Complexity 메타데이터부터                                     │
│       → 기반을 탄탄하게                                                     │
│                                                                             │
│   [B] 핵심 누락 기능(적응성) 먼저                                          │
│       → Plan 수정 메커니즘부터                                             │
│       → 가장 큰 약점 먼저 해결                                              │
│                                                                             │
│   [C] 전체 아키텍처 먼저 설계                                               │
│       → 파일 구조 + 인터페이스 정의                                        │
│       → 빅픽처 확정 후 구현                                                 │
│                                                                             │
│   [D] 현재 Ultra Planning 코드 분석 먼저                                   │
│       → 실제 코드 보면서 개선점 파악                                       │
│       → 현실적인 구현 계획 수립                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

*이 문서는 Ultra Planning 플랜 단계 개선을 위한 임시 저장 문서입니다.*
*Last updated: 2026-01-30*
