# Vorion Stack Architecture

## Complete Technical Alignment Document
**Version 1.1 | January 10, 2026**

---

## Executive Summary

Vorion is a **governed cognition kernel** — infrastructure for trustworthy AI agent operations. This document defines the complete stack architecture, component relationships, and build order.

---

## 1. Lineage & Evolution

```
AURYN (Genesis)
"The Original Brain Structure & Rules"
├── Intent Taxonomy
├── Evaluator Architecture  
├── Rigor Scaling
└── Clarification Contract
         │
         │ + A3I Trust Layer (2024-2025)
         ▼
ATSF v3.4 (Agent Trust & Safety Framework)
"Auryn + Trust = Governed Cognition"
├── 6-Tier Trust Hierarchy (T0-T5)
├── Security Layers L0-L46
├── Memory Tensor
├── Cognitive Cube
└── Kill Switch
         │
         │ + Vorion Pipeline + Decision Provenance (2025-2026)
         ▼
COGNIGATE (Current)
"Trust-Enforced Cognition Runtime"
├── INTENT Layer (why/what)
├── ENFORCE Layer (allowed?)
├── PROOF Layer (evidence)
└── CHAIN Layer (verification)
         │
         │ consumed by
         ▼
┌────────┴────────┐
│                 │
TRUSTBOT      AGENTANCHOR
(B2C)            (B2B)
```

---

## 2. Domain Architecture

| Domain | Layer | Purpose | Content |
|--------|-------|---------|---------|
| **vorion.org** | Corporate | Parent entity | Investor materials, strategic positioning, company info |
| **learn.vorion.org** | Education | Documentation | BASIS spec, tutorials, certification guides, API reference |
| **cognigate.dev** | Developer | Platform | SDK downloads, playground, integration guides, examples |

---

## 3. Component Hierarchy

### 3.1 Vorion (Parent Entity)

**vorion.org** — The governed cognition kernel company.

**Positioning:** "The cognitive trust substrate for agentic systems."

Not an app. Not a chatbot. An **infrastructure layer**.

### 3.2 BASIS Standard (Open Specification)

**Location:** learn.vorion.org
**License:** CC BY 4.0

The open specification defining what must happen before an AI agent acts.

**Four Layers:**

| Layer | Purpose | Key Question | Implementation |
|-------|---------|--------------|----------------|
| INTENT | Understand goals | "What is being attempted?" | Intent Taxonomy, Rigor Scaling |
| ENFORCE | Check permissions | "Should this be permitted?" | Trust Scoring, Capability Gating |
| PROOF | Create audit trail | "What happened and why?" | Decision Provenance, Cognitive Cube |
| CHAIN | Immutable verification | "Can this be verified?" | Blockchain Anchoring (Polygon) |

### 3.3 Cognigate Runtime

**Location:** cognigate.dev
**Type:** Trust-Enforced Cognition Runtime

Cognigate is the runtime implementation of the BASIS standard. It contains:

#### 3.3.1 Auryn Core (Genesis Layer)

The original brain structure and rules:

```typescript
// Intent Taxonomy
enum IntentClass {
  UNDERSTAND,  // Comprehension queries
  REFERENCE,   // Lookup/retrieval
  EVALUATE,    // Analysis/assessment
  DECIDE,      // Choice selection
  PLAN,        // Strategy formation
  BUILD,       // Creation/construction
  DEBUG,       // Problem diagnosis
  EXECUTE      // Action execution (restricted)
}

// Rigor Levels
enum RigorLevel {
  LIGHT,     // Quick response, minimal evidence
  STANDARD,  // Balanced depth
  DEEP       // Comprehensive analysis, full evidence
}

// Clarification Contract
// - At most ONE clarifying question
// - If ambiguity remains → proceed with explicit assumptions
```

#### 3.3.2 ATSF v3.4 (Trust Layer)

The trust and safety framework layered onto Auryn:

| ATSF Component | Cognigate Role |
|----------------|----------------|
| Memory Tensor | Cognigate Memory Plane |
| Cognitive Cube | PROOF Engine |
| Security Layers (L0-L46) | ENFORCE Runtime |
| Basis Reminders | INTENT Guardrails |
| AI TRiSM | External Compliance Interface |
| 6-Tier Trust Hierarchy | Trust Scoring (0-1000) |
| Kill Switch | Progressive Containment |

