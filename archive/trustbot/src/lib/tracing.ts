/**
 * OpenTelemetry Distributed Tracing
 *
 * Epic 13: Observability & Monitoring
 * Story 13.3: OpenTelemetry Tracing
 *
 * Provides distributed tracing for:
 * - HTTP request → DB query → external API
 * - WebSocket message → handler → response
 * - Decision flow → tribunal → execution
 */

import { Context, context, trace, Span, SpanKind, SpanStatusCode, Attributes } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
    ATTR_SERVICE_NAME,
    ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

// Define deployment environment attribute (not available in all versions)
const ATTR_DEPLOYMENT_ENVIRONMENT = 'deployment.environment';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { BatchSpanProcessor, SimpleSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';

// ============================================================================
// Types
// ============================================================================

export interface TracingConfig {
    /** Service name for traces */
    serviceName?: string;
    /** Service version */
    serviceVersion?: string;
    /** Environment (production, staging, development) */
    environment?: string;
    /** OTLP endpoint URL */
    otlpEndpoint?: string;
    /** Enable console export for debugging */
    consoleExport?: boolean;
    /** Enable auto-instrumentation */
    autoInstrumentation?: boolean;
    /** Sample rate (0.0 to 1.0) */
    sampleRate?: number;
}

export interface SpanOptions {
    /** Span kind (client, server, producer, consumer, internal) */
    kind?: SpanKind;
    /** Span attributes */
    attributes?: Attributes;
    /** Parent context */
    parentContext?: Context;
}

export interface HttpSpanAttributes {
    method: string;
    url: string;
    statusCode?: number;
    userAgent?: string;
    correlationId?: string;
    userId?: string;
    orgId?: string;
}

export interface DbSpanAttributes {
    system: string; // 'postgresql', 'redis', etc.
    operation: string; // 'SELECT', 'INSERT', etc.
    table?: string;
    statement?: string;
}

export interface WebSocketSpanAttributes {
    messageType: string;
    direction: 'inbound' | 'outbound';
    agentId?: string;
    sessionId?: string;
}

export interface DecisionSpanAttributes {
    decisionId: string;
    decisionType: string;
    agentId?: string;
    orgId?: string;
    riskLevel?: string;
    outcome?: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: TracingConfig = {
    serviceName: process.env.SERVICE_NAME || 'aurais-api',
    serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    consoleExport: process.env.NODE_ENV === 'development',
    autoInstrumentation: true,
    sampleRate: parseFloat(process.env.OTEL_SAMPLE_RATE || '1.0'),
};

// ============================================================================
// Tracing SDK
// ============================================================================

let sdk: NodeSDK | null = null;
let isInitialized = false;

/**
 * Initialize OpenTelemetry SDK
 */
export function initTracing(config: TracingConfig = {}): void {
    if (isInitialized) {
        return;
    }

    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: mergedConfig.serviceName,
        [ATTR_SERVICE_VERSION]: mergedConfig.serviceVersion,
        [ATTR_DEPLOYMENT_ENVIRONMENT]: mergedConfig.environment,
    });

    const spanProcessors = [];

    // Add OTLP exporter if endpoint is configured
    if (mergedConfig.otlpEndpoint) {
        const otlpExporter = new OTLPTraceExporter({
            url: mergedConfig.otlpEndpoint,
        });
        spanProcessors.push(new BatchSpanProcessor(otlpExporter));
    }

    // Add console exporter for development
    if (mergedConfig.consoleExport) {
        spanProcessors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()));
    }

    const instrumentations = mergedConfig.autoInstrumentation
        ? [getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-fs': { enabled: false },
            '@opentelemetry/instrumentation-dns': { enabled: false },
        })]
        : [];

    sdk = new NodeSDK({
        resource,
        spanProcessors,
        instrumentations,
    });

    sdk.start();
    isInitialized = true;

    // Graceful shutdown
    process.on('SIGTERM', async () => {
        await shutdownTracing();
    });
}

/**
 * Shutdown tracing SDK
 */
export async function shutdownTracing(): Promise<void> {
    if (sdk) {
        await sdk.shutdown();
        sdk = null;
        isInitialized = false;
    }
}

/**
 * Check if tracing is initialized
 */
export function isTracingInitialized(): boolean {
    return isInitialized;
}

// ============================================================================
// Tracer Access
// ============================================================================

const TRACER_NAME = 'aurais-tracer';

/**
 * Get the tracer instance
 */
export function getTracer() {
    return trace.getTracer(TRACER_NAME);
}

// ============================================================================
// Span Creation
// ============================================================================

/**
 * Create a new span
 */
export function createSpan(name: string, options: SpanOptions = {}): Span {
    const tracer = getTracer();
    const parentContext = options.parentContext || context.active();

    return tracer.startSpan(
        name,
        {
            kind: options.kind || SpanKind.INTERNAL,
            attributes: options.attributes,
        },
        parentContext
    );
}

