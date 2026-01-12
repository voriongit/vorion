---
sidebar_position: 7
title: AgentAnchor
description: The certification authority for AI agents
---

# AgentAnchor

## The Certification Authority for AI Agents

**Trust scores. Certification. Registry. The UL Listing for AI.**

[Platform](https://agentanchor.ai) · [Registry](https://agentanchor.ai/registry) · [API](https://agentanchor.ai/api)

---

## What is AgentAnchor?

AgentAnchor is the certification platform for BASIS-compliant AI agents:

- **Trust Scores** — Quantified trustworthiness (0-1000)
- **Certification** — Third-party validation of compliance
- **Registry** — Public directory of certified agents
- **Staking** — Economic skin-in-the-game

---

## Trust Scores

Every agent gets a dynamic trust score (0-1000) based on:

| Component | Weight | What It Measures |
|-----------|--------|------------------|
| **Compliance** | 25% | BASIS standard adherence |
| **Performance** | 20% | Runtime reliability |
| **Reputation** | 15% | Community feedback |
| **Stake** | 15% | Economic commitment |
| **History** | 15% | Track record |
| **Verification** | 10% | Identity confirmation |

### Trust Tiers

| Tier | Score | Badge |
|------|-------|-------|
| 🔴 Unverified | 0-99 | — |
| 🟠 Provisional | 100-299 | Bronze |
| 🟡 Certified | 300-499 | Silver |
| 🟢 Trusted | 500-699 | Gold |
| 🔵 Verified | 700-899 | Platinum |
| 💎 Sovereign | 900-1000 | Diamond |

---

## Certification Levels

| Level | Requirements | Cost |
|-------|--------------|------|
| **Bronze** | Basic compliance | $99/mo |
| **Silver** | + Audit, 30-day history | $299/mo |
| **Gold** | + Extended audit, 90-day | $799/mo |
| **Platinum** | + Full audit, 180-day | $1,999/mo |

---

## For Developers

### Get Your Agent Certified

```
1. REGISTER   → Create account, submit manifest
2. STAKE      → Lock ANCR tokens
3. TEST       → Automated compliance testing
4. CERTIFY    → Review and certification
5. MONITOR    → Ongoing compliance
```

### SDK Integration

```typescript
import { AgentAnchor } from '@agentanchor/sdk';

const anchor = new AgentAnchor({
  apiKey: process.env.AGENTANCHOR_API_KEY
});

// Get trust score
const trust = await anchor.trust.getScore('ag_your_agent');
console.log(`Trust: ${trust.composite} (${trust.tier})`);

// Check capability
const check = await anchor.capabilities.check(
  'ag_your_agent',
  'communication/send_external'
);
```

---

## For Enterprises

### Discover Certified Agents

Browse the public registry:
- Filter by category, trust score, certification level
- Verify before you trust
- Access audit trails

### Verify an Agent

```bash
curl https://api.agentanchor.ai/v1/verify/ag_vendor_agent

{
  "valid": true,
  "trustScore": 687,
  "certification": "gold",
  "lastAudit": "2026-01-02"
}
```

---

## Token Economy

### ANCR (Anchor Token)
- **Purpose**: Governance, staking
- **Use**: Stake to certify, vote on protocol

### TRST (Trust Token)  
- **Purpose**: Utility, API fees
- **Use**: Pay for services, earn rewards

### Staking Requirements

| Certification | Stake | Lock Period |
|---------------|-------|-------------|
| Bronze | 1,000 ANCR | 30 days |
| Silver | 5,000 ANCR | 60 days |
| Gold | 25,000 ANCR | 90 days |
| Platinum | 100,000 ANCR | 180 days |

---

## API Overview

```yaml
# Agents
POST /v1/agents              # Register
GET  /v1/agents/{id}         # Details

# Trust
GET  /v1/trust/score/{id}    # Current score
GET  /v1/trust/history/{id}  # History

# Certification
POST /v1/certifications      # Apply
GET  /v1/certifications/{id} # Status

# Registry (Public)
GET  /v1/registry/agents     # Browse
GET  /v1/verify/{id}         # Verify
```

---

## Get Started

- **Developers**: [agentanchor.ai/register](https://agentanchor.ai/register)
- **Enterprises**: [agentanchor.ai/demo](https://agentanchor.ai/demo)
- **Documentation**: [agentanchor.ai/docs](https://agentanchor.ai/docs)

---

*AgentAnchor is built on BASIS and powered by Cognigate.*
