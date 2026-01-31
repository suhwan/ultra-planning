# Ultra Planner v3.0 리팩토링 계획

## Context Architect 패턴으로 전환

> "실행하지 않는다. 맥락을 설계한다."

---

## 1. 핵심 철학

### 1.1 현재 문제점

```
현재 Ultra Planner:
├── 실행 로직 보유 (Swarm 상태, Pipeline 상태)
├── Claude Code와 중복 (TaskList, TaskUpdate)
├── 룰 기반 계산 (복잡도, 라우팅)
└── Claude Code 발전 시 충돌 가능
```

### 1.2 새로운 방향

```
Ultra Planner = Context Architect
─────────────────────────────────
• 실행 → Claude Code에 완전 위임
• 상태 관리 → Claude Code Tasks에 위임
• 판단 → Claude AI에 위임 (힌트만 제공)
• Ultra Planner → 컨텍스트/지혜/프롬프트만 담당
```

### 1.3 왜 이 방향인가?

| 이유 | 설명 |
|------|------|
| **미래 호환성** | Claude Code가 발전해도 충돌 없음 |
| **최적화** | 네이티브 기능이 항상 더 최적화됨 |
| **유지보수** | 중복 코드 제거로 부담 감소 |
| **유연성** | AI 판단이 룰보다 맥락 이해 뛰어남 |

---

## 2. 아키텍처 변경

### 2.1 Before vs After

```
┌─────────────────────────────────────────────────────────────┐
│                         BEFORE                               │
├─────────────────────────────────────────────────────────────┤
│  Ultra Planner                                               │
│  ├── complexity/        ← 룰 기반 계산                       │
│  ├── orchestration/                                          │
│  │   ├── swarm/         ← 상태 관리 (중복)                  │
│  │   ├── pipeline/      ← 상태 관리 (중복)                  │
│  │   └── delegation/    ← 룰 기반 라우팅                    │
│  ├── tasks/             ← Claude Code Tasks와 중복          │
│  ├── sync/              ← 동기화 로직                       │
│  ├── notepad/           ← Wisdom 관리                       │
│  └── mcp-server.ts      ← 73개 도구                         │
└─────────────────────────────────────────────────────────────┘

                           ▼

┌─────────────────────────────────────────────────────────────┐
│                         AFTER                                │
├─────────────────────────────────────────────────────────────┤
│  Ultra Planner (Lean)                                        │
│  ├── context/           ← 컨텍스트 수집/주입                 │
│  │   ├── collector.ts   ← PROJECT, ROADMAP, STATE 읽기      │
│  │   ├── injector.ts    ← 에이전트에 맥락 주입              │
│  │   └── compactor.ts   ← 컨텍스트 압축 (fresh-start)       │
│  │                                                           │
│  ├── wisdom/            ← 장기 기억 (유지)                   │
│  │   ├── learnings.ts   ← 학습 기록                         │
│  │   ├── decisions.ts   ← 결정 기록                         │
│  │   ├── issues.ts      ← 이슈 기록                         │
│  │   └── reader.ts      ← Wisdom 조회/주입                  │
│  │                                                           │
│  ├── prompts/           ← 프롬프트 생성                      │
│  │   ├── worker.ts      ← 워커 프롬프트                     │
│  │   ├── planner.ts     ← 계획 프롬프트                     │
│  │   ├── orchestrator.ts← 오케스트레이터 프롬프트           │
│  │   └── templates/     ← 재사용 템플릿                     │
│  │                                                           │
│  ├── hints/             ← AI 판단용 힌트 (강제 아님)        │
│  │   ├── complexity.ts  ← 복잡도 힌트                       │
│  │   └── routing.ts     ← 라우팅 힌트                       │
│  │                                                           │
│  └── .claude/           ← 워크플로우 정의 (유지)            │
│      ├── commands/                                           │
│      ├── agents/                                             │
│      └── skills/                                             │
│                                                              │
│  ❌ 제거: swarm 상태, pipeline 상태, tasks 관리              │
│  ✅ Claude Code가 처리: Task, TaskList, TaskUpdate           │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 역할 분담

| 구분 | Ultra Planner | Claude Code |
|------|--------------|-------------|
| **컨텍스트 수집** | ✅ | - |
| **Wisdom 관리** | ✅ | - |
| **프롬프트 생성** | ✅ | - |
| **힌트 제공** | ✅ (참고용) | - |
| **판단/추론** | - | ✅ (AI) |
| **태스크 관리** | - | ✅ (TaskList, TaskUpdate) |
| **병렬 실행** | - | ✅ (Task + run_in_background) |
| **파일 수정** | - | ✅ (Edit, Write) |
| **빌드/테스트** | - | ✅ (Bash) |

### 2.3 MCP 도구 변경

**유지할 도구 (Context 관련):**
```
• get_wisdom              ← Wisdom 조회
• add_learning            ← 학습 기록
• add_decision            ← 결정 기록
• add_issue               ← 이슈 기록
• create_wisdom_directive ← 서브에이전트용 맥락 생성
• collect_project_context ← 프로젝트 맥락 수집
• compress_context        ← 컨텍스트 압축 (새로 추가)
```

**유지할 도구 (Prompt 관련):**
```
• generate_worker_prompt      ← 워커 프롬프트
• generate_orchestrator_prompt← 오케스트레이터 프롬프트
• generate_planner_prompt     ← 계획 프롬프트
```

**유지할 도구 (Hint 관련):**
```
• suggest_complexity      ← 복잡도 힌트 (AI가 참고)
• suggest_model           ← 모델 힌트 (AI가 참고)
• suggest_category        ← 카테고리 힌트 (AI가 참고)
```

**제거할 도구 (Claude Code가 처리):**
```
• initialize_swarm        ← 불필요 (Task로 대체)
• claim_swarm_task        ← 불필요 (TaskUpdate로 대체)
• complete_swarm_task     ← 불필요 (TaskUpdate로 대체)
• get_swarm_status        ← 불필요 (TaskList로 대체)
• create_pipeline         ← 불필요 (프롬프트로 대체)
• record_stage_result     ← 불필요 (TaskUpdate로 대체)
```

---

## 3. 일관성 보장 방안

### 3.1 문제: AI 판단의 비일관성

```
같은 질문에 다른 답변 가능:
─────────────────────────────
Q: "이 태스크 복잡해?"
A1: "네, 복잡합니다" (어제)
A2: "아니오, 간단합니다" (오늘)
```

### 3.2 해결책: 구체적 프롬프트 + 예시

```markdown
## 모델 선택 가이드 (프롬프트에 포함)

