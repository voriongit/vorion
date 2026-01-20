# ORION Architecture

**Version:** 1.0
**Status:** CANONICAL / NO-DRIFT

## System Components

### Core 1: AURYN (Strategic Intelligence)

AURYN generates intent and plans only. It is the "thinking" core.

**AURYN SHALL:**
- Accept user goals, context, constraints, and trust summaries
- Normalize goals into measurable outcomes
- Generate multiple plan candidates
- Surface risks and assumptions
- Package intent conforming to contracts
- Recommend escalations based on trust band

**AURYN SHALL NOT:**
- Enforce policy
- Execute tools or actions
- Compute, mutate, or override trust
- Make compliance judgments

### Core 2: Agent Anchor (Trust & Authorization)

Agent Anchor is the sole authority for policy enforcement and execution gating.

**Agent Anchor SHALL:**
- Implement JSAL for policy resolution
- Compute Adaptive Trust Profiles (ATP)
- Derive Trust Bands (T0-T5)
- Make deterministic authorization decisions
- Maintain forensic-grade proof
- Run EASE conflict detection
- Generate acceptance packets

**Agent Anchor SHALL NOT:**
- Perform strategic reasoning
- Invent goals
- Interpret law (only enforce policy bundles)

### PAL (Provenance, Accountability & Lifecycle)

PAL is a wrapper, not a core. It answers questions neither core should own.

**PAL SHALL:**
- Maintain component registry + ownership map
- Manage version lineage across deployments
- Handle promotions/demotions
- Track rollback/retirement decisions
- Record trust history (from Anchor outputs)
- Produce executive/auditor views

**PAL SHALL NOT:**
- Compute trust
- Override Anchor decisions
- Interpret law

### ERA (Execution & Runtime Reference Architecture)

ERA is a conformance spec, not a system.

**ERA SHALL define:**
- Tool adapter contract (validate/execute/redact/digest)
- Conformance tests for adapters
- Reference runtime worker
- Event bus for execution telemetry
- Correlation ID propagation

## Data Flow

```
User Goal
    │
    ▼
┌───────────────────┐
│      AURYN        │
│  (Intent Only)    │
└─────────┬─────────┘
          │ intent_payload
          ▼
┌────────────────────────┐
│    AGENT ANCHOR        │
│  ┌──────────────────┐  │
│  │ Policy Resolution│  │ ◄── Policy Bundles
│  │      (JSAL)      │  │
│  └────────┬─────────┘  │
│           ▼            │
│  ┌──────────────────┐  │
│  │ Trust Computation│  │ ◄── Trust History
│  │      (ATP)       │  │
│  └────────┬─────────┘  │
│           ▼            │
│  ┌──────────────────┐  │
│  │  Authorization   │  │
│  │     Engine       │  │
│  └────────┬─────────┘  │
│           ▼            │
│  ┌──────────────────┐  │
│  │   Proof Plane    │  │ ──► ERPL (WORM)
│  └──────────────────┘  │
└────────────┬───────────┘
             │ decision_payload
             ▼
┌─────────────────────────────┐
│           ERA               │
│  ┌──────────────────────┐   │
│  │   Execution Worker   │   │
│  │ (Anchor-approved)    │   │
│  └──────────┬───────────┘   │
│             ▼               │
│  ┌──────────────────────┐   │
│  │    Tool Adapters     │   │
│  └──────────────────────┘   │
└─────────────────────────────┘
             │
             ▼
        Execution Digest
             │
             ▼
        Proof Plane
```

## Trust Model Details

### Trust Dimensions

| Dimension | Measures | Range |
|-----------|----------|-------|
| CT (Capability) | Skills, certifications, test results | 0.0 - 1.0 |
| BT (Behavioral) | Historical behavior, violations, successes | 0.0 - 1.0 |
| GT (Governance) | Oversight, policies, audit compliance | 0.0 - 1.0 |
| XT (Contextual) | Environment, jurisdiction, sensitivity | 0.0 - 1.0 |
| AC (Assurance) | Evidence quality, recency, completeness | 0.0 - 1.0 |

### Trust Band Derivation

Trust Band is derived from dimensions with gates:

- GT gates: If GT < threshold, cap band at T2
- AC gates: If AC < threshold, cap band at T1
- XT gates: Context can raise or lower by 1 band
- Hysteresis: Sustained evidence required to rise
- Decay: Stale evidence reduces CT/BT/AC

### Trust Band → Autonomy Mapping

| Band | Execution | Approval | Tools | Reversibility |
|------|-----------|----------|-------|---------------|
| T0 | Denied | - | None | - |
| T1 | Allowed | HITL required | Allowlist | Reversible only |
| T2 | Allowed | Select HITL | Allowlist | Reversible only |
| T3 | Allowed | Monitored | Expanded | Rollback required |
| T4 | Allowed | Audit | Broad | Recommended |
| T5 | Allowed | Audit | Full | Full proof |

## Policy Resolution (JSAL)

Policy bundles are composed from:

1. **Jurisdiction** (US, EU, CA, SG, etc.)
2. **Industry** (finance, healthcare, government)
3. **Standards** (SOC2, ISO27001, NIST, FedRAMP)
4. **Organization** (custom org policies)

Resolution rules:
- All applicable bundles are merged
- Most restrictive wins on conflict
- Unresolvable conflicts trigger escalation
- No interpretation of law - only enforcement

## Proof & Audit

### Proof Events

Every significant action produces a proof event:
- Intent receipt
- Policy resolution
- Authorization decision
- Trust delta
- Execution digest
- Incident

### ERPL (Evidence Preservation)

- Append-only storage (WORM)
- Retention windows by jurisdiction/industry
- Legal holds with dual approval
- Cryptographic sealing at window close
- Seal verification required for release

### Acceptance Packets (EASE Output)

| Packet Type | Audience |
|-------------|----------|
| Procurement | Government/enterprise procurement |
| Enterprise Assurance | SOC2/ISO auditors |
| Vendor/Partner | Third-party integrators |
| Developer Compliance | SDK users, contributors |

## Release Gates

A release SHALL NOT merge if ANY fail:

- [ ] EASE conflict scan
- [ ] Acceptance packet generation
- [ ] Trust regression tests
- [ ] Deterministic replay tests
- [ ] Seal verification tests
- [ ] Audit artifact generation

Every release MUST include:
- Acceptance packets
- Pinned trust model version
- Pinned policy bundle versions
- Rollback plan
