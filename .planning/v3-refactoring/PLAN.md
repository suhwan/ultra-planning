# Ultra Planner v3.0 리팩토링 실행 계획

## 개요

**목표**: Context Architect 패턴으로 전환
**원칙**: "실행하지 않는다. 맥락을 설계한다."

---

## 현재 구조 분석

### 디렉토리별 분류

| 디렉토리 | 파일 수 | 결정 | 이유 |
|----------|---------|------|------|
| `orchestration/swarm/` | 4 | 🔄 단순화 | 상태 관리 제거, 프롬프트만 유지 |
| `orchestration/pipeline/` | 4 | 🔄 단순화 | 상태 관리 제거, 프리셋만 유지 |
| `orchestration/delegation/` | 4 | 🔄 변경 | 룰→힌트로 전환 |
| `orchestration/ralplan/` | 5 | ✅ 유지 | 프롬프트/로직 유지 |
| `orchestration/verdicts/` | 3 | ✅ 유지 | 체크리스트 유지 |
| `orchestration/deviation/` | 3 | ✅ 유지 | 프로토콜 유지 |
| `orchestration/spike/` | 3 | ✅ 유지 | 프로토콜 유지 |
| `orchestration/ultrapilot/` | 5 | 🔄 단순화 | 상태 관리 제거 |
| `complexity/` | 3 | 🔄 변경 | 계산→힌트로 전환 |
| `tasks/` | 6 | ❌ 제거 | Claude Code에 위임 |
| `notepad/` | 5 | ✅ 유지 | 핵심 기능 |
| `context/` | 5 | ✅ 강화 | 핵심 기능 |
| `sync/` | 5 | ✅ 유지 | PLAN.md 파싱 유지 |
| `agents/` | 4 | ✅ 유지 | 프롬프트 생성 |
| `documents/` | 10 | ✅ 유지 | 템플릿 유지 |
| `state/` | 8 | 🔄 단순화 | 세션 관리 단순화 |
| `git/` | 3 | ✅ 유지 | 커밋 프로토콜 |
| `quality/` | 15 | ✅ 유지 | LSP, AST 유지 |
| `recovery/` | 2 | ✅ 유지 | 롤백 프로토콜 |
| `hooks/` | 5 | ✅ 유지 | 훅 시스템 |
| `loops/` | 4 | ✅ 유지 | Ralph 루프 |

---

## Phase 1: 프롬프트 분리 및 강화

### 목표
기존 프롬프트 생성 로직을 `prompts/` 모듈로 분리하고, 일관성을 위한 구체적 예시 추가

### Tasks

#### Task 1.1: prompts/ 디렉토리 구조 생성
- **Wave**: 1
- **Action**: 새 디렉토리 및 기본 파일 생성
- **Files**:
  - `src/prompts/index.ts`
  - `src/prompts/types.ts`
  - `src/prompts/worker.ts`
  - `src/prompts/orchestrator.ts`
  - `src/prompts/templates/`

#### Task 1.2: 기존 워커 프롬프트 이동
- **Wave**: 1
- **Action**: `swarm/manager.ts`의 `generateWorkerPrompt` 이동
- **From**: `src/orchestration/swarm/manager.ts`
- **To**: `src/prompts/worker.ts`

#### Task 1.3: 오케스트레이터 프롬프트 이동
- **Wave**: 1
- **Action**: `swarm/manager.ts`의 `generateOrchestratorPrompt` 이동
- **From**: `src/orchestration/swarm/manager.ts`
- **To**: `src/prompts/orchestrator.ts`

#### Task 1.4: Executor Loop 프롬프트 이동
- **Wave**: 1
- **Action**: `delegation/manager.ts`의 `generateExecutorLoopPrompt` 이동
- **From**: `src/orchestration/delegation/manager.ts`
- **To**: `src/prompts/executor.ts`

#### Task 1.5: 프롬프트에 구체적 예시 추가
- **Wave**: 2
- **Depends**: 1.1, 1.2, 1.3, 1.4
- **Action**: 모든 프롬프트에 일관성을 위한 예시 추가
- **Content**:
  - 모델 선택 기준 + 예시
  - 태스크 클레이밍 프로토콜
  - 플랜 변경 처리 프로토콜
  - 판단 기록 프로토콜

#### Task 1.6: 프롬프트 테스트 작성
- **Wave**: 2
- **Depends**: 1.5
- **Action**: 프롬프트 생성 테스트
- **File**: `src/prompts/prompts.test.ts`

---

## Phase 2: Swarm/Pipeline 단순화

### 목표
상태 관리 로직 제거, 프롬프트 생성과 프리셋 정의만 유지

### Tasks

#### Task 2.1: Swarm 상태 관리 제거
- **Wave**: 1
- **Action**: 상태 관련 함수 제거
- **Remove**:
  - `initializeSwarm()` → 프롬프트만 생성
  - `claimTask()` → Claude Code TaskUpdate 사용
  - `completeTask()` → Claude Code TaskUpdate 사용
  - `getSwarmStatus()` → Claude Code TaskList 사용
