# Phase 17: 병렬 실행 모드 완성

## 현재 상태 분석

### 문제 요약

| 모드 | 문제 | 필요한 작업 |
|------|------|------------|
| **Ultrapilot** | 코드 있음, MCP 노출 없음 | MCP 도구 추가 |
| **Swarm** | 프롬프트만, 상태 관리 없음 | 상태 관리 + MCP 도구 |
| **Pipeline** | 프롬프트만, 실행 로직 없음 | 실행 관리 + MCP 도구 |
| **UltraWork** | 스킬만, 코드 없음 | 오케스트레이션 코드 |
| **EcoMode** | 스킬만, 코드 없음 | 모델 라우팅 코드 |

---

## 요구사항

### REQ-17-01: Ultrapilot MCP 노출

**현재**: `src/orchestration/ultrapilot/` 완전 구현됨
**문제**: MCP 서버에 노출되지 않아 Claude가 호출 불가

**필요한 MCP 도구:**
```
init_ultrapilot           - 세션 초기화
get_ultrapilot_state      - 상태 조회
spawn_ultrapilot_worker   - 워커 생성 + 파일 소유권
complete_ultrapilot_worker - 워커 완료
fail_ultrapilot_worker    - 워커 실패
assign_ultrapilot_file    - 파일 소유권 할당
release_ultrapilot_file   - 파일 소유권 해제
check_file_conflicts      - 충돌 검사
end_ultrapilot            - 세션 종료
```

### REQ-17-02: Swarm 상태 관리 복원

**현재**: 프롬프트 생성만 (`generateWorkerPrompt`, `generateOrchestratorPrompt`)
**문제**: v3.0에서 상태 관리 제거됨, Claude Task API 의존

**필요한 기능:**
```
- 태스크 풀 관리 (pending/claimed/done)
- 원자적 태스크 claim
- 타임아웃 자동 release (5분)
- 워커 상태 추적

MCP 도구:
- init_swarm_session
- add_swarm_tasks
- claim_swarm_task (원자적)
- complete_swarm_task
- release_swarm_task
- get_swarm_state
- end_swarm_session
```

### REQ-17-03: Pipeline 실행 관리

**현재**: 프레셋 정의 + 프롬프트 생성
**문제**: 실제 스테이지 실행 및 데이터 전달 로직 없음

**필요한 기능:**
```
- 스테이지 실행 상태 추적
- 스테이지 간 데이터 전달
- 스테이지 실패 시 처리

MCP 도구:
- init_pipeline_session
- start_pipeline_stage
- complete_pipeline_stage (with output data)
- get_pipeline_state
- get_stage_input (이전 스테이지 출력)
- end_pipeline_session
```

### REQ-17-04: UltraWork 오케스트레이션

**현재**: 스킬 정의만 (행동 지침)
**문제**: 실제 병렬 실행 코드 없음

**필요한 기능:**
```
- Wave 내 태스크 병렬 실행 관리
- 최대 5개 동시 워커
- 워커별 진행 상태 추적
- 완료/실패 집계

MCP 도구:
- init_ultrawork_session
- get_parallel_tasks (Wave에서 병렬 가능한 태스크)
- spawn_ultrawork_worker
- complete_ultrawork_worker
- get_ultrawork_progress
- end_ultrawork_session
```

### REQ-17-05: EcoMode 모델 라우팅

**현재**: 스킬 정의만 (행동 지침)
**문제**: 실제 복잡도 기반 라우팅 코드 없음

**필요한 기능:**
```
- 태스크 복잡도 자동 분석
- 복잡도별 모델 매핑 (1-2: haiku, 3: sonnet, 4-5: opus)
- 동시 실행 제한 (haiku 5, sonnet 3, opus 2)
- 토큰 사용량 추적

MCP 도구:
- analyze_task_complexity (기존 estimate_task_complexity 확장)
- get_eco_model_recommendation
- init_ecomode_session
- track_eco_usage
- get_eco_stats
```

---

## 우선순위

| 순위 | 모드 | 이유 |
|------|------|------|
| 1 | **Ultrapilot** | 코드 완성됨, MCP만 추가하면 즉시 작동 |
| 2 | **Swarm** | 기본 구조 있음, 상태 관리 추가 필요 |
| 3 | **Pipeline** | 기본 구조 있음, 실행 관리 추가 필요 |
| 4 | **UltraWork** | Wave 기반으로 확장 가능 |
| 5 | **EcoMode** | 기존 complexity 도구 확장 |

---

## 구현 계획

### Plan 17-01: Ultrapilot MCP 노출 ✅ COMPLETE
- [x] mcp-server.ts에 import 추가
- [x] 9개 MCP 도구 정의 추가
- [x] 9개 핸들러 구현
- [x] 빌드 성공

### Plan 17-02: Swarm 상태 관리 ✅ COMPLETE
- [x] src/orchestration/swarm/state.ts 생성
- [x] 태스크 풀 관리 로직
- [x] 원자적 claim 구현
- [x] 타임아웃 로직 (5분 자동 release)
- [x] 7개 MCP 도구 추가
- [x] 빌드 성공

### Plan 17-03: Pipeline 실행 관리 ✅ COMPLETE
- [x] src/orchestration/pipeline/state.ts 생성
- [x] 스테이지 실행 로직
- [x] 데이터 전달 구조 (lastOutput → next stage)
- [x] 6개 MCP 도구 추가
- [x] 빌드 성공

### Plan 17-04: UltraWork 오케스트레이션 ✅ COMPLETE
- [x] src/orchestration/ultrawork/ 디렉토리 생성
- [x] Wave 기반 병렬 실행 로직
- [x] 워커 관리
- [x] 7개 MCP 도구 추가
- [x] 빌드 성공

### Plan 17-05: EcoMode 모델 라우팅 ✅ COMPLETE
- [x] src/orchestration/ecomode/ 디렉토리 생성
- [x] 복잡도 분석 확장 (analyzeTaskComplexity)
- [x] 모델 매핑 로직 (1-2: haiku, 3-4: sonnet, 5: opus)
- [x] 동시 실행 제한 (haiku:5, sonnet:3, opus:2)
- [x] 5개 MCP 도구 추가
- [x] 빌드 성공

---

## 총 예상 작업량

- **총 MCP 도구**: 33개 추가 ✅ COMPLETE
  - Ultrapilot: 9개
  - Swarm: 7개
  - Pipeline: 6개
  - UltraWork: 7개
  - EcoMode: 5개
  - **실제 추가**: 34개
- **우선 구현**: Ultrapilot (즉시 작동 가능) ✅

---

## 성공 기준

1. **Ultrapilot**: `/ultrapilot "build X"` 실행 시 파일 소유권 분할되어 병렬 작업
2. **Swarm**: `/swarm 5:executor "task"` 실행 시 5개 워커가 태스크 풀에서 동적 claim
3. **Pipeline**: `/pipeline review "src/"` 실행 시 4단계 순차 실행
4. **UltraWork**: `ulw: fix errors` 시 Wave 내 태스크 병렬 실행
5. **EcoMode**: `eco: refactor` 시 복잡도별 모델 자동 선택
