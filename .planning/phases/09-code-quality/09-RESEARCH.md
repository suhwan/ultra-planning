# Phase 9 Research: 코드 품질 자동화

## 연구 목표

Phase 9: LSP 진단, AST 분석, 코드 리뷰 자동화로 코드 품질 보장

## 참조 분석

### 1. LSP Tools (references/oh-my-claudecode/src/tools/lsp-tools.ts)

**핵심 기능:**
- `lsp_hover` - 타입 정보, 문서
- `lsp_goto_definition` - 정의 위치 찾기
- `lsp_find_references` - 참조 찾기
- `lsp_document_symbols` - 파일 심볼 아웃라인
- `lsp_workspace_symbols` - 워크스페이스 심볼 검색
- `lsp_diagnostics` - 단일 파일 진단 (에러, 워닝)
- `lsp_diagnostics_directory` - 프로젝트 레벨 진단 (핵심!)
- `lsp_code_actions` - 리팩토링, 퀵픽스
- `lsp_rename` - 심볼 이름 변경

**핵심 패턴:**
```typescript
// LSP 클라이언트 래퍼
async function withLspClient<T>(
  filePath: string,
  operation: string,
  fn: (client) => Promise<T>
): Promise<{ content: Array<{ type: 'text'; text: string }> }>

// 디렉토리 진단 (가장 중요)
export const lspDiagnosticsDirectoryTool = {
  name: 'lsp_diagnostics_directory',
  schema: {
    directory: z.string(),
    strategy: z.enum(['tsc', 'lsp', 'auto']).optional()
  }
}
```

**전략:**
- `tsc` - TypeScript 컴파일러 직접 사용 (빠름)
- `lsp` - Language Server 반복 (느림, fallback)
- `auto` - tsconfig.json 있으면 tsc, 없으면 lsp

### 2. AST Tools (references/oh-my-claudecode/src/tools/ast-tools.ts)

**핵심 기능:**
- `ast_grep_search` - AST 패턴 매칭 검색
- `ast_grep_replace` - AST 패턴 매칭 치환

**메타 변수:**
- `$NAME` - 단일 노드 매칭
- `$$$ARGS` - 다중 노드 매칭

**예시 패턴:**
```typescript
// 함수 찾기
"function $NAME($$$ARGS)"

// console.log 찾기
"console.log($MSG)"

// if문 찾기
"if ($COND) { $$$BODY }"

// import 찾기
"import $$$IMPORTS from '$MODULE'"
```

**의존성:**
- `@ast-grep/napi` - ast-grep의 Node.js 바인딩

**지원 언어:**
- JavaScript, TypeScript, TSX
- Python, Ruby, Go, Rust
- Java, Kotlin, Swift
- C, C++, C#
- HTML, CSS, JSON, YAML

### 3. Code Reviewer (references/oh-my-claudecode/agents/code-reviewer.md)

**2단계 리뷰 프로세스:**
1. **Stage 1: Spec Compliance** (먼저)
   - Completeness - 요구사항 전체 커버?
   - Correctness - 올바른 문제 해결?
   - Nothing Missing - 누락 기능?
   - Nothing Extra - 불필요한 기능?
   - Intent Match - 의도 일치?

2. **Stage 2: Code Quality** (Stage 1 통과 후)
   - Security Checks (CRITICAL)
   - Code Quality (HIGH)
   - Performance (MEDIUM)
   - Best Practices (LOW)

**심각도 레벨:**
| Severity | Description | Action |
|----------|-------------|--------|
| CRITICAL | 보안 취약점, 데이터 손실 위험 | 머지 전 필수 수정 |
| HIGH | 버그, 주요 코드 스멜 | 머지 전 수정 권장 |
| MEDIUM | 마이너 이슈, 성능 우려 | 가능하면 수정 |
| LOW | 스타일, 제안 | 고려 |

## 구현 전략

### Plan 09-01: LSP 진단 자동화

**목표:** 태스크 완료 후 자동으로 LSP 진단 실행

**핵심 구현:**
1. LSP 진단 인터페이스 정의
2. `lsp_diagnostics_directory` 호출 래퍼
3. 진단 결과 파싱 (에러/워닝 개수)
4. 상태 파일 연동 (STATE.md 또는 별도 파일)

