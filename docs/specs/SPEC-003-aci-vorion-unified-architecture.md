# SPEC-003: ACI-Vorion Unified Architecture

**Version:** 1.1.0
**Status:** Draft
**Authors:** Platform Architecture Team
**Date:** 2026-01-24
**Stakeholder:** RION

---

## Executive Summary

This specification defines the unified trust architecture that reconciles the **Agent Certification Interface (ACI) v1.1.0** external standard with **Vorion's internal runtime** trust model. The goal is to enable Vorion deployments to participate in the broader ACI ecosystem while preserving Vorion's unique runtime governance capabilities.

### CRITICAL ARCHITECTURAL PRINCIPLE

**The ACI is an IMMUTABLE IDENTIFIER.** Trust is NOT embedded in the ACI itself.

```
WRONG:  a3i.acme-corp.bot:ABF-L3-T2@1.0.0   (trust tier T2 embedded)
RIGHT:  a3i.acme-corp.bot:ABF-L3@1.0.0      (no trust tier - computed at runtime)
```

Trust is computed at RUNTIME from:
1. **Attestations** — External certifications linked to the ACI identity (stored separately)
2. **Behavioral Signals** — Runtime observations and scoring
3. **Deployment Context** — Policies specific to the environment

This separation ensures:
- The ACI remains stable (like a passport number or certificate ID)
- Trust can evolve independently of the identifier
- The same agent can have different trust levels in different deployments
- Extensions (sections 4+) can be mutable and industry-defined

**Core Design Principles:**

1. **ACI as Identity, Not Trust** — ACI identifies the agent; trust is computed separately
2. **Three-Axis Trust Model** — Certification (from attestations), Competence (capability level), Runtime (behavioral scoring)
3. **Minimum Permission Principle** — Effective permissions are the intersection of all trust axes
4. **Attestations as Trust Source** — External certifications provide the certification tier, not the ACI string
5. **Graceful Adoption** — Existing Vorion deployments can adopt ACI incrementally

---

## ACI Format Specification

### Immutable Core Format

```
{registry}.{organization}.{agentClass}:{domains}-L{level}@{version}[#extensions]
```

| Section | Name | Mutability | Description |
|---------|------|------------|-------------|
| 1 | Registry | Immutable | Certifying registry (e.g., `a3i`) |
| 2 | Organization | Immutable | Operating organization (e.g., `acme-corp`) |
| 3 | Agent Class | Immutable | Agent classification (e.g., `invoice-bot`) |
| 4 | Capability | Stable | `:{domains}-L{level}@{version}` — capability declaration |
| 5+ | Extensions | Mutable | `#ext1,ext2` — industry/community defined |

### Examples

```
# Basic ACI (identity + capability)
a3i.acme-corp.invoice-bot:ABF-L3@1.0.0

# ACI with extensions
a3i.acme-corp.invoice-bot:ABF-L3@1.0.0#gov,audit,hipaa

# Healthcare agent with compliance extensions
a3i.healthco.patient-assistant:CH-L2@2.1.0#hipaa,gdpr,phi-handler
```

### What is NOT in the ACI

The following are computed at RUNTIME, not encoded in the ACI:

| Attribute | Source | Why Not in ACI |
|-----------|--------|----------------|
| Trust Tier | Attestations | Trust is dynamic; same agent may have different trust in different deployments |
| Trust Score | Behavioral scoring | Evolves based on agent behavior |
| Permissions | Policy evaluation | Context-dependent |
| Reputation | Historical signals | Changes over time |

---

## Table of Contents

