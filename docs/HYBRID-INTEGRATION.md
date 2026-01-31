# Ultra Planner v3.1 - Hybrid Integration

> GSD의 계획력 + OMC의 전문성 + Ultra Planner의 오케스트레이션

## Overview

Ultra Planner v3.1은 세 시스템의 장점을 결합한 하이브리드 아키텍처입니다:

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

## What Changed

### From GSD

| 항목 | 용도 | 위치 |
|------|------|------|
| `gsd-project-researcher` | 프로젝트 리서치 (Context7, 5개 파일 출력) | `ultraplan-new-project.md`에서 호출 |
| `gsd-phase-researcher` | Phase 리서치 (검증 프로토콜) | `ultraplan-plan-phase.md`에서 호출 |
| `gsd-planner` | 논리적 컨텍스트 기반 Task 분리 | `ultraplan-new-project.md`, `ultraplan-plan-phase.md`에서 호출 |
| `/ultraplan:discuss-phase` | 계획 전 맥락 수집 | 새 명령어 |
| `/ultraplan:debug` | 체계적 디버깅 | 새 명령어 |
| Model Profiles | quality/balanced/budget | `.ultraplan/config.json` |

### From OMC

| 항목 | 용도 | 위치 |
|------|------|------|
| `build-fixer` | 빌드 에러 자동 수정 | `.claude/agents/` (심볼릭) |
| `build-fixer-low` | 간단한 빌드 에러 (Haiku) | `.claude/agents/` (심볼릭) |
| `security-reviewer` | OWASP Top 10 보안 스캔 | `.claude/agents/` (심볼릭) |
| `security-reviewer-low` | 빠른 보안 스캔 (Haiku) | `.claude/agents/` (심볼릭) |
| `code-reviewer` | 코드 품질 체크 (Opus) | `.claude/agents/` (심볼릭) |
| `code-reviewer-low` | 빠른 품질 체크 (Haiku) | `.claude/agents/` (심볼릭) |
| `tdd-guide` | TDD 강제 | `.claude/agents/` (심볼릭) |
| `tdd-guide-low` | 빠른 테스트 제안 (Haiku) | `.claude/agents/` (심볼릭) |
| `vision` | 이미지/다이어그램 분석 | `.claude/agents/` (심볼릭) |

### Kept from Ultra Planner

| 항목 | 용도 |
|------|------|
| 오케스트레이션 | `/ultraplan:*` 명령어 |
| MCP 도구 (70+) | context 수집/주입/힌트 |
| `ultraplan-architect` | Ralplan 검증 |
| `ultraplan-critic` | Ralplan 비판 |
| `ultraplan-executor` | Task 실행 |

## File Structure

```
.claude/
├── agents/
│   ├── ultraplan-architect.md      # 유지
│   ├── ultraplan-critic.md         # 유지
│   ├── ultraplan-executor.md       # 유지
│   ├── ultraplan-planner.md        # 유지 (fallback용)
│   ├── ultraplan-researcher.md     # 유지 (fallback용)
│   │
│   │  # OMC 심볼릭 링크
│   ├── build-fixer.md → references/oh-my-claudecode/agents/
│   ├── build-fixer-low.md → ...
│   ├── security-reviewer.md → ...
│   ├── security-reviewer-low.md → ...
│   ├── code-reviewer.md → ...
│   ├── code-reviewer-low.md → ...
│   ├── tdd-guide.md → ...
│   ├── tdd-guide-low.md → ...
│   └── vision.md → ...
│
├── commands/
│   ├── ultraplan-new-project.md    # GSD 에이전트 사용하도록 수정됨
│   ├── ultraplan-plan-phase.md     # GSD 에이전트 사용하도록 수정됨
│   ├── ultraplan-execute.md        # OMC 에이전트 추가됨
│   ├── ultraplan-discuss-phase.md  # 새로 추가 (GSD 래핑)
│   ├── ultraplan-debug.md          # 새로 추가 (GSD 래핑)
│   └── ...
│
└── skills/
    └── ultraplan/
        └── ...

.ultraplan/
├── config.json                     # Model Profiles 추가됨
└── ...

references/
├── get-shit-done/                  # GSD (git repo)
│   └── agents/
│       ├── gsd-project-researcher.md
│       ├── gsd-phase-researcher.md
│       └── gsd-planner.md
│
└── oh-my-claudecode/               # OMC (git repo)
    └── agents/
        ├── build-fixer.md
        ├── security-reviewer.md
        └── ...
```

