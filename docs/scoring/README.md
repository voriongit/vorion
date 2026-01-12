# AI Agent Trust Scoring Framework (ATSF) v2.0

**A rigorous mathematical framework for quantifying AI agent trustworthiness and aligning trust levels with task risk assessments.**

MIT Mathematicians | Version 2.0.0 | January 2026

---

## What's New in v2.0

Version 2.0 addresses critical vulnerabilities identified in adversarial red team analysis:

| Red Team Finding | v2.0 Solution |
|-----------------|---------------|
| **Transparency Paradox** | Observation tiers with trust ceilings (BLACK_BOX = 60% max) |
| **Safety Tax** | Tiered async governance (<1ms for R1-R2 actions) |
| **Scaffolding Bypass** | Decomposed model vs. orchestration trust |
| **Circuit Breaker DOS** | Per-entity isolation with DOS detection |
| **Liability Risk** | NIST/EU AI Act/Actuarial alignment |

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    ATSF v2.0 Engine                            │
├────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │Confidential │  │   Async     │  │  Insurance  │            │
│  │ Computing   │  │ Governance  │  │  Alignment  │            │
│  │   Layer     │  │   Layer     │  │   Layer     │            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│         │                │                │                    │
│  ┌──────┴────────────────┴────────────────┴──────┐            │
│  │           Core Trust Engine (v1.0)            │            │
│  │  • 7 Dimensions  • 28 Factors  • 6 Tiers     │            │
│  └───────────────────────────────────────────────┘            │
└────────────────────────────────────────────────────────────────┘
```

## Observation Tiers (New in v2.0)

The framework now explicitly accounts for what can be observed:

| Tier | Access Level | Trust Ceiling | Example |
|------|--------------|---------------|---------|
| **BLACK_BOX** | I/O only | 60% | GPT-4, Claude via API |
| **GRAY_BOX** | I/O + logs | 75% | Platform-hosted models |
| **WHITE_BOX** | Full code | 95% | Open-source models |
| **ATTESTED_BOX** | TEE verified | 100% | Models in secure enclaves |

**Key Insight:** API-accessed proprietary models cannot exceed 60% trust regardless of behavioral metrics.

## Governance Latency (New in v2.0)

| Risk Level | Governance Path | Latency | Mode |
|------------|-----------------|---------|------|
| R1-R2 | Optimistic | <1ms | Async audit |
| R3 | Quick sync | ~10ms | Async full audit |
| R4 | Full sync | ~100ms | Pre-approval |
| R5 | Council | ~500ms | Multi-party consensus |

## Regulatory Alignment (New in v2.0)

Trust scores now map to compliance frameworks:

- **NIST AI RMF**: Tiers 1-4 (Partial → Adaptive)
- **EU AI Act**: Conformity assessment for high-risk AI
- **ISO 42001**: AI Management System certification
- **Insurance**: Actuarial risk profiles for underwriting

## Quick Start

```python
from src.atsf_v2 import ATSFEngineV2, ModelAccessType

engine = ATSFEngineV2()

# Assess an agent
assessment = engine.assess_agent(
    agent_id="my-agent",
    model_name="gpt-4",
    model_access=ModelAccessType.API_PROPRIETARY,  # BLACK_BOX
    orchestration_available=True,
    behavioral_metrics={...},
    code_metrics={...},
    dimension_scores={...},
    context={"domain": "healthcare", "handles_pii": True}
)

print(f"V2 Score: {assessment.composite_score_v2}")  # Observation-adjusted
print(f"Trust Ceiling: {assessment.observation_tier}")
print(f"NIST Tier: {assessment.nist_tier}")
print(f"Insurability: {assessment.insurability_class}")

# Evaluate an action
decision = engine.evaluate_action(
    agent_assessment=assessment,
    action_description="Send email to patient",
    action_type="communication",
    context={"handles_phi": True}
)

