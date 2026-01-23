/**
 * COGNIGATE Module Routes
 *
 * REST API routes for the Constrained Execution Runtime.
 * Provides endpoints for submitting executions, managing handlers,
 * querying audit trails, and monitoring service health.
 *
 * @packageDocumentation
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createLogger } from '../common/logger.js';
import type { ID, Timestamp } from '../common/types.js';
import { getCognigateOpenApiSpec } from './openapi.js';
import { CognigateHealthService } from './health.js';
import { CognigateRateLimiter } from './ratelimit.js';
import { setRateLimitHeaders, rateLimitResultToInfo } from './rate-limit-headers.js';

const logger = createLogger({ component: 'cognigate-routes' });

// ============================================================================
// Type Extensions
// ============================================================================

declare module 'fastify' {
  interface FastifyRequest {
    jwtVerify<T = Record<string, unknown>>(): Promise<T>;
  }
}

interface JwtUserPayload {
  tenantId?: string;
  sub?: string;
  roles?: string[];
  tier?: string;
  [key: string]: unknown;
}

// ============================================================================
// Route Options
// ============================================================================

/**
 * Configuration options for cognigate route registration
 */
export interface CognigateRouteOptions {
  /** Whether to require JWT on all endpoints (default: true) */
  requireAuth?: boolean;
  /** Custom rate limiter instance */
  rateLimiter?: CognigateRateLimiter;
  /** Custom health service instance */
  healthService?: CognigateHealthService;
}

// ============================================================================
// Service Interface
// ============================================================================

/**
 * Cognigate service interface used by route handlers.
 * Decouples routes from the actual service implementation.
 */
export interface CognigateService {
  submitExecution(request: ExecuteRequest): Promise<ExecutionRecord>;
  getExecution(id: ID): Promise<ExecutionRecord | null>;
  terminateExecution(id: ID, tenantId: ID): Promise<ExecutionRecord>;
  pauseExecution(id: ID, tenantId: ID): Promise<ExecutionRecord>;
  resumeExecution(id: ID, tenantId: ID): Promise<ExecutionRecord>;
  listExecutions(query: ListExecutionsQuery): Promise<{ executions: ExecutionRecord[]; total: number }>;
  listHandlers(): Promise<HandlerInfo[]>;
  getHandler(name: string): Promise<HandlerInfo | null>;
  drainHandler(name: string): Promise<{ drained: number }>;
  queryAudit(query: AuditQuery): Promise<{ entries: AuditEntry[]; total: number }>;
  getMetrics(): Promise<string>;
}

/**
 * Execution request after validation
 */
