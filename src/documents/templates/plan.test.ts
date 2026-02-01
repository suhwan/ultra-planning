/**
 * Plan Template Tests
 *
 * Tests for PLAN.md parsing and generation.
 */

import { describe, it, expect } from 'vitest';
import { parsePlanMd, generatePlanMd, extractTasksFromContent } from './plan.js';

// ============================================================================
// parsePlanMd Tests - Frontmatter Extraction
// ============================================================================

describe('parsePlanMd - frontmatter extraction', () => {
  it('should extract phase, plan, type, wave from YAML frontmatter', () => {
    const markdown = `---
phase: "01-foundation"
plan: 1
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths:
    - "System works"
  artifacts:
    - path: "src/index.ts"
      provides: "Entry point"
---

# Content here
`;

    const result = parsePlanMd(markdown);
    expect(result.frontmatter.phase).toBe('01-foundation');
    expect(result.frontmatter.plan).toBe(1);
    expect(result.frontmatter.type).toBe('execute');
    expect(result.frontmatter.wave).toBe(1);
  });

  it('should extract depends_on array', () => {
    const markdown = `---
phase: "02-core"
plan: 2
type: execute
wave: 2
depends_on:
  - "01-01"
  - "01-02"
files_modified: []
autonomous: true
must_haves:
  truths: ["Works"]
  artifacts: []
---

Content
`;

    const result = parsePlanMd(markdown);
    expect(result.frontmatter.depends_on).toEqual(['01-01', '01-02']);
  });

  it('should extract files_modified array', () => {
    const markdown = `---
phase: "03-features"
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/feature.ts
  - src/feature.test.ts
autonomous: true
must_haves:
  truths: ["Feature works"]
  artifacts: []
---

Content
`;

    const result = parsePlanMd(markdown);
    expect(result.frontmatter.files_modified).toEqual([
      'src/feature.ts',
      'src/feature.test.ts',
    ]);
  });

  it('should extract autonomous boolean', () => {
    const markdown = `---
phase: "04-integration"
plan: 1
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: false
must_haves:
  truths: ["Integration works"]
  artifacts: []
---

Content
`;

    const result = parsePlanMd(markdown);
    expect(result.frontmatter.autonomous).toBe(false);
  });

  it('should extract must_haves object with truths, artifacts, key_links', () => {
    const markdown = `---
phase: "05-polish"
plan: 1
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths:
    - "UI renders correctly"
    - "No console errors"
  artifacts:
    - path: src/ui.ts
      provides: "UI component"
      min_lines: 50
  key_links:
    - from: src/ui.ts
      to: src/state.ts
      via: "imports state manager"
---

Content
`;

    const result = parsePlanMd(markdown);
    expect(result.frontmatter.must_haves.truths).toHaveLength(2);
    expect(result.frontmatter.must_haves.artifacts).toHaveLength(1);
    expect(result.frontmatter.must_haves.artifacts[0].min_lines).toBe(50);
    expect(result.frontmatter.must_haves.key_links).toHaveLength(1);
  });

  it('should extract optional user_setup array', () => {
    const markdown = `---
phase: "06-deploy"
plan: 1
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: false
user_setup:
  - service: "AWS S3"
    why: "File storage"
    env_vars:
      - name: AWS_BUCKET
        source: "AWS Console"
must_haves:
  truths: ["Deployed"]
  artifacts: []
---

Content
`;

    const result = parsePlanMd(markdown);
    // user_setup is an extension field not in the base PlanFrontmatter type
    // Access via type assertion since gray-matter parses all YAML fields
    const frontmatter = result.frontmatter as unknown as Record<string, unknown>;
    expect(frontmatter.user_setup).toBeDefined();
    const userSetup = frontmatter.user_setup as Array<{ service: string }>;
    expect(userSetup).toHaveLength(1);
    expect(userSetup[0].service).toBe('AWS S3');
  });
});

// ============================================================================
// parsePlanMd Tests - Content Extraction
// ============================================================================

describe('parsePlanMd - content extraction', () => {
  it('should return markdown content after frontmatter', () => {
    const markdown = `---
phase: "01-test"
plan: 1
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths: ["Works"]
  artifacts: []
---

# Title

This is the content after frontmatter.
`;

    const result = parsePlanMd(markdown);
    expect(result.content).toContain('# Title');
    expect(result.content).toContain('This is the content after frontmatter.');
  });

  it('should preserve <objective> section', () => {
    const markdown = `---
phase: "01-test"
plan: 1
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths: ["Works"]
  artifacts: []
---

<objective>
Create a test component.

Purpose: Testing
Output: Component file
</objective>
`;

    const result = parsePlanMd(markdown);
    expect(result.content).toContain('<objective>');
    expect(result.content).toContain('Create a test component.');
    expect(result.content).toContain('</objective>');
  });

  it('should preserve <tasks> section', () => {
    const markdown = `---
phase: "01-test"
plan: 1
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths: ["Works"]
  artifacts: []
---

<tasks>
<task type="auto">
  <name>Test Task</name>
  <files>src/test.ts</files>
  <action>Create test</action>
  <verify>npm test</verify>
  <done>Done</done>
</task>
</tasks>
`;

    const result = parsePlanMd(markdown);
    expect(result.content).toContain('<tasks>');
    expect(result.content).toContain('<task type="auto">');
    expect(result.content).toContain('</tasks>');
  });

  it('should preserve <verification> section', () => {
    const markdown = `---
phase: "01-test"
plan: 1
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths: ["Works"]
  artifacts: []
---

<verification>
- [ ] Tests pass
- [ ] Build succeeds
</verification>
`;

    const result = parsePlanMd(markdown);
    expect(result.content).toContain('<verification>');
    expect(result.content).toContain('Tests pass');
  });
});

