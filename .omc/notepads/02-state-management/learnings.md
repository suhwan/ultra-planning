
## Event System Implementation (Plan 02-02)

### Patterns Discovered

1. **Synchronous I/O for Predictability**
   - Used synchronous fs operations throughout
   - Avoids async coordination complexity in agent contexts
   - Acceptable for small state files (< 1000 lines)

2. **JSONL Append Pattern**
   - `writeFileSync(path, jsonLine + '\n', { flag: 'a' })`
   - Atomic appends without locking
   - Line-based format enables efficient polling

3. **Line-Based Polling**
   - Split by '\n', filter empty lines
   - Track lastLine as offset for next poll
   - Only parse JSON for requested range

4. **Event Rotation Strategy**
   - Move to timestamped backup instead of truncation
   - Preserves history for debugging
   - Threshold of 1000 lines prevents unbounded growth

### TypeScript Patterns

1. **Omit<> for Event Creation**
   - `Omit<StateEvent, 'id' | 'timestamp'>` for emitEvent parameter
   - System generates id and timestamp automatically
   - Clean API: user provides only type, source, payload

2. **crypto.randomUUID()**
   - Node.js built-in, no external dependencies
   - Standard UUID v4 format
   - More efficient than external uuid packages

### File Structure

```
.ultraplan/state/
  events.jsonl          # Current event queue
  events.2026-01-26T23-15-32-123Z.jsonl  # Rotated backup
```

### Integration Points

- Types defined in types.ts (StateEvent, EventPollResult)
- Uses STATE_DIR constant from types.ts
- Exports pre-allocated in index.ts by Plan 02-01
- Ready for orchestrator and agent usage

