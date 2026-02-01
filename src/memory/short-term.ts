/**
 * ShortTermMemoryManager - Session and project state
 *
 * Reads from STATE.md and session files to maintain project-level memory.
 * Syncs with the state management system for persistence.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ShortTermMemory, MemoryLayer, MemoryConfig, DEFAULT_MEMORY_CONFIG } from './types.js';
import { StateManager } from '../state/state-manager.js';
import { StateLocation } from '../state/types.js';

/** Session state structure for StateManager */
interface SessionState extends Record<string, unknown> {
  sessionId: string;
  decisions: string[];
  pendingTodos: string[];
  blockers: string[];
  phaseProgress: {
    phase: number;
    plan: number;
    status: string;
  };
  lastUpdated: string;
}

/**
 * Manages short-term memory (session and project state)
 *
 * Short-term memory persists across task executions within a session.
 * It reads from STATE.md and session state files.
 */
export class ShortTermMemoryManager {
  private readonly config: MemoryConfig;
  private readonly stateManager: StateManager<SessionState>;
  private memory: ShortTermMemory | null = null;

  /**
   * Create a new ShortTermMemoryManager
   *
   * @param config - Optional partial config to override defaults
   */
  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    this.stateManager = new StateManager<SessionState>('session', StateLocation.LOCAL);
  }

  /**
   * Load short-term memory from STATE.md and session files
   *
   * @returns Loaded short-term memory
   */
  loadFromState(): ShortTermMemory {
    // Try to load existing session state
    const stateResult = this.stateManager.read();

    if (stateResult.exists && stateResult.data) {
      this.memory = {
        layer: MemoryLayer.ShortTerm,
        sessionId: stateResult.data.sessionId,
        decisions: stateResult.data.decisions,
        pendingTodos: stateResult.data.pendingTodos,
        blockers: stateResult.data.blockers,
        phaseProgress: stateResult.data.phaseProgress,
      };
    } else {
      // Initialize new session
      this.memory = this.createNewSession();
      this.saveSession();
    }

    // Merge with STATE.md if it exists
    this.mergeStateFile();

    return { ...this.memory };
  }

  /**
   * Update phase progress
   *
   * @param phase - Phase number
   * @param plan - Plan number within phase
   * @param status - Current status string
   */
  updateProgress(phase: number, plan: number, status: string): void {
    if (!this.memory) {
      this.loadFromState();
    }

    if (this.memory) {
      this.memory.phaseProgress = { phase, plan, status };
      this.saveSession();
    }
  }

  /**
   * Add a decision to short-term memory
   *
   * @param decision - Decision string to add
   */
  addDecision(decision: string): void {
    if (!this.memory) {
      this.loadFromState();
    }

    if (this.memory) {
      this.memory.decisions.push(decision);
      this.saveSession();
    }
  }

  /**
   * Add a pending todo item
   *
   * @param todo - Todo item string
   */
  addTodo(todo: string): void {
    if (!this.memory) {
      this.loadFromState();
    }

    if (this.memory) {
      this.memory.pendingTodos.push(todo);
      this.saveSession();
    }
  }

  /**
   * Remove a completed todo item
   *
   * @param todo - Todo item to remove
   * @returns true if todo was found and removed
   */
  completeTodo(todo: string): boolean {
    if (!this.memory) {
      this.loadFromState();
    }

    if (this.memory) {
      const index = this.memory.pendingTodos.indexOf(todo);
      if (index !== -1) {
        this.memory.pendingTodos.splice(index, 1);
        this.saveSession();
        return true;
      }
    }
    return false;
  }

  /**
   * Add a blocker
   *
   * @param blocker - Blocker description
   */
  addBlocker(blocker: string): void {
    if (!this.memory) {
      this.loadFromState();
    }

    if (this.memory) {
      this.memory.blockers.push(blocker);
      this.saveSession();
    }
  }

  /**
   * Remove a resolved blocker
   *
   * @param blocker - Blocker to remove
   * @returns true if blocker was found and removed
   */
  resolveBlocker(blocker: string): boolean {
    if (!this.memory) {
      this.loadFromState();
    }

    if (this.memory) {
      const index = this.memory.blockers.indexOf(blocker);
      if (index !== -1) {
        this.memory.blockers.splice(index, 1);
        this.saveSession();
        return true;
      }
    }
    return false;
  }

  /**
   * Get current short-term memory
   *
   * @returns Current memory or null if not loaded
   */
  getMemory(): ShortTermMemory | null {
    return this.memory ? { ...this.memory } : null;
  }

  /**
   * Get session ID
   *
   * @returns Current session ID or null
   */
  getSessionId(): string | null {
    return this.memory?.sessionId ?? null;
  }

  /**
   * Clear short-term memory and session state
   */
  clear(): void {
    this.memory = null;
    this.stateManager.clear();
  }

  /**
   * Create a new session with default values
   *
   * @private
   * @returns New ShortTermMemory instance
   */
  private createNewSession(): ShortTermMemory {
    return {
      layer: MemoryLayer.ShortTerm,
      sessionId: this.generateSessionId(),
      decisions: [],
      pendingTodos: [],
      blockers: [],
      phaseProgress: {
        phase: 0,
        plan: 0,
        status: 'initialized',
      },
    };
  }

  /**
   * Generate a unique session ID
   *
   * @private
   * @returns Session ID string
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `session-${timestamp}-${random}`;
  }

  /**
   * Save current session to state file
   *
   * @private
   */
  private saveSession(): void {
    if (!this.memory) return;

    const state: SessionState = {
      sessionId: this.memory.sessionId,
      decisions: this.memory.decisions,
      pendingTodos: this.memory.pendingTodos,
      blockers: this.memory.blockers,
      phaseProgress: this.memory.phaseProgress,
      lastUpdated: new Date().toISOString(),
    };

    this.stateManager.write(state);
  }

  /**
   * Merge STATE.md content into memory if it exists
   *
   * @private
   */
  private mergeStateFile(): void {
    const statePath = join(this.config.baseDir, 'STATE.md');

    if (!existsSync(statePath) || !this.memory) {
      return;
    }

    try {
      const content = readFileSync(statePath, 'utf-8');

      // Parse phase progress from STATE.md
      const phaseMatch = content.match(/## Phase (\d+)/);
      const planMatch = content.match(/### Plan (\d+)/);
      const statusMatch = content.match(/Status:\s*(.+)/);

      if (phaseMatch) {
        this.memory.phaseProgress.phase = parseInt(phaseMatch[1], 10);
      }
      if (planMatch) {
        this.memory.phaseProgress.plan = parseInt(planMatch[1], 10);
      }
      if (statusMatch) {
        this.memory.phaseProgress.status = statusMatch[1].trim();
      }

      // Extract decisions from STATE.md
      const decisionsMatch = content.match(/## Decisions\n([\s\S]*?)(?=\n##|$)/);
      if (decisionsMatch) {
        const decisions = decisionsMatch[1]
          .split('\n')
          .filter(line => line.startsWith('- '))
          .map(line => line.slice(2).trim());

        // Merge without duplicates
        for (const decision of decisions) {
          if (!this.memory.decisions.includes(decision)) {
            this.memory.decisions.push(decision);
          }
        }
      }

      // Extract blockers from STATE.md
      const blockersMatch = content.match(/## Blockers\n([\s\S]*?)(?=\n##|$)/);
      if (blockersMatch) {
        const blockers = blockersMatch[1]
          .split('\n')
          .filter(line => line.startsWith('- '))
          .map(line => line.slice(2).trim());

        for (const blocker of blockers) {
          if (!this.memory.blockers.includes(blocker)) {
            this.memory.blockers.push(blocker);
          }
        }
      }
    } catch {
      // Silently ignore parse errors
    }
  }
}
