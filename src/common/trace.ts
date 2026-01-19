/**
 * W3C TraceContext Propagation
 *
 * Implements W3C Trace Context specification for distributed tracing.
 * See: https://www.w3.org/TR/trace-context/
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';

/**
 * Trace context following W3C specification
 */
export interface TraceContext {
  /** 16-byte trace ID as 32 hex characters */
  traceId: string;
  /** 8-byte span ID as 16 hex characters */
  spanId: string;
  /** Parent span ID (for nested spans) */
  parentSpanId?: string;
  /** Trace flags (sampled = 01, not sampled = 00) */
  traceFlags: string;
  /** Full traceparent header value */
  traceparent: string;
  /** Optional tracestate header for vendor-specific data */
  tracestate?: string;
}

/**
 * Trace span for timing and hierarchy
 */
export interface TraceSpan {
  /** Span name/operation */
  name: string;
  /** Span ID */
  spanId: string;
  /** Parent span ID */
  parentSpanId?: string;
  /** Start timestamp */
  startTime: number;
  /** End timestamp (set when span ends) */
  endTime?: number;
  /** Span attributes */
  attributes: Record<string, unknown>;
  /** Span events (point-in-time occurrences) */
  events: Array<{
    name: string;
    timestamp: number;
    attributes?: Record<string, unknown>;
  }>;
  /** Span status */
  status: 'unset' | 'ok' | 'error';
  /** Error message if status is error */
  errorMessage?: string;
}

// W3C Trace Context version
const TRACE_VERSION = '00';

// AsyncLocalStorage for propagating trace context through async calls
const traceStorage = new AsyncLocalStorage<TraceContext>();

// Active spans storage for span management
const spanStorage = new AsyncLocalStorage<TraceSpan[]>();

/**
 * Generate a 16-byte trace ID (32 hex characters)
 */
export function generateTraceId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Generate an 8-byte span ID (16 hex characters)
 */
export function generateSpanId(): string {
  return randomBytes(8).toString('hex');
}

/**
 * Build traceparent header value
 * Format: {version}-{trace-id}-{parent-id}-{trace-flags}
 * Example: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
 */
export function buildTraceparent(
  traceId: string,
  spanId: string,
  traceFlags: string = '01'
): string {
  return `${TRACE_VERSION}-${traceId}-${spanId}-${traceFlags}`;
}

/**
 * Parse traceparent header value
 * Returns null if invalid
 */
export function parseTraceparent(header: string): {
  version: string;
  traceId: string;
  parentId: string;
  traceFlags: string;
} | null {
  if (!header || typeof header !== 'string') {
    return null;
  }

  // W3C traceparent format: version-trace_id-parent_id-trace_flags
  const parts = header.trim().split('-');
  if (parts.length !== 4) {
    return null;
  }

  const [version, traceId, parentId, traceFlags] = parts;

  // Validate version (currently only '00' is supported)
  if (!version || version !== '00') {
    return null;
  }

  // Validate trace ID (32 hex characters, not all zeros)
  if (!traceId || !/^[0-9a-f]{32}$/i.test(traceId) || traceId === '0'.repeat(32)) {
    return null;
  }

  // Validate parent ID (16 hex characters, not all zeros)
  if (!parentId || !/^[0-9a-f]{16}$/i.test(parentId) || parentId === '0'.repeat(16)) {
    return null;
  }

  // Validate trace flags (2 hex characters)
  if (!traceFlags || !/^[0-9a-f]{2}$/i.test(traceFlags)) {
    return null;
  }

  return {
    version: version.toLowerCase(),
    traceId: traceId.toLowerCase(),
    parentId: parentId.toLowerCase(),
    traceFlags: traceFlags.toLowerCase(),
  };
}

/**
 * Create a new trace context
 * Optionally continue from an existing traceparent header
 */
export function createTraceContext(existingTraceparent?: string): TraceContext {
  let traceId: string;
  let parentSpanId: string | undefined;
  let traceFlags = '01'; // Sampled by default

  if (existingTraceparent) {
    const parsed = parseTraceparent(existingTraceparent);
    if (parsed) {
      traceId = parsed.traceId;
      parentSpanId = parsed.parentId;
      traceFlags = parsed.traceFlags;
    } else {
      // Invalid traceparent, start new trace
      traceId = generateTraceId();
    }
  } else {
    traceId = generateTraceId();
  }

  const spanId = generateSpanId();
  const traceparent = buildTraceparent(traceId, spanId, traceFlags);

  const context: TraceContext = {
    traceId,
    spanId,
    traceFlags,
    traceparent,
  };

  if (parentSpanId) {
    context.parentSpanId = parentSpanId;
  }

  return context;
}

/**
 * Get the current trace context from async local storage
 */
export function getTraceContext(): TraceContext | undefined {
  return traceStorage.getStore();
}

/**
 * Run a function with a specific trace context
 */
export function runWithTraceContext<T>(
  context: TraceContext,
  fn: () => T
): T {
  return traceStorage.run(context, fn);
}

/**
 * Run a function with a new trace context (continuing from optional parent)
 */
export function runInNewTrace<T>(
  fn: () => T,
  existingTraceparent?: string
): T {
  const context = createTraceContext(existingTraceparent);
  return runWithTraceContext(context, fn);
}

/**
 * Create a child span ID in the current trace
 * Returns a new span ID while preserving the trace ID
 */
