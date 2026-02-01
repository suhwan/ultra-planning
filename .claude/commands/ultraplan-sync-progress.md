# /ultraplan:sync-progress

Task/Phase 완료 후 상태 파일들을 자동 동기화합니다.

## 자동 트리거 조건

이 스킬은 다음 상황에서 **반드시** 실행되어야 합니다:

1. **Task 완료 후** - TaskUpdate(status: completed) 호출 후
2. **Phase 완료 후** - Phase의 모든 Task 완료 후
3. **Plan 완료 후** - PLAN.md의 모든 Task 완료 후

## 동기화 대상

### 1. ROADMAP.md Progress Table

```markdown
| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 15. Layered Memory | 3/3 | Complete | 2026-02-01 |
```

**업데이트 로직:**
- Plans Complete: 완료된 PLAN.md 수 / 전체 PLAN.md 수
- Status: 모두 완료 → "Complete", 진행 중 → "In Progress"
- Completed: 완료일 (YYYY-MM-DD)

### 2. ROADMAP.md Phase Checkboxes

```markdown
- [x] **Phase 15: Layered Memory** — 완료됨
- [ ] **Phase 16: Context Compaction** — 미완료
```

### 3. STATE.md Current Position

```markdown
## Current Position
- Phase: 16
- Plan: 16-02
- Task: Task 3
- Status: in_progress
```

### 4. PLAN.md Task Checkboxes

```markdown
## Tasks
- [x] Task 1: Create types
- [x] Task 2: Implement logic
- [ ] Task 3: Add tests
```

## 실행 프로토콜

```bash
# 1. 현재 완료된 태스크 확인
COMPLETED_TASKS=$(TaskList | grep "completed")

# 2. PLAN.md 체크박스 업데이트
for task in $COMPLETED_TASKS; do
  # - [ ] → - [x] 변환
done

# 3. ROADMAP.md Progress 업데이트
PHASE_DIR=".planning/phases/${PHASE_NUM}-*"
TOTAL_PLANS=$(ls ${PHASE_DIR}/*-PLAN.md | wc -l)
COMPLETED_PLANS=$(grep -l "all tasks completed" ${PHASE_DIR}/*-PLAN.md | wc -l)

# 4. Progress Table 업데이트
sed -i "s/| ${PHASE_NUM}. .* | .* |/| ${PHASE_NUM}. ${PHASE_NAME} | ${COMPLETED_PLANS}\/${TOTAL_PLANS} | ${STATUS} | ${DATE} |/"

# 5. Phase 체크박스 업데이트 (모두 완료 시)
if [ "$COMPLETED_PLANS" -eq "$TOTAL_PLANS" ]; then
  sed -i "s/- \[ \] \*\*Phase ${PHASE_NUM}/- [x] **Phase ${PHASE_NUM}/"
fi

# 6. STATE.md 업데이트
cat > .planning/STATE.md << EOF
## Current Position
- Phase: ${PHASE_NUM}
- Plan: ${PLAN_ID}
- Task: ${CURRENT_TASK}
- Status: ${STATUS}
- Last Updated: $(date -Iseconds)
EOF
```

## CLAUDE.md 통합 지침

다음 내용을 CLAUDE.md에 추가하여 자동 실행을 강제합니다:

```markdown
## MANDATORY: Task Completion Hook

**모든 TaskUpdate(status: completed) 호출 후 반드시 실행:**

1. 해당 PLAN.md 태스크 체크박스 업데이트
2. Phase의 모든 태스크 완료 시:
   - ROADMAP.md Progress Table 업데이트
   - ROADMAP.md Phase 체크박스 업데이트
3. STATE.md Current Position 업데이트

**실행 방법:** `/ultraplan:sync-progress` 또는 아래 로직 직접 실행
```

## 출력 형식

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 PROGRESS SYNC COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Updated:
  ✓ PLAN.md: 16-02-PLAN.md (3/3 tasks)
  ✓ ROADMAP.md: Phase 16 progress (3/3 plans)
  ✓ ROADMAP.md: Phase 16 checkbox [x]
  ✓ STATE.md: Current position updated

Phase 16: Context Compaction → COMPLETE
```
