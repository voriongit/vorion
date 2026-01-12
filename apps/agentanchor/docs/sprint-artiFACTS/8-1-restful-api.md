# Story 8-1: RESTful API

**Epic:** 8 - API & Integration
**Status:** Drafted
**Created:** 2025-12-03

---

## User Story

**As a** developer integrating with AgentAnchor
**I want** a RESTful API for programmatic access
**So that** I can build applications and automations using the platform

---

## Acceptance Criteria

- [ ] API versioned under `/api/v1/`
- [ ] Endpoints for agents: list, get, create, update, trust score
- [ ] Endpoints for marketplace: listings, acquire
- [ ] Endpoints for council: decisions, submit request
- [ ] Endpoints for verification: verify record (public)
- [ ] Consistent JSON response format
- [ ] Proper HTTP status codes
- [ ] Rate limiting per API key
- [ ] Request/response logging

---

## Technical Notes

### API Structure

```
/api/v1/
├── /agents
│   ├── GET /              # List user's agents
│   ├── POST /             # Create new agent
│   ├── GET /:id           # Get agent details
│   ├── PUT /:id           # Update agent
│   └── GET /:id/trust     # Get trust score details
├── /marketplace
│   ├── GET /listings      # Browse listings
│   ├── GET /listings/:id  # Get listing details
│   └── POST /acquire      # Acquire agent
├── /council
│   ├── GET /decisions     # List decisions
│   ├── GET /decisions/:id # Get decision details
│   └── POST /request      # Submit council request
└── /verify
    └── GET /:recordId     # Verify truth chain record (public)
```

### Response Format

```typescript
// Success response
interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    total?: number;
    limit?: number;
  };
}

// Error response
interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

### Rate Limiting

| Tier | Requests/min | Requests/day |
|------|-------------|--------------|
| Free | 60 | 1,000 |
| Basic | 300 | 10,000 |
| Pro | 1,000 | 100,000 |

### Files to Create/Modify

- `app/api/v1/agents/route.ts` - Agents endpoints
- `app/api/v1/agents/[id]/route.ts` - Agent detail
- `app/api/v1/agents/[id]/trust/route.ts` - Trust score
- `app/api/v1/marketplace/listings/route.ts` - Listings
- `app/api/v1/marketplace/acquire/route.ts` - Acquisition
- `app/api/v1/council/decisions/route.ts` - Decisions
- `app/api/v1/council/request/route.ts` - Submit request
- `app/api/v1/verify/[id]/route.ts` - Public verification
- `lib/api/response.ts` - Response helpers
- `lib/api/rate-limit.ts` - Rate limiting

---

## Dependencies

- Story 8-2: API Authentication (for protected endpoints)
- Existing services from Epics 2-6

---

## Out of Scope

- Webhooks (Story 8-3)
- API documentation (Story 8-4)
- GraphQL API
- Batch operations
