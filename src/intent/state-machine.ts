/**
 * Intent Status State Machine
 *
 * Defines and enforces valid status transitions for intents.
 * Prevents invalid state changes and provides detailed error messages.
 */

import type { IntentStatus } from '../common/types.js';

/**
 * Transition metadata
 */
export interface TransitionMeta {
  /** Human-readable description of the transition */
  description: string;
  /** Whether this transition requires a reason */
  requiresReason?: boolean;
  /** Whether this transition requires elevated permissions */
  requiresPermission?: boolean;
  /** Trigger event type for this transition */
  event?: string;
}

/**
 * Valid status transitions map
 * Key is the current status, value is a map of valid next statuses with metadata
 */
const VALID_TRANSITIONS: Record<IntentStatus, Map<IntentStatus, TransitionMeta>> = {
  pending: new Map([
    ['evaluating', { description: 'Begin evaluation process', event: 'intent.evaluation.started' }],
    ['cancelled', { description: 'Cancel before processing', requiresReason: true, event: 'intent.cancelled' }],
  ]),

  evaluating: new Map([
    ['approved', { description: 'Evaluation passed, intent approved', event: 'intent.approved' }],
    ['denied', { description: 'Evaluation failed, intent denied', event: 'intent.denied' }],
    ['escalated', { description: 'Requires human review', event: 'intent.escalated' }],
    ['cancelled', { description: 'Cancel during evaluation', requiresReason: true, event: 'intent.cancelled' }],
    ['failed', { description: 'Evaluation error', event: 'intent.failed' }],
  ]),

  escalated: new Map([
    ['approved', { description: 'Human approved after escalation', requiresPermission: true, event: 'intent.approved' }],
    ['denied', { description: 'Human denied after escalation', requiresPermission: true, event: 'intent.denied' }],
    ['cancelled', { description: 'Cancel during escalation', requiresReason: true, event: 'intent.cancelled' }],
  ]),

  approved: new Map([
    ['executing', { description: 'Begin execution', event: 'intent.execution.started' }],
    ['cancelled', { description: 'Cancel before execution', requiresReason: true, event: 'intent.cancelled' }],
  ]),

  executing: new Map([
    ['completed', { description: 'Execution succeeded', event: 'intent.completed' }],
    ['failed', { description: 'Execution failed', event: 'intent.failed' }],
  ]),

  denied: new Map([
    ['pending', { description: 'Replay denied intent', requiresPermission: true, event: 'intent.replayed' }],
  ]),

  failed: new Map([
    ['pending', { description: 'Retry failed intent', requiresPermission: true, event: 'intent.replayed' }],
  ]),

  completed: new Map([
    // Terminal state - no transitions allowed
  ]),

  cancelled: new Map([
    // Terminal state - no transitions allowed
  ]),
};

/**
 * Terminal states that cannot transition to any other state
 */
export const TERMINAL_STATES: Set<IntentStatus> = new Set(['completed', 'cancelled']);

/**
 * Active states where the intent is being processed
 */
export const ACTIVE_STATES: Set<IntentStatus> = new Set([
  'pending',
  'evaluating',
  'escalated',
  'approved',
  'executing',
]);

/**
 * States that allow cancellation
 */
export const CANCELLABLE_STATES: Set<IntentStatus> = new Set([
  'pending',
  'evaluating',
  'escalated',
  'approved',
]);

/**
 * States that allow replay (restart from pending)
 */
export const REPLAYABLE_STATES: Set<IntentStatus> = new Set([
  'denied',
  'failed',
]);

/**
 * Result of a transition validation
 */
export interface TransitionResult {
  valid: boolean;
  meta?: TransitionMeta;
  error?: string;
  errorCode?: 'INVALID_TRANSITION' | 'TERMINAL_STATE' | 'REQUIRES_REASON' | 'REQUIRES_PERMISSION';
}

/**
 * Check if a status transition is valid
 */
export function isValidTransition(
  fromStatus: IntentStatus,
  toStatus: IntentStatus
): boolean {
  const validTargets = VALID_TRANSITIONS[fromStatus];
  return validTargets?.has(toStatus) ?? false;
}

/**
 * Get metadata for a transition
 */
export function getTransitionMeta(
  fromStatus: IntentStatus,
  toStatus: IntentStatus
): TransitionMeta | undefined {
  return VALID_TRANSITIONS[fromStatus]?.get(toStatus);
}

/**
 * Validate a status transition with detailed result
 */
