---
name: ultraplan:all-plan
description: End-to-end planning and execution from user plan file. MVP or Detailed mode. Zero intervention until complete.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task, Teammate, TaskCreate, TaskUpdate, TaskList, AskUserQuestion
---

# /ultraplan:all-plan

사용자 계획 파일을 읽고, MVP 또는 Detailed 모드로 처음부터 끝까지 자동 실행합니다.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  /ultraplan:all-plan [plan-file]                                            │
│                                                                             │
│  1. READ USER PLAN — 사용자 계획 파일 읽기                                   │
│  2. ASK MODE — "MVP or Detailed?"                                           │
│  3. AUTO-EXECUTE — new-project → plan-phases → execute-all → complete       │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Usage

```bash
/ultraplan:all-plan                      # 현재 디렉토리에서 plan 파일 찾기
/ultraplan:all-plan my-idea.md           # 특정 파일 지정
/ultraplan:all-plan --mvp                # MVP 모드 바로 시작
/ultraplan:all-plan --detailed           # Detailed 모드 바로 시작
```

## Behavior

### Step 1: Find and Read User Plan File

사용자가 작성한 계획/아이디어 파일을 찾습니다.

**자동 탐색 순서:**
```bash
# 1. 인자로 전달된 파일
# 2. 일반적인 계획 파일명
ls -la PLAN.md plan.md idea.md project-idea.md requirements.md PRD.md 2>/dev/null | head -1

# 3. .planning 디렉토리
ls -la .planning/USER-PLAN.md .planning/idea.md 2>/dev/null | head -1
```

**파일이 없는 경우:**
```
No plan file found. Please provide your project idea:

Options:
1. Create a plan file (recommended): echo "Build a REST API for..." > plan.md
2. Describe your project now (I'll create the file for you)
```

### Step 2: Ask Mode (MVP or Detailed)

```javascript
AskUserQuestion({
  questions: [{
    question: "어떤 모드로 진행할까요?",
    header: "Mode",
    options: [
      {
        label: "MVP (Recommended)",
        description: "최소 질문, 빠른 실행. 핵심 기능만 구현. 대부분 자동 결정."
      },
      {
        label: "Detailed",
        description: "상세 인터뷰, 완전한 기능. 각 단계마다 확인. 프로덕션 품질."
      }
    ],
    multiSelect: false
  }]
})
```

### Step 3: Mode-Specific Execution

#### MVP Mode (`--mvp`)

**원칙:**
- 질문 최소화 (0-2개만)
- 자동 결정 우선
- 핵심 기능만 (nice-to-have 제외)
- 검증 간소화 (Ralplan 1회만)
- 에러 시 자동 재시도 + 스킵

**자동 결정 규칙:**
| 상황 | 자동 결정 |
|------|-----------|
| 기술 스택 선택 | 프로젝트에 이미 있는 것 사용 |
| 라이브러리 선택 | 가장 인기 있는 것 선택 |
| 아키텍처 패턴 | 단순한 것 선택 |
| Phase 수 | 최소 (3-4개) |
| Task 단위 | 크게 (30-60분) |

**MVP 실행 흐름:**
```
1. /ultraplan:new-project --mvp
   └─ Research: 건너뛰기 또는 5분 제한
   └─ Interview: 0-2개 핵심 질문만
   └─ Ralplan: 1회만 (강제 승인)

2. /ultraplan:plan-phase ALL --mvp
   └─ 모든 Phase 한 번에 계획
   └─ Research: 건너뛰기
   └─ 상세 계획 대신 개요 수준

3. /ultraplan:execute-all --mvp
   └─ TeammateTool로 Swarm 생성
   └─ 5워커 병렬 실행
   └─ Architect 검증: 1회만
   └─ 에러 시: 3회 재시도 후 스킵

4. COMPLETE
   └─ 요약 출력
   └─ 다음 단계 제안 (Detailed로 개선)
```

#### Detailed Mode (`--detailed`)

**원칙:**
- 충분한 인터뷰 (5-7개 질문)
- 사용자 확인 우선
- 전체 기능 구현
- 철저한 검증 (Ralplan 5회까지)
- 에러 시 사용자 결정

**Detailed 실행 흐름:**
```
1. /ultraplan:new-project
   └─ Research: 전체 (도메인 + 기술)
   └─ Interview: 5-7개 질문
   └─ Ralplan: 합의까지 (최대 5회)

2. /ultraplan:plan-phase 1, 2, 3, ...
   └─ Phase별 순차 계획
   └─ 각 Phase Research 포함
   └─ 상세 Task 분해 (15-30분 단위)

3. /ultraplan:execute {각 plan}
   └─ 순차 실행
   └─ Architect 검증: 철저히
   └─ 에러 시: 사용자 확인

4. COMPLETE
   └─ 상세 요약
   └─ 배포 가이드 포함
```

