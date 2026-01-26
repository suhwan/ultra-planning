# Roadmap: Ultra Planner v2

## Overview

GSD + OMC + OpenCode(참조) + Claude Code 기본 기능을 통합한 계획-실행 오케스트레이션 시스템.

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
- [ ] **Phase 6: Claude Tasks 동기화** - PLAN.md ↔ Tasks API
- [ ] **Phase 7: CLI/슬래시 커맨드** - /ultraplan:* 명령어
- [ ] **Phase 8: 통합 테스트** - E2E 워크플로우 검증

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
- [ ] 06-01-PLAN.md — Sync module types and enhanced PLAN.md parser (TaskMapping, plan-parser.ts)
- [ ] 06-02-PLAN.md — Task tool invocation mapper (task-mapper.ts, dependency-map.ts)
- [ ] 06-03-PLAN.md — Task status to PLAN.md sync (status-sync.ts, frontmatter tracking)

**Wave Structure:**
- Wave 1: 06-01 (foundation - types and parser)
- Wave 2: 06-02, 06-03 (parallel - different file sets, both depend on 06-01)

**참조:**
- `references/oh-my-claudecode/commands/` - Task tool invocation patterns
- Phase 3 infrastructure: `src/documents/xml/task-parser.ts`, `src/documents/templates/plan.ts`

### Phase 7: CLI/슬래시 커맨드
**Goal**: 사용자 인터페이스 구현
**Depends on**: Phase 6
**Success Criteria** (what must be TRUE):
  1. 슬래시 커맨드로 전체 워크플로우 실행 가능
  2. 키워드로도 트리거 가능
**Plans**: 3 plans

Plans:
- [ ] 07-01-PLAN.md - /ultraplan:new-project 구현
- [ ] 07-02-PLAN.md - /ultraplan:plan-phase 구현
- [ ] 07-03-PLAN.md - /ultraplan:execute 구현

### Phase 8: 통합 테스트
**Goal**: E2E 워크플로우 검증
**Depends on**: Phase 7
**Success Criteria** (what must be TRUE):
  1. 전체 워크플로우 E2E 성공
  2. 에러 발생 시 롤백 + 재시도 성공
**Plans**: 2 plans

Plans:
- [ ] 08-01-PLAN.md - "Todo API 만들어줘" 시나리오 테스트
- [ ] 08-02-PLAN.md - 에러 복구 시나리오 테스트

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
| 6. Claude Tasks 동기화 | 0/3 | Ready | - |
| 7. CLI/슬래시 커맨드 | 0/3 | Not started | - |
| 8. 통합 테스트 | 0/2 | Not started | - |

---
*Roadmap created: 2026-01-26*
*Version: v2 (실제 구현용)*
*Total: 8 Phases, 28 Plans*
