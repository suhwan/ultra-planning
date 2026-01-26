# Phase 4: OMC Integration - Research

**Researched:** 2026-01-26
**Domain:** Multi-agent orchestration patterns (ralplan, Ultrapilot, Magic Keywords)
**Confidence:** HIGH

## Summary

Phase 4 integrates OMC (oh-my-claudecode) core orchestration patterns into ultra-planning. This includes the ralplan verification loop (Planner+Architect+Critic iteration), Ultrapilot 5-worker parallel execution, file ownership tracking, and magic keyword detection for automatic mode activation.

Research examined the OMC reference implementation at `references/oh-my-claudecode/` including TypeScript source code, markdown commands, and agent prompts. The patterns are well-established with clear interfaces, file-based state management, and comprehensive type definitions that align with the existing Phase 2 state management infrastructure.

**Primary recommendation:** Copy and adapt OMC patterns directly rather than reimplementing from scratch. The reference implementation is production-tested and the interfaces align with existing `src/state/` infrastructure.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9.3+ | Type-safe implementation | Project standard from Phase 1 |
| Node.js fs | Built-in | File-based state I/O | OMC pattern uses direct fs |
| Zod | 3.23+ | Schema validation | Existing from Phase 3 |
| uuid | ^11.0.0 | Unique ID generation | Worker/session IDs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| minimatch | ^10.0.0 | Glob pattern matching | File ownership patterns |
| simple-git | ^3.27.0 | Git operations | Already in project from Phase 3 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| File-based state | SQLite | SQLite adds complexity; file-based is simpler for JSON state |
| minimatch | micromatch | Either works; minimatch is lighter |
| uuid v4 | nanoid | uuid is more standard; nanoid is smaller |

**Installation:**
```bash
npm install minimatch uuid
npm install -D @types/minimatch @types/uuid
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── orchestration/
│   ├── types.ts              # RalplanState, UltrapilotState, FileOwnership
│   ├── index.ts              # Re-exports
│   ├── ralplan/
│   │   ├── types.ts          # Ralplan-specific types
│   │   ├── state.ts          # State management functions
│   │   └── orchestrator.ts   # Loop logic
│   ├── ultrapilot/
│   │   ├── types.ts          # Worker, ownership types
│   │   ├── state.ts          # State persistence
│   │   ├── ownership.ts      # File ownership tracking
│   │   └── coordinator.ts    # Worker spawning/tracking
│   └── keywords/
│       ├── types.ts          # MagicKeyword interface
│       ├── patterns.ts       # Keyword definitions
│       └── processor.ts      # Detection and enhancement
├── agents/
│   ├── prompts/
│   │   ├── planner.ts        # Existing from Phase 3
│   │   ├── architect.ts      # New - READ-ONLY advisor
│   │   └── critic.ts         # New - Plan reviewer
│   └── types.ts              # Extended AgentRole type
```

### Pattern 1: Ralplan Verification Loop
**What:** Planner+Architect+Critic iterate until consensus
**When to use:** Complex planning that needs validation
**Example:**
```typescript
// Source: references/oh-my-claudecode/commands/ralplan.md
interface RalplanState {
  active: boolean;
  mode: 'ralplan';
  iteration: number;
  max_iterations: number;
  plan_path: string;
  current_phase: 'planner_planning' | 'architect_consultation' | 'critic_review' | 'handling_verdict' | 'complete';
  started_at: string;
  task_description: string;
}

// Loop: Planner creates plan -> Critic reviews -> OKAY or REJECT
// If REJECT: feedback to Planner, iterate
// Max 5 iterations with forced approval + warning
```

### Pattern 2: Ultrapilot File Ownership
**What:** Exclusive file ownership prevents parallel worker conflicts
**When to use:** When spawning multiple workers on different file sets
**Example:**
```typescript
// Source: references/oh-my-claudecode/src/hooks/ultrapilot/types.ts
interface FileOwnership {
  /** Files owned by coordinator (shared files like package.json) */
  coordinator: string[];
  /** Files owned by each worker (keyed by worker ID) */
  workers: Record<string, string[]>;
  /** Files with conflicts (multiple workers attempted modification) */
  conflicts: string[];
}

// Default shared files that only coordinator can modify
const DEFAULT_SHARED_FILES = [
  'package.json', 'package-lock.json', 'tsconfig.json',
  'jest.config.js', '.gitignore', 'README.md'
];
```

