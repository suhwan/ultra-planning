/**
 * LSP Diagnostics Tests
 *
 * Tests for the LSP diagnostics runner that executes TypeScript
 * type checking and returns structured results.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runDiagnostics } from './diagnostics.js';

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

import { execSync } from 'child_process';
import { existsSync } from 'fs';

describe('LSP Diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('runDiagnostics', () => {
    it('should return DiagnosticResult with success flag', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockReturnValue('');

      const result = await runDiagnostics('/project');

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });

    it('should auto-detect tsc strategy when tsconfig.json exists', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockReturnValue('');

      const result = await runDiagnostics('/project');

      expect(result.strategy).toBe('tsc');
    });

    it('should fall back to lsp strategy when no tsconfig', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await runDiagnostics('/project');

      expect(result.strategy).toBe('lsp');
    });

    it('should respect explicit tsc strategy option', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(execSync).mockImplementation(() => {
        const error = new Error('tsc error') as any;
        error.stderr = '';
        error.stdout = '';
        throw error;
      });

      const result = await runDiagnostics('/project', { type: 'tsc' });

      expect(result.strategy).toBe('tsc');
    });

    it('should include duration in result', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockReturnValue('');

      const result = await runDiagnostics('/project');

      expect(result).toHaveProperty('duration');
      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should return empty diagnostics on clean build', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockReturnValue('');

      const result = await runDiagnostics('/project');

      expect(result.success).toBe(true);
      expect(result.diagnostics).toEqual([]);
      expect(result.summary.errorCount).toBe(0);
    });

    it('should capture TypeScript errors with file:line:col', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const tscError = new Error('tsc failed') as any;
      tscError.stderr = 'src/file.ts(10,5): error TS2322: Type string is not assignable to type number';
      tscError.stdout = '';
      vi.mocked(execSync).mockImplementation(() => {
        throw tscError;
      });

      const result = await runDiagnostics('/project');

      expect(result.success).toBe(true); // Execution succeeded
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].file).toBe('src/file.ts');
      expect(result.diagnostics[0].line).toBe(10);
      expect(result.diagnostics[0].column).toBe(5);
    });

    it('should parse multiple errors', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const tscError = new Error('tsc failed') as any;
      tscError.stderr = `src/a.ts(1,1): error TS1001: Error one
src/b.ts(2,2): error TS1002: Error two`;
      tscError.stdout = '';
      vi.mocked(execSync).mockImplementation(() => {
        throw tscError;
      });

      const result = await runDiagnostics('/project');

      expect(result.diagnostics.length).toBe(2);
    });

    it('should handle timeout gracefully', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const timeoutError = new Error('Command timed out') as any;
      timeoutError.killed = true;
      vi.mocked(execSync).mockImplementation(() => {
        throw timeoutError;
      });

      const result = await runDiagnostics('/project');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle missing tsc gracefully', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const error = new Error('Command not found: tsc') as any;
      vi.mocked(execSync).mockImplementation(() => {
        throw error;
      });

      const result = await runDiagnostics('/project');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error field on failure', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const error = new Error('Something went wrong');
      vi.mocked(execSync).mockImplementation(() => {
        throw error;
      });

      const result = await runDiagnostics('/project');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Something went wrong');
    });
  });

  describe('Summary counts', () => {
    it('should count errors correctly', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const tscError = new Error('tsc failed') as any;
      tscError.stderr = `src/a.ts(1,1): error TS1001: Error one
src/b.ts(2,2): error TS1002: Error two
src/c.ts(3,3): error TS1003: Error three`;
      tscError.stdout = '';
      vi.mocked(execSync).mockImplementation(() => {
        throw tscError;
      });

      const result = await runDiagnostics('/project');

      expect(result.summary.errorCount).toBe(3);
    });

    it('should count warnings correctly', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const tscError = new Error('tsc failed') as any;
      tscError.stderr = `src/a.ts(1,1): warning TS6385: Warning one
src/b.ts(2,2): warning TS6386: Warning two`;
      tscError.stdout = '';
      vi.mocked(execSync).mockImplementation(() => {
        throw tscError;
      });

      const result = await runDiagnostics('/project');

      expect(result.summary.warningCount).toBe(2);
    });

    it('should count unique files affected', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const tscError = new Error('tsc failed') as any;
      tscError.stderr = `src/a.ts(1,1): error TS1001: Error one
src/a.ts(2,2): error TS1002: Error two
src/b.ts(3,3): error TS1003: Error three`;
      tscError.stdout = '';
      vi.mocked(execSync).mockImplementation(() => {
        throw tscError;
      });

      const result = await runDiagnostics('/project');

      expect(result.summary.fileCount).toBe(2);
    });

    it('should return zero counts for empty input', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockReturnValue('');

      const result = await runDiagnostics('/project');

      expect(result.summary.errorCount).toBe(0);
      expect(result.summary.warningCount).toBe(0);
      expect(result.summary.infoCount).toBe(0);
      expect(result.summary.hintCount).toBe(0);
      expect(result.summary.fileCount).toBe(0);
    });
  });

  describe('LSP strategy fallback', () => {
    it('should return stub result for lsp strategy', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await runDiagnostics('/project', { type: 'lsp' });

      expect(result.success).toBe(true);
      expect(result.strategy).toBe('lsp');
      expect(result.diagnostics).toEqual([]);
    });
  });

  describe('Auto strategy', () => {
    it('should detect tsc when tsconfig.json exists', async () => {
      vi.mocked(existsSync).mockImplementation((path: any) => {
        return path.toString().endsWith('tsconfig.json');
      });
      vi.mocked(execSync).mockReturnValue('');

      const result = await runDiagnostics('/project', { type: 'auto' });

      expect(result.strategy).toBe('tsc');
    });

    it('should fall back to lsp when no tsconfig.json', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await runDiagnostics('/project', { type: 'auto' });

      expect(result.strategy).toBe('lsp');
    });
  });
});
