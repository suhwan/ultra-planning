# Phase 7: CLI/슬래시 커맨드 - Research

**Researched:** 2026-01-27
**Domain:** Claude Code slash commands and CLI integration
**Confidence:** HIGH

## Summary

Phase 7 implements the user-facing CLI interface for Ultra Planner through Claude Code's `.claude/commands/` system. Research shows that slash commands in Claude Code are defined via markdown files with YAML frontmatter that specify invocation metadata, tool permissions, and behavioral constraints.

The standard approach uses `.claude/commands/*.md` files with frontmatter that defines the command's `name`, `description`, `allowed-tools`, and other execution parameters. Commands can invoke the orchestration infrastructure built in Phases 1-6 via the Task tool to spawn specialized agents.

The integration layer connects slash commands to keyword detection (Phase 4), allowing both `/ultraplan:command` and magic keyword triggers like "autopilot" or "plan this" to activate the same underlying workflows.

**Primary recommendation:** Implement three commands (`new-project`, `plan-phase`, `execute`) as thin orchestration layers that validate prerequisites, assemble context, and delegate to specialized agents via Task tool with structured prompts.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Claude Code Commands | Native | Slash command system | Built into Claude Code, official extension mechanism |
| YAML Frontmatter | Standard | Command metadata | Official Claude Code spec for command configuration |
| Task Tool | Native | Agent spawning | Claude Code's built-in subagent invocation mechanism |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript | 5.x | Type-safe implementation | For command logic and validation (infrastructure already exists from Phases 1-6) |
| Bash | System | Prerequisite validation | Checking file existence, permissions before spawning agents |
| Keyword Detector | Custom (Phase 4) | Magic keyword detection | When command should also trigger via natural language |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `.claude/commands/` | `.claude/skills/` | Skills support supporting files and more features, but commands are simpler for direct invocation |
| YAML frontmatter | JSON config | YAML is the official standard, JSON not supported |
| Task tool | Direct implementation | Task tool provides agent isolation with fresh 200k context, direct implementation leaks state |

**Installation:**
```bash
# No external dependencies needed
# Infrastructure from Phases 1-6 already built
```

## Architecture Patterns

### Recommended Project Structure
```
.claude/
├── commands/                # User-facing CLI (THIS PHASE)
│   ├── ultraplan-new-project.md
│   ├── ultraplan-plan-phase.md
│   ├── ultraplan-execute.md
│   └── ultraplan-status.md
├── agents/                  # Subagents (built in Phase 3)
│   ├── ultraplan-planner.md
│   ├── ultraplan-executor.md
│   └── ultraplan-architect.md
└── skills/ultraplan/        # Supporting infrastructure
    ├── SKILL.md
    ├── templates/
    └── references/

src/
├── orchestration/           # Keyword detection (Phase 4)
│   └── keywords/
├── sync/                    # Task sync (Phase 6)
├── state/                   # State management (Phase 2)
└── documents/               # Templates (Phase 3)
```

### Pattern 1: Command as Orchestration Layer
**What:** Commands are thin wrappers that validate prerequisites and spawn agents with assembled context
**When to use:** All user-facing commands that trigger complex workflows
**Example:**
```yaml
---
name: ultraplan:plan-phase
description: Generate PLAN.md files for a specific phase
allowed-tools: Read, Write, Glob, Grep, Bash, Task
---

# /ultraplan:plan-phase

## Step 1: Validate Prerequisites
Check ROADMAP.md exists, phase number is valid

## Step 2: Load Phase Context
Assemble context from PROJECT.md, ROADMAP.md, STATE.md

## Step 3: Spawn Planner Agent
Task(subagent_type="ultraplan-planner", model="opus", prompt="...")

## Step 4: Display Summary
Show generated plans and next steps
```
**Source:** Existing `.claude/commands/ultraplan-plan-phase.md` (already implemented)

### Pattern 2: Keyword Integration
**What:** Commands can be triggered both via `/command` and magic keywords
**When to use:** When natural language trigger is valuable ("plan this" → planning mode)
**Example:**
```typescript
// From src/orchestration/keywords/patterns.ts
export const PLAN_KEYWORD: MagicKeyword = {
  triggers: ['plan', 'plan this', 'plan the'],
  description: 'Planning session with interview workflow',
  action: (prompt: string) => {
    const cleanPrompt = removeTriggerWords(prompt, ['plan']);
    return `[PLANNING MODE] Start planning interview workflow.\n\n${cleanPrompt}`;
  }
};
```
**Source:** Phase 4 implementation (already built)

