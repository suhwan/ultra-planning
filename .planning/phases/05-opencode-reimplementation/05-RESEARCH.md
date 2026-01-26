# Phase 5: OpenCode Reimplementation - Research

**Researched:** 2026-01-27
**Domain:** Persistence Loops, Orchestrator Enforcement, Error Recovery
**Confidence:** HIGH

## Summary

This phase adapts two core patterns from oh-my-opencode for Claude Code: the Ralph Loop (persistent execution with error recovery) and Atlas enforcement hooks (orchestrator delegation enforcement, verification reminders). The reference implementation provides OpenCode-specific APIs that must be reimplemented using Claude Code's native mechanisms.

The standard approach is:
1. **Ralph Loop** - File-based state persistence with completion detection via `<promise>TAG</promise>` pattern, session continuation on idle, error recovery via cooldown
2. **Atlas Enforcement** - Tool execution hooks that warn orchestrators when directly modifying files, inject single-task directives to subagents, and append verification reminders after delegation
3. **Error Recovery** - Integration with existing CheckpointManager for git-based rollback on failures

**Primary recommendation:** Adapt the oh-my-opencode patterns using file-based state (existing StateManager) and markdown-based prompt injection, since Claude Code lacks OpenCode's plugin event system. Focus on file-based detection rather than API calls.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Existing StateManager | N/A | State persistence | Already implemented in Phase 2 |
| Existing CheckpointManager | N/A | Git-based rollback | Already implemented in Phase 2 |
| simple-git | ^3.x | Git operations | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fs | Node.js native | File operations | Transcript reading |
| path | Node.js native | Path manipulation | State file paths |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| File-based state | Memory-only | File persistence survives process restarts |
| Markdown state format | JSON | OpenCode uses frontmatter+body, JSON simpler for Claude Code |

**Installation:**
```bash
# No new dependencies required - uses existing stack
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── loops/
│   ├── ralph/
│   │   ├── index.ts         # Main Ralph Loop export
│   │   ├── types.ts         # RalphLoopState, RalphLoopConfig
│   │   ├── state.ts         # Read/write/clear state
│   │   └── detection.ts     # Completion detection
│   └── index.ts             # Re-export
├── hooks/
│   ├── orchestrator/
│   │   ├── index.ts         # Main enforcement export
│   │   ├── types.ts         # Hook types
│   │   ├── file-guard.ts    # Direct modification warning
│   │   ├── single-task.ts   # Single task directive injection
│   │   └── verification.ts  # Verification reminder
│   └── index.ts             # Re-export
└── recovery/
    ├── index.ts             # Error recovery orchestration
    ├── types.ts             # Recovery state types
    └── rollback.ts          # Git rollback integration
```

### Pattern 1: File-Based State Persistence
**What:** Store loop state as JSON file that survives process restarts
**When to use:** Always for Ralph Loop state
**Example:**
```typescript
// Source: Adapted from references/oh-my-opencode/src/hooks/ralph-loop/storage.ts
interface RalphLoopState {
  active: boolean;
  iteration: number;
  maxIterations: number;
  completionPromise: string;
  startedAt: string;
  prompt: string;
  sessionId?: string;
}

// Use existing StateManager
const stateManager = new StateManager<RalphLoopState>('ralph-loop', StateLocation.LOCAL);

function writeState(state: RalphLoopState): boolean {
  return stateManager.write(state).success;
}

function readState(): RalphLoopState | null {
  const result = stateManager.read();
  return result.exists ? result.data : null;
}
```

### Pattern 2: Completion Detection via Promise Tag
**What:** Detect task completion by searching for `<promise>TAG</promise>` pattern
**When to use:** To determine if Ralph Loop should continue or stop
**Example:**
```typescript
// Source: references/oh-my-opencode/src/hooks/ralph-loop/index.ts
const COMPLETION_TAG_PATTERN = /<promise>(.*?)<\/promise>/is;

function detectCompletion(text: string, promise: string): boolean {
  const pattern = new RegExp(`<promise>\\s*${escapeRegex(promise)}\\s*</promise>`, 'is');
  return pattern.test(text);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

### Pattern 3: System Directive Prefix
**What:** Mark system-injected messages with consistent prefix for filtering
**When to use:** All injected prompts, reminders, warnings
**Example:**
```typescript
// Source: references/oh-my-opencode/src/shared/system-directive.ts
const SYSTEM_DIRECTIVE_PREFIX = '[SYSTEM DIRECTIVE: ULTRA-PLANNING';

