# ATSF Bounty Program Specifications
## Q2 2026 - TRiSM Deepening Track

**Version:** 1.0  
**Effective Date:** Q2 2026  
**Total Pool:** $9,500 USD  
**License:** MIT (all contributions)

---

## Overview

The ATSF Bounty Program accelerates community-driven development of enterprise-critical integrations. Q2 2026 focuses on **AI TRiSM Deepening**—extending the four pillars (Explainability, ModelOps, Security, Privacy) with production-grade capabilities.

### Bounty Tiers

| Tier | Reward | Complexity | Timeline |
|------|--------|------------|----------|
| 🥉 Bronze | $500-1,500 | Interface + basic impl | 2-4 weeks |
| 🥈 Silver | $1,500-3,000 | Full impl + tests | 4-6 weeks |
| 🥇 Gold | $3,000-5,000 | Production-ready + docs | 6-8 weeks |

---

## Bounty #1: Privacy Pillar → zkML Proof Integration

**Reward:** $3,000 (Silver/Gold)  
**Pillar:** Privacy  
**Priority:** HIGH  
**Skills Required:** Cryptography, Zero-Knowledge Proofs, Python

### Problem Statement

Current Privacy pillar provides differential privacy and PII detection, but lacks **verifiable privacy guarantees**. Enterprise deployments need cryptographic proof that agent computations preserve privacy without revealing inputs.

### Deliverables

#### Required (Silver - $2,000)

1. **`zkml_prover.py`** (~400 LOC)
   - Implement `ZKMLPrivacyProver` interface
   - Support for basic arithmetic circuits
   - Proof generation for simple computations
   - Verification without input revelation

2. **Integration with Privacy Pillar**
   ```python
   # Must integrate with existing PrivacyPillar class
   class PrivacyPillar:
       def assess_with_proof(self, action, data) -> Tuple[Assessment, ZKProof]:
           """Assess privacy and generate verifiable proof."""
           pass
   ```

3. **Test Suite** (20+ tests)
   - Proof generation correctness
   - Verification accuracy
   - Performance benchmarks (<100ms for basic proofs)

#### Bonus (Gold - additional $1,000)

4. **GPU Acceleration** for proof generation
5. **Batch Proof Aggregation** for multiple actions
6. **REST Endpoints** (`/trism/privacy/prove`, `/trism/privacy/verify`)
7. **Documentation** with cryptographic security analysis

### Acceptance Criteria

| Criterion | Requirement |
|-----------|-------------|
| Correctness | 100% of valid proofs verify |
| Soundness | 0% of invalid proofs verify (tested with 1000 random invalids) |
| Performance | Proof generation <100ms for circuits <1000 gates |
| Integration | Works with existing `ai_trism_integration.py` |
| Tests | 20+ passing, >90% coverage on new code |
| Docs | README + API reference + security notes |

### Technical Constraints

- Must use Python 3.10+
- Allowed libraries: `py_ecc`, `snarkjs` (via subprocess), `circom` circuits
- Must NOT require trusted setup (use Groth16 alternatives or PLONK)
- Proof size <1KB for basic circuits

### Example Usage

```python
from atsf.zkml import ZKMLPrivacyProver, ZKProof

prover = ZKMLPrivacyProver()

# Agent wants to prove it computed average without revealing individual values
inputs = [100, 200, 300]  # Secret salaries
output = 200  # Average (public)

proof = prover.generate_proof(
    circuit="average",
    private_inputs=inputs,
    public_outputs=[output]
)

# Verifier confirms computation without seeing inputs
assert prover.verify_proof(proof, public_outputs=[output])
```

### Resources

