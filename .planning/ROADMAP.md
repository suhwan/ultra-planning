# Roadmap: Ultra Planner

## Overview

Ultra Planner delivers a document-driven workflow orchestration system for Claude Code, integrating the best practices from GSD, OMC, and OpenCode. The journey progresses from foundational document structures through planning agents, sequential execution, Claude Tasks synchronization (the core differentiator), quality verification loops, natural language interface, and finally parallel execution. Each phase builds on the previous, with document-task sync validated early to prove the core value proposition.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

**Dependency Graph:**
```
Phase 1 ──> Phase 2 ──> Phase 2.5 ──> Phase 3 ──┬──> Phase 4 ──┬──> Phase 7
            (Foundation) (PoC Spike)  (Execution) │   (Tasks Sync)│
                                                  │               │
                                                  └──> Phase 5 ───┤
                                                       (Quality)  │
                                                                  v
                                                              Phase 6
                                                           (Natural Lang)
```

**Critical Path:** Phase 1 → 2 → 2.5 → 3 → 4 → 6 (Tasks API verification is key risk)

- [ ] **Phase 1: Foundation** - Document templates, CLI structure, and state management infrastructure
- [ ] **Phase 2: Core Planning** - Planner agent generating PROJECT, ROADMAP, and PLAN documents
- [ ] **Phase 2.5: Tasks API Spike** - INSERTED: Claude Tasks API verification PoC (key risk mitigation)
- [ ] **Phase 3: Sequential Execution** - Executor and Architect agents with verification gates
- [ ] **Phase 4: Document-Task Sync** - PLAN to Claude Tasks bidirectional synchronization (core differentiator)
- [ ] **Phase 5: Quality Layer** - Critic agent and ralplan iterative verification loop
- [ ] **Phase 6: Natural Language** - Keyword detection, slash commands, and autopilot mode
- [ ] **Phase 7: Parallelism** - 5-worker parallel execution with file ownership tracking

## Phase Details

### Phase 1: Foundation
**Goal**: Establish document hierarchy and state management that all other phases depend on
**Depends on**: Nothing (first phase)
**Requirements**: DOCS-01, DOCS-02, DOCS-03
**Success Criteria** (what must be TRUE):
  1. User can run `/ultraplan:new-project` and get PROJECT.md, ROADMAP.md skeleton created
  2. STATE.md tracks current phase, plan, and status with visual progress bar
  3. Documents use XML tags for task structure and YAML frontmatter for metadata
  4. `.ultraplan/` directory structure exists with state, plans, and config subdirectories
**Plans**: 5 plans

Plans:
- [ ] 01-01-PLAN.md - Create .ultraplan/ directory structure and config.json schema
- [ ] 01-02-PLAN.md - Create document templates (PROJECT, ROADMAP, PLAN)
- [ ] 01-03-PLAN.md - Create STATE.md template and update protocols
- [ ] 01-04-PLAN.md - Document YAML frontmatter and XML task schemas
- [ ] 01-05-PLAN.md - Create SKILL.md and CLI command skeletons

### Phase 2: Core Planning
**Goal**: Generate complete planning documents from user input via Planner agent
**Depends on**: Phase 1
**Requirements**: AGENT-02 (planner agent portion)
**Success Criteria** (what must be TRUE):
  1. Planner agent (Opus) generates PROJECT.md from user description
  2. Planner agent decomposes project into phases in ROADMAP.md
  3. Planner agent generates PLAN.md with task breakdowns for each phase
  4. User can review and approve generated documents before proceeding
**Plans**: 6 plans

Plans:
- [ ] 02-01-PLAN.md — Create Planner agent core with interview protocol
- [ ] 02-02-PLAN.md — Add PROJECT.md and ROADMAP.md generation logic
- [ ] 02-03-PLAN.md — Add PLAN.md generation with wave assignment
- [ ] 02-04-PLAN.md — Create /ultraplan:new-project command
- [ ] 02-05-PLAN.md — Add review and approval workflow
- [ ] 02-06-PLAN.md — Integration verification (checkpoint)

### Phase 2.5: Tasks API Spike (INSERTED)
**Goal**: Validate Claude Tasks API feasibility before committing to Phase 4 architecture
**Depends on**: Phase 2
**Requirements**: None (risk mitigation spike)
**Success Criteria** (what must be TRUE):
  1. Claude Tasks API capabilities and limitations documented
  2. PoC demonstrates PLAN.md → Claude Tasks conversion
  3. PoC demonstrates Claude Tasks → PLAN.md status sync
  4. API rate limits and constraints identified
  5. Go/No-Go decision for Phase 4 approach
**Plans**: TBD (estimated 2-3 plans)

Plans:
- [ ] 02.5-01: Claude Tasks API research and documentation
- [ ] 02.5-02: Bidirectional sync PoC implementation
- [ ] 02.5-03: Feasibility report and architecture recommendation

### Phase 3: Sequential Execution
**Goal**: Execute tasks one at a time with verification gates and atomic commits
**Depends on**: Phase 2
**Requirements**: AGENT-01, AGENT-02 (executor and architect portions), EXEC-05
**Success Criteria** (what must be TRUE):
  1. Executor agent (Sonnet) runs individual tasks from PLAN.md with fresh 200k context
  2. Architect agent (Opus) verifies task completion before marking done
  3. Task results are captured and state is updated after each task
  4. Failed verifications trigger retry with feedback
  5. Each completed task triggers atomic git commit with descriptive message
