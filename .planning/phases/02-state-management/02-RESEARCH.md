# Phase 2: 상태 관리 - Research

**Researched:** 2026-01-26
**Domain:** File-based State Management + Event System + Checkpoint Recovery
**Confidence:** HIGH

## Summary

Phase 2 implements the file-based state sharing system that enables coordination between the orchestrator and subagents. The research validates that the oh-my-claudecode mode-registry pattern is the correct foundation: JSON files in `.ultraplan/state/` with a unified StateManager class providing type-safe read/write operations.

The four plans cover: (1) State Manager for basic read/write operations, (2) Event System for inter-agent communication via file-based polling, (3) Mode Registry for tracking active execution modes and mutual exclusion, and (4) Checkpoint Manager for git-based state persistence and rollback.

Key insight: Events should be implemented as append-only files rather than traditional pub/sub, because Claude Code's execution model doesn't support background processes. Agents poll for new events by reading from a specific line offset.

**Primary recommendation:** Implement the state management system following the OMC StateManager pattern with type-safe generics, then add a simple file-based event queue and git-based checkpoint system.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js fs | Built-in | File operations | Synchronous operations, no external deps |
| TypeScript | ^5.7.x | Type safety | Already in project, strict mode enabled |
| Zod | ^3.23.0 | Runtime validation | Already in project, type inference |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| crypto | Built-in | Session IDs, checksums | UUID generation, file integrity |
| path | Built-in | Path manipulation | Cross-platform path handling |
| child_process | Built-in | Git operations | Checkpoint commits, rollback |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSON files | SQLite (better-sqlite3) | JSON is simpler for basic state; SQLite for complex queries (swarm uses this) |
| File-based events | Redis pub/sub | File-based works without external services; Redis is overkill for this use case |
| Git checkpoints | Custom snapshotting | Git provides atomic commits and built-in rollback; custom is more work |
| sync fs | async fs/promises | Sync is simpler for state operations; async for long-running I/O |

**Installation:**
```bash
# No new dependencies needed - all built-in to Node.js
# Zod already installed from Phase 1
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── state/                 # State management module
│   ├── index.ts           # Re-exports all state utilities
│   ├── types.ts           # State-related type definitions
│   ├── state-manager.ts   # Generic StateManager class
│   ├── event-system.ts    # File-based event queue
│   ├── mode-registry.ts   # Execution mode tracking
│   └── checkpoint.ts      # Git-based checkpoints

.ultraplan/
├── config.json            # Project configuration
├── state/                 # Runtime state files
│   ├── session.json       # Active session state
│   ├── events.jsonl       # Event queue (append-only)
│   └── *.json             # Mode-specific state files
└── checkpoints/           # Checkpoint metadata
    └── *.json             # Checkpoint records
```

### Pattern 1: Generic StateManager Class

**What:** Type-safe wrapper for JSON state files with read/write/update operations.

**When to use:** Any persistent state that needs to be shared between orchestrator and agents.

**Example:**
```typescript
// Source: oh-my-claudecode/src/features/state-manager/index.ts
export class StateManager<T extends Record<string, unknown>> {
  constructor(
    private name: string,
    private location: StateLocation = StateLocation.LOCAL
  ) {}

  read(): StateReadResult<T> {
    const path = getStatePath(this.name, this.location);
    if (!existsSync(path)) {
      return { exists: false };
    }
    const content = readFileSync(path, 'utf-8');
    return { exists: true, data: JSON.parse(content) };
  }

  write(data: T): StateWriteResult {
    ensureStateDir(this.location);
    const path = getStatePath(this.name, this.location);
    writeFileSync(path, JSON.stringify(data, null, 2));
    return { success: true, path };
  }

  update(updater: (current: T | undefined) => T): boolean {
    const current = this.read().data;
    return this.write(updater(current)).success;
  }
}
```

### Pattern 2: File-Based Event Queue

**What:** Append-only JSONL file for inter-agent communication.

**When to use:** When orchestrator needs to signal events to agents or track progress.

