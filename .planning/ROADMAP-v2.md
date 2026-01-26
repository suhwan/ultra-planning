# Ultra Planner 로드맵 v2

## 개요

GSD + OMC + OpenCode(참조) + Claude Code 기본 기능을 통합한 계획-실행 오케스트레이션 시스템.

**원칙:**
- 최고 효율 선택 (구현 필요해도 OK)
- references/ 참조 + 필요한 것만 복사
- Git 기반 롤백 + 체크포인트 하이브리드
- 기존 .planning/ 구조 활용

---

## 의존성 전략

```
references/
├── oh-my-claudecode/     ← git pull로 업데이트
├── get-shit-done/        ← git pull로 업데이트
└── oh-my-opencode/       ← git pull로 업데이트 (참조만)

.ultraplan/
├── agents/               ← OMC/GSD에서 복사 + 수정
├── templates/            ← GSD에서 복사 + 수정
├── hooks/                ← OpenCode 참조해서 재구현
└── state/                ← 상태 파일들
```

---

## Phase 구성

| Phase | 이름 | 내용 | 예상 Plans |
|-------|------|------|------------|
| 1 | 프로젝트 구조 | TypeScript 기반, 디렉토리 구조 | 3 |
| 2 | 상태 관리 | 파일 기반 상태, 이벤트 시스템 | 4 |
| 3 | GSD 통합 | 문서 템플릿, Planner 에이전트 | 4 |
| 4 | OMC 통합 | ralplan, Ultrapilot, 키워드 감지 | 5 |
| 5 | OpenCode 재구현 | Ralph Loop 개선, Atlas 강제 | 4 |
| 6 | Claude Tasks 동기화 | PLAN.md ↔ Tasks API | 3 |
| 7 | CLI/슬래시 커맨드 | /ultraplan:* 명령어 | 3 |
| 8 | 통합 테스트 | E2E 워크플로우 검증 | 2 |

**총: 8 Phases, 28 Plans**

---

## Phase 상세

### Phase 1: 프로젝트 구조
**Goal**: TypeScript 기반 실행 가능한 프로젝트 구조 생성

**Tasks:**
- [ ] 1-1: package.json, tsconfig.json 생성
- [ ] 1-2: .ultraplan/ 디렉토리 구조 생성
- [ ] 1-3: 기본 타입 정의 (types.ts)

**Success Criteria:**
- `npm run build` 성공
- .ultraplan/ 디렉토리 존재

---

### Phase 2: 상태 관리
**Goal**: 파일 기반 상태 공유 시스템 구현

**Tasks:**
- [ ] 2-1: State Manager 구현 (readState, writeState)
- [ ] 2-2: Event System 구현 (emitEvent, pollEvents)
- [ ] 2-3: Mode Registry 구현 (OMC 패턴 참조)
- [ ] 2-4: 체크포인트 매니저 구현

**Success Criteria:**
- 상태 파일 읽기/쓰기 작동
- 이벤트 발행/구독 작동
- 체크포인트 저장/복구 작동

**참조:**
- `references/oh-my-claudecode/src/hooks/mode-registry/`

---

### Phase 3: GSD 통합
**Goal**: GSD 문서 체계와 Planner 에이전트 통합

**Tasks:**
- [ ] 3-1: 문서 템플릿 복사 + 수정 (PROJECT, ROADMAP, PLAN)
- [ ] 3-2: Planner 에이전트 프롬프트 복사 + 수정
- [ ] 3-3: XML 프롬프트 포맷 적용
- [ ] 3-4: Atomic Commit 패턴 구현

**Success Criteria:**
- PROJECT.md 자동 생성 가능
- ROADMAP.md 자동 생성 가능
- PLAN.md 자동 생성 가능
- 태스크 완료 시 atomic commit

**참조:**
- `references/get-shit-done/templates/`
- `references/get-shit-done/agents/gsd-planner.md`

---

### Phase 4: OMC 통합
**Goal**: OMC 핵심 기능 통합 (ralplan, Ultrapilot, 키워드)

**Tasks:**
- [ ] 4-1: ralplan 스킬 통합 (Planner+Architect+Critic 루프)
- [ ] 4-2: Ultrapilot 5워커 패턴 통합
- [ ] 4-3: 파일 소유권 추적 구현
- [ ] 4-4: 키워드 감지 통합 (magic-keywords)
- [ ] 4-5: Architect/Critic 에이전트 프롬프트 복사

**Success Criteria:**
- ralplan 검증 루프 작동
- 5워커 병렬 실행 작동
- "autopilot", "plan" 키워드 감지

**참조:**
- `references/oh-my-claudecode/src/features/magic-keywords.ts`
- `references/oh-my-claudecode/commands/ultrapilot.md`
- `references/oh-my-claudecode/src/hooks/mode-registry/`

---

### Phase 5: OpenCode 재구현
**Goal**: OpenCode 패턴 참조해서 Claude Code용으로 재구현

**Tasks:**
- [ ] 5-1: Ralph Loop 개선 버전 구현
  - 에러 복구 (isRecovering)
  - 세션 API 완료 감지
  - 모델/에이전트 유지
- [ ] 5-2: 오케스트레이터 강제 훅 구현
  - 직접 수정 금지
  - Single Task 강제
  - 검증 리마인더
- [ ] 5-3: Verification Reminder 구현
- [ ] 5-4: 에러 복구 + Git 롤백 통합

**Success Criteria:**
- Ralph Loop가 에러에서 복구
- 오케스트레이터가 직접 코드 수정 시 경고
- 서브에이전트 완료 후 검증 리마인더 표시

**참조:**
- `references/oh-my-opencode/src/hooks/ralph-loop/`
- `references/oh-my-opencode/src/hooks/atlas/`

