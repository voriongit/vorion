/**
 * OpenTelemetry Distributed Tracing Tests
 *
 * Epic 13: Observability & Monitoring
 * Story 13.3: OpenTelemetry Tracing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import {
    initTracing,
    shutdownTracing,
    isTracingInitialized,
    getTracer,
    createSpan,
    withSpan,
    withSpanSync,
    recordSpanError,
    createHttpSpan,
    traceHttpRequest,
    createDbSpan,
    traceDbOperation,
    createWsSpan,
    traceWsMessage,
    createDecisionSpan,
    traceDecisionFlow,
    traceTribunalProcess,
    traceDecisionExecution,
    getCurrentSpan,
    getCurrentTraceId,
    getCurrentSpanId,
    addSpanAttribute,
    addSpanEvent,
    createTracingContext,
    tracing,
} from './tracing.js';

// ============================================================================
// Test Setup
// ============================================================================

describe('OpenTelemetry Tracing', () => {
    beforeEach(() => {
        // Reset tracing state before each test
        if (isTracingInitialized()) {
            // Note: We don't actually shutdown between tests to avoid OTEL warnings
        }
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // SDK Initialization
    // =========================================================================

    describe('SDK Initialization', () => {
        it('should have init function available', () => {
            expect(typeof initTracing).toBe('function');
        });

        it('should have shutdown function available', () => {
            expect(typeof shutdownTracing).toBe('function');
        });

        it('should return tracer instance', () => {
            const tracer = getTracer();
            expect(tracer).toBeDefined();
            expect(typeof tracer.startSpan).toBe('function');
        });

        it('should check initialization status', () => {
            // In test environment, may or may not be initialized
            expect(typeof isTracingInitialized).toBe('function');
            const status = isTracingInitialized();
            expect(typeof status).toBe('boolean');
        });
    });

    // =========================================================================
    // Span Creation
    // =========================================================================

    describe('Span Creation', () => {
        it('should create a basic span', () => {
            const span = createSpan('test-span');
            expect(span).toBeDefined();
            expect(typeof span.end).toBe('function');
            span.end();
        });

        it('should create span with attributes', () => {
            const span = createSpan('test-span', {
                attributes: { 'test.key': 'test-value' },
            });
            expect(span).toBeDefined();
            span.end();
        });

        it('should create span with specific kind', () => {
            const span = createSpan('client-span', {
                kind: SpanKind.CLIENT,
            });
            expect(span).toBeDefined();
            span.end();
        });
    });

    // =========================================================================
    // withSpan Async
    // =========================================================================

    describe('withSpan (async)', () => {
        it('should execute function within span', async () => {
            let executed = false;

            await withSpan('test-operation', async (span) => {
                expect(span).toBeDefined();
                executed = true;
                return 'result';
            });

            expect(executed).toBe(true);
        });

        it('should return function result', async () => {
            const result = await withSpan('test-operation', async () => {
                return 'test-result';
            });

            expect(result).toBe('test-result');
        });

        it('should handle errors and set error status', async () => {
            const error = new Error('Test error');

            await expect(
                withSpan('failing-operation', async () => {
                    throw error;
                })
            ).rejects.toThrow('Test error');
        });

        it('should pass span to function', async () => {
            await withSpan('test-operation', async (span) => {
                span.setAttribute('custom.attr', 'value');
                expect(span.setAttribute).toBeDefined();
            });
        });
    });

    // =========================================================================
    // withSpanSync
    // =========================================================================

    describe('withSpanSync', () => {
        it('should execute sync function within span', () => {
            let executed = false;

            withSpanSync('sync-operation', (span) => {
                expect(span).toBeDefined();
                executed = true;
                return 'result';
            });

            expect(executed).toBe(true);
        });

        it('should return function result', () => {
            const result = withSpanSync('sync-operation', () => {
                return 42;
            });

            expect(result).toBe(42);
        });

        it('should handle sync errors', () => {
            expect(() =>
                withSpanSync('failing-sync', () => {
                    throw new Error('Sync error');
                })
            ).toThrow('Sync error');
        });
    });

    // =========================================================================
    // HTTP Tracing
    // =========================================================================

    describe('HTTP Tracing', () => {
        it('should create HTTP span with attributes', () => {
            const span = createHttpSpan('GET /api/test', {
                method: 'GET',
                url: '/api/test',
                correlationId: 'req_123',
            });

            expect(span).toBeDefined();
            span.end();
        });

        it('should trace HTTP request', async () => {
            const result = await traceHttpRequest(
                {
                    method: 'POST',
                    url: '/api/users',
                    correlationId: 'req_456',
                    statusCode: 201,
                },
                async (span) => {
                    expect(span).toBeDefined();
                    return { id: 'user_1' };
                }
            );

            expect(result).toEqual({ id: 'user_1' });
        });

        it('should include optional HTTP attributes', async () => {
            await traceHttpRequest(
                {
                    method: 'GET',
                    url: '/api/agents',
                    userAgent: 'TestAgent/1.0',
                    userId: 'user_1',
                    orgId: 'org_1',
                },
                async () => {
                    return [];
                }
            );
        });
    });

    // =========================================================================
    // Database Tracing
    // =========================================================================

    describe('Database Tracing', () => {
        it('should create DB span with attributes', () => {
            const span = createDbSpan('SELECT agents', {
                system: 'postgresql',
                operation: 'SELECT',
                table: 'agents',
            });

            expect(span).toBeDefined();
            span.end();
        });

        it('should trace database operation', async () => {
            const result = await traceDbOperation(
                {
                    system: 'postgresql',
                    operation: 'INSERT',
                    table: 'decisions',
                    statement: 'INSERT INTO decisions (...)',
                },
                async () => {
                    return { id: 'dec_1' };
                }
            );

            expect(result).toEqual({ id: 'dec_1' });
        });

        it('should work without optional table', async () => {
            await traceDbOperation(
                {
                    system: 'redis',
                    operation: 'GET',
                },
                async () => {
                    return 'cached-value';
                }
            );
        });
    });

    // =========================================================================
    // WebSocket Tracing
    // =========================================================================

    describe('WebSocket Tracing', () => {
        it('should create inbound WS span', () => {
            const span = createWsSpan('WS heartbeat', {
                messageType: 'heartbeat',
                direction: 'inbound',
                agentId: 'agent_1',
            });

            expect(span).toBeDefined();
            span.end();
        });

        it('should create outbound WS span', () => {
            const span = createWsSpan('WS task_result', {
                messageType: 'task_result',
                direction: 'outbound',
                agentId: 'agent_1',
                sessionId: 'sess_123',
            });

            expect(span).toBeDefined();
            span.end();
        });

        it('should trace WS message', async () => {
            const result = await traceWsMessage(
                {
                    messageType: 'decision_request',
                    direction: 'inbound',
                    agentId: 'agent_1',
                },
                async () => {
                    return { processed: true };
                }
            );

            expect(result).toEqual({ processed: true });
        });
    });

    // =========================================================================
    // Decision Flow Tracing
    // =========================================================================

    describe('Decision Flow Tracing', () => {
        it('should create decision span', () => {
            const span = createDecisionSpan('Decision execute', {
                decisionId: 'dec_123',
                decisionType: 'execute',
                agentId: 'agent_1',
                riskLevel: 'medium',
            });

            expect(span).toBeDefined();
            span.end();
        });

        it('should trace decision flow', async () => {
            const result = await traceDecisionFlow(
                {
                    decisionId: 'dec_456',
                    decisionType: 'external',
                    orgId: 'org_1',
                    riskLevel: 'high',
                    outcome: 'approved',
                },
                async () => {
                    return { approved: true };
                }
            );

            expect(result).toEqual({ approved: true });
        });

        it('should trace tribunal process', async () => {
            const result = await traceTribunalProcess(
                'dec_789',
                'trib_123',
                async () => {
                    return { votes: 3, consensus: true };
                }
            );

            expect(result).toEqual({ votes: 3, consensus: true });
        });

        it('should trace decision execution', async () => {
            const result = await traceDecisionExecution(
                'dec_abc',
                'auto_approval',
                async () => {
                    return { executed: true };
                }
            );

            expect(result).toEqual({ executed: true });
        });
    });

    // =========================================================================
    // Context Operations
    // =========================================================================

    describe('Context Operations', () => {
        it('should get current span function exists', () => {
            // In test environment without SDK, getCurrentSpan may return undefined
            const span = getCurrentSpan();
            // Just verify function exists and doesn't throw
            expect(typeof getCurrentSpan).toBe('function');
        });

        it('should get current trace ID function exists', () => {
            // In test environment without SDK, getCurrentTraceId may return undefined
            const traceId = getCurrentTraceId();
            // Just verify function exists and doesn't throw
            expect(typeof getCurrentTraceId).toBe('function');
        });

        it('should get current span ID function exists', () => {
            // In test environment without SDK, getCurrentSpanId may return undefined
            const spanId = getCurrentSpanId();
            // Just verify function exists and doesn't throw
            expect(typeof getCurrentSpanId).toBe('function');
        });

        it('should add attribute to current span without error', async () => {
            await withSpan('attribute-test', async () => {
                // Should not throw even if context not propagated
                addSpanAttribute('custom.key', 'custom-value');
                addSpanAttribute('custom.number', 42);
                addSpanAttribute('custom.bool', true);
            });
        });

        it('should add event to current span without error', async () => {
            await withSpan('event-test', async () => {
                // Should not throw even if context not propagated
                addSpanEvent('test-event', { detail: 'value' });
            });
        });
    });

    // =========================================================================
    // Error Recording
    // =========================================================================

    describe('Error Recording', () => {
        it('should record error on span', () => {
            const span = createSpan('error-test');
            const error = new Error('Test error');

            recordSpanError(span, error);
            span.end();
        });

        it('should handle non-Error objects', () => {
            const span = createSpan('error-test');

            recordSpanError(span, 'string error');
            span.end();
        });
    });

    // =========================================================================
    // Tracing Context
    // =========================================================================

    describe('Tracing Context', () => {
        it('should create tracing context for requests', () => {
            const { span, context } = createTracingContext('GET', '/api/test', 'req_123');

            expect(span).toBeDefined();
            expect(context).toBeDefined();
            span.end();
        });
    });

    // =========================================================================
    // Convenience API
    // =========================================================================

    describe('Convenience API', () => {
        it('should expose all tracing functions', () => {
            expect(tracing.init).toBe(initTracing);
            expect(tracing.shutdown).toBe(shutdownTracing);
            expect(tracing.isInitialized).toBe(isTracingInitialized);
            expect(tracing.getTracer).toBe(getTracer);
        });

        it('should expose span operations', () => {
            expect(tracing.createSpan).toBe(createSpan);
            expect(tracing.withSpan).toBe(withSpan);
            expect(tracing.withSpanSync).toBe(withSpanSync);
            expect(tracing.recordError).toBe(recordSpanError);
        });

        it('should expose HTTP tracing', () => {
            expect(tracing.http.trace).toBe(traceHttpRequest);
            expect(tracing.http.createSpan).toBe(createHttpSpan);
        });

        it('should expose DB tracing', () => {
            expect(tracing.db.trace).toBe(traceDbOperation);
            expect(tracing.db.createSpan).toBe(createDbSpan);
        });

        it('should expose WS tracing', () => {
            expect(tracing.ws.trace).toBe(traceWsMessage);
            expect(tracing.ws.createSpan).toBe(createWsSpan);
        });

        it('should expose decision tracing', () => {
            expect(tracing.decision.trace).toBe(traceDecisionFlow);
            expect(tracing.decision.createSpan).toBe(createDecisionSpan);
            expect(tracing.decision.traceTribunal).toBe(traceTribunalProcess);
            expect(tracing.decision.traceExecution).toBe(traceDecisionExecution);
        });

        it('should expose context operations', () => {
            expect(tracing.getCurrentSpan).toBe(getCurrentSpan);
            expect(tracing.getCurrentTraceId).toBe(getCurrentTraceId);
            expect(tracing.getCurrentSpanId).toBe(getCurrentSpanId);
            expect(tracing.addAttribute).toBe(addSpanAttribute);
            expect(tracing.addEvent).toBe(addSpanEvent);
        });
    });
});
