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
import {
  extractTraceFromHeaders,
  createTraceContext,
  type TraceContext,
} from '../common/trace.js';
import { checkDatabaseHealth } from '../common/db.js';
import { checkRedisHealth } from '../common/redis.js';
import { withTimeout } from '../common/timeout.js';
import { z } from 'zod';
import {
  createIntentService,
  intentSubmissionSchema,
} from '../intent/index.js';
import { createAuditService } from '../audit/service.js';
import type { ChainIntegrityResult } from '../audit/types.js';
import {
  createPolicyService,
  getPolicyLoader,
  POLICY_STATUSES,
} from '../policy/index.js';
import { PolicyValidationError } from '../policy/service.js';
import type { PolicyStatus, PolicyDefinition } from '../policy/index.js';
import {
  registerIntentWorkers,
  shutdownWorkers,
  getQueueHealth,
  retryDeadLetterJob,
  enqueueIntentSubmission,
} from '../intent/queues.js';
import { createEscalationService } from '../intent/escalation.js';
import { createWebhookService, type WebhookEventType } from '../intent/webhooks.js';
import { getMetrics, getMetricsContentType, tokenRevocationChecks } from '../intent/metrics.js';
import { startScheduler, stopScheduler, getSchedulerStatus, runCleanupNow } from '../intent/scheduler.js';
import type { IntentStatus } from '../common/types.js';
import { INTENT_STATUSES } from '../common/types.js';
import {
  createTokenRevocationService,
  validateJti,
  recordTokenRevocationAudit,
} from '../common/token-revocation.js';
import {
  POLICY_ROLES,
  checkAuthorization,
} from '../common/authorization.js';
import {
  isVorionError,
  RateLimitError,
} from '../common/errors.js';

const apiLogger = createLogger({ component: 'api' });
const intentService = createIntentService();
const escalationService = createEscalationService();
const auditService = createAuditService();
const policyService = createPolicyService();
const policyLoader = getPolicyLoader();
const webhookService = createWebhookService();
const tokenRevocationService = createTokenRevocationService();

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

/**
 * Authorization helper: Check if user can resolve an escalation
 * User must be in the escalatedTo group/role OR have admin role
 */
function canResolveEscalation(
  user: { sub?: string; roles?: string[]; groups?: string[] },
  escalation: { escalatedTo: string; tenantId: string },
  userTenantId: string
): { allowed: boolean; reason?: string } {
  // Tenant isolation: user must belong to same tenant
  if (userTenantId !== escalation.tenantId) {
    return { allowed: false, reason: 'Escalation belongs to different tenant' };
  }

  // Admin override
  const roles = user.roles ?? [];
  if (roles.includes('admin') || roles.includes('tenant:admin') || roles.includes('escalation:admin')) {
    return { allowed: true };
  }

  // Check if user is in the escalatedTo group/role
  const groups = user.groups ?? [];
  const userId = user.sub;

  // escalatedTo can be a user ID, role, or group name
  const escalatedTo = escalation.escalatedTo;

  // Direct user match
  if (userId && escalatedTo === userId) {
    return { allowed: true };
  }

  // Role match
  if (roles.includes(escalatedTo)) {
    return { allowed: true };
  }

  // Group match
  if (groups.includes(escalatedTo)) {
    return { allowed: true };
  }

  // Check for approver role
  if (roles.includes('approver') || roles.includes('tenant:approver')) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `User not authorized to resolve escalation (escalatedTo: ${escalatedTo})`,
  };
}

const dlqRetryParamsSchema = z.object({
  jobId: z.string(),
});

// ========== Audit Schemas ==========

const auditIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const auditQuerySchema = z.object({
  eventType: z.string().optional(),
  eventCategory: z.enum(['intent', 'policy', 'escalation', 'authentication', 'authorization', 'data', 'system', 'admin']).optional(),
  severity: z.enum(['info', 'warning', 'error', 'critical']).optional(),
  actorId: z.string().uuid().optional(),
  targetId: z.string().uuid().optional(),
  targetType: z.enum(['intent', 'policy', 'escalation', 'entity', 'tenant', 'user', 'system']).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const auditTargetParamsSchema = z.object({
  targetType: z.enum(['intent', 'policy', 'escalation', 'entity', 'tenant', 'user', 'system']),
  targetId: z.string().uuid(),
});

const auditTargetQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const auditTraceParamsSchema = z.object({
  traceId: z.string(),
});

const auditStatsQuerySchema = z.object({
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
});

const auditVerifyBodySchema = z.object({
  startSequence: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(100000).optional(),
});

// ========== Policy Schemas ==========

const policyIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const policyListQuerySchema = z.object({
  namespace: z.string().optional(),
  status: z
    .string()
    .refine((value): value is PolicyStatus => POLICY_STATUSES.includes(value as PolicyStatus), {
      message: 'Invalid policy status',
    })
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const policyCreateBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  namespace: z.string().min(1).max(100).optional(),
  definition: z.object({
    version: z.literal('1.0'),
    target: z.object({
      intentTypes: z.array(z.string()).optional(),
      entityTypes: z.array(z.string()).optional(),
      trustLevels: z.array(z.number().int().min(0).max(4)).optional(),
      namespaces: z.array(z.string()).optional(),
    }).optional(),
    rules: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      priority: z.number().int(),
      enabled: z.boolean(),
      when: z.any(), // Complex nested condition validation handled by PolicyService
      then: z.object({
        action: z.enum(['allow', 'deny', 'escalate', 'limit', 'monitor', 'terminate']),
        reason: z.string().optional(),
        escalation: z.object({
          to: z.string(),
          timeout: z.string(),
          requireJustification: z.boolean().optional(),
          autoDenyOnTimeout: z.boolean().optional(),
        }).optional(),
        constraints: z.record(z.unknown()).optional(),
      }),
    })),
    defaultAction: z.enum(['allow', 'deny', 'escalate', 'limit', 'monitor', 'terminate']),
    defaultReason: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
  metadata: z.record(z.unknown()).optional(),
});

const policyUpdateBodySchema = z.object({
  description: z.string().max(1000).optional(),
  definition: policyCreateBodySchema.shape.definition.optional(),
  changeSummary: z.string().max(500).optional(),
});

// ========== Webhook Schemas ==========

const WEBHOOK_EVENT_TYPES: WebhookEventType[] = [
  'escalation.created',
  'escalation.approved',
  'escalation.rejected',
  'escalation.timeout',
  'intent.approved',
  'intent.denied',
  'intent.completed',
];

const webhookCreateBodySchema = z.object({
  url: z.string().url(),
  secret: z.string().min(16).max(256).optional(),
  events: z.array(
    z.string().refine((value): value is WebhookEventType => WEBHOOK_EVENT_TYPES.includes(value as WebhookEventType), {
      message: 'Invalid webhook event type',
    })
  ).min(1),
  enabled: z.boolean().optional().default(true),
});

const webhookIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const webhookDeliveriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// ========== Token Revocation Schemas ==========

const userIdParamsSchema = z.object({
  userId: z.string().uuid(),
});

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      tenantId: string;
      sub: string;
      jti?: string;
      exp?: number;
      iat?: number;
      [key: string]: unknown;
    };
    user: {
      tenantId: string;
      sub: string;
      jti?: string;
      exp?: number;
      iat?: number;
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

  // Trace context hook - extract or create trace context for each request
  // Store trace context on request for later use
  server.decorateRequest('traceContext', null);
  server.addHook('onRequest', async (request, reply) => {
    // Extract trace context from incoming headers or create new one
    const headers = request.headers as Record<string, string | string[] | undefined>;
    const extractedContext = extractTraceFromHeaders(headers);
    const traceContext = extractedContext ?? createTraceContext();

    // Store on request for later use
    (request as FastifyRequest & { traceContext: TraceContext }).traceContext = traceContext;

    // Add trace ID to reply headers for correlation
    reply.header('x-trace-id', traceContext.traceId);
    reply.header('traceparent', traceContext.traceparent);
  });

  // Liveness check endpoint - minimal self-check with process info
  server.get('/health', async (_request, reply) => {
    const start = performance.now();
    const memUsage = process.memoryUsage();

    try {
      // Minimal async self-check with timeout
      await withTimeout(
        Promise.resolve(), // Quick self-check (no external deps)
        config.health.livenessTimeoutMs,
        'Liveness check timed out'
      );

      const latencyMs = Math.round(performance.now() - start);

      return reply.send({
        status: 'healthy',
        version: process.env['npm_package_version'],
        environment: config.env,
        process: {
          uptimeSeconds: Math.round(process.uptime()),
          memoryUsageMb: {
            rss: Math.round(memUsage.rss / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024),
          },
        },
        latencyMs,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const latencyMs = Math.round(performance.now() - start);
      apiLogger.warn({ latencyMs, error: error instanceof Error ? error.message : 'Unknown error' }, 'Liveness check failed');

      return reply.status(503).send({
        status: 'unhealthy',
        version: process.env['npm_package_version'],
        environment: config.env,
        error: error instanceof Error ? error.message : 'Unknown error',
        latencyMs,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Ready check endpoint - checks all dependencies with timeout
  server.get('/ready', async (_request, reply) => {
    const start = performance.now();
    let timedOut = false;

    // Helper to determine check status
    const getCheckStatus = (check: { healthy: boolean; timedOut?: boolean }): 'ok' | 'error' | 'timeout' => {
      if (check.timedOut) return 'timeout';
      return check.healthy ? 'ok' : 'error';
    };

    try {
      // Run all checks with overall timeout
      const checksPromise = Promise.all([
        checkDatabaseHealth(),
        checkRedisHealth(),
        getQueueHealth().catch((error) => ({
          error: error instanceof Error ? error.message : 'Unknown error',
        })),
      ]);

      const [dbHealth, redisHealth, queueHealth] = await withTimeout(
        checksPromise,
        config.health.readyTimeoutMs,
        'Ready check timed out'
      );

      const anyTimedOut = dbHealth.timedOut || redisHealth.timedOut;
      const isHealthy = dbHealth.healthy && redisHealth.healthy;

      // Determine overall status
      let status: 'ready' | 'degraded' | 'unhealthy';
      if (isHealthy && !anyTimedOut) {
        status = 'ready';
      } else if (isHealthy || anyTimedOut) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }

      const response = {
        status,
        checks: {
          database: {
            status: getCheckStatus(dbHealth),
            latencyMs: dbHealth.latencyMs,
            ...(dbHealth.error && { error: dbHealth.error }),
          },
          redis: {
            status: getCheckStatus(redisHealth),
            latencyMs: redisHealth.latencyMs,
            ...(redisHealth.error && { error: redisHealth.error }),
          },
          queues: 'error' in queueHealth ? { status: 'error' as const, error: queueHealth.error } : {
            status: 'ok' as const,
            intake: queueHealth.intake,
            evaluate: queueHealth.evaluate,
            decision: queueHealth.decision,
            deadLetter: queueHealth.deadLetter,
          },
        },
        ...(anyTimedOut && { timedOut: true }),
        timestamp: new Date().toISOString(),
      };

      return reply.status(status === 'ready' ? 200 : 503).send(response);
    } catch (error) {
      // Overall timeout reached
      timedOut = true;
      const latencyMs = Math.round(performance.now() - start);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      apiLogger.warn({ latencyMs, error: errorMessage }, 'Ready check timed out');

      const response = {
        status: 'unhealthy' as const,
        checks: {
          database: { status: 'timeout' as const, error: 'Check timed out' },
          redis: { status: 'timeout' as const, error: 'Check timed out' },
          queues: { status: 'error' as const, error: 'Check timed out' },
        },
        timedOut,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };

      return reply.status(503).send(response);
    }
  });

  // Metrics endpoint (Prometheus format)
  server.get('/metrics', async (_request, reply) => {
    const metrics = await getMetrics();
    return reply
      .header('Content-Type', getMetricsContentType())
      .send(metrics);
  });

  // Scheduler status (no auth required for health monitoring)
  server.get('/scheduler', async () => {
    const schedulerStatus = getSchedulerStatus();
    return {
      status: schedulerStatus.isLeader ? 'leader' : 'standby',
      isLeader: schedulerStatus.isLeader,
      instanceId: schedulerStatus.instanceId,
      tasks: schedulerStatus.tasks,
      timestamp: new Date().toISOString(),
    };
  });

  // API routes
  server.register(
    async (api) => {
      // Token revocation check hook - runs after JWT verification
      api.addHook('preHandler', async (request, reply) => {
        // Skip revocation check for logout endpoint (allow logout with revoked token)
        if (request.url.endsWith('/auth/logout')) {
          return;
        }

        try {
          // First verify JWT to get payload
          const payload = await request.jwtVerify<{
            jti?: string;
            sub?: string;
            iat?: number;
            exp?: number;
          }>();

          // Validate jti claim
          const jtiValidation = validateJti(payload, config);
          if (!jtiValidation.valid) {
            tokenRevocationChecks.inc({ result: 'missing_jti' });
            return reply.status(401).send({
              error: { code: 'TOKEN_INVALID', message: jtiValidation.error },
            });
          }

          // If no jti, skip revocation check (handled by validateJti based on config)
          if (!jtiValidation.jti) {
            tokenRevocationChecks.inc({ result: 'missing_jti' });
            return;
          }

          // Check if the specific token is revoked
          const isTokenRevoked = await tokenRevocationService.isRevoked(jtiValidation.jti);
          if (isTokenRevoked) {
            tokenRevocationChecks.inc({ result: 'revoked' });
            apiLogger.info({ jti: jtiValidation.jti }, 'Revoked token used');
            return reply.status(401).send({
              error: { code: 'TOKEN_REVOKED', message: 'Token has been revoked' },
            });
          }

          // Check if all user tokens issued before a certain time are revoked
          if (payload.sub && payload.iat) {
            const issuedAt = new Date(payload.iat * 1000);
            const isUserRevoked = await tokenRevocationService.isUserTokenRevoked(
              payload.sub,
              issuedAt
            );
            if (isUserRevoked) {
              tokenRevocationChecks.inc({ result: 'revoked' });
              apiLogger.info(
                { userId: payload.sub, issuedAt: issuedAt.toISOString() },
                'User token revoked (all tokens for user)'
              );
              return reply.status(401).send({
                error: { code: 'TOKEN_REVOKED', message: 'Token has been revoked' },
              });
            }
          }

          tokenRevocationChecks.inc({ result: 'valid' });
        } catch (error) {
          // JWT verification failed - let Fastify handle JWT errors
          throw error;
        }
      });

      // ========== Auth Routes ==========

      // Logout - revoke current token
      api.post('/auth/logout', async (request, reply) => {
        try {
          const payload = await request.jwtVerify<{
            jti?: string;
            sub?: string;
            exp?: number;
            tenantId?: string;
          }>();

          if (!payload.jti) {
            apiLogger.warn('Logout attempted with token missing jti claim');
            // Still return success - logout is idempotent
            return reply.send({ message: 'Logged out successfully' });
          }

          if (!payload.exp) {
            apiLogger.warn({ jti: payload.jti }, 'Logout attempted with token missing exp claim');
            // Use default TTL of 1 hour if exp missing
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
            await tokenRevocationService.revokeToken(payload.jti, expiresAt);
          } else {
            const expiresAt = new Date(payload.exp * 1000);
            await tokenRevocationService.revokeToken(payload.jti, expiresAt);
          }

          // Record audit event
          if (payload.tenantId && payload.sub) {
            await recordTokenRevocationAudit(
              payload.tenantId,
              payload.sub,
              'token.revoked',
              {
                type: 'user',
                id: payload.sub,
                ip: request.ip,
              },
              { jti: payload.jti, reason: 'logout' }
            );
          }

          apiLogger.info({ jti: payload.jti, userId: payload.sub }, 'User logged out');
          return reply.send({ message: 'Logged out successfully' });
        } catch (error) {
          // If JWT verification fails, user is effectively "logged out"
          apiLogger.warn({ error }, 'Logout with invalid token');
          return reply.send({ message: 'Logged out successfully' });
        }
      });

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
        const tenantId = await getTenantId(request);
        const params = escalationIdParamsSchema.parse(request.params ?? {});
        // Pass tenantId for built-in tenant isolation
        const escalation = await escalationService.get(params.id, tenantId);
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

        const escalation = await escalationService.getByIntentId(params.id, tenantId);
        if (!escalation) {
          return reply.status(404).send({
            error: { code: 'ESCALATION_NOT_FOUND', message: 'No escalation for this intent' },
          });
        }
        return reply.send(escalation);
      });

      // Acknowledge an escalation (SLA tracking)
      api.post('/escalations/:id/acknowledge', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const params = escalationIdParamsSchema.parse(request.params ?? {});
        const user = request.user as { sub?: string };

        const escalation = await escalationService.acknowledge(
          params.id,
          tenantId,
          user.sub ?? 'unknown'
        );

        if (!escalation) {
          return reply.status(404).send({
            error: { code: 'ESCALATION_NOT_FOUND', message: 'Escalation not found' },
          });
        }

        return reply.send(escalation);
      });

      // Approve an escalation
      api.post('/escalations/:id/approve', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const params = escalationIdParamsSchema.parse(request.params ?? {});
        const body = escalationResolveBodySchema.parse(request.body ?? {});
        const user = request.user as { sub?: string; roles?: string[]; groups?: string[] };

        // First get the escalation to check authorization
        const escalationToCheck = await escalationService.get(params.id);
        if (!escalationToCheck) {
          return reply.status(404).send({
            error: { code: 'ESCALATION_NOT_FOUND', message: 'Escalation not found' },
          });
        }

        // Authorization check
        const authResult = canResolveEscalation(user, escalationToCheck, tenantId);
        if (!authResult.allowed) {
          apiLogger.warn(
            { escalationId: params.id, userId: user.sub, reason: authResult.reason },
            'Unauthorized escalation approval attempt'
          );
          return reply.status(403).send({
            error: {
              code: 'FORBIDDEN',
              message: authResult.reason ?? 'Not authorized to approve this escalation',
            },
          });
        }

        const resolveOptions = body.notes
          ? { resolvedBy: user.sub ?? 'unknown', notes: body.notes }
          : { resolvedBy: user.sub ?? 'unknown' };
        const escalation = await escalationService.approve(params.id, tenantId, resolveOptions);

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
        const tenantId = await getTenantId(request);
        const params = escalationIdParamsSchema.parse(request.params ?? {});
        const body = escalationResolveBodySchema.parse(request.body ?? {});
        const user = request.user as { sub?: string; roles?: string[]; groups?: string[] };

        // First get the escalation to check authorization
        const escalationToCheck = await escalationService.get(params.id);
        if (!escalationToCheck) {
          return reply.status(404).send({
            error: { code: 'ESCALATION_NOT_FOUND', message: 'Escalation not found' },
          });
        }

        // Authorization check
        const authResult = canResolveEscalation(user, escalationToCheck, tenantId);
        if (!authResult.allowed) {
          apiLogger.warn(
            { escalationId: params.id, userId: user.sub, reason: authResult.reason },
            'Unauthorized escalation rejection attempt'
          );
          return reply.status(403).send({
            error: {
              code: 'FORBIDDEN',
              message: authResult.reason ?? 'Not authorized to reject this escalation',
            },
          });
        }

        const rejectOptions = body.notes
          ? { resolvedBy: user.sub ?? 'unknown', notes: body.notes }
          : { resolvedBy: user.sub ?? 'unknown' };
        const escalation = await escalationService.reject(params.id, tenantId, rejectOptions);

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

      // ========== Admin Operations ==========

      // Trigger cleanup job manually
      api.post('/admin/cleanup', async (request, reply) => {
        const user = request.user as { sub?: string; roles?: string[] };
        const roles = user.roles ?? [];

        // Require admin role
        if (!roles.includes('admin') && !roles.includes('tenant:admin') && !roles.includes('system:admin')) {
          apiLogger.warn({ userId: user.sub }, 'Unauthorized cleanup attempt');
          return reply.status(403).send({
            error: { code: 'FORBIDDEN', message: 'Admin role required' },
          });
        }

        apiLogger.info({ userId: user.sub }, 'Manual cleanup triggered');
        const result = await runCleanupNow();
        return reply.send(result);
      });

      // Retry a job from DLQ (moved to admin section)
      api.post('/admin/dlq/:jobId/retry', async (request, reply) => {
        const user = request.user as { sub?: string; roles?: string[] };
        const roles = user.roles ?? [];

        // Require admin role
        if (!roles.includes('admin') && !roles.includes('tenant:admin') && !roles.includes('system:admin')) {
          apiLogger.warn({ userId: user.sub }, 'Unauthorized DLQ retry attempt');
          return reply.status(403).send({
            error: { code: 'FORBIDDEN', message: 'Admin role required' },
          });
        }

        const params = dlqRetryParamsSchema.parse(request.params ?? {});
        apiLogger.info({ userId: user.sub, jobId: params.jobId }, 'DLQ retry triggered');

        const success = await retryDeadLetterJob(params.jobId);
        if (!success) {
          return reply.status(404).send({
            error: { code: 'JOB_NOT_FOUND', message: 'Dead letter job not found' },
          });
        }

        return reply.send({ message: 'Job retried successfully', jobId: params.jobId });
      });

      // Revoke all tokens for a user (security incident response)
      api.post('/admin/users/:userId/revoke-tokens', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const user = request.user as { sub?: string; roles?: string[] };
        const roles = user.roles ?? [];

        // Require admin role
        if (!roles.includes('admin') && !roles.includes('tenant:admin') && !roles.includes('system:admin') && !roles.includes('security:admin')) {
          apiLogger.warn({ userId: user.sub }, 'Unauthorized token revocation attempt');
          return reply.status(403).send({
            error: { code: 'FORBIDDEN', message: 'Admin role required' },
          });
        }

        const params = userIdParamsSchema.parse(request.params ?? {});
        const revokeTime = new Date();

        await tokenRevocationService.revokeAllForUser(params.userId, revokeTime);

        // Record audit event
        await recordTokenRevocationAudit(
          tenantId,
          params.userId,
          'token.user_all_revoked',
          {
            type: 'user',
            id: user.sub ?? 'unknown',
            ip: request.ip,
          },
          {
            targetUserId: params.userId,
            revokedBefore: revokeTime.toISOString(),
            reason: 'admin_revoke_all',
          }
        );

        apiLogger.info(
          { targetUserId: params.userId, adminUserId: user.sub, revokeTime: revokeTime.toISOString() },
          'All tokens revoked for user'
        );

        return reply.send({
          message: 'All tokens revoked for user',
          userId: params.userId,
          revokedBefore: revokeTime.toISOString(),
        });
      });

      // ========== Audit Routes ==========

      // Query audit records
      api.get('/audit', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const query = auditQuerySchema.parse(request.query ?? {});

        const result = await auditService.query({
          tenantId,
          eventType: query.eventType,
          eventCategory: query.eventCategory,
          severity: query.severity,
          actorId: query.actorId,
          targetId: query.targetId,
          targetType: query.targetType,
          startTime: query.startTime,
          endTime: query.endTime,
          limit: query.limit,
          offset: query.offset,
        });

        return reply.send({
          data: result.records,
          pagination: {
            total: result.total,
            hasMore: result.hasMore,
          },
        });
      });

      // Get audit record by ID
      api.get('/audit/:id', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const params = auditIdParamsSchema.parse(request.params ?? {});

        const record = await auditService.findById(params.id, tenantId);
        if (!record) {
          return reply.status(404).send({
            error: { code: 'AUDIT_RECORD_NOT_FOUND', message: 'Audit record not found' },
          });
        }

        return reply.send(record);
      });

      // Get audit trail for a target
      api.get('/audit/target/:targetType/:targetId', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const params = auditTargetParamsSchema.parse(request.params ?? {});
        const query = auditTargetQuerySchema.parse(request.query ?? {});

        const records = await auditService.getForTarget(
          tenantId,
          params.targetType,
          params.targetId,
          { limit: query.limit, offset: query.offset }
        );

        return reply.send({ data: records });
      });

      // Get all audit records for a trace
      api.get('/audit/trace/:traceId', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const params = auditTraceParamsSchema.parse(request.params ?? {});

        const records = await auditService.getByTrace(tenantId, params.traceId);

        return reply.send({ data: records });
      });

      // Get audit statistics
      api.get('/audit/stats', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const query = auditStatsQuerySchema.parse(request.query ?? {});

        const stats = await auditService.getStats(tenantId, {
          startTime: query.startTime,
          endTime: query.endTime,
        });

        return reply.send(stats);
      });

      // Verify audit chain integrity (admin-only)
      api.post('/audit/verify', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const user = request.user as { sub?: string; roles?: string[] };
        const roles = user.roles ?? [];

        // Require admin role
        if (!roles.includes('admin') && !roles.includes('tenant:admin') && !roles.includes('system:admin') && !roles.includes('audit:admin')) {
          apiLogger.warn({ userId: user.sub }, 'Unauthorized audit verify attempt');
          return reply.status(403).send({
            error: { code: 'FORBIDDEN', message: 'Admin role required' },
          });
        }

        const body = auditVerifyBodySchema.parse(request.body ?? {});

        const result: ChainIntegrityResult = await auditService.verifyChainIntegrity(tenantId, {
          startSequence: body.startSequence,
          limit: body.limit,
        });

        return reply.send(result);
      });

      // ========== Policy Routes ==========

      // Create a new policy
      api.post('/policies', async (request, reply) => {
        // Authorization: admin and policy_writer roles
        if (!await checkAuthorization(request, reply, POLICY_ROLES.WRITE)) {
          return;
        }

        const tenantId = await getTenantId(request);
        const user = request.user as { sub?: string };
        const body = policyCreateBodySchema.parse(request.body ?? {});

        try {
          const createInput: Parameters<typeof policyService.create>[1] = {
            name: body.name,
            definition: body.definition as PolicyDefinition,
          };
          if (body.description !== undefined) createInput.description = body.description;
          if (body.namespace !== undefined) createInput.namespace = body.namespace;
          if (user.sub !== undefined) createInput.createdBy = user.sub;

          const policy = await policyService.create(tenantId, createInput);

          apiLogger.info(
            { policyId: policy.id, name: policy.name, tenantId },
            'Policy created'
          );

          return reply.code(201).send(policy);
        } catch (error) {
          if (error instanceof PolicyValidationError) {
            return reply.status(400).send({
              error: {
                code: 'POLICY_VALIDATION_ERROR',
                message: error.message,
                details: error.errors,
              },
            });
          }
          throw error;
        }
      });

      // List policies for tenant
      api.get('/policies', async (request, reply) => {
        // Authorization: admin and policy_reader roles
        if (!await checkAuthorization(request, reply, POLICY_ROLES.READ)) {
          return;
        }

        const tenantId = await getTenantId(request);
        const query = policyListQuerySchema.parse(request.query ?? {});

        const limit = query.limit ?? 50;
        const offset = query.offset ?? 0;

        const listFilters: Parameters<typeof policyService.list>[0] = {
          tenantId,
          limit: limit + 1, // Fetch one extra to determine hasMore
          offset,
        };
        if (query.namespace) listFilters.namespace = query.namespace;
        if (query.status) listFilters.status = query.status;

        const policies = await policyService.list(listFilters);

        const hasMore = policies.length > limit;
        const data = hasMore ? policies.slice(0, limit) : policies;

        return reply.send({
          data,
          pagination: {
            total: data.length + offset,
            hasMore,
          },
        });
      });

      // Get policy by ID
      api.get('/policies/:id', async (request, reply) => {
        // Authorization: admin and policy_reader roles
        if (!await checkAuthorization(request, reply, POLICY_ROLES.READ)) {
          return;
        }

        const tenantId = await getTenantId(request);
        const params = policyIdParamsSchema.parse(request.params ?? {});

        const policy = await policyService.findById(params.id, tenantId);
        if (!policy) {
          return reply.status(404).send({
            error: { code: 'POLICY_NOT_FOUND', message: 'Policy not found' },
          });
        }

        return reply.send(policy);
      });

      // Update policy definition
      api.put('/policies/:id', async (request, reply) => {
        // Authorization: admin and policy_writer roles
        if (!await checkAuthorization(request, reply, POLICY_ROLES.WRITE)) {
          return;
        }

        const tenantId = await getTenantId(request);
        const user = request.user as { sub?: string };
        const params = policyIdParamsSchema.parse(request.params ?? {});
        const body = policyUpdateBodySchema.parse(request.body ?? {});

        try {
          const updateInput: Parameters<typeof policyService.update>[2] = {};
          if (body.description !== undefined) updateInput.description = body.description;
          if (body.definition !== undefined) updateInput.definition = body.definition as PolicyDefinition;
          if (body.changeSummary !== undefined) updateInput.changeSummary = body.changeSummary;
          if (user.sub !== undefined) updateInput.updatedBy = user.sub;

          const policy = await policyService.update(params.id, tenantId, updateInput);

          if (!policy) {
            return reply.status(404).send({
              error: { code: 'POLICY_NOT_FOUND', message: 'Policy not found' },
            });
          }

          // Invalidate cache after policy update
          await policyLoader.invalidateCache(tenantId, policy.namespace);

          apiLogger.info(
            { policyId: policy.id, version: policy.version, tenantId },
            'Policy updated'
          );

          return reply.send(policy);
        } catch (error) {
          if (error instanceof PolicyValidationError) {
            return reply.status(400).send({
              error: {
                code: 'POLICY_VALIDATION_ERROR',
                message: error.message,
                details: error.errors,
              },
            });
          }
          throw error;
        }
      });

      // Publish a draft policy
      api.post('/policies/:id/publish', async (request, reply) => {
        // Authorization: admin and policy_writer roles
        if (!await checkAuthorization(request, reply, POLICY_ROLES.WRITE)) {
          return;
        }

        const tenantId = await getTenantId(request);
        const params = policyIdParamsSchema.parse(request.params ?? {});

        const policy = await policyService.publish(params.id, tenantId);
        if (!policy) {
          return reply.status(404).send({
            error: { code: 'POLICY_NOT_FOUND', message: 'Policy not found' },
          });
        }

        // Invalidate cache after policy is published
        await policyLoader.invalidateCache(tenantId, policy.namespace);

        apiLogger.info(
          { policyId: policy.id, name: policy.name, tenantId },
          'Policy published'
        );

        return reply.send(policy);
      });

      // Deprecate a policy
      api.post('/policies/:id/deprecate', async (request, reply) => {
        // Authorization: admin and policy_writer roles
        if (!await checkAuthorization(request, reply, POLICY_ROLES.WRITE)) {
          return;
        }

        const tenantId = await getTenantId(request);
        const params = policyIdParamsSchema.parse(request.params ?? {});

        const policy = await policyService.deprecate(params.id, tenantId);
        if (!policy) {
          return reply.status(404).send({
            error: { code: 'POLICY_NOT_FOUND', message: 'Policy not found' },
          });
        }

        // Invalidate cache after policy is deprecated
        await policyLoader.invalidateCache(tenantId, policy.namespace);

        apiLogger.info(
          { policyId: policy.id, name: policy.name, tenantId },
          'Policy deprecated'
        );

        return reply.send(policy);
      });

      // Archive a policy
      api.post('/policies/:id/archive', async (request, reply) => {
        // Authorization: admin and policy_writer roles
        if (!await checkAuthorization(request, reply, POLICY_ROLES.WRITE)) {
          return;
        }

        const tenantId = await getTenantId(request);
        const params = policyIdParamsSchema.parse(request.params ?? {});

        const policy = await policyService.archive(params.id, tenantId);
        if (!policy) {
          return reply.status(404).send({
            error: { code: 'POLICY_NOT_FOUND', message: 'Policy not found' },
          });
        }

        // Invalidate cache after policy is archived
        await policyLoader.invalidateCache(tenantId, policy.namespace);

        apiLogger.info(
          { policyId: policy.id, name: policy.name, tenantId },
          'Policy archived'
        );

        return reply.send(policy);
      });

      // Delete a policy (only if draft)
      api.delete('/policies/:id', async (request, reply) => {
        // Authorization: admin only
        if (!await checkAuthorization(request, reply, POLICY_ROLES.DELETE)) {
          return;
        }

        const tenantId = await getTenantId(request);
        const params = policyIdParamsSchema.parse(request.params ?? {});

        // First check if the policy exists and is a draft
        const policy = await policyService.findById(params.id, tenantId);
        if (!policy) {
          return reply.status(404).send({
            error: { code: 'POLICY_NOT_FOUND', message: 'Policy not found' },
          });
        }

        if (policy.status !== 'draft') {
          return reply.status(400).send({
            error: {
              code: 'POLICY_NOT_DRAFT',
              message: 'Only draft policies can be deleted. Use archive for published policies.',
            },
          });
        }

        const deleted = await policyService.delete(params.id, tenantId);
        if (!deleted) {
          return reply.status(404).send({
            error: { code: 'POLICY_NOT_FOUND', message: 'Policy not found' },
          });
        }

        // Invalidate cache after policy deletion
        await policyLoader.invalidateCache(tenantId, policy.namespace);

        apiLogger.info(
          { policyId: params.id, tenantId },
          'Policy deleted'
        );

        return reply.status(204).send();
      });

      // ========== Webhook Routes ==========

      // Register a webhook
      api.post('/webhooks', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const body = webhookCreateBodySchema.parse(request.body ?? {});

        try {
          const webhookId = await webhookService.registerWebhook(tenantId, {
            url: body.url,
            secret: body.secret,
            events: body.events,
            enabled: body.enabled ?? true,
          });

          const webhooks = await webhookService.getWebhooks(tenantId);
          const webhook = webhooks.find((w) => w.id === webhookId);

          apiLogger.info(
            { webhookId, tenantId, url: body.url },
            'Webhook registered'
          );

          return reply.code(201).send({
            id: webhookId,
            config: webhook?.config,
          });
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Invalid webhook URL')) {
            return reply.status(400).send({
              error: {
                code: 'INVALID_WEBHOOK_URL',
                message: error.message,
              },
            });
          }
          throw error;
        }
      });

      // List webhooks for tenant
      api.get('/webhooks', async (request, reply) => {
        const tenantId = await getTenantId(request);

        const webhooks = await webhookService.getWebhooks(tenantId);

        return reply.send({
          data: webhooks.map((w) => ({
            id: w.id,
            config: w.config,
          })),
        });
      });

      // Unregister a webhook
      api.delete('/webhooks/:id', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const params = webhookIdParamsSchema.parse(request.params ?? {});

        const deleted = await webhookService.unregisterWebhook(tenantId, params.id);
        if (!deleted) {
          return reply.status(404).send({
            error: { code: 'WEBHOOK_NOT_FOUND', message: 'Webhook not found' },
          });
        }

        apiLogger.info(
          { webhookId: params.id, tenantId },
          'Webhook unregistered'
        );

        return reply.status(204).send();
      });

      // Get recent deliveries for a webhook
      api.get('/webhooks/:id/deliveries', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const params = webhookIdParamsSchema.parse(request.params ?? {});
        const query = webhookDeliveriesQuerySchema.parse(request.query ?? {});

        // First check if the webhook exists
        const webhooks = await webhookService.getWebhooks(tenantId);
        const webhook = webhooks.find((w) => w.id === params.id);
        if (!webhook) {
          return reply.status(404).send({
            error: { code: 'WEBHOOK_NOT_FOUND', message: 'Webhook not found' },
          });
        }

        const deliveries = await webhookService.getDeliveries(
          tenantId,
          params.id,
          query.limit ?? 100
        );

        return reply.send({
          data: deliveries.map((d) => ({
            id: d.id,
            result: d.result,
          })),
        });
      });
    },
    { prefix: config.api.basePath }
  );

  // Error handler - maps VorionError to proper HTTP responses
  server.setErrorHandler((error, request, reply) => {
    // Handle VorionError instances with their structured data
    if (isVorionError(error)) {
      const level = error.statusCode >= 500 ? 'error' : 'warn';
      apiLogger[level](
        {
          errorCode: error.code,
          errorName: error.name,
          statusCode: error.statusCode,
          details: error.details,
          requestId: request.id,
        },
        error.message
      );

      // Add Retry-After header for rate limit errors
      if (error instanceof RateLimitError && error.retryAfter !== undefined) {
        reply.header('Retry-After', error.retryAfter.toString());
      }

      return reply.status(error.statusCode).send({
        error: error.toJSON(),
      });
    }

    // Handle generic errors
    apiLogger.error(
      {
        error: error.message,
        stack: error.stack,
        requestId: request.id,
      },
      'Request error'
    );

    return reply.status(error.statusCode ?? 500).send({
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

      // Stop scheduled jobs and resign leadership (allows faster failover)
      await stopScheduler();
      apiLogger.info('Scheduler stopped and leadership resigned');

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
      await startScheduler();
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
