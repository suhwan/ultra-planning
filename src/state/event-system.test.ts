/**
 * Event System Tests
 *
 * Tests for file-based event queue for inter-agent communication.
 * Verifies event emission, polling, and rotation functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getEventFilePath,
  emitEvent,
  pollEvents,
  rotateEventsIfNeeded,
  clearEvents,
} from './event-system.js';
import { existsSync, readFileSync, unlinkSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { STATE_DIR, EVENT_FILE, EVENT_FILE_MAX_LINES } from './types.js';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  renameSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

// Mock crypto module
vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-1234'),
}));

describe('getEventFilePath', () => {
  it('should return path to events.jsonl in state directory', () => {
    const path = getEventFilePath();
    expect(path).toContain(STATE_DIR);
    expect(path).toContain(EVENT_FILE);
    expect(path.endsWith('.jsonl')).toBe(true);
  });

  it('should return absolute path based on cwd', () => {
    const path = getEventFilePath();
    expect(path.startsWith(process.cwd())).toBe(true);
  });
});

describe('emitEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create event with generated UUID', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(writeFileSync).mockImplementation(() => {});

    const event = emitEvent({
      type: 'task_started',
      payload: { taskId: 'test-task' },
      source: 'orchestrator',
    });

    expect(event.id).toBe('test-uuid-1234');
  });

  it('should include timestamp in event', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(writeFileSync).mockImplementation(() => {});

    const before = new Date().toISOString();
    const event = emitEvent({
      type: 'task_completed',
      payload: {},
      source: 'test',
    });
    const after = new Date().toISOString();

    expect(event.timestamp).toBeDefined();
    expect(event.timestamp >= before).toBe(true);
    expect(event.timestamp <= after).toBe(true);
  });

  it('should preserve event type and payload', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(writeFileSync).mockImplementation(() => {});

    const event = emitEvent({
      type: 'plan_started',
      payload: { planId: 'plan-123', wave: 1 },
      source: 'orchestrator',
    });

    expect(event.type).toBe('plan_started');
    expect(event.payload).toEqual({ planId: 'plan-123', wave: 1 });
    expect(event.source).toBe('orchestrator');
  });

  it('should create state directory if it does not exist', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(writeFileSync).mockImplementation(() => {});
    vi.mocked(mkdirSync).mockImplementation(() => '');

    emitEvent({
      type: 'task_started',
      payload: {},
      source: 'test',
    });

    expect(mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });

  it('should append event as JSONL line', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(writeFileSync).mockImplementation(() => {});

    const event = emitEvent({
      type: 'task_failed',
      payload: { error: 'test error' },
      source: 'executor',
    });

    expect(writeFileSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining(JSON.stringify(event).slice(0, 20)),
      { flag: 'a', encoding: 'utf-8' }
    );
  });

  it('should return the complete event with all fields', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(writeFileSync).mockImplementation(() => {});

    const event = emitEvent({
      type: 'mode_changed',
      payload: { from: 'planning', to: 'executing' },
      source: 'mode-registry',
    });

    expect(event).toHaveProperty('id');
    expect(event).toHaveProperty('timestamp');
    expect(event).toHaveProperty('type');
    expect(event).toHaveProperty('payload');
    expect(event).toHaveProperty('source');
  });
});

describe('pollEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty array when file does not exist', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = pollEvents();
    expect(result.events).toEqual([]);
    expect(result.lastLine).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  it('should parse events from JSONL file', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const events = [
      { id: '1', timestamp: '2024-01-01T00:00:00Z', type: 'task_started', payload: {}, source: 'test' },
      { id: '2', timestamp: '2024-01-01T00:01:00Z', type: 'task_completed', payload: {}, source: 'test' },
    ];
    vi.mocked(readFileSync).mockReturnValue(events.map((e) => JSON.stringify(e)).join('\n'));

    const result = pollEvents();
    expect(result.events.length).toBe(2);
    expect(result.events[0].id).toBe('1');
    expect(result.events[1].id).toBe('2');
  });

  it('should return events from sinceLineNumber onwards', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const events = [
      { id: '1', timestamp: '2024-01-01T00:00:00Z', type: 'task_started', payload: {}, source: 'test' },
      { id: '2', timestamp: '2024-01-01T00:01:00Z', type: 'task_completed', payload: {}, source: 'test' },
      { id: '3', timestamp: '2024-01-01T00:02:00Z', type: 'plan_completed', payload: {}, source: 'test' },
    ];
    vi.mocked(readFileSync).mockReturnValue(events.map((e) => JSON.stringify(e)).join('\n'));

    const result = pollEvents(2);
    expect(result.events.length).toBe(1);
    expect(result.events[0].id).toBe('3');
  });

  it('should return empty array when sinceLineNumber is beyond end', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const events = [
      { id: '1', timestamp: '2024-01-01T00:00:00Z', type: 'task_started', payload: {}, source: 'test' },
    ];
    vi.mocked(readFileSync).mockReturnValue(events.map((e) => JSON.stringify(e)).join('\n'));

    const result = pollEvents(10);
    expect(result.events).toEqual([]);
    expect(result.lastLine).toBe(1);
  });

  it('should skip malformed lines', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      '{"id":"1","type":"test","payload":{},"source":"t","timestamp":"2024-01-01T00:00:00Z"}\n' +
        'not valid json\n' +
        '{"id":"2","type":"test","payload":{},"source":"t","timestamp":"2024-01-01T00:01:00Z"}'
    );

    const result = pollEvents();
    expect(result.events.length).toBe(2);
    expect(result.events[0].id).toBe('1');
    expect(result.events[1].id).toBe('2');
  });

  it('should return lastLine as total line count', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const events = [
      { id: '1', timestamp: '2024-01-01T00:00:00Z', type: 'test', payload: {}, source: 't' },
      { id: '2', timestamp: '2024-01-01T00:01:00Z', type: 'test', payload: {}, source: 't' },
    ];
    vi.mocked(readFileSync).mockReturnValue(events.map((e) => JSON.stringify(e)).join('\n'));

    const result = pollEvents();
    expect(result.lastLine).toBe(2);
  });

  it('should handle empty file', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('');

    const result = pollEvents();
    expect(result.events).toEqual([]);
    expect(result.lastLine).toBe(0);
  });

  it('should handle read errors gracefully', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('Read error');
    });

    const result = pollEvents(5);
    expect(result.events).toEqual([]);
    expect(result.lastLine).toBe(5);
    expect(result.hasMore).toBe(false);
  });
});

describe('rotateEventsIfNeeded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return false when file does not exist', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = rotateEventsIfNeeded();
    expect(result).toBe(false);
  });

  it('should return false when line count is below threshold', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const events = Array(EVENT_FILE_MAX_LINES - 1)
      .fill(null)
      .map((_, i) => ({ id: String(i), type: 'test', payload: {}, source: 't', timestamp: '2024-01-01' }));
    vi.mocked(readFileSync).mockReturnValue(events.map((e) => JSON.stringify(e)).join('\n'));

    const result = rotateEventsIfNeeded();
    expect(result).toBe(false);
  });

  it('should rotate when line count exceeds threshold', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const events = Array(EVENT_FILE_MAX_LINES + 10)
      .fill(null)
      .map((_, i) => ({ id: String(i), type: 'test', payload: {}, source: 't', timestamp: '2024-01-01' }));
    vi.mocked(readFileSync).mockReturnValue(events.map((e) => JSON.stringify(e)).join('\n'));

    const result = rotateEventsIfNeeded();
    expect(result).toBe(true);
  });

  it('should handle rotation errors gracefully', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('Read error');
    });

    const result = rotateEventsIfNeeded();
    expect(result).toBe(false);
  });
});

describe('clearEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete events file if it exists', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(unlinkSync).mockImplementation(() => {});

    clearEvents();

    expect(unlinkSync).toHaveBeenCalledWith(expect.stringContaining(EVENT_FILE));
  });

  it('should do nothing if file does not exist', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    clearEvents();

    expect(unlinkSync).not.toHaveBeenCalled();
  });

  it('should not throw when file does not exist', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    expect(() => clearEvents()).not.toThrow();
  });
});

describe('Event Types', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(writeFileSync).mockImplementation(() => {});
  });

  it('should support plan lifecycle events', () => {
    const planEvents = ['plan_started', 'plan_completed', 'plan_failed'] as const;
    for (const type of planEvents) {
      const event = emitEvent({ type, payload: {}, source: 'test' });
      expect(event.type).toBe(type);
    }
  });

  it('should support task lifecycle events', () => {
    const taskEvents = ['task_started', 'task_completed', 'task_failed'] as const;
    for (const type of taskEvents) {
      const event = emitEvent({ type, payload: {}, source: 'test' });
      expect(event.type).toBe(type);
    }
  });

  it('should support checkpoint events', () => {
    const event = emitEvent({
      type: 'checkpoint_created',
      payload: { checkpointId: 'cp-123' },
      source: 'checkpoint-manager',
    });
    expect(event.type).toBe('checkpoint_created');
  });

  it('should support mode change events', () => {
    const event = emitEvent({
      type: 'mode_changed',
      payload: { from: 'idle', to: 'planning' },
      source: 'mode-registry',
    });
    expect(event.type).toBe('mode_changed');
  });

  it('should support ralph loop events', () => {
    const ralphEvents = [
      'ralph_loop_started',
      'ralph_loop_iteration',
      'ralph_loop_completed',
      'ralph_loop_failed',
    ] as const;
    for (const type of ralphEvents) {
      const event = emitEvent({ type, payload: {}, source: 'test' });
      expect(event.type).toBe(type);
    }
  });
});
