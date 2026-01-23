/**
 * Execution State Machine for Cognigate
 *
 * Defines and enforces valid execution status transitions.
 * Provides event-driven state change notifications, full transition
 * history, and terminal state detection for the execution lifecycle.
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import type { Timestamp } from '../common/types.js';
import type { ExecutionStatus } from './types.js';

const logger = createLogger({ component: 'cognigate', subComponent: 'state-machine' });

// =============================================================================
// TYPES
// =============================================================================

/**
 * Represents a single state transition in the execution lifecycle.
 */
export interface StateTransition {
  /** Previous state */
  from: ExecutionStatus;
  /** New state */
  to: ExecutionStatus;
  /** Reason for the transition */
  reason?: string;
  /** When the transition occurred */
  timestamp: Timestamp;
}

/**
 * Callback function invoked on state changes.
 */
export type StateChangeListener = (transition: StateTransition) => void;

// =============================================================================
// TRANSITION MAP
// =============================================================================

/**
 * Valid state transitions for execution status.
 * Maps each status to the set of statuses it can transition to.
 * Terminal states have empty transition sets.
 */
export const EXECUTION_TRANSITIONS: Record<ExecutionStatus, ExecutionStatus[]> = {
  pending: ['initializing', 'failed', 'terminated'],
  initializing: ['running', 'failed', 'terminated'],
  running: ['paused', 'completed', 'failed', 'terminated', 'timed_out', 'resource_exceeded'],
  paused: ['running', 'terminated', 'failed'],
  completed: [],
  failed: [],
  terminated: [],
  timed_out: [],
  resource_exceeded: [],
};

/**
 * Set of terminal execution states (no further transitions allowed).
 */
const TERMINAL_STATES: Set<ExecutionStatus> = new Set<ExecutionStatus>([
  'completed',
  'failed',
  'terminated',
  'timed_out',
  'resource_exceeded',
]);

// =============================================================================
// EXECUTION STATE MACHINE
// =============================================================================

/**
 * Manages execution status transitions with validation, history tracking,
 * and event-driven notifications.
 *
 * Enforces the defined transition map, preventing invalid state changes.
 * Maintains a full history of all transitions for audit purposes.
 * Supports listeners for specific states or all transitions.
 */
export class ExecutionStateMachine {
  private currentState: ExecutionStatus;
  private history: StateTransition[];
  private listeners: Map<string, StateChangeListener[]>;

  /**
   * Create a new state machine with an optional initial state.
   *
   * @param initialState - Starting state (defaults to 'pending')
   */
  constructor(initialState?: ExecutionStatus) {
    const state = initialState ?? 'pending';
    this.validateState(state);
    this.currentState = state;
    this.history = [];
    this.listeners = new Map();

    logger.debug({ initialState: this.currentState }, 'Execution state machine created');
  }

  /**
   * Transition to a new state.
   * Validates the transition is allowed, records it in history,
   * and notifies all relevant listeners.
   *
   * @param to - The target state
   * @param reason - Optional reason for the transition
   * @throws Error if the transition is not valid from the current state
   */
  transition(to: ExecutionStatus, reason?: string): void {
    this.validateState(to);

    if (!this.canTransition(to)) {
      const validTargets = ExecutionStateMachine.getValidTransitions(this.currentState);
      throw new ExecutionStateMachineError(
        this.currentState,
        to,
        `Invalid state transition from '${this.currentState}' to '${to}'. ` +
        `Valid transitions: ${validTargets.length > 0 ? validTargets.join(', ') : 'none (terminal state)'}`
      );
    }

    const transition: StateTransition = {
      from: this.currentState,
      to,
      ...(reason !== undefined ? { reason } : {}),
      timestamp: new Date().toISOString(),
    };

    const previousState = this.currentState;
    this.currentState = to;
    this.history.push(transition);

    logger.info(
      {
        from: previousState,
        to,
        reason,
        historyLength: this.history.length,
      },
      'Execution state transition'
    );

    // Notify listeners
    this.notifyListeners(transition);
  }

  /**
   * Check if a transition to the given state is valid from the current state.
   *
   * @param to - The target state to check
   * @returns True if the transition is allowed
   */
  canTransition(to: ExecutionStatus): boolean {
    const validTransitions = EXECUTION_TRANSITIONS[this.currentState];
    return validTransitions.includes(to);
  }

  /**
   * Get the current execution state.
   */
  getState(): ExecutionStatus {
    return this.currentState;
  }

  /**
   * Get the full transition history.
   *
   * @returns Copy of the transition history array
   */
  getHistory(): StateTransition[] {
    return [...this.history];
  }

  /**
   * Check if the current state is a terminal state.
   * Terminal states cannot transition to any other state.
   */
  isTerminal(): boolean {
    return TERMINAL_STATES.has(this.currentState);
  }

