/**
 * COGNIGATE Module Distributed Tracing
 *
 * OpenTelemetry-based distributed tracing for constrained execution operations.
 * Provides end-to-end visibility across execution lifecycle, handler invocations,
 * resource checks, sandbox enforcement, and related operations.
 *
 * Features:
 * - Span creation for all execution operations
 * - Trace context propagation across async boundaries
 * - Custom semantic attributes for execution-specific data
 * - Resource usage and violation tracking on spans
 * - Execution result attribute recording
 *
 * @packageDocumentation
 */

import {
  trace,
  context,
  SpanKind,
  SpanStatusCode,
  propagation,
  type Span,
  type Tracer,
  type Context,
  type Attributes,
} from '@opentelemetry/api';
import type { ID } from '../common/types.js';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Tracer name for the cognigate module */
const TRACER_NAME = 'vorion-cognigate';

/** Tracer version */
const TRACER_VERSION = '1.0.0';

/** Semantic attribute prefix */
const ATTR_PREFIX = 'vorion.cognigate';

// =============================================================================
// SEMANTIC ATTRIBUTES
// =============================================================================

/**
 * Standard semantic attributes for Cognigate tracing
 */
export const CognigateSemanticAttributes = {
  // Execution attributes
  EXECUTION_ID: `${ATTR_PREFIX}.execution.id`,
  EXECUTION_STATUS: `${ATTR_PREFIX}.execution.status`,
  EXECUTION_HANDLER: `${ATTR_PREFIX}.execution.handler`,
  EXECUTION_HANDLER_VERSION: `${ATTR_PREFIX}.execution.handler_version`,
  EXECUTION_DURATION_MS: `${ATTR_PREFIX}.execution.duration_ms`,
  EXECUTION_CACHED: `${ATTR_PREFIX}.execution.cached`,
  EXECUTION_RETRY_COUNT: `${ATTR_PREFIX}.execution.retry_count`,
  EXECUTION_PRIORITY: `${ATTR_PREFIX}.execution.priority`,

  // Intent attributes
  INTENT_ID: `${ATTR_PREFIX}.intent.id`,
  INTENT_TYPE: `${ATTR_PREFIX}.intent.type`,

  // Entity attributes
  ENTITY_ID: `${ATTR_PREFIX}.entity.id`,

  // Resource attributes
  RESOURCE_MEMORY_MB: `${ATTR_PREFIX}.resource.memory_mb`,
  RESOURCE_CPU_MS: `${ATTR_PREFIX}.resource.cpu_ms`,
  RESOURCE_WALL_TIME_MS: `${ATTR_PREFIX}.resource.wall_time_ms`,
  RESOURCE_NETWORK_REQUESTS: `${ATTR_PREFIX}.resource.network_requests`,
  RESOURCE_FS_OPS: `${ATTR_PREFIX}.resource.fs_ops`,

  // Sandbox attributes
  SANDBOX_VIOLATIONS: `${ATTR_PREFIX}.sandbox.violations`,
  SANDBOX_BLOCKED_HOST: `${ATTR_PREFIX}.sandbox.blocked_host`,
  SANDBOX_BLOCKED_MODULE: `${ATTR_PREFIX}.sandbox.blocked_module`,

  // Escalation attributes
  ESCALATION_ID: `${ATTR_PREFIX}.escalation.id`,
  ESCALATION_REASON: `${ATTR_PREFIX}.escalation.reason`,
  ESCALATION_PRIORITY: `${ATTR_PREFIX}.escalation.priority`,

  // Result attributes
  RESULT_SUCCESS: `${ATTR_PREFIX}.result.success`,
  RESULT_ERROR: `${ATTR_PREFIX}.result.error`,
  RESULT_PROOF_HASH: `${ATTR_PREFIX}.result.proof_hash`,

  // Tenant/multi-tenancy
  TENANT_ID: `${ATTR_PREFIX}.tenant.id`,

  // Request metadata
  REQUEST_ID: `${ATTR_PREFIX}.request.id`,
  CORRELATION_ID: `${ATTR_PREFIX}.correlation.id`,

  // Error attributes
  ERROR_TYPE: `${ATTR_PREFIX}.error.type`,
  ERROR_MESSAGE: `${ATTR_PREFIX}.error.message`,
} as const;

// =============================================================================
// SPAN NAMES
// =============================================================================

/**
 * Standard span names for Cognigate operations
 */
export const CognigateSpanNames = {
  // Core execution flow
  EXECUTE: 'cognigate.execute',
  HANDLER_INVOKE: 'cognigate.handler.invoke',
  RESOURCE_CHECK: 'cognigate.resource.check',
  SANDBOX_ENFORCE: 'cognigate.sandbox.enforce',

  // State transitions
  STATE_TRANSITION: 'cognigate.state.transition',

  // Cache operations
  CACHE_GET: 'cognigate.cache.get',
  CACHE_SET: 'cognigate.cache.set',
  CACHE_INVALIDATE: 'cognigate.cache.invalidate',

  // Escalation flow
  ESCALATION_CREATE: 'cognigate.escalation.create',
  ESCALATION_RESOLVE: 'cognigate.escalation.resolve',

  // Database operations
  DB_QUERY: 'cognigate.db.query',
  DB_INSERT: 'cognigate.db.insert',
  DB_UPDATE: 'cognigate.db.update',

  // Webhook operations
  WEBHOOK_DELIVER: 'cognigate.webhook.deliver',

  // Audit operations
  AUDIT_RECORD: 'cognigate.audit.record',
} as const;

