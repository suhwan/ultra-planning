# Ultra Planning v2.0 Architecture Design

*Created: 2026-01-31*
*Status: Phase 1 - Architecture Design*

---

## 1. 현재 디렉토리 구조

```
src/
├── index.ts                    # Library exports
├── mcp-server.ts               # MCP server (tools exposure)
├── types.ts                    # Core types
│
├── agents/                     # Agent definitions
│   ├── types.ts                # AgentRole, AgentConfig, AgentPrompt
│   └── prompts/                # Agent prompt files
│       ├── planner.ts          # GSD Planner (466 lines)
│       ├── architect.ts        # READ-ONLY Architect (203 lines)
│       ├── critic.ts           # Plan Critic (246 lines)
│       └── executor.ts         # Task Executor
│
├── orchestration/              # Orchestration systems
│   ├── ralplan/                # Ralplan consensus loop
│   │   ├── types.ts            # RalplanPhase, RalplanState
│   │   ├── orchestrator.ts     # State machine
│   │   └── state.ts            # State persistence
│   ├── ultrapilot/             # Parallel execution
│   │   ├── types.ts            # UltrapilotState, WorkerInfo
│   │   └── coordinator.ts      # File ownership, workers
│   ├── keywords/               # Magic keyword detection
│   └── context-polling/        # Context monitoring
│
├── state/                      # State management
│   ├── types.ts                # StateLocation, StateEvent, Checkpoint
│   ├── state-manager.ts        # File-based state
│   ├── event-system.ts         # Event queue (JSONL)
│   ├── mode-registry.ts        # Mode conflict detection
│   └── checkpoint.ts           # Git checkpoints
│
├── sync/                       # Plan parsing & dependencies
│   ├── types.ts                # TaskMapping, ParsedPlan
│   ├── plan-parser.ts          # PLAN.md parser
│   └── dependency-map.ts       # Wave→blockedBy mapping
│
├── tasks/                      # Claude Tasks API
│   ├── types.ts                # TaskCreateParams, TaskUpdateParams
│   └── dependencies.ts         # Task invocation generation
│
├── notepad/                    # Learning system
│   ├── types.ts                # NotepadEntry, WisdomSummary
│   ├── manager.ts              # Notepad initialization
│   └── api.ts                  # Learning API functions
│
├── recovery/                   # Error recovery
│   ├── types.ts                # RecoveryState
│   └── rollback.ts             # Rollback logic
│
├── quality/                    # Code quality
│   ├── ast/                    # AST analysis
│   ├── lsp/                    # LSP diagnostics
│   ├── review/                 # Code review
│   └── pipeline/               # Quality pipeline
│
├── documents/                  # Document management
├── context/                    # Context building
├── git/                        # Git operations
├── hooks/                      # Hook system
└── loops/                      # Ralph loop
```

---

## 2. v2.0 추가 타입 정의

### 2.1 Task Complexity (새로 추가)

```typescript
// src/complexity/types.ts

/** Complexity levels (maps to model selection) */
export type ComplexityLevel = 1 | 2 | 3 | 4 | 5;

/** Complexity to model mapping */
export const COMPLEXITY_MODEL_MAP: Record<ComplexityLevel, 'haiku' | 'sonnet' | 'opus'> = {
  1: 'haiku',   // Trivial: lookups, simple edits
  2: 'haiku',   // Simple: straightforward implementations
  3: 'sonnet',  // Standard: typical features
  4: 'sonnet',  // Complex: multi-file changes
  5: 'opus',    // Very complex: architectural changes
};

/** Task complexity metadata */
export interface TaskComplexity {
  /** Complexity score 1-5 */
  level: ComplexityLevel;
  /** Estimated effort in minutes */
  estimatedMinutes?: number;
  /** Complexity category (optional) */
  category?: 'quick' | 'standard' | 'complex' | 'architectural';
  /** Reasoning for complexity assignment */
  rationale?: string;
}

/** Extended task with complexity */
export interface TaskWithComplexity {
  id: string;
  name: string;
  action: string;
  complexity: TaskComplexity;
  wave: number;
  done: string;
}
```

### 2.2 Agent Verdicts (새로 추가)

