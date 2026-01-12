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
     │    TRUST CHECK      │
     │                     │
     │  Agent: ag_7x8...   │
     │  Score: 687         │
     │  Tier: TRUSTED      │
     └──────────┬──────────┘
                │ ✓ Pass
                ▼
     ┌─────────────────────┐
     │  CAPABILITY CHECK   │
     │                     │
     │  Required:          │
     │  - send_external ✓  │
     │  - read_user ✓      │
     └──────────┬──────────┘
                │ ✓ Pass
                ▼
     ┌─────────────────────┐
     │    POLICY CHECK     │
     │                     │
     │  pol_email_limits ✓ │
     │  pol_data_access ✓  │
     │  pol_external ✓     │
     └──────────┬──────────┘
                │ ✓ Pass
                ▼
     ┌─────────────────────┐
     │     RATE CHECK      │
     │                     │
     │  Hourly: 45/100 ✓   │
     │  Daily: 120/500 ✓   │
     └──────────┬──────────┘
                │ ✓ Pass
                ▼
     ┌─────────────────────────────────────────────────────┐
     │                    DECISION                         │
     │                                                     │
     │              ╔═══════════════╗                      │
     │              ║    ALLOW      ║                      │
     │              ╚═══════════════╝                      │
     │                                                     │
     │  Gate ID: gate_5e6f7g8h                            │
     │  Trust Used: 687                                    │
     │  Capabilities Granted: [send_external, read_user]   │
     │                                                     │
     └─────────────────────────────────────────────────────┘
                │
                │ Passes to PROOF layer
                ▼
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

┌─────────────────────────────────────────────────────────────┐
│                   CAPABILITY MATRIX                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  UNLOCKED at 687:                                          │
│  ✅ data/read_public (100+)                                │
│  ✅ data/read_user (300+)                                  │
│  ✅ data/write_user (300+)                                 │
│  ✅ communication/send_internal (300+)                     │
│  ✅ communication/send_external (500+)                     │
│  ✅ execution/schedule (500+)                              │
│                                                             │
│  LOCKED (need higher trust):                               │
│  🔒 data/read_sensitive (700+)                             │
│  🔒 financial/approve_payment (700+)                       │
│  🔒 admin/manage_users (700+)                              │
│  🔒 execution/spawn_agent (900+)                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Trust Score Sources

Trust scores come from [AgentAnchor](/agentanchor) or your own trust computation:

```typescript
interface TrustScore {
  composite: number;      // 0-1000
  tier: TrustTier;
  components: {
    compliance: number;   // BASIS compliance
    performance: number;  // Runtime behavior
    reputation: number;   // Community signals
    stake: number;        // Economic commitment
    history: number;      // Track record
    verification: number; // Identity verification
  };
}
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
      
    - field: daily_count
      operator: lte
      value: 500
      
    - field: trust_score
      operator: gte
      value: 500
      
  on_violation: deny
```

```yaml
# Example Policy: Financial Thresholds
policy:
  id: pol_financial_limits
  description: "Gate financial actions by trust"
  
  applies_to:
    capabilities: [financial/initiate_payment]
    
  conditions:
    - field: amount
      operator: lte
      value_by_trust:
        500: 100       # $100 max at trust 500
        600: 1000      # $1,000 max at trust 600
        700: 10000     # $10,000 max at trust 700
        800: 100000    # $100,000 max at trust 800
        
  on_exceed: escalate
```

---

## Escalation

When ENFORCE can't auto-approve:

