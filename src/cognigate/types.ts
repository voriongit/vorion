/**
 * COGNIGATE Module Type Definitions
 *
 * Comprehensive types for the Constrained Execution Runtime, including
 * execution contexts, resource limits, handler definitions, sandbox
 * configuration, bulkhead patterns, audit, and health checks.
 *
 * Cognigate sits between ENFORCE (policy decisions) and PROOF (evidence chain):
 * INTENT -> BASIS -> ENFORCE -> **COGNIGATE** -> PROOF -> TRUST ENGINE
 *
 * @packageDocumentation
 */

import type {
  ID,
  Timestamp,
  ControlAction,
  Intent,
  Decision,
} from '../common/types.js';
import { VorionError } from '../common/types.js';

// =============================================================================
// EXECUTION STATUS
// =============================================================================

/**
 * All possible states of an execution lifecycle
 */
export const EXECUTION_STATUSES = [
  'pending',
  'initializing',
  'running',
  'paused',
  'completed',
  'failed',
  'terminated',
  'timed_out',
  'resource_exceeded',
] as const;

export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

// =============================================================================
// RESOURCE TYPES
// =============================================================================

/**
 * Resource limits that constrain execution behavior
 *
 * Defines hard boundaries for memory, CPU, network, filesystem,
 * and concurrency usage during handler execution.
 */
export interface ResourceLimits {
  /** Maximum memory usage in megabytes */
  maxMemoryMb: number;
  /** Maximum CPU utilization percentage (0-100) */
  maxCpuPercent: number;
  /** Maximum wall-clock execution time in milliseconds */
  timeoutMs: number;
  /** Maximum number of outbound network requests */
  maxNetworkRequests: number;
  /** Maximum number of filesystem operations (reads + writes) */
  maxFileSystemOps: number;
  /** Maximum number of concurrent sub-operations */
  maxConcurrentOps: number;
  /** Maximum payload size in bytes for inputs/outputs */
  maxPayloadSizeBytes: number;
  /** Maximum number of retry attempts on transient failures */
  maxRetries: number;
  /** Timeout for individual network requests in milliseconds */
  networkTimeoutMs: number;
}

/**
 * Tracked resource usage during execution
 *
 * Captures actual resource consumption for comparison against limits
 * and for audit/billing purposes.
 */
export interface ResourceUsage {
  /** Peak memory usage in megabytes */
  memoryPeakMb: number;
  /** Current memory usage in megabytes */
  memoryCurrentMb: number;
  /** Total CPU time consumed in milliseconds */
  cpuTimeMs: number;
  /** Total wall-clock time elapsed in milliseconds */
  wallTimeMs: number;
  /** Number of outbound network requests made */
  networkRequests: number;
  /** Total bytes received from network */
  networkBytesIn: number;
  /** Total bytes sent over network */
  networkBytesOut: number;
  /** Number of filesystem read operations */
  fileSystemReads: number;
  /** Number of filesystem write operations */
  fileSystemWrites: number;
  /** Current number of concurrent sub-operations */
  concurrentOps: number;
}

/**
 * Resource types that can be monitored for threshold breaches
 */
