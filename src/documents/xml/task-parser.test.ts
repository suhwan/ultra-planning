/**
 * XML Task Parser Tests
 *
 * Tests for parsing task XML from PLAN.md documents.
 */

import { describe, it, expect } from 'vitest';
import { unescapeXml, parseTaskXml, parseTasksSection } from './task-parser.js';

// ============================================================================
// unescapeXml Tests
// ============================================================================

describe('unescapeXml', () => {
  it('should convert &amp; to &', () => {
    expect(unescapeXml('foo &amp; bar')).toBe('foo & bar');
  });

  it('should convert &lt; to <', () => {
    expect(unescapeXml('a &lt; b')).toBe('a < b');
  });

  it('should convert &gt; to >', () => {
    expect(unescapeXml('a &gt; b')).toBe('a > b');
  });

  it('should convert &quot; to "', () => {
    expect(unescapeXml('say &quot;hello&quot;')).toBe('say "hello"');
  });

  it('should handle multiple entities in one string', () => {
    const input = '&lt;div&gt;Hello &amp; &quot;World&quot;&lt;/div&gt;';
    const expected = '<div>Hello & "World"</div>';
    expect(unescapeXml(input)).toBe(expected);
  });

  it('should return unchanged string with no entities', () => {
    const input = 'plain text without entities';
    expect(unescapeXml(input)).toBe(input);
  });
});

// ============================================================================
// parseTaskXml Tests - Auto Tasks
// ============================================================================

describe('parseTaskXml - auto tasks', () => {
  it('should parse complete auto task with all fields', () => {
    const xml = `
      <task type="auto">
        <name>Task 1: Create component</name>
        <files>src/component.ts</files>
        <action>Create the component with proper exports</action>
        <verify>npm test -- component</verify>
        <done>Component created and tests pass</done>
      </task>
    `;

    const task = parseTaskXml(xml);
    expect(task.type).toBe('auto');
    if (task.type === 'auto') {
      expect(task.name).toBe('Task 1: Create component');
      expect(task.files).toEqual(['src/component.ts']);
      expect(task.action).toBe('Create the component with proper exports');
      expect(task.verify).toBe('npm test -- component');
      expect(task.done).toBe('Component created and tests pass');
    }
  });

  it('should parse auto task with comma-separated files', () => {
    const xml = `
      <task type="auto">
        <name>Task 2: Multi-file task</name>
        <files>src/a.ts, src/b.ts, src/c.ts</files>
        <action>Implement across files</action>
        <verify>npm run build</verify>
        <done>All files created</done>
      </task>
    `;

    const task = parseTaskXml(xml);
    expect(task.type).toBe('auto');
    if (task.type === 'auto') {
      expect(task.files).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts']);
    }
  });

  it('should throw on missing <files> tag', () => {
    const xml = `
      <task type="auto">
        <name>Missing files</name>
        <action>Do something</action>
        <verify>npm test</verify>
        <done>Done</done>
      </task>
    `;

    expect(() => parseTaskXml(xml)).toThrow(/missing <files>/i);
  });

  it('should throw on missing <action> tag', () => {
    const xml = `
      <task type="auto">
        <name>Missing action</name>
        <files>src/file.ts</files>
        <verify>npm test</verify>
        <done>Done</done>
      </task>
    `;

    expect(() => parseTaskXml(xml)).toThrow(/missing <action>/i);
  });

  it('should throw on missing <verify> tag', () => {
    const xml = `
      <task type="auto">
        <name>Missing verify</name>
        <files>src/file.ts</files>
        <action>Do something</action>
        <done>Done</done>
      </task>
    `;

    expect(() => parseTaskXml(xml)).toThrow(/missing <verify>/i);
  });

  it('should throw on missing <done> tag', () => {
    const xml = `
      <task type="auto">
        <name>Missing done</name>
        <files>src/file.ts</files>
        <action>Do something</action>
        <verify>npm test</verify>
      </task>
    `;

    expect(() => parseTaskXml(xml)).toThrow(/missing <done>/i);
  });

  it('should throw on missing type attribute', () => {
    const xml = `
      <task>
        <name>No type</name>
        <files>src/file.ts</files>
        <action>Do something</action>
        <verify>npm test</verify>
        <done>Done</done>
      </task>
    `;

    expect(() => parseTaskXml(xml)).toThrow(/missing type attribute/i);
  });
});

