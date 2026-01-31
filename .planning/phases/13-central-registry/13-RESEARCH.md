# Phase 13: Central Registry - Research

**Researched:** 2026-02-01
**Domain:** Plugin/Skill Registry System, Cross-Platform Path Resolution, YAML Configuration
**Confidence:** HIGH

## Summary

Central Registry implementation requires extending the existing `SkillRegistry` to support multiple source paths (project-local and global registry). The codebase already has established patterns for path resolution (StateManager with LOCAL/GLOBAL locations), YAML parsing (gray-matter), and registry structures.

The key challenges are:
1. **Multi-path loading** - Loading skills from both `process.cwd()/.ultraplan/skills/` AND `~/registry/skills/`
2. **Configuration extension** - Adding registry path and skill selection to `config.json`
3. **Priority/merge strategy** - Project-local skills override global registry skills with same ID
4. **Cross-platform paths** - Consistent `~` expansion across macOS/Linux/Windows

**Primary recommendation:** Extend existing SkillRegistry with multi-source path support using the established StateLocation pattern. Use `env-paths` for cross-platform directory resolution.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| gray-matter | ^4.0.3 | YAML frontmatter parsing | Already used in skill-registry.ts |
| Node.js path | built-in | Path manipulation | No external deps needed |
| Node.js fs | built-in | File system operations | Already used throughout |

### Supporting (Recommended Additions)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| env-paths | ^3.0.0 | Cross-platform app directories | Registry path resolution |
| glob | (already indirect) | Pattern matching for skill selection | `thinktank/*` pattern support |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| env-paths | Manual HOME/USERPROFILE | env-paths handles edge cases (XDG, Windows %APPDATA%) |
| cosmiconfig | Custom loader | Overkill - we only need fixed paths, not search cascade |
| js-yaml | gray-matter | gray-matter already includes yaml parsing |

**Installation:**
```bash
npm install env-paths
npm install --save-dev @types/node  # Already present
```

## Architecture Patterns

### Recommended Project Structure
```
~/registry/                    # Global registry (created by user)
├── agents/
│   ├── development/
│   │   ├── executor.yaml
│   │   └── architect.yaml
│   └── thinktank/
│       ├── optimist.yaml
│       └── realist.yaml
└── skills/
    ├── development/
    │   ├── build-fix.yaml
    │   └── security-review.yaml
    └── thinktank/
        ├── risk-analysis.yaml
        └── market-research.yaml

.ultraplan/                    # Project-local (existing)
├── config.json                # Extended with registry settings
└── skills/                    # Project-specific skills (override global)
    └── custom-skill.yaml
```

### Pattern 1: Multi-Source Registry Loading
**What:** Load skills from multiple directories with priority ordering
**When to use:** Skills need to be shared across projects but allow local overrides
**Example:**
```typescript
// Source: Based on existing StateManager pattern
export class MultiSourceRegistry {
  private sources: RegistrySource[] = [];
  private skills: Map<string, SkillDefinition> = new Map();

  constructor(config: RegistryConfig) {
    // Priority order: local first (overrides), then global
    if (config.localPath) {
      this.sources.push({ path: config.localPath, priority: 1 });
    }
    if (config.globalPath) {
      this.sources.push({ path: config.globalPath, priority: 2 });
    }
  }

  private loadSkills(): void {
    // Load from lowest priority first, so higher priority overwrites
    const sortedSources = [...this.sources].sort((a, b) => b.priority - a.priority);

    for (const source of sortedSources) {
      this.loadFromDirectory(source.path);
    }
  }
}
```

### Pattern 2: Skill Selection via Glob Patterns
**What:** Allow config.json to specify which skills to use with glob patterns
**When to use:** Projects need to select a subset of available skills
**Example:**
```typescript
// Source: ESLint flat config pattern
interface RegistryConfig {
  registry: string;  // ~/registry or absolute path
  use: {
    agents: string[];  // ["thinktank/*", "development/executor"]
    skills: string[];  // ["thinktank/*", "development/build-fix"]
  };
}

function matchesPattern(skillId: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      return skillId.startsWith(prefix + '/');
    }
    return skillId === pattern || skillId.endsWith('/' + pattern);
  });
}
```

