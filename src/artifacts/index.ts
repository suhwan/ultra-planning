/**
 * Artifact Reference System
 *
 * Barrel export for artifact types and utilities.
 */

// Types
export type {
  ArtifactType,
  ArtifactSummary,
  ArtifactReference,
  ArtifactCollection,
  ArtifactLoadingInstruction,
} from './types.js';

// Utilities
export {
  inferArtifactType,
  summarizeFile,
  createArtifactReference,
  formatArtifactReference,
  formatArtifactList,
  formatArtifactCollection,
  createProjectArtifacts,
} from './reference.js';