print(f"Permitted: {decision.permitted}")
print(f"Latency: {decision.decision_latency_ms}ms")
```

## Package Structure

```
atsf/
├── src/
│   ├── trust_score.py           # Core v1.0 scoring
│   ├── risk_classification.py   # Risk taxonomy
│   ├── alignment_policy.py      # Policy engine
│   ├── confidential_computing.py # v2.0: Observation tiers, TEE
│   ├── async_governance.py      # v2.0: Tiered async governance
│   ├── insurance_alignment.py   # v2.0: Regulatory/actuarial
│   └── atsf_v2.py              # v2.0: Integrated engine
├── simulations/
│   └── monte_carlo.py          # Validation framework
├── docs/
│   ├── ATSF_White_Paper.docx   # Formal specification
│   └── formal_specification.md  # Mathematical notation
└── README.md
```

## Validation Results

**Conservative Policy Performance:**
- Precision: 1.000 (zero false positives)
- Recall: 0.520
- F1 Score: 0.673
- Accuracy: 89.2%

**Governance Latency:**
- Optimistic path: <1ms (R1-R2)
- Quick sync: ~10ms (R3)
- Full sync: ~100ms (R4)
- Council: ~500ms (R5)

## Key Formulas

**Trust Score (v1.0):**
```
T(A) = 10 × Σᵢ wᵢ × Dᵢ  where Σwᵢ = 1
```

**Observation-Adjusted Trust (v2.0):**
```
T_adj(A) = min(T(A), ceiling(observation_tier))
```

**Actuarial Incident Rate:**
```
λ = BASE_RATE × (DECAY)^tier × domain_multiplier
```

## Citation

```bibtex
@techreport{atsf2026v2,
  title={ATSF v2.0: Addressing the Transparency Paradox},
  author={MIT Mathematicians},
  year={2026},
  note={Response to adversarial red team analysis}
}
```

## License

Research use. See LICENSE for details.

## Future Requirements Alignment (New in v2.0)

The framework anticipates regulatory evolution with:

### Regulatory Horizon Tracking

```python
from src.future_alignment import RegulatoryHorizonTracker, Jurisdiction

tracker = RegulatoryHorizonTracker()
roadmap = tracker.get_compliance_roadmap(
    jurisdictions=[Jurisdiction.EU, Jurisdiction.US_COLORADO],
    current_scores={"governance": 55, "observability": 60},
    risk_categories=["healthcare"]
)

# Returns prioritized compliance gaps with enforcement dates
```

**Tracked Regulations:**
| Regulation | Status | Enforcement |
|------------|--------|-------------|
| EU AI Act - Prohibited | Enforced | Feb 2025 |
| EU AI Act - GPAI | Adopted | Aug 2025 |
| EU AI Act - High Risk | Adopted | Aug 2026 |
| Colorado AI Act | Adopted | Feb 2026 |
| UK AI Safety | Draft | TBD |
| ISO 42001 | Enforced | Dec 2023 |

### Multi-Agent Trust Composition

For agent swarms and hierarchies:

```python
from src.future_alignment import MultiAgentTrustComposer

composer = MultiAgentTrustComposer()
# Register agents...

# Chain trust = min(scores) - weakest link principle
chain_trust, max_risk, warnings = composer.compute_chain_trust(
    ["orchestrator", "code-agent", "data-agent"]
)

# Swarm trust with Byzantine fault tolerance
swarm_trust, meta = composer.compute_swarm_trust(
    agent_ids, aggregation_function="byzantine"
)
```

### Continuous Learning Drift Detection

Monitors for behavioral drift in adaptive systems:

```python
from src.future_alignment import ContinuousLearningMonitor

monitor = ContinuousLearningMonitor(alert_threshold_sigma=2.0)
baseline = monitor.establish_baseline(agent_id, historical_metrics)

# Check for drift
alerts = monitor.check_for_drift(agent_id, current_metrics)
# Returns alerts if hallucination/refusal rates deviate >2σ

# Get trust adjustment factor
adjustment = monitor.get_trust_adjustment(agent_id)  # 0.5-1.0
```

### Cross-Registry Interoperability

Portable trust attestations for federated ecosystems:

```python
from src.future_alignment import TrustRegistry

registry_a = TrustRegistry("alpha", "Alpha Trust Registry")
registry_a.trust_registry("beta", public_key, trust_level=0.8)

# Verify attestation from another registry
valid, adjusted_score, issues = registry_a.verify_external_attestation(
    external_attestation
)
# Score adjusted by registry trust factor
```