export const RESOURCE_TYPES = [
  'memory',
  'cpu',
  'time',
  'network_requests',
  'network_bytes',
  'filesystem',
  'concurrent_ops',
  'payload_size',
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

/**
 * Threshold configuration for resource monitoring
 *
 * Defines warning and critical levels for each resource type,
 * and the action to take when a threshold is breached.
 */
export interface ResourceThreshold {
  /** Type of resource being monitored */
  resource: ResourceType;
  /** Percentage of limit that triggers a warning (0-100) */
  warningPercent: number;
  /** Percentage of limit that triggers critical action (0-100) */
  criticalPercent: number;
  /** Action to take when critical threshold is breached */
  action: 'warn' | 'throttle' | 'terminate';
}

// =============================================================================
// EXECUTION TYPES
// =============================================================================

/**
 * Complete execution context passed to handler execution
 *
 * Contains all information needed to execute an approved intent,
 * including the original intent, enforcement decision, resource
 * constraints, and observability metadata.
 */
export interface ExecutionContext {
  /** Unique execution identifier (UUID) */
  executionId: ID;
  /** Tenant this execution belongs to */
  tenantId: ID;
  /** The approved intent to execute */
  intent: Intent;
  /** The enforcement decision that approved this intent */
  decision: Decision;
  /** Resource limits for this execution */
  resourceLimits?: Partial<ResourceLimits>;
  /** Name of the handler to invoke (overrides intent type matching) */
  handler?: string;
  /** Sandbox configuration overrides for this execution */
  sandboxConfig?: Partial<SandboxConfig>;
  /** Parent execution ID for nested/chained executions */
  parentExecutionId?: ID;
  /** Correlation ID for request tracing across services */
  correlationId?: ID;
  /** Distributed tracing trace ID */
  traceId?: string;
  /** Distributed tracing span ID */
  spanId?: string;
  /** Execution priority (0 = lowest, higher = more urgent) */
  priority?: number;
  /** Absolute deadline timestamp (ISO 8601) after which execution must abort */
  deadline?: Timestamp;
  /** External abort signal for cooperative cancellation */
  abortSignal?: AbortSignal;
  /** Additional metadata for the execution context */
  metadata: Record<string, unknown>;
}

/**
 * Result of executing an intent handler
 *
 * Contains execution outcomes, resource consumption, timing,
 * and optional proof chain hash for the evidence trail.
 */
export interface ExecutionResult {
  /** Unique execution identifier */
  executionId: ID;
  /** ID of the intent that was executed */
  intentId: ID;
  /** Tenant this execution belongs to */
  tenantId: ID;
  /** Final execution status */
  status: ExecutionStatus;
  /** Handler output data */
  outputs: Record<string, unknown>;
  /** Actual resource usage during execution */
  resourceUsage: ResourceUsage;
  /** When execution started (ISO 8601) */
  startedAt: Timestamp;
  /** When execution completed (ISO 8601) */
  completedAt: Timestamp;
  /** Total duration in milliseconds */
  durationMs: number;
  /** Error information if execution failed */
  error?: ExecutionError;
  /** Number of retry attempts before final result */
  retryCount: number;
  /** Name of the handler that was invoked */
  handlerName: string;
  /** Cryptographic hash for proof chain integration */
  proofHash?: string;
  /** Additional result metadata */
  metadata: Record<string, unknown>;
}

/**
 * Structured error information from execution
 */
export interface ExecutionError {
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Stack trace (only in non-production environments) */
  stack?: string;
  /** Additional error details */
  details?: Record<string, unknown>;
  /** Whether this error is retryable */
  retryable: boolean;
}

/**
 * Persistent execution record for database storage
 *
 * Extends ExecutionResult with database metadata including
 * versioning, soft deletion, and timestamps.
 */
export interface ExecutionRecord {
  /** Database record ID */
  id: ID;
  /** Unique execution identifier */
  executionId: ID;
  /** ID of the intent that was executed */
  intentId: ID;
  /** Tenant this execution belongs to */
  tenantId: ID;
  /** Final execution status */
  status: ExecutionStatus;
  /** Handler output data */
  outputs: Record<string, unknown>;
  /** Actual resource usage during execution */
  resourceUsage: ResourceUsage;
  /** When execution started (ISO 8601) */
  startedAt: Timestamp;
  /** When execution completed (ISO 8601) */
  completedAt: Timestamp;
  /** Total duration in milliseconds */
  durationMs: number;
  /** Error information if execution failed */
  error?: ExecutionError;
  /** Number of retry attempts before final result */
  retryCount: number;
  /** Name of the handler that was invoked */
  handlerName: string;
  /** Cryptographic hash for proof chain integration */
  proofHash?: string;
  /** Additional result metadata */
  metadata: Record<string, unknown>;
  /** Record version for optimistic concurrency control */
  version: number;
  /** When this record was created (ISO 8601) */
  createdAt: Timestamp;
  /** When this record was last updated (ISO 8601) */
  updatedAt: Timestamp;
  /** Soft delete timestamp for GDPR compliance (ISO 8601) */
  deletedAt?: Timestamp | null;
}

// =============================================================================
// HANDLER TYPES
// =============================================================================

/**
 * Generic execution handler function type
 *
 * Handlers receive the approved intent and a context object,
 * and return output data to be included in the execution result.
 *
 * @template TInput - Type of the intent context data
 * @template TOutput - Type of the handler output data
 */
export type ExecutionHandler<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput extends Record<string, unknown> = Record<string, unknown>,
> = (
  intent: Intent,
  context: TInput,
  signal: AbortSignal
) => Promise<TOutput>;

/**
 * Definition for registering an execution handler
 *
 * Provides handler metadata, supported intent types, default
 * resource limits, and operational configuration.
 */
export interface HandlerDefinition {
  /** Unique handler name (used for routing) */
  name: string;
  /** Semantic version of this handler */
  version: string;
  /** Intent types this handler can process */
  intentTypes: string[];
  /** The handler function to invoke */
  handler: ExecutionHandler;
  /** Default resource limits for this handler (merged with global defaults) */
  resourceDefaults?: Partial<ResourceLimits>;
  /** Optional health check function for readiness probes */
  healthCheck?: () => Promise<boolean>;
  /** Handler-specific timeout override in milliseconds */
  timeout?: number;
  /** Retry policy for transient handler failures */
  retryPolicy?: RetryPolicy;
  /** Handler description for documentation */
  description?: string;
  /** Additional handler metadata */
  metadata: Record<string, unknown>;
}

/**
 * Handler registration state (definition + runtime tracking)
 *
 * Tracks handler lifecycle including registration time,
 * operational status, and execution statistics.
 */
export interface HandlerRegistration {
  /** The handler definition */
  definition: HandlerDefinition;
  /** When this handler was registered (ISO 8601) */
  registeredAt: Timestamp;
  /** Current handler status */
  status: 'active' | 'inactive' | 'degraded' | 'draining';
  /** Total number of executions processed */
  executionCount: number;
  /** Total number of failed executions */
  failureCount: number;
  /** When this handler was last invoked (ISO 8601) */
  lastExecutedAt?: Timestamp;
  /** Average execution duration in milliseconds */
  avgDurationMs?: number;
}

/**
 * Retry policy configuration for handler failures
 *
 * Defines how transient failures are retried with
 * exponential backoff and jitter.
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial backoff delay in milliseconds */
  backoffMs: number;
  /** Multiplier applied to backoff on each retry */
  backoffMultiplier: number;
  /** Maximum backoff delay in milliseconds (cap) */
  maxBackoffMs: number;
  /** Error codes/messages that are eligible for retry */
  retryableErrors: string[];
}

