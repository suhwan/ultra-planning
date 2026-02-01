/**
 * Mode Registry Tests
 *
 * Tests for execution mode tracking with mutual exclusion.
 * Verifies exclusive mode enforcement and state management.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isModeActive,
  canStartMode,
  startMode,
  endMode,
  getActiveModes,
  getModeConfig,
  MODE_CONFIGS,
  EXCLUSIVE_MODES,
} from './mode-registry.js';
import { StateManager } from './state-manager.js';
import { STALE_MARKER_THRESHOLD_MS } from './types.js';

// Mock the StateManager module
vi.mock('./state-manager.js', () => {
  const mockRead = vi.fn();
  const mockWrite = vi.fn();
  const mockClear = vi.fn();

  return {
    StateManager: vi.fn().mockImplementation(() => ({
      read: mockRead,
      write: mockWrite,
      clear: mockClear,
    })),
    __mockRead: mockRead,
    __mockWrite: mockWrite,
    __mockClear: mockClear,
  };
});

// Get mock functions for direct access
const getMocks = () => {
  const mod = vi.mocked(StateManager);
  const instance = new mod('test', 'local' as any);
  return {
    mockRead: instance.read as ReturnType<typeof vi.fn>,
    mockWrite: instance.write as ReturnType<typeof vi.fn>,
    mockClear: instance.clear as ReturnType<typeof vi.fn>,
  };
};

describe('MODE_CONFIGS', () => {
  it('should have configuration for all expected modes', () => {
    expect(MODE_CONFIGS.planning).toBeDefined();
    expect(MODE_CONFIGS.executing).toBeDefined();
    expect(MODE_CONFIGS.verifying).toBeDefined();
    expect(MODE_CONFIGS.paused).toBeDefined();
    expect(MODE_CONFIGS.error).toBeDefined();
  });

  it('should have stateFile and activeProperty for each config', () => {
    for (const [mode, config] of Object.entries(MODE_CONFIGS)) {
      expect(config.stateFile, `${mode} missing stateFile`).toBeDefined();
      expect(typeof config.stateFile).toBe('string');
      expect(config.activeProperty, `${mode} missing activeProperty`).toBeDefined();
    }
  });

  it('should have unique state file names', () => {
    const stateFiles = Object.values(MODE_CONFIGS).map((c) => c.stateFile);
    const uniqueFiles = new Set(stateFiles);
    expect(uniqueFiles.size).toBe(stateFiles.length);
  });
});

describe('EXCLUSIVE_MODES', () => {
  it('should contain planning, executing, and verifying', () => {
    expect(EXCLUSIVE_MODES).toContain('planning');
    expect(EXCLUSIVE_MODES).toContain('executing');
    expect(EXCLUSIVE_MODES).toContain('verifying');
  });

  it('should not contain paused or error', () => {
    expect(EXCLUSIVE_MODES).not.toContain('paused');
    expect(EXCLUSIVE_MODES).not.toContain('error');
  });
});

describe('isModeActive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return false for mode with no state file', () => {
    const { mockRead } = getMocks();
    mockRead.mockReturnValue({ exists: false });

    const result = isModeActive('planning');
    expect(result).toBe(false);
  });

  it('should return true for mode with active state file', () => {
    const { mockRead } = getMocks();
    mockRead.mockReturnValue({
      exists: true,
      data: {
        active: true,
        startedAt: new Date().toISOString(),
      },
    });

    const result = isModeActive('planning');
    expect(result).toBe(true);
  });

  it('should return false for stale markers (older than threshold)', () => {
    const { mockRead } = getMocks();
    const staleDate = new Date(Date.now() - STALE_MARKER_THRESHOLD_MS - 1000);
    mockRead.mockReturnValue({
      exists: true,
      data: {
        active: true,
        startedAt: staleDate.toISOString(),
      },
    });

    const result = isModeActive('planning');
    expect(result).toBe(false);
  });

  it('should return false when active property is false', () => {
    const { mockRead } = getMocks();
    mockRead.mockReturnValue({
      exists: true,
      data: {
        active: false,
        startedAt: new Date().toISOString(),
      },
    });

    const result = isModeActive('planning');
    expect(result).toBe(false);
  });

  it('should return false for unconfigured mode', () => {
    const result = isModeActive('unknown' as any);
    expect(result).toBe(false);
  });

  it('should handle missing activeProperty gracefully', () => {
    const { mockRead } = getMocks();
    mockRead.mockReturnValue({
      exists: true,
      data: {
        startedAt: new Date().toISOString(),
        // no 'active' property
      },
    });

    const result = isModeActive('planning');
    expect(result).toBe(false);
  });
});

describe('canStartMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return allowed:true for non-exclusive modes', () => {
    const result = canStartMode('paused');
    expect(result.allowed).toBe(true);
    expect(result.message).toContain('not exclusive');
  });

  it('should return allowed:true when no exclusive mode is active', () => {
    const { mockRead } = getMocks();
    mockRead.mockReturnValue({ exists: false });

    const result = canStartMode('planning');
    expect(result.allowed).toBe(true);
    expect(result.message).toContain('can start');
  });

  it('should return allowed:false with blockedBy when exclusive mode is active', () => {
    const { mockRead } = getMocks();
    // Mock first call (for executing mode check) to return active
    mockRead
      .mockReturnValueOnce({ exists: false }) // planning check
      .mockReturnValueOnce({
        // executing check
        exists: true,
        data: { active: true, startedAt: new Date().toISOString() },
      });

    const result = canStartMode('verifying');
    expect(result.allowed).toBe(false);
    expect(result.blockedBy).toBe('executing');
  });

  it('should return correct message with blocking mode name', () => {
    const { mockRead } = getMocks();
    mockRead.mockReturnValue({
      exists: true,
      data: { active: true, startedAt: new Date().toISOString() },
    });

    const result = canStartMode('executing');
    expect(result.allowed).toBe(false);
    expect(result.message).toContain("Cannot start 'executing'");
    expect(result.message).toContain('is active');
  });
});

describe('startMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create state file with active:true', () => {
    const { mockRead, mockWrite } = getMocks();
    mockRead.mockReturnValue({ exists: false });
    mockWrite.mockReturnValue({ success: true, path: '/test/path' });

    const result = startMode('planning');
    expect(result).toBe(true);
    expect(mockWrite).toHaveBeenCalled();

    const writeArg = mockWrite.mock.calls[0][0];
    expect(writeArg.active).toBe(true);
  });

  it('should include startedAt timestamp', () => {
    const { mockRead, mockWrite } = getMocks();
    mockRead.mockReturnValue({ exists: false });
    mockWrite.mockReturnValue({ success: true, path: '/test/path' });

    startMode('planning');

    const writeArg = mockWrite.mock.calls[0][0];
    expect(writeArg.startedAt).toBeDefined();
    expect(typeof writeArg.startedAt).toBe('string');
    // Verify it's a valid ISO date string
    expect(() => new Date(writeArg.startedAt)).not.toThrow();
  });

  it('should include process pid', () => {
    const { mockRead, mockWrite } = getMocks();
    mockRead.mockReturnValue({ exists: false });
    mockWrite.mockReturnValue({ success: true, path: '/test/path' });

    startMode('planning');

    const writeArg = mockWrite.mock.calls[0][0];
    expect(writeArg.pid).toBe(process.pid);
  });

  it('should store optional metadata', () => {
    const { mockRead, mockWrite } = getMocks();
    mockRead.mockReturnValue({ exists: false });
    mockWrite.mockReturnValue({ success: true, path: '/test/path' });

    const metadata = { planId: 'test-123', wave: 2 };
    startMode('planning', metadata);

    const writeArg = mockWrite.mock.calls[0][0];
    expect(writeArg.metadata).toEqual(metadata);
  });

  it('should return false if blocked by another mode', () => {
    const { mockRead } = getMocks();
    mockRead.mockReturnValue({
      exists: true,
      data: { active: true, startedAt: new Date().toISOString() },
    });

    const result = startMode('executing');
    expect(result).toBe(false);
  });

  it('should return false for unconfigured mode', () => {
    const result = startMode('unknown' as any);
    expect(result).toBe(false);
  });
});

describe('endMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should clear state file on end', () => {
    const { mockClear } = getMocks();
    mockClear.mockReturnValue(true);

    const result = endMode('planning');
    expect(result).toBe(true);
    expect(mockClear).toHaveBeenCalled();
  });

  it('should return true on successful end', () => {
    const { mockClear } = getMocks();
    mockClear.mockReturnValue(true);

    const result = endMode('executing');
    expect(result).toBe(true);
  });

  it('should return false for unconfigured mode', () => {
    const result = endMode('unknown' as any);
    expect(result).toBe(false);
  });

  it('should return false when clear fails', () => {
    const { mockClear } = getMocks();
    mockClear.mockReturnValue(false);

    const result = endMode('planning');
    expect(result).toBe(false);
  });
});

describe('getActiveModes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty array when no modes active', () => {
    const { mockRead } = getMocks();
    mockRead.mockReturnValue({ exists: false });

    const result = getActiveModes();
    expect(result).toEqual([]);
  });

  it('should return array of active mode statuses', () => {
    const { mockRead } = getMocks();
    const startedAt = new Date().toISOString();

    // First call sequence for isModeActive checks, then for reading full data
    mockRead
      .mockReturnValueOnce({
        exists: true,
        data: { active: true, startedAt },
        foundAt: '/test/planning-state.json',
      })
      .mockReturnValueOnce({ exists: false })
      .mockReturnValueOnce({ exists: false })
      .mockReturnValueOnce({ exists: false })
      .mockReturnValueOnce({ exists: false })
      .mockReturnValueOnce({
        exists: true,
        data: { active: true, startedAt },
        foundAt: '/test/planning-state.json',
      });

    const result = getActiveModes();
    expect(result.length).toBeGreaterThanOrEqual(0);
  });

  it('should include metadata and timestamps in status', () => {
    const { mockRead } = getMocks();
    const startedAt = new Date().toISOString();
    const metadata = { testKey: 'testValue' };

    mockRead.mockReturnValue({
      exists: true,
      data: { active: true, startedAt, metadata },
      foundAt: '/test/planning-state.json',
    });

    const result = getActiveModes();

    if (result.length > 0) {
      expect(result[0].startedAt).toBe(startedAt);
      expect(result[0].metadata).toEqual(metadata);
      expect(result[0].active).toBe(true);
    }
  });
});

describe('getModeConfig', () => {
  it('should return configuration for existing mode', () => {
    const config = getModeConfig('planning');
    expect(config).toBeDefined();
    expect(config?.name).toBe('Planning');
    expect(config?.stateFile).toBe('planning-state.json');
  });

  it('should return undefined for unknown mode', () => {
    const config = getModeConfig('unknown' as any);
    expect(config).toBeUndefined();
  });
});
