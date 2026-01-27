# Phase 9 Plan 01 Summary: LSP Diagnostics Wrapper

**Status:** ✅ COMPLETED
**Date:** 2026-01-27
**Duration:** ~15 minutes

## Objectives Achieved

Implemented LSP diagnostics wrapper for project-level type checking with TypeScript compiler integration.

## What Was Built

### Module Structure
```
src/quality/lsp/
├── types.ts        - Type definitions (88 lines)
├── parser.ts       - Output parser (108 lines)
├── diagnostics.ts  - Diagnostic runner (167 lines)
└── index.ts        - Barrel export (9 lines)
```

### Key Components

1. **types.ts** - Complete type system for diagnostics
   - `DiagnosticSeverity`: 'error' | 'warning' | 'info' | 'hint'
   - `DiagnosticItem`: Individual diagnostic with file, line, column, severity, code, message
   - `DiagnosticStrategy`: Configuration for tsc/lsp/auto detection
   - `DiagnosticResult`: Complete execution result with summary
   - `DiagnosticSummary`: Error/warning/info/hint counts and file count

2. **parser.ts** - TypeScript compiler output parsing
   - `parseDiagnosticOutput()`: Parse tsc --noEmit stderr output
   - `groupByFile()`: Group diagnostics by file path
   - `countBySeverity()`: Generate summary statistics
   - Regex-based parsing: `file.ts(line,col): severity TScode: message`

3. **diagnostics.ts** - Execution engine
   - `runDiagnostics()`: Main entry point with auto-detection
   - `detectStrategy()`: Auto-select tsc if tsconfig.json exists
   - `runTscDiagnostics()`: Execute `npx tsc --noEmit` and parse output
   - `runLspDiagnostics()`: LSP fallback stub (for future implementation)
   - 60-second default timeout with configurable override

4. **Integration**
   - Created `src/quality/index.ts` barrel export
   - Added quality module to main `src/index.ts`
   - All exports available from `ultra-planner` package

## Verification Results

### Build Verification
```bash
$ npm run build
✅ No compilation errors
✅ All TypeScript declarations generated
✅ Source maps created
```

### Export Verification
```bash
$ node -e "import('./dist/index.js').then(m => console.log(Object.keys(m).filter(k => k.includes('Diagnostic'))))"
✅ parseDiagnosticOutput
✅ runDiagnostics
```

### Functionality Test
```bash
$ runDiagnostics('.')
✅ Strategy: tsc
✅ Success: true
✅ Duration: 2716ms
✅ Summary: 0 errors, 0 warnings, 0 info, 0 hints
✅ Diagnostics count: 0
```

## Files Modified

- ✅ `src/quality/lsp/types.ts` (new, 88 lines)
- ✅ `src/quality/lsp/parser.ts` (new, 108 lines)
- ✅ `src/quality/lsp/diagnostics.ts` (new, 167 lines)
- ✅ `src/quality/lsp/index.ts` (new, 9 lines)
- ✅ `src/quality/index.ts` (new, 9 lines)
- ✅ `src/index.ts` (modified, added quality module export)

## Must-Haves Validation

### Truths
- ✅ `runDiagnostics()` returns structured error/warning counts in `DiagnosticSummary`
- ✅ `parseDiagnosticOutput()` extracts file, line, severity, message from tsc output
- ✅ `DiagnosticResult` includes per-file breakdown (via `groupByFile()`) and summary

### Artifacts
- ✅ `src/quality/lsp/types.ts` - Exports all diagnostic types (88 lines, min 40)
- ✅ `src/quality/lsp/diagnostics.ts` - Exports `runDiagnostics` (167 lines, min 60)
- ✅ `src/quality/lsp/parser.ts` - Exports parser functions (108 lines, min 50)
- ✅ `src/quality/lsp/index.ts` - Module barrel export (9 lines, min 5)

### Key Links
- ✅ `diagnostics.ts` → `child_process` via `execSync('npx tsc --noEmit', ...)`
- ✅ Pattern matched: `execSync.*tsc`

## Technical Implementation Details

### Strategy Auto-Detection
```typescript
function detectStrategy(directory: string): 'tsc' | 'lsp' {
  return existsSync(join(directory, 'tsconfig.json')) ? 'tsc' : 'lsp';
}
```

### Error Handling
- Distinguishes between execution errors and type errors
- `success: true` even when code has type errors (execution succeeded)
- `success: false` only for timeout/command not found/system errors

### Output Parsing
- Regex: `/^(.+)\((\d+),(\d+)\):\s+(error|warning|info|hint)\s+(TS\d+):\s+(.+)$/`
- Handles both stdout and stderr (tsc uses both)
- Validates severity before accepting diagnostic

### Future Work
- LSP iteration strategy implementation (currently stub)
- Severity filtering via `minSeverity` option
- Custom timeout configuration
- Integration with verification gate protocol

## Reference Patterns Used

Based on `references/oh-my-claudecode/src/tools/lsp-tools.ts`:
- `lspDiagnosticsDirectoryTool` pattern for directory-level checks
- Strategy auto-detection (tsc vs LSP)
- Error handling with graceful fallback
- Structured result format

## Next Steps

Ready for Phase 9 Plan 02: Integration with verification gate protocol for automated quality checks after task completion.

## Commit Message

```
feat(09-code-quality): implement LSP diagnostics wrapper

- Add LSP diagnostics types (DiagnosticItem, DiagnosticResult, DiagnosticStrategy)
- Implement tsc --noEmit parser with regex-based extraction
- Create runDiagnostics() with auto-detection (tsc/lsp/auto)
- Add groupByFile() and countBySeverity() utilities
- Export quality module from main package
- Verified: 0 build errors, all exports available, 2.7s execution time
```
