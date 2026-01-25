# Agent Registry API Specification

**ACI Agent Registry (ANS - Agent Naming Service)**  
**Version:** 1.0.0  
**Status:** Draft  
**Last Updated:** January 2026

---

## Abstract

The Agent Registry provides a discovery and query service for AI agents registered with the Agent Classification Identifier (ACI) system. It enables systems to find agents based on capability requirements.

---

## 1. Overview

### 1.1 Purpose

The Agent Registry serves three core functions:

1. **Registration:** Agents register their identity and capabilities
2. **Discovery:** Systems query for agents matching capability requirements
3. **Attestation:** Certification authorities issue and manage attestations

### 1.2 Base URL

```
https://registry.agentanchor.io/v1
```

---

## 2. Authentication

### 2.1 Organization Authentication

Organizations authenticate using OAuth 2.0 client credentials:

```http
POST /oauth/token HTTP/1.1
Host: auth.agentanchor.io
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&
client_id=org_vorion&
client_secret=<secret>&
scope=registry:write
```

### 2.2 Agent Authentication

Agents authenticate using DID Auth:

```http
POST /agents/vorion/banquet-advisor/actions HTTP/1.1
Host: registry.agentanchor.io
Authorization: DIDAuth <signed-challenge>
```

---

## 3. Endpoints

### 3.1 Agent Registration

#### Create Agent

```http
POST /agents HTTP/1.1
Host: registry.agentanchor.io
Authorization: Bearer <org-token>
Content-Type: application/json

{
  "organization": "vorion",
  "agentClass": "banquet-advisor",
  "capabilities": {
    "domains": ["F", "H", "C"],
    "level": 3,
    "skills": ["menu-planning", "cost-estimation", "guest-management"]
  },
  "publicKey": {
    "kty": "EC",
    "crv": "P-256",
    "x": "f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU",
    "y": "x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0"
  },
  "serviceEndpoint": "https://agents.vorion.org/banquet-advisor",
  "metadata": {
    "description": "AI assistant for banquet planning and catering operations",
    "version": "1.2.0"
  }
}
```

**Response:**

```json
{
  "aci": "a3i.vorion.banquet-advisor:FHC-L3-T1@1.2.0",
  "did": "did:aci:a3i:vorion:banquet-advisor",
  "created": "2026-01-24T12:00:00Z",
  "trustTier": 1
}
```

#### Get Agent

```http
GET /agents/{organization}/{agentClass} HTTP/1.1
Host: registry.agentanchor.io
```

**Response:**

```json
{
  "aci": "a3i.vorion.banquet-advisor:FHC-L3-T2@1.2.0",
  "did": "did:aci:a3i:vorion:banquet-advisor",
  "organization": "vorion",
  "agentClass": "banquet-advisor",
  "capabilities": {
    "domains": ["F", "H", "C"],
    "domainsBitmask": 164,
    "level": 3,
    "skills": ["menu-planning", "cost-estimation", "guest-management"]
  },
  "trustTier": 2,
  "serviceEndpoint": "https://agents.vorion.org/banquet-advisor",
  "attestations": [
    {
      "issuer": "did:web:agentanchor.io",
      "scope": "full",
      "issuedAt": "2025-12-01T00:00:00Z",
      "expiresAt": "2026-06-01T00:00:00Z"
    }
  ],
  "created": "2025-11-15T00:00:00Z",
  "updated": "2025-12-01T00:00:00Z"
}
```

#### Update Agent

```http
PATCH /agents/{organization}/{agentClass} HTTP/1.1
Host: registry.agentanchor.io
Authorization: Bearer <org-token>
Content-Type: application/json

{
  "capabilities": {
    "level": 4
  },
  "metadata": {
    "version": "1.3.0"
  }
}
```

#### Deactivate Agent

```http
DELETE /agents/{organization}/{agentClass} HTTP/1.1
Host: registry.agentanchor.io
Authorization: Bearer <org-token>
```

---

### 3.2 Agent Discovery

#### Query Agents

```http
POST /agents/query HTTP/1.1
Host: registry.agentanchor.io
Content-Type: application/json

{
  "domains": ["F", "H"],
  "minLevel": 3,
  "minTrust": 2,
  "skills": ["menu-planning"],
  "limit": 10,
  "offset": 0
}
```

