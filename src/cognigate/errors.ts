/**
 * COGNIGATE Module Error Taxonomy
 *
 * Structured error hierarchy for the cognigate execution engine providing:
 * - Base error class with structured logging support
 * - HTTP status code mapping for API responses
 * - Operational vs programmer error distinction
 * - Error code constants for programmatic identification
 * - Type guards and factory helpers
 * - Fastify error handler integration
 *
 * Error categories:
 * - Execution lifecycle (validation, not found, conflict, timeout, terminated)
 * - Resource management (exhausted, bulkhead rejected, rate limited)
 * - Security (sandbox violation)
 * - Infrastructure (database, circuit open)
 * - Handler management (registration, invocation)
 *
 * @packageDocumentation
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '../common/logger.js';

const logger = createLogger({ module: 'cognigate', component: 'error-handler' });

// =============================================================================
// ERROR CODES
// =============================================================================

/**
 * Standardized error codes for the cognigate module.
 * All codes are prefixed with COGNIGATE_ for namespace isolation.
 */
export const COGNIGATE_ERROR_CODES = {
  VALIDATION_ERROR: 'COGNIGATE_VALIDATION_ERROR',
  NOT_FOUND: 'COGNIGATE_NOT_FOUND',
  CONFLICT: 'COGNIGATE_CONFLICT',
  TIMEOUT: 'COGNIGATE_TIMEOUT',
  TERMINATED: 'COGNIGATE_TERMINATED',
  RESOURCE_EXHAUSTED: 'COGNIGATE_RESOURCE_EXHAUSTED',
  SANDBOX_VIOLATION: 'COGNIGATE_SANDBOX_VIOLATION',
  HANDLER_ERROR: 'COGNIGATE_HANDLER_ERROR',
  BULKHEAD_REJECTED: 'COGNIGATE_BULKHEAD_REJECTED',
  RATE_LIMITED: 'COGNIGATE_RATE_LIMITED',
  DATABASE_ERROR: 'COGNIGATE_DATABASE_ERROR',
  CIRCUIT_OPEN: 'COGNIGATE_CIRCUIT_OPEN',
} as const;

export type CognigateErrorCode = typeof COGNIGATE_ERROR_CODES[keyof typeof COGNIGATE_ERROR_CODES];

// =============================================================================
// BASE ERROR CLASS
// =============================================================================

/**
 * Base error for all cognigate module errors.
 *
 * Provides structured error information suitable for both API responses
 * and structured logging. Distinguishes between operational errors
 * (expected failures like validation or timeouts) and programmer errors
 * (bugs in handler code or integration issues).
 *
 * @example
 * ```typescript
 * throw new CognigateError(
 *   'Execution parameter missing required field',
 *   COGNIGATE_ERROR_CODES.VALIDATION_ERROR,
 *   400,
 *   { executionId: 'exec_123', field: 'payload' }
 * );
 * ```
 */
export class CognigateError extends Error {
  /** Machine-readable error code (COGNIGATE_* prefixed) */
  public readonly code: string;
  /** HTTP status code for API responses */
  public readonly statusCode: number;
  /** Whether this is an operational error (expected) vs programmer error (bug) */
  public readonly isOperational: boolean;
  /** Additional context for debugging and structured logging */
  public readonly context: Record<string, unknown>;
  /** ISO 8601 timestamp of when the error was created */
  public readonly timestamp: string;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    context: Record<string, unknown> = {},
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'CognigateError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;
    this.timestamp = new Date().toISOString();

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Serialize error for structured logging and API responses.
   * Excludes stack trace for security in production environments.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      timestamp: this.timestamp,
      ...(Object.keys(this.context).length > 0 && { context: this.context }),
    };
  }
}

// =============================================================================
// EXECUTION LIFECYCLE ERRORS
// =============================================================================

/**
 * Validation error for invalid execution parameters (400 Bad Request).
 *
 * Used when execution request payloads fail schema validation, contain
 * invalid handler references, or violate execution parameter constraints.
 */
export class ExecutionValidationError extends CognigateError {
  /** The field(s) that failed validation, if identifiable */
  public readonly field?: string | undefined;
  /** Detailed validation failures when multiple fields are invalid */
  public readonly violations?: ReadonlyArray<{ field: string; message: string }> | undefined;

