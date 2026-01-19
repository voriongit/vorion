# Vorion Security Configuration Guide

**Version:** 1.0.0
**Classification:** Internal - DevOps/Security Team
**Last Updated:** January 19, 2026

---

## Overview

This guide covers security configuration for the Vorion platform, including authentication, authorization, rate limiting, input validation, and tenant isolation.

---

## Table of Contents

1. [Security Architecture](#security-architecture)
2. [Authentication Configuration](#authentication-configuration)
3. [Authorization & RBAC](#authorization--rbac)
4. [Rate Limiting](#rate-limiting)
5. [Input Validation](#input-validation)
6. [Tenant Isolation](#tenant-isolation)
7. [Secrets Management](#secrets-management)
8. [Security Headers](#security-headers)
9. [Audit Logging](#audit-logging)
10. [Security Checklist](#security-checklist)

---

## Security Architecture

### Defense in Depth Layers

```
┌─────────────────────────────────────────────────────────┐
│                    PERIMETER                             │
│  CORS │ Rate Limiting │ WAF (if deployed)               │
├─────────────────────────────────────────────────────────┤
│                   AUTHENTICATION                         │
│  JWT Verification │ Token Expiration │ Refresh Tokens   │
├─────────────────────────────────────────────────────────┤
│                   AUTHORIZATION                          │
│  RBAC │ Permissions │ Tenant Isolation                  │
├─────────────────────────────────────────────────────────┤
│                   INPUT VALIDATION                       │
│  Zod Schemas │ Injection Detection │ Payload Limits     │
├─────────────────────────────────────────────────────────┤
│                   APPLICATION                            │
│  Trust Engine │ Policy Enforcement │ Governance         │
├─────────────────────────────────────────────────────────┤
│                   DATA                                   │
│  RLS Policies │ Encryption │ Cryptographic Proofs       │
└─────────────────────────────────────────────────────────┘
```

### Zero Trust Principles

1. **Never trust, always verify** - Every request authenticated
2. **Least privilege** - Minimum permissions required
3. **Assume breach** - Log everything, detect anomalies
4. **Verify explicitly** - Tenant context on every operation

---

## Authentication Configuration

### JWT Configuration

**Environment Variables:**

```bash
# REQUIRED - Minimum 32 characters in production
VORION_JWT_SECRET=your-secure-secret-minimum-32-characters-long

# Token lifetimes
JWT_ACCESS_EXPIRATION=1h        # Access token lifetime
JWT_REFRESH_EXPIRATION=7d       # Refresh token lifetime

# Algorithm (default: HS256)
JWT_ALGORITHM=HS256
```

**Production Requirements:**

| Setting | Requirement | Validation |
|---------|-------------|------------|
| `VORION_JWT_SECRET` | Min 32 chars | Startup check |
| `NODE_ENV` | Must be `production` | Env check |
| Token expiration | Max 1 hour access | Config validation |

### Token Structure

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user-uuid",
    "tenantId": "tenant-uuid",
    "roles": ["admin", "developer"],
    "permissions": ["agents:read", "agents:write", "trust:read"],
    "iat": 1737244800,
    "exp": 1737248400
  }
}
```

### Implementing Authentication

**Server-side verification:**

```typescript
// src/api/auth.ts

import { createHmac } from 'crypto';

interface TenantContext {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

export async function verifyToken(token: string): Promise<TenantContext> {
  const secret = process.env.VORION_JWT_SECRET;

  // Production check
  if (process.env.NODE_ENV === 'production' && (!secret || secret.length < 32)) {
    throw new Error('CRITICAL: VORION_JWT_SECRET must be set with 32+ chars in production');
  }

  const [headerB64, payloadB64, signatureB64] = token.split('.');

  // Verify signature using Web Crypto API
  const data = `${headerB64}.${payloadB64}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signature = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(data));

  if (!valid) {
    throw new Error('Invalid token signature');
  }

  const payload = JSON.parse(atob(payloadB64));

  // Check expiration
  if (payload.exp < Date.now() / 1000) {
    throw new Error('Token expired');
  }

  return {
    userId: payload.sub,
    tenantId: payload.tenantId,
    roles: payload.roles || [],
    permissions: payload.permissions || []
  };
}
```

### Supabase Auth Integration

**Configuration:**

```typescript
// apps/agentanchor/lib/supabase/config.ts

export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,

  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',  // Use PKCE for security

    // Session settings
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'vorion-auth-token',
  }
};
```

---

## Authorization & RBAC

### Role Definitions

| Role | Description | Permissions |
|------|-------------|-------------|
| `super_admin` | Platform administrator | All permissions |
| `admin` | Tenant administrator | Manage tenant resources |
| `developer` | API developer | agents:*, trust:read, proofs:read |
| `analyst` | Read-only analyst | *:read |
| `operator` | Operations | escalations:*, audit:read |

### Permission Format

```
resource:action
```

**Resources:**
- `agents` - Agent management
- `trust` - Trust scoring
- `policies` - Governance policies
- `proofs` - Audit proofs
- `escalations` - Human review
- `audit` - Audit logs

**Actions:**
- `read` - View resources
- `write` - Create/update resources
- `delete` - Remove resources
- `*` - All actions

### Implementing Authorization

```typescript
// src/api/auth.ts

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const context = request.tenantContext;

    if (!context) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const hasRole = roles.some(role => context.roles.includes(role));

    if (!hasRole) {
      return reply.status(403).send({
        error: 'Forbidden',
        required: roles,
        actual: context.roles
      });
    }
  };
}

export function requirePermission(...permissions: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const context = request.tenantContext;

    if (!context) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const hasPermission = permissions.every(perm => {
      const [resource, action] = perm.split(':');
      return (
        context.permissions.includes(perm) ||
        context.permissions.includes(`${resource}:*`) ||
        context.permissions.includes('*:*')
      );
    });

    if (!hasPermission) {
      return reply.status(403).send({
        error: 'Insufficient permissions',
        required: permissions
      });
    }
  };
}
```

### Route Protection Examples

```typescript
// Protected routes

// Requires admin role
app.delete('/agents/:id', {
  preValidation: [authenticate, requireRole('admin', 'super_admin')]
}, deleteAgentHandler);

// Requires specific permission
app.post('/trust/:entityId/signal', {
  preValidation: [authenticate, requirePermission('trust:write')]
}, recordSignalHandler);

// Multiple permission check
app.post('/escalations/:id/resolve', {
  preValidation: [
    authenticate,
    requirePermission('escalations:write', 'audit:write')
  ]
}, resolveEscalationHandler);
```

---

## Rate Limiting

### Configuration

**Environment Variables:**

```bash
# Rate limit settings
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000        # 1 minute window
RATE_LIMIT_MAX_FREE=60            # Free tier: 60/min
RATE_LIMIT_MAX_PRO=300            # Pro tier: 300/min
RATE_LIMIT_MAX_ENTERPRISE=1000    # Enterprise: 1000/min

# Redis for distributed rate limiting (optional)
REDIS_URL=redis://localhost:6379
RATE_LIMIT_STORE=memory           # 'memory' or 'redis'
```

### Tier-Based Limits

```typescript
// src/api/rate-limit.ts

export const TIER_LIMITS = {
  free: {
    burst: { max: 10, window: 1000 },      // 10/sec
    minute: { max: 60, window: 60000 },    // 60/min
    hour: { max: 1000, window: 3600000 }   // 1000/hr
  },
  pro: {
    burst: { max: 50, window: 1000 },
    minute: { max: 300, window: 60000 },
    hour: { max: 10000, window: 3600000 }
  },
  enterprise: {
    burst: { max: 100, window: 1000 },
    minute: { max: 1000, window: 60000 },
    hour: { max: 50000, window: 3600000 }
  }
};
```

### Route-Specific Limits

Some routes need stricter limits:

```typescript
const ROUTE_LIMITS = {
  'POST /auth/token': { max: 5, window: 60000 },      // 5/min for auth
  'POST /trust/*/signal': { max: 50, window: 60000 }, // 50/min for signals
  'POST /intents': { max: 100, window: 60000 },       // 100/min for intents
  'GET /proofs/*': { max: 200, window: 60000 }        // 200/min for proofs
};
```

### Implementation

```typescript
// src/api/rate-limit.ts

import { FastifyRequest, FastifyReply } from 'fastify';

interface RateLimitStore {
  requests: Map<string, number[]>;
}

const store: RateLimitStore = { requests: new Map() };

export async function rateLimit(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.tenantContext?.tenantId || request.ip;
  const tier = request.tenantContext?.tier || 'free';
  const limits = TIER_LIMITS[tier];

  const now = Date.now();
  const key = `${tenantId}:minute`;

  // Get request timestamps
  let timestamps = store.requests.get(key) || [];

  // Remove old timestamps
  timestamps = timestamps.filter(t => now - t < limits.minute.window);

  if (timestamps.length >= limits.minute.max) {
    const retryAfter = Math.ceil((timestamps[0] + limits.minute.window - now) / 1000);

    reply.header('X-RateLimit-Limit', limits.minute.max);
    reply.header('X-RateLimit-Remaining', 0);
    reply.header('X-RateLimit-Reset', Math.ceil((now + limits.minute.window) / 1000));
    reply.header('Retry-After', retryAfter);

    return reply.status(429).send({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests',
        retryAfter
      }
    });
  }

  // Record this request
  timestamps.push(now);
  store.requests.set(key, timestamps);

  // Set headers
  reply.header('X-RateLimit-Limit', limits.minute.max);
  reply.header('X-RateLimit-Remaining', limits.minute.max - timestamps.length);
  reply.header('X-RateLimit-Reset', Math.ceil((now + limits.minute.window) / 1000));
}
```

---

## Input Validation

### Zod Schema Configuration

```typescript
// src/api/validation.ts

import { z } from 'zod';

// Sanitization patterns
const INJECTION_PATTERNS = [
  /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,           // SQL injection
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,  // XSS
  /\$\{.*\}/,                                   // Template injection
  /\.\.\//,                                     // Path traversal
  /[;&|`$]/                                     // Command injection
];

// Sanitize function
export function sanitize(input: unknown): unknown {
  if (typeof input === 'string') {
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        throw new Error('Potential injection detected');
      }
    }
    return input.trim();
  }

  if (Array.isArray(input)) {
    return input.map(sanitize);
  }

  if (typeof input === 'object' && input !== null) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[sanitize(key) as string] = sanitize(value);
    }
    return sanitized;
  }

  return input;
}

// Common schemas
export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0)
});

// Intent submission schema
export const intentSubmissionSchema = z.object({
  entityId: uuidSchema,
  goal: z.string().min(1).max(10000).transform(s => s.trim()),
  context: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional()
}).transform(sanitize);

// Trust signal schema
export const trustSignalSchema = z.object({
  signalType: z.enum(['success', 'failure', 'compliance', 'violation', 'verification']),
  impact: z.number().min(-100).max(100),
  context: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional()
}).transform(sanitize);
```

### Payload Size Limits

```typescript
// Server configuration
app.register(require('@fastify/multipart'), {
  limits: {
    fieldNameSize: 100,
    fieldSize: 1000000,      // 1MB per field
    fields: 10,
    fileSize: 10000000,      // 10MB per file
    files: 1,
    headerPairs: 2000
  }
});

// Body parser limits
app.addContentTypeParser('application/json', {
  parseAs: 'string',
  bodyLimit: 1048576  // 1MB
}, (req, body, done) => {
  try {
    const json = JSON.parse(body);
    done(null, json);
  } catch (err) {
    done(err, undefined);
  }
});
```

### Validation Middleware

```typescript
export function validateBody<T>(schema: z.Schema<T>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      request.body = await schema.parseAsync(request.body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          }
        });
      }
      throw error;
    }
  };
}
```

---

## Tenant Isolation

### Multi-Tenant Architecture

Every resource is scoped to a tenant:

```sql
-- All tables include tenant_id
CREATE TABLE agents (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  ...
);

