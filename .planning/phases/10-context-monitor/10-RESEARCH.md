# Phase 10: Context Monitor - Research

**Researched:** 2026-01-27
**Domain:** Claude Code subagent context management, file-based state polling, checkpoint handoff
**Confidence:** HIGH

## Summary

Phase 10 implements context window monitoring for Claude Code subagents. Unlike direct API token counting, this is about:
1. **Estimating** context usage within subagents using `text.length / 4`
2. **Detecting** thresholds (70% = prepare handoff, 85% = force return)
3. **Implementing** a structured checkpoint return pattern for graceful handoff
4. **Orchestrator polling** subagent state files to detect when handoff is needed

The codebase already has robust patterns to build upon:
- `StateManager` for file-based state persistence with atomic writes
- `EventSystem` for JSONL-based event queuing
- `Checkpoint` system for state snapshots
- Mode-registry patterns for state file polling

**Primary recommendation:** Use the existing `StateManager` and `EventSystem` patterns. Add a `ContextMonitor` state file that subagents update, and the orchestrator polls. The checkpoint return structure should be a JSON file with completed/remaining/context sections.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js fs | Built-in | File-based state | Already used throughout codebase |
| Node.js path | Built-in | Path manipulation | Consistent with existing patterns |
| uuid | 11.x | Unique checkpoint IDs | Already in use (v4 for worker IDs) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | 3.23+ | Schema validation | Validate checkpoint return structure |
| simple-git | 3.27+ | Git operations | Checkpoint commits (already used) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| File polling | WebSocket | File polling is simpler, no extra server |
| JSONL events | SQLite | JSONL is simpler, easier debugging |
| text.length/4 | tiktoken | tiktoken adds dependency, /4 is good enough |

**Installation:**
```bash
# No new dependencies needed - uses existing packages
```

## Architecture Patterns

### Recommended Project Structure
```
src/context/
├── types.ts               # ContextState, CheckpointReturn, Thresholds
├── estimator.ts           # Token estimation (text.length / 4)
├── monitor.ts             # ContextMonitor class
├── thresholds.ts          # Threshold detection and actions
├── checkpoint-return.ts   # Checkpoint return structure
└── index.ts               # Public exports

src/orchestration/context-polling/
├── types.ts               # PollingState, SubagentStatus
├── poller.ts              # File watcher for subagent states
└── index.ts               # Public exports
```

### Pattern 1: Token Estimation (text.length / 4)
**What:** Approximate token count from character length
**When to use:** Every time context content is tracked
**Example:**
```typescript
// Source: references/oh-my-claudecode/src/hooks/preemptive-compaction/constants.ts
export const CHARS_PER_TOKEN = 4;
export const CLAUDE_DEFAULT_CONTEXT_LIMIT = 200_000; // or 1M if env var set

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function getUsageRatio(totalChars: number): number {
  const tokens = estimateTokens(totalChars.toString().length > 0 ? 'x'.repeat(totalChars) : '');
  // Actually: just do totalChars / CHARS_PER_TOKEN / CONTEXT_LIMIT
  return (totalChars / CHARS_PER_TOKEN) / CLAUDE_DEFAULT_CONTEXT_LIMIT;
}
```

### Pattern 2: Cumulative Context Tracking
**What:** Track accumulated context across tool calls
**When to use:** In subagent to monitor own context usage
**Example:**
```typescript
// Source: references/oh-my-claudecode/src/hooks/preemptive-compaction/index.ts
interface ContextState {
  sessionId: string;
  estimatedTokens: number;
  lastUpdated: string;
  usageRatio: number;
  thresholdStatus: 'normal' | 'warning' | 'critical';
}

const sessionStates = new Map<string, {
  estimatedTokens: number;
  lastWarningTime: number;
  warningCount: number;
}>();

function trackToolOutput(sessionId: string, responseText: string): void {
  const state = sessionStates.get(sessionId) ?? {
    estimatedTokens: 0,
    lastWarningTime: 0,
    warningCount: 0
  };

  const responseTokens = estimateTokens(responseText);
  state.estimatedTokens += responseTokens;

  sessionStates.set(sessionId, state);
}
```

