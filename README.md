# Ultra Planner v4.0

> **"실행하지 않는다. 맥락을 설계한다."**
> (Don't execute, design context.)

Ultra Planner는 Claude Code를 위한 **Context Architect**입니다.

---

## ⚠️ MANDATORY WORKFLOW

**이 워크플로우를 따르지 않으면 Ultra Planner를 사용하는 의미가 없습니다.**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 /ultraplan:plan-phase {N}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 1: RESEARCH                                                       │
│  Agent: gsd-phase-researcher (opus)                                     │
│  Output: .planning/phases/{NN}-*/RESEARCH.md                            │
│                                                                         │
│  • Context7로 라이브러리 문서 조회                                       │
│  • WebSearch로 최신 패턴 조사                                            │
│  • 코드베이스 탐색으로 기존 패턴 파악                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 2: PLAN GENERATION                                                │
│  Agent: gsd-planner (opus)                                              │
│  Output: .planning/phases/{NN}-*/{NN}-01-PLAN.md, {NN}-02-PLAN.md, ...  │
│                                                                         │
│  • 목표역산 (Goal-Backward) 방법론                                      │
│  • 논리적 컨텍스트 기반 태스크 분리                                      │
│  • Wave 기반 의존성 설정                                                 │
│  • must_haves (truths, artifacts, key_links) 도출                       │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 3: RALPLAN VERIFICATION (합의까지 반복, 최대 5회)                  │
│                                                                         │
│     ┌──────────────┐       ┌──────────────┐       ┌──────────────┐     │
│     │  gsd-planner │──────▶│  ultraplan-  │──────▶│  ultraplan-  │     │
│     │    (opus)    │       │  architect   │       │    critic    │     │
│     └──────────────┘       └──────────────┘       └──────────────┘     │
│            ▲                      │                      │              │
│            │    ISSUES FOUND      │                      │              │
│            └──────────────────────┘                      │              │
│            │                          NOT SATISFIED      │              │
│            └─────────────────────────────────────────────┘              │
│                                                                         │
│  종료 조건: Architect APPROVED + Critic SATISFIED                       │
└─────────────────────────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 /ultraplan:execute {plan}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 1: NATIVE TASKS 등록 (MANDATORY)                                  │
│                                                                         │
│  PLAN.md 파싱 후 Claude Code Tasks에 등록:                               │
│                                                                         │
│  TaskCreate("16-01-01: Add types")           → #6 (no blockers)         │
│  TaskCreate("16-01-02: Implement monitor")   → #5                       │
│  TaskUpdate(#5, blockedBy: [#6])                                        │
│  TaskCreate("16-01-03: Add tests")           → #7                       │
│  TaskUpdate(#7, blockedBy: [#5])                                        │
│                                                                         │
│  결과:                                                                   │
│  #6 [pending] 16-01-01: Add types                                       │
│  #5 [pending] 16-01-02: Implement monitor [blocked by #6]               │
│  #7 [pending] 16-01-03: Add tests [blocked by #5]                       │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 2: WAVE 기반 병렬 실행                                             │
│                                                                         │
│  FOR each unblocked task:                                               │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  2.1 TaskUpdate(taskId, status: in_progress)                      │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                  │                                      │
│                                  ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  2.2 EXECUTE                                                      │ │
│  │      Agent: ultraplan-executor (opus)                             │ │
│  │      Input: <task> XML from PLAN.md                               │ │
│  │      Output: YAML result (success/failure/blocked)                │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                  │                                      │
│                                  ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  2.3 VERIFY                                                       │ │
│  │      Agent: ultraplan-architect (opus)                            │ │
│  │      ├─ APPROVED → 2.4로 진행                                     │ │
│  │      └─ REJECTED → 피드백과 함께 2.2 재실행                        │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                  │                                      │
│                                  ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  2.4 TaskUpdate(taskId, status: completed)                        │ │
│  │      → blockedBy에 이 task가 있던 다른 tasks가 unblock됨           │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                  │                                      │
│                                  ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  2.5 ATOMIC COMMIT                                                │ │
│  │      git add {files} && git commit -m "feat({task}): {desc}"      │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  (BUILD ERROR 발생 시)                                                   │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  Agent: oh-my-claudecode:build-fixer (sonnet)                     │ │
│  │  → 빌드 에러 수정 후 2.3 재실행                                     │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 3: PHASE 완료                                                     │
│                                                                         │
│  1. ROADMAP.md 체크박스 업데이트: - [ ] → - [x]                          │
│  2. Phase 단위 커밋: feat(phase-N): complete {phase-name}               │
│  3. Unattended mode: 다음 Phase로 자동 진행                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Agent Selection (MANDATORY)

| 단계 | Agent | Model | NEVER Use |
|------|-------|-------|-----------|
| Research | `gsd-phase-researcher` | opus | - |
| Planning | `gsd-planner` | opus | - |
| Execution | `ultraplan-executor` | **opus** | `oh-my-claudecode:executor` |
| Verification | `ultraplan-architect` | opus | - |
| Critique | `ultraplan-critic` | opus | - |
| Build Fixes | `oh-my-claudecode:build-fixer` | sonnet | - |

### FORBIDDEN

1. **NEVER** use `oh-my-claudecode:executor` for task execution
2. **NEVER** use `sonnet` model for code generation tasks
3. **NEVER** skip verification after task completion
4. **NEVER** execute tasks without Native Tasks registration
5. **NEVER** skip blockedBy setup for multi-wave plans

---

## Native Tasks Protocol (MANDATORY)

### Task Registration

```typescript
// Wave 1: No blockers
TaskCreate({ subject: "16-01-01: Add types", ... })  // → #6

// Wave 2: Blocked by Wave 1
TaskCreate({ subject: "16-01-02: Implement", ... })  // → #5
TaskUpdate({ taskId: "5", addBlockedBy: ["6"] })

// Wave 3: Blocked by Wave 2
TaskCreate({ subject: "16-01-03: Tests", ... })      // → #7
TaskUpdate({ taskId: "7", addBlockedBy: ["5"] })
```

### Execution Flow

```
실행 전:
  #6 [pending] Task 1              ← Wave 1 (unblocked)
  #5 [pending] Task 2 [blocked by #6]  ← Wave 2
  #7 [pending] Task 3 [blocked by #5]  ← Wave 3

#6 실행 중:
  #6 [in_progress] Task 1          ← 현재 실행 중
  #5 [pending] Task 2 [blocked by #6]
  #7 [pending] Task 3 [blocked by #5]

#6 완료 후:
  #6 [completed] Task 1
  #5 [pending] Task 2              ← 이제 unblocked!
  #7 [pending] Task 3 [blocked by #5]
```

### Status Updates

| When | Action |
|------|--------|
| Task created | status: pending (default) |
| About to execute | TaskUpdate status: in_progress |
| Executor returns success | TaskUpdate status: completed |
| Executor returns failure | Keep in_progress, retry |

---

## What's New in v4.0

### Context Architect Pattern

| Feature | Description |
|---------|-------------|
| **Layered Memory** | Working/ShortTerm/LongTerm 3-layer 메모리 |
| **Artifact Pattern** | JIT 로딩으로 토큰 90% 절약 |
| **Context Compaction** | 80% 도달 시 자동 압축 |
| **Central Registry** | 프로젝트 간 스킬/에이전트 공유 |
| **Native Tasks** | Claude Code Tasks로 의존성 추적 |

### New Files (v4.0)

```
src/
├── memory/                # Layered Memory System
│   ├── types.ts           # MemoryLayer, WorkingMemory, etc.
│   ├── working.ts         # Volatile task state
│   ├── short-term.ts      # Session state (STATE.md)
│   ├── long-term.ts       # Persistent wisdom
│   ├── extractor.ts       # Wisdom extraction
│   ├── collector.ts       # Auto-collection
│   ├── session-loader.ts  # Session initialization
│   └── prompt-injector.ts # Wisdom injection
│
├── artifacts/             # Artifact Pattern
│   ├── types.ts           # ArtifactReference, ArtifactCollection
│   ├── reference.ts       # createArtifactReference
│   └── prompt-templates.ts # JIT loading prompts
│
├── registry/              # Central Registry
│   ├── types.ts           # RegistryEntry, RegistryConfig
│   ├── skills.ts          # SkillRegistry
│   └── agents.ts          # AgentRegistry
│
└── context/               # Context Compaction
    ├── advanced-monitor.ts # 80% auto-compaction detection
    ├── extractor.ts        # CoreInfo extraction
    ├── auto-compaction.ts  # AutoCompactionManager
    └── fresh-start.ts      # Session continuation
```

---

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

### 3. 스킬/커맨드 설치

```bash
# 전역 설치
mkdir -p ~/.claude/commands ~/.claude/agents
ln -sf /path/to/ultra-planning/.claude/commands/* ~/.claude/commands/
ln -sf /path/to/ultra-planning/.claude/agents/* ~/.claude/agents/
```

---

## Commands

| Command | Description |
|---------|-------------|
| `/ultraplan:new-project` | 새 프로젝트 초기화 (Research → Plan → Ralplan) |
| `/ultraplan:plan-phase {N}` | Phase N 계획 생성 |
| `/ultraplan:execute {plan}` | 계획 실행 (Native Tasks + Wave 병렬) |
| `/ultraplan:fresh-start` | 압축된 컨텍스트로 세션 재개 |
| `/thorough all` | 모든 미완료 Phase 자동 실행 |
| `/thorough from {N}` | Phase N부터 끝까지 실행 |

---

## Philosophy

> **"Claude Code는 계속 발전한다. 우리는 발전을 따라가는 게 아니라, 발전 위에 올라타는 것이다."**

Ultra Planner v4.0은 세 시스템의 장점을 결합합니다:

- **GSD의 계획력** - 논리적 컨텍스트 기반 Task 분리, Context7 리서치
- **OMC의 전문성** - build-fixer, security-reviewer, code-reviewer
- **Ultra Planner의 오케스트레이션** - MCP 도구, Ralplan 검증, Native Tasks

---

## Version History

| Version | Codename | Key Features |
|---------|----------|--------------|
| v4.0 | Context Architect | Layered Memory, Artifact Pattern, Context Compaction, Native Tasks |
| v3.1.1 | Skill Injection | 스킬 레지스트리, 자동 주입 |
| v3.1 | Hybrid Integration | GSD + OMC 통합, Model Profiles |
| v3.0 | Context Architect | Context collection/injection/compaction |
| v2.0 | Multi-agent | Swarm, Pipeline patterns |
| v1.0 | Foundation | Basic planning, PLAN.md format |

---

## License

MIT

---

*Made with Ultra Planner v4.0 - Context Architect Pattern*