```
┌─────────────────────────────────────────────────────────────┐
│                     ESCALATION FLOW                         │
└─────────────────────────────────────────────────────────────┘

ENFORCE decides: ESCALATE
         │
         ▼
┌─────────────────────┐
│  Create Escalation  │
│                     │
│  ID: esc_2k3l4m5n   │
│  Reason: High-risk  │
│  Timeout: 1 hour    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Notify Approvers  │
│                     │
│  • Email            │
│  • Webhook          │
│  • Dashboard        │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
  APPROVED    DENIED/TIMEOUT
     │           │
     ▼           ▼
  PROCEED     BLOCK
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
  ],
  "context": {
    "action": "send_invoice_email",
    "resources": ["invoice_data", "email_system"],
    "metadata": {
      "recipientType": "external",
      "dataClassification": "financial"
    }
  }
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
    "requested": ["communication/send_external", "data/read_user"],
    "granted": ["communication/send_external", "data/read_user"],
    "denied": [],
    "reason": "All capabilities available at trust level 687"
  },
  "policyChecks": [
    {"policy": "pol_email_limits", "result": "pass"},
    {"policy": "pol_data_access", "result": "pass"}
  ],
  "escalation": null,
  "proofId": "prf_9h0i1j2k",
  "validUntil": "2026-01-08T16:42:00Z"
}
```

---

## The Four Checks

### 1. Trust Check
```python
def check_trust(agent_id: str, required_capabilities: list) -> TrustResult:
    score = get_trust_score(agent_id)
    
    for cap in required_capabilities:
        min_trust = CAPABILITY_THRESHOLDS[cap]
        if score.composite < min_trust:
            return TrustResult(
                passed=False,
                reason=f"Trust {score.composite} < {min_trust} for {cap}"
            )
    
    return TrustResult(passed=True, score=score)
```

### 2. Capability Check
```python
def check_capabilities(agent_id: str, requested: list) -> CapabilityResult:
    declared = get_agent_capabilities(agent_id)
    
    for cap in requested:
        if cap not in declared:
            return CapabilityResult(
                passed=False,
                reason=f"Capability {cap} not declared in manifest"
            )
    
    return CapabilityResult(passed=True, granted=requested)
```

### 3. Policy Check
```python
def check_policies(intent: Intent, context: dict) -> PolicyResult:
    applicable = get_applicable_policies(intent.capabilities)
    
    for policy in applicable:
        result = evaluate_policy(policy, intent, context)
        if not result.passed:
            return PolicyResult(
                passed=False,
                policy=policy.id,
                reason=result.reason
            )
    
    return PolicyResult(passed=True)
```

### 4. Rate Check
```python
def check_rate_limits(agent_id: str, action: str) -> RateResult:
    limits = get_rate_limits(agent_id, action)
    usage = get_current_usage(agent_id, action)
    
    if usage.hourly >= limits.hourly:
        return RateResult(passed=False, reason="Hourly limit exceeded")
    if usage.daily >= limits.daily:
        return RateResult(passed=False, reason="Daily limit exceeded")
    
    return RateResult(passed=True)
```

---

## Degraded Mode

Sometimes partial approval makes sense:

```json
{
  "decision": "DEGRADE",
  "capabilityStatus": {
    "requested": ["bulk_export", "send_external"],
    "granted": ["send_external"],
    "denied": ["bulk_export"],
    "reason": "bulk_export requires trust 700+, current: 687"
  },
  "restrictions": {
    "maxRecords": 100,
    "requiresReview": true
  }
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

## Integration

```
[INTENT]                    [ENFORCE]                    [PROOF]
    │                           │                           │
    │   Structured Intent       │                           │
    │──────────────────────────▶│                           │
    │                           │                           │
    │                           │   Gate Decision           │
    │                           │──────────────────────────▶│
    │                           │                           │
    │   Decision + Gate ID      │                           │
    │◀──────────────────────────│                           │
    │                           │                           │
```

---

## Next Layer

All ENFORCE decisions pass to [**PROOF**](/proof) for immutable logging.

```
[ENFORCE] ──gate decision──▶ [PROOF]
```

---

## Resources

- [ENFORCE Specification](/spec/enforce)
- [Reference Implementation](https://github.com/voriongit/cognigate/tree/main/enforce)
- [Policy Language Guide](/docs/policies)
- [Trust Score Integration](/docs/trust)
- [API Reference](/api#enforce)

---

*ENFORCE is Layer 2 of the BASIS governance stack.*