// ============================================================================
// parsePlanMd Tests - Edge Cases
// ============================================================================

describe('parsePlanMd - edge cases', () => {
  it('should handle empty content after frontmatter', () => {
    const markdown = `---
phase: "01-empty"
plan: 1
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths: ["Works"]
  artifacts: []
---
`;

    const result = parsePlanMd(markdown);
    expect(result.content.trim()).toBe('');
  });

  it('should handle frontmatter with no optional fields', () => {
    const markdown = `---
phase: "minimal"
plan: 1
type: tdd
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths: ["Test"]
  artifacts: []
---

Content
`;

    const result = parsePlanMd(markdown);
    expect(result.frontmatter.phase).toBe('minimal');
    // user_setup is optional and not in base type - access via assertion
    const frontmatter = result.frontmatter as unknown as Record<string, unknown>;
    expect(frontmatter.user_setup).toBeUndefined();
  });
});

// ============================================================================
// generatePlanMd Tests
// ============================================================================

describe('generatePlanMd', () => {
  it('should generate valid markdown from document', () => {
    const doc = {
      frontmatter: {
        phase: '01-gen',
        plan: 1,
        type: 'execute' as const,
        wave: 1,
        depends_on: [],
        files_modified: ['src/gen.ts'],
        autonomous: true,
        must_haves: {
          truths: ['Generated works'],
          artifacts: [{ path: 'src/gen.ts', provides: 'Generated file' }],
        },
      },
      content: '# Generated Content\n\nThis is generated.',
    };

    const result = generatePlanMd(doc);
    expect(result).toContain('---');
    expect(result).toContain('phase: 01-gen');
    expect(result).toContain('# Generated Content');
  });

  it('should roundtrip parse -> generate -> parse', () => {
    const original = `---
phase: "roundtrip"
plan: 5
type: tdd
wave: 2
depends_on:
  - "dep-1"
files_modified:
  - src/round.ts
autonomous: false
must_haves:
  truths:
    - "Roundtrip works"
  artifacts:
    - path: src/round.ts
      provides: "Roundtrip file"
---

<objective>
Test roundtrip functionality.
</objective>
`;

    const parsed = parsePlanMd(original);
    const generated = generatePlanMd(parsed);
    const reparsed = parsePlanMd(generated);

    expect(reparsed.frontmatter.phase).toBe(parsed.frontmatter.phase);
    expect(reparsed.frontmatter.plan).toBe(parsed.frontmatter.plan);
    expect(reparsed.frontmatter.type).toBe(parsed.frontmatter.type);
  });
});

// ============================================================================
// extractTasksFromContent Tests
// ============================================================================

describe('extractTasksFromContent', () => {
  it('should extract auto tasks from content', () => {
    const content = `
<task type="auto">
  <name>Task 1: Create file</name>
  <files>src/file.ts</files>
  <action>Create the file</action>
  <verify>npm test</verify>
  <done>File created</done>
</task>
`;

    const tasks = extractTasksFromContent(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].name).toBe('Task 1: Create file');
    expect(tasks[0].type).toBe('auto');
  });

  it('should extract multiple auto tasks', () => {
    const content = `
<task type="auto">
  <name>Task 1</name>
  <files>src/a.ts</files>
  <action>Action 1</action>
  <verify>npm test</verify>
  <done>Done 1</done>
</task>

<task type="auto">
  <name>Task 2</name>
  <files>src/b.ts</files>
  <action>Action 2</action>
  <verify>npm test</verify>
  <done>Done 2</done>
</task>
`;

    const tasks = extractTasksFromContent(content);
    expect(tasks).toHaveLength(2);
  });

  it('should return empty array for content without tasks', () => {
    const content = 'Just regular markdown content without any tasks.';
    const tasks = extractTasksFromContent(content);
    expect(tasks).toEqual([]);
  });

  it('should unescape XML entities in extracted content', () => {
    const content = `
<task type="auto">
  <name>Task with &amp; symbol</name>
  <files>src/test.ts</files>
  <action>Use &lt;Component /&gt;</action>
  <verify>npm test</verify>
  <done>Works with &quot;quotes&quot;</done>
</task>
`;

    const tasks = extractTasksFromContent(content);
    expect(tasks[0].name).toBe('Task with & symbol');
    expect(tasks[0].action).toBe('Use <Component />');
  });

  it('should parse comma-separated files', () => {
    const content = `
<task type="auto">
  <name>Multi-file task</name>
  <files>src/a.ts, src/b.ts, src/c.ts</files>
  <action>Work across files</action>
  <verify>npm test</verify>
  <done>All done</done>
</task>
`;

    const tasks = extractTasksFromContent(content);
    expect(tasks[0].files).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts']);
  });
});
