# AgentAnchor B2B Conversion Plan

**Date:** January 18, 2026
**Status:** Planning
**Goal:** Convert AgentAnchor from marketplace/consumer model to enterprise B2B AI governance platform

---

## Executive Summary

AgentAnchor will be repositioned as the **operational platform** for the Vorion AI governance ecosystem:

- **BASIS** = The open standard (what)
- **Cognigate** = The execution runtime (how)
- **AgentAnchor** = The enterprise platform (where)

---

## Current State Analysis

### What Exists

| Component | Status | Keep/Modify/Remove |
|-----------|--------|-------------------|
| Trust Score System | Working | **KEEP** - Core differentiator |
| Dashboard UI | Scaffolded | **MODIFY** - Simplify for B2B |
| Agent Management | Partial | **KEEP** - Enhance |
| Marketplace | Scaffolded | **REMOVE** - Not B2B |
| Token Economy | Documented | **REMOVE** - Not B2B |
| Council/Validators | Scaffolded | **SIMPLIFY** - Single-tenant first |
| Truth Chain | Partial | **KEEP** - Map to PROOF |
| Observer | Scaffolded | **KEEP** - Monitoring |
| Academy/Certification | Scaffolded | **DEFER** - Post-MVP |
| Staking | Planned | **REMOVE** - Not B2B |

### Current App Routes

```
/dashboard          → KEEP - Main dashboard
/agents             → KEEP - Agent management
/agents/[id]        → KEEP - Agent details
/agents/[id]/trust  → KEEP - Trust scoring
/trust              → KEEP - Trust overview
/compliance         → KEEP - Compliance dashboard
/escalations        → KEEP - Human escalation queue
/sandbox            → KEEP - Agent testing
/observer           → KEEP - Real-time monitoring
/truth-chain        → RENAME → /audit
/settings           → KEEP - Configuration

/marketplace        → REMOVE
/storefront         → REMOVE
/portfolio          → REMOVE
/earnings           → REMOVE
/council            → SIMPLIFY → /governance
/tribunal           → REMOVE
/academy            → DEFER
/shadow-training    → DEFER
/collaboration      → DEFER
/mcp                → EVALUATE
```

---

## B2B Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     AGENTANCHOR PLATFORM                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   AGENTS    │  │    TRUST    │  │   POLICIES  │              │
│  │  Registry   │  │   Engine    │  │   Engine    │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                       │
│         └────────────────┼────────────────┘                       │
│                          │                                         │
│  ┌───────────────────────┴───────────────────────┐               │
│  │              GOVERNANCE LAYER                  │               │
│  │   INTENT → ENFORCE → PROOF (via atsf-core)    │               │
│  └───────────────────────┬───────────────────────┘               │
│                          │                                         │
│  ┌───────────────────────┴───────────────────────┐               │
│  │              COGNIGATE RUNTIME                 │               │
│  │   Constrained execution with resource limits   │               │
│  └───────────────────────────────────────────────┘               │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│  DASHBOARDS: Agents | Trust | Policies | Audit | Escalations     │
└─────────────────────────────────────────────────────────────────┘
```

### Integration with atsf-core

AgentAnchor becomes the UI/API layer on top of `@vorion/atsf-core`:

```typescript
// AgentAnchor uses atsf-core components
import {
  createIntentProcessor,  // INTENT layer
  createEnforcer,         // ENFORCE layer
  createProofSystem,      // PROOF layer
  createTrustEngine,      // Trust scoring
  createGateway           // Cognigate runtime
} from '@vorion/atsf-core';

