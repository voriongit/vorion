---
sidebar_position: 1
title: INTENT Layer
description: Understanding what agents want to do
---

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
        STRUCTURED INTENT
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
  timestamp: string; // ISO8601
  
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

## Implementation Requirements

| Requirement | Description |
|-------------|-------------|
| **REQ-INT-001** | Generate unique intentId for every evaluation |
| **REQ-INT-002** | Identify all required capabilities |
| **REQ-INT-003** | Classify risk level (4 levels) |
| **REQ-INT-004** | Structure output per schema |
| **REQ-INT-005** | Complete evaluation in < 500ms |
| **REQ-INT-006** | Never execute actions (evaluation only) |

---

## Next Layer

Once INTENT has structured the request, it passes to [**ENFORCE**](/layers/enforce) for trust verification and policy checking.

```
[INTENT] ──structured intent──▶ [ENFORCE]
```
