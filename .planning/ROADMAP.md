# Roadmap: Ultra Planner v4

## Overview

GSD + OMC + OpenCode(참조) + Claude Code 기본 기능을 통합한 계획-실행 오케스트레이션 시스템.

**v4.0 추가 목표:** Context Architect - 실행하는 에이전트가 아닌, 맥락을 설계하는 아키텍트

**원칙:**
- 최고 효율 선택 (구현 필요해도 OK)
- references/ 참조 + 필요한 것만 복사
- Git 기반 롤백 + 체크포인트 하이브리드
- 기존 .planning/ 구조 활용

**Critical Path:** Phase 1 → 2 → 3 → 6 (Tasks 동기화가 핵심)

## Phases

- [x] **Phase 1: 프로젝트 구조** - TypeScript 기반, 디렉토리 구조
- [x] **Phase 2: 상태 관리** - 파일 기반 상태, 이벤트 시스템
- [x] **Phase 3: GSD 통합** - 문서 템플릿, Planner 에이전트
- [x] **Phase 4: OMC 통합** - ralplan, Ultrapilot, 키워드 감지
- [x] **Phase 5: OpenCode 재구현** - Ralph Loop 개선, Atlas 강제
- [x] **Phase 6: Claude Tasks 동기화** - PLAN.md ↔ Tasks API
- [x] **Phase 7: CLI/슬래시 커맨드** - /ultraplan:* 명령어
- [x] **Phase 8: 통합 테스트** - E2E 워크플로우 검증
- [x] **Phase 9: 코드 품질 자동화** - LSP 진단, AST 분석, 코드 리뷰
- [x] **Phase 10: 컨텍스트 모니터** - 토큰 추적, 중간 반환 패턴
- [x] **Phase 11: Tasks API 실제 연동** - TaskCreate/Update 실제 호출
- [x] **Phase 12: Notepad 학습 시스템** - 서브에이전트 학습 누적

### v4.0 - Context Architect
- [x] **Phase 13: Central Registry** - 에이전트/스킬 중앙 저장소
- [x] **Phase 14: Artifact Pattern** - JIT 로딩으로 토큰 효율화
- [ ] **Phase 15: Layered Memory** - Working/Short/Long-term 메모리 분리
- [ ] **Phase 16: Context Compaction** - 자동 압축 고도화

## Phase Details

### Phase 1: 프로젝트 구조
**Goal**: TypeScript 기반 실행 가능한 프로젝트 구조 생성
**Depends on**: Nothing (first phase)
**Success Criteria** (what must be TRUE):
  1. `npm run build` 성공
  2. .ultraplan/ 디렉토리 존재
  3. 기본 타입 정의 완료
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md - package.json, tsconfig.json 생성
- [ ] 01-02-PLAN.md - .ultraplan/ 디렉토리 구조 생성
- [ ] 01-03-PLAN.md - 기본 타입 정의 (types.ts)

### Phase 2: 상태 관리
**Goal**: 파일 기반 상태 공유 시스템 구현
**Depends on**: Phase 1
**Success Criteria** (what must be TRUE):
  1. 상태 파일 읽기/쓰기 작동
  2. 이벤트 발행/구독 작동
  3. 체크포인트 저장/복구 작동
**Plans**: 4 plans

Plans:
- [ ] 02-01-PLAN.md - State Manager 구현 (readState, writeState)
- [ ] 02-02-PLAN.md - Event System 구현 (emitEvent, pollEvents)
- [ ] 02-03-PLAN.md - Mode Registry 구현 (OMC 패턴 참조)
- [ ] 02-04-PLAN.md - 체크포인트 매니저 구현

**참조:**
- `references/oh-my-claudecode/src/hooks/mode-registry/`

### Phase 3: GSD 통합
**Goal**: GSD 문서 체계와 Planner 에이전트 통합
**Depends on**: Phase 2
**Success Criteria** (what must be TRUE):
  1. PROJECT.md 자동 생성 가능
  2. ROADMAP.md 자동 생성 가능
  3. PLAN.md 자동 생성 가능
  4. 태스크 완료 시 atomic commit
**Plans**: 4 plans

