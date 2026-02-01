# /ultraplan:fresh-start

Resume work from a compacted context snapshot.

## Usage

```
/ultraplan:fresh-start [snapshot-id]
```

**Arguments:**
- `snapshot-id` (optional): Specific snapshot to restore. Default: "latest"

## Behavior

1. **Load Snapshot**: Reads compacted context from `.omc/snapshots/`
2. **Inject Context**: Formats preserved information for this session
3. **Show Resume Instructions**: Displays current phase, active task, unresolved issues

## What Gets Restored

- **Architecture Decisions**: Key decisions from previous sessions
- **Unresolved Issues**: Problems that still need attention
- **Current Progress**: Phase, plan, and task state
- **Recent Learnings**: Patterns discovered during execution

## Automatic Trigger

This command runs automatically when:
- Context usage reaches 80%
- AutoCompactionManager triggers compaction
- Orchestrator receives `auto_compaction_complete` event

## Manual Usage

Use when:
- Starting a new session to continue previous work
- Context window is getting full
- Need to reset conversation while preserving progress

## Example

```
/ultraplan:fresh-start 20260201-143022-a1b2
```

Restores specific snapshot and shows resume instructions.

## See Also

- `/ultraplan:execute` - Continue plan execution
- `.omc/snapshots/` - Snapshot storage location
