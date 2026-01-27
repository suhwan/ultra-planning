/**
 * AST Analyzer
 *
 * Core analysis functions using ast-grep for code structure extraction.
 * Analyzes TypeScript/JavaScript files to extract functions, classes, exports, and imports.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import type { CodeStructure, FunctionInfo, ClassInfo, ExportInfo, ImportInfo, FileAnalysis } from './types.js';
import { PATTERNS } from './patterns.js';
import { calculateMetrics } from './metrics.js';

// Dynamic import for ESM module
let sgModule: typeof import('@ast-grep/napi') | null = null;

/**
 * Get or initialize ast-grep module
 * Uses dynamic import for ESM compatibility
 */
async function getSgModule() {
  if (!sgModule) {
    sgModule = await import('@ast-grep/napi');
  }
  return sgModule;
}

/**
 * Analyze a single TypeScript/JavaScript file
 *
 * @param filePath - Path to file to analyze
 * @returns File analysis with structure and metrics
 */
export async function analyzeFile(filePath: string): Promise<FileAnalysis> {
  const sg = await getSgModule();
  const content = readFileSync(filePath, 'utf-8');

  // Determine language from extension
  const ext = extname(filePath).toLowerCase();
  const lang = ext === '.tsx' ? sg.Lang.Tsx
    : ext === '.ts' ? sg.Lang.TypeScript
    : sg.Lang.JavaScript;

  const root = sg.parse(lang, content).root();

  const structure: CodeStructure = {
    functions: extractFunctions(root, filePath, content),
    classes: extractClasses(root, filePath, content),
    exports: extractExports(root, filePath),
    imports: extractImports(root, filePath),
  };

  return {
    file: filePath,
    structure,
    metrics: calculateMetrics(content, structure),
  };
}

/**
 * Analyze directory recursively
 *
 * @param dirPath - Directory path to analyze
 * @param options - Analysis options
 * @returns Array of file analyses
 */
export async function analyzeDirectory(
  dirPath: string,
  options?: { extensions?: string[]; exclude?: string[] }
): Promise<FileAnalysis[]> {
  const extensions = options?.extensions ?? ['.ts', '.tsx', '.js', '.jsx'];
  const exclude = options?.exclude ?? ['node_modules', 'dist', '.git'];

  const files = collectFiles(dirPath, extensions, exclude);
  const results: FileAnalysis[] = [];

  for (const file of files) {
    try {
      results.push(await analyzeFile(file));
    } catch {
      // Skip files that fail to parse
    }
  }

  return results;
}

/**
 * Collect files recursively from directory
 *
 * @param dir - Starting directory
 * @param extensions - File extensions to include
 * @param exclude - Directory names to exclude
 * @returns Array of file paths
 */