**Response:**

```json
{
  "agents": [
    {
      "aci": "a3i.vorion.banquet-advisor:FHC-L3-T2@1.2.0",
      "did": "did:aci:a3i:vorion:banquet-advisor",
      "matchScore": 0.95,
      "capabilities": {
        "domains": ["F", "H", "C"],
        "level": 3
      },
      "trustTier": 2,
      "serviceEndpoint": "https://agents.vorion.org/banquet-advisor"
    },
    {
      "aci": "a3i.acme.event-planner:FHD-L4-T3@2.0.0",
      "did": "did:aci:a3i:acme:event-planner",
      "matchScore": 0.87,
      "capabilities": {
        "domains": ["F", "H", "D"],
        "level": 4
      },
      "trustTier": 3,
      "serviceEndpoint": "https://agents.acme.com/event-planner"
    }
  ],
  "total": 2,
  "limit": 10,
  "offset": 0
}
```

#### SQL-Like Query (Advanced)

```http
POST /agents/query/sql HTTP/1.1
Host: registry.agentanchor.io
Content-Type: application/json

{
  "query": "SELECT * FROM agents WHERE domains & 0x0A4 = 0x0A4 AND level >= 3 AND trust >= 2 ORDER BY trust DESC LIMIT 10"
}
```

---

### 3.3 DID Resolution

#### Resolve DID

```http
GET /did/{method-specific-id} HTTP/1.1
Host: registry.agentanchor.io
Accept: application/did+json
```

**Example:**

```http
GET /did/a3i/vorion/banquet-advisor HTTP/1.1
```

**Response:** Full DID Document (see DID Method Spec)

---

### 3.4 Attestations

#### Issue Attestation

```http
POST /attestations HTTP/1.1
Host: registry.agentanchor.io
Authorization: Bearer <ca-token>
Content-Type: application/json

{
  "subject": "did:aci:a3i:vorion:banquet-advisor",
  "scope": "full",
  "trustTier": 2,
  "validityDays": 180,
  "evidence": {
    "testResults": "https://testing.agentanchor.io/results/abc123",
    "auditReport": "https://audits.agentanchor.io/reports/def456"
  }
}
```

**Response:**

```json
{
  "id": "att_xyz789",
  "issuer": "did:web:agentanchor.io",
  "subject": "did:aci:a3i:vorion:banquet-advisor",
  "scope": "full",
  "trustTier": 2,
  "issuedAt": "2026-01-24T12:00:00Z",
  "expiresAt": "2026-07-23T12:00:00Z",
  "proof": {
    "type": "JsonWebSignature2020",
    "jws": "eyJhbGciOiJFUzI1NiJ9..."
  }
}
```

#### List Attestations

```http
GET /attestations?subject=did:aci:a3i:vorion:banquet-advisor HTTP/1.1
Host: registry.agentanchor.io
```

#### Revoke Attestation

```http
DELETE /attestations/{attestationId} HTTP/1.1
Host: registry.agentanchor.io
Authorization: Bearer <ca-token>
```

---

### 3.5 Revocation

#### Check Revocation Status

```http
GET /revocations/{did} HTTP/1.1
Host: registry.agentanchor.io
```

**Response:**

```json
{
  "did": "did:aci:a3i:vorion:banquet-advisor",
  "revoked": false,
  "attestationRevocations": []
}
```

#### Revocation List

```http
GET /revocations HTTP/1.1
Host: registry.agentanchor.io
Accept: application/json
```

#### 3.5.1 Recursive Revocation (REQUIRED)

When an agent in a delegation chain is revoked, all downstream agents MUST be notified and their derived capabilities invalidated.

**Revocation Propagation Rules:**

```
User → Agent A → Agent B → Agent C

If Agent A is revoked:
  1. Agent B's delegation from A is invalidated
  2. Agent C's delegation from B is invalidated (transitively)
  3. All active tokens derived from A's authority expire immediately
```

**Implementation:**

```http
POST /revocations/recursive HTTP/1.1
Host: registry.agentanchor.io
Authorization: Bearer <authority-token>
Content-Type: application/json

{
  "revokedDid": "did:aci:a3i:vorion:agent-a",
  "reason": "Compromised credentials",
  "propagationPolicy": {
    "terminateDescendants": true,
    "gracePeriodMs": 0,
    "notifyWebhooks": true
  }
}
```

