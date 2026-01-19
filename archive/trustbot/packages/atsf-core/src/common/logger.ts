/**
 * Logging configuration for Vorion
 */

import pino from 'pino';

const level = process.env['VORION_LOG_LEVEL'] ?? 'info';

export const logger = pino({
  level,
  transport:
    process.env['NODE_ENV'] !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  base: {
    service: 'vorion',
    version: process.env['npm_package_version'],
  },
});

export type Logger = typeof logger;

/**
 * Create a child logger with context
 */
export function createLogger(context: Record<string, unknown>): Logger {
  return logger.child(context);
}