  constructor(
    message: string,
    context: Record<string, unknown> = {},
    field?: string,
    violations?: ReadonlyArray<{ field: string; message: string }>
  ) {
    super(
      message,
      COGNIGATE_ERROR_CODES.VALIDATION_ERROR,
      400,
      { ...context, ...(field !== undefined ? { field } : {}), ...(violations !== undefined ? { violations } : {}) }
    );
    this.name = 'ExecutionValidationError';
    this.field = field;
    this.violations = violations;
  }
}

/**
 * Not found error for missing executions or handlers (404 Not Found).
 *
 * Used when an execution, handler, or other cognigate resource cannot
 * be located by the provided identifier.
 */
export class ExecutionNotFoundError extends CognigateError {
  /** The type of resource that was not found */
  public readonly resource: string;
  /** The identifier used to look up the resource */
  public readonly resourceId: string;

  constructor(resource: string, resourceId: string, context: Record<string, unknown> = {}) {
    super(
      `${resource} not found: ${resourceId}`,
      COGNIGATE_ERROR_CODES.NOT_FOUND,
      404,
      { ...context, resource, resourceId }
    );
    this.name = 'ExecutionNotFoundError';
    this.resource = resource;
    this.resourceId = resourceId;
  }
}

/**
 * Conflict error for execution state conflicts (409 Conflict).
 *
 * Used for duplicate execution attempts, invalid state transitions,
 * or concurrent modification conflicts in execution state.
 */
export class ExecutionConflictError extends CognigateError {
  /** The current state of the execution, if available */
  public readonly currentState?: string | undefined;
  /** The target state that was rejected */
  public readonly targetState?: string | undefined;

  constructor(
    message: string,
    context: Record<string, unknown> = {},
    currentState?: string,
    targetState?: string
  ) {
    super(
      message,
      COGNIGATE_ERROR_CODES.CONFLICT,
      409,
      {
        ...context,
        ...(currentState !== undefined ? { currentState } : {}),
        ...(targetState !== undefined ? { targetState } : {}),
      }
    );
    this.name = 'ExecutionConflictError';
    this.currentState = currentState;
    this.targetState = targetState;
  }
}

/**
 * Timeout error for executions that exceed their time budget (504 Gateway Timeout).
 *
 * Used when an execution or handler invocation exceeds the configured
 * timeout, requiring termination and cleanup.
 */
export class ExecutionTimeoutError extends CognigateError {
  /** The timeout duration in milliseconds that was exceeded */
  public readonly timeoutMs: number;
  /** The execution ID that timed out, if available */
  public readonly executionId?: string | undefined;

  constructor(
    message: string,
    timeoutMs: number,
    context: Record<string, unknown> = {},
    executionId?: string
  ) {
    super(
      message,
      COGNIGATE_ERROR_CODES.TIMEOUT,
      504,
      { ...context, timeoutMs, ...(executionId !== undefined ? { executionId } : {}) }
    );
    this.name = 'ExecutionTimeoutError';
    this.timeoutMs = timeoutMs;
    this.executionId = executionId;
  }
}

/**
 * Terminated error for executions that were explicitly stopped (410 Gone).
 *
 * Used when an execution is terminated by an external signal, administrative
 * action, or system shutdown procedure. The execution will not resume.
 */
export class ExecutionTerminatedError extends CognigateError {
  /** The reason the execution was terminated */
  public readonly reason: string;
  /** The actor or system that initiated termination */
  public readonly terminatedBy?: string | undefined;

  constructor(
    message: string,
    reason: string,
    context: Record<string, unknown> = {},
    terminatedBy?: string
  ) {
    super(
      message,
      COGNIGATE_ERROR_CODES.TERMINATED,
      410,
      { ...context, reason, ...(terminatedBy !== undefined ? { terminatedBy } : {}) }
    );
    this.name = 'ExecutionTerminatedError';
    this.reason = reason;
    this.terminatedBy = terminatedBy;
  }
}

// =============================================================================
// RESOURCE MANAGEMENT ERRORS
// =============================================================================

/**
 * Resource exhausted error for exceeded limits (429 Too Many Requests).
 *
 * Used when system resource limits are exceeded, such as memory quotas,
 * execution count limits, or payload size restrictions.
 */
export class ResourceExhaustedError extends CognigateError {
  /** The type of resource that was exhausted */
  public readonly resourceType: string;
  /** The limit that was exceeded */
  public readonly limit: number;
  /** The current usage at the time of the error */
  public readonly current?: number | undefined;

