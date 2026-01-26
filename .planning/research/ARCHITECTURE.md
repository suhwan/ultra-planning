# Architecture Patterns

**Domain:** AI Coding Assistant CLI Workflow Systems
**Researched:** 2026-01-26
**Confidence:** HIGH (verified via official Claude Code documentation, GitHub repos, and multiple authoritative sources)

## Executive Summary

AI coding assistant workflow systems in 2026 converge on a **layered orchestration architecture** with these core patterns:

1. **Context-First Design**: Markdown documents (CLAUDE.md, PROJECT.md) serve as persistent memory
2. **Fresh Subagent Execution**: Each task runs in isolated 200k-token contexts
3. **Progressive Disclosure**: Load information only when needed to preserve context
4. **Multi-Agent Orchestration**: Specialized agents coordinate via central router/orchestrator

For Ultra Planner, the recommended architecture follows a 5-layer stack: Entry Layer (CLI/Commands) -> Orchestration Layer (Router/Dispatcher) -> Agent Layer (Specialized Workers) -> Context Layer (Document System) -> Execution Layer (Task Workers).

---

## Recommended Architecture

```
                    +------------------+
                    |   Entry Layer    |
                    | /ultraplan:* CLI |
                    | Natural Language |
                    +--------+---------+
                             |
                    +--------v---------+
                    | Orchestration    |
                    | - Router         |
                    | - Task Queue     |
                    | - State Manager  |
                    +--------+---------+
                             |
        +--------------------+--------------------+
        |                    |                    |
+-------v------+    +--------v-------+    +------v-------+
|   Planner    |    |   Executor     |    |  Architect   |
|   Agent      |    |   Agent        |    |  Agent       |
+--------------+    +----------------+    +--------------+
        |                    |                    |
        +--------------------+--------------------+
                             |
                    +--------v---------+
                    |  Context Layer   |
                    | - PROJECT.md     |
                    | - ROADMAP.md     |
                    | - PLAN.md        |
                    | - STATE.md       |
                    +--------+---------+
                             |
                    +--------v---------+
                    |  Execution Layer |
                    | - Claude Tasks   |
                    | - Git Commits    |
                    | - File System    |
                    +------------------+
```

---

## Component Boundaries

| Component | Responsibility | Communicates With | Build Phase |
|-----------|---------------|-------------------|-------------|
| **Entry Layer** | CLI parsing, keyword detection, command routing | Orchestration Layer | Phase 1 |
| **Router** | Intent classification, mode selection (autopilot/manual) | All agents, State Manager | Phase 1 |
| **State Manager** | Persist execution state, track progress, manage queues | All components | Phase 1 |
| **Planner Agent** | Generate PLAN.md, decompose tasks, estimate dependencies | Router, Context Layer | Phase 2 |
| **Executor Agent** | Implement tasks, write code, run commands | Router, Execution Layer | Phase 2 |
| **Architect Agent** | Verify completeness, validate quality, approve completion | Router, Planner | Phase 3 |
| **Critic Agent** | Review plans, identify gaps, challenge assumptions | Router, Architect | Phase 3 |
| **Context Layer** | Manage document hierarchy, serve context to agents | All agents | Phase 1 |
| **Execution Layer** | Claude Tasks API, Git operations, file I/O | Executor, State Manager | Phase 2 |

### Component Interaction Rules

1. **Agents never communicate directly** - All inter-agent coordination goes through Router
2. **Context Layer is read-heavy** - Agents read frequently, write rarely (on task completion)
3. **State Manager is the source of truth** - Progress, queue state, execution history
4. **Execution Layer is stateless** - No execution-layer state; all state in State Manager

---

## Data Flow

### Initialization Flow (New Project)

```
User Input: "Build a todo app"
        |
        v
+---------------+
| Entry Layer   | --> Detect "build" keyword
+-------+-------+
        |
        v
+---------------+
| Router        | --> Mode: autopilot (implied by "build")
+-------+-------+
        |
        v
+---------------+
| Planner Agent | --> Generate:
+-------+-------+     - PROJECT.md (vision)
        |             - REQUIREMENTS.md (scope)
        v             - ROADMAP.md (phases)
+---------------+
| Context Layer | --> Persist documents to .ultraplan/
+---------------+
```

### Phase Execution Flow