Plans:
- [x] 03-01-PLAN.md - Document templates + generators (types, Zod schemas, PROJECT/ROADMAP/PLAN generators)
- [x] 03-02-PLAN.md - Planner agent prompt management (TypeScript, getFullPrompt())
- [x] 03-03-PLAN.md - XML task format utilities (generate/parse, escaping)
- [x] 03-04-PLAN.md - Atomic commit pattern (simple-git, conventional commits)

**Wave Structure:**
- Wave 1: 03-01, 03-02, 03-04 (parallel - no file overlap)
- Wave 2: 03-03 (depends on 03-01 types)

**참조:**
- `references/get-shit-done/templates/`
- `references/get-shit-done/agents/gsd-planner.md`

### Phase 4: OMC 통합
**Goal**: OMC 핵심 기능 통합 (ralplan, Ultrapilot, 키워드)
**Depends on**: Phase 3
**Success Criteria** (what must be TRUE):
  1. ralplan 검증 루프 작동
  2. 5워커 병렬 실행 작동
  3. "autopilot", "plan" 키워드 감지
**Plans**: 5 plans

Plans:
- [x] 04-01-PLAN.md — Architect/Critic agent prompts (READ-ONLY advisor + plan reviewer)
- [x] 04-02-PLAN.md — Magic keyword detection (autopilot, plan, ultrawork triggers)
- [x] 04-03-PLAN.md — File ownership tracking (exclusive worker file sets)
- [x] 04-04-PLAN.md — Ralplan orchestration loop (Planner+Architect+Critic iteration)
- [x] 04-05-PLAN.md — Ultrapilot worker coordination (spawn, track, complete/fail)

**Wave Structure:**
- Wave 1: 04-01, 04-02, 04-03 (parallel - no file overlap)
- Wave 2: 04-04, 04-05 (04-04 depends on 04-01, 04-05 depends on 04-03)

**참조:**
- `references/oh-my-claudecode/src/features/magic-keywords.ts`
- `references/oh-my-claudecode/commands/ultrapilot.md`
- `references/oh-my-claudecode/src/hooks/mode-registry/`

### Phase 5: OpenCode 재구현
**Goal**: OpenCode 패턴 참조해서 Claude Code용으로 재구현
**Depends on**: Phase 4
**Success Criteria** (what must be TRUE):
  1. Ralph Loop가 에러에서 복구
  2. 오케스트레이터가 직접 코드 수정 시 경고
  3. 서브에이전트 완료 후 검증 리마인더 표시
**Plans**: 4 plans

Plans:
- [x] 05-01-PLAN.md — Ralph Loop 상태 관리 및 완료 감지 (StateManager 통합, promise 패턴)
- [x] 05-02-PLAN.md — 오케스트레이터 강제 훅 (file guard, single task directive)
- [x] 05-03-PLAN.md — Verification Reminder 구현 (검증 체크리스트, 이벤트 발행)
- [x] 05-04-PLAN.md — 에러 복구 + Git 롤백 통합 (cooldown, checkpoint rollback)

**Wave Structure:**
- Wave 1: 05-01, 05-02 (parallel - no file overlap)
- Wave 2: 05-03, 05-04 (05-03 depends on 05-02, 05-04 depends on 05-01)

**참조:**
- `references/oh-my-opencode/src/hooks/ralph-loop/`
- `references/oh-my-opencode/src/hooks/atlas/`

### Phase 6: Claude Tasks 동기화
**Goal**: PLAN.md와 Claude Tasks API 양방향 동기화
**Depends on**: Phase 5
**Success Criteria** (what must be TRUE):
  1. PLAN.md 생성 시 Tasks 자동 등록
  2. Task 완료 시 PLAN.md 체크박스 업데이트
  3. 의존성(wave) → blockedBy 변환
**Plans**: 3 plans

Plans:
- [x] 06-01-PLAN.md — Sync module types and enhanced PLAN.md parser (TaskMapping, plan-parser.ts)
- [x] 06-02-PLAN.md — Task tool invocation mapper (task-mapper.ts, dependency-map.ts)
- [x] 06-03-PLAN.md — Task status to PLAN.md sync (status-sync.ts, frontmatter tracking)

