# Story 8-2: API Authentication

**Epic:** 8 - API & Integration
**Status:** Drafted
**Created:** 2025-12-03

---

## User Story

**As a** developer
**I want** to generate and manage API keys
**So that** I can securely authenticate my API requests

---

## Acceptance Criteria

- [ ] `api_keys` table for key management
- [ ] API keys page at `/dashboard/settings/api-keys`
- [ ] Generate new API key with name and scopes
- [ ] API key shown once on creation (not retrievable)
- [ ] List existing keys with last used timestamp
- [ ] Revoke/delete API keys
- [ ] Key format: `sk_live_` or `sk_test_` prefix
- [ ] Scoped permissions per key
- [ ] Key expiration (optional)

---

## Technical Notes

### Database Schema

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  name VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(12) NOT NULL,    -- First 12 chars for identification
  key_hash VARCHAR(64) NOT NULL,      -- SHA-256 of full key
  scopes TEXT[] NOT NULL,
  rate_limit_tier VARCHAR(20) DEFAULT 'free',
  last_used_at TIMESTAMPTZ,
  last_used_ip VARCHAR(45),
  expires_at TIMESTAMPTZ,
  revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id, revoked);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
```

### API Key Scopes

```typescript
type ApiKeyScope =
  | 'agents:read'      // View agents
  | 'agents:write'     // Create/update agents
  | 'marketplace:read' // Browse marketplace
  | 'marketplace:write'// Acquire agents
  | 'council:read'     // View decisions
  | 'webhooks:manage'; // Manage webhooks

// Scope presets
const SCOPE_PRESETS = {
  readonly: ['agents:read', 'marketplace:read', 'council:read'],
  standard: ['agents:read', 'agents:write', 'marketplace:read', 'marketplace:write', 'council:read'],
  full: ['agents:read', 'agents:write', 'marketplace:read', 'marketplace:write', 'council:read', 'webhooks:manage']
};
```

### Key Generation

```typescript
function generateApiKey(): { key: string; prefix: string; hash: string } {
  const environment = process.env.NODE_ENV === 'production' ? 'live' : 'test';
  const randomBytes = crypto.randomBytes(24).toString('base64url');
  const key = `sk_${environment}_${randomBytes}`;
  const prefix = key.substring(0, 12);
  const hash = crypto.createHash('sha256').update(key).digest('hex');

  return { key, prefix, hash };
}
```

### Authentication Middleware

```typescript
// lib/api/auth.ts
async function authenticateApiKey(request: Request): Promise<ApiKeyContext | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer sk_')) return null;

  const key = authHeader.substring(7);
  const prefix = key.substring(0, 12);
  const hash = crypto.createHash('sha256').update(key).digest('hex');

  const apiKey = await db.query.apiKeys.findFirst({
    where: and(
      eq(apiKeys.keyPrefix, prefix),
      eq(apiKeys.keyHash, hash),
      eq(apiKeys.revoked, false)
    )
  });

  if (!apiKey) return null;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

  // Update last used
  await updateLastUsed(apiKey.id, request);

  return {
    userId: apiKey.userId,
    scopes: apiKey.scopes,
    rateLimitTier: apiKey.rateLimitTier
  };
}
```

### Files to Create/Modify

- `lib/db/schema/api-keys.ts` - Schema
- `lib/api/key-service.ts` - Key management
- `lib/api/auth.ts` - Authentication middleware
- `app/(dashboard)/settings/api-keys/page.tsx` - Key management UI
- `components/settings/ApiKeyForm.tsx` - Create key form
- `components/settings/ApiKeyList.tsx` - List keys
- `app/api/users/api-keys/route.ts` - Key management API

---

## Dependencies

- Story 8-1: RESTful API (uses authentication)
- User authentication system

---

## Out of Scope

- OAuth2 flows
- API key analytics dashboard
- Team/organization keys