-- Index for efficient tenant queries
CREATE INDEX idx_agents_tenant ON agents(tenant_id);
```

### Row-Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY tenant_isolation ON agents
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Service role bypass (for admin operations)
CREATE POLICY service_bypass ON agents
  FOR ALL
  TO service_role
  USING (true);
```

### Application-Level Enforcement

```typescript
// src/api/auth.ts

export function requireTenantAccess(
  context: TenantContext,
  resourceTenantId: string
) {
  if (context.tenantId !== resourceTenantId) {
    // Check for super_admin override
    if (!context.roles.includes('super_admin')) {
      throw new ForbiddenError('Access denied: tenant mismatch');
    }
  }
}

// Usage in route handlers
app.get('/agents/:id', async (request, reply) => {
  const agent = await agentService.get(request.params.id);

  if (!agent) {
    return reply.status(404).send({ error: 'Not found' });
  }

  // Verify tenant access
  requireTenantAccess(request.tenantContext, agent.tenantId);

  return reply.send({ success: true, data: agent });
});
```

### Query Scoping

```typescript
// Always scope queries to tenant
export class AgentService {
  async list(tenantId: string, options: ListOptions) {
    return this.db
      .select()
      .from(agents)
      .where(eq(agents.tenantId, tenantId))  // Always include tenant filter
      .limit(options.limit)
      .offset(options.offset);
  }
}
```

