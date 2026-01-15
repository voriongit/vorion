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
      api.post('/intents', async (_request, _reply) => {
        // TODO: Implement intent submission
        return { message: 'Intent submission - not implemented' };
      });

      api.get('/intents/:id', async (_request, _reply) => {
        // TODO: Implement intent retrieval
        return { message: 'Intent retrieval - not implemented' };
      });

      // Proof routes
      api.get('/proofs/:id', async (_request, _reply) => {
        // TODO: Implement proof retrieval
        return { message: 'Proof retrieval - not implemented' };
      });

      api.post('/proofs/:id/verify', async (_request, _reply) => {
        // TODO: Implement proof verification
        return { message: 'Proof verification - not implemented' };
      });

      // Trust routes
      api.get('/trust/:entityId', async (_request, _reply) => {
        // TODO: Implement trust retrieval
        return { message: 'Trust retrieval - not implemented' };
      });

      // Constraint routes
      api.post('/constraints/validate', async (_request, _reply) => {
        // TODO: Implement constraint validation
        return { message: 'Constraint validation - not implemented' };
      });
    },
    { prefix: config.api.basePath }
  );

  // Error handler
  server.setErrorHandler((error: Error & { statusCode?: number; code?: string }, request, reply) => {
    apiLogger.error(
      {
        error: error.message,
        stack: error.stack,
        requestId: request.id,
      },
      'Request error'
    );

    reply.status(error.statusCode ?? 500).send({
      error: {
        code: error.code ?? 'INTERNAL_ERROR',
        message:
          config.env === 'production'
            ? 'An error occurred'
            : error.message,
      },
    });
  });

  return server;
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
