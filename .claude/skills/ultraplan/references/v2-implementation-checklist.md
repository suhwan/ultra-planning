# Ultra Planning v2.0 Implementation Checklist

*Created: 2026-01-30*
*Status: ✅ COMPLETE*
*Last Verified: 2026-01-31*

---

## 현재 상태 요약

### 이미 구현됨 (검증 완료) ✅
| 기능 | 위치 | 비고 |
|------|------|------|
| Planner | `src/agents/prompts/planner.ts` | GSD 방법론, 466줄 |
| Orchestrator | `src/orchestration/ralplan/orchestrator.ts` | Ralplan 상태 머신 |
| Ralplan Loop | `src/orchestration/ralplan/` | 5회 반복, 강제 승인 |
| Agent 분리 | `src/agents/prompts/` | Planner/Architect/Critic/Executor |
| 자동 의존성 분석 | `src/sync/dependency-map.ts` | Wave→blockedBy 매핑 |
| Notepad 시스템 | `src/notepad/` | learnings/decisions/issues.md |
| Git Checkpoint | `src/state/checkpoint.ts` | 10개 보존, 상태만 롤백 |
| Rollback | `src/recovery/rollback.ts` | 쿨다운, 재시도 로직 |
| Ultrapilot | `src/orchestration/ultrapilot/` | 파일 소유권, 5워커 |

### Claude Code 순정 활용 🔧
| 기능 | 순정 도구 | 오케스트레이터 역할 |
|------|----------|---------------------|
| Swarm 패턴 | TaskCreate/TaskUpdate/TaskList + `run_in_background` | 워커 스폰 + 태스크 분배 명령 |
| 태스크 클레이밍 | TaskUpdate (owner 필드) | 경쟁 조건 처리 로직 |
| Pipeline | Task Tool 순차 호출 | 단계별 결과 전달 명령 |
| Hook | Claude Code hooks | 필요시 커스텀 훅 추가 |

### OMC에서 참조할 패턴 📚
| 패턴 | 참조 위치 | 용도 |
|------|----------|------|
| Delegation Categories | `src/features/delegation-categories/` | 복잡도→모델 매핑 로직 |
| Executor Loop 패턴 | `commands/swarm.md` | 워커 프롬프트 구조 |

### 새로 구현 필요 🆕
| 기능 | 설명 |
|------|------|
| Session 격리 | Task 호출 시 컨텍스트 분리 |
| Plan 수정 메커니즘 | Living Document 버전 관리 |
| Spike Phase | 불확실성 높은 태스크 PoC |
| Deviation 권한 | Level 1/2/3 일탈 처리 |

---

## Phase 0: 분석 완료 (Prerequisites)

### Plan 단계 분석
- [x] 12개 개선점 도출
- [x] 패러다임 충돌 분석 (Orchestrator vs Swarm)
- [x] Orchestrator 고도화 분석
- [x] Moltbot 패턴 분석
- [x] 근본적 약점 분석 ("Plan은 진리가 아니다")
- [x] 비판적 재검토 (과설계 vs 실용성)
- [x] Task Tool 병렬 실행 확인
- [x] **기능 비교표 검증** ✅ 완료

### Execute 단계 분석
- [ ] Executor 현재 구현 분석
- [ ] Router 프로토콜 분석
- [ ] Architect 검증 로직 분석
- [ ] 상태 관리 분석
- [ ] 에러 처리 분석
- [ ] Execute 개선점 목록 작성

---

## Phase 1: 아키텍처 설계 [C] ✅ 완료

### 1.1 파일 구조 설계
- [x] 전체 디렉토리 구조 확정 → `v2-architecture.md` Section 1
- [x] schemas/ 폴더 구조 → `src/schemas/`
- [x] 상태 파일 구조 확인 → `v2-architecture.md` Section 3
- [x] 설정 파일 구조 → `v2-architecture.md` Section 6

### 1.2 인터페이스 정의
- [x] task-complexity.schema.yaml
- [x] executor-result.schema.yaml
- [x] architect-verdict.schema.yaml
- [x] critic-verdict.schema.yaml
- [x] deviation-report.schema.yaml
- [x] learning-entry.schema.yaml