**Response:**

```json
{
  "revocationId": "rev_abc123",
  "revokedDid": "did:aci:a3i:vorion:agent-a",
  "descendantsRevoked": [
    "did:aci:a3i:vorion:agent-b",
    "did:aci:a3i:vorion:agent-c"
  ],
  "tokensInvalidated": 47,
  "propagationComplete": true,
  "timestamp": "2026-01-24T12:00:00Z"
}
```

#### 3.5.2 Revocation SLA Requirements

| Trust Tier | Max Propagation Latency | Sync Check Required |
|------------|-------------------------|---------------------|
| T0-T1 | 60 seconds | No |
| T2-T3 | 10 seconds | For L3+ operations |
| T4-T5 | 1 second | Always |

For **high-value operations** (financial, PII, external API), relying parties MUST perform synchronous revocation checks regardless of trust tier.

---

### 3.6 Agent Registration with Commit-Reveal (Anti-Front-Running)

To prevent front-running attacks where adversaries monitor registration queues and claim namespaces before legitimate registrants, agent registration uses a commit-reveal scheme.

#### Phase 1: Commit

The registrant submits a hash of their registration data without revealing the content:

```http
POST /agents/commit HTTP/1.1
Host: registry.agentanchor.io
Authorization: Bearer <org-token>
Content-Type: application/json

{
  "commitmentHash": "sha256:<hash-of-salt-plus-registration>",
  "bondAmount": 100,
  "bondToken": "ACI",
  "expiresIn": 3600
}
```

**Response:**

```json
{
  "commitmentId": "commit_xyz789",
  "commitmentHash": "sha256:abc123...",
  "bondEscrowed": 100,
  "revealDeadline": "2026-01-24T13:00:00Z",
  "minRevealDelay": 30
}
```

#### Phase 2: Reveal (after minRevealDelay seconds)

```http
POST /agents/reveal HTTP/1.1
Host: registry.agentanchor.io
Authorization: Bearer <org-token>
Content-Type: application/json

{
  "commitmentId": "commit_xyz789",
  "salt": "random-256-bit-salt",
  "registration": {
    "organization": "vorion",
    "agentClass": "banquet-advisor",
    "capabilities": {
      "domains": ["F", "H", "C"],
      "level": 3
    },
    "publicKey": { ... }
  }
}
```

**Validation:**
1. Server computes `sha256(salt + JSON.stringify(registration))`
2. Compares with original `commitmentHash`
3. If match, registration proceeds; bond returned
4. If mismatch or timeout, bond is slashed

#### Front-Running Protection

- Commitment reveals no information about the agent being registered
- Minimum delay between commit and reveal prevents reactive attacks
- Bond slashing discourages spam commits

---

## 4. Webhooks

### 4.1 Event Types

| Event | Description |
|-------|-------------|
| `agent.created` | New agent registered |
| `agent.updated` | Agent capabilities changed |
| `agent.deactivated` | Agent deactivated |
| `attestation.issued` | New attestation issued |
| `attestation.revoked` | Attestation revoked |

### 4.2 Webhook Registration

```http
POST /webhooks HTTP/1.1
Host: registry.agentanchor.io
Authorization: Bearer <org-token>
Content-Type: application/json

{
  "url": "https://api.vorion.org/webhooks/aci",
  "events": ["agent.updated", "attestation.revoked"],
  "secret": "whsec_..."
}
```

---

## 5. Rate Limits

| Endpoint | Rate Limit |
|----------|------------|
| Query | 100/min |
| Registration | 10/min |
| DID Resolution | 1000/min |
| Attestation | 10/min |

---

## 6. Error Responses

```json
{
  "error": {
    "code": "AGENT_NOT_FOUND",
    "message": "Agent 'vorion/unknown-agent' not found",
    "details": {
      "organization": "vorion",
      "agentClass": "unknown-agent"
    }
  }
}
```

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AGENT_NOT_FOUND` | 404 | Agent does not exist |
| `INVALID_ACI` | 400 | ACI format invalid |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `RATE_LIMITED` | 429 | Too many requests |
| `ATTESTATION_EXPIRED` | 400 | Attestation has expired |

---

*Specification authored by AgentAnchor (A3I)*  
*License: Apache 2.0*