export interface ExecuteRequest {
  intentId: string;
  tenantId: string;
  decision: {
    intentId: string;
    action: string;
    constraintsEvaluated: unknown[];
    trustScore: number;
    trustLevel: number;
    decidedAt: string;
  };
  resourceLimits?: {
    maxMemoryMb?: number;
    maxCpuPercent?: number;
    timeoutMs?: number;
    maxNetworkRequests?: number;
    maxFileSystemOps?: number;
  };
  handlerName?: string;
  priority?: number;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

/**
 * Execution record returned by the service
 */
export interface ExecutionRecord {
  id: ID;
  intentId: ID;
  tenantId: ID;
  status: string;
  handlerName: string;
  priority: number;
  resourceLimits: Record<string, unknown>;
  resourceUsage?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

/**
 * Handler information
 */
export interface HandlerInfo {
  name: string;
  status: 'active' | 'draining' | 'degraded' | 'inactive';
  activeExecutions: number;
  totalExecutions: number;
  avgDurationMs: number;
  errorRate: number;
  registeredAt: Timestamp;
  lastExecutionAt?: Timestamp;
}

/**
 * List executions query parameters
 */
export interface ListExecutionsQuery {
  tenantId?: string | undefined;
  status?: string | undefined;
  handlerName?: string | undefined;
  since?: string | undefined;
  until?: string | undefined;
  limit: number;
  offset: number;
}

/**
 * Audit query parameters
 */
export interface AuditQuery {
  tenantId?: string | undefined;
  executionId?: string | undefined;
  eventType?: string | undefined;
  severity?: string | undefined;
  since?: string | undefined;
  until?: string | undefined;
  limit: number;
}

/**
 * Audit trail entry
 */
export interface AuditEntry {
  id: ID;
  executionId?: ID;
  tenantId: ID;
  eventType: string;
  severity: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Timestamp;
}

// ============================================================================
// Request Validation Schemas
// ============================================================================

const ExecuteRequestSchema = z.object({
  intentId: z.string().min(1),
  tenantId: z.string().min(1),
  decision: z.object({
    intentId: z.string(),
    action: z.enum(['allow', 'deny', 'escalate', 'limit', 'monitor', 'terminate']),
    constraintsEvaluated: z.array(z.any()),
    trustScore: z.number().min(0).max(1000),
    trustLevel: z.number().int().min(0).max(4),
    decidedAt: z.string(),
  }),
  resourceLimits: z.object({
    maxMemoryMb: z.number().positive().optional(),
    maxCpuPercent: z.number().min(1).max(100).optional(),
    timeoutMs: z.number().positive().optional(),
    maxNetworkRequests: z.number().int().nonnegative().optional(),
    maxFileSystemOps: z.number().int().nonnegative().optional(),
  }).optional(),
  handlerName: z.string().optional(),
  priority: z.number().int().min(0).max(10).optional(),
  metadata: z.record(z.unknown()).optional(),
  correlationId: z.string().optional(),
});

const ExecutionIdParamsSchema = z.object({
  id: z.string().min(1),
});

const HandlerNameParamsSchema = z.object({
  name: z.string().min(1),
});

const ListExecutionsQuerySchema = z.object({
  tenantId: z.string().optional(),
  status: z.enum([
    'pending', 'initializing', 'running', 'paused', 'completed',
    'failed', 'terminated', 'timed_out', 'resource_exceeded',
  ]).optional(),
  handlerName: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const AuditQuerySchema = z.object({
  tenantId: z.string().optional(),
  executionId: z.string().optional(),
  eventType: z.string().optional(),
  severity: z.enum(['info', 'warning', 'error', 'critical']).optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ============================================================================
// Metrics Tracking
// ============================================================================

interface RouteMetrics {
  requests: Map<string, number>;
  errors: Map<string, number>;
  latencies: Map<string, number[]>;
}

const metrics: RouteMetrics = {
  requests: new Map(),
  errors: new Map(),
  latencies: new Map(),
};

/**
 * Record a request metric
 */
function recordMetric(endpoint: string, durationMs: number, isError: boolean): void {
  const reqCount = metrics.requests.get(endpoint) ?? 0;
  metrics.requests.set(endpoint, reqCount + 1);

  if (isError) {
    const errCount = metrics.errors.get(endpoint) ?? 0;
    metrics.errors.set(endpoint, errCount + 1);
  }

  const latencies = metrics.latencies.get(endpoint) ?? [];
  latencies.push(durationMs);
  if (latencies.length > 1000) {
    latencies.shift();
  }
  metrics.latencies.set(endpoint, latencies);
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * POST /api/v1/cognigate/execute
 * Submit an execution request to the Constrained Execution Runtime
 */
async function handleExecute(
  service: CognigateService,
  rateLimiter: CognigateRateLimiter | null,
  request: FastifyRequest<{ Body: z.infer<typeof ExecuteRequestSchema> }>,
  reply: FastifyReply
): Promise<void> {
  const startTime = performance.now();
  const endpoint = 'POST /execute';

  try {
    // Validate JWT and extract tenant
    let userPayload: JwtUserPayload | null = null;
    try {
      userPayload = await request.jwtVerify<JwtUserPayload>();
    } catch {
      logger.debug({ requestId: request.id }, 'No JWT token provided');
    }

    const body = ExecuteRequestSchema.parse(request.body);

    // Verify tenant access
    if (userPayload?.tenantId && userPayload.tenantId !== body.tenantId) {
      void reply.status(403).send({
        error: {
          code: 'TENANT_MISMATCH',
          message: 'Cannot submit executions for other tenants',
        },
      });
      recordMetric(endpoint, performance.now() - startTime, true);
      return;
    }

    // Check rate limit
    if (rateLimiter) {
      const tier = userPayload?.tier ?? 'free';
      const rateLimitResult = await rateLimiter.checkLimit(body.tenantId, tier);
      setRateLimitHeaders(reply, rateLimitResultToInfo(rateLimitResult));
      if (!rateLimitResult.allowed) {
        void reply.status(429).send({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Execution rate limit exceeded',
            details: {
              remaining: rateLimitResult.remaining,
              resetAt: rateLimitResult.resetAt,
              retryAfterMs: rateLimitResult.retryAfterMs,
              reason: rateLimitResult.reason,
            },
          },
        });
        recordMetric(endpoint, performance.now() - startTime, true);
        return;
      }
    }

    // Verify decision allows execution
    if (body.decision.action === 'deny') {
      void reply.status(403).send({
        error: {
          code: 'EXECUTION_DENIED',
          message: 'Decision does not allow execution',
        },
      });
      recordMetric(endpoint, performance.now() - startTime, true);
      return;
    }

    // Submit execution
    const execution = await service.submitExecution(body as ExecuteRequest);

    // Record execution in rate limiter
    if (rateLimiter) {
      await rateLimiter.recordExecution(body.tenantId);
    }

    const durationMs = performance.now() - startTime;
    recordMetric(endpoint, durationMs, false);

    logger.info(
      {
        executionId: execution.id,
        intentId: body.intentId,
        tenantId: body.tenantId,
        handlerName: body.handlerName,
        durationMs,
        requestId: request.id,
      },
      'Execution submitted'
    );

    void reply.status(202).send({
      data: execution,
      meta: {
        durationMs: Math.round(durationMs),
        requestId: request.id,
      },
    });
  } catch (error) {
    const durationMs = performance.now() - startTime;
    recordMetric(endpoint, durationMs, true);
    logger.error({ error, requestId: request.id }, 'Execute request failed');

    if (error instanceof z.ZodError) {
      void reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: error.errors,
        },
      });
      return;
    }

    void reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to submit execution',
      },
    });
  }
}

