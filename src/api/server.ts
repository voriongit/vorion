/**
 * API Server
 *
 * Fastify server providing REST API for Vorion platform.
 *
 * @packageDocumentation
 */

import Fastify, { FastifyInstance, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyJwt from '@fastify/jwt';
import { createLogger, logger } from '../common/logger.js';
import { getConfig } from '../common/config.js';
import { checkDatabaseHealth } from '../common/db.js';
import { checkRedisHealth } from '../common/redis.js';
import { z } from 'zod';
import {
  createIntentService,
  intentSubmissionSchema,
} from '../intent/index.js';
import {
  registerIntentWorkers,
  shutdownWorkers,
  getQueueHealth,
  retryDeadLetterJob,
  enqueueIntentSubmission,
} from '../intent/queues.js';
import { createEscalationService } from '../intent/escalation.js';
import { getMetrics, getMetricsContentType } from '../intent/metrics.js';
import { startScheduler, stopScheduler, getSchedulerStatus, runCleanupNow } from '../intent/scheduler.js';
import type { IntentStatus } from '../common/types.js';
import { INTENT_STATUSES } from '../common/types.js';

const apiLogger = createLogger({ component: 'api' });
const intentService = createIntentService();
const escalationService = createEscalationService();

const intentIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const intentListQuerySchema = z.object({
  entityId: z.string().uuid().optional(),
  status: z
    .string()
    .refine((value): value is IntentStatus => INTENT_STATUSES.includes(value as IntentStatus), {
      message: 'Invalid status',
    })
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().uuid().optional(),
});

const intentCancelBodySchema = z.object({
  reason: z.string().min(1).max(500),
});

const escalationIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const escalationResolveBodySchema = z.object({
  notes: z.string().max(1000).optional(),
});

const dlqRetryParamsSchema = z.object({
  jobId: z.string(),
});

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      tenantId: string;
      sub: string;
      [key: string]: unknown;
    };
    user: {
      tenantId: string;
      sub: string;
      [key: string]: unknown;
    };
  }
}

async function getTenantId(request: FastifyRequest): Promise<string> {
  const payload = await request.jwtVerify<{ tenantId?: string }>();
  if (!payload.tenantId) {
    const error = new Error('Tenant context missing from token');
    (error as Error & { statusCode?: number }).statusCode = 403;
    throw error;
  }
  return payload.tenantId;
}

/**
 * Create and configure the API server
 */