**Trust Tiers:**

| Tier | Score Range | Capabilities |
|------|-------------|--------------|
| T0 | 0-100 | Zero Trust — no capabilities |
| T1 | 101-250 | Minimal — basic read-only |
| T2 | 251-450 | Limited — constrained writes |
| T3 | 451-650 | Standard — normal operations |
| T4 | 651-850 | Elevated — advanced capabilities |
| T5 | 851-1000 | Supreme — full autonomous |

#### 3.3.3 Vorion Pipeline (Orchestration)

The invariant execution pipeline:

```
Request
 → Validation
 → Intent Classification
 → Rigor & Risk Scaling
 → Governance / Authority Arbitration
 → Plan Construction
 → Evaluator Selection
 → Evaluator Execution
 → Output Normalization
 → Evidence + Assumptions Ledger
 → Confidence + Invalidity Conditions
 → Trace + Audit
 → Response
```

**All features must compose onto this pipeline, not bypass it.**

#### 3.3.4 Decision Provenance Objects (DPO)

Court-defensible reasoning records:

```typescript
interface DecisionProvenanceObject {
  decision_id: string;
  trigger_event: string;
  rules_considered: Rule[];
  rules_applied: Rule[];
  causal_chains_evaluated: CausalChain[];
  confidence_score: number;  // 0-1
  counterfactuals_rejected: Counterfactual[];
  trace: Trace;
}
```

#### 3.3.5 ATSF-Ralph Integration

Autonomous loop governance for productivity without sacrificing safety:

| Mode | Use Case | Oversight | Overhead |
|------|----------|-----------|----------|
| SUPERVISED | High-risk | Every iteration | ~40% |
| CHECKPOINT | Complex tasks | Every N iterations | ~15% |
| GUARDRAILED | Daily dev | Automatic | <5% |
| AUTONOMOUS | Low-risk | Post-hoc | <1% |
| NIGHTSHIFT | Batch runs | Minimal | <0.5% |

**Philosophy:** "Signs not walls" — dynamic guardrails that guide rather than block.

### 3.4 Products (Consume Cognigate)

#### TrustBot (B2C Frontend)

**Purpose:** Consumer-facing AI assistant demonstrating trust-gated capabilities.

**Features:**
- Progressive capability unlocking
- Fading human-in-the-loop
- Aggressiveness slider
- Visible governance decisions
- Reference implementation of BASIS

**Role:** Proves the standard works. "This is what correct looks like."

#### AgentAnchor (B2B Certification Portal)

**Purpose:** Certification authority for third-party AI agents.

**Features:**
- Agent registry & marketplace
- Certification workflows
- Trust scoring dashboard
- Compliance audit tools
- Token economy (ANCR/TRST)

**Role:** "UL listing for AI agents"

---

## 4. Package Architecture

### NPM Packages

| Package | Contents | Purpose |
|---------|----------|---------|
| `@vorion/cognigate-core` | Runtime SDK | Core cognition engine |
| `@vorion/basis-protocol` | TypeScript types | Standard definitions |
| `@vorion/agentanchor-sdk` | React hooks & components | Certification UI |
| `@vorion/atsf-ralph` | Autonomous loop governance | Ralph integration |

### Repository Structure

```
vorion/
├── packages/
│   ├── cognigate-core/        # Runtime engine
│   │   ├── src/
│   │   │   ├── intent/        # Auryn intent system
│   │   │   ├── governance/    # ATSF trust layer
│   │   │   ├── planner/       # Pipeline orchestration
│   │   │   ├── evaluators/    # Baseline evaluators
│   │   │   ├── proof/         # DPO & audit
│   │   │   └── ralph/         # Autonomous loop integration
│   │   └── package.json
│   │
│   ├── basis-protocol/        # Type definitions
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   ├── constants.ts
│   │   │   └── utils.ts
│   │   └── package.json
│   │
│   └── agentanchor-sdk/       # React SDK
│       ├── src/
│       │   ├── hooks/
│       │   ├── components/
│       │   └── client.ts
│       └── package.json
│
├── apps/
│   ├── trustbot/              # B2C frontend
│   └── agentanchor/           # B2B portal
│
├── docs/                      # learn.vorion.org source
└── infra/                     # Deployment configs
```