function collectFiles(dir: string, extensions: string[], exclude: string[]): string[] {
  const files: string[] = [];

  function walk(currentPath: string) {
    try {
      const entries = readdirSync(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentPath, entry.name);

        if (entry.isDirectory()) {
          if (!exclude.includes(entry.name)) {
            walk(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = extname(entry.name).toLowerCase();
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  const stat = statSync(dir);
  if (stat.isFile()) {
    return [dir];
  }

  walk(dir);
  return files;
}

/**
 * Extract functions using ast-grep patterns
 *
 * @param root - AST root node
 * @param filePath - Source file path
 * @param content - File content for line calculations
 * @returns Array of function information
 */
function extractFunctions(root: any, filePath: string, content: string): FunctionInfo[] {
  const functions: FunctionInfo[] = [];

  // Match all function declarations (handles TypeScript type annotations)
  const funcDecls = root.findAll('function $NAME');
  for (const match of funcDecls) {
    const name = match.getMatch('NAME')?.text() ?? 'anonymous';
    const range = match.range();
    const params = extractParams(match);

    // Check if exported by looking at parent node
    const parent = match.parent();
    const isExported = parent?.text().trim().startsWith('export') ?? false;

    // Check if async by looking at match text or parent
    const fullText = parent?.text() ?? match.text();
    const isAsync = fullText.includes('async function');

    functions.push({
      name,
      file: filePath,
      startLine: range.start.line + 1,
      endLine: range.end.line + 1,
      lineCount: range.end.line - range.start.line + 1,
      params,
      isAsync,
      isExported,
    });
  }

  // Match arrow functions (const NAME = ...)
  const arrowFuncs = root.findAll('const $NAME = $EXPR');
  for (const match of arrowFuncs) {
    const exprNode = match.getMatch('EXPR');
    if (!exprNode) continue;

    const exprText = exprNode.text();
    // Only include if it's an arrow function
    if (!exprText.includes('=>')) continue;

    const name = match.getMatch('NAME')?.text() ?? 'anonymous';
    const range = match.range();

    // Check if exported
    const parent = match.parent();
    const isExported = parent?.text().trim().startsWith('export') ?? false;

    // Check if async
    const isAsync = exprText.trim().startsWith('async');

    // Try to extract params from arrow function
    const params: string[] = [];
    const paramMatch = exprText.match(/\(([^)]*)\)/);
    if (paramMatch) {
      params.push(...paramMatch[1].split(',').map((p: string) => p.trim().split(/[:\s=]/)[0]).filter((p: string) => p.length > 0));
    }

    functions.push({
      name,
      file: filePath,
      startLine: range.start.line + 1,
      endLine: range.end.line + 1,
      lineCount: range.end.line - range.start.line + 1,
      params,
      isAsync,
      isExported,
    });
  }

  return functions;
}

/**
 * Extract parameter names from function match
 *
 * @param match - AST match node
 * @returns Array of parameter names
 */
function extractParams(match: any): string[] {
  try {
    const paramsNode = match.getMatch('PARAMS');
    if (!paramsNode) return [];

    const paramsText = paramsNode.text();
    if (!paramsText) return [];

    // Simple split on comma (not perfect but good enough)
    return paramsText
      .split(',')
      .map((p: string) => p.trim().split(/[:\s=]/)[0])
      .filter((p: string) => p.length > 0);
  } catch {
    return [];
  }
}

/**
 * Extract classes using ast-grep patterns
 *
 * @param root - AST root node
 * @param filePath - Source file path
 * @param content - File content
 * @returns Array of class information
 */
function extractClasses(root: any, filePath: string, content: string): ClassInfo[] {
  const classes: ClassInfo[] = [];

  // Match all class declarations
  const classDecls = root.findAll('class $NAME');
  for (const match of classDecls) {
    const name = match.getMatch('NAME')?.text() ?? 'Anonymous';
    const range = match.range();

    // Check if exported
    const parent = match.parent();
    const isExported = parent?.text().trim().startsWith('export') ?? false;

    // Extract methods from class body (simplified)
    const methods: string[] = [];
    const properties: string[] = [];

    // Try to find methods in the class
    try {
      const methodMatches = match.findAll('$NAME($$$)');
      for (const methodMatch of methodMatches) {
        const methodName = methodMatch.getMatch('NAME')?.text();
        if (methodName && methodName !== name) {
          methods.push(methodName);
        }
      }
    } catch {
      // Skip if method extraction fails
    }

    classes.push({
      name,
      file: filePath,
      startLine: range.start.line + 1,
      endLine: range.end.line + 1,
      lineCount: range.end.line - range.start.line + 1,
      methods,
      properties,
      isExported,
    });
  }

  return classes;
}

/**
 * Extract exports from file
 *
 * @param root - AST root node
 * @param filePath - Source file path
 * @returns Array of export information
 */
function extractExports(root: any, filePath: string): ExportInfo[] {
  const exports: ExportInfo[] = [];

  // Find all nodes and filter for export_statement kind
  function findExportStatements(node: any): any[] {
    const results: any[] = [];

    if (node.kind() === 'export_statement') {
      results.push(node);
    }

    // Recursively search children
    for (const child of node.children()) {
      results.push(...findExportStatements(child));
    }

    return results;
  }

  const exportStatements = findExportStatements(root);

  for (const exportNode of exportStatements) {
    const range = exportNode.range();
    const text = exportNode.text();

    let name = 'unknown';
    let type: ExportInfo['type'] = 'const';

    // Parse export statement to determine type and name
    if (text.includes('export function')) {
      const funcMatch = text.match(/export\s+function\s+(\w+)/);
      if (funcMatch) {
        name = funcMatch[1];
        type = 'function';
      }
    } else if (text.includes('export class')) {
      const classMatch = text.match(/export\s+class\s+(\w+)/);
      if (classMatch) {
        name = classMatch[1];
        type = 'class';
      }
    } else if (text.includes('export const')) {
      const constMatch = text.match(/export\s+const\s+(\w+)/);
      if (constMatch) {
        name = constMatch[1];
        type = 'const';
      }
    } else if (text.includes('export type')) {
      const typeMatch = text.match(/export\s+type\s+(\w+)/);
      if (typeMatch) {
        name = typeMatch[1];
        type = 'type';
      }
    } else if (text.includes('export interface')) {
      const interfaceMatch = text.match(/export\s+interface\s+(\w+)/);
      if (interfaceMatch) {
        name = interfaceMatch[1];
        type = 'interface';
      }
    } else if (text.includes('export default')) {
      name = 'default';
      type = 'default';
    } else if (text.match(/export\s*\{/)) {
      // Handle named exports
      const namesMatch = text.match(/export\s*\{\s*([^}]+)\s*\}/);
      if (namesMatch) {
        const names = namesMatch[1].split(',').map((n: string) => n.trim());
        for (const exportedName of names) {
          exports.push({
            name: exportedName,
            type: 'const',
            file: filePath,
            line: range.start.line + 1,
          });
        }
        continue;
      }
    } else if (text.includes('export *')) {
      // Re-export all
      name = '*';
      type = 'const';
    }

    exports.push({
      name,
      type,
      file: filePath,
      line: range.start.line + 1,
    });
  }

  return exports;
}

/**
 * Extract imports from file
 *
 * @param root - AST root node
 * @param filePath - Source file path
 * @returns Array of import information
 */
function extractImports(root: any, filePath: string): ImportInfo[] {
  const imports: ImportInfo[] = [];

  // Match all import statements
  const allImports = root.findAll('import $$$');
  for (const match of allImports) {
    const range = match.range();
    const text = match.text();

    // Parse the import statement
    let source = '';
    let names: string[] = [];
    let isDefault = false;

    // Extract source
    const sourceMatch = text.match(/from\s+['"]([^'"]+)['"]/);
    if (sourceMatch) {
      source = sourceMatch[1];
    } else {
      // Handle side-effect imports or type imports
      const directMatch = text.match(/import\s+['"]([^'"]+)['"]/);
      if (directMatch) {
        source = directMatch[1];
      }
    }

    // Extract names
    if (text.includes('* as')) {
      const namespaceMatch = text.match(/\*\s+as\s+(\w+)/);
      if (namespaceMatch) {
        names = [`* as ${namespaceMatch[1]}`];
      }
    } else if (text.includes('{')) {
      const namedMatch = text.match(/\{([^}]+)\}/);
      if (namedMatch) {
        names = namedMatch[1].split(',').map((n: string) => n.trim());
      }
    } else {
      const defaultMatch = text.match(/import\s+(\w+)/);
      if (defaultMatch) {
        names = [defaultMatch[1]];
        isDefault = true;
      }
    }

    if (source) {
      imports.push({
        source,
        names,
        isDefault,
        file: filePath,
        line: range.start.line + 1,
      });
    }
  }

  return imports;
}