export async function createServer(): Promise<FastifyInstance> {
  const config = getConfig();

  const server = Fastify({
    logger: logger as unknown as FastifyInstance['log'],
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
  });

  await server.register(fastifyJwt, {
    secret: config.jwt.secret,
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
  server.get('/ready', async (_request, reply) => {
    const [dbHealth, redisHealth, queueHealth] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
      getQueueHealth().catch((error) => ({
        error: error instanceof Error ? error.message : 'Unknown error',
      })),
    ]);

    const isHealthy = dbHealth.healthy && redisHealth.healthy;

    const response = {
      status: isHealthy ? 'ready' : 'degraded',
      checks: {
        database: {
          status: dbHealth.healthy ? 'ok' : 'error',
          latencyMs: dbHealth.latencyMs,
          error: dbHealth.error,
        },
        redis: {
          status: redisHealth.healthy ? 'ok' : 'error',
          latencyMs: redisHealth.latencyMs,
          error: redisHealth.error,
        },
        queues: 'error' in queueHealth ? { status: 'error', error: queueHealth.error } : {
          status: 'ok',
          intake: queueHealth.intake,
          evaluate: queueHealth.evaluate,
          decision: queueHealth.decision,
          deadLetter: queueHealth.deadLetter,
        },
      },
      timestamp: new Date().toISOString(),
    };

    return reply.status(isHealthy ? 200 : 503).send(response);
  });

  // Metrics endpoint (Prometheus format)
  server.get('/metrics', async (_request, reply) => {
    const metrics = await getMetrics();
    return reply
      .header('Content-Type', getMetricsContentType())
      .send(metrics);
  });

  // Scheduler status (no auth required for health monitoring)
  server.get('/scheduler', async () => ({
    status: 'running',
    tasks: getSchedulerStatus(),
    timestamp: new Date().toISOString(),
  }));

  // API routes
  server.register(
    async (api) => {
      // Intent routes
      api.post('/intents', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const body = intentSubmissionSchema.parse(request.body ?? {});
        const intent = await intentService.submit(body, { tenantId });
        return reply.code(202).send(intent);
      });

      api.get('/intents/:id', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const params = intentIdParamsSchema.parse(request.params ?? {});
        const result = await intentService.getWithEvents(params.id, tenantId);
        if (!result) {
          return reply.status(404).send({
            error: { code: 'INTENT_NOT_FOUND', message: 'Intent not found' },
          });
        }
        return reply.send({
          ...result.intent,
          events: result.events,
          evaluations: result.evaluations ?? [],
        });
      });

      api.get('/intents', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const query = intentListQuerySchema.parse(request.query ?? {});
        const listOptions: Parameters<typeof intentService.list>[0] = { tenantId };
        if (query.entityId) listOptions.entityId = query.entityId;
        if (query.status) listOptions.status = query.status as IntentStatus;
        if (query.limit) listOptions.limit = query.limit;
        if (query.cursor) listOptions.cursor = query.cursor;
        const intents = await intentService.list(listOptions);

        // Include next cursor for pagination
        const nextCursor = intents.length > 0 ? intents[intents.length - 1]?.id : undefined;
        return reply.send({
          data: intents,
          pagination: {
            nextCursor,
            hasMore: intents.length === (query.limit ?? 50),
          },
        });
      });

      // Cancel an intent
      api.post('/intents/:id/cancel', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const params = intentIdParamsSchema.parse(request.params ?? {});
        const body = intentCancelBodySchema.parse(request.body ?? {});

        const cancelledBy = (request.user as { sub?: string })?.sub;
        const intent = await intentService.cancel(params.id, cancelledBy
          ? { tenantId, reason: body.reason, cancelledBy }
          : { tenantId, reason: body.reason }
        );

        if (!intent) {
          return reply.status(404).send({
            error: {
              code: 'INTENT_NOT_FOUND_OR_NOT_CANCELLABLE',
              message: 'Intent not found or cannot be cancelled in current state'
            },
          });
        }

        return reply.send(intent);
      });

      // Soft delete an intent (GDPR)
      api.delete('/intents/:id', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const params = intentIdParamsSchema.parse(request.params ?? {});

        const intent = await intentService.delete(params.id, tenantId);

        if (!intent) {
          return reply.status(404).send({
            error: { code: 'INTENT_NOT_FOUND', message: 'Intent not found' },
          });
        }

        return reply.status(204).send();
      });

      // Verify event chain integrity
      api.get('/intents/:id/verify', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const params = intentIdParamsSchema.parse(request.params ?? {});

        // First check intent exists
        const intent = await intentService.get(params.id, tenantId);
        if (!intent) {
          return reply.status(404).send({
            error: { code: 'INTENT_NOT_FOUND', message: 'Intent not found' },
          });
        }

        const verification = await intentService.verifyEventChain(params.id);
        return reply.send(verification);
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

      // ========== Escalation Routes ==========

      // List pending escalations for tenant
      api.get('/escalations', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const escalations = await escalationService.listPending(tenantId);
        return reply.send({ data: escalations });
      });

      // Get escalation by ID
      api.get('/escalations/:id', async (request, reply) => {
        const params = escalationIdParamsSchema.parse(request.params ?? {});
        const escalation = await escalationService.get(params.id);
        if (!escalation) {
          return reply.status(404).send({
            error: { code: 'ESCALATION_NOT_FOUND', message: 'Escalation not found' },
          });
        }
        return reply.send(escalation);
      });

      // Get escalation for an intent
      api.get('/intents/:id/escalation', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const params = intentIdParamsSchema.parse(request.params ?? {});

        const intent = await intentService.get(params.id, tenantId);
        if (!intent) {
          return reply.status(404).send({
            error: { code: 'INTENT_NOT_FOUND', message: 'Intent not found' },
          });
        }

        const escalation = await escalationService.getByIntentId(params.id);
        if (!escalation) {
          return reply.status(404).send({
            error: { code: 'ESCALATION_NOT_FOUND', message: 'No escalation for this intent' },
          });
        }
        return reply.send(escalation);
      });

      // Approve an escalation
      api.post('/escalations/:id/approve', async (request, reply) => {
        const params = escalationIdParamsSchema.parse(request.params ?? {});
        const body = escalationResolveBodySchema.parse(request.body ?? {});
        const user = request.user as { sub?: string };

        const resolveOptions = body.notes
          ? { resolvedBy: user.sub ?? 'unknown', notes: body.notes }
          : { resolvedBy: user.sub ?? 'unknown' };
        const escalation = await escalationService.approve(params.id, resolveOptions);

        if (!escalation) {
          return reply.status(404).send({
            error: { code: 'ESCALATION_NOT_FOUND', message: 'Escalation not found' },
          });
        }

        // Update intent status to approved if escalation approved
        if (escalation.status === 'approved') {
          await intentService.updateStatus(escalation.intentId, escalation.tenantId, 'approved', 'escalated');
        }

        return reply.send(escalation);
      });

      // Reject an escalation
      api.post('/escalations/:id/reject', async (request, reply) => {
        const params = escalationIdParamsSchema.parse(request.params ?? {});
        const body = escalationResolveBodySchema.parse(request.body ?? {});
        const user = request.user as { sub?: string };

        const rejectOptions = body.notes
          ? { resolvedBy: user.sub ?? 'unknown', notes: body.notes }
          : { resolvedBy: user.sub ?? 'unknown' };
        const escalation = await escalationService.reject(params.id, rejectOptions);

        if (!escalation) {
          return reply.status(404).send({
            error: { code: 'ESCALATION_NOT_FOUND', message: 'Escalation not found' },
          });
        }

        // Update intent status to denied if escalation rejected
        if (escalation.status === 'rejected') {
          await intentService.updateStatus(escalation.intentId, escalation.tenantId, 'denied', 'escalated');
        }

        return reply.send(escalation);
      });

      // ========== Intent Replay ==========

      // Replay an intent (re-enqueue for processing)
      api.post('/intents/:id/replay', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const params = intentIdParamsSchema.parse(request.params ?? {});

        const intent = await intentService.get(params.id, tenantId);
        if (!intent) {
          return reply.status(404).send({
            error: { code: 'INTENT_NOT_FOUND', message: 'Intent not found' },
          });
        }

        // Only replay failed or denied intents
        if (!['failed', 'denied'].includes(intent.status)) {
          return reply.status(400).send({
            error: {
              code: 'INVALID_STATE',
              message: `Cannot replay intent in ${intent.status} status`,
            },
          });
        }

        // Reset status and re-enqueue
        await intentService.updateStatus(params.id, tenantId, 'pending', intent.status);
        const enqueueOptions = intent.intentType
          ? { namespace: intent.intentType }
          : {};
        await enqueueIntentSubmission(intent, enqueueOptions);

        return reply.send({
          message: 'Intent queued for replay',
          intentId: params.id,
        });
      });

      // ========== Dead Letter Queue ==========

      // Retry a job from DLQ
      api.post('/dlq/:jobId/retry', async (request, reply) => {
        const params = dlqRetryParamsSchema.parse(request.params ?? {});

        const success = await retryDeadLetterJob(params.jobId);
        if (!success) {
          return reply.status(404).send({
            error: { code: 'JOB_NOT_FOUND', message: 'Dead letter job not found' },
          });
        }

        return reply.send({ message: 'Job retried successfully', jobId: params.jobId });
      });

      // ========== Admin Operations ==========

      // Trigger cleanup job manually
      api.post('/admin/cleanup', async (_request, reply) => {
        const result = await runCleanupNow();
        return reply.send(result);
      });
    },
    { prefix: config.api.basePath }
  );

  // Error handler
  server.setErrorHandler((error, request, reply) => {
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

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    apiLogger.info({ signal }, 'Shutdown signal received');

    try {
      // Stop accepting new requests
      await server.close();
      apiLogger.info('HTTP server closed');

      // Stop scheduled jobs
      stopScheduler();
      apiLogger.info('Scheduler stopped');

      // Shutdown workers gracefully
      await shutdownWorkers();
      apiLogger.info('Workers shutdown complete');

      process.exit(0);
    } catch (error) {
      apiLogger.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await server.listen({
      port: config.api.port,
      host: config.api.host,
    });

    try {
      registerIntentWorkers(intentService);
      apiLogger.info('Intent workers started');
    } catch (error) {
      apiLogger.error({ error }, 'Failed to start intent workers');
    }

    try {
      startScheduler();
      apiLogger.info('Scheduler started');
    } catch (error) {
      apiLogger.error({ error }, 'Failed to start scheduler');
    }

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
