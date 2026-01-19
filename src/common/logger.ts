/**
 * Logging configuration for Vorion
 *
 * Provides structured logging with automatic redaction of sensitive data.
 *
 * @packageDocumentation
 */

import pino, { Logger as PinoLogger } from 'pino';
import { redact, redactString, createRedactor } from './redaction.js';

const level = process.env['VORION_LOG_LEVEL'] ?? 'info';
const isProduction = process.env['NODE_ENV'] === 'production';

/**
 * Custom serializers that redact sensitive data
 */
const redactingSerializer = createRedactor({
  preserveType: true,
  // Additional patterns specific to Vorion
  sensitivePatterns: [
    /jwt/i,
    /bearer/i,
    /signature/i,
    /private/i,
    /secret/i,
    /key/i,
    /token/i,
    /password/i,
    /credential/i,
    /authorization/i,
  ],
});

/**
 * Serialize objects with redaction
 */
function redactObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return redactString(obj);
  }

  if (typeof obj === 'object') {
    return redactingSerializer.redact(obj);
  }

  return obj;
}

/**
 * Serialize error objects for logging
 */
function serializeError(err: Error): Record<string, unknown> {
  return {
    type: err.constructor.name,
    message: isProduction ? redactString(err.message) : err.message,
    stack: isProduction ? '[REDACTED]' : err.stack,
    ...(err.cause ? { cause: serializeError(err.cause as Error) } : {}),
  };
}

/**
 * Custom serializers for common log properties
 */
const serializers: { [key: string]: pino.SerializerFn } = {
  // Redact error stack traces in production (may contain sensitive data)
  err: serializeError,

  // Redact request headers
  req: (req: { headers?: Record<string, unknown>; url?: string; method?: string }) => ({
    method: req.method,
    url: req.url,
    headers: req.headers ? redact(req.headers) : undefined,
  }),

  // Redact response (if logging responses)
  res: (res: { statusCode?: number }) => ({
    statusCode: res.statusCode,
  }),

  // Generic object redaction
  data: redactObject,
  context: redactObject,
  metadata: redactObject,
  payload: redactObject,
  body: redactObject,
};

/**
 * Create the base logger instance
 */
function createBaseLogger(): PinoLogger {
  const options: pino.LoggerOptions = {
    level,
    serializers,
    base: {
      service: 'vorion',
      version: process.env['npm_package_version'],
    },
    // Redaction paths for pino's built-in redaction
    redact: {
      paths: [
        'password',
        'secret',
        'token',
        'apiKey',
        'api_key',
        'authorization',
        'Authorization',
        'cookie',
        'Cookie',
        '*.password',
        '*.secret',
        '*.token',
        '*.apiKey',
        '*.api_key',
        'headers.authorization',
        'headers.cookie',
        'req.headers.authorization',
        'req.headers.cookie',
      ],
      censor: '[REDACTED]',
    },
    // Format for production vs development
    formatters: {
      level: (label) => ({ level: label }),
      bindings: (bindings) => ({
        service: bindings['service'],
        version: bindings['version'],
        // Omit pid and hostname in production for cleaner logs
        ...(isProduction ? {} : { pid: bindings['pid'], hostname: bindings['hostname'] }),
      }),
    },
  };

  // Use pino-pretty in development
  if (!isProduction) {
    options.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    };
  }

  return pino(options);
}

/**
 * Base logger instance
 */
export const logger = createBaseLogger();

export type Logger = PinoLogger;

/**
 * Create a child logger with context
 */
export function createLogger(context: Record<string, unknown>): Logger {
  // Redact context before creating child logger
  const safeContext = redact(context);
  return logger.child(safeContext);
}

/**
 * Create a request-scoped logger
 */
export function createRequestLogger(
  requestId: string,
  tenantId?: string,
  userId?: string
): Logger {
  return logger.child({
    requestId,
    ...(tenantId && { tenantId }),
    ...(userId && { userId }),
  });
}

/**
 * Log with automatic redaction
 */
export function logSafe(
  level: 'debug' | 'info' | 'warn' | 'error',
  obj: Record<string, unknown>,
  msg?: string
): void {
  const safeObj = redact(obj);
  logger[level](safeObj, msg);
}

/**
 * Audit log for security-sensitive operations
 * Always logs regardless of level, with full redaction
 */
export function auditLog(
  action: string,
  details: {
    userId?: string;
    tenantId?: string;
    resourceType?: string;
    resourceId?: string;
    outcome: 'success' | 'failure' | 'denied';
    reason?: string;
    metadata?: Record<string, unknown>;
  }
): void {
  logger.info(
    {
      audit: true,
      action,
      ...redact(details),
      timestamp: new Date().toISOString(),
    },
    `AUDIT: ${action} - ${details.outcome}`
  );
}