### 1.3 상태 흐름도
- [x] Plan → Execute 상태 전이 → `v2-architecture.md` Section 4
- [x] Ralplan Loop 상태 머신 → `v2-architecture.md` Section 4.1
- [x] Execute Loop 상태 머신 → `v2-architecture.md` Section 4.2
- [x] Swarm 패턴 흐름 → `v2-architecture.md` Section 4.3

### 1.4 문서화
- [x] 아키텍처 설계 문서 작성 → `v2-architecture.md`

---

## Phase 2: Week 1 - 핵심 품질 [A] ✅ 완료

### 2.1 Task Complexity 메타데이터 ✅ 완료
- [x] 복잡도 타입 정의 (`src/complexity/types.ts`)
- [x] 복잡도 추정 로직 (`src/complexity/estimator.ts`)
- [x] 복잡도 → 모델 매핑 (1-2→haiku, 3-4→sonnet, 5→opus)
- [x] MCP tools: estimate_task_complexity, get_model_for_complexity, batch_estimate_complexity

### 2.2 Agent Interface Contract ✅ 완료
- [x] schemas/ 폴더 생성 (Phase 1에서 완료)
- [x] 각 스키마 파일 작성 (Phase 1에서 완료)
- [x] Verdict 타입 정의 (`src/orchestration/verdicts/types.ts`)
- [x] 체크리스트 로직 (`src/orchestration/verdicts/checklist.ts`)
- [x] MCP tools: evaluate_architect_checklist, evaluate_critic_checklist

### 2.3 객관적 Ralplan 체크리스트 ✅ 완료
- [x] 체크리스트 항목 정의 (5개씩 Architect/Critic)
- [x] Architect 프롬프트 업데이트 (task_verification 섹션)
- [x] Critic 프롬프트 업데이트 (verdict_format 개선)
- [x] 80% pass = APPROVED/OKAY 로직 구현

### 2.4 Session 격리 ✅ 완료
- [x] Session ID 생성 메커니즘 (`src/state/session/types.ts`)
- [x] SessionManager 구현 (`src/state/session/manager.ts`)
- [x] Task claiming (다른 세션과 충돌 방지)
- [x] MCP tools: create_session, get_session, list_sessions, claim_task_for_session, complete_session

### 2.5 Task Tool 병렬 실행 ✅ (기존 Ultrapilot 활용)
- [x] Ultrapilot Coordinator 이미 구현됨
- [x] Session 기반 태스크 클레이밍으로 병렬 실행 지원

---

## Phase 3: Week 2 - 적응성 ✅ 완료

### 3.1 Plan 수정 메커니즘 ✅ 완료
- [x] Living Document 버전 관리 (`src/orchestration/revision/types.ts`)
- [x] plan_revision_needed 플래그 (`flagPlanForRevision`, `checkRevisionNeeded`)
- [x] completePlanRevision() API 함수
- [x] Version history 관리 (`getPlanVersionHistory`, `getCurrentPlanVersion`)
- [x] 영향받는 Task 표시 (affectedTasks 필드)
- [x] MCP tools: `flag_plan_for_revision`, `check_revision_needed`, `complete_plan_revision`, `get_plan_version_history`

### 3.2 Executor Deviation 권한 ✅ 완료
- [x] Deviation Level 1/2/3 정의 (`src/orchestration/deviation/types.ts`)
  - Level 1: 보고만 (DEVIATION.md 기록)
  - Level 2: Architect 빠른 승인 필요
  - Level 3: Plan 수정 트리거
- [x] Executor 프롬프트 생성 (`src/agents/prompts/executor.ts`)
- [x] DEVIATION.md 자동 생성 로직 (`appendToDeviationMd`)
- [x] Architect 빠른 승인 로직 (Level 2) (`submitArchitectVerdict`)
- [x] Plan 수정 트리거 (Level 3) (`flagPlanForRevision` 연동)
- [x] MCP tools: `report_deviation`, `get_deviations`, `submit_deviation_verdict`, `get_deviation_stats`, `has_unresolved_level3`

