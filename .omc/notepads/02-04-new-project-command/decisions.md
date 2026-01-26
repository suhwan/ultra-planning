# Decisions: 02-04 New Project Command

## Command Design Decisions

### 1. Agent Spawning Over Direct Implementation

**Decision:** Command file delegates to agent rather than implementing logic directly.

**Rationale:**
- Separation of concerns: command = orchestration, agent = execution
- Enables reuse of planner agent from multiple entry points
- Keeps command definition focused on decision logic and context assembly

**Alternative Considered:** Implement interview logic directly in command file
**Rejected Because:** Would duplicate agent capabilities and mix orchestration with implementation

### 2. Pre-flight State Checks

**Decision:** Check for existing PROJECT.md and .ultraplan/ before spawning agent.

**Rationale:**
- Prevents accidental overwrites
- Gives user early warning if project already initialized
- Reduces wasted agent invocations

**Alternative Considered:** Let agent handle all checks
**Rejected Because:** User gets faster feedback with pre-flight checks

### 3. Context Assembly via Bash Commands

**Decision:** Use bash commands to detect brownfield vs greenfield before spawning agent.

**Rationale:**
- Provides richer context to agent prompt
- Enables agent to ask better questions
- Reduces redundant discovery work

**Alternative Considered:** Let agent discover context itself
**Rejected Because:** Pre-gathering context is more efficient

### 4. Template Variable Replacement

**Decision:** Document explicit variable replacement pattern for prompt template.

**Rationale:**
- Makes command behavior predictable
- Enables testing and verification
- Clear contract between command and agent

**Alternative Considered:** Free-form prompt generation
**Rejected Because:** Templates ensure consistency

### 5. Error Handling Documentation

**Decision:** Include comprehensive error tables and recovery procedures.

**Rationale:**
- Makes command maintainable
- Guides future enhancements
- Helps debugging when issues arise

**Alternative Considered:** Minimal error documentation
**Rejected Because:** Complex commands need detailed error specifications

## Model Selection

**Decision:** Use Opus for planner agent.

**Rationale:**
- Strategic planning requires highest reasoning capability
- Interview flow benefits from sophisticated context awareness
- Plan quality directly impacts all downstream work

**Alternative Considered:** Use Sonnet for cost savings
**Rejected Because:** Planning is infrequent but critical, warrants highest capability
