# Phase 1: 프로젝트 구조 - Research

**Researched:** 2026-01-26
**Domain:** TypeScript Project Setup + .ultraplan/ Directory Structure
**Confidence:** HIGH

## Summary

Phase 1 establishes the TypeScript-based project structure for Ultra Planner v2. Unlike v1 (which was purely document-driven), v2 requires a buildable TypeScript project with proper module organization, type definitions, and directory structure. The goal is a minimal but functional foundation that `npm run build` succeeds on.

The research confirms that modern TypeScript projects should use ESM modules with Node.js 22+ compatibility. The .ultraplan/ directory will serve as the runtime state location, following the OMC mode-registry pattern for file-based state management. Type definitions should be centralized in a `types.ts` file following patterns established in the oh-my-claudecode references.

**Primary recommendation:** Create a minimal ESM TypeScript project with Node.js 22+ target, strict mode enabled, and a single `types.ts` file containing core type definitions extracted from the existing oh-my-claudecode patterns.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.7.x | Type system and compilation | Native ESM support, Node.js 22+ compatibility |
| Node.js | >=22.0.0 | Runtime target | LTS version, native TypeScript stripping support |
| Zod | ^3.25.0 | Runtime type validation | Proven library, supports both v3 and v4 patterns |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | ^4.x | Testing framework | Unit tests for core functionality |
| @types/node | ^22.x | Node.js type definitions | Development only |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ESM module | CommonJS | ESM is the modern standard; CJS is legacy |
| Vitest | Jest | Vitest has native ESM/TypeScript support; Jest requires more config |
| tsconfig base | @tsconfig/node22 | Manual config is more explicit; presets can be opinionated |
| Zod | AJV + ts-interface-builder | Zod has better DX and type inference |

**Installation:**
```bash
npm init -y
npm install typescript zod
npm install -D @types/node vitest
```

## Architecture Patterns

### Recommended Project Structure

```
.ultraplan/                # Runtime state directory (created by tool)
├── config.json            # Project-specific configuration
├── state/                 # Execution state files
│   └── session.json       # Active session state
└── logs/                  # Optional execution logs

src/                       # TypeScript source
├── types.ts               # Core type definitions
└── index.ts               # Entry point (minimal, exports types)

dist/                      # Compiled output (generated)
├── types.js
├── types.d.ts
└── index.js

package.json
tsconfig.json
```

### Pattern 1: ESM Module with NodeNext Resolution

**What:** Modern ES Modules with Node.js-style resolution.

**When to use:** All TypeScript projects targeting Node.js 22+.

**Example:**
```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "types": ["node"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Source:** [TypeScript TSConfig Reference](https://www.typescriptlang.org/tsconfig/), [oh-my-claudecode tsconfig.json](verified in references/oh-my-claudecode/tsconfig.json)

### Pattern 2: Type-First Development

**What:** Define types before implementation. Types serve as the contract.

**When to use:** When building a system that will integrate with other components (agents, skills, CLI).

**Example:**
```typescript
// src/types.ts
export type ExecutionMode = 'planning' | 'executing' | 'verifying' | 'idle';

export interface PlanState {
  phase: string;
  plan: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  wave: number;
}

export interface SessionState {
  active_plan: string | null;
  started_at: string;
  session_id: string;
}
```

**Source:** [oh-my-claudecode/src/hooks/mode-registry/types.ts](verified in references)

### Pattern 3: Mode Registry State Pattern

**What:** File-based state management with JSON files in a dedicated state directory.

**When to use:** For sharing state between orchestrator and subagents.

**Example:**
```typescript
// Pattern from OMC mode-registry
export interface ModeConfig {
  name: string;
  stateFile: string;      // Relative to .ultraplan/state/
  markerFile?: string;    // Optional marker for active state
  activeProperty?: string; // Property to check for active status
}