---

## 5. Infrastructure

### Deployment Architecture

| Component | Platform | Purpose |
|-----------|----------|---------|
| TrustBot Frontend | Vercel | Consumer app |
| AgentAnchor Frontend | Vercel | B2B portal |
| Cognigate API | Fly.io | Runtime engine |
| Database | Supabase | PostgreSQL + Auth |
| Blockchain | Polygon | PROOF anchoring |
| Docs | Vercel | learn.vorion.org |

### Cost Model

| Service | Estimated Annual Cost |
|---------|----------------------|
| Vercel (3 apps) | $240 |
| Fly.io (API) | $600 |
| Supabase (Pro) | $300 |
| Polygon Anchoring | $640 |
| **Total** | **~$1,780/year** |

---

## 6. Build Order (Enforced)

Per the Vorion Build Spec, implementation must follow this sequence:

### Phase 1: Foundation
1. **Output Contracts** — VorionResponse, VorionErrorResponse, Trace, Evidence
2. **Governance Engine** — Rule hierarchy, enforcement, conflict resolution
3. **Intent System** — Taxonomy, classifier, rigor scaling, clarification

### Phase 2: Orchestration
4. **Planner** — Plan builder, executor, pipeline orchestration
5. **Evaluator Registry** — Interface, validation, baseline evaluators
6. **Decision Provenance** — DPO implementation, causal chain tracking

### Phase 3: Production Hardening
7. **API Hardening** — Middleware, routes, health/version endpoints
8. **Observability & Audit** — Structured logging, trace capture, audit log
9. **Determinism & Replay** — Recording, replay fidelity

### Phase 4: Trust Extensions
10. **Trust Arbitration** — Multi-agent conflict resolution
11. **Progressive Containment** — Graded kill switch modes
12. **Typed Security Layers** — Interface definitions for L0-L46
13. **ATSF-Ralph** — Autonomous loop integration

### Phase 5: Products
14. **TrustBot** — Consumer frontend
15. **AgentAnchor** — B2B certification portal

---

## 7. Acceptance Criteria

### Per-Component Requirements

**Output Contracts:**
- API never returns raw strings or unstructured objects
- All success + failure paths conform to contract
- Schema tests exist

**Governance Engine:**
- Identical inputs → identical rule outcomes
- Tests prove hard-rule refusal
- Governance runs BEFORE evaluator execution

**Intent System:**
- Deterministic classification
- Rigor impacts output structure
- Clarification behavior tested

**Planner:**
- Trace shows step timings
- Failures stop execution cleanly
- Planner is deterministic

**Evaluator Registry:**
- Drop-in evaluator addition
- Registry tests exist
- Evaluator selection deterministic

**Determinism & Replay:**
- Recorded run replays deterministically
- Non-deterministic outputs explicitly marked

### System-Wide Requirements

- All tests pass
- Docker build/run works
- curl example returns valid VorionResponse
- No undocumented env vars
- No unhandled promise rejections

---

## 8. Strategic Positioning

### Market Position

**Vorion as:** "The cognitive trust substrate for agentic systems."

### Competitive Advantages

1. **Working Production Systems** — Not vaporware
2. **Open Standard (BASIS)** — Network effects without lock-in
3. **Regulatory Alignment** — EU AI Act compliant
4. **Domain Expertise** — 20 years B2B SaaS + ops experience
5. **Reference Implementation** — TrustBot proves viability

### Target Markets

| Segment | Product | Pain Point |
|---------|---------|------------|
| Enterprise AI Teams | AgentAnchor | "Can't deploy without governance" |
| AI Agent Builders | Cognigate SDK | "Need trust infrastructure" |
| Consumers | TrustBot | "Don't trust AI autonomy" |
| Regulators | BASIS Standard | "Need verifiable compliance" |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-10 | Initial alignment |
| 1.1 | 2026-01-10 | Added Auryn lineage, removed AIq |
