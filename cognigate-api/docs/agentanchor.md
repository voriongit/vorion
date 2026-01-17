# AgentAnchor

## The Certification Authority for AI Agents

**Trust scores. Certification. Registry. The UL Listing for AI.**

[Get Certified](https://agentanchorai.com/register) · [Browse Registry](https://agentanchorai.com/registry) · [Documentation](https://agentanchorai.com/docs)

---

## What is AgentAnchor?

AgentAnchor is the certification platform for [BASIS](/basis)-compliant AI agents:

- **Trust Scores** — Quantified trustworthiness (0-1000)
- **Certification** — Third-party validation of compliance
- **Registry** — Public directory of certified agents
- **Staking** — Economic skin-in-the-game

```
┌─────────────────────────────────────────────────────────────┐
│                      AGENTANCHOR                            │
│               AI Agent Certification Platform               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   DEVELOPERS                        ENTERPRISES             │
│   ──────────                        ───────────             │
│   Register agents                   Discover agents         │
│   Get certified                     Verify compliance       │
│   Build trust                       Reduce risk             │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │                                                     │  │
│   │    [REGISTER] → [TEST] → [CERTIFY] → [MONITOR]    │  │
│   │                                                     │  │
│   │              TRUST SCORE: 687 🟢                   │  │
│   │              GOLD CERTIFIED ✓                       │  │
│   │                                                     │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

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

| Tier | Score | Badge | Unlocks |
|------|-------|-------|---------|
| 🔴 Unverified | 0-99 | — | Sandbox only |
| 🟠 Provisional | 100-299 | Bronze | Basic ops |
| 🟡 Certified | 300-499 | Silver | Standard ops |
| 🟢 Trusted | 500-699 | Gold | Extended ops |
| 🔵 Verified | 700-899 | Platinum | Privileged ops |
| 💎 Sovereign | 900-1000 | Diamond | Full autonomy |

---

## Certification Levels

| Level | Requirements | Cost | Benefits |
|-------|--------------|------|----------|
| **Bronze** | Basic compliance, min stake | $99/mo | Registry listing |
| **Silver** | + Audit, 30-day history | $299/mo | Standard capabilities |
| **Gold** | + Extended audit, 90-day | $799/mo | Extended capabilities |
| **Platinum** | + Full audit, 180-day | $1,999/mo | Privileged access, SLA |

---

## For Developers

### Get Your Agent Certified

```
1. REGISTER
   Create account, submit agent manifest
   
2. STAKE
   Lock ANCR tokens as commitment
   
3. TEST
   Automated compliance testing
   
4. CERTIFY
   Review and certification issued
   
5. MONITOR
   Ongoing compliance, trust score updates
```

### SDK Integration

```typescript
import { AgentAnchor } from '@agentanchor/sdk';

const anchor = new AgentAnchor({
  apiKey: process.env.AGENTANCHOR_API_KEY
});

// Get your agent's trust score
const trust = await anchor.trust.getScore('ag_your_agent');
console.log(`Trust: ${trust.composite} (${trust.tier})`);

// Check if action is allowed
const check = await anchor.capabilities.check(
  'ag_your_agent',
  'communication/send_external'
);

if (check.allowed) {
  // Proceed with action
}
```

### Dashboard Features

- Real-time trust score monitoring
- Compliance status and alerts
- Certification management
- Stake and token management
- Analytics and reports

---

## For Enterprises

### Discover Certified Agents

Browse the public registry of certified agents:

```
https://agentanchorai.com/registry
```

Filter by:
- Category (assistants, data processing, automation)
- Trust score (minimum threshold)
- Certification level
- Capabilities
- Jurisdiction

### Verify Before You Trust

```bash
# Verify an agent's certification
curl https://api.agentanchorai.com/v1/verify/ag_vendor_agent

{
  "valid": true,
  "agent": {
    "id": "ag_vendor_agent",
    "name": "Vendor Assistant Pro",
    "trustScore": 687,
    "certification": "gold",
    "lastAudit": "2026-01-02"
  },
  "verificationProof": "0x..."
}
```

### Enterprise Features

- Bulk agent verification API
- Compliance reports
- Audit trail access
- Custom policy templates
- SLA guarantees
- Dedicated support

---

## Token Economy

AgentAnchor uses a dual-token model:

### ANCR (Anchor Token)
- **Purpose**: Governance, staking, certification collateral
- **Use**: Stake to certify agents, vote on protocol changes
- **Supply**: Fixed 1B tokens

### TRST (Trust Token)
- **Purpose**: Utility, API fees, rewards
- **Use**: Pay for API calls, certifications, earn for good behavior
- **Supply**: Dynamic emission

### Staking Requirements

| Certification | Minimum Stake | Lock Period |
|---------------|---------------|-------------|
| Bronze | 1,000 ANCR | 30 days |
| Silver | 5,000 ANCR | 60 days |
| Gold | 25,000 ANCR | 90 days |
| Platinum | 100,000 ANCR | 180 days |

---

## API Overview

```yaml
# Agent Management
POST   /v1/agents              # Register agent
GET    /v1/agents/{id}         # Get agent details
PATCH  /v1/agents/{id}         # Update agent

# Trust Scores
GET    /v1/trust/score/{id}    # Current trust score
GET    /v1/trust/history/{id}  # Score history

# Certification
POST   /v1/certifications      # Apply for certification
GET    /v1/certifications/{id} # Certification status
POST   /v1/certifications/{id}/renew

# Registry (Public)
GET    /v1/registry/agents     # Browse certified agents
GET    /v1/registry/search     # Search agents
GET    /v1/verify/{id}         # Verify certification

# Tokens
GET    /v1/tokens/balance      # Token balances
POST   /v1/tokens/stake        # Stake for agent
POST   /v1/tokens/unstake      # Unstake tokens
```

[Full API Reference →](https://agentanchorai.com/api)

---

## Verification Badge

Embed certification status on your site:

```html
<!-- Certification Badge -->
<script src="https://agentanchorai.com/badge/ag_your_agent.js"></script>

<!-- Or static image -->
<img src="https://agentanchorai.com/badge/ag_your_agent.png" 
     alt="AgentAnchor Certified" />
```

Displays:
- Current trust score
- Certification level
- Last verification date
- Click to verify

---

## Compliance

AgentAnchor helps with regulatory compliance:

| Framework | Support |
|-----------|---------|
| EU AI Act | Risk classification mapping |
| NIST AI RMF | Control alignment |
| ISO 42001 | Certification evidence |
| SOC 2 | Audit trail support |

---

## Pricing

### Developer Plans

| Plan | Price | Agents | Features |
|------|-------|--------|----------|
| **Free** | $0/mo | 1 | Basic monitoring, sandbox |
| **Pro** | $49/mo | 5 | Full monitoring, Bronze cert included |
| **Team** | $199/mo | 20 | All features, Silver cert included |
| **Enterprise** | Custom | Unlimited | Custom, Platinum support |

### Certification Fees

Paid in TRST tokens:
- Bronze: 100 TRST
- Silver: 500 TRST
- Gold: 2,000 TRST
- Platinum: 10,000 TRST

---

## Get Started

### Developers
```bash
npm install @agentanchor/sdk
```
[Developer Guide →](https://agentanchorai.com/docs/developers)

### Enterprises
[Schedule Demo →](https://agentanchorai.com/demo)

### Community
[Join Discord →](https://discord.gg/basis-protocol)

---

## Links

- **Platform**: [agentanchorai.com](https://agentanchorai.com)
- **Registry**: [agentanchorai.com/registry](https://agentanchorai.com/registry)
- **Documentation**: [agentanchorai.com/docs](https://agentanchorai.com/docs)
- **API Reference**: [agentanchorai.com/api](https://agentanchorai.com/api)
- **Status**: [status.agentanchorai.com](https://status.agentanchorai.com)

---

*AgentAnchor is built on the [BASIS](/basis) standard and powered by [Cognigate](/cognigate).*

*Operated by [Vorion](https://vorion.org).*
