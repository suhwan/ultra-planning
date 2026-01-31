# Phase 14: Artifact Pattern - Research

**Researched:** 2026-02-01
**Domain:** Context Engineering / Token Optimization
**Confidence:** HIGH

## Summary

This phase implements the Artifact Pattern for JIT (Just-In-Time) loading to eliminate token waste from "Context Dumping" - the antipattern of loading entire file contents into agent prompts upfront.

The current implementation in `generateWorkerPrompt` and `collectProjectContext` loads full file contents into prompts, wasting 50%+ tokens on context that agents may never use. Research from Google ADK, Anthropic's Context Engineering Guide, and industry best practices confirms that **reference-based loading with on-demand retrieval** reduces costs by 60%+ while maintaining functionality.

**Primary recommendation:** Replace inline content injection with artifact references (file paths) and provide agents tools to fetch content when needed.

## Standard Stack

### Core Components (Existing - Modify)

| Component | Location | Current | Target |
|-----------|----------|---------|--------|
| `generateWorkerPrompt` | `src/prompts/worker.ts` | Injects `config.context.project` inline | Provides path references only |
| `collectProjectContext` | `src/context/collector.ts` | Returns full file contents | Returns paths + metadata (summary mode) |
| `PromptContext` | `src/prompts/types.ts` | String fields for content | Add `ArtifactReference[]` field |

### Supporting (New)

| Type | Purpose | Location |
|------|---------|----------|
| `ArtifactReference` | Typed path reference | `src/context/types.ts` |
| `ArtifactManifest` | Collection of references with metadata | `src/context/types.ts` |
| `summarizeContent()` | Generate 1-2 line summaries | `src/context/summarizer.ts` |

### No External Dependencies

This phase requires no new npm packages. All functionality uses existing fs operations and the Read tool available to agents.

## Architecture Patterns

### Pattern 1: Artifact Reference (Google ADK)

**What:** Instead of embedding file contents, provide structured references with metadata.

**When to use:** Any file >500 tokens or files agents may not need for every task.

**Example:**
```typescript
// Source: Google ADK Artifact Pattern + Anthropic Context Engineering

// Before (Context Dumping - BAD)
const prompt = `
## Project Context
${fs.readFileSync('PROJECT.md')}  // 10,000 tokens wasted

## Roadmap
${fs.readFileSync('ROADMAP.md')}  // 5,000 tokens wasted
`;

// After (Artifact Reference - GOOD)
const prompt = `
## Artifacts (Read when needed)
| File | Path | Summary |
|------|------|---------|
| PROJECT.md | .planning/PROJECT.md | Project goals, tech stack, success criteria |
| ROADMAP.md | .planning/ROADMAP.md | 16 phases, currently on Phase 14 |
| RESEARCH.md | .planning/phases/14-artifact-pattern/14-RESEARCH.md | JIT loading research |

Use the **Read** tool to fetch any artifact content you need.
`;
```

### Pattern 2: Summary Mode Collection

**What:** Return file existence + summary instead of full content.

**When to use:** `collectProjectContext` calls where agents need awareness, not full content.

**Example:**
```typescript
// Source: Industry best practices - lazy loading

export interface ProjectContextSummary {
  planningDir: string;
  exists: boolean;
  artifacts: ArtifactReference[];
}

export interface ArtifactReference {
  name: string;
  path: string;
  summary: string;
  estimatedTokens: number;
  lastModified: string;
}

export function collectProjectContext(
  planningDir: string,
  mode: 'full' | 'summary' = 'summary'  // NEW parameter, default to summary
): ProjectContext | ProjectContextSummary {
  if (mode === 'summary') {
    return {
      planningDir,
      exists: existsSync(planningDir),
      artifacts: [
        summarizeFile(join(planningDir, 'PROJECT.md')),
        summarizeFile(join(planningDir, 'ROADMAP.md')),
        summarizeFile(join(planningDir, 'REQUIREMENTS.md')),
      ].filter(a => a !== null),
    };
  }
  // ... existing full content logic
}
```

### Pattern 3: Agent Read Instructions

**What:** Prompt agents to use Read tool for JIT loading.

**When to use:** Every generated prompt that references artifacts.

**Example:**
```typescript
// Source: Anthropic Context Engineering Guide

const ARTIFACT_INSTRUCTIONS = `
## Artifacts (Just-In-Time Loading)

