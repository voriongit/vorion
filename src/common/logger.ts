/**
 * Logging configuration for Vorion
 */

import pino from 'pino';

const level = process.env['VORION_LOG_LEVEL'] ?? 'info';

const pinoOptions: pino.LoggerOptions = {
  level,
  base: {
    service: 'vorion',
    version: process.env['npm_package_version'],
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
 */
export function createLogger(context: Record<string, unknown>): Logger {
  return logger.child(context);
}
