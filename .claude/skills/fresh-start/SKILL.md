# Fresh Start Skill

새 작업 시작 전 컨텍스트를 정리하고 필수 정보만 주입하는 스킬.

## 트리거

- `/fresh-start` 또는 `/fs`
- "fresh start", "새로 시작", "컨텍스트 정리" 언급 시

## 워크플로우

### Phase 1: 현재 상태 저장

현재 진행 중인 작업이 있다면 Notepad에 저장:

```
1. 진행 중인 태스크 확인 (TaskList)
2. 미완료 작업 있으면 Notepad에 기록:
   - addIssue(planId, { content: "중단됨: {reason}", status: "open" })
3. 중요한 발견사항 저장:
   - addLearning(planId, { content: "..." })
```

### Phase 2: 컨텍스트 정리 안내

사용자에게 `/clear` 실행 권장:

```
## Context Cleanup

현재 컨텍스트가 무거워졌습니다.
최적의 성능을 위해 `/clear` 실행을 권장합니다.

**저장된 정보:**
- [x] 진행 상태 → Notepad
- [x] 학습 내용 → learnings.md
- [x] 미완료 작업 → issues.md

`/clear` 후 `/fresh-start continue` 로 재개하세요.
```

### Phase 3: 필수 컨텍스트 주입

`/clear` 후 또는 `continue` 인자와 함께 실행 시:

```
1. 프로젝트 컨텍스트 로드:
   - Read: .planning/PROJECT.md (요약)
   - Read: .planning/ROADMAP.md (현재 Phase)
   - Read: .planning/STATE.md (상태)

2. Wisdom 주입:
   - MCP: get_wisdom(planId)
   - 또는: createWisdomDirective(planId)

3. 현재 태스크 확인:
   - Read: 현재 PLAN.md
   - TaskList로 pending 작업 확인
```

## 사용법

### 기본 사용

```bash
# 현재 상태 저장 + /clear 안내
/fresh-start

# /clear 후 컨텍스트 복원
/fresh-start continue

# 특정 Phase로 시작
/fresh-start phase 2

# 특정 Plan으로 시작
/fresh-start plan 01-02
```

### 자동 주입되는 컨텍스트

| 항목 | 소스 | 용도 |
|------|------|------|
| 프로젝트 개요 | PROJECT.md | 전체 맥락 |
| 현재 Phase | ROADMAP.md | 진행 상황 |
| 이전 학습 | learnings.md | 실수 방지 |
| 결정 사항 | decisions.md | 일관성 유지 |
| 알려진 이슈 | issues.md | 주의 사항 |

## 구현

### MCP 도구 사용

```typescript
// 1. Wisdom 조회
const wisdom = await mcp__ultra-planner__get_wisdom(planId);

// 2. 서브에이전트용 디렉티브 생성
const directive = await mcp__ultra-planner__create_wisdom_directive(planId);

// 3. 워커에게 주입
const prompt = generateWorkerPrompt({
  worker: { id: 'worker-1', name: 'Worker-1', index: 0 },
  learnings: directive,
});
```

### 직접 파일 읽기

```typescript
// Notepad 파일 위치
const notepadDir = '.ultraplan/notepads/{plan-id}/';
const learnings = Read(`${notepadDir}/learnings.md`);
const decisions = Read(`${notepadDir}/decisions.md`);
const issues = Read(`${notepadDir}/issues.md`);
```

## 출력 예시

```markdown
## Fresh Start Complete

### Project Context
- **Project**: Ultra Planner v2.0
- **Current Phase**: 3 - Adaptability
- **Status**: In Progress (60%)

### Loaded Wisdom
**Learnings (3):**
- Zod 3.23 requires .pipe() for transforms
- Use async/await for all DB operations
- TypeScript strict mode needs explicit returns

**Decisions (2):**
- Use Sonnet for documentation tasks
- Swarm pattern for parallel execution

**Open Issues (1):**
- Race condition in concurrent file writes (workaround: sequential)

### Ready for Execution
Next task: `01-03` - Add validation layer

Run `/ultraplan:execute 01-03` to continue.
```

## 주의사항

1. **자동 저장**: `/clear` 전에 중요 정보는 자동으로 Notepad에 저장됨
2. **Wisdom 크기**: 너무 많은 학습 내용은 요약하여 주입
3. **토큰 효율**: 필수 정보만 주입하여 토큰 절약

## 관련 스킬

- `/ultraplan:execute` - 태스크 실행
- `/ultraplan:status` - 현재 상태 확인
- `/oh-my-claudecode:note` - 수동 노트 저장