**파일:**
- `src/quality/lsp/types.ts` - 진단 타입 정의
- `src/quality/lsp/diagnostics.ts` - 진단 실행 로직
- `src/quality/lsp/parser.ts` - 결과 파싱

**진단 전략:**
```typescript
interface DiagnosticStrategy {
  type: 'tsc' | 'lsp' | 'auto';
  timeout: number;
  severity?: 'error' | 'warning' | 'info' | 'hint';
}
```

### Plan 09-02: AST 파서 구현

**목표:** TypeScript AST 분석으로 코드 구조 파악

**핵심 구현:**
1. AST 분석 인터페이스 정의
2. `ast_grep_search` 래퍼
3. 코드 구조 추출 (함수, 클래스, export)
4. 코드 메트릭 계산 (복잡도, 라인 수)

**파일:**
- `src/quality/ast/types.ts` - AST 타입 정의
- `src/quality/ast/analyzer.ts` - AST 분석 로직
- `src/quality/ast/patterns.ts` - 공통 패턴 정의
- `src/quality/ast/metrics.ts` - 메트릭 계산

**분석 대상:**
```typescript
interface CodeStructure {
  functions: FunctionInfo[];
  classes: ClassInfo[];
  exports: ExportInfo[];
  imports: ImportInfo[];
}

interface CodeMetrics {
  totalLines: number;
  functionCount: number;
  classCount: number;
  avgFunctionSize: number;
  maxFunctionSize: number;
  complexity: number; // cyclomatic complexity
}
```

### Plan 09-03: 코드 리뷰 에이전트

**목표:** 자동 코드 리뷰 피드백 생성

**핵심 구현:**
1. 리뷰 체크리스트 정의
2. 2단계 리뷰 로직 (Spec → Quality)
3. 심각도별 이슈 분류
4. 리뷰 리포트 생성

**파일:**
- `src/quality/review/types.ts` - 리뷰 타입 정의
- `src/quality/review/checklist.ts` - 체크리스트 정의
- `src/quality/review/analyzer.ts` - 리뷰 분석 로직
- `src/quality/review/reporter.ts` - 리포트 생성

**체크리스트:**
```typescript
interface ReviewChecklist {
  security: SecurityCheck[];
  quality: QualityCheck[];
  performance: PerformanceCheck[];
  bestPractices: BestPracticeCheck[];
}

interface ReviewIssue {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  file: string;
  line: number;
  description: string;
  fix: string;
}
```

### Plan 09-04: 통합 파이프라인

**목표:** 태스크 완료 → LSP → AST → 리뷰 자동 흐름

**핵심 구현:**
1. 파이프라인 단계 정의
2. 단계별 실행 로직
3. 결과 취합 및 상태 업데이트
4. 실패 시 처리 로직

**파일:**
- `src/quality/pipeline/types.ts` - 파이프라인 타입
- `src/quality/pipeline/executor.ts` - 파이프라인 실행
- `src/quality/pipeline/integration.ts` - 훅 연동

**파이프라인 흐름:**
```
Task Complete
    ↓
[LSP Diagnostics]
    ↓ (errors == 0)
[AST Analysis]
    ↓
[Code Review]
    ↓
Update State/Report
```

## 의존성

**외부 패키지:**
- `@ast-grep/napi` - AST 분석 (이미 OMC에서 사용)

**내부 의존성:**
- `src/state/` - 상태 관리 (Phase 2)
- `src/documents/` - 문서 생성 (Phase 3)

## 위험 및 완화

| 위험 | 완화 방안 |
|------|----------|
| LSP 서버 미설치 | 설치 힌트 제공, 진단 건너뛰기 옵션 |
| AST 파싱 실패 | 파일별 try-catch, 실패 파일 스킵 |
| 대규모 프로젝트 느림 | 타임아웃 설정, 증분 분석 |

## 결론

Phase 9는 OMC의 LSP/AST 도구를 참조하여 Ultra Planner용 래퍼를 구현합니다:

1. **LSP 진단**: `lsp_diagnostics_directory` 호출 래퍼 + 결과 파싱
2. **AST 분석**: `ast_grep_search` 래퍼 + 코드 메트릭
3. **코드 리뷰**: 2단계 체크리스트 기반 리뷰
4. **파이프라인**: 태스크 완료 훅 연동

---
*Research completed: 2026-01-27*
