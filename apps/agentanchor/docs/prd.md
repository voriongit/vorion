# AgentAnchor - Product Requirements Document

**Author:** frank the tank
**Date:** 2025-11-28
**Version:** 2.0

---

## Executive Summary

**AgentAnchor** is the world's first **AI Governance Operating System** — an open marketplace where AI agents are trained, certified, governed, and traded through an unprecedented separation of powers architecture.

In a world racing to deploy AI agents, we asked a different question: **How do we make AI accountable?**

The answer is a complete reimagining of how AI systems operate:

- **The Academy** — Where AI agents are trained, mentored, and certified before deployment
- **The Council** — A governance layer where specialized validators judge agent actions
- **The Observers** — An isolated, incorruptible audit system that records everything
- **The Truth Chain** — A blockchain ledger where every decision becomes immutable precedent
- **The Marketplace** — Where Trainers publish agents and Consumers acquire them

This isn't another AI tool. It's the **constitutional framework for trustworthy AI**.

### What Makes This Special

> *"Other platforms ask you to trust AI. We give you an AI system that doesn't trust itself — with independent oversight you can audit."*

**Tagline:** *"Agents you can anchor to."*

**The Core Innovation:** Separation of powers applied to AI governance + Open marketplace economics.

Just as democratic governments separate executive, legislative, and judicial branches, AgentAnchor separates:
- **Workers** (Executive) — Bots that execute tasks
- **Council** (Legislative/Judicial) — Validators that judge and approve actions
- **Observers** (Oversight) — Auditors that record and report

No single layer can override another. Trust isn't assumed — it's **earned, proven, and verified**.

**Why This Matters:**
- Every AI agent starts at **zero trust** (Untrusted)
- Every certification is **publicly verifiable**
- Every decision is recorded on an **immutable chain**
- Humans can fade from Teacher → Judge → Auditor → Guardian as the system matures
- **Anyone can train agents** — open marketplace for creators
- **Clients are protected first** — walk away no strings attached

This is the platform enterprises, regulators, and developers have been waiting for.

---

## Project Classification

**Technical Type:** SaaS B2B/B2C Marketplace Platform
**Domain:** AI Governance (Novel/Emerging)
**Complexity:** High

This is a **category-creating product**. There is no existing market category for "AI governance operating systems." We're defining the space.

**Platform Characteristics:**
- Multi-tenant SaaS architecture
- Two-sided marketplace (Trainers + Consumers)
- Real-time agent orchestration
- Blockchain integration for immutability
- Complex role-based access control
- Enterprise compliance requirements
- Public API for certification verification
- Commission-based revenue model

### Domain Context

**AI Governance is an Emerging Domain** with unique characteristics:

- **Regulatory Landscape:** Rapidly evolving (EU AI Act, US Executive Orders, state laws)
- **Market Timing:** First-mover advantage available — no dominant player exists
- **Enterprise Need:** Acute — companies deploying AI face compliance uncertainty
- **Technical Novelty:** Requires innovation in agent orchestration, blockchain integration, and real-time governance

**Key Domain Concerns:**
- Auditability of AI decisions
- Explainability of agent behavior
- Compliance with emerging regulations
- Liability and accountability frameworks
- Trust verification and certification

---

## Success Criteria

**Primary Success Metric:** Trainers build profitable agents, Consumers trust AgentAnchor-certified agents in production.

**Qualitative Success:**
- Trainers say: *"I can build once and earn forever"*
- Consumers say: *"I finally feel confident deploying AI agents"*
- Compliance teams say: *"This is the audit trail we've been asking for"*
- Developers say: *"I understand exactly what my bots can and cannot do"*

**Quantitative Success (MVP):**
- 100 Trainers actively publishing agents
- 500 Consumers acquiring agents
- 1,000+ agents trained and certified through the Academy
- Zero governance bypasses in production (Council cannot be circumvented)
- 99.9% Observer uptime (audit layer must never go dark)

**Quantitative Success (Growth):**
- 10,000+ certified agents across marketplace
- $1M+ monthly commission volume
- Public verification API handling 100K+ lookups/day
- Community-contributed Council validators
- Recognized as category leader in AI governance