---

## Secrets Management

### Required Secrets

| Secret | Purpose | Rotation |
|--------|---------|----------|
| `VORION_JWT_SECRET` | JWT signing | Quarterly |
| `DATABASE_URL` | Database connection | On compromise |
| `SUPABASE_SERVICE_KEY` | Admin database access | Quarterly |
| `REDIS_PASSWORD` | Cache authentication | Quarterly |
| `ENCRYPTION_KEY` | Data encryption | Annually |

### Secret Requirements

```typescript
// config/secrets.ts

const SECRET_REQUIREMENTS = {
  VORION_JWT_SECRET: {
    minLength: 32,
    pattern: /^[A-Za-z0-9+/=_-]+$/,
    required: process.env.NODE_ENV === 'production'
  },
  DATABASE_URL: {
    pattern: /^postgres(ql)?:\/\/.+/,
    required: true
  },
  SUPABASE_SERVICE_KEY: {
    minLength: 100,
    required: true
  }
};

export function validateSecrets() {
  const errors: string[] = [];

  for (const [name, requirements] of Object.entries(SECRET_REQUIREMENTS)) {
    const value = process.env[name];

    if (requirements.required && !value) {
      errors.push(`Missing required secret: ${name}`);
      continue;
    }

    if (value) {
      if (requirements.minLength && value.length < requirements.minLength) {
        errors.push(`${name} must be at least ${requirements.minLength} characters`);
      }

      if (requirements.pattern && !requirements.pattern.test(value)) {
        errors.push(`${name} has invalid format`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Secret validation failed:\n${errors.join('\n')}`);
  }
}
```

### Secret Rotation Procedure

1. **Generate new secret**
2. **Update in secret manager** (Vercel/AWS/etc.)
3. **Deploy with new secret** (rolling deployment)
4. **Invalidate old tokens** (if JWT secret)
5. **Verify functionality**
6. **Remove old secret**

---

## Security Headers

### Helmet Configuration

```typescript
// src/api/server.ts