**Example:**
```typescript
// Event queue using append-only JSONL
interface StateEvent {
  id: string;
  timestamp: string;
  type: string;
  payload: Record<string, unknown>;
  source: string;
}

function emitEvent(event: Omit<StateEvent, 'id' | 'timestamp'>): void {
  const fullEvent: StateEvent = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...event
  };
  appendFileSync(
    getEventFilePath(),
    JSON.stringify(fullEvent) + '\n'
  );
}

function pollEvents(sinceLineNumber: number): { events: StateEvent[], lastLine: number } {
  const content = readFileSync(getEventFilePath(), 'utf-8');
  const lines = content.trim().split('\n');
  const events = lines.slice(sinceLineNumber).map(line => JSON.parse(line));
  return { events, lastLine: lines.length };
}
```

### Pattern 3: Mode Registry for Mutual Exclusion

**What:** Centralized tracking of active execution modes with conflict detection.

**When to use:** Prevent multiple incompatible modes from running simultaneously.

**Example:**
```typescript
// Source: oh-my-claudecode/src/hooks/mode-registry/index.ts
const MODE_CONFIGS: Record<ExecutionMode, ModeConfig> = {
  planning: {
    name: 'Planning',
    stateFile: 'planning-state.json',
    activeProperty: 'active'
  },
  executing: {
    name: 'Executing',
    stateFile: 'execution-state.json',
    activeProperty: 'active'
  }
};

const EXCLUSIVE_MODES: ExecutionMode[] = ['planning', 'executing'];

function canStartMode(mode: ExecutionMode): CanStartResult {
  for (const exclusive of EXCLUSIVE_MODES) {
    if (exclusive !== mode && isModeActive(exclusive)) {
      return {
        allowed: false,
        blockedBy: exclusive,
        message: `Cannot start ${mode} while ${exclusive} is active`
      };
    }
  }
  return { allowed: true };
}
```

### Pattern 4: Git-Based Checkpoints

**What:** Create git commits as recovery points, enable rollback via git reset.

**When to use:** Before risky operations, after successful task completion.

**Example:**
```typescript
// Checkpoint using git commits
interface Checkpoint {
  id: string;
  commitHash: string;
  createdAt: string;
  phase: string;
  plan: number;
  description: string;
}

function createCheckpoint(phase: string, plan: number, description: string): Checkpoint {
  const hash = execSync('git rev-parse HEAD').toString().trim();

  // Commit current state
  execSync('git add .ultraplan/state/');
  execSync(`git commit -m "checkpoint(${phase}/${plan}): ${description}" --allow-empty`);

  const newHash = execSync('git rev-parse HEAD').toString().trim();

  return {
    id: crypto.randomUUID(),
    commitHash: newHash,
    createdAt: new Date().toISOString(),
    phase,
    plan,
    description
  };
}

function rollbackToCheckpoint(checkpoint: Checkpoint): boolean {
  execSync(`git reset --hard ${checkpoint.commitHash}`);
  return true;
}
```

### Anti-Patterns to Avoid

- **Async state operations:** Claude Code runs synchronously; use sync fs for predictability.
- **In-memory caching without file backing:** All state must be file-backed for crash recovery.
- **Multiple writers to same file:** Use atomic writes or file locks for concurrent access.
- **Polling without offset tracking:** Always track last-read position to avoid re-processing events.
- **Storing secrets in state files:** State files may be committed to git; no API keys or tokens.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON parsing with validation | Manual try/catch | Zod schemas | Type inference + runtime validation |
| Unique IDs | Math.random() | crypto.randomUUID() | Cryptographically secure, built-in |
| Directory creation | Check + create | mkdirSync({ recursive: true }) | Atomic, handles nested |
| Git command execution | shell interpolation | execSync with array args | Prevents injection |
| ISO timestamps | manual formatting | new Date().toISOString() | Standard format |

**Key insight:** Node.js built-ins cover all requirements. No external dependencies needed beyond what's already installed.

## Common Pitfalls

### Pitfall 1: State File Corruption During Write

