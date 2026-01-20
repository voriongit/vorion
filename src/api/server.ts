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
// Note: Database and Redis health checks are now handled by globalHealthCheck/globalReadinessCheck
// in src/intent/health.ts which provides unified health monitoring
import { z } from 'zod';
import {
  createIntentService,
  intentSubmissionSchema,
  bulkIntentSubmissionSchema,
  PAYLOAD_LIMITS,
} from '../intent/index.js';
import { createAuditService } from '../audit/service.js';
import type { ChainIntegrityResult } from '../audit/types.js';
import {
  createPolicyService,
  getPolicyLoader,
  POLICY_STATUSES,
} from '../policy/index.js';
import { PolicyValidationException } from '../policy/service.js';
import type { PolicyStatus, PolicyDefinition } from '../policy/index.js';
import {
  registerIntentWorkers,
  retryDeadLetterJob,
  enqueueIntentSubmission,
} from '../intent/queues.js';
import {
  isServerShuttingDown,
  shutdownRequestHook,
  shutdownResponseHook,
  registerShutdownHandlers,
  getActiveRequestCount,
} from '../intent/shutdown.js';
import { createEscalationService } from '../intent/escalation.js';
import { createWebhookService, type WebhookEventType } from '../intent/webhooks.js';
import { getMetrics, getMetricsContentType, tokenRevocationChecks } from '../intent/metrics.js';
import { startScheduler, getSchedulerStatus, runCleanupNow } from '../intent/scheduler.js';
import {
  livenessCheck as intentLivenessCheck,
  intentReadinessCheck as intentModuleReadinessCheck,
  validateStartupDependencies,
  globalHealthCheck,
  globalReadinessCheck,
} from '../intent/health.js';
import {
  createGdprService,
  enqueueGdprExport,
  registerGdprWorker,
} from '../intent/gdpr.js';
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
  ForbiddenError,
} from '../common/errors.js';
import { requireTenantMembership } from '../common/tenant-verification.js';
import {
  verifyGroupMembership,
  isAssignedApprover,
  assignApprover,
  removeApprover,
  listApprovers,
} from '../common/group-membership.js';
import {
  createStandardErrorHandler,
  sendSuccess,
  sendError,
  sendNotFound,
  sendCursorPaginated,
} from '../intent/response-middleware.js';
import { HttpStatus } from '../intent/response.js';

const apiLogger = createLogger({ component: 'api' });
const intentService = createIntentService();
const escalationService = createEscalationService();
const auditService = createAuditService();
const policyService = createPolicyService();
const policyLoader = getPolicyLoader();
const webhookService = createWebhookService();
const tokenRevocationService = createTokenRevocationService();
const gdprService = createGdprService();

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
 * SECURE Authorization helper: Check if user can resolve an escalation
 *
 * SECURITY FIX: This function now verifies group membership against the database,
 * NOT trusting JWT claims which can be manipulated by attackers.
 *
 * Authorization is granted if ANY of the following are true:
 * 1. User has admin role (verified from token, but roles are signed by auth server)
 * 2. User is directly assigned as an approver for this escalation (database check)
 * 3. User is the direct target of the escalation (escalatedTo === userId)
 * 4. User has verified group membership matching escalatedTo (database check)
 *
 * All authorization decisions are logged for audit purposes.
 */