// AgentAnchor adds:
// - Multi-tenant management
// - Web dashboard
// - REST/GraphQL API
// - Persistent storage
// - User authentication
// - Reporting/analytics
```

---

## MVP Feature Set

### Must Have (Phase 1)

| Feature | Description | atsf-core Component |
|---------|-------------|---------------------|
| **Agent Registry** | Register, configure, manage agents | - |
| **Trust Dashboard** | View scores, history, signals | TrustEngine |
| **Policy Editor** | Define governance rules | BASIS Evaluator |
| **Action Logs** | View all agent decisions | PROOF System |
| **Escalation Queue** | Review ESCALATE decisions | ENFORCE |
| **API Access** | REST API for integration | All |

### Should Have (Phase 2)

| Feature | Description |
|---------|-------------|
| **Policy Templates** | Pre-built governance policies |
| **Compliance Reports** | EU AI Act, ISO 42001 reports |
| **Team Management** | Multi-user with RBAC |
| **Webhooks** | Event notifications |
| **SDK** | TypeScript/Python SDKs |

### Could Have (Phase 3)

| Feature | Description |
|---------|-------------|
| **SSO/SAML** | Enterprise identity |
| **Custom Integrations** | LangChain, CrewAI, etc. |
| **Multi-region** | Data residency |
| **White-label** | Custom branding |

---

## Database Schema Changes

### Keep

```sql
-- Agents
CREATE TABLE agents (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  capabilities JSONB,
  trust_score INTEGER DEFAULT 0,
  trust_tier VARCHAR(50) DEFAULT 'sandbox',
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Trust Signals
CREATE TABLE trust_signals (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES agents(id),
  signal_type VARCHAR(100) NOT NULL,
  impact INTEGER NOT NULL,
  context JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Decisions (Audit Log)
CREATE TABLE decisions (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES agents(id),
  intent_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL, -- allow, deny, escalate, degrade
  constraints JSONB,
  proof_hash VARCHAR(64),
  chain_hash VARCHAR(64),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Escalations
CREATE TABLE escalations (
  id UUID PRIMARY KEY,
  decision_id UUID REFERENCES decisions(id),
  status VARCHAR(50) DEFAULT 'pending',
  resolved_by UUID,
  resolution VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);
```

### Remove

```sql
-- Remove marketplace tables
DROP TABLE IF EXISTS listings;
DROP TABLE IF EXISTS acquisitions;
DROP TABLE IF EXISTS commissions;
DROP TABLE IF EXISTS earnings;

-- Remove token tables
DROP TABLE IF EXISTS stakes;
DROP TABLE IF EXISTS tokens;
DROP TABLE IF EXISTS rewards;

-- Remove council tables (simplify)
DROP TABLE IF EXISTS validators;
DROP TABLE IF EXISTS votes;
DROP TABLE IF EXISTS precedents;
```

---

## API Design

### Core Endpoints

```yaml
# Authentication
POST /api/v1/auth/token          # Get API token

# Agents
GET    /api/v1/agents            # List agents
POST   /api/v1/agents            # Register agent
GET    /api/v1/agents/:id        # Get agent
PUT    /api/v1/agents/:id        # Update agent
DELETE /api/v1/agents/:id        # Deactivate agent

# Trust
GET    /api/v1/agents/:id/trust           # Get trust score
GET    /api/v1/agents/:id/trust/history   # Score history
POST   /api/v1/agents/:id/trust/signal    # Report signal

# Governance
POST   /api/v1/enforce/check     # Check action permission
POST   /api/v1/enforce/execute   # Execute with governance
GET    /api/v1/decisions         # List decisions
GET    /api/v1/decisions/:id     # Get decision

# Escalations
GET    /api/v1/escalations       # List pending escalations
POST   /api/v1/escalations/:id/resolve  # Resolve escalation

# Policies
GET    /api/v1/policies          # List policies
POST   /api/v1/policies          # Create policy
PUT    /api/v1/policies/:id      # Update policy

# Audit
GET    /api/v1/audit/logs        # Get audit logs
GET    /api/v1/audit/export      # Export for compliance
GET    /api/v1/proof/:id         # Verify proof
```

---

## UI Simplification

### New Navigation

```
AgentAnchor
├── Dashboard (overview, key metrics)
├── Agents
│   ├── List (all agents)
│   ├── [id] (agent details)
│   └── New (register agent)
├── Trust
│   ├── Scores (all agent scores)
│   └── Signals (recent signals)
├── Governance
│   ├── Policies (rule definitions)
│   ├── Decisions (action log)
│   └── Escalations (pending reviews)
├── Audit
│   ├── Logs (full audit trail)
│   ├── Reports (compliance exports)
│   └── Verify (proof verification)
└── Settings
    ├── API Keys
    ├── Team
    ├── Webhooks
    └── Billing
```

### Component Reuse

Keep existing shadcn/ui components:
- DataTable for agent lists
- Cards for dashboard metrics
- Dialogs for confirmations
- Forms for configuration

---

## Implementation Phases

### Phase 1: Core Platform (4 weeks)

**Week 1-2: Backend**
- [ ] Integrate atsf-core into AgentAnchor
- [ ] Simplify database schema
- [ ] Implement core API endpoints
- [ ] Add API authentication

**Week 3-4: Frontend**
- [ ] Simplify navigation/routes
- [ ] Agent management UI
- [ ] Trust dashboard
- [ ] Basic audit log viewer

### Phase 2: Governance Features (3 weeks)

**Week 5-6:**
- [ ] Policy editor UI
- [ ] Escalation queue
- [ ] Decision viewer

**Week 7:**
- [ ] Compliance report generation
- [ ] Export functionality

### Phase 3: Enterprise Ready (3 weeks)

**Week 8-9:**
- [ ] Team/RBAC
- [ ] Webhooks
- [ ] SDK (TypeScript)

**Week 10:**
- [ ] Documentation
- [ ] API reference
- [ ] Launch prep

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| API latency | <100ms p95 | Governance checks |
| Uptime | 99.9% | Platform availability |
| Agents managed | 100+ | Per enterprise customer |
| Decisions/day | 10,000+ | Governance throughput |
| Audit retrieval | <1s | Log query performance |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Scope creep | HIGH | Strict MVP definition |
| atsf-core integration | MEDIUM | Early integration testing |
| Performance at scale | MEDIUM | Load testing in Phase 2 |
| Security vulnerabilities | HIGH | Security review before launch |

---

## Next Steps

1. **Immediate:** Review this plan with Alex
2. **This week:** Begin Phase 1 implementation
3. **Ongoing:** Track progress against milestones

---

*This plan aligns AgentAnchor with the Vorion ecosystem as the enterprise deployment platform for governed AI agents.*
