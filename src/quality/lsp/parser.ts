/**
 * LSP Diagnostics Parser
 *
 * Parses TypeScript compiler (tsc --noEmit) output into structured diagnostics.
 * Handles standard tsc output format: "file.ts(line,col): severity TScode: message"
 */

import { DiagnosticItem, DiagnosticSeverity, DiagnosticSummary } from './types.js';

/**
 * Parse tsc --noEmit output into structured diagnostic items
 *
 * Expected format: "src/file.ts(10,5): error TS2322: Type 'string' is not assignable..."
 *
 * @param output - Raw stdout/stderr from tsc command
 * @returns Array of parsed diagnostic items
 */
export function parseDiagnosticOutput(output: string): DiagnosticItem[] {
  const lines = output.split('\n');
  const items: DiagnosticItem[] = [];

  // Regex to match tsc diagnostic format
  // Captures: file path, line, column, severity, code, message
  const regex = /^(.+)\((\d+),(\d+)\):\s+(error|warning|info|hint)\s+(TS\d+):\s+(.+)$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(regex);
    if (!match) continue;

    const [, file, lineStr, colStr, severityStr, code, message] = match;

    // Validate severity
    const severity = severityStr as DiagnosticSeverity;
    if (!['error', 'warning', 'info', 'hint'].includes(severity)) {
      continue;
    }

    items.push({
      file: file.trim(),
      line: parseInt(lineStr, 10),
      column: parseInt(colStr, 10),
      severity,
      code,
      message: message.trim()
    });
  }

  return items;
}

/**
 * Group diagnostic items by file path
 *
 * @param items - Array of diagnostic items
 * @returns Map of file path to diagnostics in that file
 */
export function groupByFile(items: DiagnosticItem[]): Map<string, DiagnosticItem[]> {
  const grouped = new Map<string, DiagnosticItem[]>();

  for (const item of items) {
    const existing = grouped.get(item.file) || [];
    existing.push(item);
    grouped.set(item.file, existing);
  }

  return grouped;
}

/**
 * Count diagnostics by severity level
 *
 * @param items - Array of diagnostic items
 * @returns Summary with counts per severity and unique file count
 */
export function countBySeverity(items: DiagnosticItem[]): DiagnosticSummary {
  const summary: DiagnosticSummary = {
    errorCount: 0,
    warningCount: 0,
    infoCount: 0,
    hintCount: 0,
    fileCount: 0
  };

  const uniqueFiles = new Set<string>();

  for (const item of items) {
    uniqueFiles.add(item.file);

    switch (item.severity) {
      case 'error':
        summary.errorCount++;
        break;
      case 'warning':
        summary.warningCount++;
        break;
      case 'info':
        summary.infoCount++;
        break;
      case 'hint':
        summary.hintCount++;
        break;
    }
  }

  summary.fileCount = uniqueFiles.size;

  return summary;
}
