# AgentAnchor - Growth Phase PRD

**Author:** frank the tank
**Date:** 2025-12-06
**Version:** 3.0
**Base Document:** PRD v2.0 (MVP - 149 FRs, 100% Complete)

---

## Executive Summary

The **Growth Phase** extends AgentAnchor's MVP foundation with advanced monetization, platform reliability, and trainer empowerment features. This phase transforms AgentAnchor from a viable product into a scalable, self-sustaining marketplace.

### Growth Phase Goals

1. **Revenue Diversification** - Add Clone and Enterprise acquisition models beyond commission
2. **Platform Trust** - Implement MIA Protocol and full Client Bill of Rights
3. **Trainer Empowerment** - Enable maintenance delegation and specialization tracks
4. **Marketplace Depth** - Create sustainable ecosystem for long-term growth

### What's New in Growth

| Capability | MVP State | Growth State |
|------------|-----------|--------------|
| Acquisition Models | Commission only | Commission + Clone + Enterprise Lock |
| Trainer Delegation | Not available | Full MIA detection + delegation flow |
| Consumer Protection | Basic | Full Bill of Rights with 30-day notice |
| Academy Tracks | Core Curriculum | Core + Specializations + Mentorship |
| Agent Ownership | Single trainer | Transfer, delegate, platform takeover |

---

## Growth Phase Scope

### Growth Epic 9: Clone & Enterprise Acquisition

**Goal:** Diversify revenue beyond commission model with one-time purchases and enterprise exclusivity.

**User Value:**
- Trainers unlock premium pricing options for high-value agents
- Consumers get flexible acquisition models matching their needs
- Platform captures higher-value transactions

**FRs Covered:** FR14-15, FR28-29

---

### Growth Epic 10: MIA Protocol

**Goal:** Detect and handle missing-in-action trainers to protect consumers and platform integrity.

**User Value:**
- Consumers protected from abandoned agents
- Platform maintains marketplace quality
- Active trainers get more visibility

**FRs Covered:** FR116-122

---

### Growth Epic 11: Client Bill of Rights

**Goal:** Full consumer protection with ownership change notifications, opt-out flows, and clean termination.

**User Value:**
- Consumers feel truly protected with 30-day notice
- Walk-away termination builds trust
- Platform continuity even when trainers leave

**FRs Covered:** FR123-128

---

### Growth Epic 12: Maintenance Delegation

**Goal:** Allow trainers to delegate agent maintenance while retaining ownership and earnings.

**User Value:**
- Trainers can scale without burnout
- Skilled maintainers can earn income
- Agents get better care over time

**FRs Covered:** FR18-22

---

### Growth Epic 13: Academy Specializations & Mentorship

**Goal:** Extend Academy with specialized tracks and elite mentorship programs.

**User Value:**
- Agents gain deeper expertise in specific domains
- Mentored agents achieve higher trust faster
- Creates premium tier in marketplace

**FRs Covered:** FR47-48

---

### Growth Epic 14: Precedent Flywheel (MOAT BUILDER)

**Goal:** Build an AI-powered governance intelligence system that learns from every Council decision, creating an unassailable competitive moat.

**User Value:**
- Council decisions become more consistent over time
- Similar cases receive similar rulings (fairness)
- Governance quality compounds with usage
- Competitors cannot replicate years of governance wisdom

**Strategic Value:**
- Creates proprietary training data for validator fine-tuning
- Network effect: more decisions = smarter Council = more trust = more decisions
- Patent-protected learning mechanism

**FRs Covered:** FR150-156 (New)

---

### Growth Epic 15: Portable Trust Credentials (MOAT BUILDER)

**Goal:** Enable AgentAnchor-certified agents to carry their trust reputation anywhere, making AgentAnchor the universal trust authority for AI agents.

**User Value:**
- Agents can prove trustworthiness outside platform
- Third-party systems can verify agent credentials
- Trust follows the agent, not the platform

**Strategic Value:**
- Creates network effect beyond platform boundaries
- Verification API generates recurring revenue
- Positions AgentAnchor as industry standard
- Patent-protected credential system

**FRs Covered:** FR157-162 (New)

---

## Functional Requirements - Growth Phase

