/**
 * Todo Continuation Enforcer Hook
 *
 * Automatically continues work when session becomes idle with incomplete tasks.
 * This is a critical feature from oh-my-opencode that prevents agents from
 * stopping prematurely when tasks remain.
 *
 * Features:
 * - Session state tracking with Map<sessionId, SessionState>
 * - 2-second countdown timer for auto-continuation
 * - Background task awareness (skip if pending tasks)
 * - Auto-injection of continuation prompt
 * - Abort detection to prevent unwanted continuation
 *
 * @module hooks/core/todo-continuation-enforcer
 */

import type { HookContext, HookHandlers, EventInput, EventOutput } from '../types.js';
import { ExtendedSystemDirectiveTypes } from '../types.js';
import { SYSTEM_DIRECTIVE_PREFIX } from '../orchestrator/types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Per-session state for tracking countdown and recovery status.
 */
interface SessionState {
  /** Timer for countdown completion */
  countdownTimer?: ReturnType<typeof setTimeout>;
  /** Interval for countdown display updates */
  countdownInterval?: ReturnType<typeof setInterval>;
  /** Whether session is currently recovering from an error */
  isRecovering?: boolean;
  /** Timestamp when countdown started (for grace period checks) */
  countdownStartedAt?: number;
  /** Timestamp when abort was detected (to prevent immediate continuation) */
  abortDetectedAt?: number;
}

/**
 * Todo item interface matching typical task tracker format.
 */
interface Todo {
  /** Todo content/description */
  content: string;
  /** Current status (pending, in_progress, completed, cancelled) */
  status: string;
  /** Priority level */
  priority?: string;
  /** Unique identifier */
  id: string;
}

/**
 * Configuration options for the todo continuation enforcer.
 */
