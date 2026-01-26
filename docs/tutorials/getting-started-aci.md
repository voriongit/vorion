# Getting Started with ACI Trust Engine

This tutorial walks you through integrating the Vorion ACI (Agent Classification Identifier) Trust Engine into your AI agent system.

## Overview

The ACI Trust Engine provides production-grade governance for AI agents with:

- **Trust Tiers (T0-T5)**: Hierarchical trust levels from Sandbox to Sovereign
- **Role Gates**: Permission control based on agent trust level
- **Ceiling Enforcement**: Regulatory compliance limits
- **Gaming Detection**: Protection against trust manipulation
- **Provenance Tracking**: Agent lineage and creation history

## Prerequisites

- Node.js 20+ or Python 3.9+
- Access to a Vorion deployment (or local dev environment)
- API key (for production deployments)

## Installation

### TypeScript/JavaScript

```bash
npm install @vorion/aci-client
```

### Python

```bash
pip install vorion-aci
```

## Quick Start

### 1. Create a Client

**TypeScript:**
```typescript
import { createACIClient } from '@vorion/aci-client'

const client = createACIClient({
  baseUrl: 'https://api.vorion.dev',
  apiKey: process.env.ACI_API_KEY,
})
```

**Python:**
```python
from vorion_aci import ACIClient

client = ACIClient(
    base_url="https://api.vorion.dev",
    api_key=os.environ.get("ACI_API_KEY"),
)
```

### 2. Check Role Gate Before Operations

Before your agent performs a sensitive operation, check if the role is allowed:

**TypeScript:**
```typescript
import { AgentRole, TrustTier } from '@vorion/aci-client'

async function canPerformOperation(agentId: string, score: number) {
  const result = await client.evaluateRoleGate({
    agentId,
    requestedRole: 'R_L4', // Domain Expert
    currentTier: getTierFromScore(score),
    currentScore: score,
  })

  if (result.decision === 'ALLOW') {
    // Proceed with operation
    return true
  } else if (result.decision === 'ESCALATE') {
    // Request human approval
    await requestHumanApproval(agentId, result)
    return false
  } else {
    // Log denial and reject
    console.log(`Denied: ${result.reason}`)
    return false
  }
}
```

**Python:**
```python
from vorion_aci import RoleGateRequest, AgentRole, get_tier_from_score

async def can_perform_operation(agent_id: str, score: int) -> bool:
    result = await client.evaluate_role_gate(RoleGateRequest(
        agent_id=agent_id,
        requested_role=AgentRole.R_L4,
        current_tier=get_tier_from_score(score),
        current_score=score,
    ))

    if result.decision == "ALLOW":
        return True
    elif result.decision == "ESCALATE":
        await request_human_approval(agent_id, result)
        return False
    else:
        print(f"Denied: {result.reason}")
        return False
```

### 3. Apply Trust Ceiling

Before granting elevated permissions, check if a ceiling applies:

**TypeScript:**
```typescript
async function getEffectiveScore(agentId: string, rawScore: number) {
  const result = await client.checkCeiling({
    agentId,
    currentScore: rawScore,
  })

  if (result.ceilingApplied) {
    console.log(`Ceiling applied: ${result.ceilingSource}`)
    console.log(`Score reduced from ${rawScore} to ${result.effectiveScore}`)
  }

  return result.effectiveScore
}
```

### 4. Track Agent Provenance

When creating new agents, record their provenance:

**TypeScript:**
```typescript
async function createAgent(
  agentId: string,
  creationType: 'FRESH' | 'CLONED' | 'EVOLVED' | 'PROMOTED' | 'IMPORTED',
  parentAgentId?: string
) {
  const result = await client.createProvenance({
    agentId,
    creationType,
    parentAgentId,
  })

  console.log(`Agent created with score modifier: ${result.record.scoreModifier}`)
  // FRESH: 0, CLONED: -50, EVOLVED: +100, PROMOTED: +150, IMPORTED: -100

  return result.record
}
```

## Understanding Trust Tiers

| Tier | Name | Score Range | Description |
|------|------|-------------|-------------|
| T0 | Sandbox | 0-99 | New/untrusted agents, read-only access |
| T1 | Probation | 100-299 | Limited agents, basic task execution |
| T2 | Limited | 300-499 | Verified agents, workflow participation |
| T3 | Standard | 500-699 | Trusted agents, domain-level access |
| T4 | Trusted | 700-899 | High-trust agents, resource control |
| T5 | Sovereign | 900-1000 | Maximum trust, system administration |

## Understanding Agent Roles

| Role | Name | Min Tier | Capabilities |
|------|------|----------|--------------|
| R_L0 | Listener | T0 | Observe, receive data |
| R_L1 | Responder | T0 | Respond to queries |
| R_L2 | Task Executor | T1 | Execute assigned tasks |
| R_L3 | Workflow Manager | T2 | Coordinate multi-step workflows |
| R_L4 | Domain Expert | T3 | Make domain-specific decisions |
| R_L5 | Resource Controller | T4 | Manage external resources |
| R_L6 | System Administrator | T5 | Configure system settings |
| R_L7 | Trust Governor | T5 | Modify trust rules |
| R_L8 | Ecosystem Controller | T5 | Cross-system coordination |

## Compliance Frameworks

The ACI Trust Engine supports multiple compliance frameworks:

### EU AI Act
- Maximum trust score: 699 (T3 ceiling)
- High-risk AI systems cannot exceed T3
- Requires human oversight for elevated operations

### NIST AI RMF
- Maximum trust score: 899 (T4 ceiling)
- Governance emphasis with T4 limit
- Risk-based approach to trust elevation

### ISO 42001
- Maximum trust score: 799 (T4 ceiling)
- Quality management focus
- Balanced trust limits

## Handling Gaming Alerts

Monitor for trust manipulation attempts:

```typescript
// Check for active alerts
const alerts = await client.getAlerts({ status: 'ACTIVE' })

for (const alert of alerts) {
  if (alert.severity === 'CRITICAL') {
    // Take immediate action
    await suspendAgent(alert.agentId)
    await notifySecurityTeam(alert)
  }
}

// Resolve false positives
await client.updateAlertStatus({
  alertId: 'alert-123',
  status: 'FALSE_POSITIVE',
  resolvedBy: 'admin@example.com',
  resolutionNotes: 'Legitimate batch operation',
})
```

## Best Practices

### 1. Always Check Role Gates
Never skip role gate checks for sensitive operations. Even if you cache results, re-validate periodically.

### 2. Apply Ceilings Early
Check ceiling constraints at the start of trust-sensitive operations, not at the end.

### 3. Log All Decisions
Every role gate decision should be logged for audit purposes. The SDK does this automatically.

### 4. Handle Escalations Gracefully
When a decision returns `ESCALATE`, queue the operation for human review rather than rejecting outright.

### 5. Monitor Gaming Alerts
Set up alerting (PagerDuty, Slack) for CRITICAL and HIGH severity gaming alerts.

## Next Steps

- [API Reference](../api-reference.md)
- [Role Gate Deep Dive](./role-gates-advanced.md)
- [Compliance Configuration](./compliance-setup.md)
- [Gaming Detection Tuning](./gaming-detection.md)
