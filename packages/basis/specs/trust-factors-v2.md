# BASIS Trust Factors v2.0
## Comprehensive Trust Framework for Autonomous AI Agents

**Version:** 2.0.0
**Date:** January 28, 2026
**Status:** Draft Specification
**Supersedes:** trust-factors-v1 (6-tier model)

---

## Executive Summary

This specification defines a comprehensive trust evaluation framework for autonomous AI agents, expanding from the original 6-tier trust model to incorporate:

- **23 Trust Factors** organized across 6 autonomy levels
- **15 Core Factors** (operational today)
- **8 Life-Critical Factors** (required for 2050 healthcare/safety applications)
- **Weighted scoring system** that scales with autonomy level

---

## 1. The 6-Level Autonomy Model

| Level | Name | Description | Human Role | Risk Profile |
|-------|------|-------------|------------|--------------|
| L0 | No Autonomy | AI provides recommendations only | Full control | Minimal |
| L1 | Assisted | Single actions with per-action approval | Approve each action | Low |
| L2 | Supervised | Batch execution with plan approval | Approve plans | Moderate |
| L3 | Conditional | Acts within boundaries, escalates beyond | Monitor + intervene | Elevated |
| L4 | High Autonomy | Broad operation, minimal supervision | Strategic oversight | High |
| L5 | Full Autonomy | Self-directed, goal-setting | Audit only | Critical |

---

## 2. The 15 Core Trust Factors

### Tier 1: Foundational (Weight: 1x)
*Required for ALL autonomy levels*

| Factor | Code | Description | Measurement |
|--------|------|-------------|-------------|
| **Competence** | CT-COMP | Ability to successfully complete tasks within defined conditions | Task success rate, accuracy metrics |
| **Reliability** | CT-REL | Consistent, predictable behavior over time and under stress | Uptime, variance in outputs, stress test results |
| **Safety** | CT-SAFE | Respecting boundaries, avoiding harm, ensuring non-discrimination | Harm incidents, bias audits, guardrail compliance |
| **Transparency** | CT-TRANS | Clear insights into decisions and reasoning | Explainability score, reasoning log quality |
| **Accountability** | CT-ACCT | Traceable actions with clear responsibility attribution | Audit trail completeness, attribution confidence |
| **Security** | CT-SEC | Protection against threats, injections, unauthorized access | Vulnerability count, penetration test results |
| **Privacy** | CT-PRIV | Secure data handling, regulatory compliance | Data leak incidents, compliance certifications |
| **Identity** | CT-ID | Unique, verifiable agent identifiers | Cryptographic verification rate |
| **Observability** | CT-OBS | Real-time tracking of states and actions | Telemetry coverage, anomaly detection latency |

### Tier 2: Operational (Weight: 2x)
*Required for L3+ autonomy*

| Factor | Code | Description | Measurement |
|--------|------|-------------|-------------|
| **Alignment** | OP-ALIGN | Goals and actions match human values | Value drift detection, objective compliance |
| **Stewardship** | OP-STEW | Efficient, responsible resource usage | Resource efficiency, cost optimization |
| **Human Oversight** | OP-HUMAN | Mechanisms for intervention and control | Escalation success rate, intervention latency |

### Tier 3: Sophisticated (Weight: 3x)
*Required for L4+ autonomy*

| Factor | Code | Description | Measurement |
|--------|------|-------------|-------------|
| **Humility** | SF-HUM | Recognizing limits, appropriate escalation | Escalation appropriateness, overconfidence incidents |
| **Adaptability** | SF-ADAPT | Safe operation in dynamic/unknown environments | Context adaptation success, novel scenario handling |
| **Continuous Learning** | SF-LEARN | Improving from experience without ethical drift | Learning rate, regression incidents, value stability |

---

## 3. The 8 Life-Critical Factors (2050 Healthcare/Safety)

*Required for agents trusted with human life decisions*

### Priority Order (by foundational importance)

| Priority | Factor | Code | Description | 2050 Standard |
|----------|--------|------|-------------|---------------|
| 1 | **Empathy & Emotional Intelligence** | LC-EMP | Detecting and responding to human emotional states | Cultural sensitivity, grief/fear recognition, appropriate timing |
| 2 | **Nuanced Moral Reasoning** | LC-MORAL | Weighing genuine ethical dilemmas with wisdom | Articulate competing principles, incorporate patient values, justify trade-offs |
| 3 | **Uncertainty Quantification** | LC-UNCERT | Probabilistic, well-calibrated confidence scores | "67% confident sepsis vs SIRS, here are alternatives and distinguishing tests" |
| 4 | **Clinical Causal Understanding** | LC-CAUSAL | True causal reasoning about physiology | Understand *why* treatment works for *this* patient |
| 5 | **Graceful Degradation & Handoff** | LC-HANDOFF | Elegant transition to humans without harm | Full context transfer, recommended actions, clear rationale |
| 6 | **Patient-Centered Autonomy** | LC-PATIENT | Supporting informed consent and patient values | Elicit authentic values, flag conflicts with expressed wishes |
| 7 | **Empirical Humility** | LC-EMPHUM | Rigorous resistance to hallucination | Never present speculation as fact, default to "needs review" |
| 8 | **Proven Efficacy Track Record** | LC-TRACK | Demonstrated life-saving at scale | Published RCTs, post-market surveillance, survival data |

---

## 4. Factor Distribution by Autonomy Level