/**
 * Execute a function within a span
 */
export async function withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    options: SpanOptions = {}
): Promise<T> {
    const span = createSpan(name, options);

    try {
        const result = await context.with(trace.setSpan(context.active(), span), () => fn(span));
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
    } catch (error) {
        recordSpanError(span, error);
        throw error;
    } finally {
        span.end();
    }
}

/**
 * Execute a synchronous function within a span
 */
export function withSpanSync<T>(
    name: string,
    fn: (span: Span) => T,
    options: SpanOptions = {}
): T {
    const span = createSpan(name, options);

    try {
        const result = context.with(trace.setSpan(context.active(), span), () => fn(span));
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
    } catch (error) {
        recordSpanError(span, error);
        throw error;
    } finally {
        span.end();
    }
}

/**
 * Record an error on a span
 */
export function recordSpanError(span: Span, error: unknown): void {
    span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof Error) {
        span.recordException(error);
    }
}

// ============================================================================
// HTTP Tracing
// ============================================================================

/**
 * Create an HTTP request span
 */
export function createHttpSpan(name: string, attrs: HttpSpanAttributes): Span {
    return createSpan(name, {
        kind: SpanKind.SERVER,
        attributes: {
            'http.method': attrs.method,
            'http.url': attrs.url,
            'http.user_agent': attrs.userAgent,
            'http.correlation_id': attrs.correlationId,
            'user.id': attrs.userId,
            'org.id': attrs.orgId,
        },
    });
}

/**
 * Trace an HTTP request
 */
export async function traceHttpRequest<T>(
    attrs: HttpSpanAttributes,
    fn: (span: Span) => Promise<T>
): Promise<T> {
    const spanName = `HTTP ${attrs.method} ${attrs.url}`;
    return withSpan(spanName, async (span) => {
        span.setAttributes({
            'http.method': attrs.method,
            'http.url': attrs.url,
            'http.user_agent': attrs.userAgent,
            'http.correlation_id': attrs.correlationId,
            'user.id': attrs.userId,
            'org.id': attrs.orgId,
        });

        const result = await fn(span);

        if (attrs.statusCode) {
            span.setAttribute('http.status_code', attrs.statusCode);
        }

        return result;
    }, { kind: SpanKind.SERVER });
}

// ============================================================================
// Database Tracing
// ============================================================================

/**
 * Create a database span
 */
export function createDbSpan(name: string, attrs: DbSpanAttributes): Span {
    return createSpan(name, {
        kind: SpanKind.CLIENT,
        attributes: {
            'db.system': attrs.system,
            'db.operation': attrs.operation,
            'db.sql.table': attrs.table,
            'db.statement': attrs.statement,
        },
    });
}

/**
 * Trace a database operation
 */
export async function traceDbOperation<T>(
    attrs: DbSpanAttributes,
    fn: (span: Span) => Promise<T>
): Promise<T> {
    const spanName = `DB ${attrs.operation}${attrs.table ? ` ${attrs.table}` : ''}`;
    return withSpan(spanName, async (span) => {
        span.setAttributes({
            'db.system': attrs.system,
            'db.operation': attrs.operation,
            'db.sql.table': attrs.table,
            'db.statement': attrs.statement,
        });
        return fn(span);
    }, { kind: SpanKind.CLIENT });
}

// ============================================================================
// WebSocket Tracing
// ============================================================================

/**
 * Create a WebSocket message span
 */
export function createWsSpan(name: string, attrs: WebSocketSpanAttributes): Span {
    const kind = attrs.direction === 'inbound' ? SpanKind.SERVER : SpanKind.CLIENT;
    return createSpan(name, {
        kind,
        attributes: {
            'messaging.system': 'websocket',
            'messaging.operation': attrs.direction === 'inbound' ? 'receive' : 'send',
            'messaging.message.type': attrs.messageType,
            'agent.id': attrs.agentId,
            'session.id': attrs.sessionId,
        },
    });
}

/**
 * Trace a WebSocket message
 */
export async function traceWsMessage<T>(
    attrs: WebSocketSpanAttributes,
    fn: (span: Span) => Promise<T>
): Promise<T> {
    const spanName = `WS ${attrs.direction} ${attrs.messageType}`;
    const kind = attrs.direction === 'inbound' ? SpanKind.SERVER : SpanKind.CLIENT;

    return withSpan(spanName, async (span) => {
        span.setAttributes({
            'messaging.system': 'websocket',
            'messaging.operation': attrs.direction === 'inbound' ? 'receive' : 'send',
            'messaging.message.type': attrs.messageType,
            'agent.id': attrs.agentId,
            'session.id': attrs.sessionId,
        });
        return fn(span);
    }, { kind });
}

// ============================================================================
// Decision Flow Tracing
// ============================================================================

/**
 * Create a decision span
 */
