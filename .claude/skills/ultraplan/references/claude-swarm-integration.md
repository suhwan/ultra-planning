# Claude Tasks + TeammateTool Integration

Ultra Planner가 Claude의 새로운 Multi-Agent 기능을 활용하는 방법을 설명합니다.

## Claude의 새 기능 (2026년 1월 기준)

### 1. Claude Tasks API

세션 내에서 태스크를 관리하는 내장 도구입니다.

```javascript
// 태스크 생성
TaskCreate({
  subject: "Implement user authentication",
  description: "Add JWT-based auth to the API",
  activeForm: "Implementing auth...",  // 실행 중 표시될 문구
  metadata: {
    planFile: "01-01-PLAN.md",
    wave: 1,
    files: ["src/auth/jwt.ts"]
  }
})

// 태스크 목록 조회
TaskList()  // → 모든 태스크의 상태, 소유자, 차단 관계

// 태스크 업데이트
TaskUpdate({
  taskId: "1",
  status: "in_progress",  // pending → in_progress → completed
  owner: "executor-1",
  addBlockedBy: ["2", "3"]  // 의존성 추가
})

// 태스크 조회
TaskGet({ taskId: "1" })  // → 전체 상세 정보
```

**핵심 특징:**
- 의존성 기반 자동 언블록: Task 2 완료 → Task 3 자동 언블록
- 소유권 관리: 여러 워커가 경쟁적으로 클레임
- 메타데이터: Plan 파일, Wave, 파일 목록 등 저장

### 2. TeammateTool (Agent Swarm)

팀 기반 멀티-에이전트 조정 시스템입니다.

```javascript
// 팀 생성
Teammate({
  operation: "spawnTeam",
  team_name: "ultraplan-execution",
  description: "UltraPlan execution swarm"
})

// 팀원 스폰 (백그라운드 실행)
Task({
  team_name: "ultraplan-execution",
  name: "executor-1",
  subagent_type: "general-purpose",
  prompt: "Execute tasks from the queue...",
  run_in_background: true
})

// 팀원에게 메시지 전송
Teammate({
  operation: "write",
  target_agent_id: "executor-1",
  value: "Prioritize auth tasks"
})

// 브로드캐스트 (모든 팀원에게)
Teammate({
  operation: "broadcast",
  name: "team-lead",
  value: "Status report requested"
})

// 종료 요청
Teammate({
  operation: "requestShutdown",
  target_agent_id: "executor-1",
  reason: "All tasks complete"
})

// 정리
Teammate({ operation: "cleanup" })
```

**파일 구조:**
```
~/.claude/teams/{team-name}/
├── config.json              # 팀 메타데이터 + 멤버 목록
└── inboxes/
    ├── team-lead.json       # 리더 받은 메시지
    ├── executor-1.json
    └── executor-2.json

~/.claude/tasks/{team-name}/
├── 1.json                   # Task #1 상태
└── 2.json
```

### 3. Spawn Backends

팀원이 실행되는 환경을 선택할 수 있습니다.

| Backend | 특징 | 사용 시점 |
|---------|------|----------|
| `in-process` | 같은 프로세스 내 async 실행 | 기본값 |
| `tmux` | 별도 tmux pane | 디버깅/모니터링 필요시 |
| `iterm2` | macOS iTerm2 split pane | macOS 개발 |

```bash
# 강제 지정
export CLAUDE_CODE_SPAWN_BACKEND=tmux
```

## UltraPlan에서의 활용

### Wave → blockedBy 매핑

PLAN.md의 Wave 시스템을 Claude Tasks의 blockedBy로 변환합니다.

```typescript
// src/sync/dependency-map.ts
function buildDependencyMap(tasks: TaskMapping[]): Record<string, string[]> {
  const waves = groupByWave(tasks);
  const depMap: Record<string, string[]> = {};

  for (const task of tasks) {
    if (task.wave === 1) {
      depMap[task.id] = [];  // Wave 1: 의존성 없음
    } else {
      // Wave N: Wave 1..N-1의 모든 태스크에 의존
      depMap[task.id] = waves
        .slice(0, task.wave - 1)
        .flat()
        .map(t => t.claudeTaskId);
    }
  }

  return depMap;
}
```

### Swarm Execution Pattern

