/**
 * Structured Logger
 *
 * Production-ready logging with:
 * - JSON structured output for log aggregation
 * - Correlation ID tracking across requests
 * - Log levels (trace, debug, info, warn, error, fatal)
 * - Context enrichment
 * - Pretty printing in development
 *
 * Epic 9: Production Hardening
 * Story 9.2: Structured Logging with Correlation IDs
 */

import pino, { Logger as PinoLogger, LoggerOptions } from 'pino';

// ============================================================================
// Types
// ============================================================================

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
    correlationId?: string;
    service?: string;
    component?: string;
    userId?: string;
    orgId?: string;
    agentId?: string;
    decisionId?: string;
    taskId?: string;
    [key: string]: unknown;
}

export interface LogEntry {
    level: LogLevel;
    timestamp: string;
    correlationId?: string;
    service: string;
    message: string;
    context?: Record<string, unknown>;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
}

export interface Logger {
    trace(msg: string, context?: LogContext): void;
    debug(msg: string, context?: LogContext): void;
    info(msg: string, context?: LogContext): void;
    warn(msg: string, context?: LogContext): void;
    error(msg: string, error?: Error | unknown, context?: LogContext): void;
    fatal(msg: string, error?: Error | unknown, context?: LogContext): void;
    child(bindings: LogContext): Logger;
    setCorrelationId(correlationId: string): void;
    getCorrelationId(): string | undefined;
}

// ============================================================================
// Configuration
// ============================================================================

const SERVICE_NAME = process.env.SERVICE_NAME || 'aurais-api';
const LOG_LEVEL = (process.env.LOG_LEVEL || 'info') as LogLevel;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

// ============================================================================
// Logger Implementation
// ============================================================================

class StructuredLogger implements Logger {
    private pinoLogger: PinoLogger;
    private correlationId?: string;
    private baseContext: LogContext;

    constructor(options: { pinoLogger?: PinoLogger; context?: LogContext } = {}) {
        this.baseContext = {
            service: SERVICE_NAME,
            ...options.context,
        };

        if (options.pinoLogger) {
            this.pinoLogger = options.pinoLogger;
        } else {
            const pinoOptions: LoggerOptions = {
                level: LOG_LEVEL,
                base: {
                    service: SERVICE_NAME,
                    pid: process.pid,
                    hostname: process.env.HOSTNAME || 'localhost',
                },
                timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
                formatters: {
                    level: (label) => ({ level: label }),
                },
            };

            // Use pino-pretty for development
            if (!IS_PRODUCTION) {
                this.pinoLogger = pino({
                    ...pinoOptions,
                    transport: {
                        target: 'pino-pretty',
                        options: {
                            colorize: true,
                            translateTime: 'SYS:standard',
                            ignore: 'pid,hostname',
                        },
                    },
                });
            } else {
                this.pinoLogger = pino(pinoOptions);
            }
        }
    }

    private formatContext(context?: LogContext): Record<string, unknown> {
        const merged = {
            ...this.baseContext,
            ...context,
        };

        if (this.correlationId) {
            merged.correlationId = this.correlationId;
        }

        return merged;
    }

    private formatError(error: Error | unknown): { name: string; message: string; stack?: string } {
        if (error instanceof Error) {
            return {
                name: error.name,
                message: error.message,
                stack: error.stack,
            };
        }
        return {
            name: 'UnknownError',
            message: String(error),
        };
    }

    trace(msg: string, context?: LogContext): void {
        this.pinoLogger.trace(this.formatContext(context), msg);
    }

    debug(msg: string, context?: LogContext): void {
        this.pinoLogger.debug(this.formatContext(context), msg);
    }

    info(msg: string, context?: LogContext): void {
        this.pinoLogger.info(this.formatContext(context), msg);
    }

    warn(msg: string, context?: LogContext): void {
        this.pinoLogger.warn(this.formatContext(context), msg);
    }

    error(msg: string, error?: Error | unknown, context?: LogContext): void {
        const ctx = this.formatContext(context);
        if (error) {
            ctx.error = this.formatError(error);
        }
        this.pinoLogger.error(ctx, msg);
    }

    fatal(msg: string, error?: Error | unknown, context?: LogContext): void {
        const ctx = this.formatContext(context);
        if (error) {
            ctx.error = this.formatError(error);
        }
        this.pinoLogger.fatal(ctx, msg);
    }

    child(bindings: LogContext): Logger {
        return new StructuredLogger({
            pinoLogger: this.pinoLogger.child(bindings),
            context: { ...this.baseContext, ...bindings },
        });
    }

    setCorrelationId(correlationId: string): void {
        this.correlationId = correlationId;
    }

    getCorrelationId(): string | undefined {
        return this.correlationId;
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let loggerInstance: Logger | null = null;

/**
 * Get the singleton logger instance
 */
export function getLogger(): Logger {
    if (!loggerInstance) {
        loggerInstance = new StructuredLogger();
    }
    return loggerInstance;
}

/**
 * Create a new logger with specific context
 */
export function createLogger(context?: LogContext): Logger {
    return new StructuredLogger({ context });
}

/**
 * Create a child logger with additional bindings
 */
export function childLogger(bindings: LogContext): Logger {
    return getLogger().child(bindings);
}

// ============================================================================
// Convenience Exports
// ============================================================================

export const logger = getLogger();

// ============================================================================
// Request Logger Middleware Helper
// ============================================================================

export interface RequestLogData {
    method: string;
    path: string;
    statusCode: number;
    responseTimeMs: number;
    userAgent?: string;
    ip?: string;
    correlationId?: string;
    userId?: string;
    orgId?: string;
}

/**
 * Log an HTTP request/response
 */
export function logRequest(data: RequestLogData): void {
    const level: LogLevel = data.statusCode >= 500 ? 'error' : data.statusCode >= 400 ? 'warn' : 'info';
    const msg = `${data.method} ${data.path} ${data.statusCode} ${data.responseTimeMs}ms`;

    const context: LogContext = {
        correlationId: data.correlationId,
        component: 'http',
        http: {
            method: data.method,
            path: data.path,
            statusCode: data.statusCode,
            responseTimeMs: data.responseTimeMs,
            userAgent: data.userAgent,
            ip: data.ip,
        },
    };

    if (data.userId) context.userId = data.userId;
    if (data.orgId) context.orgId = data.orgId;

    switch (level) {
        case 'error':
            logger.error(msg, undefined, context);
            break;
        case 'warn':
            logger.warn(msg, context);
            break;
        default:
            logger.info(msg, context);
    }
}

// ============================================================================
// Domain-Specific Loggers
// ============================================================================

/**
 * Create a logger for decision-related operations
 */
export function decisionLogger(decisionId: string, correlationId?: string): Logger {
    const log = childLogger({ component: 'decisions', decisionId });
    if (correlationId) log.setCorrelationId(correlationId);
    return log;
}

/**
 * Create a logger for agent-related operations
 */
export function agentLogger(agentId: string, correlationId?: string): Logger {
    const log = childLogger({ component: 'agents', agentId });
    if (correlationId) log.setCorrelationId(correlationId);
    return log;
}

/**
 * Create a logger for trust-related operations
 */
export function trustLogger(correlationId?: string): Logger {
    const log = childLogger({ component: 'trust' });
    if (correlationId) log.setCorrelationId(correlationId);
    return log;
}

/**
 * Create a logger for tribunal-related operations
 */
export function tribunalLogger(tribunalId?: string, correlationId?: string): Logger {
    const log = childLogger({ component: 'tribunal', tribunalId });
    if (correlationId) log.setCorrelationId(correlationId);
    return log;
}
