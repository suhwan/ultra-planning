---
phase: 10-context-monitor
plan: 01
completed: 2026-01-27
wave: 1
---

# Plan 10-01 Summary: Token Estimator

## Objective
Implement token estimation using text.length / 4 pattern and cumulative context tracking.

## Implementation

### Files Created
1. **src/context/types.ts** - Context types and constants
   - Constants: CHARS_PER_TOKEN=4, CLAUDE_DEFAULT_CONTEXT_LIMIT=200000
   - Threshold constants: WARNING_THRESHOLD=0.70, CRITICAL_THRESHOLD=0.85
   - ContextConfig interface for configuration
   - ContextState interface for file persistence
   - ContextUsageResult interface for analysis results

2. **src/context/estimator.ts** - Token estimation and tracking
   - `estimateTokens(text)` - Returns Math.ceil(text.length / 4)
   - `getContextLimit()` - Checks ANTHROPIC_1M_CONTEXT env var
   - `analyzeContextUsage(cumulativeChars, config?)` - Threshold analysis
   - `createContextTracker(sessionId, config?)` - Cumulative tracker with:
     - `trackContent(text)` - Accumulates chars
     - `getState()` - Returns ContextState
     - `getUsage()` - Returns ContextUsageResult
     - `reset()` - Resets cumulative count

3. **src/context/index.ts** - Public API exports

## Verification Results

### Build Status
✅ `npm run build` - All files compile successfully

### Functional Tests
✅ estimateTokens('hello') = 2 tokens (5 chars / 4 = 1.25, ceil = 2)
✅ estimateTokens(1000 chars) = 250 tokens (1000 / 4 = 250)
✅ Context tracker accumulates across multiple trackContent calls
✅ Threshold analysis correctly identifies normal/warning/critical states:
   - Normal (50%): action=none
   - Warning (75%): action=prepare_handoff
   - Critical (90%): action=force_return

## Success Criteria Met
- [x] Token estimation works (text.length / 4)
- [x] Context tracker accumulates chars and computes usage
- [x] Threshold analysis returns correct action for normal/warning/critical states
- [x] All exports accessible from src/context/index.ts

## Technical Notes

### Token Estimation Formula
- Uses industry-standard approximation: 1 token ≈ 4 characters
- Always rounds up (Math.ceil) to avoid underestimation

### Threshold Behavior
- **Normal (< 70%)**: action='none'
- **Warning (70-85%)**: action='prepare_handoff', isWarning=true
- **Critical (≥ 85%)**: action='force_return', isCritical=true

### Context Limits
- Default: 200K tokens (Claude standard)
- Extended: 1M tokens (if ANTHROPIC_1M_CONTEXT env var set)
- Configurable via ContextConfig

## Next Steps
This foundation enables:
- Plan 10-02: Context Monitor (file persistence, state tracking)
- Plan 10-03: Context Handoff (subagent coordination)
- Integration with existing orchestration/agent modules
