# Vorion B2B Platform Architecture Diagrams

**Generated:** January 19, 2026
**Version:** Post-B2B Conversion
**Format:** ASCII/Text (copy-paste ready)

---

## 1. HIGH-LEVEL SYSTEM CONTEXT

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VORION ECOSYSTEM                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │
│   │    BASIS     │    │  COGNIGATE   │    │ AGENTANCHOR  │                 │
│   │  (Standard)  │    │  (Runtime)   │    │  (Platform)  │                 │
│   │              │    │              │    │              │                 │
│   │  Open spec   │───▶│  Execution   │◀──▶│  B2B Portal  │                 │
│   │  for AI gov  │    │  with limits │    │  Dashboard   │                 │
│   └──────────────┘    └──────────────┘    └──────────────┘                 │
│          │                   │                   │                          │
│          └───────────────────┼───────────────────┘                          │
│                              │                                               │
│                    ┌─────────▼─────────┐                                    │
│                    │    ATSF-CORE      │                                    │
│                    │   (SDK/Library)   │                                    │
│                    │                   │                                    │
│                    │  Trust Engine     │                                    │
│                    │  Governance       │                                    │
│                    │  Proof System     │                                    │
│                    └───────────────────┘                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

DOMAINS:
├── vorion.org           → Corporate / Parent
├── basis.vorion.org     → Open Standard Documentation
├── cognigate.dev        → Developer Platform (planned)
├── agentanchorai.com    → B2B Marketing Site
└── app.agentanchorai.com → B2B Platform Application
```

---

## 2. FOUR-LAYER GOVERNANCE MODEL (BASIS)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BASIS GOVERNANCE LAYERS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐                                                            │
│  │   INTENT    │  Parse and classify agent action requests                  │
│  │   Layer     │  • Goal extraction                                         │
│  │             │  • Context analysis                                        │
│  │             │  • Risk classification                                     │
│  └──────┬──────┘                                                            │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────┐                                                            │
│  │  ENFORCE    │  Policy evaluation against trust scores                    │
│  │   Layer     │  • Rule matching                                           │
│  │             │  • Trust threshold checks                                  │
│  │             │  • Constraint application                                  │
│  └──────┬──────┘                                                            │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────┐                                                            │
│  │   PROOF     │  Cryptographic audit records                               │
│  │   Layer     │  • SHA-256 hashing                                         │
│  │             │  • Ed25519 signatures                                      │
│  │             │  • Chain linkage                                           │
│  └──────┬──────┘                                                            │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────┐                                                            │
│  │   HUMAN     │  Escalation for high-risk decisions                        │
│  │   Layer     │  • Review queue                                            │
│  │             │  • Approval workflow                                       │
│  │             │  • Override capability                                     │
│  └─────────────┘                                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

DECISION OUTCOMES:
├── ALLOW     → Execute with full permissions
├── DENY      → Block execution completely
├── ESCALATE  → Send to human review queue
├── LIMIT     → Execute with reduced capabilities
├── MONITOR   → Execute with enhanced logging
└── TERMINATE → Stop and rollback if possible
```

---

