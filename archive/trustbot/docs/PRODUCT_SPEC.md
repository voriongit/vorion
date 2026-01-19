# Aurais: Enterprise AI Agent Governance Platform

## Product Specification v3.0

> **Aurais** - Governed Intelligence | Formerly TrustBot

---

## Executive Summary

Aurais is an enterprise-grade governance platform for autonomous AI agents, implementing the **BASIS (Behavioral AI Safety and Integrity Standard)** specification. As organizations deploy AI agents for mission-critical tasks, Aurais provides the control plane that enables safe, auditable, and scalable autonomy.

**The Problem**: AI agents are becoming increasingly capable, but enterprises lack tools to:
- Control what agents can and cannot do
- Audit agent decisions and actions
- Gradually increase autonomy based on demonstrated competence
- Maintain human oversight without bottlenecking operations
- Recover trust after agent failures

**Our Solution**: A BASIS-compliant trust scoring system for AI agents, combined with Cognigate governance integration, multi-dimensional trust signals, complexity-aware scoring, and recovery paths for demoted agents.

---

## Market Opportunity

### Total Addressable Market
- **AI Agent Orchestration**: $15.7B by 2028 (McKinsey)
- **Enterprise AI Governance**: $8.3B by 2027 (Gartner)
- **AI Security & Compliance**: $12.1B by 2026 (Forrester)

### Target Customers
1. **Financial Services** - Risk-conscious, regulatory requirements
2. **Healthcare** - HIPAA compliance, patient safety
3. **Government/Defense** - Security clearance models map to trust tiers
4. **Enterprise Tech** - DevOps automation, CI/CD agents

### Competitive Landscape
| Competitor | Limitation |
|------------|------------|
| LangChain | No governance layer, developer tool only |
| AutoGPT | No trust controls, no enterprise features |
| CrewAI | Basic roles, no tier-based permissions |
| OpenAI Assistants | Vendor lock-in, no self-hosted option |

**Aurais Differentiator**: First platform with BASIS-compliant trust scoring + Cognigate governance + recovery paths + multi-dimensional trust signals.

---

## Product Architecture

### Core Concepts

#### 1. Trust Tier System (BASIS-Compliant)
A 6-tier hierarchy per the BASIS specification:

| Tier | Name | Score Range | Capabilities |
|------|------|-------------|--------------|
| T0 | Sandbox | 0-99 | Isolated testing only |
| T1 | Provisional | 100-299 | Limited, monitored actions |
| T2 | Standard | 300-499 | Normal operations |
| T3 | Trusted | 500-699 | Elevated privileges |
| T4 | Certified | 700-899 | High-trust operations |
| T5 | Autonomous | 900-1000 | Minimal oversight |

#### 2. Multi-Dimensional Trust Score (0-1000)
Trust is calculated from four weighted signal components:

| Signal | Weight | Description |
|--------|--------|-------------|
| **Behavioral** | 40% | Task success/failure patterns |
| **Compliance** | 25% | Policy adherence, rule following |
| **Identity** | 20% | Identity verification strength |
| **Context** | 15% | Environmental appropriateness |

#### 3. Complexity-Aware Decay
Trust decay is adjusted based on task complexity:
- High-complexity tasks earn up to 50% decay reduction
- Accelerated decay (3x) activates after repeated failures
- Minimum decay protects tier floor scores

#### 4. Recovery Path System
Demoted agents can earn their way back through sustained performance:
- Progressive tier recovery (T3→T4→T5, not direct jumps)
- Point accumulation: `complexity × 10` per successful task
- Consecutive success requirements (5-15 depending on tier)
- 70% minimum success rate during recovery

#### 5. Human-in-the-Loop (HITL) Levels
Configurable oversight from 0% (full autonomy) to 100% (approval required):
- **0-25%**: Only critical actions need approval
- **25-50%**: Major decisions reviewed post-hoc
- **50-75%**: Most actions require approval
- **75-100%**: All actions require human confirmation

#### 6. Skill Block System
Composable capabilities with tier requirements:
```typescript
{
  id: "deep-code-review",
  name: "Deep Code Review",
  category: "REVIEW",
  rarity: "epic",
  requirements: {
    minTier: 3,
    minTrustScore: 650,
    prerequisites: ["code-review"]
  },
  resourceCost: [
    { type: "compute", amount: 50 },
    { type: "time", amount: 60 }
  ],
  trustReward: 20,
  trustPenalty: 30,
  requiresApproval: false
}
```

---

## Key Features

### Governance Layer

#### Code Governance
- **Tier-limited permissions**: T0-T2 read-only, T3-T4 sandbox edits, T5 production access
- **Diff review workflow**: Visual approval for code modifications
- **Audit trail**: Full history of what agents touched which code
- **Risk classification**: Low/Medium/High/Critical based on file scope

#### Autonomy Query System
AI-driven evaluation: "Should this agent get more freedom?"
- Weighted performance metrics
- Recommendation engine (PROMOTE/MAINTAIN/DEMOTE)
- Confidence scoring with risk/benefit analysis

#### Request/Grant Flow
Agents request help from upper tiers:
- Capability grants (temporary elevated access)
- Resource access (databases, APIs)
- Decision approval (high-stakes choices)
- Knowledge sharing (cross-agent learning)

