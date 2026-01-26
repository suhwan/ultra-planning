/**
 * Mode Registry - Execution mode tracking with mutual exclusion
 *
 * Manages execution mode states and prevents incompatible modes from running
 * simultaneously. Provides centralized mode tracking for the orchestrator.
 *
 * Based on patterns from oh-my-claudecode mode-registry.
 */

import { StateManager } from './state-manager.js';
import { StateLocation, STALE_MARKER_THRESHOLD_MS } from './types.js';
import type {
  ModeConfig,
  ModeStatus,
  CanStartResult,
  ModeStateData,
} from './types.js';
import type { ExecutionMode } from '../types.js';

// ============================================================================
// Mode Configuration
// ============================================================================

/**
 * Configuration for each execution mode
 *
 * Defines state file locations and active property names for each mode.
 */
export const MODE_CONFIGS: Partial<Record<ExecutionMode, ModeConfig>> = {
  planning: {
    name: 'Planning',
    stateFile: 'planning-state.json',
    activeProperty: 'active',
  },
  executing: {
    name: 'Executing',
    stateFile: 'execution-state.json',
    activeProperty: 'active',
  },
  verifying: {
    name: 'Verifying',
    stateFile: 'verification-state.json',
    activeProperty: 'active',
  },
  paused: {
    name: 'Paused',
    stateFile: 'paused-state.json',
    activeProperty: 'active',
  },
  error: {
    name: 'Error',
    stateFile: 'error-state.json',
    activeProperty: 'active',
  },
};

/**
 * Modes that cannot run simultaneously
 *
 * These modes are mutually exclusive - only one can be active at a time.
 * Prevents conflicts between planning and execution phases.
 */
export const EXCLUSIVE_MODES: ExecutionMode[] = [
  'planning',
  'executing',
  'verifying',
];

// ============================================================================
// Mode Status Queries
// ============================================================================

/**
 * Check if a mode is currently active
 *
 * Reads the mode's state file and checks the active property.
 * Handles stale markers (older than STALE_MARKER_THRESHOLD_MS) by
 * treating them as inactive.
 *
 * @param mode - The execution mode to check
 * @returns True if mode is active and not stale
 */
export function isModeActive(mode: ExecutionMode): boolean {
  const config = MODE_CONFIGS[mode];
  if (!config) {
    return false;
  }

  // Remove .json extension from stateFile to get name
  const stateName = config.stateFile.replace(/\.json$/, '');
  const manager = new StateManager<ModeStateData>(stateName, StateLocation.LOCAL);

  const result = manager.read();
  if (!result.exists || !result.data) {
    return false;
  }

  // Check active property (default to 'active')
  const activeProperty = config.activeProperty || 'active';
  const isActive = result.data[activeProperty as keyof ModeStateData];

  if (!isActive) {
    return false;
  }

  // Check for stale markers
  if (result.data.startedAt) {
    const startedAt = new Date(result.data.startedAt).getTime();
    const now = Date.now();
    const age = now - startedAt;

    if (age > STALE_MARKER_THRESHOLD_MS) {
      // Marker is stale, treat as inactive
      return false;
    }
  }

  return true;
}

/**
 * Check if a mode can be started
 *
 * Verifies that no conflicting exclusive modes are currently active.
 * Returns detailed result with blocking mode and message if blocked.
 *
 * @param mode - The execution mode to check
 * @returns Result indicating whether mode can start and why
 */
export function canStartMode(mode: ExecutionMode): CanStartResult {
  // If this mode is not in the exclusive list, it can always start
  if (!EXCLUSIVE_MODES.includes(mode)) {
    return {
      allowed: true,
      message: `Mode '${mode}' is not exclusive and can start`,
    };
  }

  // Check if any other exclusive mode is active
  for (const exclusiveMode of EXCLUSIVE_MODES) {
    // Skip checking the mode we want to start
    if (exclusiveMode === mode) {
      continue;
    }

    if (isModeActive(exclusiveMode)) {
      const config = MODE_CONFIGS[exclusiveMode];
      return {
        allowed: false,
        blockedBy: exclusiveMode,
        message: `Cannot start '${mode}' while '${config?.name || exclusiveMode}' is active`,
      };
    }
  }

  return {
    allowed: true,
    message: `No conflicting modes active, '${mode}' can start`,
  };
}

// ============================================================================
// Mode Lifecycle
// ============================================================================

/**
 * Start an execution mode
 *
 * Checks for conflicts, then creates state file with active flag and metadata.
 * Automatically includes timestamp and optional custom metadata.
 *
 * @param mode - The execution mode to start
 * @param metadata - Optional mode-specific metadata to store
 * @returns True if mode started successfully, false if blocked or failed
 */
export function startMode(
  mode: ExecutionMode,
  metadata?: Record<string, unknown>
): boolean {
  // Check if mode can start
  const canStart = canStartMode(mode);
  if (!canStart.allowed) {
    return false;
  }

  const config = MODE_CONFIGS[mode];
  if (!config) {
    return false;
  }

  // Create state data
  const stateData: ModeStateData = {
    active: true,
    startedAt: new Date().toISOString(),
    pid: process.pid,
    metadata,
  };

  // Write state file
  const stateName = config.stateFile.replace(/\.json$/, '');
  const manager = new StateManager<ModeStateData>(stateName, StateLocation.LOCAL);

  return manager.write(stateData).success;
}

/**
 * End an execution mode
 *
 * Deactivates the mode by either setting active to false or deleting
 * the state file entirely. Uses deletion approach for cleaner state.
 *
 * @param mode - The execution mode to end
 * @returns True if mode ended successfully
 */
export function endMode(mode: ExecutionMode): boolean {
  const config = MODE_CONFIGS[mode];
  if (!config) {
    return false;
  }

  const stateName = config.stateFile.replace(/\.json$/, '');
  const manager = new StateManager<ModeStateData>(stateName, StateLocation.LOCAL);

  // Delete state file entirely for clean shutdown
  return manager.clear();
}

// ============================================================================
// Mode Introspection
// ============================================================================

/**
 * Get all currently active modes
 *
 * Scans all configured modes and returns status objects for active ones.
 * Includes metadata and timestamps from state files.
 *
 * @returns Array of active mode status objects
 */
export function getActiveModes(): ModeStatus[] {
  const activeModes: ModeStatus[] = [];

  // Check all configured modes
  for (const [modeKey, config] of Object.entries(MODE_CONFIGS)) {
    const mode = modeKey as ExecutionMode;

    if (!isModeActive(mode)) {
      continue;
    }

    // Read full state data
    const stateName = config.stateFile.replace(/\.json$/, '');
    const manager = new StateManager<ModeStateData>(stateName, StateLocation.LOCAL);
    const result = manager.read();

    if (result.exists && result.data) {
      activeModes.push({
        mode,
        active: true,
        stateFilePath: result.foundAt || '',
        startedAt: result.data.startedAt,
        metadata: result.data.metadata,
      });
    }
  }

  return activeModes;
}

/**
 * Get configuration for a specific mode
 *
 * Returns the mode configuration including state file path and active property.
 *
 * @param mode - The execution mode to get config for
 * @returns Mode configuration or undefined if mode not configured
 */
export function getModeConfig(mode: ExecutionMode): ModeConfig | undefined {
  return MODE_CONFIGS[mode];
}