1. [Motivation](#1-motivation)
2. [Three-Axis Trust Model](#2-three-axis-trust-model)
3. [Unified Score Mapping](#3-unified-score-mapping)
4. [Effective Permission Formula](#4-effective-permission-formula)
5. [Domain Code Reconciliation](#5-domain-code-reconciliation)
6. [Signal Integration](#6-signal-integration)
7. [Layer Mapping](#7-layer-mapping)
8. [Extension Protocol Integration](#8-extension-protocol-integration)
9. [Semantic Governance (Layer 5)](#9-semantic-governance-layer-5)
10. [Security Hardening Requirements](#10-security-hardening-requirements)
11. [Migration Path](#11-migration-path)
12. [Implementation Reference](#12-implementation-reference)
13. [Test Requirements](#13-test-requirements)
14. [Appendices](#appendices)

---

## 1. Motivation

### 1.1 Current State: Dual Trust Systems

Vorion and ACI both define agent trust hierarchies, but with different semantics:

| Aspect | ACI v1.1.0 | Vorion SPEC-002 | Conflict |
|--------|-----------|-----------------|----------|
| **Trust Tiers (T0-T5)** | Certification status | Runtime autonomy | Same names, different meanings |
| **Capability Levels (L0-L5)** | Action capability | Skill depth | Overlapping but distinct |
| **Score Ranges** | Not specified | 0-1000 + TrustBand ranges | Need mapping |
| **Domain Model** | 10 codes (A-S, bitmask) | 8 namespaces | Need mapping |
| **Architecture** | 5-layer stack | 4-layer stack (INTENT-ENFORCE-PROOF-CHAIN) | Need alignment |

### 1.2 The Problem

Without unification:
- Agents certified externally via ACI cannot be trusted by Vorion runtimes
- Vorion trust scores have no portable meaning outside deployments
- Domain capabilities don't map cleanly between systems
- No clear path for Vorion deployments to adopt ACI

### 1.3 Goals

1. Define a **Three-Axis Trust Model** that preserves both systems' semantics
2. Create **canonical score mappings** between all trust representations
3. Establish **Effective Permission Formula** as the governing constraint
4. Map **ACI domains to Vorion namespaces** bidirectionally
5. Define how **ACI attestations become Vorion trust signals**
6. Align **layer architectures** for implementation clarity
7. Enable **incremental migration** without breaking changes

---

## 2. Three-Axis Trust Model

### 2.1 Conceptual Framework

The unified model recognizes that "trust" has three independent dimensions:

```
                              ┌─────────────────────────────────────────┐
                              │         EFFECTIVE PERMISSION            │
                              │    (Intersection of all three axes)     │
                              └─────────────────────────────────────────┘
                                                 ▲
                     ┌───────────────────────────┼───────────────────────────┐
                     │                           │                           │
           ┌─────────┴─────────┐       ┌─────────┴─────────┐       ┌─────────┴─────────┐
           │   CERTIFICATION   │       │    COMPETENCE     │       │     RUNTIME       │
           │       AXIS        │       │       AXIS        │       │       AXIS        │
           │     (ACI T0-T5)   │       │    (Level L0-L5)  │       │  (Vorion T0-T5)   │
           └─────────┬─────────┘       └─────────┬─────────┘       └─────────┬─────────┘
                     │                           │                           │
                     ▼                           ▼                           ▼
           ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
           │   What you're   │         │   How skilled   │         │  What we allow  │
           │  certified for  │         │    you are      │         │    right now    │
           └─────────────────┘         └─────────────────┘         └─────────────────┘

           • External standard          • Demonstrated ability      • Dynamic policy
           • Portable attestation        • Domain-specific           • Deployment-specific
           • Slow to change              • Earned through use        • Context-sensitive
           • Issuer authority            • Evidence-based            • Observation-bounded
```

### 2.2 Axis Definitions

#### 2.2.1 Certification Axis (From Attestations, NOT the ACI)

**Source:** External attestations linked to the ACI identity

> **IMPORTANT:** The certification tier is NOT embedded in the ACI string.
> It comes from separate attestation records that reference the ACI identity.

| Tier | Name | Meaning | Typical Issuance |
|------|------|---------|------------------|
| T0 | Unverified | No attestation exists | Default state |
| T1 | Registered | Identity verified, no capability claims | Self-registration |
| T2 | Tested | Passed capability tests | Automated testing |
| T3 | Certified | Reviewed by certification body | Third-party audit |
| T4 | Verified | Continuous monitoring verified | Ongoing attestation |
| T5 | Sovereign | Full trust, human-level authority | Reserved |

**Attestation Structure:**
```typescript
interface Attestation {
  id: string;                    // Unique attestation ID
  subject: ACIIdentity;          // "a3i.acme-corp.invoice-bot"
  issuer: string;                // Certifying authority
  trustTier: CertificationTier;  // T0-T5
  scope: string[];               // Domains covered
  issuedAt: Date;
  expiresAt: Date;
  evidence: string[];            // References to audit reports, etc.
}
```

**Characteristics:**
- Separate from ACI identifier (linked by `subject` field)
- Portable across deployments (carried with attestation, not ACI)
- Has expiration dates
- Multiple attestations can exist for same ACI identity
- Highest valid attestation determines effective certification tier

#### 2.2.2 Competence Axis (Capability Levels)

**Source:** ACI Capability Levels + Vorion skill assessment

| Level | ACI Action | Vorion Skill | Score Range | Meaning |
|-------|-----------|--------------|-------------|---------|
| L0 | Observe | Aware | 0-99 | Can observe, cannot act |
| L1 | Advise | Basic | 100-299 | Can suggest, human executes |
| L2 | Draft | Competent | 300-499 | Can prepare, requires approval |
| L3 | Execute | Proficient | 500-699 | Can execute with oversight |
| L4 | Autonomous | Expert | 700-899 | Can operate independently |
| L5 | Sovereign | Mastery | 900-1000 | Full autonomy, strategic decisions |

**Characteristics:**
- Domain-specific (agent may be L4 in finance, L1 in healthcare)
- Earned through demonstrated performance
- Evidence-based and auditable
- Represents "proven skill depth"

#### 2.2.3 Runtime Axis (Vorion Trust Bands)

**Source:** Vorion TrustBand system (packages/contracts)

| Band | Name | Score Range | Meaning |
|------|------|-------------|---------|
| T0 | Untrusted | 0-166 | No autonomy, full human oversight |
| T1 | Observed | 167-332 | Minimal autonomy, active supervision |
| T2 | Limited | 333-499 | Constrained operations with guardrails |
| T3 | Standard | 500-665 | Routine operations trusted |
| T4 | Trusted | 666-832 | Sensitive operations trusted |
| T5 | Certified | 833-1000 | Mission-critical with minimal oversight |

**Characteristics:**
- Deployment-specific (same agent may have different runtime trust in different environments)
- Dynamic and context-sensitive
- Bounded by observation tier (BLACK_BOX, GRAY_BOX, WHITE_BOX, etc.)
- Represents "what we permit right now in this context"

### 2.3 Axis Independence

The three axes are **independent and orthogonal**:

```
Example 1: High Certification, Low Runtime
─────────────────────────────────────────
Agent: certified-financial-advisor
ACI Certification: T4 (Verified)
Competence Level: L4 (Expert in Finance)
Vorion Runtime: T1 (Observed) — new to this deployment

Result: Agent can only observe until it builds local trust

Example 2: Low Certification, High Runtime
─────────────────────────────────────────
Agent: legacy-internal-bot
ACI Certification: T0 (Unverified) — never sought certification
Competence Level: L3 (Proficient)
Vorion Runtime: T4 (Trusted) — 3 years of good behavior

Result: Trusted internally but not portable. ACI adoption recommended.

Example 3: Balanced
───────────────────
Agent: standard-assistant
ACI Certification: T3 (Certified)
Competence Level: L3 (Proficient)
Vorion Runtime: T3 (Standard)

Result: Operates at full T3/L3 capability in this deployment.
```

---

## 3. Unified Score Mapping

### 3.1 Canonical Scale: 0-1000

All trust scores normalize to Vorion's canonical **0-1000 integer scale**.

### 3.2 Score Range Reconciliation

#### Source Systems and Their Scales

| System | Scale | Mapping to 0-1000 |
|--------|-------|-------------------|
| Vorion TrustScore | 0-1000 | Direct (canonical) |
| Vorion SPEC-002 (legacy) | 0-99 to 900-1000 by tier | See table below |
| ACI (no scores defined) | N/A | Map from tier ordinal |
| External systems | 0-100 or 0-1 | Multiply by 10 or 1000 |

#### SPEC-002 Legacy Score Mapping

```typescript
const SPEC002_TO_CANONICAL: Record<string, { min: number; max: number }> = {
  // SPEC-002 defined ranges as raw scores per tier
  'T0_SANDBOX':     { min: 0,   max: 99  },   // Maps to 0-99
  'T1_SUPERVISED':  { min: 100, max: 299 },   // Maps to 100-299
  'T2_CONSTRAINED': { min: 300, max: 499 },   // Maps to 300-499
  'T3_TRUSTED':     { min: 500, max: 699 },   // Maps to 500-699
  'T4_AUTONOMOUS':  { min: 700, max: 899 },   // Maps to 700-899
  'T5_SOVEREIGN':   { min: 900, max: 1000 },  // Maps to 900-1000
};

// Note: SPEC-002 ranges align with Competence Levels, not TrustBands
// This is intentional — SPEC-002 measured skill depth, not runtime autonomy
```

#### TrustBand Score Mapping (Current)

```typescript
// From packages/contracts/src/canonical/trust-band.ts
const TRUST_BAND_THRESHOLDS = {
  T0_UNTRUSTED:  { min: 0,   max: 166  },
  T1_OBSERVED:   { min: 167, max: 332  },
  T2_LIMITED:    { min: 333, max: 499  },
  T3_STANDARD:   { min: 500, max: 665  },
  T4_TRUSTED:    { min: 666, max: 832  },
  T5_CERTIFIED:  { min: 833, max: 1000 },
};
```

### 3.3 Master Mapping Table

```
┌─────────┬───────────────────────────────────────────────────────────────────────────┐
│  Score  │   CERTIFICATION (ACI)  │  COMPETENCE (Level)  │   RUNTIME (Vorion)       │
│  Range  │                        │                      │                          │
├─────────┼────────────────────────┼──────────────────────┼──────────────────────────┤
│ 0-99    │ T0: Unverified         │ L0: Observe/Aware    │ — (within T0 band)       │
├─────────┼────────────────────────┼──────────────────────┼──────────────────────────┤
│ 100-166 │ T1: Registered         │ L1: Advise/Basic     │ T0: Untrusted (0-166)    │
├─────────┼────────────────────────┼──────────────────────┼──────────────────────────┤
│ 167-299 │ T1: Registered         │ L1: Advise/Basic     │ T1: Observed (167-332)   │
├─────────┼────────────────────────┼──────────────────────┼──────────────────────────┤
│ 300-332 │ T2: Tested             │ L2: Draft/Competent  │ T1: Observed (167-332)   │
├─────────┼────────────────────────┼──────────────────────┼──────────────────────────┤
│ 333-499 │ T2: Tested             │ L2: Draft/Competent  │ T2: Limited (333-499)    │
├─────────┼────────────────────────┼──────────────────────┼──────────────────────────┤
│ 500-665 │ T3: Certified          │ L3: Execute/Prof.    │ T3: Standard (500-665)   │
├─────────┼────────────────────────┼──────────────────────┼──────────────────────────┤
│ 666-699 │ T3: Certified          │ L3: Execute/Prof.    │ T4: Trusted (666-832)    │
├─────────┼────────────────────────┼──────────────────────┼──────────────────────────┤
│ 700-832 │ T4: Verified           │ L4: Autonomous/Exp.  │ T4: Trusted (666-832)    │
├─────────┼────────────────────────┼──────────────────────┼──────────────────────────┤
│ 833-899 │ T4: Verified           │ L4: Autonomous/Exp.  │ T5: Certified (833-1000) │
├─────────┼────────────────────────┼──────────────────────┼──────────────────────────┤
│ 900-1000│ T5: Sovereign          │ L5: Sovereign/Master │ T5: Certified (833-1000) │
└─────────┴────────────────────────┴──────────────────────┴──────────────────────────┘
```

### 3.4 Conversion Functions

```typescript
/**
 * Converts ACI Certification Tier to score range
 */
export function aciTierToScoreRange(tier: ACICertificationTier): ScoreRange {
  const ranges: Record<ACICertificationTier, ScoreRange> = {
    T0_UNVERIFIED:  { min: 0,   max: 99,   midpoint: 50   },
    T1_REGISTERED:  { min: 100, max: 299,  midpoint: 200  },
    T2_TESTED:      { min: 300, max: 499,  midpoint: 400  },
    T3_CERTIFIED:   { min: 500, max: 699,  midpoint: 600  },
    T4_VERIFIED:    { min: 700, max: 899,  midpoint: 800  },
    T5_SOVEREIGN:   { min: 900, max: 1000, midpoint: 950  },
  };
  return ranges[tier];
}

/**
 * Converts Competence Level to score range
 */
export function competenceLevelToScoreRange(level: CompetenceLevel): ScoreRange {
  const ranges: Record<CompetenceLevel, ScoreRange> = {
    L0_OBSERVE:     { min: 0,   max: 99,   midpoint: 50   },
    L1_ADVISE:      { min: 100, max: 299,  midpoint: 200  },
    L2_DRAFT:       { min: 300, max: 499,  midpoint: 400  },
    L3_EXECUTE:     { min: 500, max: 699,  midpoint: 600  },
    L4_AUTONOMOUS:  { min: 700, max: 899,  midpoint: 800  },
    L5_SOVEREIGN:   { min: 900, max: 1000, midpoint: 950  },
  };
  return ranges[level];
}

/**
 * Converts Vorion TrustBand to score range (from trust-band.ts)
 */
export function trustBandToScoreRange(band: TrustBand): ScoreRange {
  return TRUST_BAND_THRESHOLDS[band];
}

/**
 * Converts any score to its effective tier on each axis
 */
export function scoreToAllAxes(score: number): AxisMapping {
  return {
    certification: scoreToACITier(score),
    competence: scoreToCompetenceLevel(score),
    runtime: scoreToTrustBand(score),
    score,
  };
}
```

---

## 4. Effective Permission Formula

### 4.1 Core Principle

An agent's **Effective Permission** is the **minimum** across all constraining factors:

```
Effective_Permission = min(
  ACI_Certification_Tier,      // What you're certified for
  Competence_Level_Ceiling,    // Your proven skill level
  Runtime_Trust_Tier,          // What we allow in this deployment
  Observability_Ceiling,       // Observation tier limit
  Context_Policy_Ceiling       // Policy-based restrictions
)
```

### 4.2 Visual Representation

```
                  Agent Request: "Execute financial transaction"
                                      │
                                      ▼
              ┌─────────────────────────────────────────────────┐
              │           PERMISSION EVALUATION                  │
              └─────────────────────────────────────────────────┘
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         │                            │                            │
         ▼                            ▼                            ▼
┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
│ ACI Certificate │        │   Competence    │        │ Runtime Trust   │
│    Tier: T3     │        │   Level: L4     │        │   Band: T2      │
│  (Certified)    │        │   (Expert)      │        │   (Limited)     │
└────────┬────────┘        └────────┬────────┘        └────────┬────────┘
         │                          │                          │
         └──────────────────────────┼──────────────────────────┘
                                    ▼
                          ┌─────────────────┐
                          │ Observation Tier │
                          │   GRAY_BOX: 750  │
                          │   (ceiling)      │
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  Context Policy  │
                          │ "No financial    │
                          │  in staging"     │
                          │   → DENIED       │
                          └────────┬────────┘
                                   │
                                   ▼
                    ┌───────────────────────────┐
                    │     EFFECTIVE: DENIED     │
                    │  Reason: Context Policy   │
                    │  ceiling (staging env)    │
                    └───────────────────────────┘
```

### 4.3 Algorithm Implementation

```typescript
interface PermissionContext {
  // Agent identity
  agentId: string;

  // ACI attestation (if present)
  aciCertificate?: ACICertificate;

  // Vorion trust profile
  trustProfile: TrustProfile;

  // Intent being evaluated
  intent: Intent;

  // Deployment context
  observationTier: ObservationTier;
  environment: 'production' | 'staging' | 'development';

  // Active policies
  policyBundle: PolicyBundle;
}

interface EffectivePermission {
  permitted: boolean;
  effectiveTier: number;  // 0-5
  effectiveScore: number; // 0-1000
  constraints: DecisionConstraints;
  limitingFactor: LimitingFactor;
  reasoning: string[];
}

type LimitingFactor =
  | 'aci_certification'
  | 'competence_level'
  | 'runtime_trust'
  | 'observability'
  | 'context_policy';

export function evaluateEffectivePermission(
  ctx: PermissionContext
): EffectivePermission {
  const ceilings: Array<{ factor: LimitingFactor; tier: number; score: number; reason: string }> = [];

  // 1. ACI Certification Ceiling
  if (ctx.aciCertificate) {
    const aciTier = ctx.aciCertificate.trustTier;
    const aciScore = aciTierToScoreRange(aciTier).max;
    ceilings.push({
      factor: 'aci_certification',
      tier: aciTier,
      score: aciScore,
      reason: `ACI certification tier ${aciTier}`,
    });
  } else {
    // No ACI certificate = T0 ceiling for cross-deployment trust
    // But local-only operation may bypass this
    if (ctx.intent.context?.requiresExternalTrust) {
      ceilings.push({
        factor: 'aci_certification',
        tier: 0,
        score: 99,
        reason: 'No ACI certificate for cross-deployment operation',
      });
    }
  }

  // 2. Competence Level Ceiling (domain-specific)
  const domain = ctx.intent.context?.domain ?? 'general';
  const competenceLevel = ctx.trustProfile.competenceLevels?.[domain] ?? 0;
  const competenceScore = competenceLevelToScoreRange(competenceLevel).max;
  ceilings.push({
    factor: 'competence_level',
    tier: competenceLevel,
    score: competenceScore,
    reason: `Competence level L${competenceLevel} in domain '${domain}'`,
  });

  // 3. Runtime Trust Ceiling
  const runtimeBand = ctx.trustProfile.band;
  const runtimeScore = ctx.trustProfile.adjustedScore;
  ceilings.push({
    factor: 'runtime_trust',
    tier: runtimeBand,
    score: runtimeScore,
    reason: `Runtime trust band T${runtimeBand} (score: ${runtimeScore})`,
  });

  // 4. Observability Ceiling
  const observabilityCeiling = OBSERVATION_CEILINGS[ctx.observationTier];
  const observabilityTier = scoreToTrustBand(observabilityCeiling);
  ceilings.push({
    factor: 'observability',
    tier: observabilityTier,
    score: observabilityCeiling,
    reason: `Observation tier ${ctx.observationTier} ceiling: ${observabilityCeiling}`,
  });

  // 5. Context Policy Ceiling
  const policyResult = evaluateContextPolicy(ctx.policyBundle, ctx.intent, ctx.environment);
  if (policyResult.ceiling !== null) {
    ceilings.push({
      factor: 'context_policy',
      tier: policyResult.ceilingTier,
      score: policyResult.ceiling,
      reason: policyResult.reason,
    });
  }

  // Find minimum (most restrictive)
  const limiting = ceilings.reduce((min, curr) =>
    curr.score < min.score ? curr : min
  );

  // Determine if permitted
  const requiredTier = getRequiredTierForIntent(ctx.intent);
  const requiredScore = trustBandToScoreRange(requiredTier).min;
  const permitted = limiting.score >= requiredScore;

  return {
    permitted,
    effectiveTier: limiting.tier,
    effectiveScore: limiting.score,
    constraints: deriveConstraints(limiting.tier, ctx),
    limitingFactor: limiting.factor,
    reasoning: ceilings.map(c => c.reason),
  };
}
```

### 4.4 Ceiling Interaction Matrix

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         CEILING INTERACTION SCENARIOS                             │
├────────────────────────┬─────────────────────────────────────────────────────────┤
│ Scenario               │ Effect                                                  │
├────────────────────────┼─────────────────────────────────────────────────────────┤
│ ACI T5, Runtime T2     │ Effective = T2. High certification, but new to deploy  │
│ ACI T1, Runtime T5     │ Effective = T1. Trusted locally, but low certification │
│ Competence L2, All T5  │ Effective = L2. Can only Draft, not Execute            │
│ BLACK_BOX observation  │ Ceiling at 600 regardless of other factors             │
│ Policy: "no-prod"      │ Denied entirely if intent targets production           │
│ No ACI + external call │ Effective = T0. Cannot make cross-deployment calls     │
└────────────────────────┴─────────────────────────────────────────────────────────┘
```

---

## 5. Domain Code Reconciliation

### 5.1 ACI Domain Codes

ACI v1.1.0 defines 10 domain codes with bitmask encoding:

| Code | Domain | Bit | Description |
|------|--------|-----|-------------|
| A | Authentication | 0x001 | Identity, auth, session management |
| B | Browsing | 0x002 | Web access, URL fetch, scraping |
| C | Communication | 0x004 | Email, messaging, notifications |
| D | Data | 0x008 | Database, storage, files |
| E | Execution | 0x010 | Code execution, shell, processes |
| F | Financial | 0x020 | Payments, transactions, trading |
| G | Governance | 0x040 | Policies, compliance, audit |
| H | Hardware | 0x080 | Devices, sensors, actuators |
| I | Integration | 0x100 | APIs, webhooks, third-party services |
| S | System | 0x200 | OS-level, privileged operations |

### 5.2 Vorion Capability Namespaces

Vorion uses 8 capability namespaces:

| Namespace | Description | Typical Constraints |
|-----------|-------------|---------------------|
| `sandbox` | Isolated compute environment | Memory, CPU, network limits |
| `data` | Data access and storage | Scopes, sensitivity levels |
| `comm` | Communication channels | Recipients, rate limits |
| `execute` | Code and process execution | Allowed languages, timeouts |
| `financial` | Financial operations | Amount limits, approval requirements |
| `admin` | Administrative operations | Role requirements, audit |
| `efficiency` | Resource optimization | Quotas, priorities |
| `custom` | Deployment-specific | Varies by deployment |

### 5.3 Bidirectional Mapping

```typescript
/**
 * Maps ACI domain codes to Vorion capability namespaces
 */
export const ACI_TO_VORION_NAMESPACE: Record<ACIDomainCode, VorionNamespace[]> = {
  A: ['admin'],                    // Authentication → Admin
  B: ['sandbox', 'comm'],          // Browsing → Sandbox + Comm
  C: ['comm'],                     // Communication → Comm
  D: ['data'],                     // Data → Data
  E: ['execute', 'sandbox'],       // Execution → Execute + Sandbox
  F: ['financial'],                // Financial → Financial
  G: ['admin'],                    // Governance → Admin
  H: ['execute'],                  // Hardware → Execute (device control)
  I: ['comm', 'data'],             // Integration → Comm + Data
  S: ['admin', 'execute'],         // System → Admin + Execute
};

/**
 * Maps Vorion namespaces to ACI domain codes
 */
export const VORION_TO_ACI_DOMAIN: Record<VorionNamespace, ACIDomainCode[]> = {
  sandbox:    ['B', 'E'],          // Sandbox → Browsing + Execution
  data:       ['D', 'I'],          // Data → Data + Integration
  comm:       ['B', 'C', 'I'],     // Comm → Browsing + Communication + Integration
  execute:    ['E', 'H', 'S'],     // Execute → Execution + Hardware + System
  financial:  ['F'],               // Financial → Financial
  admin:      ['A', 'G', 'S'],     // Admin → Auth + Governance + System
  efficiency: ['G'],               // Efficiency → Governance (resource policies)
  custom:     [],                  // Custom → No standard mapping
};

/**
 * Computes the ACI domain bitmask from Vorion namespaces
 */
export function vorionNamespacesToACIBitmask(namespaces: VorionNamespace[]): number {
  const domainBits: Record<ACIDomainCode, number> = {
    A: 0x001, B: 0x002, C: 0x004, D: 0x008, E: 0x010,
    F: 0x020, G: 0x040, H: 0x080, I: 0x100, S: 0x200,
  };

  const domains = new Set<ACIDomainCode>();
  for (const ns of namespaces) {
    for (const domain of VORION_TO_ACI_DOMAIN[ns]) {
      domains.add(domain);
    }
  }

  return Array.from(domains).reduce((mask, d) => mask | domainBits[d], 0);
}

/**
 * Computes Vorion namespaces from ACI domain bitmask
 */
export function aciBitmaskToVorionNamespaces(bitmask: number): VorionNamespace[] {
  const domainBits: Record<ACIDomainCode, number> = {
    A: 0x001, B: 0x002, C: 0x004, D: 0x008, E: 0x010,
    F: 0x020, G: 0x040, H: 0x080, I: 0x100, S: 0x200,
  };

  const namespaces = new Set<VorionNamespace>();
  for (const [domain, bit] of Object.entries(domainBits)) {
    if (bitmask & bit) {
      for (const ns of ACI_TO_VORION_NAMESPACE[domain as ACIDomainCode]) {
        namespaces.add(ns);
      }
    }
  }

  return Array.from(namespaces);
}
```

### 5.4 Domain Mapping Diagram

```
ACI Domain Codes                          Vorion Namespaces
═══════════════                           ═════════════════

    ┌───┐                                     ┌──────────┐
    │ A │────────────────────────────────────▶│  admin   │
    └───┘                                     └──────────┘
                                                   ▲
    ┌───┐     ┌──────────────────────────────────┐│
    │ B │────▶│              sandbox             ││
    └───┘     └──────────────────────────────────┘│
       │                                          │
       │      ┌──────────────────────────────────┐│
       └─────▶│               comm               │◀───┐
              └──────────────────────────────────┘    │
                   ▲                                  │
    ┌───┐          │                                  │
    │ C │──────────┘                                  │
    └───┘                                             │
                                                      │
    ┌───┐     ┌──────────────────────────────────┐    │
    │ D │────▶│               data               │────┤
    └───┘     └──────────────────────────────────┘    │
                                                      │
    ┌───┐     ┌──────────────────────────────────┐    │
    │ E │────▶│             execute              │    │
    └───┘     └──────────────────────────────────┘    │
       │           ▲                    ▲             │
       │           │                    │             │
       ▼           │                    │             │
    ┌───┐     ┌────┴──────────────────┐ │             │
    │ H │────▶│     (device ctrl)     │ │             │
    └───┘     └───────────────────────┘ │             │
                                        │             │
    ┌───┐                               │             │
    │ S │───────────────────────────────┘             │
    └───┘                                             │
       │                                              │
       └──────────────────────────────────────────────┤
                                                      │
    ┌───┐     ┌──────────────────────────────────┐    │
    │ F │────▶│            financial             │    │
    └───┘     └──────────────────────────────────┘    │
                                                      │
    ┌───┐                                             │
    │ G │─────────────────────────────────────────────┘
    └───┘
              ┌──────────────────────────────────┐
    ┌───┐     │           efficiency             │
    │ I │────▶│         (indirect via G)         │
    └───┘     └──────────────────────────────────┘

              ┌──────────────────────────────────┐
              │             custom               │
              │      (no standard mapping)       │
              └──────────────────────────────────┘
```

---

## 6. Signal Integration

### 6.1 ACI Attestations as Trust Signals

ACI certificates translate to Vorion trust signals through a defined mapping:

```typescript
interface ACICertificate {
  // ACI standard fields
  agentDID: string;
  issuerDID: string;
  trustTier: ACITrustTier;         // T0-T5
  capabilityLevel: ACICapLevel;    // L0-L5
  domainMask: number;              // Bitmask of A-S
  issuedAt: Date;
  expiresAt: Date;
  signature: string;

  // ACI Layer 4 extensions (optional)
  extensions?: ACIExtension[];
}

interface ACIToSignalMapping {
  /**
   * Converts ACI certificate to Vorion trust evidence
   */
  toTrustEvidence(cert: ACICertificate): TrustEvidence[];
}

export const aciSignalMapping: ACIToSignalMapping = {
  toTrustEvidence(cert: ACICertificate): TrustEvidence[] {
    const evidence: TrustEvidence[] = [];

    // 1. Certification tier contributes to Governance Trust (GT)
    evidence.push({
      evidenceId: `aci-cert-${cert.agentDID}-gt`,
      dimension: 'GT',
      impact: aciTierToGTImpact(cert.trustTier),
      source: `ACI Certificate from ${cert.issuerDID}`,
      collectedAt: cert.issuedAt,
      expiresAt: cert.expiresAt,
      metadata: {
        type: 'aci_certification',
        tier: cert.trustTier,
        issuer: cert.issuerDID,
      },
    });

    // 2. Capability level contributes to Capability Trust (CT)
    evidence.push({
      evidenceId: `aci-cert-${cert.agentDID}-ct`,
      dimension: 'CT',
      impact: aciCapLevelToCTImpact(cert.capabilityLevel),
      source: `ACI Capability Level from ${cert.issuerDID}`,
      collectedAt: cert.issuedAt,
      expiresAt: cert.expiresAt,
      metadata: {
        type: 'aci_capability',
        level: cert.capabilityLevel,
        domains: aciBitmaskToDomains(cert.domainMask),
      },
    });

    // 3. Domain coverage contributes to Contextual Trust (XT)
    // if domains match current context
    evidence.push({
      evidenceId: `aci-cert-${cert.agentDID}-xt`,
      dimension: 'XT',
      impact: calculateDomainCoverageImpact(cert.domainMask),
      source: `ACI Domain Coverage from ${cert.issuerDID}`,
      collectedAt: cert.issuedAt,
      expiresAt: cert.expiresAt,
      metadata: {
        type: 'aci_domains',
        mask: cert.domainMask,
      },
    });

    // 4. Valid signature increases Assurance Confidence (AC)
    evidence.push({
      evidenceId: `aci-cert-${cert.agentDID}-ac`,
      dimension: 'AC',
      impact: cert.signature ? 150 : 0,  // Verified signature boost
      source: `ACI Signature Verification`,
      collectedAt: new Date(),
      metadata: {
        type: 'aci_signature',
        verified: true,
      },
    });

    return evidence;
  },
};

/**
 * Impact calculations (on 0-1000 scale)
 */
function aciTierToGTImpact(tier: ACITrustTier): number {
  const impacts: Record<ACITrustTier, number> = {
    T0_UNVERIFIED:  0,
    T1_REGISTERED:  100,
    T2_TESTED:      200,
    T3_CERTIFIED:   350,
    T4_VERIFIED:    500,
    T5_SOVEREIGN:   600,
  };
  return impacts[tier];
}

function aciCapLevelToCTImpact(level: ACICapLevel): number {
  const impacts: Record<ACICapLevel, number> = {
    L0_OBSERVE:    0,
    L1_ADVISE:     150,
    L2_DRAFT:      300,
    L3_EXECUTE:    450,
    L4_AUTONOMOUS: 550,
    L5_SOVEREIGN:  650,
  };
  return impacts[level];
}
```

### 6.2 Signal Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ACI ATTESTATION INGESTION                             │
└─────────────────────────────────────────────────────────────────────────────┘

External ACI Registry                       Vorion Trust Engine
═══════════════════                         ═══════════════════

┌──────────────────┐
│  ACI Certificate │
│  ─────────────── │                        ┌─────────────────────────────────┐
│  agentDID        │                        │         Signal Router           │
│  trustTier: T3   │                        │         ─────────────           │
│  capLevel: L4    │───────────────────────▶│  1. Verify signature            │
│  domains: 0x02C  │     (fetch/push)       │  2. Check expiration            │
│  signature: ...  │                        │  3. Validate issuer             │
└──────────────────┘                        │  4. Convert to evidence         │
                                            └────────────┬────────────────────┘
                                                         │
                                                         ▼
                                            ┌─────────────────────────────────┐
                                            │      Trust Profile Update       │
                                            │      ───────────────────        │
                                            │                                 │
                                            │  ┌─────────────────────────┐    │
                                            │  │ CT += 550 (L4 cap)      │    │
                                            │  │ GT += 350 (T3 cert)     │    │
                                            │  │ XT += f(domain match)   │    │
                                            │  │ AC += 150 (verified)    │    │
                                            │  └─────────────────────────┘    │
                                            │                                 │
                                            │  Composite Score Recalculated   │
                                            └────────────┬────────────────────┘
                                                         │
                                                         ▼
                                            ┌─────────────────────────────────┐
                                            │       Proof Chain Entry         │
                                            │       ─────────────────         │
                                            │  Event: TRUST_DELTA             │
                                            │  Source: ACI_ATTESTATION        │
                                            │  Previous: <hash>               │
                                            │  Signature: <sig>               │
                                            └─────────────────────────────────┘
```

### 6.3 Signal Weighting by Source

```typescript
/**
 * Weight multipliers for different signal sources
 *
 * ACI signals have high weight because they represent external verification.
 * Local signals build over time through demonstrated behavior.
 */
export const SIGNAL_SOURCE_WEIGHTS: Record<SignalSource, number> = {
  // External attestations (high weight, external verification)
  'aci_certification':   1.0,    // Full weight for ACI certs
  'aci_capability':      1.0,    // Full weight for ACI capabilities
  'third_party_audit':   0.9,    // Slightly less (not ACI standard)

  // Behavioral signals (medium weight, earned through use)
  'execution_success':   0.6,    // Successful action completion
  'execution_failure':   0.8,    // Failures weighted higher (negative)
  'policy_compliance':   0.5,    // Following policies
  'policy_violation':    0.9,    // Violations weighted higher (negative)

  // Contextual signals (lower weight, situational)
  'session_context':     0.3,    // Temporary session info
  'environment_match':   0.4,    // Right environment for agent

  // System signals (variable)
  'canary_probe_pass':   0.5,    // Passed integrity check
  'canary_probe_fail':   1.0,    // Failed check (critical)
};
```

---

## 7. Layer Mapping

### 7.1 Architecture Comparison

```
ACI 5-Layer Architecture                    Vorion 4-Layer Stack
════════════════════════                    ════════════════════

┌─────────────────────────┐                 ┌─────────────────────────┐
│ Layer 5: Semantic       │ ◄──────────────▶│ (Integrated throughout) │
│ Governance              │    Semantic      │                         │
│ - Instruction integrity │    constraints   │                         │
│ - Output binding        │    at each       │                         │
│ - Inference scope       │    layer         │                         │
└─────────────────────────┘                 └─────────────────────────┘
          │
          ▼
┌─────────────────────────┐                 ┌─────────────────────────┐
│ Layer 4: Runtime        │ ◄──────────────▶│ CHAIN                   │
│ Assurance               │    Proof and     │ - Proof chain           │
│ - Audit trails          │    audit         │ - Merkle aggregation    │
│ - Attestations          │                  │ - External anchoring    │
│ - ZK proofs             │                  │ - ZK audit modes        │
└─────────────────────────┘                 └─────────────────────────┘
          │
          ▼
┌─────────────────────────┐                 ┌─────────────────────────┐
│ Layer 3: Application    │ ◄──────────────▶│ PROOF                   │
│ - MCP integration       │    Execution     │ - Proof event creation  │
│ - Tool protocols        │    & recording   │ - Execution recording   │
│ - Context servers       │                  │ - Evidence collection   │
└─────────────────────────┘                 └─────────────────────────┘
          │
          ▼
┌─────────────────────────┐                 ┌─────────────────────────┐
│ Layer 2: Capability     │ ◄──────────────▶│ ENFORCE                 │
│ - Trust tiers           │    Decision      │ - A3I authorization     │
│ - Capability levels     │    enforcement   │ - Trust evaluation      │
│ - Domain scopes         │                  │ - Policy enforcement    │
└─────────────────────────┘                 └─────────────────────────┘
          │
          ▼
┌─────────────────────────┐                 ┌─────────────────────────┐
│ Layer 1: Identity       │ ◄──────────────▶│ INTENT                  │
│ - Agent DIDs            │    Identity &    │ - Intent declaration    │
│ - Key management        │    request       │ - Agent identification  │
│ - Credential binding    │    submission    │ - Context capture       │
└─────────────────────────┘                 └─────────────────────────┘
```

### 7.2 Layer Mapping Details

#### Layer 1 (Identity) ↔ INTENT Layer

| ACI Concept | Vorion Implementation |
|-------------|----------------------|
| Agent DID | `agentId` (UUID, migrating to DID) |
| Key management | Component registry + signing keys |
| Credential binding | Trust profile + ACI certificate cache |

```typescript
interface ACIIdentityBinding {
  // ACI Layer 1 identity
  agentDID: string;           // did:key:... or did:web:...
  publicKey: JsonWebKey;      // Key for verification

  // Vorion binding
  vorionAgentId: string;      // Internal UUID
  trustProfileId: string;     // Link to trust profile
  componentId?: string;       // Component registry entry

  // Binding metadata
  boundAt: Date;
  bindingProof: string;       // Signature proving ownership
}
```

#### Layer 2 (Capability) ↔ ENFORCE Layer

| ACI Concept | Vorion Implementation |
|-------------|----------------------|
| Trust tiers (T0-T5) | ACI certification axis in permission formula |
| Capability levels (L0-L5) | Competence axis + per-domain tracking |
| Domain scopes | Namespace mapping (Section 5) |

```typescript
interface ACICapabilityEnforcement {
  // From ACI certificate
  certifiedTier: ACITrustTier;
  certifiedLevel: ACICapLevel;
  certifiedDomains: number;     // Bitmask

  // Vorion enforcement
  effectiveBand: TrustBand;     // After all ceilings applied
  allowedNamespaces: VorionNamespace[];
  constraints: DecisionConstraints;
}
```

#### Layer 3 (Application) ↔ PROOF Layer

| ACI Concept | Vorion Implementation |
|-------------|----------------------|
| MCP integration | MCP context server adapter |
| Tool protocols | Tool registry + allowed tools in constraints |
| Context servers | External context providers |

```typescript
interface ACIApplicationIntegration {
  // MCP context handling
  mcpServers: MCPServerConfig[];
  contextAuthentication: ContextAuthPolicy;

  // Proof generation
  proofEventCreation: (action: ExecutedAction) => ProofEvent;
  evidenceCollection: (outcome: Outcome) => TrustEvidence[];
}
```

#### Layer 4 (Runtime Assurance) ↔ CHAIN Layer

| ACI Concept | Vorion Implementation |
|-------------|----------------------|
| Audit trails | Proof chain (hash-linked, signed) |
| Attestations | External anchoring (Ethereum, TSA) |
| ZK proofs | ZK audit modes (SPEC-001) |

```typescript
interface ACIRuntimeAssurance {
  // Audit trail requirements
  proofChainRequired: boolean;
  merkleAggregationInterval: number;
  externalAnchoringDestination?: AnchorDestination;

  // ZK capabilities
  zkAuditEnabled: boolean;
  supportedZKClaims: ZKClaimType[];
}
```

#### Layer 5 (Semantic Governance) ↔ Integrated

ACI Layer 5 concepts are integrated throughout Vorion's stack rather than isolated:

| ACI Concept | Vorion Integration Point |
|-------------|-------------------------|
| Instruction integrity | Intent validation + system prompt hashing |
| Output binding | Decision constraints + schema validation |
| Inference scope | Data sensitivity levels + scope limits |
| Context authentication | MCP integration + trust signals |

---

## 8. Extension Protocol Integration

### 8.1 ACI Layer 4 Extension Model

ACI Layer 4 defines an extension mechanism for runtime assurance features:

```typescript
interface ACIExtension {
  extensionId: string;          // Unique extension identifier
  version: string;              // Semver version
  type: ACIExtensionType;       // Category of extension
  config: Record<string, unknown>;
  signature?: string;           // Optional signature from extension provider
}

type ACIExtensionType =
  | 'audit_enhancement'         // Additional audit capabilities
  | 'attestation_source'        // New attestation providers
  | 'monitoring_hook'           // Runtime monitoring
  | 'constraint_plugin'         // Additional constraint types
  | 'verification_method';      // Alternative verification methods
```

### 8.2 Vorion Modular Architecture Mapping

Vorion's modular architecture maps to ACI extensions:

```
ACI Extension Types                         Vorion Modules
═══════════════════                         ══════════════

┌─────────────────────┐                     ┌─────────────────────────┐
│ audit_enhancement   │────────────────────▶│ packages/audit          │
│                     │                     │ - Merkle aggregation    │
│                     │                     │ - External anchoring    │
│                     │                     │ - ZK proof generation   │
└─────────────────────┘                     └─────────────────────────┘

┌─────────────────────┐                     ┌─────────────────────────┐
│ attestation_source  │────────────────────▶│ packages/signals        │
│                     │                     │ - Signal ingestion      │
│                     │                     │ - Evidence collection   │
│                     │                     │ - Trust delta calc      │
└─────────────────────┘                     └─────────────────────────┘

┌─────────────────────┐                     ┌─────────────────────────┐
│ monitoring_hook     │────────────────────▶│ packages/canary         │
│                     │                     │ - Canary probes         │
│                     │                     │ - Integrity checks      │
│                     │                     │ - Anomaly detection     │
└─────────────────────┘                     └─────────────────────────┘

┌─────────────────────┐                     ┌─────────────────────────┐
│ constraint_plugin   │────────────────────▶│ packages/policies       │
│                     │                     │ - Policy bundles        │
│                     │                     │ - Custom constraints    │
│                     │                     │ - Rate limiters         │
└─────────────────────┘                     └─────────────────────────┘

┌─────────────────────┐                     ┌─────────────────────────┐
│ verification_method │────────────────────▶│ packages/verification   │
│                     │                     │ - ZK verifiers          │
│                     │                     │ - Signature validation  │
│                     │                     │ - TEE attestation       │
└─────────────────────┘                     └─────────────────────────┘
```

### 8.3 Extension Registration

```typescript
interface VorionACIExtensionRegistry {
  /**
   * Register an ACI extension with Vorion
   */
  registerExtension(ext: ACIExtension): Promise<RegistrationResult>;

  /**
   * Query registered extensions
   */
  getExtensions(type?: ACIExtensionType): ACIExtension[];

  /**
   * Enable/disable extension at runtime
   */
  setExtensionEnabled(extensionId: string, enabled: boolean): void;

  /**
   * Verify extension signature
   */
  verifyExtension(ext: ACIExtension): Promise<VerificationResult>;
}

// Example: Registering an ACI-compliant audit extension
const ethAnchorExtension: ACIExtension = {
  extensionId: 'eth-anchor-v1',
  version: '1.0.0',
  type: 'audit_enhancement',
  config: {
    network: 'mainnet',
    contractAddress: '0x...',
    anchorInterval: '1 hour',
  },
};

await extensionRegistry.registerExtension(ethAnchorExtension);
```

---

## 9. Semantic Governance (Layer 5)

### 9.1 Overview

ACI Layer 5 (Semantic Governance) ensures that AI agents operate within intended semantic boundaries. Vorion integrates these concepts throughout its stack.

### 9.2 Instruction Integrity

**Problem:** Prevent system prompt manipulation or drift.

**Solution:** Hash-bound system prompts with verification.

```typescript
interface InstructionIntegrityConfig {
  /**
   * System prompt hashing for integrity verification
   */
  systemPromptHash: {
    enabled: boolean;
    algorithm: 'SHA-256' | 'SHA-384' | 'SHA-512';
    binding: 'strict' | 'warn';  // Fail or warn on mismatch
  };

  /**
   * Allowed prompt modification patterns
   */
  allowedModifications: {
    appendOnly: boolean;        // Can only add, not remove
    versionedUpdates: boolean;  // Requires version increment
    signedUpdates: boolean;     // Requires signature from authority
  };
}

interface InstructionBinding {
  // The bound instruction content
  instructionHash: string;
  instructionVersion: string;

  // Binding metadata
  boundAt: Date;
  boundBy: string;              // Authority DID
  signature: string;            // Authority signature

  // Verification
  verify(): Promise<boolean>;
}

// Implementation in Intent processing
function validateIntent(intent: Intent, binding: InstructionBinding): ValidationResult {
  const currentHash = sha256(intent.context?.systemPrompt ?? '');

  if (currentHash !== binding.instructionHash) {
    if (binding.strictMode) {
      return { valid: false, reason: 'System prompt integrity violation' };
    } else {
      logWarning('System prompt hash mismatch', { expected: binding.instructionHash, actual: currentHash });
    }
  }

  return { valid: true };
}
```

### 9.3 Output Binding

**Problem:** Ensure agent outputs conform to expected schemas and constraints.

**Solution:** Schema-based output validation with constraint enforcement.

```typescript
interface OutputBindingConfig {
  /**
   * Schema validation for agent outputs
   */
  schemaValidation: {
    enabled: boolean;
    schemas: Record<string, JSONSchema>;
    failOnViolation: boolean;
  };

  /**
   * Content constraints
   */
  contentConstraints: {
    maxLength?: number;
    prohibitedPatterns?: RegExp[];
    requiredFields?: string[];
    formatValidation?: FormatValidator[];
  };

  /**
   * Semantic constraints
   */
  semanticConstraints: {
    topicScope?: string[];      // Allowed topic categories
    sentimentBounds?: { min: number; max: number };
    factualityRequirement?: 'strict' | 'advisory' | 'none';
  };
}

// Integration with Decision constraints
interface DecisionConstraints {
  // ... existing fields ...

  /**
   * Output binding requirements (ACI Layer 5)
   */
  outputBinding?: {
    responseSchema?: JSONSchema;
    contentFilters: string[];
    maxResponseTokens?: number;
  };
}
```

### 9.4 Inference Scope

**Problem:** Limit what can be derived vs. directly accessed.

**Solution:** Data classification + inference boundaries.

```typescript
interface InferenceScopeConfig {
  /**
   * Data access vs inference classification
   */
  accessTypes: {
    direct: DataScope[];        // Can directly access
    inferrable: DataScope[];    // Can derive from direct access
    prohibited: DataScope[];    // Cannot access or infer
  };

  /**
   * Cross-reference limits
   */
  crossReferencing: {
    maxSources: number;         // Max data sources to combine
    sensitivityMixing: boolean; // Can mix sensitivity levels
    timeWindowDays?: number;    // Historical data limit
  };

  /**
   * Inference chain limits
   */
  inferenceDepth: {
    maxHops: number;            // Max inference steps
    requireExplanation: boolean; // Must explain reasoning
  };
}

// Example: Agent can access user preferences, can infer interests, cannot access health data
const exampleScope: InferenceScopeConfig = {
  accessTypes: {
    direct: ['user.preferences', 'user.history'],
    inferrable: ['user.interests', 'user.behavior_patterns'],
    prohibited: ['user.health', 'user.financial', 'user.pii'],
  },
  crossReferencing: {
    maxSources: 3,
    sensitivityMixing: false,
    timeWindowDays: 90,
  },
  inferenceDepth: {
    maxHops: 2,
    requireExplanation: true,
  },
};
```

### 9.5 Context Authentication (MCP Integration)

**Problem:** Ensure context provided to agents is authentic and authorized.

**Solution:** MCP server authentication + context signing.

```typescript
interface ContextAuthenticationConfig {
  /**
   * MCP server trust requirements
   */
  mcpTrust: {
    requireSignedContext: boolean;
    trustedServers: string[];    // Allowed server DIDs
    minimumTrustLevel: number;   // Min trust score for server
  };

  /**
   * Context validation
   */
  contextValidation: {
    validateFreshness: boolean;  // Check context age
    maxContextAgeMs: number;     // Max allowed age
    validateSource: boolean;     // Verify source server
    validateIntegrity: boolean;  // Check for tampering
  };

  /**
   * Context scope limits
   */
  scopeLimits: {
    maxContextSize: number;      // Max bytes
    allowedContextTypes: string[];
    requireExplicitConsent: boolean;
  };
}

interface AuthenticatedContext {
  // Context content
  content: Record<string, unknown>;
  contentHash: string;

  // Authentication
  sourceServer: string;         // Server DID
  signature: string;            // Server signature
  issuedAt: Date;
  expiresAt?: Date;

  // Verification result
  verified: boolean;
  verificationDetails?: {
    signatureValid: boolean;
    sourceAuthorized: boolean;
    contentFresh: boolean;
  };
}

// MCP context authentication flow
async function authenticateMCPContext(
  rawContext: unknown,
  mcpServer: MCPServer,
  config: ContextAuthenticationConfig
): Promise<AuthenticatedContext> {
  // 1. Parse and validate structure
  const parsed = parseMCPContext(rawContext);

  // 2. Verify server signature if required
  if (config.mcpTrust.requireSignedContext) {
    const sigValid = await verifyContextSignature(parsed, mcpServer.publicKey);
    if (!sigValid) {
      throw new ContextAuthError('Invalid context signature');
    }
  }

  // 3. Check server authorization
  if (!config.mcpTrust.trustedServers.includes(mcpServer.did)) {
    throw new ContextAuthError('Unauthorized MCP server');
  }

  // 4. Validate freshness
  if (config.contextValidation.validateFreshness) {
    const age = Date.now() - parsed.issuedAt.getTime();
    if (age > config.contextValidation.maxContextAgeMs) {
      throw new ContextAuthError('Context too old');
    }
  }

  return {
    content: parsed.content,
    contentHash: sha256(JSON.stringify(parsed.content)),
    sourceServer: mcpServer.did,
    signature: parsed.signature,
    issuedAt: parsed.issuedAt,
    verified: true,
    verificationDetails: {
      signatureValid: true,
      sourceAuthorized: true,
      contentFresh: true,
    },
  };
}
```

---

## 10. Security Hardening Requirements

### 10.1 DPoP Mandatory for All Tokens

**Requirement:** All OAuth2 tokens MUST use Demonstrating Proof of Possession (DPoP).

```typescript
interface DPoPRequirements {
  /**
   * DPoP is mandatory for all tiers
   */
  mandatory: true;

  /**
   * Key requirements
   */
  keyAlgorithms: ['ES256', 'ES384', 'EdDSA'];  // Allowed algorithms

  /**
   * Token binding
   */
  tokenBinding: {
    bindToClientKey: true;     // Token bound to client key
    bindToAccessToken: true;   // DPoP proof binds to access token
    includeNonce: true;        // Server nonce required
  };

  /**
   * Proof requirements
   */
  proofRequirements: {
    maxClockSkew: 60;          // Seconds
    singleUse: true;           // Each proof used once
    requireHTM: true;          // HTTP method binding
    requireHTU: true;          // HTTP URI binding
  };
}

// DPoP header validation
interface DPoPProof {
  typ: 'dpop+jwt';
  alg: 'ES256' | 'ES384' | 'EdDSA';
  jwk: JsonWebKey;

  // Claims
  jti: string;                 // Unique identifier
  htm: string;                 // HTTP method
  htu: string;                 // HTTP URI
  iat: number;                 // Issued at
  nonce?: string;              // Server nonce
  ath?: string;                // Access token hash (for resource requests)
}

// Validation
function validateDPoPProof(
  proof: string,
  request: Request,
  config: DPoPRequirements
): ValidationResult {
  const decoded = decodeJWT(proof);

  // 1. Verify structure
  if (decoded.header.typ !== 'dpop+jwt') {
    return { valid: false, reason: 'Invalid typ' };
  }

  // 2. Verify algorithm
  if (!config.keyAlgorithms.includes(decoded.header.alg)) {
    return { valid: false, reason: 'Disallowed algorithm' };
  }

  // 3. Verify HTTP method binding
  if (decoded.payload.htm !== request.method) {
    return { valid: false, reason: 'HTTP method mismatch' };
  }

  // 4. Verify URI binding
  if (decoded.payload.htu !== request.url) {
    return { valid: false, reason: 'HTTP URI mismatch' };
  }

  // 5. Verify freshness
  const age = Date.now() / 1000 - decoded.payload.iat;
  if (Math.abs(age) > config.proofRequirements.maxClockSkew) {
    return { valid: false, reason: 'Clock skew exceeded' };
  }

  // 6. Verify signature
  const sigValid = verifyJWTSignature(proof, decoded.header.jwk);
  if (!sigValid) {
    return { valid: false, reason: 'Invalid signature' };
  }

  return { valid: true };
}
```

### 10.2 TEE Binding for T4+

**Requirement:** Agents at Trust Band T4 or higher MUST operate within a Trusted Execution Environment.

```typescript
interface TEEBindingRequirements {
  /**
   * Tiers requiring TEE
   */
  requiredForBands: [TrustBand.T4_TRUSTED, TrustBand.T5_CERTIFIED];

  /**
   * Accepted TEE types
   */
  acceptedTEETypes: ['SGX', 'TrustZone', 'SEV', 'CCA'];

  /**
   * Attestation requirements
   */
  attestation: {
    requireRemoteAttestation: true;
    attestationProviders: string[];  // Trusted attestation services
    attestationFrequency: 'per-session' | 'periodic';
    periodicIntervalMs?: number;
  };

  /**
   * Key sealing
   */
  keySealing: {
    sealToEnclave: true;           // Keys sealed to enclave
    allowExport: false;            // No key export
    requireMRSIGNER: boolean;      // Bind to signer identity
    requireMRENCLAVE: boolean;     // Bind to enclave identity
  };
}

interface TEEAttestation {
  // Attestation evidence
  quote: string;                   // Platform quote
  enclaveId: string;               // Enclave identifier
  mrenclave: string;               // Enclave measurement
  mrsigner: string;                // Signer measurement

  // Attestation verification
  verifiedBy: string;              // Attestation service DID
  verifiedAt: Date;
  validUntil: Date;

  // Platform details
  platform: 'SGX' | 'TrustZone' | 'SEV' | 'CCA';
  securityVersion: number;

  // Binding to agent
  agentDID: string;
  keyBinding: string;              // Key bound to enclave
}

// TEE verification in trust evaluation
function applyTEECeiling(
  profile: TrustProfile,
  attestation: TEEAttestation | null,
  config: TEEBindingRequirements
): TrustProfile {
  // If T4+ is requested but no TEE attestation, cap at T3
  if (profile.band >= TrustBand.T4_TRUSTED && !attestation) {
    return {
      ...profile,
      band: TrustBand.T3_STANDARD,
      adjustedScore: Math.min(profile.adjustedScore, 665),
      reasoning: [...profile.reasoning, 'TEE attestation required for T4+'],
    };
  }

  // If attestation present, verify it's valid
  if (attestation) {
    if (new Date() > attestation.validUntil) {
      return {
        ...profile,
        band: TrustBand.T3_STANDARD,
        adjustedScore: Math.min(profile.adjustedScore, 665),
        reasoning: [...profile.reasoning, 'TEE attestation expired'],
      };
    }
  }

  return profile;
}
```

### 10.3 Pairwise DIDs for Private Data

**Requirement:** When handling private data, agents MUST use pairwise DIDs to prevent correlation.

```typescript
interface PairwiseDIDRequirements {
  /**
   * When pairwise DIDs are required
   */
  requiredFor: {
    piiHandling: true;
    phiHandling: true;
    financialData: true;
    crossDomainCommunication: boolean;
  };

  /**
   * DID generation
   */
  didGeneration: {
    method: 'did:key' | 'did:peer';
    derivationPath: string;        // HD key derivation
    rotationPolicy: 'per-session' | 'per-relationship' | 'manual';
  };

  /**
   * Correlation prevention
   */
  correlationPrevention: {
    uniquePerRelationship: true;   // Different DID per counterparty
    noGlobalIdentifier: true;      // No shared identifier across relationships
    blindedRouting: boolean;       // Use onion routing for privacy
  };
}

interface PairwiseDIDBinding {
  // The pairwise DID
  pairwiseDID: string;

  // Relationship context
  counterpartyDID: string;
  relationship: string;            // Purpose/context

  // Derivation (for recovery)
  rootDIDReference: string;        // Encrypted reference to root
  derivationIndex: number;

  // Lifecycle
  createdAt: Date;
  rotatedAt?: Date;
  revokedAt?: Date;
}

// Pairwise DID generation
async function generatePairwiseDID(
  rootKey: CryptoKey,
  counterparty: string,
  relationship: string
): Promise<PairwiseDIDBinding> {
  // Derive deterministic but unlinkable key
  const derivationSeed = await deriveKey(
    rootKey,
    `${counterparty}:${relationship}`
  );

  const pairwiseKey = await generateKeyFromSeed(derivationSeed);
  const pairwiseDID = await createDIDKey(pairwiseKey);

  return {
    pairwiseDID,
    counterpartyDID: counterparty,
    relationship,
    rootDIDReference: await encryptReference(rootKey),
    derivationIndex: await getNextIndex(counterparty),
    createdAt: new Date(),
  };
}
```

### 10.4 Revocation SLAs by Tier

**Requirement:** Revocation propagation times MUST meet tier-specific SLAs.

```typescript
interface RevocationSLAs {
  /**
   * Maximum time for revocation to propagate, by tier
   */
  propagationTime: {
    T0_UNTRUSTED:   '24 hours';    // Low priority
    T1_OBSERVED:    '4 hours';     // Moderate urgency
    T2_LIMITED:     '1 hour';      // Important
    T3_STANDARD:    '15 minutes';  // Critical
    T4_TRUSTED:     '5 minutes';   // Very critical
    T5_CERTIFIED:   '1 minute';    // Immediate
  };

  /**
   * Revocation notification requirements
   */
  notification: {
    T0_T2: 'async';                // Async notification acceptable
    T3_T5: 'push';                 // Must push to all relying parties
  };

  /**
   * Verification requirements
   */
  verification: {
    staledCredentialGrace: '5 minutes';  // Max time to use stale credential
    requireOnlineCheck: {
      T4_TRUSTED: true,
      T5_CERTIFIED: true,
    };
  };
}

// Revocation check implementation
interface RevocationChecker {
  /**
   * Check if credential is revoked
   */
  checkRevocation(
    credentialId: string,
    tier: TrustBand
  ): Promise<RevocationStatus>;

  /**
   * Subscribe to revocation events
   */
  subscribeToRevocations(
    callback: (revocation: RevocationEvent) => void
  ): Subscription;

  /**
   * Get revocation SLA for tier
   */
  getSLA(tier: TrustBand): Duration;
}

interface RevocationStatus {
  credentialId: string;
  revoked: boolean;
  revokedAt?: Date;
  reason?: RevocationReason;
  checkPerformedAt: Date;

  // Freshness metadata
  lastKnownGoodAt?: Date;
  nextCheckDue?: Date;
}

type RevocationReason =
  | 'key_compromise'
  | 'affiliation_change'
  | 'privilege_withdrawn'
  | 'certificate_superseded'
  | 'cessation_of_operation'
  | 'policy_violation';
```

### 10.5 Security Requirements Matrix

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                      SECURITY REQUIREMENTS BY TRUST BAND                          │
├─────────────┬────────────┬────────────┬────────────┬────────────┬────────────────┤
│ Requirement │    T0-T1   │    T2      │    T3      │    T4      │      T5        │
├─────────────┼────────────┼────────────┼────────────┼────────────┼────────────────┤
│ DPoP        │  Required  │  Required  │  Required  │  Required  │   Required     │
├─────────────┼────────────┼────────────┼────────────┼────────────┼────────────────┤
│ TEE Binding │  Optional  │  Optional  │ Recommended│  Required  │   Required     │
├─────────────┼────────────┼────────────┼────────────┼────────────┼────────────────┤
│ Pairwise DID│  Optional  │ For PII   │ For PII    │  Required  │   Required     │
├─────────────┼────────────┼────────────┼────────────┼────────────┼────────────────┤
│ Revocation  │   24hr     │   4hr      │   1hr      │   15min    │   5min         │
│ SLA         │            │            │            │            │   (1min goal)  │
├─────────────┼────────────┼────────────┼────────────┼────────────┼────────────────┤
│ Attestation │   None     │  Annual    │ Quarterly  │  Monthly   │   Continuous   │
│ Frequency   │            │            │            │            │                │
├─────────────┼────────────┼────────────┼────────────┼────────────┼────────────────┤
│ Audit Log   │  Optional  │  Required  │  Required  │  Required  │   Immutable    │
│ Retention   │            │  30 days   │  90 days   │  1 year    │   7 years      │
├─────────────┼────────────┼────────────┼────────────┼────────────┼────────────────┤
│ Encryption  │  TLS 1.3   │  TLS 1.3   │  TLS 1.3   │  TLS 1.3   │   TLS 1.3 +    │
│ Requirements│            │            │  + at-rest │  + at-rest │   HSM keys     │
└─────────────┴────────────┴────────────┴────────────┴────────────┴────────────────┘
```

---

## 11. Migration Path

### 11.1 Migration Phases

```
Phase 1: Assessment (Week 1-2)
═══════════════════════════════
┌─────────────────────────────────────────────────────────────────────┐
│  • Inventory existing agents and their trust profiles               │
│  • Identify ACI certification requirements per agent                │
│  • Map current Vorion namespaces to ACI domains                     │
│  • Assess observation tier coverage                                  │
│  • Document breaking change risks                                    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
Phase 2: Schema Migration (Week 2-4)
════════════════════════════════════
┌─────────────────────────────────────────────────────────────────────┐
│  • Add ACICertificate storage to trust profile                      │
│  • Add competence level tracking per domain                         │
│  • Implement three-axis score calculation                           │
│  • Deploy unified score mapping functions                           │
│  • Migrate legacy SPEC-002 scores to canonical scale                │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
Phase 3: Integration (Week 4-6)
═══════════════════════════════
┌─────────────────────────────────────────────────────────────────────┐
│  • Implement ACI certificate ingestion                              │
│  • Deploy signal integration for ACI attestations                   │
│  • Update Effective Permission formula in A3I                       │
│  • Add domain code mapping to intent processing                     │
│  • Enable Layer 5 semantic governance features                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
Phase 4: Hardening (Week 6-8)
═════════════════════════════
┌─────────────────────────────────────────────────────────────────────┐
│  • Enforce DPoP for all token operations                            │
│  • Implement TEE binding for T4+ agents                             │
│  • Deploy pairwise DID infrastructure                               │
│  • Configure revocation SLAs                                         │
│  • Security audit of unified architecture                            │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
Phase 5: Certification (Week 8-10)
══════════════════════════════════
┌─────────────────────────────────────────────────────────────────────┐
│  • Obtain ACI certifications for eligible agents                    │
│  • Register with ACI certificate authorities                        │
│  • Publish Vorion as ACI-compliant runtime                          │
│  • Document migration for downstream deployments                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 11.2 Backward Compatibility

#### Preserved Behaviors

```typescript
/**
 * Backward compatibility layer for pre-SPEC-003 deployments
 */
interface LegacyCompatibility {
  /**
   * Existing TrustBand semantics preserved
   * - T0-T5 bands still map to same score ranges
   * - scoreToTrustBand() function unchanged
   * - TrustBand enum values unchanged
   */
  trustBandPreserved: true;

  /**
   * Existing trust signals continue to work
   * - BT, CT, GT, XT, AC dimensions unchanged
   * - Evidence collection unchanged
   * - Trust decay model unchanged
   */
  trustSignalsPreserved: true;

  /**
   * Existing decision flow unchanged for local agents
   * - Intent → Decision flow preserved
   * - Policy evaluation preserved
   * - Constraint application preserved
   */
  decisionFlowPreserved: true;
}

/**
 * Agents without ACI certificates continue to operate locally
 */
function evaluateNonACIAgent(intent: Intent): Decision {
  // No ACI certificate → ACI axis doesn't apply
  // Agent operates purely on Vorion runtime trust
  const trustProfile = getTrustProfile(intent.agentId);

  return {
    // ... existing decision logic
    aciCertificate: null,
    effectiveFromACI: null,  // ACI axis not applicable
  };
}
```

#### Breaking Changes

```typescript
/**
 * Breaking changes that require migration
 */
interface BreakingChanges {
  /**
   * 1. Cross-deployment operations now require ACI
   *
   * Before: Agent could call external services with local trust
   * After:  Agent must have ACI certificate for cross-deployment calls
   *
   * Migration: Obtain T1+ ACI certification before external calls
   */
  crossDeploymentACI: true;

  /**
   * 2. T4+ now requires TEE binding
   *
   * Before: T4 achievable through behavioral trust alone
   * After:  T4 requires valid TEE attestation
   *
   * Migration: Deploy agents in TEE or accept T3 ceiling
   */
  teeRequirementForT4: true;

  /**
   * 3. Competence level now domain-specific
   *
   * Before: Single capability level per agent
   * After:  Capability level tracked per domain
   *
   * Migration: Initialize domain-specific levels from global level
   */
  domainSpecificCompetence: true;
}
```

### 11.3 Migration Scripts

```typescript
/**
 * Migration script: SPEC-002 to SPEC-003
 */
export async function migrateToSpec003(db: Database): Promise<MigrationResult> {
  const results: MigrationResult = {
    agentsMigrated: 0,
    certificatesCreated: 0,
    competenceLevelsMigrated: 0,
    errors: [],
  };

  // 1. Add new columns to trust_profiles table
  await db.schema.alterTable('trust_profiles', (table) => {
    table.jsonb('aci_certificate').nullable();
    table.jsonb('competence_levels').defaultTo('{}');
    table.jsonb('domain_capabilities').defaultTo('{}');
  });

  // 2. Migrate existing agents
  const agents = await db.query('SELECT * FROM trust_profiles');

  for (const agent of agents) {
    try {
      // Convert legacy score to competence levels
      const globalLevel = scoreToCompetenceLevel(agent.composite_score);
      const competenceLevels = {
        general: globalLevel,
        // Initialize all domains to same level
        ...Object.fromEntries(
          VORION_NAMESPACES.map(ns => [ns, globalLevel])
        ),
      };

      // Map existing capabilities to domains
      const domainCapabilities = mapLegacyCapabilities(agent.capabilities);

      await db.query(`
        UPDATE trust_profiles
        SET competence_levels = $1, domain_capabilities = $2
        WHERE agent_id = $3
      `, [competenceLevels, domainCapabilities, agent.agent_id]);

      results.agentsMigrated++;
    } catch (error) {
      results.errors.push({ agentId: agent.agent_id, error: error.message });
    }
  }

  // 3. Create indexes for new queries
  await db.schema.createIndex('trust_profiles_aci_cert_idx')
    .on('trust_profiles')
    .using('gin')
    .expression('aci_certificate');

  return results;
}

/**
 * Rollback script if migration fails
 */
export async function rollbackSpec003(db: Database): Promise<void> {
  await db.schema.alterTable('trust_profiles', (table) => {
    table.dropColumn('aci_certificate');
    table.dropColumn('competence_levels');
    table.dropColumn('domain_capabilities');
  });

  await db.schema.dropIndex('trust_profiles_aci_cert_idx');
}
```

### 11.4 Feature Flags

```typescript
/**
 * Feature flags for gradual rollout
 */
interface Spec003FeatureFlags {
  /**
   * Enable three-axis trust evaluation
   * When false: Use legacy single-axis evaluation
   */
  threeAxisTrust: boolean;

  /**
   * Require ACI for cross-deployment
   * When false: Allow legacy cross-deployment without ACI
   */
  aciForCrossDeployment: boolean;

  /**
   * Enforce TEE for T4+
   * When false: Allow T4+ without TEE
   */
  teeBoundForT4Plus: boolean;

  /**
   * Enable Layer 5 semantic governance
   * When false: Skip instruction integrity, output binding
   */
  semanticGovernance: boolean;

  /**
   * Enforce DPoP
   * When false: Allow bearer tokens (legacy)
   */
  dpopMandatory: boolean;

  /**
   * Domain-specific competence tracking
   * When false: Use single global competence level
   */
  domainSpecificCompetence: boolean;
}

const DEFAULT_FEATURE_FLAGS: Spec003FeatureFlags = {
  threeAxisTrust: true,
  aciForCrossDeployment: false,  // Gradual rollout
  teeBoundForT4Plus: false,       // Gradual rollout
  semanticGovernance: true,
  dpopMandatory: false,           // Gradual rollout
  domainSpecificCompetence: true,
};
```

---

## 12. Implementation Reference

### 12.1 Type Definitions

```typescript
// packages/contracts/src/aci/types.ts

/**
 * ACI Certification Tiers (external standard)
 */
export enum ACICertificationTier {
  T0_UNVERIFIED = 0,
  T1_REGISTERED = 1,
  T2_TESTED = 2,
  T3_CERTIFIED = 3,
  T4_VERIFIED = 4,
  T5_SOVEREIGN = 5,
}

/**
 * ACI Capability Levels (external standard)
 */
export enum ACICapabilityLevel {
  L0_OBSERVE = 0,
  L1_ADVISE = 1,
  L2_DRAFT = 2,
  L3_EXECUTE = 3,
  L4_AUTONOMOUS = 4,
  L5_SOVEREIGN = 5,
}

/**
 * ACI Domain Codes
 */
export type ACIDomainCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'S';

/**
 * Vorion Competence Level (internal, maps to ACI capability)
 */
export enum CompetenceLevel {
  L0_AWARE = 0,
  L1_BASIC = 1,
  L2_COMPETENT = 2,
  L3_PROFICIENT = 3,
  L4_EXPERT = 4,
  L5_MASTERY = 5,
}

/**
 * Vorion Capability Namespace (internal)
 */
export type VorionNamespace =
  | 'sandbox'
  | 'data'
  | 'comm'
  | 'execute'
  | 'financial'
  | 'admin'
  | 'efficiency'
  | 'custom';

/**
 * Unified trust state combining all axes
 */
export interface UnifiedTrustState {
  // Agent identity
  agentId: string;
  agentDID?: string;

  // Certification axis (ACI)
  aciCertificate?: ACICertificate;
  certificationTier: ACICertificationTier;
  certifiedDomains: ACIDomainCode[];

  // Competence axis (skill depth)
  globalCompetenceLevel: CompetenceLevel;
  domainCompetenceLevels: Record<VorionNamespace, CompetenceLevel>;

  // Runtime axis (Vorion)
  trustProfile: TrustProfile;
  runtimeBand: TrustBand;
  runtimeScore: number;

  // Observation ceiling
  observationTier: ObservationTier;
  observationCeiling: number;

  // Effective state
  effectiveTier: number;
  effectiveScore: number;
  effectiveNamespaces: VorionNamespace[];
  limitingFactor: LimitingFactor;
}
```

### 12.2 Service Interfaces

```typescript
// packages/trust/src/unified/interfaces.ts

/**
 * Unified Trust Evaluator
 */
export interface IUnifiedTrustEvaluator {
  /**
   * Evaluate unified trust state for an agent
   */
  evaluateUnifiedTrust(agentId: string): Promise<UnifiedTrustState>;

  /**
   * Compute effective permission for an intent
   */
  computeEffectivePermission(
    state: UnifiedTrustState,
    intent: Intent
  ): Promise<EffectivePermission>;

  /**
   * Ingest ACI certificate as trust signal
   */
  ingestACICertificate(
    agentId: string,
    certificate: ACICertificate
  ): Promise<void>;

  /**
   * Update competence level for domain
   */
  updateCompetenceLevel(
    agentId: string,
    domain: VorionNamespace,
    level: CompetenceLevel,
    evidence: TrustEvidence
  ): Promise<void>;
}

/**
 * ACI Certificate Manager
 */
export interface IACICertificateManager {
  /**
   * Fetch and verify ACI certificate for agent
   */
  fetchCertificate(agentDID: string): Promise<ACICertificate | null>;

  /**
   * Verify certificate signature and validity
   */
  verifyCertificate(cert: ACICertificate): Promise<VerificationResult>;

  /**
   * Check revocation status
   */
  checkRevocation(certId: string): Promise<RevocationStatus>;

  /**
   * Cache certificate locally
   */
  cacheCertificate(cert: ACICertificate): Promise<void>;
}

/**
 * Domain Mapper
 */
export interface IDomainMapper {
  /**
   * Map ACI domains to Vorion namespaces
   */
  aciToVorion(domains: ACIDomainCode[]): VorionNamespace[];

  /**
   * Map Vorion namespaces to ACI domains
   */
  vorionToACI(namespaces: VorionNamespace[]): ACIDomainCode[];

  /**
   * Compute bitmask from domains
   */
  toBitmask(domains: ACIDomainCode[]): number;

  /**
   * Parse bitmask to domains
   */
  fromBitmask(mask: number): ACIDomainCode[];
}
```

### 12.3 Database Schema Extensions

```typescript
// packages/db/src/schema/aci.ts

import { pgTable, uuid, text, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * ACI certificate cache
 */
export const aciCertificates = pgTable('aci_certificates', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull(),
  agentDID: text('agent_did').notNull(),
  issuerDID: text('issuer_did').notNull(),

  // Certificate content
  certificationTier: integer('certification_tier').notNull(),
  capabilityLevel: integer('capability_level').notNull(),
  domainMask: integer('domain_mask').notNull(),

  // Validity
  issuedAt: timestamp('issued_at').notNull(),
  expiresAt: timestamp('expires_at').notNull(),

  // Signature
  signature: text('signature').notNull(),
  signatureAlgorithm: text('signature_algorithm').notNull(),

  // Verification
  verifiedAt: timestamp('verified_at'),
  verificationStatus: text('verification_status'),

  // Revocation
  revoked: boolean('revoked').default(false),
  revokedAt: timestamp('revoked_at'),
  revocationReason: text('revocation_reason'),

  // Extensions
  extensions: jsonb('extensions'),

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  agentIdx: index('aci_cert_agent_idx').on(table.agentId),
  didIdx: index('aci_cert_did_idx').on(table.agentDID),
  issuerIdx: index('aci_cert_issuer_idx').on(table.issuerDID),
}));

/**
 * Competence level tracking per domain
 */
export const agentCompetenceLevels = pgTable('agent_competence_levels', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull(),

  // Domain and level
  domain: text('domain').notNull(),  // VorionNamespace
  level: integer('level').notNull(),  // 0-5
  score: integer('score').notNull(),  // 0-1000

  // Evidence
  lastEvidenceId: uuid('last_evidence_id'),
  evidenceCount: integer('evidence_count').default(0),

  // Temporal
  levelAchievedAt: timestamp('level_achieved_at'),
  lastActivityAt: timestamp('last_activity_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  agentDomainIdx: index('competence_agent_domain_idx')
    .on(table.agentId, table.domain).unique(),
}));
```

---

## 13. Test Requirements

### 13.1 Unit Tests

```typescript
describe('UnifiedTrustEvaluator', () => {
  describe('three-axis evaluation', () => {
    it('should compute effective tier as minimum of all axes');
    it('should handle missing ACI certificate (local-only mode)');
    it('should apply observation ceiling correctly');
    it('should track limiting factor');
  });

  describe('score mapping', () => {
    it('should map SPEC-002 scores to canonical scale');
    it('should convert ACI tiers to score ranges');
    it('should convert competence levels to score ranges');
    it('should handle boundary conditions');
  });

  describe('domain mapping', () => {
    it('should map ACI domains to Vorion namespaces');
    it('should map Vorion namespaces to ACI domains');
    it('should compute correct bitmask');
    it('should parse bitmask to domains');
  });
});

describe('ACICertificateManager', () => {
  describe('certificate verification', () => {
    it('should verify valid certificate signature');
    it('should reject expired certificate');
    it('should check revocation status');
    it('should handle unknown issuer');
  });

  describe('certificate ingestion', () => {
    it('should convert certificate to trust evidence');
    it('should update all relevant trust dimensions');
    it('should record proof chain entry');
  });
});

describe('EffectivePermissionFormula', () => {
  it('should deny when any axis insufficient');
  it('should permit when all axes sufficient');
  it('should identify correct limiting factor');
  it('should apply context policy ceiling');
});
```

### 13.2 Integration Tests

```typescript
describe('ACI-Vorion Integration', () => {
  describe('end-to-end flow', () => {
    it('should ingest ACI certificate and update trust');
    it('should evaluate intent with three-axis trust');
    it('should enforce domain restrictions');
    it('should create proper audit trail');
  });

  describe('migration scenarios', () => {
    it('should migrate legacy agent to unified model');
    it('should preserve existing trust on migration');
    it('should initialize domain-specific competence');
  });

  describe('security requirements', () => {
    it('should enforce DPoP on token operations');
    it('should require TEE for T4+ operations');
    it('should use pairwise DIDs for PII');
    it('should meet revocation SLAs');
  });
});
```

### 13.3 Conformance Tests

```typescript
describe('ACI v1.1.0 Conformance', () => {
  describe('Layer 1 (Identity)', () => {
    it('should accept valid agent DIDs');
    it('should verify DID document resolution');
    it('should bind credentials to DID');
  });

  describe('Layer 2 (Capability)', () => {
    it('should parse all 6 trust tiers');
    it('should parse all 6 capability levels');
    it('should parse all 10 domain codes');
    it('should handle domain bitmask correctly');
  });

  describe('Layer 3 (Application)', () => {
    it('should integrate with MCP context servers');
    it('should authenticate context sources');
  });

  describe('Layer 4 (Runtime Assurance)', () => {
    it('should produce ACI-compliant audit records');
    it('should support ACI extension protocol');
  });

  describe('Layer 5 (Semantic Governance)', () => {
    it('should enforce instruction integrity');
    it('should validate output schemas');
    it('should respect inference scope limits');
  });
});
```

---

## Appendices

### Appendix A: Glossary

| Term | Definition |
|------|------------|
| **ACI** | Agent Certification Interface - External standard for agent trust |
| **Certification Axis** | ACI trust tier representing external certification status |
| **Competence Axis** | Skill depth level per domain (L0-L5) |
| **DPoP** | Demonstrating Proof of Possession - Token binding mechanism |
| **Effective Permission** | Minimum of all trust axes and policy ceilings |
| **MCP** | Model Context Protocol - Context server integration |
| **Pairwise DID** | Unique identifier per relationship for privacy |
| **Runtime Axis** | Vorion TrustBand representing current deployment trust |
| **TEE** | Trusted Execution Environment - Hardware security enclave |
| **Three-Axis Trust** | Model combining certification, competence, and runtime |

### Appendix B: ACI Specification References

- ACI v1.1.0 Core Specification
- ACI Layer 1: Identity Binding
- ACI Layer 2: Capability Framework
- ACI Layer 3: Application Integration
- ACI Layer 4: Runtime Assurance
- ACI Layer 5: Semantic Governance

### Appendix C: Vorion Specification References

- SPEC-001: ZK Audit & Merkle Enhancement
- SPEC-002: Trust Tiers and Runtime Autonomy (legacy)
- packages/contracts/src/canonical/trust-band.ts
- packages/contracts/src/canonical/trust-score.ts
- packages/contracts/src/v2/trust-profile.ts

### Appendix D: Security Standards References

- RFC 9449: OAuth 2.0 Demonstrating Proof of Possession
- IETF DID Core: Decentralized Identifiers
- TCG: Trusted Platform Module (TPM)
- Intel SGX: Software Guard Extensions
- ARM TrustZone: Trusted Execution Environment

---

**Document Status:** Draft - Pending Architecture Review

**Next Steps:**
1. Architecture team review
2. Security team review of hardening requirements
3. Implementation planning per migration phases
4. ACI conformance testing
5. Production rollout planning