/**
 * GET /api/v1/cognigate/executions/:id
 * Get execution status and result
 */
async function handleGetExecution(
  service: CognigateService,
  request: FastifyRequest<{ Params: z.infer<typeof ExecutionIdParamsSchema> }>,
  reply: FastifyReply
): Promise<void> {
  const startTime = performance.now();
  const endpoint = 'GET /executions/:id';

  try {
    const params = ExecutionIdParamsSchema.parse(request.params);

    let userPayload: JwtUserPayload | null = null;
    try {
      userPayload = await request.jwtVerify<JwtUserPayload>();
    } catch {
      logger.debug({ requestId: request.id }, 'No JWT token provided');
    }

    const execution = await service.getExecution(params.id);

    if (!execution) {
      void reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Execution ${params.id} not found`,
        },
      });
      recordMetric(endpoint, performance.now() - startTime, true);
      return;
    }

    // Verify tenant access
    if (userPayload?.tenantId && userPayload.tenantId !== execution.tenantId) {
      void reply.status(403).send({
        error: {
          code: 'TENANT_MISMATCH',
          message: 'Cannot access executions from other tenants',
        },
      });
      recordMetric(endpoint, performance.now() - startTime, true);
      return;
    }

    const durationMs = performance.now() - startTime;
    recordMetric(endpoint, durationMs, false);

    void reply.status(200).send({
      data: execution,
      meta: {
        durationMs: Math.round(durationMs),
        requestId: request.id,
      },
    });
  } catch (error) {
    const durationMs = performance.now() - startTime;
    recordMetric(endpoint, durationMs, true);
    logger.error({ error, requestId: request.id }, 'Get execution failed');

    if (error instanceof z.ZodError) {
      void reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid execution ID',
          details: error.errors,
        },
      });
      return;
    }

    void reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve execution',
      },
    });
  }
}

/**
 * POST /api/v1/cognigate/executions/:id/terminate
 * Terminate a running execution
 */
async function handleTerminateExecution(
  service: CognigateService,
  request: FastifyRequest<{ Params: z.infer<typeof ExecutionIdParamsSchema> }>,
  reply: FastifyReply
): Promise<void> {
  const startTime = performance.now();
  const endpoint = 'POST /executions/:id/terminate';

  try {
    const params = ExecutionIdParamsSchema.parse(request.params);

    let userPayload: JwtUserPayload | null = null;
    try {
      userPayload = await request.jwtVerify<JwtUserPayload>();
    } catch {
      logger.debug({ requestId: request.id }, 'No JWT token provided');
    }

    const tenantId = userPayload?.tenantId ?? '';
    const execution = await service.terminateExecution(params.id, tenantId);

    const durationMs = performance.now() - startTime;
    recordMetric(endpoint, durationMs, false);

    logger.info(
      { executionId: params.id, tenantId, requestId: request.id },
      'Execution terminated'
    );

    void reply.status(200).send({
      data: execution,
      meta: {
        durationMs: Math.round(durationMs),
        requestId: request.id,
      },
    });
  } catch (error) {
    const durationMs = performance.now() - startTime;
    recordMetric(endpoint, durationMs, true);
    logger.error({ error, requestId: request.id }, 'Terminate execution failed');

    if (error instanceof Error && error.message.includes('not found')) {
      void reply.status(404).send({
        error: { code: 'NOT_FOUND', message: error.message },
      });
      return;
    }

    void reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to terminate execution' },
    });
  }
}

/**
 * POST /api/v1/cognigate/executions/:id/pause
 * Pause a running execution
 */
async function handlePauseExecution(
  service: CognigateService,
  request: FastifyRequest<{ Params: z.infer<typeof ExecutionIdParamsSchema> }>,
  reply: FastifyReply
): Promise<void> {
  const startTime = performance.now();
  const endpoint = 'POST /executions/:id/pause';

  try {
    const params = ExecutionIdParamsSchema.parse(request.params);

    let userPayload: JwtUserPayload | null = null;
    try {
      userPayload = await request.jwtVerify<JwtUserPayload>();
    } catch {
      logger.debug({ requestId: request.id }, 'No JWT token provided');
    }

    const tenantId = userPayload?.tenantId ?? '';
    const execution = await service.pauseExecution(params.id, tenantId);

    const durationMs = performance.now() - startTime;
    recordMetric(endpoint, durationMs, false);

    logger.info(
      { executionId: params.id, tenantId, requestId: request.id },
      'Execution paused'
    );

    void reply.status(200).send({
      data: execution,
      meta: {
        durationMs: Math.round(durationMs),
        requestId: request.id,
      },
    });
  } catch (error) {
    const durationMs = performance.now() - startTime;
    recordMetric(endpoint, durationMs, true);
    logger.error({ error, requestId: request.id }, 'Pause execution failed');

    if (error instanceof Error && error.message.includes('not found')) {
      void reply.status(404).send({
        error: { code: 'NOT_FOUND', message: error.message },
      });
      return;
    }

    void reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to pause execution' },
    });
  }
}

/**
 * POST /api/v1/cognigate/executions/:id/resume
 * Resume a paused execution
 */
async function handleResumeExecution(
  service: CognigateService,
  request: FastifyRequest<{ Params: z.infer<typeof ExecutionIdParamsSchema> }>,
  reply: FastifyReply
): Promise<void> {
  const startTime = performance.now();
  const endpoint = 'POST /executions/:id/resume';

  try {
    const params = ExecutionIdParamsSchema.parse(request.params);

    let userPayload: JwtUserPayload | null = null;
    try {
      userPayload = await request.jwtVerify<JwtUserPayload>();
    } catch {
      logger.debug({ requestId: request.id }, 'No JWT token provided');
    }

    const tenantId = userPayload?.tenantId ?? '';
    const execution = await service.resumeExecution(params.id, tenantId);

    const durationMs = performance.now() - startTime;
    recordMetric(endpoint, durationMs, false);

    logger.info(
      { executionId: params.id, tenantId, requestId: request.id },
      'Execution resumed'
    );

    void reply.status(200).send({
      data: execution,
      meta: {
        durationMs: Math.round(durationMs),
        requestId: request.id,
      },
    });
  } catch (error) {
    const durationMs = performance.now() - startTime;
    recordMetric(endpoint, durationMs, true);
    logger.error({ error, requestId: request.id }, 'Resume execution failed');

    if (error instanceof Error && error.message.includes('not found')) {
      void reply.status(404).send({
        error: { code: 'NOT_FOUND', message: error.message },
      });
      return;
    }

    void reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to resume execution' },
    });
  }
}

/**
 * GET /api/v1/cognigate/executions
 * List executions with optional filters
 */
async function handleListExecutions(
  service: CognigateService,
  request: FastifyRequest<{ Querystring: z.infer<typeof ListExecutionsQuerySchema> }>,
  reply: FastifyReply
): Promise<void> {
  const startTime = performance.now();
  const endpoint = 'GET /executions';

  try {
    let userPayload: JwtUserPayload | null = null;
    try {
      userPayload = await request.jwtVerify<JwtUserPayload>();
    } catch {
      logger.debug({ requestId: request.id }, 'No JWT token provided');
    }

    const query = ListExecutionsQuerySchema.parse(request.query);

    // Enforce tenant isolation
    const tenantId = userPayload?.tenantId ?? query.tenantId;
    if (!tenantId) {
      void reply.status(400).send({
        error: {
          code: 'MISSING_TENANT',
          message: 'Tenant ID required in query or JWT',
        },
      });
      recordMetric(endpoint, performance.now() - startTime, true);
      return;
    }

    const listQuery: ListExecutionsQuery = {
      tenantId,
      status: query.status,
      handlerName: query.handlerName,
      since: query.since,
      until: query.until,
      limit: query.limit,
      offset: query.offset,
    };

    const { executions, total } = await service.listExecutions(listQuery);

    const durationMs = performance.now() - startTime;
    recordMetric(endpoint, durationMs, false);

    void reply.status(200).send({
      data: executions,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
      },
      meta: {
        durationMs: Math.round(durationMs),
        requestId: request.id,
      },
    });
  } catch (error) {
    const durationMs = performance.now() - startTime;
    recordMetric(endpoint, durationMs, true);
    logger.error({ error, requestId: request.id }, 'List executions failed');

    if (error instanceof z.ZodError) {
      void reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: error.errors,
        },
      });
      return;
    }

    void reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list executions' },
    });
  }
}

/**
 * GET /api/v1/cognigate/handlers
 * List registered execution handlers
 */
async function handleListHandlers(
  service: CognigateService,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const startTime = performance.now();
  const endpoint = 'GET /handlers';

  try {
    const handlers = await service.listHandlers();

    const durationMs = performance.now() - startTime;
    recordMetric(endpoint, durationMs, false);

    void reply.status(200).send({
      data: handlers,
      meta: {
        durationMs: Math.round(durationMs),
        requestId: request.id,
      },
    });
  } catch (error) {
    const durationMs = performance.now() - startTime;
    recordMetric(endpoint, durationMs, true);
    logger.error({ error, requestId: request.id }, 'List handlers failed');

    void reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list handlers' },
    });
  }
}

/**
 * GET /api/v1/cognigate/handlers/:name
 * Get details of a specific handler
 */
async function handleGetHandler(
  service: CognigateService,
  request: FastifyRequest<{ Params: z.infer<typeof HandlerNameParamsSchema> }>,
  reply: FastifyReply
): Promise<void> {
  const startTime = performance.now();
  const endpoint = 'GET /handlers/:name';

  try {
    const params = HandlerNameParamsSchema.parse(request.params);
    const handler = await service.getHandler(params.name);

    if (!handler) {
      void reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Handler '${params.name}' not found`,
        },
      });
      recordMetric(endpoint, performance.now() - startTime, true);
      return;
    }

    const durationMs = performance.now() - startTime;
    recordMetric(endpoint, durationMs, false);

    void reply.status(200).send({
      data: handler,
      meta: {
        durationMs: Math.round(durationMs),
        requestId: request.id,
      },
    });
  } catch (error) {
    const durationMs = performance.now() - startTime;
    recordMetric(endpoint, durationMs, true);
    logger.error({ error, requestId: request.id }, 'Get handler failed');

    void reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get handler' },
    });
  }
}

