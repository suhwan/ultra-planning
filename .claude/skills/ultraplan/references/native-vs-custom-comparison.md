# Claude 순정 기능 vs Ultra Planner 커스텀 구현 비교

각 기능별로 순정 기능과 커스텀 구현의 장단점을 객관적으로 비교합니다.

---

## 1. Task 등록 및 관리

### Claude Tasks API (순정)

```javascript
TaskCreate({
  subject: "Implement auth",
  description: "Add JWT authentication",
  activeForm: "Implementing auth...",
  metadata: { wave: 1, files: ["src/auth.ts"] }
})

TaskUpdate({ taskId: "1", status: "completed" })
TaskList()
```

### MCP generate_task_creates (커스텀)

```javascript
// MCP 도구 호출
mcp__ultra-planner__generate_task_creates({ path: "01-01-PLAN.md" })
// → TaskCreate 구조체 배열 반환
// → Orchestrator가 순회하며 TaskCreate 호출
```

### 비교

| 항목 | Claude Tasks API | MCP 커스텀 |
|------|------------------|------------|
| **호출 단계** | 1단계 (직접) | 2단계 (MCP → 반복) |
| **지연 시간** | 낮음 | MCP 오버헤드 있음 |
| **의존성 관리** | ✅ addBlockedBy 내장 | 별도 구현 필요 |
| **실시간 상태** | ✅ TaskList로 즉시 | 파일 읽기 필요 |
| **세션 영속성** | ❌ 세션 종료 시 사라짐 | ✅ 파일로 영속 |
| **커스텀 필드** | metadata로 제한적 | 자유로운 확장 |
| **IDE 통합** | ✅ Claude UI에 표시 | ❌ 별도 표시 필요 |

### 결론

| 사용 사례 | 권장 |
|----------|------|
| 단일 세션 실행 | ⭐ **Claude Tasks** - 직접적, 빠름 |
| 세션 간 영속성 필요 | ⭐ **커스텀** - 파일 기반 |
| IDE에서 진행 상황 보기 | ⭐ **Claude Tasks** - 내장 UI |
| 복잡한 메타데이터 | ⭐ **커스텀** - 자유로운 확장 |

**통합 권장:** Claude Tasks를 주로 사용하되, PLAN.md에 주기적 백업

---

## 2. 의존성 관리

### Claude Tasks addBlockedBy (순정)

```javascript
// Wave 2 태스크가 Wave 1에 의존
TaskUpdate({ taskId: "3", addBlockedBy: ["1", "2"] })

// Wave 1 완료 → Wave 2 자동 언블록
TaskUpdate({ taskId: "1", status: "completed" })
TaskUpdate({ taskId: "2", status: "completed" })
// → taskId "3"이 자동으로 실행 가능해짐
```

### MCP build_dependency_map (커스텀)

```javascript
// MCP 도구로 의존성 맵 생성
const depMap = mcp__ultra-planner__build_dependency_map({ path: "..." })
// → { "3": ["1", "2"], "4": ["1", "2"], ... }

// Orchestrator가 직접 관리
for (const task of queue) {
  if (allDependenciesCompleted(task, depMap)) {
    execute(task);
  }
}
```

### 비교

| 항목 | Claude Tasks | MCP 커스텀 |
|------|--------------|------------|
| **자동 언블록** | ✅ 내장 | ❌ 수동 체크 필요 |
| **순환 감지** | ✅ 내장 (추정) | 별도 구현 필요 |
| **복잡한 의존성** | 제한적 (blockedBy만) | 유연 (needs/creates) |
| **시각화** | ✅ Claude UI | ❌ 별도 도구 |
| **디버깅** | TaskList로 확인 | 로그 분석 필요 |

### 결론

| 사용 사례 | 권장 |
|----------|------|
| 단순 Wave 의존성 | ⭐ **Claude Tasks** - 자동 관리 |
| 파일 기반 의존성 (needs X creates Y) | ⭐ **커스텀** - 더 정밀 |
| 대규모 태스크 (100+) | **테스트 필요** - 성능 미확인 |

---

## 3. 병렬 실행

### TeammateTool Swarm (순정)

```javascript
// 팀 생성
Teammate({ operation: "spawnTeam", team_name: "executors" })

// 5워커 스폰
for (let i = 1; i <= 5; i++) {
  Task({
    team_name: "executors",
    name: `worker-${i}`,
    subagent_type: "general-purpose",
    prompt: "Claim and execute tasks...",
    run_in_background: true
  })
}

// 메시지 기반 조정
Teammate({ operation: "write", target_agent_id: "worker-1", value: "..." })
```

### Custom Ultrapilot (커스텀)

```typescript
// src/orchestration/ultrapilot/coordinator.ts
class UltrapilotCoordinator {
  workers: Worker[] = [];

  async spawnWorker(id: string) {
    const worker = await Task({
      subagent_type: "ultraplan-executor",
      run_in_background: true,
      prompt: "..."
    });
    this.workers.push(worker);
  }

  async assignTask(workerId: string, task: Task) {
    // 파일 소유권 관리
    this.ownership[workerId] = task.files;
  }
}
```