**What goes wrong:** Partial writes leave corrupted JSON that breaks subsequent reads.

**Why it happens:** Power failure or crash during writeFileSync.

**How to avoid:**
- Write to temp file first, then atomic rename
- Or: validate JSON can be parsed immediately after write
- Pattern: `writeFileSync(path + '.tmp', data); renameSync(path + '.tmp', path);`

**Warning signs:** "Unexpected token" JSON parse errors after restart.

### Pitfall 2: Event Queue Growing Unbounded

**What goes wrong:** Events.jsonl grows indefinitely, slowing reads.

**Why it happens:** Never truncating old events.

**How to avoid:**
- Rotate event file when it exceeds threshold (e.g., 1000 lines)
- Or: archive old events to timestamped files
- Track high-water mark for cleanup

**Warning signs:** Slow pollEvents performance, large file size.

### Pitfall 3: Race Conditions in Mode Registry

**What goes wrong:** Two processes check mode simultaneously, both start.

**Why it happens:** Check-then-act without locking.

**How to avoid:**
- Use marker files with process ID
- Check for stale markers (older than threshold)
- Pattern from OMC: 1-hour stale marker threshold

**Warning signs:** Multiple modes running when exclusive.

### Pitfall 4: Git Checkpoint Without Clean Working Directory

**What goes wrong:** Checkpoint commits include unrelated changes.

**Why it happens:** User has uncommitted work when checkpoint is created.

**How to avoid:**
- Only commit .ultraplan/state/ directory
- Use `git add .ultraplan/state/` not `git add .`
- Document that checkpoints don't include source code changes

**Warning signs:** Large unexpected diffs in checkpoint commits.

### Pitfall 5: Missing State Directory

**What goes wrong:** First write fails with ENOENT.

**Why it happens:** .ultraplan/state/ doesn't exist yet.

**How to avoid:**
- Always call ensureStateDir() before any write
- Or: use mkdirSync with recursive in write path
- Initialize directory in project setup

**Warning signs:** ENOENT errors on first state write.

## Code Examples

Verified patterns from oh-my-claudecode:

### StateManager Types (src/state/types.ts)

```typescript
// Source: oh-my-claudecode/src/features/state-manager/types.ts

export enum StateLocation {
  /** Local project state: .ultraplan/state/{name}.json */
  LOCAL = 'local',
  /** Global user state: ~/.ultraplan/state/{name}.json */
  GLOBAL = 'global'
}

export interface StateReadResult<T = unknown> {
  exists: boolean;
  data?: T;
  foundAt?: string;
}

export interface StateWriteResult {
  success: boolean;
  path: string;
  error?: string;
}

export interface StateClearResult {
  removed: string[];
  notFound: string[];
  errors: Array<{ path: string; error: string }>;
}
```

### Mode Config Types (src/state/types.ts)

```typescript
// Source: oh-my-claudecode/src/hooks/mode-registry/types.ts

export interface ModeConfig {
  /** Display name for the mode */
  name: string;
  /** Primary state file path (relative to .ultraplan/state/) */
  stateFile: string;
  /** Alternative/marker file path */
  markerFile?: string;
  /** Property to check in JSON state */
  activeProperty?: string;
  /** Whether mode has global state */
  hasGlobalState?: boolean;
}

export interface ModeStatus {
  mode: ExecutionMode;
  active: boolean;
  stateFilePath: string;
}

export interface CanStartResult {
  allowed: boolean;
  blockedBy?: ExecutionMode;
  message?: string;
}
```

### Event Types (src/state/types.ts)

```typescript
// Custom design for Ultra Planner event system

export interface StateEvent {
  id: string;
  timestamp: string;
  type: StateEventType;
  payload: Record<string, unknown>;
  source: string; // 'orchestrator' | 'agent:{name}'
}

export type StateEventType =
  | 'plan_started'
  | 'plan_completed'
  | 'plan_failed'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'checkpoint_created'
  | 'rollback_initiated'
  | 'mode_changed';

export interface EventPollResult {
  events: StateEvent[];
  lastLine: number;
  hasMore: boolean;
}
```