### Step 4: Swarm-Based Execution (MVP Mode)

MVP 모드에서는 Claude의 새 TeammateTool을 활용합니다.

```javascript
// 1. 팀 생성
Teammate({
  operation: "spawnTeam",
  team_name: "ultraplan-execution"
})

// 2. 모든 Phase의 Task를 Claude Tasks에 등록
for (const plan of allPlans) {
  const tasks = parsePlanTasks(plan);
  for (const task of tasks) {
    TaskCreate({
      subject: task.name,
      description: task.action,
      metadata: {
        planFile: plan.path,
        wave: task.wave,
        phase: plan.phase
      }
    });
  }
}

// 3. Wave 기반 의존성 설정
const waves = groupByWave(allTasks);
for (let w = 1; w < waves.length; w++) {
  const blockers = waves.slice(0, w).flat().map(t => t.id);
  for (const task of waves[w]) {
    TaskUpdate({ taskId: task.id, addBlockedBy: blockers });
  }
}

// 4. Executor Swarm 스폰 (5워커)
for (let i = 1; i <= 5; i++) {
  Task({
    team_name: "ultraplan-execution",
    name: `executor-${i}`,
    subagent_type: "ultraplan-executor",
    model: "sonnet",
    prompt: EXECUTOR_SWARM_PROMPT,
    run_in_background: true
  });
}

// 5. Architect Monitor 스폰 (1워커)
Task({
  team_name: "ultraplan-execution",
  name: "architect-monitor",
  subagent_type: "ultraplan-architect",
  model: "opus",
  prompt: ARCHITECT_MONITOR_PROMPT,
  run_in_background: true
});

// 6. Coordinator Loop (team-lead)
while (pendingTasks > 0) {
  // Check inbox for completed/failed tasks
  // Update progress
  // Handle failures
  await sleep(5000);
}

// 7. Cleanup
Teammate({ operation: "requestShutdown", target_agent_id: "executor-1" });
// ... shutdown all
Teammate({ operation: "cleanup" });
```

**Executor Swarm Prompt:**
```markdown
You are an Executor in the UltraPlan Swarm.

## Your Loop
1. TaskList() - 사용 가능한 태스크 확인
2. Find pending task with no owner and no blockers
3. TaskUpdate({ taskId, owner: "$CLAUDE_CODE_AGENT_NAME", status: "in_progress" })
4. Execute the task (read files, write code, run commands)
5. On success: TaskUpdate({ taskId, status: "completed" })
6. Send result to team-lead: Teammate({ operation: "write", target_agent_id: "team-lead", value: "..." })
7. Repeat until no tasks remain
8. When idle 2+ minutes with no tasks: request shutdown

## Rules
- ONE task at a time
- Atomic commits per task
- Report errors immediately
- Never skip verification step from task
```

**Architect Monitor Prompt:**
```markdown
You are the Architect Monitor in the UltraPlan Swarm.

## Your Loop
1. Watch team-lead inbox for completed task notifications
2. For each completion:
   - Read the changed files
   - Verify against task.done criteria
   - If APPROVED: Send confirmation to team-lead
   - If REJECTED: Send rejection with issues to team-lead
3. Track quality metrics
4. Repeat until all tasks verified

## Rules
- Verify within 2 minutes of completion
- Be thorough but fast
- In MVP mode: Be lenient (80% good enough = APPROVED)
```

### Step 5: Progress Display

실행 중 진행 상황을 실시간으로 표시합니다.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ULTRAPLAN ► ALL-PLAN [MVP Mode]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Stage: EXECUTION (3/4)
Progress: [████████▓░] 85% (17/20 tasks)

Active Workers:
  executor-1: Task 18 - Add user validation ⏳
  executor-2: Task 19 - Create API routes ⏳
  executor-3: idle (waiting for tasks)
  executor-4: idle (waiting for tasks)
  executor-5: Task 20 - Write tests ⏳
  architect-monitor: Verifying Task 17 ⏳

Recent Activity:
  ✓ Task 16: Create database schema (executor-1, 45s)
  ✓ Task 17: Add migration files (executor-2, 32s)
  ⏳ Task 18: Add user validation (executor-1, 28s...)

Errors: 0 | Retries: 2 | Skipped: 0
───────────────────────────────────────────────────────
```

### Step 6: Completion Summary

모든 작업 완료 후 요약을 출력합니다.

```markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ULTRAPLAN ► COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Project:** Task Manager API
**Mode:** MVP
**Total Time:** 12m 34s