**Wave Structure:**
- Wave 1: 06-01 (foundation - types and parser)
- Wave 2: 06-02, 06-03 (parallel - different file sets, both depend on 06-01)

**참조:**
- `references/oh-my-claudecode/commands/` - Task tool invocation patterns
- Phase 3 infrastructure: `src/documents/xml/task-parser.ts`, `src/documents/templates/plan.ts`

### Phase 7: CLI/슬래시 커맨드
**Goal**: 사용자 인터페이스 구현 - 슬래시 커맨드와 키워드 통합
**Depends on**: Phase 6
**Success Criteria** (what must be TRUE):
  1. 슬래시 커맨드로 전체 워크플로우 실행 가능
  2. 키워드로도 트리거 가능
**Plans**: 3 plans

Plans:
- [x] 07-01-PLAN.md — /ultraplan:new-project + keyword triggers
- [x] 07-02-PLAN.md — /ultraplan:plan-phase + context extraction
- [x] 07-03-PLAN.md — /ultraplan:execute + Router Protocol integration

**Wave Structure:**
- Wave 1: 07-01, 07-02, 07-03 (parallel - no file overlap)

**참조:**
- Existing commands: `.claude/commands/ultraplan-*.md`
- Keyword patterns: `src/orchestration/keywords/patterns.ts`
- Router protocol: `.claude/skills/ultraplan/references/router.md`

### Phase 8: 통합 테스트
**Goal**: E2E 워크플로우 검증
**Depends on**: Phase 7
**Success Criteria** (what must be TRUE):
  1. 전체 워크플로우 E2E 성공
  2. 에러 발생 시 롤백 + 재시도 성공
**Plans**: 2 plans

Plans:
- [x] 08-01-PLAN.md — E2E workflow integration tests (state, documents, task sync)
- [x] 08-02-PLAN.md — Error recovery scenario tests (checkpoints, rollback, retry)

**Wave Structure:**
- Wave 1: 08-01, 08-02 (parallel - different test suites, no file overlap)

**참조:**
- Research: `.planning/phases/08-integration-testing/08-RESEARCH.md`
- Test patterns: Vitest with temp directories, test.extend() fixtures

### Phase 9: 코드 품질 자동화
**Goal**: LSP 진단, AST 분석, 코드 리뷰 자동화로 코드 품질 보장
**Depends on**: Phase 8
**Success Criteria** (what must be TRUE):
  1. 태스크 완료 후 자동 LSP 진단 실행
  2. AST 파싱으로 코드 구조 분석 가능
  3. 코드 리뷰 에이전트가 품질 피드백 제공
  4. 진단 결과가 상태 파일에 기록
**Plans**: 4 plans

Plans:
- [ ] 09-01-PLAN.md - LSP 진단 자동화 (lsp_diagnostics 호출, 에러 파싱, 상태 연동)
- [ ] 09-02-PLAN.md - AST 파서 구현 (TypeScript AST 분석, 함수/클래스 추출)
- [ ] 09-03-PLAN.md - 코드 리뷰 에이전트 (품질 체크리스트, 피드백 생성)
- [ ] 09-04-PLAN.md - 통합 파이프라인 (태스크 완료 → LSP → AST → 리뷰)

**Wave Structure:**
- Wave 1: 09-01, 09-02 (parallel - no file overlap)
- Wave 2: 09-03 (depends on 09-02 for AST types)
- Wave 3: 09-04 (depends on all above)

**참조:**
- `references/oh-my-opencode/src/hooks/lsp/` - LSP 통합 패턴
- `references/oh-my-opencode/src/hooks/ast/` - AST 파싱 패턴
- `references/oh-my-claudecode/agents/code-reviewer.md` - 코드 리뷰 에이전트

### Phase 10: 컨텍스트 모니터
**Goal**: 컨텍스트 윈도우 사용량 모니터링 및 중간 반환 패턴 구현
**Depends on**: Phase 9
**Success Criteria** (what must be TRUE):
  1. 컨텍스트 사용량 실시간 추적 가능 (text.length / 4 추정)
  2. 70% 초과 시 체크포인트 준비 (현재 작업 마무리)
  3. 85% 초과 시 중간 반환 (completed + remaining + context)
  4. Orchestrator가 체크포인트에서 새 서브에이전트로 계속