// =============================================================================
// SANDBOX TYPES
// =============================================================================

/**
 * Isolation levels for sandboxed execution
 */
export const ISOLATION_LEVELS = ['none', 'process', 'container', 'vm'] as const;
export type IsolationLevel = (typeof ISOLATION_LEVELS)[number];

/**
 * Sandbox configuration for isolated execution
 *
 * Controls the isolation boundary and access policies
 * for handler execution environments.
 */
export interface SandboxConfig {
  /** Whether sandboxing is enabled */
  enabled: boolean;
  /** Level of process isolation */
  isolationLevel: IsolationLevel;
  /** Module names allowed in the sandbox (whitelist) */
  allowedModules: string[];
  /** Module names denied in the sandbox (blacklist, takes precedence) */
  deniedModules: string[];
  /** Environment variables available to the sandbox */
  environmentVariables: Record<string, string>;
  /** Working directory for the sandboxed process */
  workingDirectory?: string;
  /** Network access policy */
  networkPolicy: NetworkPolicy;
}

/**
 * Network access policy for sandboxed execution
 *
 * Controls which hosts can be reached, connection limits,
 * and timeout behavior for outbound network access.
 */
export interface NetworkPolicy {
  /** Whether outbound network access is allowed */
  allowOutbound: boolean;
  /** Hosts that are explicitly allowed (whitelist) */
  allowedHosts: string[];
  /** Hosts that are explicitly denied (blacklist, takes precedence) */
  deniedHosts: string[];
  /** Maximum concurrent connections per host */
  maxConnectionsPerHost: number;
  /** Default timeout for network connections in milliseconds */
  timeoutMs: number;
}

/**
 * Violation types detected during sandboxed execution
 */
export const SANDBOX_VIOLATION_TYPES = [
  'module_access',
  'network_access',
  'filesystem_access',
  'resource_limit',
  'environment_access',
  'process_spawn',
] as const;

export type SandboxViolationType = (typeof SANDBOX_VIOLATION_TYPES)[number];

/**
 * Record of a sandbox policy violation
 *
 * Captures details of a security boundary breach
 * during handler execution.
 */
