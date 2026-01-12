# Story 003: Comprehensive Error Handling & Monitoring

**Epic**: Platform Reliability & Observability
**Priority**: High
**Story Points**: 8
**Status**: Ready for Development

## User Story

**As a** platform operator
**I want** comprehensive error tracking, logging, and monitoring
**So that** I can quickly identify and fix issues, ensuring a reliable user experience

## Acceptance Criteria

### AC1: Sentry Integration (Already Installed)
- [ ] Complete Sentry configuration for client, server, and edge runtimes
- [ ] Configure `sentry.client.config.ts` with proper error filtering
- [ ] Configure `sentry.server.config.ts` with environment and release tracking
- [ ] Configure `sentry.edge.config.ts` for edge runtime errors
- [ ] Add source maps upload in build process
- [ ] Test error reporting in all three environments

### AC2: Structured Logging with Pino
- [ ] Create centralized logger utility using `pino` (already installed)
- [ ] Configure pino-pretty for local development
- [ ] JSON logging for production
- [ ] Log levels: DEBUG, INFO, WARN, ERROR, FATAL
- [ ] Include correlation IDs for request tracing
- [ ] Sensitive data redaction (API keys, passwords)

### AC3: API Error Handling
**Standard Error Response Format:**
```typescript
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable error message",
    "details": {...},
    "requestId": "uuid",
    "timestamp": "ISO 8601"
  }
}
```

**Implementation:**
- [ ] Create error utility module `lib/errors.ts`
- [ ] Define custom error classes (ValidationError, AuthError, NotFoundError, etc.)
- [ ] Implement global error handler middleware
- [ ] Add error logging to all API routes
- [ ] Consistent HTTP status codes (400, 401, 403, 404, 500)

### AC4: Client-Side Error Boundaries
- [ ] Root error boundary in `app/layout.tsx`
- [ ] Section-specific error boundaries (chat, bots, teams)
- [ ] User-friendly error messages
- [ ] "Retry" and "Report" actions on error screens
- [ ] Automatic error reporting to Sentry
- [ ] Graceful degradation (show cached data when possible)

### AC5: Monitoring & Metrics
- [ ] Create metrics utility `lib/metrics.ts`
- [ ] Track key metrics:
  - API response times (P50, P95, P99)
  - Error rates per endpoint
  - Claude API latency
  - Database query times
  - Active users/conversations
- [ ] Dashboard for metrics visualization (future: Grafana)
- [ ] Alerts for critical metrics (error rate > 5%, P95 latency > 2s)

### AC6: Health Check Endpoints
**`GET /api/health`**
- [ ] Returns 200 OK with system status
- [ ] Checks: Database connectivity, Claude API, storage
- [ ] Response format:
```json
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "claude_api": "ok",
    "storage": "ok"
  },
  "timestamp": "ISO 8601"
}
```

**`GET /api/health/ready`** - Kubernetes readiness probe
**`GET /api/health/live`** - Kubernetes liveness probe

### AC7: Rate Limiting Error Handling
- [ ] User-friendly rate limit messages
- [ ] Include retry-after header
- [ ] Display remaining quota to users
- [ ] Log rate limit hits for analysis

## Technical Details

### Files to Create
1. **`lib/logger.ts`** - Centralized Pino logger
2. **`lib/errors.ts`** - Custom error classes and handlers
3. **`lib/metrics.ts`** - Metrics collection utility
4. **`middleware/error-handler.ts`** - Global error middleware
5. **`components/ErrorBoundary.tsx`** - React error boundary
6. **`app/api/health/route.ts`** - Health check endpoint
7. **`app/api/health/ready/route.ts`** - Readiness probe
8. **`app/api/health/live/route.ts`** - Liveness probe

### Files to Modify
1. **All API routes** - Add consistent error handling
2. **`app/layout.tsx`** - Add root error boundary
3. **`app/chat/page.tsx`** - Add section error boundary
4. **`next.config.js`** - Configure Sentry source maps
5. **`package.json`** - Add build scripts for source maps

### Sentry Configuration

**`sentry.client.config.ts`:**
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  beforeSend(event, hint) {
    // Filter out known non-critical errors
    if (event.exception?.values?.[0]?.value?.includes('ResizeObserver')) {
      return null;
    }
    return event;
  },
  ignoreErrors: [
    'ResizeObserver loop',
    'Non-Error promise rejection',
  ],
});
```

**`sentry.server.config.ts`:**
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0, // Higher sample rate on server
  environment: process.env.NODE_ENV,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
  ],
});
```

### Logger Implementation

**`lib/logger.ts`:**
```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true },
        },
      }
    : {}),
  redact: {
    paths: ['*.password', '*.apiKey', '*.token'],
    remove: true,
  },
});

export default logger;
```

### Error Classes

**`lib/errors.ts`:**
```typescript
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class AuthError extends AppError {
  constructor(message = 'Unauthorized') {
    super('AUTH_ERROR', message, 401);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404);
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super('RATE_LIMIT', 'Too many requests', 429, { retryAfter });
  }
}
```

### Metrics Collection

**`lib/metrics.ts`:**
```typescript
interface Metric {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: Date;
}

class MetricsCollector {
  private metrics: Metric[] = [];

  record(name: string, value: number, tags?: Record<string, string>) {
    this.metrics.push({ name, value, tags, timestamp: new Date() });

    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to Datadog/Prometheus/CloudWatch
    }
  }

  recordDuration(name: string, duration: number, tags?: Record<string, string>) {
    this.record(`${name}.duration`, duration, tags);
  }

  increment(name: string, tags?: Record<string, string>) {
    this.record(name, 1, tags);
  }
}

export const metrics = new MetricsCollector();
```

## Implementation Phases

**Phase 1: Logging Foundation**
- Set up Pino logger
- Add logging to all API routes
- Configure log levels and redaction

**Phase 2: Error Handling**
- Create error classes
- Implement error handler middleware
- Update all API routes with consistent error handling

**Phase 3: Sentry Integration**
- Complete Sentry configuration
- Add source maps
- Test error reporting

**Phase 4: Client Error Boundaries**
- Create error boundary components
- Add to layouts and critical sections
- Implement fallback UIs

**Phase 5: Monitoring**
- Implement metrics collection
- Create health check endpoints
- Set up alerting (future)

## Dependencies
- Sentry account (already configured based on installed package)
- Environment variables: `NEXT_PUBLIC_SENTRY_DSN`, `LOG_LEVEL`

## Testing Notes
- Test error reporting in all environments (client, server, edge)
- Verify Sentry receives errors
- Test health check endpoints
- Simulate various error scenarios
- Check log output format and redaction
- Performance: Ensure logging doesn't impact latency

## Monitoring Metrics to Track

**API Performance:**
- `/api/chat` response time (P50, P95, P99)
- `/api/orchestrator/*` latency
- Error rates per endpoint

**Business Metrics:**
- Bots created per day
- Messages sent per day
- Active users (DAU, MAU)
- Conversations started per day

**Infrastructure:**
- Database connection pool usage
- Claude API quota usage
- Storage usage
- Error rate trends

## Definition of Done
- [ ] All acceptance criteria met
- [ ] Sentry fully configured and tested
- [ ] Logging implemented across all API routes
- [ ] Error boundaries in place
- [ ] Health check endpoints working
- [ ] Metrics collection implemented
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Runbook created for common errors

## Future Enhancements
- Distributed tracing with OpenTelemetry
- Log aggregation (e.g., Datadog, Logtail)
- Custom dashboards for business metrics
- Automated incident response
- Performance profiling and APM