```typescript
// src/orchestration/verdicts/types.ts

/** Architect verdict for task verification */
export interface ArchitectVerdict {
  /** Overall verdict */
  verdict: 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION';
  /** Verification timestamp */
  timestamp: string;
  /** Task ID that was verified */
  taskId: string;
  /** Checklist results */
  checklist: {
    codeCompiles: boolean;
    testsPass: boolean;
    requirementsMet: boolean;
    noRegressions: boolean;
    codeQuality: boolean;
  };
  /** Pass percentage (80% = APPROVED) */
  passPercentage: number;
  /** Issues found (if any) */
  issues?: string[];
  /** Suggestions for improvement */
  suggestions?: string[];
}

/** Critic verdict for plan review */
export interface CriticVerdict {
  /** Overall verdict */
  verdict: 'OKAY' | 'REJECT';
  /** Review timestamp */
  timestamp: string;
  /** Plan path reviewed */
  planPath: string;
  /** Checklist results */
  checklist: {
    goalsAligned: boolean;
    tasksAtomic: boolean;
    dependenciesClear: boolean;
    verifiable: boolean;
    waveStructure: boolean;
  };
  /** Pass percentage (80% = OKAY) */
  passPercentage: number;
  /** Justification for verdict */
  justification: string;
  /** Improvements needed (if REJECT) */
  improvements?: string[];
}
```

### 2.3 Executor Result (새로 추가)

```typescript
// src/orchestration/executor/types.ts

/** Executor result after task completion */
export interface ExecutorResult {
  /** Task ID executed */
  taskId: string;
  /** Execution status */
  status: 'success' | 'failed' | 'partial';
  /** Timestamp */
  timestamp: string;
  /** Files modified */
  filesModified: string[];
  /** Lines changed */
  linesChanged: number;
  /** Commit hash (if committed) */
  commitHash?: string;
  /** Test results (if ran) */
  testResults?: {
    passed: number;
    failed: number;
    skipped: number;
  };
  /** Error message (if failed) */
  error?: string;
  /** Learnings discovered */
  learnings?: string[];
  /** Deviation report (if deviated from plan) */
  deviation?: DeviationReport;
}
```

### 2.4 Deviation Report (새로 추가)

```typescript
// src/orchestration/deviation/types.ts

/** Deviation levels */
export type DeviationLevel = 1 | 2 | 3;

/** Deviation report from executor */
export interface DeviationReport {
  /** Deviation level */
  level: DeviationLevel;
  /** Task ID */
  taskId: string;
  /** Timestamp */
  timestamp: string;
  /** What was originally planned */
  originalPlan: string;
  /** What was actually done */
  actualImplementation: string;
  /** Reason for deviation */
  reason: string;
  /** Impact assessment */
  impact: 'none' | 'minor' | 'major';
  /** Requires plan modification? */
  requiresPlanModification: boolean;
  /** Affected downstream tasks */
  affectedTasks?: string[];
}

/** Deviation level definitions */
export const DEVIATION_LEVELS = {
  1: {
    name: 'Informational',
    description: 'Minor deviation, no approval needed',
    action: 'Log to DEVIATION.md only',
  },
  2: {
    name: 'Requires Approval',
    description: 'Moderate deviation, needs Architect sign-off',
    action: 'Architect quick review before proceeding',
  },
  3: {
    name: 'Plan Modification',
    description: 'Major deviation, plan needs update',
    action: 'Trigger plan revision workflow',
  },
} as const;
```

### 2.5 Session Isolation (새로 추가)

```typescript
// src/state/session/types.ts

/** Session identifier */
export interface SessionId {
  /** UUID for the session */
  id: string;
  /** Session creation timestamp */
  createdAt: string;
  /** Parent session (for nested spawns) */
  parentSessionId?: string;
}

/** Session-scoped state */
export interface SessionState {
  /** Session identifier */
  sessionId: SessionId;
  /** Active mode */
  mode: ExecutionMode;
  /** Current plan path */
  activePlan?: string;
  /** Tasks claimed by this session */
  claimedTasks: string[];
  /** Agent role in this session */
  agentRole?: AgentRole;
}

/** Session isolation rules */
export interface SessionIsolationRules {
  /** What context to pass to spawned agents */
  contextToPass: 'plan_only' | 'plan_and_state' | 'minimal';
  /** What results to collect */
  resultsToCollect: ('verdict' | 'learnings' | 'metrics')[];
  /** Timeout for spawned session */
  timeoutMs: number;
}
```

---

## 3. 상태 파일 구조

### 3.1 프로젝트 상태 (`.ultraplan/`)