---

### Phase 6: Claude Tasks 동기화
**Goal**: PLAN.md와 Claude Tasks API 양방향 동기화

**Tasks:**
- [ ] 6-1: PLAN.md 파서 구현 (태스크 추출)
- [ ] 6-2: PLAN.md → TaskCreate 동기화
- [ ] 6-3: TaskUpdate → PLAN.md 상태 반영

**Success Criteria:**
- PLAN.md 생성 시 Tasks 자동 등록
- Task 완료 시 PLAN.md 체크박스 업데이트
- 의존성(wave) → blockedBy 변환

---

### Phase 7: CLI/슬래시 커맨드
**Goal**: 사용자 인터페이스 구현

**Tasks:**
- [ ] 7-1: /ultraplan:new-project 구현
- [ ] 7-2: /ultraplan:plan-phase 구현
- [ ] 7-3: /ultraplan:execute 구현

**Success Criteria:**
- 슬래시 커맨드로 전체 워크플로우 실행 가능
- 키워드로도 트리거 가능

---

### Phase 8: 통합 테스트
**Goal**: E2E 워크플로우 검증

**Tasks:**
- [ ] 8-1: "Todo API 만들어줘" 시나리오 테스트
- [ ] 8-2: 에러 복구 시나리오 테스트

**Success Criteria:**
- 전체 워크플로우 E2E 성공
- 에러 발생 시 롤백 + 재시도 성공

---

## v2 Phase (나중에)

| Phase | 이름 | 내용 |
|-------|------|------|
| 9 | Context Monitor | 70% 경고, 자동 복구 |
| 10 | 동적 태스크 분할 | 컨텍스트 초과 시 분할 |
| 11 | Comment Checker | TODO/FIXME 감지 |

---

## 에러/롤백 전략

```
┌─────────────────────────────────────────────────────────────┐
│                    에러 복구 흐름                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 태스크 시작 전                                          │
│     └── 체크포인트 저장 (.ultraplan/state/checkpoint.json)  │
│     └── git stash (선택적)                                  │
│                                                             │
│  2. 태스크 실행                                             │
│     └── 성공 → Atomic Commit                                │
│     └── 실패 → 3번으로                                      │
│                                                             │
│  3. 에러 발생 시                                            │
│     └── git reset --hard HEAD (마지막 커밋으로)             │
│     └── 체크포인트에서 상태 복구                            │
│     └── Ralph Loop로 재시도 (최대 3회)                      │
│                                                             │
│  4. 재시도 실패 시                                          │
│     └── 이벤트 발행: TASK_FAILED                            │
│     └── 사용자에게 알림                                     │
│     └── 다음 태스크로 진행 (선택적)                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 디렉토리 구조 (최종)

```
ultra-planning/
├── .planning/                    ← 기존 (스펙 참고용)
│   ├── PROJECT.md
│   ├── ROADMAP.md
│   ├── ROADMAP-v2.md            ← 이 파일
│   └── FEATURE-ANALYSIS.md
│
├── .ultraplan/                   ← 새로 생성 (실제 시스템)
│   ├── agents/
│   │   ├── planner.md           ← GSD에서 복사+수정
│   │   ├── executor.md
│   │   ├── architect.md         ← OMC에서 복사
│   │   └── critic.md            ← OMC에서 복사
│   │
│   ├── templates/
│   │   ├── project.md           ← GSD에서 복사+수정
│   │   ├── roadmap.md
│   │   └── plan.md
│   │
│   ├── hooks/                    ← 새로 구현
│   │   ├── ralph-loop.ts        ← OpenCode 참조
│   │   ├── atlas-enforcer.ts    ← OpenCode 참조
│   │   └── keyword-detector.ts  ← OMC 참조
│   │
│   ├── state/                    ← 런타임 상태
│   │   ├── orchestrator.json
│   │   ├── ralph.json
│   │   ├── ultrapilot.json
│   │   ├── checkpoint.json
│   │   └── events.jsonl
│   │
│   └── src/                      ← TypeScript 소스
│       ├── orchestrator/
│       │   ├── index.ts
│       │   ├── event-system.ts
│       │   └── state-manager.ts
│       ├── sync/
│       │   └── tasks-sync.ts
│       ├── types.ts
│       └── index.ts
│
├── references/                   ← 참조용 (git pull로 업데이트)
│   ├── oh-my-claudecode/
│   ├── get-shit-done/
│   └── oh-my-opencode/
│
├── .claude/
│   ├── commands/
│   │   ├── ultraplan-new-project.md
│   │   ├── ultraplan-plan-phase.md
│   │   └── ultraplan-execute.md
│   └── settings.json
│
├── package.json
└── tsconfig.json
```

---

## 실행 순서

```
Phase 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8
   │      │     │     │     │     │     │     │
   │      │     │     │     │     │     │     └── E2E 테스트
   │      │     │     │     │     │     └── CLI 명령어
   │      │     │     │     │     └── Tasks 동기화
   │      │     │     │     └── OpenCode 재구현 (Ralph, Atlas)
   │      │     │     └── OMC 통합 (ralplan, Ultrapilot)
   │      │     └── GSD 통합 (문서, Planner)
   │      └── 상태 관리 시스템
   └── 프로젝트 구조
```

**Critical Path**: Phase 1 → 2 → 3 → 6 (Tasks 동기화가 핵심)

---

## 다음 단계

1. **Phase 1 실행**: 프로젝트 구조 생성
2. 각 Phase마다 PLAN.md 생성
3. ralplan 검증 후 실행

---

*생성일: 2026-01-26*
*버전: v2 (실제 구현용)*
