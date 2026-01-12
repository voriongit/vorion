/**
 * Structured Logging
 *
 * Provides consistent, structured logging across the application using Pino.
 * Logs are formatted differently in development (pretty) vs production (JSON).
 */

import pino from 'pino'
import { config, isDevelopment } from './config'

/**
 * Create logger instance
 */
export const logger = pino({
  level: config.monitoring.logLevel,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() }
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    env: config.env,
    service: config.app.name,
  },
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
})

/**
 * Logger interface for different contexts
 */
export interface Logger {
  trace(obj: object, msg?: string): void
  trace(msg: string): void
  debug(obj: object, msg?: string): void
  debug(msg: string): void
  info(obj: object, msg?: string): void
  info(msg: string): void
  warn(obj: object, msg?: string): void
  warn(msg: string): void
  error(obj: object, msg?: string): void
  error(msg: string): void
  fatal(obj: object, msg?: string): void
  fatal(msg: string): void
}

/**
 * Create a child logger with additional context
 */
export function createLogger(context: object): Logger {
  return logger.child(context) as Logger
}

/**
 * Request logger for API routes
 */
export function logRequest(req: Request, metadata?: object) {
  logger.info({
    type: 'request',
    method: req.method,
    url: req.url,
    headers: {
      'user-agent': req.headers.get('user-agent'),
      'content-type': req.headers.get('content-type'),
    },
    ...metadata,
  })
}

/**
 * Response logger for API routes
 */
export function logResponse(
  req: Request,
  response: Response,
  duration: number,
  metadata?: object
) {
  logger.info({
    type: 'response',
    method: req.method,
    url: req.url,
    status: response.status,
    duration,
    ...metadata,
  })
}

/**
 * Error logger
 */
export function logError(error: Error, context?: object) {
  logger.error({
    type: 'error',
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
  })
}

/**
 * API call logger (for external services)
 */
export function logApiCall(
  service: string,
  operation: string,
  metadata?: object
) {
  logger.debug({
    type: 'api_call',
    service,
    operation,
    ...metadata,
  })
}

/**
 * Database query logger
 */
export function logQuery(query: string, duration: number, metadata?: object) {
  logger.debug({
    type: 'query',
    query,
    duration,
    ...metadata,
  })
}

/**
 * Audit logger for sensitive operations
 */
export function logAudit(
  userId: string,
  action: string,
  resource: string,
  metadata?: object
) {
  logger.info({
    type: 'audit',
    userId,
    action,
    resource,
    timestamp: new Date().toISOString(),
    ...metadata,
  })
}

/**
 * Performance logger
 */
export function logPerformance(
  operation: string,
  duration: number,
  metadata?: object
) {
  const level = duration > 5000 ? 'warn' : duration > 1000 ? 'info' : 'debug'

  logger[level]({
    type: 'performance',
    operation,
    duration,
    ...metadata,
  })
}

/**
 * Middleware to measure and log request duration
 */
export async function withRequestLogging<T>(
  req: Request,
  handler: () => Promise<T>
): Promise<T> {
  const start = Date.now()

  logRequest(req)

  try {
    const result = await handler()
    const duration = Date.now() - start

    logPerformance('request', duration, {
      method: req.method,
      url: req.url,
    })

    return result
  } catch (error) {
    const duration = Date.now() - start
    logError(error as Error, {
      method: req.method,
      url: req.url,
      duration,
    })
    throw error
  }
}

export default logger
