---
sidebar_position: 2
title: ENFORCE Layer
description: Trust verification and policy enforcement
---

# ENFORCE Layer

## The Gatekeeper — Trust Verification & Policy Enforcement

**Should this action be allowed? ENFORCE makes the call.**

---

## What is ENFORCE?

The ENFORCE layer is the decision point. It takes structured intent from the INTENT layer and determines:

1. **Trust Check** — Does the agent have sufficient trust score?
2. **Capability Check** — Are required capabilities unlocked?
3. **Policy Check** — Do policies allow this action?
4. **Rate Check** — Is the agent within limits?
5. **Decision** — ALLOW, DENY, ESCALATE, or DEGRADE

```
┌─────────────────────────────────────────────────────────────┐
│                       ENFORCE LAYER                         │
└─────────────────────────────────────────────────────────────┘

     ┌─────────────────────┐
     │  From INTENT Layer  │
     │  Structured Intent  │
     └──────────┬──────────┘
                │
                ▼
     ┌─────────────────────┐
     │    TRUST CHECK      │──▶ Score: 687, Tier: TRUSTED
     └──────────┬──────────┘
                │ ✓ Pass
                ▼
     ┌─────────────────────┐
     │  CAPABILITY CHECK   │──▶ Required caps available
     └──────────┬──────────┘
                │ ✓ Pass
                ▼
     ┌─────────────────────┐
     │    POLICY CHECK     │──▶ All policies satisfied
     └──────────┬──────────┘
                │ ✓ Pass
                ▼
     ┌─────────────────────┐
     │     RATE CHECK      │──▶ Within limits
     └──────────┬──────────┘
                │ ✓ Pass
                ▼
           ╔═══════════╗
           ║   ALLOW   ║
           ╚═══════════╝
```

---

## Decision Types

| Decision | Meaning | When Used |
|----------|---------|-----------|
| **ALLOW** | Full approval, proceed | All checks pass |
| **DENY** | Blocked, cannot proceed | Trust/policy failure |
| **ESCALATE** | Needs human approval | High-risk action |
| **DEGRADE** | Partial approval | Some capabilities denied |

---

## Trust Gating

The core innovation: **dynamic capability unlocking based on trust score**.

```
Trust Score: 687 (TRUSTED tier)

UNLOCKED at 687:
✅ data/read_public (100+)
✅ data/read_user (300+)
✅ data/write_user (300+)
✅ communication/send_internal (300+)
✅ communication/send_external (500+)
✅ execution/schedule (500+)

LOCKED (need higher trust):
🔒 data/read_sensitive (700+)
🔒 financial/approve_payment (700+)
🔒 admin/manage_users (700+)
🔒 execution/spawn_agent (900+)
```

---

## Policy Engine

Policies are declarative rules that govern behavior:

```yaml
# Example Policy: Email Rate Limits
policy:
  id: pol_email_limits
  description: "Limit external emails"
  
  applies_to:
    capabilities: [communication/send_external]
    
  conditions:
    - field: hourly_count
      operator: lte
      value: 100
      
    - field: trust_score
      operator: gte
      value: 500
      
  on_violation: deny
```

---

## API Endpoint

```
POST /v1/enforce/gate
```

**Request:**
```json
{
  "agentId": "ag_7x8k2mN3p",
  "intentId": "int_9h8g7f6e",
  "requestedCapabilities": [
    "communication/send_external",
    "data/read_user"
  ]
}
```

**Response:**
```json
{
  "decision": "ALLOW",
  "gateId": "gate_5e6f7g8h",
  "trustScore": {
    "composite": 687,
    "tier": "trusted"
  },
  "capabilityStatus": {
    "granted": ["communication/send_external", "data/read_user"],
    "denied": []
  },
  "proofId": "prf_9h0i1j2k"
}
```

---

## Implementation Requirements

| Requirement | Description |
|-------------|-------------|
| **REQ-ENF-001** | Complete all 4 checks before decision |
| **REQ-ENF-002** | Generate unique gateId for every decision |
| **REQ-ENF-003** | Decision latency < 100ms (p99) |
| **REQ-ENF-004** | Pass all data to PROOF layer |
| **REQ-ENF-005** | Support escalation with configurable timeout |
| **REQ-ENF-006** | Cache trust scores with TTL ≤ 60s |

---

## Next Layer

All ENFORCE decisions pass to [**PROOF**](/layers/proof) for immutable logging.

```
[ENFORCE] ──gate decision──▶ [PROOF]
```