### 비교

| 항목 | TeammateTool | Ultrapilot 커스텀 |
|------|--------------|-------------------|
| **스폰 방식** | 내장 API | 커스텀 래퍼 |
| **통신** | Inbox JSON 파일 | 파일 기반 (유사) |
| **파일 소유권** | ❌ 없음 | ✅ 충돌 방지 |
| **Heartbeat** | ✅ 5분 타임아웃 | 별도 구현 필요 |
| **크래시 복구** | ✅ 자동 감지 | 별도 구현 필요 |
| **디버깅** | tmux/iterm 백엔드 | 로그 파일 |
| **최대 워커** | 제한 미확인 | 5개 (설정) |

### 결론

| 사용 사례 | 권장 |
|----------|------|
| 빠른 병렬 실행 | ⭐ **TeammateTool** - 내장 기능 |
| 파일 충돌 방지 필요 | ⭐ **커스텀** - 소유권 관리 |
| 디버깅/모니터링 | ⭐ **TeammateTool** - tmux 백엔드 |
| 복잡한 워크플로우 | **하이브리드** - 둘 다 사용 |

**권장:** TeammateTool 기반 + 파일 소유권 로직 추가

---

## 4. 상태 관리

### Claude Tasks Status (순정)

```javascript
// 실시간 상태
TaskList()
// → [{ id: "1", status: "completed" }, { id: "2", status: "in_progress" }, ...]

TaskUpdate({ taskId: "2", status: "completed" })
```

### MCP State Manager (커스텀)

```typescript
// src/state/state-manager.ts
class StateManager<T> {
  async read(): Promise<T> {
    return JSON.parse(await readFile(this.path));
  }

  async write(state: T): Promise<void> {
    // Atomic write: .tmp → rename
    await writeFile(this.path + '.tmp', JSON.stringify(state));
    await rename(this.path + '.tmp', this.path);
  }
}

// PLAN.md frontmatter
task_states:
  "01-01-01": done
  "01-01-02": executing
```

### 비교

| 항목 | Claude Tasks | StateManager 커스텀 |
|------|--------------|---------------------|
| **영속성** | ❌ 세션 한정 | ✅ 파일 영속 |
| **Atomic 쓰기** | 내부 (추정) | ✅ .tmp + rename |
| **다중 세션** | ❌ 불가 | ✅ 파일 공유 |
| **충돌 해결** | ❌ 없음 | 별도 구현 필요 |
| **사람 가독성** | ❌ API 전용 | ✅ JSON/YAML |
| **버전 관리** | ❌ | ✅ git 추적 가능 |
| **실시간 UI** | ✅ Claude에 표시 | ❌ |

### 결론

| 사용 사례 | 권장 |
|----------|------|
| 단일 세션 진행 | ⭐ **Claude Tasks** - 실시간 UI |
| 세션 재개 필요 | ⭐ **커스텀** - 파일 영속 |
| Git 히스토리 추적 | ⭐ **커스텀** - 버전 관리 |
| 팀 협업 | ⭐ **커스텀** - 파일 공유 |

**권장:** Claude Tasks (실시간) + 커스텀 (백업/영속)

---

## 5. Agent 프롬프트

### Claude 내장 Agent Types (순정)

```javascript
Task({
  subagent_type: "Explore",  // 내장
  description: "Find auth files",
  prompt: "Locate authentication-related files",
  model: "haiku"
})
```

**내장 타입:**
- `Bash` - 명령어 실행
- `Explore` - 코드베이스 탐색 (읽기 전용)
- `Plan` - 아키텍처/전략 (읽기 전용)
- `general-purpose` - 모든 도구

### Custom ultraplan-* Agents (커스텀)

```javascript
Task({
  subagent_type: "ultraplan-executor",  // 커스텀
  model: "sonnet",
  prompt: "Execute task..."
})
```

**커스텀 정의:** `.claude/agents/ultraplan-executor.md`

### 비교

| 항목 | Claude 내장 | 커스텀 Agent |
|------|-------------|--------------|
| **프롬프트 제어** | 제한적 | ✅ 완전 제어 |
| **도구 접근** | 타입별 고정 | 자유 설정 |
| **출력 포맷** | 일반적 | ✅ 특정 포맷 강제 |
| **도메인 지식** | 없음 | ✅ 프로젝트 특화 |
| **유지보수** | ❌ Anthropic 의존 | ✅ 직접 관리 |
| **업데이트** | 자동 (변경 가능) | 명시적 버전 관리 |

### 결론

| 사용 사례 | 권장 |
|----------|------|
| 일반 탐색/검색 | ⭐ **Explore 내장** - 최적화됨 |
| 특정 출력 포맷 | ⭐ **커스텀** - XML task 등 |
| 도메인 특화 로직 | ⭐ **커스텀** - 프로젝트 규칙 |
| 빠른 프로토타입 | ⭐ **내장** - 설정 불필요 |

