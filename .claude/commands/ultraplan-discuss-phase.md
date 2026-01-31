---
name: ultraplan:discuss-phase
description: Gather context before planning through adaptive questioning. Creates CONTEXT.md consumed by planner.
allowed-tools: Read, Write, Glob, Grep, Bash, Task, AskUserQuestion
---

# /ultraplan:discuss-phase

계획 전 사용자와 대화하여 맥락을 수집합니다. CONTEXT.md를 생성하여 planner가 더 정확한 계획을 세울 수 있게 합니다.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│  /ultraplan:discuss-phase {N}                               │
│                                                             │
│  1. EXPLORE — Phase 목표와 코드베이스 분석                   │
│  2. IDENTIFY — Claude가 결정해야 할 사항 파악               │
│  3. INTERVIEW — 적응형 질문으로 맥락 수집                   │
│  4. DOCUMENT — CONTEXT.md 생성                              │
└─────────────────────────────────────────────────────────────┘
```

## Usage

```bash
/ultraplan:discuss-phase 1              # Phase 1 맥락 수집
/ultraplan:discuss-phase 03             # Phase 3 (zero-padded)
/ultraplan:discuss-phase 2 --quick      # 빠른 모드 (3개 질문만)
```

## Behavior

### Step 1: Load Phase Context

```bash
# Find phase directory
PADDED_PHASE=$(printf "%02d" ${phase_number})
PHASE_DIR=$(ls -d .planning/phases/${PADDED_PHASE}-* .planning/phases/${phase_number}-* 2>/dev/null | head -1)

# Read phase goal from ROADMAP.md
PHASE_GOAL=$(sed -n "/^### Phase ${phase_number}:/,/^### Phase/p" .planning/ROADMAP.md | head -20)
```

### Step 2: Identify Decision Points

Claude가 Phase 구현 시 결정해야 할 사항들을 분류합니다:

| 분류 | 설명 | 예시 |
|------|------|------|
| **Decisions** | 사용자가 결정해야 함 | UI 스타일, 라이브러리 선택 |
| **Claude's Discretion** | Claude가 결정 가능 | 구현 세부사항, 파일 구조 |
| **Deferred Ideas** | 나중에 고려 | Nice-to-have 기능 |

### Step 3: Adaptive Interview

사용자에게 맥락을 수집하는 질문을 합니다.

**질문 원칙:**
- 한 번에 하나씩 질문
- 구체적이고 선택지 제공
- 기술적 세부사항보다 의도와 제약 파악
- 이미 알 수 있는 건 질문 안 함

```javascript
AskUserQuestion({
  questions: [{
    question: "이 Phase에서 가장 중요한 결과물은 무엇인가요?",
    header: "Priority",
    options: [
      { label: "기능 완성", description: "모든 기능이 동작하는 것이 최우선" },
      { label: "코드 품질", description: "유지보수 가능한 깔끔한 코드" },
      { label: "빠른 완성", description: "MVP로 빠르게 확인" }
    ],
    multiSelect: false
  }]
})
```

### Step 4: Generate CONTEXT.md

수집된 맥락을 CONTEXT.md로 정리합니다.

```markdown
# Phase {N}: {Name} - Context

**Discussed:** {date}
**Confidence:** HIGH

## Decisions (User Specified)

사용자가 결정한 사항들:

- **UI 스타일:** 미니멀, 모노크롬
- **라이브러리:** React Query 사용
- **우선순위:** 기능 완성 > 코드 품질

## Claude's Discretion

Claude가 판단해서 결정할 사항들:

- 파일 구조 및 네이밍
- 에러 핸들링 방식
- 유틸리티 함수 구현

## Deferred Ideas

이번 Phase에서는 제외:

- 다크 모드 지원
- 애니메이션 효과
- 국제화 (i18n)

## Constraints

- TypeScript strict 모드 사용
- 기존 컴포넌트 스타일 따르기
- 테스트 커버리지 80% 이상
```

**Output Location:** `${PHASE_DIR}/${PADDED_PHASE}-CONTEXT.md`

### Step 5: Commit and Return

```bash
git add "${PHASE_DIR}/${PADDED_PHASE}-CONTEXT.md"
git commit -m "docs(phase-${phase_number}): gather planning context

- User decisions documented
- Claude discretion areas identified
- Deferred ideas captured"
```

## Integration with plan-phase

`/ultraplan:plan-phase`에서 CONTEXT.md가 있으면 자동으로 참조합니다:

```
/ultraplan:discuss-phase 3    # CONTEXT.md 생성
/ultraplan:plan-phase 3       # CONTEXT.md 참조하여 더 정확한 계획
```

## Quick Mode (--quick)

```bash
/ultraplan:discuss-phase 3 --quick
```

- 3개 핵심 질문만
- 5분 이내 완료
- MVP/빠른 진행 시 사용

## Examples

**Full Discussion:**
```
> /ultraplan:discuss-phase 2

Phase 2: API 엔드포인트 구현

Q1: 인증 방식은 어떤 것을 선호하시나요?
  [1] JWT (Recommended)
  [2] Session-based
  [3] OAuth only

> 1

Q2: 에러 응답 형식은?
  [1] RFC 7807 Problem Details
  [2] Custom JSON format
  [3] Claude 판단에 맡김

> 3

...

✓ CONTEXT.md 생성 완료
  → .planning/phases/02-api/02-CONTEXT.md

다음: /ultraplan:plan-phase 2
```

## Related Commands

| Command | Description |
|---------|-------------|
| `/ultraplan:plan-phase` | CONTEXT.md 참조하여 계획 |
| `/ultraplan:new-project` | 프로젝트 초기 맥락 수집 |