// =============================================================================
// TRACER INSTANCE
// =============================================================================

/** Cached tracer instance */
let _tracer: Tracer | null = null;

/**
 * Get the Cognigate module tracer instance
 *
 * Returns a cached tracer for the cognigate module. The tracer is created
 * on first access using the global OpenTelemetry trace provider.
 */
export function getTracer(): Tracer {
  if (!_tracer) {
    _tracer = trace.getTracer(TRACER_NAME, TRACER_VERSION);
  }
  return _tracer;
}

// =============================================================================
// SPAN CREATION
// =============================================================================

/**
 * Create a span for an execution operation
 *
 * Creates a new span representing the full lifecycle of an execution,
 * with execution-specific attributes pre-populated.
 *
 * @param executionId - Unique execution identifier
 * @param intentId - Intent being executed
 * @param handlerName - Handler processing the execution
 * @param parentContext - Optional parent context for linking spans
 * @returns The created span
 */
export function createExecutionSpan(
  executionId: ID,
  intentId: ID,
  handlerName: string,
  parentContext?: Context
): Span {
  const tracer = getTracer();
  const ctx = parentContext || context.active();

  const span = tracer.startSpan(
    CognigateSpanNames.EXECUTE,
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        [CognigateSemanticAttributes.EXECUTION_ID]: executionId,
        [CognigateSemanticAttributes.INTENT_ID]: intentId,
        [CognigateSemanticAttributes.EXECUTION_HANDLER]: handlerName,
      },
    },
    ctx
  );

  return span;
}

/**
 * Execute a function within a new span
 *
 * Creates a span, executes the provided function within that span's
 * context, and handles error recording and span lifecycle automatically.
 *
 * @param name - Span name
 * @param fn - Function to execute within the span
 * @param attributes - Optional initial span attributes
 * @returns The function's return value
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const tracer = getTracer();
  const span = tracer.startSpan(name, {
    kind: SpanKind.INTERNAL,
    attributes: attributes as Attributes,
  });

  const spanContext = trace.setSpan(context.active(), span);

  try {
    const result = await context.with(spanContext, () => fn(span));
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    recordSpanError(span, error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    span.end();
  }
}

// =============================================================================
// ERROR RECORDING
// =============================================================================

/**
 * Record an error on a span
 *
 * Sets the span status to ERROR, records the exception, and adds
 * error-specific attributes for debugging.
 *
 * @param span - The span to record the error on
 * @param error - The error to record
 */
export function recordSpanError(span: Span, error: Error): void {
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error.message,
  });

  span.setAttributes({
    [CognigateSemanticAttributes.ERROR_TYPE]: error.name,
    [CognigateSemanticAttributes.ERROR_MESSAGE]: error.message,
  });

  span.recordException(error);
}

// =============================================================================
// SPAN EVENTS
// =============================================================================

/**
 * Add a named event to a span with optional attributes
 *
 * Events mark points in time within a span, useful for tracking
 * intermediate steps or notable occurrences during execution.
 *
 * @param span - The span to add the event to
 * @param name - Event name
 * @param attributes - Optional event attributes
 */
export function addSpanEvent(
  span: Span,
  name: string,
  attributes?: Record<string, string | number | boolean>
): void {
  span.addEvent(name, attributes as Attributes);
}

// =============================================================================
// ATTRIBUTE HELPERS
// =============================================================================

/**
 * Execution context for span attributes
 */
export interface ExecutionContext {
  executionId: ID;
  intentId: ID;
  entityId: ID;
  tenantId: ID;
  handlerName: string;
  handlerVersion?: string;
  priority?: number;
  correlationId?: string;
  requestId?: string;
}

/**
 * Resource usage for span attributes
 */
export interface ResourceUsage {
  memoryPeakMb: number;
  cpuTimeMs: number;
  wallTimeMs: number;
  networkRequests: number;
  fileSystemOps: number;
}

/**
 * Execution result for span attributes
 */
export interface ExecutionResult {
  success: boolean;
  error?: string;
  durationMs: number;
  cached?: boolean;
  proofHash?: string;
}

/**
 * Set execution context attributes on a span
 *
 * @param span - Target span
 * @param ctx - Execution context
 */
