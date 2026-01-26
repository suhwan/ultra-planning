# Domain Pitfalls: AI Coding Assistant Workflow Tools

**Domain:** CLI workflow orchestration for AI coding assistants
**Researched:** 2026-01-26
**Confidence:** MEDIUM (multiple sources corroborate patterns)

---

## Critical Pitfalls

Mistakes that cause rewrites, project cancellation, or fundamental architectural failures.

---

### Pitfall 1: Tool Integration Complexity Explosion

**What goes wrong:** Merging three different tools (GSD, OMC, OpenCode) with different philosophies creates exponential integration complexity. Each tool has its own state management, file structures, and execution models. Attempting to support all features from all tools results in a Frankenstein system that nobody can maintain.

**Why it happens:**
- Natural desire to preserve all functionality from source tools
- Fear of losing users who rely on specific features
- Underestimating the combinatorial explosion of feature interactions

**Consequences:**
- 40%+ of agentic AI projects get cancelled due to unanticipated complexity ([Deloitte 2026](https://www.deloitte.com/us/en/insights/industry/technology/technology-media-and-telecom-predictions/2026/ai-agent-orchestration.html))
- Maintenance burden grows faster than value delivered
- Debugging becomes guesswork across subsystems
- New contributors cannot onboard effectively

**Warning Signs:**
- Configuration file keeps growing with "compatibility" options
- Bug fixes in one area break unrelated features
- Documentation cannot keep up with actual behavior
- You catch yourself saying "it depends on which mode you're using"

**Prevention:**
1. Define ONE core philosophy, not a merger of three
2. Create explicit "out of scope" list and enforce it
3. Build v1 with 20% of features that deliver 80% of value
4. Establish maximum complexity budget (e.g., max 5 config options)

**Phase Mapping:** Address in Phase 1 (Foundation) - Establish core philosophy before writing code

---

### Pitfall 2: Document-Execution Synchronization Failure

**What goes wrong:** The core value proposition ("documents sync to Claude Tasks automatically") silently breaks. Documents show one state, actual execution shows another. Users trust the documents and make decisions based on stale information.

**Why it happens:**
- Trigger-based sync (on-write) misses edge cases
- No single source of truth designated
- Partial failures leave inconsistent state
- Race conditions in parallel execution

**Consequences:**
- Users lose trust in the system entirely
- Tasks execute based on outdated plans
- Debugging requires checking multiple files to understand state
- "It worked yesterday" becomes common complaint

**Warning Signs:**
- Users manually checking task status instead of trusting documents
- Intermittent "state mismatch" errors
- Same task appearing in different states across views
- Recovery procedures becoming part of normal workflow

**Prevention:**
1. Designate ONE authoritative source (either documents OR tasks, not both)
2. Implement bidirectional sync with conflict detection
3. Add staleness indicators (last sync timestamp visible to users)
4. Implement "sync health" checks that run before execution
5. Design for "eventual consistency" with clear reconciliation rules

**Phase Mapping:** Address in Phase 2 (Core Sync) - This IS the core feature, not an afterthought

---

### Pitfall 3: Parallel Execution File Conflicts

**What goes wrong:** Multiple parallel agents write to the same files, corrupting work or creating merge conflicts. Git worktrees help but add complexity. Users lose work they didn't back up.

**Why it happens:**
- File ownership not tracked between parallel workers
- No coordination layer for shared resources
- Optimistic assumptions about non-overlapping work
- Missing conflict detection before writes

**Consequences:**
- Lost work (most damaging to user trust)
- Corrupted files requiring manual recovery
- Silent overwrites where last writer wins
- Users avoiding parallel execution entirely (defeating purpose)

**Warning Signs:**
- "File modified by another process" errors
- Git conflicts appearing in automated workflows
- Users asking "which version is correct?"
- Successful parallel runs but broken output

**Prevention:**
1. Implement explicit file ownership tracking per worker
2. Use locking or claim-based file access
3. Require workers to declare file dependencies upfront
4. Implement pre-execution conflict detection
5. Never allow parallel writes to same file - queue or fail instead

**Phase Mapping:** Address in Phase 3 (Parallel Execution) - Must solve before enabling parallelism

---

### Pitfall 4: Cost and Token Explosion

**What goes wrong:** Chaining agents, especially in loops, causes token usage to explode. Users hit rate limits unexpectedly. Monthly bills spike dramatically. The tool becomes unusable for the majority of users.

**Why it happens:**
- Each agent call includes growing context
- Retry loops multiply costs on failures
- No budget enforcement at orchestration layer
- Passing full conversation history between agents

**Consequences:**
- Users hit Claude Pro/Max caps within hours
- Tool unusable for budget-conscious users
- Hidden costs discovered only in billing
- "AI sprawl" - single request triggers 20+ API calls

**Warning Signs:**
- Users reporting they "used up monthly quota in one session"
- Token counts growing linearly (or worse) with task complexity
- No visibility into token usage before execution
- "Why is this taking so long?" (actually rate-limited)

**Prevention:**
1. Implement token budget per task with hard limits
2. Summarize context between agent handoffs (not full history)
3. Add dry-run mode showing estimated token cost
4. Implement circuit breakers for runaway loops
5. Surface real-time token usage to users during execution

**Phase Mapping:** Address in Phase 3 (Parallel Execution) - Build budgeting into orchestration layer

---

### Pitfall 5: Context/Prompt Decay Over Time

**What goes wrong:** System prompts and agent instructions become "5,000-token Frankenstein monsters of conflicting instructions, edge-case fixes, and emotional blackmail." Agent behavior degrades as context accumulates.

**Why it happens:**
- Edge case fixes added incrementally without cleanup
- Multiple contributors add instructions without coordination
- No distinction between temporary patches and permanent knowledge
- Context grows but is never pruned

**Consequences:**
- Agent behavior becomes unpredictable
- Performance degrades as prompts grow
- Model-specific patches become obsolete on model updates
- GPT models hallucinate, Claude models refuse to answer ([PromptLayer research](https://blog.promptlayer.com/why-llms-get-distracted-and-how-to-write-shorter-prompts/))

**Warning Signs:**
- Agent sometimes ignores instructions that "used to work"
- Need to repeat instructions multiple times
- Different behavior on same prompt across sessions
- System prompt file growing without bounds

**Prevention:**
1. Separate "Model Patches (Temporary)" from "World Knowledge (Permanent)"
2. Implement prompt "garbage collection" - periodic cleanup reviews
3. Set maximum prompt size budgets per agent
4. Version prompts and track behavioral changes
5. Test agent behavior after every prompt modification

**Phase Mapping:** Address in Phase 4 (Agent System) - Design prompt architecture with decay in mind

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or degraded user experience.

---

### Pitfall 6: Feature Creep via "Just One More Option"

**What goes wrong:** The tool becomes bloated with configuration options, modes, and flags. New users cannot learn it. Documentation cannot keep up. Core functionality buried under edge cases.

**Why it happens:**
- Each user request seems reasonable in isolation
- "Adding a flag" feels cheaper than saying no
- Source tools (GSD, OMC, OpenCode) each had their own feature sets
- No clear criteria for what belongs in v1

**Consequences:**
- 80% of features rarely or never used ([Pendo study](https://www.geteppo.com/blog/feature-creep))
- Developers spend 17.3 hours/week on complexity-related debugging ([Stripe report](https://www.designrush.com/agency/software-development/trends/feature-creep))
- iTunes syndrome - tool becomes sluggish and confusing
- Onboarding time increases exponentially

**Warning Signs:**
- Backlog growing faster than completion rate
- Users asking "what does this flag do?"
- Multiple ways to accomplish same task
- Documentation has more caveats than instructions

**Prevention:**
1. Establish strict feature criteria tied to core value proposition
2. "Say no" as default - require strong justification for additions
3. Track feature usage in telemetry
4. Kill unused features aggressively
5. One way to do each thing (Python philosophy)

**Phase Mapping:** Address in Phase 1 (Foundation) - Define scope boundaries before building

---

### Pitfall 7: Silent Failures in Agent Workflows

**What goes wrong:** Agents fail in ways that look successful. Code appears to work but has removed safety checks. Output format is correct but content is wrong. Users ship bugs they didn't know existed.

**Why it happens:**
- Modern LLMs avoid obvious errors (syntax, crashes)
- Failures manifest as semantic incorrectness, not technical errors
- No verification layer between agent output and user
- Optimistic assumption that "it compiled = it works"

**Consequences:**
- AI-generated PRs have 10.83 issues vs 6.45 for human code ([IEEE Spectrum](https://spectrum.ieee.org/ai-coding-degrades))
- Security vulnerabilities shipped unknowingly
- Logic errors discovered only in production
- Users stop trusting the tool after burned

**Warning Signs:**
- Tests pass but functionality is wrong
- Code reviews find issues AI should have caught
- "It works on my machine" from AI-generated code
- Users not reviewing AI output anymore

**Prevention:**
1. Mandatory Architect/Critic verification before claiming "done"
2. Never claim completion without fresh test run evidence
3. Implement semantic verification, not just syntax checks
4. Surface confidence levels to users
5. Require human approval for security-critical code

**Phase Mapping:** Address in Phase 4 (Agent System) - Build verification into agent contracts

---

### Pitfall 8: Review Bottleneck Negates Speed Gains

**What goes wrong:** AI generates code faster than humans can review it. The bottleneck shifts from generation to review. Large changesets accumulate, making review harder. Speed gains evaporate into review queues.

**Why it happens:**
- Natural bottleneck: review speed << generation speed
- AI can generate hundreds of changes before user notices
- Large changesets are exponentially harder to review
- No mechanism to throttle generation to review capacity

**Consequences:**
- Users approve changes without proper review (risk)
- Or review queues back up (negates speed benefit)
- Technical debt accumulates faster than before AI
- "Move fast, break things" without the "fix things" part

**Warning Signs:**
- Changeset size growing over time
- Review time per line decreasing (rubber-stamping)
- Bugs caught in production that should have been caught in review
- Users saying "I don't have time to review all this"

**Prevention:**
1. Enforce small, incremental changes (atomic commits)
2. Request one change at a time, validate, move on
3. Implement "review budget" - pause generation until caught up
4. Surface changeset size warnings to users
5. Break large tasks into reviewable units automatically

**Phase Mapping:** Address in Phase 3 (Execution) - Build review pacing into execution model

---

### Pitfall 9: Planning Without Execution Feedback Loop

**What goes wrong:** Plans are created but execution results don't update plans. Plans become stale. The "ralplan" verification loop runs once but not continuously. Reality diverges from documentation.

**Why it happens:**
- Planning and execution treated as separate phases
- Feedback requires bidirectional sync (hard to implement)
- "Plan once, execute many" mental model
- No triggers for re-planning on execution failures

**Consequences:**
- Plans show tasks as pending that actually completed
- Completed work not reflected in project status
- Manual reconciliation becomes necessary
- Users maintain shadow tracking systems

**Warning Signs:**
- Users manually updating documents after execution
- Discrepancies between plan and reality discovered late
- Questions like "did this actually run?"
- Plans that haven't been updated in days

**Prevention:**
1. Treat plan as living document, not artifact
2. Automatically update plan on task completion/failure
3. Implement execution event stream that plans subscribe to
4. Add "last verified" timestamps visible to users
5. Trigger re-planning on significant execution failures

**Phase Mapping:** Address in Phase 2 (Core Sync) - Bidirectional sync is core feature

---

### Pitfall 10: Agent Role Ambiguity

**What goes wrong:** Agent responsibilities overlap or have gaps. Planner and Architect disagree on scope. Executor makes architectural decisions. Critic doesn't have criteria for approval.

**Why it happens:**
- Roles defined in prose, not contracts
- Natural language allows interpretation
- No formal handoff protocol between agents
- Edge cases not covered by role definitions

**Consequences:**
- Inconsistent results from same input
- Wasted compute on overlapping work
- Gaps where no agent takes responsibility
- "Whose job is this?" becomes common question

**Warning Signs:**
- Same task handled differently on repeat runs
- Agents producing conflicting recommendations
- Tasks falling through cracks (nobody owns them)
- Debugging requires understanding agent internals

**Prevention:**
1. Define explicit input/output contracts per agent
2. Specify exactly what each agent can and cannot decide
3. Implement formal handoff protocol with required fields
4. Add conflict detection when agents disagree
5. Single agent owns each decision type (no overlap)

**Phase Mapping:** Address in Phase 4 (Agent System) - Define contracts before implementing agents

---

## Minor Pitfalls

Mistakes that cause annoyance but are recoverable.

---

### Pitfall 11: CLI Ergonomics Neglected

**What goes wrong:** Commands are verbose, flags are inconsistent, error messages are cryptic. Users struggle with basic operations. Mental model doesn't match tool structure.

**Prevention:**
1. Consistent flag naming conventions
2. Progressive disclosure (simple default, advanced optional)
3. Helpful error messages with suggested fixes
4. Shell completion support
5. Test with new users, not just power users

**Phase Mapping:** Address in Phase 5 (Polish) - UX refinement after core works

---

### Pitfall 12: Insufficient Error Recovery

**What goes wrong:** Failures leave system in inconsistent state. Users must manually clean up. No clear path to resume from failure.

**Prevention:**
1. Design for failure from the start
2. Implement checkpoints for long-running operations
3. Provide "resume" capability, not just "restart"
4. Clean up partial state on failure
5. Surface clear recovery instructions

**Phase Mapping:** Address in Phase 3 (Execution) - Build recovery into execution engine

---

### Pitfall 13: Configuration File Sprawl

**What goes wrong:** Config lives in multiple places (.ultraplan/, ~/.config/, CLAUDE.md, .env). Users don't know which config applies. Different config formats (JSON, YAML, Markdown).

**Prevention:**
1. Single canonical config location with clear precedence
2. One format (recommend JSON for tooling support)
3. Config validation on load with helpful errors
4. `--show-config` command to see effective configuration
5. Migration tool for legacy config locations

**Phase Mapping:** Address in Phase 1 (Foundation) - Establish config architecture early

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1: Foundation | Feature creep from source tools | Strict scope definition, explicit "not in v1" list |
| Phase 2: Document System | Sync failure silent or delayed | Bidirectional sync with conflict detection |
| Phase 3: Parallel Execution | File conflicts, cost explosion | File ownership tracking, token budgets |
| Phase 4: Agent System | Role ambiguity, prompt decay | Explicit contracts, prompt version control |
| Phase 5: Integration | Cross-phase state inconsistency | End-to-end testing, state reconciliation |

---

## Domain-Specific Risk Matrix

| Risk Area | Probability | Impact | Mitigation Priority |
|-----------|-------------|--------|---------------------|
| Tool integration complexity | HIGH | CRITICAL | Phase 1 - define boundaries |
| Document-execution sync failure | HIGH | CRITICAL | Phase 2 - core architecture |
| Parallel file conflicts | MEDIUM | HIGH | Phase 3 - before enabling parallel |
| Token cost explosion | MEDIUM | HIGH | Phase 3 - budget enforcement |
| Prompt/context decay | MEDIUM | MEDIUM | Phase 4 - prompt architecture |
| Feature creep | HIGH | MEDIUM | Ongoing - governance process |
| Silent agent failures | MEDIUM | HIGH | Phase 4 - verification layer |
| Review bottleneck | LOW | MEDIUM | Phase 3 - atomic changes |

---

## Sources

### HIGH Confidence (Official/Research)
- [Deloitte: AI Agent Orchestration Predictions 2026](https://www.deloitte.com/us/en/insights/industry/technology/technology-media-and-telecom-predictions/2026/ai-agent-orchestration.html) - 40% cancellation rate projection
- [IEEE Spectrum: AI Coding Degradation](https://spectrum.ieee.org/ai-coding-degrades) - Issue rates in AI-generated code
- [Microsoft: AI Agent Design Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) - Architecture patterns and anti-patterns

### MEDIUM Confidence (Multiple Sources Agree)
- [Addy Osmani: LLM Coding Workflow 2026](https://addyosmani.com/blog/ai-coding-workflow/) - Practical workflow lessons
- [DEV.to: Why AI Coding Tools Fail](https://dev.to/lofcz/why-most-ai-coding-tools-fail-and-how-they-succeed-i31) - Tool architecture failures
- [Multi-Agent Orchestration Enterprise Guide](https://www.onabout.ai/p/mastering-multi-agent-orchestration-architectures-patterns-roi-benchmarks-for-2025-2026) - Common failure patterns
- [PromptLayer: LLM Distraction Research](https://blog.promptlayer.com/why-llms-get-distracted-and-how-to-write-shorter-prompts/) - Context degradation
- [Simon Willison: Parallel Coding Agents](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/) - File conflict issues

### LOW Confidence (Single Source/Unverified)
- [Merge.dev: Software Integration Challenges 2026](https://www.merge.dev/blog/software-integration-challenges) - Integration complexity patterns
- [Autonoly: Workflow Automation Mistakes](https://www.autonoly.com/blog/689425c15e45ab09470d4531/my-automation-failed-7-common-workflow-automation-mistakes-and-how-to-fix-them) - Automation failure modes