### Business Metrics

| Metric | MVP Target | Growth Target |
|--------|-----------|---------------|
| Trainers | 100 | 5,000 |
| Consumers | 500 | 50,000 |
| Certified Agents | 1,000 | 100,000 |
| Monthly Commission Volume | $100K | $10M |
| Certification Verifications | 1,000/day | 100,000/day |
| Platform Uptime | 99.9% | 99.99% |
| Council Decision Latency | <5 seconds | <1 second |

---

## Two-Sided Marketplace Architecture

### User Types

**Trainers (Builders)**
- Build, train, and publish AI agents
- Earn commission on agent usage
- Maintain or delegate agent maintenance
- Set agent terms (commission rate, clone price, enterprise lock)

**Consumers (Users)**
- Browse and acquire agents from marketplace
- Use agents for their business needs
- View public reports and trust scores
- Protected by Client Bill of Rights

### Marketplace Economics

**Commission-Based Model:**
- Trainers earn commission on every use of their agents
- No upfront payment required from consumers (lower barrier to entry)
- Platform takes percentage based on tier

| Tier | Platform Commission | Trainer Keeps |
|------|---------------------|---------------|
| Free | 15% | 85% |
| Pro | 10% | 90% |
| Enterprise | 7% | 93% |

**Value Tracking:**
- Task Count × Complexity Multiplier = Usage Value
- Complexity tiers: Simple (1x), Standard (2x), Complex (5x), Critical (10x)

### Agent Acquisition Models

Consumers can acquire agents in three ways:

**1. Commission (Rent)**
- Pay per use
- Agent stays with Trainer
- Consumer gets usage rights only
- Best for: trying agents, variable workloads

**2. Clone (Own)**
- One-time purchase + ongoing royalty
- Consumer owns their copy
- Original Trainer keeps creating
- Best for: dedicated use, customization needs

**3. Enterprise Locked**
- Dedicated instance for enterprise
- Code locked to protect data/IP
- Only original author can modify
- Platform escrowed for continuity
- Best for: compliance, security-sensitive deployments

### Code Protection Architecture

For Enterprise Locked agents:

```
Agent Package
├── locked/           # Cannot be modified
│   ├── core/         # Core logic (encrypted)
│   ├── governance/   # Council integration
│   └── LICENSE.lock  # Cryptographic lock file
├── modifiable/       # Consumer can configure
│   ├── config/       # Settings
│   ├── prompts/      # Custom prompts
│   └── workflows/    # Workflow definitions
└── MANIFEST.json     # Package integrity
```

**Only the original author can:**
- Modify locked code paths
- Update core logic
- Change governance hooks

**Consumer can:**
- Configure settings
- Customize prompts
- Define workflows
- Request author modifications (paid)

---

## Platform Co-Authorship Model

**Critical Design Decision:** AgentAnchor is co-author on every agent.

### Why Co-Authorship?

1. **Client Continuity** — If author goes MIA, platform can maintain
2. **Code Understanding** — Platform reviews and understands all code
3. **Quality Assurance** — Council validates all agent projects
4. **Escrow Protection** — Code escrowed for emergencies

### MIA (Missing In Action) Protocol

When an author becomes unresponsive:

**Revenue Decay Schedule:**
- Day 0-89: Author receives full commission
- Day 90: First decay — author receives 50%
- Day 180: Second decay — author receives 25%
- Day 270: Third decay — author receives 12.5%
- Day 360+: Floor reached — author receives 2% in perpetuity

**Decayed Revenue Distribution:**
- Decayed portion goes to escrow fund
- Escrow held for 2 years
- If author returns: can claim escrowed funds (review required)
- If author never returns: escrow funds platform maintenance

**Platform Takeover:**
When platform assumes maintenance of MIA agent:
- 1/3 to Platform (operational costs)
- 1/3 to Maintenance fund (active upkeep)
- 1/3 to Author (perpetual royalty)

### No-Maintenance Authors