### Pattern 3: Agent Spawning Protocol
**What:** Commands use Task tool with specific parameters for agent invocation
**When to use:** All orchestration that delegates to specialized agents
**Example:**
```javascript
Task(
  subagent_type="ultraplan-executor",
  model="sonnet",
  prompt="Execute task from PLAN.md...\n\n[context]"
)
```
**Source:** Router protocol (`.claude/skills/ultraplan/references/router.md`)

### Pattern 4: Context Assembly Before Spawning
**What:** Gather all required context before spawning agents to minimize back-and-forth
**When to use:** Before any agent spawn
**Example:**
```bash
# Context assembly (example from ultraplan-plan-phase.md)
cat .ultraplan/PROJECT.md
cat .ultraplan/ROADMAP.md
cat .ultraplan/STATE.md
ls -la .ultraplan/plans/${phase_number}-*.md 2>/dev/null

# Then spawn with all context embedded in prompt
```
**Source:** Existing command implementations

### Pattern 5: Shorthand Resolution
**What:** Accept user-friendly input like `03-01` and resolve to full path
**When to use:** When command accepts file paths
**Example:**
```
Input: "03-01"
Resolved: ".planning/phases/03-sequential-execution/03-01-PLAN.md"

Implementation:
PADDED=$(printf "%02d" ${PHASE})
PHASE_DIR=$(ls -d .planning/phases/${PADDED}-* | head -1)
```
**Source:** `ultraplan-execute.md` implementation

### Anti-Patterns to Avoid
- **Implementing logic in command files:** Commands should orchestrate, not implement. Logic belongs in TypeScript modules or agent prompts.
- **Missing prerequisite checks:** Always validate that required files exist before spawning agents. Fail fast with helpful error messages.
- **Hardcoded paths without fallback:** Use pattern matching to handle both padded (`01-`) and unpadded (`1-`) phase numbers.
- **Spawning agents without context:** Always assemble and pass complete context to agents. Agents should not need to read PROJECT.md or ROADMAP.md themselves.
- **Asking user for confirmation in unattended mode:** Check for unattended execution mode and auto-proceed when appropriate.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Command frontmatter parsing | Custom YAML parser | Claude Code's built-in frontmatter handling | Claude Code automatically parses frontmatter and enforces constraints |
| Agent context isolation | Manual state cleanup | Task tool with fresh context | Task tool provides clean 200k context per spawn, automatic isolation |
| Tool permission control | Runtime checks | `allowed-tools` frontmatter | Claude Code enforces permissions at invocation time, cannot be bypassed |
| Command help text | Custom help command | `description` frontmatter field | Appears in `/help` output automatically |
| Argument parsing | String manipulation | `{{ARGUMENTS}}` placeholder | Claude Code provides this automatically, preserves spacing and quoting |
| File path resolution | Complex glob logic | Bash pattern matching (`ls -d .planning/phases/${PADDED}-*`) | Handles variations robustly, works with zero-padded and unpadded |

**Key insight:** Claude Code's command system handles most infrastructure concerns (parsing, permissions, help text). Commands should focus on workflow orchestration, not low-level concerns.

## Common Pitfalls

### Pitfall 1: Assuming `.claude/commands/` and `.claude/skills/` are interchangeable
**What goes wrong:** Commands defined as skills don't appear in slash command autocomplete, or vice versa
**Why it happens:** Commands and skills use similar syntax but different directories and frontmatter options
**How to avoid:** Use `.claude/commands/` for direct user invocation via `/command`, `.claude/skills/` for background knowledge or complex multi-file skills
**Warning signs:** Command doesn't appear when typing `/`, or skill triggers when it shouldn't

### Pitfall 2: Spawning agents without validating prerequisites
**What goes wrong:** Agent fails mid-execution because required file doesn't exist, user gets poor error message
**Why it happens:** Skipping prerequisite checks to "save time"
**How to avoid:** Always check file existence, permissions, and required state before spawning agents. Use decision matrices (if X exists → action Y)
**Warning signs:** Agent errors like "ROADMAP.md not found" appear deep in execution logs

### Pitfall 3: Hardcoding phase directory paths
**What goes wrong:** Commands fail when phase numbering changes or uses different padding conventions
**Why it happens:** Assuming all phases use zero-padded numbers (`01-`, `02-`) when some might use `1-`, `2-`
**How to avoid:** Use pattern matching: `PHASE_DIR=$(ls -d .planning/phases/${PADDED}-* .planning/phases/${PHASE}-* 2>/dev/null | head -1)`
**Warning signs:** Command works for phases 1-9 but fails for phase 10+, or vice versa

### Pitfall 4: Missing `allowed-tools` restrictions
**What goes wrong:** Command has access to tools it shouldn't use, creates security or consistency issues
**Why it happens:** Leaving `allowed-tools` unspecified gives unrestricted access
**How to avoid:** Explicitly list only the tools the command needs. For orchestration commands: `Read, Write, Glob, Grep, Bash, Task`
**Warning signs:** Command modifies files it shouldn't touch, or users report unexpected behavior

