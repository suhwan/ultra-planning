/**
 * LSP Parser Tests
 *
 * Tests for the diagnostic output parser that converts tsc output
 * into structured diagnostic items.
 */

import { describe, it, expect } from 'vitest';
import { parseDiagnosticOutput, countBySeverity, groupByFile } from './parser.js';

describe('LSP Parser', () => {
  describe('parseDiagnosticOutput', () => {
    it('should parse tsc error format: "file(line,col): error TScode: message"', () => {
      const output = 'src/file.ts(10,5): error TS2322: Type string is not assignable to type number';
      const result = parseDiagnosticOutput(output);

      expect(result).toHaveLength(1);
      expect(result[0].file).toBe('src/file.ts');
      expect(result[0].line).toBe(10);
      expect(result[0].column).toBe(5);
      expect(result[0].severity).toBe('error');
      expect(result[0].code).toBe('TS2322');
      expect(result[0].message).toBe('Type string is not assignable to type number');
    });

    it('should parse warning format: "file(line,col): warning TScode: message"', () => {
      const output = 'src/utils.ts(5,3): warning TS6385: A function returning never is used';
      const result = parseDiagnosticOutput(output);

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('warning');
      expect(result[0].code).toBe('TS6385');
    });

    it('should handle multi-line error output', () => {
      const output = `src/a.ts(1,1): error TS1001: First error
src/b.ts(2,2): error TS1002: Second error
src/c.ts(3,3): warning TS1003: A warning`;

      const result = parseDiagnosticOutput(output);

      expect(result).toHaveLength(3);
      expect(result[0].file).toBe('src/a.ts');
      expect(result[1].file).toBe('src/b.ts');
      expect(result[2].file).toBe('src/c.ts');
    });

    it('should return empty array for clean output', () => {
      const output = '';
      const result = parseDiagnosticOutput(output);

      expect(result).toEqual([]);
    });

    it('should handle relative paths', () => {
      const output = './src/file.ts(5,10): error TS2000: Some error';
      const result = parseDiagnosticOutput(output);

      expect(result).toHaveLength(1);
      expect(result[0].file).toBe('./src/file.ts');
    });

    it('should handle absolute paths', () => {
      const output = '/home/user/project/src/file.ts(5,10): error TS2000: Some error';
      const result = parseDiagnosticOutput(output);

      expect(result).toHaveLength(1);
      expect(result[0].file).toBe('/home/user/project/src/file.ts');
    });

    it('should handle malformed output gracefully', () => {
      const output = `This is not a diagnostic
Just some random text
Also not valid`;

      const result = parseDiagnosticOutput(output);

      expect(result).toEqual([]);
    });

    it('should ignore non-diagnostic lines', () => {
      const output = `Starting compilation...
src/file.ts(1,1): error TS1000: Real error
Done in 1.5s`;

      const result = parseDiagnosticOutput(output);

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('TS1000');
    });

    it('should handle blank lines in output', () => {
      const output = `
src/a.ts(1,1): error TS1001: Error one

src/b.ts(2,2): error TS1002: Error two
`;

      const result = parseDiagnosticOutput(output);

      expect(result).toHaveLength(2);
    });

    it('should parse info severity', () => {
      const output = 'src/file.ts(1,1): info TS2000: Information message';
      const result = parseDiagnosticOutput(output);

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('info');
    });

    it('should parse hint severity', () => {
      const output = 'src/file.ts(1,1): hint TS2000: Hint message';
      const result = parseDiagnosticOutput(output);

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('hint');
    });
  });

  describe('Diagnostic structure', () => {
    it('should include file path', () => {
      const output = 'src/models/user.ts(10,5): error TS2322: Type error';
      const result = parseDiagnosticOutput(output);

      expect(result[0].file).toBe('src/models/user.ts');
    });

    it('should include line number', () => {
      const output = 'src/file.ts(42,5): error TS2322: Type error';
      const result = parseDiagnosticOutput(output);

      expect(result[0].line).toBe(42);
    });

    it('should include column number', () => {
      const output = 'src/file.ts(10,15): error TS2322: Type error';
      const result = parseDiagnosticOutput(output);

      expect(result[0].column).toBe(15);
    });

    it('should include error code (TSxxxx)', () => {
      const output = 'src/file.ts(1,1): error TS2345: Argument type error';
      const result = parseDiagnosticOutput(output);

      expect(result[0].code).toBe('TS2345');
    });

    it('should include message text', () => {
      const message = "Property 'foo' does not exist on type 'Bar'";
      const output = `src/file.ts(1,1): error TS2339: ${message}`;
      const result = parseDiagnosticOutput(output);

      expect(result[0].message).toBe(message);
    });
  });

  describe('countBySeverity', () => {
    it('should count errors correctly', () => {
      const items = [
        { file: 'a.ts', line: 1, column: 1, severity: 'error' as const, code: 'TS1', message: 'e1' },
        { file: 'b.ts', line: 2, column: 1, severity: 'error' as const, code: 'TS2', message: 'e2' },
        { file: 'c.ts', line: 3, column: 1, severity: 'error' as const, code: 'TS3', message: 'e3' },
      ];

      const result = countBySeverity(items);

      expect(result.errorCount).toBe(3);
    });

    it('should count warnings correctly', () => {
      const items = [
        { file: 'a.ts', line: 1, column: 1, severity: 'warning' as const, code: 'TS1', message: 'w1' },
        { file: 'b.ts', line: 2, column: 1, severity: 'warning' as const, code: 'TS2', message: 'w2' },
      ];

      const result = countBySeverity(items);

      expect(result.warningCount).toBe(2);
    });

    it('should count info and hints correctly', () => {
      const items = [
        { file: 'a.ts', line: 1, column: 1, severity: 'info' as const, code: 'TS1', message: 'i1' },
        { file: 'b.ts', line: 2, column: 1, severity: 'hint' as const, code: 'TS2', message: 'h1' },
        { file: 'c.ts', line: 3, column: 1, severity: 'hint' as const, code: 'TS3', message: 'h2' },
      ];

      const result = countBySeverity(items);

      expect(result.infoCount).toBe(1);
      expect(result.hintCount).toBe(2);
    });

    it('should return zero counts for empty input', () => {
      const result = countBySeverity([]);

      expect(result.errorCount).toBe(0);
      expect(result.warningCount).toBe(0);
      expect(result.infoCount).toBe(0);
      expect(result.hintCount).toBe(0);
      expect(result.fileCount).toBe(0);
    });

    it('should count unique files affected', () => {
      const items = [
        { file: 'a.ts', line: 1, column: 1, severity: 'error' as const, code: 'TS1', message: 'e1' },
        { file: 'a.ts', line: 2, column: 1, severity: 'error' as const, code: 'TS2', message: 'e2' },
        { file: 'b.ts', line: 1, column: 1, severity: 'error' as const, code: 'TS3', message: 'e3' },
      ];

      const result = countBySeverity(items);

      expect(result.fileCount).toBe(2);
    });

    it('should handle mixed severities', () => {
      const items = [
        { file: 'a.ts', line: 1, column: 1, severity: 'error' as const, code: 'TS1', message: 'e1' },
        { file: 'b.ts', line: 2, column: 1, severity: 'warning' as const, code: 'TS2', message: 'w1' },
        { file: 'c.ts', line: 3, column: 1, severity: 'info' as const, code: 'TS3', message: 'i1' },
        { file: 'd.ts', line: 4, column: 1, severity: 'hint' as const, code: 'TS4', message: 'h1' },
      ];

      const result = countBySeverity(items);

      expect(result.errorCount).toBe(1);
      expect(result.warningCount).toBe(1);
      expect(result.infoCount).toBe(1);
      expect(result.hintCount).toBe(1);
      expect(result.fileCount).toBe(4);
    });
  });

  describe('groupByFile', () => {
    it('should group diagnostics by file path', () => {
      const items = [
        { file: 'a.ts', line: 1, column: 1, severity: 'error' as const, code: 'TS1', message: 'e1' },
        { file: 'a.ts', line: 2, column: 1, severity: 'error' as const, code: 'TS2', message: 'e2' },
        { file: 'b.ts', line: 1, column: 1, severity: 'error' as const, code: 'TS3', message: 'e3' },
      ];

      const result = groupByFile(items);

      expect(result.size).toBe(2);
      expect(result.get('a.ts')?.length).toBe(2);
      expect(result.get('b.ts')?.length).toBe(1);
    });

    it('should return empty map for empty input', () => {
      const result = groupByFile([]);

      expect(result.size).toBe(0);
    });

    it('should handle single file with multiple diagnostics', () => {
      const items = [
        { file: 'single.ts', line: 1, column: 1, severity: 'error' as const, code: 'TS1', message: 'e1' },
        { file: 'single.ts', line: 2, column: 1, severity: 'warning' as const, code: 'TS2', message: 'w1' },
        { file: 'single.ts', line: 3, column: 1, severity: 'info' as const, code: 'TS3', message: 'i1' },
      ];

      const result = groupByFile(items);

      expect(result.size).toBe(1);
      expect(result.get('single.ts')?.length).toBe(3);
    });
  });
});