/**
 * POST /api/v1/cognigate/handlers/:name/drain
 * Drain a handler (stop accepting new executions, finish existing)
 */
async function handleDrainHandler(
  service: CognigateService,
  request: FastifyRequest<{ Params: z.infer<typeof HandlerNameParamsSchema> }>,
  reply: FastifyReply
): Promise<void> {
  const startTime = performance.now();
  const endpoint = 'POST /handlers/:name/drain';

  try {
    const params = HandlerNameParamsSchema.parse(request.params);

    let userPayload: JwtUserPayload | null = null;
    try {
      userPayload = await request.jwtVerify<JwtUserPayload>();
    } catch {
      logger.debug({ requestId: request.id }, 'No JWT token provided');
    }

    // Only admins can drain handlers
    if (userPayload?.roles && !userPayload.roles.includes('admin')) {
      void reply.status(403).send({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin role required to drain handlers',
        },
      });
      recordMetric(endpoint, performance.now() - startTime, true);
      return;
    }

    const result = await service.drainHandler(params.name);

    const durationMs = performance.now() - startTime;
    recordMetric(endpoint, durationMs, false);

    logger.info(
      { handlerName: params.name, drained: result.drained, requestId: request.id },
      'Handler drain initiated'
    );

    void reply.status(200).send({
      data: {
        handlerName: params.name,
        status: 'draining',
        drained: result.drained,
      },
      meta: {
        durationMs: Math.round(durationMs),
        requestId: request.id,
      },
    });
  } catch (error) {
    const durationMs = performance.now() - startTime;
    recordMetric(endpoint, durationMs, true);
    logger.error({ error, requestId: request.id }, 'Drain handler failed');

    if (error instanceof Error && error.message.includes('not found')) {
      void reply.status(404).send({
        error: { code: 'NOT_FOUND', message: error.message },
      });
      return;
    }

    void reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to drain handler' },
    });
  }
}

