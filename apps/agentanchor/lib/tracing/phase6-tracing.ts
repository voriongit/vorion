/**
 * Phase 6 OpenTelemetry Distributed Tracing
 *
 * Provides observability for Phase 6 Trust Engine operations with:
 * - Automatic span creation for key operations
 * - Context propagation across service boundaries
 * - Custom attributes for trust-specific metrics
 * - Baggage for cross-service correlation
 */

import {
  SpanKind,
  SpanStatusCode,
  context,
  trace,
  propagation,
  Span,
  Tracer,
  Context,
} from '@opentelemetry/api'

// =============================================================================
// TYPES
// =============================================================================

export interface Phase6SpanAttributes {
  // Agent attributes
  'phase6.agent.id'?: string
  'phase6.agent.tier'?: string
  'phase6.agent.score'?: number

  // Role gate attributes
  'phase6.role_gate.role'?: string
  'phase6.role_gate.decision'?: string
  'phase6.role_gate.kernel_allowed'?: boolean
  'phase6.role_gate.policy_applied'?: string

  // Ceiling attributes
  'phase6.ceiling.original_score'?: number
  'phase6.ceiling.effective_score'?: number
  'phase6.ceiling.source'?: string
  'phase6.ceiling.compliance_status'?: string

  // Provenance attributes
  'phase6.provenance.creation_type'?: string
  'phase6.provenance.parent_agent_id'?: string
  'phase6.provenance.lineage_verified'?: boolean

  // Context attributes
  'phase6.context.deployment_id'?: string
  'phase6.context.org_id'?: string
  'phase6.context.operation_id'?: string

  // Alert attributes
  'phase6.alert.type'?: string
  'phase6.alert.severity'?: string

  // Generic
  [key: string]: string | number | boolean | undefined
}

export interface TracingOptions {
  /** Service name for tracer */
  serviceName?: string
  /** Whether to record exceptions */
  recordExceptions?: boolean
  /** Additional default attributes */
  defaultAttributes?: Record<string, string>
}

// =============================================================================
// TRACER INITIALIZATION
// =============================================================================

const TRACER_NAME = 'phase6-trust-engine'
const TRACER_VERSION = '1.0.0'

let tracer: Tracer | null = null

/**
 * Get or create the Phase 6 tracer
 */
export function getTracer(): Tracer {
  if (!tracer) {
    tracer = trace.getTracer(TRACER_NAME, TRACER_VERSION)
  }
  return tracer
}

// =============================================================================
// SPAN HELPERS
// =============================================================================

/**
 * Create a new span for Phase 6 operations
 */
export function startPhase6Span(
  name: string,
  attributes?: Phase6SpanAttributes,
  kind: SpanKind = SpanKind.INTERNAL
): Span {
  const span = getTracer().startSpan(name, {
    kind,
    attributes: {
      'service.name': TRACER_NAME,
      ...attributes,
    },
  })

  return span
}

/**
 * Execute an async operation within a span
 */
export async function withSpan<T>(
  name: string,
  operation: (span: Span) => Promise<T>,
  options?: {
    attributes?: Phase6SpanAttributes
    kind?: SpanKind
    recordExceptions?: boolean
  }
): Promise<T> {
  const span = startPhase6Span(name, options?.attributes, options?.kind)

  try {
    const result = await context.with(trace.setSpan(context.active(), span), () =>
      operation(span)
    )

    span.setStatus({ code: SpanStatusCode.OK })
    return result
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    })

    if (options?.recordExceptions !== false && error instanceof Error) {
      span.recordException(error)
    }

    throw error
  } finally {
    span.end()
  }
}

/**
 * Execute a sync operation within a span
 */
