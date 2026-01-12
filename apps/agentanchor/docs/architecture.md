# AgentAnchor - System Architecture

**Version:** 3.0
**Date:** 2025-12-05
**Status:** Planning (Architecture Complete)
**Architect:** frank the tank + BMad System Architect (Winston)

---

## Executive Summary

AgentAnchor is the world's first **AI Governance Operating System** — an open marketplace where AI agents are trained, certified, governed, and traded through an unprecedented separation of powers architecture.

**Core Architectural Principles:**
1. **Separation of Powers** - Worker, Council, and Observer layers cannot influence each other
2. **Trust Through Proof** - Everything verifiable on the Truth Chain
3. **Client-First Design** - Consumer protection built into every layer
4. **Open Marketplace** - Anyone can build, governance ensures quality
5. **Council of Nine** - Epic-level governance with 9 specialized validators

**Tagline:** *"Agents you can anchor to."*

---

## What's New in v3.0

| Feature | Description |
|---------|-------------|
| **Council of Nine** | Expanded from 4 to 9 validators with specialized domains |
| **Elder Wisdom Council** | 3 advisory bots (Steward, Conscience, Witness) |
| **LangGraph.js** | Agent orchestration framework for stateful flows |
| **Unified Marketplace** | Single marketplace with live ticker, prebuilt agents, and custom requests |
| **Live Ticker** | Stock-market-style feed showing real-time marketplace activity |
| **Custom Agent Requests** | Consumers can post requests, trainers can bid |
| **Redis Caching** | Trust scores and marketplace data caching |

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Council of Nine Architecture](#3-council-of-nine-architecture)
4. [Seven-Layer Governance Architecture](#4-seven-layer-governance-architecture)
5. [Observer Layer Isolation](#5-observer-layer-isolation)
6. [Truth Chain Design](#6-truth-chain-design)
7. [Unified Marketplace](#7-unified-marketplace)
8. [Data Model](#8-data-model)
9. [API Design](#9-api-design)
10. [Frontend Architecture](#10-frontend-architecture)
11. [Real-Time Architecture](#11-real-time-architecture)
12. [Security Architecture](#12-security-architecture)
13. [Implementation Patterns](#13-implementation-patterns)
14. [Infrastructure](#14-infrastructure)
15. [Key Design Decisions](#15-key-design-decisions)
16. [Implementation Phases](#16-implementation-phases)

---

## 1. System Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACES                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Trainer   │  │  Consumer   │  │   Public    │  │    Admin    │        │
│  │  Dashboard  │  │  Dashboard  │  │ Verification│  │   Console   │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
└─────────┼────────────────┼────────────────┼────────────────┼────────────────┘
          │                │                │                │
          └────────────────┴────────────────┴────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         UNIFIED MARKETPLACE                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ◄◄ LIVE TICKER ►► Agent listed | Agent acquired | Request posted   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                        │
│  │  PREBUILT   │  │   CUSTOM    │  │  MY AGENTS  │                        │
│  │   AGENTS    │  │  REQUESTS   │  │             │                        │
│  └─────────────┘  └─────────────┘  └─────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        API GATEWAY (Vercel Edge)                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │    Auth     │  │   Rate      │  │  Validation │  │   Routing   │        │
│  │  Middleware │  │   Limiter   │  │   Layer     │  │   Layer     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
┌─────────────────┐    ┌─────────────────────────────┐    ┌─────────────────┐
│ OPERATIONAL     │    │      COUNCIL OF NINE        │    │ VERIFICATION    │
│                 │    │                             │    │                 │
│ ┌─────────────┐ │    │  ┌─────────────────────┐   │    │ ┌─────────────┐ │
│ │   Worker    │ │    │  │ ELDER WISDOM COUNCIL│   │    │ │   Public    │ │
│ │   Agents    │ │    │  │ Steward│Conscience │   │    │ │   Verify    │ │
│ │ (LangGraph) │ │    │  │      │Witness      │   │    │ │   API       │ │
│ └──────┬──────┘ │    │  └─────────┬───────────┘   │    │ └─────────────┘ │
│        │        │    │            │ Advises       │    │ ┌─────────────┐ │
│ ┌──────▼──────┐ │    │  ┌─────────▼───────────┐   │    │ │   Trust     │ │
│ │   Academy   │ │    │  │THE NINE VALIDATORS  │   │    │ │   Portal    │ │
│ │  Training   │ │    │  │1-Guardian 6-Sentinel│   │    │ └─────────────┘ │
│ └─────────────┘ │    │  │2-Arbiter  7-Adversary│  │    │                 │
│                 │    │  │3-Scholar  8-Oracle  │   │    │                 │
└────────┬────────┘    │  │4-Advocate 9-Orchestr│   │    └─────────────────┘
         │             │  │5-Economist          │   │
         │             │  └─────────────────────┘   │
         │             └────────────┬───────────────┘
         │                          │
         │  Events (One-Way)        │ Decisions
         ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TRUTH CHAIN                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Hash Chain (PostgreSQL) ──► Merkle Tree ──► Trillian (Future)      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         │  (One-Way - No Return Path)
         ▼
╔═════════════════════════════════════════════════════════════════════════════╗
║                           ISOLATION BARRIER                                  ║
╚═════════════════════════════════════════════════════════════════════════════╝
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              OBSERVER ZONE                                   │
│                         (Completely Isolated)                                │
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │ Chronicler  │    │  Analyst    │    │  Auditor    │                     │
│  │  (Logger)   │    │ (Patterns)  │    │ (Compliance)│                     │
│  └─────────────┘    └─────────────┘    └─────────────┘                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Core Entities

| Entity | Description | Key Relationships |
|--------|-------------|-------------------|
| **User** | Platform user (Trainer or Consumer) | Owns Agents, Conversations |
| **Agent** | AI assistant with governance | Has Trust Score, Certifications |
| **Council of Nine** | 9 specialized validators | Votes on Decisions |
| **Elder Wisdom** | 3 advisory bots | Advises Council |
| **Trust Score** | 0-1000 credibility metric | Belongs to Agent |
| **Certification** | Academy completion record | Recorded on Truth Chain |
| **Custom Request** | Consumer request for custom agent | Has Bids from Trainers |
| **Marketplace Listing** | Published agent for sale | Links Agent, Terms |
| **Truth Chain Record** | Immutable decision record | Cryptographically linked |

---

## 2. Technology Stack

### 2.1 Core Technologies

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Framework** | Next.js | 14.x | React framework, App Router, SSR/RSC |
| **Language** | TypeScript | 5.x | Type safety |
| **UI** | React | 18.x | UI library |
| **Styling** | Tailwind CSS | 3.x | Utility-first CSS |
| **Components** | shadcn/ui | Latest | Component library |
| **Orchestration** | LangGraph.js | Latest | Stateful agent workflows |

### 2.2 Backend Services

| Service | Technology | Purpose |
|---------|------------|---------|
| **API** | Next.js API Routes | Serverless endpoints |
| **Auth** | Supabase Auth | Authentication & sessions |
| **Database** | PostgreSQL (Supabase) | Operational data with RLS |
| **Cache** | Redis (Upstash) | Trust scores, rate limiting |
| **Real-time** | Pusher | Live ticker, notifications |
| **AI** | Anthropic Claude | Council validators, agent chat |
| **Logging** | Pino | Structured JSON logs |

### 2.3 Data Layer

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Operational DB** | PostgreSQL (Supabase) | Users, agents, marketplace |
| **Truth Chain** | PostgreSQL + Hash Chain | Immutable audit records |
| **Observer DB** | TimescaleDB | Time-series event logs |
| **Cache** | Redis (Upstash) | Hot data, rate limits |
| **Future: Trillian** | Google Trillian | Verifiable logs (post-MVP) |

### 2.4 Infrastructure

| Service | Purpose |
|---------|---------|
| Vercel | Edge hosting, serverless |
| Supabase | Managed PostgreSQL, Auth, RLS |
| Upstash Redis | Serverless Redis |
| Pusher | Real-time messaging |
| Stripe | Payments, payouts |
| Sentry | Error tracking |

---

## 3. Council of Nine Architecture

### 3.1 The Nine Validators

```
                    ┌─────────────────────────────────────────┐
                    │          ELDER WISDOM COUNCIL           │
                    │   Steward │ Conscience │ Witness        │
                    │        (Advisory Input Only)            │
                    └─────────────────┬───────────────────────┘
                                      │ Informs
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COUNCIL OF NINE                                    │
│                                                                              │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐              │
│   │    1    │ │    2    │ │    3    │ │    4    │ │    5    │              │
│   │Guardian │ │ Arbiter │ │ Scholar │ │Advocate │ │Economist│              │
│   │ Safety  │ │Precedent│ │Analysis │ │  User   │ │  Value  │              │
│   └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘              │
│        │           │           │           │           │                    │
│   ┌────┴────┐ ┌────┴────┐ ┌────┴────┐ ┌────┴────────────┘                  │
│   │    6    │ │    7    │ │    8    │ │        9        │                  │
│   │Sentinel │ │Adversary│ │ Oracle  │ │  ORCHESTRATOR   │◄── Tie-breaker   │
│   │Complianc│ │Red Team │ │Longterm │ │   Synthesis     │                  │
│   └─────────┘ └─────────┘ └─────────┘ └─────────────────┘                  │
│                                                                              │
│   Voting: 5 of 9 for approval │ Dissent recorded │ Confidence scores       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Validator Responsibilities

| # | Validator | Domain | Responsibility |
|---|-----------|--------|----------------|
| 1 | **Guardian** | Safety & Risk | Evaluates security threats, potential harms, data exposure |
| 2 | **Arbiter** | Justice & Precedent | Ensures consistency, references precedent library |
| 3 | **Scholar** | Knowledge & Analysis | Deep technical analysis, research synthesis, accuracy |
| 4 | **Advocate** | User Champion | Represents user interests, accessibility, experience |
| 5 | **Economist** | Value & Sustainability | Assesses economic impact, platform health, sustainability |
| 6 | **Sentinel** | Compliance & Regulation | EU AI Act, GDPR, industry regulations |
| 7 | **Adversary** | Red Team | Challenges assumptions, finds weaknesses, devil's advocate |
| 8 | **Oracle** | Long-term Consequences | Predicts downstream effects, systemic risk, future impact |
| 9 | **Orchestrator** | Synthesis & Resolution | Tie-breaker, writes final rationale, coordinates deliberation |

### 3.3 Elder Wisdom Council (Advisors)

Non-voting advisors that inform deliberations:

| Advisor | Role | Input |
|---------|------|-------|
| **Steward** | Platform Health | Long-term sustainability, ecosystem balance |
| **Conscience** | Ethics | Moral implications beyond compliance |
| **Witness** | Transparency | Ensuring proceedings are accountable |

### 3.4 Enhanced Governance Features

| Feature | Description |
|---------|-------------|
| **Public Council Proceedings** | Deliberations visible to stakeholders (configurable) |
| **Three-Bot Review** | 3 validators pre-screen before full Council for efficiency |
| **Dissent Recording** | Minority opinions preserved for precedent |
| **Confidence Scores** | Each validator provides 0-100 confidence with vote |
| **Precedent Library** | Searchable database of past decisions for consistency |
| **Public Trust Portal** | External visibility into Council decisions |
| **Council Decision Cards** | Structured output format for transparency |

### 3.5 Deliberation Flow

```typescript
interface CouncilDeliberation {
  caseId: string;

  // Phase 1: Wisdom Council Input
  wisdomInput: {
    steward?: string;
    conscience?: string;
    witness?: string;
  };

  // Phase 2: Parallel Evaluation (LangGraph)
  validatorEvaluations: ValidatorVote[]; // 9 parallel evaluations

  // Phase 3: Orchestrator Synthesis
  orchestratorSynthesis: {
    verdict: 'APPROVE' | 'DENY' | 'ESCALATE';
    rationale: string;
    confidence: number;
    dissent: DissentRecord[];
    precedentReference?: string;
  };

  // Phase 4: Truth Chain Recording
  truthChainHash: string;
}

interface ValidatorVote {
  validatorId: string;
  validatorName: string;
  vote: 'APPROVE' | 'DENY' | 'ABSTAIN';
  rationale: string;
  confidence: number; // 0-100
  processingTimeMs: number;
}
```

### 3.6 Voting Rules

| Scenario | Requirement | Outcome |
|----------|-------------|---------|
| 5+ APPROVE | Simple majority | APPROVED |
| 5+ DENY | Simple majority | DENIED |
| 4-4-1 or ties | No majority | ESCALATE to Human |
| Critical risk (L4) | 7+ APPROVE | Required for approval |
| Human override | Any decision | Recorded, can reverse |

---

## 4. Seven-Layer Governance Architecture

### 4.1 Layer Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1: HUMAN (Supreme Authority)                              │
│ Role Evolution: Teacher → Judge → Auditor → Guardian            │
│ • Receives escalations for Level 4 decisions                    │
│ • Can override Council (logged to Truth Chain)                  │
│ • Configures governance parameters                              │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 2: COUNCIL OF NINE                                        │
│ 9 Validators + 3 Wisdom Advisors                                │
│ • Guardian, Arbiter, Scholar, Advocate, Economist               │
│ • Sentinel, Adversary, Oracle, Orchestrator                     │
│ • Steward, Conscience, Witness (advisory)                       │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 3: THE ACADEMY (Training & Certification)                 │
│ Enrollment → Curriculum → Examination → Graduation              │
│ • Core curriculum for all agents                                │
│ • Specialization tracks                                         │
│ • Council examination for certification                         │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 4: TRUTH CHAIN (Immutable Records)                        │
│ Hash Chain → Merkle Tree → Trillian (Future)                    │
│ • Every decision cryptographically linked                       │
│ • 6+ month retention for EU AI Act                              │
│ • Public verification API                                       │
├─────────────────────────────────────────────────────────────────┤
│ ═══════════════ ISOLATION BARRIER ═══════════════               │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 5: OBSERVER SERVICE (External Audit)                      │
│ Chronicler, Analyst, Auditor — Read-only, Incorruptible         │
│ • Cannot influence operations                                   │
│ • Append-only logs                                              │
│ • Anomaly detection                                             │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 6: UNIFIED MARKETPLACE                                    │
│ Prebuilt Agents + Custom Requests + Live Ticker                 │
│ • Single marketplace experience                                 │
│ • Real-time activity feed                                       │
│ • Commission-based model (Clone/Enterprise future)              │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 7: WORKER AGENTS (Execution)                              │
│ LangGraph-orchestrated, Trust-governed, Council-supervised      │
│ • Execute tasks within trust boundaries                         │
│ • Request Upchain approval for high-risk actions                │
│ • Trust Score determines autonomy level                         │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Risk Levels & Approval Requirements

| Level | Name | Council Requirement | Example Actions |
|-------|------|---------------------|-----------------|
| L0 | Routine | Auto (logged) | Read data, format text |
| L1 | Standard | Auto (logged) | Generate content, analyze |
| L2 | Elevated | 3-Bot Review | External API call, create file |
| L3 | Significant | Full Council (5/9) | Modify system, send email |
| L4 | Critical | Supermajority (7/9) + Human | Delete data, financial action |

---

## 5. Observer Layer Isolation

### 5.1 Isolation Principles

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         EXECUTION LAYER (VPC-A)                             │
│   Workers │ Council │ Marketplace │ Academy                                │
│                                                                             │
│   ──────────────────── ONE-WAY WRITE ────────────────────────►             │
└────────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼ (Write-only API, no read access)
┌────────────────────────────────────────────────────────────────────────────┐
│                         OBSERVER LAYER (VPC-B)                              │
│   ┌──────────────────────────────────────────────────────────────────┐     │
│   │                    TRUTH CHAIN (Immutable)                        │     │
│   │   Hash-linked entries │ 6-month retention │ Tamper-evident       │     │
│   └──────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                        │
│   │  Chronicler │  │   Analyst   │  │   Auditor   │                        │
│   │ Event logs  │  │  Patterns   │  │ Compliance  │                        │
│   └─────────────┘  └─────────────┘  └─────────────┘                        │
│                                                                             │
│   NO WRITE ACCESS BACK TO EXECUTION LAYER                                   │
└────────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼ (Read-only feeds)
┌────────────────────────────────────────────────────────────────────────────┐
│                         PUBLIC INTERFACES                                   │
│   Observer Dashboard │ Trust Portal │ Compliance Reports │ Real-time Feed │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Observer Components

| Component | Responsibility |
|-----------|---------------|
| **Chronicler** | Logs all events with timestamps and metadata |
| **Analyst** | Detects patterns, anomalies, trends |
| **Auditor** | Generates compliance reports, EU AI Act documentation |

---

## 6. Truth Chain Design

### 6.1 Hash Chain Structure

```typescript
interface TruthChainEntry {
  id: string;                    // UUID
  timestamp: Date;               // When recorded
  entryType: 'ACTION' | 'DECISION' | 'ESCALATION' | 'ACQUISITION';

  // The actual data
  payload: {
    actorId: string;             // Agent or user ID
    actorType: 'AGENT' | 'COUNCIL' | 'HUMAN';
    action: string;              // What happened
    context: Record<string, any>;// Supporting data
    outcome: string;             // Result
  };

  // Immutability chain
  previousHash: string;          // Hash of previous entry
  currentHash: string;           // SHA-256(timestamp + payload + previousHash)

  // Signatures
  actorSignature: string;        // Signed by actor's keypair
  observerSignature: string;     // Countersigned by Observer
}
```

### 6.2 Verification Flow

```
Entry N-1                    Entry N                      Entry N+1
┌──────────┐                ┌──────────┐                 ┌──────────┐
│ hash: A  │───────────────►│prevHash:A│────────────────►│prevHash:B│
│          │                │ hash: B  │                 │ hash: C  │
└──────────┘                └──────────┘                 └──────────┘
                                 │
                                 ▼
                    If B ≠ SHA256(payload + A)
                    → TAMPERING DETECTED
```

### 6.3 Record Types

| Type | Trigger | Retention |
|------|---------|-----------|
| `certification.issued` | Graduation | Permanent |
| `council.decision` | Any Council vote | 6+ months |
| `ownership.transferred` | Agent transfer | Permanent |
| `human.override` | Human override | Permanent |
| `trust.milestone` | Tier change | 2 years |
| `client.walkaway` | Consumer opt-out | 2 years |
| `acquisition.complete` | Agent purchased | Permanent |

---

## 7. Unified Marketplace

### 7.1 Marketplace Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         UNIFIED MARKETPLACE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    ◄◄  LIVE TICKER  ►►                              │    │
│  │  🟢 "DataBot" listed (847 Trust) │ 🔵 "AnalystPro" acquired by...   │    │
│  │  🟡 Custom: "Healthcare bot" - 3 bids │ 🟢 "SalesHelper" listed...   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  FILTERS: [Trust Score ▼] [Category ▼] [Price ▼] [Acquisition ▼]   │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌───────────┬───────────┬───────────┐                                      │
│  │  PREBUILT │  CUSTOM   │ MY AGENTS │◄── Tab navigation                   │
│  │  AGENTS   │ REQUESTS  │           │                                      │
│  └───────────┴───────────┴───────────┘                                      │
│                                                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                           │
│  │ Agent 1 │ │ Agent 2 │ │ Agent 3 │ │ Agent 4 │ ...                       │
│  │  ★ 847  │ │  ★ 723  │ │  ★ 912  │ │  ★ 445  │                           │
│  │ $99/mo  │ │ $49/mo  │ │ $199/mo │ │ $29/mo  │                           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Live Ticker Event Types

| Icon | Event Type | Description |
|------|------------|-------------|
| 🟢 | `LISTING_CREATED` | New agent listed for sale |
| 🔵 | `ACQUISITION_COMPLETE` | Agent purchased |
| 🟡 | `REQUEST_CREATED` | New custom agent request posted |
| 🟠 | `BID_PLACED` | Trainer bid on custom request |
| 🔴 | `TRUST_CHANGED` | Significant trust score change |
| ⚪ | `COUNCIL_DECISION` | Council ruled on case |
| 🟣 | `GRADUATION` | Agent graduated from Academy |

### 7.3 Custom Request Flow

```
Consumer Posts Request
        │
        ▼
┌───────────────────┐
│ "I need a bot for │
│ healthcare claims │
│ processing"       │
│ Budget: $150/mo   │
└────────┬──────────┘
         │
         ▼
┌───────────────────────────────────────┐
│         TRAINER BIDS                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │Trainer A│ │Trainer B│ │Trainer C│  │
│  │$120/mo  │ │$145/mo  │ │$130/mo  │  │
│  │TS: 847  │ │TS: 723  │ │TS: 912  │  │
│  └─────────┘ └─────────┘ └─────────┘  │
└───────────────────┬───────────────────┘
                    │
                    ▼
        Consumer Selects Trainer
                    │
                    ▼
        Agent Built & Deployed
                    │
                    ▼
        Recorded to Truth Chain
```

### 7.4 Acquisition Models

| Model | Description | Revenue Split |
|-------|-------------|---------------|
| **Commission** | Pay-per-use, agent stays with trainer | Platform 15%/10%/7%, Trainer 85%/90%/93% |
| **Clone** | One-time purchase, own your copy | Platform 20%, Trainer 80% |
| **Enterprise** | Dedicated instance, code locked | Negotiated |

---

## 8. Data Model

### 8.1 Core Tables

```sql
-- Council of Nine Decisions
CREATE TABLE council_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL,
  agent_id UUID REFERENCES agents(id),

  -- Request
  action_type VARCHAR(100) NOT NULL,
  action_details JSONB NOT NULL,
  risk_level INT NOT NULL CHECK (risk_level >= 0 AND risk_level <= 4),

  -- Wisdom Council Input
  wisdom_input JSONB, -- {steward, conscience, witness}

  -- Nine Validator Votes
  votes JSONB NOT NULL, -- Array of 9 votes

  -- Orchestrator Synthesis
  verdict VARCHAR(20) NOT NULL, -- 'APPROVED', 'DENIED', 'ESCALATED'
  orchestrator_rationale TEXT NOT NULL,
  overall_confidence INT NOT NULL,

  -- Dissent
  dissent JSONB, -- Array of dissenting opinions

  -- Precedent
  precedent_reference UUID REFERENCES council_decisions(id),
  creates_precedent BOOLEAN DEFAULT FALSE,

  -- Human Override
  human_override JSONB, -- {user_id, decision, reasoning}

  -- Truth Chain
  truth_chain_hash VARCHAR(64) NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom Agent Requests
CREATE TABLE custom_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID REFERENCES users(id) NOT NULL,

  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(100),
  requirements JSONB,

  budget_min DECIMAL(10,2),
  budget_max DECIMAL(10,2),

  status VARCHAR(20) DEFAULT 'open', -- 'open', 'bidding', 'selected', 'completed', 'cancelled'
  selected_bid_id UUID,

  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bids on Custom Requests
CREATE TABLE request_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES custom_requests(id) NOT NULL,
  trainer_id UUID REFERENCES users(id) NOT NULL,

  proposed_price DECIMAL(10,2) NOT NULL,
  proposed_timeline VARCHAR(100),
  proposal TEXT NOT NULL,

  trainer_trust_score INT, -- Snapshot at bid time

  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'withdrawn'

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Marketplace Activity (for ticker)
CREATE TABLE marketplace_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,

  agent_id UUID,
  agent_name VARCHAR(255),
  trainer_id UUID,
  consumer_id UUID,

  trust_score INT,
  price DECIMAL(10,2),

  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 8.2 Trust Score Tiers

```sql
-- Trust tier calculation (updated thresholds)
CREATE OR REPLACE FUNCTION get_trust_tier(score INT)
RETURNS VARCHAR(20) AS $$
BEGIN
  RETURN CASE
    WHEN score < 100 THEN 'untrusted'
    WHEN score < 250 THEN 'probation'
    WHEN score < 500 THEN 'developing'
    WHEN score < 750 THEN 'established'
    WHEN score < 900 THEN 'trusted'
    ELSE 'legendary'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

---

## 9. API Design

### 9.1 API Structure

```
/api
├── /auth                           # Authentication
├── /agents                         # Agent management
├── /academy                        # Training & certification
├── /council
│   ├── POST /request               # Submit to Council of Nine
│   ├── GET  /decisions             # Decision history
│   ├── GET  /decisions/:id         # Decision detail with all 9 votes
│   ├── GET  /precedents            # Precedent library
│   └── POST /override              # Human override
├── /marketplace
│   ├── GET  /listings              # Browse prebuilt agents
│   ├── POST /listings              # Create listing
│   ├── GET  /ticker                # Live ticker (SSE)
│   ├── GET  /requests              # Custom requests
│   ├── POST /requests              # Post custom request
│   ├── POST /requests/:id/bid      # Bid on request
│   └── POST /acquire               # Acquire agent
├── /observer
│   ├── GET  /feed                  # Real-time event feed (SSE)
│   ├── GET  /logs                  # Query historical logs
│   └── GET  /anomalies             # Anomaly alerts
├── /truth-chain
│   ├── GET  /records               # Query records
│   ├── GET  /verify/:hash          # Public verification
│   └── GET  /proof/:id             # Merkle proof
└── /verify (Public - No Auth)
    ├── GET  /:hash                 # Verify any record
    └── GET  /agent/:id             # Agent certifications
```

### 9.2 Key Endpoints

#### Council Request

```typescript
// POST /api/council/request
interface CouncilRequest {
  agentId: string;
  action: {
    type: string;
    details: Record<string, any>;
    justification: string;
  };
}

interface CouncilResponse {
  caseId: string;
  riskLevel: number;
  verdict: 'APPROVED' | 'DENIED' | 'ESCALATED';
  votes: {
    validatorId: string;
    validatorName: string;
    vote: 'APPROVE' | 'DENY' | 'ABSTAIN';
    rationale: string;
    confidence: number;
  }[];
  orchestratorSynthesis: string;
  overallConfidence: number;
  dissent: string[];
  truthChainHash: string;
}
```

#### Live Ticker

```typescript
// GET /api/marketplace/ticker (SSE)
interface TickerEvent {
  type: 'LISTING_CREATED' | 'ACQUISITION_COMPLETE' | 'REQUEST_CREATED' | 'BID_PLACED' | 'TRUST_CHANGED';
  agentId?: string;
  agentName?: string;
  trustScore?: number;
  price?: { amount: number; model: string };
  trainerId?: string;
  consumerId?: string;
  timestamp: string;
}
```

---

## 10. Frontend Architecture

### 10.1 Application Structure

```
app/
├── (dashboard)/
│   ├── layout.tsx                  # Sidebar + header shell
│   ├── dashboard/page.tsx          # Role-based dashboard
│   ├── agents/
│   │   ├── page.tsx                # Agent list
│   │   ├── [id]/page.tsx           # Agent detail
│   │   └── [id]/trust/page.tsx     # Trust history
│   ├── marketplace/
│   │   ├── page.tsx                # Unified marketplace with ticker
│   │   ├── [id]/page.tsx           # Agent detail
│   │   └── requests/
│   │       ├── page.tsx            # Custom requests list
│   │       ├── new/page.tsx        # Post new request
│   │       └── [id]/page.tsx       # Request with bids
│   ├── council/page.tsx            # Council decisions view
│   ├── observer/page.tsx           # Observer feed
│   ├── truth-chain/page.tsx        # Truth Chain explorer
│   └── earnings/page.tsx           # Trainer earnings
│
├── verify/                         # Public verification
│   └── [hash]/page.tsx
│
└── api/                            # API routes

components/
├── agents/
│   ├── TrustBadge.tsx              # Trust score display
│   ├── ProbationIndicator.tsx      # Probation warning
│   └── AgentCard.tsx
├── council/
│   ├── CouncilDeliberation.tsx     # Full 9-vote view
│   ├── ValidatorCard.tsx           # Individual validator
│   ├── VotingPanel.tsx             # Vote visualization
│   ├── DecisionCard.tsx            # Decision summary
│   └── WisdomCouncilAdvisor.tsx    # Elder wisdom display
├── marketplace/
│   ├── LiveTicker.tsx              # Real-time ticker
│   ├── ListingCard.tsx             # Agent listing
│   ├── RequestCard.tsx             # Custom request
│   ├── BidCard.tsx                 # Trainer bid
│   └── AcquisitionFlow.tsx         # Purchase flow
├── observer/
│   ├── EventFeed.tsx               # Real-time events
│   └── AnomalyList.tsx
└── ui/                             # shadcn/ui components
```

---

## 11. Real-Time Architecture

### 11.1 Pusher Channels

| Channel | Purpose | Events |
|---------|---------|--------|
| `marketplace-activity` | Global ticker | `ticker-event` |
| `agent-{id}` | Agent-specific updates | `trust-update`, `acquisition` |
| `user-{id}` | Personal notifications | `notification` |
| `council-{caseId}` | Live deliberation | `vote-cast`, `decision` |
| `observer-feed` | Observer events | `event`, `anomaly` |

### 11.2 Ticker Implementation

```typescript
// Server-side broadcast
import { pusherServer } from '@/lib/pusher/server';

async function broadcastTickerEvent(event: TickerEvent) {
  await pusherServer.trigger('marketplace-activity', 'ticker-event', {
    type: event.type,
    agentId: event.agentId,
    agentName: event.agentName,
    trustScore: event.trustScore,
    price: event.price,
    timestamp: new Date().toISOString()
  });
}

// Client-side subscription
import { usePusher } from '@/lib/pusher/hooks';

function LiveTicker() {
  const [events, setEvents] = useState<TickerEvent[]>([]);

  usePusher('marketplace-activity', 'ticker-event', (event) => {
    setEvents(prev => [event, ...prev].slice(0, 50));
  });

  return (
    <div className="ticker-container">
      {events.map(event => <TickerItem key={event.timestamp} {...event} />)}
    </div>
  );
}
```

---

## 12. Security Architecture

### 12.1 Authentication Flow

| Layer | Protection | Implementation |
|-------|------------|----------------|
| **Transport** | TLS 1.3 | Vercel Edge |
| **Authentication** | JWT + Sessions | Supabase Auth |
| **Authorization** | RLS Policies | PostgreSQL |
| **Rate Limiting** | Per-user limits | Redis (Upstash) |
| **Input Validation** | Zod schemas | API middleware |
| **Agent Identity** | Keypairs | Cryptographic signing |
| **Observer Isolation** | Network separation | VPC/ACLs |
| **Truth Chain** | Hash chain | SHA-256 |

### 12.2 Role-Based Access

| Role | Capabilities |
|------|--------------|
| **Admin** | Full platform access, Council override |
| **Trainer** | Create agents, publish to marketplace, bid on requests |
| **Consumer** | Acquire agents, post requests, view Observer feed |
| **Observer** | Read-only access to audit data (system role) |

---

## 13. Implementation Patterns

### 13.1 Naming Conventions

| Category | Convention | Example |
|----------|------------|---------|
| **Files** | kebab-case | `council-service.ts` |
| **Components** | PascalCase | `TrustBadge` |
| **Functions** | camelCase | `calculateTrustScore` |
| **Constants** | SCREAMING_SNAKE | `MAX_TRUST_SCORE` |
| **Types** | PascalCase | `CouncilDecision` |
| **DB tables** | snake_case | `council_decisions` |
| **API routes** | kebab-case | `/api/council/assess-risk` |
| **Pusher channels** | kebab-case | `marketplace-activity` |

### 13.2 Trust Score Tiers

```typescript
export const TRUST_TIERS = {
  LEGENDARY:   { min: 900, max: 1000, label: 'Legendary',   color: 'gold' },
  TRUSTED:     { min: 750, max: 899,  label: 'Trusted',     color: 'emerald' },
  ESTABLISHED: { min: 500, max: 749,  label: 'Established', color: 'blue' },
  DEVELOPING:  { min: 250, max: 499,  label: 'Developing',  color: 'yellow' },
  PROBATION:   { min: 100, max: 249,  label: 'Probation',   color: 'orange' },
  UNTRUSTED:   { min: 0,   max: 99,   label: 'Untrusted',   color: 'red' }
} as const;
```

### 13.3 Autonomy Levels

| Level | Trust Range | Capability | Human Involvement |
|-------|-------------|------------|-------------------|
| 0 | 0-99 | Ask before every action | Required for all |
| 1 | 100-249 | Suggest, wait for approval | Approve each action |
| 2 | 250-499 | Execute with notification | Notified, can intervene |
| 3 | 500-749 | Execute autonomously (low-risk) | Periodic review |
| 4 | 750+ | Full autonomy (non-critical) | Exception-based |

### 13.4 API Response Format

```typescript
interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: { page?: number; totalPages?: number; cursor?: string };
}

interface ApiError {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

type ApiResponse<T> = ApiSuccess<T> | ApiError;
```

---

## 14. Infrastructure

### 14.1 Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# Upstash Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Pusher
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=
PUSHER_APP_ID=
PUSHER_SECRET=

# Truth Chain
TRUTH_CHAIN_DATABASE_URL=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Sentry
SENTRY_DSN=

# Platform
PLATFORM_SIGNING_KEY=
```

### 14.2 Caching Strategy

| Data | Cache | TTL | Rationale |
|------|-------|-----|-----------|
| **Trust Scores** | Redis | 5 min | Frequently accessed |
| **Agent Profiles** | Redis | 15 min | Read-heavy |
| **Marketplace Listings** | Redis | 1 min | High visibility |
| **Council Decisions** | Immutable | Forever | Never changes |
| **Ticker Feed** | In-memory | Real-time | Streaming |

---

## 15. Key Design Decisions

### 15.1 Why Council of Nine?

**Decision:** Expand from 4 validators to 9 specialized validators.

**Rationale:**
- More comprehensive coverage of governance concerns
- Specialized expertise in each domain
- Odd number prevents ties
- Orchestrator provides synthesis and resolution
- "Nine sounds official" - user feedback

### 15.2 Why LangGraph.js?

**Decision:** Use LangGraph.js for agent orchestration.

**Rationale:**
- Native JavaScript/TypeScript integration with Next.js
- Stateful graph-based workflows
- Built-in support for parallel execution (Council voting)
- Clean separation of concerns
- Production-ready for complex multi-agent systems

### 15.3 Why Unified Marketplace?

**Decision:** Single marketplace with prebuilt agents, custom requests, and live ticker.

**Rationale:**
- Better user experience (no context switching)
- Real-time engagement with ticker
- Network effects from combined activity
- Custom requests enable long-tail needs
- User feedback: "one large marketplace"

### 15.4 Why Elder Wisdom Council?

**Decision:** Add 3 advisory bots that inform but don't vote.

**Rationale:**
- Captures important perspectives (ethics, platform health, transparency)
- Doesn't slow down voting (advisory only)
- Provides context for validator decisions
- Demonstrates commitment to responsible AI

---

## 16. Implementation Phases

### Phase 1: MVP Foundation

**Deliverables:**
- Basic agent creation and chat
- Academy enrollment and graduation
- Council of Nine (all 9 validators)
- Trust Score (0-1000) with 6 tiers
- Internal hash chain
- Unified Marketplace with Live Ticker
- Commission acquisition model
- Custom agent requests (basic)
- Role-based dashboards
- Observer feed (basic)

### Phase 2: Marketplace Depth

**Deliverables:**
- Clone acquisition model
- Enterprise Lock acquisition
- Bidding system for custom requests
- Earnings dashboard with payouts
- MIA detection + decay
- Client protection flows

### Phase 3: Trust Infrastructure

**Deliverables:**
- Trillian integration for Truth Chain
- Public verification pages
- Verification widgets
- Observer isolation (full)
- Compliance reports (EU AI Act)
- Anomaly detection

### Phase 4: Scale & Polish

**Deliverables:**
- Performance optimization
- Advanced analytics
- Enterprise SSO
- Custom Council validators
- API marketplace
- Partner integrations

---

## Appendix A: Related Documents

| Document | Purpose |
|----------|---------|
| `docs/prd.md` | Product Requirements (149 FRs) |
| `docs/product-brief-agentanchor-2025-12-04.md` | Product Vision |
| `docs/research-market-2025-12-04.md` | Market Research |
| `docs/research-technical-2025-12-04.md` | Technical Research |
| `docs/frontend-architecture.md` | Frontend Patterns |

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Council of Nine** | 9 specialized validators for governance decisions |
| **Elder Wisdom Council** | 3 advisory bots (Steward, Conscience, Witness) |
| **Orchestrator** | 9th validator that synthesizes and resolves ties |
| **Truth Chain** | Immutable hash-linked audit trail |
| **Trust Score** | 0-1000 credibility metric |
| **Upchain** | Protocol for requesting Council approval |
| **Live Ticker** | Real-time marketplace activity feed |
| **Custom Request** | Consumer-posted request for custom agent |
| **LangGraph.js** | Agent orchestration framework |

---

**End of Architecture Document**

*"Agents you can anchor to."*

*AgentAnchor System Architecture v3.0*
