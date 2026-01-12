/**
 * Execution Event Schema
 *
 * Defines events observed during execution.
 * Per spec Section III.3 (Execution Events) and Section IV.5 (Observation & Telemetry Layer):
 *
 * Observed Data:
 * - Tool calls (digests, not raw secrets)
 * - Inputs and outputs (redacted)
 * - Timing and duration
 * - Errors and retries
 * - Completion status
 *
 * Rules:
 * - Observation is PASSIVE
 * - No mutation of execution
 * - No optimization feedback
 */

import { z } from 'zod';
import {
  UUIDSchema,
  TimestampSchema,
  SemVerSchema,
  ActorSchema,
  ExecutionOutcomeSchema,
  CorrelationIdSchema,
  HashSchema,
  SeveritySchema,
} from './common.js';

// ============================================================================
// EVENT TYPES
// ============================================================================

/** Classification of execution event */
export const ExecutionEventTypeSchema = z.enum([
  // Lifecycle events
  'EXECUTION_STARTED',
  'EXECUTION_COMPLETED',
  'EXECUTION_FAILED',
  'EXECUTION_CANCELLED',
  'EXECUTION_TIMEOUT',

  // Tool events
  'TOOL_INVOKED',
  'TOOL_COMPLETED',
  'TOOL_FAILED',
  'TOOL_RETRIED',

  // Agent events
  'AGENT_SPAWNED',
  'AGENT_TERMINATED',
  'AGENT_MESSAGE',

  // Resource events
  'RESOURCE_ACCESSED',
  'RESOURCE_MODIFIED',
  'RESOURCE_CREATED',
  'RESOURCE_DELETED',

  // Control events
  'CHECKPOINT_CREATED',
  'ROLLBACK_INITIATED',
  'PAUSE_REQUESTED',
  'RESUME_REQUESTED',

  // Error events
  'ERROR_OCCURRED',
  'EXCEPTION_CAUGHT',
  'RETRY_ATTEMPTED',

  // Security events
  'AUTHORIZATION_CHECKED',
  'CONSTRAINT_VIOLATED',
  'RATE_LIMIT_HIT',
  'ESCALATION_TRIGGERED',

  // Human events
  'HUMAN_INTERVENTION',
  'APPROVAL_RECEIVED',
  'REJECTION_RECEIVED',
]);

// ============================================================================
// TOOL INVOCATION
// ============================================================================

/** Details of a tool invocation */
export const ToolInvocationSchema = z.object({
  /** Tool identifier */
  toolId: z.string(),
  /** Tool name */
  toolName: z.string(),
  /** Tool version */
  toolVersion: z.string().optional(),
  /** Input digest (hash of input, not raw data) */
  inputDigest: HashSchema.optional(),
  /** Input size (bytes) */
  inputSize: z.number().int().nonnegative().optional(),
  /** Output digest (hash of output) */
  outputDigest: HashSchema.optional(),
  /** Output size (bytes) */
  outputSize: z.number().int().nonnegative().optional(),
  /** Execution duration (ms) */
  durationMs: z.number().int().nonnegative().optional(),
  /** Was the invocation successful? */
  success: z.boolean(),
  /** Error code (if failed) */
  errorCode: z.string().optional(),
  /** Error message (redacted) */
  errorMessage: z.string().optional(),
  /** Retry count */
  retryCount: z.number().int().nonnegative().default(0),
  /** Resource usage */
  resourceUsage: z.object({
    cpuMs: z.number().nonnegative().optional(),
    memoryBytes: z.number().int().nonnegative().optional(),
    networkBytesIn: z.number().int().nonnegative().optional(),
    networkBytesOut: z.number().int().nonnegative().optional(),
  }).optional(),
});

// ============================================================================
// ERROR DETAILS
// ============================================================================

/** Structured error information */
export const ErrorDetailsSchema = z.object({
  /** Error code */
  code: z.string(),
  /** Error type/category */
  type: z.enum([
    'VALIDATION_ERROR',
    'AUTHORIZATION_ERROR',
    'EXECUTION_ERROR',
    'TIMEOUT_ERROR',
    'RATE_LIMIT_ERROR',
    'RESOURCE_ERROR',
    'NETWORK_ERROR',
    'INTERNAL_ERROR',
    'EXTERNAL_ERROR',
  ]),
  /** Error message (may be redacted) */
  message: z.string(),
  /** Stack trace (may be redacted) */
  stackTrace: z.string().optional(),
  /** Is this error recoverable? */
  recoverable: z.boolean(),
  /** Suggested action */
  suggestedAction: z.string().optional(),
  /** Related error codes */
  relatedErrors: z.array(z.string()).optional(),
});

// ============================================================================
// RESOURCE ACCESS
// ============================================================================

/** Details of resource access */
export const ResourceAccessSchema = z.object({
  /** Resource type */
  resourceType: z.string(),
  /** Resource identifier */
  resourceId: z.string(),
  /** Access type */
  accessType: z.enum(['READ', 'WRITE', 'DELETE', 'EXECUTE', 'LIST']),
  /** Was access successful? */
  success: z.boolean(),
  /** Access duration (ms) */
  durationMs: z.number().int().nonnegative().optional(),
  /** Data size accessed (bytes) */
  dataSize: z.number().int().nonnegative().optional(),
  /** Was data redacted? */
  wasRedacted: z.boolean().optional(),
});

// ============================================================================
// EXECUTION METRICS
// ============================================================================