다음 기준으로 모델을 선택하세요:

| 조건 | 모델 | 이유 |
|------|------|------|
| 파일 1-2개 + 단순 수정 | Haiku | 빠르고 저렴 |
| 파일 3-5개 또는 새 기능 | Sonnet | 균형 |
| 파일 6개+ 또는 아키텍처 | Opus | 복잡한 추론 필요 |

### 예시

- "Fix typo in README" → **Haiku**
  - 파일 1개, 단순 수정

- "Add user validation to form" → **Sonnet**
  - 파일 2-3개, 새 기능

- "Refactor authentication system" → **Opus**
  - 파일 5개+, 아키텍처 변경

- "Debug race condition in cache" → **Opus**
  - 복잡한 추론 필요
```

### 3.3 판단 기록 (Notepad)

모든 중요한 판단을 기록하여 추적 가능하게:

```typescript
// 프롬프트에 포함
"중요한 판단을 할 때마다 기록하세요:

mcp__ultra-planner__add_decision(planId, {
  taskId: '01-02',
  content: '모델 선택: Opus',
  rationale: '파일 7개 수정, auth 관련, 리팩토링 키워드',
  alternatives: ['Sonnet도 가능했으나 안전하게 Opus 선택']
});

→ 나중에 왜 그렇게 판단했는지 추적 가능"
```

### 3.4 학습 피드백 루프

```
┌─────────────────────────────────────────────────────────────┐
│              LEARNING FEEDBACK LOOP                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 판단 실행                                                │
│     └── "Sonnet으로 이 태스크 실행"                         │
│                                                              │
│  2. 결과 확인                                                │
│     └── 실패! 복잡해서 Opus가 필요했음                       │
│                                                              │
│  3. 학습 기록                                                │
│     └── add_learning("auth 관련 리팩토링은 항상 Opus")       │
│                                                              │
│  4. 다음 세션에 주입                                         │
│     └── Wisdom에서 학습 내용 로드                           │
│                                                              │
│  5. 개선된 판단                                              │
│     └── "auth 리팩토링이니 Opus 사용"                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 테스트 전략

### 4.1 기존 테스트 (유지)

```
현재 80개 테스트:
├── delegation/manager.test.ts  ← 힌트 로직으로 변경
├── pipeline/manager.test.ts    ← 프롬프트 생성만 테스트
├── swarm/manager.test.ts       ← 프롬프트 생성만 테스트
├── complexity/estimator.test.ts← 힌트 로직으로 변경
└── notepad/*.test.ts           ← 유지
```

### 4.2 통합 테스트 (추가)

```typescript
// E2E 워크플로우 테스트
describe('Context Architect E2E', () => {
  it('should collect and inject context correctly', async () => {
    // 1. 컨텍스트 수집
    const context = await collectProjectContext();
    expect(context.project).toBeDefined();
    expect(context.roadmap).toBeDefined();

    // 2. Wisdom 주입
    const wisdom = await getWisdom('phase-01');
    const directive = createWisdomDirective(wisdom);
    expect(directive).toContain('Learnings');

    // 3. 프롬프트 생성
    const prompt = generateWorkerPrompt({
      worker: { id: 'w1', name: 'Worker-1', index: 0 },
      learnings: directive,
    });
    expect(prompt).toContain('Worker-1');
    expect(prompt).toContain('Learnings');
  });
});
```

### 4.3 oh-my-claudecode 테스트 에이전트 활용

