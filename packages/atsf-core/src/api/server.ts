/**
 * API Server
 *
 * Fastify server providing REST API for Vorion platform.
 *
 * @packageDocumentation
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { createLogger, logger } from '../common/logger.js';
import { getConfig } from '../common/config.js';
import { createIntentService } from '../intent/index.js';
import { createProofService } from '../proof/index.js';
import { createTrustEngine } from '../trust-engine/index.js';
import { createEvaluator } from '../basis/evaluator.js';
import type { ID } from '../common/types.js';

const apiLogger = createLogger({ component: 'api' });

// Request body types
interface IntentSubmitBody {
  entityId: ID;
  goal: string;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

interface ConstraintValidateBody {
  entityId: ID;
  intentType: string;
  context?: Record<string, unknown>;
}

/**
 * Create and configure the API server
 */
export async function createServer(): Promise<FastifyInstance> {
  const config = getConfig();

  // Initialize services
  const intentService = createIntentService();
  const proofService = createProofService();
  const trustEngine = createTrustEngine();
  const evaluator = createEvaluator();

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
      api.post<{ Body: IntentSubmitBody }>(
        '/intents',
        async (request: FastifyRequest<{ Body: IntentSubmitBody }>, reply: FastifyReply) => {
          const { entityId, goal, context, metadata } = request.body;

          if (!entityId || !goal) {
            return reply.status(400).send({
              error: { code: 'INVALID_REQUEST', message: 'Missing required fields: entityId, goal' },
            });
          }

          const intent = await intentService.submit({
            entityId,
            goal,
            context: context ?? {},
            metadata,
          });

          apiLogger.info({ intentId: intent.id, entityId }, 'Intent submitted');
          return reply.status(201).send({ intent });
        }
      );

      api.get<{ Params: { id: ID } }>(
        '/intents/:id',
        async (request: FastifyRequest<{ Params: { id: ID } }>, reply: FastifyReply) => {
          const intent = await intentService.get(request.params.id);

          if (!intent) {
            return reply.status(404).send({
              error: { code: 'NOT_FOUND', message: 'Intent not found' },
            });
          }

          return { intent };
        }
      );

      // Proof routes
      api.get<{ Params: { id: ID } }>(
        '/proofs/:id',
        async (request: FastifyRequest<{ Params: { id: ID } }>, reply: FastifyReply) => {
          const proof = await proofService.get(request.params.id);

          if (!proof) {
            return reply.status(404).send({
              error: { code: 'NOT_FOUND', message: 'Proof not found' },
            });
          }

          return { proof };
        }
      );

      api.post<{ Params: { id: ID } }>(
        '/proofs/:id/verify',
        async (request: FastifyRequest<{ Params: { id: ID } }>, reply: FastifyReply) => {
          const result = await proofService.verify(request.params.id);

          if (result.chainPosition === -1) {
            return reply.status(404).send({
              error: { code: 'NOT_FOUND', message: 'Proof not found' },
            });
          }

          return { verification: result };
        }
      );

      // Trust routes
      api.get<{ Params: { entityId: ID } }>(
        '/trust/:entityId',
        async (request: FastifyRequest<{ Params: { entityId: ID } }>, reply: FastifyReply) => {
          const record = await trustEngine.getScore(request.params.entityId);

          if (!record) {
            return reply.status(404).send({
              error: { code: 'NOT_FOUND', message: 'Entity trust record not found' },
            });
          }

          return {
            trust: {
              entityId: record.entityId,
              score: record.score,
              level: record.level,
              levelName: trustEngine.getLevelName(record.level),
              lastCalculatedAt: record.lastCalculatedAt,
            },
          };
        }
      );

      // Constraint routes
      api.post<{ Body: ConstraintValidateBody }>(
        '/constraints/validate',
        async (request: FastifyRequest<{ Body: ConstraintValidateBody }>, reply: FastifyReply) => {
          const { entityId, intentType, context } = request.body;

          if (!entityId || !intentType) {
            return reply.status(400).send({
              error: { code: 'INVALID_REQUEST', message: 'Missing required fields' },
            });
          }

          // Get entity trust record
          const trustRecord = await trustEngine.getScore(entityId);
          if (!trustRecord) {
            return reply.status(404).send({
              error: { code: 'NOT_FOUND', message: 'Entity not found' },
            });
          }

          // Create evaluation context
          const evalContext = {
            intent: {
              id: 'validation-check',
              type: intentType,
              goal: 'constraint-validation',
              context: context ?? {},
            },
            entity: {
              id: entityId,
              type: 'agent',
              trustScore: trustRecord.score,
              trustLevel: trustRecord.level,
              attributes: {},
            },
            environment: {
              timestamp: new Date().toISOString(),
              timezone: 'UTC',
              requestId: request.id,
            },
            custom: {},
          };

          // Evaluate constraints
          const result = await evaluator.evaluate(evalContext);

          return {
            validation: {
              passed: result.passed,
              action: result.finalAction,
              rulesEvaluated: result.rulesEvaluated.length,
              violations: result.violatedRules.map((r) => ({
                ruleId: r.ruleId,
                reason: r.reason,
              })),
            },
          };
        }
      );
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
