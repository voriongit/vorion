# OpenID Connect Claims Extension for ACI

**ACI Claims for OpenID Connect and JWT**  
**Version:** 1.0.0  
**Status:** Draft  
**Last Updated:** January 2026

---

## Abstract

This specification defines OpenID Connect claims for embedding Agent Classification Identifier (ACI) information in ID Tokens and Access Tokens. It enables capability-aware authorization in OAuth 2.0 / OpenID Connect flows.

---

## 1. Introduction

### 1.1 Purpose

When AI agents authenticate via OpenID Connect, relying parties need to know:

1. What the agent is certified to do
2. What autonomy level it operates at
3. Who certified it and when

Standard OIDC claims don't capture this. ACI claims fill the gap.

### 1.2 Use Cases

- **API Gateway:** Route requests based on agent capabilities
- **Authorization Server:** Issue scoped tokens based on ACI
- **Resource Server:** Enforce capability-based access control
- **Audit System:** Log agent capabilities for compliance

---

## 2. ACI Claims

### 2.1 Claim Definitions

| Claim | Type | Description |
|-------|------|-------------|
| `aci` | string | Full ACI string |
| `aci_domains` | integer | Domain bitmask |
| `aci_domains_list` | string[] | Domain codes array |
| `aci_skills` | string | Base64-encoded skill bitmask |
| `aci_level` | integer | Capability level (0-5) |
| `aci_trust` | integer | Trust tier (0-5) |
| `aci_registry` | string | Certifying registry |
| `aci_org` | string | Operating organization |
| `aci_class` | string | Agent classification |
| `aci_version` | string | ACI version |
| `aci_did` | string | Agent's DID |
| `aci_attestations` | object[] | Attestation array |

### 2.2 Example Token Payload

```json
{
  "iss": "https://auth.agentanchor.io",
  "sub": "agent:vorion:banquet-advisor:prod001",
  "aud": "https://api.example.com",
  "exp": 1704067200,
  "iat": 1704063600,
  "jti": "abc123",
  
  "aci": "a3i.vorion.banquet-advisor:FHC-L3-T2@1.2.0",
  "aci_domains": 164,
  "aci_domains_list": ["F", "H", "C"],
  "aci_level": 3,
  "aci_trust": 2,
  "aci_registry": "a3i",
  "aci_org": "vorion",
  "aci_class": "banquet-advisor",
  "aci_version": "1.2.0",
  "aci_did": "did:aci:a3i:vorion:banquet-advisor",
  
  "aci_attestations": [
    {
      "iss": "did:web:agentanchor.io",
      "scope": "full",
      "iat": 1701388800,
      "exp": 1717200000,
      "evidence": "https://registry.agentanchor.io/attestations/abc123"
    }
  ]
}
```

---

## 3. Claim Details

### 3.0 Security Requirements (MANDATORY)

All ACI tokens MUST implement the following security controls:

#### 3.0.1 DPoP (Demonstrating Proof-of-Possession) - REQUIRED

All ACI Access Tokens MUST be sender-constrained using DPoP (RFC 9449). This prevents token theft and replay attacks.

```http
POST /resource HTTP/1.1
Host: api.example.com
Authorization: DPoP <access_token>
DPoP: <dpop_proof_jwt>
```

The DPoP proof MUST:
- Be bound to the agent's DID key
- Include a unique `jti` claim
- Include the `htm` (HTTP method) and `htu` (HTTP URI) claims
- Be valid for no more than 60 seconds

**Rationale:** Unlike human users, compromised agents may have their token storage breached. DPoP ensures stolen tokens cannot be used without the private key.

#### 3.0.2 Token Lifetime Constraints - REQUIRED

| Token Type | Maximum Lifetime | Rationale |
|------------|------------------|-----------|
| Access Token | 300 seconds (5 min) | Forces frequent refresh, enables revocation |
| Refresh Token | 86400 seconds (24 hr) | Balances usability with security |
| ID Token | 300 seconds (5 min) | Matches access token lifecycle |

For agents operating at **L3 (Execute) or higher**, access tokens SHOULD have a maximum lifetime of **60 seconds**.

#### 3.0.3 Token Introspection for High-Value Operations

For operations classified as high-value (financial transactions, PII access, external API calls), relying parties MUST perform synchronous token introspection rather than relying on cached validation:

```http
POST /introspect HTTP/1.1
Host: auth.agentanchor.io
Content-Type: application/x-www-form-urlencoded

token=<access_token>&token_type_hint=access_token
```

---

### 3.1 aci (Required)

The complete ACI string in canonical format.

```json
{
  "aci": "a3i.vorion.banquet-advisor:FHC-L3-T2@1.2.0"
}
```

**Validation:**
- Must match ACI regex pattern
- Must be issued by a trusted registry
- Token MUST be DPoP-bound

### 3.2 aci_domains (Required)

Integer bitmask encoding enabled domains.

```json
{
  "aci_domains": 164
}
```

**Bit positions:**
```
A=0x001, B=0x002, C=0x004, D=0x008, E=0x010
F=0x020, G=0x040, H=0x080, I=0x100, S=0x200
```

### 3.3 aci_domains_list (Required)

Array of domain code strings for human readability.

```json
{
  "aci_domains_list": ["F", "H", "C"]
}
```

### 3.4 aci_level (Required)

Capability level as integer 0-5.