**Plans**: TBD (estimated 7-9 plans)

Plans:
- [ ] 03-01: Executor agent definition (.claude/agents/executor.md)
- [ ] 03-02: Fresh subagent spawning pattern
- [ ] 03-03: Architect agent definition (.claude/agents/architect.md)
- [ ] 03-04: Verification gate protocol
- [ ] 03-05: Result capture and state updates
- [ ] 03-06: Retry loop with failure feedback
- [ ] 03-07: Router for agent coordination
- [ ] 03-08: Atomic commit protocol per task

### Phase 4: Document-Task Sync
**Goal**: Bidirectional synchronization between PLAN.md and Claude Tasks (core differentiator)
**Depends on**: Phase 3
**Requirements**: EXEC-01, EXEC-02
**Success Criteria** (what must be TRUE):
  1. Tasks in PLAN.md automatically register as Claude Tasks
  2. Task completion in Claude updates PLAN.md status
  3. Dependency analysis creates correct task execution order
  4. Sync conflicts are detected with resolution options
  5. Staleness indicators show when documents are out of sync
**Plans**: TBD (estimated 6-8 plans)

Plans:
- [ ] 04-01: Claude Tasks API integration research
- [ ] 04-02: PLAN.md to Claude Tasks conversion
- [ ] 04-03: Claude Tasks to PLAN.md status sync
- [ ] 04-04: Dependency graph analysis
- [ ] 04-05: Conflict detection and resolution
- [ ] 04-06: Staleness indicators and sync health checks
- [ ] 04-07: Sync reconciliation rules

### Phase 5: Quality Layer
**Goal**: Iterative verification loop ensuring plans meet quality standards before execution
**Depends on**: Phase 2 (Planner for ralplan), Phase 3 (Executor/Architect)
**Requirements**: AGENT-02 (critic portion), AGENT-03, AGENT-04
**Success Criteria** (what must be TRUE):
  1. Critic agent (Opus) reviews plans and identifies gaps
  2. Ralplan loop (Planner + Architect + Critic) iterates until consensus
  3. Verification protocol runs automatically after execution
  4. User receives clear approval/rejection with actionable feedback
**Plans**: TBD (estimated 5-7 plans)

Plans:
- [ ] 05-01: Critic agent definition (.claude/agents/critic.md)
- [ ] 05-02: Plan review protocol
- [ ] 05-03: Ralplan iteration loop
- [ ] 05-04: Consensus detection logic
- [ ] 05-05: Post-execution verification protocol
- [ ] 05-06: Approval/rejection workflow with feedback

### Phase 6: Natural Language
**Goal**: Natural language interface with keyword detection and autopilot mode
**Depends on**: Phase 4, Phase 5
**Requirements**: NL-01, NL-02, NL-03, NL-04
**Success Criteria** (what must be TRUE):
  1. User can run `/ultraplan:plan`, `/ultraplan:execute`, `/ultraplan:status` commands
  2. Ambiguous requests trigger clarifying questions before proceeding
  3. Keywords "autopilot", "plan", "execute" trigger appropriate behaviors
  4. Autopilot mode executes end-to-end without manual intervention
  5. Manual mode (default) requires explicit triggers for each step
**Plans**: TBD (estimated 6-8 plans)

Plans:
- [ ] 06-01: Slash command router implementation
- [ ] 06-02: Keyword detection system
- [ ] 06-03: Intent classification logic
- [ ] 06-04: Ambiguity detection and question generation
- [ ] 06-05: Autopilot mode orchestration
- [ ] 06-06: Manual mode step-by-step workflow
- [ ] 06-07: Mode switching logic

### Phase 7: Parallelism
**Goal**: Execute up to 5 tasks in parallel with file ownership tracking
**Depends on**: Phase 3 (Executor), Phase 4 (Tasks Sync for dependency waves)
**Requirements**: EXEC-03, EXEC-04
**Success Criteria** (what must be TRUE):
  1. Up to 5 executor workers run concurrently on independent tasks
  2. File ownership is tracked per worker to prevent conflicts
  3. Wave-based grouping dispatches dependency-free tasks together
  4. Parallel write conflicts are detected and prevented before execution
  5. Results from all workers are merged and reconciled
**Plans**: TBD (estimated 7-9 plans)

Plans:
- [ ] 07-01: Task queue with dependency waves
- [ ] 07-02: File ownership tracking system
- [ ] 07-03: Worker pool management (max 5)
- [ ] 07-04: Pre-execution conflict detection
- [ ] 07-05: Concurrent task dispatch
- [ ] 07-06: Result collection and merging
- [ ] 07-07: Conflict resolution strategies
- [ ] 07-08: Worker health and timeout handling

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 2.5 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/5 | Planned | - |
| 2. Core Planning | 0/6 | Planned | - |
| 2.5. Tasks API Spike | 0/3 | Not started | - |
| 3. Sequential Execution | 0/8 | Not started | - |
| 4. Document-Task Sync | 0/7 | Not started | - |
| 5. Quality Layer | 0/6 | Not started | - |
| 6. Natural Language | 0/7 | Not started | - |
| 7. Parallelism | 0/8 | Not started | - |

---
*Roadmap created: 2026-01-26*
*Roadmap revised: 2026-01-26 (Architect review)*
*Phase 1 planned: 2026-01-26*
*Depth: comprehensive (8 phases, 49 estimated plans)*
*Coverage: 16/16 v1 requirements mapped*