**Plans**: 4 plans

Plans:
- [x] 10-01-PLAN.md — 토큰 추정기 및 누적 추적 (text.length/4, context tracker)
- [x] 10-02-PLAN.md — 임계값 감지 및 ContextMonitor (70%/85%, 상태 파일)
- [x] 10-03-PLAN.md — 중간 반환 패턴 (CheckpointReturn 구조, builder)
- [x] 10-04-PLAN.md — Orchestrator 상태 폴링 (서브에이전트 감시, 5s 간격)

**Wave Structure:**
- Wave 1: 10-01, 10-03, 10-04 (parallel - different files)
- Wave 2: 10-02 (depends on 10-01 for estimator)

**핵심 패턴: 중간 반환 (Checkpoint Return)**
```yaml
checkpoint:
  completed:
    - file: "src/types.ts"
      status: "done"
      tests: "passed"
  remaining:
    - file: "src/service.ts"
      description: "utils.ts 패턴 따라서 구현"
  context:
    decisions: ["Zod 3.23 사용"]
    patterns: ["utils.ts:15-30 에러 핸들링 참고"]
```

**중요**: "서두르기" 금지! 70%는 "깔끔한 인수인계" 준비 시점

**참조:**
- `references/oh-my-opencode/src/hooks/context-window-monitor.ts` - 컨텍스트 모니터 패턴
- `references/oh-my-claudecode/src/hooks/preemptive-compaction/` - 선제적 컴팩션 패턴

### Phase 11: Tasks API 실제 연동
**Goal**: Claude Code Tasks API를 실제로 호출하여 태스크 추적 및 시각화
**Depends on**: Phase 10
**Success Criteria** (what must be TRUE):
  1. PLAN.md 파싱 시 TaskCreate 실제 호출됨
  2. Wave 의존성이 blockedBy로 정확히 변환됨
  3. 태스크 완료 시 TaskUpdate 호출로 상태 동기화
  4. TaskList로 현재 진행상황 조회 가능
**Plans**: 3 plans

Plans:
- [x] 11-01-PLAN.md — TaskCreate API wrapper + Task ID registry (types, api.ts, registry.ts)
- [x] 11-02-PLAN.md — BlockedBy dependency wiring (wave-to-blockedBy via TaskUpdate)
- [x] 11-03-PLAN.md — Status sync + progress visualization (TaskUpdate, TaskList)

**Wave Structure:**
- Wave 1: 11-01 (foundation - TaskCreate + registry)
- Wave 2: 11-02, 11-03 (parallel - depend on 11-01)

**참조:**
- `src/sync/task-mapper.ts` - 기존 매핑 로직 (활용)
- `src/sync/dependency-map.ts` - 의존성 맵 (활용)
- `.claude/commands/ultraplan-execute.md` - 명령어 문서 (통합)

### Phase 12: Notepad 학습 시스템
**Goal**: 서브에이전트 간 학습 공유 및 프로젝트 레벨 누적
**Depends on**: Phase 10
**Success Criteria** (what must be TRUE):
  1. 서브에이전트가 학습 내용을 notepad에 기록
  2. Orchestrator가 다음 서브에이전트에 학습 전달
  3. 플랜 간, Phase 간 학습이 누적됨
  4. 프로젝트 레벨 학습 요약 조회 가능
**Plans**: 3 plans

Plans:
- [x] 12-01-PLAN.md - Notepad 구조 및 API (learnings, decisions, issues)
- [x] 12-02-PLAN.md - 플랜 내 학습 전파 (orchestrator → subagent 주입)
- [x] 12-03-PLAN.md - 프로젝트 레벨 누적 학습 (cross-plan 병합, 요약 생성)

**Wave Structure:**
- Wave 1: 12-01 (foundation - notepad structure)
- Wave 2: 12-02 (depends on 12-01)
- Wave 3: 12-03 (depends on 12-02)