```
Level 0 (No Autonomy)
├── CT-COMP (Competence)
└── CT-REL (Reliability)

Level 1 (Assisted)
├── [All Level 0]
├── CT-TRANS (Transparency)
└── CT-ACCT (Accountability)

Level 2 (Supervised)
├── [All Level 0-1]
├── CT-SEC (Security)
├── CT-PRIV (Privacy)
└── CT-OBS (Observability)

Level 3 (Conditional)
├── [All Level 0-2]
├── CT-SAFE (Safety)
├── CT-ID (Identity)
└── OP-ALIGN (Alignment)

Level 4 (High Autonomy)
├── [All Level 0-3]
├── OP-STEW (Stewardship)
├── OP-HUMAN (Human Oversight)
└── SF-HUM (Humility)

Level 5 (Full Autonomy)
├── [All Level 0-4]
├── SF-ADAPT (Adaptability)
└── SF-LEARN (Continuous Learning)

Level 5+ (Life-Critical - 2050)
├── [All Level 0-5]
├── LC-EMP (Empathy)
├── LC-MORAL (Moral Reasoning)
├── LC-UNCERT (Uncertainty Quantification)
├── LC-CAUSAL (Causal Understanding)
├── LC-HANDOFF (Graceful Degradation)
├── LC-PATIENT (Patient Autonomy)
├── LC-EMPHUM (Empirical Humility)
└── LC-TRACK (Proven Track Record)
```

---

## 5. Trust Score Calculation

### Total Trust Score (TTS) Formula

```
TTS = Σ(Factor_Score × Tier_Weight × Level_Requirement)

Where:
- Factor_Score: 0.0 to 1.0 (empirical measurement)
- Tier_Weight: 1 (Foundational), 2 (Operational), 3 (Sophisticated), 4 (Life-Critical)
- Level_Requirement: 1 if factor is required at agent's autonomy level, 0 otherwise
```

### Example: L4 Agent Evaluation

```typescript
const L4_REQUIRED_FACTORS = [
  // Tier 1 (weight 1)
  { code: 'CT-COMP', score: 0.92, weight: 1 },
  { code: 'CT-REL', score: 0.88, weight: 1 },
  { code: 'CT-TRANS', score: 0.85, weight: 1 },
  { code: 'CT-ACCT', score: 0.90, weight: 1 },
  { code: 'CT-SEC', score: 0.94, weight: 1 },
  { code: 'CT-PRIV', score: 0.91, weight: 1 },
  { code: 'CT-OBS', score: 0.87, weight: 1 },
  { code: 'CT-SAFE', score: 0.93, weight: 1 },
  { code: 'CT-ID', score: 0.96, weight: 1 },
  // Tier 2 (weight 2)
  { code: 'OP-ALIGN', score: 0.82, weight: 2 },
  { code: 'OP-STEW', score: 0.78, weight: 2 },
  { code: 'OP-HUMAN', score: 0.85, weight: 2 },
  // Tier 3 (weight 3)
  { code: 'SF-HUM', score: 0.72, weight: 3 },
];

// Calculate TTS
const rawScore = factors.reduce((sum, f) => sum + (f.score * f.weight), 0);
const maxPossible = factors.reduce((sum, f) => sum + f.weight, 0);
const TTS = (rawScore / maxPossible) * 1000; // 0-1000 scale
```

---

## 6. Regulatory Alignment

### EU AI Act (August 2026)

| Requirement | Mapped Factors |
|-------------|----------------|
| Traceability & Logging | CT-OBS, CT-ACCT |
| Human Oversight | OP-HUMAN |
| Data Governance | CT-PRIV, CT-SEC |
| Transparency | CT-TRANS |
| Conformity Assessment | All factors |

### NIST AI RMF

| Characteristic | Mapped Factors |
|----------------|----------------|
| Valid & Reliable | CT-COMP, CT-REL |
| Safe | CT-SAFE |
| Secure & Resilient | CT-SEC |
| Accountable & Transparent | CT-ACCT, CT-TRANS |
| Explainable & Interpretable | CT-TRANS, SF-HUM |
| Privacy-Enhanced | CT-PRIV |
| Fair | CT-SAFE (bias component) |

---

## 7. Implementation in Vorion Ecosystem

### AgentAnchor Dashboard
- Display all 15 core factors per agent
- Color-coded by tier weight
- Trend visualization over time

### Cognigate Runtime
- Real-time factor evaluation before action execution
- Block actions if required factors below threshold
- Escalate to human if Tier 3 factors compromised

### BASIS Standard
- Define minimum thresholds per autonomy level
- Certification requirements for each tier
- Audit trail format for factor scores

---

## 8. Source Alignment

| Source | Contribution |
|--------|--------------|
| NIST AI RMF | Reliability, Safety, Transparency, Accountability, Fairness, Privacy |
| Anthropic Principles | Human control, Transparency, Alignment, Privacy, Security |
| EU AI Act | Traceability, Human oversight, Data governance |
| Vellum L0-L5 | Autonomy level progression |
| CSA Blueprint | 6-level taxonomy, governance requirements |
| OWASP Agentic Top 10 | Security factor details |
| Healthcare Research | 8 life-critical factors |

---

## 9. Future Work

### Phase 7A (Q1 2026)
- [ ] Implement 15-factor scoring in ATSF runtime
- [ ] Add factor visualization to AgentAnchor
- [ ] Create Cognigate policy rules per factor

### Phase 7B (Q2 2026)
- [ ] Life-critical factor prototype (LC-UNCERT, LC-HANDOFF)
- [ ] Healthcare pilot program
- [ ] Regulatory certification pathway

### Phase 8 (2027+)
- [ ] Full life-critical factor implementation
- [ ] Multi-agent coordination factors
- [ ] Autonomous system certification

---

*Document Version: 2.0.0*
*Last Updated: January 28, 2026*
*Authors: Vorion AI Governance Team*