- **Keep**:
  - `generateWorkerPrompt()` (Phase 1에서 이동)
  - `generateOrchestratorPrompt()` (Phase 1에서 이동)
  - 타입 정의

#### Task 2.2: Pipeline 상태 관리 제거
- **Wave**: 1
- **Action**: 상태 관련 함수 제거
- **Remove**:
  - `initializePipeline()`
  - `startPipeline()`
  - `recordStageResult()`
  - `getCurrentStage()`
  - `getPipelineStatus()`
- **Keep**:
  - `PIPELINE_PRESETS` (프리셋 정의)
  - `parsePipelineString()` (파싱)
  - `createPipelineFromPreset()` (생성)
  - 타입 정의

#### Task 2.3: Pipeline을 프롬프트 기반으로 전환
- **Wave**: 2
- **Depends**: 2.2
- **Action**: Pipeline 실행을 프롬프트로 가이드
- **Add**: `generatePipelinePrompt()` - 단계별 실행 가이드 생성

#### Task 2.4: Ultrapilot 상태 관리 제거
- **Wave**: 1
- **Action**: 소유권/상태 관리 제거
- **Remove**:
  - `ownership.ts` 전체
  - `state.ts` 전체
- **Keep**:
  - `coordinator.ts` (프롬프트 생성 부분만)
  - 타입 정의

#### Task 2.5: 테스트 업데이트
- **Wave**: 2
- **Depends**: 2.1, 2.2, 2.4
- **Action**: 상태 관련 테스트 제거, 프롬프트 테스트만 유지
- **Files**:
  - `src/orchestration/swarm/manager.test.ts`
  - `src/orchestration/pipeline/manager.test.ts`

---

## Phase 3: Complexity → Hints 전환

### 목표
룰 기반 계산을 AI 판단용 힌트 제공으로 전환

### Tasks

#### Task 3.1: hints/ 디렉토리 생성
- **Wave**: 1
- **Action**: 힌트 모듈 구조 생성
- **Files**:
  - `src/hints/index.ts`
  - `src/hints/types.ts`
  - `src/hints/complexity.ts`
  - `src/hints/routing.ts`

#### Task 3.2: Complexity를 힌트로 전환
- **Wave**: 1
- **Action**: `estimateComplexity` → `suggestComplexity`
- **Change**:
  - 반환값에 `isHint: true` 추가
  - "AI가 최종 판단" 메시지 포함
  - 강제 로직 제거

#### Task 3.3: Delegation을 힌트로 전환
- **Wave**: 1
- **Action**: `routeTask` → `suggestRoute`
- **Change**:
  - 반환값에 `isHint: true` 추가
  - "AI가 맥락 보고 결정" 메시지 포함

#### Task 3.4: 프롬프트에 힌트 사용법 추가
- **Wave**: 2
- **Depends**: 3.2, 3.3
- **Action**: 워커/오케스트레이터 프롬프트에 힌트 활용법 추가
- **Content**:
  ```
  "Ultra Planner가 힌트를 제공합니다:
   - suggestComplexity() → 참고용 복잡도
   - suggestRoute() → 참고용 라우팅

   최종 판단은 당신이 맥락을 보고 결정하세요."
  ```

#### Task 3.5: 테스트 업데이트
- **Wave**: 2
- **Depends**: 3.2, 3.3
- **Action**: 힌트 로직 테스트로 변경
- **Files**:
  - `src/hints/hints.test.ts`

---

## Phase 4: Tasks 모듈 제거

### 목표
Claude Code에 완전 위임, 중복 제거

### Tasks

#### Task 4.1: tasks/ 모듈 사용처 확인
- **Wave**: 1
- **Action**: tasks/ 함수를 사용하는 곳 파악
- **Check**: mcp-server.ts, sync/, 기타

#### Task 4.2: MCP 도구에서 tasks 관련 제거
- **Wave**: 2
- **Depends**: 4.1
- **Action**: 불필요한 MCP 도구 제거
- **Remove** (mcp-server.ts에서):
  - 중복되는 TaskCreate/Update 래퍼

#### Task 4.3: sync/ 모듈 수정
- **Wave**: 2
- **Depends**: 4.1
- **Action**: tasks/ 의존성 제거
- **Change**: TaskMapping 생성만 유지, 실제 생성은 프롬프트로 가이드

#### Task 4.4: tasks/ 디렉토리 삭제
- **Wave**: 3
- **Depends**: 4.2, 4.3
- **Action**: 전체 디렉토리 삭제
- **Remove**: `src/tasks/`

---

## Phase 5: Context 모듈 강화

### 목표
컨텍스트 수집/주입/압축 기능 강화

### Tasks

#### Task 5.1: Context Collector 강화
- **Wave**: 1
- **Action**: 프로젝트 맥락 수집 기능 추가
- **File**: `src/context/collector.ts`
- **Functions**:
  - `collectProjectContext()` - PROJECT.md, ROADMAP.md 수집
  - `collectPhaseContext()` - 특정 Phase 맥락 수집
  - `collectTaskContext()` - 특정 Task 맥락 수집

