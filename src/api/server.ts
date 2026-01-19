/**
 * API Server
 *
 * Fastify server providing REST API for Vorion platform.
 *
 * @packageDocumentation
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { createLogger, logger } from '../common/logger.js';
import { getConfig } from '../common/config.js';

const apiLogger = createLogger({ component: 'api' });

/**
 * Create and configure the API server
 */
export async function createServer(): Promise<FastifyInstance> {
  const config = getConfig();

  const server = Fastify({
    logger: logger,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
  });

  // Register plugins
  await server.register(cors, {
    origin: config.env === 'production' ? false : true,
    credentials: true,
  });

  await server.register(helmet, {
    contentSecurityPolicy: config.env === 'production',
  });

  await server.register(rateLimit, {
    max: config.api.rateLimit,
    timeWindow: '1 minute',
  });

  // Health check endpoint
  server.get('/health', async () => ({
    status: 'healthy',
    version: process.env['npm_package_version'],
    environment: config.env,
    timestamp: new Date().toISOString(),
  }));

  // Ready check endpoint
  server.get('/ready', async () => ({
    status: 'ready',
    checks: {
      database: 'ok', // TODO: Implement actual checks
      redis: 'ok',
      proof: 'ok',
    },
  }));

  // API routes
  server.register(
    async (api) => {
      // Intent routes
      api.post('/intents', async (request, reply) => {
        // TODO: Implement intent submission
        return { message: 'Intent submission - not implemented' };
      });

      api.get('/intents/:id', async (request, reply) => {
        // TODO: Implement intent retrieval
        return { message: 'Intent retrieval - not implemented' };
      });

      // Proof routes
      api.get('/proofs/:id', async (request, reply) => {
        // TODO: Implement proof retrieval
        return { message: 'Proof retrieval - not implemented' };
      });

      api.post('/proofs/:id/verify', async (request, reply) => {
        // TODO: Implement proof verification
        return { message: 'Proof verification - not implemented' };
      });

      // Trust routes
      api.get('/trust/:entityId', async (request, reply) => {
        // TODO: Implement trust retrieval
        return { message: 'Trust retrieval - not implemented' };
      });

      // Constraint routes
      api.post('/constraints/validate', async (request, reply) => {
        // TODO: Implement constraint validation
        return { message: 'Constraint validation - not implemented' };
      });
    },
    { prefix: config.api.basePath }
  );

  // Error handler with proper type safety
  server.setErrorHandler((error, request, reply) => {
    // Extract error details safely
    const statusCode = getStatusCode(error);
    const errorCode = getErrorCode(error);
    const errorMessage = error.message || 'Unknown error';

    apiLogger.error(
      {
        error: errorMessage,
        stack: error.stack,
        requestId: request.id,
        statusCode,
        errorCode,
        path: request.url,
        method: request.method,
      },
      'Request error'
    );

    reply.status(statusCode).send({
      error: {
        code: errorCode,
        message: config.env === 'production' ? getPublicMessage(statusCode) : errorMessage,
        requestId: request.id,
      },
    });
  });

  return server;
}

/**
 * Safely extract status code from error
 */
function getStatusCode(error: unknown): number {
  if (error && typeof error === 'object') {
    // Fastify error
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return error.statusCode;
    }
    // Standard HTTP error
    if ('status' in error && typeof error.status === 'number') {
      return error.status;
    }
  }
  return 500;
}

/**
 * Safely extract error code from error
 */
function getErrorCode(error: unknown): string {
  if (error && typeof error === 'object') {
    if ('code' in error && typeof error.code === 'string') {
      return error.code;
    }
    if ('name' in error && typeof error.name === 'string') {
      return error.name.toUpperCase().replace(/ERROR$/, '_ERROR');
    }
  }
  return 'INTERNAL_ERROR';
}

/**
 * Get user-safe error message for production
 */
function getPublicMessage(statusCode: number): string {
  const messages: Record<number, string> = {
    400: 'Invalid request',
    401: 'Authentication required',
    403: 'Access denied',
    404: 'Resource not found',
    409: 'Conflict',
    422: 'Validation error',
    429: 'Too many requests',
    500: 'An internal error occurred',
    502: 'Service temporarily unavailable',
    503: 'Service unavailable',
    504: 'Request timeout',
  };
  return messages[statusCode] || 'An error occurred';
}

/**
 * Start the API server
 */
export async function startServer(): Promise<void> {
  const config = getConfig();
  const server = await createServer();

  try {
    await server.listen({
      port: config.api.port,
      host: config.api.host,
    });

    apiLogger.info(
      {
        port: config.api.port,
        host: config.api.host,
        environment: config.env,
      },
      'Server started'
    );
  } catch (error) {
    apiLogger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}