### Clone & Enterprise Acquisition (FR14-15, FR28-29)

**Trainer Clone Pricing:**
- FR14: Trainers can set clone pricing for their published agents
- FR15: Trainers can enable Enterprise Lock (exclusive consumer rights)

**Consumer Acquisition Options:**
- FR28: Consumers can acquire agents via Clone model (one-time purchase, self-hosted)
- FR29: Consumers can acquire agents via Enterprise Lock (exclusive rights, premium price)

**Clone Model Details:**
- Consumer pays one-time fee
- Receives agent definition for self-hosting
- No ongoing commission to trainer
- No platform updates after purchase
- Recorded on Truth Chain

**Enterprise Lock Details:**
- Consumer pays premium for exclusivity
- Agent removed from public marketplace
- Only this consumer can use the agent
- Trainer continues earning commission
- Time-limited or perpetual options

---

### MIA Protocol (FR116-122)

**MIA Detection:**
- FR116: System detects trainer inactivity (configurable threshold, default 30 days)
- FR117: System tracks last login, last agent update, last response time
- FR118: Graduated warning system: Notice → Warning → Critical → MIA

**MIA Handling:**
- FR119: MIA trainers receive escalating notifications across all channels
- FR120: After MIA threshold, consumers notified of trainer status
- FR121: Platform can assign temporary maintainer for critical agents
- FR122: After extended MIA, ownership transfer flow initiated

**MIA Status Display:**
- Trainer dashboard shows activity score
- Marketplace listings show trainer activity status
- Consumers can filter by trainer activity level

---

### Client Bill of Rights (FR123-128)

**Ownership Change Notifications:**
- FR123: Consumers receive notification when agent ownership may change
- FR124: Minimum 30-day notice period before any ownership change takes effect

**Consumer Opt-Out:**
- FR125: Consumers can opt out during notice period
- FR126: "Walk away clean" - no penalty termination during notice
- FR127: Platform guarantees service continuity during transition

**Protection Records:**
- FR128: All protection decisions recorded on Truth Chain

**Bill of Rights Display:**
- Clear explanation of rights on acquisition
- Rights reminder during ownership changes
- Easy-access opt-out button during notice period

---

### Maintenance Delegation (FR18-22)

**Delegation Setup:**
- FR18: Trainers can designate maintenance delegate
- FR19: Delegate receives limited access (update agent, respond to feedback)
- FR20: Trainer retains ownership and earnings

**Delegation Management:**
- FR21: Trainers can revoke delegation at any time
- FR22: Delegation history recorded on Truth Chain

**Delegate Permissions:**
- Can update agent system prompt
- Can respond to consumer feedback
- Can view agent analytics
- Cannot change pricing
- Cannot transfer ownership
- Cannot access earnings

---

### Academy Specializations & Mentorship (FR47-48)

**Specialization Tracks:**
- FR47: Graduated agents can enroll in Specialization tracks
- Tracks available: Customer Service, Data Analysis, Creative Writing, Code Review, Research, Legal, Medical (domain-specific)

**Specialization Benefits:**
- Additional Trust Score boost on completion (+50-100)
- Specialization badge displayed in marketplace
- Access to specialized tools and capabilities
- Higher commission rates for specialized tasks

**Elite Mentorship:**
- FR48: High-trust agents (700+) can mentor graduating agents
- Mentor agents receive Trust Score boost for successful mentees
- Mentored agents graduate with higher initial Trust Score (300-399 vs 200-299)
- Mentor relationship recorded on Truth Chain

---

### Precedent Flywheel (FR150-156) - NEW MOAT FRs

**Precedent Intelligence:**
- FR150: Every Council decision is indexed with structured metadata (action type, risk level, outcome, validator votes, rationale)
- FR151: System performs semantic similarity search to find relevant precedents for new requests
- FR152: Validators receive precedent context when evaluating requests ("Similar case #4721 was approved because...")
- FR153: Arbiter validator specifically trained on precedent matching and consistency enforcement

**Learning Mechanism:**
- FR154: System tracks decision consistency scores (similar cases → similar outcomes)
- FR155: Validator prompts are refined based on precedent corpus (quarterly fine-tuning cycles)
- FR156: Council accuracy improves measurably over time (tracked metric: consistency score)

