/**
 * OpenAPI Specification for COGNIGATE Module
 *
 * Provides OpenAPI 3.0 documentation for the Constrained Execution Runtime API.
 * Documents all endpoints with request/response schemas, security requirements,
 * and example payloads.
 *
 * @packageDocumentation
 */

// ============================================================================
// OpenAPI Types
// ============================================================================

interface OpenApiInfo {
  title: string;
  version: string;
  description: string;
  contact?: {
    name?: string;
    email?: string;
    url?: string;
  };
}

interface OpenApiServer {
  url: string;
  description?: string;
}

interface OpenApiSchema {
  type?: string;
  format?: string;
  properties?: Record<string, OpenApiSchema>;
  items?: OpenApiSchema;
  required?: string[];
  enum?: string[];
  description?: string;
  example?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  default?: unknown;
  $ref?: string;
  allOf?: OpenApiSchema[];
  oneOf?: OpenApiSchema[];
  anyOf?: OpenApiSchema[];
  additionalProperties?: boolean | OpenApiSchema;
}

interface OpenApiRequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, { schema: OpenApiSchema }>;
}

interface OpenApiResponse {
  description: string;
  content?: Record<string, { schema: OpenApiSchema }>;
}

interface OpenApiParameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  schema: OpenApiSchema;
}

interface OpenApiOperation {
  tags?: string[];
  summary: string;
  description?: string;
  operationId: string;
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  responses: Record<string, OpenApiResponse>;
  security?: Array<Record<string, string[]>>;
}

interface OpenApiPathItem {
  get?: OpenApiOperation;
  post?: OpenApiOperation;
  put?: OpenApiOperation;
  delete?: OpenApiOperation;
  patch?: OpenApiOperation;
}

interface OpenApiSpec {
  openapi: string;
  info: OpenApiInfo;
  servers: OpenApiServer[];
  paths: Record<string, OpenApiPathItem>;
  components: {
    schemas: Record<string, OpenApiSchema>;
    securitySchemes?: Record<string, unknown>;
  };
  tags?: Array<{ name: string; description: string }>;
}

// ============================================================================
// Schema Definitions
// ============================================================================

