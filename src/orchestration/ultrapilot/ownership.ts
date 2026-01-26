import type { FileOwnership, AssignmentResult, UltrapilotConfig } from './types.js';

/**
 * Default files reserved for coordinator modification only.
 * These files are shared infrastructure and should not be modified by workers.
 */
export const DEFAULT_SHARED_FILES = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'tsconfig.*.json',
  '.gitignore',
  'README.md',
  '.env',
  '.env.*',
];

/**
 * Create a new FileOwnership structure.
 * Coordinator initially owns all shared files.
 *
 * @param config - Optional configuration with custom shared files
 * @returns Initialized FileOwnership object
 */
export function createOwnership(config?: UltrapilotConfig): FileOwnership {
  const sharedFiles = [
    ...DEFAULT_SHARED_FILES,
    ...(config?.sharedFiles || []),
  ];

  return {
    coordinator: sharedFiles,
    workers: {},
    conflicts: [],
  };
}

/**
 * Assign a file to a worker.
 * Fails if file is already owned by another worker or coordinator.
 *
 * @param ownership - Current ownership state
 * @param workerId - ID of worker requesting ownership
 * @param filePath - Path to file being assigned
 * @returns Result indicating success or conflict
 */
export function assignFile(
  ownership: FileOwnership,
  workerId: string,
  filePath: string
): AssignmentResult {
  // Check if coordinator owns this file
  if (ownership.coordinator.includes(filePath)) {
    return {
      success: false,
      conflict: `File '${filePath}' is coordinator-owned (shared file)`,
    };
  }

  // Check if coordinator pattern matches (e.g., tsconfig.*.json)
  for (const pattern of ownership.coordinator) {
    if (pattern.includes('*') && matchesPattern(filePath, pattern)) {
      return {
        success: false,
        conflict: `File '${filePath}' matches coordinator pattern '${pattern}'`,
      };
    }
  }

  // Check if any other worker owns this file
  for (const [otherId, files] of Object.entries(ownership.workers)) {
    if (otherId !== workerId && files.includes(filePath)) {
      return {
        success: false,
        conflict: `File '${filePath}' already owned by worker '${otherId}'`,
      };
    }
  }

  // Assign file to worker
  if (!ownership.workers[workerId]) {
    ownership.workers[workerId] = [];
  }

  if (!ownership.workers[workerId].includes(filePath)) {
    ownership.workers[workerId].push(filePath);
  }

  return { success: true };
}

/**
 * Release a file from worker ownership.
 *
 * @param ownership - Current ownership state
 * @param workerId - ID of worker releasing file
 * @param filePath - Path to file being released
 * @returns True if file was released, false if worker didn't own it
 */
export function releaseFile(
  ownership: FileOwnership,
  workerId: string,
  filePath: string
): boolean {
  const workerFiles = ownership.workers[workerId];
  if (!workerFiles) {
    return false;
  }

  const index = workerFiles.indexOf(filePath);
  if (index === -1) {
    return false;
  }

  workerFiles.splice(index, 1);
  return true;
}

/**
 * Get the owner of a specific file.
 *
 * @param ownership - Current ownership state
 * @param filePath - Path to file
 * @returns 'coordinator', worker ID, or null if unowned
 */
export function getOwnerOf(
  ownership: FileOwnership,
  filePath: string
): string | null {
  // Check coordinator first
  if (ownership.coordinator.includes(filePath)) {
    return 'coordinator';
  }

  // Check coordinator patterns
  for (const pattern of ownership.coordinator) {
    if (pattern.includes('*') && matchesPattern(filePath, pattern)) {
      return 'coordinator';
    }
  }

  // Check workers
  for (const [workerId, files] of Object.entries(ownership.workers)) {
    if (files.includes(filePath)) {
      return workerId;
    }
  }

  return null;
}

/**
 * Check if there are any conflicts in the ownership state.
 *
 * @param ownership - Current ownership state
 * @returns True if conflicts exist
 */
export function hasConflicts(ownership: FileOwnership): boolean {
  return ownership.conflicts.length > 0;
}

/**
 * Record a conflict for a file.
 * Adds file to conflicts array if not already present.
 *
 * @param ownership - Current ownership state
 * @param filePath - Path to file with conflict
 */
export function recordConflict(
  ownership: FileOwnership,
  filePath: string
): void {
  if (!ownership.conflicts.includes(filePath)) {
    ownership.conflicts.push(filePath);
  }
}

/**
 * Simple glob pattern matching for file paths.
 * Supports * wildcard only.
 *
 * @param filePath - File path to test
 * @param pattern - Glob pattern (e.g., "tsconfig.*.json")
 * @returns True if file matches pattern
 */
function matchesPattern(filePath: string, pattern: string): boolean {
  // Convert glob pattern to regex
  // Escape special regex chars except *
  const regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filePath);
}
