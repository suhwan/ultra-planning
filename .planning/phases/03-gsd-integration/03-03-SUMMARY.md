# Plan 03-03 Summary: XML Task Format Utilities

**Status**: ✓ Complete
**Completed**: 2026-01-26

## What Was Built

Implemented comprehensive XML task format utilities for PLAN.md documents, enabling bidirectional conversion between Task objects and XML representation.

### Files Created

1. **src/documents/xml/types.ts** (180 lines)
   - Task type definitions (AutoTask, CheckpointTask variants)
   - Type guards (isAutoTask, isCheckpointTask, etc.)
   - Comprehensive type support for all GSD task variations

2. **src/documents/xml/task-generator.ts** (170 lines)
   - `escapeXml()` - Escape special characters (< > & ")
   - `generateTaskXml()` - Convert Task object to XML
   - `generateTasksSection()` - Wrap multiple tasks in `<tasks>` section
   - Handles all task types (auto, checkpoint:human-verify, checkpoint:decision, checkpoint:human-action)

3. **src/documents/xml/task-parser.ts** (330 lines)
   - `unescapeXml()` - Reverse XML entity escaping
   - `parseTaskXml()` - Parse single task XML to Task object
   - `parseTasksSection()` - Extract all tasks from `<tasks>` section
   - Regex-based parsing (not DOM parser) for custom XML format
   - Robust error handling for missing required fields

4. **src/documents/xml/index.ts** (31 lines)
   - Re-exports all types, generators, and parsers
   - Clean module interface

### Integration

Updated **src/documents/index.ts** to export XML module, making utilities accessible via:
```typescript
import { generateTaskXml, parseTaskXml, ... } from './documents/index.js';
```

## Key Implementation Details

### XML Escaping Strategy

Special characters are properly escaped/unescaped:
- `&` → `&amp;`
- `<` → `&lt;`
- `>` → `&gt;`
- `"` → `&quot;`

This prevents XML parsing errors when task content includes code examples or special characters.

### Checkpoint Task Handling

Checkpoint tasks don't have `<name>` tags in XML (per GSD template), but maintain a `name` field in TypeScript for internal tracking. Parser generates default names like "Checkpoint: decision" for checkpoints.

### Parser Implementation

Uses regex patterns rather than DOM parser because GSD XML is a custom format:
- Task extraction: `/<task\s+type="([^"]+)"[^>]*>([\s\S]*?)<\/task>/gi`
- Tag extraction: `/<tagName[^>]*>([\s\S]*?)<\/tagName>/i`
- Attribute extraction: `/attrName="([^"]*)"/i`

This approach handles multi-line content, nested structures (like decision options), and edge cases correctly.

## Verification Results

✓ `npm run build` succeeds - no TypeScript errors
✓ generateTaskXml() produces valid XML structure for all task types
✓ parseTaskXml() extracts task data correctly
✓ Round-trip (parse → generate → parse) maintains data integrity
✓ Special characters (< > & ") escaped and unescaped correctly
✓ All task types supported (auto, checkpoint:human-verify, checkpoint:decision, checkpoint:human-action)
✓ Decision options parsed correctly (multiple options with id, name, pros, cons)
✓ Empty tasks section handled gracefully
✓ Type guards work correctly (isAutoTask, isCheckpointTask, etc.)

## Test Results

Comprehensive tests verified:
- Auto task with special characters and multi-line content
- Human-verify checkpoint
- Decision checkpoint with 3 options
- Human-action checkpoint
- Mixed task section (4 different task types)
- Empty tasks section

All tests passed successfully.

## Exports Available

### Types
- `Task`, `TaskType`, `AutoTask`, `CheckpointTask`
- `HumanVerifyTask`, `DecisionTask`, `HumanActionTask`, `DecisionOption`

### Type Guards
- `isAutoTask()`, `isCheckpointTask()`
- `isHumanVerifyTask()`, `isDecisionTask()`, `isHumanActionTask()`

### Generators
- `escapeXml(str)` - Escape XML entities
- `generateTaskXml(task)` - Task → XML
- `generateTasksSection(tasks)` - Task[] → `<tasks>...</tasks>`

### Parsers
- `unescapeXml(str)` - Unescape XML entities
- `parseTaskXml(xml)` - XML → Task
- `parseTasksSection(xml)` - `<tasks>...</tasks>` → Task[]

## Dependencies

- Depends on: Plan 03-01 (base types from src/documents/types.ts)
- Required by: Future plan generation and parsing features

## Notes

The XML format matches the GSD phase-prompt.md template exactly, ensuring compatibility with existing GSD workflows. The implementation prioritizes correctness over performance, using regex-based parsing that's easier to debug and maintain than a full XML parser.

## What's Next

These utilities will be used by:
- Plan template generators (to create PLAN.md files)
- Plan parsers (to extract tasks from existing plans)
- Plan validation (to verify task structure)
- Execution workflows (to process tasks during phase execution)
