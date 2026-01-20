/**
 * INTENT Module Routes
 *
 * Defines API routes for the INTENT module, including the OpenAPI documentation
 * endpoints. These routes can be registered with the main Fastify server.
 *
 * @packageDocumentation
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { JWT } from '@fastify/jwt';
import { z } from 'zod';
import { getOpenApiSpec, getOpenApiSpecJson } from './openapi.js';
import {
  createIntentService,
  intentSubmissionSchema,
  IntentService,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from './index.js';
import { createEscalationService, type EscalationStatus } from './escalation.js';
import { createWebhookService } from './webhooks.js';
import type { IntentStatus } from '../common/types.js';
import { INTENT_STATUSES } from '../common/types.js';
import {
  recordAudit,
  queryAuditLog,
  extractRequestMetadata,
  type AuditAction,
  type AuditResourceType,
} from './audit.js';

// Extend FastifyRequest to include JWT methods when JWT plugin is registered
declare module 'fastify' {
  interface FastifyRequest {
    jwtVerify<T = Record<string, unknown>>(): Promise<T>;
    // Note: 'user' property is declared by @fastify/jwt
  }
}

// Lazy-initialized services to avoid database connections at module load
let _intentService: ReturnType<typeof createIntentService> | null = null;
let _escalationService: ReturnType<typeof createEscalationService> | null = null;
let _webhookService: ReturnType<typeof createWebhookService> | null = null;

function getIntentService() {
  if (!_intentService) {
    _intentService = createIntentService();
  }
  return _intentService;
}

function getEscalationService() {
  if (!_escalationService) {
    _escalationService = createEscalationService();
  }
  return _escalationService;
}

function getWebhookService() {
  if (!_webhookService) {
    _webhookService = createWebhookService();
  }
  return _webhookService;
}

// ============================================================================
// Schemas
// ============================================================================

const intentIdParamsSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Pagination query schema with strict validation.
 * - limit: min 1, max MAX_PAGE_SIZE (1000), defaults to DEFAULT_PAGE_SIZE (50)
 * - offset: min 0, used for offset-based pagination
 * - cursor: UUID for cursor-based pagination (mutually exclusive with offset)
 */
const intentListQuerySchema = z.object({
  entityId: z.string().uuid().optional(),
  status: z
    .string()
    .refine((value): value is IntentStatus => INTENT_STATUSES.includes(value as IntentStatus), {
      message: 'Invalid status',
    })
    .optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  cursor: z.string().uuid().optional(),
}).refine(
  (data) => !(data.offset !== undefined && data.cursor !== undefined),
  {
    message: 'Cannot use both offset and cursor pagination simultaneously',
    path: ['cursor'],
  }
);

const intentCancelBodySchema = z.object({
  reason: z.string().min(1).max(500),
});

const escalationIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const escalationResolveBodySchema = z.object({
  resolution: z.enum(['approved', 'rejected']),
  notes: z.string().max(1000).optional(),
});

const escalateIntentBodySchema = z.object({
  reason: z.string().min(1),
  reasonCategory: z.enum([
    'trust_insufficient',
    'high_risk',
    'policy_violation',
    'manual_review',
    'constraint_escalate',
  ]),
  escalatedTo: z.string().min(1),
  timeout: z.string().regex(/^P(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+S)?)?$/).optional(),
  context: z.record(z.any()).optional(),
});

const entityIdParamsSchema = z.object({
  entityId: z.string().uuid(),
});

const eventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional().default(DEFAULT_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const auditQuerySchema = z.object({
  userId: z.string().optional(),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// Webhook delivery schemas
const webhookIdParamsSchema = z.object({
  webhookId: z.string().uuid(),
});

const deliveryIdParamsSchema = z.object({
  webhookId: z.string().uuid(),
  deliveryId: z.string().uuid(),
});

const deliveryHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  status: z.enum(['pending', 'delivered', 'failed', 'retrying']).optional(),
});

// ============================================================================
// Route Registration
// ============================================================================

/**
 * Register INTENT module routes on a Fastify instance.
 *
 * This function registers all INTENT-related endpoints including:
 * - Intent CRUD operations
 * - Escalation management
 * - Event history
 * - GDPR endpoints
 * - OpenAPI documentation
 *
 * @param server - Fastify instance to register routes on
 * @param opts - Route options (e.g., prefix)
 */
export async function registerIntentRoutes(
  server: FastifyInstance,
  opts: { prefix?: string } = {}
): Promise<void> {
  const prefix = opts.prefix ?? '/api/v1/intent';

  // Helper to get tenant ID from JWT
  async function getTenantId(request: FastifyRequest): Promise<string> {
    const payload = await request.jwtVerify<{ tenantId?: string }>();
    if (!payload.tenantId) {
      throw new Error('Tenant context missing from token');
    }
    return payload.tenantId;
  }

  // Helper to get user ID from JWT (for audit logging)
  function getUserId(request: FastifyRequest): string {
    return request.user?.sub ?? 'anonymous';
  }

  // Helper to check if user has admin role (for audit query endpoint)
  function isAdmin(request: FastifyRequest): boolean {
    const user = request.user as { roles?: string[] } | undefined;
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    return roles.includes('admin') || roles.includes('compliance_officer');
  }

  // Helper to log read audit (fire-and-forget)
  function logReadAudit(
    request: FastifyRequest,
    tenantId: string,
    action: AuditAction,
    resourceType: AuditResourceType,
    resourceId: string,
    metadata?: Record<string, unknown>
  ): void {
    const { ipAddress, userAgent } = extractRequestMetadata(request);
    recordAudit({
      tenantId,
      userId: getUserId(request),
      action,
      resourceType,
      resourceId,
      metadata,
      ipAddress,
      userAgent,
    });
  }

  server.register(
    async (api) => {
      // ========================================================================
      // OpenAPI Documentation Endpoints
      // ========================================================================

      /**
       * GET /openapi.json - Returns the OpenAPI specification
       */
      api.get('/openapi.json', async (_request: FastifyRequest, reply: FastifyReply) => {
        return reply
          .header('Content-Type', 'application/json')
          .send(getOpenApiSpecJson());
      });

      /**
       * GET /docs - Swagger UI (HTML page)
       */
      api.get('/docs', async (_request: FastifyRequest, reply: FastifyReply) => {
        const specUrl = `${prefix}/openapi.json`;

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vorion INTENT API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    html { box-sizing: border-box; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: "${specUrl}",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        persistAuthorization: true,
        withCredentials: true
      });
    };
  </script>
</body>
</html>`;

        return reply
          .header('Content-Type', 'text/html')
          .send(html);
      });

      // ========================================================================
      // Health Check Endpoint
      // ========================================================================

      /**
       * GET /health - Intent service health check
       */
      api.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
        // This is a simple health check - the full health check is at /ready
        return reply.send({
          status: 'healthy',
          service: 'intent',
          timestamp: new Date().toISOString(),
        });
      });

      // ========================================================================
      // Intent Endpoints
      // ========================================================================

      /**
       * POST / - Submit a new intent
       */
      api.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
        const tenantId = await getTenantId(request);
        const body = intentSubmissionSchema.parse(request.body ?? {});
        const intent = await getIntentService().submit(body, { tenantId });
        return reply.code(202).send(intent);
      });

      /**
       * GET / - List intents with pagination
       *
       * Supports both cursor-based and offset-based pagination:
       * - Cursor-based: Use `cursor` param with previous page's nextCursor
       * - Offset-based: Use `offset` param (cannot be combined with cursor)
       *
       * Response includes full pagination metadata:
       * { items, total?, limit, offset?, nextCursor?, hasMore }
       */
      api.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
        const tenantId = await getTenantId(request);
        const query = intentListQuerySchema.parse(request.query ?? {});

        // Build list options with pagination parameters
        const listOptions: Parameters<IntentService['list']>[0] = {
          tenantId,
          limit: query.limit,
          offset: query.offset,
          cursor: query.cursor,
        };
        if (query.entityId) listOptions.entityId = query.entityId;
        if (query.status) listOptions.status = query.status;

        const result = await getIntentService().list(listOptions);

        // Log read audit for SOC2 compliance
        logReadAudit(request, tenantId, 'intent.read_list', 'intent', '*', {
          entityId: query.entityId,
          status: query.status,
          limit: result.limit,
          offset: result.offset,
          cursor: query.cursor,
          resultCount: result.items.length,
          hasMore: result.hasMore,
        });

        // Return paginated response with full metadata
        return reply.send({
          items: result.items,
          limit: result.limit,
          offset: result.offset,
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
        });
      });

      /**
       * GET /:id - Get intent by ID
       */
      api.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const tenantId = await getTenantId(request);
        const params = intentIdParamsSchema.parse(request.params ?? {});
        const result = await getIntentService().getWithEvents(params.id, tenantId);
        if (!result) {
          return reply.status(404).send({
            error: { code: 'INTENT_NOT_FOUND', message: 'Intent not found' },
          });
        }

        // Log read audit for SOC2 compliance
        logReadAudit(request, tenantId, 'intent.read', 'intent', params.id);

        return reply.send({
          ...result.intent,
          events: result.events,
          evaluations: result.evaluations ?? [],
        });
      });

      /**
       * DELETE /:id - Soft delete an intent (GDPR)
       */
      api.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const tenantId = await getTenantId(request);
        const params = intentIdParamsSchema.parse(request.params ?? {});
        const intent = await getIntentService().delete(params.id, tenantId);
        if (!intent) {
          return reply.status(404).send({
            error: { code: 'INTENT_NOT_FOUND', message: 'Intent not found' },
          });
        }
        return reply.status(204).send();
      });

      /**
       * POST /:id/cancel - Cancel an intent
       */
      api.post('/:id/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
        const tenantId = await getTenantId(request);
        const params = intentIdParamsSchema.parse(request.params ?? {});
        const body = intentCancelBodySchema.parse(request.body ?? {});
        const user = request.user;

        const cancelOptions = user?.sub
          ? { tenantId, reason: body.reason, cancelledBy: user.sub }
          : { tenantId, reason: body.reason };

        const intent = await getIntentService().cancel(params.id, cancelOptions);
        if (!intent) {
          return reply.status(404).send({
            error: {
              code: 'INTENT_NOT_FOUND_OR_NOT_CANCELLABLE',
              message: 'Intent not found or cannot be cancelled in current state',
            },
          });
        }
        return reply.send(intent);
      });

      /**
       * POST /:id/escalate - Escalate an intent
       */
      api.post('/:id/escalate', async (request: FastifyRequest, reply: FastifyReply) => {
        const tenantId = await getTenantId(request);
        const params = intentIdParamsSchema.parse(request.params ?? {});
        const body = escalateIntentBodySchema.parse(request.body ?? {});

        // Verify intent exists
        const intent = await getIntentService().get(params.id, tenantId);
        if (!intent) {
          return reply.status(404).send({
            error: { code: 'INTENT_NOT_FOUND', message: 'Intent not found' },
          });
        }

        // Create escalation
        const escalation = await getEscalationService().create({
          intentId: params.id,
          tenantId,
          reason: body.reason,
          reasonCategory: body.reasonCategory,
          escalatedTo: body.escalatedTo,
          timeout: body.timeout,
          context: body.context,
        });

        // Update intent status to escalated
        await getIntentService().updateStatus(params.id, tenantId, 'escalated');

        return reply.code(201).send(escalation);
      });

      /**
       * GET /:id/events - Get intent events
       */
      api.get('/:id/events', async (request: FastifyRequest, reply: FastifyReply) => {
        const tenantId = await getTenantId(request);
        const params = intentIdParamsSchema.parse(request.params ?? {});
        const query = eventsQuerySchema.parse(request.query ?? {});

        // Verify intent exists
        const intent = await getIntentService().get(params.id, tenantId);
        if (!intent) {
          return reply.status(404).send({
            error: { code: 'INTENT_NOT_FOUND', message: 'Intent not found' },
          });
        }

        const result = await getIntentService().getWithEvents(params.id, tenantId);
        const events = result?.events?.slice(0, query.limit) ?? [];

        return reply.send({ data: events });
      });

      /**
       * GET /:id/verify - Verify intent event chain
       */
      api.get('/:id/verify', async (request: FastifyRequest, reply: FastifyReply) => {
        const tenantId = await getTenantId(request);
        const params = intentIdParamsSchema.parse(request.params ?? {});

        // Verify intent exists
        const intent = await getIntentService().get(params.id, tenantId);
        if (!intent) {
          return reply.status(404).send({
            error: { code: 'INTENT_NOT_FOUND', message: 'Intent not found' },
          });
        }

        const verification = await getIntentService().verifyEventChain(params.id);
        return reply.send(verification);
      });

      /**
       * GET /:id/escalation - Get escalation for intent
       */
      api.get('/:id/escalation', async (request: FastifyRequest, reply: FastifyReply) => {
        const tenantId = await getTenantId(request);
        const params = intentIdParamsSchema.parse(request.params ?? {});

        const intent = await getIntentService().get(params.id, tenantId);
        if (!intent) {
          return reply.status(404).send({
            error: { code: 'INTENT_NOT_FOUND', message: 'Intent not found' },
          });
        }

        const escalation = await getEscalationService().getByIntentId(params.id, tenantId);
        if (!escalation) {
          return reply.status(404).send({
            error: { code: 'ESCALATION_NOT_FOUND', message: 'No escalation for this intent' },
          });
        }

        // Log read audit for SOC2 compliance
        logReadAudit(request, tenantId, 'escalation.read', 'escalation', escalation.id, {
          intentId: params.id,
        });

        return reply.send(escalation);
      });

      // ========================================================================
      // Escalation Endpoints
      // ========================================================================

      /**
       * PUT /escalation/:id/resolve - Resolve an escalation
       */
      api.put('/escalation/:id/resolve', async (request: FastifyRequest, reply: FastifyReply) => {
        const tenantId = await getTenantId(request);
        const params = escalationIdParamsSchema.parse(request.params ?? {});
        const body = escalationResolveBodySchema.parse(request.body ?? {});
        const user = request.user;

        const escalation = await getEscalationService().get(params.id, tenantId);
        if (!escalation) {
          return reply.status(404).send({
            error: { code: 'ESCALATION_NOT_FOUND', message: 'Escalation not found' },
          });
        }

        const resolveOptions = {
          resolvedBy: user?.sub ?? 'unknown',
          notes: body.notes,
        };

        let resolved;
        if (body.resolution === 'approved') {
          resolved = await getEscalationService().approve(params.id, tenantId, resolveOptions);
          if (resolved && resolved.status === 'approved') {
            await getIntentService().updateStatus(resolved.intentId, tenantId, 'approved', 'escalated');
          }
        } else {
          resolved = await getEscalationService().reject(params.id, tenantId, resolveOptions);
          if (resolved && resolved.status === 'rejected') {
            await getIntentService().updateStatus(resolved.intentId, tenantId, 'denied', 'escalated');
          }
        }

        return reply.send(resolved);
      });

      // ========================================================================
      // GDPR Endpoints
      // ========================================================================

      /**
       * GET /gdpr/export/:entityId - Export entity data
       */
      api.get('/gdpr/export/:entityId', async (request: FastifyRequest, reply: FastifyReply) => {
        const tenantId = await getTenantId(request);
        const params = entityIdParamsSchema.parse(request.params ?? {});

        // Get all intents for the entity (using MAX_PAGE_SIZE limit)
        const intentsResult = await getIntentService().list({
          tenantId,
          entityId: params.entityId,
          limit: MAX_PAGE_SIZE, // Get all intents up to the maximum allowed limit
        });

        // Get events and evaluations for each intent
        const intentsWithDetails = await Promise.all(
          intentsResult.items.map(async (intent) => {
            const details = await getIntentService().getWithEvents(intent.id, tenantId);
            return details;
          })
        );

        // Get escalations for the entity's intents
        const escalations = await Promise.all(
          intentsResult.items.map(async (intent) => {
            const escalation = await getEscalationService().getByIntentId(intent.id, tenantId);
            return escalation;
          })
        );

        // Log GDPR export audit for SOC2 compliance
        logReadAudit(request, tenantId, 'gdpr.export', 'user_data', params.entityId, {
          intentCount: intentsResult.items.length,
          escalationCount: escalations.filter(Boolean).length,
        });

        return reply.send({
          entityId: params.entityId,
          exportedAt: new Date().toISOString(),
          intents: intentsWithDetails.filter(Boolean),
          escalations: escalations.filter(Boolean),
        });
      });

      /**
       * DELETE /gdpr/erase/:entityId - Erase entity data
       */
      api.delete('/gdpr/erase/:entityId', async (request: FastifyRequest, reply: FastifyReply) => {
        const tenantId = await getTenantId(request);
        const params = entityIdParamsSchema.parse(request.params ?? {});

        // Get all intents for the entity (using MAX_PAGE_SIZE limit)
        const intentsResult = await getIntentService().list({
          tenantId,
          entityId: params.entityId,
          limit: MAX_PAGE_SIZE,
        });

        // Soft delete each intent
        let erasedCount = 0;
        for (const intent of intentsResult.items) {
          const deleted = await getIntentService().delete(intent.id, tenantId);
          if (deleted) {
            erasedCount++;
          }
        }

        // Log GDPR erase audit for SOC2 compliance
        logReadAudit(request, tenantId, 'gdpr.erase', 'user_data', params.entityId, {
          intentsErased: erasedCount,
        });

        return reply.send({
          entityId: params.entityId,
          intentsErased: erasedCount,
          erasedAt: new Date().toISOString(),
        });
      });

      // ========================================================================
      // Audit Endpoints (SOC2 Compliance)
      // ========================================================================

      /**
       * GET /audit - Query audit log (admin only)
       *
       * This endpoint allows compliance officers and administrators to query
       * the read audit log for SOC2 compliance reporting.
       */
      api.get('/audit', async (request: FastifyRequest, reply: FastifyReply) => {
        const tenantId = await getTenantId(request);

        // Authorization check - only admin or compliance_officer roles
        if (!isAdmin(request)) {
          return reply.status(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'Audit log access requires admin or compliance_officer role',
            },
          });
        }

        const query = auditQuerySchema.parse(request.query ?? {});

        const result = await queryAuditLog({
          tenantId,
          userId: query.userId,
          action: query.action as AuditAction | undefined,
          resourceType: query.resourceType as AuditResourceType | undefined,
          resourceId: query.resourceId,
          from: query.from,
          to: query.to,
          limit: query.limit,
          offset: query.offset,
        });

        return reply.send({
          data: result.entries.map((entry) => ({
            id: entry.id,
            userId: entry.userId,
            action: entry.action,
            resourceType: entry.resourceType,
            resourceId: entry.resourceId,
            metadata: entry.metadata,
            ipAddress: entry.ipAddress,
            userAgent: entry.userAgent,
            timestamp: entry.timestamp.toISOString(),
          })),
          pagination: {
            total: result.total,
            hasMore: result.hasMore,
            offset: query.offset ?? 0,
            limit: query.limit ?? 50,
          },
        });
      });

      // ========================================================================
      // Webhook Delivery Endpoints
      // ========================================================================

      /**
       * GET /webhooks/:webhookId/deliveries - Get delivery history for a webhook
       *
       * Returns a paginated list of delivery attempts for the specified webhook.
       * Includes status, attempts, timestamps, and errors for each delivery.
       */
      api.get('/webhooks/:webhookId/deliveries', async (request: FastifyRequest, reply: FastifyReply) => {
        const tenantId = await getTenantId(request);
        const params = webhookIdParamsSchema.parse(request.params ?? {});
        const query = deliveryHistoryQuerySchema.parse(request.query ?? {});

        const deliveries = await getWebhookService().getPersistentDeliveryHistory(
          params.webhookId,
          query.limit
        );

        // Filter by status if provided
        const filteredDeliveries = query.status
          ? deliveries.filter(d => d.status === query.status)
          : deliveries;

        // Log read audit for SOC2 compliance
        logReadAudit(request, tenantId, 'webhook.read_deliveries', 'webhook', params.webhookId, {
          resultCount: filteredDeliveries.length,
          status: query.status,
        });

        return reply.send({
          data: filteredDeliveries.map((delivery) => ({
            id: delivery.id,
            webhookId: delivery.webhookId,
            eventType: delivery.eventType,
            status: delivery.status,
            attempts: delivery.attempts,
            lastAttemptAt: delivery.lastAttemptAt,
            lastError: delivery.lastError,
            nextRetryAt: delivery.nextRetryAt,
            deliveredAt: delivery.deliveredAt,
            responseStatus: delivery.responseStatus,
            createdAt: delivery.createdAt,
          })),
          pagination: {
            limit: query.limit,
            offset: query.offset,
            hasMore: filteredDeliveries.length >= query.limit,
          },
        });
      });

      /**
       * GET /webhooks/:webhookId/deliveries/:deliveryId - Get a specific delivery
       *
       * Returns detailed information about a specific delivery attempt,
       * including the full payload and response body.
       */
      api.get('/webhooks/:webhookId/deliveries/:deliveryId', async (request: FastifyRequest, reply: FastifyReply) => {
        const tenantId = await getTenantId(request);
        const params = deliveryIdParamsSchema.parse(request.params ?? {});

        const delivery = await getWebhookService().getPersistentDeliveryById(params.deliveryId);

        if (!delivery) {
          return reply.status(404).send({
            error: { code: 'DELIVERY_NOT_FOUND', message: 'Webhook delivery not found' },
          });
        }

        // Verify tenant authorization (delivery belongs to tenant's webhook)
        if (delivery.tenantId !== tenantId) {
          return reply.status(404).send({
            error: { code: 'DELIVERY_NOT_FOUND', message: 'Webhook delivery not found' },
          });
        }

        // Verify webhook ID matches
        if (delivery.webhookId !== params.webhookId) {
          return reply.status(404).send({
            error: { code: 'DELIVERY_NOT_FOUND', message: 'Webhook delivery not found' },
          });
        }

        // Log read audit for SOC2 compliance
        logReadAudit(request, tenantId, 'webhook.read_delivery', 'webhook', params.deliveryId);

        return reply.send({
          id: delivery.id,
          webhookId: delivery.webhookId,
          eventType: delivery.eventType,
          payload: delivery.payload,
          status: delivery.status,
          attempts: delivery.attempts,
          lastAttemptAt: delivery.lastAttemptAt,
          lastError: delivery.lastError,
          nextRetryAt: delivery.nextRetryAt,
          deliveredAt: delivery.deliveredAt,
          responseStatus: delivery.responseStatus,
          responseBody: delivery.responseBody,
          createdAt: delivery.createdAt,
        });
      });

      /**
       * POST /webhooks/:webhookId/deliveries/:deliveryId/replay - Replay a failed delivery
       *
       * Requeues a failed delivery for immediate retry.
       * Requires admin role.
       * Returns 202 Accepted with the updated delivery record.
       */
      api.post('/webhooks/:webhookId/deliveries/:deliveryId/replay', async (request: FastifyRequest, reply: FastifyReply) => {
        const tenantId = await getTenantId(request);
        const params = deliveryIdParamsSchema.parse(request.params ?? {});

        // Authorization check - only admin can replay deliveries
        if (!isAdmin(request)) {
          return reply.status(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'Webhook delivery replay requires admin role',
            },
          });
        }

        try {
          const updatedDelivery = await getWebhookService().replayDelivery(
            params.deliveryId,
            tenantId
          );

          // Verify webhook ID matches
          if (updatedDelivery.webhookId !== params.webhookId) {
            return reply.status(404).send({
              error: { code: 'DELIVERY_NOT_FOUND', message: 'Webhook delivery not found' },
            });
          }

          // Log audit event
          logReadAudit(request, tenantId, 'webhook.replay', 'webhook', params.deliveryId, {
            webhookId: params.webhookId,
            previousStatus: 'failed',
            newStatus: updatedDelivery.status,
          });

          return reply.status(202).send({
            id: updatedDelivery.id,
            webhookId: updatedDelivery.webhookId,
            eventType: updatedDelivery.eventType,
            status: updatedDelivery.status,
            attempts: updatedDelivery.attempts,
            nextRetryAt: updatedDelivery.nextRetryAt,
            message: 'Delivery queued for replay',
          });
        } catch (error) {
          if (error instanceof Error) {
            if (error.message.includes('not found')) {
              return reply.status(404).send({
                error: { code: 'DELIVERY_NOT_FOUND', message: 'Webhook delivery not found' },
              });
            }
            if (error.message.includes('Cannot replay')) {
              return reply.status(400).send({
                error: { code: 'INVALID_DELIVERY_STATUS', message: error.message },
              });
            }
          }
          throw error;
        }
      });

      /**
       * GET /webhooks/failed - Get all failed deliveries for the tenant
       *
       * Returns a list of failed webhook deliveries for monitoring and debugging.
       * Requires admin role.
       */
      api.get('/webhooks/failed', async (request: FastifyRequest, reply: FastifyReply) => {
        const tenantId = await getTenantId(request);
        const query = deliveryHistoryQuerySchema.parse(request.query ?? {});

        // Authorization check - only admin can view all failed deliveries
        if (!isAdmin(request)) {
          return reply.status(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'Viewing failed deliveries requires admin role',
            },
          });
        }

        const failedDeliveries = await getWebhookService().getFailedDeliveries(
          tenantId,
          query.limit
        );

        // Log read audit for SOC2 compliance
        logReadAudit(request, tenantId, 'webhook.read_failed_deliveries', 'webhook', '*', {
          resultCount: failedDeliveries.length,
        });

        return reply.send({
          data: failedDeliveries.map((delivery) => ({
            id: delivery.id,
            webhookId: delivery.webhookId,
            eventType: delivery.eventType,
            status: delivery.status,
            attempts: delivery.attempts,
            lastAttemptAt: delivery.lastAttemptAt,
            lastError: delivery.lastError,
            responseStatus: delivery.responseStatus,
            createdAt: delivery.createdAt,
          })),
          pagination: {
            limit: query.limit,
            offset: query.offset,
            hasMore: failedDeliveries.length >= query.limit,
          },
        });
      });
    },
    { prefix }
  );
}

/**
 * Export the OpenAPI specification for external use
 */
export { getOpenApiSpec, getOpenApiSpecJson } from './openapi.js';