| 에이전트 | 용도 |
|----------|------|
| `tdd-guide` | TDD 워크플로우 강제 |
| `qa-tester` | 대화형 QA 테스트 |
| `ultraqa` | 테스트 → 수정 → 반복 루프 |

```bash
# TDD 가이드와 함께 개발
/oh-my-claudecode:tdd "Add context collector"

# QA 루프로 검증
/oh-my-claudecode:ultraqa "Test context injection"
```

---

## 5. 마이그레이션 계획

### 5.1 Phase 1: 프롬프트 분리

```
1. src/prompts/ 디렉토리 생성
2. 기존 generateWorkerPrompt 등 이동
3. 프롬프트에 구체적 예시 추가
4. 테스트 업데이트
```

### 5.2 Phase 2: Swarm/Pipeline 단순화

```
1. 상태 관리 로직 제거
2. 프롬프트 생성 함수만 유지
3. MCP 도구에서 상태 관련 제거
4. 테스트 업데이트
```

### 5.3 Phase 3: Complexity → Hints 변환

```
1. estimateComplexity → suggestComplexity
2. "계산" → "힌트 제공"으로 역할 변경
3. 프롬프트에 "참고용"임을 명시
4. AI가 최종 판단하도록 가이드
```

### 5.4 Phase 4: Context 모듈 강화

```
1. context/collector.ts - 프로젝트 맥락 수집
2. context/injector.ts - 에이전트 맥락 주입
3. context/compactor.ts - 컨텍스트 압축
4. /fresh-start 스킬 연동
```

---

## 6. 예상 결과

### 6.1 정량적

| 지표 | Before | After |
|------|--------|-------|
| 코드량 | ~15,000줄 | ~7,500줄 (-50%) |
| MCP 도구 | 73개 | ~25개 (-66%) |
| 테스트 | 80개 | ~40개 (-50%) |
| 유지보수 부담 | 높음 | 낮음 |

### 6.2 정성적

```
✅ Claude Code와 충돌 없음
✅ 미래 호환성 확보
✅ AI 판단의 유연성
✅ 컨텍스트/지혜에 집중
✅ 네이티브 최적화 활용
```

---

## 7. 참고 자료

### 7.1 업계 모범 사례

- [Anthropic: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Microsoft: AI Agent Design Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)
- [Google: Architecting efficient context-aware multi-agent framework](https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/)
- [mem0: Context Engineering AI Agents Guide](https://mem0.ai/blog/context-engineering-ai-agents-guide)

### 7.2 핵심 인용

> "Context engineering is the practice of strategically curating which tokens are available to an LLM during inference."
> — Anthropic

> "Treat context as a precious, finite resource."
> — Anthropic

> "Once you adopt this mental model, context engineering stops being prompt gymnastics and starts looking like systems engineering."
> — Google ADK

---

## 8. 결론

```
Ultra Planner v3.0 = Context Architect
─────────────────────────────────────

"Claude Code는 계속 발전한다.
 우리는 발전을 따라가는 게 아니라,
 발전 위에 올라타는 것이다."

Ultra Planner는 Claude Code의 "기억"과 "지혜"
실행은 항상 Claude Code에게
```

---

## 9. 완료 상태 (Completion Status)

### v3.0 Refactoring Complete ✅

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | 프롬프트 분리 및 강화 | ✅ Complete |
| Phase 2 | Swarm/Pipeline 단순화 | ✅ Complete |
| Phase 3 | Complexity → Hints 전환 | ✅ Complete |
| Phase 4 | Tasks 모듈 제거 | ✅ Complete |
| Phase 5 | Context 모듈 강화 | ✅ Complete |
| Phase 6 | MCP 서버 정리 | ✅ Complete |
| Phase 7 | 통합 테스트 및 문서화 | ✅ Complete |

### 결과 지표 (Results)

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Test Count | 80 | 228 | +185% |
| Test Files | 5 | 10 | +100% |
| MCP Tools | ~73 | ~45 | -38% |

### 핵심 변경 사항 (Key Changes)

1. **Context Module** (`src/context/`)
   - `collector.ts`: Context collection from .planning files
   - `injector.ts`: Role-based context injection
   - `compactor.ts`: Context compression for fresh-start

2. **Hints Module** (`src/hints/`)
   - `suggestComplexity()`: Complexity hints with `isHint: true`
   - `suggestRoute()`: Routing hints with `isHint: true`
   - `getTaskHints()`: Combined hints in one call

3. **Prompts Module** (`src/prompts/`)
   - Centralized prompt generation
   - Worker, orchestrator, executor prompts
   - Model hints (not enforced)

4. **Swarm/Pipeline Simplified**
   - State management removed
   - Only prompt generation retained
   - Claude Code handles execution

5. **Tasks Module Removed**
   - Migrated to `src/sync/`
   - Claude Code TaskList/TaskUpdate handles state

---

*작성일: 2026-01-31*
*버전: v3.0 Final*
*완료일: 2026-01-31*