## Configuration

### Model Profiles

`.ultraplan/config.json`:

```json
{
  "modelProfile": "balanced",  // quality | balanced | budget
  "profiles": {
    "quality": {
      "routing": {
        "research": "opus",
        "planning": "opus",
        "execution": "opus",
        "verification": "opus"
      },
      "agents": {
        "build-fixer": "build-fixer",
        "security-reviewer": "security-reviewer",
        "code-reviewer": "code-reviewer"
      }
    },
    "balanced": {
      "routing": {
        "research": "opus",
        "planning": "opus",
        "execution": "sonnet",
        "verification": "opus"
      },
      "agents": {
        "build-fixer": "build-fixer",
        "security-reviewer": "security-reviewer-low",
        "code-reviewer": "code-reviewer-low"
      }
    },
    "budget": {
      "routing": {
        "research": "sonnet",
        "planning": "sonnet",
        "execution": "haiku",
        "verification": "sonnet"
      },
      "agents": {
        "build-fixer": "build-fixer-low",
        "security-reviewer": "security-reviewer-low",
        "code-reviewer": "code-reviewer-low"
      }
    }
  }
}
```

### Execution Options

```json
{
  "execution": {
    "autoFixBuildErrors": true,   // executor 후 빌드 에러 자동 수정
    "autoSecurityReview": true,   // 완료 후 보안 스캔
    "autoCodeReview": false,      // 완료 후 코드 리뷰 (기본 off)
    "maxBuildFixAttempts": 3,     // 빌드 수정 최대 시도
    "enableTDD": false            // TDD 모드 (--tdd 플래그로도 가능)
  }
}
```

## Usage

### Basic Workflow

```bash
# 1. 프로젝트 시작 (GSD 리서치 + GSD 계획 + Ralplan 검증)
/ultraplan:new-project

# 2. Phase 맥락 수집 (선택)
/ultraplan:discuss-phase 1

# 3. Phase 계획 (GSD 리서치 + GSD 계획 + Ralplan 검증)
/ultraplan:plan-phase 1

# 4. 실행 (executor + build-fixer + security-reviewer)
/ultraplan:execute 01-01
```

### With Options

```bash
# TDD 모드로 실행
/ultraplan:execute 01-01 --tdd

# 빠른 모드 (리서치 스킵)
/ultraplan:plan-phase 1 --skip-research

# 디버깅
/ultraplan:debug "TypeError in auth"
```

### Model Profile 변경

```bash
# config.json 직접 수정
# "modelProfile": "budget"

# 또는 환경 변수
ULTRAPLAN_PROFILE=budget /ultraplan:execute 01-01
```

## Updating References

GSD와 OMC는 정기적으로 업데이트됩니다:

```bash
# 수동 업데이트
./scripts/update-references.sh

# 결과 예시
▶ Updating GSD (Get Shit Done)...
  ✓ Updated: 339e911 → 5ee22e6

▶ Updating OMC (Oh My ClaudeCode)...
  ✓ Updated: 33ad052 → 592e65c
```

## Migration from v3.0

v3.0에서 업그레이드:

1. **자동 적용됨:**
   - GSD 에이전트 사용 (심볼릭 링크)
   - OMC 에이전트 사용 (심볼릭 링크)
   - 기존 명령어 그대로 작동

2. **선택적 설정:**
   - `.ultraplan/config.json`에서 modelProfile 선택
   - execution 옵션 조정

3. **새 명령어:**
   - `/ultraplan:discuss-phase` - 맥락 수집
   - `/ultraplan:debug` - 체계적 디버깅

## Troubleshooting

### 에이전트를 찾을 수 없음

```bash
# 심볼릭 링크 확인
ls -la .claude/agents/

# 재생성
ln -sf references/oh-my-claudecode/agents/build-fixer.md .claude/agents/
```

### GSD/OMC 업데이트 실패

```bash
cd references/get-shit-done && git pull origin main
cd references/oh-my-claudecode && git pull origin main
```

### Config 적용 안 됨

```bash
# JSON 유효성 검사
cat .ultraplan/config.json | jq .
```

## Version History

- **v3.1.0** (2025-01-31): Hybrid Integration
  - GSD 리서치 + 계획 통합
  - OMC 전문 에이전트 통합
  - Model Profiles 추가
  - discuss-phase, debug 명령어 추가

- **v3.0.0**: Context Architect 패턴
  - MCP 도구 70+
  - Ralplan 검증 루프
