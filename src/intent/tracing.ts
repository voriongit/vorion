/**
 * INTENT Distributed Tracing - OpenTelemetry Integration
 *
 * Provides distributed tracing for intent processing workflows.
 * Enables end-to-end visibility across queue workers and API calls.
 */

import {
  trace,
  context,
  SpanKind,
  SpanStatusCode,
  type Span,
  type Tracer,
  type Context,
} from '@opentelemetry/api';
import type { Intent, IntentStatus } from '../common/types.js';

// Tracer for intent operations
const TRACER_NAME = 'vorion.intent';
const TRACER_VERSION = '1.0.0';

/**
 * Get the intent tracer
 */
export function getTracer(): Tracer {
  return trace.getTracer(TRACER_NAME, TRACER_VERSION);
}

/**
 * Span attribute names for intent operations
 */
export const IntentAttributes = {
  INTENT_ID: 'intent.id',
  INTENT_TYPE: 'intent.type',
  INTENT_STATUS: 'intent.status',
  INTENT_PRIORITY: 'intent.priority',
  TENANT_ID: 'tenant.id',
  ENTITY_ID: 'entity.id',
  TRUST_LEVEL: 'trust.level',
  ESCALATION_ID: 'escalation.id',
  ESCALATION_REASON: 'escalation.reason',
  ESCALATION_STATUS: 'escalation.status',
  QUEUE_NAME: 'queue.name',
  JOB_ID: 'job.id',
} as const;

/**
 * Create a span for intent submission
 */
export function traceIntentSubmission<T>(
  tenantId: string,
  entityId: string,
  intentType: string | null | undefined,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  const tracer = getTracer();

  return tracer.startActiveSpan(
    'intent.submit',
    {
      kind: SpanKind.PRODUCER,
      attributes: {
        [IntentAttributes.TENANT_ID]: tenantId,
        [IntentAttributes.ENTITY_ID]: entityId,
        [IntentAttributes.INTENT_TYPE]: intentType ?? 'default',
      },
    },
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        if (error instanceof Error) {
          span.recordException(error);
        }
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Create a span for queue job processing
 */
export function traceQueueJob<T>(
  queueName: string,
  jobId: string,
  intentId: string,
  fn: (span: Span) => Promise<T>,
  parentContext?: Context
): Promise<T> {
  const tracer = getTracer();
  const ctx = parentContext ?? context.active();

  return context.with(ctx, () =>
    tracer.startActiveSpan(
      `queue.${queueName}.process`,
      {
        kind: SpanKind.CONSUMER,
        attributes: {
          [IntentAttributes.QUEUE_NAME]: queueName,
          [IntentAttributes.JOB_ID]: jobId,
          [IntentAttributes.INTENT_ID]: intentId,
        },
      },
      async (span) => {
        try {
          const result = await fn(span);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
          if (error instanceof Error) {
            span.recordException(error);
          }
          throw error;
        } finally {
          span.end();
        }
      }
    )
  );
}

/**
 * Create a span for trust evaluation
 */
export function traceTrustEvaluation<T>(
  intentId: string,
  tenantId: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  const tracer = getTracer();

  return tracer.startActiveSpan(
    'trust.evaluate',
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        [IntentAttributes.INTENT_ID]: intentId,
        [IntentAttributes.TENANT_ID]: tenantId,
      },
    },
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        if (error instanceof Error) {
          span.recordException(error);
        }
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Create a span for rule evaluation
 */
export function traceRuleEvaluation<T>(
  intentId: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  const tracer = getTracer();

  return tracer.startActiveSpan(
    'rules.evaluate',
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        [IntentAttributes.INTENT_ID]: intentId,
      },
    },
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        if (error instanceof Error) {
          span.recordException(error);
        }
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Create a span for escalation creation
 */
export function traceEscalationCreate<T>(
  intentId: string,
  tenantId: string,
  reason: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  const tracer = getTracer();

  return tracer.startActiveSpan(
    'escalation.create',
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        [IntentAttributes.INTENT_ID]: intentId,
        [IntentAttributes.TENANT_ID]: tenantId,
        [IntentAttributes.ESCALATION_REASON]: reason,
      },
    },
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        if (error instanceof Error) {
          span.recordException(error);
        }
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Create a span for escalation resolution
 */
export function traceEscalationResolve<T>(
  escalationId: string,
  resolution: 'approved' | 'rejected',
  fn: (span: Span) => Promise<T>
): Promise<T> {
  const tracer = getTracer();

  return tracer.startActiveSpan(
    `escalation.${resolution}`,
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        [IntentAttributes.ESCALATION_ID]: escalationId,
        [IntentAttributes.ESCALATION_STATUS]: resolution,
      },
    },
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        if (error instanceof Error) {
          span.recordException(error);
        }
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Create a span for decision making
 */
export function traceDecision<T>(
  intentId: string,
  tenantId: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  const tracer = getTracer();

  return tracer.startActiveSpan(
    'intent.decide',
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        [IntentAttributes.INTENT_ID]: intentId,
        [IntentAttributes.TENANT_ID]: tenantId,
      },
    },
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        if (error instanceof Error) {
          span.recordException(error);
        }
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Add intent attributes to current span
 */
export function addIntentAttributes(
  span: Span,
  intent: Intent
): void {
  span.setAttributes({
    [IntentAttributes.INTENT_ID]: intent.id,
    [IntentAttributes.INTENT_TYPE]: intent.intentType ?? 'default',
    [IntentAttributes.INTENT_STATUS]: intent.status,
    [IntentAttributes.INTENT_PRIORITY]: intent.priority,
    [IntentAttributes.TENANT_ID]: intent.tenantId,
    [IntentAttributes.ENTITY_ID]: intent.entityId,
  });
}

/**
 * Add trust attributes to current span
 */
export function addTrustAttributes(
  span: Span,
  trustLevel: number,
  trustScore?: number
): void {
  span.setAttribute(IntentAttributes.TRUST_LEVEL, trustLevel);
  if (trustScore !== undefined) {
    span.setAttribute('trust.score', trustScore);
  }
}

/**
 * Record a status transition event
 */
export function recordStatusTransitionEvent(
  span: Span,
  fromStatus: IntentStatus | 'new',
  toStatus: IntentStatus
): void {
  span.addEvent('status.transition', {
    'status.from': fromStatus,
    'status.to': toStatus,
  });
}

/**
 * Record an evaluation result event
 */
export function recordEvaluationEvent(
  span: Span,
  evaluationType: 'trust' | 'rules' | 'policy',
  result: 'passed' | 'failed' | 'escalated',
  details?: Record<string, string | number | boolean>
): void {
  span.addEvent(`evaluation.${evaluationType}`, {
    'evaluation.result': result,
    ...details,
  });
}

/**
 * Extract trace context for propagation to queue jobs
 */
export function extractTraceContext(): Record<string, string> {
  const carrier: Record<string, string> = {};
  const activeSpan = trace.getActiveSpan();

  if (activeSpan) {
    const spanContext = activeSpan.spanContext();
    carrier['traceparent'] = `00-${spanContext.traceId}-${spanContext.spanId}-01`;
  }

  return carrier;
}

/**
 * Inject trace context from carrier into context
 */
export function injectTraceContext(_carrier: Record<string, string>): Context {
  // This is a simplified implementation
  // In production, use W3C TraceContext propagator
  return context.active();
}
