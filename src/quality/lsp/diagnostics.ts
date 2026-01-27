/**
 * LSP Diagnostics Runner
 *
 * Executes diagnostics using TypeScript compiler or LSP iteration.
 * Provides unified interface for project-level type checking.
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { DiagnosticResult, DiagnosticStrategy } from './types.js';
import { parseDiagnosticOutput, countBySeverity } from './parser.js';

/**
 * Auto-detect best diagnostic strategy for a directory
 *
 * Prefers tsc if tsconfig.json exists, otherwise falls back to LSP
 *
 * @param directory - Target directory path
 * @returns Recommended strategy
 */
function detectStrategy(directory: string): 'tsc' | 'lsp' {
  const tsconfigPath = join(directory, 'tsconfig.json');
  return existsSync(tsconfigPath) ? 'tsc' : 'lsp';
}

/**
 * Run diagnostics on a directory
 *
 * Main entry point for executing diagnostics. Auto-detects strategy
 * or uses provided configuration.
 *
 * @param directory - Project directory to check
 * @param options - Optional strategy configuration
 * @returns Diagnostic execution result with all findings
 */
export async function runDiagnostics(
  directory: string,
  options?: Partial<DiagnosticStrategy>
): Promise<DiagnosticResult> {
  // Resolve strategy
  const strategy = options?.type === 'auto' || !options?.type
    ? detectStrategy(directory)
    : options.type;

  const timeout = options?.timeout ?? 60000;
  const start = Date.now();

  try {
    if (strategy === 'tsc') {
      return await runTscDiagnostics(directory, timeout);
    } else {
      // LSP fallback - not yet implemented
      return await runLspDiagnostics(directory, timeout);
    }
  } catch (error) {
    const duration = Date.now() - start;
    return {
      success: false,
      strategy,
      diagnostics: [],
      summary: {
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        hintCount: 0,
        fileCount: 0
      },
      duration,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Run diagnostics using TypeScript compiler
 *
 * Executes `tsc --noEmit` and parses the output
 *
 * @param directory - Project directory
 * @param timeout - Maximum execution time in ms
 * @returns Diagnostic result
 */
async function runTscDiagnostics(
  directory: string,
  timeout: number
): Promise<DiagnosticResult> {
  const start = Date.now();

  try {
    // Run tsc --noEmit to check types without generating output files
    // We expect this to fail with exit code 2 if there are type errors
    execSync('npx tsc --noEmit', {
      cwd: directory,
      encoding: 'utf-8',
      timeout,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // If we get here, no type errors were found
    const duration = Date.now() - start;
    return {
      success: true,
      strategy: 'tsc',
      diagnostics: [],
      summary: {
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        hintCount: 0,
        fileCount: 0
      },
      duration
    };
  } catch (error: any) {
    // tsc exits with code 2 when there are type errors
    // The diagnostic output is in stderr
    const duration = Date.now() - start;

    if (error.stderr || error.stdout) {
      // Combine stdout and stderr as tsc may use both
      const output = (error.stderr || '') + '\n' + (error.stdout || '');
      const diagnostics = parseDiagnosticOutput(output);
      const summary = countBySeverity(diagnostics);

      return {
        success: true, // Execution succeeded, even though code has errors
        strategy: 'tsc',
        diagnostics,
        summary,
        duration
      };
    }

    // Actual execution error (timeout, command not found, etc.)
    return {
      success: false,
      strategy: 'tsc',
      diagnostics: [],
      summary: {
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        hintCount: 0,
        fileCount: 0
      },
      duration,
      error: error.message || 'TypeScript compilation check failed'
    };
  }
}

/**
 * Run diagnostics using Language Server Protocol iteration
 *
 * Fallback strategy when tsc is not available.
 * Currently a stub - will iterate through files using LSP.
 *
 * @param directory - Project directory
 * @param timeout - Maximum execution time in ms
 * @returns Diagnostic result
 */
async function runLspDiagnostics(
  directory: string,
  timeout: number
): Promise<DiagnosticResult> {
  const start = Date.now();

  // TODO: Implement LSP iteration strategy
  // This would:
  // 1. Find all TypeScript files in directory
  // 2. Open each file via LSP client
  // 3. Collect diagnostics from LSP
  // 4. Aggregate results

  const duration = Date.now() - start;
  return {
    success: true,
    strategy: 'lsp',
    diagnostics: [],
    summary: {
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
      hintCount: 0,
      fileCount: 0
    },
    duration
  };
}