---

## 6. Ralplan 합의 루프

### TeammateTool 병렬 (순정 활용)

```javascript
// Architect + Critic 동시 스폰
Teammate({ operation: "spawnTeam", team_name: "ralplan" })

Task({
  team_name: "ralplan",
  name: "architect",
  subagent_type: "ultraplan-architect",
  prompt: "Review plans...",
  run_in_background: true
})

Task({
  team_name: "ralplan",
  name: "critic",
  subagent_type: "ultraplan-critic",
  prompt: "Challenge assumptions...",
  run_in_background: true
})

// 결과 수집
const inbox = readInbox("team-lead");
// → Architect, Critic 결과 동시 수신
```

### 순차 Task (현재 커스텀)

```typescript
// src/orchestration/ralplan/orchestrator.ts
while (iteration < MAX) {
  // 순차 호출
  const architectResult = await Task(architect);
  if (!approved) { await Task(planner, feedback); continue; }

  const criticResult = await Task(critic);
  if (!satisfied) { await Task(planner, feedback); continue; }

  break;  // 합의 도달
}
```

### 비교

| 항목 | TeammateTool 병렬 | 순차 Task |
|------|-------------------|-----------|
| **실행 시간** | ✅ ~50% 단축 | 순차적 |
| **복잡도** | 높음 (Inbox 관리) | 낮음 |
| **디버깅** | 어려움 (비동기) | 쉬움 (순차) |
| **에러 처리** | 복잡 | 단순 |
| **결과 병합** | 수동 필요 | 자연스러움 |

### 결론

| 사용 사례 | 권장 |
|----------|------|
| MVP (속도 중요) | ⭐ **TeammateTool** - 병렬화 |
| Detailed (품질 중요) | ⭐ **순차** - 명확한 피드백 루프 |
| 디버깅 필요 | ⭐ **순차** - 추적 용이 |

---

## 종합 비교표

| 기능 | 순정 우위 | 커스텀 우위 | 권장 |
|------|----------|------------|------|
| Task 등록 | ✅ 직접적, UI 통합 | 영속성 | 순정 + 백업 |
| 의존성 | ✅ 자동 언블록 | 복잡한 의존성 | 순정 (단순), 커스텀 (복잡) |
| 병렬 실행 | ✅ 내장 Swarm | 파일 소유권 | 순정 + 소유권 로직 |
| 상태 관리 | ✅ 실시간 UI | ✅ 영속성, Git | 하이브리드 |
| Agent | 최적화된 내장 | ✅ 도메인 특화 | 커스텀 유지 |
| Ralplan | 병렬 가능 | ✅ 명확한 루프 | 선택적 (MVP/Detailed) |

---

## 최종 권장 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                     Hybrid Architecture                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Claude Native (순정)                                    │    │
│  │   • Claude Tasks API - 태스크 등록/상태/의존성           │    │
│  │   • TeammateTool - 병렬 실행 (MVP 모드)                  │    │
│  │   • Explore Agent - 일반 탐색                            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                               │                                  │
│                               ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Ultra Planner Custom (커스텀)                            │    │
│  │   • MCP parse_plan - XML 파싱                            │    │
│  │   • ultraplan-* agents - 도메인 특화 프롬프트             │    │
│  │   • Notepad 시스템 - 학습 축적                           │    │
│  │   • Git commit - Atomic commit                           │    │
│  │   • File ownership - 충돌 방지                           │    │
│  │   • PLAN.md/STATE.md - 영속성/Git 추적                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                               │                                  │
│                               ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Mode-Based Selection                                     │    │
│  │                                                         │    │
│  │   MVP Mode:                                              │    │
│  │     • TeammateTool Swarm ✅                              │    │
│  │     • Claude Tasks ✅                                    │    │
│  │     • Ralplan 병렬 ✅                                    │    │
│  │                                                         │    │
│  │   Detailed Mode:                                         │    │
│  │     • 순차 Task 실행                                     │    │
│  │     • 커스텀 상태 관리                                    │    │
│  │     • Ralplan 순차 (명확한 피드백)                        │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 검증 필요 사항

실제 통합 전 다음 항목 테스트 필요:

| 항목 | 테스트 방법 | 기준 |
|------|------------|------|
| Claude Tasks 대규모 성능 | 100개 태스크 등록 | < 5초 |
| TeammateTool 안정성 | 5워커 30분 실행 | 크래시 0회 |
| Inbox 메시지 지연 | 메시지 왕복 시간 | < 500ms |
| 순정 vs 커스텀 속도 | 동일 워크플로우 비교 | 측정 |
| 하이브리드 복잡도 | 디버깅 시간 | 수용 가능 |

---
*Last updated: 2026-01-30*
*Status: 비교 분석 완료, 실제 벤치마크 필요*
