# Project Research Summary

**Project:** Ultra Planner
**Domain:** CLI workflow orchestration for AI coding assistants
**Researched:** 2026-01-26
**Confidence:** HIGH

## Executive Summary

Ultra Planner is a **document-driven workflow orchestration system** for Claude Code. The research reveals this is fundamentally a prompt engineering project, not a traditional software engineering project. The "stack" is Markdown documents with YAML frontmatter and XML-structured tasks, not compiled code. Successful systems in this domain (GSD, OMC) are built as pure CLAUDE.md skill systems with specialized subagents.

The recommended approach follows a 5-layer architecture: Entry Layer (CLI/slash commands) → Orchestration Layer (router, state manager) → Agent Layer (planner, executor, architect, critic) → Context Layer (PROJECT.md, ROADMAP.md, PLAN.md hierarchy) → Execution Layer (Claude Tasks API, git operations). The core value proposition is **document-to-execution synchronization** - planning documents automatically sync to Claude Tasks and execution results flow back to update state. This creates a traceable, auditable development workflow with parallel execution capabilities.

Key risks center on integration complexity (merging three different tool philosophies), document-execution sync failures (the core feature that must not break), and parallel execution file conflicts. Mitigation requires strict scope discipline, bidirectional sync with conflict detection from day one, and explicit file ownership tracking before enabling parallelism. The research strongly recommends starting with a minimal v1 (4 core agents, sequential execution, one differentiator: Claude Tasks sync) and adding complexity incrementally with validation.

## Key Findings

### Recommended Stack

Ultra Planner should be implemented as a **pure Markdown/YAML/XML prompt system** following Claude Code's native extensibility model. No build step, no compiled code - just SKILL.md files, agent definitions, and document templates.

