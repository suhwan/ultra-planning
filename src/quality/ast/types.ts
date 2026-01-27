/**
 * AST Analysis Types
 *
 * Type definitions for code structure analysis results including
 * functions, classes, exports, imports, and code metrics.
 */

// ============================================================================
// Code Structure Types
// ============================================================================

/**
 * Information about a function in the codebase
 */
export interface FunctionInfo {
  /** Function name */
  name: string;
  /** Source file path */
  file: string;
  /** Starting line number (1-indexed) */
  startLine: number;
  /** Ending line number (1-indexed) */
  endLine: number;
  /** Total lines spanned by function */
  lineCount: number;
  /** Parameter names */
  params: string[];
  /** Whether function is async */
  isAsync: boolean;
  /** Whether function is exported */
  isExported: boolean;
}

/**
 * Information about a class in the codebase
 */
export interface ClassInfo {
  /** Class name */
  name: string;
  /** Source file path */
  file: string;
  /** Starting line number (1-indexed) */
  startLine: number;
  /** Ending line number (1-indexed) */
  endLine: number;
  /** Total lines spanned by class */
  lineCount: number;
  /** Method names */
  methods: string[];
  /** Property names */
  properties: string[];
  /** Whether class is exported */
  isExported: boolean;
}

/**
 * Information about an export statement
 */
export interface ExportInfo {
  /** Export name */
  name: string;
  /** Export type */
  type: 'function' | 'class' | 'const' | 'type' | 'interface' | 'default';
  /** Source file path */
  file: string;
  /** Line number */
  line: number;
}

/**
 * Information about an import statement
 */
export interface ImportInfo {
  /** Import source module */
  source: string;
  /** Imported names */
  names: string[];
  /** Whether this is a default import */
  isDefault: boolean;
  /** Source file path */
  file: string;
  /** Line number */
  line: number;
}

/**
 * Complete code structure information for a file
 */
export interface CodeStructure {
  /** Functions found in the file */
  functions: FunctionInfo[];
  /** Classes found in the file */
  classes: ClassInfo[];
  /** Exports from the file */
  exports: ExportInfo[];
  /** Imports in the file */
  imports: ImportInfo[];
}

// ============================================================================
// Code Metrics Types
// ============================================================================

/**
 * Calculated metrics for code quality assessment
 */
export interface CodeMetrics {
  /** Total lines including blanks and comments */
  totalLines: number;
  /** Code lines (excluding blank/comments) */
  codeLines: number;
  /** Number of functions */
  functionCount: number;
  /** Number of classes */
  classCount: number;
  /** Number of exports */
  exportCount: number;
  /** Number of imports */
  importCount: number;
  /** Average function size in lines */
  avgFunctionSize: number;
  /** Largest function size in lines */
  maxFunctionSize: number;
  /** Name of largest function */
  largestFunction: string | null;
  /** Cyclomatic complexity estimate */
  complexity: number;
}

/**
 * Complete file analysis result
 */
export interface FileAnalysis {
  /** File path */
  file: string;
  /** Code structure information */
  structure: CodeStructure;
  /** Calculated metrics */
  metrics: CodeMetrics;
}