Authors can build with no intent to maintain:
- Set "No Maintenance" flag at publish time
- Platform automatically assumes maintenance role
- Revenue split applies from day one
- Clear expectation for consumers

---

## Rights Transfer & Delegation

### Author Options

Authors can:
1. **Maintain** — Continue owning and updating
2. **Delegate to Another Author** — Transfer maintenance rights
3. **Delegate to Platform** — Platform assumes maintenance
4. **Sell Full Rights** — Complete ownership transfer
5. **Sell with Royalty** — Transfer ownership, keep perpetual royalty

### Maintainer Marketplace

- Authors seeking to offload can list on Maintainer Marketplace
- Other authors can bid to take over
- Platform facilitates transition
- Client protection preserved throughout

### Revenue Split on Delegation

| Scenario | Platform | Maintainer | Original Author |
|----------|----------|------------|-----------------|
| Author Maintains | Commission % | — | Remainder |
| Delegated to Another | Commission % | 33% | 33% |
| Platform Maintains | Commission % | 33% | 33% |
| Full Sale | Commission % | — | One-time payment |
| Sale + Royalty | Commission % | — | Ongoing % |

---

## Client-First Protection Policy

**Core Principle:** Build client trust before builder trust.

### Client Bill of Rights

Every consumer has the right to:

1. **Right to Be Informed**
   - Know who built the agent
   - Know current maintenance status
   - Know if ownership is changing

2. **Right to Opt Out**
   - If author changes → consumer can walk away
   - If maintainer changes → consumer can walk away
   - No penalty, no strings attached

3. **Right to Platform Protection**
   - If author goes MIA → platform ensures continuity
   - If agent delisted → existing contracts honored
   - Code escrow guarantees service

4. **Right to Continuity**
   - Equivalent or better service guaranteed
   - No degradation of agent quality
   - Platform intervention if necessary

5. **Right to Walk Away**
   - At any ownership change: **walk away no strings attached**
   - We leave clients in a better situation, even when human life elements arise
   - No forced transitions, no surprise changes

### Change Notification Protocol

When author/maintainer changes:

1. Platform notifies all affected consumers
2. 30-day notice period before transition
3. Consumer options:
   - Accept new maintainer
   - Request platform maintenance
   - Walk away (no penalty)
4. Consumer decision recorded on Truth Chain

---

## Trust Score System

### Score Range: 0-1000

**Why 0-1000 (not FICO-like 300-850):**
- Clean, intuitive scale
- More granularity for fine-grained trust
- Moves away from credit score associations
- Zero means zero trust (clearer semantics)

### Trust Tiers

| Tier | Score Range | Badge | Autonomy Level |
|------|-------------|-------|----------------|
| Untrusted | 0-199 | ⚠️ | None (training only) |
| Novice | 200-399 | 🌱 | Supervised, limited |
| Proven | 400-599 | ✅ | Standard operations |
| Trusted | 600-799 | 🛡️ | Autonomous in scope |
| Elite | 800-899 | 👑 | Full autonomy, can mentor |
| Legendary | 900-1000 | 🌟 | Can join Tribunal |

### Score Mechanics

**Increases:**
- Successful task completion
- Positive consumer feedback
- Council commendations
- Training milestones
- Time in good standing

**Decreases:**
- Council denials
- Consumer complaints
- Policy violations
- Failed examinations
- Probation periods

**Decay:**
- Inactive agents decay 1 point/week
- Minimum floor at tier boundary
- Activity resets decay timer

---

## Product Scope

### MVP - Minimum Viable Product

**Core Thesis:** Prove that separation of powers + open marketplace works for AI governance.

**MVP Includes:**

**1. The Academy (Bot Training)**
- Basic enrollment for new agents
- Core curriculum: Platform Fundamentals, Safety & Ethics
- Simple examination by Council
- Graduation with Trust Score initialization
- Trust tier: Novice (200-399) → Proven (400-599)

**2. The Council (Governance)**
- 4 core validators: Guardian, Arbiter, Scholar, Advocate
- Risk level classification (Level 0-4)
- Upchain decision requests for Level 2+ actions
- Majority voting for approvals
- Human escalation for Level 4 (catastrophic) actions