/**
 * GET /api/v1/cognigate/audit
 * Query the execution audit trail
 */
async function handleQueryAudit(
  service: CognigateService,
  request: FastifyRequest<{ Querystring: z.infer<typeof AuditQuerySchema> }>,
  reply: FastifyReply
): Promise<void> {
  const startTime = performance.now();
  const endpoint = 'GET /audit';

  try {
    let userPayload: JwtUserPayload | null = null;
    try {
      userPayload = await request.jwtVerify<JwtUserPayload>();
    } catch {
      logger.debug({ requestId: request.id }, 'No JWT token provided');
    }

    const query = AuditQuerySchema.parse(request.query);

    // Use tenant from JWT if available
    const tenantId = userPayload?.tenantId ?? query.tenantId;
    if (!tenantId) {
      void reply.status(400).send({
        error: {
          code: 'MISSING_TENANT',
          message: 'Tenant ID required in query or JWT',
        },
      });
      recordMetric(endpoint, performance.now() - startTime, true);
      return;
    }

    const auditQuery: AuditQuery = {
      tenantId,
      executionId: query.executionId,
      eventType: query.eventType,
      severity: query.severity,
      since: query.since,
      until: query.until,
      limit: query.limit,
    };

    const { entries, total } = await service.queryAudit(auditQuery);

    const durationMs = performance.now() - startTime;
    recordMetric(endpoint, durationMs, false);

    void reply.status(200).send({
      data: entries,
      pagination: {
        total,
        limit: query.limit,
      },
      meta: {
        durationMs: Math.round(durationMs),
        requestId: request.id,
      },
    });
  } catch (error) {
    const durationMs = performance.now() - startTime;
    recordMetric(endpoint, durationMs, true);
    logger.error({ error, requestId: request.id }, 'Audit query failed');

    if (error instanceof z.ZodError) {
      void reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: error.errors,
        },
      });
      return;
    }

    void reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to query audit trail' },
    });
  }
}

