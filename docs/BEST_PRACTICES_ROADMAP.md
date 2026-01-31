# Ultra Planner 업계 모범 사례 및 업데이트 로드맵

> 작성일: 2026-01-31
> 상태: 추후 적용 예정

---

## 1. Context Engineering (Anthropic 공식)

Anthropic은 컨텍스트를 **'귀중하고 유한한 자원'**으로 정의하며, 6계층 스택을 제안합니다.

**핵심**: 모델에게 모든 정보를 주는 것이 아니라, 원하는 결과를 얻기 위한 **최소한의 고신호(High-signal) 토큰만 선별**해 제공하는 것.

### 6-Layer Context Stack

| Layer | 설명 | Ultra Planner 매핑 |
|-------|------|-------------------|
| 1. 시스템 지시 | System Instructions | CLAUDE.md, 에이전트 프롬프트 |
| 2. 장기 기억 | Long-term Memory | Wisdom (Learnings, Decisions) |
| 3. 검색된 문서 | Retrieved Docs | 스킬 정의서, 지식체계 |
| 4. 도구 정의 | Tool Definitions | MCP 도구 스키마 |
| 5. 대화 기록 | Conversation History | 세션 로그 |
| 6. 현재 태스크 | Current Task | PLAN.md |

---

## 2. 메모리 아키텍처 (Google ADK & 논문)

단순한 로그 저장이 아니라, **기억의 성격에 따라 계층을 나누어 관리**해야 합니다.

### 3-Tier Memory

| 계층 | 이름 | 설명 | Ultra Planner 파일 |
|------|------|------|-------------------|
| L1 | Working Memory | 현재 대화 및 즉시 휘발 가능 | PLAN.md |
| L2 | Short-term Memory | 프로젝트 현재 상태, 세션 기록 | STATE.md |
| L3 | Long-term Memory | 영속적인 지혜 | Wisdom (Learnings, Decisions, Issues) |

### 적용 방안

```
.ultraplan/
├── state/
│   ├── session-{id}.json    # L2: 세션별 단기 기억
│   └── current-state.json   # L2: 현재 상태
├── wisdom/
│   ├── learnings.md         # L3: 기술적 발견
│   ├── decisions.md         # L3: 아키텍처 결정
│   └── issues.md            # L3: 알려진 이슈
└── plans/
    └── PLAN-{phase}.md      # L1: 현재 작업 계획
```

---

## 3. 오케스트레이션 패턴 (Microsoft)

작업의 성격에 따라 에이전트를 조직하는 방식입니다.

| 패턴 | 설명 | 적용 시나리오 |
|------|------|--------------|
| **Sequential** | 의존성 있는 작업 순차 실행 | Wave 간 실행 |
| **Concurrent** | 독립적 작업 병렬 실행 | Wave 내 에이전트 |
| **Hierarchical** | 상위 에이전트가 하부 관리 | Orchestrator → Workers |
| **Magentic** | 동적 태스크 생성 | 불확실한 계획 상황 |

### Ultra Planner 현재 구현

```
Wave 1 (Concurrent)    Wave 2 (Concurrent)    Wave 3 (Sequential)
┌────┐┌────┐┌────┐     ┌────┐┌────┐┌────┐     ┌────┐→┌────┐→┌────┐
│ A1 ││ A2 ││ A3 │  →  │ B1 ││ B2 ││ B3 │  →  │ C1 │ │ C2 │ │ C3 │
└────┘└────┘└────┘     └────┘└────┘└────┘     └────┘ └────┘ └────┘
     (병렬)                 (병렬)                  (순차)
```

---

## 4. 컨텍스트 압축 / Compaction (Mem0)

Context Window가 한계에 도달했을 때의 전략입니다.

### 원칙

- ❌ 단순 삭제하지 않음
- ✅ 핵심 정보만 요약하여 보존:
  - 아키텍처 결정사항
  - 미해결 이슈
  - 구현 상세

### 구현: `/fresh-start`

```markdown
## Fresh Start 시 보존되는 정보

1. PROJECT.md 요약 (목표, 제약사항)
2. 현재 Phase 진행 상황
3. 미완료 태스크 목록
4. 중요 결정사항 (Decisions)
5. 알려진 이슈 (Issues)

## 삭제되는 정보

1. 대화 기록 상세
2. 도구 호출 로그
3. 중간 결과물
```

---

## 5. Artifact 패턴 (Google ADK)

**가장 중요한 JIT(Just-in-Time) 데이터 로딩 전략**

### ❌ Context Dumping (나쁜 예)

```
User: 이 파일 분석해줘
[파일 전체 내용 10,000 토큰 붙여넣기]
```

문제: 영구적인 토큰 낭비, 컨텍스트 오염

### ✅ Artifact Pattern (좋은 예)

```
User: 이 파일 분석해줘
→ 파일 경로: /path/to/file.md

Agent: Read 도구로 필요할 때만 로드
```

### Ultra Planner 적용

| 문서 | 저장 위치 | 로딩 방식 |
|------|----------|----------|
| PROJECT.md | 프로젝트 루트 | 필요시 Read |
| ROADMAP.md | 프로젝트 루트 | 필요시 Read |
| PLAN.md | .planning/ | 실행 시 Read |
| 스킬 정의 | .ultraplan/skills/ | 매칭 시 Read |
| Wisdom | .ultraplan/wisdom/ | 세션 시작 시 요약 로드 |

---

## 🎯 Ultra Planner 업데이트 로드맵

### Phase 1: Layered Memory 구현

- [ ] Wisdom 디렉토리 구조 생성
- [ ] add_learning, add_decision, add_issue 도구 업데이트
- [ ] 세션 시작 시 Wisdom 요약 자동 로드

### Phase 2: JIT Retrieval 개선

- [ ] 대용량 문서 경로 참조 방식으로 전환
- [ ] 스킬 정의서 lazy loading
- [ ] 컨텍스트 사용량 모니터링 추가

### Phase 3: Compaction 고도화

- [ ] `/fresh-start` 자동 트리거 조건 정의
- [ ] 핵심 정보 추출 알고리즘 개선
- [ ] 세션 간 연속성 보장

### Phase 4: Native Delegation 강화

- [ ] Claude Code Task API 최적 활용
- [ ] 상태 관리 Claude Code 위임
- [ ] Ultra Planner는 **맥락 설계**에만 집중

---

## 참고 자료

- [Anthropic Context Engineering](https://docs.anthropic.com/)
- [Google ADK Architecture](https://cloud.google.com/agent-development-kit)
- [Microsoft Multi-Agent Patterns](https://learn.microsoft.com/en-us/semantic-kernel/)
- [Mem0 Memory Architecture](https://mem0.ai/)

---

*이 문서는 업계 모범 사례 조사 결과를 바탕으로 작성되었습니다.*