const SystemDirectiveTypes = {
  RALPH_LOOP: 'RALPH LOOP',
  DELEGATION_REQUIRED: 'DELEGATION REQUIRED',
  SINGLE_TASK_ONLY: 'SINGLE TASK ONLY',
  VERIFICATION_REMINDER: 'VERIFICATION REMINDER',
} as const;

function createSystemDirective(type: string): string {
  return `${SYSTEM_DIRECTIVE_PREFIX} - ${type}]`;
}

function isSystemDirective(text: string): boolean {
  return text.trimStart().startsWith(SYSTEM_DIRECTIVE_PREFIX);
}
```

### Pattern 4: Orchestrator Enforcement Hooks
**What:** Intercept tool calls to enforce delegation-only behavior
**When to use:** When orchestrator (main agent) attempts direct file modifications
**Example:**
```typescript
// Source: Adapted from references/oh-my-opencode/src/hooks/atlas/index.ts
const WRITE_EDIT_TOOLS = ['Write', 'Edit', 'write', 'edit'];
const ALLOWED_PATHS = ['.ultraplan/', '.planning/'];

function shouldWarn(tool: string, filePath: string): boolean {
  if (!WRITE_EDIT_TOOLS.includes(tool)) return false;
  return !ALLOWED_PATHS.some(prefix => filePath.includes(prefix));
}

const DELEGATION_WARNING = `
${createSystemDirective(SystemDirectiveTypes.DELEGATION_REQUIRED)}

**STOP. YOU ARE VIOLATING ORCHESTRATOR PROTOCOL.**

You are attempting to directly modify a file outside .ultraplan/

As an ORCHESTRATOR, you MUST:
1. DELEGATE all implementation work via subagents
2. VERIFY the work done by subagents
3. COORDINATE - you orchestrate, you don't implement
`;
```

### Pattern 5: Verification Reminder Injection
**What:** Append verification checklist after subagent completion
**When to use:** After every delegation returns
**Example:**
```typescript
// Source: references/oh-my-opencode/src/hooks/atlas/index.ts
const VERIFICATION_REMINDER = `
**MANDATORY: WHAT YOU MUST DO RIGHT NOW**

CRITICAL: Subagents FREQUENTLY LIE about completion.

**STEP 1: VERIFY WITH YOUR OWN TOOL CALLS**
1. lsp_diagnostics on changed files -> Must be CLEAN
2. Run tests -> Must PASS
3. Run build/typecheck -> Must succeed
4. Read the actual code -> Must match requirements

**STEP 2: IF VERIFICATION FAILS**
- Resume the SAME session with the ACTUAL error
- Do NOT start fresh

**STEP 3: MARK COMPLETION**
- Update plan checkbox [x]
- Commit atomic unit
`;
```

### Anti-Patterns to Avoid
- **Polling APIs in loops:** OpenCode uses session.messages() API - Claude Code doesn't have this. Use file-based detection instead.
- **Memory-only state:** State must survive process restarts. Always use file persistence.
- **Hard blocking writes:** Use warnings, not blocking. Orchestrator may need small fixes during verification.
- **Batch task delegation:** Always enforce single-task-per-delegation pattern.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State persistence | Custom file format | Existing StateManager | Already tested, atomic writes |
| Git rollback | Manual git commands | Existing CheckpointManager | Handles edge cases |
| Regex escaping | Manual escaping | escapeRegex helper | Easy to miss special chars |
| Event emission | Custom logging | Existing EventSystem | Structured, queryable |

**Key insight:** Phase 2 already built the foundation. Reuse StateManager, EventSystem, and CheckpointManager rather than creating parallel systems.

## Common Pitfalls

### Pitfall 1: Session ID Mismatch
**What goes wrong:** Loop continues in wrong session after restart
**Why it happens:** Session IDs are process-specific in Claude Code
**How to avoid:** Always validate sessionId matches current session before injecting continuation
**Warning signs:** Loop injects prompts into unrelated conversations

### Pitfall 2: Premature Completion Detection
**What goes wrong:** Loop stops before task is actually complete
**Why it happens:** Completion tag appears in instructions, not actual output
**How to avoid:** Only check assistant/tool output, skip user messages (see test case in ralph-loop index.test.ts)
**Warning signs:** Loop completes on first iteration without real work

### Pitfall 3: Recovery Mode Suppression
**What goes wrong:** Loop doesn't resume after error
**Why it happens:** Error recovery flag not reset properly
**How to avoid:** Use cooldown timer (5 seconds default), clear isRecovering flag after timeout
**Warning signs:** Loop silently stops after any error

### Pitfall 4: Orphaned State Files
**What goes wrong:** Old state files cause unexpected behavior in new sessions
**Why it happens:** State not cleared on session deletion
**How to avoid:** Implement session existence check, clear orphaned state
**Warning signs:** New sessions immediately enter loop continuation

### Pitfall 5: Hard Blocking vs Warning
**What goes wrong:** Orchestrator cannot make any direct changes
**Why it happens:** Blocking writes entirely instead of warning
**How to avoid:** Use warnings that inform but don't block. Allow .ultraplan/ and .planning/ paths.
**Warning signs:** Verification fixes fail because orchestrator can't write

## Code Examples

Verified patterns from official sources:

### Ralph Loop State Management
```typescript
// Source: references/oh-my-opencode/src/hooks/ralph-loop/storage.ts
interface RalphLoopState {
  active: boolean;
  iteration: number;
  maxIterations: number;
  completionPromise: string;
  startedAt: string;
  prompt: string;
  sessionId?: string;
}

