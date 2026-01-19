# JWT Guidance for Intent API

## Requirements
- Tokens must include at minimum:
  - `tenantId`: string identifying tenant (UUID or slug).
  - `sub`: subject identifier (agent/user id).
  - Optional claims: `exp`, `iat`, `iss`, `aud`, role flags.
- Signed with the same secret configured via `VORION_JWT_SECRET`.
- Fastify JWT plugin expects standard Bearer tokens in `Authorization` header.

## Sample Payload
```json
{
  "tenantId": "tenant_123",
  "sub": "agent_456",
  "role": "service",
  "scope": ["intents:create", "intents:read"],
  "iat": 1736784000,
  "exp": 1736787600
}
```

## Generating Locally (Node.js)
```bash
node -e "const jwt=require('jsonwebtoken');const token=jwt.sign({tenantId:'tenant_123',sub:'agent_456'}, process.env.VORION_JWT_SECRET || 'development-secret-change-in-production-min-32-chars',{expiresIn:'1h'});console.log(token);"
```
Ensure `jsonwebtoken` dependency is available (install via `npm install jsonwebtoken`). Use the same secret as configured in `.env` or Docker compose.

## Usage in Requests
```
POST /api/v1/intents
Authorization: Bearer <token>
Content-Type: application/json
```

## Operational Checklist
1. Identity provider (IdP) or Vorion auth service must mint tokens with `tenantId` claim.
2. Rotate `VORION_JWT_SECRET` in production; use JWKS if moving to asymmetric keys (adjust Fastify JWT config accordingly).
3. Add scopes/roles for fine-grained access (`intents:read`, `intents:write`, `admin`).
4. Update partner onboarding docs to describe tenant claim requirements.