```
/ultraplan:execute-phase 1
        |
        v
+---------------+
| Router        | --> Load phase from ROADMAP.md
+-------+-------+
        |
        v
+---------------+
| Planner Agent | --> Generate PLAN.md with tasks
+-------+-------+
        |
        v
+---------------+
| State Manager | --> Create task queue, analyze dependencies
+-------+-------+
        |
        +------------+------------+
        |            |            |
        v            v            v
+--------+   +--------+   +--------+
|Executor|   |Executor|   |Executor|   (Up to 5 parallel)
|Worker 1|   |Worker 2|   |Worker 3|
+---+----+   +---+----+   +---+----+
    |            |            |
    v            v            v
+------------------------------------+
| Execution Layer (Claude Tasks)     |
+------------------------------------+
        |
        v
+---------------+
| Architect     | --> Verify all tasks complete
+-------+-------+
        |
        v
+---------------+
| State Manager | --> Update STATE.md, mark phase complete
+---------------+
```

### Document Data Flow

```
PROJECT.md (always loaded)
    |
    +--> Informs REQUIREMENTS.md scope decisions
    |
    v
REQUIREMENTS.md (loaded during planning)
    |
    +--> Drives ROADMAP.md phase structure
    |
    v
ROADMAP.md (loaded during phase selection)
    |
    +--> Generates PLAN.md for each phase
    |
    v
PLAN.md (loaded during execution)
    |
    +--> Decomposes into Claude Tasks
    |
    v
STATE.md (always updated)
    |
    +--> Tracks decisions, blockers, progress
```

---

## Patterns to Follow

### Pattern 1: Fresh Subagent Execution

**What:** Each task executes in a fresh, isolated context with its own 200k token window.

**When:** Any task that modifies code or requires focused work.

**Why:** Prevents context pollution. Each executor starts clean without accumulated "garbage" from previous tasks.

**Implementation:**
```typescript
// Spawn fresh context per task
const result = await spawnTask({
  type: 'executor',
  prompt: taskDefinition,
  context: {
    projectMd: loadProjectMd(),
    taskSpec: task.specification,
    // Minimal context - only what task needs
  },
  model: selectModelForComplexity(task.complexity)
});
```

