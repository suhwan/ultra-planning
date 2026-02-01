/**
 * File Guard Hook Tests
 *
 * Tests for the write warning enforcement system that helps orchestrators
 * avoid directly modifying source files.
 */

import { describe, it, expect } from 'vitest';
import {
  shouldWarnOnWrite,
  getFileGuardWarning,
  WRITE_TOOLS,
  ALLOWED_PATHS,
} from './file-guard.js';

describe('File Guard Hook', () => {
  describe('WRITE_TOOLS constant', () => {
    it('should contain Write tool', () => {
      expect(WRITE_TOOLS).toContain('Write');
    });

    it('should contain Edit tool', () => {
      expect(WRITE_TOOLS).toContain('Edit');
    });

    it('should contain lowercase write tool', () => {
      expect(WRITE_TOOLS).toContain('write');
    });

    it('should contain lowercase edit tool', () => {
      expect(WRITE_TOOLS).toContain('edit');
    });

    it('should contain MultiEdit tool', () => {
      expect(WRITE_TOOLS).toContain('MultiEdit');
    });
  });

  describe('ALLOWED_PATHS constant', () => {
    it('should contain .ultraplan/ directory', () => {
      expect(ALLOWED_PATHS).toContain('.ultraplan/');
    });

    it('should contain .planning/ directory', () => {
      expect(ALLOWED_PATHS).toContain('.planning/');
    });

    it('should contain CLAUDE.md file', () => {
      expect(ALLOWED_PATHS).toContain('CLAUDE.md');
    });

    it('should contain AGENTS.md file', () => {
      expect(ALLOWED_PATHS).toContain('AGENTS.md');
    });
  });

  describe('shouldWarnOnWrite', () => {
    it('should return true for Write tool on source files', () => {
      expect(shouldWarnOnWrite('Write', 'src/api.ts')).toBe(true);
    });

    it('should return true for Edit tool on source files', () => {
      expect(shouldWarnOnWrite('Edit', 'src/models/user.ts')).toBe(true);
    });

    it('should return true for lowercase write tool on source files', () => {
      expect(shouldWarnOnWrite('write', 'lib/utils.js')).toBe(true);
    });

    it('should return true for MultiEdit tool on source files', () => {
      expect(shouldWarnOnWrite('MultiEdit', 'src/components/Button.tsx')).toBe(true);
    });

    it('should return false for Write tool on .planning/ paths', () => {
      expect(shouldWarnOnWrite('Write', '.planning/PLAN.md')).toBe(false);
    });

    it('should return false for Write tool on .ultraplan/ paths', () => {
      expect(shouldWarnOnWrite('Write', '.ultraplan/STATE.md')).toBe(false);
    });

    it('should return false for Write tool on CLAUDE.md', () => {
      expect(shouldWarnOnWrite('Write', 'CLAUDE.md')).toBe(false);
    });

    it('should return false for Write tool on AGENTS.md', () => {
      expect(shouldWarnOnWrite('Write', 'AGENTS.md')).toBe(false);
    });

    it('should return false for Read tool (not a write operation)', () => {
      expect(shouldWarnOnWrite('Read', 'src/api.ts')).toBe(false);
    });

    it('should return false for Glob tool', () => {
      expect(shouldWarnOnWrite('Glob', 'src/*.ts')).toBe(false);
    });

    it('should return false for Grep tool', () => {
      expect(shouldWarnOnWrite('Grep', 'src/api.ts')).toBe(false);
    });

    it('should return false for Bash tool', () => {
      expect(shouldWarnOnWrite('Bash', 'npm test')).toBe(false);
    });

    it('should handle paths containing allowed prefixes', () => {
      // Path contains .planning/ so should not warn
      expect(shouldWarnOnWrite('Write', '/project/.planning/notes.md')).toBe(false);
    });

    it('should handle nested source file paths', () => {
      expect(shouldWarnOnWrite('Edit', 'src/features/auth/login.ts')).toBe(true);
    });
  });

  describe('getFileGuardWarning', () => {
    it('should return shouldWarn:false for allowed paths', () => {
      const result = getFileGuardWarning('Write', '.planning/PLAN.md');
      expect(result.shouldWarn).toBe(false);
      expect(result.warning).toBeUndefined();
    });

    it('should return shouldWarn:true for source files', () => {
      const result = getFileGuardWarning('Write', 'src/models/user.ts');
      expect(result.shouldWarn).toBe(true);
    });

    it('should include file path in warning', () => {
      const result = getFileGuardWarning('Write', 'src/models/user.ts');
      expect(result.warning).toContain('src/models/user.ts');
    });

    it('should include delegation instructions in warning', () => {
      const result = getFileGuardWarning('Edit', 'src/api.ts');
      expect(result.warning).toContain('DELEGATE');
    });

    it('should mention allowed exceptions in warning', () => {
      const result = getFileGuardWarning('Write', 'lib/utils.js');
      expect(result.warning).toContain('.ultraplan/');
      expect(result.warning).toContain('.planning/');
      expect(result.warning).toContain('CLAUDE.md');
      expect(result.warning).toContain('AGENTS.md');
    });

    it('should include path property in result', () => {
      const result = getFileGuardWarning('Write', 'src/index.ts');
      expect(result.path).toBe('src/index.ts');
    });

    it('should include tool property in result', () => {
      const result = getFileGuardWarning('Edit', 'src/index.ts');
      expect(result.tool).toBe('Edit');
    });

    it('should contain SYSTEM DIRECTIVE prefix in warning', () => {
      const result = getFileGuardWarning('Write', 'src/code.ts');
      expect(result.warning).toContain('[SYSTEM DIRECTIVE:');
    });

    it('should contain DELEGATION REQUIRED type in warning', () => {
      const result = getFileGuardWarning('Write', 'src/code.ts');
      expect(result.warning).toContain('DELEGATION REQUIRED');
    });

    it('should not warn for CLAUDE.md with full path', () => {
      const result = getFileGuardWarning('Write', '/project/CLAUDE.md');
      expect(result.shouldWarn).toBe(false);
    });

    it('should handle Read tool (no warning)', () => {
      const result = getFileGuardWarning('Read', 'src/api.ts');
      expect(result.shouldWarn).toBe(false);
    });
  });
});