export function withSpanSync<T>(
  name: string,
  operation: (span: Span) => T,
  options?: {
    attributes?: Phase6SpanAttributes
    kind?: SpanKind
  }
): T {
  const span = startPhase6Span(name, options?.attributes, options?.kind)

  try {
    const result = context.with(trace.setSpan(context.active(), span), () =>
      operation(span)
    )

    span.setStatus({ code: SpanStatusCode.OK })
    return result
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    })

    if (error instanceof Error) {
      span.recordException(error)
    }

    throw error
  } finally {
    span.end()
  }
}

// =============================================================================
// PHASE 6 SPECIFIC TRACING
// =============================================================================

/**
 * Trace role gate evaluation
 */
export async function traceRoleGateEvaluation<T>(
  agentId: string,
  role: string,
  tier: string,
  operation: (span: Span) => Promise<T>
): Promise<T> {
  return withSpan('phase6.role_gate.evaluate', operation, {
    attributes: {
      'phase6.agent.id': agentId,
      'phase6.role_gate.role': role,
      'phase6.agent.tier': tier,
    },
    kind: SpanKind.SERVER,
  })
}

/**
 * Trace ceiling check
 */
export async function traceCeilingCheck<T>(
  agentId: string,
  score: number,
  operation: (span: Span) => Promise<T>
): Promise<T> {
  return withSpan('phase6.ceiling.check', operation, {
    attributes: {
      'phase6.agent.id': agentId,
      'phase6.ceiling.original_score': score,
    },
    kind: SpanKind.INTERNAL,
  })
}

/**
 * Trace provenance creation
 */
export async function traceProvenanceCreation<T>(
  agentId: string,
  creationType: string,
  operation: (span: Span) => Promise<T>
): Promise<T> {
  return withSpan('phase6.provenance.create', operation, {
    attributes: {
      'phase6.agent.id': agentId,
      'phase6.provenance.creation_type': creationType,
    },
    kind: SpanKind.INTERNAL,
  })
}

/**
 * Trace gaming alert creation
 */
export async function traceGamingAlert<T>(
  agentId: string,
  alertType: string,
  severity: string,
  operation: (span: Span) => Promise<T>
): Promise<T> {
  return withSpan('phase6.alert.create', operation, {
    attributes: {
      'phase6.agent.id': agentId,
      'phase6.alert.type': alertType,
      'phase6.alert.severity': severity,
    },
    kind: SpanKind.INTERNAL,
  })
}

/**
 * Trace preset resolution
 */
export async function tracePresetResolution<T>(
  presetId: string,
  presetType: 'aci' | 'vorion' | 'axiom',
  operation: (span: Span) => Promise<T>
): Promise<T> {
  return withSpan(`phase6.preset.resolve.${presetType}`, operation, {
    attributes: {
      'phase6.preset.id': presetId,
      'phase6.preset.type': presetType,
    },
    kind: SpanKind.INTERNAL,
  })
}

// =============================================================================
// CONTEXT PROPAGATION
// =============================================================================

/**
 * Inject trace context into headers for outgoing requests
 */
export function injectTraceContext(headers: Record<string, string>): void {
  propagation.inject(context.active(), headers)
}

/**
 * Extract trace context from incoming request headers
 */
export function extractTraceContext(headers: Record<string, string>): Context {
  return propagation.extract(context.active(), headers)
}

/**
 * Run operation with extracted context
 */
export async function withExtractedContext<T>(
  headers: Record<string, string>,
  operation: () => Promise<T>
): Promise<T> {
  const extractedContext = extractTraceContext(headers)
  return context.with(extractedContext, operation)
}

// =============================================================================
// SPAN ENRICHMENT
// =============================================================================

/**
 * Add role gate decision to current span
 */
export function recordRoleGateDecision(
  span: Span,
  decision: 'ALLOW' | 'DENY' | 'ESCALATE',
  reason?: string
): void {
  span.setAttributes({
    'phase6.role_gate.decision': decision,
    ...(reason && { 'phase6.role_gate.reason': reason }),
  })
}

/**
 * Add ceiling result to current span
 */