```json
{
  "aci_level": 3
}
```

| Value | Meaning |
|-------|---------|
| 0 | Observe |
| 1 | Advise |
| 2 | Draft |
| 3 | Execute |
| 4 | Autonomous |
| 5 | Sovereign |

### 3.5 aci_trust (Required)

Trust tier as integer 0-5.

```json
{
  "aci_trust": 2
}
```

| Value | Meaning |
|-------|---------|
| 0 | Unverified |
| 1 | Registered |
| 2 | Tested |
| 3 | Certified |
| 4 | Verified |
| 5 | Sovereign |

### 3.6 aci_attestations (Optional)

Array of attestation objects from certifying authorities.

```json
{
  "aci_attestations": [
    {
      "iss": "did:web:agentanchor.io",
      "scope": "full",
      "iat": 1701388800,
      "exp": 1717200000,
      "evidence": "https://registry.agentanchor.io/attestations/abc123"
    }
  ]
}
```

---

## 4. Token Types

### 4.1 ID Token

ACI claims in ID Tokens provide agent identity information to the client:

```json
{
  "iss": "https://auth.agentanchor.io",
  "sub": "agent:vorion:banquet-advisor",
  "aci": "a3i.vorion.banquet-advisor:FHC-L3-T2@1.2.0",
  "aci_level": 3,
  "aci_trust": 2
}
```

### 4.2 Access Token

ACI claims in Access Tokens enable capability-based authorization:

```json
{
  "iss": "https://auth.agentanchor.io",
  "sub": "agent:vorion:banquet-advisor",
  "aci": "a3i.vorion.banquet-advisor:FHC-L3-T2@1.2.0",
  "aci_domains": 164,
  "aci_level": 3,
  "scope": "finance:read hospitality:write"
}
```

### 4.3 Refresh Token

Refresh tokens SHOULD NOT contain ACI claims (minimal payload).

---

## 5. Scopes

### 5.1 ACI-Based Scopes

ACI capabilities can map to OAuth scopes:

```
aci:F:L3  → Finance domain, Level 3
aci:H:L4  → Hospitality domain, Level 4
aci:*:L2  → All domains, Level 2
```

### 5.2 Scope Request

```http
GET /authorize?
  client_id=agent-client&
  scope=openid aci:F:L3 aci:H:L3&
  response_type=code
```

### 5.3 Scope Enforcement

The authorization server MUST verify:

1. Requested scopes don't exceed agent's certified capabilities
2. Requested level doesn't exceed agent's certified level
3. Agent's attestations are valid and not expired

---

## 6. Discovery

### 6.1 OpenID Provider Metadata

ACI-aware providers advertise support:

```json
{
  "issuer": "https://auth.agentanchor.io",
  "claims_supported": [
    "sub", "iss", "aud", "exp", "iat",
    "aci", "aci_domains", "aci_domains_list",
    "aci_level", "aci_trust", "aci_registry",
    "aci_org", "aci_class", "aci_version",
    "aci_did", "aci_attestations"
  ],
  "scopes_supported": [
    "openid", "profile",
    "aci:F:*", "aci:H:*", "aci:C:*", "aci:D:*"
  ]
}
```

---

## 7. Security Considerations

### 7.1 Claim Verification

Relying parties MUST:

1. Verify token signature
2. Validate `aci` format
3. Check `aci_attestations` expiry
4. Verify attestation signatures (if validating attestations)

### 7.2 Downgrade Prevention

Never trust client-asserted ACI claims. Always verify against:

- Token signature from trusted issuer
- Attestation chain to registry

### 7.3 Token Binding

For high-security scenarios, bind tokens to:

- TLS channel (token binding)
- DPoP proof
- Agent's key fingerprint

---

## 8. JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://aci.agentanchor.io/schema/aci-claims.json",
  "type": "object",
  "properties": {
    "aci": {
      "type": "string",
      "pattern": "^[a-z0-9]+\\.[a-z0-9-]+\\.[a-z0-9-]+:[A-Z]+-L[0-5]-T[0-5]@\\d+\\.\\d+\\.\\d+$"
    },
    "aci_domains": {
      "type": "integer",
      "minimum": 0
    },
    "aci_domains_list": {
      "type": "array",
      "items": { "type": "string", "pattern": "^[A-Z]$" }
    },
    "aci_level": {
      "type": "integer",
      "minimum": 0,
      "maximum": 5
    },
    "aci_trust": {
      "type": "integer",
      "minimum": 0,
      "maximum": 5
    },
    "aci_registry": { "type": "string" },
    "aci_org": { "type": "string" },
    "aci_class": { "type": "string" },
    "aci_version": { "type": "string" },
    "aci_did": { "type": "string" },
    "aci_attestations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["iss", "scope", "iat", "exp"],
        "properties": {
          "iss": { "type": "string" },
          "scope": { "type": "string" },
          "iat": { "type": "integer" },
          "exp": { "type": "integer" },
          "evidence": { "type": "string", "format": "uri" }
        }
      }
    }
  }
}
```

---

## 9. References

- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
- [OAuth 2.0 (RFC 6749)](https://tools.ietf.org/html/rfc6749)
- [JWT (RFC 7519)](https://tools.ietf.org/html/rfc7519)
- [ACI Core Specification](./aci-core.md)

---

*Specification authored by AgentAnchor (A3I)*  
*License: Apache 2.0*