### 3.3 LEARNINGS.md 확장 ✅ 완료
- [x] 기본 시스템 이미 구현됨 (`src/notepad/`)
- [x] Learning 유형 확장: pattern, convention, gotcha, discovery, avoid, prefer
- [x] LearningEntry에 learningType, priority 필드 추가
- [x] MCP tool 업데이트: add_learning()에 learningType, priority 지원
- [x] Wisdom injection 시스템 이미 구현됨 (`createWisdomDirective`)

### 3.4 자동 의존성 분석 ✅ (이미 구현됨)
- [x] buildDependencyMap() 이미 구현 (`src/sync/dependency-map.ts`)
- [x] Wave→blockedBy 매핑 완료
- [x] 실행 순서 계산 완료
- [x] MCP tools 이미 구현: `build_dependency_map`, `get_execution_order`

---

## Phase 4: Week 3 - 안정성 ✅ 완료

### 4.1 Spike Phase ✅ 완료
- [x] uncertainty 필드 추가 (0-10) (`TaskUncertaintyMetadata`)
- [x] Spike Task 타입 정의 (`src/orchestration/spike/types.ts`)
- [x] Spike Task 자동 생성 로직 (`autoCreateSpikeIfNeeded`, threshold >= 7)
- [x] Spike 결과 → Plan 수정 연동 (`flagPlanForRevision` 연동)
- [x] MCP tools: `create_spike`, `assess_uncertainty`, `complete_spike`, `get_pending_spikes`, `get_spike_stats`

### 4.2 Git Checkpoint ✅ 완료
- [x] 기본 checkpoint 시스템 구현됨 (`src/state/checkpoint.ts`)
- [x] Phase 완료 시 자동 태그 추가 (`tagPhaseComplete`)
- [x] git tag phase-N-complete 형식
- [x] `completePhase()` - checkpoint + tag 통합
- [x] MCP tools: `complete_phase`, `list_phase_tags`

### 4.3 롤백 명령어 ✅ 완료
- [x] 기본 rollback 구현됨 (`src/recovery/rollback.ts`)
- [x] 선택적 롤백 옵션 (`selectiveRollback`)
- [x] 상태/소스 분리 롤백 지원
- [x] 롤백 미리보기 (`previewRollback`)
- [x] Phase별 롤백 (`rollbackToPhase`)
- [x] MCP tools: `preview_rollback`, `selective_rollback`, `rollback_to_phase`, `get_rollback_targets`

### 4.4 상태 복원 프로토콜 ✅ 완료
- [x] 기본 상태 관리 구현됨 (`src/state/state-manager.ts`)
- [x] Checkpoint/Tag 기반 복원 포인트
- [x] `getAvailableRollbackTargets()` - 복원 가능 지점 조회
- [x] Session 기반 상태 격리 (Phase 2에서 구현)

---

## Phase 5: 오케스트레이터 고도화 (순정 활용) ✅ 완료

### 5.1 Swarm 패턴 (순정 Task API) 🔧 ✅ 완료
- [x] Orchestrator가 TaskCreate로 태스크 등록 (`src/orchestration/swarm/types.ts`)
- [x] Wave→blockedBy 매핑 (이미 구현됨, 통합 완료)
- [x] 워커 스폰: Task Tool + `run_in_background: true` (프롬프트에 포함)
- [x] 워커 프롬프트: TaskList → TaskUpdate(owner) → 실행 → TaskUpdate(completed) (`generateWorkerPrompt`)
- [x] 경쟁 조건 처리: owner 설정 실패 시 재시도 (`claimTask`, `claimAnyTask`)
- [x] 5워커 병렬 실행 지원 (`DEFAULT_SWARM_CONFIG.maxWorkers: 5`)
- [x] MCP tools: initialize_swarm, claim_swarm_task, complete_swarm_task, get_swarm_status 등