/**
 * GET /api/v1/cognigate/health
 * Liveness probe endpoint
 */
async function handleHealth(
  healthService: CognigateHealthService,
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const status = await healthService.getHealthStatus();
  const httpStatus = status.status === 'unhealthy' ? 503 : 200;
  void reply.status(httpStatus).send(status);
}

/**
 * GET /api/v1/cognigate/ready
 * Readiness probe endpoint
 */
async function handleReady(
  healthService: CognigateHealthService,
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const status = await healthService.getReadinessStatus();
  const httpStatus = status.ready ? 200 : 503;
  void reply.status(httpStatus).send(status);
}

/**
 * GET /api/v1/cognigate/metrics
 * Prometheus metrics endpoint
 */
async function handleMetrics(
  service: CognigateService,
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const metricsOutput = await service.getMetrics();
  void reply.header('Content-Type', 'text/plain; charset=utf-8').status(200).send(metricsOutput);
}

/**
 * GET /api/v1/cognigate/openapi.json
 * OpenAPI specification endpoint
 */
function handleOpenApi(
  _request: FastifyRequest,
  reply: FastifyReply
): void {
  const spec = getCognigateOpenApiSpec();
  void reply.header('Content-Type', 'application/json').status(200).send(spec);
}

// ============================================================================
// Route Registration
// ============================================================================

