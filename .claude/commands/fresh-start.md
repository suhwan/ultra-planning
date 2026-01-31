# /fresh-start

새 작업 시작 전 컨텍스트 정리 및 필수 정보 주입.

## 사용법

```bash
/fresh-start              # 상태 저장 + /clear 안내
/fresh-start continue     # /clear 후 컨텍스트 복원
/fresh-start phase N      # 특정 Phase로 시작
/fresh-start plan ID      # 특정 Plan으로 시작 (예: 01-02)
```

## 인자: $ARGUMENTS

## 실행 프로토콜

### Step 1: 인자 파싱

```
ARGS = "$ARGUMENTS"
MODE = "save"  # default

if ARGS contains "continue":
  MODE = "restore"
elif ARGS contains "phase":
  MODE = "restore"
  PHASE = extract_number(ARGS)
elif ARGS contains "plan":
  MODE = "restore"
  PLAN_ID = extract_plan_id(ARGS)
```

### Step 2: Save Mode (기본)

현재 상태를 Notepad에 저장하고 `/clear` 안내:

```
1. TaskList 호출하여 진행 중인 작업 확인

2. 진행 중인 작업이 있다면:
   - mcp__ultra-planner__add_issue(planId, {
       taskId: currentTaskId,
       content: "작업 중단 - fresh start 요청",
       severity: "low",
       status: "open"
     })

3. 현재 Phase/Plan ID 확인:
   - Read: .planning/STATE.md
   - 또는 ROADMAP.md에서 현재 Phase 파싱

4. 안내 메시지 출력:
   ┌─────────────────────────────────────────────┐
   │ Fresh Start - 컨텍스트 정리                  │
   ├─────────────────────────────────────────────┤
   │                                              │
   │ 현재 상태가 Notepad에 저장되었습니다.         │
   │                                              │
   │ 다음 단계:                                   │
   │ 1. /clear 실행                              │
   │ 2. /fresh-start continue 실행               │
   │                                              │
   │ 또는 특정 작업으로 시작:                      │
   │ • /fresh-start phase 2                      │
   │ • /fresh-start plan 01-02                   │
   │                                              │
   └─────────────────────────────────────────────┘
```

### Step 3: Restore Mode

필수 컨텍스트 주입:

```
1. 프로젝트 컨텍스트 로드:
   - Read: .planning/PROJECT.md
     → 프로젝트 이름, 목표, 핵심 요구사항 추출

   - Read: .planning/ROADMAP.md
     → 현재 Phase, 진행률 추출

   - Read: .planning/STATE.md (있으면)
     → 마지막 상태 확인

2. Wisdom 로드 (MCP 사용):
   - mcp__ultra-planner__get_wisdom(planId)

   또는 직접 파일 읽기:
   - Read: .ultraplan/notepads/{planId}/learnings.md
   - Read: .ultraplan/notepads/{planId}/decisions.md
   - Read: .ultraplan/notepads/{planId}/issues.md

3. 현재 PLAN 로드 (특정 plan 지정 시):
   - Read: .planning/phases/{phase}/{plan}-PLAN.md

4. 요약 출력:
   ┌─────────────────────────────────────────────┐
   │ Fresh Start Complete                        │
   ├─────────────────────────────────────────────┤
   │                                              │
   │ Project: {project_name}                     │
   │ Phase: {current_phase} ({progress}%)        │
   │                                              │
   │ Loaded Wisdom:                              │
   │ • Learnings: {count}                        │
   │ • Decisions: {count}                        │
   │ • Issues: {count}                           │
   │                                              │
   │ Next Task: {next_task_id}                   │
   │                                              │
   │ Ready! Run:                                 │
   │ /ultraplan:execute {plan_id}                │
   │                                              │
   └─────────────────────────────────────────────┘
```

## Wisdom 주입 형식

서브에이전트에게 전달할 때 사용하는 형식:

```markdown
## Accumulated Wisdom

### Learnings
- [2024-01-31] Zod 3.23 requires .pipe() for transform chains
- [2024-01-31] Use async/await for all database operations

### Decisions
- [2024-01-31] Use Sonnet for documentation (rationale: quality + speed balance)

### Known Issues
- [2024-01-31] Race condition in parallel writes (workaround: use sequential)

---
When encountering similar patterns, apply these learnings.
Report new discoveries using mcp__ultra-planner__add_learning().
```

## 예시

### 기본 사용

```
User: /fresh-start