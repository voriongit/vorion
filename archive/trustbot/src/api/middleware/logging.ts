/**
 * Logging Middleware
 *
 * Provides HTTP request/response logging with:
 * - Correlation ID tracking
 * - Request timing
 * - User context extraction
 * - Structured log output
 *
 * Epic 9: Production Hardening
 * Story 9.2: Structured Logging with Correlation IDs
 */

import { Context, Next } from 'hono';
import { logger, logRequest, createLogger, type Logger, type LogContext } from '../../lib/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface LoggingConfig {
    /** Skip logging for these paths */
    skipPaths?: string[];
    /** Include request body in logs (be careful with sensitive data) */
    logRequestBody?: boolean;
    /** Include response body in logs (be careful with sensitive data) */
    logResponseBody?: boolean;
    /** Custom context extractor */
    contextExtractor?: (c: Context) => LogContext;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: LoggingConfig = {
    skipPaths: ['/health', '/live', '/ready', '/favicon.ico'],
    logRequestBody: false,
    logResponseBody: false,
};

// ============================================================================
// Logging Middleware
// ============================================================================

/**
 * Creates logging middleware for HTTP requests
 */
export function loggingMiddleware(config: LoggingConfig = {}) {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    return async (c: Context, next: Next) => {
        const path = c.req.path;

        // Skip logging for configured paths
        if (mergedConfig.skipPaths?.some(skipPath => path.startsWith(skipPath))) {
            await next();
            return;
        }

        const startTime = Date.now();
        const correlationId = c.get('requestId') || c.req.header('X-Request-ID') || crypto.randomUUID();

        // Create request-scoped logger
        const requestLogger = createLogger({
            correlationId,
            component: 'http',
        });
        requestLogger.setCorrelationId(correlationId);

        // Store logger in context for route handlers to use
        c.set('logger', requestLogger);
        c.set('correlationId', correlationId);

        // Log incoming request
        requestLogger.debug('Incoming request', {
            method: c.req.method,
            path: c.req.path,
            query: c.req.query(),
            userAgent: c.req.header('user-agent'),
        });

        try {
            await next();
        } catch (error) {
            // Log unhandled errors
            requestLogger.error('Unhandled request error', error, {
                method: c.req.method,
                path: c.req.path,
            });
            throw error;
        }

        // Calculate response time
        const responseTimeMs = Date.now() - startTime;

        // Extract user context if available
        const user = c.get('user') as { id?: string; email?: string; orgId?: string } | undefined;

        // Log completed request
        logRequest({
            method: c.req.method,
            path: c.req.path,
            statusCode: c.res.status,
            responseTimeMs,
            userAgent: c.req.header('user-agent'),
            ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
            correlationId,
            userId: user?.id,
            orgId: user?.orgId,
        });
    };
}

// ============================================================================
// Logger Accessor
// ============================================================================

/**
 * Get the request-scoped logger from context
 */
export function getRequestLogger(c: Context): Logger {
    const requestLogger = c.get('logger') as Logger | undefined;
    if (requestLogger) {
        return requestLogger;
    }

    // Fallback to creating a new logger with correlation ID
    const correlationId = c.get('correlationId') || c.get('requestId');
    const fallbackLogger = createLogger({ correlationId });
    if (correlationId) {
        fallbackLogger.setCorrelationId(correlationId);
    }
    return fallbackLogger;
}

/**
 * Get correlation ID from context
 */
export function getCorrelationId(c: Context): string | undefined {
    return c.get('correlationId') || c.get('requestId');
}

// ============================================================================
// Audit Logging
// ============================================================================

export interface AuditLogEntry {
    action: string;
    resource: string;
    resourceId?: string;
    userId?: string;
    orgId?: string;
    details?: Record<string, unknown>;
    success: boolean;
    correlationId?: string;
}

/**
 * Log an audit event
 */
export function logAudit(entry: AuditLogEntry): void {
    const level = entry.success ? 'info' : 'warn';
    const msg = `AUDIT: ${entry.action} ${entry.resource}${entry.resourceId ? `/${entry.resourceId}` : ''} - ${entry.success ? 'SUCCESS' : 'FAILURE'}`;

    const context: LogContext = {
        component: 'audit',
        audit: {
            action: entry.action,
            resource: entry.resource,
            resourceId: entry.resourceId,
            success: entry.success,
            details: entry.details,
        },
        correlationId: entry.correlationId,
        userId: entry.userId,
        orgId: entry.orgId,
    };

    if (level === 'warn') {
        logger.warn(msg, context);
    } else {
        logger.info(msg, context);
    }
}

// ============================================================================
// Domain Event Logging
// ============================================================================

export interface DomainEvent {
    event: string;
    aggregate: string;
    aggregateId: string;
    payload?: Record<string, unknown>;
    correlationId?: string;
    userId?: string;
    orgId?: string;
}

/**
 * Log a domain event
 */
export function logDomainEvent(event: DomainEvent): void {
    const msg = `EVENT: ${event.event} on ${event.aggregate}/${event.aggregateId}`;

    logger.info(msg, {
        component: 'events',
        event: {
            name: event.event,
            aggregate: event.aggregate,
            aggregateId: event.aggregateId,
            payload: event.payload,
        },
        correlationId: event.correlationId,
        userId: event.userId,
        orgId: event.orgId,
    });
}
