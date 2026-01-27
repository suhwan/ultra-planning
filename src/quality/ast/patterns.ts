/**
 * AST Patterns
 *
 * Reusable ast-grep patterns for matching TypeScript/JavaScript constructs.
 * Uses ast-grep pattern syntax: https://ast-grep.github.io/guide/pattern-syntax.html
 *
 * Meta-variables:
 * - $NAME - Matches a single AST node (identifier, expression)
 * - $$$PARAMS - Matches multiple nodes (for lists)
 */

/**
 * AST-grep patterns for TypeScript/JavaScript analysis
 */
export const PATTERNS = {
  // ============================================================================
  // Functions
  // ============================================================================

  /** Regular function declaration */
  functionDeclaration: 'function $NAME($$$PARAMS) { $$$BODY }',

  /** Async function declaration */
  asyncFunction: 'async function $NAME($$$PARAMS) { $$$BODY }',

  /** Arrow function (const assignment) */
  arrowFunction: 'const $NAME = ($$$PARAMS) => $BODY',

  /** Async arrow function */
  asyncArrowFunction: 'const $NAME = async ($$$PARAMS) => $BODY',

  /** Method definition in class */
  methodDefinition: '$NAME($$$PARAMS) { $$$BODY }',

  // ============================================================================
  // Classes
  // ============================================================================

  /** Class declaration */
  classDeclaration: 'class $NAME { $$$BODY }',

  /** Class with inheritance */
  classWithExtends: 'class $NAME extends $PARENT { $$$BODY }',

  // ============================================================================
  // Exports
  // ============================================================================

  /** Export default statement */
  exportDefault: 'export default $EXPR',

  /** Named exports */
  exportNamed: 'export { $$$NAMES }',

  /** Export const declaration */
  exportConst: 'export const $NAME = $VALUE',

  /** Export function declaration */
  exportFunction: 'export function $NAME($$$PARAMS) { $$$BODY }',

  /** Export class declaration */
  exportClass: 'export class $NAME { $$$BODY }',

  /** Export type alias */
  exportType: 'export type $NAME = $TYPE',

  /** Export interface */
  exportInterface: 'export interface $NAME { $$$BODY }',

  // ============================================================================
  // Imports
  // ============================================================================

  /** Default import */
  importDefault: "import $NAME from '$SOURCE'",

  /** Named imports */
  importNamed: "import { $$$NAMES } from '$SOURCE'",

  /** Namespace import */
  importAll: "import * as $NAME from '$SOURCE'",
} as const;

/**
 * Pattern keys for type safety
 */
export type PatternKey = keyof typeof PATTERNS;

/**
 * Get patterns applicable to a language
 * Currently TypeScript and JavaScript use the same patterns
 *
 * @param language - Target language
 * @returns Pattern set for the language
 */
export function getPatternForLanguage(language: 'typescript' | 'javascript'): typeof PATTERNS {
  // ast-grep patterns work for both TypeScript and JavaScript
  return PATTERNS;
}