// Default constants
const DEFAULT_MAX_ITERATIONS = 100;
const DEFAULT_COMPLETION_PROMISE = 'DONE';

function incrementIteration(state: RalphLoopState): RalphLoopState {
  return {
    ...state,
    iteration: state.iteration + 1,
  };
}
```

### Continuation Prompt Template
```typescript
// Source: references/oh-my-opencode/src/hooks/ralph-loop/index.ts
const CONTINUATION_PROMPT = `${createSystemDirective('RALPH LOOP')} {{ITERATION}}/{{MAX}}]

Your previous attempt did not output the completion promise. Continue working on the task.

IMPORTANT:
- Review your progress so far
- Continue from where you left off
- When FULLY complete, output: <promise>{{PROMISE}}</promise>
- Do not stop until the task is truly done

Original task:
{{PROMPT}}`;

function buildContinuationPrompt(state: RalphLoopState): string {
  return CONTINUATION_PROMPT
    .replace('{{ITERATION}}', String(state.iteration))
    .replace('{{MAX}}', String(state.maxIterations))
    .replace('{{PROMISE}}', state.completionPromise)
    .replace('{{PROMPT}}', state.prompt);
}
```

### Single Task Directive
```typescript
// Source: references/oh-my-opencode/src/hooks/atlas/index.ts
const SINGLE_TASK_DIRECTIVE = `
${createSystemDirective('SINGLE TASK ONLY')}

**STOP. READ THIS BEFORE PROCEEDING.**

If you were NOT given **exactly ONE atomic task**, you MUST:
1. **IMMEDIATELY REFUSE** this request
2. **DEMAND** the orchestrator provide a single, specific task

**Your response if multiple tasks detected:**
> "I refuse to proceed. You provided multiple tasks.
> PROVIDE EXACTLY ONE TASK. One file. One change. One verification."

**REFUSE multi-task requests. DEMAND single-task clarity.**
`;
```

### Error Recovery with Checkpoint
```typescript
// Integration with existing CheckpointManager
import { createCheckpoint, rollbackToCheckpoint, getLatestCheckpoint } from '../state/checkpoint.js';