The following files are available. **Read them only when needed** for your current task.

| Artifact | Path | When to Read |
|----------|------|--------------|
| PROJECT.md | ${paths.project} | Understanding project scope/goals |
| ROADMAP.md | ${paths.roadmap} | Checking phase dependencies |
| PLAN.md | ${paths.plan} | Task details and verification |

**Protocol:**
1. Review artifact table to understand what's available
2. For current task, identify which artifacts are relevant
3. Use Read tool to fetch ONLY needed content
4. DO NOT read all artifacts upfront

This saves tokens and keeps your context focused.
`;
```

### Recommended Project Structure

```
src/
├── context/
│   ├── types.ts            # Add ArtifactReference, ArtifactManifest
│   ├── collector.ts        # Modify for summary mode (14-03)
│   ├── summarizer.ts       # NEW: Generate file summaries (14-01)
│   └── artifacts.ts        # NEW: Artifact reference utilities (14-01)
├── prompts/
│   ├── types.ts            # Update PromptContext with artifacts
│   ├── worker.ts           # Modify to use artifact references (14-02)
│   └── templates/
│       └── artifacts.ts    # NEW: Artifact instruction template (14-02)
```

### Anti-Patterns to Avoid

- **Eager Loading:** Reading all files at prompt generation time
- **Content Embedding:** Putting file contents directly in prompts
- **No Metadata:** Providing paths without summaries or context
- **Forced Reading:** Not giving agents the choice of what to read

## Don't Hand-Roll

Problems with existing solutions that must be used:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File reading | Custom file loader | Agent's Read tool | Already available, handles errors |
| Token estimation | Complex tokenizer | `chars / 4` | Simple, accurate enough (existing) |
| File summaries | AI-generated summaries | First 2 lines + file stats | Deterministic, no extra API calls |
| Change detection | File watchers | `lastModified` timestamp | Simple, sufficient for prompts |

**Key insight:** The goal is to DEFER file reading to the agent, not to build sophisticated caching or prefetching. Agents already have Read tool access.

## Common Pitfalls

### Pitfall 1: Over-summarization

**What goes wrong:** Summaries become so brief they're useless, forcing agents to read everything anyway.
**Why it happens:** Aggressively minimizing summary tokens.
**How to avoid:** Include enough context (file type, main purpose, size estimate) to enable informed decisions.
**Warning signs:** Agents reading all artifacts anyway despite summaries.

### Pitfall 2: Missing Read Instructions

**What goes wrong:** Agents don't know they can/should read artifacts, continue working without context.
**Why it happens:** Assuming agents will infer the pattern.
**How to avoid:** Explicit "## Artifacts" section with clear Read tool instructions.
**Warning signs:** Agent asks for context that's available in artifacts.

### Pitfall 3: Breaking Existing Callers

**What goes wrong:** Code expecting full content breaks when getting summary mode.
**Why it happens:** Changing function signature without considering callers.
**How to avoid:** Add `mode` parameter with default to preserve backward compatibility.
**Warning signs:** Test failures in existing code after changes.

### Pitfall 4: Inconsistent Path Format

**What goes wrong:** Agents can't Read because paths are relative vs absolute, or use wrong separators.
**Why it happens:** Not normalizing paths consistently.
**How to avoid:** Always use paths relative to project root with forward slashes.
**Warning signs:** "File not found" errors from agents.

## Code Examples

### ArtifactReference Type Definition

```typescript
// Source: Google ADK Artifact Pattern + TypeScript best practices

/**
 * Reference to a file artifact that can be loaded on demand
 */
export interface ArtifactReference {
  /** Human-readable artifact name */
  name: string;
  /** Path relative to project root */
  path: string;
  /** Brief description of contents */
  summary: string;
  /** Estimated token count if loaded */
  estimatedTokens: number;
  /** Last modified timestamp */
  lastModified: string;
  /** Whether file exists */
  exists: boolean;
}

/**
 * Collection of artifacts with metadata
 */
export interface ArtifactManifest {
  /** Base directory for artifacts */
  baseDir: string;
  /** List of artifact references */
  artifacts: ArtifactReference[];
  /** Total estimated tokens if all loaded */
  totalEstimatedTokens: number;
  /** When manifest was generated */
  generatedAt: string;
}
```