// ============================================================================
// parseTaskXml Tests - checkpoint:human-verify
// ============================================================================

describe('parseTaskXml - checkpoint:human-verify', () => {
  it('should parse complete human-verify task', () => {
    const xml = `
      <task type="checkpoint:human-verify" gate="blocking">
        <what-built>Authentication flow</what-built>
        <how-to-verify>Test login with valid credentials</how-to-verify>
        <resume-signal>verified works</resume-signal>
      </task>
    `;

    const task = parseTaskXml(xml);
    expect(task.type).toBe('checkpoint:human-verify');
    if (task.type === 'checkpoint:human-verify') {
      expect(task.whatBuilt).toBe('Authentication flow');
      expect(task.howToVerify).toBe('Test login with valid credentials');
      expect(task.resumeSignal).toBe('verified works');
      expect(task.gate).toBe('blocking');
    }
  });

  it('should default gate to blocking', () => {
    const xml = `
      <task type="checkpoint:human-verify">
        <what-built>Feature X</what-built>
        <how-to-verify>Check manually</how-to-verify>
        <resume-signal>looks good</resume-signal>
      </task>
    `;

    const task = parseTaskXml(xml);
    if (task.type === 'checkpoint:human-verify') {
      expect(task.gate).toBe('blocking');
    }
  });

  it('should throw on missing <what-built>', () => {
    const xml = `
      <task type="checkpoint:human-verify">
        <how-to-verify>Check it</how-to-verify>
        <resume-signal>done</resume-signal>
      </task>
    `;

    expect(() => parseTaskXml(xml)).toThrow(/missing <what-built>/i);
  });

  it('should throw on missing <how-to-verify>', () => {
    const xml = `
      <task type="checkpoint:human-verify">
        <what-built>Something</what-built>
        <resume-signal>done</resume-signal>
      </task>
    `;

    expect(() => parseTaskXml(xml)).toThrow(/missing <how-to-verify>/i);
  });

  it('should throw on missing <resume-signal>', () => {
    const xml = `
      <task type="checkpoint:human-verify">
        <what-built>Something</what-built>
        <how-to-verify>Check it</how-to-verify>
      </task>
    `;

    expect(() => parseTaskXml(xml)).toThrow(/missing <resume-signal>/i);
  });
});

// ============================================================================
// parseTaskXml Tests - checkpoint:decision
// ============================================================================

describe('parseTaskXml - checkpoint:decision', () => {
  it('should parse complete decision task with options', () => {
    const xml = `
      <task type="checkpoint:decision" gate="blocking">
        <decision>Choose database</decision>
        <context>We need persistent storage</context>
        <options>
          <option id="postgres">
            <name>PostgreSQL</name>
            <pros>Reliable, well-supported</pros>
            <cons>Heavier setup</cons>
          </option>
          <option id="sqlite">
            <name>SQLite</name>
            <pros>Simple, embedded</pros>
            <cons>Limited concurrency</cons>
          </option>
        </options>
        <resume-signal>decided: postgres</resume-signal>
      </task>
    `;

    const task = parseTaskXml(xml);
    expect(task.type).toBe('checkpoint:decision');
    if (task.type === 'checkpoint:decision') {
      expect(task.decision).toBe('Choose database');
      expect(task.context).toBe('We need persistent storage');
      expect(task.options).toHaveLength(2);
      expect(task.options[0].id).toBe('postgres');
      expect(task.options[0].name).toBe('PostgreSQL');
      expect(task.options[1].id).toBe('sqlite');
    }
  });

  it('should throw on missing <decision>', () => {
    const xml = `
      <task type="checkpoint:decision">
        <context>Context here</context>
        <options>
          <option id="a"><name>A</name><pros>Pro</pros><cons>Con</cons></option>
        </options>
        <resume-signal>decided</resume-signal>
      </task>
    `;

    expect(() => parseTaskXml(xml)).toThrow(/missing <decision>/i);
  });

  it('should throw on missing <options>', () => {
    const xml = `
      <task type="checkpoint:decision">
        <decision>Choose something</decision>
        <context>Context here</context>
        <resume-signal>decided</resume-signal>
      </task>
    `;

    expect(() => parseTaskXml(xml)).toThrow(/missing <options>/i);
  });

  it('should throw on empty options', () => {
    const xml = `
      <task type="checkpoint:decision">
        <decision>Choose something</decision>
        <context>Context here</context>
        <options></options>
        <resume-signal>decided</resume-signal>
      </task>
    `;

    expect(() => parseTaskXml(xml)).toThrow(/missing.*options/i);
  });
});

