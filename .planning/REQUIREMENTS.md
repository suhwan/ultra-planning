# Requirements: Ultra Planner

**Defined:** 2026-01-26
**Core Value:** 계획에서 실행까지 끊김 없이 — 문서 체계가 Claude Tasks와 자동 동기화

## v1 Requirements

v1 출시를 위한 필수 요구사항. 각 요구사항은 로드맵 페이즈에 매핑됨.

### 문서 체계 (Document System)

- [ ] **DOCS-01**: PROJECT.md, ROADMAP.md, PLAN.md 자동 생성
- [ ] **DOCS-02**: STATE.md로 진행 상태 추적
- [ ] **DOCS-03**: XML + YAML 하이브리드 프롬프트 포맷

### 에이전트 (Agent System)

- [ ] **AGENT-01**: Fresh subagent 패턴 (각 태스크에 새 200k 컨텍스트)
- [ ] **AGENT-02**: 4개 핵심 에이전트 (planner, executor, architect, critic)
- [ ] **AGENT-03**: Ralplan 반복 검증 (Planner→Architect→Critic 루프)
- [ ] **AGENT-04**: 검증 통과까지 자동 반복

### 실행 & Tasks (Execution & Tasks Sync)

- [ ] **EXEC-01**: PLAN → Claude Tasks 자동 등록
- [ ] **EXEC-02**: 의존성 분석 후 병렬 태스크 분리
- [ ] **EXEC-03**: 최대 5 워커 병렬 실행
- [ ] **EXEC-04**: 파일 소유권 추적 (충돌 방지)

### 자연어 (Natural Language Interface)

- [ ] **NL-01**: /ultraplan:* 슬래시 커맨드
- [ ] **NL-02**: 불명확한 요청 시 질문으로 확인
- [ ] **NL-03**: 'autopilot', 'plan', 'execute' 키워드 자동 감지
- [ ] **NL-04**: 하이브리드 모드 (기본 수동 + autopilot 자동)

## v2 Requirements

v2로 연기된 기능. 현재 로드맵에 포함되지 않음.

### 고급 도구 (Advanced Tools)

- **TOOL-01**: LSP 도구 통합
- **TOOL-02**: AST-grep 지원
- **TOOL-03**: Context Window Monitor

### 확장 기능 (Extensions)

- **EXT-01**: HUD 상태바
- **EXT-02**: Learned Skills 시스템
- **EXT-03**: Memory System
- **EXT-04**: 32개 에이전트 전체 (v1은 4개만)

## Out of Scope

명시적으로 제외된 기능. 스코프 확장 방지를 위해 문서화.

| Feature | Reason |
|---------|--------|
| Atomic commit | 사용자 선택에서 제외 |
| GUI/웹 인터페이스 | CLI 전용 도구 |
| 클라우드 동기화 | 로컬 파일 시스템 기반 |
| IDE 플러그인 | Claude Code CLI 전용 |
| 다중 프로젝트 관리 | 단일 프로젝트 집중 |

## Traceability

로드맵 생성 시 업데이트됨.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DOCS-01 | TBD | Pending |
| DOCS-02 | TBD | Pending |
| DOCS-03 | TBD | Pending |
| AGENT-01 | TBD | Pending |
| AGENT-02 | TBD | Pending |
| AGENT-03 | TBD | Pending |
| AGENT-04 | TBD | Pending |
| EXEC-01 | TBD | Pending |
| EXEC-02 | TBD | Pending |
| EXEC-03 | TBD | Pending |
| EXEC-04 | TBD | Pending |
| NL-01 | TBD | Pending |
| NL-02 | TBD | Pending |
| NL-03 | TBD | Pending |
| NL-04 | TBD | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 0
- Unmapped: 15 ⚠️

---
*Requirements defined: 2026-01-26*
*Last updated: 2026-01-26 after initial definition*