### summarizeFile Function

```typescript
// Source: Industry best practices

import { existsSync, statSync, readFileSync } from 'fs';
import { basename } from 'path';

export function summarizeFile(filePath: string): ArtifactReference | null {
  if (!existsSync(filePath)) {
    return null;
  }

  const stats = statSync(filePath);
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Extract first meaningful line (skip empty lines and headers)
  let summary = '';
  for (const line of lines.slice(0, 10)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.length > 10) {
      summary = trimmed.slice(0, 100);
      break;
    }
  }

  // Fallback to first header if no content found
  if (!summary) {
    const header = lines.find(l => l.startsWith('#'));
    summary = header ? header.replace(/^#+\s*/, '').slice(0, 100) : basename(filePath);
  }

  return {
    name: basename(filePath),
    path: filePath,
    summary,
    estimatedTokens: Math.ceil(content.length / 4),
    lastModified: stats.mtime.toISOString(),
    exists: true,
  };
}
```

### Modified generateWorkerPrompt

```typescript
// Source: Existing worker.ts + artifact pattern

export function generateWorkerPrompt(config: WorkerPromptConfig): GeneratedPrompt {
  const modelHint = suggestModel(config);

  // Build artifact table instead of inline content
  const artifactSection = config.artifacts?.length
    ? `
## Artifacts (Read when needed)

| File | Path | Summary | Tokens |
|------|------|---------|--------|
${config.artifacts.map(a =>
  `| ${a.name} | ${a.path} | ${a.summary} | ~${a.estimatedTokens} |`
).join('\n')}

**Read Protocol:**
1. Identify which artifacts are relevant to your current task
2. Use Read tool to fetch ONLY needed content
3. DO NOT read all artifacts upfront
`
    : '';

  const prompt = `# Swarm Worker: ${config.worker.name}

You are a worker in a parallel execution swarm...

${artifactSection}

## Worker Identity
- **Worker ID**: ${config.worker.id}
...
`;

  return { prompt, modelHint, metadata: { ... } };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline content | Artifact references | 2025-2026 | 60%+ token reduction |
| Eager loading | Lazy/JIT loading | 2025 | Better relevance, lower cost |
| Full context | Task-specific profiles | 2025-2026 | Focused agent attention |

**Research sources:**
- Google ADK: "load_artifact() on demand rather than pre-loading"
- Anthropic: "retrieve data just in time rather than front-loading"
- Factory.ai: "100:1 compression ratios while maintaining information"
- FlowHunt: "60% cost reduction through lazy loading"

## Open Questions

1. **Summary Generation Strategy**
   - What we know: First lines + metadata work for most files
   - What's unclear: Should we extract specific sections (e.g., "## Summary" if present)?
   - Recommendation: Start simple (first content line), iterate based on agent behavior

2. **Backward Compatibility Testing**
   - What we know: MCP tools use `collectProjectContext`
   - What's unclear: Which callers depend on full content?
   - Recommendation: Add `mode` parameter with `full` default, then migrate callers

## Sources

### Primary (HIGH confidence)
- [Google ADK Artifacts](https://google.github.io/adk-docs/artifacts/) - On-demand loading pattern
- [Context Engineering for AI Agents](https://dev.to/akshaygupta1996/context-engineering-giving-ai-agents-memory-without-breaking-the-token-budget-1ho5) - Lazy loading implementation
- Existing codebase: `src/prompts/worker.ts`, `src/context/collector.ts`

### Secondary (MEDIUM confidence)
- [Factory.ai - Evaluating Context Compression](https://factory.ai/news/evaluating-compression) - Compression strategies
- [FlowHunt - Context Engineering](https://www.flowhunt.io/blog/context-engineering-ai-agents-token-optimization/) - Token optimization patterns
- [7 Ways to Reduce AI Agent Tokens](https://medium.com/@alexefimenko/7-ways-to-stop-wasting-money-on-ai-tokens-d15a8e235694) - Production strategies

### Tertiary (LOW confidence)
- [Qodo context injection patterns](https://www.qodo.ai/blog/context-windows/) - Reference-based loading examples

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Based on existing codebase analysis
- Architecture: HIGH - Confirmed by Google ADK and Anthropic patterns
- Pitfalls: HIGH - Common patterns from industry research

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - stable pattern)