// ============================================================================
// parseTaskXml Tests - checkpoint:human-action
// ============================================================================

describe('parseTaskXml - checkpoint:human-action', () => {
  it('should parse complete human-action task', () => {
    const xml = `
      <task type="checkpoint:human-action" gate="blocking">
        <action>Configure AWS credentials</action>
        <instructions>Run aws configure and enter your keys</instructions>
        <resume-signal>credentials configured</resume-signal>
      </task>
    `;

    const task = parseTaskXml(xml);
    expect(task.type).toBe('checkpoint:human-action');
    if (task.type === 'checkpoint:human-action') {
      expect(task.action).toBe('Configure AWS credentials');
      expect(task.instructions).toBe('Run aws configure and enter your keys');
      expect(task.resumeSignal).toBe('credentials configured');
    }
  });

  it('should throw on missing <action>', () => {
    const xml = `
      <task type="checkpoint:human-action">
        <instructions>Do something</instructions>
        <resume-signal>done</resume-signal>
      </task>
    `;

    expect(() => parseTaskXml(xml)).toThrow(/missing <action>/i);
  });

  it('should throw on missing <instructions>', () => {
    const xml = `
      <task type="checkpoint:human-action">
        <action>Do something</action>
        <resume-signal>done</resume-signal>
      </task>
    `;

    expect(() => parseTaskXml(xml)).toThrow(/missing <instructions>/i);
  });
});

// ============================================================================
// parseTasksSection Tests
// ============================================================================

describe('parseTasksSection', () => {
  it('should extract multiple tasks from <tasks> section', () => {
    const xml = `
      <tasks>
        <task type="auto">
          <name>Task 1</name>
          <files>src/a.ts</files>
          <action>First action</action>
          <verify>npm test</verify>
          <done>Done 1</done>
        </task>
        <task type="auto">
          <name>Task 2</name>
          <files>src/b.ts</files>
          <action>Second action</action>
          <verify>npm test</verify>
          <done>Done 2</done>
        </task>
      </tasks>
    `;

    const tasks = parseTasksSection(xml);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].name).toBe('Task 1');
    expect(tasks[1].name).toBe('Task 2');
  });

  it('should return empty array for missing <tasks> section', () => {
    const xml = '<content>No tasks here</content>';
    const tasks = parseTasksSection(xml);
    expect(tasks).toEqual([]);
  });

  it('should handle mixed task types', () => {
    const xml = `
      <tasks>
        <task type="auto">
          <name>Auto Task</name>
          <files>src/auto.ts</files>
          <action>Auto action</action>
          <verify>npm test</verify>
          <done>Done</done>
        </task>
        <task type="checkpoint:human-verify">
          <what-built>Feature</what-built>
          <how-to-verify>Test manually</how-to-verify>
          <resume-signal>verified</resume-signal>
        </task>
      </tasks>
    `;

    const tasks = parseTasksSection(xml);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].type).toBe('auto');
    expect(tasks[1].type).toBe('checkpoint:human-verify');
  });

  it('should re-throw parse errors with context', () => {
    const xml = `
      <tasks>
        <task type="auto">
          <name>Invalid Task</name>
          <!-- Missing required fields -->
        </task>
      </tasks>
    `;

    expect(() => parseTasksSection(xml)).toThrow(/Failed to parse task/i);
  });

  it('should handle empty tasks section', () => {
    const xml = '<tasks></tasks>';
    const tasks = parseTasksSection(xml);
    expect(tasks).toEqual([]);
  });

  it('should unescape XML entities in parsed content', () => {
    const xml = `
      <tasks>
        <task type="auto">
          <name>Task with &amp; entities</name>
          <files>src/file.ts</files>
          <action>Use &lt;Component /&gt; for rendering</action>
          <verify>npm test</verify>
          <done>Done with &quot;quotes&quot;</done>
        </task>
      </tasks>
    `;

    const tasks = parseTasksSection(xml);
    expect(tasks).toHaveLength(1);
    if (tasks[0].type === 'auto') {
      expect(tasks[0].name).toBe('Task with & entities');
      expect(tasks[0].action).toBe('Use <Component /> for rendering');
      expect(tasks[0].done).toBe('Done with "quotes"');
    }
  });
});
