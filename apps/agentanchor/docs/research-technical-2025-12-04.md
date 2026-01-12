# Technical Research Report: AgentAnchor Architecture

**Date:** 2025-12-04
**Purpose:** Technical architecture patterns, frameworks, and technology evaluation
**Context:** AgentAnchor - AI Governance Operating System

---

## Executive Summary

This research evaluates technical options for building AgentAnchor's core architecture: multi-agent orchestration, governance layer, audit trail/Truth Chain, and Trust Score system. Key findings:

1. **Agent Orchestration:** LangGraph (stateful, graph-based) best fits AgentAnchor's separation of powers model; CrewAI good for role-based agent teams
2. **Governance Architecture:** "Governance-as-a-Service" pattern with policy-driven enforcement aligns with Council design
3. **Audit Trail:** Hash chain with Merkle trees provides tamper-evidence without blockchain complexity; Trillian is production-proven
4. **Trust System:** Hybrid centralized/distributed reputation model with behavioral tracking and decay mechanisms

---

## 1. Agent Orchestration Frameworks

### Framework Comparison

Based on [Turing](https://www.turing.com/resources/ai-agent-frameworks), [Langfuse](https://langfuse.com/blog/2025-03-19-ai-agent-comparison), and [IBM](https://www.ibm.com/think/insights/top-ai-agent-frameworks) analysis:

| Framework | Architecture | Best For | Governance Support |
|-----------|--------------|----------|-------------------|
| **LangGraph** | Graph-based, stateful | Custom workflows, complex state | ✅ Good - DAG philosophy, debuggable |
| **AutoGen** | Conversation-centric | Multi-agent messaging, HITL | ✅ Good - Flexible agent roles |
| **CrewAI** | Role-based teams | Task delegation, structured pipelines | ⚠️ Moderate - Crew/Flow layers |
| **OpenAI Agents SDK** | Lightweight Python | Simple multi-agent | ❌ Limited - No governance built-in |

### Recommendation: LangGraph + Custom Governance Layer

**Why LangGraph:**
- Graph-based orchestration maps naturally to separation of powers
- Stateful execution supports Trust Score tracking
- Built-in support for human-in-the-loop (Level 4 escalations)
- Visualization/debugging for audit purposes
- Active ecosystem and LangChain integration

**Architecture Pattern:**

```
┌─────────────────────────────────────────────────────────────┐
│                    LangGraph Orchestrator                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│   │   Worker    │───▶│   Council   │───▶│  Observer   │    │
│   │   Agents    │    │ Validators  │    │   Layer     │    │
│   └─────────────┘    └─────────────┘    └─────────────┘    │
│         │                   │                   │           │
│         │                   │                   │           │
│         ▼                   ▼                   ▼           │
│   ┌─────────────────────────────────────────────────────┐  │
│   │              State Management (LangGraph)            │  │
│   │   - Trust Scores    - Decision History               │  │
│   │   - Session State   - Escalation Queue               │  │
│   └─────────────────────────────────────────────────────┘  │
│                              │                              │
│                              ▼                              │
│   ┌─────────────────────────────────────────────────────┐  │
│   │              Truth Chain (Append-Only)               │  │
│   └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Sources
- [Turing - AI Agent Frameworks](https://www.turing.com/resources/ai-agent-frameworks)
- [Langfuse - AI Agent Comparison](https://langfuse.com/blog/2025-03-19-ai-agent-comparison)
- [AryaXAI - Modern Frameworks Comparison](https://www.aryaxai.com/article/comparing-modern-ai-agent-frameworks-autogen-langchain-openai-agents-crewai-and-dspy)

---

## 2. Multi-Agent Governance Patterns

### Enterprise Architecture Patterns

Based on [Microsoft Azure Architecture](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns), [InfoQ](https://www.infoq.com/news/2025/10/ai-agent-orchestration/), and [Galileo](https://galileo.ai/blog/architectures-for-multi-agent-systems):

#### Pattern 1: Hierarchical Supervisor

**Description:** Lead agents supervise processes while sub-agents handle tasks

**Application to AgentAnchor:**
- Council Orchestrator = Supervisor
- Guardian, Arbiter, Scholar, Advocate = Sub-agents
- Workers report to Council for approval

**Pros:** Clear accountability, natural escalation path
**Cons:** Single point of failure at supervisor

#### Pattern 2: Governance-as-a-Service (GaaS)

**Description:** [Academic Research](https://arxiv.org/html/2508.18765v2) - Policy-driven enforcement layer that governs agent outputs at runtime

**Key Features:**
- Declarative rule sets (maps to Council policies)
- Trust Factor mechanism (maps to Trust Score)
- Graduated enforcement (maps to Risk Levels 0-4)
- Per-agent trust modulation

**Application to AgentAnchor:**
- Council = GaaS layer
- Trust Score = Trust Factor
- Risk Levels = Enforcement graduation

**Strong alignment with AgentAnchor architecture.**

#### Pattern 3: Group Chat Orchestration

**Description:** Multiple agents collaborate in shared conversation thread

**Application to AgentAnchor:**
- Council deliberation could use group chat pattern
- Chat manager = Orchestrator determining which validator responds

**Pros:** Natural for Council voting/discussion
**Cons:** Less structured than hierarchical

### Recommended Hybrid Pattern

```
Human Escalation (Level 4)
        ▲
        │
┌───────┴───────────────────────────────────────────┐
│           Council (GaaS Pattern)                   │
│  ┌─────────────────────────────────────────────┐  │
│  │         Group Chat Deliberation              │  │
│  │   Guardian ←→ Arbiter ←→ Scholar ←→ Advocate │  │
│  └─────────────────────────────────────────────┘  │
│         ▲ Decision Request    │ Approval/Denial   │
└─────────┼─────────────────────┼───────────────────┘
          │                     ▼
┌─────────┴─────────────────────────────────────────┐
│           Worker Agents (Hierarchical)             │
│   Lead Agent → Sub-Agents → Task Execution         │
└───────────────────────────────────────────────────┘
```

### Sources
- [Microsoft Azure - AI Agent Design Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)
- [InfoQ - AI Agent Orchestration](https://www.infoq.com/news/2025/10/ai-agent-orchestration/)
- [Galileo - Multi-Agent Architectures](https://galileo.ai/blog/architectures-for-multi-agent-systems)
- [arXiv - Governance-as-a-Service](https://arxiv.org/html/2508.18765v2)

---

## 3. Audit Trail / Truth Chain Implementation

### Requirements

Based on [EU AI Act Article 19](https://www.dynatrace.com/news/blog/the-rise-of-agentic-ai-part-7-introducing-data-governance-and-audit-trails-for-ai-services/):
- Automatically generated logs retained 6+ months
- Tamper-evident (can detect modifications)
- Append-only (no deletions)
- Cryptographically signed
- Queryable for compliance

### Technology Options

| Option | Complexity | Performance | Tamper-Evidence | Recommendation |
|--------|------------|-------------|-----------------|----------------|
| **Hash Chain** | Low | High | Tamper-evident | ✅ MVP |
| **Merkle Tree** | Medium | High | Tamper-evident + efficient proofs | ✅ MVP+Growth |
| **Trillian** | Medium | High | Production-proven | ✅ Recommended |
| **Blockchain** | High | Low | Tamper-proof | ❌ Overkill for MVP |

### Recommended: Trillian + Hash Chain

[Trillian](https://transparency.dev/) is an open-source append-only log that provides:
- Tamper-evident proofs with logarithmic size
- Foundation for Certificate Transparency (production-proven at scale)
- Integration with existing systems (no ground-up rebuild)
- 3 KB proof vs 800 MB for classic hash chain (80M events)

**Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│                     Truth Chain Service                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│   │   Ingestion │───▶│   Trillian  │───▶│   Query     │    │
│   │   API       │    │   Log       │    │   API       │    │
│   └─────────────┘    └─────────────┘    └─────────────┘    │
│                            │                                 │
│                            ▼                                 │
│   ┌─────────────────────────────────────────────────────┐  │
│   │              Merkle Tree Storage                     │  │
│   │   - Append-only writes                               │  │
│   │   - Signed tree heads                                │  │
│   │   - Inclusion proofs                                 │  │
│   └─────────────────────────────────────────────────────┘  │
│                            │                                 │
│                            ▼                                 │
│   ┌─────────────────────────────────────────────────────┐  │
│   │              Public Verification API                 │  │
│   │   - Verify certification hashes                      │  │
│   │   - Generate inclusion proofs                        │  │
│   │   - External audit support                           │  │
│   └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### What to Log

Based on [Medium - AI Audit Logs](https://medium.com/@pranavprakash4777/audit-logging-for-ai-what-should-you-track-and-where-3de96bbf171b):

**Essential Fields:**
- Timestamp (ISO 8601)
- Agent ID (who)
- Action type (what)
- Input/output summary (context)
- Decision outcome (approval/denial)
- Council votes (governance)
- Risk level (classification)
- Human escalation (if any)

**Retention Policy:**
- Hot storage: 30 days (full query)
- Warm storage: 6 months (EU AI Act minimum)
- Cold storage: 2+ years (compliance archive)

### Sources
- [Transparency.dev - Trillian](https://transparency.dev/)
- [Cossack Labs - Audit Logs Security](https://www.cossacklabs.com/blog/audit-logs-security/)
- [Dynatrace - AI Audit Trails](https://www.dynatrace.com/news/blog/the-rise-of-agentic-ai-part-7-introducing-data-governance-and-audit-trails-for-ai-services/)
- [Medium - Audit Logging for AI](https://medium.com/@pranavprakash4777/audit-logging-for-ai-what-should-you-track-and-where-3de96bbf171b)

---

## 4. Trust Score System

### Design Principles

Based on [ACM Computing Surveys](https://dl.acm.org/doi/10.1145/2816826) and [Restack](https://www.restack.io/p/multi-agent-systems-answer-trust-reputation-cat-ai):

**Two Trust Types:**
1. **Intrinsic Trust** - AI's ability to explain actions (Council reasoning)
2. **Extrinsic Trust** - Observed behavior history (Trust Score)

**Key Components:**
- Reputation (positive history)
- Disrepute (negative history)
- Conflict (disagreement with Council)

### Trust Score Algorithm

```python
# Simplified Trust Score calculation
class TrustScore:
    TIERS = {
        'UNTRUSTED': (0, 199),
        'NOVICE': (200, 399),
        'PROVEN': (400, 599),
        'TRUSTED': (600, 799),
        'ELITE': (800, 899),
        'LEGENDARY': (900, 1000)
    }

    def calculate_delta(self, event):
        """Calculate Trust Score change from event"""
        base_delta = {
            'task_success': +5,
            'task_failure': -10,
            'council_approval': +3,
            'council_denial': -15,
            'human_escalation_success': +10,
            'human_escalation_failure': -25,
            'consumer_positive_feedback': +2,
            'consumer_negative_feedback': -5,
            'examination_pass': +50,
            'examination_fail': -100,
        }

        # Apply complexity multiplier
        multiplier = self.get_complexity_multiplier(event.complexity)
        return base_delta.get(event.type, 0) * multiplier

    def apply_decay(self, score, days_inactive):
        """Apply inactivity decay (1 point/week)"""
        decay = days_inactive // 7
        return max(score - decay, self.get_tier_floor(score))
```

### Architecture Pattern: Hybrid Centralized/Distributed

**Centralized:**
- Trust Score calculation (single source of truth)
- Historical data storage
- Cross-agent reputation queries

**Distributed:**
- Local caching for performance
- Event emission for real-time updates
- Peer recommendations (for Council validators)

```
┌─────────────────────────────────────────────────────────────┐
│                 Trust Score Service                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│   │   Event     │───▶│   Score     │───▶│   Tier      │    │
│   │   Ingestion │    │   Engine    │    │   Manager   │    │
│   └─────────────┘    └─────────────┘    └─────────────┘    │
│         ▲                  │                   │            │
│         │                  ▼                   ▼            │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│   │   Observer  │    │   History   │    │   Cache     │    │
│   │   Events    │    │   Store     │    │   Layer     │    │
│   └─────────────┘    └─────────────┘    └─────────────┘    │
│                            │                                 │
│                            ▼                                 │
│   ┌─────────────────────────────────────────────────────┐  │
│   │              Truth Chain (Immutable Record)          │  │
│   └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Anti-Manipulation Measures

Based on research on [trust system vulnerabilities](https://www.restack.io/p/multi-agent-systems-answer-trust-reputation-cat-ai):

1. **Sybil Attack Prevention** - Agents tied to verified Trainer identities
2. **Collusion Detection** - Statistical analysis of voting patterns
3. **Manipulation Penalties** - Severe Trust Score penalties for detected gaming
4. **Rate Limiting** - Cap on how fast Trust Score can change
5. **Minimum History** - Require minimum actions before Trust Score stabilizes

### Sources
- [ACM - Trust and Reputation Models](https://dl.acm.org/doi/10.1145/2816826)
- [Restack - Trust in Multi-Agent Systems](https://www.restack.io/p/multi-agent-systems-answer-trust-reputation-cat-ai)
- [Salesforce - Trustworthy AI Agents](https://www.salesforce.com/blog/trustworthy-ai-agent/)

---

## 5. Observer Layer Isolation

### Requirement

Observer Layer must be:
- Read-only (cannot influence Workers or Council)
- Isolated infrastructure (no network path to control planes)
- Always available (99.99% uptime for audit continuity)

### Implementation Pattern

```
┌──────────────────────────────────────────────────────────────┐
│                    Production VPC                             │
│  ┌────────────────────┐    ┌────────────────────┐           │
│  │  Worker Agents     │    │  Council Validators │           │
│  │  (Execution VPC)   │    │  (Governance VPC)   │           │
│  └─────────┬──────────┘    └─────────┬──────────┘           │
│            │                         │                       │
│            ▼                         ▼                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Event Bus (Kafka/Kinesis)                   ││
│  │              - Write-only from Workers/Council           ││
│  │              - No return channel                         ││
│  └─────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
              │
              │ One-way event stream
              ▼
┌──────────────────────────────────────────────────────────────┐
│                    Observer VPC (Isolated)                    │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Event Consumer                              ││
│  │              - Read-only database access                 ││
│  │              - No write path back to production          ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Observer Services                           ││
│  │  - Chronicler (logging)                                 ││
│  │  - Analyst (pattern detection)                          ││
│  │  - Auditor (compliance reporting)                       ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Observer Database (Read Replica)            ││
│  └─────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

### Key Security Controls

1. **Network Isolation** - Separate VPC with no peering to production control planes
2. **IAM Restrictions** - Read-only roles, no write permissions
3. **Event Bus One-Way** - Kafka/Kinesis configured for unidirectional flow
4. **Cryptographic Attestation** - Observer signs integrity proofs
5. **Independent Scaling** - Observer scales separately from production

---

## 6. Technology Stack Recommendation

### MVP Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Orchestration** | LangGraph | Stateful, graph-based, good debugging |
| **LLM Provider** | OpenAI + Anthropic | Multi-provider for resilience |
| **Database** | PostgreSQL + TimescaleDB | Relational + time-series for events |
| **Event Streaming** | Kafka (managed) | One-way streaming for Observer |
| **Truth Chain** | Custom hash chain | Simple MVP, upgrade to Trillian later |
| **Cache** | Redis | Trust Score caching, session state |
| **Search** | Elasticsearch | Marketplace search, log queries |
| **Queue** | Redis/BullMQ | Async task processing |
| **Frontend** | Next.js 14 + React 18 | Already in stack |
| **Real-time** | Pusher | Already in stack for Observer feed |

### Growth Stack Additions

| Component | Technology | When to Add |
|-----------|------------|-------------|
| **Truth Chain** | Trillian | When audit volume exceeds simple hash chain |
| **ML Ops** | MLflow | When training custom models |
| **Feature Store** | Feast | When Trust Score becomes ML-based |
| **Blockchain Anchor** | Ethereum L2 | When enterprise demands true immutability |

---

## 7. Key Technical Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| LangGraph vendor lock-in | HIGH | Abstract orchestration layer, keep framework-agnostic interfaces |
| Trust Score manipulation | HIGH | Statistical anomaly detection, rate limiting, minimum history requirements |
| Observer isolation breach | CRITICAL | Strict IAM, network isolation, regular security audits |
| Hash chain scalability | MEDIUM | Design for Trillian migration from start |
| Council latency | MEDIUM | Async processing, caching, parallel validator execution |

---

## 8. Recommended Architecture for MVP

```
┌─────────────────────────────────────────────────────────────────┐
│                         Next.js Frontend                         │
│   Dashboard │ Marketplace │ Academy │ Observer Feed │ Admin     │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer (Next.js API Routes)           │
│   REST API │ WebSocket (Pusher) │ Public Verification API        │
└───────────────────────────────┬─────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│    Worker     │     │    Council    │     │   Observer    │
│   Service     │     │   Service     │     │   Service     │
│  (LangGraph)  │     │  (LangGraph)  │     │  (Isolated)   │
└───────┬───────┘     └───────┬───────┘     └───────┬───────┘
        │                     │                     │
        └──────────┬──────────┘                     │
                   ▼                                │
        ┌───────────────────┐                      │
        │   Event Bus       │──────────────────────┘
        │   (Kafka)         │
        └─────────┬─────────┘
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
┌───────────────┐   ┌───────────────┐
│   PostgreSQL  │   │  Truth Chain  │
│   (Supabase)  │   │  (Hash Chain) │
└───────────────┘   └───────────────┘
        │
        ▼
┌───────────────┐
│    Redis      │
│  (Cache/Queue)│
└───────────────┘
```

---

## Summary

**Key Decisions:**

1. **LangGraph** for orchestration — best fit for stateful, graph-based governance
2. **Governance-as-a-Service pattern** — aligns with Council architecture
3. **Hash chain → Trillian** migration path for Truth Chain
4. **Hybrid trust model** — centralized calculation, distributed caching
5. **Strict Observer isolation** — separate VPC, one-way event flow
6. **PostgreSQL + TimescaleDB** — leverage existing Supabase, add time-series

**Technical Confidence: HIGH**

The architecture is technically sound and aligns well with the product vision. No fundamental technical blockers identified. Main risks are execution-related (complexity, latency optimization) rather than feasibility.

---

_Generated by BMad Method Technical Research Workflow_
_For AgentAnchor - AI Governance Operating System_