### Pattern 3: Threshold-Based Actions
**What:** Different actions at 70% and 85% thresholds
**When to use:** After each context update
**Example:**
```typescript
// Source: references/oh-my-claudecode/src/hooks/preemptive-compaction/constants.ts
export const WARNING_THRESHOLD = 0.70;   // 70% - prepare handoff
export const CRITICAL_THRESHOLD = 0.85;  // 85% - force return

// NOT 85%/95% from OMC - those are for compaction warnings
// Our thresholds are for graceful handoff preparation

interface ThresholdAction {
  action: 'none' | 'prepare_handoff' | 'force_return';
  message: string;
}

export function analyzeContextUsage(usageRatio: number): ThresholdAction {
  if (usageRatio >= CRITICAL_THRESHOLD) {
    return {
      action: 'force_return',
      message: 'Context critical - initiating checkpoint return'
    };
  }

  if (usageRatio >= WARNING_THRESHOLD) {
    return {
      action: 'prepare_handoff',
      message: 'Context warning - complete current task and prepare handoff'
    };
  }

  return { action: 'none', message: 'Context normal' };
}
```

### Pattern 4: Checkpoint Return Structure
**What:** Structured handoff data for continuation
**When to use:** When subagent reaches critical threshold
**Example:**
```typescript
// Source: Based on ROADMAP.md checkpoint pattern
interface CheckpointReturn {
  /** Items completed by this subagent */
  completed: CompletedItem[];
  /** Items remaining for next subagent */
  remaining: RemainingItem[];
  /** Context to preserve across handoff */
  context: HandoffContext;
}

interface CompletedItem {
  file: string;
  status: 'done' | 'partial';
  tests?: 'passed' | 'skipped' | 'failed';
  notes?: string;
}

interface RemainingItem {
  file: string;
  description: string;
  referencePattern?: string; // e.g., "utils.ts:15-30 error handling"
}

interface HandoffContext {
  /** Key architectural decisions made */
  decisions: string[];
  /** Code patterns to follow */
  patterns: string[];
  /** Issues encountered */
  issues?: string[];
  /** Files modified (for dependency tracking) */
  filesModified: string[];
}
```

### Pattern 5: File-Based State Polling
**What:** Orchestrator polls subagent state files
**When to use:** Orchestrator monitoring subagent health
**Example:**
```typescript
// Source: references/oh-my-claudecode/src/hooks/mode-registry/index.ts pattern
const SUBAGENT_STATE_DIR = '.ultraplan/state/subagents';
const POLL_INTERVAL_MS = 5000; // 5 seconds

interface SubagentState {
  agentId: string;
  active: boolean;
  contextUsage: number;
  thresholdStatus: 'normal' | 'warning' | 'critical';
  checkpoint?: CheckpointReturn;
  lastHeartbeat: string;
}

export function pollSubagentState(agentId: string): SubagentState | null {
  const stateFile = join(SUBAGENT_STATE_DIR, `${agentId}.json`);

  if (!existsSync(stateFile)) {
    return null;
  }

  try {
    const content = readFileSync(stateFile, 'utf-8');
    return JSON.parse(content) as SubagentState;
  } catch {
    return null;
  }
}

export function isSubagentNeedingHandoff(state: SubagentState): boolean {
  return state.thresholdStatus === 'critical' ||
         state.checkpoint !== undefined;
}
```

### Anti-Patterns to Avoid
- **Rushing at 70%**: The 70% threshold is for PREPARING clean handoff, not rushing to complete everything
- **Direct API token counting**: We cannot access Claude API token counts from Claude Code - use estimation
- **Blocking file watches**: Use polling, not fs.watch (simpler, more reliable cross-platform)
- **Complex state machines**: Keep it simple - normal/warning/critical states are enough

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file writes | Manual temp file + rename | StateManager.write() | Already handles atomicity |
| Event emission | Custom pub/sub | EventSystem.emitEvent() | JSONL pattern proven |
| Checkpoint persistence | Custom JSON | StateManager + Checkpoint | Existing patterns |
| UUID generation | Math.random | uuid v4 | Proper randomness |
| State polling | fs.watch | setInterval + readFile | More reliable |

**Key insight:** The codebase already has StateManager, EventSystem, and Checkpoint patterns that handle file-based state correctly. Reuse these.

## Common Pitfalls

