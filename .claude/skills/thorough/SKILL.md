---
name: thorough
description: GSD 계획 생성 + Architect 검토 + 병렬 실행을 자동으로 수행. "꼼꼼하게", "thorough", "careful phase" 요청 시 사용.
---

# 꼼꼼하게 (Thorough) 모드

Phase 단위로 계획 → 검토 → 실행을 자동화합니다.

## 사용법

```
/thorough phase {N}        # 단일 페이즈 자동 실행
/thorough plan phase {N}   # 계획+검토만
/thorough exec phase {N}   # 실행만
/thorough all              # 🆕 모든 미완료 페이즈 연속 실행
/thorough from {N}         # 🆕 페이즈 N부터 끝까지 실행
```

## 실행 흐름

### STEP 1: 계획 생성 (GSD)
```
/gsd:plan-phase {N} 실행
→ .planning/phases/{NN}-*/PLAN.md 생성
```

### STEP 2: Architect 검토 (Ralph Plan)
```
oh-my-claudecode:architect 호출하여 PLAN.md 검토

검토 항목:
- 요구사항과 매핑 확인
- 의존성 완전성
- 태스크 분리 적절성
- 병렬 가능 태스크 식별

결과:
- APPROVED → STEP 3로 진행
- NEEDS_REVISION → 수정 후 재검토 (최대 3회)
```

### STEP 3: Tasks 동기화
```
PLAN.md에서 태스크 추출하여 Claude Code Tasks에 등록
- 태스크 이름, 설명
- 의존성 정보
- 병렬 가능 여부 표시
```

### STEP 4: 병렬 실행 (UltraWork)
```
"ulw: .planning/phases/{NN}-*/ 실행"

- 독립 태스크: 5워커 병렬 실행
- 의존성 있는 태스크: 순차 실행
- 각 태스크 완료 시 atomic commit
```

### STEP 5: 완료 보고
```
Phase {N} 완료!

✅ 완료된 태스크: {count}
📁 생성된 파일: {files}
⏱️ 소요 시간: {time}

➡️ 다음: /thorough phase {N+1}
```

### STEP 6: 다음 페이즈 진행 (all/from 모드)
```
"all" 또는 "from {N}" 모드일 경우:
→ 다음 미완료 페이즈 자동 감지
→ STEP 1부터 반복
→ 모든 페이즈 완료될 때까지 계속
```

## 출력 형식

### 단일 페이즈 실행 시
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 THOROUGH MODE: Phase {N}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/5] 계획 생성 중...
→ /gsd:plan-phase {N} 실행
→ PLAN.md 생성 완료 ✓

[2/5] Architect 검토 중...
→ 검토 결과: {APPROVED/NEEDS_REVISION}
→ {수정 필요 시 수정 내용}
→ 최종: APPROVED ✓

[3/5] Tasks 동기화 중...
→ {count}개 태스크 등록 완료 ✓

[4/5] 병렬 실행 중...
→ 독립 태스크 {n}개 병렬 실행
→ 순차 태스크 {m}개 실행
→ 전체 완료 ✓

[5/5] 완료 보고
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 전체 연속 실행 시 (all/from)
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 THOROUGH MODE: 연속 실행
 남은 페이즈: {N}, {N+1}, {N+2}...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

═══ Phase {N}: {phase_name} ═══
[1/5] 계획 생성 중... ✓
[2/5] Architect 검토 중... ✓
[3/5] Tasks 동기화 중... ✓
[4/5] 병렬 실행 중... ✓
[5/5] Phase {N} 완료! ✓

→ ROADMAP.md 업데이트 ✓
→ 다음 페이즈로 자동 진행...

═══ Phase {N+1}: {phase_name} ═══
[1/5] 계획 생성 중...
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 🎉 전체 완료!

 완료된 페이즈: {list}
 총 태스크: {count}개
 총 커밋: {commits}개
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 옵션별 동작

### `/thorough phase {N}` (단일)
STEP 1 → 2 → 3 → 4 → 5 전체 실행
해당 페이즈만 완료 후 종료

### `/thorough all` (전체)
ROADMAP.md에서 미완료 페이즈 목록 파싱
→ 첫 번째 미완료 페이즈부터 순서대로 실행
→ STEP 1 → 2 → 3 → 4 → 5 → 6(다음 페이즈) 반복
→ 모든 페이즈 완료 시 최종 보고

