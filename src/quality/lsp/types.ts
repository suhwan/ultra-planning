/**
 * LSP Diagnostics Types
 *
 * Type definitions for LSP-based diagnostics and code quality checks.
 * Supports both TypeScript compiler (tsc) and Language Server Protocol strategies.
 */

// ============================================================================
// Diagnostic Severity
// ============================================================================

/**
 * Diagnostic severity levels matching LSP and TypeScript compiler output
 */
export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';

// ============================================================================
// Diagnostic Items
// ============================================================================

/**
 * Individual diagnostic item from LSP or compiler
 */
export interface DiagnosticItem {
  /** Source file path (absolute or relative) */
  file: string;
  /** Line number (1-indexed) */
  line: number;
  /** Column number (1-indexed) */
  column: number;
  /** Severity level */
  severity: DiagnosticSeverity;
  /** Error/warning code (e.g., "TS2322" or 2322) */
  code: string | number;
  /** Human-readable diagnostic message */
  message: string;
}

// ============================================================================
// Strategy Configuration
// ============================================================================

/**
 * Diagnostic execution strategy configuration
 */
export interface DiagnosticStrategy {
  /**
   * Strategy type:
   * - 'tsc': Use TypeScript compiler (fast, preferred for TS projects)
   * - 'lsp': Use Language Server Protocol iteration (fallback)
   * - 'auto': Auto-detect based on tsconfig.json presence
   */
  type: 'tsc' | 'lsp' | 'auto';

  /** Maximum execution timeout in milliseconds (default: 60000) */
  timeout?: number;

  /** Minimum severity level to include in results (filters out less severe) */
  minSeverity?: DiagnosticSeverity;
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Summary statistics for diagnostic results
 */
export interface DiagnosticSummary {
  /** Number of errors found */
  errorCount: number;
  /** Number of warnings found */
  warningCount: number;
  /** Number of info-level diagnostics */
  infoCount: number;
  /** Number of hints */
  hintCount: number;
  /** Number of unique files with diagnostics */
  fileCount: number;
}

/**
 * Complete diagnostic execution result
 */
export interface DiagnosticResult {
  /** Whether execution succeeded (not whether code is error-free) */
  success: boolean;
  /** Strategy used for execution */
  strategy: 'tsc' | 'lsp';
  /** All diagnostic items found */
  diagnostics: DiagnosticItem[];
  /** Summary statistics */
  summary: DiagnosticSummary;
  /** Execution duration in milliseconds */
  duration: number;
  /** Error message if execution failed */
  error?: string;
}