  constructor(
    message: string,
    resourceType: string,
    limit: number,
    context: Record<string, unknown> = {},
    current?: number
  ) {
    super(
      message,
      COGNIGATE_ERROR_CODES.RESOURCE_EXHAUSTED,
      429,
      { ...context, resourceType, limit, ...(current !== undefined ? { current } : {}) }
    );
    this.name = 'ResourceExhaustedError';
    this.resourceType = resourceType;
    this.limit = limit;
    this.current = current;
  }
}

/**
 * Bulkhead rejected error when concurrency limits are reached (503 Service Unavailable).
 *
 * Used when the bulkhead pattern rejects new executions because the
 * maximum concurrent execution count has been reached.
 */
export class BulkheadRejectedError extends CognigateError {
  /** The maximum concurrent executions allowed */
  public readonly maxConcurrency: number;
  /** The current number of active executions */
  public readonly activeCount: number;
  /** The bulkhead partition that is full, if partitioned */
  public readonly partition?: string | undefined;

  constructor(
    message: string,
    maxConcurrency: number,
    activeCount: number,
    context: Record<string, unknown> = {},
    partition?: string
  ) {
    super(
      message,
      COGNIGATE_ERROR_CODES.BULKHEAD_REJECTED,
      503,
      { ...context, maxConcurrency, activeCount, ...(partition !== undefined ? { partition } : {}) }
    );
    this.name = 'BulkheadRejectedError';
    this.maxConcurrency = maxConcurrency;
    this.activeCount = activeCount;
    this.partition = partition;
  }
}

/**
 * Rate limit exceeded error (429 Too Many Requests).
 *
 * Used when an execution source, tenant, or handler exceeds its
 * configured rate limit for execution submissions.
 */
export class CognigateRateLimitError extends CognigateError {
  /** Seconds until the rate limit window resets */
  public readonly retryAfter: number;
  /** The rate limit bucket that was exceeded */
  public readonly bucket?: string | undefined;

  constructor(
    message: string,
    retryAfter: number = 60,
    context: Record<string, unknown> = {},
    bucket?: string
  ) {
    super(
      message,
      COGNIGATE_ERROR_CODES.RATE_LIMITED,
      429,
      { ...context, retryAfter, ...(bucket !== undefined ? { bucket } : {}) }
    );
    this.name = 'CognigateRateLimitError';
    this.retryAfter = retryAfter;
    this.bucket = bucket;
  }
}

// =============================================================================
// SECURITY ERRORS
// =============================================================================

/**
 * Sandbox violation error for security boundary breaches (403 Forbidden).
 *
 * Used when a handler execution attempts to access resources or perform
 * operations outside its permitted sandbox boundaries.
 */
export class SandboxViolationError extends CognigateError {
  /** The type of violation detected */
  public readonly violationType: string;
  /** The resource or operation that was attempted */
  public readonly attemptedAccess: string;

  constructor(
    message: string,
    violationType: string,
    attemptedAccess: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      message,
      COGNIGATE_ERROR_CODES.SANDBOX_VIOLATION,
      403,
      { ...context, violationType, attemptedAccess },
      true
    );
    this.name = 'SandboxViolationError';
    this.violationType = violationType;
    this.attemptedAccess = attemptedAccess;
  }
}

// =============================================================================
// HANDLER ERRORS
// =============================================================================

/**
 * Handler error for registration and execution failures (500 Internal Server Error).
 *
 * Used when a handler fails to register, throws an unhandled exception during
 * execution, or encounters an error that prevents normal operation.
 * Programmer errors (non-operational) should set isOperational to false.
 */
export class HandlerError extends CognigateError {
  /** The name of the handler that failed */
  public readonly handlerName: string;
  /** The phase where the error occurred (registration, execution, cleanup) */
  public readonly phase: string;
  /** The underlying cause error, if wrapping another error */
  public readonly cause?: Error | undefined;