## 3. TRUST SCORING SYSTEM

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         6-TIER TRUST SYSTEM                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Score Range    Tier           Capabilities                                 │
│  ───────────    ────           ────────────                                 │
│                                                                              │
│  900-1000  ┌────────────┐  Full autonomy, minimal oversight                 │
│     L5     │ AUTONOMOUS │  • All operations allowed                         │
│            └────────────┘  • Self-healing enabled                           │
│                                                                              │
│  700-899   ┌────────────┐  Extended autonomy with periodic review           │
│     L4     │ CERTIFIED  │  • External API access                            │
│            └────────────┘  • Financial operations                           │
│                                                                              │
│  500-699   ┌────────────┐  Standard operations, trust established           │
│     L3     │  TRUSTED   │  • Cross-system communication                     │
│            └────────────┘  • Data modification                              │
│                                                                              │
│  300-499   ┌────────────┐  Basic operations, building trust                 │
│     L2     │ STANDARD   │  • Read public data                               │
│            └────────────┘  • Limited writes                                 │
│                                                                              │
│  100-299   ┌────────────┐  Limited ops, under observation                   │
│     L1     │PROVISIONAL │  • Internal operations only                       │
│            └────────────┘  • Enhanced logging                               │
│                                                                              │
│    0-99    ┌────────────┐  Human approval required for all actions          │
│     L0     │  SANDBOX   │  • Test environment only                          │
│            └────────────┘  • No external access                             │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TRUST DYNAMICS:                                                            │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │                                                                 │        │
│  │   Positive Signals          Negative Signals                    │        │
│  │   ────────────────          ────────────────                    │        │
│  │   ✓ Successful ops          ✗ Policy violations                 │        │
│  │   ✓ Compliance pass         ✗ Security incidents                │        │
│  │   ✓ Verification            ✗ Escalation denials                │        │
│  │                                                                 │        │
│  │          │                         │                            │        │
│  │          ▼                         ▼                            │        │
│  │   ┌───────────┐            ┌───────────────┐                    │        │
│  │   │ Recovery  │            │ Accelerated   │                    │        │
│  │   │ Boost     │            │ Decay (3x)    │                    │        │
│  │   └───────────┘            └───────────────┘                    │        │
│  │                                                                 │        │
│  │   Base Decay: 7-day half-life (14-day enterprise)              │        │
│  │                                                                 │        │
│  └─────────────────────────────────────────────────────────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. ATSF-CORE PACKAGE ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         @vorionsys/atsf-core                                 │
│                    Agentic Trust Scoring Framework                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         API LAYER                                    │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │    │
│  │  │/intents │  │/proofs  │  │ /trust  │  │/enforce │  │/escalate│  │    │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  │    │
│  └───────┼────────────┼────────────┼────────────┼────────────┼───────┘    │
│          │            │            │            │            │             │
│  ┌───────▼────────────▼────────────▼────────────▼────────────▼───────┐    │
│  │                      SERVICE LAYER                                 │    │
│  │                                                                    │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │    │
│  │  │   Intent    │  │    Trust    │  │  Governance │               │    │
│  │  │  Service    │  │   Engine    │  │   Engine    │               │    │
│  │  │             │  │             │  │             │               │    │
│  │  │ • submit()  │  │ • getScore()│  │ • evaluate()│               │    │
│  │  │ • get()     │  │ • record()  │  │ • register()│               │    │
│  │  │ • update()  │  │ • decay()   │  │ • query()   │               │    │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘               │    │
│  │         │                │                │                       │    │
│  │  ┌──────▼────────────────▼────────────────▼──────┐               │    │
│  │  │              ENFORCE SERVICE                   │               │    │
│  │  │  • decide()  • setPolicy()  • getDecisions()  │               │    │
│  │  └──────────────────────┬────────────────────────┘               │    │
│  │                         │                                         │    │
│  └─────────────────────────┼─────────────────────────────────────────┘    │
│                            │                                              │
│  ┌─────────────────────────▼─────────────────────────────────────────┐    │
│  │                      PROOF LAYER                                   │    │
│  │                                                                    │    │
│  │  ┌─────────────────────────────────────────────────────────────┐ │    │
│  │  │                    Proof Service                             │ │    │
│  │  │  • create()  • verify()  • verifyChain()  • query()         │ │    │
│  │  │                                                              │ │    │
│  │  │  Cryptography:                                               │ │    │
│  │  │  ├── SHA-256 hashing                                        │ │    │
│  │  │  ├── Ed25519 signing                                        │ │    │
│  │  │  └── Chain position tracking                                │ │    │
│  │  └─────────────────────────────────────────────────────────────┘ │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│                                                                            │
│  ┌───────────────────────────────────────────────────────────────────┐    │
│  │                    EXECUTION LAYER                                 │    │
│  │                                                                    │    │
│  │  ┌─────────────────────────────────────────────────────────────┐ │    │
│  │  │                  Cognigate Gateway                           │ │    │
│  │  │  • execute()  • terminate()  • registerHandler()            │ │    │
│  │  │                                                              │ │    │
│  │  │  Resource Limits:                                            │ │    │
│  │  │  ├── maxMemoryMb                                            │ │    │
│  │  │  ├── maxCpuPercent                                          │ │    │
│  │  │  ├── timeoutMs                                              │ │    │
│  │  │  ├── maxNetworkRequests                                     │ │    │
│  │  │  └── maxFileSystemOps                                       │ │    │
│  │  └─────────────────────────────────────────────────────────────┘ │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│                                                                            │
│  ┌───────────────────────────────────────────────────────────────────┐    │
│  │                   PERSISTENCE LAYER                                │    │
│  │                                                                    │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │    │
│  │  │   Memory    │  │    File     │  │  Supabase   │               │    │
│  │  │  Provider   │  │  Provider   │  │  Provider   │               │    │
│  │  │  (testing)  │  │   (dev)     │  │   (prod)    │               │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘               │    │
│  │         │                │                │                       │    │
│  │         └────────────────┼────────────────┘                       │    │
│  │                          │                                        │    │
│  │              ┌───────────▼───────────┐                           │    │
│  │              │  Unified Interface    │                           │    │
│  │              │  save/get/delete/query│                           │    │
│  │              └───────────────────────┘                           │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│                                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. AGENTANCHOR B2B PLATFORM

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      AGENTANCHOR B2B PLATFORM                                │
│                    app.agentanchorai.com                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        NAVIGATION                                    │    │
│  │                                                                      │    │
│  │   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│    │
│  │   │Dashboard │ │ Agents   │ │Governance│ │  Audit   │ │ Settings ││    │
│  │   └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘│    │
│  └────────┼────────────┼────────────┼────────────┼────────────┼───────┘    │
│           │            │            │            │            │             │
│  ┌────────▼────┐ ┌─────▼─────┐ ┌────▼────┐ ┌────▼────┐ ┌─────▼─────┐      │
│  │             │ │           │ │         │ │         │ │           │      │
│  │  Overview   │ │  Agent    │ │ Policy  │ │  Proof  │ │  API      │      │
│  │  Metrics    │ │  Registry │ │ Editor  │ │  Chain  │ │  Keys     │      │
│  │             │ │           │ │         │ │         │ │           │      │
│  │  Trust      │ │  Trust    │ │ Decision│ │ Verify  │ │  Team     │      │
│  │  Summary    │ │  Scoring  │ │ Log     │ │ Export  │ │  RBAC     │      │
│  │             │ │           │ │         │ │         │ │           │      │
│  │  Alerts     │ │  Observer │ │Escalate │ │Compliance│ │ Webhooks │      │
│  │             │ │           │ │ Queue   │ │ Reports │ │           │      │
│  │             │ │  Sandbox  │ │         │ │         │ │  Billing  │      │
│  └─────────────┘ └───────────┘ └─────────┘ └─────────┘ └───────────┘      │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  REMOVED (B2B Conversion):                                                  │
│  ├── /marketplace    (agent marketplace)                                    │
│  ├── /storefront     (agent sales)                                          │
│  ├── /portfolio      (token holdings)                                       │
│  ├── /earnings       (revenue tracking)                                     │
│  ├── /tribunal       (dispute resolution)                                   │
│  └── /staking        (token staking)                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. DATA FLOW ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GOVERNANCE DATA FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   External System                                                           │
│        │                                                                     │
│        │ Agent Request                                                       │
│        ▼                                                                     │
│   ┌─────────────┐                                                           │
│   │  API Layer  │◀── Authentication (JWT)                                   │
│   │  (Fastify)  │◀── Rate Limiting                                          │
│   └──────┬──────┘◀── Input Validation (Zod)                                 │
│          │                                                                   │
│          ▼                                                                   │
│   ┌─────────────┐                                                           │
│   │   INTENT    │  Parse request into structured intent                     │
│   │  Processing │  Extract: entityId, goal, context, metadata               │
│   └──────┬──────┘                                                           │
│          │                                                                   │
│          ▼                                                                   │
│   ┌─────────────┐     ┌─────────────┐                                       │
│   │   BASIS     │────▶│   TRUST     │  Fetch current trust score            │
│   │   Rules     │     │   ENGINE    │  Check tier permissions               │
│   └──────┬──────┘     └─────────────┘                                       │
│          │                                                                   │
│          ▼                                                                   │
│   ┌─────────────┐                                                           │
│   │ GOVERNANCE  │  Evaluate against registered rules                        │
│   │   ENGINE    │  Apply priority ordering                                  │
│   └──────┬──────┘  Check schedule/blackout windows                          │
│          │                                                                   │
│          ▼                                                                   │
│   ┌─────────────┐                                                           │
│   │  ENFORCE    │  Make final decision                                      │
│   │  SERVICE    │  Apply constraints if needed                              │
│   └──────┬──────┘                                                           │
│          │                                                                   │
│          ├─────────────────────────────────┐                                │
│          │                                 │                                │
│    ┌─────▼─────┐                    ┌─────▼─────┐                           │
│    │  ESCALATE │                    │   ALLOW   │                           │
│    │           │                    │   /DENY   │                           │
│    └─────┬─────┘                    └─────┬─────┘                           │
│          │                                │                                 │
│          ▼                                │                                 │
│   ┌─────────────┐                         │                                 │
│   │   HUMAN     │                         │                                 │
│   │   Review    │                         │                                 │
│   │   Queue     │                         │                                 │
│   └──────┬──────┘                         │                                 │
│          │                                │                                 │
│          └─────────┬──────────────────────┘                                 │
│                    │                                                         │
│                    ▼                                                         │
│            ┌─────────────┐                                                   │
│            │  COGNIGATE  │  Execute within resource limits                   │
│            │  (if ALLOW) │  Worker thread sandboxing                         │
│            └──────┬──────┘                                                   │
│                   │                                                          │
│                   ▼                                                          │
│            ┌─────────────┐                                                   │
│            │   PROOF     │  Create cryptographic record                      │
│            │   SERVICE   │  Chain to previous proofs                         │
│            └──────┬──────┘  Sign with Ed25519                                │
│                   │                                                          │
│                   ▼                                                          │
│            ┌─────────────┐                                                   │
│            │ PERSISTENCE │  Store to PostgreSQL/Supabase                     │
│            │   LAYER     │  Update trust signals                             │
│            └──────┬──────┘                                                   │
│                   │                                                          │
│                   ▼                                                          │
│            ┌─────────────┐                                                   │
│            │  RESPONSE   │  VorionResponse with provenance                   │
│            │  CONTRACT   │  Confidence breakdown                             │
│            └─────────────┘  Timing metrics                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. MONOREPO STRUCTURE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VORION MONOREPO (C:\axiom)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  axiom/                                                                      │
│  │                                                                           │
│  ├── apps/                          APPLICATIONS                            │
│  │   ├── agentanchor/               B2B Platform (Next.js 14)               │
│  │   │   ├── app/                   App Router pages                        │
│  │   │   ├── components/            React components                        │
│  │   │   ├── lib/                   Utilities, DB, services                 │
│  │   │   └── drizzle/               Database migrations                     │
│  │   │                                                                       │
│  │   ├── agentanchor-www/           Marketing site (Next.js)                │
│  │   └── bai-cc-www/                Portfolio site (Astro)                  │
│  │                                                                           │
│  ├── packages/                      SHARED PACKAGES                         │
│  │   ├── atsf-core/                 Core SDK (@vorionsys/atsf-core)         │
│  │   │   ├── src/                                                           │
│  │   │   │   ├── trust-engine/      Trust scoring                           │
│  │   │   │   ├── intent/            Intent processing                       │
│  │   │   │   ├── enforce/           Policy enforcement                      │
│  │   │   │   ├── proof/             Audit system                            │
│  │   │   │   ├── governance/        Rule management                         │
│  │   │   │   ├── persistence/       Data storage                            │
│  │   │   │   ├── cognigate/         Execution runtime                       │
│  │   │   │   └── api/               REST API [DEPRECATED]                   │
│  │   │   └── package.json                                                   │
│  │   │                                                                       │
│  │   ├── contracts/                 Shared type definitions                 │
│  │   ├── a3i/                       AI utilities                            │
│  │   ├── orion/                     Proof system (alias)                    │
│  │   ├── agent-sdk/                 Client SDK                              │
│  │   ├── ai-gateway/                API gateway                             │
│  │   └── council/                   Governance (legacy)                     │
│  │                                                                           │
│  ├── src/                           CORE KERNEL                             │
│  │   ├── api/                       Primary REST API (Fastify)              │
│  │   │   ├── server.ts              Main server + routes                    │
│  │   │   ├── auth.ts                JWT authentication                      │
│  │   │   ├── validation.ts          Zod schemas                             │
│  │   │   └── rate-limit.ts          Per-tenant limiting                     │
│  │   │                                                                       │
│  │   ├── intent/                    Intent queue service                    │
│  │   ├── enforce/                   Policy enforcement                      │
│  │   ├── proof/                     Proof generation                        │
│  │   ├── trust-engine/              Trust calculations                      │
│  │   ├── escalation/                Escalation service                      │
│  │   └── common/                    Shared types & utils                    │
│  │                                                                           │
│  ├── cognigate-api/                 Python runtime (FastAPI)                │
│  ├── basis-core/                    Open standard specs                     │
│  ├── docs/                          Documentation hub                       │
│  │   ├── basis-docs/                BASIS spec site (Docusaurus)            │
│  │   └── ATSF_*.md                  White papers                            │
│  │                                                                           │
│  ├── package.json                   Monorepo root                           │
│  ├── turbo.json                     Turborepo config                        │
│  └── tsconfig.base.json             Shared TS config                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. SECURITY ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SECURITY ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      PERIMETER SECURITY                              │    │
│  │                                                                      │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │    │
│  │  │    CORS     │  │   Helmet    │  │Rate Limiter │                 │    │
│  │  │  (origins)  │  │  (headers)  │  │ (per-tenant)│                 │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 │    │
│  │                                                                      │    │
│  │  Rate Limit Tiers:                                                  │    │
│  │  ├── Free:       60 req/min                                        │    │
│  │  ├── Pro:       300 req/min                                        │    │
│  │  └── Enterprise: 1000 req/min                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    AUTHENTICATION                                    │    │
│  │                                                                      │    │
│  │  JWT Token (HMAC-SHA256):                                           │    │
│  │  ┌─────────────────────────────────────────────────────────┐       │    │
│  │  │ {                                                        │       │    │
│  │  │   "sub": "user-id",                                     │       │    │
│  │  │   "tenantId": "tenant-uuid",                            │       │    │
│  │  │   "roles": ["admin", "developer"],                      │       │    │
│  │  │   "permissions": ["agents:read", "trust:write"],        │       │    │
│  │  │   "exp": 1737331200                                     │       │    │
│  │  │ }                                                        │       │    │
│  │  └─────────────────────────────────────────────────────────┘       │    │
│  │                                                                      │    │
│  │  Secret Requirements:                                               │    │
│  │  ├── Minimum 32 characters in production                           │    │
│  │  └── Fails startup if not set                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    INPUT VALIDATION                                  │    │
│  │                                                                      │    │
│  │  Zod Schema Validation:                                             │    │
│  │  ├── Type checking                                                  │    │
│  │  ├── String length limits                                          │    │
│  │  ├── Enum enforcement                                              │    │
│  │  └── Nested object validation                                      │    │
│  │                                                                      │    │
│  │  Injection Detection:                                               │    │
│  │  ├── SQL injection patterns                                        │    │
│  │  ├── XSS patterns                                                  │    │
│  │  ├── Command injection                                             │    │
│  │  └── Path traversal                                                │    │
│  │                                                                      │    │
│  │  Payload Limits:                                                    │    │
│  │  └── Max 1MB request body                                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    TENANT ISOLATION                                  │    │
│  │                                                                      │    │
│  │  Multi-Tenant Controls:                                             │    │
│  │  ├── Every request scoped to tenantId                              │    │
│  │  ├── RLS policies on all tables                                    │    │
│  │  ├── Cross-tenant access blocked                                   │    │
│  │  └── Audit logs include tenant context                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    CRYPTOGRAPHIC INTEGRITY                           │    │
│  │                                                                      │    │
│  │  Proof Chain:                                                       │    │
│  │  ├── SHA-256 content hashing                                       │    │
│  │  ├── Ed25519 digital signatures                                    │    │
│  │  ├── Chain position tracking                                       │    │
│  │  └── Previous hash linkage                                         │    │
│  │                                                                      │    │
│  │  ┌──────┐    ┌──────┐    ┌──────┐    ┌──────┐                     │    │
│  │  │Proof │───▶│Proof │───▶│Proof │───▶│Proof │                     │    │
│  │  │  #1  │    │  #2  │    │  #3  │    │  #4  │                     │    │
│  │  │      │    │      │    │      │    │      │                     │    │
│  │  │hash_0│    │hash_1│    │hash_2│    │hash_3│                     │    │
│  │  │prev:─│    │prev:0│    │prev:1│    │prev:2│                     │    │
│  │  │sign_0│    │sign_1│    │sign_2│    │sign_3│                     │    │
│  │  └──────┘    └──────┘    └──────┘    └──────┘                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. TECHNOLOGY STACK

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TECHNOLOGY STACK                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  FRONTEND                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Next.js 14    │  React 18     │  TypeScript   │  Tailwind CSS     │    │
│  │  App Router    │  Server Comp  │  Strict Mode  │  shadcn/ui        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  BACKEND                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Fastify 5     │  Hono         │  TypeScript   │  Node.js 20+      │    │
│  │  Primary API   │  SDK API      │  ES Modules   │  Worker Threads   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  DATABASE                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Neon          │  Drizzle ORM  │  Supabase     │  Redis (Upstash)  │    │
│  │  PostgreSQL    │  Type-safe    │  Auth+RLS     │  Rate Limiting    │    │
│  │  Serverless    │  Migrations   │  Realtime     │  Sessions         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  VALIDATION & SECURITY                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Zod           │  Helmet       │  CORS         │  JWT              │    │
│  │  Schema Valid  │  Sec Headers  │  Origin Ctrl  │  Auth Tokens      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  CRYPTOGRAPHY                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Web Crypto    │  Ed25519      │  SHA-256      │  HMAC             │    │
│  │  Native API    │  Signatures   │  Hashing      │  JWT Signing      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  OBSERVABILITY                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Pino          │  Sentry       │  Event System │  Request IDs      │    │
│  │  Logging       │  Errors       │  Trust Events │  Correlation      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  BUILD & DEPLOY                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Turborepo     │  Vercel       │  Docker       │  GitHub Actions   │    │
│  │  Monorepo      │  Hosting      │  Containers   │  CI/CD            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  TESTING                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Vitest        │  Playwright   │  MSW          │  Testing Library  │    │
│  │  Unit Tests    │  E2E Tests    │  API Mocking  │  React Testing    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

*Diagrams generated by BMad Master*
*For interactive versions, consider exporting to Mermaid or Excalidraw*