export function recordCeilingResult(
  span: Span,
  effectiveScore: number,
  source: string,
  status: string
): void {
  span.setAttributes({
    'phase6.ceiling.effective_score': effectiveScore,
    'phase6.ceiling.source': source,
    'phase6.ceiling.compliance_status': status,
  })
}

/**
 * Add provenance verification result to current span
 */
export function recordProvenanceVerification(
  span: Span,
  verified: boolean,
  parentAgentId?: string
): void {
  span.setAttributes({
    'phase6.provenance.lineage_verified': verified,
    ...(parentAgentId && { 'phase6.provenance.parent_agent_id': parentAgentId }),
  })
}

/**
 * Add context information to current span
 */
export function recordContextInfo(
  span: Span,
  context: {
    deploymentId?: string
    orgId?: string
    operationId?: string
  }
): void {
  span.setAttributes({
    ...(context.deploymentId && { 'phase6.context.deployment_id': context.deploymentId }),
    ...(context.orgId && { 'phase6.context.org_id': context.orgId }),
    ...(context.operationId && { 'phase6.context.operation_id': context.operationId }),
  })
}

// =============================================================================
// EVENTS
// =============================================================================

/**
 * Add Phase 6 event to current span
 */
export function addPhase6Event(
  span: Span,
  name: string,
  attributes?: Record<string, string | number | boolean>
): void {
  span.addEvent(name, attributes)
}

/**
 * Record role gate kernel evaluation event
 */
export function eventKernelEvaluation(span: Span, allowed: boolean): void {
  addPhase6Event(span, 'phase6.kernel.evaluated', {
    allowed,
  })
}

/**
 * Record policy evaluation event
 */
export function eventPolicyEvaluation(span: Span, policy: string, result: string): void {
  addPhase6Event(span, 'phase6.policy.evaluated', {
    policy,
    result,
  })
}

/**
 * Record BASIS override event
 */
export function eventBasisOverride(span: Span, approvers: string[]): void {
  addPhase6Event(span, 'phase6.basis.override', {
    approver_count: approvers.length,
    approvers: approvers.join(','),
  })
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Tracing middleware for Next.js API routes
 */
export function createTracingMiddleware(options?: TracingOptions) {
  return async function tracingMiddleware(
    request: Request,
    handler: (request: Request) => Promise<Response>
  ): Promise<Response> {
    const url = new URL(request.url)
    const spanName = `HTTP ${request.method} ${url.pathname}`

    // Extract context from incoming headers
    const headers: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      headers[key] = value
    })

    return withExtractedContext(headers, async () => {
      return withSpan(
        spanName,
        async (span) => {
          // Add HTTP attributes
          span.setAttributes({
            'http.method': request.method,
            'http.url': url.href,
            'http.target': url.pathname,
            ...options?.defaultAttributes,
          })

          const response = await handler(request)

          // Record response status
          span.setAttributes({
            'http.status_code': response.status,
          })

          if (response.status >= 400) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: `HTTP ${response.status}`,
            })
          }

          return response
        },
        {
          kind: SpanKind.SERVER,
          recordExceptions: options?.recordExceptions ?? true,
        }
      )
    })
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  getTracer,
  startSpan: startPhase6Span,
  withSpan,
  withSpanSync,
  traceRoleGate: traceRoleGateEvaluation,
  traceCeiling: traceCeilingCheck,
  traceProvenance: traceProvenanceCreation,
  traceAlert: traceGamingAlert,
  tracePreset: tracePresetResolution,
  inject: injectTraceContext,
  extract: extractTraceContext,
  record: {
    roleGateDecision: recordRoleGateDecision,
    ceilingResult: recordCeilingResult,
    provenanceVerification: recordProvenanceVerification,
    contextInfo: recordContextInfo,
  },
  event: {
    kernelEvaluation: eventKernelEvaluation,
    policyEvaluation: eventPolicyEvaluation,
    basisOverride: eventBasisOverride,
  },
  middleware: createTracingMiddleware,
}