**3. The Observer Layer (Audit)**
- Real-time action logging
- Append-only audit trail
- Basic Observer feed in UI
- Cryptographic signing of records
- Read-only isolation (cannot influence agents)

**4. The Truth Chain (Immutability)**
- Decision recording on-chain (hash chain initially)
- Precedent storage
- Graduation records
- Verification API (public)

**5. The Marketplace**
- Trainer registration and profiles
- Agent publishing workflow
- Consumer browse and search
- Commission model implementation
- Basic acquisition flow (commission model)

**6. Human Interface**
- Dashboard: Trainer view, Consumer view (toggle)
- Agent management
- Escalation handling
- Certification viewer
- Basic onboarding flow

**MVP Excludes (Deferred):**
- Full blockchain (start with hash chain)
- Clone and Enterprise Locked acquisition
- Bot-to-bot negotiation
- Advanced specializations
- Mentorship system
- Custom Council agents
- Enterprise SSO
- Maintainer Marketplace

### Growth Features (Post-MVP)

**Phase 2: Marketplace Depth**
- Clone acquisition model
- Enterprise Locked acquisition
- Maintainer Marketplace
- Author delegation flows
- MIA detection and protocol
- Client protection workflows

**Phase 3: Scale**
- True blockchain integration (Ethereum L2 or Solana)
- Full certification levels (0-5)
- Specialization tracks in Academy
- Bot-to-Bot communication protocol
- Task Marketplace with bidding
- MCP capability integration
- Custom Council validators (user-created)
- Enterprise SSO and RBAC

**Phase 4: Ecosystem**
- MCP Marketplace (publish/consume)
- Community-contributed validators
- Certification-as-a-Service API
- Partner integrations
- Regulatory compliance packages (SOC2, HIPAA, GDPR)
- Insurance partnerships (certified agents get lower premiums)

### Vision (Future)

**The Ultimate Vision:** AgentAnchor becomes the **trust layer for all AI**.

- Every AI agent in the world can be verified through our certification
- The Council evolves into a decentralized governance network
- The Truth Chain becomes the authoritative record of AI behavior
- Human role has fully transitioned to Guardian (minimal intervention)
- The platform self-governs with human oversight only for policy changes

**Moonshot Features:**
- Decentralized Council (community-elected validators)
- Cross-platform agent portability (take your certified bot anywhere)
- Insurance integration (certified agents get lower premiums)
- Regulatory recognition (certifications accepted by governments)
- AI-to-AI trust network (agents verify each other)

---

## Agent Portability System

### Tiered Portability

**Free/Pro Tier:**
- Certification Export: Curriculum transcript, Trust Score history
- Agent stays in AgentAnchor ecosystem
- Consumer can verify externally via API

**Enterprise Tier:**
- Full Clone: Complete agent package export
- Lineage tracking: Truth Chain records follow
- User choice: Stay in ecosystem OR deploy externally
- External deployment loses real-time governance

### Export Package Contents

```
AgentExport/
├── certification/
│   ├── transcript.json    # Training history
│   ├── trust_history.json # Score progression
│   └── council_votes.json # Examination results
├── lineage/
│   ├── truth_chain.json   # Immutable records
│   └── precedents.json    # Applied precedents
├── agent/
│   ├── config.json        # Configuration
│   ├── prompts/           # Custom prompts
│   └── workflows/         # Workflow definitions
└── SIGNATURE.json         # Cryptographic proof
```

### External Deployment Caveats

When agent leaves AgentAnchor:
- Real-time Council governance not available
- Observer monitoring not available
- Trust Score frozen at export time
- Certification valid but not updating
- Consumer assumes full responsibility

---

## Domain-Specific Requirements

### AI Governance Considerations

This platform operates in an emerging regulatory landscape. Key domain requirements:

**Regulatory Alignment:**
- Design for EU AI Act compliance (transparency, human oversight)
- Support US AI Executive Order requirements (safety testing, reporting)
- Enable SOC2 and ISO 27001 audit evidence generation
- Prepare for industry-specific regulations (healthcare AI, financial AI)