### Pitfall 1: Confusing API Tokens with Context Estimation
**What goes wrong:** Trying to get actual token counts from Claude API
**Why it happens:** Other systems have API access to token usage
**How to avoid:** Claude Code subagents estimate via text.length / 4
**Warning signs:** Looking for "usage" or "tokens" in API responses

### Pitfall 2: Rushing at Warning Threshold
**What goes wrong:** Agent rushes to complete at 70%, producing low-quality work
**Why it happens:** Treating warning as "hurry up" instead of "prepare handoff"
**How to avoid:** At 70%, complete current task normally, then prepare checkpoint
**Warning signs:** Quality degradation, incomplete implementations

### Pitfall 3: Stale State Files
**What goes wrong:** Orchestrator reads stale state from crashed subagent
**Why it happens:** Subagent crashes without cleanup
**How to avoid:** Check lastHeartbeat timestamp, use STALE_MARKER_THRESHOLD_MS
**Warning signs:** Orchestrator waiting on inactive subagent

### Pitfall 4: Checkpoint Too Large
**What goes wrong:** Checkpoint data itself uses significant context
**Why it happens:** Including too much detail in checkpoint
**How to avoid:** Keep checkpoint focused: files, decisions, patterns (not full content)
**Warning signs:** Checkpoint return > 1000 tokens

### Pitfall 5: Polling Too Frequently
**What goes wrong:** Excessive file I/O, CPU usage
**Why it happens:** Aggressive polling interval
**How to avoid:** 5-second polling interval is sufficient
**Warning signs:** High I/O wait, CPU spikes

## Code Examples

Verified patterns from official sources:

### Token Estimation with Cumulative Tracking
```typescript
// Source: references/oh-my-claudecode/src/hooks/preemptive-compaction/index.ts
export const CHARS_PER_TOKEN = 4;
export const CONTEXT_LIMIT = 200_000;

export interface ContextUsageResult {
  totalTokens: number;
  usageRatio: number;
  isWarning: boolean;
  isCritical: boolean;
  action: 'none' | 'prepare_handoff' | 'force_return';
}

export function analyzeContextUsage(
  cumulativeChars: number,
  warningThreshold = 0.70,
  criticalThreshold = 0.85
): ContextUsageResult {
  const totalTokens = Math.ceil(cumulativeChars / CHARS_PER_TOKEN);
  const usageRatio = totalTokens / CONTEXT_LIMIT;

  const isWarning = usageRatio >= warningThreshold;
  const isCritical = usageRatio >= criticalThreshold;

  let action: 'none' | 'prepare_handoff' | 'force_return' = 'none';
  if (isCritical) {
    action = 'force_return';
  } else if (isWarning) {
    action = 'prepare_handoff';
  }

  return { totalTokens, usageRatio, isWarning, isCritical, action };
}
```

### Subagent State File Structure
```typescript
// Source: Based on OMC mode-registry + ultrapilot patterns
import { StateManager } from '../state/state-manager.js';
import { StateLocation } from '../state/types.js';

export interface SubagentContextState extends Record<string, unknown> {
  agentId: string;
  sessionId: string;
  active: boolean;
  startedAt: string;
  lastHeartbeat: string;

  // Context tracking
  cumulativeChars: number;
  estimatedTokens: number;
  usageRatio: number;
  thresholdStatus: 'normal' | 'warning' | 'critical';

  // Task progress
  currentTask?: string;
  tasksCompleted: number;
  tasksTotal: number;

  // Checkpoint (set when critical threshold reached)
  checkpoint?: CheckpointReturn;
}

export function createSubagentStateManager(agentId: string) {
  return new StateManager<SubagentContextState>(
    `subagents/${agentId}`,
    StateLocation.LOCAL
  );
}
```

