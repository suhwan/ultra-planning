# Ultra Planning Project

## Unattended Execution Mode

When `/thorough all` or `/thorough from {N}` is running:

**CRITICAL: Do NOT ask user questions. Auto-decide everything.**

### Auto-Response Rules

| Situation | Automatic Decision |
|-----------|-------------------|
| Multiple implementation approaches | Choose simplest |
| Library choice | Use existing in project |
| Naming decisions | Follow existing conventions |
| y/n confirmation prompts | Always `y` |
| 3-option menus | See specific rules below |

### GSD Skill Auto-Responses

| Prompt | Auto-Response |
|--------|---------------|
| "RESEARCH BLOCKED" choices | Skip research and plan anyway |
| "Existing plans" choices | Replan from scratch |
| "Max iterations reached" choices | Force proceed |
| Any "Proceed? (y/n)" | y |
| Any "Overwrite? (y/n)" | y |

### When to Actually Stop

Only stop for:
1. Architect review failed 3x consecutively
2. Build errors unfixable after 3 attempts
3. File system errors (permission denied, disk full)
4. Missing critical dependencies that cannot be auto-installed

### Execution Flags

Use these flags to minimize interruptions:
- `--skip-verify` - Skip verification loops
- `--skip-research` - Skip research phase

### Progress Tracking

After each phase completion:
1. Update ROADMAP.md checkbox `- [ ]` to `- [x]`
2. Commit changes with message: `feat(phase-N): complete {phase-name}`
3. Automatically proceed to next phase
