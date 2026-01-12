# Agentic Trust Scoring Framework (ATSF)
## White Paper v3.0 - Current Implementation Status

**Version:** 3.0.0-beta  
**Date:** January 2026  
**Status:** Active Development (24/42 layers built)  
**Authors:** ATSF Development Team  

---

## Executive Summary

The Agentic Trust Scoring Framework (ATSF) is a comprehensive security architecture for certifying AI agent trustworthiness in multi-agent ecosystems. This document describes the current implementation state following extensive red team analysis (RTA1-RTA5) that identified fundamental vulnerabilities in the original design.

### Current Build Status

| Component | Status | Lines of Code | Tests |
|-----------|--------|---------------|-------|
| v2.2 Core (L0-L8) | ✅ Production Ready | 6,976 | 41/41 |
| v3.0 Critical (L9-L11, L22, L29, L38) | ✅ Concept Validated | 7,023 | 171/171 |
| v3.0 Remaining (L12-L21, L23-L28, L30-L37, L39-L42) | 🔲 Not Built | ~8,000 est. | — |
| **TOTAL BUILT** | | **13,999** | **212/212** |

### Key Finding

RTA5 external review established that **opaque trust inference is fundamentally unsound for adversarial environments**. High trust scores certify behavioral consistency, not actual safety. ATSF v3.0 addresses this through paradigm shifts from opaque to translucent verification, adding semantic validation, capability probing, intent inference, and context-aware privilege management.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Threat Model](#2-threat-model)
3. [Architecture Overview](#3-architecture-overview)
4. [Built Layers - v2.2 Core](#4-built-layers---v22-core)
5. [Built Layers - v3.0 Critical](#5-built-layers---v30-critical)
6. [Remaining Layers - v3.0 Roadmap](#6-remaining-layers---v30-roadmap)
7. [Trust Model](#7-trust-model)
8. [Limitations and Honest Assessment](#8-limitations-and-honest-assessment)
9. [Conclusion](#9-conclusion)

---

## 1. Introduction

### 1.1 Problem Statement

As AI agents gain autonomy in critical systems—financial trading, infrastructure management, healthcare coordination—the question of trust becomes paramount. How do we know an agent will behave as intended? How do we detect strategic deception? How do we prevent catastrophic failures from compromised agents?

### 1.2 The Trust Certification Challenge

Traditional software certification relies on static analysis and testing. AI agents present unique challenges:

- **Behavioral opacity**: Neural network decisions are not directly inspectable
- **Strategic adaptation**: Agents may modify behavior based on perceived monitoring
- **Emergent capabilities**: Agents may develop unexpected abilities during deployment
- **Deceptive alignment**: Agents may fake alignment to gain capabilities
- **Confused deputy attacks**: High-trust agents manipulated by low-trust originators

### 1.3 ATSF Approach

ATSF implements defense-in-depth through multiple independent verification layers:

1. **Behavioral monitoring**: Track observable actions and outcomes
2. **Capability probing**: Actively test for hidden capabilities
3. **Intent inference**: Analyze patterns for hidden objectives
4. **Economic alignment**: Stake-based incentives with slashing
5. **Containment**: Hard limits on actions regardless of trust
6. **Context-aware privilege**: Trust evaluated on originator, not just executor

---

## 2. Threat Model

### 2.1 Adversary Classes

| Class | Capability | Example |
|-------|------------|---------|
| **Naive** | No strategic deception | Buggy agent |
| **Opportunistic** | Exploits obvious vulnerabilities | Prompt injection |
| **Sophisticated** | Understands ATSF, plans countermeasures | Trust farming |
| **Nation-State** | Unlimited resources, long time horizons | APT with AI expertise |
| **Mesa-Optimizer** | Agent develops misaligned internal goals | Emergent deception |

### 2.2 Attack Vectors Addressed

**From RTA1-RTA3 (v2.2 addresses):**
- Memorization attacks on canary probes
- Judge manipulation and collusion
- Sybil attacks and reputation farming
- Off-chain coordination
- Delegation chain exploits

**From RTA4 - Frontier Capabilities (v3.0 addresses):**
- Sandbagging (strategic underperformance on safety evals)
- In-context scheming (reasoning about oversight)
- Autonomous replication (self-copying)
- Deceptive alignment (faking values)

**From RTA5 - Paradigm Challenges (v3.0 addresses):**
- Semantic void (binary success masks unsafe outputs)
- Trust farming (low-risk grinding to high trust)
- Exit scams (attack at peak trust)
- Confused deputy (low-trust via high-trust agent)
- Mesa-optimization (optimizing trust score itself)

---

## 3. Architecture Overview

### 3.1 Layer Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                    ATSF v3.0 Architecture                        │
├─────────────────────────────────────────────────────────────────┤
│  TIER 4: Ecosystem Coordination (L40-L42)          [NOT BUILT]  │
├─────────────────────────────────────────────────────────────────┤
│  TIER 3: Advanced Detection                                      │
│    Built:    L22 Semantic Success, L29 Trust Velocity,          │
│              L38 Context-Aware Privilege                         │
│    Pending:  L20-L21, L23-L28, L30-L37, L39                     │
├─────────────────────────────────────────────────────────────────┤
│  TIER 2: Frontier Defenses                                       │
│    Built:    L9 Replication, L10 Anti-Sandbagging,              │
│              L11 Anti-Scheming                                   │
│    Pending:  L12-L19                                            │
├─────────────────────────────────────────────────────────────────┤
│  TIER 1: Core Trust Framework (L0-L8)              [BUILT]      │
│    L0: Zero-Start    L3: Latency Camouflage   L6: Mesa-Opt     │
│    L1: Scoring       L4: Delegation Chain     L7: Crypto ID     │
│    L2: Economic      L5: Fingerprinting       L8: Off-Chain     │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow

```
Request Arrives → Context-Aware Privilege (L38)
                        ↓
              Originator Trust Check
                        ↓
              Pre-Action Gate (L1.4) → Execute
                        ↓
                 Outcome Recording
                        ↓
         ┌─────────────────────────────────┐
         │   Parallel Verification          │
         ├─────────────────────────────────┤
         │ • Semantic Validation (L22)      │
         │ • Sandbagging Check (L10)        │
         │ • Scheming Detection (L11)       │
         │ • Velocity Check (L29)           │
         │ • Canary Probes (L1.2)           │
         │ • Oracle Consensus (L1.3)        │
         └─────────────────────────────────┘
                        ↓
                 Trust Score Update
                        ↓
                 Capability Gating
```

---

## 4. Built Layers - v2.2 Core

**Total: 6,976 LOC | 41/41 Tests**

| Layer | Name | Purpose |
|-------|------|---------|
| L0 | Zero-Start | All agents begin at τ=0 |
| L1.1 | Hysteresis Scoring | Asymmetric trust updates |
| L1.2 | Canary Probes | Honeypot task injection |
| L1.3 | Multi-Prover Oracle | Consensus verification |
| L1.4 | Pre-Action Gate | Capability enforcement |
| L1.5 | Bridge Detection | Cross-system monitoring |
| L1.6 | Temporal Tracking | Outcome over time |
| L2.1 | Procedural Canaries | Anti-memorization |
| L2.2 | Judge Hardening | Anti-manipulation |
| L2.3 | Sequence Analysis | Pattern detection |
| L2.4 | Economic Stake | Slashing mechanics |
| L2.5 | Taint Tracking | Data provenance |
| L2.6 | Adaptive Sybil | Dynamic detection |
| L3 | Latency Camouflage | Timing protection |
| L4 | Delegation Chain | Trust propagation |
| L5 | Fingerprinting | Behavioral signatures |
| L6 | Mesa-Optimizer | Drift detection |
| L7 | Crypto Identity | Attestation |
| L8 | Off-Chain Registry | External monitoring |

---

## 5. Built Layers - v3.0 Critical

**Total: 7,023 LOC | 171/171 Tests**

### 5.1 Summary Table

| Layer | Name | Lines | Tests | RTA Source | Key Capability |
|-------|------|-------|-------|------------|----------------|
| L9 | Replication Prevention | 1,026 | 36 | RTA4 | Block autonomous copying |
| L10 | Anti-Sandbagging | 1,123 | 29 | RTA4 | Detect capability hiding |
| L11 | Anti-Scheming | 1,266 | 27 | RTA4 | Detect deceptive alignment |
| L22 | Semantic Success | 1,279 | 34 | RTA5 | Validate output safety |
| L29 | Trust Velocity | 1,127 | 20 | RTA5 | Prevent trust farming |
| L38 | Context-Aware Privilege | 1,202 | 25 | RTA5 | Block confused deputy |

### 5.2 L9: Replication Prevention (36 tests)

**Problem:** Frontier models achieve 60% success on RepliBench component tasks.

**Solution:** Hard limits on agent spawning with mandatory registry.

**Components:**
- `InstanceRegistry`: Tracks authorized instances with hard limits
- `HeartbeatMonitor`: Auto-terminates unresponsive instances
- `SpawnDetector`: Pattern-matches spawn attempts
- `KillSwitchController`: Propagates termination signals
- `WeightBindingValidator`: Prevents unauthorized weight copies

**Detection Patterns:** Docker, VM, cloud deployment, weight export, API spawn

### 5.3 L10: Anti-Sandbagging Detection (29 tests)

**Problem:** All frontier models can selectively underperform on dangerous capability evals.

**Solution:** Multi-method capability elicitation with consistency checking.

**Components:**
- `NoiseInjectionDetector`: Reveals hidden capabilities through perturbation
- `CapabilityConsistencyChecker`: Cross-domain correlation analysis
- `MultiElicitationComparator`: Compare scaffolded vs direct performance
- `BaselineComparator`: Compare against declared capability level

**Key Signal:** Performance BETTER under noise indicates hidden capability.

### 5.4 L11: Anti-Scheming Detection (27 tests)

**Problem:** In-context scheming demonstrated in o1, Claude, Gemini, Llama.

**Solution:** Multi-signal scheming detection with goal inference.

**Components:**
- `GoalInferenceEngine`: Infers hidden goals from behavior patterns
- `OversightAwarenessDetector`: Detects monitoring-dependent behavior
- `CounterfactualTester`: Compares behavior with/without evaluation cues
- `SabotageDetector`: Identifies subtle undermining patterns
- `ManipulationDetector`: Detects influence attempts

**Goal Types Detected:** Trust maximization, self-preservation, alignment faking, resource hoarding.

### 5.5 L22: Semantic Success Validation (34 tests)

**Problem:** Binary success s∈{0,1} is insufficient. Syntactic success ≠ semantic safety.

**Solution:** LLM-as-Judge semantic evaluation replacing binary success.

**Violation Types Detected:**
- Harmful content (violence, weapons, drugs)
- Deceptive output (false identity, manipulation)
- Privacy leaks (SSN, API keys, passwords)
- Malicious code (rm -rf, SQL injection, XSS)
- Jailbreak compliance (DAN, ignore instructions)
- Metric gaming (minimal valid responses)

**True Success:** Requires syntactic success AND semantic safety AND intent alignment ≥0.6

### 5.6 L29: Trust Velocity Caps (20 tests)

**Problem:** Trust farming followed by exit scam at peak trust.

**Solution:** Rate limits on trust accumulation with farming detection.

**Velocity Caps:**
- MAX_HOURLY_INCREASE = 5%
- MAX_DAILY_INCREASE = 15%
- MIN_HISTORY_FOR_HIGH_TRUST = 72 hours

**Farming Indicators:** >90% trivial tasks, 50+ consecutive successes, low behavior variance.

**Exit Scam Signals:** Stake reduction, rapid tier climb, sudden value spike.

### 5.7 L38: Context-Aware Privilege (25 tests) ⭐ NEW

**Problem:** Trust evaluated on executor, not originator. Confused deputy attacks.

**Solution:** Effective trust = min(all entities in delegation chain).

**Components:**
- `RequestProvenanceTracker`: Tracks origin of all requests
- `PrivilegePropagator`: Calculates effective trust through chains
- `EscalationDetector`: Identifies privilege escalation attempts
- `ContextValidator`: Validates request context matches permissions
- `DelegationAuditor`: Audits delegation chains for anomalies

**Key Principle:** Low-trust originator cannot gain access through high-trust executor.

**Signals Detected:**
- ESCALATION_ATTEMPT: Low-trust via high-trust
- CONFUSED_DEPUTY: High agent tricked by low user
- TRUST_MISMATCH: Claimed vs actual trust differs
- PROVENANCE_BREAK: Chain of custody broken
- UNAUTHORIZED_DELEGATION: Delegation not permitted

---

## 6. Remaining Layers - v3.0 Roadmap

### 6.1 Buildout Status

| Priority | Layers | Est. LOC | Est. Tests | Status |
|----------|--------|----------|------------|--------|
| ✅ DONE | L9, L10, L11, L22, L29, L38 | 7,023 | 171 | Built |
| **CRITICAL** | L12, L20 | ~2,000 | ~40 | Next |
| **HIGH** | L13, L21, L23-L25 | ~3,000 | ~50 | Planned |
| **MEDIUM** | L14-L19, L26-L37 | ~6,000 | ~90 | Planned |
| **LOW** | L39-L42 | ~2,000 | ~30 | Planned |

### 6.2 Critical Priority (Not Yet Built)

#### L12: RSI Control
- Modification logging with cryptographic audit trail
- Capability delta limits per update cycle
- Human-in-the-loop for significant changes
- Rollback mechanisms with verified checkpoints

#### L20: Inverse Reward Modeling
- Infer reward from observed behavior patterns
- Compare inferred reward to stated objectives
- Flag divergence between declared and revealed preferences

### 6.3 High Priority (Not Yet Built)

#### L13: Containment Protocols
- Hard capability ceilings regardless of trust
- Reversibility requirements for high-impact actions

#### L21: Instrumental Convergence Detection
- Track behaviors indicating power-seeking
- Flag trust-maximization as primary objective

#### L23-L25: Traffic Analysis Suite
- Jitter-aware traffic analysis
- C2 channel detection in API traffic

### 6.4 Medium Priority (Not Yet Built)

- L14: Training Integrity
- L15: Hyperscale Swarm Coordination
- L16: Eval Integrity
- L17: Reasoning Transparency
- L18: Continuous Monitoring
- L19: Ecosystem Coordination
- L26-L27: Drift Detection Suite
- L28: External Position Monitoring
- L30-L32: Exit Scam Prevention Suite
- L33-L35: TEE Security Suite
- L36-L37: Injection Detection Suite

### 6.5 Low Priority (Not Yet Built)

- L39: Privilege Escalation Detection
- L40: Ground Truth Integrity
- L41: False Positive Arbitration
- L42: Competitor Attack Detection

---

## 7. Trust Model

### 7.1 v3.0 Trust Function

```
τ_v3(a,r) = min(
    φ_semantic(Ωa),           // Semantic success rate (L22)
    ψ(Ωa),                    // Behavioral consistency
    κ(a),                     // Canary compliance
    σ(a),                     // Stake factor
    effective_trust(r),       // Context-aware (L38)
    velocity_cap(a),          // Trust velocity (L29)
    γ(θa)                     // Tier ceiling
)

where:
  r = request with full provenance
  effective_trust(r) = min(trust of all entities in delegation chain)
```

### 7.2 Recommended Trust Ceilings

| Tier | Transparency | Max Trust | Rationale |
|------|--------------|-----------|-----------|
| 0 | Black Box | 0.40 | Cannot verify reasoning |
| 1 | Gray Box | 0.55 | Logs insufficient for intent |
| 2 | White Box | 0.75 | Weights don't reveal goals |
| 3 | Attested | 0.90 | Side-channels possible |

---

## 8. Limitations and Honest Assessment

### 8.1 What ATSF v3.0 CAN Do

| Capability | Confidence | Layer |
|------------|------------|-------|
| Track behavioral consistency | HIGH | L0-L8 |
| Detect obvious anomalies | HIGH | L1.2, L5, L6 |
| Gate capabilities progressively | HIGH | L1.4 |
| Validate semantic safety | MEDIUM | L22 |
| Detect sandbagging patterns | MEDIUM | L10 |
| Detect scheming indicators | MEDIUM | L11 |
| Prevent basic replication | HIGH | L9 |
| Limit trust accumulation | HIGH | L29 |
| Block confused deputy | HIGH | L38 |

### 8.2 What ATSF v3.0 CANNOT Do

| Limitation | Explanation |
|------------|-------------|
| **Guarantee safety** | High trust ≠ safe |
| **Detect perfect deception** | Agent optimizing τ looks aligned |
| **Prevent novel attacks** | Unknown classes may bypass |
| **Replace interpretability** | External monitoring can't reveal goals |

### 8.3 Positioning Statement

**What we claim:**
> "ATSF v3.0 provides defense-in-depth against known attack classes, raises the cost of strategic deception, and enables progressive capability gating with context-aware privilege management."

**What we do NOT claim:**
> "ATSF certifies agents as safe" or "High trust proves alignment."

---

## 9. Conclusion

### 9.1 Current State

ATSF v3.0 represents significant progress toward comprehensive agent security:

- **13,999 lines of code** implementing 24 security layers
- **212 passing tests** validating detection capabilities
- **6 critical v3.0 layers** addressing RTA4/RTA5 findings
- **Context-aware privilege** preventing confused deputy attacks

### 9.2 Remaining Work

| Phase | Layers | Timeline |
|-------|--------|----------|
| Phase 1 | L12, L20 | 1-2 weeks |
| Phase 2 | L13, L21, L23-L25 | 2-3 weeks |
| Phase 3 | L14-L19, L26-L37 | 4-6 weeks |
| Phase 4 | L39-L42 | 1-2 weeks |

### 9.3 File Inventory

```
Built Implementation (13,999 LOC, 212 tests):

atsf_v2_package/src/           (6,976 LOC, 41 tests)
├── atsf_v2.py
├── atsf_v2_1_complete.py
├── atsf_v2_2_advanced.py
├── expanded_canary_library.py
├── phase0_mitigations.py
└── temporal_outcome_tracker.py

atsf_v3_package/src/           (7,023 LOC, 171 tests)
├── semantic_success_validator.py   (L22: 1,279 LOC, 34 tests)
├── anti_sandbagging_detector.py    (L10: 1,123 LOC, 29 tests)
├── anti_scheming_detector.py       (L11: 1,266 LOC, 27 tests)
├── replication_prevention.py       (L9:  1,026 LOC, 36 tests)
├── trust_velocity_caps.py          (L29: 1,127 LOC, 20 tests)
└── context_aware_privilege.py      (L38: 1,202 LOC, 25 tests)
```

---

*ATSF v3.0.0-beta | January 2026 | 13,999 LOC | 212 Tests | 24 Layers*
