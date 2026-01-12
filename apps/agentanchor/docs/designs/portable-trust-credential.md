# Portable Trust Credential System

**Design Document**
**Date:** 2025-12-06
**Authors:** Sally (UX), Winston (Architect), Dr. Quinn (Innovation)

---

## Executive Summary

The Portable Trust Credential (PTC) system allows AgentAnchor-certified agents to carry their trust reputation **outside** the platform. Third-party systems can verify an agent's trust score, tier, and governance history without accessing AgentAnchor directly.

This creates:
1. **Network effect moat** - AgentAnchor becomes the trust authority
2. **Revenue opportunity** - Verification API fees
3. **Patent protection** - Novel portable AI certification

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     AgentAnchor Platform                        │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Trust Score │  │ Truth Chain  │  │ Credential Issuer      │ │
│  │   Engine    │──│   Records    │──│ (Signs Attestations)   │ │
│  └─────────────┘  └──────────────┘  └────────────────────────┘ │
│                                              │                  │
└──────────────────────────────────────────────│──────────────────┘
                                               │
                    ┌──────────────────────────▼──────────────────┐
                    │      Portable Trust Credential (PTC)        │
                    │  ┌────────────────────────────────────────┐ │
                    │  │ {                                      │ │
                    │  │   "agent_id": "aa_agent_xxx",          │ │
                    │  │   "trust_score": 742,                  │ │
                    │  │   "trust_tier": "Trusted",             │ │
                    │  │   "issued_at": "2025-12-06T...",       │ │
                    │  │   "expires_at": "2025-12-07T...",      │ │
                    │  │   "governance_summary": {...},         │ │
                    │  │   "truth_chain_anchor": "0xabc...",    │ │
                    │  │   "signature": "sig_xxx"               │ │
                    │  │ }                                      │ │
                    │  └────────────────────────────────────────┘ │
                    └─────────────────────────────────────────────┘
                                               │
              ┌────────────────────────────────┼────────────────────────────┐
              │                                │                            │
              ▼                                ▼                            ▼
    ┌─────────────────┐              ┌─────────────────┐          ┌─────────────────┐
    │ Third-Party App │              │ Enterprise CRM  │          │ AI Marketplace  │
    │ "Is this agent  │              │ "What tier is   │          │ "Show certified │
    │  trustworthy?"  │              │  this agent?"   │          │  agents only"   │
    └─────────────────┘              └─────────────────┘          └─────────────────┘
              │                                │                            │
              └────────────────────────────────┼────────────────────────────┘
                                               │
                                               ▼
                              ┌─────────────────────────────┐
                              │   AgentAnchor Verify API    │
                              │   GET /verify/credential    │
                              │   (Public, rate-limited)    │
                              └─────────────────────────────┘
