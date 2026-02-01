/**
 * SessionWisdomLoader - Session-level memory initialization
 *
 * Loads wisdom at session start, caching context for the session duration.
 * Initializes both long-term and short-term memory layers.
 */

import { LongTermMemoryManager } from './long-term.js';
import { ShortTermMemoryManager } from './short-term.js';
import { LongTermMemory, ShortTermMemory, MemoryConfig, DEFAULT_MEMORY_CONFIG } from './types.js';

export interface SessionContext {
  sessionId: string;
  startTime: string;  // ISO timestamp
  longTermMemory: LongTermMemory | null;
  shortTermMemory: ShortTermMemory | null;
  loaded: boolean;
}

export class SessionWisdomLoader {
  private config: MemoryConfig;
  private longTermManager: LongTermMemoryManager;
  private shortTermManager: ShortTermMemoryManager;
  private sessionContext: SessionContext | null = null;

  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    this.longTermManager = new LongTermMemoryManager(this.config);
    this.shortTermManager = new ShortTermMemoryManager(this.config);
  }

  /**
   * Initialize session and load all persistent memory
   * Call this at orchestrator startup
   */
  initSession(): SessionContext {
    const sessionId = this.generateSessionId();

    // Ensure wisdom directory exists
    this.longTermManager.initWisdomDir();

    // Load both memory layers
    const longTermMemory = this.longTermManager.loadWisdom();
    const shortTermMemory = this.shortTermManager.loadFromState();

    this.sessionContext = {
      sessionId,
      startTime: new Date().toISOString(),
      longTermMemory,
      shortTermMemory,
      loaded: true,
    };

    return this.sessionContext;
  }

  /**
   * Get current session context
   * Returns null if initSession() not called
   */
  getSessionContext(): SessionContext | null {
    return this.sessionContext;
  }

  /**
   * Refresh long-term memory (e.g., after wisdom collection)
   */
  refreshLongTermMemory(): LongTermMemory | null {
    const longTermMemory = this.longTermManager.loadWisdom();
    if (this.sessionContext) {
      this.sessionContext.longTermMemory = longTermMemory;
    }
    return longTermMemory;
  }

  /**
   * Get wisdom summary for quick status check
   */
  getWisdomStats(): { learnings: number; decisions: number; issues: number; patterns: number } | null {
    if (!this.sessionContext?.longTermMemory) {
      return null;
    }
    const mem = this.sessionContext.longTermMemory;
    return {
      learnings: mem.learnings.length,
      decisions: mem.decisions.length,
      issues: mem.issues.length,
      patterns: mem.patterns.length,
    };
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