export function setExecutionAttributes(span: Span, ctx: ExecutionContext): void {
  const attrs: Attributes = {
    [CognigateSemanticAttributes.EXECUTION_ID]: ctx.executionId,
    [CognigateSemanticAttributes.INTENT_ID]: ctx.intentId,
    [CognigateSemanticAttributes.ENTITY_ID]: ctx.entityId,
    [CognigateSemanticAttributes.TENANT_ID]: ctx.tenantId,
    [CognigateSemanticAttributes.EXECUTION_HANDLER]: ctx.handlerName,
  };

  if (ctx.handlerVersion !== undefined) {
    attrs[CognigateSemanticAttributes.EXECUTION_HANDLER_VERSION] = ctx.handlerVersion;
  }
  if (ctx.priority !== undefined) {
    attrs[CognigateSemanticAttributes.EXECUTION_PRIORITY] = ctx.priority;
  }
  if (ctx.correlationId !== undefined) {
    attrs[CognigateSemanticAttributes.CORRELATION_ID] = ctx.correlationId;
  }
  if (ctx.requestId !== undefined) {
    attrs[CognigateSemanticAttributes.REQUEST_ID] = ctx.requestId;
  }

  span.setAttributes(attrs);
}

/**
 * Set resource usage attributes on a span
 *
 * @param span - Target span
 * @param usage - Resource usage metrics
 */
export function setResourceAttributes(span: Span, usage: ResourceUsage): void {
  span.setAttributes({
    [CognigateSemanticAttributes.RESOURCE_MEMORY_MB]: usage.memoryPeakMb,
    [CognigateSemanticAttributes.RESOURCE_CPU_MS]: usage.cpuTimeMs,
    [CognigateSemanticAttributes.RESOURCE_WALL_TIME_MS]: usage.wallTimeMs,
    [CognigateSemanticAttributes.RESOURCE_NETWORK_REQUESTS]: usage.networkRequests,
    [CognigateSemanticAttributes.RESOURCE_FS_OPS]: usage.fileSystemOps,
  });
}

/**
 * Set execution result attributes on a span
 *
 * @param span - Target span
 * @param result - Execution result
 */
export function setResultAttributes(span: Span, result: ExecutionResult): void {
  const attrs: Attributes = {
    [CognigateSemanticAttributes.RESULT_SUCCESS]: result.success,
    [CognigateSemanticAttributes.EXECUTION_DURATION_MS]: result.durationMs,
  };

  if (result.error !== undefined) {
    attrs[CognigateSemanticAttributes.RESULT_ERROR] = result.error;
  }
  if (result.cached !== undefined) {
    attrs[CognigateSemanticAttributes.EXECUTION_CACHED] = result.cached;
  }
  if (result.proofHash !== undefined) {
    attrs[CognigateSemanticAttributes.RESULT_PROOF_HASH] = result.proofHash;
  }

  span.setAttributes(attrs);
}

// =============================================================================
// CONTEXT PROPAGATION
// =============================================================================

/**
 * Extract trace context from metadata (e.g., from job payloads or messages)
 *
 * Supports both W3C traceparent format in metadata and direct traceId/spanId fields.
 *
 * @param metadata - Metadata object potentially containing trace context
 * @returns The extracted context, or undefined if no trace context found
 */
export function extractTraceContext(metadata: Record<string, unknown>): Context | undefined {
  // Try W3C traceparent format
  if (typeof metadata.traceparent === 'string') {
    const carrier: Record<string, string> = {
      traceparent: metadata.traceparent,
    };
    if (typeof metadata.tracestate === 'string') {
      carrier.tracestate = metadata.tracestate;
    }
    return propagation.extract(context.active(), carrier);
  }

  // Try direct traceId/spanId format
  if (typeof metadata.traceId === 'string' && typeof metadata.spanId === 'string') {
    const traceFlags = typeof metadata.traceFlags === 'number' ? metadata.traceFlags : 1;
    const traceparent = `00-${metadata.traceId}-${metadata.spanId}-0${traceFlags}`;
    const carrier: Record<string, string> = { traceparent };

    if (typeof metadata.traceState === 'string') {
      carrier.tracestate = metadata.traceState;
    }

    return propagation.extract(context.active(), carrier);
  }

  return undefined;
}

/**
 * Inject trace context into metadata for propagation across async boundaries
 *
 * Adds W3C traceparent and tracestate headers to the metadata object
 * for propagation to downstream services or async job processors.
 *
 * @param metadata - Metadata object to inject trace context into
 * @returns The metadata object with trace context injected
 */
export function injectTraceContext(
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);

  // Copy trace headers into metadata
  if (carrier.traceparent) {
    metadata.traceparent = carrier.traceparent;
  }
  if (carrier.tracestate) {
    metadata.tracestate = carrier.tracestate;
  }

  // Also extract and store individual components for direct access
  const activeSpan = trace.getActiveSpan();
  if (activeSpan) {
    const spanContext = activeSpan.spanContext();
    metadata.traceId = spanContext.traceId;
    metadata.spanId = spanContext.spanId;
    metadata.traceFlags = spanContext.traceFlags;
  }

  return metadata;
}

// =============================================================================
// TESTING UTILITIES
// =============================================================================

/**
 * Create a test span for testing purposes
 *
 * @param name - Span name
 * @returns A new span
 */
export function createTestSpan(name: string): Span {
  const tracer = getTracer();
  return tracer.startSpan(name);
}

/**
 * Reset the cached tracer instance (for testing)
 */
export function resetTracer(): void {
  _tracer = null;
}