export interface TodoContinuationEnforcerOptions {
  /** Number of seconds for countdown before continuation (default: 2) */
  countdownSeconds?: number;
  /** Agent names to skip (e.g., ['prometheus', 'compaction']) */
  skipAgents?: string[];
  /** Whether to check for background tasks before continuing (default: true) */
  checkBackgroundTasks?: boolean;
  /** Optional function to check if background tasks are running */
  backgroundTaskChecker?: (sessionId: string) => boolean;
  /** Optional function to get todos for a session */
  todoGetter?: (sessionId: string) => Todo[] | Promise<Todo[]>;
  /** Optional function to inject continuation prompt */
  promptInjector?: (sessionId: string, prompt: string) => void | Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

const HOOK_NAME = 'todo-continuation-enforcer';

/** Default agents to skip (internal/system agents) */
const DEFAULT_SKIP_AGENTS = ['prometheus', 'compaction'];

/** Default countdown duration in seconds */
const DEFAULT_COUNTDOWN_SECONDS = 2;

/** Window in milliseconds to ignore idle events after abort detection */
const ABORT_WINDOW_MS = 3000;

/** Grace period in milliseconds before user input cancels countdown */
const COUNTDOWN_GRACE_PERIOD_MS = 500;

/**
 * Create a formatted system directive for TODO_CONTINUATION.
 * Uses the extended directive type format.
 */
function createTodoContinuationDirective(): string {
  return `${SYSTEM_DIRECTIVE_PREFIX} - ${ExtendedSystemDirectiveTypes.TODO_CONTINUATION}]`;
}

/**
 * Continuation prompt injected when incomplete tasks remain.
 * Uses TODO_CONTINUATION system directive for consistent identification.
 */
const CONTINUATION_PROMPT = `${createTodoContinuationDirective()}

Incomplete tasks remain in your todo list. Continue working on the next pending task.

- Proceed without asking for permission
- Mark each task complete when finished
- Do not stop until all tasks are done`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Count incomplete todos (not completed or cancelled).
 *
 * @param todos - Array of todo items
 * @returns Number of incomplete todos
 */
function getIncompleteCount(todos: Todo[]): number {
  return todos.filter(
    (t) => t.status !== 'completed' && t.status !== 'cancelled'
  ).length;
}

/**
 * Create a log entry for debugging.
 *
 * @param message - Log message
 * @param data - Additional context data
 */
function log(message: string, data?: Record<string, unknown>): void {
  console.log(`[${HOOK_NAME}] ${message}`, data ? JSON.stringify(data) : '');
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a todo continuation enforcer hook.
 *
 * This hook monitors session idle events and automatically injects
 * continuation prompts when incomplete tasks remain.
 *
 * @param ctx - Hook context with state manager and event emitter
 * @param options - Configuration options
 * @returns HookHandlers with event handler
 *
 * @example
 * const hook = createTodoContinuationEnforcerHook(ctx, {
 *   countdownSeconds: 3,
 *   skipAgents: ['prometheus'],
 *   backgroundTaskChecker: (sessionId) => hasRunningTasks(sessionId)
 * });
 */
export function createTodoContinuationEnforcerHook(
  ctx: HookContext,
  options: TodoContinuationEnforcerOptions = {}
): HookHandlers {
  const {
    countdownSeconds = DEFAULT_COUNTDOWN_SECONDS,
    skipAgents = DEFAULT_SKIP_AGENTS,
    checkBackgroundTasks = true,
    backgroundTaskChecker,
    todoGetter,
    promptInjector,
  } = options;

  /** Per-session state tracking */
  const sessions = new Map<string, SessionState>();

  // ==========================================================================
  // Session State Management
  // ==========================================================================

  /**
   * Get or create session state.
   *
   * @param sessionId - Session identifier
   * @returns Session state object
   */
  function getState(sessionId: string): SessionState {
    let state = sessions.get(sessionId);
    if (!state) {
      state = {};
      sessions.set(sessionId, state);
    }
    return state;
  }

  /**
   * Cancel any active countdown for a session.
   *
   * @param sessionId - Session identifier
   */
  function cancelCountdown(sessionId: string): void {
    const state = sessions.get(sessionId);
    if (!state) return;

    if (state.countdownTimer) {
      clearTimeout(state.countdownTimer);
      state.countdownTimer = undefined;
    }
    if (state.countdownInterval) {
      clearInterval(state.countdownInterval);
      state.countdownInterval = undefined;
    }
    state.countdownStartedAt = undefined;
  }

  /**
   * Clean up all state for a session.
   *
   * @param sessionId - Session identifier
   */
  function cleanup(sessionId: string): void {
    cancelCountdown(sessionId);
    sessions.delete(sessionId);
  }

  /**
   * Mark a session as recovering (skip continuation during recovery).
   *
   * @param sessionId - Session identifier
   */
  function markRecovering(sessionId: string): void {
    const state = getState(sessionId);
    state.isRecovering = true;
    cancelCountdown(sessionId);
    log('Session marked as recovering', { sessionId });
  }

  /**
   * Mark session recovery as complete.
   *
   * @param sessionId - Session identifier
   */
  function markRecoveryComplete(sessionId: string): void {
    const state = sessions.get(sessionId);
    if (state) {
      state.isRecovering = false;
      log('Session recovery complete', { sessionId });
    }
  }

  // ==========================================================================
  // Continuation Logic
  // ==========================================================================

  /**
   * Inject continuation prompt for a session.
   *
   * @param sessionId - Session identifier
   * @param incompleteCount - Number of incomplete tasks
   * @param total - Total number of tasks
   */
  async function injectContinuation(
    sessionId: string,
    incompleteCount: number,
    total: number
  ): Promise<void> {
    const state = sessions.get(sessionId);

    // Skip if in recovery mode
    if (state?.isRecovering) {
      log('Skipped injection: in recovery', { sessionId });
      return;
    }

    // Check for running background tasks
    if (checkBackgroundTasks && backgroundTaskChecker) {
      const hasRunningBgTasks = backgroundTaskChecker(sessionId);
      if (hasRunningBgTasks) {
        log('Skipped injection: background tasks running', { sessionId });
        return;
      }
    }

    // Re-check todo count (might have changed during countdown)
    let freshTodos: Todo[] = [];
    if (todoGetter) {
      try {
        freshTodos = await todoGetter(sessionId);
      } catch (err) {
        log('Failed to fetch todos', { sessionId, error: String(err) });
        return;
      }
    }

    const freshIncompleteCount = freshTodos.length > 0
      ? getIncompleteCount(freshTodos)
      : incompleteCount;

    if (freshIncompleteCount === 0) {
      log('Skipped injection: no incomplete todos', { sessionId });
      return;
    }

    // Build continuation prompt with status
    const prompt = `${CONTINUATION_PROMPT}

[Status: ${total - freshIncompleteCount}/${total} completed, ${freshIncompleteCount} remaining]`;

    log('Injecting continuation', { sessionId, incompleteCount: freshIncompleteCount });

    // Inject the prompt
    if (promptInjector) {
      try {
        await promptInjector(sessionId, prompt);
        log('Injection successful', { sessionId });
      } catch (err) {
        log('Injection failed', { sessionId, error: String(err) });
      }
    } else {
      // Without injector, emit event for orchestrator to act on
      ctx.emitEvent({
        type: 'todo_continuation',
        payload: {
          sessionId,
          prompt,
          incompleteCount: freshIncompleteCount,
          totalCount: total,
        },
        source: `hook:${HOOK_NAME}`,
      });
      log('Emitted continuation event (no injector configured)', { sessionId });
    }
  }

  /**
   * Start countdown timer before injecting continuation.
   *
   * @param sessionId - Session identifier
   * @param incompleteCount - Number of incomplete tasks
   * @param total - Total number of tasks
   */
  function startCountdown(
    sessionId: string,
    incompleteCount: number,
    total: number
  ): void {
    const state = getState(sessionId);
    cancelCountdown(sessionId);

    state.countdownStartedAt = Date.now();

    log('Countdown started', {
      sessionId,
      seconds: countdownSeconds,
      incompleteCount,
    });

    // Optional: interval for countdown display (not implemented here)
    // In a real implementation, this would update a UI/toast

    // Set timer for actual injection
    state.countdownTimer = setTimeout(() => {
      cancelCountdown(sessionId);
      injectContinuation(sessionId, incompleteCount, total);
    }, countdownSeconds * 1000);
  }

  // ==========================================================================
  // Event Handler
  // ==========================================================================

  /**
   * Main event handler for the hook.
   * Handles session.idle, session.error, message.updated, tool execution events.
   */
  async function eventHandler(input: EventInput): Promise<EventOutput | void> {
    const { event, sessionId } = input;
    const eventType = event.type;
    const payload = event.payload as Record<string, unknown> | undefined;

    // -------------------------------------------------------------------------
    // session.error - Cancel countdown, detect aborts
    // -------------------------------------------------------------------------
    if (eventType === 'session_error') {
      const errorName = (payload?.error as { name?: string })?.name;

      if (errorName === 'MessageAbortedError' || errorName === 'AbortError') {
        const state = getState(sessionId);
        state.abortDetectedAt = Date.now();
        log('Abort detected via session.error', { sessionId, errorName });
      }

      cancelCountdown(sessionId);
      log('session.error', { sessionId });
      return { handled: true };
    }

    // -------------------------------------------------------------------------
    // session.idle - Check for incomplete todos, start countdown
    // -------------------------------------------------------------------------
    if (eventType === 'session_idle') {
      log('session.idle', { sessionId });

      const state = getState(sessionId);

      // Skip if in recovery mode
      if (state.isRecovering) {
        log('Skipped: in recovery', { sessionId });
        return { handled: true };
      }

      // Check for recent abort (event-based detection)
      if (state.abortDetectedAt) {
        const timeSinceAbort = Date.now() - state.abortDetectedAt;
        if (timeSinceAbort < ABORT_WINDOW_MS) {
          log(`Skipped: abort detected ${timeSinceAbort}ms ago`, { sessionId });
          state.abortDetectedAt = undefined;
          return { handled: true };
        }
        state.abortDetectedAt = undefined;
      }

      // Check for running background tasks
      if (checkBackgroundTasks && backgroundTaskChecker) {
        const hasRunningBgTasks = backgroundTaskChecker(sessionId);
        if (hasRunningBgTasks) {
          log('Skipped: background tasks running', { sessionId });
          return { handled: true };
        }
      }

      // Get todos
      let todos: Todo[] = [];
      if (todoGetter) {
        try {
          todos = await todoGetter(sessionId);
        } catch (err) {
          log('Todo fetch failed', { sessionId, error: String(err) });
          return { handled: true };
        }
      } else {
        // Without todoGetter, check payload or emit event for external handling
        todos = (payload?.todos as Todo[]) || [];
      }

      if (!todos || todos.length === 0) {
        log('No todos', { sessionId });
        return { handled: true };
      }

      const incompleteCount = getIncompleteCount(todos);
      if (incompleteCount === 0) {
        log('All todos complete', { sessionId, total: todos.length });
        return { handled: true };
      }

      // Check if agent should be skipped
      const agentName = payload?.agent as string | undefined;
      if (agentName && skipAgents.includes(agentName)) {
        log('Skipped: agent in skipAgents list', { sessionId, agent: agentName });
        return { handled: true };
      }

      // Start countdown
      startCountdown(sessionId, incompleteCount, todos.length);
      return { handled: true };
    }

    // -------------------------------------------------------------------------
    // message.updated - Cancel countdown on user/assistant activity
    // -------------------------------------------------------------------------
    if (eventType === 'message_updated') {
      const role = payload?.role as string | undefined;

      if (role === 'user') {
        const state = sessions.get(sessionId);
        // Grace period: ignore user messages shortly after countdown starts
        if (state?.countdownStartedAt) {
          const elapsed = Date.now() - state.countdownStartedAt;
          if (elapsed < COUNTDOWN_GRACE_PERIOD_MS) {
            log('Ignoring user message in grace period', { sessionId, elapsed });
            return { handled: false };
          }
        }
        if (state) state.abortDetectedAt = undefined;
        cancelCountdown(sessionId);
      }

      if (role === 'assistant') {
        const state = sessions.get(sessionId);
        if (state) state.abortDetectedAt = undefined;
        cancelCountdown(sessionId);
      }

      return { handled: true };
    }

    // -------------------------------------------------------------------------
    // tool.execute.before / tool.execute.after - Cancel countdown
    // -------------------------------------------------------------------------
    if (eventType === 'tool_execute_before' || eventType === 'tool_execute_after') {
      const state = sessions.get(sessionId);
      if (state) state.abortDetectedAt = undefined;
      cancelCountdown(sessionId);
      return { handled: true };
    }

    // -------------------------------------------------------------------------
    // session.deleted - Cleanup
    // -------------------------------------------------------------------------
    if (eventType === 'session_deleted') {
      cleanup(sessionId);
      log('Session deleted: cleaned up', { sessionId });
      return { handled: true };
    }

    // Not handled by this hook
    return { handled: false };
  }

  // ==========================================================================
  // Return Hook Handlers
  // ==========================================================================

  return {
    event: eventHandler,
    'session.idle': async (input) => {
      await eventHandler({
        event: { type: 'session_idle', id: '', timestamp: new Date().toISOString(), payload: input as unknown as Record<string, unknown>, source: 'session' },
        sessionId: input.sessionId,
      });
      return { action: 'continue' };
    },
    'session.error': async (input) => {
      await eventHandler({
        event: { type: 'session_error', id: '', timestamp: new Date().toISOString(), payload: input as unknown as Record<string, unknown>, source: 'session' },
        sessionId: input.sessionId,
      });
      return { handled: true };
    },
    'session.deleted': async (input) => {
      await eventHandler({
        event: { type: 'session_deleted', id: '', timestamp: new Date().toISOString(), payload: input as unknown as Record<string, unknown>, source: 'session' },
        sessionId: input.sessionId,
      });
      return { cleanedUp: ['countdown-timers', 'session-state'] };
    },
  };
}

/**
 * Additional exports for external control of session state.
 */
export interface TodoContinuationEnforcerControls {
  /** Mark a session as recovering (skip continuation) */
  markRecovering: (sessionId: string) => void;
  /** Mark session recovery as complete */
  markRecoveryComplete: (sessionId: string) => void;
}