export interface SandboxViolation {
  /** Type of violation detected */
  type: SandboxViolationType;
  /** Resource that was accessed or attempted */
  resource: string;
  /** Configured limit that was breached */
  limit: string | number;
  /** Actual value that triggered the violation */
  actual: string | number;
  /** When the violation occurred (ISO 8601) */
  timestamp: Timestamp;
  /** Execution that caused the violation */
  executionId: ID;
  /** Additional violation context */
  details?: Record<string, unknown>;
}

// =============================================================================
// BULKHEAD TYPES
// =============================================================================

/**
 * Bulkhead configuration for concurrency isolation
 *
 * Implements the bulkhead pattern to prevent a single handler
 * or tenant from consuming all execution capacity.
 */
export interface BulkheadConfig {
  /** Maximum number of concurrent executions */
  maxConcurrent: number;
  /** Maximum number of queued executions waiting for capacity */
  maxQueued: number;
  /** Maximum execution time before forced termination (ms) */
  executionTimeoutMs: number;
  /** Maximum time a request can wait in the queue (ms) */
  queueTimeoutMs: number;
  /** Whether to apply per-tenant isolation */
  perTenant: boolean;
  /** Whether to apply per-handler isolation */
  perHandler: boolean;
}

/**
 * Current bulkhead operational status
 *
 * Provides runtime visibility into bulkhead capacity
 * and rejection metrics.
 */
export interface BulkheadStatus {
  /** Bulkhead name/identifier */
  name: string;
  /** Number of currently active executions */
  active: number;
  /** Number of executions waiting in queue */
  queued: number;
  /** Maximum concurrent execution capacity */
  maxConcurrent: number;
  /** Maximum queue depth */
  maxQueued: number;
  /** Total number of rejected executions */
  rejectedCount: number;
  /** Total number of queue timeout rejections */
  queueTimeoutCount: number;
  /** Average wait time in queue (ms) */
  avgQueueWaitMs: number;
}

// =============================================================================
// ACTIVE EXECUTION TRACKING
// =============================================================================

/**
 * Represents a currently running execution
 *
 * Tracked in-memory for lifecycle management, resource
 * monitoring, and graceful shutdown coordination.
 */
