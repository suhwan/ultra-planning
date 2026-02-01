/**
 * AST Analyzer Tests
 *
 * Tests for the AST analyzer that uses ast-grep to extract
 * code structure information from TypeScript/JavaScript files.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeFile, analyzeDirectory } from './analyzer.js';

// Mock @ast-grep/napi
vi.mock('@ast-grep/napi', () => {
  const mockRange = () => ({
    start: { line: 0, column: 0 },
    end: { line: 10, column: 0 },
  });

  const createMockNode = (text: string, kind: string = 'export_statement') => ({
    text: () => text,
    kind: () => kind,
    range: mockRange,
    parent: () => null,
    children: () => [],
    findAll: (_pattern: string) => [],
    getMatch: (name: string) => {
      if (name === 'NAME') {
        const match = text.match(/(?:function|class|const)\s+(\w+)/);
        return match ? { text: () => match[1] } : null;
      }
      return null;
    },
  });

  return {
    Lang: {
      TypeScript: 'typescript',
      Tsx: 'tsx',
      JavaScript: 'javascript',
    },
    parse: (lang: string, content: string) => ({
      root: () => ({
        findAll: (pattern: string) => {
          if (pattern === 'function $NAME') {
            // Return mock function matches based on content
            if (content.includes('function hello')) {
              return [createMockNode('function hello() {}')];
            }
            return [];
          }
          if (pattern === 'const $NAME = $EXPR') {
            if (content.includes('const arrow =')) {
              const node = createMockNode('const arrow = () => {}');
              node.getMatch = (name: string) => {
                if (name === 'NAME') return { text: () => 'arrow' };
                if (name === 'EXPR') return { text: () => '() => {}' };
                return null;
              };
              return [node];
            }
            return [];
          }
          if (pattern === 'class $NAME') {
            if (content.includes('class MyClass')) {
              return [createMockNode('class MyClass {}')];
            }
            return [];
          }
          if (pattern === 'import $$$') {
            return [];
          }
          return [];
        },
        kind: () => 'program',
        text: () => content,
        range: mockRange,
        children: () => {
          // Return export_statement nodes for exports
          if (content.includes('export function')) {
            const node = createMockNode(content, 'export_statement');
            node.children = () => [];
            return [node];
          }
          return [];
        },
      }),
    }),
  };
});

// Mock fs
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
}));

import { readFileSync, readdirSync, statSync } from 'fs';

describe('AST Analyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeFile', () => {
    it('should analyze TypeScript source files', async () => {
      vi.mocked(readFileSync).mockReturnValue('const x = 1;');

      const result = await analyzeFile('/project/src/file.ts');

      expect(result).toHaveProperty('file');
      expect(result.file).toBe('/project/src/file.ts');
    });

    it('should detect function declarations', async () => {
      vi.mocked(readFileSync).mockReturnValue(`
function hello(name: string): void {
  console.log(name);
}
`);

      const result = await analyzeFile('/project/src/file.ts');

      expect(result.structure.functions.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect class declarations', async () => {
      vi.mocked(readFileSync).mockReturnValue(`
class MyClass {
  constructor() {}
  method() {}
}
`);

      const result = await analyzeFile('/project/src/file.ts');

      expect(result.structure.classes.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect export statements', async () => {
      vi.mocked(readFileSync).mockReturnValue(`
export function hello() {}
`);

      const result = await analyzeFile('/project/src/file.ts');

      expect(result.structure).toHaveProperty('exports');
    });

    it('should return structure with imports array', async () => {
      vi.mocked(readFileSync).mockReturnValue(`
import { something } from './module';
`);

      const result = await analyzeFile('/project/src/file.ts');

      expect(result.structure).toHaveProperty('imports');
      expect(Array.isArray(result.structure.imports)).toBe(true);
    });

    it('should include metrics in result', async () => {
      vi.mocked(readFileSync).mockReturnValue('const x = 1;');

      const result = await analyzeFile('/project/src/file.ts');

      expect(result).toHaveProperty('metrics');
      expect(result.metrics).toHaveProperty('totalLines');
      expect(result.metrics).toHaveProperty('codeLines');
    });

    it('should handle .tsx files', async () => {
      vi.mocked(readFileSync).mockReturnValue('const Component = () => <div />;');

      const result = await analyzeFile('/project/src/Component.tsx');

      expect(result.file).toBe('/project/src/Component.tsx');
    });

    it('should handle .js files', async () => {
      vi.mocked(readFileSync).mockReturnValue('function hello() {}');

      const result = await analyzeFile('/project/src/file.js');

      expect(result.file).toBe('/project/src/file.js');
    });
  });

  describe('analyzeDirectory', () => {
    it('should analyze directory recursively', async () => {
      vi.mocked(statSync).mockReturnValue({ isFile: () => false, isDirectory: () => true } as any);
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'file1.ts', isDirectory: () => false, isFile: () => true } as any,
        { name: 'file2.ts', isDirectory: () => false, isFile: () => true } as any,
      ]);
      vi.mocked(readFileSync).mockReturnValue('const x = 1;');

      const results = await analyzeDirectory('/project/src');

      expect(Array.isArray(results)).toBe(true);
    });

    it('should respect extensions option', async () => {
      vi.mocked(statSync).mockReturnValue({ isFile: () => false, isDirectory: () => true } as any);
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'file.ts', isDirectory: () => false, isFile: () => true } as any,
        { name: 'file.js', isDirectory: () => false, isFile: () => true } as any,
        { name: 'file.py', isDirectory: () => false, isFile: () => true } as any,
      ]);
      vi.mocked(readFileSync).mockReturnValue('const x = 1;');

      const results = await analyzeDirectory('/project/src', { extensions: ['.ts'] });

      // Should only include .ts files
      expect(results.every(r => r.file.endsWith('.ts'))).toBe(true);
    });

    it('should exclude node_modules by default', async () => {
      vi.mocked(statSync).mockReturnValue({ isFile: () => false, isDirectory: () => true } as any);
      vi.mocked(readdirSync).mockImplementation((path: any) => {
        if (path.toString() === '/project/src') {
          return [
            { name: 'file.ts', isDirectory: () => false, isFile: () => true } as any,
            { name: 'node_modules', isDirectory: () => true, isFile: () => false } as any,
          ];
        }
        return [];
      });
      vi.mocked(readFileSync).mockReturnValue('const x = 1;');

      const results = await analyzeDirectory('/project/src');

      // Should not include files from node_modules
      expect(results.every(r => !r.file.includes('node_modules'))).toBe(true);
    });

    it('should exclude dist by default', async () => {
      vi.mocked(statSync).mockReturnValue({ isFile: () => false, isDirectory: () => true } as any);
      vi.mocked(readdirSync).mockImplementation((path: any) => {
        if (path.toString() === '/project/src') {
          return [
            { name: 'file.ts', isDirectory: () => false, isFile: () => true } as any,
            { name: 'dist', isDirectory: () => true, isFile: () => false } as any,
          ];
        }
        return [];
      });
      vi.mocked(readFileSync).mockReturnValue('const x = 1;');

      const results = await analyzeDirectory('/project/src');

      // Should not include files from dist
      expect(results.every(r => !r.file.includes('/dist/'))).toBe(true);
    });

    it('should handle empty directory', async () => {
      vi.mocked(statSync).mockReturnValue({ isFile: () => false, isDirectory: () => true } as any);
      vi.mocked(readdirSync).mockReturnValue([]);

      const results = await analyzeDirectory('/project/empty');

      expect(results).toEqual([]);
    });

    it('should skip files that fail to parse', async () => {
      vi.mocked(statSync).mockReturnValue({ isFile: () => false, isDirectory: () => true } as any);
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'good.ts', isDirectory: () => false, isFile: () => true } as any,
        { name: 'bad.ts', isDirectory: () => false, isFile: () => true } as any,
      ]);
      vi.mocked(readFileSync).mockImplementation((path: any) => {
        if (path.toString().includes('bad.ts')) {
          throw new Error('Parse error');
        }
        return 'const x = 1;';
      });

      const results = await analyzeDirectory('/project/src');

      // Should return partial results (only the good file)
      expect(results.length).toBe(1);
    });

    it('should handle single file path', async () => {
      vi.mocked(statSync).mockReturnValue({ isFile: () => true, isDirectory: () => false } as any);
      vi.mocked(readFileSync).mockReturnValue('const x = 1;');

      const results = await analyzeDirectory('/project/src/single.ts');

      expect(results.length).toBe(1);
      expect(results[0].file).toBe('/project/src/single.ts');
    });
  });

  describe('Function extraction', () => {
    it('should extract function name', async () => {
      vi.mocked(readFileSync).mockReturnValue('function hello() {}');

      const result = await analyzeFile('/project/src/file.ts');
      const func = result.structure.functions.find(f => f.name === 'hello');

      expect(func).toBeDefined();
    });

    it('should extract arrow functions', async () => {
      vi.mocked(readFileSync).mockReturnValue('const arrow = () => {}');

      const result = await analyzeFile('/project/src/file.ts');

      expect(result.structure.functions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Class extraction', () => {
    it('should extract class name', async () => {
      vi.mocked(readFileSync).mockReturnValue('class MyClass {}');

      const result = await analyzeFile('/project/src/file.ts');
      const cls = result.structure.classes.find(c => c.name === 'MyClass');

      expect(cls).toBeDefined();
    });
  });

  describe('Metrics calculation', () => {
    it('should count total lines', async () => {
      vi.mocked(readFileSync).mockReturnValue('line1\nline2\nline3');

      const result = await analyzeFile('/project/src/file.ts');

      expect(result.metrics.totalLines).toBeGreaterThanOrEqual(3);
    });

    it('should count functions', async () => {
      vi.mocked(readFileSync).mockReturnValue('function hello() {}');

      const result = await analyzeFile('/project/src/file.ts');

      expect(result.metrics.functionCount).toBeGreaterThanOrEqual(0);
    });

    it('should count classes', async () => {
      vi.mocked(readFileSync).mockReturnValue('class MyClass {}');

      const result = await analyzeFile('/project/src/file.ts');

      expect(result.metrics.classCount).toBeGreaterThanOrEqual(0);
    });
  });
});