### Pitfall 5: Not integrating with keyword detection
**What goes wrong:** Users expect "plan this" to trigger planning mode, but it doesn't work
**Why it happens:** Command exists but keyword detector not updated
**How to avoid:** For commands that should have keyword triggers, update `src/orchestration/keywords/patterns.ts` with corresponding keyword definition
**Warning signs:** `/command` works but natural language trigger doesn't

### Pitfall 6: Overloading command files with business logic
**What goes wrong:** Command file becomes 500+ lines of logic, hard to maintain
**Why it happens:** Implementing validation, parsing, state management in markdown
**How to avoid:** Commands should be ~100-200 lines max. Extract logic to TypeScript modules (already built in Phases 1-6), commands just orchestrate
**Warning signs:** Command file has nested conditionals, complex parsing logic, or duplicates code from other commands

### Pitfall 7: Not handling "already initialized" gracefully
**What goes wrong:** Command overwrites existing planning files without warning
**Why it happens:** No detection of existing state
**How to avoid:** Check for existing files, display decision matrix (if exists AND complete → warn and stop, if exists partially → ask, if not exists → proceed)
**Warning signs:** Users complain about lost planning work

## Code Examples

Verified patterns from official sources:

### Command Frontmatter Structure
```yaml
---
name: ultraplan:plan-phase
description: Generate PLAN.md files for a specific phase by invoking the Planner agent
allowed-tools: Read, Write, Glob, Grep, Bash, Task
---
```
**Source:** [Claude Code Slash Commands Docs](https://code.claude.com/docs/en/slash-commands)

### Context Assembly Pattern
```bash
# Extract phase information from ROADMAP.md
PHASE_NAME=$(grep -A 1 "^### Phase ${phase_number}:" .ultraplan/ROADMAP.md | tail -1 | sed 's/^**Goal**: //')

# Read full context files
PROJECT_CONTEXT=$(cat .ultraplan/PROJECT.md)
ROADMAP_CONTEXT=$(cat .ultraplan/ROADMAP.md)
STATE_CONTEXT=$(cat .ultraplan/STATE.md)

# Pass to agent in structured prompt
Task(
  subagent_type="ultraplan-planner",
  model="opus",
  prompt="Phase ${phase_number}: ${PHASE_NAME}

## Context from PROJECT.md
${PROJECT_CONTEXT}

## Context from ROADMAP.md
${ROADMAP_CONTEXT}

..."
)
```
**Source:** Existing `.claude/commands/ultraplan-plan-phase.md`

### Prerequisite Validation Pattern
```bash
# Check required files exist
test -f .ultraplan/ROADMAP.md || {
  echo "ERROR: ROADMAP.md not found. Run /ultraplan:new-project first."
  exit 1
}

test -f .ultraplan/PROJECT.md || {
  echo "ERROR: PROJECT.md not found. Run /ultraplan:new-project first."
  exit 1
}

# Validate phase number exists in ROADMAP
grep -q "Phase ${phase_number}:" .ultraplan/ROADMAP.md || {
  echo "ERROR: Phase ${phase_number} not found in ROADMAP.md"
  exit 1
}
```
**Source:** Existing `.claude/commands/ultraplan-plan-phase.md`

### Agent Spawning with Result Capture
```javascript
// Spawn Planner agent
Task(
  subagent_type="ultraplan-planner",
  model="opus",
  prompt="You are planning Phase {phase_number}: {phase_name}.

## Mode
PHASE-PLANNING (not NEW-PROJECT)

## Phase Goal
{phase_goal_from_roadmap}

## Success Criteria
{success_criteria_from_roadmap}

..."
)

// After agent completes, display summary
echo "Planning complete for Phase ${phase_number}: ${phase_name}"
echo ""
echo "Generated PLAN.md files:"
ls -1 .ultraplan/plans/${phase_number}-*.md | while read plan; do
  TASK_COUNT=$(grep -c "<task type=" "$plan")
  echo "- $plan ($TASK_COUNT tasks)"
done
```
**Source:** Router protocol and existing command implementations

### Shorthand Resolution
```bash
# Accept inputs like "03-01", "03-01-PLAN.md", or full path
# Resolve to: .planning/phases/03-sequential-execution/03-01-PLAN.md

parse_plan_path() {
  local input=$1

  # If full path, use as-is
  if [[ -f "$input" ]]; then
    echo "$input"
    return
  fi

  # Extract phase and plan numbers
  PHASE=$(echo "$input" | grep -oE '^[0-9]+' | head -1)
  PLAN=$(echo "$input" | grep -oE '[0-9]+-[0-9]+' | tail -1)

  # Find phase directory
  PADDED_PHASE=$(printf "%02d" $PHASE)
  PHASE_DIR=$(ls -d .planning/phases/${PADDED_PHASE}-* 2>/dev/null | head -1)

  # Construct path
  echo "${PHASE_DIR}/${PLAN}-PLAN.md"
}
```
**Source:** `ultraplan-execute.md` implementation

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Commands in CLAUDE.md | `.claude/commands/*.md` files | Claude Code v1.0 (2024) | Better organization, auto-discovery, frontmatter validation |
| Manual tool permission checks | `allowed-tools` frontmatter | Claude Code v1.2 (2024) | Enforced at invocation time, more secure |
| Todos for tracking | Claude Tasks API | Claude Code v2.0 (Jan 2026) | Persistent across sessions, API-driven |
| Skills and commands separate | Skills can include commands | Claude Code v1.5 (2025) | Skills support additional features but commands simpler |

**Deprecated/outdated:**
- **Hardcoded command definitions in CLAUDE.md:** Now use `.claude/commands/` directory for auto-discovery
- **`user-invocable: false`:** This frontmatter option is deprecated, use skill/command distinction instead
- **Todos API:** Replaced by Tasks API in January 2026, todos no longer persist across sessions

## Open Questions

Things that couldn't be fully resolved:

1. **How should commands handle unattended execution mode?**
   - What we know: CLAUDE.md specifies auto-response rules for `/thorough` mode
   - What's unclear: Should commands detect this mode and skip confirmations automatically?
   - Recommendation: Check for unattended mode via environment or state file, auto-proceed with logged decisions

2. **Should keyword detection happen in command files or skill activation?**
   - What we know: Keyword detector exists in Phase 4 (`src/orchestration/keywords/`)
   - What's unclear: Where should keyword → command mapping be defined?
   - Recommendation: Keep keyword definitions in TypeScript (`patterns.ts`), commands just handle explicit invocation. Skill layer bridges keywords to commands.

3. **How to version command APIs if commands call TypeScript modules?**
   - What we know: Commands invoke infrastructure from Phases 1-6
   - What's unclear: What happens if command expects newer TypeScript API than is built?
   - Recommendation: Commands should gracefully handle missing modules, display version mismatch error with upgrade instructions

## Sources

### Primary (HIGH confidence)
- [Claude Code Slash Commands Docs](https://code.claude.com/docs/en/slash-commands) - Official documentation on command structure
- [Claude Code Customization Guide](https://alexop.dev/posts/claude-code-customization-guide-claudemd-skills-subagents/) - Comprehensive guide on skills, commands, subagents
- Existing `.claude/commands/` implementations in project - ultraplan-new-project.md, ultraplan-plan-phase.md, ultraplan-execute.md
- Phase 4 implementation - `src/orchestration/keywords/` (keyword detection already built)
- Phase 6 implementation - `src/sync/` (Task sync already built)
- Router protocol - `.claude/skills/ultraplan/references/router.md`

### Secondary (MEDIUM confidence)
- [How to Create Custom Slash Commands in Claude Code](https://en.bioerrorlog.work/entry/claude-code-custom-slash-command) - Community tutorial verified against official docs
- [Claude Code Tutorial: YouTube Research Agent](https://creatoreconomy.so/p/claude-code-tutorial-build-a-youtube-research-agent-in-15-min) - Practical example of command + agent pattern
- Oh-My-ClaudeCode command references - `references/oh-my-claudecode/commands/` (autopilot.md, ralplan.md, help.md)

### Tertiary (LOW confidence)
- WebSearch: "Claude Code Tasks API 2026" - Reports Tasks replaced Todos in January 2026, but specific API details not verified with official docs
- GitHub discussions on command frontmatter options - Some fields mentioned in issues but not all appear in official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Claude Code command system is well-documented, existing commands provide reference implementations
- Architecture: HIGH - Patterns verified in existing project commands, aligned with official docs
- Pitfalls: MEDIUM - Based on existing command implementations and common mistakes in references, not all verified through user testing
- Code examples: HIGH - All examples from existing project files or official documentation
- State of the art: MEDIUM - Todos→Tasks transition confirmed by multiple sources, but deprecation timeline not officially documented

**Research date:** 2026-01-27
**Valid until:** 2026-02-27 (30 days - stable API, but Claude Code updates monthly)

---

**Key Takeaway for Planner:**
Commands are thin orchestration layers. The heavy lifting (validation logic, state management, document generation, agent prompts) is already built in Phases 1-6. Phase 7 just needs to wire user invocation (slash commands + keywords) to the existing infrastructure with proper prerequisite checking and context assembly.