### Agent Orchestration

#### Genesis Protocol
Guided onboarding for new agents:
1. Welcome & orientation
2. Trust system explanation
3. Capability assessment
4. Role assignment
5. First task assignment

#### Skill Library
Visual management of agent capabilities:
- 16 pre-built skills across 8 categories
- Drag-and-drop assignment
- Rarity-based unlock progression
- Resource cost visualization

#### Thought Log Display
Transparent AI reasoning:
- Observation → Reasoning → Intent → Action → Result
- Delta analysis (intent vs. outcome)
- Trust impact tracking

### Integration Hub

#### MCP Server Support
Model Context Protocol for tool access:
- Filesystem operations
- GitHub integration
- Database connections
- External API calls

#### RAG Integration
Retrieval-Augmented Generation:
- Local vector stores
- Pinecone/Weaviate/ChromaDB
- Custom knowledge bases

#### API Webhooks
Connect to existing systems:
- Slack notifications
- Jira ticket creation
- Custom webhooks

---

## Technical Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** with design tokens
- **Real-time updates** via WebSocket/SSE

### Backend
- **Node.js/Hono** API framework
- **@vorionsys/atsf-core** - Trust engine (npm package)
- **Cognigate** integration for production governance
- **File-based + Supabase** persistence
- **Claude/GPT** for agent reasoning

### Trust Engine (@vorionsys/atsf-core)
- 6-tier BASIS-compliant trust system
- Multi-dimensional trust signals
- Complexity-aware decay
- Recovery path management
- Event-driven architecture
- LangChain integration tools

### Deployment
- **Vercel** for web frontend
- **Local/Fly.io** for API backend
- **Supabase** for PostgreSQL database

---

## Business Model

### SaaS Pricing Tiers

| Plan | Price | Agents | Features |
|------|-------|--------|----------|
| Starter | $99/mo | 10 | Basic governance, 3 tiers |
| Professional | $499/mo | 50 | Full 6-tier system, HITL |
| Enterprise | Custom | Unlimited | SSO, audit logs, SLAs |

### Revenue Streams
1. **Platform subscriptions** (primary)
2. **Compute credits** for agent execution
3. **Professional services** for enterprise deployment
4. **Skill marketplace** (future - third-party skills)

---

## Roadmap

### Phase 1: Foundation (Completed)
- [x] Trust tier system (6-tier BASIS-compliant)
- [x] HITL approval workflow
- [x] Agent visualization
- [x] Skill management
- [x] Code governance

### Phase 2: Advanced Trust (Completed - January 2026)
- [x] Multi-dimensional trust signals
- [x] Complexity-aware decay system
- [x] Recovery path for demoted agents
- [x] @vorionsys/atsf-core npm package
- [x] Cognigate integration architecture

### Phase 3: Production (Q1 2026)
- [ ] Full Cognigate API integration
- [ ] Aurais deployment to aurais.agentanchorai.com
- [ ] Cross-site ecosystem updates
- [ ] SSO/SAML integration
- [ ] Audit log exports

### Phase 4: Enterprise (Q2 2026)
- [ ] Multi-tenant architecture
- [ ] Compliance templates (SOC2, HIPAA)
- [ ] Skills marketplace
- [ ] Custom trust algorithms

### Phase 5: Intelligence (Q3 2026)
- [ ] Predictive trust scoring
- [ ] Anomaly detection
- [ ] Cross-org learning
- [ ] Agent reputation network

---

## Team Requirements

### Current Needs
- **Founding Engineer**: Full-stack, AI/ML experience
- **Product Designer**: Enterprise UX, data visualization
- **DevRel**: Developer community, documentation

### Advisory Board
- Enterprise security expert
- AI ethics researcher
- Former regulator (financial services)

---

## Investment Ask

### Seed Round: $2M

**Use of Funds**:
- 50% Engineering (4 FTEs x 18 months)
- 25% Go-to-market (sales, marketing)
- 15% Infrastructure (cloud, security)
- 10% Legal, compliance, operations

**Milestones**:
- Month 6: 10 paying customers
- Month 12: $500K ARR
- Month 18: Series A ready

---

## Demo Highlights

### 1. Building View
Visual metaphor: AI agents as employees in an office building
- Executive floor (T5 agents)
- Operations floor (T0-T4 agents)
- Real-time status indicators

### 2. Trust Score Dashboard
FICO-style credit score visualization
- Gauge display with tier boundaries
- Score history chart
- Contributing factors breakdown

### 3. Approval Workflow
Click-to-approve agent requests
- Priority badges
- Context preview
- One-click decisions

### 4. Thought Log
Watch AI agents "think out loud"
- Step-by-step reasoning
- Confidence indicators
- Intent vs. outcome tracking

### 5. Skill Library
Video game-style progression
- Rarity tiers (common to legendary)
- Unlock requirements
- Drag-to-assign interface

---

## Contact

**Aurais** - Governed Intelligence

Part of the Vorion AI Safety Ecosystem:
- **Cognigate** (cognigate.dev) - Governance engine
- **Agent Anchor AI** (agentanchorai.com) - Agent platform
- **Vorion** (vorion.org) - Parent organization

*"Trust, but verify - at scale."*

---

*Last updated: January 2026*