**Source:** GSD workflow pattern, verified in [Claude Code subagent documentation](https://code.claude.com/docs/en/sub-agents)

### Pattern 2: Progressive Disclosure

**What:** Load information in stages as needed, not upfront.

**When:** Managing context across multiple files, documents, or reference materials.

**Why:** Preserves context window for actual work. Only ~20k tokens overhead per subagent startup.

**Implementation:**
```markdown
# SKILL.md (always loaded - minimal)
## Quick Reference
Basic usage here...

## Advanced Features
See [ADVANCED.md](./ADVANCED.md) for details

## API Reference
See [REFERENCE.md](./REFERENCE.md) for full API
```

**Source:** [Claude Skills documentation](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)

### Pattern 3: Hierarchical Context Management

**What:** 3-layer context system: Main Context (always loaded), Skill Metadata (~200 tokens per skill), Active Skill Context (loaded on demand).

**When:** System has multiple skills/capabilities that shouldn't all load simultaneously.

**Why:** Supports hundreds of skills without context exhaustion.

**Implementation:**
```
Layer 1: Main Context
  - CLAUDE.md (system instructions)
  - PROJECT.md (project vision)

Layer 2: Skill Metadata (YAML frontmatter only)
  - name: "ultraplan-execute"
  - description: "Execute phase tasks..."

Layer 3: Active Skill Context (loaded when triggered)
  - PLAN.md
  - Phase-specific context
```

**Source:** [Claude Skills architecture](https://tylerfolkman.substack.com/p/the-complete-guide-to-claude-skills)

### Pattern 4: Verification Loop (Ralplan Pattern)

**What:** Generator-Critic cycle where one agent creates, another validates.

**When:** Complex plans, critical decisions, quality-sensitive outputs.

**Why:** Catches errors before execution. Multiple perspectives improve plan quality.

**Implementation:**
```
1. Planner generates initial PLAN.md
2. Critic reviews for gaps, ambiguity, missing cases
3. If issues found:
   - Planner revises
   - Critic re-reviews
4. Architect gives final approval
5. Only then: Execute
```

**Source:** [Google multi-agent patterns](https://www.infoq.com/news/2026/01/multi-agent-design-patterns/)

### Pattern 5: Atomic Commits per Task

**What:** Each completed task triggers immediate git commit.

**When:** Any task that modifies files.

**Why:**
- Git bisect can find exact failing task
- Each task independently revertable
- Clear history for future sessions
- Better observability

**Implementation:**
```bash
# After each task completion
git add <modified-files>
git commit -m "feat(phase-task): <task description>"
```

**Source:** GSD workflow, verified in [GitHub repo](https://github.com/glittercowboy/get-shit-done)

### Pattern 6: Task Queue with Dependency Waves

**What:** Group tasks into dependency waves. Tasks in same wave run parallel; waves execute sequentially.

**When:** Phase has multiple tasks with varying dependencies.

**Why:** Maximizes parallelism while respecting dependencies.

**Implementation:**
```
Wave 1: [Task A, Task B, Task C]  // No dependencies, run parallel
    |
    v (all complete)
Wave 2: [Task D, Task E]          // Depend on Wave 1
    |
    v (all complete)
Wave 3: [Task F]                  // Depends on D and E
```

**Limit:** Maximum 5 parallel workers per wave (Claude Code constraint; 10 is theoretical max but 5 is practical)

**Source:** oh-my-claudecode Ultrapilot pattern, [GSD documentation](https://github.com/glittercowboy/get-shit-done)

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Monolithic Context

**What:** Loading all project context into every agent.

**Why bad:**
- Context exhaustion (200k fills quickly)
- Quality degrades as context fills
- Slower responses, higher costs

**Instead:** Progressive disclosure. Load PROJECT.md always, load phase-specific context only when executing that phase.

### Anti-Pattern 2: Agent-to-Agent Direct Communication

**What:** Agents calling other agents directly.

**Why bad:**
- Creates unpredictable execution order
- Hard to debug and track state
- Risk of infinite loops

**Instead:** All coordination through Router. Agents return results to Router, which dispatches to next agent.

### Anti-Pattern 3: Nested Subagent Spawning

**What:** Subagents spawning their own subagents.

**Why bad:**
- Claude Code explicitly prevents this
- Even if possible, creates debugging nightmares
- Context isolation becomes unclear

**Instead:** Flat hierarchy. Main thread orchestrates; workers execute and return.

**Source:** [Claude Code documentation](https://code.claude.com/docs/en/sub-agents) - "Subagents cannot spawn other subagents"

### Anti-Pattern 4: State in Execution Layer

**What:** Storing progress or queue state in executor agents.

**Why bad:**
- Executors are ephemeral (die after task)
- State lost on crash or timeout
- No visibility into progress

**Instead:** All state in State Manager (STATE.md and .ultraplan/state/). Execution layer is stateless.

### Anti-Pattern 5: Time-Sensitive Instructions

**What:** Instructions that reference specific dates or versions.

**Why bad:**
- Becomes stale quickly
- Causes confusion when dates pass

**Instead:** Use "old patterns" section for deprecated approaches. Keep main instructions timeless.

**Source:** [Claude Skills best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)

### Anti-Pattern 6: Magic Keywords Without Verification

**What:** Triggering modes based solely on keyword detection.

**Why bad:**
- False positives (user mentions "plan" but doesn't want planning mode)
- Unclear what triggered which behavior

**Instead:** Keyword detection + intent confirmation. For ambiguous cases, ask user.

---

## Build Order (Dependencies)

Based on component dependencies, recommended build order:

### Phase 1: Foundation (No external dependencies)

**Build First:**
1. **Context Layer** - Document structure (.ultraplan/ directory)
   - PROJECT.md template
   - ROADMAP.md template
   - PLAN.md template
   - STATE.md template

2. **Entry Layer** - CLI commands
   - `/ultraplan:new-project`
   - `/ultraplan:status`
   - Basic command parsing

3. **State Manager** - Persistence
   - State file format
   - Read/write operations
   - Progress tracking

**Rationale:** Everything depends on documents existing and state being trackable.

### Phase 2: Core Agents (Depends on Phase 1)

**Build Second:**
4. **Planner Agent** - Document generation
   - PROJECT.md generation from user input
   - ROADMAP.md generation (phase decomposition)
   - PLAN.md generation (task decomposition)

5. **Executor Agent** - Task implementation
   - Single task execution
   - Result capture
   - Atomic commit integration

6. **Router** - Coordination
   - Intent classification
   - Agent dispatch
   - Result collection

**Rationale:** Need documents before planning, need planning before execution.

### Phase 3: Quality Layer (Depends on Phase 2)

**Build Third:**
7. **Architect Agent** - Verification
   - Completion verification
   - Quality checks
   - Approval/rejection

8. **Critic Agent** - Review
   - Plan review
   - Gap identification
   - Iteration triggers

**Rationale:** Verification requires something to verify (execution results).

### Phase 4: Parallelism (Depends on Phase 2-3)

**Build Fourth:**
9. **Task Queue** - Parallel execution
   - Dependency analysis
   - Wave grouping
   - Concurrent dispatch (up to 5 workers)

10. **Tasks Sync** - Claude Tasks integration
    - PLAN.md -> Tasks conversion
    - Status synchronization
    - Completion detection

**Rationale:** Sequential execution must work before adding parallel complexity.

### Phase 5: Natural Language (Depends on Phase 1-4)

**Build Fifth:**
11. **Keyword Detection** - Natural triggers
    - "autopilot", "plan", "execute" detection
    - Ambiguity resolution
    - Mode switching

12. **Autopilot Mode** - Full autonomous
    - End-to-end orchestration
    - No manual intervention
    - Self-healing loops

**Rationale:** Manual mode must work before automating it.

---

## Key Architectural Decisions

| Decision | Options Considered | Recommendation | Rationale |
|----------|-------------------|----------------|-----------|
| State storage | JSON files vs SQLite vs Memory | **JSON files in .ultraplan/state/** | Human-readable, git-trackable, no dependencies |
| Agent communication | Direct vs Message Queue vs Router | **Central Router** | Simpler debugging, clear execution flow |
| Context loading | All upfront vs Progressive | **Progressive disclosure** | Preserves context for actual work |
| Parallelism limit | 3 vs 5 vs 10 workers | **5 workers (configurable)** | Balance between speed and stability |
| Document format | JSON vs YAML vs Markdown | **Markdown with YAML frontmatter** | Claude-native, human-readable, versionable |
| Verification model | Optional vs Required | **Required (ralplan pattern)** | Quality over speed |

---

## Scalability Considerations

| Concern | Single Project | Multi-Project | Enterprise (100+ projects) |
|---------|---------------|---------------|---------------------------|
| State storage | .ultraplan/state/ files | Same, per-project | Consider central state service |
| Context management | Progressive disclosure | Same | Add project-level caching |
| Parallelism | 5 workers | Same | Worker pools across projects |
| Document sync | File system | Git branches | Git + webhooks |

**Note:** Ultra Planner v1 targets single-project use. Enterprise considerations are documented but out of scope.

---

## Sources

### HIGH Confidence (Official Documentation)
- [Claude Code Common Workflows](https://code.claude.com/docs/en/common-workflows)
- [Claude Code Subagents](https://code.claude.com/docs/en/sub-agents)
- [Claude Skills Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)

### MEDIUM Confidence (Verified Community Projects)
- [GSD (Get-Shit-Done) Workflow](https://github.com/glittercowboy/get-shit-done) - Verified architecture patterns
- [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) - Multi-agent orchestration patterns
- [Claude-Flow](https://github.com/ruvnet/claude-flow) - Enterprise orchestration reference

### MEDIUM Confidence (Industry Analysis)
- [Google Multi-Agent Design Patterns](https://www.infoq.com/news/2026/01/multi-agent-design-patterns/)
- [Azure AI Agent Design Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)
- [AWS CLI Agent Orchestrator](https://aws.amazon.com/blogs/opensource/introducing-cli-agent-orchestrator-transforming-developer-cli-tools-into-a-multi-agent-powerhouse/)

### LOW Confidence (Community Discussion)
- [DEV.to Multi-Agent Orchestration](https://dev.to/bredmond1019/multi-agent-orchestration-running-10-claude-instances-in-parallel-part-3-29da)
- [Medium Claude Code Parallel Coding](https://medium.com/@codecentrevibe/claude-code-multi-agent-parallel-coding-83271c4675fa)