### Orchestrator Polling Loop
```typescript
// Source: Based on OMC swarm heartbeat pattern
const POLL_INTERVAL_MS = 5000;
const STALE_THRESHOLD_MS = 60 * 1000; // 1 minute

export interface PollResult {
  agentId: string;
  status: 'active' | 'stale' | 'checkpoint_ready' | 'not_found';
  checkpoint?: CheckpointReturn;
}

export function pollSubagent(agentId: string): PollResult {
  const manager = createSubagentStateManager(agentId);
  const result = manager.read();

  if (!result.exists || !result.data) {
    return { agentId, status: 'not_found' };
  }

  const state = result.data;

  // Check for stale heartbeat
  const lastHeartbeat = new Date(state.lastHeartbeat).getTime();
  const age = Date.now() - lastHeartbeat;

  if (age > STALE_THRESHOLD_MS) {
    return { agentId, status: 'stale' };
  }

  // Check for checkpoint
  if (state.checkpoint) {
    return {
      agentId,
      status: 'checkpoint_ready',
      checkpoint: state.checkpoint
    };
  }

  return { agentId, status: 'active' };
}

export function startPollingLoop(
  agentIds: string[],
  onCheckpoint: (agentId: string, checkpoint: CheckpointReturn) => void
): NodeJS.Timeout {
  return setInterval(() => {
    for (const agentId of agentIds) {
      const result = pollSubagent(agentId);

      if (result.status === 'checkpoint_ready' && result.checkpoint) {
        onCheckpoint(agentId, result.checkpoint);
      }
    }
  }, POLL_INTERVAL_MS);
}
```

### Checkpoint Return Builder
```typescript
// Source: Based on ROADMAP.md checkpoint pattern
export class CheckpointReturnBuilder {
  private completed: CompletedItem[] = [];
  private remaining: RemainingItem[] = [];
  private context: HandoffContext = {
    decisions: [],
    patterns: [],
    filesModified: []
  };

  addCompleted(item: CompletedItem): this {
    this.completed.push(item);
    return this;
  }

  addRemaining(item: RemainingItem): this {
    this.remaining.push(item);
    return this;
  }

  addDecision(decision: string): this {
    this.context.decisions.push(decision);
    return this;
  }

  addPattern(pattern: string): this {
    this.context.patterns.push(pattern);
    return this;
  }

  addFileModified(file: string): this {
    if (!this.context.filesModified.includes(file)) {
      this.context.filesModified.push(file);
    }
    return this;
  }

  build(): CheckpointReturn {
    return {
      completed: this.completed,
      remaining: this.remaining,
      context: this.context
    };
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| API token counting | text.length / 4 estimation | N/A (Claude Code constraint) | Simpler, no API dependency |
| fs.watch | setInterval polling | Common practice | More reliable cross-platform |
| Complex state machines | Simple threshold checks | N/A | Easier debugging |

**Deprecated/outdated:**
- tiktoken: Adds dependency for minimal accuracy improvement
- Compaction-based approach: Claude Code cannot trigger compaction programmatically

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal Polling Interval**
   - What we know: 5 seconds is common practice
   - What's unclear: Performance impact with many subagents
   - Recommendation: Start with 5s, make configurable

2. **Context Limit Detection**
   - What we know: Default is 200K, can be 1M with env var
   - What's unclear: How to detect actual limit at runtime
   - Recommendation: Read ANTHROPIC_1M_CONTEXT env var, default to 200K

3. **Checkpoint Size Limits**
   - What we know: Should be focused, not verbose
   - What's unclear: Exact size threshold for "too big"
   - Recommendation: Warn if checkpoint > 4000 chars (~1000 tokens)

## Sources

### Primary (HIGH confidence)
- references/oh-my-claudecode/src/hooks/preemptive-compaction/ - Token estimation, thresholds
- references/oh-my-opencode/src/hooks/context-window-monitor.ts - Context monitoring pattern
- references/oh-my-claudecode/src/hooks/mode-registry/ - State file polling pattern
- src/state/state-manager.ts - Existing StateManager implementation
- src/state/event-system.ts - Existing EventSystem implementation

### Secondary (MEDIUM confidence)
- references/oh-my-claudecode/src/hooks/ultrapilot/state.ts - Worker state patterns
- references/oh-my-claudecode/src/hooks/swarm/index.ts - Heartbeat/polling patterns

### Tertiary (LOW confidence)
- N/A - All findings verified with codebase references

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses only existing dependencies
- Architecture: HIGH - Based on proven OMC patterns
- Pitfalls: HIGH - Documented in existing implementations
- Token estimation: HIGH - text.length/4 used in production

**Research date:** 2026-01-27
**Valid until:** 2026-02-27 (30 days - stable patterns)
