# ACI Core Specification

**Agent Classification Identifier (ACI)**  
**Version:** 1.0.0  
**Status:** Draft  
**Last Updated:** January 2026

---

## Abstract

The Agent Classification Identifier (ACI) is a hierarchical identifier system for AI agents that encodes identity, capabilities, autonomy level, and certification status in a human-readable and machine-parseable format.

---

## 1. Introduction

### 1.1 Purpose

ACI addresses the need for a standardized way to:

1. **Identify** AI agents across organizational boundaries
2. **Classify** agent capabilities in a machine-queryable format
3. **Certify** agent trustworthiness through attestation chains
4. **Route** tasks to appropriate agents based on requirements

### 1.2 Scope

This specification defines:

- ACI string format and encoding
- Capability domain codes
- Autonomy levels
- Trust tiers
- Validation rules
- Integration with existing standards (DID, OpenID, OAuth)

---

## 2. ACI Format

### 2.1 Syntax

```
ACI = Identity ":" Capabilities "@" Version
Identity = Registry "." Organization "." AgentClass
Capabilities = Domains "-L" Level "-T" TrustTier
```

### 2.2 ABNF Grammar

```abnf
aci           = identity ":" capabilities "@" version
identity      = registry "." organization "." agent-class
capabilities  = domains "-L" level "-T" trust-tier

registry      = 1*ALPHA
organization  = 1*(ALPHA / DIGIT / "-")
agent-class   = 1*(ALPHA / DIGIT / "-")
domains       = 1*ALPHA
level         = DIGIT
trust-tier    = DIGIT
version       = 1*DIGIT "." 1*DIGIT "." 1*DIGIT
```

### 2.3 Examples

```
a3i.vorion.banquet-advisor:FHC-L3-T2@1.2.0
a3i.acme.support-agent:CD-L2-T3@1.0.0
a3i.example.data-processor:DI-L4-T4@2.1.0
```

### 2.4 Regular Expression

```regex
^[a-z0-9]+\.[a-z0-9-]+\.[a-z0-9-]+:[A-Z]+-L[0-5]-T[0-5]@\d+\.\d+\.\d+$
```

---

## 3. Identity Segment

### 3.1 Registry

The registry identifies the certification authority that issued the agent's credentials.

| Registry | Authority | Description |
|----------|-----------|-------------|
| `a3i` | AgentAnchor | Primary global registry |
| `eu-ai` | EU AI Office | European registry |
| `self` | Self-signed | No external certification |

### 3.2 Organization

The organization that operates the agent. Must be registered with the specified registry.

**Rules:**
- Lowercase alphanumeric and hyphens
- 2-63 characters
- Cannot start or end with hyphen

### 3.3 Agent Class

The functional classification of the agent within the organization.

**Rules:**
- Lowercase alphanumeric and hyphens
- 2-63 characters
- Should be descriptive of agent's purpose

---

## 4. Capability Domains

### 4.1 Domain Codes

| Code | Domain | Description | Examples |
|------|--------|-------------|----------|
| A | Administration | System administration, user management | User provisioning, access control |
| B | Business | Business logic, workflows | Order processing, approvals |
| C | Communications | Messaging, notifications | Email, SMS, chat |
| D | Data | Data processing, analytics | ETL, reporting, queries |
| E | External | Third-party integrations | API calls, webhooks |
| F | Finance | Financial operations | Payments, accounting, invoicing |
| G | Governance | Policy, compliance | Audit, compliance checks |
| H | Hospitality | Venue, events, catering | Booking, menu planning |
| I | Infrastructure | Compute, storage, network | Cloud resources, deployment |
| S | Security | Auth, encryption, audit | Authentication, key management |

### 4.2 Domain Encoding

Domains are encoded as a concatenated string of domain codes:

```
FHC = Finance + Hospitality + Communications
DI  = Data + Infrastructure
FHCDS = Finance + Hospitality + Communications + Data + Security
```

### 4.3 Domain Bitmask

For machine processing, domains can be encoded as a bitmask:

```typescript
const DOMAIN_BITS = {
  A: 0x001,  // Administration
  B: 0x002,  // Business
  C: 0x004,  // Communications
  D: 0x008,  // Data
  E: 0x010,  // External
  F: 0x020,  // Finance
  G: 0x040,  // Governance
  H: 0x080,  // Hospitality
  I: 0x100,  // Infrastructure
  S: 0x200,  // Security
};

// FHC = 0x020 | 0x080 | 0x004 = 0x0A4 = 164
```

---

## 5. Capability Levels

### 5.1 Level Definitions

| Level | Name | Human Involvement | Description |
|-------|------|-------------------|-------------|
| L0 | Observe | None required | Read-only access, monitoring |
| L1 | Advise | Review recommended | Can suggest actions, provide recommendations |
| L2 | Draft | Approval required | Can prepare changes, stage for review |
| L3 | Execute | Approval required | Can execute actions after human approval |
| L4 | Autonomous | Exception handling | Self-directed within defined bounds |
| L5 | Sovereign | Emergency only | Full autonomy, highest certification required |