export function createDecisionSpan(name: string, attrs: DecisionSpanAttributes): Span {
    return createSpan(name, {
        kind: SpanKind.INTERNAL,
        attributes: {
            'decision.id': attrs.decisionId,
            'decision.type': attrs.decisionType,
            'agent.id': attrs.agentId,
            'org.id': attrs.orgId,
            'decision.risk_level': attrs.riskLevel,
        },
    });
}

/**
 * Trace a decision flow
 */
export async function traceDecisionFlow<T>(
    attrs: DecisionSpanAttributes,
    fn: (span: Span) => Promise<T>
): Promise<T> {
    const spanName = `Decision ${attrs.decisionType} ${attrs.decisionId}`;
    return withSpan(spanName, async (span) => {
        span.setAttributes({
            'decision.id': attrs.decisionId,
            'decision.type': attrs.decisionType,
            'agent.id': attrs.agentId,
            'org.id': attrs.orgId,
            'decision.risk_level': attrs.riskLevel,
        });

        const result = await fn(span);

        if (attrs.outcome) {
            span.setAttribute('decision.outcome', attrs.outcome);
        }

        return result;
    }, { kind: SpanKind.INTERNAL });
}

/**
 * Trace a tribunal process
 */
export async function traceTribunalProcess<T>(
    decisionId: string,
    tribunalId: string,
    fn: (span: Span) => Promise<T>
): Promise<T> {
    const spanName = `Tribunal ${tribunalId}`;
    return withSpan(spanName, async (span) => {
        span.setAttributes({
            'tribunal.id': tribunalId,
            'decision.id': decisionId,
        });
        return fn(span);
    }, { kind: SpanKind.INTERNAL });
}

/**
 * Trace decision execution
 */
export async function traceDecisionExecution<T>(
    decisionId: string,
    executionType: string,
    fn: (span: Span) => Promise<T>
): Promise<T> {
    const spanName = `Execute ${executionType}`;
    return withSpan(spanName, async (span) => {
        span.setAttributes({
            'execution.type': executionType,
            'decision.id': decisionId,
        });
        return fn(span);
    }, { kind: SpanKind.INTERNAL });
}

// ============================================================================
// Context Propagation
// ============================================================================

/**
 * Get the current span from context
 */
export function getCurrentSpan(): Span | undefined {
    return trace.getSpan(context.active());
}

/**
 * Get the current trace ID
 */
export function getCurrentTraceId(): string | undefined {
    const span = getCurrentSpan();
    if (span) {
        return span.spanContext().traceId;
    }
    return undefined;
}

/**
 * Get the current span ID
 */
export function getCurrentSpanId(): string | undefined {
    const span = getCurrentSpan();
    if (span) {
        return span.spanContext().spanId;
    }
    return undefined;
}

/**
 * Run a function with a specific context
 */
export function runInContext<T>(ctx: Context, fn: () => T): T {
    return context.with(ctx, fn);
}

/**
 * Add attribute to current span
 */
export function addSpanAttribute(key: string, value: string | number | boolean): void {
    const span = getCurrentSpan();
    if (span) {
        span.setAttribute(key, value);
    }
}

/**
 * Add event to current span
 */
export function addSpanEvent(name: string, attributes?: Attributes): void {
    const span = getCurrentSpan();
    if (span) {
        span.addEvent(name, attributes);
    }
}

// ============================================================================
// Tracing Middleware Helper
// ============================================================================

export interface TracingMiddlewareOptions {
    /** Paths to exclude from tracing */
    excludePaths?: string[];
}

/**
 * Create tracing context for HTTP requests
 */
export function createTracingContext(
    method: string,
    path: string,
    correlationId?: string
): { span: Span; context: Context } {
    const span = createHttpSpan(`${method} ${path}`, {
        method,
        url: path,
        correlationId,
    });
    const ctx = trace.setSpan(context.active(), span);
    return { span, context: ctx };
}

// ============================================================================
// Convenience API
// ============================================================================

export const tracing = {
    init: initTracing,
    shutdown: shutdownTracing,
    isInitialized: isTracingInitialized,
    getTracer,

    // Span operations
    createSpan,
    withSpan,
    withSpanSync,
    recordError: recordSpanError,

    // Domain-specific tracing
    http: {
        trace: traceHttpRequest,
        createSpan: createHttpSpan,
    },
    db: {
        trace: traceDbOperation,
        createSpan: createDbSpan,
    },
    ws: {
        trace: traceWsMessage,
        createSpan: createWsSpan,
    },
    decision: {
        trace: traceDecisionFlow,
        createSpan: createDecisionSpan,
        traceTribunal: traceTribunalProcess,
        traceExecution: traceDecisionExecution,
    },

    // Context operations
    getCurrentSpan,
    getCurrentTraceId,
    getCurrentSpanId,
    addAttribute: addSpanAttribute,
    addEvent: addSpanEvent,
    runInContext,
};

export default tracing;