```
.ultraplan/
├── config.json                 # Project configuration
├── state/
│   ├── session.json            # Current session state
│   ├── ralplan-state.json      # Ralplan loop state
│   ├── ultrapilot-state.json   # Parallel execution state
│   ├── ralph-state.json        # Ralph loop state
│   ├── events.jsonl            # Event queue (append-only)
│   └── sessions/               # Session isolation (NEW)
│       └── {session-id}/
│           ├── state.json      # Session-specific state
│           └── learnings.json  # Session learnings
├── checkpoints/
│   └── {checkpoint-id}.json    # Checkpoint snapshots
└── deviations/                 # Deviation reports (NEW)
    └── {task-id}.md            # Per-task deviation log
```

### 3.2 Planning 디렉토리 (`.planning/`)

```
.planning/
├── PROJECT.md                  # Project definition
├── ROADMAP.md                  # Phase roadmap
├── research/                   # Research outputs
├── phases/
│   └── {phase-id}/
│       ├── {plan-id}-PLAN.md   # Plan files
│       └── {plan-id}-RESEARCH.md
└── notepads/                   # Learning system
    ├── _project/               # Project-level wisdom
    │   ├── learnings.md
    │   ├── decisions.md
    │   └── issues.md
    └── {plan-id}/              # Plan-scoped wisdom
        ├── learnings.md
        ├── decisions.md
        └── issues.md
```

---

## 4. 상태 흐름도

### 4.1 Ralplan Loop 상태 머신

```
                    ┌─────────────────┐
                    │     IDLE        │
                    └────────┬────────┘
                             │ start_planning
                             ▼
                    ┌─────────────────┐
              ┌────▶│ PLANNER_PLANNING│◀────────┐
              │     └────────┬────────┘         │
              │              │ plan_ready       │ REJECT + feedback
              │              ▼                  │
              │     ┌─────────────────┐         │
              │     │  CRITIC_REVIEW  │─────────┘
              │     └────────┬────────┘
              │              │ OKAY
              │              ▼
              │     ┌─────────────────┐
              │     │    COMPLETE     │
              │     └─────────────────┘
              │
              │ max_iterations reached
              │              │
              │              ▼
              │     ┌─────────────────┐
              └─────│ FORCED_APPROVAL │
                    └─────────────────┘
```

### 4.2 Execute Loop 상태 머신 (v2.0)

```
                    ┌─────────────────┐
                    │     IDLE        │
                    └────────┬────────┘
                             │ start_execution
                             ▼
                    ┌─────────────────┐
                    │  LOADING_PLAN   │
                    └────────┬────────┘
                             │ plan_loaded
                             ▼
                    ┌─────────────────┐
              ┌────▶│ SPAWNING_WORKERS│
              │     └────────┬────────┘
              │              │ workers_ready
              │              ▼
              │     ┌─────────────────┐
              │     │   EXECUTING     │◀───────┐
              │     └────────┬────────┘        │
              │              │                 │
              │     ┌────────┴────────┐        │
              │     ▼                 ▼        │
              │ ┌────────┐     ┌──────────┐    │
              │ │DEVIATION│     │TASK_DONE │────┘
              │ │DETECTED │     └──────────┘    more tasks
              │ └────┬───┘
              │      │
              │ ┌────┴────┐
              │ │Level 1  │──▶ Log only
              │ │Level 2  │──▶ Architect approval
              │ │Level 3  │──▶ Plan revision ───┐
              │ └─────────┘                      │
              │                                  │
              └──────────────────────────────────┘
                             │
                             │ all_tasks_complete
                             ▼
                    ┌─────────────────┐
                    │ARCHITECT_VERIFY │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
              ┌──────────┐     ┌──────────┐
              │ APPROVED │     │ REJECTED │
              └────┬─────┘     └────┬─────┘
                   │                │ fix issues
                   ▼                ▼
              ┌──────────┐     ┌──────────┐
              │ COMPLETE │     │  RETRY   │
              └──────────┘     └────┬─────┘
                                    │
                                    ▼
                              (back to EXECUTING)
```