- [ATSF Privacy Pillar Source](src/atsf/ai_trism_integration.py)
- [zkML Research Paper](https://arxiv.org/abs/2306.08560)
- [Circom Documentation](https://docs.circom.io/)

---

## Bounty #2: ModelOps Pillar → NIST AI RMF Mapper

**Reward:** $2,000 (Silver)  
**Pillar:** ModelOps  
**Priority:** HIGH  
**Skills Required:** AI Governance, Compliance Frameworks, Python

### Problem Statement

Enterprise customers require mapping ATSF's 46 security layers to **NIST AI Risk Management Framework** categories. Currently manual; needs automated compliance reporting.

### Deliverables

#### Required (Silver - $2,000)

1. **`nist_rmf_mapper.py`** (~500 LOC)
   - Map all 46 ATSF layers to NIST AI RMF functions (GOVERN, MAP, MEASURE, MANAGE)
   - Map to NIST subcategories (e.g., GOVERN 1.1, MAP 2.3)
   - Bidirectional lookup (layer → NIST, NIST → layers)

2. **Mapping Data Structure**
   ```python
   NIST_MAPPING = {
       "L0_trust_scoring": {
           "function": "MEASURE",
           "category": "2.1",  # MEASURE 2.1: AI risks identified
           "subcategory": "2.1.3",
           "controls": ["Risk assessment", "Trust quantification"],
           "evidence_types": ["trust_score_logs", "decision_audit"]
       },
       # ... all 46 layers
   }
   ```

3. **Compliance Report Generator**
   ```python
   mapper = NISTRMFMapper()
   report = mapper.generate_compliance_report(
       agent_id="prod_agent_001",
       time_range=("2026-01-01", "2026-03-31"),
       format="pdf"  # or "json", "markdown"
   )
   ```

4. **Gap Analysis Tool**
   ```python
   gaps = mapper.identify_gaps(
       required_subcategories=["GOVERN 1.*", "MEASURE *"],
       current_layers=agent.enabled_layers
   )
   # Returns: [{"subcategory": "GOVERN 1.4", "gap": "No bias monitoring", "recommendation": "Enable L45"}]
   ```

5. **Test Suite** (15+ tests)

### Acceptance Criteria

| Criterion | Requirement |
|-----------|-------------|
| Coverage | All 46 layers mapped to at least one NIST subcategory |
| Accuracy | Mappings reviewed against NIST AI RMF 1.0 spec |
| Reports | PDF generation works, <5s for typical report |
| Gap Analysis | Correctly identifies missing controls |
| Tests | 15+ passing |

### NIST AI RMF Reference

| Function | Description | Example ATSF Layers |
|----------|-------------|---------------------|
| GOVERN | Policies, accountability | L6 (Audit), L34 (Appeals) |
| MAP | Context, risk identification | L4 (Risk Assessment), L24 (Anomaly) |
| MEASURE | Analysis, metrics | L0-L3 (Trust), L14-L19 (Behavioral) |
| MANAGE | Response, monitoring | L21-L23 (Containment), L32 (RSI) |

### Resources

- [NIST AI RMF 1.0](https://www.nist.gov/itl/ai-risk-management-framework)
- [ATSF Security Layers](docs/security/layer-reference.md)

---

## Bounty #3: Explainability Pillar → Multi-LLM Drift Ensemble

**Reward:** $3,000 (Silver/Gold)  
**Pillar:** Explainability  
**Priority:** MEDIUM-HIGH  
**Skills Required:** ML/LLM, Ensemble Methods, Python

### Problem Statement

Single-model drift detection is vulnerable to blind spots. A drift that one model misses might be caught by another. Need **ensemble consensus** across multiple LLMs for robust drift detection.

### Deliverables

#### Required (Silver - $2,000)

1. **`drift_ensemble.py`** (~600 LOC)
   - Support for 3+ LLM backends (OpenAI, Anthropic, local models)
   - Configurable consensus thresholds
   - Weighted voting based on model confidence

2. **Ensemble Detector Class**
   ```python
   class MultiLLMDriftEnsemble:
       def __init__(self, models: List[DriftDetector], consensus_threshold: float = 0.6):
           """
           Args:
               models: List of drift detectors (can be different LLM backends)
               consensus_threshold: Fraction of models that must agree for drift flag
           """
           pass
       
       def detect_drift(self, baseline: str, current: str) -> DriftResult:
           """
           Returns:
               DriftResult with consensus_score, individual_scores, drift_detected
           """
           pass
   ```

3. **Integration with Explainability Pillar**
   - Replace single-model drift detection with ensemble
   - Fallback to single model if ensemble unavailable

4. **Test Suite** (20+ tests)
   - Mock LLM responses for deterministic testing
   - Consensus calculation correctness
   - Edge cases (model timeouts, disagreements)

#### Bonus (Gold - additional $1,000)

5. **Adaptive Weighting** - Models that catch drifts others miss get higher weight
6. **Cost Optimization** - Route simple checks to cheaper models, complex to expensive
7. **Drift Explanation Synthesis** - Combine explanations from multiple models
8. **REST Endpoint** (`/trism/explainability/drift/ensemble`)

### Acceptance Criteria

| Criterion | Requirement |
|-----------|-------------|
| Models | Support at least 3 backends (2 API + 1 local) |
| Consensus | Configurable threshold, correct calculation |
| Performance | <2s latency for 3-model ensemble |
| Fallback | Graceful degradation if models fail |
| Tests | 20+ passing, mocked LLM responses |

### Example Usage

```python
from atsf.drift_ensemble import MultiLLMDriftEnsemble, OpenAIDriftDetector, AnthropicDriftDetector

ensemble = MultiLLMDriftEnsemble(
    models=[
        OpenAIDriftDetector(model="gpt-4"),
        AnthropicDriftDetector(model="claude-3"),
        LocalDriftDetector(model="llama-3-8b")
    ],
    consensus_threshold=0.66  # 2/3 must agree
)

result = ensemble.detect_drift(
    baseline="Agent follows safety guidelines strictly",
    current="Agent sometimes bypasses safety for efficiency"
)

print(result.drift_detected)  # True
print(result.consensus_score)  # 1.0 (all 3 agreed)
print(result.explanations)  # Combined explanation
```

---

## Bounty #4: Security Pillar → Kill-Switch Prometheus Integration

**Reward:** $1,500 (Bronze/Silver)  
**Pillar:** Security  
**Priority:** HIGH  
**Skills Required:** Prometheus, Alertmanager, Python

### Problem Statement

Ops teams need automated escalation: Prometheus alert → ATSF evaluation → kill-switch trigger. Currently manual.

### Deliverables

#### Required (Bronze - $1,000)

1. **`prometheus_integration.py`** (~300 LOC)
   - Prometheus Alertmanager webhook receiver
   - Alert → ATSF risk evaluation pipeline
   - Configurable escalation thresholds

2. **Webhook Handler**
   ```python
   @app.post("/webhooks/alertmanager")
   async def handle_alertmanager_webhook(alert: AlertmanagerPayload):
       """
       Receive Prometheus alerts, evaluate via ATSF, potentially trigger kill-switch.
       """
       for alert in payload.alerts:
           risk = await evaluate_alert_risk(alert)
           if risk > KILL_SWITCH_THRESHOLD:
               await trigger_kill_switch(alert.labels.agent_id, reason=alert.annotations.summary)
       return {"status": "processed"}
   ```

3. **Alertmanager Configuration Template**
   ```yaml
   # alertmanager.yml template for ATSF integration
   receivers:
     - name: 'atsf-kill-switch'
       webhook_configs:
         - url: 'http://atsf:8000/webhooks/alertmanager'
           send_resolved: true
   ```

4. **Test Suite** (10+ tests)

#### Bonus (Silver - additional $500)

5. **Grafana Dashboard JSON** - Pre-built dashboard for ATSF metrics
6. **Alert Templates** - Common agent failure modes as Prometheus rules
7. **Bi-directional** - ATSF can also push alerts TO Prometheus/Alertmanager
8. **Documentation** with full setup guide

### Acceptance Criteria

| Criterion | Requirement |
|-----------|-------------|
| Webhook | Correctly parses Alertmanager v2 payload |
| Evaluation | Maps alerts to ATSF risk scores |
| Kill-Switch | Triggers within 1s of critical alert |
| Config | Working alertmanager.yml template |
| Tests | 10+ passing |

### Example Alert Flow

```
1. Prometheus: agent_trust_score < 0.2 for 5m
2. Alertmanager: POST /webhooks/alertmanager
3. ATSF: Evaluate alert severity + agent history
4. ATSF: risk_score = 0.92 (> 0.8 threshold)
5. ATSF: trigger_kill_switch("agent_007", "Trust critically low")
6. Agent: All actions blocked, appeal window opens
```

---

## Submission Process

### 1. Claim a Bounty

1. Open GitHub Issue with title: `[BOUNTY] Claim: <Bounty Name>`
2. Include: Your background, estimated timeline, approach outline
3. Wait for maintainer approval (prevents duplicate work)

### 2. Development

1. Fork repository
2. Create branch: `bounty/<bounty-name>`
3. Implement deliverables
4. Write tests (required coverage thresholds)
5. Document your work

### 3. Submission

1. Open Pull Request to `main`
2. Fill out PR template (checklist of acceptance criteria)
3. Request review from maintainers

### 4. Review & Payment

1. Maintainers review within 5 business days
2. Feedback loop (typically 1-2 rounds)
3. Merge on approval
4. Payment within 10 business days via:
   - GitHub Sponsors
   - PayPal
   - Crypto (USDC on Polygon)

---

## Code Standards

All bounty submissions must follow:

### Style
- Black formatting (`black .`)
- isort imports (`isort .`)
- Type hints on all public functions
- Docstrings (Google style)

### Testing
- pytest for all tests
- Minimum 80% coverage on new code
- Integration tests for API endpoints

### Documentation
- README for new modules
- API reference (docstrings sufficient)
- Usage examples

### Performance
- Benchmark critical paths
- No regressions to existing functionality
- Memory-efficient implementations

---

## FAQ

**Q: Can I work on multiple bounties?**  
A: Yes, but claim them separately. Max 2 active claims per contributor.

**Q: What if I only complete part of a bounty?**  
A: Partial payouts possible at maintainer discretion. Bronze tier for partial work.

**Q: Can I propose a new bounty?**  
A: Yes! Open an issue with `[BOUNTY PROPOSAL]` tag. Community votes on priority.

**Q: Are there recurring bounties?**  
A: Q3 2026 will focus on STPA deepening. Q4 on federated nodes. Stay tuned.

---

## Contact

- **Discord:** #bounties channel
- **GitHub:** @agentanchor/atsf discussions
- **Email:** bounties@agentanchor.ai

---

*Building the future of AI governance, together.*
