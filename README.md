# Ultra Planner v3.1

> **"실행하지 않는다. 맥락을 설계한다."**
> (Don't execute, design context.)

Ultra Planner는 Claude Code를 위한 **Context Architect**입니다. **GSD의 계획력 + OMC의 전문성 + Ultra Planner의 오케스트레이션**을 결합한 하이브리드 아키텍처입니다.

## What's New in v3.1

### Hybrid Integration

```
┌─────────────────────────────────────────────────────────────────┐
│  Ultra Planner v3.1 Hybrid Architecture                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐                                           │
│  │  Orchestration   │  Ultra Planner                            │
│  │  + MCP Tools     │  (70+ context tools)                      │
│  └────────┬─────────┘                                           │
│           │                                                      │
│  ┌────────▼─────────┐  ┌──────────────────┐                     │
│  │     Research     │  │     Planning     │                     │
│  │  GSD Researcher  │  │   GSD Planner    │                     │
│  │  (Context7,      │  │  (논리적 Task    │                     │
│  │   검증 프로토콜) │  │   분리)          │                     │
│  └────────┬─────────┘  └────────┬─────────┘                     │
│           │                     │                                │
│  ┌────────▼─────────────────────▼─────────┐                     │
│  │          Ralplan Verification           │                     │
│  │  ultraplan-architect + ultraplan-critic │                     │
│  └────────────────────┬───────────────────┘                     │
│                       │                                          │
│  ┌────────────────────▼───────────────────┐                     │
│  │             Execution                   │                     │
│  │  ultraplan-executor                     │                     │
│  │  + build-fixer (에러 자동 수정)         │  ← OMC              │
│  │  + security-reviewer (보안 스캔)        │  ← OMC              │
│  │  + code-reviewer (품질 체크)            │  ← OMC              │
│  └─────────────────────────────────────────┘                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### New Features

| Feature | Description |
|---------|-------------|
| **GSD Research** | Context7 지원, 5개 파일 출력, 검증 프로토콜 |
| **GSD Planning** | 논리적 컨텍스트 기반 Task 분리 |
| **OMC Agents** | build-fixer, security-reviewer, code-reviewer, tdd-guide, vision |
| **Model Profiles** | quality / balanced / budget 모드 |
| **Auto Build-Fix** | executor 에러 시 자동 수정 |
| **Auto Security** | 완료 후 자동 보안 스캔 |
| **discuss-phase** | 계획 전 맥락 수집 명령어 |
| **debug** | 체계적 디버깅 명령어 |

## Features

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **Context Architect** | 맥락 수집, 주입, 압축 - Claude Code가 실행 |
| **GSD Research** | Context7, 신뢰도 계층 (HIGH/MEDIUM/LOW), 5개 구조화 파일 |
| **GSD Planning** | 논리적 컨텍스트 기반 Task 분리, Goal-backward 방법론 |
| **Ralplan Verification** | Architect + Critic 합의까지 검증 |
| **OMC Quality Gates** | build-fixer, security-reviewer, code-reviewer 자동 호출 |
| **Model Profiles** | quality/balanced/budget - 비용 최적화 |
| **병렬 실행** | Wave 기반 태스크 병렬 처리 (Swarm 패턴) |
| **Hints (AI Decides)** | 규칙이 아닌 힌트 - AI가 최종 결정 |
| **Wisdom 축적** | 학습, 결정, 이슈 기록 - 세션 간 지속 |

### Integrated Components

| Source | Components | Purpose |
|--------|------------|---------|
| **GSD** | gsd-project-researcher | 프로젝트 리서치 (Context7) |
| | gsd-phase-researcher | Phase 리서치 (검증 프로토콜) |
| | gsd-planner | 논리적 Task 분리 |
| **OMC** | build-fixer / low | 빌드 에러 자동 수정 |
| | security-reviewer / low | OWASP Top 10 보안 스캔 |
| | code-reviewer / low | 코드 품질 체크 |
| | tdd-guide / low | TDD 강제 |
| | vision | 이미지/다이어그램 분석 |
| **Ultra Planner** | 오케스트레이션 | /ultraplan:* 명령어 |
| | MCP Tools (70+) | 컨텍스트 수집/주입/힌트 |
| | ultraplan-architect | Ralplan 검증 |
| | ultraplan-critic | Ralplan 비판 |
| | ultraplan-executor | Task 실행 |

## Installation

### 1. 의존성 설치

```bash
cd ultra-planning
npm install
npm run build
```

### 2. MCP 서버 설정

`~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "ultra-planner": {
      "command": "node",
      "args": ["/path/to/ultra-planning/dist/mcp-server.js"]
    }
  }
}
```

### 3. 스킬/커맨드 설치 (선택)

```bash
# 전역 설치
mkdir -p ~/.claude/commands ~/.claude/skills
ln -sf /path/to/ultra-planning/.claude/commands/* ~/.claude/commands/
ln -sf /path/to/ultra-planning/.claude/skills/* ~/.claude/skills/

# 또는 프로젝트별 설치
cp -r /path/to/ultra-planning/.claude /your/project/
```

### 4. GSD/OMC 업데이트

```bash
# 레퍼런스 최신화
./scripts/update-references.sh
```

## Model Profiles

`.ultraplan/config.json`:

```json
{
  "modelProfile": "balanced",
  "profiles": {
    "quality": {
      "description": "Maximum quality, higher cost",
      "routing": {
        "research": "opus",
        "planning": "opus",
        "execution": "opus"
      }
    },
    "balanced": {
      "description": "Balance between quality and cost (default)",
      "routing": {
        "research": "opus",
        "planning": "opus",
        "execution": "sonnet"
      }
    },
    "budget": {
      "description": "Minimize cost, use haiku where possible",
      "routing": {
        "research": "sonnet",
        "planning": "sonnet",
        "execution": "haiku"
      }
    }
  }
}
```

## Workflows

### /ultraplan:new-project

새 프로젝트 초기화 - GSD Research → GSD Plan → Ralplan 검증:

```
/ultraplan:new-project [description] [--skip-research]
```

```
┌─────────────────────────────────────────────────────────────┐
│  1. RESEARCH — GSD Project Researcher                        │
│     • Context7로 최신 라이브러리 문서 조회                    │
│     • 신뢰도 계층: HIGH/MEDIUM/LOW                           │
│     • 5개 파일 출력: SUMMARY, STACK, FEATURES, ARCH, PITFALLS│
│                                                              │
│  2. PLAN — GSD Planner                                       │
│     • 논리적 컨텍스트 기반 Task 분리                          │
│     • Goal-backward 방법론                                   │
│     • PROJECT.md, ROADMAP.md 생성                            │
│                                                              │
│  3. RALPLAN — Ultra Planner 검증                             │
│     • ultraplan-architect 검토                               │
│     • ultraplan-critic 검토                                  │
│     • 80% 이상 통과시 승인                                   │
└─────────────────────────────────────────────────────────────┘
```

### /ultraplan:discuss-phase (NEW)

계획 전 맥락 수집:

```
/ultraplan:discuss-phase [phase-number]
```

```
┌─────────────────────────────────────────────────────────────┐
│  1. EXPLORE — Phase 목표와 코드베이스 분석                   │
│  2. IDENTIFY — Claude가 결정해야 할 사항 파악               │
│  3. INTERVIEW — 적응형 질문으로 맥락 수집                   │
│  4. DOCUMENT — CONTEXT.md 생성                              │
└─────────────────────────────────────────────────────────────┘
```

### /ultraplan:plan-phase

특정 Phase 계획 생성:

```
/ultraplan:plan-phase [phase-number] [--skip-research]
```

```
┌─────────────────────────────────────────────────────────────┐
│  1. (Optional) discuss-phase — 맥락 수집                    │
│  2. GSD Phase Research — Context7 기반 구현 방법 조사       │
│  3. GSD Plan — 논리적 Task 분리 + PLAN.md 생성              │
│  4. Ralplan Verification — Architect + Critic 검증          │
└─────────────────────────────────────────────────────────────┘
```

### /ultraplan:execute

Phase 실행 + 자동 품질 게이트:

```
/ultraplan:execute [plan-path] [--tdd]
```

```
┌─────────────────────────────────────────────────────────────┐
│  Wave-based Execution + Quality Gates                        │
│                                                              │
│  Wave 1: [Task A] [Task B] [Task C]  ← 병렬 실행             │
│              ↓                                               │
│        [에러 발생?] → build-fixer 자동 호출                  │
│              ↓                                               │
│  Wave 2: [Task D] [Task E]           ← Wave 1 완료 후        │
│              ↓                                               │
│  완료 후:                                                    │
│    • security-reviewer 자동 호출                             │
│    • (옵션) code-reviewer 호출                               │
│    • ultraplan-architect 최종 검증                           │
└─────────────────────────────────────────────────────────────┘
```

### /ultraplan:debug (NEW)

체계적 디버깅:

```
/ultraplan:debug [problem] [--resume]
```

```
┌─────────────────────────────────────────────────────────────┐
│  1. REPRODUCE — 문제 재현 및 증상 기록                       │
│  2. HYPOTHESIZE — 가능한 원인 가설 수립                     │
│  3. TEST — 가설 검증 (하나씩)                               │
│  4. FIX — 원인 확인 후 수정 (build-fixer 연계)              │
│  5. VERIFY — 수정 검증 및 회귀 테스트                       │
└─────────────────────────────────────────────────────────────┘
```

### /thorough

GSD 플랜 생성 + Architect 검토 + 병렬 실행 자동화:

```
/thorough all              # 모든 Phase 실행
/thorough from 3           # Phase 3부터 실행
```

## Architecture

```
ultra-planning/
├── src/
│   ├── context/              # Context Architect (v3.0 Core)
│   ├── hints/                # AI 힌트 (규칙 아님)
│   ├── prompts/              # 프롬프트 생성
│   ├── notepad/              # Wisdom 축적
│   ├── orchestration/        # 오케스트레이션
│   ├── sync/                 # Claude Code 동기화
│   └── mcp-server.ts         # MCP 서버 (70+ 도구)
│
├── .claude/
│   ├── agents/               # 에이전트 정의
│   │   ├── ultraplan-*.md    # Ultra Planner 에이전트
│   │   ├── build-fixer*.md   # OMC 심볼릭 링크
│   │   ├── security-*.md     # OMC 심볼릭 링크
│   │   ├── code-reviewer*.md # OMC 심볼릭 링크
│   │   ├── tdd-guide*.md     # OMC 심볼릭 링크
│   │   └── vision.md         # OMC 심볼릭 링크
│   │
│   ├── commands/             # 슬래시 커맨드
│   │   ├── ultraplan-new-project.md
│   │   ├── ultraplan-plan-phase.md
│   │   ├── ultraplan-execute.md
│   │   ├── ultraplan-discuss-phase.md  # NEW
│   │   ├── ultraplan-debug.md          # NEW
│   │   └── fresh-start.md
│   │
│   └── skills/
│
├── .ultraplan/
│   └── config.json           # Model Profiles
│
├── references/               # 외부 시스템 (git repos)
│   ├── get-shit-done/        # GSD 에이전트
│   └── oh-my-claudecode/     # OMC 에이전트
│
├── scripts/
│   └── update-references.sh  # GSD/OMC 업데이트
│
└── docs/
    └── HYBRID-INTEGRATION.md # 통합 가이드
```

## MCP Tools (70+)

### Context Tools
| Tool | Description |
|------|-------------|
| `collect_project_context` | PROJECT.md, ROADMAP.md, REQUIREMENTS.md 수집 |
| `collect_phase_context` | 페이즈 리서치 및 계획 수집 |
| `compress_context` | Fresh-start용 압축 (99% 압축률) |
| `restore_context` | 스냅샷에서 복원 |

### Hint Tools
| Tool | Description |
|------|-------------|
| `suggest_complexity` | 복잡도 힌트 (isHint: true) |
| `suggest_route` | 라우팅 힌트 (isHint: true) |
| `get_task_hints` | 모든 힌트 통합 |

### Plan Sync Tools
| Tool | Description |
|------|-------------|
| `parse_plan` | PLAN.md 파싱 |
| `get_execution_order` | Wave 순서 계산 |
| `build_dependency_map` | 의존성 맵 생성 |
| `calculate_progress` | 진행률 계산 |

### Wisdom Tools
| Tool | Description |
|------|-------------|
| `add_learning` | 학습 기록 |
| `add_decision` | 결정 기록 |
| `add_issue` | 이슈 기록 |
| `get_wisdom` | 축적된 지혜 조회 |

### Skill Injection Tools (v3.1.1)
| Tool | Description |
|------|-------------|
| `match_skills` | 컨텍스트 기반 스킬 매칭 |
| `inject_skills` | 에이전트 프롬프트에 스킬 주입 |
| `inject_specific_skills` | 특정 스킬 강제 주입 |
| `list_skills` | 스킬 목록 조회 |
| `get_skill` | 스킬 상세 조회 |
| `get_auto_selected_skills` | 자동 선택 스킬 조회 |

(전체 70+ 도구 목록은 docs/HYBRID-INTEGRATION.md 참조)

## Updating References

GSD와 OMC는 정기적으로 업데이트됩니다:

```bash
./scripts/update-references.sh
```

## Version History

### v3.1.1 - Dynamic Skill Injection (Current)
- 스킬 레지스트리 시스템 (YAML 기반)
- 오케스트레이터 자동 스킬 매칭/주입
- MCP 도구 7개 추가

### v3.1.0 - Hybrid Integration
- GSD Research + Planning 통합 (Context7, 검증 프로토콜)
- OMC Agent 통합 (build-fixer, security-reviewer, code-reviewer, tdd-guide, vision)
- Model Profiles (quality/balanced/budget)
- 새 명령어: discuss-phase, debug
- 자동 품질 게이트 (build-fix, security-review)

### v3.0 - Context Architect Pattern
- Context collection, injection, compaction
- Hints with `isHint: true` (AI decides, not rules)
- Simplified swarm/pipeline to prompt generation only
- 247 tests (11 test files)

### v2.0 - Multi-agent Orchestration
- Swarm pattern for parallel execution
- Pipeline pattern with 6 presets
- Deviation handling

### v1.0 - Foundation
- Basic planning workflow
- PLAN.md format
- Wave-based execution

## Philosophy

> **"Claude Code는 계속 발전한다. 우리는 발전을 따라가는 게 아니라, 발전 위에 올라타는 것이다."**

Ultra Planner는 세 시스템의 장점을 결합합니다:
- **GSD의 계획력** - 논리적 컨텍스트 기반 Task 분리, Context7 리서치
- **OMC의 전문성** - build-fixer, security-reviewer, code-reviewer
- **Ultra Planner의 오케스트레이션** - 70+ MCP 도구, Ralplan 검증

## License

MIT

---

*Made with Ultra Planner v3.1 - Hybrid Integration*
