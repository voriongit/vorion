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
import { authenticate, requireTenantAccess } from './auth.js';
import { createRateLimitMiddleware } from './rate-limit.js';
import { validateBody, validateQuery, validateParams, escalationSchemas } from './validation.js';
import { createEscalationService } from '../escalation/index.js';

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
      // Per-tenant rate limiting (applied after authentication)
      const tenantRateLimiter = createRateLimitMiddleware({
        // Skip rate limiting for health checks
        skip: (req) => req.url === '/health' || req.url === '/ready',
      });

      // Apply tenant rate limiting to all authenticated routes
      api.addHook('preHandler', async (request, reply) => {
        // Only apply if authenticated
        if (request.auth) {
          await tenantRateLimiter(request, reply);
        }
      });

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

      // Escalation routes (authenticated with tenant authorization)
      const escalationService = createEscalationService();

      // Create escalation
      api.post<{
        Body: {
          intentId: string;
          entityId: string;
          reason: string;
          priority?: 'low' | 'medium' | 'high' | 'critical';
          escalatedTo: string;
          context?: Record<string, unknown>;
          requestedAction?: string;
          timeoutMinutes?: number;
        };
      }>(
        '/escalations',
        { preHandler: [authenticate, validateBody(escalationSchemas.create)] },
        async (request, reply) => {
          if (!request.auth) {
            return reply.status(401).send({ error: { code: 'UNAUTHORIZED' } });
          }

          const escalation = await escalationService.create({
            tenantId: request.auth.tenantId,
            intentId: request.body.intentId,
            entityId: request.body.entityId,
            reason: request.body.reason,
            priority: request.body.priority ?? 'medium',
            escalatedTo: request.body.escalatedTo,
            escalatedBy: request.auth.userId,
            context: request.body.context ?? {},
            requestedAction: request.body.requestedAction ?? '',
            timeoutMinutes: request.body.timeoutMinutes ?? 60,
          });

          return reply.status(201).send(escalation);
        }
      );

      // Get escalation by ID (with tenant check)
      api.get<{ Params: { id: string } }>(
        '/escalations/:id',
        {
          preHandler: [
            authenticate,
            validateParams(escalationSchemas.idParam),
            requireTenantAccess((req) => req.auth?.tenantId),
          ],
        },
        async (request, reply) => {
          if (!request.auth) {
            return reply.status(401).send({ error: { code: 'UNAUTHORIZED' } });
          }

          const escalation = await escalationService.get(
            request.params.id,
            request.auth.tenantId
          );

          if (!escalation) {
            return reply.status(404).send({
              error: { code: 'NOT_FOUND', message: 'Escalation not found' },
            });
          }

          return escalation;
        }
      );

      // List escalations for tenant
      api.get<{
        Querystring: {
          status?: 'pending' | 'approved' | 'rejected' | 'timeout' | 'cancelled';
          intentId?: string;
          entityId?: string;
          escalatedTo?: string;
          limit?: number;
          offset?: number;
        };
      }>(
        '/escalations',
        { preHandler: [authenticate, validateQuery(escalationSchemas.query)] },
        async (request, reply) => {
          if (!request.auth) {
            return reply.status(401).send({ error: { code: 'UNAUTHORIZED' } });
          }

          const escalations = await escalationService.query({
            tenantId: request.auth.tenantId,
            ...request.query,
          });

          return { escalations, count: escalations.length };
        }
      );

      // Resolve escalation (approve/reject)
      api.post<{
        Params: { id: string };
        Body: {
          resolution: 'approved' | 'rejected';
          notes?: string;
        };
      }>(
        '/escalations/:id/resolve',
        {
          preHandler: [
            authenticate,
            validateParams(escalationSchemas.idParam),
            validateBody(escalationSchemas.resolve),
            requireTenantAccess((req) => req.auth?.tenantId),
          ],
        },
        async (request, reply) => {
          if (!request.auth) {
            return reply.status(401).send({ error: { code: 'UNAUTHORIZED' } });
          }

          try {
            const escalation = await escalationService.resolve(
              {
                escalationId: request.params.id,
                resolution: request.body.resolution,
                resolvedBy: request.auth.userId,
                notes: request.body.notes ?? '',
              },
              request.auth.tenantId
            );

            if (!escalation) {
              return reply.status(404).send({
                error: { code: 'NOT_FOUND', message: 'Escalation not found' },
              });
            }

            return escalation;
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to resolve escalation';
            return reply.status(400).send({
              error: { code: 'INVALID_OPERATION', message },
            });
          }
        }
      );

      // Cancel escalation
      api.post<{
        Params: { id: string };
        Body: { reason?: string };
      }>(
        '/escalations/:id/cancel',
        {
          preHandler: [
            authenticate,
            validateParams(escalationSchemas.idParam),
            validateBody(escalationSchemas.cancel),
            requireTenantAccess((req) => req.auth?.tenantId),
          ],
        },
        async (request, reply) => {
          if (!request.auth) {
            return reply.status(401).send({ error: { code: 'UNAUTHORIZED' } });
          }

          try {
            const escalation = await escalationService.cancel(
              request.params.id,
              request.auth.tenantId,
              request.auth.userId,
              request.body.reason
            );

            if (!escalation) {
              return reply.status(404).send({
                error: { code: 'NOT_FOUND', message: 'Escalation not found' },
              });
            }

            return escalation;
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to cancel escalation';
            return reply.status(400).send({
              error: { code: 'INVALID_OPERATION', message },
            });
          }
        }
      );

      // Get escalation audit trail
      api.get<{ Params: { id: string } }>(
        '/escalations/:id/audit',
        {
          preHandler: [
            authenticate,
            validateParams(escalationSchemas.idParam),
            requireTenantAccess((req) => req.auth?.tenantId),
          ],
        },
        async (request, reply) => {
          if (!request.auth) {
            return reply.status(401).send({ error: { code: 'UNAUTHORIZED' } });
          }

          const audit = await escalationService.getAuditTrail(
            request.params.id,
            request.auth.tenantId
          );

          return { audit };
        }
      );

      // Get pending escalation count
      api.get(
        '/escalations/pending/count',
        { preHandler: [authenticate] },
        async (request, reply) => {
          if (!request.auth) {
            return reply.status(401).send({ error: { code: 'UNAUTHORIZED' } });
          }

          const count = await escalationService.getPendingCount(request.auth.tenantId);
          return { count };
        }
      );
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
