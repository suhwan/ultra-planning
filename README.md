# Ultra Planner v3.0

> **"실행하지 않는다. 맥락을 설계한다."**
> (Don't execute, design context.)

Ultra Planner는 Claude Code를 위한 **Context Architect**입니다. 맥락, 지혜, 힌트, 프롬프트를 제공하고 - 실행은 Claude Code의 네이티브 Task API가 처리합니다.

## Philosophy

```
┌─────────────────────────────────────────────────────────────┐
│                    Context Architect Pattern                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Ultra Planner                    Claude Code               │
│   ─────────────                    ──────────                │
│   • Context Collection      →      • Task Execution          │
│   • Context Injection       →      • State Management        │
│   • Hints (AI decides)      →      • File Operations         │
│   • Prompt Generation       →      • Build/Test              │
│   • Wisdom Accumulation     →      • Parallel Workers        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Why This Pattern?

| Reason | Explanation |
|--------|-------------|
| **Future Compatibility** | Claude Code evolves; we ride on top, not against |
| **Optimization** | Native features are always more optimized |
| **Maintainability** | No duplicate code, reduced maintenance burden |
| **Flexibility** | AI judgment > rigid rules |

## Installation

```bash
# Install dependencies
npm install

# Build
npm run build

# Run MCP server
npm start
```

### MCP 서버 설정

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

## Architecture

```
src/
├── context/           # Context Architect (v3.0)
│   ├── collector.ts   # Collect from .planning files
│   ├── injector.ts    # Role-based context injection
│   └── compactor.ts   # Compress for fresh-start
│
├── hints/             # AI Suggestions (not rules)
│   ├── complexity.ts  # Complexity hints (isHint: true)
│   └── routing.ts     # Routing hints (isHint: true)
│
├── prompts/           # Prompt Generation
│   ├── worker.ts      # Worker prompts
│   ├── orchestrator.ts# Orchestrator prompts
│   └── executor.ts    # Executor loop prompts
│
├── notepad/           # Wisdom Accumulation
│   ├── learnings.ts   # Learning records
│   ├── decisions.ts   # Decision records
│   └── issues.ts      # Issue records
│
├── orchestration/     # Simplified Orchestration
│   ├── swarm/         # Prompt generation only
│   └── pipeline/      # Preset definitions only
│
└── mcp-server.ts      # MCP Server (~45 tools)
```

## Core Modules

### 1. Context Collection

`.planning` 디렉토리에서 맥락 수집:

```typescript
import { collectContext } from 'ultra-planner';

const ctx = collectContext({
  planId: '03-01',
  includeProject: true,
  includePhase: true,
});

// ctx.project  → PROJECT.md, ROADMAP.md, REQUIREMENTS.md
// ctx.phase    → Research, Plans, Summaries
// ctx.task     → Current PLAN.md
```

### 2. Context Injection

각 에이전트 역할에 맞는 맥락 주입:

```typescript
import { injectWorkerContext, injectArchitectContext } from 'ultra-planner';

// Worker: 태스크 계획, 페이즈 리서치, 프로젝트 개요
const workerCtx = injectWorkerContext(ctx);

// Architect: 검증할 태스크, 요구사항, 프로젝트 맥락
const architectCtx = injectArchitectContext(ctx);
```

| Role | Gets |
|------|------|
| Worker | Task plan, phase research, project overview |
| Orchestrator | All phase plans, roadmap, requirements |
| Planner | Project, requirements, roadmap, research |
| Executor | Task plan, task summary, minimal project |
| Architect | Task to verify, requirements, project |
| Critic | Plan to review, requirements, roadmap |

### 3. Context Compaction

Fresh-start 시나리오를 위한 맥락 압축:

```typescript
import { compactContext, saveContextSnapshot, restoreContext } from 'ultra-planner';

// 대화 리셋 전
const compacted = compactContext(ctx);
saveContextSnapshot(compacted);
// 20,000 tokens → 200 tokens (99% 압축)

// Fresh-start 후
const restored = restoreContext('latest');
```

### 4. Hints (AI Decides)

`isHint: true`로 제안 제공 - AI가 최종 결정:

```typescript
import { suggestComplexity, suggestRoute, getTaskHints } from 'ultra-planner';

const complexity = suggestComplexity({
  taskDescription: 'Add OAuth authentication',
  files: ['auth.ts', 'middleware.ts'],
});
// { isHint: true, level: 4, category: 'complex', confidence: 0.8 }

const routing = suggestRoute({
  taskDescription: 'Debug race condition',
  contextHints: { isDebugging: true },
});
// { isHint: true, agent: 'architect', model: 'opus', confidence: 0.9 }

// 통합 힌트
const hints = getTaskHints({ taskDescription: '...' });
// hints.message: "Your judgment is the final authority."
```

### 5. Prompt Generation

워커 및 오케스트레이터 프롬프트 생성:

```typescript
import { generateWorkerPrompt, generateOrchestratorPrompt } from 'ultra-planner';

const workerPrompt = generateWorkerPrompt({
  worker: { id: 'w1', name: 'Auth Worker', index: 0 },
  planPath: '.planning/phases/03-auth/03-01-PLAN.md',
  learnings: formattedContext,
});

const orchestratorPrompt = generateOrchestratorPrompt({
  planPath: '.planning/phases/03-auth/03-01-PLAN.md',
  workerCount: 3,
});
```

## MCP Tools

### Context Tools
| Tool | Description |
|------|-------------|
| `collect_project_context` | PROJECT.md, ROADMAP.md, REQUIREMENTS.md 수집 |
| `collect_phase_context` | 페이즈 리서치 및 계획 수집 |
| `collect_task_context` | 특정 PLAN.md 수집 |
| `compress_context` | Fresh-start용 압축 |
| `restore_context` | 스냅샷에서 복원 |

### Hint Tools
| Tool | Description |
|------|-------------|
| `suggest_complexity` | 복잡도 힌트 (isHint: true) |
| `suggest_route` | 라우팅 힌트 (isHint: true) |
| `get_task_hints` | 모든 힌트 한번에 |

### Wisdom Tools
| Tool | Description |
|------|-------------|
| `add_learning` | 학습 기록 |
| `add_decision` | 결정 기록 |
| `add_issue` | 이슈 기록 |
| `get_wisdom` | 축적된 지혜 조회 |
| `create_wisdom_directive` | 서브에이전트용 디렉티브 생성 |

### Prompt Tools
| Tool | Description |
|------|-------------|
| `generate_worker_prompt` | 워커 프롬프트 생성 |
| `generate_swarm_orchestrator_prompt` | 오케스트레이터 프롬프트 생성 |
| `generate_pipeline_orchestrator_prompt` | 파이프라인 프롬프트 생성 |

## Testing

```bash
# 전체 테스트
npm test

# E2E 시나리오 테스트
npm test -- tests/integration/e2e-full-scenario.test.ts
```

**테스트 커버리지:**
- 247 tests across 11 test files
- Context collection, injection, compaction
- Hints with isHint verification
- Full E2E workflow tests

## .planning Directory Structure

```
.planning/
├── PROJECT.md          # 프로젝트 정의
├── ROADMAP.md          # 페이즈 로드맵
├── REQUIREMENTS.md     # 요구사항
├── STATE.md            # 현재 상태
├── phases/
│   ├── 01-foundation/
│   │   ├── 01-RESEARCH.md
│   │   ├── 01-01-PLAN.md
│   │   └── 01-01-SUMMARY.md
│   └── ...
└── notepads/
    └── _project/
        ├── learnings.md
        ├── decisions.md
        └── issues.md
```

## Integration with Claude Code

Ultra Planner는 Claude Code와 원활하게 통합:

```
1. Ultra Planner가 .planning에서 맥락 수집
2. 에이전트 역할에 맞게 맥락 주입
3. 힌트 제공 (AI가 결정, 규칙 아님)
4. 워커용 프롬프트 생성
5. Claude Code가 TaskList, TaskUpdate, Task API로 실행
6. 지혜가 축적되어 다음 세션에 활용
```

## Version History

### v3.0 - Context Architect Pattern
- Context collection, injection, compaction
- Hints with `isHint: true` (AI decides)
- Removed state management (Claude Code handles)
- Simplified swarm/pipeline to prompt generation only
- 247 tests (11 test files)

### v2.0 - Multi-agent Orchestration
- Swarm, pipeline, delegation
- Complexity estimation
- Wisdom notepad

## License

MIT

---

*"Claude Code는 계속 발전한다. 우리는 발전을 따라가는 게 아니라, 발전 위에 올라타는 것이다."*
