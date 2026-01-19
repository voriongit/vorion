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
import { createIntentService, intentSubmissionSchema, IntentService } from './index.js';
import { createEscalationService, type EscalationStatus } from './escalation.js';
import type { IntentStatus } from '../common/types.js';
import { INTENT_STATUSES } from '../common/types.js';

// Extend FastifyRequest to include JWT methods when JWT plugin is registered
declare module 'fastify' {
  interface FastifyRequest {
    jwtVerify<T = Record<string, unknown>>(): Promise<T>;
    user?: {
      tenantId?: string;
      sub?: string;
      roles?: string[];
      groups?: string[];
      [key: string]: unknown;
    };
  }
}

// Lazy-initialized services to avoid database connections at module load
let _intentService: ReturnType<typeof createIntentService> | null = null;
let _escalationService: ReturnType<typeof createEscalationService> | null = null;

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

// ============================================================================
// Schemas
// ============================================================================

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
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
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
       * GET / - List intents
       */
      api.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
        const tenantId = await getTenantId(request);
        const query = intentListQuerySchema.parse(request.query ?? {});
        const listOptions: Parameters<IntentService['list']>[0] = { tenantId };
        if (query.entityId) listOptions.entityId = query.entityId;
        if (query.status) listOptions.status = query.status;
        if (query.limit) listOptions.limit = query.limit;
        if (query.cursor) listOptions.cursor = query.cursor;
        const intents = await getIntentService().list(listOptions);

        const nextCursor = intents.length > 0 ? intents[intents.length - 1]?.id : undefined;
        return reply.send({
          data: intents,
          pagination: {
            nextCursor,
            hasMore: intents.length === (query.limit ?? 50),
          },
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

        // Get all intents for the entity
        const intents = await getIntentService().list({
          tenantId,
          entityId: params.entityId,
          limit: 1000, // Get all intents up to a reasonable limit
        });

        // Get events and evaluations for each intent
        const intentsWithDetails = await Promise.all(
          intents.map(async (intent) => {
            const details = await getIntentService().getWithEvents(intent.id, tenantId);
            return details;
          })
        );

        // Get escalations for the entity's intents
        const escalations = await Promise.all(
          intents.map(async (intent) => {
            const escalation = await getEscalationService().getByIntentId(intent.id, tenantId);
            return escalation;
          })
        );

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

        // Get all intents for the entity
        const intents = await getIntentService().list({
          tenantId,
          entityId: params.entityId,
          limit: 1000,
        });

        // Soft delete each intent
        let erasedCount = 0;
        for (const intent of intents) {
          const deleted = await getIntentService().delete(intent.id, tenantId);
          if (deleted) {
            erasedCount++;
          }
        }

        return reply.send({
          entityId: params.entityId,
          intentsErased: erasedCount,
          erasedAt: new Date().toISOString(),
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