**Precedent Corpus Characteristics:**
- Append-only (decisions cannot be removed)
- Cryptographically linked to Truth Chain
- Exportable for compliance (but not the trained models)
- Proprietary asset: the trained validator models stay on platform

---

### Portable Trust Credentials (FR157-162) - NEW MOAT FRs

**Credential Issuance:**
- FR157: Agents with Trust Score 250+ can request Portable Trust Credential (PTC)
- FR158: PTC contains trust score, tier, governance summary, and Truth Chain anchor
- FR159: PTC is cryptographically signed by AgentAnchor and expires after 24 hours

**Verification API:**
- FR160: Third-party systems can verify PTC via public API
- FR161: Verification confirms signature validity, expiration, and current trust state
- FR162: Verification API is rate-limited and monetized by tier

**Credential Contents:**
- Agent ID and trust score/tier
- Academy graduation status and specializations
- Governance summary (approval rate, escalation rate)
- Truth Chain hash for independent verification
- Mentor certification if applicable

---

## Non-Functional Requirements - Growth Phase

### Performance

- Clone package generation: <10 seconds
- MIA detection scan: Background, <1 hour cycles
- Ownership transfer: Atomic, <5 seconds
- Specialization enrollment: <3 seconds

### Security

- Clone packages encrypted with consumer's public key
- Delegation permissions enforced at API level
- MIA notifications authenticated to prevent spoofing
- Enterprise Lock contracts cryptographically signed

### Scalability

- MIA detection scales to 100K+ trainers
- Clone package CDN distribution
- Specialization tracks support 10K concurrent enrollments

### Data Integrity

- All ownership changes on Truth Chain
- Delegation history immutable
- MIA status changes logged
- Clone purchases recorded permanently

---

## Growth Phase Epic Summary

| Epic | Title | Stories (Est.) | Key FRs | Moat Type |
|------|-------|----------------|---------|-----------|
| 9 | Clone & Enterprise Acquisition | 5 | FR14-15, FR28-29 | Revenue |
| 10 | MIA Protocol | 5 | FR116-122 | Trust |
| 11 | Client Bill of Rights | 5 | FR123-128 | Trust |
| 12 | Maintenance Delegation | 4 | FR18-22 | Trainer UX |
| 13 | Academy Specializations | 4 | FR47-48 | Depth |
| 14 | **Precedent Flywheel** | 5 | FR150-156 | **DATA MOAT** |
| 15 | **Portable Trust Credentials** | 5 | FR157-162 | **NETWORK MOAT** |
| **Total** | | **33 Stories** | **37 FRs** | |

---

## Growth Phase Dependencies

```
Epic 9 (Clone/Enterprise) → No dependencies, can start immediately
Epic 10 (MIA Protocol) → No dependencies, can start immediately
Epic 11 (Client Protection) → Depends on Epic 10 (MIA triggers protection flows)
Epic 12 (Delegation) → Depends on Epic 10 (MIA can trigger delegation)
Epic 13 (Specializations) → Depends on MVP Epic 2 (Academy must exist)
```

**Recommended Parallel Tracks:**
- **Track A:** Epic 9 + Epic 13 (Revenue + Academy)
- **Track B:** Epic 10 + Epic 11 + Epic 12 (Platform Trust)

---

## Success Criteria - Growth Phase

**Quantitative:**
- 20% of acquisitions via Clone or Enterprise model
- <5% trainer MIA rate (active marketplace)
- 100% consumer opt-out success during notice period
- 30% of trainers using delegation feature
- 50% of agents with at least one specialization

**Qualitative:**
- Trainers say: "I can finally take a vacation"
- Consumers say: "I know I can walk away if I need to"
- High-value agents command premium pricing
- Academy produces specialized experts

---

## Next Steps

1. **Architecture Review** - Update system design for new capabilities
2. **Epic Breakdown** - Create stories for each Growth epic
3. **Sprint Planning** - Add Growth epics to sprint-status.yaml
4. **Implementation** - Begin Track A and Track B in parallel

---

*This PRD extends AgentAnchor v2.0 MVP with Growth Phase capabilities.*

*"Agents you can anchor to - now with even stronger chains."*