const schemas: Record<string, OpenApiSchema> = {
  ExecuteRequest: {
    type: 'object',
    required: ['intentId', 'tenantId', 'decision'],
    properties: {
      intentId: { type: 'string', minLength: 1, description: 'ID of the intent to execute' },
      tenantId: { type: 'string', minLength: 1, description: 'Tenant ID for multi-tenant isolation' },
      decision: {
        type: 'object',
        required: ['intentId', 'action', 'constraintsEvaluated', 'trustScore', 'trustLevel', 'decidedAt'],
        properties: {
          intentId: { type: 'string', description: 'Intent ID in the decision' },
          action: { type: 'string', enum: ['allow', 'deny', 'escalate', 'limit', 'monitor', 'terminate'], description: 'Decision action' },
          constraintsEvaluated: { type: 'array', items: { type: 'object' }, description: 'Constraints evaluated' },
          trustScore: { type: 'number', minimum: 0, maximum: 1000, description: 'Trust score at decision time' },
          trustLevel: { type: 'integer', minimum: 0, maximum: 4, description: 'Trust level (0=L0 to 4=L4)' },
          decidedAt: { type: 'string', format: 'date-time', description: 'When the decision was made' },
        },
      },
      resourceLimits: {
        type: 'object',
        properties: {
          maxMemoryMb: { type: 'number', minimum: 1, description: 'Maximum memory in MB' },
          maxCpuPercent: { type: 'number', minimum: 1, maximum: 100, description: 'Maximum CPU percentage' },
          timeoutMs: { type: 'number', minimum: 1, description: 'Execution timeout in milliseconds' },
          maxNetworkRequests: { type: 'integer', minimum: 0, description: 'Maximum network requests allowed' },
          maxFileSystemOps: { type: 'integer', minimum: 0, description: 'Maximum file system operations allowed' },
        },
      },
      handlerName: { type: 'string', description: 'Specific handler to use for execution' },
      priority: { type: 'integer', minimum: 0, maximum: 10, description: 'Execution priority (0=lowest, 10=highest)' },
      metadata: { type: 'object', additionalProperties: true, description: 'Additional metadata' },
      correlationId: { type: 'string', description: 'Correlation ID for distributed tracing' },
    },
  },
  ExecutionRecord: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Unique execution ID' },
      intentId: { type: 'string', description: 'Associated intent ID' },
      tenantId: { type: 'string', description: 'Tenant ID' },
      status: { type: 'string', enum: ['pending', 'initializing', 'running', 'paused', 'completed', 'failed', 'terminated', 'timed_out', 'resource_exceeded'], description: 'Current execution status' },
      handlerName: { type: 'string', description: 'Handler processing this execution' },
      priority: { type: 'integer', description: 'Execution priority' },
      resourceLimits: { type: 'object', description: 'Configured resource limits' },
      resourceUsage: { type: 'object', description: 'Actual resource usage' },
      result: { type: 'object', description: 'Execution result (if completed)' },
      error: { type: 'string', description: 'Error message (if failed)' },
      startedAt: { type: 'string', format: 'date-time', description: 'When execution started' },
      completedAt: { type: 'string', format: 'date-time', description: 'When execution completed' },
      createdAt: { type: 'string', format: 'date-time', description: 'When record was created' },
      updatedAt: { type: 'string', format: 'date-time', description: 'When record was last updated' },
      metadata: { type: 'object', description: 'Additional metadata' },
      correlationId: { type: 'string', description: 'Correlation ID' },
    },
  },
  HandlerInfo: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Handler name' },
      status: { type: 'string', enum: ['active', 'draining', 'degraded', 'inactive'], description: 'Handler status' },
      activeExecutions: { type: 'integer', description: 'Currently active executions' },
      totalExecutions: { type: 'integer', description: 'Total executions processed' },
      avgDurationMs: { type: 'number', description: 'Average execution duration in ms' },
      errorRate: { type: 'number', minimum: 0, maximum: 1, description: 'Error rate (0-1)' },
      registeredAt: { type: 'string', format: 'date-time', description: 'When handler was registered' },
      lastExecutionAt: { type: 'string', format: 'date-time', description: 'When last execution occurred' },
    },
  },
  AuditEntry: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Audit entry ID' },
      executionId: { type: 'string', description: 'Associated execution ID' },
      tenantId: { type: 'string', description: 'Tenant ID' },
      eventType: { type: 'string', description: 'Type of audit event' },
      severity: { type: 'string', enum: ['info', 'warning', 'error', 'critical'], description: 'Event severity' },
      message: { type: 'string', description: 'Human-readable message' },
      details: { type: 'object', additionalProperties: true, description: 'Event details' },
      timestamp: { type: 'string', format: 'date-time', description: 'When event occurred' },
    },
  },
  HealthStatus: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'], description: 'Overall health status' },
      checks: { type: 'object', description: 'Individual component health checks' },
      uptime: { type: 'number', description: 'Uptime in seconds' },
      activeExecutions: { type: 'integer', description: 'Currently active executions' },
      queuedExecutions: { type: 'integer', description: 'Queued executions' },
      version: { type: 'string', description: 'Service version' },
      timestamp: { type: 'string', format: 'date-time', description: 'Check timestamp' },
    },
  },
  ReadinessStatus: {
    type: 'object',
    properties: {
      ready: { type: 'boolean', description: 'Whether service is ready' },
      checks: { type: 'object', description: 'Readiness checks' },
      startedAt: { type: 'string', format: 'date-time', description: 'When service started' },
    },
  },
  Error: {
    type: 'object',
    properties: {
      error: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: { type: 'string', description: 'Error code' },
          message: { type: 'string', description: 'Error message' },
          details: { type: 'object', additionalProperties: true, description: 'Additional error details' },
        },
      },
    },
  },
};

// ============================================================================
// Path Definitions
// ============================================================================