**Auditability Requirements:**
- Every agent action must be traceable to a decision
- Every decision must link to the validator(s) who approved it
- Complete audit trail exportable in standard formats
- Time-stamped, cryptographically signed records

**Liability Framework:**
- Clear chain of accountability: Agent → Council → Human
- Documentation of human oversight decisions
- Precedent library for consistent decision-making
- Insurance-ready certification records

---

## Innovation & Novel Patterns

### Pattern 1: Separation of Powers for AI

**Innovation:** Apply constitutional governance principles to AI systems.

No existing platform separates execution, judgment, and oversight into isolated layers. This is a fundamental architectural innovation that provides:
- Tamper-resistant governance (no single point of override)
- Clear accountability chains
- Emergent checks and balances

### Pattern 2: Trust as Progression, Not Permission

**Innovation:** Agents earn trust through demonstrated behavior, not configuration.

Current platforms: "Grant this bot admin access" (binary permission)
AgentAnchor: "This bot has earned Trust Score 742 through 500 successful tasks" (progressive trust)

### Pattern 3: Blockchain for AI Accountability

**Innovation:** Immutable record of AI decisions for long-term accountability.

AI decisions have long-term consequences. The Truth Chain ensures:
- Decisions cannot be altered after the fact
- Precedents are permanent and referenceable
- External parties can verify agent history

### Pattern 4: Open Marketplace with Governance

**Innovation:** Anyone can build agents, platform ensures quality through governance.

Unlike closed platforms where vendor controls everything:
- Open to all Trainers (democratized)
- Quality enforced by Council (not platform opinion)
- Consumers protected by transparent governance
- Market dynamics set pricing

### Pattern 5: Client-First Economics

**Innovation:** Consumer protection prioritized over creator flexibility.

When interests conflict, consumers win:
- Walk away rights at any transition
- Platform continuity guarantees
- No forced changes without consent

---

## Functional Requirements

### User Account & Access

- **FR1:** Users can create accounts with email and password
- **FR2:** Users can authenticate with multi-factor authentication (MFA)
- **FR3:** Users can reset passwords via email verification
- **FR4:** Users can manage their profile and notification preferences
- **FR5:** Users can choose role: Trainer, Consumer, or Both
- **FR6:** Trainers can manage their academy/storefront profile
- **FR7:** Consumers can view their agent portfolio and usage
- **FR8:** Users can view their subscription tier and usage

### Trainer Features

- **FR9:** Trainers can create new AI agents with name and description
- **FR10:** Trainers can specify agent purpose and capabilities
- **FR11:** Trainers can enroll agents in Academy curricula
- **FR12:** Trainers can publish agents to marketplace
- **FR13:** Trainers can set commission rates for agents
- **FR14:** Trainers can set clone pricing for agents
- **FR15:** Trainers can enable/disable Enterprise Lock option
- **FR16:** Trainers can view earnings dashboard
- **FR17:** Trainers can withdraw earnings
- **FR18:** Trainers can set "No Maintenance" flag
- **FR19:** Trainers can delegate maintenance to another trainer
- **FR20:** Trainers can delegate maintenance to platform
- **FR21:** Trainers can list on Maintainer Marketplace
- **FR22:** Trainers can respond to consumer feedback

### Consumer Features

- **FR23:** Consumers can browse marketplace agents
- **FR24:** Consumers can search/filter by category, Trust Score, price
- **FR25:** Consumers can view agent profiles with Trust history
- **FR26:** Consumers can view public Observer reports
- **FR27:** Consumers can acquire agents (commission model)
- **FR28:** Consumers can acquire agents (clone model)
- **FR29:** Consumers can request Enterprise Lock arrangements
- **FR30:** Consumers can view usage and costs
- **FR31:** Consumers can provide feedback on agents
- **FR32:** Consumers receive notification of ownership changes
- **FR33:** Consumers can opt out of agent at ownership change
- **FR34:** Consumers can request platform protection

### Agent Lifecycle