### Checkpoint Types (src/state/types.ts)

```typescript
// Custom design for Ultra Planner checkpoint system

export interface Checkpoint {
  id: string;
  commitHash: string;
  createdAt: string;
  phase: string;
  plan: number;
  wave: number;
  description: string;
  stateSnapshot: Record<string, unknown>;
}

export interface CheckpointCreateResult {
  success: boolean;
  checkpoint?: Checkpoint;
  error?: string;
}

export interface RollbackResult {
  success: boolean;
  rolledBackTo?: Checkpoint;
  error?: string;
}
```

### Directory Constants

```typescript
// Paths relative to project root
export const STATE_DIR = '.ultraplan/state';
export const CHECKPOINT_DIR = '.ultraplan/checkpoints';
export const EVENT_FILE = 'events.jsonl';

// Thresholds
export const STALE_MARKER_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
export const EVENT_FILE_MAX_LINES = 1000;
export const CHECKPOINT_RETAIN_COUNT = 10;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Database state | File-based JSON | Claude Code launch (2024) | Simpler, git-friendly |
| Message queue events | Append-only files | Claude Code architecture | No external services needed |
| Custom snapshotting | Git commits | Git maturity | Built-in rollback, history |
| Async state operations | Sync operations | Claude Code model | Predictable execution |

**Deprecated/outdated:**
- Redis/message brokers: Overkill for single-machine Claude Code
- SQLite for basic state: JSON files are sufficient; SQLite reserved for complex queries (swarm)
- Async fs/promises for state: Use sync for predictability in Claude Code's execution model

## Open Questions

1. **Event file rotation strategy**
   - What we know: File grows unbounded without rotation
   - What's unclear: Optimal threshold and rotation method
   - Recommendation: Rotate at 1000 lines, archive with timestamp suffix. Implement in Phase 2 Plan 2.

2. **Concurrent agent access to state**
   - What we know: Multiple agents may read/write simultaneously
   - What's unclear: Frequency and severity of race conditions
   - Recommendation: Start with simple file-per-mode pattern; add locking if issues arise.

3. **Checkpoint scope**
   - What we know: Git commits are the mechanism
   - What's unclear: Should checkpoints include source code or just state?
   - Recommendation: Checkpoints commit .ultraplan/state/ only. Source changes are separate commits.

4. **Global vs local state**
   - What we know: OMC supports both ~/.omc/state/ and .omc/state/
   - What's unclear: Which state should be global in Ultra Planner
   - Recommendation: Start with local only (.ultraplan/state/). Add global later if needed.

## Sources

### Primary (HIGH confidence)

- [oh-my-claudecode/src/features/state-manager/](verified) - StateManager class patterns
- [oh-my-claudecode/src/features/state-manager/types.ts](verified) - State type definitions
- [oh-my-claudecode/src/hooks/mode-registry/index.ts](verified) - Mode registry implementation
- [oh-my-claudecode/src/hooks/mode-registry/types.ts](verified) - Mode registry types
- [oh-my-claudecode/src/hooks/autopilot/state.ts](verified) - Autopilot state patterns
- [oh-my-claudecode/src/hooks/ultrapilot/state.ts](verified) - Ultrapilot state patterns

### Secondary (MEDIUM confidence)

- [oh-my-claudecode/src/hooks/swarm/state.ts](verified) - SQLite alternative for complex state
- [oh-my-claudecode/src/hooks/recovery/](verified) - Recovery and rollback patterns

### Tertiary (LOW confidence)

- Git checkpoint strategy is custom design based on OMC rollback mentions; needs validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All built-in Node.js, proven in OMC
- Architecture: HIGH - Direct patterns from oh-my-claudecode codebase
- Event system: MEDIUM - Custom design, inspired by OMC but not directly copied
- Checkpoints: MEDIUM - Custom design using git; requires testing

**Research date:** 2026-01-26
**Valid until:** 2026-02-26 (30 days - stable domain, patterns from production OMC)
