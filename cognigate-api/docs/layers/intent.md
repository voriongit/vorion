# INTENT Layer

## Understanding What Agents Want to Do

**The first layer of BASIS governance — before enforcement, before logging, understand the intent.**

---

## What is INTENT?

The INTENT layer is responsible for:

1. **Parsing** — What action is the agent attempting?
2. **Planning** — What steps are required?
3. **Risk Surfacing** — What could go wrong?
4. **Structuring** — Format for downstream processing

```
┌─────────────────────────────────────────────────────────────┐
│                        INTENT LAYER                         │
└─────────────────────────────────────────────────────────────┘

     ┌─────────────────┐
     │  Agent Request  │
     │  "Send email    │
     │   to client"    │
     └────────┬────────┘
              │
              ▼
     ┌─────────────────┐
     │     PARSE       │──▶ Action: send_email
     │                 │    Target: external
     │                 │    Data: client_contact
     └────────┬────────┘
              │
              ▼
     ┌─────────────────┐
     │      PLAN       │──▶ Step 1: Lookup client
     │                 │    Step 2: Compose email
     │                 │    Step 3: Send via SMTP
     └────────┬────────┘
              │
              ▼
     ┌─────────────────┐
     │  RISK SURFACE   │──▶ Risk: MEDIUM
     │                 │    - External communication
     │                 │    - Contains client data
     │                 │    - Irreversible
     └────────┬────────┘
              │
              ▼
     ┌─────────────────────────────────────────────────────┐
     │                  STRUCTURED INTENT                  │
     │                                                     │
     │  {                                                  │
     │    "intentId": "int_abc123",                       │
     │    "action": "send_email",                         │
     │    "plan": [...],                                  │
     │    "risk": "medium",                               │
     │    "capabilities_required": [                      │
     │      "communication/send_external",                │
     │      "data/read_user"                              │
     │    ]                                               │
     │  }                                                 │
     │                                                     │
     └─────────────────────────────────────────────────────┘
              │
              │ Passes to ENFORCE layer
              ▼
```

---

## Why INTENT First?

You can't enforce what you don't understand.

| Without INTENT | With INTENT |
|----------------|-------------|
| "Agent did something" | "Agent attempted send_email to external recipient" |
| Binary allow/deny | Risk-appropriate response |
| Black box decisions | Explainable governance |
| Post-hoc auditing | Pre-execution understanding |

---

## INTENT Output Schema

```typescript
interface Intent {
  // Identification
  intentId: string;
  agentId: string;
  sessionId: string;
  timestamp: ISO8601;
  
  // What
  action: string;
  parameters: Record<string, any>;
  
  // Plan
  plan: {
    steps: Step[];
    estimatedDuration: number;
    reversible: boolean;
  };
  
  // Risk Assessment
  risk: {
    level: "minimal" | "limited" | "significant" | "high";
    factors: string[];
    mitigations: string[];
  };
  
  // Requirements
  capabilities: string[];
  resources: string[];
  
  // Context
  context: {
    userId?: string;
    triggeredBy: "user" | "schedule" | "agent" | "system";
    metadata: Record<string, any>;
  };
}
```

---

## Risk Classification

INTENT is responsible for initial risk assessment:

### Minimal Risk
- Read-only operations
- Public data access
- Internal computations
- No external effects

### Limited Risk
- User data read/write (scoped)
- Internal communications
- Reversible operations

### Significant Risk
- External communications
- Sensitive data access
- System modifications
- Multi-step operations

### High Risk
- Financial transactions
- Bulk data operations
- Irreversible actions
- Permission changes

---

## Capability Detection

INTENT identifies what capabilities are needed:

```yaml
# Example: "Send weekly report to team"

detected_capabilities:
  - data/read_user        # Read report data
  - data/read_sensitive   # May contain metrics
  - communication/send_internal  # To team
  
# Example: "Send invoice to client"

detected_capabilities:
  - data/read_user        # Read invoice
  - financial/view_balance # Check amounts
  - communication/send_external  # To client
```

---

## API Endpoint

```
POST /v1/intent/evaluate
```

**Request:**
```json
{
  "agentId": "ag_7x8k2mN3p",
  "intent": {
    "action": "send_email",
    "parameters": {
      "to": "client@example.com",
      "subject": "Invoice #1234",
      "body": "..."
    }
  },
  "context": {
    "userId": "usr_abc123",
    "sessionId": "ses_def456"
  }
}
```

**Response:**
```json
{
  "intentId": "int_9h8g7f6e",
  "status": "evaluated",
  "plan": {
    "steps": [
      {"action": "validate_recipient", "risk": "low"},
      {"action": "compose_email", "risk": "low"},
      {"action": "send_email", "risk": "medium"}
    ]
  },
  "risk": {
    "level": "medium",
    "factors": [
      "external_communication",
      "contains_financial_data"
    ]
  },
  "capabilities": [
    "communication/send_external",
    "data/read_user"
  ],
  "nextStep": "enforce"
}
```

---

## Integration with ENFORCE

INTENT output flows directly to ENFORCE:

```
INTENT                          ENFORCE
──────                          ───────
intentId ─────────────────────▶ intentId
capabilities ─────────────────▶ Check trust score against requirements
risk.level ───────────────────▶ Determine approval path
plan.steps ───────────────────▶ Gate each step if needed
```

---

## Implementation Requirements

To be BASIS-compliant, INTENT layer MUST:

| Requirement | Description |
|-------------|-------------|
| **REQ-INT-001** | Generate unique intentId for every evaluation |
| **REQ-INT-002** | Identify all required capabilities |
| **REQ-INT-003** | Classify risk level (4 levels) |
| **REQ-INT-004** | Structure output per schema |
| **REQ-INT-005** | Complete evaluation in < 500ms |
| **REQ-INT-006** | Never execute actions (evaluation only) |

---

## Reference Implementation

The reference implementation uses LLM-based intent parsing with structured output:

```python
# Simplified example
async def evaluate_intent(request: IntentRequest) -> Intent:
    # 1. Parse the raw intent
    parsed = await parse_action(request.intent)
    
    # 2. Generate execution plan
    plan = await generate_plan(parsed)
    
    # 3. Assess risk
    risk = assess_risk(parsed, plan)
    
    # 4. Identify capabilities
    capabilities = extract_capabilities(parsed, plan)
    
    # 5. Structure output
    return Intent(
        intentId=generate_id(),
        agentId=request.agentId,
        action=parsed.action,
        plan=plan,
        risk=risk,
        capabilities=capabilities,
        context=request.context
    )
```

---

## Next Layer

Once INTENT has structured the request, it passes to [**ENFORCE**](/enforce) for trust verification and policy checking.

```
[INTENT] ──structured intent──▶ [ENFORCE]
```

---

## Resources

- [INTENT Specification](/spec/intent)
- [Reference Implementation](https://github.com/voriongit/cognigate/tree/main/intent)
- [API Reference](/api#intent)
- [Examples](/examples/intent)

---

*INTENT is Layer 1 of the BASIS governance stack.*