**Notepad 구조:**
```
.ultraplan/notepads/
├── {plan-id}/              # 플랜별 학습
│   ├── learnings.md
│   ├── decisions.md
│   └── issues.md
└── _project/               # 프로젝트 레벨 누적
    ├── learnings.md        # 모든 플랜에서 병합
    ├── decisions.md        # 아키텍처 결정 히스토리
    ├── patterns.md         # 발견된 코드 패턴
    └── summary.md          # 자동 생성 요약
```

**누적 학습 흐름:**
1. 서브에이전트가 `{plan-id}/learnings.md`에 기록
2. 플랜 완료 시 `_project/learnings.md`에 병합
3. 다음 플랜 시작 시 `_project/*` 컨텍스트로 주입

**참조:**
- `references/oh-my-opencode/docs/guide/understanding-orchestration-system.md` - Notepad 패턴
- `references/oh-my-claudecode/src/hooks/notepad/` - 노트패드 API

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. 프로젝트 구조 | 3/3 | Complete | 2026-01-26 |
| 2. 상태 관리 | 4/4 | Complete | 2026-01-26 |
| 3. GSD 통합 | 4/4 | Complete | 2026-01-26 |
| 4. OMC 통합 | 5/5 | Complete | 2026-01-26 |
| 5. OpenCode 재구현 | 4/4 | Complete | 2026-01-27 |
| 6. Claude Tasks 동기화 | 3/3 | Complete | 2026-01-27 |
| 7. CLI/슬래시 커맨드 | 3/3 | Complete | 2026-01-27 |
| 8. 통합 테스트 | 2/2 | Complete | 2026-01-27 |
| 9. 코드 품질 자동화 | 4/4 | Complete | 2026-01-27 |
| 10. 컨텍스트 모니터 | 4/4 | Complete | 2026-01-27 |
| 11. Tasks API 실제 연동 | 3/3 | Complete | 2026-01-27 |
| 12. Notepad 학습 시스템 | 3/3 | Complete | 2026-01-27 |

### Phase 13: Central Registry
**Goal**: 에이전트/스킬 중앙 저장소로 크로스 프로젝트 공유 지원
**Depends on**: Phase 12
**Success Criteria** (what must be TRUE):
  1. Registry 디렉토리 구조 생성 (`~/registry/agents/`, `~/registry/skills/`)
  2. SkillRegistry가 registry 경로에서 로드
  3. 프로젝트 config.json에서 사용할 에이전트/스킬 선택 가능
  4. adsaprk-ceo에서 ThinkTank 스킬 인젝션 작동
**Plans**: 4 plans

Plans:
- [ ] 13-01-PLAN.md — Registry types and path utilities (RegistrySource, expandTilde, resolveRegistryPath)
- [ ] 13-02-PLAN.md — SkillRegistry multi-source loading (skill-loader, priority ordering, pattern filtering)
- [ ] 13-03-PLAN.md — AgentRegistry implementation (AgentDefinition, agent-loader, persona support)
- [ ] 13-04-PLAN.md — Config extension and injection integration (ProjectConfig, getRegistryConfig)

**Wave Structure:**
- Wave 1: 13-01 (foundation - types, paths)
- Wave 2: 13-02, 13-03 (parallel - skill/agent registry)
- Wave 3: 13-04 (depends on 13-02, 13-03)

**참조:**
- `.planning/v4.0-VISION.md` - Central Registry 설계
- `src/skills/skill-registry.ts` - 현재 SkillRegistry 구현

### Phase 14: Artifact Pattern
**Goal**: JIT 로딩으로 토큰 낭비 제거 (Context Dumping → Artifact Reference)
**Depends on**: Phase 13
**Success Criteria** (what must be TRUE):
  1. generate_worker_prompt가 파일 경로만 제공 (내용 X)
  2. collect_project_context가 요약만 반환
  3. 에이전트가 필요시 Read 도구로 직접 조회
  4. 토큰 사용량 50% 이상 감소
**Plans**: 3 plans

Plans:
- [ ] 14-01-PLAN.md - Artifact Reference 타입 및 유틸리티
- [ ] 14-02-PLAN.md - generate_worker_prompt 수정 (경로만 제공)
- [ ] 14-03-PLAN.md - collect_project_context 수정 (요약 모드)

**Wave Structure:**
- Wave 1: 14-01 (foundation - types)
- Wave 2: 14-02, 14-03 (parallel - prompt/context 수정)