export interface ActiveExecution {
  /** Unique execution identifier */
  executionId: ID;
  /** Tenant this execution belongs to */
  tenantId: ID;
  /** ID of the intent being executed */
  intentId: ID;
  /** Name of the handler processing this execution */
  handlerName: string;
  /** Current execution status */
  status: ExecutionStatus;
  /** When execution started (ISO 8601) */
  startedAt: Timestamp;
  /** Absolute deadline for execution completion */
  deadline: number;
  /** AbortController for termination */
  abortController: AbortController;
  /** Current resource usage snapshot */
  resourceUsage: ResourceUsage;
  /** Resource limits for this execution */
  resourceLimits: ResourceLimits;
  /** Execution priority */
  priority: number;
  /** Current retry attempt (0-based) */
  retryCount: number;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Complete Cognigate service configuration
 *
 * Defines defaults for resource limits, sandbox behavior,
 * bulkhead concurrency, circuit breaker resilience, caching,
 * audit logging, and operational parameters.
 */
export interface CognigateConfig {
  /** Default resource limits applied to all executions */
  defaultResourceLimits: ResourceLimits;
  /** Sandbox configuration for execution isolation */
  sandbox: Partial<SandboxConfig>;
  /** Bulkhead configuration for concurrency control */
  bulkhead: BulkheadConfig;
  /** Circuit breaker configuration for handler resilience */
  circuitBreaker: {
    /** Number of failures before opening the circuit */
    failureThreshold: number;
    /** Time before attempting to close the circuit (ms) */
    resetTimeoutMs: number;
    /** Maximum attempts in half-open state */
    halfOpenMaxAttempts: number;
    /** Monitoring window for failures (ms) */
    monitorWindowMs: number;
  };
  /** Execution result caching configuration */
  cache: {
    /** Whether caching is enabled */
    enabled: boolean;
    /** Time-to-live for cached results (ms) */
    ttlMs: number;
    /** Maximum number of cached entries */
    maxSize: number;
  };
  /** Audit logging configuration */
  audit: {
    /** Whether audit logging is enabled */
    enabled: boolean;
    /** Number of audit entries to batch before flushing */
    batchSize: number;
    /** Interval between audit flushes (ms) */
    flushIntervalMs: number;
  };
  /** Whether metrics collection is enabled */
  metricsEnabled: boolean;
  /** Maximum time to wait for active executions during shutdown (ms) */
  gracefulShutdownTimeoutMs: number;
  /** Number of days to retain execution history records */
  maxExecutionHistoryDays: number;
  /** Resource monitoring thresholds */
  resourceThresholds?: ResourceThreshold[];
}

// =============================================================================
// AUDIT TYPES
// =============================================================================

/**
 * Types of execution events that are audited
 */
export const EXECUTION_EVENT_TYPES = [
  'execution_started',
  'execution_completed',
  'execution_failed',
  'resource_warning',
  'resource_breach',
  'handler_timeout',
  'sandbox_violation',
  'execution_terminated',
  'execution_paused',
  'execution_resumed',
  'retry_attempted',
] as const;

export type ExecutionEventType = (typeof EXECUTION_EVENT_TYPES)[number];

/**
 * Audit severity levels for execution events
 */
export const EXECUTION_AUDIT_SEVERITIES = ['info', 'warning', 'error', 'critical'] as const;
export type ExecutionAuditSeverity = (typeof EXECUTION_AUDIT_SEVERITIES)[number];

/**
 * Audit outcomes for execution events
 */
export const EXECUTION_AUDIT_OUTCOMES = ['success', 'failure', 'partial', 'terminated'] as const;
export type ExecutionAuditOutcome = (typeof EXECUTION_AUDIT_OUTCOMES)[number];

/**
 * Complete audit entry for an execution event
 *
 * Provides a full audit trail of execution lifecycle events
 * for compliance, debugging, and observability.
 */
export interface ExecutionAuditEntry {
  /** Unique audit entry identifier */
  id: ID;
  /** Tenant this entry belongs to */
  tenantId: ID;
  /** Execution that generated this event */
  executionId: ID;
  /** Intent associated with this execution */
  intentId: ID;
  /** Type of execution event */
  eventType: ExecutionEventType;
  /** Severity level of this event */
  severity: ExecutionAuditSeverity;
  /** Outcome of the event */
  outcome: ExecutionAuditOutcome;
  /** Action that was taken */
  action: ControlAction;
  /** Human-readable reason for the event */
  reason: string;
  /** Name of the handler involved */
  handlerName: string;
  /** Resource usage at event time */
  resourceUsage?: ResourceUsage;
  /** Sandbox violation details (if applicable) */
  violation?: SandboxViolation;
  /** Request ID for correlation */
  requestId?: ID;
  /** Distributed tracing trace ID */
  traceId?: string;
  /** Distributed tracing span ID */
  spanId?: string;
  /** Additional event metadata */
  metadata?: Record<string, unknown>;
  /** When the event occurred (ISO 8601) */
  eventTime: Timestamp;
  /** When the audit record was written (ISO 8601) */
  recordedAt: Timestamp;
}

// =============================================================================
// ESCALATION TYPES
// =============================================================================

/**
 * Escalation priorities for execution issues
 */
export const EXECUTION_ESCALATION_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type ExecutionEscalationPriority = (typeof EXECUTION_ESCALATION_PRIORITIES)[number];

/**
 * Escalation statuses
 */
export const EXECUTION_ESCALATION_STATUSES = [
  'pending',
  'acknowledged',
  'resolved',
  'expired',
] as const;
export type ExecutionEscalationStatus = (typeof EXECUTION_ESCALATION_STATUSES)[number];

/**
 * Escalation triggered by execution issues
 *
 * Created when resource violations, handler failures, or
 * security issues require human review.
 */
export interface ExecutionEscalation {
  /** Unique escalation identifier */
  id: ID;
  /** Execution that triggered this escalation */
  executionId: ID;
  /** Tenant this escalation belongs to */
  tenantId: ID;
  /** Intent associated with the execution */
  intentId: ID;
  /** Reason for escalation */
  reason: string;
  /** Priority level of this escalation */
  priority: ExecutionEscalationPriority;
  /** Target group or user for escalation */
  escalatedTo: string;
  /** Current escalation status */
  status: ExecutionEscalationStatus;
  /** Sandbox violation that triggered escalation (if applicable) */
  violation?: SandboxViolation;
  /** Who resolved this escalation */
  resolvedBy?: string;
  /** When this escalation was resolved (ISO 8601) */
  resolvedAt?: Timestamp;
  /** Resolution notes */
  resolutionNotes?: string;
  /** Timeout duration (ISO 8601 duration format) */
  timeout: string;
  /** Absolute timeout timestamp (ISO 8601) */
  timeoutAt: Timestamp;
  /** Additional escalation metadata */
  metadata: Record<string, unknown>;
  /** When this escalation was created (ISO 8601) */
  createdAt: Timestamp;
}

// =============================================================================
// HEALTH TYPES
// =============================================================================

/**
 * Health status levels
 */
export const HEALTH_STATUSES = ['healthy', 'degraded', 'unhealthy'] as const;
export type HealthStatus = (typeof HEALTH_STATUSES)[number];

/**
 * Individual health check result
 */
export interface HealthCheck {
  /** Name of the component being checked */
  name: string;
  /** Health status of the component */
  status: HealthStatus;
  /** Human-readable status message */
  message?: string;
  /** When this check was last performed (ISO 8601) */
  lastCheckedAt: Timestamp;
  /** Duration of the health check in milliseconds */
  durationMs?: number;
}

/**
 * Overall Cognigate health status
 *
 * Aggregates health of all subsystems including handlers,
 * bulkhead, sandbox, cache, and circuit breakers.
 */
export interface CognigateHealthStatus {
  /** Overall health status */
  status: HealthStatus;
  /** Individual component health checks */
  checks: {
    /** Handler subsystem health */
    handlers: HealthCheck;
    /** Bulkhead subsystem health */
    bulkhead: HealthCheck;
    /** Sandbox subsystem health */
    sandbox: HealthCheck;
    /** Cache subsystem health */
    cache: HealthCheck;
    /** Circuit breaker subsystem health */
    circuitBreakers: HealthCheck;
  };
  /** Service uptime in milliseconds */
  uptime: number;
  /** Number of currently active executions */
  activeExecutions: number;
  /** Number of executions waiting in queue */
  queuedExecutions: number;
  /** Total executions since startup */
  totalExecutions: number;
  /** Total failures since startup */
  totalFailures: number;
}

/**
 * Cognigate readiness status for orchestration probes
 */
export interface CognigateReadinessStatus {
  /** Whether the service is ready to accept executions */
  ready: boolean;
  /** Individual readiness checks */
  checks: {
    /** Whether handlers are registered and active */
    handlersReady: boolean;
    /** Whether bulkhead has available capacity */
    bulkheadReady: boolean;
    /** Whether sandbox is initialized */
    sandboxReady: boolean;
    /** Whether circuit breakers are in closed state */
    circuitBreakersReady: boolean;
  };
  /** When the service started (ISO 8601) */
  startedAt: Timestamp;
  /** Time since service started in milliseconds */
  uptimeMs: number;
}

// =============================================================================
// METRICS INTERFACE
// =============================================================================

/**
 * Cognigate metrics interface
 *
 * Defines the contract for metrics collection. Implementation
 * is provided by the metrics module (./metrics.ts).
 */
export interface CognigateMetrics {
  /** Record an execution start event */
  recordExecutionStart(tenantId: ID, handlerName: string): void;
  /** Record an execution completion event */
  recordExecutionComplete(tenantId: ID, handlerName: string, durationMs: number, status: ExecutionStatus): void;
  /** Record a handler registration event */
  recordHandlerRegistration(handlerName: string): void;
  /** Record a bulkhead rejection */
  recordBulkheadRejection(tenantId: ID, reason: string): void;
  /** Record a resource threshold warning */
  recordResourceWarning(executionId: ID, resource: ResourceType, usage: number, limit: number): void;
  /** Record a resource threshold breach */
  recordResourceBreach(executionId: ID, resource: ResourceType, usage: number, limit: number): void;
  /** Record a sandbox violation */
  recordSandboxViolation(executionId: ID, violation: SandboxViolation): void;
  /** Record a retry attempt */
  recordRetryAttempt(executionId: ID, attempt: number, error: string): void;
  /** Record a cache hit */
  recordCacheHit(tenantId: ID): void;
  /** Record a cache miss */
  recordCacheMiss(tenantId: ID): void;
  /** Record execution termination */
  recordTermination(executionId: ID, reason: string): void;
}

// =============================================================================
// CACHE TYPES
// =============================================================================

/**
 * Cached execution result entry
 */
export interface ExecutionCacheEntry {
  /** The cached execution result */
  result: ExecutionResult;
  /** When this entry was cached (Unix ms) */
  cachedAt: number;
  /** When this entry expires (Unix ms) */
  expiresAt: number;
  /** Number of cache hits for this entry */
  hitCount: number;
}

/**
 * Cache key components for execution result caching
 */
export interface ExecutionCacheKey {
  /** Tenant ID */
  tenantId: ID;
  /** Intent ID */
  intentId: ID;
  /** Handler name */
  handlerName: string;
  /** Hash of the intent context for cache invalidation */
  contextHash: string;
}

// =============================================================================
// CUSTOM ERROR CLASSES
// =============================================================================

/**
 * Error thrown when execution exceeds its configured timeout
 */
export class ExecutionTimeoutError extends VorionError {
  constructor(
    executionId: ID,
    timeoutMs: number,
    elapsedMs: number
  ) {
    super(
      `Execution ${executionId} timed out after ${elapsedMs}ms (limit: ${timeoutMs}ms)`,
      'EXECUTION_TIMEOUT',
      { executionId, timeoutMs, elapsedMs }
    );
    this.name = 'ExecutionTimeoutError';
  }
}

/**
 * Error thrown when execution exceeds a resource limit
 */
export class ResourceExceededError extends VorionError {
  public readonly resource: ResourceType;
  public readonly limit: number;
  public readonly actual: number;