async function canResolveEscalation(
  user: { sub?: string; roles?: string[]; groups?: string[] },
  escalation: { id: string; escalatedTo: string; tenantId: string },
  userTenantId: string
): Promise<{ allowed: boolean; reason?: string; authMethod?: string }> {
  const userId = user.sub;
  const escalationId = escalation.id;

  // Tenant isolation: user must belong to same tenant
  if (userTenantId !== escalation.tenantId) {
    apiLogger.warn(
      { userId, escalationId, userTenantId, escalationTenantId: escalation.tenantId },
      'Authorization denied: tenant mismatch'
    );
    return { allowed: false, reason: 'Escalation belongs to different tenant' };
  }

  // Admin override - roles in JWT are signed by auth server, so we trust them
  // Note: For highest security, admin roles could also be verified against database
  const roles = user.roles ?? [];
  if (roles.includes('admin') || roles.includes('tenant:admin') || roles.includes('escalation:admin')) {
    apiLogger.info(
      { userId, escalationId, authMethod: 'admin_role' },
      'Authorization granted: admin role'
    );
    return { allowed: true, authMethod: 'admin_role' };
  }

  // escalatedTo can be a user ID, role, or group name
  const escalatedTo = escalation.escalatedTo;

  // Direct user match - if escalation was assigned directly to this user
  if (userId && escalatedTo === userId) {
    apiLogger.info(
      { userId, escalationId, authMethod: 'direct_assignment' },
      'Authorization granted: direct user assignment'
    );
    return { allowed: true, authMethod: 'direct_assignment' };
  }

  // Check if user is explicitly assigned as an approver for this escalation
  // This is a database check, not trusting JWT claims
  if (userId) {
    try {
      const approverResult = await isAssignedApprover(escalationId, userId, userTenantId);
      if (approverResult.isApprover) {
        apiLogger.info(
          { userId, escalationId, authMethod: 'explicit_approver', assignedAt: approverResult.assignedAt },
          'Authorization granted: explicitly assigned approver'
        );
        return { allowed: true, authMethod: 'explicit_approver' };
      }
    } catch (error) {
      apiLogger.error(
        { error, userId, escalationId },
        'Error checking explicit approver assignment'
      );
      // Continue to other checks - don't fail open, but don't fail closed on DB errors
    }
  }

  // SECURITY FIX: Verify group membership against database, NOT JWT claims
  // The old code trusted user.groups from JWT which attackers could manipulate
  if (userId) {
    try {
      const groupResult = await verifyGroupMembership(userId, escalatedTo, userTenantId);
      if (groupResult.isMember) {
        apiLogger.info(
          { userId, escalationId, groupName: escalatedTo, authMethod: 'verified_group_membership', source: groupResult.source },
          'Authorization granted: verified group membership'
        );
        return { allowed: true, authMethod: 'verified_group_membership' };
      }
    } catch (error) {
      apiLogger.error(
        { error, userId, escalationId, groupName: escalatedTo },
        'Error verifying group membership'
      );
      // Continue to denial - fail closed on DB errors for security
    }
  }

  // Note: We no longer trust JWT group claims (user.groups) for authorization
  // The following code has been removed as it was the source of the vulnerability:
  // if (groups.includes(escalatedTo)) { return { allowed: true }; }

  // Note: Generic approver roles are also no longer trusted from JWT
  // If approver roles are needed, they should be verified against the database
  // The following code has been removed:
  // if (roles.includes('approver') || roles.includes('tenant:approver')) { return { allowed: true }; }

  apiLogger.warn(
    { userId, escalationId, escalatedTo },
    'Authorization denied: no valid authorization method found'
  );

  return {
    allowed: false,
    reason: `User not authorized to resolve escalation (escalatedTo: ${escalatedTo}). Authorization requires: admin role, explicit approver assignment, or verified group membership.`,
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

/**
 * Extract and verify tenant ID from JWT token.
 *
 * SECURITY: This function verifies that the user (sub claim) is actually a member
 * of the tenant specified in the tenantId claim. This prevents cross-tenant data
 * exposure attacks where an attacker modifies JWT claims to access other tenants' data.
 *
 * @param request - The Fastify request object
 * @returns The verified tenant ID
 * @throws ForbiddenError if tenant context is missing or user is not a member
 */
async function getTenantId(request: FastifyRequest): Promise<string> {
  const payload = await request.jwtVerify<{ tenantId?: string; sub?: string }>();

  if (!payload.tenantId) {
    throw new ForbiddenError('Tenant context missing from token');
  }

  if (!payload.sub) {
    throw new ForbiddenError('User identifier missing from token');
  }

  // CRITICAL SECURITY CHECK: Verify user is actually a member of the claimed tenant
  // This prevents attackers from modifying JWT tenantId claims to access other tenants' data
  await requireTenantMembership(payload.sub, payload.tenantId);

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
    // Enforce body size limit at HTTP layer (matches schema validation limit)
    bodyLimit: PAYLOAD_LIMITS.MAX_PAYLOAD_SIZE_BYTES,
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

  // Graceful shutdown hooks - track active requests and reject new ones during shutdown
  // This must run after trace context hook but before route handlers
  server.addHook('onRequest', shutdownRequestHook);
  server.addHook('onResponse', shutdownResponseHook);

  // ==========================================================================
  // Global Health Endpoints
  // ==========================================================================

  /**
   * Global liveness check endpoint - Kubernetes livenessProbe
   *
   * Returns detailed component status including:
   * - Memory usage and uptime
   * - INTENT module health
   * - Process information
   *
   * Returns 503 during shutdown or if critical components unhealthy
   */
  server.get('/health', async (_request, reply) => {
    const shuttingDown = isServerShuttingDown();
    const activeRequests = getActiveRequestCount();

    try {
      const healthStatus = await globalHealthCheck(activeRequests, shuttingDown);

      // Return 503 for shutdown or unhealthy status
      const statusCode =
        healthStatus.status === 'shutting_down' || healthStatus.status === 'unhealthy'
          ? 503
          : 200;

      // Add Retry-After header during shutdown
      if (healthStatus.status === 'shutting_down') {
        reply.header('Retry-After', '5');
      }

      return reply.status(statusCode).send(healthStatus);
    } catch (error) {
      apiLogger.warn(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Global health check failed'
      );

      return reply.status(503).send({
        status: 'unhealthy',
        version: process.env['npm_package_version'] || '0.0.0',
        environment: config.env,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * Global readiness check endpoint - Kubernetes readinessProbe
   *
   * Checks all dependencies with timeouts:
   * - Database connectivity and latency
   * - Redis connectivity and latency
   * - Queue health and job counts
   * - INTENT module readiness (policies, queues)
   *
   * Returns structured response with component-level status
   * Returns 503 if any critical component is unhealthy
   */
  server.get('/ready', async (_request, reply) => {
    try {
      const readinessStatus = await globalReadinessCheck();

      // Return 503 for non-ready status
      const statusCode = readinessStatus.status === 'ready' ? 200 : 503;

      return reply.status(statusCode).send(readinessStatus);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      apiLogger.warn({ error: errorMessage }, 'Global readiness check failed');

      return reply.status(503).send({
        status: 'unhealthy',
        checks: {
          database: { status: 'error', error: errorMessage },
          redis: { status: 'error', error: errorMessage },
          queues: { status: 'error', error: errorMessage },
          intent: { status: 'error', error: errorMessage },
        },
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
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

  // ==========================================================================
  // INTENT Module Health Endpoints (auto-registered at startup)
  // ==========================================================================

  /**
   * INTENT module liveness check - Kubernetes livenessProbe for INTENT service
   *
   * Minimal self-check that returns quickly. Only fails if process is deadlocked.
   * No external dependencies are checked.
   */
  server.get(`${config.api.basePath}/intent/health`, async (_request, reply) => {
    const result = await intentLivenessCheck();
    const statusCode = result.alive ? 200 : 503;

    return reply.status(statusCode).send({
      status: result.alive ? 'healthy' : 'unhealthy',
      module: 'intent',
      alive: result.alive,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * INTENT module readiness check - Kubernetes readinessProbe for INTENT service
   *
   * Checks INTENT-specific dependencies:
   * - Queue connectivity and health
   * - Policy loader availability
   *
   * Returns 503 if INTENT module cannot handle requests
   */
  server.get(`${config.api.basePath}/intent/ready`, async (_request, reply) => {
    const healthStatus = await intentModuleReadinessCheck();
    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;

    return reply.status(statusCode).send({
      ...healthStatus,
      module: 'intent',
    });
  });

  apiLogger.info(
    { healthEndpoint: '/health', readyEndpoint: '/ready', intentHealth: `${config.api.basePath}/intent/health`, intentReady: `${config.api.basePath}/intent/ready` },
    'Health check endpoints auto-registered'
  );

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

      // Intent routes - using standardized API response envelope
      api.post('/intents', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const body = intentSubmissionSchema.parse(request.body ?? {});
        const intent = await intentService.submit(body, { tenantId });
        // Use sendSuccess with ACCEPTED status for async processing
        return sendSuccess(reply, intent, HttpStatus.ACCEPTED, request);
      });

      /**
       * Bulk create intents for batch processing efficiency.
       *
       * This endpoint allows submitting multiple intents in a single request.
       * Each intent in the batch is processed individually, and the response
       * includes details about successful and failed items.
       *
       * Rate limiting:
       * - Separate rate limit for bulk operations (10 requests per minute by default)
       * - This is lower than single intent submissions to prevent abuse
       * - Each bulk request counts as 1 request regardless of item count
       *
       * Response status codes:
       * - 202 Accepted: All items processed successfully
       * - 207 Multi-Status: Some items succeeded, some failed
       * - 400 Bad Request: All items failed
       *
       * @param intents - Array of 1-100 intent submissions
       * @param options - Optional processing options (stopOnError, returnPartial)
       */
      api.post('/intents/bulk', {
        config: {
          rateLimit: {
            max: config.api.bulkRateLimit ?? 10, // Default: 10 bulk requests per minute
            timeWindow: '1 minute',
          },
        },
      }, async (request, reply) => {
        const tenantId = await getTenantId(request);
        const body = bulkIntentSubmissionSchema.parse(request.body ?? {});

        const result = await intentService.submitBulk(body.intents, {
          tenantId,
          stopOnError: body.options?.stopOnError ?? false,
        });

        // Determine appropriate HTTP status code:
        // - 202 Accepted: All items processed successfully
        // - 207 Multi-Status: Partial success (some succeeded, some failed)
        // - 400 Bad Request: All items failed
        let status: number;
        if (result.stats.failed === 0) {
          status = HttpStatus.ACCEPTED;
        } else if (result.stats.succeeded > 0) {
          status = 207; // Multi-Status
        } else {
          status = HttpStatus.BAD_REQUEST;
        }

        return reply.status(status).send({
          data: result,
          meta: {
            requestId: request.id,
            timestamp: new Date().toISOString(),
          },
        });
      });

      api.get('/intents/:id', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const params = intentIdParamsSchema.parse(request.params ?? {});
        const result = await intentService.getWithEvents(params.id, tenantId);
        if (!result) {
          // Use standardized not found response
          return sendNotFound(reply, 'Intent', request);
        }
        // Use standardized success response
        return sendSuccess(reply, {
          ...result.intent,
          events: result.events,
          evaluations: result.evaluations ?? [],
        }, HttpStatus.OK, request);
      });

      api.get('/intents', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const query = intentListQuerySchema.parse(request.query ?? {});
        const listOptions: Parameters<typeof intentService.list>[0] = { tenantId };
        if (query.entityId) listOptions.entityId = query.entityId;
        if (query.status) listOptions.status = query.status as IntentStatus;
        if (query.limit) listOptions.limit = query.limit;
        if (query.cursor) listOptions.cursor = query.cursor;
        const result = await intentService.list(listOptions);

        // Use standardized cursor pagination response with PaginatedResult
        return sendCursorPaginated(reply, result.items, {
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
        }, request);
      });

      // Cancel an intent - using standardized API response envelope
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
          // Use standardized error response
          return sendError(
            reply,
            'INTENT_NOT_FOUND_OR_NOT_CANCELLABLE',
            'Intent not found or cannot be cancelled in current state',
            HttpStatus.NOT_FOUND,
            undefined,
            request
          );
        }

        return sendSuccess(reply, intent, HttpStatus.OK, request);
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

        // Authorization check - now async with database verification
        const authResult = await canResolveEscalation(user, escalationToCheck, tenantId);
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

        // Authorization check - now async with database verification
        const authResult = await canResolveEscalation(user, escalationToCheck, tenantId);
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

      // ========== Escalation Approver Management ==========

      // Schema for assigning approvers
      const assignApproverBodySchema = z.object({
        userId: z.string().min(1).max(255),
      });

      // Assign an approver to an escalation
      api.post('/escalations/:id/assign', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const params = escalationIdParamsSchema.parse(request.params ?? {});
        const body = assignApproverBodySchema.parse(request.body ?? {});
        const user = request.user as { sub?: string; roles?: string[] };

        // Only admins or the escalation creator can assign approvers
        const roles = user.roles ?? [];
        const isAdmin = roles.includes('admin') || roles.includes('tenant:admin') || roles.includes('escalation:admin');

        if (!isAdmin) {
          return reply.status(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'Only administrators can assign approvers to escalations',
            },
          });
        }

        // Verify escalation exists and belongs to tenant
        const escalation = await escalationService.get(params.id, tenantId);
        if (!escalation) {
          return reply.status(404).send({
            error: { code: 'ESCALATION_NOT_FOUND', message: 'Escalation not found' },
          });
        }

        // Escalation must be pending or acknowledged to assign approvers
        if (!['pending', 'acknowledged'].includes(escalation.status)) {
          return reply.status(400).send({
            error: {
              code: 'INVALID_STATE',
              message: `Cannot assign approvers to escalation in ${escalation.status} status`,
            },
          });
        }

        try {
          const assignment = await assignApprover({
            escalationId: params.id,
            userId: body.userId,
            tenantId,
            assignedBy: user.sub ?? 'unknown',
          });

          apiLogger.info(
            { escalationId: params.id, assignedUserId: body.userId, assignedBy: user.sub },
            'Approver assigned to escalation'
          );

          return reply.status(201).send({
            id: assignment.id,
            escalationId: params.id,
            userId: body.userId,
            assignedAt: assignment.assignedAt,
            assignedBy: user.sub,
          });
        } catch (error) {
          apiLogger.error(
            { error, escalationId: params.id, userId: body.userId },
            'Failed to assign approver'
          );
          throw error;
        }
      });

      // Remove an approver from an escalation
      api.delete('/escalations/:id/assign/:userId', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const params = z.object({
          id: z.string().uuid(),
          userId: z.string().min(1),
        }).parse(request.params ?? {});
        const user = request.user as { sub?: string; roles?: string[] };

        // Only admins can remove approvers
        const roles = user.roles ?? [];
        const isAdmin = roles.includes('admin') || roles.includes('tenant:admin') || roles.includes('escalation:admin');

        if (!isAdmin) {
          return reply.status(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'Only administrators can remove approvers from escalations',
            },
          });
        }

        // Verify escalation exists and belongs to tenant
        const escalation = await escalationService.get(params.id, tenantId);
        if (!escalation) {
          return reply.status(404).send({
            error: { code: 'ESCALATION_NOT_FOUND', message: 'Escalation not found' },
          });
        }

        const removed = await removeApprover(params.id, params.userId, tenantId);

        if (!removed) {
          return reply.status(404).send({
            error: { code: 'APPROVER_NOT_FOUND', message: 'Approver assignment not found' },
          });
        }

        apiLogger.info(
          { escalationId: params.id, removedUserId: params.userId, removedBy: user.sub },
          'Approver removed from escalation'
        );

        return reply.status(204).send();
      });

      // List approvers for an escalation
      api.get('/escalations/:id/approvers', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const params = escalationIdParamsSchema.parse(request.params ?? {});

        // Verify escalation exists and belongs to tenant
        const escalation = await escalationService.get(params.id, tenantId);
        if (!escalation) {
          return reply.status(404).send({
            error: { code: 'ESCALATION_NOT_FOUND', message: 'Escalation not found' },
          });
        }

        const approvers = await listApprovers(params.id, tenantId);

        return reply.send({
          data: approvers,
          escalationId: params.id,
        });
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
          if (error instanceof PolicyValidationException) {
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
          if (error instanceof PolicyValidationException) {
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

      // ========== GDPR Routes ==========

      // Schema for GDPR export request
      const gdprExportBodySchema = z.object({
        userId: z.string().uuid(),
      });

      const gdprRequestIdParamsSchema = z.object({
        requestId: z.string().uuid(),
      });

      // Initiate GDPR data export (async job)
      api.post('/intent/gdpr/export', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const user = request.user as { sub?: string };
        const body = gdprExportBodySchema.parse(request.body ?? {});

        // Create export request
        const exportRequest = await gdprService.createExportRequest(
          body.userId,
          tenantId,
          user.sub ?? 'unknown'
        );

        // Queue the export job
        await enqueueGdprExport(exportRequest.id, body.userId, tenantId);

        apiLogger.info(
          { requestId: exportRequest.id, userId: body.userId, tenantId },
          'GDPR export initiated'
        );

        return reply.code(202).send({
          requestId: exportRequest.id,
          status: exportRequest.status,
          message: 'Export request queued. Use the requestId to check status.',
          expiresAt: exportRequest.expiresAt,
        });
      });

      // Get GDPR export status
      api.get('/intent/gdpr/export/:requestId', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const params = gdprRequestIdParamsSchema.parse(request.params ?? {});

        const exportRequest = await gdprService.getExportRequest(params.requestId, tenantId);
        if (!exportRequest) {
          return reply.status(404).send({
            error: {
              code: 'EXPORT_REQUEST_NOT_FOUND',
              message: 'Export request not found or expired',
            },
          });
        }

        return reply.send({
          requestId: exportRequest.id,
          userId: exportRequest.userId,
          status: exportRequest.status,
          requestedAt: exportRequest.requestedAt,
          completedAt: exportRequest.completedAt,
          expiresAt: exportRequest.expiresAt,
          downloadUrl: exportRequest.downloadUrl,
          error: exportRequest.error,
        });
      });

      // Download GDPR export data
      api.get('/intent/gdpr/export/:requestId/download', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const params = gdprRequestIdParamsSchema.parse(request.params ?? {});

        const exportData = await gdprService.getExportData(params.requestId, tenantId);
        if (!exportData) {
          return reply.status(404).send({
            error: {
              code: 'EXPORT_DATA_NOT_FOUND',
              message: 'Export data not found, not ready, or expired',
            },
          });
        }

        // Return as JSON file download
        return reply
          .header('Content-Type', 'application/json')
          .header(
            'Content-Disposition',
            `attachment; filename="gdpr-export-${exportData.userId}-${exportData.exportTimestamp.split('T')[0]}.json"`
          )
          .send(exportData);
      });

      // GDPR right to erasure (soft delete user data)
      api.delete('/intent/gdpr/data', async (request, reply) => {
        const tenantId = await getTenantId(request);
        const user = request.user as { sub?: string; roles?: string[] };
        const body = gdprExportBodySchema.parse(request.body ?? {});

        // Require admin role or self-request for erasure
        const roles = user.roles ?? [];
        const isAdmin = roles.includes('admin') || roles.includes('tenant:admin') || roles.includes('gdpr:admin');
        const isSelfRequest = user.sub === body.userId;

        if (!isAdmin && !isSelfRequest) {
          return reply.status(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'Only administrators or the data subject can request data erasure',
            },
          });
        }

        const result = await gdprService.eraseUserData(
          body.userId,
          tenantId,
          user.sub ?? 'unknown'
        );

        apiLogger.info(
          { userId: body.userId, tenantId, erasedBy: user.sub, counts: result.counts },
          'GDPR data erasure completed'
        );

        return reply.send({
          message: 'User data has been erased in compliance with GDPR Article 17',
          userId: result.userId,
          erasedAt: result.erasedAt,
          counts: result.counts,
        });
      });
    },
    { prefix: config.api.basePath }
  );

  // Error handler - uses standardized API response envelope
  // The createStandardErrorHandler provides consistent error formatting with:
  // - Proper HTTP status code mapping for VorionError types
  // - Trace ID inclusion for debugging
  // - Error detail sanitization in production
  // - Zod validation error handling
  server.setErrorHandler(createStandardErrorHandler(config.env));

  return server;
}

/**
 * Start the API server
 */
export async function startServer(): Promise<void> {
  const config = getConfig();

  // Validate startup dependencies before accepting requests
  // If DB or Redis connectivity fails, exit with code 1
  try {
    await validateStartupDependencies();
  } catch (error) {
    apiLogger.error({ error }, 'Startup validation failed - exiting');
    process.exit(1);
  }

  const server = await createServer();

  // Register graceful shutdown handlers using the centralized shutdown module
  // This handles SIGTERM (Kubernetes) and SIGINT (Ctrl+C) signals
  // and coordinates shutdown of HTTP server, workers, database, and Redis
  registerShutdownHandlers(server, {
    timeoutMs: config.intent.shutdownTimeoutMs ?? 30000,
  });

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

    try {
      registerGdprWorker();
      apiLogger.info('GDPR workers started');
    } catch (error) {
      apiLogger.error({ error }, 'Failed to start GDPR workers');
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