  constructor(
    message: string,
    handlerName: string,
    phase: string,
    context: Record<string, unknown> = {},
    cause?: Error,
    isOperational: boolean = false
  ) {
    super(
      message,
      COGNIGATE_ERROR_CODES.HANDLER_ERROR,
      500,
      { ...context, handlerName, phase, ...(cause !== undefined ? { causeMessage: cause.message } : {}) },
      isOperational
    );
    this.name = 'HandlerError';
    this.handlerName = handlerName;
    this.phase = phase;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

// =============================================================================
// INFRASTRUCTURE ERRORS
// =============================================================================

/**
 * Database error for persistence layer failures (503 Service Unavailable).
 *
 * Used when database operations fail due to connectivity issues, constraint
 * violations at the DB level, or other persistence layer errors that prevent
 * execution state management.
 */
export class CognigateDatabaseError extends CognigateError {
  /** The database operation that failed (query, insert, update, delete) */
  public readonly operation: string;
  /** The underlying cause error from the database driver */
  public readonly cause?: Error | undefined;

  constructor(
    message: string,
    operation: string,
    context: Record<string, unknown> = {},
    cause?: Error
  ) {
    super(
      message,
      COGNIGATE_ERROR_CODES.DATABASE_ERROR,
      503,
      { ...context, operation, ...(cause !== undefined ? { causeMessage: cause.message } : {}) }
    );
    this.name = 'CognigateDatabaseError';
    this.operation = operation;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

/**
 * Circuit breaker open error (503 Service Unavailable).
 *
 * Used when the circuit breaker for an external dependency or handler pool
 * is in the open state, indicating that the service is temporarily unavailable
 * and requests should not be forwarded.
 */
export class CognigateCircuitOpenError extends CognigateError {
  /** The name of the circuit that is open */
  public readonly circuitName: string;
  /** Estimated time until the circuit may transition to half-open, in milliseconds */
  public readonly resetAfterMs?: number | undefined;

  constructor(
    circuitName: string,
    context: Record<string, unknown> = {},
    resetAfterMs?: number
  ) {
    super(
      `Circuit breaker '${circuitName}' is open; executions temporarily unavailable`,
      COGNIGATE_ERROR_CODES.CIRCUIT_OPEN,
      503,
      { ...context, circuitName, ...(resetAfterMs !== undefined ? { resetAfterMs } : {}) }
    );
    this.name = 'CognigateCircuitOpenError';
    this.circuitName = circuitName;
    if (resetAfterMs !== undefined) {
      this.resetAfterMs = resetAfterMs;
    }
  }
}

// =============================================================================
// TYPE GUARD
// =============================================================================

/**
 * Type guard to check if an unknown error is a CognigateError.
 *
 * Useful in catch blocks and error handlers to narrow error types
 * before accessing cognigate-specific properties.
 *
 * @example
 * ```typescript
 * try {
 *   await executeHandler(params);
 * } catch (err) {
 *   if (isCognigateError(err)) {
 *     logger.warn({ code: err.code, context: err.context }, err.message);
 *   }
 * }
 * ```
 */
export function isCognigateError(error: unknown): error is CognigateError {
  return error instanceof CognigateError;
}

// =============================================================================
// ERROR FACTORY HELPERS
// =============================================================================

/**
 * Create a not-found error for a missing execution.
 *
 * @param executionId - The execution identifier that was not found
 */
export function createExecutionNotFound(executionId: string): ExecutionNotFoundError {
  return new ExecutionNotFoundError('Execution', executionId);
}

/**
 * Create a not-found error for a missing handler.
 *
 * @param handlerName - The handler name that was not found in the registry
 */
export function createHandlerNotFound(handlerName: string): ExecutionNotFoundError {
  return new ExecutionNotFoundError('Handler', handlerName);
}

/**
 * Create a rate limit error with retry information.
 *
 * @param retryAfter - Seconds until the rate limit window resets
 * @param bucket - Optional rate limit bucket identifier
 */
export function createRateLimited(retryAfter: number, bucket?: string): CognigateRateLimitError {
  return new CognigateRateLimitError(
    `Rate limit exceeded; retry after ${retryAfter} seconds`,
    retryAfter,
    {},
    bucket
  );
}

/**
 * Create a timeout error for an execution that exceeded its time budget.
 *
 * @param executionId - The execution that timed out
 * @param timeoutMs - The timeout duration in milliseconds that was exceeded
 */
export function createTimeout(executionId: string, timeoutMs: number): ExecutionTimeoutError {
  return new ExecutionTimeoutError(
    `Execution '${executionId}' exceeded timeout of ${timeoutMs}ms`,
    timeoutMs,
    {},
    executionId
  );
}

/**
 * Create a conflict error for a duplicate execution submission.
 *
 * @param executionId - The execution ID that already exists
 * @param currentState - The current state of the existing execution
 */
export function createDuplicateExecution(
  executionId: string,
  currentState: string
): ExecutionConflictError {
  return new ExecutionConflictError(
    `Execution '${executionId}' already exists in state '${currentState}'`,
    { executionId },
    currentState
  );
}

/**
 * Create a bulkhead rejected error with capacity details.
 *
 * @param maxConcurrency - The maximum allowed concurrent executions
 * @param activeCount - The current number of active executions
 * @param partition - Optional bulkhead partition name
 */
export function createBulkheadRejected(
  maxConcurrency: number,
  activeCount: number,
  partition?: string
): BulkheadRejectedError {
  const partitionMsg = partition !== undefined ? ` in partition '${partition}'` : '';
  return new BulkheadRejectedError(
    `Concurrency limit reached${partitionMsg}: ${activeCount}/${maxConcurrency} active executions`,
    maxConcurrency,
    activeCount,
    {},
    partition
  );
}

/**
 * Create a sandbox violation error for an unauthorized access attempt.
 *
 * @param violationType - The category of violation (filesystem, network, process, etc.)
 * @param attemptedAccess - Description of what was attempted
 * @param handlerName - The handler that attempted the violation
 */
export function createSandboxViolation(
  violationType: string,
  attemptedAccess: string,
  handlerName: string
): SandboxViolationError {
  return new SandboxViolationError(
    `Sandbox violation in handler '${handlerName}': ${violationType} access to '${attemptedAccess}' denied`,
    violationType,
    attemptedAccess,
    { handlerName }
  );
}

/**
 * Create a handler error wrapping an underlying exception.
 *
 * @param handlerName - The handler that threw the error
 * @param phase - The phase where the error occurred
 * @param cause - The underlying error
 */
export function createHandlerError(
  handlerName: string,
  phase: string,
  cause: Error
): HandlerError {
  return new HandlerError(
    `Handler '${handlerName}' failed during ${phase}: ${cause.message}`,
    handlerName,
    phase,
    {},
    cause,
    false
  );
}

// =============================================================================
// FASTIFY ERROR HANDLER
// =============================================================================

/**
 * Fastify error handler for the cognigate module.
 *
 * Handles CognigateError instances with proper HTTP status codes and structured
 * error responses. Unknown errors are sanitized to prevent leaking internal details.
 *
 * Logging strategy:
 * - Operational errors (expected): logged at warn level
 * - Programmer errors (bugs): logged at error level with stack traces
 * - Unknown errors: logged at error level as unhandled
 *
 * @example
 * ```typescript
 * import { cognigateErrorHandler } from './errors.js';
 *
 * const app = fastify();
 * app.setErrorHandler(cognigateErrorHandler);
 * ```
 */
export function cognigateErrorHandler(
  error: Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const requestContext = {
    requestId: request.id,
    method: request.method,
    url: request.url,
  };

  if (isCognigateError(error)) {
    // --- Operational errors: expected failures, logged at warn level ---
    if (error.isOperational) {
      logger.warn(
        {
          err: error,
          code: error.code,
          statusCode: error.statusCode,
          context: error.context,
          ...requestContext,
        },
        `Cognigate operational error: ${error.message}`
      );
    } else {
      // --- Programmer errors: bugs in handler code, logged at error level ---
      logger.error(
        {
          err: error,
          code: error.code,
          statusCode: error.statusCode,
          context: error.context,
          stack: error.stack,
          ...requestContext,
        },
        `Cognigate programmer error: ${error.message}`
      );
    }

    const responseBody: Record<string, unknown> = {
      error: {
        code: error.code,
        message: error.isOperational ? error.message : 'An internal execution error occurred',
        timestamp: error.timestamp,
        ...(error.isOperational && Object.keys(error.context).length > 0 && { details: error.context }),
      },
    };

    // Add Retry-After header for rate limit and resource exhausted errors
    if (error instanceof CognigateRateLimitError) {
      void reply.header('Retry-After', error.retryAfter.toString());
    } else if (error instanceof CognigateCircuitOpenError && error.resetAfterMs !== undefined) {
      void reply.header('Retry-After', Math.ceil(error.resetAfterMs / 1000).toString());
    }

    void reply.status(error.statusCode).send(responseBody);
  } else {
    // --- Unknown errors: not a CognigateError, treat as unhandled ---
    logger.error(
      {
        err: error,
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...requestContext,
      },
      `Unhandled error in cognigate: ${error.message}`
    );

    void reply.status(500).send({
      error: {
        code: 'COGNIGATE_INTERNAL_ERROR',
        message: 'An internal error occurred',
        timestamp: new Date().toISOString(),
      },
    });
  }
}