/**
 * Create and register all cognigate module routes.
 *
 * @param service - The cognigate service instance providing business logic
 * @param options - Optional route configuration
 * @returns Object with a register method for Fastify instances
 */
export function createCognigateRoutes(service: CognigateService, options?: CognigateRouteOptions) {
  const healthService = options?.healthService ?? new CognigateHealthService();
  const rateLimiter = options?.rateLimiter ?? null;

  return {
    /**
     * Register all cognigate routes on a Fastify instance
     */
    register(app: FastifyInstance): void {
      // Execution endpoints
      app.post('/api/v1/cognigate/execute', (req, reply) =>
        handleExecute(service, rateLimiter, req as FastifyRequest<{ Body: z.infer<typeof ExecuteRequestSchema> }>, reply)
      );
      app.get('/api/v1/cognigate/executions/:id', (req, reply) =>
        handleGetExecution(service, req as FastifyRequest<{ Params: z.infer<typeof ExecutionIdParamsSchema> }>, reply)
      );
      app.post('/api/v1/cognigate/executions/:id/terminate', (req, reply) =>
        handleTerminateExecution(service, req as FastifyRequest<{ Params: z.infer<typeof ExecutionIdParamsSchema> }>, reply)
      );
      app.post('/api/v1/cognigate/executions/:id/pause', (req, reply) =>
        handlePauseExecution(service, req as FastifyRequest<{ Params: z.infer<typeof ExecutionIdParamsSchema> }>, reply)
      );
      app.post('/api/v1/cognigate/executions/:id/resume', (req, reply) =>
        handleResumeExecution(service, req as FastifyRequest<{ Params: z.infer<typeof ExecutionIdParamsSchema> }>, reply)
      );
      app.get('/api/v1/cognigate/executions', (req, reply) =>
        handleListExecutions(service, req as FastifyRequest<{ Querystring: z.infer<typeof ListExecutionsQuerySchema> }>, reply)
      );

      // Handler endpoints
      app.get('/api/v1/cognigate/handlers', (req, reply) =>
        handleListHandlers(service, req, reply)
      );
      app.get('/api/v1/cognigate/handlers/:name', (req, reply) =>
        handleGetHandler(service, req as FastifyRequest<{ Params: z.infer<typeof HandlerNameParamsSchema> }>, reply)
      );
      app.post('/api/v1/cognigate/handlers/:name/drain', (req, reply) =>
        handleDrainHandler(service, req as FastifyRequest<{ Params: z.infer<typeof HandlerNameParamsSchema> }>, reply)
      );

      // Audit endpoint
      app.get('/api/v1/cognigate/audit', (req, reply) =>
        handleQueryAudit(service, req as FastifyRequest<{ Querystring: z.infer<typeof AuditQuerySchema> }>, reply)
      );

      // Health & monitoring endpoints
      app.get('/api/v1/cognigate/health', (req, reply) =>
        handleHealth(healthService, req, reply)
      );
      app.get('/api/v1/cognigate/ready', (req, reply) =>
        handleReady(healthService, req, reply)
      );
      app.get('/api/v1/cognigate/metrics', (req, reply) =>
        handleMetrics(service, req, reply)
      );

      // Documentation
      app.get('/api/v1/cognigate/openapi.json', handleOpenApi);

      logger.info('Cognigate module routes registered');
    },
  };
}

/**
 * Get current route metrics for monitoring.
 * Returns aggregate request counts, error counts, and latency percentiles.
 */
export function getRouteMetrics(): Record<string, { requests: number; errors: number; p50Ms: number; p99Ms: number }> {
  const result: Record<string, { requests: number; errors: number; p50Ms: number; p99Ms: number }> = {};

  const entries = Array.from(metrics.requests);
  for (const [endpoint, count] of entries) {
    const errors = metrics.errors.get(endpoint) ?? 0;
    const latencies = (metrics.latencies.get(endpoint) ?? []).slice().sort((a, b) => a - b);
    const p50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] ?? 0 : 0;
    const p99 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.99)] ?? 0 : 0;

    result[endpoint] = {
      requests: count,
      errors,
      p50Ms: Math.round(p50),
      p99Ms: Math.round(p99),
    };
  }

  return result;
}

/**
 * Reset route metrics. Primarily for testing.
 */
export function resetRouteMetrics(): void {
  metrics.requests.clear();
  metrics.errors.clear();
  metrics.latencies.clear();
}