// State is stored as: .ultraplan/state/{mode}-state.json
```

**Source:** [oh-my-claudecode/src/hooks/mode-registry/index.ts](verified in references)

### Anti-Patterns to Avoid

- **Mixed CJS/ESM:** Don't use `require()` in ESM modules. Use `import` consistently.
- **Barrel exports without re-exporting types:** If using barrel files (`index.ts`), ensure types are re-exported.
- **Implicit any:** Keep `strict: true` and avoid suppressing type errors.
- **Circular dependencies:** Types should flow in one direction (types.ts → implementations).

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type validation at runtime | Custom type guards everywhere | Zod schemas | Generates both types and validators |
| JSON config parsing | Custom parsers | Zod + resolveJsonModule | Type-safe config with validation |
| Directory creation | Custom recursive mkdir | `fs.mkdirSync(..., { recursive: true })` | Built into Node.js |
| File existence checks | Try/catch wrappers | `fs.existsSync()` | Simpler, synchronous |

**Key insight:** This is a foundation phase. Keep dependencies minimal. Only add what's needed for `npm run build` to succeed.

## Common Pitfalls

### Pitfall 1: Module Resolution Mismatch

**What goes wrong:** TypeScript compiles but Node.js fails to resolve imports at runtime.

**Why it happens:** `moduleResolution` doesn't match actual module system, or missing `.js` extensions in imports.

**How to avoid:**
- Use `"moduleResolution": "NodeNext"` with `"module": "NodeNext"`
- Add `.js` extensions to relative imports when using `NodeNext`
- Or use `"moduleResolution": "bundler"` if using a bundler

**Warning signs:** `ERR_MODULE_NOT_FOUND` at runtime despite successful compilation.

### Pitfall 2: Missing Type Declarations

**What goes wrong:** `npm run build` succeeds but consuming projects can't use types.

**Why it happens:** `declaration: true` not set, or declaration files not in package exports.

**How to avoid:**
- Set `"declaration": true` in tsconfig
- Set `"declarationMap": true` for source mapping
- Ensure `"types"` field in package.json points to declaration entry

**Warning signs:** "Could not find declaration file" errors in consuming projects.

### Pitfall 3: State Directory Not Existing

**What goes wrong:** First-time users get ENOENT errors when tool tries to write state.

**Why it happens:** Assuming .ultraplan/ exists without creating it.

**How to avoid:**
- Use `fs.mkdirSync(path, { recursive: true })` before any write
- Or check existence and create in initialization code
- Document that `/ultraplan:new-project` creates the directory

**Warning signs:** ENOENT errors on first run, "directory not found" in logs.

### Pitfall 4: Strict Mode Violations

**What goes wrong:** Existing code patterns from references don't compile.

**Why it happens:** References may have been written with different strictness settings.

**How to avoid:**
- Start with `strict: true` from day one
- Add explicit types to all function parameters
- Use `| undefined` instead of optional chaining for potentially undefined values

**Warning signs:** Many "Parameter 'x' implicitly has 'any' type" errors.

## Code Examples

### package.json Template

```json
{
  "name": "ultra-planner",
  "version": "0.1.0",
  "description": "Document-driven workflow orchestration for Claude Code",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "engines": {
    "node": ">=22.0.0"
  },
  "dependencies": {
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0",
    "vitest": "^4.0.0"
  }
}
```

**Source:** Based on [oh-my-claudecode/package.json](verified in references) with simplifications for v0.1.0

### tsconfig.json Template

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "types": ["node"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Source:** Based on [oh-my-claudecode/tsconfig.json](verified in references), [Modern Node.js TypeScript Setup](https://dev.to/woovi/a-modern-nodejs-typescript-setup-for-2025-nlk)

### Core Types Template (src/types.ts)

```typescript
/**
 * Ultra Planner Core Types
 *
 * Type definitions for the orchestration system.
 * Based on patterns from oh-my-claudecode mode-registry.
 */

// ============================================================================
// Execution Modes
// ============================================================================

/** Execution mode states */
export type ExecutionMode =
  | 'idle'
  | 'planning'
  | 'executing'
  | 'verifying'
  | 'paused'
  | 'error';

// ============================================================================
// Plan Types
// ============================================================================

/** Plan status values */
export type PlanStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/** PLAN.md frontmatter schema */
export interface PlanFrontmatter {
  phase: string;
  plan: number;
  type: 'execute' | 'tdd';
  wave: number;
  depends_on: string[];
  files_modified: string[];
  autonomous: boolean;
  must_haves: MustHaves;
}

/** Verification requirements */
export interface MustHaves {
  truths: string[];
  artifacts: Artifact[];
  key_links?: KeyLink[];
}

export interface Artifact {
  path: string;
  provides: string;
  contains?: string;
  exports?: string[];
  min_lines?: number;
}

export interface KeyLink {
  from: string;
  to: string;
  via: string;
  pattern?: string;
}

// ============================================================================
// State Types
// ============================================================================