**자동 진행 로직:**
1. ROADMAP.md 읽기
2. `- [ ]` 체크박스로 미완료 페이즈 식별
3. 페이즈 번호 순서대로 실행
4. 각 페이즈 완료 후 ROADMAP.md 체크박스 업데이트
5. 다음 미완료 페이즈로 자동 진행

### `/thorough from {N}` (특정 시작점)
페이즈 N부터 끝까지 실행
→ N 이전 페이즈는 건너뜀
→ 나머지는 `/thorough all`과 동일

### `/thorough plan phase {N}`
STEP 1 → 2만 실행 (계획 생성 + 검토)
실행 없이 승인된 계획만 준비

### `/thorough exec phase {N}`
STEP 4 → 5만 실행 (이미 승인된 계획 실행)
.planning/phases/{NN}-*/PLAN.md가 있어야 함

## 자연어 감지

다음 패턴도 자동 인식:
- "꼼꼼하게 phase 1"
- "careful phase 1"
- "thorough phase 1 실행해줘"
- "phase 1 꼼꼼하게 해줘"
- "끝까지 해줘" → `/thorough all`
- "전부 다 실행해" → `/thorough all`
- "나머지 페이즈 다 해줘" → `/thorough all`
- "phase 2부터 끝까지" → `/thorough from 2`
- "2번부터 마지막까지" → `/thorough from 2`

## 에러 처리

### 검토 3회 실패 시
```
⚠️ Architect 검토 3회 실패
수동 검토가 필요합니다.

문제 목록:
- {issue 1}
- {issue 2}

→ 수정 후 다시 "/thorough phase {N}" 실행
```

### PLAN.md 없을 때 exec 시도 시
```
⚠️ Phase {N}의 PLAN.md가 없습니다.
먼저 "/thorough plan phase {N}" 실행하세요.
```

### 페이즈 실패 시 (all/from 모드)
```
⚠️ Phase {N} 실행 중 오류 발생

오류: {error_message}

옵션:
1. 문제 해결 후 "/thorough from {N}" 으로 재개
2. 이 페이즈 건너뛰고 "/thorough from {N+1}" 진행
3. 중단

→ 진행된 페이즈 {1..N-1}의 변경사항은 이미 커밋됨
```

## 중단/재개 지원

실행 중 중단되어도 안전합니다:
- 각 페이즈 완료 시 ROADMAP.md 체크박스 업데이트
- 각 태스크 완료 시 atomic commit
- `/thorough all` 다시 실행하면 미완료 페이즈부터 재개

## 무인 실행 모드 (Unattended)

`/thorough all` 또는 `/thorough from {N}` 실행 시 **완전 자동화**:

**자동 진행 원칙:**
1. 사용자 확인 요청 금지 - 모든 결정을 자동으로 내림
2. AskUserQuestion 사용 금지 - 합리적인 기본값 선택
3. Architect 검토 실패 시 - 자동 수정 후 재시도 (최대 3회)
4. 빌드 에러 시 - build-fixer 자동 호출
5. 테스트 실패 시 - 자동 수정 시도

**자동 결정 규칙:**
| 상황 | 자동 결정 |
|------|----------|
| 구현 방식 선택 | 가장 단순한 방식 선택 |
| 라이브러리 선택 | 이미 프로젝트에 있는 것 우선 |
| 네이밍 결정 | 기존 코드 컨벤션 따름 |
| 에러 처리 방식 | 프로젝트 기존 패턴 따름 |

**실패 시에만 멈춤:**
- Architect 검토 3회 연속 실패
- 빌드 에러 수정 3회 실패
- 치명적 에러 (파일 시스템 오류 등)

## GSD 자동 응답 규칙

GSD 스킬에서 질문이 나오면 아래 규칙으로 자동 응답:

| GSD 질문 | 자동 응답 |
|----------|----------|
| "RESEARCH BLOCKED" - 3가지 선택 | 2) Skip research and plan anyway |
| "기존 플랜 있음" - 3가지 선택 | 3) Replan from scratch |
| "Max iterations reached" - 3가지 선택 | 1) Force proceed |
| "Proceed? (y/n)" | y |
| "Overwrite? (y/n)" | y |
| "Continue? (y/n)" | y |

**실행 방법:**
```
/gsd:plan-phase {N} --skip-verify
```
`--skip-verify` 플래그로 검증 루프 건너뛰기 (Architect 검토로 대체)