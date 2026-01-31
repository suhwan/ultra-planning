---
name: ultraplan:debug
description: Systematic debugging with hypothesis testing and persistent state across sessions.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, WebSearch
---

# /ultraplan:debug

체계적 디버깅 워크플로우. 가설 기반 접근과 세션 간 상태 유지를 지원합니다.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│  /ultraplan:debug                                           │
│                                                             │
│  1. REPRODUCE — 문제 재현 및 증상 기록                       │
│  2. HYPOTHESIZE — 가능한 원인 가설 수립                     │
│  3. TEST — 가설 검증 (하나씩)                               │
│  4. FIX — 원인 확인 후 수정                                 │
│  5. VERIFY — 수정 검증 및 회귀 테스트                       │
└─────────────────────────────────────────────────────────────┘
```

## Usage

```bash
/ultraplan:debug                        # 새 디버그 세션 시작
/ultraplan:debug --resume               # 이전 세션 이어가기
/ultraplan:debug "TypeError in auth"    # 특정 문제로 시작
```

## Debug State File

디버그 상태는 `.ultraplan/debug-session.json`에 저장됩니다:

```json
{
  "sessionId": "debug-2024-01-15-001",
  "status": "in_progress",
  "problem": {
    "description": "TypeError: Cannot read property 'id' of undefined",
    "location": "src/auth/login.ts:45",
    "reproducible": true,
    "steps": ["1. Click login", "2. Enter valid credentials", "3. Error occurs"]
  },
  "hypotheses": [
    {
      "id": "H1",
      "description": "User object not loaded before accessing id",
      "status": "rejected",
      "evidence": "console.log shows user is defined"
    },
    {
      "id": "H2",
      "description": "Race condition between auth check and render",
      "status": "testing",
      "evidence": null
    }
  ],
  "attempts": [
    {
      "hypothesis": "H1",
      "action": "Added console.log to check user object",
      "result": "User is defined, not the issue",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ],
  "checkpoints": [
    {
      "id": "checkpoint-1",
      "commit": "abc123",
      "description": "Before attempting H2 fix"
    }
  ]
}
```

## Behavior

### Step 1: Problem Identification

```javascript
Task(
  subagent_type="gsd-debugger",
  model="opus",
  prompt="""
## Mode
PROBLEM-IDENTIFICATION

## Instructions
1. Reproduce the problem
2. Capture exact error message and stack trace
3. Identify affected file(s) and line(s)
4. Document reproduction steps
5. Create initial debug state file

## Output
Return problem summary and initial hypotheses.
"""
)
```

### Step 2: Hypothesis Generation

문제에 대한 가능한 원인을 가설로 수립:

| 가설 우선순위 | 기준 |
|--------------|------|
| HIGH | 직접 관련 코드, 최근 변경 |
| MEDIUM | 간접 관련, 의존성 |
| LOW | 환경, 외부 요인 |

### Step 3: Hypothesis Testing

**한 번에 하나의 가설만 테스트합니다.**

```javascript
Task(
  subagent_type="gsd-debugger",
  model="opus",
  prompt="""
## Mode
HYPOTHESIS-TESTING

## Current Hypothesis
${HYPOTHESIS}

## Instructions
1. Create checkpoint before testing
2. Add minimal diagnostic code
3. Reproduce problem
4. Collect evidence
5. Update hypothesis status (confirmed/rejected)
6. Remove diagnostic code if rejected

## Constraints
- ONE hypothesis at a time
- Always checkpoint before changes
- Document all evidence
"""
)
```

### Step 4: Fix Implementation

원인이 확인되면 수정:

```javascript
Task(
  subagent_type="oh-my-claudecode:build-fixer",
  model="sonnet",
  prompt="""
## Mode
DEBUG-FIX

## Root Cause
${ROOT_CAUSE}

## Instructions
1. Create checkpoint
2. Implement minimal fix
3. Verify fix resolves issue
4. Run regression tests
5. If tests fail, rollback to checkpoint
"""
)
```

### Step 5: Verification

```bash
# Run tests
npm test

# Verify specific fix
npm test -- --grep "auth login"

# Check for regressions
npm run test:regression
```

## Checkpoint System

디버그 중 안전한 롤백을 위한 체크포인트:

```bash
# 자동 체크포인트 생성
git stash push -m "debug-checkpoint-$(date +%s)"

# 롤백 필요 시
git stash pop
```

## Session Resume

세션이 중단되어도 상태 유지:

```bash
# 이전 세션 확인
cat .ultraplan/debug-session.json

# 이어서 진행
/ultraplan:debug --resume
```

## Integration with Other Commands

| 상황 | 연계 명령어 |
|------|-------------|
| 빌드 에러 | `build-fixer` 자동 호출 |
| 보안 이슈 | `security-reviewer` 호출 |
| 테스트 실패 | `tdd-guide` 호출 |

## Examples

**New Debug Session:**
```
> /ultraplan:debug "Login fails with TypeError"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 DEBUG SESSION: debug-2024-01-15-001
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Problem: TypeError: Cannot read property 'id' of undefined
Location: src/auth/login.ts:45

Hypotheses:
  [H1] User object not loaded before accessing id
  [H2] Race condition between auth check and render
  [H3] API response changed, id field renamed

Testing H1...
  → Added console.log at login.ts:40
  → Reproduced error
  → Evidence: user object IS defined
  → H1 REJECTED

Testing H2...
  → Created checkpoint: checkpoint-1
  → Added async/await verification
  ...
```

**Resume Session:**
```
> /ultraplan:debug --resume

Resuming session: debug-2024-01-15-001

Status: Testing H2
Last attempt: Added async/await verification
Next step: Check if race condition is resolved

Continue? [Y/n]
```

## Related Commands

| Command | Description |
|---------|-------------|
| `/ultraplan:execute` | 실행 중 에러 시 자동 디버그 제안 |
| `build-fixer` | 빌드 에러 자동 수정 |