import helmet from '@fastify/helmet';

app.register(helmet, {
  // Content Security Policy
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.agentanchorai.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  } : false,

  // Other headers
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "same-origin" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: "deny" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true
});
```

### CORS Configuration

```typescript
// src/api/server.ts

import cors from '@fastify/cors';

app.register(cors, {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://app.agentanchorai.com', 'https://agentanchorai.com']
    : true,  // Allow all in development

  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  credentials: true,
  maxAge: 86400  // 24 hours
});
```

---

## Audit Logging

### What to Log

| Event | Data to Include |
|-------|-----------------|
| Authentication | userId, success/failure, IP, userAgent |
| Authorization | userId, resource, action, decision |
| Data access | userId, resource, operation, filters |
| Data modification | userId, resource, before/after |
| Escalations | userId, intentId, decision, notes |
| Security events | type, severity, details |

### Log Format

```typescript
// src/logger/index.ts

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',

  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      host: bindings.hostname,
      service: 'vorion-api'
    })
  },

  // Redact sensitive fields
  redact: {
    paths: [
      'req.headers.authorization',
      'req.body.password',
      'req.body.secret',
      '*.token',
      '*.apiKey'
    ],
    censor: '[REDACTED]'
  },

  timestamp: pino.stdTimeFunctions.isoTime
});

// Security event logging
export function logSecurityEvent(event: {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  tenantId?: string;
  details: Record<string, unknown>;
}) {
  logger.warn({
    securityEvent: true,
    ...event,
    timestamp: new Date().toISOString()
  }, `Security event: ${event.type}`);
}
```

### Example Audit Entries

```json
{
  "level": "info",
  "time": "2026-01-19T10:30:00.000Z",
  "requestId": "req_abc123",
  "userId": "user-uuid",
  "tenantId": "tenant-uuid",
  "event": "agent.created",
  "resource": "agents",
  "resourceId": "agent-uuid",
  "action": "create",
  "outcome": "success"
}
```

```json
{
  "level": "warn",
  "time": "2026-01-19T10:30:00.000Z",
  "securityEvent": true,
  "type": "rate_limit_exceeded",
  "severity": "medium",
  "tenantId": "tenant-uuid",
  "details": {
    "endpoint": "/api/v1/intents",
    "requests": 65,
    "limit": 60,
    "window": "1 minute"
  }
}
```

---

## Security Checklist

### Pre-Deployment

- [ ] All secrets set in production environment
- [ ] JWT secret is 32+ characters
- [ ] Database URL uses SSL (`?sslmode=require`)
- [ ] RLS policies enabled on all tables
- [ ] Rate limiting configured
- [ ] CORS origins restricted to production domains
- [ ] CSP headers configured
- [ ] HSTS enabled
- [ ] All inputs validated with Zod schemas
- [ ] Injection patterns blocked
- [ ] Error messages don't leak internal details

### Ongoing

- [ ] Secrets rotated quarterly
- [ ] Dependencies updated weekly
- [ ] Security scans run on PRs
- [ ] Audit logs reviewed weekly
- [ ] Rate limit thresholds appropriate
- [ ] Failed auth attempts monitored
- [ ] Escalation queue reviewed daily

### Incident Response

- [ ] Incident response plan documented
- [ ] Security contact defined
- [ ] Log retention configured (90 days minimum)
- [ ] Backup restoration tested
- [ ] Token revocation process defined

---

*Security Configuration Guide created by BMad Master*
*Review annually or after security incidents*
