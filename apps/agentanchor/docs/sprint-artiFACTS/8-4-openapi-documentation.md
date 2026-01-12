# Story 8-4: OpenAPI Documentation

**Epic:** 8 - API & Integration
**Status:** Drafted
**Created:** 2025-12-03

---

## User Story

**As a** developer
**I want** interactive API documentation
**So that** I can explore and test the API easily

---

## Acceptance Criteria

- [ ] OpenAPI 3.0 specification generated
- [ ] Interactive documentation at `/docs/api`
- [ ] Try-it-out functionality for authenticated endpoints
- [ ] Code examples in multiple languages
- [ ] Response schema documentation
- [ ] Authentication guide
- [ ] Webhook event documentation
- [ ] Rate limiting documentation

---

## Technical Notes

### OpenAPI Specification

```yaml
openapi: 3.0.3
info:
  title: AgentAnchor API
  version: 1.0.0
  description: |
    The AgentAnchor API provides programmatic access to the AI governance platform.

    ## Authentication
    All authenticated endpoints require a Bearer token:
    ```
    Authorization: Bearer sk_live_xxxxxxxxxxxx
    ```

    ## Rate Limiting
    - Free tier: 60 requests/minute
    - Basic tier: 300 requests/minute
    - Pro tier: 1,000 requests/minute

servers:
  - url: https://app.agentanchorai.com/api/v1
    description: Production
  - url: https://staging.agentanchorai.com/api/v1
    description: Staging

tags:
  - name: Agents
    description: Agent management
  - name: Marketplace
    description: Agent marketplace
  - name: Council
    description: Governance decisions
  - name: Verification
    description: Public verification
  - name: Webhooks
    description: Webhook management
```

### Documentation UI

Use Scalar (modern alternative to Swagger UI):

```typescript
// app/docs/api/page.tsx
import { ApiReference } from '@scalar/nextjs-api-reference';

export default function ApiDocsPage() {
  return (
    <ApiReference
      configuration={{
        spec: {
          url: '/api/openapi.json'
        },
        theme: 'default',
        customCss: `...`
      }}
    />
  );
}
```

### Code Examples

Include examples for:
- JavaScript/TypeScript (fetch, axios)
- Python (requests)
- cURL
- Go (http)

```typescript
// Example in spec
paths:
  /agents:
    get:
      summary: List agents
      x-codeSamples:
        - lang: JavaScript
          source: |
            const response = await fetch('https://app.agentanchorai.com/api/v1/agents', {
              headers: { 'Authorization': 'Bearer sk_live_xxx' }
            });
            const agents = await response.json();
```

### Files to Create/Modify

- `lib/api/openapi/spec.ts` - OpenAPI spec generation
- `lib/api/openapi/schemas.ts` - Reusable schemas
- `app/api/openapi.json/route.ts` - Serve spec
- `app/docs/api/page.tsx` - Documentation page
- `app/docs/api/getting-started/page.tsx` - Getting started guide
- `app/docs/api/authentication/page.tsx` - Auth guide
- `app/docs/api/webhooks/page.tsx` - Webhooks guide

### Spec Generation

```typescript
// lib/api/openapi/spec.ts
import { generateOpenApi } from '@asteasolutions/zod-to-openapi';

// Use Zod schemas to generate OpenAPI spec
const agentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  trustScore: z.number().min(0).max(1000),
  // ...
});

registry.register('Agent', agentSchema);
```

---

## Dependencies

- Story 8-1: RESTful API (endpoints to document)
- Story 8-2: API Authentication (auth documentation)
- Story 8-3: Webhooks (webhook documentation)

---

## Out of Scope

- SDK generation
- API versioning documentation
- Changelog
- API status page