### 4.3 Swarm 패턴 흐름 (순정 Task API)

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR (Main)                           │
├─────────────────────────────────────────────────────────────────┤
│ 1. Parse PLAN.md                                                 │
│ 2. For each task: TaskCreate({ subject, description })          │
│ 3. Build dependency map: TaskUpdate({ addBlockedBy: [...] })    │
│ 4. Spawn workers: Task({ run_in_background: true })             │
│ 5. Monitor: TaskList() → check completion                        │
│ 6. Verify: Task({ subagent: "architect" })                      │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   Worker 1       │ │   Worker 2       │ │   Worker N       │
├──────────────────┤ ├──────────────────┤ ├──────────────────┤
│ Loop:            │ │ Loop:            │ │ Loop:            │
│ 1. TaskList()    │ │ 1. TaskList()    │ │ 1. TaskList()    │
│ 2. Find pending  │ │ 2. Find pending  │ │ 2. Find pending  │
│    (no owner,    │ │    (no owner,    │ │    (no owner,    │
│    unblocked)    │ │    unblocked)    │ │    unblocked)    │
│ 3. TaskUpdate    │ │ 3. TaskUpdate    │ │ 3. TaskUpdate    │
│    (owner: me)   │ │    (owner: me)   │ │    (owner: me)   │
│ 4. Execute task  │ │ 4. Execute task  │ │ 4. Execute task  │
│ 5. TaskUpdate    │ │ 5. TaskUpdate    │ │ 5. TaskUpdate    │
│    (completed)   │ │    (completed)   │ │    (completed)   │
│ 6. Repeat        │ │ 6. Repeat        │ │ 6. Repeat        │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

---

## 5. 인터페이스 계약 (Agent Contract)

### 5.1 Planner → Critic

```yaml
# Input to Critic
plan_path: string          # Path to PLAN.md
iteration: number          # Current Ralplan iteration
previous_feedback: string? # Feedback from last rejection

# Output from Critic
verdict: "OKAY" | "REJECT"
checklist:
  goals_aligned: boolean
  tasks_atomic: boolean
  dependencies_clear: boolean
  verifiable: boolean
  wave_structure: boolean
pass_percentage: number
justification: string
improvements: string[]?
```

### 5.2 Executor → Architect

```yaml
# Input to Architect
task_id: string
files_modified: string[]
commit_hash: string?
test_results:
  passed: number
  failed: number
  skipped: number

# Output from Architect
verdict: "APPROVED" | "REJECTED" | "NEEDS_REVISION"
checklist:
  code_compiles: boolean
  tests_pass: boolean
  requirements_met: boolean
  no_regressions: boolean
  code_quality: boolean
pass_percentage: number
issues: string[]?
suggestions: string[]?
```

### 5.3 Orchestrator → Worker

```yaml
# Worker Prompt Template
role: "Executor Worker"
instructions:
  - TaskList() to find available tasks
  - Filter: status=pending, owner=null, blockedBy=[]
  - TaskUpdate({ taskId, owner: agentName, status: "in_progress" })
  - Execute the task (read files, write code)
  - TaskUpdate({ taskId, status: "completed" })
  - Repeat until no tasks available

constraints:
  - ONE task at a time
  - Atomic commits per task
  - Report errors immediately
  - No task skipping

termination:
  - No pending tasks for 2 minutes → exit
```

---

## 6. 설정 파일 구조

### 6.1 `.ultraplan/config.json`

```json
{
  "version": "2.0.0",
  "mode": "interactive",
  "depth": "standard",
  "parallelization": true,
  "max_workers": 5,
  "commit_docs": true,
  "model_profile": "balanced",

  "complexity": {
    "enabled": true,
    "default_level": 3,
    "model_mapping": {
      "1": "haiku",
      "2": "haiku",
      "3": "sonnet",
      "4": "sonnet",
      "5": "opus"
    }
  },

  "ralplan": {
    "max_iterations": 5,
    "consult_architect_on_reject": true,
    "checklist_pass_threshold": 0.8
  },

  "execution": {
    "deviation_levels": {
      "1": "log_only",
      "2": "architect_approval",
      "3": "plan_revision"
    },
    "auto_retry_count": 3,
    "architect_leniency": 0.8
  },

  "session": {
    "isolation_enabled": true,
    "context_to_pass": "plan_only",
    "timeout_ms": 300000
  }
}
```

---

## 7. 다음 단계

### Phase 1 완료 조건
- [x] 전체 디렉토리 구조 확정
- [ ] schemas/ 폴더 생성
- [ ] 각 스키마 파일 작성
- [ ] 상태 흐름도 완성
- [ ] 아키텍처 문서 완성

### Phase 2로 진행
- Task Complexity 구현
- Agent Interface Contract 구현
- Ralplan 체크리스트 구현

---

*Last updated: 2026-01-31*
