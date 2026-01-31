/**
 * Artifact Reference Types
 *
 * Types for managing artifact references in context messages.
 * Enables efficient artifact loading without embedding full file contents.
 */

/** Artifact type classification */
export type ArtifactType =
  | 'source'        // Source code files
  | 'config'        // Configuration files
  | 'schema'        // Type definitions, interfaces, schemas
  | 'documentation' // README, docs, guides
  | 'plan'          // Planning documents
  | 'data'          // JSON, CSV, etc.
  | 'test'          // Test files
  | 'build'         // Build outputs, artifacts
  | 'other';        // Unknown/misc

/** Minimal artifact summary for quick understanding */
export interface ArtifactSummary {
  /** File path relative to project root */
  path: string;

  /** Artifact type classification */
  type: ArtifactType;

  /** One-line description of what this artifact provides */
  description: string;

  /** Optional: key exports, functions, classes */
  exports?: string[];

  /** Optional: file size in bytes */
  size?: number;

  /** Optional: last modified timestamp */
  modified?: string;
}

/** Artifact reference for context messages */
export interface ArtifactReference {
  /** Summary information */
  summary: ArtifactSummary;

  /** Loading instruction for the agent */
  instruction: string;
}

/** Collection of related artifacts */
export interface ArtifactCollection {
  /** Collection name/category */
  name: string;

  /** Collection description */
  description: string;

  /** Artifact references in this collection */
  artifacts: ArtifactReference[];
}

/** Loading instruction template */
export interface ArtifactLoadingInstruction {
  /** When to load this artifact */
  trigger: 'on_demand' | 'if_needed' | 'preload';

  /** How to use this artifact */
  usage: string;

  /** Optional: specific tool to use for loading */
  tool?: 'Read' | 'Grep' | 'Glob';
}