**참조:**
- Google ADK Artifact Pattern
- `.planning/v4.0-VISION.md` - Artifact Pattern 설계

### Phase 15: Layered Memory
**Goal**: Working/Short-term/Long-term 메모리 계층화
**Depends on**: Phase 14
**Success Criteria** (what must be TRUE):
  1. Working Memory: 현재 PLAN.md 태스크 (휘발성)
  2. Short-term Memory: STATE.md + 세션 기록 (프로젝트 수명)
  3. Long-term Memory: Wisdom (learnings, decisions, issues) 영속
  4. 세션 간 Wisdom 자동 전달
**Plans**: 3 plans

Plans:
- [ ] 15-01-PLAN.md - Memory 계층 타입 정의 및 .planning/wisdom/ 구조
- [ ] 15-02-PLAN.md - Wisdom 자동 수집 로직 (에이전트 결과 분석)
- [ ] 15-03-PLAN.md - 세션 간 Wisdom 로드/주입

**Wave Structure:**
- Wave 1: 15-01 (foundation - types, structure)
- Wave 2: 15-02, 15-03 (parallel - collect/inject)

**참조:**
- Google ADK Memory Architecture
- Mem0 Compaction Strategies
- `src/notepad/` - 현재 Notepad 구현

### Phase 16: Context Compaction
**Goal**: 자동 컨텍스트 압축으로 장기 세션 안정성 확보
**Depends on**: Phase 15
**Success Criteria** (what must be TRUE):
  1. 컨텍스트 사용량 80% 도달 시 자동 압축 트리거
  2. 핵심 정보 추출 (아키텍처 결정, 미해결 이슈, 현재 진행)
  3. 압축된 컨텍스트로 /fresh-start 자동 실행
  4. 장기 세션 (8시간+) 안정적 지원
**Plans**: 3 plans

Plans:
- [ ] 16-01-PLAN.md — AdvancedContextMonitor with 80% auto-compaction threshold
- [ ] 16-02-PLAN.md — CoreInfo extraction algorithm (<20% token waste)
- [ ] 16-03-PLAN.md — AutoCompactionManager and /fresh-start command

**Wave Structure:**
- Wave 1: 16-01 (foundation - monitoring with 80% threshold)
- Wave 2: 16-02, 16-03 (parallel - extraction and trigger)

**참조:**
- Anthropic Context Engineering Guide
- Mem0 Compaction Strategies
- `src/context/monitor.ts` - 현재 모니터 구현
- `src/context/compactor.ts` - 현재 컴팩터 구현

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → ... → 12 (v2 완료) → 13 → 14 → 15 → 16 (v4)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. 프로젝트 구조 | 3/3 | Complete | 2026-01-26 |
| 2. 상태 관리 | 4/4 | Complete | 2026-01-26 |
| 3. GSD 통합 | 4/4 | Complete | 2026-01-26 |
| 4. OMC 통합 | 5/5 | Complete | 2026-01-26 |
| 5. OpenCode 재구현 | 4/4 | Complete | 2026-01-27 |
| 6. Claude Tasks 동기화 | 3/3 | Complete | 2026-01-27 |
| 7. CLI/슬래시 커맨드 | 3/3 | Complete | 2026-01-27 |
| 8. 통합 테스트 | 2/2 | Complete | 2026-01-27 |
| 9. 코드 품질 자동화 | 4/4 | Complete | 2026-01-27 |
| 10. 컨텍스트 모니터 | 4/4 | Complete | 2026-01-27 |
| 11. Tasks API 실제 연동 | 3/3 | Complete | 2026-01-27 |
| 12. Notepad 학습 시스템 | 3/3 | Complete | 2026-01-27 |
| **v4.0** | | | |
| 13. Central Registry | 4/4 | Complete | 2026-02-01 |
| 14. Artifact Pattern | 3/3 | Complete | 2026-02-01 |
| 15. Layered Memory | 0/3 | Pending | - |
| 16. Context Compaction | 0/3 | Planned | - |

---
*Roadmap created: 2026-01-26*
*Version: v4 (Context Architect)*
*Total: 16 Phases, 55 Plans*