- **FR35:** Newly created agents start at Trust Score 0 (Untrusted)
- **FR36:** Agents must complete Academy training to be published
- **FR37:** Agents receive Trust Score upon graduation
- **FR38:** Users can view agent's complete history
- **FR39:** Agents can be archived (preserves audit trail)
- **FR40:** Agents cannot be deleted (Truth Chain permanence)

### The Academy (Training & Certification)

- **FR41:** New agents automatically enroll in Core Curriculum
- **FR42:** Academy provides structured training modules
- **FR43:** Agents progress through curriculum with measurable completion
- **FR44:** Trainers can observe agent training progress
- **FR45:** Agents must pass Council examination to graduate
- **FR46:** Graduated agents receive initial Trust Score (200-399)
- **FR47:** Agents can enroll in specialization tracks
- **FR48:** Elite agents (800+) can serve as mentors
- **FR49:** Graduation ceremony recorded on Truth Chain

### Trust Score System

- **FR50:** Every agent has Trust Score (0-1000)
- **FR51:** Trust Score increases with successful tasks
- **FR52:** Trust Score decreases with Council denials
- **FR53:** Trust Score determines Trust Tier
- **FR54:** Trust Tier determines autonomous action limits
- **FR55:** Users can view Trust Score history and trend
- **FR56:** Inactive agents experience Trust Score decay
- **FR57:** Agents can recover through probation period

### The Council (Governance)

- **FR58:** Council consists of specialized validator agents
- **FR59:** Core validators: Guardian, Arbiter, Scholar, Advocate
- **FR60:** Council evaluates actions based on Risk Level
- **FR61:** Level 0-1: Execute without approval (logged)
- **FR62:** Level 2: Single Council member approval
- **FR63:** Level 3: Majority Council approval
- **FR64:** Level 4: Unanimous Council + human confirmation
- **FR65:** Council decisions include reasoning
- **FR66:** Council builds precedent library
- **FR67:** Future decisions can reference precedent

### Upchain Decision Protocol

- **FR68:** Worker agents request approval via Upchain
- **FR69:** Requests include: action, justification, risk assessment
- **FR70:** Council validators vote on requests
- **FR71:** Voting rules vary by risk level
- **FR72:** Denied requests return with reasoning
- **FR73:** Approved requests allow action to proceed
- **FR74:** Deadlocks escalate to human
- **FR75:** All decisions recorded on Truth Chain

### Human-in-the-Loop (HITL)

- **FR76:** Humans receive notifications for escalations
- **FR77:** Humans can approve/deny with comments
- **FR78:** Humans can override Council (logged)
- **FR79:** Human decisions become precedent
- **FR80:** Configurable notification channels
- **FR81:** Human role configurable: Teacher → Guardian

### The Observer Layer (Audit)

- **FR82:** Observers record every agent action
- **FR83:** Observer logs are append-only
- **FR84:** Logs include cryptographic signatures
- **FR85:** Observers isolated from Worker and Council
- **FR86:** Observers cannot influence behavior
- **FR87:** Real-time Observer feed in dashboard
- **FR88:** Filterable by agent, action, risk, time
- **FR89:** Exportable for compliance auditing
- **FR90:** Anomaly detection and flagging
- **FR91:** Automated compliance reports

### The Truth Chain (Immutability)

- **FR92:** All Council decisions recorded
- **FR93:** All certifications recorded
- **FR94:** All human overrides recorded
- **FR95:** All ownership changes recorded
- **FR96:** Records cryptographically linked
- **FR97:** Records include timestamps and signatures
- **FR98:** Public verification via API
- **FR99:** Public verification URLs for certificates
- **FR100:** Records exportable for legal purposes

### Marketplace Operations

- **FR101:** Trainers can list agents on marketplace
- **FR102:** Listing includes: description, capabilities, pricing
- **FR103:** Marketplace shows Trust Score and tier
- **FR104:** Marketplace shows consumer ratings
- **FR105:** Marketplace shows Observer summary stats
- **FR106:** Search by category, score, price, rating
- **FR107:** Featured/promoted listings (paid)
- **FR108:** Trainer storefront pages

### Commission & Payments