  /**
   * Get the duration spent in the current state (in milliseconds).
   * Returns 0 if no transitions have occurred.
   */
  getCurrentStateDurationMs(): number {
    if (this.history.length === 0) {
      return 0;
    }
    const lastTransition = this.history[this.history.length - 1]!;
    const transitionTime = new Date(lastTransition.timestamp).getTime();
    return Date.now() - transitionTime;
  }

  /**
   * Get the total elapsed time from the first transition to now (in milliseconds).
   * Returns 0 if no transitions have occurred.
   */
  getTotalElapsedMs(): number {
    if (this.history.length === 0) {
      return 0;
    }
    const firstTransition = this.history[0]!;
    const startTime = new Date(firstTransition.timestamp).getTime();
    return Date.now() - startTime;
  }

  /**
   * Register a listener for state change events.
   * Listeners can subscribe to specific states or 'any' for all transitions.
   *
   * @param event - The state to listen for, or 'any' for all transitions
   * @param listener - Callback function to invoke on matching transitions
   */
  on(event: ExecutionStatus | 'any', listener: StateChangeListener): void {
    const existing = this.listeners.get(event) ?? [];
    existing.push(listener);
    this.listeners.set(event, existing);
  }

  /**
   * Remove a previously registered listener.
   *
   * @param event - The event the listener was registered for
   * @param listener - The listener function to remove
   */
  off(event: ExecutionStatus | 'any', listener: StateChangeListener): void {
    const existing = this.listeners.get(event);
    if (!existing) {
      return;
    }

    const filtered = existing.filter(l => l !== listener);
    if (filtered.length === 0) {
      this.listeners.delete(event);
    } else {
      this.listeners.set(event, filtered);
    }
  }

  /**
   * Remove all listeners for a specific event or all events.
   *
   * @param event - Optional event to clear listeners for. If omitted, clears all.
   */
  removeAllListeners(event?: ExecutionStatus | 'any'): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get the number of registered listeners.
   *
   * @param event - Optional event to count listeners for. If omitted, counts all.
   */
  listenerCount(event?: ExecutionStatus | 'any'): number {
    if (event) {
      return this.listeners.get(event)?.length ?? 0;
    }

    let total = 0;
    for (const listeners of this.listeners.values()) {
      total += listeners.length;
    }
    return total;
  }

  /**
   * Check if a given status is a terminal state.
   *
   * @param status - The status to check
   * @returns True if the status is terminal
   */
  static isTerminal(status: ExecutionStatus): boolean {
    return TERMINAL_STATES.has(status);
  }

  /**
   * Get valid transitions from a given state.
   *
   * @param from - The state to get transitions for
   * @returns Array of valid target states
   */
  static getValidTransitions(from: ExecutionStatus): ExecutionStatus[] {
    return [...(EXECUTION_TRANSITIONS[from] ?? [])];
  }

  /**
   * Get all defined terminal states.
   */
  static getTerminalStates(): ExecutionStatus[] {
    return Array.from(TERMINAL_STATES);
  }

  /**
   * Get all defined non-terminal (active) states.
   */
  static getActiveStates(): ExecutionStatus[] {
    return Object.keys(EXECUTION_TRANSITIONS)
      .filter(state => !TERMINAL_STATES.has(state as ExecutionStatus)) as ExecutionStatus[];
  }

  /**
   * Validate that a state value is a recognized ExecutionStatus.
   */
  private validateState(state: string): void {
    if (!(state in EXECUTION_TRANSITIONS)) {
      throw new Error(
        `Invalid execution status '${state}'. ` +
        `Valid statuses: ${Object.keys(EXECUTION_TRANSITIONS).join(', ')}`
      );
    }
  }

  /**
   * Notify all relevant listeners about a state transition.
   */
  private notifyListeners(transition: StateTransition): void {
    // Notify 'any' listeners
    const anyListeners = this.listeners.get('any');
    if (anyListeners) {
      for (const listener of anyListeners) {
        this.safeNotify(listener, transition);
      }
    }

    // Notify state-specific listeners
    const stateListeners = this.listeners.get(transition.to);
    if (stateListeners) {
      for (const listener of stateListeners) {
        this.safeNotify(listener, transition);
      }
    }
  }

  /**
   * Safely invoke a listener, catching and logging any errors.
   */
  private safeNotify(listener: StateChangeListener, transition: StateTransition): void {
    try {
      listener(transition);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        {
          from: transition.from,
          to: transition.to,
          error: errorMessage,
        },
        'State change listener threw an error'
      );
    }
  }
}

// =============================================================================
// ERROR CLASS
// =============================================================================

/**
 * Error thrown when an invalid state transition is attempted.
 */
export class ExecutionStateMachineError extends Error {
  /** The state the machine was in when the transition was attempted */
  public readonly fromState: ExecutionStatus;
  /** The state that was requested */
  public readonly toState: ExecutionStatus;

  constructor(fromState: ExecutionStatus, toState: ExecutionStatus, message: string) {
    super(message);
    this.name = 'ExecutionStateMachineError';
    this.fromState = fromState;
    this.toState = toState;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
