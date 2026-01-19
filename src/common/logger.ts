/**
 * Logging configuration for Vorion
 *
 * Uses pino for structured logging with W3C TraceContext support.
 */

import pino from 'pino';
import { getTraceLogContext } from './trace.js';

const level = process.env['VORION_LOG_LEVEL'] ?? 'info';

/**
 * Custom log method that automatically includes trace context
 */
function createTracingMixin() {
  return (): Record<string, unknown> => {
    const traceContext = getTraceLogContext();
    if (traceContext) {
      return traceContext;
    }
    return {};
  };
}

const pinoOptions: pino.LoggerOptions = {
  level,
  base: {
    service: 'vorion',
    version: process.env['npm_package_version'],
  },
  mixin: createTracingMixin(),
  // Redact sensitive fields
  redact: {
    paths: [
      'password',
      'secret',
      'apiKey',
      'token',
      'authorization',
      'context.password',
      'context.apiKey',
      'context.secret',
      'metadata.password',
      'metadata.apiKey',
      'metadata.secret',
    ],
    censor: '[REDACTED]',
  },
};

// Add pretty printing in development
if (process.env['NODE_ENV'] !== 'production') {
  pinoOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  };
}

export const logger = pino(pinoOptions);

export type Logger = typeof logger;

/**
 * Create a child logger with context
 * Trace context is automatically included via mixin
 */
export function createLogger(context: Record<string, unknown>): Logger {
  return logger.child(context);
}

/**
 * Create a child logger with explicit trace context override
 * Use this when trace context needs to be manually specified
 * (e.g., when processing jobs from a queue)
 */
export function createTracedLogger(
  context: Record<string, unknown>,
  traceId?: string,
  spanId?: string
): Logger {
  const traceContext: Record<string, unknown> = {};
  if (traceId) {
    traceContext.traceId = traceId;
  }
  if (spanId) {
    traceContext.spanId = spanId;
  }
  return logger.child({ ...context, ...traceContext });
}