MVP 모드에서 5 Executor + 1 Architect 패턴을 사용합니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                     ULTRAPLAN SWARM                              │
│                                                                  │
│  ┌──────────┐                                                    │
│  │team-lead │ (Coordinator)                                      │
│  │(Opus)    │                                                    │
│  └────┬─────┘                                                    │
│       │                                                          │
│       ├──────────────────────────────────────────────────┐       │
│       │                                                  │       │
│  ┌────▼────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │executor-1│ │executor-2│ │executor-3│ │executor-4│ │executor-5│ │
│  │(Sonnet) │ │(Sonnet) │ │(Sonnet) │ │(Sonnet) │ │(Sonnet) │   │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘   │
│       │           │           │           │           │         │
│       └───────────┴───────────┴───────────┴───────────┘         │
│                               │                                  │
│                         ┌─────▼─────┐                            │
│                         │ architect │                            │
│                         │ (Opus)    │                            │
│                         └───────────┘                            │
│                                                                  │
│  Communication: Inbox JSON files                                 │
│  Task Queue: Claude Tasks API                                    │
└─────────────────────────────────────────────────────────────────┘
```

**역할:**
- **team-lead**: 전체 조정, 진행 상황 모니터링, 에러 핸들링
- **executor-N**: 태스크 클레임 → 실행 → 완료 보고
- **architect**: 완료된 태스크 검증, 품질 게이트

### Executor Loop

각 Executor는 다음 루프를 실행합니다:

```javascript
async function executorLoop() {
  while (true) {
    // 1. 사용 가능한 태스크 찾기
    const tasks = await TaskList();
    const available = tasks.filter(t =>
      t.status === 'pending' &&
      !t.owner &&
      t.blockedBy.every(b => isCompleted(b))
    );

    if (available.length === 0) {
      // 대기 중임을 알림
      await Teammate.write('team-lead', { type: 'idle' });
      await sleep(5000);
      continue;
    }

    // 2. 태스크 클레임
    const task = available[0];
    await TaskUpdate({ taskId: task.id, owner: agentName, status: 'in_progress' });

    // 3. 실행
    try {
      const result = await executeTask(task);
      await TaskUpdate({ taskId: task.id, status: 'completed' });
      await Teammate.write('team-lead', {
        type: 'task_completed',
        taskId: task.id,
        result
      });
    } catch (error) {
      await Teammate.write('team-lead', {
        type: 'task_failed',
        taskId: task.id,
        error: error.message
      });
    }
  }
}
```

### Architect Monitor Loop

```javascript
async function architectLoop() {
  while (true) {
    // 1. 완료 알림 확인
    const messages = await readInbox('architect');
    const completions = messages.filter(m => m.type === 'verify_request');

    for (const msg of completions) {
      const task = await TaskGet({ taskId: msg.taskId });

      // 2. 검증
      const verification = await verifyTask(task, msg.result);

      // 3. 결과 보고
      await Teammate.write('team-lead', {
        type: verification.approved ? 'verified' : 'rejected',
        taskId: task.id,
        issues: verification.issues
      });
    }

    await sleep(3000);
  }
}
```

## 메시지 포맷

### Task Completed
```json
{
  "type": "task_completed",
  "from": "executor-1",
  "taskId": "5",
  "result": {
    "filesModified": ["src/auth/jwt.ts"],
    "linesChanged": 45,
    "testsPassed": true
  },
  "timestamp": "2026-01-30T10:15:00Z"
}
```

### Task Failed
```json
{
  "type": "task_failed",
  "from": "executor-2",
  "taskId": "6",
  "error": "Type error in src/models/user.ts:42",
  "retryCount": 1,
  "timestamp": "2026-01-30T10:16:00Z"
}
```

### Verification Result
```json
{
  "type": "verified",
  "from": "architect",
  "taskId": "5",
  "approved": true,
  "notes": "Implementation follows established patterns",
  "timestamp": "2026-01-30T10:17:00Z"
}
```

### Idle Notification
```json
{
  "type": "idle",
  "from": "executor-3",
  "idleSince": "2026-01-30T10:18:00Z",
  "completedTasks": 4
}
```

## MVP vs Detailed Mode 차이

| 항목 | MVP | Detailed |
|------|-----|----------|
| Executor 수 | 5 | 3 |
| Architect 검증 | Lenient (80%) | Strict (95%) |
| 재시도 후 스킵 | 3회 후 자동 | 사용자 확인 |
| 병렬화 | 최대 | 안전 우선 |
| Wave 처리 | 공격적 오버랩 | 엄격한 순서 |

## 에러 복구

### Executor 크래시

```javascript
// Coordinator가 heartbeat 타임아웃 감지 (5분)
if (isTimedOut(executor)) {
  // 1. 클레임한 태스크 해제
  const claimedTask = findClaimedTask(executor);
  await TaskUpdate({ taskId: claimedTask.id, owner: null, status: 'pending' });

  // 2. 새 Executor 스폰
  await spawnExecutor(executor.name);
}
```

### 전체 데드락

```javascript
// 모든 Executor가 idle이지만 태스크가 남아있을 때
if (allExecutorsIdle() && hasPendingTasks()) {
  // 1. 의존성 체인 분석
  const blockedTasks = findBlockedTasks();

  // 2. 순환 의존성 감지
  if (hasCircularDependency(blockedTasks)) {
    // MVP: 강제 언블록
    await forcUnblock(blockedTasks[0]);
    // Detailed: 사용자 확인
    await askUser("Circular dependency detected. Force unblock?");
  }
}
```

## 참고 자료

- [Anthropic Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Claude Code Swarm Orchestration Skill](https://gist.github.com/kieranklaassen/4f2aba89594a4aea4ad64d753984b2ea)
- [claude-flow](https://github.com/ruvnet/claude-flow) - Community orchestration framework

---
*Last updated: 2026-01-30*