### 5.2 Pipeline 패턴 (순정 Task Tool) 🔧 ✅ 완료
- [x] Orchestrator가 순차 Task 호출 (`src/orchestration/pipeline/manager.ts`)
- [x] 단계별 결과 전달 (이전 결과 → 다음 프롬프트) (`buildStagePrompt`, `recordStageResult`)
- [x] 내장 프리셋 정의: review, implement, debug, research, refactor, security (`PIPELINE_PRESETS`)
- [x] MCP tools: create_pipeline_preset, initialize_pipeline, get_current_pipeline_stage 등

### 5.3 Executor Loop 프롬프트 📚 ✅ 완료
- [x] OMC Swarm 워커 프롬프트 참조
- [x] Executor가 자율적으로 태스크 가져가는 루프 작성 (`generateExecutorLoopPrompt`)
- [x] Heartbeat/상태 보고 패턴 (`generateHeartbeatProtocol`)
- [x] MCP tool: generate_executor_loop_prompt

### 5.4 Delegation Categories (복잡도 매핑) 📚 ✅ 완료
- [x] 7개 카테고리 구현: quick, standard, complex, ultrabrain, visual-engineering, artistry, writing (`src/orchestration/delegation/types.ts`)
- [x] 태스크 복잡도 → 모델 선택 로직 (`DELEGATION_CATEGORIES`, `COMPLEXITY_TO_CATEGORY`)
- [x] Orchestrator에 라우팅 로직 추가 (`routeTask`, `routeByComplexity`)
- [x] MCP tools: detect_task_category, route_task, route_by_complexity, list_delegation_categories

---

## Phase 6: Week 4 - 검증 ✅ 완료

### 6.1 테스트 작성 ✅ 완료
- [x] Complexity Estimator 테스트 (`src/complexity/estimator.test.ts`)
- [x] Swarm Manager 테스트 (`src/orchestration/swarm/manager.test.ts`)
- [x] Pipeline Manager 테스트 (`src/orchestration/pipeline/manager.test.ts`)
- [x] Delegation Manager 테스트 (`src/orchestration/delegation/manager.test.ts`)
- [x] 기존 통합 테스트 유지 (`tests/integration/`)
- [x] 총 80개 테스트 통과

### 6.2 빌드 검증 ✅ 완료
- [x] TypeScript 빌드 성공
- [x] 모든 타입 오류 해결
- [x] MCP 서버 정상 동작

### 6.3 문서화 완료 ✅ 완료
- [x] README.md v2.0 기능 문서화
  - 복잡도 추정 및 모델 라우팅
  - 세션 격리
  - Deviation 처리
  - Spike Phase
  - Swarm 패턴
  - Pipeline 패턴
  - Delegation 카테고리
  - 고급 롤백
- [x] API 예시 추가
- [x] 카테고리/모델 매핑 테이블

---

## 진행 상황 추적

| Phase | 시작일 | 완료일 | 상태 | 비고 |
|-------|--------|--------|------|------|
| Phase 0 | 2026-01-30 | 2026-01-30 | ✅ 완료 | 기능 검증 완료 |
| Phase 1 | 2026-01-31 | 2026-01-31 | ✅ 완료 | 아키텍처 설계 |
| Phase 2 | 2026-01-31 | 2026-01-31 | ✅ 완료 | 핵심 품질 |
| Phase 3 | 2026-01-31 | 2026-01-31 | ✅ 완료 | 적응성 |
| Phase 4 | 2026-01-31 | 2026-01-31 | ✅ 완료 | 안정성 |
| Phase 5 | 2026-01-31 | 2026-01-31 | ✅ 완료 | 순정 활용 + 오케스트레이터 고도화 |
| Phase 6 | 2026-01-31 | 2026-01-31 | ✅ 완료 | 테스트 + 문서화 |

---

## 범례

| 표시 | 의미 |
|------|------|
| ✅ | 이미 구현됨 |
| 🆕 | 새로 구현 필요 |
| 🔧 | 순정 도구 활용 |
| 📚 | OMC 패턴 참조 |
| [x] | 완료 |
| [ ] | 미완료 |

---

*Last updated: 2026-01-31 (v2.0 전체 완료)*