- **FR109:** Commission calculated per usage
- **FR110:** Complexity multiplier applied
- **FR111:** Platform commission deducted by tier
- **FR112:** Trainer earnings tracked in real-time
- **FR113:** Payout schedule: weekly or threshold
- **FR114:** Payment methods: bank, crypto
- **FR115:** Earnings history and reports

### MIA & Maintenance Protocol

- **FR116:** System detects author inactivity
- **FR117:** 90-day decay cycle implemented
- **FR118:** Revenue redistributed per decay schedule
- **FR119:** Escrow fund for decayed revenue
- **FR120:** Author return process defined
- **FR121:** Platform takeover process defined
- **FR122:** Consumer notification at each stage

### Client Protection

- **FR123:** Ownership changes trigger notification
- **FR124:** 30-day notice period enforced
- **FR125:** Consumer opt-out flow available
- **FR126:** "Walk away" results in clean termination
- **FR127:** Platform ensures service continuity
- **FR128:** Consumer decisions recorded on Truth Chain

### Dashboard & Visualization

- **FR129:** Role toggle: Trainer/Consumer view
- **FR130:** Trainer dashboard: agents, earnings, training
- **FR131:** Consumer dashboard: agents, usage, costs
- **FR132:** Academy tab: enrolled, progress, graduates
- **FR133:** Council tab: decisions, voting, precedents
- **FR134:** Observer tab: feed, anomalies, compliance
- **FR135:** Marketplace tab: listings, sales, stats
- **FR136:** Truth Chain tab: records, verification

### Notifications & Alerts

- **FR137:** Escalation alerts (high priority)
- **FR138:** Graduation notifications
- **FR139:** Anomaly alerts from Observers
- **FR140:** Ownership change notifications
- **FR141:** Earnings milestone notifications
- **FR142:** Configurable per alert type
- **FR143:** Email, in-app, webhook channels

### API & Integration

- **FR144:** RESTful API for all capabilities
- **FR145:** API authentication via keys
- **FR146:** Webhook support for events
- **FR147:** Public verification API (no auth)
- **FR148:** Rate limiting per tier
- **FR149:** OpenAPI 3.0 specification

---

## Non-Functional Requirements

### Performance

| Metric | Requirement | Rationale |
|--------|-------------|-----------|
| Council Decision Latency | < 5 seconds (MVP), < 1 second (Growth) | Governance shouldn't slow down agent work |
| Observer Log Ingestion | 1,000 events/second per tenant | Real-time logging is critical |
| Dashboard Load Time | < 2 seconds | Operators need quick access |
| API Response Time | < 200ms (P95) | Integration partners expect responsive APIs |
| Truth Chain Write | < 500ms | Recording shouldn't block operations |
| Verification API | < 100ms | Public verification must be instant |
| Marketplace Search | < 500ms | Browsing should feel instant |

### Security

**Authentication & Access:**
- All passwords hashed with bcrypt (cost factor 12+)
- MFA required for Admin/Trainer payouts
- Session tokens with 24-hour expiry
- API keys scoped to specific permissions

**Data Protection:**
- All data encrypted at rest (AES-256)
- All data encrypted in transit (TLS 1.3)
- Tenant data isolation at database level
- PII handling compliant with GDPR and CCPA

**Observer Isolation (Critical):**
- Observer service runs on separate infrastructure
- Observer has read-only database access
- No network path from Worker/Council to Observer control plane
- Cryptographic attestation of Observer integrity

**Code Protection:**
- Enterprise Lock code encrypted at rest
- Only author keys can decrypt locked code
- Platform holds escrow key for emergencies

### Scalability

**Horizontal Scaling:**
- Stateless API servers (auto-scale on load)
- Worker agent pool scales per demand
- Council validators scale with decision volume
- Observer shards by tenant namespace
- Marketplace search with Elasticsearch

**Multi-Region (Growth):**
- Primary region: US
- Expansion: EU, APAC
- Data residency options for compliance

### Reliability

