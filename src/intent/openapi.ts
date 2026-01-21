/**
 * OpenAPI 3.1 Specification for the INTENT Module API
 *
 * This module exports a comprehensive OpenAPI specification for all INTENT-related
 * endpoints including intent submission, retrieval, escalation, and GDPR operations.
 *
 * @packageDocumentation
 */

import type { OpenAPIV3_1 } from 'openapi-types';

/**
 * Extended schema type that includes the `nullable` property for OpenAPI 3.0 compatibility.
 * OpenAPI 3.1 replaced `nullable` with type arrays, but many tools still use `nullable`.
 */
type SchemaObjectWithNullable = OpenAPIV3_1.SchemaObject & { nullable?: boolean };

/**
 * OpenAPI 3.1 specification for the INTENT module
 */
export const intentOpenApiSpec: OpenAPIV3_1.Document = {
  openapi: '3.1.0',
  info: {
    title: 'Vorion INTENT Module API',
    version: '1.0.0',
    description: `
# INTENT Module API

The INTENT module provides production-grade goal processing with validation,
persistence, audit events, and human-in-the-loop escalation workflows.

## Features

- **Intent Lifecycle Management**: Submit, track, cancel, and delete intents
- **Trust Gate Validation**: Automatic trust level verification for sensitive operations
- **Escalation Workflows**: Human-in-the-loop approval for high-risk intents
- **GDPR Compliance**: Soft delete and data erasure support
- **Audit Trail**: Cryptographically chained event history

## Authentication

All endpoints require Bearer token authentication. Include the JWT token in the
Authorization header:

\`\`\`
Authorization: Bearer <token>
\`\`\`

The token must contain:
- \`tenantId\`: The tenant context for multi-tenant isolation
- \`sub\`: The user/entity identifier
- \`jti\`: Token identifier for revocation support

## Rate Limiting

API requests are rate-limited per tenant. Rate limit headers are included in responses:
- \`X-RateLimit-Limit\`: Maximum requests per window
- \`X-RateLimit-Remaining\`: Remaining requests in current window
- \`X-RateLimit-Reset\`: Unix timestamp when the window resets
- \`Retry-After\`: Seconds to wait before retrying (on 429 responses)
`,
    contact: {
      name: 'Vorion API Support',
      email: 'api-support@vorion.io',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1 base path',
    },
  ],
  tags: [
    {
      name: 'Intents',
      description: 'Intent lifecycle management operations',
    },
    {
      name: 'Escalations',
      description: 'Human-in-the-loop escalation workflows',
    },
    {
      name: 'Events',
      description: 'Intent event history and verification',
    },
    {
      name: 'GDPR',
      description: 'Data protection and erasure operations',
    },
    {
      name: 'Health',
      description: 'Service health and status endpoints',
    },
    {
      name: 'OpenAPI',
      description: 'API documentation endpoints',
    },
  ],
  paths: {
    '/intent': {
      post: {
        tags: ['Intents'],
        summary: 'Submit a new intent',
        operationId: 'submitIntent',
        description: `
Submit a new intent for processing. The intent will be validated, deduplicated,
and queued for evaluation.

**Trust Gate Validation**: If the intent type requires a specific trust level,
the request will be rejected if the caller's trust level is insufficient.

**Deduplication**: Identical intents (same goal, context, entity) submitted within
the deduplication window will return the existing intent instead of creating a duplicate.
`,
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/TenantId' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/IntentSubmission' },
              examples: {
                basic: {
                  summary: 'Basic intent submission',
                  value: {
                    entityId: '123e4567-e89b-12d3-a456-426614174000',
                    goal: 'Send notification to user',
                    context: {
                      userId: 'user-456',
                      message: 'Your order has shipped',
                    },
                  },
                },
                withPriority: {
                  summary: 'High priority intent',
                  value: {
                    entityId: '123e4567-e89b-12d3-a456-426614174000',
                    goal: 'Process urgent payment',
                    context: {
                      amount: 1000,
                      currency: 'USD',
                    },
                    intentType: 'payment-processing',
                    priority: 9,
                    idempotencyKey: 'payment-order-789',
                  },
                },
              },
            },
          },
        },
        responses: {
          '202': {
            description: 'Intent accepted for processing',
            headers: {
              'X-RateLimit-Limit': { $ref: '#/components/headers/X-RateLimit-Limit' },
              'X-RateLimit-Remaining': { $ref: '#/components/headers/X-RateLimit-Remaining' },
              'X-RateLimit-Reset': { $ref: '#/components/headers/X-RateLimit-Reset' },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Intent' },
                example: {
                  id: '550e8400-e29b-41d4-a716-446655440000',
                  tenantId: 'tenant-123',
                  entityId: '123e4567-e89b-12d3-a456-426614174000',
                  goal: 'Send notification to user',
                  context: { userId: 'user-456', message: 'Your order has shipped' },
                  metadata: {},
                  status: 'pending',
                  priority: 0,
                  createdAt: '2024-01-15T10:30:00.000Z',
                  updatedAt: '2024-01-15T10:30:00.000Z',
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
      get: {
        tags: ['Intents'],
        summary: 'List intents',
        operationId: 'listIntents',
        description: `
List intents for the current tenant with optional filtering and pagination.

Results are ordered by creation time (newest first) and use cursor-based
pagination for efficient traversal of large result sets.
`,
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/TenantId' },
          { $ref: '#/components/parameters/EntityIdFilter' },
          { $ref: '#/components/parameters/StatusFilter' },
          { $ref: '#/components/parameters/Limit' },
          { $ref: '#/components/parameters/Cursor' },
        ],
        responses: {
          '200': {
            description: 'List of intents',
            headers: {
              'X-RateLimit-Limit': { $ref: '#/components/headers/X-RateLimit-Limit' },
              'X-RateLimit-Remaining': { $ref: '#/components/headers/X-RateLimit-Remaining' },
              'X-RateLimit-Reset': { $ref: '#/components/headers/X-RateLimit-Reset' },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/IntentListResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/intent/{id}': {
      get: {
        tags: ['Intents'],
        summary: 'Get intent by ID',
        operationId: 'getIntent',
        description: `
Retrieve a specific intent by its ID, including events and evaluations.

The response includes the full intent object along with:
- Event history (most recent first)
- Evaluation records (trust gate, basis, decision stages)
`,
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/TenantId' },
          { $ref: '#/components/parameters/IntentId' },
        ],
        responses: {
          '200': {
            description: 'Intent details with events and evaluations',
            headers: {
              'X-RateLimit-Limit': { $ref: '#/components/headers/X-RateLimit-Limit' },
              'X-RateLimit-Remaining': { $ref: '#/components/headers/X-RateLimit-Remaining' },
              'X-RateLimit-Reset': { $ref: '#/components/headers/X-RateLimit-Reset' },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/IntentWithEvents' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
      delete: {
        tags: ['Intents', 'GDPR'],
        summary: 'Delete intent (GDPR soft delete)',
        operationId: 'deleteIntent',
        description: `
Soft delete an intent for GDPR compliance. The intent record is marked as deleted
and sensitive data (context, metadata) is cleared, but the audit trail is preserved.

After soft deletion:
- The intent will not appear in list queries
- The intent ID remains valid for audit purposes
- Context and metadata fields are emptied
- The \`deletedAt\` timestamp is set

**Note**: Permanently deleted after the retention period (configurable).
`,
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/TenantId' },
          { $ref: '#/components/parameters/IntentId' },
        ],
        responses: {
          '204': {
            description: 'Intent successfully deleted',
            headers: {
              'X-RateLimit-Limit': { $ref: '#/components/headers/X-RateLimit-Limit' },
              'X-RateLimit-Remaining': { $ref: '#/components/headers/X-RateLimit-Remaining' },
              'X-RateLimit-Reset': { $ref: '#/components/headers/X-RateLimit-Reset' },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/intent/{id}/cancel': {
      post: {
        tags: ['Intents'],
        summary: 'Cancel an intent',
        operationId: 'cancelIntent',
        description: `
Cancel an in-flight intent. Only intents in cancellable states can be cancelled:
- \`pending\`
- \`evaluating\`
- \`escalated\`

Intents in terminal states (\`completed\`, \`failed\`, \`cancelled\`, \`approved\`, \`denied\`)
cannot be cancelled.
`,
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/TenantId' },
          { $ref: '#/components/parameters/IntentId' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CancelIntentRequest' },
              example: {
                reason: 'User requested cancellation',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Intent cancelled successfully',
            headers: {
              'X-RateLimit-Limit': { $ref: '#/components/headers/X-RateLimit-Limit' },
              'X-RateLimit-Remaining': { $ref: '#/components/headers/X-RateLimit-Remaining' },
              'X-RateLimit-Reset': { $ref: '#/components/headers/X-RateLimit-Reset' },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Intent' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/intent/{id}/escalate': {
      post: {
        tags: ['Intents', 'Escalations'],
        summary: 'Escalate an intent',
        operationId: 'escalateIntent',
        description: `
Create an escalation for an intent that requires human approval.

This endpoint is typically called by the evaluation pipeline when a policy
rule triggers an escalation action, but can also be invoked manually.

The escalation will be routed to the specified recipient(s) and will
timeout if not resolved within the specified duration.
`,
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/TenantId' },
          { $ref: '#/components/parameters/IntentId' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/EscalateIntentRequest' },
              example: {
                reason: 'High-value transaction requires manual approval',
                reasonCategory: 'high_risk',
                escalatedTo: 'finance-approvers',
                timeout: 'PT4H',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Escalation created',
            headers: {
              'X-RateLimit-Limit': { $ref: '#/components/headers/X-RateLimit-Limit' },
              'X-RateLimit-Remaining': { $ref: '#/components/headers/X-RateLimit-Remaining' },
              'X-RateLimit-Reset': { $ref: '#/components/headers/X-RateLimit-Reset' },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Escalation' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/intent/{id}/events': {
      get: {
        tags: ['Events'],
        summary: 'Get intent events',
        operationId: 'getIntentEvents',
        description: `
Retrieve the event history for an intent. Events are ordered by occurrence time
(most recent first) and include cryptographic hashes for tamper detection.

Each event contains:
- Event type (e.g., \`intent.submitted\`, \`intent.status.changed\`)
- Event payload with relevant data
- Occurrence timestamp
- Hash and previous hash for chain integrity verification
`,
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/TenantId' },
          { $ref: '#/components/parameters/IntentId' },
          {
            name: 'limit',
            in: 'query',
            description: 'Maximum number of events to return',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 10,
            },
          },
        ],
        responses: {
          '200': {
            description: 'List of intent events',
            headers: {
              'X-RateLimit-Limit': { $ref: '#/components/headers/X-RateLimit-Limit' },
              'X-RateLimit-Remaining': { $ref: '#/components/headers/X-RateLimit-Remaining' },
              'X-RateLimit-Reset': { $ref: '#/components/headers/X-RateLimit-Reset' },
            },
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/IntentEvent' },
                    },
                  },
                  required: ['data'],
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/intent/{id}/verify': {
      get: {
        tags: ['Events'],
        summary: 'Verify intent event chain',
        operationId: 'verifyIntentEventChain',
        description: `
Verify the cryptographic integrity of an intent's event chain.

This endpoint validates that:
- Each event's hash matches its content
- The chain of previous hashes is unbroken
- No events have been tampered with

Returns verification status and details about any chain breaks.
`,
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/TenantId' },
          { $ref: '#/components/parameters/IntentId' },
        ],
        responses: {
          '200': {
            description: 'Chain verification result',
            headers: {
              'X-RateLimit-Limit': { $ref: '#/components/headers/X-RateLimit-Limit' },
              'X-RateLimit-Remaining': { $ref: '#/components/headers/X-RateLimit-Remaining' },
              'X-RateLimit-Reset': { $ref: '#/components/headers/X-RateLimit-Reset' },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ChainVerificationResult' },
                examples: {
                  valid: {
                    summary: 'Valid chain',
                    value: { valid: true },
                  },
                  invalid: {
                    summary: 'Broken chain',
                    value: {
                      valid: false,
                      invalidAt: 3,
                      error: 'Chain broken at event 3: hash mismatch',
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/intent/{id}/escalation': {
      get: {
        tags: ['Escalations'],
        summary: 'Get escalation for intent',
        operationId: 'getIntentEscalation',
        description: 'Get the most recent escalation associated with an intent.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/TenantId' },
          { $ref: '#/components/parameters/IntentId' },
        ],
        responses: {
          '200': {
            description: 'Escalation details',
            headers: {
              'X-RateLimit-Limit': { $ref: '#/components/headers/X-RateLimit-Limit' },
              'X-RateLimit-Remaining': { $ref: '#/components/headers/X-RateLimit-Remaining' },
              'X-RateLimit-Reset': { $ref: '#/components/headers/X-RateLimit-Reset' },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Escalation' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/intent/escalation/{id}/resolve': {
      put: {
        tags: ['Escalations'],
        summary: 'Resolve an escalation',
        operationId: 'resolveEscalation',
        description: `
Resolve an escalation by approving or rejecting it.

**Authorization**: Only authorized users can resolve escalations:
- Admin roles (\`admin\`, \`tenant:admin\`, \`escalation:admin\`)
- Direct assignees (escalatedTo matches user ID)
- Verified group members (database-verified group membership)
- Explicitly assigned approvers

The resolution will update both the escalation and the associated intent's status.
`,
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/TenantId' },
          { $ref: '#/components/parameters/EscalationId' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ResolveEscalationRequest' },
              examples: {
                approve: {
                  summary: 'Approve escalation',
                  value: {
                    resolution: 'approved',
                    notes: 'Verified by finance team - amount within authorized limits',
                  },
                },
                reject: {
                  summary: 'Reject escalation',
                  value: {
                    resolution: 'rejected',
                    notes: 'Transaction violates policy - see ticket #1234',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Escalation resolved',
            headers: {
              'X-RateLimit-Limit': { $ref: '#/components/headers/X-RateLimit-Limit' },
              'X-RateLimit-Remaining': { $ref: '#/components/headers/X-RateLimit-Remaining' },
              'X-RateLimit-Reset': { $ref: '#/components/headers/X-RateLimit-Reset' },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Escalation' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/intent/health': {
      get: {
        tags: ['Health'],
        summary: 'Intent service health check',
        operationId: 'getIntentHealth',
        description: `
Check the health status of the intent service and its dependencies.

This endpoint does not require authentication and is suitable for
load balancer health checks.
`,
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
                example: {
                  status: 'healthy',
                  timestamp: '2024-01-15T10:30:00.000Z',
                  checks: {
                    database: { status: 'ok', latencyMs: 5 },
                    redis: { status: 'ok', latencyMs: 2 },
                    queues: { status: 'ok' },
                  },
                },
              },
            },
          },
          '503': {
            description: 'Service is unhealthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
                example: {
                  status: 'unhealthy',
                  timestamp: '2024-01-15T10:30:00.000Z',
                  checks: {
                    database: { status: 'error', error: 'Connection timeout' },
                    redis: { status: 'ok', latencyMs: 2 },
                    queues: { status: 'ok' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/intent/openapi.json': {
      get: {
        tags: ['OpenAPI'],
        summary: 'Get OpenAPI specification',
        operationId: 'getOpenApiSpec',
        description: 'Returns the OpenAPI 3.1 specification for the INTENT module API.',
        responses: {
          '200': {
            description: 'OpenAPI specification',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  description: 'OpenAPI 3.1 specification document',
                },
              },
            },
          },
        },
      },
    },
    '/intent/gdpr/export/{entityId}': {
      get: {
        tags: ['GDPR'],
        summary: 'Export entity data (GDPR)',
        operationId: 'exportEntityData',
        description: `
Export all data associated with an entity for GDPR data portability requests.

Returns all intents, events, evaluations, and escalations associated with the
specified entity in a structured format.
`,
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/TenantId' },
          {
            name: 'entityId',
            in: 'path',
            required: true,
            description: 'Entity UUID to export data for',
            schema: {
              type: 'string',
              format: 'uuid',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Entity data export',
            headers: {
              'X-RateLimit-Limit': { $ref: '#/components/headers/X-RateLimit-Limit' },
              'X-RateLimit-Remaining': { $ref: '#/components/headers/X-RateLimit-Remaining' },
              'X-RateLimit-Reset': { $ref: '#/components/headers/X-RateLimit-Reset' },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GdprDataExport' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/intent/gdpr/erase/{entityId}': {
      delete: {
        tags: ['GDPR'],
        summary: 'Erase entity data (GDPR)',
        operationId: 'eraseEntityData',
        description: `
Erase all data associated with an entity for GDPR right-to-erasure requests.

This operation:
- Soft deletes all intents for the entity
- Clears sensitive context and metadata
- Preserves minimal audit trail for compliance

**Note**: Some data may be retained for legal/compliance purposes as documented
in your data retention policy.
`,
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/TenantId' },
          {
            name: 'entityId',
            in: 'path',
            required: true,
            description: 'Entity UUID to erase data for',
            schema: {
              type: 'string',
              format: 'uuid',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Entity data erased',
            headers: {
              'X-RateLimit-Limit': { $ref: '#/components/headers/X-RateLimit-Limit' },
              'X-RateLimit-Remaining': { $ref: '#/components/headers/X-RateLimit-Remaining' },
              'X-RateLimit-Reset': { $ref: '#/components/headers/X-RateLimit-Reset' },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GdprEraseResponse' },
                example: {
                  entityId: '123e4567-e89b-12d3-a456-426614174000',
                  intentsErased: 15,
                  erasedAt: '2024-01-15T10:30:00.000Z',
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: `
JWT token for authentication. The token must contain:
- \`tenantId\`: Tenant identifier for multi-tenant isolation
- \`sub\`: User/entity identifier
- \`jti\`: Token identifier for revocation support
- \`exp\`: Expiration timestamp
`,
      },
    },
    parameters: {
      TenantId: {
        name: 'X-Tenant-ID',
        in: 'header',
        description: 'Tenant identifier (extracted from JWT if not provided)',
        schema: {
          type: 'string',
        },
      },
      IntentId: {
        name: 'id',
        in: 'path',
        required: true,
        description: 'Intent UUID',
        schema: {
          type: 'string',
          format: 'uuid',
        },
      },
      EscalationId: {
        name: 'id',
        in: 'path',
        required: true,
        description: 'Escalation UUID',
        schema: {
          type: 'string',
          format: 'uuid',
        },
      },
      EntityIdFilter: {
        name: 'entityId',
        in: 'query',
        description: 'Filter by entity ID',
        schema: {
          type: 'string',
          format: 'uuid',
        },
      },
      StatusFilter: {
        name: 'status',
        in: 'query',
        description: 'Filter by intent status',
        schema: {
          $ref: '#/components/schemas/IntentStatus',
        },
      },
      Limit: {
        name: 'limit',
        in: 'query',
        description: 'Maximum number of results to return',
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 50,
        },
      },
      Cursor: {
        name: 'cursor',
        in: 'query',
        description: 'Pagination cursor (last item ID from previous page)',
        schema: {
          type: 'string',
          format: 'uuid',
        },
      },
    },
    headers: {
      'X-RateLimit-Limit': {
        description: 'Maximum number of requests allowed in the current time window',
        schema: {
          type: 'integer',
        },
      },
      'X-RateLimit-Remaining': {
        description: 'Number of requests remaining in the current time window',
        schema: {
          type: 'integer',
        },
      },
      'X-RateLimit-Reset': {
        description: 'Unix timestamp when the rate limit window resets',
        schema: {
          type: 'integer',
        },
      },
    },
    schemas: {
      IntentSubmission: {
        type: 'object',
        description: 'Request body for submitting a new intent',
        required: ['entityId', 'goal', 'context'],
        properties: {
          entityId: {
            type: 'string',
            format: 'uuid',
            description: 'UUID of the entity (agent, user, service) submitting the intent',
          },
          goal: {
            type: 'string',
            minLength: 1,
            maxLength: 1024,
            description: 'Description of what the intent aims to achieve',
          },
          context: {
            type: 'object',
            additionalProperties: true,
            description: 'Contextual data for intent evaluation (max 64KB)',
          },
          metadata: {
            type: 'object',
            additionalProperties: true,
            description: 'Optional metadata for tracking and filtering',
          },
          intentType: {
            type: 'string',
            minLength: 1,
            maxLength: 128,
            description: 'Type classification for routing and policy matching',
          },
          priority: {
            type: 'integer',
            minimum: 0,
            maximum: 9,
            default: 0,
            description: 'Priority level (0=lowest, 9=highest)',
          },
          idempotencyKey: {
            type: 'string',
            maxLength: 128,
            description: 'Client-provided key for idempotent submissions',
          },
        },
      },
      Intent: {
        type: 'object',
        description: 'An intent representing a goal to be governed',
        required: ['id', 'tenantId', 'entityId', 'goal', 'context', 'metadata', 'status', 'createdAt', 'updatedAt'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique intent identifier',
          },
          tenantId: {
            type: 'string',
            description: 'Tenant identifier',
          },
          entityId: {
            type: 'string',
            format: 'uuid',
            description: 'Entity that submitted the intent',
          },
          goal: {
            type: 'string',
            description: 'Intent goal description',
          },
          intentType: {
            type: 'string',
            nullable: true,
            description: 'Intent type classification',
          } as SchemaObjectWithNullable,
          context: {
            type: 'object',
            additionalProperties: true,
            description: 'Intent context data',
          },
          metadata: {
            type: 'object',
            additionalProperties: true,
            description: 'Intent metadata',
          },
          priority: {
            type: 'integer',
            description: 'Priority level (0-9)',
          },
          status: {
            $ref: '#/components/schemas/IntentStatus',
          },
          trustSnapshot: {
            type: 'object',
            nullable: true,
            additionalProperties: true,
            description: 'Trust state snapshot at submission time',
          } as SchemaObjectWithNullable,
          trustLevel: {
            type: 'integer',
            nullable: true,
            minimum: 0,
            maximum: 4,
            description: 'Trust level (L0-L4)',
          } as SchemaObjectWithNullable,
          trustScore: {
            type: 'integer',
            nullable: true,
            minimum: 0,
            maximum: 1000,
            description: 'Trust score (0-1000)',
          } as SchemaObjectWithNullable,
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp',
          },
          deletedAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Soft delete timestamp (GDPR)',
          } as SchemaObjectWithNullable,
          cancellationReason: {
            type: 'string',
            nullable: true,
            description: 'Reason for cancellation if cancelled',
          } as SchemaObjectWithNullable,
        },
      },
      IntentStatus: {
        type: 'string',
        enum: ['pending', 'evaluating', 'approved', 'denied', 'escalated', 'executing', 'completed', 'failed', 'cancelled'],
        description: `Intent lifecycle status:
- \`pending\`: Awaiting evaluation
- \`evaluating\`: Being evaluated by the policy engine
- \`approved\`: Approved for execution
- \`denied\`: Denied by policy
- \`escalated\`: Awaiting human approval
- \`executing\`: Currently executing
- \`completed\`: Successfully completed
- \`failed\`: Execution failed
- \`cancelled\`: Cancelled by user or system`,
      },
      IntentWithEvents: {
        allOf: [
          { $ref: '#/components/schemas/Intent' },
          {
            type: 'object',
            properties: {
              events: {
                type: 'array',
                items: { $ref: '#/components/schemas/IntentEvent' },
                description: 'Recent events for this intent',
              },
              evaluations: {
                type: 'array',
                items: { $ref: '#/components/schemas/IntentEvaluation' },
                description: 'Evaluation records for this intent',
              },
            },
          },
        ],
      },
      IntentEvent: {
        type: 'object',
        description: 'An event in the intent lifecycle',
        required: ['id', 'intentId', 'eventType', 'payload', 'occurredAt'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Event identifier',
          },
          intentId: {
            type: 'string',
            format: 'uuid',
            description: 'Associated intent ID',
          },
          eventType: {
            type: 'string',
            description: 'Event type (e.g., intent.submitted, intent.approved)',
          },
          payload: {
            type: 'object',
            additionalProperties: true,
            description: 'Event payload data',
          },
          occurredAt: {
            type: 'string',
            format: 'date-time',
            description: 'Event occurrence timestamp',
          },
          hash: {
            type: 'string',
            nullable: true,
            description: 'SHA-256 hash for tamper detection',
          } as SchemaObjectWithNullable,
          previousHash: {
            type: 'string',
            nullable: true,
            description: 'Previous event hash for chain integrity',
          } as SchemaObjectWithNullable,
        },
      },
      IntentEvaluation: {
        type: 'object',
        description: 'An evaluation record for an intent',
        required: ['id', 'intentId', 'tenantId', 'result', 'createdAt'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Evaluation identifier',
          },
          intentId: {
            type: 'string',
            format: 'uuid',
            description: 'Associated intent ID',
          },
          tenantId: {
            type: 'string',
            description: 'Tenant identifier',
          },
          result: {
            $ref: '#/components/schemas/EvaluationPayload',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Evaluation timestamp',
          },
        },
      },
      EvaluationPayload: {
        type: 'object',
        description: 'Evaluation result data by stage',
        required: ['stage'],
        properties: {
          stage: {
            type: 'string',
            enum: ['trust-snapshot', 'trust-gate', 'basis', 'decision', 'error', 'cancelled'],
            description: 'Evaluation stage',
          },
        },
        discriminator: {
          propertyName: 'stage',
        },
        oneOf: [
          {
            type: 'object',
            properties: {
              stage: { type: 'string', const: 'trust-snapshot' },
              result: { type: 'object', nullable: true } as SchemaObjectWithNullable,
            },
          },
          {
            type: 'object',
            properties: {
              stage: { type: 'string', const: 'trust-gate' },
              passed: { type: 'boolean' },
              requiredLevel: { type: 'integer' },
              actualLevel: { type: 'integer' },
            },
          },
          {
            type: 'object',
            properties: {
              stage: { type: 'string', const: 'basis' },
              evaluation: { type: 'object' },
              namespace: { type: 'string' },
            },
          },
          {
            type: 'object',
            properties: {
              stage: { type: 'string', const: 'decision' },
              decision: { type: 'object' },
            },
          },
          {
            type: 'object',
            properties: {
              stage: { type: 'string', const: 'error' },
              error: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
          {
            type: 'object',
            properties: {
              stage: { type: 'string', const: 'cancelled' },
              reason: { type: 'string' },
              cancelledBy: { type: 'string' },
            },
          },
        ],
      },
      IntentListResponse: {
        type: 'object',
        required: ['data', 'pagination'],
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Intent' },
          },
          pagination: {
            type: 'object',
            properties: {
              nextCursor: {
                type: 'string',
                format: 'uuid',
                description: 'Cursor for next page',
              },
              hasMore: {
                type: 'boolean',
                description: 'Whether more results are available',
              },
            },
          },
        },
      },
      CancelIntentRequest: {
        type: 'object',
        required: ['reason'],
        properties: {
          reason: {
            type: 'string',
            minLength: 1,
            maxLength: 500,
            description: 'Reason for cancellation',
          },
        },
      },
      EscalateIntentRequest: {
        type: 'object',
        required: ['reason', 'reasonCategory', 'escalatedTo'],
        properties: {
          reason: {
            type: 'string',
            description: 'Human-readable reason for escalation',
          },
          reasonCategory: {
            $ref: '#/components/schemas/EscalationReasonCategory',
          },
          escalatedTo: {
            type: 'string',
            description: 'User ID, role, or group to escalate to',
          },
          timeout: {
            type: 'string',
            pattern: '^P(?:\\d+D)?(?:T(?:\\d+H)?(?:\\d+M)?(?:\\d+S)?)?$',
            default: 'PT1H',
            description: 'ISO 8601 duration for escalation timeout',
          },
          context: {
            type: 'object',
            additionalProperties: true,
            description: 'Additional context for the approver',
          },
        },
      },
      Escalation: {
        type: 'object',
        description: 'An escalation requiring human approval',
        required: ['id', 'intentId', 'tenantId', 'reason', 'reasonCategory', 'escalatedTo', 'status', 'timeout', 'timeoutAt', 'slaBreached', 'createdAt', 'updatedAt'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Escalation identifier',
          },
          intentId: {
            type: 'string',
            format: 'uuid',
            description: 'Associated intent ID',
          },
          tenantId: {
            type: 'string',
            description: 'Tenant identifier',
          },
          reason: {
            type: 'string',
            description: 'Reason for escalation',
          },
          reasonCategory: {
            $ref: '#/components/schemas/EscalationReasonCategory',
          },
          escalatedTo: {
            type: 'string',
            description: 'Target user, role, or group',
          },
          escalatedBy: {
            type: 'string',
            description: 'Entity that created the escalation',
          },
          status: {
            $ref: '#/components/schemas/EscalationStatus',
          },
          resolution: {
            type: 'object',
            nullable: true,
            properties: {
              resolvedBy: { type: 'string' },
              resolvedAt: { type: 'string', format: 'date-time' },
              notes: { type: 'string' },
            },
          } as SchemaObjectWithNullable,
          timeout: {
            type: 'string',
            description: 'ISO 8601 duration',
          },
          timeoutAt: {
            type: 'string',
            format: 'date-time',
            description: 'Timeout deadline',
          },
          acknowledgedAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'When the escalation was acknowledged',
          } as SchemaObjectWithNullable,
          slaBreached: {
            type: 'boolean',
            description: 'Whether the SLA was breached',
          },
          context: {
            type: 'object',
            nullable: true,
            additionalProperties: true,
            description: 'Escalation context',
          } as SchemaObjectWithNullable,
          metadata: {
            type: 'object',
            nullable: true,
            additionalProperties: true,
            description: 'Escalation metadata',
          } as SchemaObjectWithNullable,
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp',
          },
        },
      },
      EscalationStatus: {
        type: 'string',
        enum: ['pending', 'acknowledged', 'approved', 'rejected', 'timeout', 'cancelled'],
        description: `Escalation status:
- \`pending\`: Awaiting acknowledgment
- \`acknowledged\`: Acknowledged by approver
- \`approved\`: Approved by approver
- \`rejected\`: Rejected by approver
- \`timeout\`: Timed out without resolution
- \`cancelled\`: Cancelled`,
      },
      EscalationReasonCategory: {
        type: 'string',
        enum: ['trust_insufficient', 'high_risk', 'policy_violation', 'manual_review', 'constraint_escalate'],
        description: `Reason for escalation:
- \`trust_insufficient\`: Entity trust level too low
- \`high_risk\`: High-risk operation detected
- \`policy_violation\`: Policy rule triggered escalation
- \`manual_review\`: Requires manual review
- \`constraint_escalate\`: Constraint evaluation triggered escalation`,
      },
      ResolveEscalationRequest: {
        type: 'object',
        required: ['resolution'],
        properties: {
          resolution: {
            type: 'string',
            enum: ['approved', 'rejected'],
            description: 'Resolution decision',
          },
          notes: {
            type: 'string',
            maxLength: 1000,
            description: 'Optional notes explaining the decision',
          },
        },
      },
      ChainVerificationResult: {
        type: 'object',
        description: 'Result of cryptographic event chain verification',
        required: ['valid'],
        properties: {
          valid: {
            type: 'boolean',
            description: 'Whether the chain is valid',
          },
          invalidAt: {
            type: 'integer',
            description: 'Index of first invalid event (if invalid)',
          },
          error: {
            type: 'string',
            description: 'Error description (if invalid)',
          },
        },
      },
      HealthResponse: {
        type: 'object',
        description: 'Health check response with service status and dependency checks',
        required: ['status', 'timestamp'],
        properties: {
          status: {
            type: 'string',
            enum: ['healthy', 'degraded', 'unhealthy'],
            description: 'Overall health status',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Health check timestamp',
          },
          checks: {
            type: 'object',
            properties: {
              database: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['ok', 'error', 'timeout'] },
                  latencyMs: { type: 'integer' },
                  error: { type: 'string' },
                },
              },
              redis: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['ok', 'error', 'timeout'] },
                  latencyMs: { type: 'integer' },
                  error: { type: 'string' },
                },
              },
              queues: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['ok', 'error'] },
                  error: { type: 'string' },
                },
              },
            },
          },
        },
      },
      GdprDataExport: {
        type: 'object',
        description: 'GDPR data export containing all data associated with an entity',
        required: ['entityId', 'exportedAt', 'intents'],
        properties: {
          entityId: {
            type: 'string',
            format: 'uuid',
            description: 'Entity identifier',
          },
          exportedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Export timestamp',
          },
          intents: {
            type: 'array',
            items: { $ref: '#/components/schemas/IntentWithEvents' },
            description: 'All intents for the entity',
          },
          escalations: {
            type: 'array',
            items: { $ref: '#/components/schemas/Escalation' },
            description: 'All escalations for the entity',
          },
        },
      },
      GdprEraseResponse: {
        type: 'object',
        description: 'Response from GDPR data erasure request with count of erased records',
        required: ['entityId', 'intentsErased', 'erasedAt'],
        properties: {
          entityId: {
            type: 'string',
            format: 'uuid',
            description: 'Entity identifier',
          },
          intentsErased: {
            type: 'integer',
            description: 'Number of intents erased',
          },
          erasedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Erasure timestamp',
          },
        },
      },
      Error: {
        type: 'object',
        description: 'Standard error response wrapper',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: {
                type: 'string',
                description: 'Error code',
              },
              message: {
                type: 'string',
                description: 'Human-readable error message',
              },
              details: {
                type: 'object',
                additionalProperties: true,
                description: 'Additional error details',
              },
            },
          },
        },
      },
    },
    responses: {
      BadRequest: {
        description: 'Bad request - invalid input parameters',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid request body',
                details: {
                  field: 'entityId',
                  issue: 'Must be a valid UUID',
                },
              },
            },
          },
        },
      },
      Unauthorized: {
        description: 'Unauthorized - missing or invalid authentication',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
              },
            },
          },
        },
      },
      Forbidden: {
        description: 'Forbidden - insufficient permissions',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: {
                code: 'FORBIDDEN',
                message: 'Insufficient permissions to access this resource',
              },
            },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: {
                code: 'NOT_FOUND',
                message: 'Intent not found',
              },
            },
          },
        },
      },
      TooManyRequests: {
        description: 'Rate limit exceeded',
        headers: {
          'Retry-After': {
            description: 'Seconds to wait before retrying',
            schema: {
              type: 'integer',
            },
          },
        },
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests, please retry after 60 seconds',
              },
            },
          },
        },
      },
      InternalError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: {
                code: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred',
              },
            },
          },
        },
      },
    },
  },
  security: [
    { bearerAuth: [] },
  ],
};

/**
 * Get the OpenAPI specification as a JSON string
 */
export function getOpenApiSpecJson(): string {
  return JSON.stringify(intentOpenApiSpec, null, 2);
}

/**
 * Get the OpenAPI specification object
 */
export function getOpenApiSpec(): OpenAPIV3_1.Document {
  return intentOpenApiSpec;
}
