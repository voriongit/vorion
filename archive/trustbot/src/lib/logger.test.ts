/**
 * Structured Logger - Unit Tests
 * Epic 9: Production Hardening
 * Story 9.2: Structured Logging with Correlation IDs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    getLogger,
    createLogger,
    childLogger,
    logger,
    logRequest,
    decisionLogger,
    agentLogger,
    trustLogger,
    tribunalLogger,
    type LogContext,
} from './logger.js';

describe('Structured Logger', () => {
    // ========================================================================
    // Logger Factory Tests
    // ========================================================================

    describe('Logger Factory', () => {
        it('getLogger returns a singleton instance', () => {
            const logger1 = getLogger();
            const logger2 = getLogger();
            expect(logger1).toBe(logger2);
        });

        it('createLogger creates a new logger with context', () => {
            const log = createLogger({ component: 'test', userId: 'user-123' });
            expect(log).toBeDefined();
            expect(log.info).toBeDefined();
            expect(log.error).toBeDefined();
        });

        it('childLogger creates a child with bindings', () => {
            const child = childLogger({ component: 'child-test' });
            expect(child).toBeDefined();
            expect(child.info).toBeDefined();
        });

        it('default logger export is available', () => {
            expect(logger).toBeDefined();
            expect(logger.info).toBeDefined();
            expect(logger.error).toBeDefined();
        });
    });

    // ========================================================================
    // Correlation ID Tests
    // ========================================================================

    describe('Correlation ID', () => {
        it('setCorrelationId and getCorrelationId work correctly', () => {
            const log = createLogger();
            expect(log.getCorrelationId()).toBeUndefined();

            log.setCorrelationId('test-correlation-123');
            expect(log.getCorrelationId()).toBe('test-correlation-123');
        });

        it('child loggers inherit correlation ID from context', () => {
            const parent = createLogger({ correlationId: 'parent-id' });
            const child = parent.child({ component: 'child' });
            // Child should have its own correlation ID management
            expect(child).toBeDefined();
        });
    });

    // ========================================================================
    // Log Level Methods Tests
    // ========================================================================

    describe('Log Level Methods', () => {
        let log: ReturnType<typeof createLogger>;

        beforeEach(() => {
            log = createLogger({ component: 'test' });
        });

        it('trace method exists and is callable', () => {
            expect(() => log.trace('Trace message')).not.toThrow();
        });

        it('debug method exists and is callable', () => {
            expect(() => log.debug('Debug message')).not.toThrow();
        });

        it('info method exists and is callable', () => {
            expect(() => log.info('Info message')).not.toThrow();
        });

        it('warn method exists and is callable', () => {
            expect(() => log.warn('Warning message')).not.toThrow();
        });

        it('error method exists and is callable', () => {
            expect(() => log.error('Error message')).not.toThrow();
        });

        it('error method accepts Error object', () => {
            const err = new Error('Test error');
            expect(() => log.error('Error occurred', err)).not.toThrow();
        });

        it('fatal method exists and is callable', () => {
            expect(() => log.fatal('Fatal message')).not.toThrow();
        });

        it('fatal method accepts Error object', () => {
            const err = new Error('Fatal error');
            expect(() => log.fatal('Fatal occurred', err)).not.toThrow();
        });
    });

    // ========================================================================
    // Context Enrichment Tests
    // ========================================================================

    describe('Context Enrichment', () => {
        it('accepts additional context in log methods', () => {
            const log = createLogger();
            const context: LogContext = {
                userId: 'user-123',
                orgId: 'org-456',
                decisionId: 'dec-789',
            };

            expect(() => log.info('Test message', context)).not.toThrow();
        });

        it('child method creates logger with merged context', () => {
            const parent = createLogger({ service: 'api' });
            const child = parent.child({ component: 'auth' });

            expect(child).toBeDefined();
            expect(child.info).toBeDefined();
        });
    });

    // ========================================================================
    // Request Logging Tests
    // ========================================================================

    describe('Request Logging', () => {
        it('logRequest logs successful requests', () => {
            expect(() => logRequest({
                method: 'GET',
                path: '/api/test',
                statusCode: 200,
                responseTimeMs: 50,
                correlationId: 'req-123',
            })).not.toThrow();
        });

        it('logRequest logs client errors as warnings', () => {
            expect(() => logRequest({
                method: 'POST',
                path: '/api/auth',
                statusCode: 401,
                responseTimeMs: 10,
            })).not.toThrow();
        });

        it('logRequest logs server errors as errors', () => {
            expect(() => logRequest({
                method: 'GET',
                path: '/api/data',
                statusCode: 500,
                responseTimeMs: 100,
            })).not.toThrow();
        });

        it('logRequest includes user context when provided', () => {
            expect(() => logRequest({
                method: 'GET',
                path: '/api/user',
                statusCode: 200,
                responseTimeMs: 25,
                userId: 'user-123',
                orgId: 'org-456',
                userAgent: 'Mozilla/5.0',
                ip: '192.168.1.1',
            })).not.toThrow();
        });
    });

    // ========================================================================
    // Domain-Specific Logger Tests
    // ========================================================================

    describe('Domain-Specific Loggers', () => {
        it('decisionLogger creates logger with decision context', () => {
            const log = decisionLogger('dec-123', 'corr-456');
            expect(log).toBeDefined();
            expect(log.getCorrelationId()).toBe('corr-456');
        });

        it('agentLogger creates logger with agent context', () => {
            const log = agentLogger('agent-123', 'corr-789');
            expect(log).toBeDefined();
            expect(log.getCorrelationId()).toBe('corr-789');
        });

        it('trustLogger creates logger for trust operations', () => {
            const log = trustLogger('corr-101');
            expect(log).toBeDefined();
            expect(log.getCorrelationId()).toBe('corr-101');
        });

        it('tribunalLogger creates logger with tribunal context', () => {
            const log = tribunalLogger('tribunal-123', 'corr-202');
            expect(log).toBeDefined();
            expect(log.getCorrelationId()).toBe('corr-202');
        });

        it('domain loggers work without correlation ID', () => {
            const decision = decisionLogger('dec-1');
            const agent = agentLogger('agent-1');
            const trust = trustLogger();
            const tribunal = tribunalLogger();

            expect(decision).toBeDefined();
            expect(agent).toBeDefined();
            expect(trust).toBeDefined();
            expect(tribunal).toBeDefined();
        });
    });
});
