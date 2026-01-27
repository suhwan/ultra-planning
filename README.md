# Ultra Planner v2

GSD + OMC + OpenCode 패턴을 통합한 Claude Code용 계획-실행 오케스트레이션 시스템.

## 특징

- **문서 기반 워크플로우**: PROJECT.md → ROADMAP.md → PLAN.md 자동 생성
- **인터뷰 기반 계획**: Planner 에이전트가 질문하고 계획 수립
- **병렬 실행**: Wave 기반 태스크 병렬 처리 (Ultrapilot 패턴)
- **Claude Tasks 동기화**: PLAN.md ↔ Claude Tasks API 양방향 연동
- **에러 복구**: 자동 롤백 + 재시도 (Ralph Loop 패턴)
- **Atomic Commit**: 태스크별 자동 커밋

## 설치

### 개인용 전역 설치 (권장)

```bash
# 1. 디렉토리 생성
mkdir -p ~/.claude/commands ~/.claude/agents ~/.claude/skills

# 2. 심볼릭 링크 생성
ln -sf /path/to/ultra-planning/.claude/commands/* ~/.claude/commands/
ln -sf /path/to/ultra-planning/.claude/agents/* ~/.claude/agents/
ln -sf /path/to/ultra-planning/.claude/skills/ultraplan ~/.claude/skills/

# 3. 확인
ls ~/.claude/commands/ultraplan*
```

### 프로젝트별 설치

```bash
# 특정 프로젝트에만 설치
cp -r /path/to/ultra-planning/.claude /your/project/
```

## 사용법

### 기본 워크플로우

```bash
# 1. 새 프로젝트 시작 (인터뷰 진행)
/ultraplan:new-project

# 2. Phase 계획 생성
/ultraplan:plan-phase 1

# 3. Plan 실행
/ultraplan:execute 01-01
```

### 슬래시 커맨드

| 명령어 | 설명 |
|--------|------|
| `/ultraplan:new-project` | 새 프로젝트 초기화 (PROJECT.md, ROADMAP.md 생성) |
| `/ultraplan:plan-phase {N}` | Phase N의 PLAN.md 파일들 생성 |
| `/ultraplan:execute {plan}` | Plan 실행 (예: `01-01`, `02`) |

### 단축 입력

```bash
/ultraplan:execute 01-01    # 특정 Plan 실행
/ultraplan:execute 01       # Phase 1 전체 실행
/ultraplan:execute 3        # Phase 3 전체 실행
```

## 디렉토리 구조

### 설치 파일 (공유됨)

```
.claude/
├── commands/               # 슬래시 커맨드 정의
│   ├── ultraplan-new-project.md
│   ├── ultraplan-plan-phase.md
│   └── ultraplan-execute.md
├── agents/                 # 에이전트 정의
│   ├── ultraplan-planner.md
│   ├── ultraplan-executor.md
│   └── ultraplan-architect.md
└── skills/ultraplan/       # 스킬 및 참조 문서
    ├── SKILL.md
    ├── templates/
    └── references/
```

### 프로젝트 계획 파일 (프로젝트별 독립)

```
your-project/
└── .planning/
    ├── PROJECT.md          # 프로젝트 정의
    ├── ROADMAP.md          # Phase 목록 + 진행 상황
    ├── STATE.md            # 현재 상태
    └── phases/
        ├── 01-foundation/
        │   ├── 01-RESEARCH.md
        │   ├── 01-01-PLAN.md
        │   ├── 01-01-SUMMARY.md
        │   └── ...
        └── 02-feature/
            └── ...
```

## 핵심 모듈

| 모듈 | 위치 | 기능 |
|------|------|------|
| State Manager | `src/state/` | 파일 기반 상태 관리, 이벤트, 체크포인트 |
| Documents | `src/documents/` | PROJECT/ROADMAP/PLAN.md 템플릿 + 생성기 |
| Agents | `src/agents/` | Planner, Architect, Critic 프롬프트 |
| Orchestration | `src/orchestration/` | 키워드 감지, Ralplan, Ultrapilot |
| Sync | `src/sync/` | PLAN.md ↔ Claude Tasks 동기화 |
| Recovery | `src/recovery/` | 에러 복구 + Git 롤백 |
| Git | `src/git/` | Atomic commit |
| Ralph Loop | `src/loops/ralph/` | 완료 감지 + 상태 관리 |

## API 예시

### 상태 관리

```typescript
import { readState, writeState, createCheckpoint } from 'ultra-planner';

// 상태 읽기/쓰기
const state = await readState('my-state');
await writeState('my-state', { phase: 1, status: 'in_progress' });

// 체크포인트
await createCheckpoint('before-risky-operation');
await rollbackToCheckpoint('before-risky-operation');
```

### 문서 생성

```typescript
import { generateProjectMd, generateRoadmapMd, generatePlanMd } from 'ultra-planner';

// PROJECT.md 생성
const projectMd = generateProjectMd({
  name: 'My Project',
  description: 'A cool project',
  requirements: [{ id: 'REQ-01', description: 'Feature A' }]
});

// PLAN.md 파싱
const plan = await parsePlanMd('.planning/phases/01-foundation/01-01-PLAN.md');
```

### 태스크 동기화

```typescript
import { parsePlanForSync, extractTaskMappings, markTaskComplete } from 'ultra-planner';

// PLAN.md에서 태스크 추출
const planData = await parsePlanForSync('.planning/phases/01/01-01-PLAN.md');
const tasks = extractTaskMappings(planData);

// 태스크 완료 표시
await markTaskComplete('.planning/phases/01/01-01-PLAN.md', '01-01-01');
```

## 빌드 및 테스트

```bash
# 의존성 설치
npm install

# 빌드
npm run build

# 테스트
npm test
```

## 아키텍처 원칙

1. **문서가 곧 프롬프트**: PLAN.md는 실행자에게 직접 전달되는 지시문
2. **Goal-Backward**: 목표에서 역산하여 Phase/Task 도출
3. **Wave 기반 병렬화**: 의존성 없는 태스크는 병렬 실행
4. **Atomic Commit**: 태스크 완료마다 자동 커밋
5. **파일 기반 상태**: 에이전트 간 상태 공유는 파일로

## 참조 프로젝트

- [oh-my-claudecode](https://github.com/anthropics/oh-my-claudecode) - OMC 패턴
- [get-shit-done](https://github.com/anthropics/get-shit-done) - GSD 문서 체계
- [oh-my-opencode](https://github.com/anthropics/oh-my-opencode) - Ralph Loop, Atlas 패턴

## 라이선스

MIT

---

*Ultra Planner v2 - 2026-01-27*