export function createChildSpanId(): string {
  const currentContext = getTraceContext();
  if (!currentContext) {
    throw new Error('No trace context available - must be called within runWithTraceContext');
  }
  return generateSpanId();
}

/**
 * Get trace context for logging
 * Returns object suitable for including in log entries
 */
export function getTraceLogContext(): Record<string, string> | undefined {
  const context = getTraceContext();
  if (!context) {
    return undefined;
  }

  const logContext: Record<string, string> = {
    traceId: context.traceId,
    spanId: context.spanId,
  };

  if (context.parentSpanId) {
    logContext.parentSpanId = context.parentSpanId;
  }

  return logContext;
}

/**
 * Extract trace context from HTTP headers
 */
export function extractTraceFromHeaders(
  headers: Record<string, string | string[] | undefined>
): TraceContext | null {
  const traceparent = headers['traceparent'];
  const tracestate = headers['tracestate'];

  // Handle array headers (some frameworks return string[])
  const traceparentStr = Array.isArray(traceparent) ? traceparent[0] : traceparent;
  const tracestateStr = Array.isArray(tracestate) ? tracestate[0] : tracestate;

  if (!traceparentStr) {
    return null;
  }

  const parsed = parseTraceparent(traceparentStr);
  if (!parsed) {
    return null;
  }

  // Create new span ID for this service
  const spanId = generateSpanId();
  const context: TraceContext = {
    traceId: parsed.traceId,
    spanId,
    parentSpanId: parsed.parentId,
    traceFlags: parsed.traceFlags,
    traceparent: buildTraceparent(parsed.traceId, spanId, parsed.traceFlags),
  };

  if (tracestateStr) {
    context.tracestate = tracestateStr;
  }

  return context;
}

/**
 * Inject trace context into HTTP headers
 */
export function injectTraceToHeaders(
  headers: Record<string, string>,
  context?: TraceContext
): Record<string, string> {
  const ctx = context ?? getTraceContext();
  if (!ctx) {
    return headers;
  }

  return {
    ...headers,
    traceparent: ctx.traceparent,
    ...(ctx.tracestate ? { tracestate: ctx.tracestate } : {}),
  };
}

/**
 * Start a new span within the current trace
 */
export function startSpan(name: string, attributes?: Record<string, unknown>): TraceSpan {
  const context = getTraceContext();
  const spans = spanStorage.getStore() ?? [];

  const parentSpan = spans[spans.length - 1];

  const parentSpanId = parentSpan?.spanId ?? context?.spanId;
  const span: TraceSpan = {
    name,
    spanId: generateSpanId(),
    startTime: Date.now(),
    attributes: attributes ?? {},
    events: [],
    status: 'unset',
  };

  if (parentSpanId) {
    span.parentSpanId = parentSpanId;
  }

  spans.push(span);
  return span;
}

/**
 * End a span
 */
export function endSpan(span: TraceSpan, status?: 'ok' | 'error', errorMessage?: string): void {
  span.endTime = Date.now();
  span.status = status ?? 'ok';
  if (errorMessage) {
    span.errorMessage = errorMessage;
  }

  // Remove from active spans
  const spans = spanStorage.getStore();
  if (spans) {
    const index = spans.indexOf(span);
    if (index !== -1) {
      spans.splice(index, 1);
    }
  }
}

/**
 * Add an event to a span
 */
export function addSpanEvent(
  span: TraceSpan,
  name: string,
  attributes?: Record<string, unknown>
): void {
  const event: { name: string; timestamp: number; attributes?: Record<string, unknown> } = {
    name,
    timestamp: Date.now(),
  };
  if (attributes) {
    event.attributes = attributes;
  }
  span.events.push(event);
}

/**
 * Set span attribute
 */
export function setSpanAttribute(
  span: TraceSpan,
  key: string,
  value: unknown
): void {
  span.attributes[key] = value;
}

/**
 * Run a function within a span
 */
export async function withSpan<T>(
  name: string,
  fn: (span: TraceSpan) => Promise<T>,
  attributes?: Record<string, unknown>
): Promise<T> {
  const span = startSpan(name, attributes);
  try {
    const result = await fn(span);
    endSpan(span, 'ok');
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    endSpan(span, 'error', message);
    throw error;
  }
}

/**
 * Serialize trace context for queue job data
 */
export function serializeTraceContext(context?: TraceContext): string | undefined {
  const ctx = context ?? getTraceContext();
  if (!ctx) {
    return undefined;
  }
  return JSON.stringify(ctx);
}

/**
 * Deserialize trace context from queue job data
 */
export function deserializeTraceContext(data: string | undefined): TraceContext | null {
  if (!data) {
    return null;
  }
  try {
    const parsed = JSON.parse(data) as TraceContext;
    // Validate required fields
    if (parsed.traceId && parsed.spanId && parsed.traceparent) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Propagate trace context for BullMQ jobs
 * Add trace context to job data
 */
export function addTraceToJobData<T extends Record<string, unknown>>(
  data: T,
  context?: TraceContext
): T & { _trace?: string } {
  const serialized = serializeTraceContext(context);
  if (!serialized) {
    return data;
  }
  return {
    ...data,
    _trace: serialized,
  };
}

/**
 * Extract trace context from BullMQ job data
 */
export function extractTraceFromJobData(
  data: Record<string, unknown>
): TraceContext | null {
  const trace = data['_trace'];
  if (typeof trace !== 'string') {
    return null;
  }
  return deserializeTraceContext(trace);
}