  constructor(
    executionId: ID,
    resource: ResourceType,
    limit: number,
    actual: number
  ) {
    super(
      `Execution ${executionId} exceeded ${resource} limit: ${actual} > ${limit}`,
      'RESOURCE_EXCEEDED',
      { executionId, resource, limit, actual }
    );
    this.name = 'ResourceExceededError';
    this.resource = resource;
    this.limit = limit;
    this.actual = actual;
  }
}

/**
 * Error thrown when a sandbox policy is violated
 */
export class SandboxViolationError extends VorionError {
  constructor(
    executionId: ID,
    violation: SandboxViolation
  ) {
    super(
      `Sandbox violation in execution ${executionId}: ${violation.type} on ${violation.resource}`,
      'SANDBOX_VIOLATION',
      { executionId, violation }
    );
    this.name = 'SandboxViolationError';
  }
}

/**
 * Error thrown when no handler is found for an intent type
 */
export class HandlerNotFoundError extends VorionError {
  constructor(
    intentType: string,
    handlerName?: string
  ) {
    super(
      handlerName
        ? `Handler '${handlerName}' not found`
        : `No handler registered for intent type '${intentType}'`,
      'HANDLER_NOT_FOUND',
      { intentType, handlerName }
    );
    this.name = 'HandlerNotFoundError';
  }
}

/**
 * Error thrown when an execution is externally terminated
 */
export class ExecutionTerminatedError extends VorionError {
  constructor(
    executionId: ID,
    reason: string
  ) {
    super(
      `Execution ${executionId} was terminated: ${reason}`,
      'EXECUTION_TERMINATED',
      { executionId, reason }
    );
    this.name = 'ExecutionTerminatedError';
  }
}

/**
 * Error thrown when bulkhead capacity is exceeded
 */
export class BulkheadRejectedError extends VorionError {
  constructor(
    tenantId: ID,
    active: number,
    maxConcurrent: number,
    queued: number,
    maxQueued: number
  ) {
    super(
      `Bulkhead capacity exceeded for tenant ${tenantId}: ${active}/${maxConcurrent} active, ${queued}/${maxQueued} queued`,
      'BULKHEAD_REJECTED',
      { tenantId, active, maxConcurrent, queued, maxQueued }
    );
    this.name = 'BulkheadRejectedError';
  }
}

/**
 * Error thrown when execution context validation fails
 */
export class ExecutionContextError extends VorionError {
  constructor(
    message: string,
    field: string,
    value?: unknown
  ) {
    super(
      `Invalid execution context: ${message}`,
      'EXECUTION_CONTEXT_INVALID',
      { field, value }
    );
    this.name = 'ExecutionContextError';
  }
}
