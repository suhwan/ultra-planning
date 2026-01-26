# Ultra Planner

## What This Is

GSD, Oh My Claude Code, Oh My OpenCode 세 도구의 핵심 강점을 추출하여 하나로 통합한 워크플로우 시스템. Claude Code 사용자가 `/ultraplan:new-project`로 프로젝트를 시작하고, 자연어로도 작업을 지시할 수 있으며, 계획이 Claude Tasks에 자동 등록되어 병렬 실행되는 올인원 개발 워크플로우 도구.

## Core Value

**계획에서 실행까지 끊김 없이** — 문서 체계(PROJECT→ROADMAP→PLAN)가 자동으로 Claude Tasks와 동기화되어, 계획 즉시 병렬 실행 가능한 상태가 되어야 한다.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**문서 체계 (GSD 기반)**
- [ ] PROJECT.md, ROADMAP.md, PLAN.md 자동 생성
- [ ] Atomic commit으로 각 문서 즉시 저장
- [ ] XML 프롬프트 포맷 활용

**Tasks 동기화**
- [ ] PLAN → Claude Tasks 자동 등록
- [ ] 의존성 분석 후 병렬 태스크 분리
- [ ] Task 완료 시 문서 상태 업데이트

**병렬 실행**
- [ ] 최대 5개 워커 병렬 실행 (Ultrapilot 스타일)
- [ ] 의존성 없는 태스크 동시 처리
- [ ] Fresh subagent 패턴 적용

**자연어 감지**
- [ ] 'autopilot', 'plan', 'execute' 키워드 인식
- [ ] 불명확한 요청 시 질문으로 핵심 파악
- [ ] `/ultraplan:*` 슬래시 커맨드 지원

**자기 반복 검증**
- [ ] 1차 플랜 후 놓친 부분 자동 체크 (ralplan 스타일)
- [ ] Architect/Critic 검증 루프
- [ ] 검증 통과까지 반복

**실행 모드**
- [ ] 기본: 수동 트리거 (`/ultraplan:execute`)
- [ ] 'autopilot' 키워드 시 자동 실행

### Out of Scope

- LSP 도구 통합 — v2로 연기 (복잡도 높음)
- AST-grep — v2로 연기
- HUD 상태바 — v2로 연기 (핵심 기능 우선)
- Learned Skills 시스템 — v2로 연기
- Memory System — v2로 연기
- Context Window Monitor — v2로 연기
- 32개 에이전트 전체 — v1은 핵심 에이전트만 (planner, executor, architect, critic)

## Context

**통합 대상 도구:**

| 도구 | 핵심 추출 기능 |
|------|---------------|
| GSD | Fresh subagent, PROJECT→ROADMAP→PLAN 문서, 4개 병렬 리서처, XML 프롬프트, Atomic commit, 최대 3 태스크, 검증 루프 |
| OMC | Ultrapilot 5워커 병렬, 자연어 키워드 감지, Ralph 루프, 핵심 에이전트 프롬프트 |
| OpenCode | Todo Continuation, Comment Checker 개념 참고 |

**기술 환경:**
- Claude Code CLI 환경
- CLAUDE.md 기반 스킬 시스템
- `.ultraplan/` 디렉토리 구조

## Constraints

- **스킬 형태**: CLAUDE.md에 통합 가능한 형태로 구현
- **디렉토리**: `.ultraplan/` 사용 (`.planning/`과 구분)
- **병렬 제한**: 최대 5개 워커 (Claude Code 제한 고려)
- **에이전트**: v1은 4개 핵심 에이전트만 (planner, executor, architect, critic)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 하이브리드 실행 모드 | 기본 수동 + autopilot 자동으로 유연성 확보 | — Pending |
| v1 핵심 기능 집중 | LSP, HUD 등은 v2로 연기하여 빠른 출시 | — Pending |
| ralplan 스타일 검증 | 1차 플랜 후 자동 반복으로 품질 확보 | — Pending |
| Claude Tasks 동기화 | 계획→실행 연결의 핵심 | — Pending |

---
*Last updated: 2026-01-26 after initialization*