/** Metrics captured during execution */
export const ExecutionMetricsSchema = z.object({
  /** Total duration (ms) */
  totalDurationMs: z.number().int().nonnegative(),
  /** Time waiting for authorization (ms) */
  authorizationTimeMs: z.number().int().nonnegative().optional(),
  /** Time waiting for human input (ms) */
  humanWaitTimeMs: z.number().int().nonnegative().optional(),
  /** Time in actual execution (ms) */
  executionTimeMs: z.number().int().nonnegative().optional(),
  /** Number of tool calls */
  toolCallCount: z.number().int().nonnegative().default(0),
  /** Number of retries */
  retryCount: z.number().int().nonnegative().default(0),
  /** Number of checkpoints */
  checkpointCount: z.number().int().nonnegative().default(0),
  /** Cost incurred */
  costIncurred: z.number().nonnegative().optional(),
  /** Cost unit */
  costUnit: z.string().optional(),
  /** Token usage (for LLM tools) */
  tokenUsage: z.object({
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    totalTokens: z.number().int().nonnegative().optional(),
  }).optional(),
});

// ============================================================================
// EXECUTION EVENT (Main Schema)
// ============================================================================

/**
 * ExecutionEvent captures a single observable event during execution.
 * Events are immutable once recorded.
 */
export const ExecutionEventSchema = z.object({
  // ─── Identity ───────────────────────────────────────────────────────────────
  /** Unique event identifier */
  id: UUIDSchema,
  /** Schema version */
  schemaVersion: SemVerSchema.default('1.0.0'),
  /** Correlation ID for tracing */
  correlationId: CorrelationIdSchema,
  /** Sequence number within execution */
  sequenceNumber: z.number().int().nonnegative(),

  // ─── Reference ──────────────────────────────────────────────────────────────
  /** Intent ID this event relates to */
  intentId: UUIDSchema,
  /** Authorization decision ID */
  decisionId: UUIDSchema.optional(),
  /** Parent event ID (for nested events) */
  parentEventId: UUIDSchema.optional(),

  // ─── Event Details ──────────────────────────────────────────────────────────
  /** Event type */
  type: ExecutionEventTypeSchema,
  /** Event severity */
  severity: SeveritySchema.default('INFO'),
  /** Event description */
  description: z.string(),
  /** Event timestamp */
  timestamp: TimestampSchema,

  // ─── Actor ──────────────────────────────────────────────────────────────────
  /** Who/what generated this event */
  actor: ActorSchema,

  // ─── Event-Specific Data ────────────────────────────────────────────────────
  /** Tool invocation details (for tool events) */
  toolInvocation: ToolInvocationSchema.optional(),
  /** Error details (for error events) */
  errorDetails: ErrorDetailsSchema.optional(),
  /** Resource access details (for resource events) */
  resourceAccess: ResourceAccessSchema.optional(),
  /** Execution metrics (for completion events) */
  metrics: ExecutionMetricsSchema.optional(),

  // ─── Outcome ────────────────────────────────────────────────────────────────
  /** Event outcome (for completion events) */
  outcome: ExecutionOutcomeSchema.optional(),

  // ─── Constraint Tracking ────────────────────────────────────────────────────
  /** Was a constraint violated? */
  constraintViolated: z.boolean().default(false),
  /** Violated constraint details */
  violatedConstraint: z.object({
    constraintType: z.string(),
    constraintValue: z.unknown(),
    actualValue: z.unknown(),
    message: z.string(),
  }).optional(),

  // ─── Metadata ───────────────────────────────────────────────────────────────
  /** Environment where event occurred */
  environment: z.string().optional(),
  /** Host/node identifier */
  hostId: z.string().optional(),
  /** Process identifier */
  processId: z.string().optional(),
  /** Custom metadata */
  metadata: z.record(z.unknown()).optional(),
  /** Tags */
  tags: z.array(z.string()).optional(),

  // ─── Integrity ──────────────────────────────────────────────────────────────
  /** Hash of event content */
  eventHash: HashSchema.optional(),
  /** Previous event hash (for chain) */
  previousEventHash: HashSchema.optional(),
});

// ============================================================================
// EXECUTION TRACE
// ============================================================================

/** Complete execution trace (collection of events) */
export const ExecutionTraceSchema = z.object({
  /** Trace identifier */
  id: UUIDSchema,
  /** Intent ID */
  intentId: UUIDSchema,
  /** Decision ID */
  decisionId: UUIDSchema,
  /** Correlation ID */
  correlationId: CorrelationIdSchema,
  /** Events in sequence order */
  events: z.array(ExecutionEventSchema),
  /** Overall outcome */
  outcome: ExecutionOutcomeSchema,
  /** Aggregate metrics */
  aggregateMetrics: ExecutionMetricsSchema,
  /** Trace start time */
  startedAt: TimestampSchema,
  /** Trace end time */
  completedAt: TimestampSchema.optional(),
  /** Is trace complete? */
  isComplete: z.boolean(),
  /** Root hash (Merkle root of events) */
  rootHash: HashSchema.optional(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ExecutionEventType = z.infer<typeof ExecutionEventTypeSchema>;
export type ToolInvocation = z.infer<typeof ToolInvocationSchema>;
export type ErrorDetails = z.infer<typeof ErrorDetailsSchema>;
export type ResourceAccess = z.infer<typeof ResourceAccessSchema>;
export type ExecutionMetrics = z.infer<typeof ExecutionMetricsSchema>;
export type ExecutionEvent = z.infer<typeof ExecutionEventSchema>;
export type ExecutionTrace = z.infer<typeof ExecutionTraceSchema>;