### 5.2 Level Constraints

Levels are **monotonic within a session** — an agent can operate at or below its certified level but never above.

```typescript
// Agent certified at L3 can operate at L0, L1, L2, or L3
// Never L4 or L5
const effectiveLevel = Math.min(certifiedLevel, requestedLevel);
```

---

## 6. Trust Tiers

### 6.1 Tier Definitions

| Tier | Name | Certification | Description |
|------|------|---------------|-------------|
| T0 | Unverified | None | No external verification |
| T1 | Registered | Identity only | Organization identity verified |
| T2 | Tested | Capability tests | Passed automated capability tests |
| T3 | Certified | Third-party audit | Independent audit completed |
| T4 | Verified | Continuous monitoring | Ongoing behavioral verification |
| T5 | Sovereign | Highest assurance | Full certification + insurance |

### 6.2 Trust Score Mapping

Trust tiers map to numeric scores (0-1000):

| Tier | Score Range | Unlocks |
|------|-------------|---------|
| T0 | 0-99 | Sandbox only |
| T1 | 100-299 | Basic operations |
| T2 | 300-499 | Standard operations |
| T3 | 500-699 | Extended operations |
| T4 | 700-899 | Privileged operations |
| T5 | 900-1000 | Full capabilities |

---

## 7. Version

### 7.1 Semantic Versioning

ACI versions follow Semantic Versioning 2.0.0:

```
MAJOR.MINOR.PATCH
```

- **MAJOR:** Breaking changes to agent behavior
- **MINOR:** New capabilities (backward compatible)
- **PATCH:** Bug fixes, no capability changes

### 7.2 Version Compatibility

When querying for agents, version constraints can be specified:

```typescript
// Exact version
{ version: '1.2.0' }

// Range
{ version: '>=1.2.0 <2.0.0' }

// Latest minor
{ version: '^1.2.0' }
```

---

## 8. Validation

### 8.1 Validation Rules

1. **Format:** Must match ACI regex pattern
2. **Registry:** Must be a known registry
3. **Domains:** Must contain only valid domain codes
4. **Level:** Must be 0-5
5. **Trust:** Must be 0-5
6. **Version:** Must be valid semver

### 8.2 Validation Response

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  parsed?: ParsedACI;
}
```

---

## 9. Security Considerations

### 9.1 ACI String Integrity

ACI strings SHOULD be cryptographically signed when transmitted:

```json
{
  "aci": "a3i.vorion.banquet-advisor:FHC-L3-T2@1.2.0",
  "signature": "eyJhbGciOiJFUzI1NiJ9...",
  "issuer": "did:web:agentanchor.io"
}
```

### 9.2 Capability Escalation Prevention

Systems MUST enforce:

1. **Monotonic derivation:** Derived capabilities ≤ parent
2. **Trust ceiling:** Effective trust ≤ min(certified, user-allowed)
3. **Short-lived tokens:** Capability tokens expire in 5-15 minutes

### 9.3 Registry Trust

Only accept ACI strings from trusted registries. Maintain an allowlist:

```typescript
const TRUSTED_REGISTRIES = ['a3i', 'eu-ai'];
```

---

## 10. References

- [DID Core Specification](https://www.w3.org/TR/did-core/)
- [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html)
- [OAuth 2.0](https://tools.ietf.org/html/rfc6749)
- [Semantic Versioning](https://semver.org/)
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)

---

## Appendix A: JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://aci.agentanchor.io/schema/aci.json",
  "type": "object",
  "required": ["aci"],
  "properties": {
    "aci": {
      "type": "string",
      "pattern": "^[a-z0-9]+\\.[a-z0-9-]+\\.[a-z0-9-]+:[A-Z]+-L[0-5]-T[0-5]@\\d+\\.\\d+\\.\\d+$"
    },
    "domains": {
      "type": "integer",
      "minimum": 0
    },
    "level": {
      "type": "integer",
      "minimum": 0,
      "maximum": 5
    },
    "trustTier": {
      "type": "integer",
      "minimum": 0,
      "maximum": 5
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    }
  }
}
```

---

## Appendix B: TypeScript Types

```typescript
type DomainCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'S';

enum CapabilityLevel {
  L0_OBSERVE = 0,
  L1_ADVISE = 1,
  L2_DRAFT = 2,
  L3_EXECUTE = 3,
  L4_AUTONOMOUS = 4,
  L5_SOVEREIGN = 5,
}

enum TrustTier {
  T0_UNVERIFIED = 0,
  T1_REGISTERED = 1,
  T2_TESTED = 2,
  T3_CERTIFIED = 3,
  T4_VERIFIED = 4,
  T5_SOVEREIGN = 5,
}

interface ParsedACI {
  registry: string;
  organization: string;
  agentClass: string;
  domains: DomainCode[];
  level: CapabilityLevel;
  trustTier: TrustTier;
  version: string;
}
```

---

*Specification authored by AgentAnchor (A3I)*  
*License: Apache 2.0*