```

---

## Credential Specification

### PTC Token Format (JWT-based)

```json
{
  "header": {
    "alg": "ES256",
    "typ": "PTC",
    "kid": "aa_key_2025_001"
  },
  "payload": {
    "iss": "https://agentanchorai.com",
    "sub": "aa_agent_7f8a9b2c",
    "iat": 1733468400,
    "exp": 1733554800,
    "nbf": 1733468400,

    "trust": {
      "score": 742,
      "tier": "Trusted",
      "tier_code": 5,
      "percentile": 89
    },

    "governance": {
      "total_decisions": 1247,
      "approval_rate": 0.94,
      "escalation_rate": 0.02,
      "last_council_review": "2025-12-05T14:30:00Z"
    },

    "certification": {
      "academy_graduated": true,
      "graduation_date": "2025-03-15",
      "specializations": ["customer-service", "data-analysis"],
      "mentor_certified": true
    },

    "provenance": {
      "truth_chain_hash": "0x7f8a9b2c4d5e6f...",
      "block_height": 847293,
      "trainer_id": "aa_trainer_xxx"
    }
  },
  "signature": "MEUCIQDx..."
}
```

### Trust Tiers in Credential

| Tier Code | Tier Name | Score Range | Badge Color | External Display |
|-----------|-----------|-------------|-------------|------------------|
| 0 | Untrusted | 0-99 | Red | "Uncertified" |
| 1 | Probation | 100-249 | Orange | "Probationary" |
| 2 | Developing | 250-499 | Yellow | "Developing" |
| 3 | Established | 500-749 | Blue | "Established" |
| 4 | Trusted | 750-899 | Emerald | "Trusted" |
| 5 | Legendary | 900-1000 | Gold | "Legendary" |

---

## Verification API

### Public Endpoint

```
GET https://api.agentanchorai.com/v1/verify/credential
```

**Headers:**
```
Authorization: Bearer <ptc_token>
```

**Response:**
```json
{
  "valid": true,
  "agent_id": "aa_agent_7f8a9b2c",
  "trust_score": 742,
  "trust_tier": "Trusted",
  "verification_timestamp": "2025-12-06T10:30:00Z",
  "truth_chain_verified": true,
  "warnings": [],
  "credential_expires_in": 82400
}
```

### Verification Checks

1. **Signature Valid** - Credential signed by AgentAnchor key
2. **Not Expired** - Current time within validity window
3. **Not Revoked** - Agent not suspended or archived
4. **Chain Anchored** - Truth Chain hash matches current state
5. **Score Current** - Trust score hasn't changed significantly (>50 points)

---

## Credential Lifecycle

```
┌──────────────────────────────────────────────────────────────────┐
│                     Credential Lifecycle                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. ISSUANCE                                                      │
│     Agent requests credential → System checks eligibility →       │
│     Signs credential → Returns PTC token                          │
│     (Minimum: Trust Score 250+, Academy Graduated)                │
│                                                                   │
│  2. USAGE                                                         │
│     Agent presents PTC to third-party → Third-party calls         │
│     verify API → Receives trust attestation                       │
│                                                                   │
│  3. REFRESH                                                       │
│     Credentials expire after 24 hours → Agent requests new        │
│     credential → Fresh trust data encoded                         │
│                                                                   │
│  4. REVOCATION                                                    │
│     If agent suspended/archived → Credential added to             │
│     revocation list → Verification fails immediately              │
│                                                                   │
│  5. UPGRADE                                                       │
│     If trust tier changes → Old credential still valid but        │
│     verification returns "stale" warning → Encourage refresh      │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Revenue Model

| Tier | Verification Calls | Monthly Price |
|------|-------------------|---------------|
| Free | 100/month | $0 |
| Starter | 10,000/month | $49 |
| Business | 100,000/month | $299 |
| Enterprise | Unlimited | Custom |

**Projections:**
- 100 third-party integrations × $299/mo = $29,900 MRR
- Enterprise deals: 10 × $2,000/mo = $20,000 MRR
- **Potential:** $50K+ MRR from verification alone

---

## Patent Claims (Draft)

### Claim Set for Portable Trust Credential

**Independent Claim 1:**
A system for portable AI agent trust certification comprising:
- a trust scoring engine calculating agent trustworthiness based on behavioral history;
- a credential issuer generating cryptographically signed attestations of said trust score;
- said attestations including governance summary, certification status, and immutable ledger reference;
- a verification service validating attestations for third-party systems;
- wherein attestations are portable across computing environments without platform dependency.

**Dependent Claims:**
- 2: wherein attestations expire after configurable time period requiring refresh
- 3: wherein attestations include specialization certifications from training programs
- 4: wherein verification service checks attestation against current trust state
- 5: wherein attestations reference immutable governance records on distributed ledger
- 6: wherein trust score in attestation is derived from Council validator decisions

---

## Implementation Phases

### Phase 1: Core Credential (Growth Epic)
- Credential issuance endpoint
- Basic verification API
- 24-hour expiring tokens

### Phase 2: Rich Attestations
- Governance summary inclusion
- Specialization badges
- Mentor certification chain

### Phase 3: Ecosystem
- SDK for third-party integration
- Verification widget embeddable
- Batch verification API

---

## Security Considerations

1. **Key Rotation** - Signing keys rotated quarterly
2. **Rate Limiting** - Prevent enumeration attacks
3. **Privacy** - Minimal data in credential, details via authenticated API
4. **Revocation** - CRL (Certificate Revocation List) checked on each verify

---

*"Your trust, verified everywhere."*