export function validateTransition(
  fromStatus: IntentStatus,
  toStatus: IntentStatus,
  options?: {
    hasReason?: boolean;
    hasPermission?: boolean;
  }
): TransitionResult {
  // Check if current status is terminal
  if (TERMINAL_STATES.has(fromStatus)) {
    return {
      valid: false,
      error: `Cannot transition from terminal state '${fromStatus}'`,
      errorCode: 'TERMINAL_STATE',
    };
  }

  // Check if transition is defined
  const meta = getTransitionMeta(fromStatus, toStatus);
  if (!meta) {
    const validTargets = getValidTransitions(fromStatus);
    return {
      valid: false,
      error: `Invalid transition from '${fromStatus}' to '${toStatus}'. Valid transitions: ${validTargets.join(', ') || 'none'}`,
      errorCode: 'INVALID_TRANSITION',
    };
  }

  // Check if reason is required
  if (meta.requiresReason && !options?.hasReason) {
    return {
      valid: false,
      meta,
      error: `Transition to '${toStatus}' requires a reason`,
      errorCode: 'REQUIRES_REASON',
    };
  }

  // Check if permission is required
  if (meta.requiresPermission && !options?.hasPermission) {
    return {
      valid: false,
      meta,
      error: `Transition to '${toStatus}' requires elevated permissions`,
      errorCode: 'REQUIRES_PERMISSION',
    };
  }

  return {
    valid: true,
    meta,
  };
}

/**
 * Get all valid transitions from a status
 */
export function getValidTransitions(fromStatus: IntentStatus): IntentStatus[] {
  const validTargets = VALID_TRANSITIONS[fromStatus];
  return validTargets ? Array.from(validTargets.keys()) : [];
}

/**
 * Get the event type for a transition
 */
export function getTransitionEvent(
  fromStatus: IntentStatus,
  toStatus: IntentStatus
): string | undefined {
  return getTransitionMeta(fromStatus, toStatus)?.event;
}

/**
 * Check if a status is terminal (no further transitions possible)
 */
export function isTerminalState(status: IntentStatus): boolean {
  return TERMINAL_STATES.has(status);
}

/**
 * Check if a status is active (intent is being processed)
 */
export function isActiveState(status: IntentStatus): boolean {
  return ACTIVE_STATES.has(status);
}

/**
 * Check if an intent can be cancelled from the given status
 */
export function canCancel(status: IntentStatus): boolean {
  return CANCELLABLE_STATES.has(status);
}

/**
 * Check if an intent can be replayed from the given status
 */
export function canReplay(status: IntentStatus): boolean {
  return REPLAYABLE_STATES.has(status);
}

/**
 * Get the next logical status for workflow progression
 * Returns the primary "happy path" next status
 */
export function getNextWorkflowStatus(status: IntentStatus): IntentStatus | null {
  switch (status) {
    case 'pending':
      return 'evaluating';
    case 'evaluating':
      return 'approved'; // Or denied/escalated based on evaluation
    case 'approved':
      return 'executing';
    case 'executing':
      return 'completed';
    case 'escalated':
      return null; // Requires human decision
    case 'denied':
    case 'failed':
    case 'completed':
    case 'cancelled':
      return null; // Terminal or special handling
    default:
      return null;
  }
}

/**
 * State machine error class
 */
export class StateMachineError extends Error {
  public readonly fromStatus: IntentStatus;
  public readonly toStatus: IntentStatus;
  public readonly errorCode: TransitionResult['errorCode'];

  constructor(result: TransitionResult, fromStatus: IntentStatus, toStatus: IntentStatus) {
    super(result.error ?? `Invalid transition from ${fromStatus} to ${toStatus}`);
    this.name = 'StateMachineError';
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
    this.errorCode = result.errorCode;
  }
}

/**
 * Assert that a transition is valid, throwing if not
 */
export function assertValidTransition(
  fromStatus: IntentStatus,
  toStatus: IntentStatus,
  options?: {
    hasReason?: boolean;
    hasPermission?: boolean;
  }
): void {
  const result = validateTransition(fromStatus, toStatus, options);
  if (!result.valid) {
    throw new StateMachineError(result, fromStatus, toStatus);
  }
}

/**
 * Get a visual representation of the state machine
 * Returns a mermaid diagram string
 */
export function getStateDiagram(): string {
  const lines: string[] = ['stateDiagram-v2'];

  for (const [fromStatus, transitions] of Object.entries(VALID_TRANSITIONS)) {
    for (const [toStatus, meta] of transitions) {
      const label = meta.event ? meta.event.replace('intent.', '') : '';
      lines.push(`    ${fromStatus} --> ${toStatus}: ${label}`);
    }
  }

  // Mark terminal states
  lines.push('');
  lines.push('    [*] --> pending');
  lines.push('    completed --> [*]');
  lines.push('    cancelled --> [*]');

  return lines.join('\n');
}