### Pattern 3: Magic Keyword Detection
**What:** Detect keywords in user input and inject enhanced prompts
**When to use:** Auto-activate modes based on natural language triggers
**Example:**
```typescript
// Source: references/oh-my-claudecode/src/features/magic-keywords.ts
interface MagicKeyword {
  triggers: string[];
  action: (prompt: string) => string;
  description: string;
}

// Strip code blocks before detection to avoid false positives
const CODE_BLOCK_PATTERN = /```[\s\S]*?```/g;
const INLINE_CODE_PATTERN = /`[^`]+`/g;

function removeCodeBlocks(text: string): string {
  return text.replace(CODE_BLOCK_PATTERN, '').replace(INLINE_CODE_PATTERN, '');
}

// Check keywords against cleaned text
function detectMagicKeywords(prompt: string): string[] {
  const cleanedPrompt = removeCodeBlocks(prompt);
  // Match against trigger patterns...
}
```

### Anti-Patterns to Avoid
- **Shared file modification without coordination:** Multiple workers writing to same file causes conflicts
- **Infinite ralplan loops:** Always enforce max_iterations (5 recommended)
- **Keyword detection in code blocks:** Strip code blocks before pattern matching
- **Worker timeout without heartbeat:** Workers can stall; implement timeout detection

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File conflict detection | Custom diffing | Exclusive ownership map | Prevents conflicts proactively |
| Keyword matching | Naive string search | OMC pattern with code block stripping | Avoids false positives in code examples |
| State persistence | Custom serialization | Existing StateManager from Phase 2 | Already tested and working |
| Agent prompts | Inline strings | Structured prompt sections | From existing planner.ts pattern |
| Worker ID generation | Random strings | uuid v4 | Guaranteed uniqueness |

**Key insight:** The OMC reference implementation has solved these problems with battle-tested patterns. Copy and adapt rather than reinvent.

## Common Pitfalls

### Pitfall 1: Ralplan Loop Doesn't Terminate
**What goes wrong:** Critic keeps rejecting, Planner keeps revising endlessly
**Why it happens:** No iteration limit enforcement
**How to avoid:**
- Always set `max_iterations: 5`
- After max iterations, force approval with warning message
- Log iteration count prominently
**Warning signs:** Iteration count > 3 without OKAY verdict

### Pitfall 2: File Ownership Conflicts
**What goes wrong:** Two workers modify the same file, causing merge conflicts
**Why it happens:** File ownership not checked before worker assignment
**How to avoid:**
- Build ownership map BEFORE spawning workers
- Validate no file appears in multiple worker ownership lists
- Coordinator owns all shared/config files exclusively
**Warning signs:** `conflicts` array in FileOwnership is non-empty

### Pitfall 3: Magic Keyword False Positives
**What goes wrong:** Code examples trigger mode activation
**Why it happens:** Matching keywords inside code blocks
**How to avoid:**
- Strip code blocks (```) and inline code (`) before detection
- Use word boundary matching (`\b` in regex)
- Test with prompts containing code examples
**Warning signs:** Mode activation when user pastes code snippets

### Pitfall 4: Worker Stale State
**What goes wrong:** Worker crashes, but state shows "running" forever
**Why it happens:** No heartbeat/timeout mechanism
**How to avoid:**
- Implement staleness check (1 hour threshold per OMC pattern)
- Auto-clear stale markers on read
- Log warning when clearing stale state
**Warning signs:** Workers stuck in "running" status for > 10 minutes

### Pitfall 5: Agent Identity Confusion
**What goes wrong:** Architect tries to make changes, Critic tries to plan
**Why it happens:** Unclear role boundaries in prompts
**How to avoid:**
- Clear role constraints at top of each prompt
- Architect: READ-ONLY, no Write/Edit tools
- Critic: Reviews plans only, does not create
- Planner: Creates plans, does not implement
**Warning signs:** Agent output contains code changes instead of analysis

## Code Examples

Verified patterns from official sources:

### Ralplan State Initialization
```typescript
// Source: references/oh-my-claudecode/commands/ralplan.md
const initialState: RalplanState = {
  active: true,
  mode: 'ralplan',
  iteration: 0,
  max_iterations: 5,
  plan_path: `.ultraplan/plans/${featureName}.md`,
  current_phase: 'planner_planning',
  started_at: new Date().toISOString(),
  task_description: userTask
};
```

### Ultrapilot Worker Initialization
```typescript
// Source: references/oh-my-claudecode/src/hooks/ultrapilot/state.ts
function initUltrapilot(
  directory: string,
  task: string,
  subtasks: string[],
  sessionId?: string,
  config?: Partial<UltrapilotConfig>
): UltrapilotState | null {
  // Check mutual exclusion first
  const canStart = canStartMode('ultrapilot', directory);
  if (!canStart.allowed) {
    console.error(canStart.message);
    return null;
  }

  const state: UltrapilotState = {
    active: true,
    iteration: 1,
    maxIterations: config?.maxIterations ?? 3,
    originalTask: task,
    subtasks,
    workers: [],
    ownership: {
      coordinator: config?.sharedFiles ?? DEFAULT_SHARED_FILES,
      workers: {},
      conflicts: []
    },
    startedAt: new Date().toISOString(),
    completedAt: null,
    totalWorkersSpawned: 0,
    successfulWorkers: 0,
    failedWorkers: 0,
    sessionId
  };

  writeUltrapilotState(directory, state);
  return state;
}
```

### Magic Keyword Processor
```typescript
// Source: references/oh-my-claudecode/src/features/magic-keywords.ts
export function createMagicKeywordProcessor(
  config?: PluginConfig['magicKeywords']
): (prompt: string) => string {
  const keywords = [...builtInMagicKeywords];

  return (prompt: string): string => {
    let result = prompt;
    for (const keyword of keywords) {
      const hasKeyword = keyword.triggers.some(trigger => {
        const regex = new RegExp(`\\b${trigger}\\b`, 'i');
        return regex.test(removeCodeBlocks(result));
      });
      if (hasKeyword) {
        result = keyword.action(result);
      }
    }
    return result;
  };
}
```

### Worker File Ownership Assignment
```typescript
// Source: references/oh-my-claudecode/src/hooks/ultrapilot/index.ts
function assignFileOwnership(
  workerId: string,
  filePath: string,
  state: UltrapilotState
): { success: boolean; conflict?: string } {
  // Check if already owned by another worker
  for (const [id, files] of Object.entries(state.ownership.workers)) {
    if (id !== workerId && files.includes(filePath)) {
      return { success: false, conflict: `File ${filePath} already owned by ${id}` };
    }
  }

  // Check if coordinator-owned (shared file)
  if (state.ownership.coordinator.includes(filePath)) {
    return { success: false, conflict: `File ${filePath} is coordinator-owned` };
  }

  // Assign ownership
  if (!state.ownership.workers[workerId]) {
    state.ownership.workers[workerId] = [];
  }
  if (!state.ownership.workers[workerId].includes(filePath)) {
    state.ownership.workers[workerId].push(filePath);
  }

  return { success: true };
}
```

### Agent Prompt Section Pattern
```typescript
// Source: Existing src/agents/prompts/planner.ts pattern
// Adapted for Architect
export const ARCHITECT_SECTIONS: AgentPromptSection[] = [
  {
    name: 'identity',
    tag: 'identity',
    content: `YOU ARE A CONSULTANT. YOU DO NOT IMPLEMENT.

FORBIDDEN ACTIONS (will be blocked):
- Write tool: BLOCKED
- Edit tool: BLOCKED
- Any file modification: BLOCKED

YOU CAN ONLY:
- Read files for analysis
- Search codebase for patterns
- Provide analysis and recommendations`
  },
  {
    name: 'phases',
    tag: 'operational_phases',
    content: `## Phase 1: Context Gathering (MANDATORY)
Before any analysis, gather context via parallel tool calls:
1. Codebase Structure: Use Glob
2. Related Code: Use Grep/Read
3. Dependencies: Check package.json
4. Test Coverage: Find existing tests

## Phase 2: Deep Analysis
After context, perform systematic analysis.

## Phase 3: Recommendation Synthesis
Structure your output with Summary, Diagnosis, Root Cause, Recommendations, Trade-offs, References.`
  }
];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sequential agent calls | Parallel workers with ownership | OMC v3.4 | 3-5x speedup |
| Manual mode switching | Magic keyword auto-detection | OMC v3.0 | Better UX |
| Ad-hoc plan review | Structured Planner+Architect+Critic loop | OMC v3.2 | Higher plan quality |
| Single state file | Mode-specific state files | OMC v3.3 | Better isolation |

**Deprecated/outdated:**
- Global `.omc/state.json` - Replaced by mode-specific files in `.omc/state/`
- Inline agent prompts - Replaced by structured sections with tags

## Integration Points with Existing Codebase

### Phase 2 State Infrastructure
Use existing `src/state/` modules:
- `StateManager` - For reading/writing mode state files
- `EventSystem` - For emitting phase/task events
- `ModeRegistry` - Extend with new modes (ralplan, ultrapilot)
- `CheckpointManager` - For recovery points

### Phase 3 Agent Infrastructure
Extend existing `src/agents/` modules:
- `AgentPromptSection` type - Same pattern for Architect/Critic
- `getFullPrompt()` - Compose prompts from sections
- `AgentRole` type - Add 'architect' | 'critic'

### File Paths
Use consistent naming:
```
.ultraplan/state/ralplan-state.json
.ultraplan/state/ultrapilot-state.json
.ultraplan/state/ultrapilot-ownership.json
```

## Open Questions

Things that couldn't be fully resolved:

1. **Worker Spawning Mechanism**
   - What we know: OMC uses Task tool with `run_in_background: true`
   - What's unclear: How to integrate with Claude Code's actual Task API
   - Recommendation: Implement state tracking assuming external worker spawning; actual spawning done by orchestrator prompt

2. **Keyword Detection Scope**
   - What we know: OMC detects in user prompts
   - What's unclear: Should we detect in PLAN.md content too?
   - Recommendation: Start with user prompt detection only, extend if needed

3. **Architect Consultation Frequency**
   - What we know: Called after Planner if questions exist, or after Critic rejection
   - What's unclear: Should every iteration consult Architect?
   - Recommendation: Only consult when explicitly requested by Planner or Critic feedback

## Sources

### Primary (HIGH confidence)
- `references/oh-my-claudecode/src/hooks/ultrapilot/types.ts` - Worker and ownership type definitions
- `references/oh-my-claudecode/src/hooks/ultrapilot/state.ts` - State management patterns
- `references/oh-my-claudecode/src/features/magic-keywords.ts` - Keyword detection implementation
- `references/oh-my-claudecode/src/hooks/mode-registry/index.ts` - Mode management patterns
- `references/oh-my-claudecode/commands/ralplan.md` - Ralplan workflow specification
- `references/oh-my-claudecode/commands/ultrapilot.md` - Ultrapilot workflow specification
- `references/oh-my-claudecode/agents/architect.md` - Architect agent prompt
- `references/oh-my-claudecode/agents/critic.md` - Critic agent prompt
- `references/oh-my-claudecode/agents/planner.md` - Planner agent prompt (for contrast)

### Secondary (MEDIUM confidence)
- `references/oh-my-claudecode/docs/CLAUDE.md` - High-level architecture documentation
- `references/oh-my-claudecode/CHANGELOG.md` - Feature history and evolution

### Tertiary (LOW confidence)
- None - all findings verified against source code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Directly from reference implementation
- Architecture patterns: HIGH - Verified against working TypeScript code
- Pitfalls: HIGH - Documented in reference code comments and CHANGELOG

**Research date:** 2026-01-26
**Valid until:** 2026-02-26 (30 days - patterns are stable)