/** Session state for .ultraplan/state/session.json */
export interface SessionState {
  active_plan: string | null;
  started_at: string;
  session_id: string;
  phase: string;
  plan: number;
  mode: ExecutionMode;
}

/** Project config for .ultraplan/config.json */
export interface ProjectConfig {
  version: string;
  mode: 'interactive' | 'autopilot';
  depth: 'quick' | 'standard' | 'comprehensive';
  parallelization: boolean;
  max_workers: number;
  commit_docs: boolean;
  model_profile: 'quality' | 'balanced' | 'budget';
}

// ============================================================================
// Progress Types
// ============================================================================

/** Progress tracking */
export interface PlanProgress {
  total: number;
  completed: number;
  is_complete: boolean;
}

export interface PhaseProgress {
  phase: string;
  plans_total: number;
  plans_completed: number;
  status: 'not_started' | 'in_progress' | 'completed';
}

export interface ProjectProgress {
  phases: PhaseProgress[];
  overall_percentage: number;
}
```

**Source:** Based on patterns from [oh-my-claudecode/src/hooks/mode-registry/types.ts](verified), [oh-my-claudecode/src/features/boulder-state/types.ts](verified), and [schemas.md](verified in .claude/skills/ultraplan/references/)

### Directory Structure for .ultraplan/

```
.ultraplan/
├── config.json            # Project configuration
├── state/                 # Runtime state
│   ├── session.json       # Active session
│   └── .gitkeep           # Ensure directory exists in git
└── logs/                  # Optional logs directory
    └── .gitkeep
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CommonJS modules | ESM with NodeNext | Node.js 22 LTS (2025) | Native ESM is default |
| ts-node for development | Node --experimental-strip-types | Node.js 23 (2025) | Fewer dependencies |
| Jest for testing | Vitest | 2024 | Better ESM/TS support |
| Zod v3 | Zod v3.25+ (v4 compat) | 2025 | Forward compatible with v4 |

**Deprecated/outdated:**
- `module: CommonJS`: Use `NodeNext` for new ESM projects
- `ts-node` for development: Consider native TypeScript stripping in Node 22+
- `moduleResolution: node`: Use `NodeNext` for modern projects

## Open Questions

1. **Whether to use Zod v4 directly**
   - What we know: Zod v4 has performance improvements but some compatibility issues
   - What's unclear: MCP integration with Zod v4
   - Recommendation: Use v3.25.0 which provides forward compatibility. Can upgrade to v4 later.

2. **Native TypeScript execution vs compilation**
   - What we know: Node 22+ supports `--experimental-strip-types`
   - What's unclear: Stability for production use
   - Recommendation: Stick with traditional `tsc` compilation for v1. Directory structure supports either.

3. **Vitest vs other test frameworks**
   - What we know: Vitest has best ESM support
   - What's unclear: Whether tests are needed in Phase 1
   - Recommendation: Add Vitest to devDependencies now, write tests in later phases.

## Sources

### Primary (HIGH confidence)

- [oh-my-claudecode/tsconfig.json](verified in references) - Proven TypeScript configuration
- [oh-my-claudecode/package.json](verified in references) - Modern ESM Node.js setup
- [oh-my-claudecode/src/hooks/mode-registry/types.ts](verified in references) - State management types
- [TypeScript TSConfig Reference](https://www.typescriptlang.org/tsconfig/) - Official documentation

### Secondary (MEDIUM confidence)

- [Modern Node.js TypeScript Setup 2025](https://dev.to/woovi/a-modern-nodejs-typescript-setup-for-2025-nlk) - Current best practices
- [Node.js, TypeScript and ESM](https://dev.to/a0viedo/nodejs-typescript-and-esm-it-doesnt-have-to-be-painful-438e) - ESM configuration patterns
- [Zod v4 Release Notes](https://zod.dev/v4) - Migration path from v3

### Tertiary (LOW confidence)

- [TypeScript Project Structure Guide](https://plainenglish.io/blog/typescript-project-directory-structure-module-resolution-and-related-configuration-options) - General organization patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Based on verified references and official documentation
- Architecture: HIGH - Direct patterns from oh-my-claudecode codebase
- Pitfalls: MEDIUM - Based on general TypeScript development experience

**Research date:** 2026-01-26
**Valid until:** 2026-02-26 (30 days - stable domain, TypeScript ecosystem is mature)