const paths: Record<string, OpenApiPathItem> = {
  '/api/v1/cognigate/execute': {
    post: {
      tags: ['Execution'],
      summary: 'Submit execution request',
      description: 'Submit an intent for constrained execution within defined resource limits.',
      operationId: 'submitExecution',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ExecuteRequest' } } },
      },
      responses: {
        '202': { description: 'Execution accepted', content: { 'application/json': { schema: { $ref: '#/components/schemas/ExecutionRecord' } } } },
        '400': { description: 'Invalid request', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        '403': { description: 'Execution denied or tenant mismatch', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        '429': { description: 'Rate limit exceeded', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        '500': { description: 'Internal server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      },
    },
  },
  '/api/v1/cognigate/executions/{id}': {
    get: {
      tags: ['Execution'],
      summary: 'Get execution status',
      description: 'Retrieve the current status and result of an execution.',
      operationId: 'getExecution',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, description: 'Execution ID', schema: { type: 'string' } }],
      responses: {
        '200': { description: 'Execution found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ExecutionRecord' } } } },
        '403': { description: 'Tenant mismatch', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        '404': { description: 'Execution not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      },
    },
  },
  '/api/v1/cognigate/executions/{id}/terminate': {
    post: {
      tags: ['Execution'],
      summary: 'Terminate execution',
      description: 'Terminate a running execution immediately.',
      operationId: 'terminateExecution',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, description: 'Execution ID', schema: { type: 'string' } }],
      responses: {
        '200': { description: 'Execution terminated', content: { 'application/json': { schema: { $ref: '#/components/schemas/ExecutionRecord' } } } },
        '404': { description: 'Execution not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        '500': { description: 'Internal server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      },
    },
  },
  '/api/v1/cognigate/executions/{id}/pause': {
    post: {
      tags: ['Execution'],
      summary: 'Pause execution',
      description: 'Pause a running execution. Can be resumed later.',
      operationId: 'pauseExecution',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, description: 'Execution ID', schema: { type: 'string' } }],
      responses: {
        '200': { description: 'Execution paused', content: { 'application/json': { schema: { $ref: '#/components/schemas/ExecutionRecord' } } } },
        '404': { description: 'Execution not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      },
    },
  },
  '/api/v1/cognigate/executions/{id}/resume': {
    post: {
      tags: ['Execution'],
      summary: 'Resume execution',
      description: 'Resume a previously paused execution.',
      operationId: 'resumeExecution',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, description: 'Execution ID', schema: { type: 'string' } }],
      responses: {
        '200': { description: 'Execution resumed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ExecutionRecord' } } } },
        '404': { description: 'Execution not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      },
    },
  },
  '/api/v1/cognigate/executions': {
    get: {
      tags: ['Execution'],
      summary: 'List executions',
      description: 'List executions with optional filters for status, handler, and time range.',
      operationId: 'listExecutions',
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'tenantId', in: 'query', description: 'Filter by tenant ID', schema: { type: 'string' } },
        { name: 'status', in: 'query', description: 'Filter by status', schema: { type: 'string', enum: ['pending', 'initializing', 'running', 'paused', 'completed', 'failed', 'terminated', 'timed_out', 'resource_exceeded'] } },
        { name: 'handlerName', in: 'query', description: 'Filter by handler name', schema: { type: 'string' } },
        { name: 'since', in: 'query', description: 'Filter by start date (ISO 8601)', schema: { type: 'string', format: 'date-time' } },
        { name: 'until', in: 'query', description: 'Filter by end date (ISO 8601)', schema: { type: 'string', format: 'date-time' } },
        { name: 'limit', in: 'query', description: 'Maximum results (1-100)', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        { name: 'offset', in: 'query', description: 'Offset for pagination', schema: { type: 'integer', minimum: 0, default: 0 } },
      ],
      responses: {
        '200': { description: 'Executions listed', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/ExecutionRecord' } }, pagination: { type: 'object', properties: { total: { type: 'integer' }, limit: { type: 'integer' }, offset: { type: 'integer' } } } } } } } },
        '400': { description: 'Invalid query parameters', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      },
    },
  },
  '/api/v1/cognigate/handlers': {
    get: {
      tags: ['Handlers'],
      summary: 'List handlers',
      description: 'List all registered execution handlers with their status.',
      operationId: 'listHandlers',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': { description: 'Handlers listed', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/HandlerInfo' } } } } } } },
      },
    },
  },
  '/api/v1/cognigate/handlers/{name}': {
    get: {
      tags: ['Handlers'],
      summary: 'Get handler details',
      description: 'Get detailed information about a specific handler.',
      operationId: 'getHandler',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'name', in: 'path', required: true, description: 'Handler name', schema: { type: 'string' } }],
      responses: {
        '200': { description: 'Handler found', content: { 'application/json': { schema: { $ref: '#/components/schemas/HandlerInfo' } } } },
        '404': { description: 'Handler not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      },
    },
  },
  '/api/v1/cognigate/handlers/{name}/drain': {
    post: {
      tags: ['Handlers'],
      summary: 'Drain handler',
      description: 'Drain a handler: stop accepting new executions and finish existing ones.',
      operationId: 'drainHandler',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'name', in: 'path', required: true, description: 'Handler name', schema: { type: 'string' } }],
      responses: {
        '200': { description: 'Handler draining', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'object', properties: { handlerName: { type: 'string' }, status: { type: 'string' }, drained: { type: 'integer' } } } } } } } },
        '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        '404': { description: 'Handler not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      },
    },
  },
  '/api/v1/cognigate/audit': {
    get: {
      tags: ['Audit'],
      summary: 'Query audit trail',
      description: 'Query the execution audit trail with optional filters.',
      operationId: 'queryAudit',
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'tenantId', in: 'query', description: 'Filter by tenant ID', schema: { type: 'string' } },
        { name: 'executionId', in: 'query', description: 'Filter by execution ID', schema: { type: 'string' } },
        { name: 'eventType', in: 'query', description: 'Filter by event type', schema: { type: 'string' } },
        { name: 'severity', in: 'query', description: 'Filter by severity', schema: { type: 'string', enum: ['info', 'warning', 'error', 'critical'] } },
        { name: 'since', in: 'query', description: 'Filter from date (ISO 8601)', schema: { type: 'string', format: 'date-time' } },
        { name: 'until', in: 'query', description: 'Filter to date (ISO 8601)', schema: { type: 'string', format: 'date-time' } },
        { name: 'limit', in: 'query', description: 'Maximum results (1-100)', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
      ],
      responses: {
        '200': { description: 'Audit entries returned', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/AuditEntry' } }, pagination: { type: 'object' } } } } } },
        '400': { description: 'Invalid query', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      },
    },
  },
  '/api/v1/cognigate/health': {
    get: {
      tags: ['Health'],
      summary: 'Health check (liveness)',
      description: 'Check if the cognigate service is alive and functioning.',
      operationId: 'healthCheck',
      responses: {
        '200': { description: 'Service is healthy or degraded', content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthStatus' } } } },
        '503': { description: 'Service is unhealthy', content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthStatus' } } } },
      },
    },
  },
  '/api/v1/cognigate/ready': {
    get: {
      tags: ['Health'],
      summary: 'Readiness check',
      description: 'Check if the cognigate service is ready to accept traffic.',
      operationId: 'readinessCheck',
      responses: {
        '200': { description: 'Service is ready', content: { 'application/json': { schema: { $ref: '#/components/schemas/ReadinessStatus' } } } },
        '503': { description: 'Service is not ready', content: { 'application/json': { schema: { $ref: '#/components/schemas/ReadinessStatus' } } } },
      },
    },
  },
  '/api/v1/cognigate/metrics': {
    get: {
      tags: ['Monitoring'],
      summary: 'Prometheus metrics',
      description: 'Get Prometheus-formatted metrics for the cognigate module.',
      operationId: 'getMetrics',
      responses: {
        '200': { description: 'Metrics returned', content: { 'text/plain': { schema: { type: 'string' } } } },
      },
    },
  },
  '/api/v1/cognigate/openapi.json': {
    get: {
      tags: ['Documentation'],
      summary: 'OpenAPI specification',
      description: 'Get the OpenAPI 3.0 specification for the Cognigate API.',
      operationId: 'getOpenApiSpec',
      responses: {
        '200': { description: 'OpenAPI spec returned', content: { 'application/json': { schema: { type: 'object' } } } },
      },
    },
  },
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Get the complete OpenAPI specification for the Cognigate module.
 *
 * @returns OpenAPI 3.0.3 specification object
 */
export function getCognigateOpenApiSpec(): OpenApiSpec {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Vorion Cognigate API',
      version: '1.0.0',
      description: `
The Cognigate module provides the Constrained Execution Runtime for the Vorion AI Governance platform.

## Features
- Submit and manage constrained executions
- Resource limiting (memory, CPU, network, filesystem)
- Handler registration and lifecycle management
- Execution pause/resume/terminate controls
- Comprehensive audit trail
- Per-tenant rate limiting

## Authentication
All endpoints except /health, /ready, /metrics, and /openapi.json require a valid JWT token.
`,
      contact: {
        name: 'Vorion Team',
      },
    },
    servers: [
      {
        url: '/',
        description: 'Current server',
      },
    ],
    tags: [
      { name: 'Execution', description: 'Execution submission and management' },
      { name: 'Handlers', description: 'Execution handler management' },
      { name: 'Audit', description: 'Audit trail endpoints' },
      { name: 'Health', description: 'Health check endpoints' },
      { name: 'Monitoring', description: 'Monitoring and metrics' },
      { name: 'Documentation', description: 'API documentation' },
    ],
    paths,
    components: {
      schemas,
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  };
}

/**
 * Get the OpenAPI specification as a JSON string.
 *
 * @returns Pretty-printed JSON string
 */
export function getCognigateOpenApiSpecJson(): string {
  return JSON.stringify(getCognigateOpenApiSpec(), null, 2);
}
