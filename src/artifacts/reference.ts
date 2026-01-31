/**
 * Artifact Reference Utilities
 *
 * Functions for creating and formatting artifact references.
 */

import { readFileSync, statSync } from 'node:fs';
import { extname, relative } from 'node:path';
import type {
  ArtifactType,
  ArtifactSummary,
  ArtifactReference,
  ArtifactCollection,
} from './types.js';

/** Infer artifact type from file path */
export function inferArtifactType(filePath: string): ArtifactType {
  const ext = extname(filePath).toLowerCase();
  const basename = filePath.toLowerCase();

  // Documentation
  if (basename.includes('readme') || basename.includes('.md')) {
    return 'documentation';
  }

  // Plans
  if (filePath.includes('/plans/') || filePath.includes('/.omc/')) {
    return 'plan';
  }

  // Tests
  if (basename.includes('.test.') || basename.includes('.spec.') || filePath.includes('/test/')) {
    return 'test';
  }

  // Config
  if (['.json', '.yaml', '.yml', '.toml', '.ini', '.env'].includes(ext)) {
    return 'config';
  }

  // Schema/Types
  if (basename.includes('types.ts') || basename.includes('schema') || basename.includes('interface')) {
    return 'schema';
  }

  // Source code
  if (['.ts', '.js', '.tsx', '.jsx', '.py', '.go', '.rs', '.java'].includes(ext)) {
    return 'source';
  }

  // Data
  if (['.json', '.csv', '.xml', '.sql'].includes(ext)) {
    return 'data';
  }

  // Build outputs
  if (filePath.includes('/dist/') || filePath.includes('/build/') || ext === '.map') {
    return 'build';
  }

  return 'other';
}

/** Extract exports from a source file (basic heuristic) */
function extractExports(content: string, type: ArtifactType): string[] | undefined {
  if (type !== 'source' && type !== 'schema') {
    return undefined;
  }

  const exports: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // TypeScript/JavaScript exports
    const exportMatch = line.match(/export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/);
    if (exportMatch) {
      exports.push(exportMatch[1]);
    }

    // Default exports
    if (line.match(/export\s+default/)) {
      exports.push('default');
    }
  }

  return exports.length > 0 ? exports : undefined;
}

/** Create a summary of a file */
export function summarizeFile(
  filePath: string,
  projectRoot: string,
  description?: string
): ArtifactSummary {
  const relativePath = relative(projectRoot, filePath);
  const type = inferArtifactType(relativePath);

  let stats;
  try {
    stats = statSync(filePath);
  } catch {
    // File doesn't exist or not accessible
    return {
      path: relativePath,
      type,
      description: description || `File: ${relativePath}`,
    };
  }

  let content: string | undefined;
  let exports: string[] | undefined;

  // Read file for export extraction (only for small source files)
  if ((type === 'source' || type === 'schema') && stats.size < 100000) {
    try {
      content = readFileSync(filePath, 'utf-8');
      exports = extractExports(content, type);
    } catch {
      // Ignore read errors
    }
  }

  return {
    path: relativePath,
    type,
    description: description || `${type}: ${relativePath}`,
    exports,
    size: stats.size,
    modified: stats.mtime.toISOString(),
  };
}

/** Create an artifact reference with loading instruction */
export function createArtifactReference(
  summary: ArtifactSummary,
  customInstruction?: string
): ArtifactReference {
  const defaultInstruction = customInstruction || generateDefaultInstruction(summary);

  return {
    summary,
    instruction: defaultInstruction,
  };
}

/** Generate default loading instruction based on artifact type */
function generateDefaultInstruction(summary: ArtifactSummary): string {
  const { path, type } = summary;

  switch (type) {
    case 'source':
    case 'schema':
      return `Read ${path} when you need to understand implementation details or modify code.`;

    case 'config':
      return `Read ${path} if you need to check or modify configuration.`;

    case 'documentation':
      return `Read ${path} for context about project structure and guidelines.`;

    case 'plan':
      return `Read ${path} to understand requirements and verification criteria.`;

    case 'test':
      return `Read ${path} to understand test coverage and expectations.`;

    case 'data':
      return `Read ${path} if you need to access or analyze this data.`;

    default:
      return `Read ${path} on demand.`;
  }
}

/** Format a single artifact reference for display */
export function formatArtifactReference(ref: ArtifactReference): string {
  const { summary, instruction } = ref;
  const exportsInfo = summary.exports ? ` (exports: ${summary.exports.join(', ')})` : '';

  return `- **${summary.path}** [${summary.type}]${exportsInfo}\n  ${instruction}`;
}

/** Format a list of artifact references */
export function formatArtifactList(refs: ArtifactReference[]): string {
  if (refs.length === 0) {
    return 'No artifacts available.';
  }

  return refs.map(formatArtifactReference).join('\n\n');
}

/** Format an artifact collection */
export function formatArtifactCollection(collection: ArtifactCollection): string {
  const header = `## ${collection.name}\n\n${collection.description}\n`;
  const artifacts = formatArtifactList(collection.artifacts);

  return `${header}\n${artifacts}`;
}

/** Create artifact references for common project files */
export function createProjectArtifacts(projectRoot: string): ArtifactCollection[] {
  const collections: ArtifactCollection[] = [];

  // Configuration collection
  const configArtifacts: ArtifactReference[] = [
    createArtifactReference(
      summarizeFile(`${projectRoot}/package.json`, projectRoot, 'Project dependencies and scripts')
    ),
    createArtifactReference(
      summarizeFile(`${projectRoot}/tsconfig.json`, projectRoot, 'TypeScript configuration')
    ),
  ];

  collections.push({
    name: 'Project Configuration',
    description: 'Core configuration files',
    artifacts: configArtifacts,
  });

  // Documentation collection
  const docArtifacts: ArtifactReference[] = [
    createArtifactReference(
      summarizeFile(`${projectRoot}/README.md`, projectRoot, 'Project overview and usage')
    ),
  ];

  collections.push({
    name: 'Documentation',
    description: 'Project documentation and guides',
    artifacts: docArtifacts,
  });

  return collections;
}