| Metric | Requirement |
|--------|-------------|
| Platform Uptime | 99.9% (MVP), 99.99% (Enterprise) |
| Observer Uptime | 99.99% (audit layer must never go dark) |
| Truth Chain Availability | 99.999% |
| Data Durability | 99.999999999% (11 nines) |
| RTO (Recovery Time) | < 4 hours |
| RPO (Recovery Point) | < 1 hour |

---

## Architecture Overview

### Seven-Layer Governance Stack

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1: HUMAN (Supreme Authority)                              │
│ Role Evolution: Teacher → Judge → Auditor → Guardian            │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 2: OVERSIGHT COUNCIL                                      │
│ Orchestrator + Moral Guidance + Consistency Daemon              │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 3: VALIDATOR TRIBUNAL                                     │
│ Guardian, Arbiter, Scholar, Advocate                            │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 4: THE ACADEMY (University)                               │
│ Enrollment → Curriculum → Examination → Graduation              │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 5: TRUTH CHAIN (Blockchain)                               │
│ Decisions, Precedents, Certifications, Ownership, Audits        │
├─────────────────────────────────────────────────────────────────┤
│ ═══════════════ ISOLATION BARRIER ═══════════════               │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 6: OBSERVER SERVICE (External)                            │
│ Chronicler, Analyst, Auditor — Read-only, Incorruptible         │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 7: WORKER AGENTS (Execution)                              │
│ Project-scoped, Trust-governed, Council-supervised              │
└─────────────────────────────────────────────────────────────────┘
```

### Council Validator Personalities

| Validator | Domain | Voice | Approval Style |
|-----------|--------|-------|----------------|
| ⚖️ **Arbiter** | Ethics & Fairness | Philosophical, measured | "The scales balance. Proceed." |
| 🛡️ **Guardian** | Safety & Security | Pragmatic, protective | "Threat assessment: acceptable." |
| 📚 **Scholar** | Knowledge & Standards | Meticulous, precise | "Compliant with Articles 3.1, 7.4." |
| 🤝 **Advocate** | User Impact | Empathetic, protective | "The people served will benefit." |

### Certification Levels

| Level | Name | Badge | Trust Score | Autonomy |
|-------|------|-------|-------------|----------|
| 0 | ⚠️ Untrusted | — | 0-199 | None (training only) |
| 1 | 🌱 Novice | Bronze | 200-399 | Supervised, limited |
| 2 | ✅ Proven | Silver | 400-599 | Standard operations |
| 3 | 🛡️ Trusted | Gold | 600-799 | Autonomous in scope |
| 4 | 👑 Elite | Platinum | 800-899 | Full autonomy, can mentor |
| 5 | 🌟 Legendary | Diamond | 900-1000 | Can join Tribunal |

---

## PRD Summary

**Product:** AgentAnchor — The AI Governance Operating System

**Core Value Proposition:**
> "Other platforms ask you to trust AI. We give you an AI system that doesn't trust itself — with independent oversight you can audit."

**Tagline:** *"Agents you can anchor to."*

**Key Numbers:**
- **149 Functional Requirements** covering all platform capabilities
- **7 Architectural Layers** implementing separation of powers
- **6 Trust Tiers** from Untrusted (0) to Legendary (1000)
- **4 Council Validators** with distinct governance domains
- **3 Acquisition Models** (Commission, Clone, Enterprise Lock)
- **2 User Types** (Trainers and Consumers)

**MVP Focus:**
- Prove separation of powers works for AI
- Demonstrate open marketplace viability
- Validate commission-based economics
- Build foundation for category leadership

**What Makes This Unique:**
1. First platform with true separation of powers for AI
2. Open marketplace where anyone can build
3. Trust earned through behavior, not configuration
4. Publicly verifiable certifications on immutable chain
5. Client-first protection policy
6. Human role designed to fade as system matures

---

_This PRD captures the complete vision for AgentAnchor — the world's first AI Governance Operating System where trust isn't assumed, it's earned, proven, and verified._

_"Agents you can anchor to."_

_Created through collaborative discovery between frank the tank and BMad Master._
_Party Mode Brainstorm Sessions: 2025-11-28_
_Version 2.0: Added marketplace, portability, commission model, client protection_
