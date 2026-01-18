---
sidebar_position: 7
title: AgentAnchor
description: Enterprise AI Agent Governance Platform
---

# AgentAnchor

## Enterprise AI Agent Governance Platform

**Deploy governed AI agents with trust scoring, policy enforcement, and complete auditability.**

[Platform](https://agentanchorai.com) · [Documentation](https://agentanchorai.com/docs) · [API](https://agentanchorai.com/api)

---

## What is AgentAnchor?

AgentAnchor is the enterprise platform for deploying and governing AI agents using the BASIS standard:

- **Trust Scoring** — Quantified trustworthiness (0-1000) with behavioral tracking
- **Policy Enforcement** — Real-time governance with capability gating
- **Audit Trails** — Immutable proof chains for every decision
- **Compliance Ready** — EU AI Act, ISO 42001, NIST AI RMF aligned

---

## Core Capabilities

### Trust Engine

Every agent gets a dynamic trust score (0-1000) based on:

| Component | Weight | What It Measures |
|-----------|--------|------------------|
| **Compliance** | 25% | BASIS standard adherence |
| **Performance** | 20% | Runtime reliability |
| **Reputation** | 15% | Organizational feedback |
| **History** | 15% | Track record |
| **Verification** | 10% | Identity confirmation |
| **Context** | 15% | Environmental factors |

### Trust Tiers

| Tier | Score | Capabilities |
|------|-------|--------------|
| Sandbox | [0, 100) | Isolated testing only |
| Provisional | [100, 300) | Read public data, internal messaging |
| Standard | [300, 500) | Limited external communication |
| Trusted | [500, 700) | External API calls |
| Certified | [700, 900) | Financial transactions |
| Autonomous | [900, 1000] | Full autonomy within policy bounds |

### Trust Decay

Inactive agents experience automatic trust decay:
- **Default:** 7-day half-life
- **Enterprise:** 14-day half-life (configurable)
- **Maintenance Mode:** Pauses decay during planned downtime

---

## Governance Architecture

AgentAnchor implements the BASIS four-layer governance model:

```
┌─────────────────────────────────────────────────────────────┐
│                    HUMAN LAYER                               │
│   Escalation for high-risk decisions                        │
└─────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────┐
│                    ENFORCE LAYER                             │
│   Policy evaluation against trust scores and constraints     │
│   Output: ALLOW, DENY, ESCALATE, or DEGRADE                 │
└─────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────┐
│                    INTENT LAYER                              │
│   Parse and classify agent action requests                   │
│   Risk classification and capability mapping                 │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    PROOF LAYER                               │
│   SHA-256 chained audit records for every decision          │
│   Ed25519 signatures for tamper detection                   │
└─────────────────────────────────────────────────────────────┘
```

---

## For Developers

### SDK Integration

```typescript
import { AgentAnchor } from '@agentanchor/sdk';

const anchor = new AgentAnchor({
  apiKey: process.env.AGENTANCHOR_API_KEY
});

// Register an agent
const agent = await anchor.agents.register({
  name: 'my-agent',
  capabilities: ['data/read_public', 'communication/internal']
});

// Check trust before action
const decision = await anchor.enforce.check({
  agentId: agent.id,
  action: 'communication/send_external',
  context: { recipient: 'partner@example.com' }
});

if (decision.action === 'allow') {
  // Execute action
} else if (decision.action === 'escalate') {
  // Request human approval
}
```

### Cognigate Integration

AgentAnchor uses [Cognigate](/cognigate) as its constrained execution runtime:

```typescript
import { createGateway } from '@vorion/atsf-core/cognigate';

const gateway = createGateway({
  maxMemoryMb: 512,
  timeoutMs: 30000
});

// Execute within resource limits
const result = await gateway.execute({
  intent,
  decision,
  resourceLimits: { maxMemoryMb: 256 }
});
```

---

## For Enterprises

### Deploy Governed Agents

1. **Register** — Define agents with capability manifests
2. **Configure** — Set trust thresholds and policies
3. **Deploy** — Run agents through AgentAnchor governance
4. **Monitor** — Real-time dashboards and alerts
5. **Audit** — Complete proof chains for compliance

### Compliance Features

| Requirement | AgentAnchor Capability |
|-------------|------------------------|
| EU AI Act Article 19 | Immutable audit trails, 6+ month retention |
| ISO 42001 | AI management system integration |
| NIST AI RMF | Risk management, measurement, governance |
| SOC 2 Type II | Security controls, access logging |

### API Verification

```bash
curl https://api.agentanchorai.com/v1/verify/ag_vendor_agent

{
  "valid": true,
  "trustScore": 687,
  "tier": "trusted",
  "lastAction": "2026-01-18T10:30:00Z",
  "complianceStatus": "active"
}
```

---

## Pricing

| Plan | Agents | Features | Price |
|------|--------|----------|-------|
| **Starter** | Up to 5 | Trust scoring, basic audit | $299/mo |
| **Professional** | Up to 25 | + Policy engine, API access | $999/mo |
| **Enterprise** | Unlimited | + SSO, SLA, dedicated support | Custom |

---

## API Overview

```yaml
# Agents
POST /v1/agents              # Register agent
GET  /v1/agents/{id}         # Get agent details
PUT  /v1/agents/{id}         # Update agent

# Trust
GET  /v1/trust/score/{id}    # Current score
GET  /v1/trust/history/{id}  # Score history
POST /v1/trust/signal        # Report behavioral signal

# Governance
POST /v1/enforce/check       # Check action permission
POST /v1/escalate            # Request human approval
GET  /v1/decisions/{id}      # Get decision details

# Audit
GET  /v1/proof/{id}          # Get proof record
GET  /v1/proof/chain/{id}    # Verify chain integrity
GET  /v1/audit/export        # Export audit logs
```

---

## Get Started

- **Free Trial**: [agentanchorai.com/trial](https://agentanchorai.com/trial)
- **Documentation**: [agentanchorai.com/docs](https://agentanchorai.com/docs)
- **API Reference**: [agentanchorai.com/api](https://agentanchorai.com/api)
- **Enterprise Demo**: [agentanchorai.com/demo](https://agentanchorai.com/demo)

---

*AgentAnchor is built on the [BASIS](/spec/overview) standard and powered by [Cognigate](/cognigate).*
