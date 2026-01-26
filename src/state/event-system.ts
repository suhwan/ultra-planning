/**
 * Event System - File-based event queue for inter-agent communication
 *
 * Provides append-only JSONL event queue for the orchestrator to signal events
 * to agents and track progress. Uses line-based polling for efficient reads.
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync, renameSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';
import {
  StateEvent,
  EventPollResult,
  EVENT_FILE,
  EVENT_FILE_MAX_LINES,
  STATE_DIR,
} from './types.js';

/**
 * Get absolute path to the events file
 *
 * @returns Absolute path to events.jsonl in project state directory
 */
export function getEventFilePath(): string {
  return join(process.cwd(), STATE_DIR, EVENT_FILE);
}

/**
 * Emit an event to the event queue
 *
 * Appends a JSONL line to the events file with generated UUID and timestamp.
 * Creates the state directory if it doesn't exist.
 *
 * @param event - Event data without id and timestamp
 * @returns The complete event with id and timestamp
 */
export function emitEvent(event: Omit<StateEvent, 'id' | 'timestamp'>): StateEvent {
  const fullEvent: StateEvent = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...event,
  };

  const eventPath = getEventFilePath();
  const eventDir = dirname(eventPath);

  // Ensure directory exists
  if (!existsSync(eventDir)) {
    mkdirSync(eventDir, { recursive: true });
  }

  // Append event as JSONL line
  const jsonLine = JSON.stringify(fullEvent) + '\n';
  writeFileSync(eventPath, jsonLine, { flag: 'a', encoding: 'utf-8' });

  return fullEvent;
}

/**
 * Poll events from the event queue
 *
 * Reads events from the specified line number onwards. Returns an empty
 * array if the file doesn't exist or if sinceLineNumber is beyond the end.
 *
 * @param sinceLineNumber - Line number to start reading from (0-based)
 * @returns Event poll result with events, last line, and hasMore flag
 */
export function pollEvents(sinceLineNumber: number = 0): EventPollResult {
  const eventPath = getEventFilePath();

  // Handle file not existing
  if (!existsSync(eventPath)) {
    return {
      events: [],
      lastLine: 0,
      hasMore: false,
    };
  }

  try {
    const content = readFileSync(eventPath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim() !== '');

    // If requested line is beyond the end, return empty
    if (sinceLineNumber >= lines.length) {
      return {
        events: [],
        lastLine: lines.length,
        hasMore: false,
      };
    }

    // Parse events from sinceLineNumber onwards
    const events: StateEvent[] = [];
    for (let i = sinceLineNumber; i < lines.length; i++) {
      try {
        const event = JSON.parse(lines[i]) as StateEvent;
        events.push(event);
      } catch {
        // Skip malformed lines
        continue;
      }
    }

    return {
      events,
      lastLine: lines.length,
      hasMore: false, // We read to the end of the current file
    };
  } catch (error) {
    // If read fails, return empty result
    return {
      events: [],
      lastLine: sinceLineNumber,
      hasMore: false,
    };
  }
}

/**
 * Rotate events file if it exceeds the line threshold
 *
 * Moves current events.jsonl to events.{timestamp}.jsonl and creates
 * a fresh events.jsonl file. This prevents the event file from growing
 * unbounded.
 *
 * @returns Whether rotation occurred
 */
export function rotateEventsIfNeeded(): boolean {
  const eventPath = getEventFilePath();

  // If file doesn't exist, nothing to rotate
  if (!existsSync(eventPath)) {
    return false;
  }

  try {
    const content = readFileSync(eventPath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim() !== '');

    // Check if we've exceeded the threshold
    if (lines.length <= EVENT_FILE_MAX_LINES) {
      return false;
    }

    // Create timestamped backup filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const eventDir = dirname(eventPath);
    const backupPath = join(eventDir, `events.${timestamp}.jsonl`);

    // Move current file to backup
    renameSync(eventPath, backupPath);

    // Create fresh events file (will be created on next emit)
    // No need to create empty file - emitEvent will handle it

    return true;
  } catch {
    // If rotation fails, continue with existing file
    return false;
  }
}

/**
 * Clear all events by deleting the events file
 *
 * Removes the events.jsonl file if it exists. Used for cleanup
 * or resetting event state.
 */
export function clearEvents(): void {
  const eventPath = getEventFilePath();

  if (existsSync(eventPath)) {
    unlinkSync(eventPath);
  }
}