#### Task 5.2: Context Injector 강화
- **Wave**: 1
- **Action**: 에이전트별 맥락 주입 기능
- **File**: `src/context/injector.ts`
- **Functions**:
  - `injectWorkerContext()` - 워커용 맥락
  - `injectOrchestratorContext()` - 오케스트레이터용 맥락
  - `injectPlannerContext()` - 플래너용 맥락

#### Task 5.3: Context Compactor 추가
- **Wave**: 2
- **Depends**: 5.1
- **Action**: 컨텍스트 압축 기능 (fresh-start용)
- **File**: `src/context/compactor.ts`
- **Functions**:
  - `compactContext()` - 현재 상태 요약
  - `saveContextSnapshot()` - Notepad에 저장
  - `restoreContext()` - Notepad에서 복원

#### Task 5.4: fresh-start 스킬 연동
- **Wave**: 2
- **Depends**: 5.3
- **Action**: /fresh-start 스킬과 Context 모듈 연동
- **Update**: `.claude/skills/fresh-start/SKILL.md`

#### Task 5.5: 테스트 작성
- **Wave**: 2
- **Depends**: 5.1, 5.2, 5.3
- **File**: `src/context/context.test.ts`

---

## Phase 6: MCP 서버 정리

### 목표
불필요한 도구 제거, 힌트/컨텍스트 도구 추가

### Tasks

#### Task 6.1: 제거할 MCP 도구 목록 확정
- **Wave**: 1
- **Action**: 제거 대상 최종 확인
- **Remove List**:
  - `initialize_swarm`
  - `claim_swarm_task`
  - `complete_swarm_task`
  - `get_swarm_status`
  - `start_swarm`
  - `cleanup_stale_workers`
  - `initialize_pipeline`
  - `start_pipeline`
  - `record_pipeline_stage_result`
  - `get_pipeline_status`
  - `get_current_pipeline_stage`

#### Task 6.2: MCP 도구 제거 실행
- **Wave**: 2
- **Depends**: 6.1
- **Action**: mcp-server.ts에서 도구 제거
- **File**: `src/mcp-server.ts`

#### Task 6.3: 새 MCP 도구 추가
- **Wave**: 2
- **Action**: 힌트/컨텍스트 도구 추가
- **Add**:
  - `suggest_complexity` (기존 estimate_complexity 대체)
  - `suggest_route` (기존 route_task 대체)
  - `collect_project_context`
  - `compress_context`

#### Task 6.4: MCP 도구 문서 업데이트
- **Wave**: 3
- **Depends**: 6.2, 6.3
- **Action**: README에 새 도구 목록 반영

---

## Phase 7: 통합 테스트 및 문서화

### Tasks

#### Task 7.1: E2E 테스트 작성
- **Wave**: 1
- **Action**: 전체 워크플로우 테스트
- **File**: `src/integration/e2e.test.ts`
- **Scenarios**:
  - Context 수집 → Wisdom 주입 → 프롬프트 생성
  - fresh-start 워크플로우
  - 힌트 기반 판단 워크플로우

#### Task 7.2: README 업데이트
- **Wave**: 2
- **Depends**: 7.1
- **Action**: v3.0 변경사항 반영
- **Content**:
  - Context Architect 철학
  - 새 API 문서
  - Claude Code 연동 가이드

#### Task 7.3: MIGRATION.md 작성
- **Wave**: 2
- **Action**: v2 → v3 마이그레이션 가이드
- **Content**:
  - 제거된 API 목록
  - 대체 방법
  - 프롬프트 예시

#### Task 7.4: CHANGELOG 업데이트
- **Wave**: 2
- **Action**: v3.0.0 변경 내역

---

## 실행 순서 (Wave 기반)

### Wave 1 (병렬 실행 가능)
- Task 1.1, 1.2, 1.3, 1.4
- Task 2.1, 2.2, 2.4
- Task 3.1, 3.2, 3.3
- Task 4.1
- Task 5.1, 5.2
- Task 6.1
- Task 7.1

### Wave 2 (Wave 1 완료 후)
- Task 1.5, 1.6
- Task 2.3, 2.5
- Task 3.4, 3.5
- Task 4.2, 4.3
- Task 5.3, 5.4, 5.5
- Task 6.2, 6.3
- Task 7.2, 7.3, 7.4

### Wave 3 (Wave 2 완료 후)
- Task 4.4
- Task 6.4

---

## 예상 결과

| 지표 | Before | After | 변화 |
|------|--------|-------|------|
| src/ 파일 수 | ~100 | ~60 | -40% |
| MCP 도구 수 | 73 | ~30 | -59% |
| 테스트 수 | 80 | ~50 | -38% |
| 코드 줄 수 | ~15,000 | ~8,000 | -47% |

---

## 롤백 계획

각 Phase 완료 후 git tag 생성:
- `git tag v3.0-phase1-complete`
- `git tag v3.0-phase2-complete`
- ...

문제 발생 시:
```bash
git checkout v3.0-phase{N-1}-complete
```

---

*작성일: 2026-01-31*