### Pattern 3: Cross-Platform Path Resolution
**What:** Resolve `~` and platform-specific paths consistently
**When to use:** Any path that can be user-configured
**Example:**
```typescript
// Source: env-paths pattern + existing StateManager
import envPaths from 'env-paths';

function resolveRegistryPath(configPath: string): string {
  // Handle ~ expansion
  if (configPath.startsWith('~/')) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    return path.join(home, configPath.slice(2));
  }

  // Handle absolute paths
  if (path.isAbsolute(configPath)) {
    return configPath;
  }

  // Default to app data directory
  const paths = envPaths('ultra-planner', { suffix: '' });
  return path.join(paths.data, configPath);
}
```

### Anti-Patterns to Avoid
- **Hardcoded paths:** Don't hardcode `~/.ultraplan` - use env-paths or config
- **Sync file operations in hot path:** Use caching, load skills once at startup
- **Merging skill contents:** Skills with same ID should REPLACE, not merge
- **Case-sensitive matching on Windows:** Normalize skill IDs to lowercase

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-platform home dir | `process.env.HOME \|\| USERPROFILE` | `env-paths` or `os.homedir()` | Handles XDG, Windows %APPDATA%, edge cases |
| YAML parsing | Custom regex/string parsing | `gray-matter` (existing) | Edge cases with multiline, escaping |
| Glob pattern matching | Custom string matching | `minimatch` or `micromatch` | Handles `**`, `*`, negation properly |
| Config file discovery | Manual file existence checks | `cosmiconfig` pattern | If needed later for rc files |

**Key insight:** The project already uses gray-matter for YAML parsing. The StateManager already handles LOCAL/GLOBAL locations. Extend these patterns rather than creating new ones.

## Common Pitfalls

### Pitfall 1: Skill ID Collision Without Clear Priority
**What goes wrong:** Same skill ID in both local and global registry, unclear which wins
**Why it happens:** No defined priority order for multi-source loading
**How to avoid:** Load sources in reverse priority order (global first, local last). Last write wins.
**Warning signs:** Different behavior between projects with same skill ID

### Pitfall 2: Synchronous File Operations Blocking Event Loop
**What goes wrong:** Slow startup when loading many YAML files synchronously
**Why it happens:** Current SkillRegistry uses `fs.readFileSync` in constructor
**How to avoid:** Keep sync for now (simple), but cache aggressively. Consider async init if needed.
**Warning signs:** Startup time >500ms with large registry

### Pitfall 3: Path Separator Issues on Windows
**What goes wrong:** Paths with `/` fail on Windows, or `\` break POSIX
**Why it happens:** Hardcoded path separators instead of `path.join()`
**How to avoid:** Always use `path.join()`, `path.resolve()`, never string concatenation
**Warning signs:** "File not found" errors only on Windows

### Pitfall 4: Missing Registry Directory Not Handled Gracefully
**What goes wrong:** Error thrown if `~/registry` doesn't exist
**Why it happens:** No existence check before directory listing
**How to avoid:** Check `fs.existsSync()` and log warning, continue without global registry
**Warning signs:** Crash on fresh install before user creates registry

### Pitfall 5: Circular Dependency in Skill Synergies
**What goes wrong:** Skill A references Skill B which references Skill A
**Why it happens:** synergies field can create cycles
**How to avoid:** Track visited skills when adding synergies, skip already-seen
**Warning signs:** Infinite loop or stack overflow in matchSkills

## Code Examples

Verified patterns from existing codebase:

### Loading Skills from Directory (Existing Pattern)
```typescript
// Source: /home/ubuntu/code/ultra-planning/src/skills/skill-registry.ts
private loadSkills(): void {
  if (!fs.existsSync(this.skillsDir)) {
    console.warn(`Skills directory not found: ${this.skillsDir}`);
    return;
  }

  // Index first
  const indexPath = path.join(this.skillsDir, '_index.yaml');
  if (fs.existsSync(indexPath)) {
    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    this.index = parseYaml(indexContent) as SkillIndex;
  }

  // Individual skills
  const files = fs.readdirSync(this.skillsDir);
  for (const file of files) {
    if (file.endsWith('.yaml') && !file.startsWith('_')) {
      const filePath = path.join(this.skillsDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const skill = parseYaml(content) as SkillDefinition;
        this.skills.set(skill.id, skill);
      } catch (error) {
        console.warn(`Failed to load skill: ${file}`, error);
      }
    }
  }
}
```

### StateLocation Pattern (Existing)
```typescript
// Source: /home/ubuntu/code/ultra-planning/src/state/state-manager.ts
private getPath(): string {
  if (this.location === StateLocation.GLOBAL) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    return join(home, STATE_DIR, `${this.name}.json`);
  } else {
    return join(process.cwd(), STATE_DIR, `${this.name}.json`);
  }
}
```

### Config JSON Structure (Extended)
```typescript
// Source: /home/ubuntu/code/ultra-planning/.ultraplan/config.json + v4.0-VISION.md
interface ExtendedProjectConfig extends ProjectConfig {
  // Existing fields...