**Core technologies:**
- **CLAUDE.md skill system** (.claude/skills/*/SKILL.md) — Entry points for workflows with YAML frontmatter, provides native Claude Code integration without build overhead
- **Subagent definitions** (.claude/agents/*.md) — Specialized workers (planner, executor, architect, critic) with role definitions and execution protocols
- **Markdown document hierarchy** (.planning/*.md) — PROJECT.md → ROADMAP.md → PLAN.md provides persistent context and single source of truth
- **XML task structure** (in PLAN.md) — Claude-optimized format for task definitions with <task>, <action>, <verify>, <done> tags
- **YAML frontmatter** (metadata, dependencies, wave assignments) — Machine-readable metadata on Markdown documents for orchestration
- **JSON state files** (.planning/state/*.json) — Structured state tracking for queues, progress, configuration

**Anti-pattern to avoid:** Building a TypeScript/Python "framework" that generates prompts. This adds build complexity, fights Claude's native model, and slows iteration. GSD and OMC prove pure Markdown works at scale.

### Expected Features

**Must have (table stakes):**
- Natural language task input — Users describe goals in plain English, system detects intent
- Document workflow (PROJECT.md → ROADMAP.md → PLAN.md) — Structured planning with version control
- Multi-file coordinated editing — Tasks span multiple files with tracking
- Command execution with retry loops — Run tests/builds, auto-fix on failure (ralph pattern)
- Git integration with atomic commits — Each task = one commit, clean audit trail
- Session persistence — Resume work where left off
- Slash commands — /ultraplan:new-project, /ultraplan:plan-phase shortcuts
- Plan mode — Read-only exploration before changes
- Progress visibility — Show current status, files modified

**Should have (competitive differentiators):**
- **Claude Tasks synchronization** — PLAN.md auto-registers as native tasks (UNIQUE VALUE PROP)
- Fresh subagent pattern — Each executor starts with clean 200k context
- Verification loop architecture — Architect/Critic review before claiming "done"
- Automatic intent detection — "autopilot", "plan", "execute" keywords trigger behaviors
- Iterative planning consensus (ralplan) — Planner + Architect + Critic iterate until agreement

**Defer (v2+):**
- Full parallel execution (requires complex file ownership system)
- 32-agent ecosystem (4 agents sufficient for v1)
- MCP extensibility (standard but not unique)
- LSP/AST-grep integration (complex per-language setup)
- Session teleportation across devices

### Architecture Approach

The architecture follows a **layered orchestration model** with clear separation of concerns. Entry Layer parses CLI/keywords and routes to Orchestration Layer. Orchestration manages a central Router (intent classification), State Manager (progress tracking), and Task Queue (dependency analysis). The Agent Layer contains specialized workers that never communicate directly - all coordination flows through Router. Context Layer manages the document hierarchy (PROJECT.md always loaded, phase-specific context loaded on-demand for progressive disclosure). Execution Layer is stateless - it runs git operations and Claude Tasks API calls but stores no state.

**Major components:**
1. **Router** — Intent classification, agent selection, mode switching (autopilot vs manual)
2. **Planner Agent** (Opus) — Generate PROJECT.md, ROADMAP.md, PLAN.md with task decomposition
3. **Executor Agent** (Sonnet) — Implement tasks, fresh context per task, atomic commits
4. **Architect Agent** (Opus) — Verify completeness, validate quality, final approval gate
5. **State Manager** — Persist execution state, track progress, manage task queues
6. **Context Layer** — Document hierarchy with progressive disclosure to preserve context window

**Key patterns:** Fresh subagent execution (isolated 200k contexts), progressive disclosure (load only needed context), verification loop (generator-critic cycle), atomic commits per task, wave-based dependency grouping for parallel execution.

### Critical Pitfalls

1. **Tool Integration Complexity Explosion** — Merging three tools (GSD, OMC, OpenCode) creates exponential complexity. 40% of agentic AI projects get cancelled due to unanticipated complexity. **Avoid:** Define ONE core philosophy, build v1 with 20% of features delivering 80% value, establish explicit "out of scope" list, enforce maximum complexity budget (max 5 config options).

2. **Document-Execution Synchronization Failure** — Core value prop (documents sync to Claude Tasks) silently breaks. Users trust stale information. **Avoid:** Designate ONE authoritative source (documents OR tasks), implement bidirectional sync with conflict detection, add staleness indicators, design for eventual consistency with reconciliation rules, run sync health checks before execution.

3. **Parallel Execution File Conflicts** — Multiple agents write to same files, corrupting work or creating merge conflicts. Users lose work. **Avoid:** Implement explicit file ownership tracking per worker, require workers to declare file dependencies upfront, never allow parallel writes to same file (queue or fail), pre-execution conflict detection.

4. **Cost and Token Explosion** — Chaining agents in loops causes token usage to spike. Users hit rate limits. **Avoid:** Implement token budget per task with hard limits, summarize context between agent handoffs (not full history), add dry-run mode showing estimated cost, circuit breakers for runaway loops, real-time token usage visibility.

5. **Context/Prompt Decay Over Time** — System prompts become "5,000-token Frankenstein monsters" of conflicting instructions. Agent behavior degrades. **Avoid:** Separate "Model Patches (Temporary)" from "World Knowledge (Permanent)", implement prompt garbage collection, set maximum prompt size budgets, version prompts and track behavioral changes.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation (No Dependencies)
**Rationale:** Everything depends on documents existing and state being trackable. Must establish core architecture and scope boundaries before writing agents.
**Delivers:** Document templates (PROJECT.md, ROADMAP.md, PLAN.md, STATE.md), CLI command structure (/ultraplan:new-project, /ultraplan:status), state management infrastructure (read/write operations, progress tracking)
**Addresses:** Table stakes features (document workflow, session persistence), establishes configuration architecture
**Avoids:** Feature creep pitfall - define strict scope and "not in v1" list upfront, tool integration complexity - establish ONE core philosophy before building

### Phase 2: Core Planning (Depends on Phase 1)
**Rationale:** Need documents before executing. Planner agent generates the documents that all other agents consume.
**Delivers:** Planner Agent implementation, PROJECT.md generation from user input, ROADMAP.md generation (phase decomposition), PLAN.md generation (task decomposition), intent classification for "plan" keyword
**Uses:** Markdown with YAML frontmatter, XML task structure, Opus model for complex reasoning
**Implements:** Context Layer document hierarchy, progressive disclosure pattern
**Avoids:** Monolithic context anti-pattern - load only needed context per agent

### Phase 3: Sequential Execution (Depends on Phase 2)
**Rationale:** Sequential execution must work before adding parallel complexity. Establishes verification patterns and atomic commit discipline.
**Delivers:** Executor Agent implementation (single task execution), Architect Agent (verification gate), result capture, atomic commit integration, Router (agent coordination), State Manager updates
**Addresses:** Table stakes (multi-file editing, command execution, git integration, error retry loops)
**Avoids:** Silent failures pitfall - mandatory verification before claiming "done", review bottleneck - atomic commits keep changesets small
**Research Flag:** May need deeper research on git worktree patterns if parallel execution planned for v2

### Phase 4: Document-Task Sync (Depends on Phase 3)
**Rationale:** This is the core differentiator. Must work reliably or entire value proposition fails.
**Delivers:** PLAN.md → Claude Tasks conversion, bidirectional sync (execution results update documents), status synchronization, completion detection, staleness indicators, sync health checks
**Addresses:** Unique differentiator - Claude Tasks synchronization
**Avoids:** Document-execution sync failure pitfall (CRITICAL) - this is Phase 2 in importance, must have conflict detection and reconciliation from day one
**Research Flag:** NEEDS DEEP RESEARCH - Claude Tasks API documentation, sync conflict resolution strategies, rate limiting behavior

### Phase 5: Quality Layer (Depends on Phase 3)
**Rationale:** Verification requires something to verify. Adds quality gates after execution works.
**Delivers:** Critic Agent implementation (plan review, gap identification), iterative planning consensus (ralplan pattern), verification protocol, approval/rejection workflows
**Addresses:** Differentiator - verification loop architecture
**Implements:** Ralplan pattern (Planner + Architect + Critic iterate)
**Avoids:** Agent role ambiguity pitfall - define explicit input/output contracts per agent

### Phase 6: Natural Language Interface (Depends on All Prior)
**Rationale:** Manual mode must work before automating. Natural language is wrapper around working core.
**Delivers:** Keyword detection ("autopilot", "plan", "execute"), ambiguity resolution, mode switching, autopilot mode (end-to-end orchestration), intent confirmation for ambiguous cases
**Addresses:** Table stakes - natural language task input, automatic intent detection
**Avoids:** CLI ergonomics neglect - test with new users, progressive disclosure

### Phase 7: Parallelism (v2 - Optional)
**Rationale:** Adds complexity. Only build after sequential mode proven stable. Requires file ownership system.
**Delivers:** Task Queue with dependency waves, file ownership tracking, wave grouping (up to 5 parallel workers), concurrent dispatch, result merging with conflict detection
**Addresses:** Differentiator - parallel subagent execution
**Avoids:** Parallel file conflicts pitfall (CRITICAL for this phase) - must have ownership tracking before enabling, token explosion - enforce budgets per task
**Research Flag:** NEEDS DEEP RESEARCH - file locking strategies, git worktree coordination, Claude Code's 5-worker limit behavior

### Phase Ordering Rationale

- **Foundation → Planning → Execution** follows natural dependency chain: can't plan without documents, can't execute without plans
- **Sequential before Parallel** reduces complexity risk - prove core loop works before adding concurrency
- **Document-Task Sync in Phase 4** (not later) because it's the core differentiator - must validate early
- **Quality Layer after Execution** because verification needs results to verify
- **Natural Language last** because it's a wrapper - all underlying functionality must work first
- **Defer Parallelism to v2** to contain scope and avoid 40% cancellation risk from complexity explosion

This ordering avoids the critical pitfalls identified in research:
- Phase 1 addresses feature creep and integration complexity upfront
- Phase 4 addresses document-sync failure before it becomes architectural debt
- Phase 7 deferred to v2 avoids parallel file conflicts and token explosion until core is stable

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Document-Task Sync):** CRITICAL - Claude Tasks API behavior, sync conflict resolution, rate limits, WebSocket vs polling for status updates
- **Phase 7 (Parallelism - v2):** File locking strategies, git worktree coordination patterns, worker pool management at Claude Code's limits

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Well-established document structure from GSD/OMC, standard JSON state patterns
- **Phase 2 (Core Planning):** Standard Markdown generation, proven YAML frontmatter schemas
- **Phase 3 (Sequential Execution):** Established subagent patterns from Claude Code docs
- **Phase 5 (Quality Layer):** Ralplan pattern documented in OMC, verification protocols proven in GSD
- **Phase 6 (Natural Language):** Intent detection patterns standard, keyword mapping straightforward

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official Claude Code documentation verified, GSD/OMC patterns examined in live systems, Markdown/YAML/XML approach proven at scale |
| Features | MEDIUM-HIGH | Table stakes verified across multiple competitors (Cursor, GitHub Copilot CLI, Windsurf), differentiators validated in GSD/OMC, some features inferred from domain patterns |
| Architecture | HIGH | Multiple authoritative sources agree on layered orchestration, fresh subagent pattern verified in official docs, component boundaries tested in production systems |
| Pitfalls | MEDIUM | 40% cancellation statistic from Deloitte research, specific failure modes corroborated across multiple sources, some pitfalls inferred from general agentic AI patterns |

**Overall confidence:** HIGH

Research quality is strong due to official documentation verification, examination of working systems (GSD, OMC in live installation), and cross-validation across multiple independent sources. The Markdown/YAML/XML stack recommendation is particularly high-confidence because it's observable in production systems and documented in official guides.

### Gaps to Address

- **Claude Tasks API behavior:** Research found references to "Claude Tasks synchronization" as a feature concept but limited technical documentation on the API itself. **Handle during Phase 4 planning:** Deep research into Claude Code's Tasks API, rate limits, sync patterns, conflict resolution strategies.

- **Optimal parallelism limits:** Research cites "5 workers practical, 10 theoretical max" for Claude Code but lacks empirical data on performance degradation curves. **Handle during Phase 7 planning (v2):** Benchmark testing with 3/5/7/10 workers to find optimal balance, may need user-configurable limit.

- **Token cost modeling:** Research identifies token explosion as a critical pitfall but doesn't provide formulas for estimating cost per task. **Handle during Phase 3 planning:** Build cost estimation model based on task complexity, context size, agent tier (Haiku/Sonnet/Opus).

- **MCP integration patterns:** Research mentions MCP as "standard but not unique" and defers to v2, but doesn't detail integration approach if added later. **Handle during v2 planning:** Research MCP server protocols, Context7 integration for documentation lookup, GitHub API for PR/issue automation.

- **Git worktree coordination:** Mentioned as enabling "true parallelism without conflicts" but implementation details sparse. **Handle during Phase 7 planning (v2):** Research git worktree lifecycle management, branch synchronization patterns, merge strategies for parallel work.

## Sources

### Primary (HIGH confidence)
- [Claude Code Docs - Create Custom Subagents](https://code.claude.com/docs/en/sub-agents) — Subagent architecture, constraints (no nesting), fresh context pattern
- [Claude Code Docs - Common Workflows](https://code.claude.com/docs/en/common-workflows) — Workflow orchestration patterns, best practices
- [Anthropic - Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices) — Engineering patterns, prompt design
- [Anthropic - Use XML Tags](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/use-xml-tags) — Why XML for task structure
- [Claude Skills Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) — Progressive disclosure, context management
- GSD (Get Shit Done) system — `/home/ubuntu/.claude/agents/gsd-*.md` — Verified architecture in production
- OMC (Oh My Claude Code) — `/home/ubuntu/.claude/CLAUDE.md` — Multi-agent orchestration patterns at scale

### Secondary (MEDIUM confidence)
- [Deloitte TMT Predictions 2026 - AI Agent Orchestration](https://www.deloitte.com/us/en/insights/industry/technology/technology-media-and-telecom-predictions/2026/ai-agent-orchestration.html) — 40% cancellation rate for complex agentic systems
- [IEEE Spectrum - AI Coding Degradation](https://spectrum.ieee.org/ai-coding-degrades) — AI-generated code issue rates (10.83 vs 6.45)
- [Google Multi-Agent Design Patterns](https://www.infoq.com/news/2026/01/multi-agent-design-patterns/) — Generator-critic patterns, verification loops
- [Azure AI Agent Design Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) — Sequential/concurrent orchestration
- [Addy Osmani - LLM Coding Workflow 2026](https://addyosmani.com/blog/ai-coding-workflow/) — Practical workflow lessons
- [Shakudo - Best AI Coding Assistants 2026](https://www.shakudo.io/blog/best-ai-coding-assistants) — Competitive landscape
- [PromptLayer - LLM Distraction Research](https://blog.promptlayer.com/why-llms-get-distracted-and-how-to-write-shorter-prompts/) — Context degradation, prompt decay

### Tertiary (LOW confidence)
- [DEV.to - Multi-Agent Orchestration](https://dev.to/bredmond1019/multi-agent-orchestration-running-10-claude-instances-in-parallel-part-3-29da) — Parallel execution patterns (needs validation)
- [Medium - Claude Code Multi-Agent Parallel Coding](https://medium.com/@codecentrevibe/claude-code-multi-agent-parallel-coding-83271c4675fa) — Task tool parallelization
- [Merge.dev - Software Integration Challenges 2026](https://www.merge.dev/blog/software-integration-challenges) — Integration complexity patterns
- [Pendo - Feature Usage Study](https://www.geteppo.com/blog/feature-creep) — 80% of features rarely used statistic
- [Stripe Developer Report](https://www.designrush.com/agency/software-development/trends/feature-creep) — 17.3 hours/week debugging complexity

---
*Research completed: 2026-01-26*
*Ready for roadmap: yes*