async function handleError(
  phase: string,
  plan: number,
  error: Error
): Promise<boolean> {
  // 1. Log the error
  emitEvent({
    type: 'task_failed',
    payload: { phase, plan, error: error.message },
    source: 'recovery',
  });

  // 2. Get latest checkpoint
  const checkpoint = getLatestCheckpoint();
  if (!checkpoint) {
    return false; // No checkpoint to roll back to
  }

  // 3. Roll back state (NOT source code)
  const result = rollbackToCheckpoint(checkpoint.id);
  if (!result.success) {
    return false;
  }

  // 4. Clear Ralph Loop state to allow retry
  const loopManager = new StateManager<RalphLoopState>('ralph-loop', StateLocation.LOCAL);
  loopManager.clear();

  return true;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OpenCode plugin events | Claude Code file-based | N/A (port) | Must adapt to file detection |
| session.messages() API | File/transcript reading | N/A (port) | No API access in Claude Code |
| TUI toasts | Markdown output | N/A (port) | Output to conversation instead |

**Deprecated/outdated:**
- OpenCode-specific APIs (plugin events, TUI, session API) - must use file-based alternatives

## Integration Points

### With Existing Codebase

| Component | Location | How Phase 5 Uses It |
|-----------|----------|---------------------|
| StateManager | src/state/state-manager.ts | Ralph Loop state persistence |
| EventSystem | src/state/event-system.ts | Error/completion event emission |
| CheckpointManager | src/state/checkpoint.ts | Git-based rollback on failure |
| ModeRegistry | src/state/mode-registry.ts | Track ralph-loop mode active state |

### Event Types to Add
```typescript
// Add to src/state/types.ts StateEventType
| 'ralph_loop_started'
| 'ralph_loop_iteration'
| 'ralph_loop_completed'
| 'ralph_loop_failed'
| 'orchestrator_warning'
| 'verification_required'
```

## Claude Code Adaptations

Key differences from OpenCode implementation:

| OpenCode Pattern | Claude Code Adaptation |
|------------------|------------------------|
| `ctx.client.session.prompt()` | Output continuation text directly |
| `ctx.client.session.messages()` | Read from file/state instead |
| `ctx.client.tui.showToast()` | Output formatted markdown |
| Plugin event hooks | CLAUDE.md instruction injection |
| `tool.execute.before/after` | CLAUDE.md warning text |

### Prompt Injection Strategy

Since Claude Code lacks tool hooks, use CLAUDE.md for instructions:

```markdown
# Orchestrator Enforcement

When acting as orchestrator:
- NEVER write code directly (except .ultraplan/, .planning/)
- ALWAYS delegate via subagents
- ALWAYS verify subagent claims independently
- ALWAYS use single-task delegation

After subagent returns:
1. Run lsp_diagnostics
2. Run tests
3. Run build
4. Read changed files
5. Confirm requirements met
```

## Open Questions

Things that couldn't be fully resolved:

1. **Completion Detection Without API**
   - What we know: OpenCode uses session.messages() API for completion detection
   - What's unclear: Best way to detect completion in Claude Code without API
   - Recommendation: Use file-based detection via state files or output parsing

2. **Session Continuity**
   - What we know: Claude Code sessions don't have stable IDs across restarts
   - What's unclear: How to reliably resume loops after process restart
   - Recommendation: Use state file existence as primary signal, not session ID

3. **Tool Hook Timing**
   - What we know: OpenCode has tool.execute.before/after hooks
   - What's unclear: How to achieve similar interception in Claude Code
   - Recommendation: Use CLAUDE.md instructions + output reminders

## Sources

### Primary (HIGH confidence)
- `references/oh-my-opencode/src/hooks/ralph-loop/` - Full implementation
- `references/oh-my-opencode/src/hooks/atlas/` - Full implementation
- `references/oh-my-opencode/src/shared/system-directive.ts` - Directive pattern
- `src/state/state-manager.ts` - Existing state management
- `src/state/checkpoint.ts` - Existing checkpoint system

### Secondary (MEDIUM confidence)
- `references/oh-my-opencode/src/agents/atlas.ts` - Orchestrator prompt patterns

### Tertiary (LOW confidence)
- Claude Code API capabilities - need validation of actual available APIs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Reuses existing Phase 2 components
- Architecture: HIGH - Clear patterns from OpenCode reference
- Pitfalls: HIGH - Explicit test cases in reference code
- Claude Code adaptation: MEDIUM - Some patterns need validation

**Research date:** 2026-01-27
**Valid until:** 2026-02-27 (30 days - stable patterns)