  // New registry fields
  registry?: string;  // Default: ~/registry
  use?: {
    agents?: string[];  // Glob patterns: ["thinktank/*"]
    skills?: string[];  // Glob patterns: ["development/build-fix"]
  };
}
```

### Multi-Directory Skill Loading (New Pattern)
```typescript
// Based on existing patterns, new implementation
interface RegistrySource {
  path: string;
  priority: number;  // Lower = loaded later = overrides
  isGlobal: boolean;
}

function getSkillSources(config: ExtendedProjectConfig): RegistrySource[] {
  const sources: RegistrySource[] = [];

  // Global registry (loaded first, can be overridden)
  if (config.registry) {
    const globalPath = resolveRegistryPath(config.registry);
    const skillsPath = path.join(globalPath, 'skills');
    if (fs.existsSync(skillsPath)) {
      sources.push({ path: skillsPath, priority: 2, isGlobal: true });
    }
  }

  // Local project skills (loaded last, override global)
  const localPath = path.join(process.cwd(), '.ultraplan/skills');
  if (fs.existsSync(localPath)) {
    sources.push({ path: localPath, priority: 1, isGlobal: false });
  }

  return sources;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-source registry | Multi-source with priority | This phase | Enables cross-project sharing |
| Hardcoded paths | Configurable registry path | This phase | User customization |
| All skills loaded | Selective loading via patterns | This phase | Performance, control |

**Deprecated/outdated:**
- Direct `process.cwd()` only path resolution - extend with global
- Loading all skills unconditionally - add pattern filtering

## Open Questions

Things that couldn't be fully resolved:

1. **Agent Registry Scope**
   - What we know: Vision doc mentions agents/ in registry, but current code has no AgentRegistry
   - What's unclear: Should agents be YAML like skills, or stay as code?
   - Recommendation: Focus on skills first (clear implementation path), defer agents to Phase 14

2. **Registry Initialization UX**
   - What we know: User must create ~/registry manually
   - What's unclear: Should we provide a CLI command to scaffold?
   - Recommendation: Document manual setup, add `ultraplanner init-registry` later

3. **Index Merging**
   - What we know: Each source can have `_index.yaml` with categories, relationships
   - What's unclear: How to merge multiple indexes?
   - Recommendation: Load all indexes, merge categories (additive), relationships (additive)

## Sources

### Primary (HIGH confidence)
- `/home/ubuntu/code/ultra-planning/src/skills/skill-registry.ts` - Current SkillRegistry implementation
- `/home/ubuntu/code/ultra-planning/src/state/state-manager.ts` - StateLocation pattern
- `/home/ubuntu/code/ultra-planning/.planning/v4.0-VISION.md` - Target architecture
- `/home/ubuntu/code/ultra-planning/.ultraplan/config.json` - Current config structure

### Secondary (MEDIUM confidence)
- [env-paths GitHub](https://github.com/sindresorhus/env-paths) - Cross-platform paths
- [cosmiconfig GitHub](https://github.com/cosmiconfig/cosmiconfig) - Config discovery patterns
- [ESLint Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files) - Multi-source config merging

### Tertiary (LOW confidence)
- WebSearch results for plugin registry patterns - General guidance only

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses existing libraries already in project
- Architecture: HIGH - Extends established patterns from StateManager
- Pitfalls: MEDIUM - Based on common Node.js patterns, not all verified in this codebase
- Code examples: HIGH - Most examples from existing codebase

**Research date:** 2026-02-01
**Valid until:** 60 days (stable Node.js patterns, no fast-moving dependencies)
