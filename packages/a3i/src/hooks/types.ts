/**
 * Hook System Types - Type definitions for the hook system
 *
 * Hooks allow extensibility at key points in the authorization
 * and execution lifecycle.
 */

import type {
  Intent,
  Decision,
  TrustProfile,
  ProofEvent,
} from '@orion/contracts';

/**
 * Hook lifecycle phases
 */
export enum HookPhase {
  /** Before authorization decision */
  PRE_AUTHORIZE = 'pre-authorize',
  /** After authorization decision */
  POST_AUTHORIZE = 'post-authorize',
  /** Before action execution */
  PRE_EXECUTE = 'pre-execute',
  /** After successful execution */
  POST_EXECUTE = 'post-execute',
  /** After failed execution */
  EXECUTION_FAILED = 'execution-failed',
  /** When trust score changes */
  TRUST_CHANGE = 'trust-change',
  /** When a trust violation occurs */
  TRUST_VIOLATION = 'trust-violation',
  /** When a proof event is emitted */
  EVENT_EMITTED = 'event-emitted',
}

/**
 * Hook execution priority
 * Lower numbers execute first
 */
export enum HookPriority {
  CRITICAL = 0,
  HIGH = 100,
  NORMAL = 500,
  LOW = 900,
  MONITOR = 1000,
}

/**
 * Result of hook execution
 */
export interface HookResult {
  /** Whether the hook succeeded */
  success: boolean;
  /** Whether to abort the operation (for pre- hooks) */
  abort?: boolean;
  /** Reason for abort */
  abortReason?: string;
  /** Modified data (if applicable) */
  modified?: unknown;
  /** Error if hook failed */
  error?: Error;
  /** Execution time in ms */
  durationMs: number;
}

/**
 * Context passed to all hooks
 */
export interface HookContext {
  /** Unique ID for this hook execution chain */
  executionId: string;
  /** Correlation ID for tracing */
  correlationId: string;
  /** Timestamp when the hook chain started */
  startedAt: Date;
  /** Custom metadata */
  metadata: Record<string, unknown>;
}

/**
 * Context for pre-authorize hooks
 */
export interface PreAuthorizeContext extends HookContext {
  /** The intent being authorized */
  intent: Intent;
  /** Agent's trust profile (if available) */
  profile?: TrustProfile;
}

/**
 * Context for post-authorize hooks
 */
export interface PostAuthorizeContext extends HookContext {
  /** The original intent */
  intent: Intent;
  /** The authorization decision */
  decision: Decision;
  /** Agent's trust profile */
  profile: TrustProfile;
}

/**
 * Context for pre-execute hooks
 */
export interface PreExecuteContext extends HookContext {
  /** The authorization decision */
  decision: Decision;
  /** The original intent */
  intent: Intent;
  /** Agent's trust profile */
  profile: TrustProfile;
  /** Execution parameters */
  params?: Record<string, unknown>;
}

/**
 * Context for post-execute hooks
 */
export interface PostExecuteContext extends HookContext {
  /** The authorization decision */
  decision: Decision;
  /** The original intent */
  intent: Intent;
  /** Execution result */
  result: unknown;
  /** Execution duration in ms */
  durationMs: number;
}

/**
 * Context for execution-failed hooks
 */
export interface ExecutionFailedContext extends HookContext {
  /** The authorization decision */
  decision: Decision;
  /** The original intent */
  intent: Intent;
  /** The error that occurred */
  error: Error;
  /** Execution duration before failure in ms */
  durationMs: number;
  /** Whether the operation can be retried */
  retryable: boolean;
}

/**
 * Context for trust-change hooks
 */
export interface TrustChangeContext extends HookContext {
  /** Agent ID */
  agentId: string;
  /** Previous trust profile */
  previousProfile: TrustProfile;
  /** New trust profile */
  newProfile: TrustProfile;
  /** Reason for the change */
  reason: string;
}

/**
 * Context for trust-violation hooks
 */
export interface TrustViolationContext extends HookContext {
  /** Agent ID */
  agentId: string;
  /** Current trust profile */
  profile: TrustProfile;
  /** Type of violation */
  violationType: string;
  /** Violation details */
  details: Record<string, unknown>;
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Context for event-emitted hooks
 */
export interface EventEmittedContext extends HookContext {
  /** The emitted proof event */
  event: ProofEvent;
}

/**
 * Union type for all hook contexts
 */
export type AnyHookContext =
  | PreAuthorizeContext
  | PostAuthorizeContext
  | PreExecuteContext
  | PostExecuteContext
  | ExecutionFailedContext
  | TrustChangeContext
  | TrustViolationContext
  | EventEmittedContext;

/**
 * Hook handler function signature
 */
export type HookHandler<T extends AnyHookContext = AnyHookContext> = (
  context: T
) => HookResult | Promise<HookResult>;

/**
 * Hook definition
 */
export interface HookDefinition<T extends AnyHookContext = AnyHookContext> {
  /** Unique hook ID */
  id: string;
  /** Hook name for display */
  name: string;
  /** Hook phase */
  phase: HookPhase;
  /** Execution priority */
  priority: HookPriority;
  /** The hook handler function */
  handler: HookHandler<T>;
  /** Whether the hook is enabled */
  enabled: boolean;
  /** Timeout in ms (default: 5000) */
  timeoutMs?: number;
  /** Whether to continue on error */
  continueOnError?: boolean;
  /** Optional filter function */
  filter?: (context: T) => boolean;
  /** Hook metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Summary of hook execution
 */
export interface HookExecutionSummary {
  /** Hook phase */
  phase: HookPhase;
  /** Number of hooks executed */
  hooksExecuted: number;
  /** Number of hooks that succeeded */
  succeeded: number;
  /** Number of hooks that failed */
  failed: number;
  /** Number of hooks that were skipped */
  skipped: number;
  /** Whether any hook requested abort */
  aborted: boolean;
  /** Abort reason (if aborted) */
  abortReason?: string;
  /** Total execution time in ms */
  totalDurationMs: number;
  /** Individual hook results */
  results: Array<{
    hookId: string;
    hookName: string;
    result: HookResult;
  }>;
}
