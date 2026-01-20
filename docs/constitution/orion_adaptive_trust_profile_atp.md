# ORION Adaptive Trust Profile (ATP)

**STATUS:** CANONICAL / NO-DRIFT
**AUTHORITY:** Agent Anchor (sole authority for trust computation)

---

## Overview

The Adaptive Trust Profile (ATP) is ORION's five-dimensional trust model. It provides a comprehensive, evidence-based assessment of trustworthiness that drives autonomy decisions.

---

## Trust Dimensions

### CT — Capability Trust

**What can this agent do well?**

- Measured skills and certifications
- Test results and evaluations
- Domain expertise verification
- Tool proficiency assessments

**Range:** 0.0 - 1.0

### BT — Behavioral Trust

**How has this agent behaved historically?**

- Success/failure rates
- Violation history
- Compliance track record
- Incident attribution

**Range:** 0.0 - 1.0

### GT — Governance Trust

**Is this agent properly governed?**

- Oversight mechanisms in place
- Policy compliance verification
- Audit trail completeness
- Accountability bindings

**Range:** 0.0 - 1.0

### XT — Contextual Trust

**Does the current context support trust?**

- Environmental factors
- Jurisdiction requirements
- Sensitivity level
- Temporal factors

**Range:** 0.0 - 1.0

### AC — Assurance Confidence

**How certain are we of our assessment?**

- Evidence quality
- Evidence recency
- Evidence completeness
- Source reliability

**Range:** 0.0 - 1.0

---

## Trust Bands (T0-T5)

Trust Bands are derived from the five dimensions and serve as the sole autonomy driver.

| Band | Description | Autonomy Level |
|------|-------------|----------------|
| T0 | Untrusted | Deny execution |
| T1 | Minimal Trust | HITL mandatory; no irreversible actions |
| T2 | Limited Trust | Constrained autonomy; reversible only; strict allowlists |
| T3 | Moderate Trust | Supervised autonomy; rollback required |
| T4 | High Trust | Broad autonomy; continuous monitoring |
| T5 | Mission-Critical Trust | Strongest proof; strict GT/AC requirements |

---

## Band Derivation Rules

### Gating Caps

- **GT Gate:** If GT < 0.3, cap band at T2 (insufficient governance)
- **AC Gate:** If AC < 0.4, cap band at T1 (insufficient evidence)
- **XT Gate:** Context can raise or lower by 1 band

### Asymmetric Updates

- **Fast Loss:** Trust drops immediately on violations
- **Slow Gain:** Trust rises only with sustained positive evidence

### Hysteresis

To prevent oscillation:
- Rising: Must maintain evidence above threshold for N periods
- Falling: Immediate on severe violations, gradual on minor

### Decay

Stale evidence reduces trust:
- CT decays if capabilities not re-verified
- BT decays toward neutral over time
- AC decays as evidence ages

---

## Trust Delta Events

Every trust change produces a `trust_delta_event`:

```json
{
  "event_id": "uuid",
  "profile_id": "uuid",
  "timestamp": "iso8601",
  "previous_band": "T3",
  "new_band": "T2",
  "dimension_deltas": {
    "CT": 0.0,
    "BT": -0.15,
    "GT": 0.0,
    "XT": -0.05,
    "AC": -0.10
  },
  "trigger": "violation_detected",
  "evidence_ids": ["uuid1", "uuid2"],
  "correlation_id": "uuid"
}
```

Trust delta events are written to the Proof Plane and preserved per ERPL.

---

## Trust Profile Structure

```json
{
  "profile_id": "uuid",
  "scope": {
    "type": "agent|user|org|tool",
    "id": "identifier"
  },
  "dimensions": {
    "CT": 0.75,
    "BT": 0.80,
    "GT": 0.60,
    "XT": 0.70,
    "AC": 0.85
  },
  "band": "T3",
  "computed_at": "iso8601",
  "evidence_summary": {
    "total_evidence": 42,
    "positive": 38,
    "negative": 4,
    "oldest": "iso8601",
    "newest": "iso8601"
  },
  "gates_applied": ["GT_gate"],
  "decay_applied": false
}
```

---

## Authority Rules

1. **Agent Anchor** is the sole authority for trust computation
2. **AURYN** may read trust summaries (band + AC) but never compute
3. **PAL** may record trust history but never compute
4. **ERA** receives trust constraints but has no trust visibility
5. Trust profiles are scoped (per agent, user, org, tool)

---

## Anti-Gaming Protections

- Asymmetric updates prevent rapid trust farming
- Hysteresis prevents band oscillation attacks
- Evidence quality checks prevent fake evidence injection
- Multi-dimensional model prevents single-vector manipulation
- Decay prevents stale trust persistence

---

## Testing Requirements

All trust-related changes require:

- [ ] Trust regression tests
- [ ] Anti-gaming tests
- [ ] Deterministic replay tests
- [ ] Band transition tests
- [ ] Decay behavior tests
- [ ] Gate enforcement tests
