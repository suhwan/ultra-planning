/**
 * AST Patterns Tests
 *
 * Tests for the AST pattern definitions used with ast-grep
 * for matching TypeScript/JavaScript code structures.
 */

import { describe, it, expect } from 'vitest';
import { PATTERNS, getPatternForLanguage, type PatternKey } from './patterns.js';

describe('AST Patterns', () => {
  describe('PATTERNS constant', () => {
    it('should contain function declaration pattern', () => {
      expect(PATTERNS.functionDeclaration).toBeDefined();
      expect(typeof PATTERNS.functionDeclaration).toBe('string');
    });

    it('should contain async function pattern', () => {
      expect(PATTERNS.asyncFunction).toBeDefined();
      expect(PATTERNS.asyncFunction).toContain('async');
    });

    it('should contain arrow function pattern', () => {
      expect(PATTERNS.arrowFunction).toBeDefined();
      expect(PATTERNS.arrowFunction).toContain('=>');
    });

    it('should contain async arrow function pattern', () => {
      expect(PATTERNS.asyncArrowFunction).toBeDefined();
      expect(PATTERNS.asyncArrowFunction).toContain('async');
      expect(PATTERNS.asyncArrowFunction).toContain('=>');
    });

    it('should contain class declaration pattern', () => {
      expect(PATTERNS.classDeclaration).toBeDefined();
      expect(PATTERNS.classDeclaration).toContain('class');
    });

    it('should contain class with extends pattern', () => {
      expect(PATTERNS.classWithExtends).toBeDefined();
      expect(PATTERNS.classWithExtends).toContain('extends');
    });

    it('should contain method definition pattern', () => {
      expect(PATTERNS.methodDefinition).toBeDefined();
    });
  });

  describe('Export patterns', () => {
    it('should contain export default pattern', () => {
      expect(PATTERNS.exportDefault).toBeDefined();
      expect(PATTERNS.exportDefault).toContain('export default');
    });

    it('should contain named exports pattern', () => {
      expect(PATTERNS.exportNamed).toBeDefined();
      expect(PATTERNS.exportNamed).toContain('export');
      expect(PATTERNS.exportNamed).toContain('{');
    });

    it('should contain export const pattern', () => {
      expect(PATTERNS.exportConst).toBeDefined();
      expect(PATTERNS.exportConst).toContain('export const');
    });

    it('should contain export function pattern', () => {
      expect(PATTERNS.exportFunction).toBeDefined();
      expect(PATTERNS.exportFunction).toContain('export function');
    });

    it('should contain export class pattern', () => {
      expect(PATTERNS.exportClass).toBeDefined();
      expect(PATTERNS.exportClass).toContain('export class');
    });

    it('should contain export type pattern', () => {
      expect(PATTERNS.exportType).toBeDefined();
      expect(PATTERNS.exportType).toContain('export type');
    });

    it('should contain export interface pattern', () => {
      expect(PATTERNS.exportInterface).toBeDefined();
      expect(PATTERNS.exportInterface).toContain('export interface');
    });
  });

  describe('Import patterns', () => {
    it('should contain default import pattern', () => {
      expect(PATTERNS.importDefault).toBeDefined();
      expect(PATTERNS.importDefault).toContain('import');
      expect(PATTERNS.importDefault).toContain('from');
    });

    it('should contain named imports pattern', () => {
      expect(PATTERNS.importNamed).toBeDefined();
      expect(PATTERNS.importNamed).toContain('import');
      expect(PATTERNS.importNamed).toContain('{');
    });

    it('should contain namespace import pattern', () => {
      expect(PATTERNS.importAll).toBeDefined();
      expect(PATTERNS.importAll).toContain('* as');
    });
  });

  describe('Pattern format', () => {
    it('should use $NAME meta-variable for single node matches', () => {
      const patternsWithName = [
        PATTERNS.functionDeclaration,
        PATTERNS.arrowFunction,
        PATTERNS.classDeclaration,
        PATTERNS.exportConst,
      ];

      for (const pattern of patternsWithName) {
        expect(pattern).toContain('$NAME');
      }
    });

    it('should use $$$PARAMS for parameter lists', () => {
      expect(PATTERNS.functionDeclaration).toContain('$$$PARAMS');
      expect(PATTERNS.asyncFunction).toContain('$$$PARAMS');
    });

    it('should use $$$BODY for function/class bodies', () => {
      expect(PATTERNS.functionDeclaration).toContain('$$$BODY');
      expect(PATTERNS.classDeclaration).toContain('$$$BODY');
    });

    it('should use $EXPR for expressions', () => {
      expect(PATTERNS.exportDefault).toContain('$EXPR');
    });

    it('should use $SOURCE for import sources', () => {
      expect(PATTERNS.importDefault).toContain('$SOURCE');
      expect(PATTERNS.importNamed).toContain('$SOURCE');
    });
  });

  describe('getPatternForLanguage', () => {
    it('should return PATTERNS for TypeScript', () => {
      const result = getPatternForLanguage('typescript');
      expect(result).toBe(PATTERNS);
    });

    it('should return PATTERNS for JavaScript', () => {
      const result = getPatternForLanguage('javascript');
      expect(result).toBe(PATTERNS);
    });

    it('should return same patterns for both languages', () => {
      const tsPatterns = getPatternForLanguage('typescript');
      const jsPatterns = getPatternForLanguage('javascript');

      expect(tsPatterns).toEqual(jsPatterns);
    });
  });

  describe('Pattern completeness', () => {
    it('should have all expected pattern keys', () => {
      const expectedKeys = [
        'functionDeclaration',
        'asyncFunction',
        'arrowFunction',
        'asyncArrowFunction',
        'methodDefinition',
        'classDeclaration',
        'classWithExtends',
        'exportDefault',
        'exportNamed',
        'exportConst',
        'exportFunction',
        'exportClass',
        'exportType',
        'exportInterface',
        'importDefault',
        'importNamed',
        'importAll',
      ];

      for (const key of expectedKeys) {
        expect(PATTERNS).toHaveProperty(key);
      }
    });

    it('should have non-empty string values for all patterns', () => {
      for (const [key, value] of Object.entries(PATTERNS)) {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    });
  });

  describe('PatternKey type', () => {
    it('should be usable for type-safe pattern access', () => {
      const key: PatternKey = 'functionDeclaration';
      const pattern = PATTERNS[key];

      expect(pattern).toBeDefined();
      expect(typeof pattern).toBe('string');
    });
  });
});