## Phases Completed
  [x] Phase 1: Core Models (4 tasks, 2m 15s)
  [x] Phase 2: Database Layer (5 tasks, 3m 42s)
  [x] Phase 3: API Endpoints (6 tasks, 4m 18s)
  [x] Phase 4: Basic Auth (5 tasks, 2m 19s)

## Statistics
  - Tasks: 20/20 completed
  - Commits: 20 atomic commits
  - Files Modified: 34
  - Lines Added: 1,247
  - Workers Used: 5 Executors + 1 Architect

## Generated Files
  - src/models/*.ts (4 files)
  - src/routes/*.ts (3 files)
  - src/middleware/*.ts (2 files)
  - tests/*.test.ts (5 files)

## Next Steps

**Option 1: Test the MVP**
  npm run dev
  curl http://localhost:3000/api/tasks

**Option 2: Enhance with Detailed Mode**
  /ultraplan:all-plan --detailed
  (Adds: advanced auth, caching, rate limiting, full tests)

**Option 3: Deploy**
  /ultraplan:deploy (coming soon)

───────────────────────────────────────────────────────
```

## Error Handling

### MVP Mode Errors

| Error | Handling |
|-------|----------|
| Task failed 3x | Auto-skip + warn |
| Worker crashed | Auto-respawn |
| Architect rejected 3x | Force approve + warn |
| All workers stuck | Coordinator intervenes |

### Detailed Mode Errors

| Error | Handling |
|-------|----------|
| Task failed 3x | Ask user: retry/skip/abort |
| Worker crashed | Ask user: respawn/continue |
| Architect rejected 3x | Ask user: force/fix/abort |

## Configuration

`.ultraplan/config.json`:

```json
{
  "allPlan": {
    "defaultMode": "mvp",
    "mvp": {
      "maxQuestions": 2,
      "ralplanIterations": 1,
      "executorCount": 5,
      "autoSkipAfterRetries": 3,
      "architectLeniency": 0.8
    },
    "detailed": {
      "maxQuestions": 7,
      "ralplanIterations": 5,
      "executorCount": 3,
      "autoSkipAfterRetries": 0,
      "architectLeniency": 0.95
    }
  }
}
```

## Integration with Claude Tasks + TeammateTool

이 명령어는 Claude의 새로운 기능을 적극 활용합니다:

### Claude Tasks API
- `TaskCreate`: Phase/Plan의 모든 태스크 등록
- `TaskUpdate`: 상태 변경 + 의존성 설정
- `TaskList`: 진행 상황 모니터링

### TeammateTool
- `spawnTeam`: Executor Swarm 팀 생성
- `Task` (with team): 백그라운드 워커 스폰
- `Teammate.write`: 팀원 간 통신
- `requestShutdown` + `cleanup`: 정리

### Benefits
1. **병렬 실행**: 5워커가 동시에 태스크 처리
2. **자동 의존성**: Wave 기반 blockedBy가 자동 언블록
3. **실시간 모니터링**: TaskList로 진행 상황 확인
4. **견고한 조정**: Inbox 기반 메시지로 상태 동기화

## Related Commands

| Command | Purpose |
|---------|---------|
| `/ultraplan:new-project` | 프로젝트 초기화만 |
| `/ultraplan:plan-phase N` | 특정 Phase 계획만 |
| `/ultraplan:execute PLAN` | 특정 Plan 실행만 |
| `/ultraplan:status` | 현재 상태 확인 |
| `/ultraplan:all-plan` | **처음부터 끝까지 전체 자동화** |

## Examples

### Example 1: Quick MVP

```bash
# plan.md 작성
echo "Build a todo list API with:
- CRUD for tasks
- User authentication
- PostgreSQL database" > plan.md

# 실행
/ultraplan:all-plan --mvp

# 결과: 10-15분 후 동작하는 MVP 완성
```

### Example 2: Full Project

```bash
# 상세 요구사항 파일
cat > requirements.md << 'EOF'
# E-Commerce Platform

## Core Features
- Product catalog with categories
- Shopping cart
- Order management
- Payment integration (Stripe)
- User accounts with OAuth

## Technical Requirements
- TypeScript + Node.js
- PostgreSQL + Redis
- REST API + WebSocket for real-time
- 80%+ test coverage
EOF

# Detailed 모드로 실행
/ultraplan:all-plan requirements.md --detailed

# 결과: 인터뷰 후 완전한 프로덕션 앱 완성
```

---
*Ultra Planner v2.0.0 - Claude Tasks + TeammateTool Integration*
