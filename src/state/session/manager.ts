/**
 * Session Manager
 *
 * Manages session lifecycle and isolation.
 */

import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';

import {
  SessionId,
  SessionState,
  SessionResult,
  SessionIsolationRules,
  DEFAULT_SESSION_RULES,
  SESSION_STATE_DIR,
} from './types.js';
import type { ExecutionMode } from '../../types.js';
import type { AgentRole } from '../../agents/types.js';

// ============================================================================
// Session Manager Class
// ============================================================================

export class SessionManager {
  private baseDir: string;

  constructor(projectRoot: string = process.cwd()) {
    this.baseDir = join(projectRoot, SESSION_STATE_DIR);
  }

  // ============================================================================
  // Session Lifecycle
  // ============================================================================

  /**
   * Create a new session
   */
  createSession(options: {
    name?: string;
    parentSessionId?: string;
    mode?: ExecutionMode;
    agentRole?: AgentRole;
    activePlan?: string;
  } = {}): SessionState {
    const sessionId: SessionId = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      parentSessionId: options.parentSessionId,
      name: options.name,
    };

    const now = new Date().toISOString();

    const session: SessionState = {
      sessionId,
      mode: options.mode || 'idle',
      activePlan: options.activePlan,
      claimedTasks: [],
      agentRole: options.agentRole,
      startedAt: now,
      lastActivityAt: now,
    };

    this.saveSession(session);
    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): SessionState | null {
    const sessionPath = this.getSessionPath(sessionId);
    if (!existsSync(sessionPath)) {
      return null;
    }

    try {
      const data = readFileSync(sessionPath, 'utf-8');
      return JSON.parse(data) as SessionState;
    } catch {
      return null;
    }
  }

  /**
   * Update session state
   */
  updateSession(sessionId: string, updates: Partial<SessionState>): SessionState | null {
    const session = this.getSession(sessionId);
    if (!session) {
      return null;
    }

    const updated: SessionState = {
      ...session,
      ...updates,
      lastActivityAt: new Date().toISOString(),
    };

    this.saveSession(updated);
    return updated;
  }

  /**
   * Complete a session
   */
  completeSession(
    sessionId: string,
    result: Omit<SessionResult, 'sessionId' | 'completedAt' | 'durationMs'>
  ): SessionResult | null {
    const session = this.getSession(sessionId);
    if (!session) {
      return null;
    }

    const completedAt = new Date().toISOString();
    const durationMs = new Date(completedAt).getTime() - new Date(session.startedAt).getTime();

    const sessionResult: SessionResult = {
      sessionId,
      completedAt,
      durationMs,
      ...result,
    };

    // Save result
    const resultPath = this.getSessionResultPath(sessionId);
    this.ensureDir(dirname(resultPath));
    writeFileSync(resultPath, JSON.stringify(sessionResult, null, 2));

    // Clean up session state
    this.deleteSession(sessionId);

    return sessionResult;
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    const sessionPath = this.getSessionPath(sessionId);
    if (existsSync(sessionPath)) {
      unlinkSync(sessionPath);
      return true;
    }
    return false;
  }

  // ============================================================================
  // Task Claiming
  // ============================================================================

  /**
   * Claim a task for a session
   */
  claimTask(sessionId: string, taskId: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) {
      return false;
    }

    if (session.claimedTasks.includes(taskId)) {
      return true; // Already claimed
    }

    // Check if task is claimed by another session
    const allSessions = this.listActiveSessions();
    for (const other of allSessions) {
      if (other.sessionId.id !== sessionId && other.claimedTasks.includes(taskId)) {
        return false; // Already claimed by another session
      }
    }

    session.claimedTasks.push(taskId);
    this.saveSession(session);
    return true;
  }

  /**
   * Release a task from a session
   */
  releaseTask(sessionId: string, taskId: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) {
      return false;
    }

    const index = session.claimedTasks.indexOf(taskId);
    if (index === -1) {
      return false;
    }

    session.claimedTasks.splice(index, 1);
    this.saveSession(session);
    return true;
  }

  // ============================================================================
  // Session Queries
  // ============================================================================

  /**
   * List all active sessions
   */
  listActiveSessions(): SessionState[] {
    if (!existsSync(this.baseDir)) {
      return [];
    }

    const sessions: SessionState[] = [];
    const files = readdirSync(this.baseDir).filter(f => f.endsWith('.json') && !f.includes('-result'));

    for (const file of files) {
      const sessionId = file.replace('.json', '');
      const session = this.getSession(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Get child sessions of a parent
   */
  getChildSessions(parentSessionId: string): SessionState[] {
    return this.listActiveSessions().filter(
      s => s.sessionId.parentSessionId === parentSessionId
    );
  }

  /**
   * Check nesting depth
   */
  getNestingDepth(sessionId: string): number {
    let depth = 0;
    let currentId: string | undefined = sessionId;

    while (currentId) {
      const session = this.getSession(currentId);
      if (!session?.sessionId.parentSessionId) {
        break;
      }
      currentId = session.sessionId.parentSessionId;
      depth++;
    }

    return depth;
  }

  /**
   * Check if can create nested session
   */
  canCreateNestedSession(
    parentSessionId: string,
    rules: SessionIsolationRules = DEFAULT_SESSION_RULES
  ): boolean {
    const depth = this.getNestingDepth(parentSessionId);
    return depth < rules.maxNestingDepth;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Clean up stale sessions (older than timeout)
   */
  cleanupStaleSessions(timeoutMs: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;

    const sessions = this.listActiveSessions();
    for (const session of sessions) {
      const lastActivity = new Date(session.lastActivityAt).getTime();
      if (now - lastActivity > timeoutMs) {
        this.deleteSession(session.sessionId.id);
        cleaned++;
      }
    }

    return cleaned;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private getSessionPath(sessionId: string): string {
    return join(this.baseDir, `${sessionId}.json`);
  }

  private getSessionResultPath(sessionId: string): string {
    return join(this.baseDir, `${sessionId}-result.json`);
  }

  private saveSession(session: SessionState): void {
    const path = this.getSessionPath(session.sessionId.id);
    this.ensureDir(dirname(path));
    writeFileSync(path, JSON.stringify(session, null, 2));
  }

  private ensureDir(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let _sessionManager: SessionManager | null = null;

/**
 * Get the session manager instance
 */
export function getSessionManager(projectRoot?: string): SessionManager {
  if (!_sessionManager || projectRoot) {
    _sessionManager = new SessionManager(projectRoot);
  }
  return _sessionManager;
}

/**
 * Create session (convenience function)
 */
export function createSession(options?: Parameters<SessionManager['createSession']>[0]): SessionState {
  return getSessionManager().createSession(options);
}

/**
 * Get session (convenience function)
 */
export function getSession(sessionId: string): SessionState | null {
  return getSessionManager().getSession(sessionId);
}
