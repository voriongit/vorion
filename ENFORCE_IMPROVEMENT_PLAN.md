# ENFORCE Module Improvement Game Plan

## Current State Assessment

### Module Comparison: enforce vs intent

| Metric | enforce | intent | Gap |
|--------|---------|--------|-----|
| **Files** | 5 | 22 | -17 |
| **Test Files** | 4 | 25 | -21 |
| **Total Tests** | 61 | ~1000+ | ~940 |
| **Lines of Code** | ~2,500 | ~22,000 | ~19,500 |

### Current enforce Files
- `index.ts` - Core enforcement service
- `types.ts` - Type definitions
- `metrics.ts` - Prometheus metrics
- `decision-cache.ts` - Two-tier caching
- `audit.ts` - Audit trail

### Missing Features (present in intent)

| Feature | Priority | Complexity | Impact |
|---------|----------|------------|--------|
| API Routes (`routes.ts`) | P0 | Medium | REST API exposure |
| OpenAPI Spec (`openapi.ts`) | P0 | Medium | API documentation |
| Health Checks (`health.ts`) | P0 | Low | Observability |
| Rate Limiting (`ratelimit.ts`) | P1 | Medium | Security |
| Webhooks (`webhooks.ts`) | P1 | High | Event delivery |
| Repository Layer (`repository.ts`) | P1 | Medium | Data persistence |
| Queue Processing (`queues.ts`) | P2 | High | Async processing |
| Graceful Shutdown (`shutdown.ts`) | P2 | Low | Reliability |
| Distributed Tracing (`tracing.ts`) | P2 | Medium | Observability |
| GDPR Compliance (`gdpr.ts`) | P3 | Medium | Compliance |

---

## Phase 1: Core API (Week 1-2)

### 1.1 Create `routes.ts` - REST API Endpoints

**Endpoints to implement:**
```
POST   /api/v1/enforce/decide      - Make enforcement decision
GET    /api/v1/enforce/decision/:id - Get decision by ID
GET    /api/v1/enforce/decisions    - List decisions (paginated)
POST   /api/v1/enforce/evaluate     - Dry-run evaluation
GET    /api/v1/enforce/audit/:intentId - Get audit trail
GET    /api/v1/enforce/metrics      - Prometheus metrics
GET    /api/v1/enforce/health       - Health check
```

**Requirements:**
- [ ] Zod request/response validation
- [ ] Tenant-scoped authorization
- [ ] Request ID tracking
- [ ] Structured error responses

### 1.2 Create `openapi.ts` - API Documentation

**Requirements:**
- [ ] Full OpenAPI 3.0 spec
- [ ] Request/response schemas
- [ ] Example payloads
- [ ] Error response documentation

### 1.3 Create `health.ts` - Health Checks

**Checks to implement:**
- [ ] Redis connectivity
- [ ] Database connectivity
- [ ] Circuit breaker states
- [ ] Cache stats
- [ ] Memory usage

---

## Phase 2: Resilience (Week 3-4)

### 2.1 Create `ratelimit.ts` - Rate Limiting

**Requirements:**
- [ ] Per-tenant rate limits
- [ ] Sliding window algorithm
- [ ] Redis-backed counters
- [ ] Configurable limits by endpoint

### 2.2 Create `repository.ts` - Data Access Layer

**Features:**
- [ ] Decision persistence
- [ ] Query builder with filters
- [ ] Soft delete support
- [ ] Pagination helpers

### 2.3 Create `shutdown.ts` - Graceful Shutdown

**Requirements:**
- [ ] Drain in-flight requests
- [ ] Flush audit buffer
- [ ] Close Redis connections
- [ ] Timeout protection

---

## Phase 3: Observability (Week 5-6)

### 3.1 Create `tracing.ts` - Distributed Tracing

**Requirements:**
- [ ] OpenTelemetry integration
- [ ] Span creation for decisions
- [ ] Context propagation
- [ ] Error recording

### 3.2 Enhance `metrics.ts`

**Additional metrics:**
- [ ] Decision latency histograms
- [ ] Cache hit/miss ratios
- [ ] Circuit breaker state changes
- [ ] Queue depths

### 3.3 Create `webhooks.ts` - Event Delivery

**Events to support:**
- [ ] `enforcement.decision.made`
- [ ] `enforcement.escalation.triggered`
- [ ] `enforcement.policy.violation`

---

## Phase 4: Advanced Features (Week 7-8)

### 4.1 Create `queues.ts` - Async Processing

**Features:**
- [ ] Decision evaluation queue
- [ ] Audit flush queue
- [ ] Retry logic with backoff
- [ ] Dead letter queue

### 4.2 Create `gdpr.ts` - Compliance

**Features:**
- [ ] Data export for entity
- [ ] Data deletion (soft delete)
- [ ] Audit log retention
- [ ] Anonymization support

---

## Phase 5: Test Coverage (Ongoing)

### Target: Match intent module coverage

**Test files to create:**
| Test File | Coverage Target |
|-----------|-----------------|
| `routes.test.ts` | API endpoints |
| `health.test.ts` | Health checks |
| `ratelimit.test.ts` | Rate limiting |
| `repository.test.ts` | Data access |
| `tracing.test.ts` | Distributed tracing |
| `webhooks.test.ts` | Event delivery |
| `gdpr.test.ts` | GDPR compliance |
| `integration.test.ts` | End-to-end |

**Test categories:**
- [ ] Unit tests for each module
- [ ] Integration tests with Redis
- [ ] Integration tests with database
- [ ] Load tests for performance
- [ ] Security tests for authorization

---

## Scorecard Target

| Category | Current | Target | Actions |
|----------|---------|--------|---------|
| **Code Metrics** | 5/10 | 9/10 | Add missing modules |
| **Documentation** | 4/10 | 9/10 | OpenAPI, JSDoc |
| **Test Coverage** | 3/10 | 8/10 | Add test files |
| **Security** | 6/10 | 9/10 | Rate limiting, auth |
| **Resilience** | 7/10 | 9/10 | Queues, shutdown |
| **Observability** | 5/10 | 9/10 | Tracing, health |
| **Overall** | 5/10 | 9/10 | Full enterprise grade |

---

## Immediate Next Steps (Today)

1. **Create `routes.ts`** - Expose enforcement via REST API
2. **Create `health.ts`** - Add health check endpoint
3. **Create `openapi.ts`** - Document the API
4. **Add more tests** - Increase coverage to 80%+

---

## Success Criteria

- [ ] All P0 features implemented
- [ ] 80%+ test coverage
- [ ] OpenAPI documentation complete
- [ ] Health checks passing
- [ ] Rate limiting enabled
- [ ] Graceful shutdown working
- [ ] Metrics dashboard ready
- [ ] Zero critical/high audit findings
