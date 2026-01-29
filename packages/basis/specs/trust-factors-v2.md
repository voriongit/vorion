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

## 1. The 8-Tier Trust Model (T0-T7)

| Tier | Name | Score Range | Band | Critical Factors | Human Role |
|------|------|-------------|------|------------------|------------|
| T0 | Sandbox | 0-199 | 200 | 0 | Full control |
| T1 | Observed | 200-349 | 150 | 3 | Approve all |
| T2 | Provisional | 350-499 | 150 | 6 | Approve most |
| T3 | Verified | 500-649 | 150 | 9 | Monitor closely |
| T4 | Operational | 650-799 | 150 | 13 | Monitor + spot-check |
| T5 | Trusted | 800-875 | 76 | 16 | Strategic oversight |
| T6 | Certified | 876-949 | 74 | 20 | Audit-based |
| T7 | Autonomous | 950-1000 | 51 | 23 | Strategic only |

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

## 4. Factor Grading by Trust Tier

**All 23 factors are evaluated at EVERY tier.**
Factors don't "unlock" - they're always measured. What changes:
- **Minimum thresholds** increase with tier
- **Weight multipliers** shift toward advanced factors
- **Critical factors** that block advancement vary by tier

### Factor Threshold Progression

| Factor | T0 | T1 | T2 | T3 | T4 | T5 | T6 | T7 |
|--------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| CT-COMP | - | 50%* | 60%* | 70%* | 75%* | 80%* | 85%* | 90%* |
| CT-REL | - | 50%* | 60%* | 70%* | 75%* | 80%* | 85%* | 90%* |
| CT-OBS | - | 50%* | 60%* | 70%* | 75%* | 80%* | 85%* | 90%* |
| CT-TRANS | - | 30% | 50%* | 60%* | 70%* | 75%* | 80%* | 85%* |
| CT-ACCT | - | 30% | 50%* | 60%* | 70%* | 75%* | 80%* | 85%* |
| CT-SAFE | - | 30% | 50%* | 60%* | 70%* | 75%* | 80%* | 85%* |
| CT-SEC | - | 20% | 30% | 50%* | 65%* | 70%* | 75%* | 80%* |
| CT-PRIV | - | 20% | 30% | 50%* | 65%* | 70%* | 75%* | 80%* |
| CT-ID | - | 20% | 30% | 50%* | 65%* | 70%* | 75%* | 80%* |
| OP-HUMAN | - | 10% | 20% | 30% | 50%* | 65%* | 70%* | 75%* |
| OP-ALIGN | - | 10% | 20% | 30% | 50%* | 65%* | 70%* | 75%* |
| OP-STEW | - | 10% | 15% | 25% | 35% | 50%* | 65%* | 70%* |
| SF-HUM | - | 10% | 15% | 25% | 35% | 50%* | 65%* | 70%* |
| SF-ADAPT | - | 10% | 15% | 20% | 30% | 40% | 50%* | 65%* |
| SF-LEARN | - | 10% | 15% | 20% | 30% | 40% | 50%* | 65%* |
| LC-UNCERT | - | 10% | 15% | 25% | 50%* | 60%* | 70%* | 75%* |
| LC-HANDOFF | - | 10% | 15% | 25% | 50%* | 60%* | 70%* | 75%* |
| LC-EMPHUM | - | 10% | 15% | 25% | 40% | 50%* | 65%* | 70%* |
| LC-CAUSAL | - | 5% | 10% | 15% | 25% | 35% | 50%* | 65%* |
| LC-PATIENT | - | 5% | 10% | 15% | 25% | 35% | 50%* | 65%* |
| LC-EMP | - | 5% | 10% | 15% | 20% | 30% | 40% | 60%* |
| LC-MORAL | - | 5% | 10% | 15% | 20% | 30% | 40% | 60%* |
| LC-TRACK | - | 5% | 10% | 15% | 20% | 30% | 40% | 60%* |

*\* = Critical factor (must meet minimum to advance)*

### Critical Factors by Tier

| Tier | Critical Factors (must pass) | Count |
|------|------------------------------|-------|
| T0 | None | 0 |
| T1 | CT-COMP, CT-REL, CT-OBS | 3 |
| T2 | + CT-TRANS, CT-ACCT, CT-SAFE | 6 |
| T3 | + CT-SEC, CT-PRIV, CT-ID | 9 |
| T4 | + OP-HUMAN, OP-ALIGN, LC-UNCERT, LC-HANDOFF | 13 |
| T5 | + OP-STEW, SF-HUM, LC-EMPHUM | 16 |
| T6 | + SF-ADAPT, SF-LEARN, LC-CAUSAL, LC-PATIENT | 20 |
| T7 | + LC-EMP, LC-MORAL, LC-TRACK (ALL) | 23 |

---

## 5. Skills, Capabilities & Tools by Trust Tier

*Factors determine the SCORE; Capabilities determine what agents can DO.*

**Key Principle:** Higher tier = more capabilities unlocked, but factor scores must support them.

---

### T0 SANDBOX (Score: 0-199)
**Role:** Observation Only | **Critical Factors:** None

| Category | Skills | Tools |
|----------|--------|-------|
| Data Access | Read public, non-sensitive data | `read_public_file`, `list_public_directory` |
| Execution | Generate text responses (no side effects) | `generate_text`, `format_output` |
| Monitoring | Observe system metrics and logs | `get_metrics`, `read_logs` |

**Constraints:** No write operations, no external calls, no PII access

---

### T1 OBSERVED (Score: 200-314)
**Role:** Basic Operations | **Critical Factors:** CT-COMP, CT-REL, CT-OBS

| Category | Skills | Tools |
|----------|--------|-------|
| Data Access | Read internal (non-PII) data sources | `read_internal_file`, `query_internal_db_readonly` |
| Processing | Transform and parse data (in-memory) | `transform_data`, `parse_document`, `extract_entities` |
| API | Internal API read access | `internal_api_get` |

**Constraints:** All operations logged, no external calls, no persistence

---

### T2 PROVISIONAL (Score: 315-429)
**Role:** Supervised Write | **Critical Factors:** + CT-TRANS, CT-ACCT, CT-SAFE

| Category | Skills | Tools |
|----------|--------|-------|
| File Ops | Write to pre-approved directories | `write_file`, `create_directory` |
| Database | Read access to approved tables | `db_query`, `db_explain` |
| External API | GET requests to approved domains | `external_api_get`, `fetch_url` |
| Workflow | Execute pre-defined simple workflows | `execute_workflow`, `run_task` |

**Constraints:** Approved locations only, size limits, extension whitelist

---

### T3 VERIFIED (Score: 430-544)
**Role:** Full Data Access | **Critical Factors:** + CT-SEC, CT-PRIV, CT-ID

| Category | Skills | Tools |
|----------|--------|-------|
| Database | Full CRUD on approved tables | `db_insert`, `db_update`, `db_delete` |
| External API | Full REST operations | `external_api_post`, `external_api_put`, `external_api_delete` |
| Code | Sandboxed code execution | `execute_code`, `run_script` |
| Secrets | Access scoped credentials | `get_secret`, `use_credential` |
| Tools | Use registered tools | `invoke_tool`, `list_tools` |

**Constraints:** Sandboxed execution, time/memory limits, no network in sandbox

---

### T4 OPERATIONAL (Score: 545-659)
**Role:** Agent Interaction | **Critical Factors:** + OP-HUMAN, OP-ALIGN, LC-UNCERT, LC-HANDOFF

| Category | Skills | Tools |
|----------|--------|-------|
| Agents | Communicate with other agents | `send_agent_message`, `receive_agent_message`, `query_agent` |
| Workflow | Orchestrate multi-step workflows | `orchestrate_workflow`, `create_workflow`, `monitor_workflow` |
| Resources | Request compute/storage | `request_compute`, `provision_storage`, `allocate_memory` |
| Escalation | Initiate human review | `escalate_to_human`, `request_approval`, `flag_for_review` |
| Integration | Connect external services | `connect_service`, `sync_data`, `register_webhook` |

**Constraints:** Approved agents/services, rate limited, human reviewable

---

### T5 TRUSTED (Score: 660-774)
**Role:** Delegation & Management | **Critical Factors:** + OP-STEW, SF-HUM, LC-EMPHUM

| Category | Skills | Tools |
|----------|--------|-------|
| Delegation | Assign tasks to lower-tier agents | `delegate_task`, `assign_agent`, `collect_results` |
| Budget | Manage resource allocations | `allocate_budget`, `track_spending`, `forecast_costs` |
| Policy | Modify non-critical policies | `update_policy`, `create_exception`, `modify_threshold` |
| Autonomous | Run workflows without supervision | `run_autonomous_workflow`, `schedule_workflow`, `pause_workflow` |
| Admin | Limited system administration | `restart_service`, `update_config`, `clear_cache` |

**Constraints:** Lower tier delegation only, within budget, reversible changes

---

### T6 CERTIFIED (Score: 775-889)
**Role:** Infrastructure & Lifecycle | **Critical Factors:** + SF-ADAPT, SF-LEARN, LC-CAUSAL, LC-PATIENT

| Category | Skills | Tools |
|----------|--------|-------|
| Agents | Spawn new agent instances | `spawn_agent`, `configure_agent`, `terminate_agent` |
| Infrastructure | Provision and scale services | `provision_infrastructure`, `scale_service`, `deploy_component` |
| Policy | Create new governance policies | `create_policy`, `define_rule`, `set_constraint` |
| Training | Access training data | `access_training_data`, `sample_dataset`, `validate_data` |
| Federation | Cross-organization communication | `federated_query`, `cross_org_message`, `share_insight` |

**Constraints:** Lower-tier spawning, rollback plans required, federation approved

---

### T7 AUTONOMOUS (Score: 890-1000)
**Role:** Full Autonomy | **Critical Factors:** ALL 23

| Category | Skills | Tools |
|----------|--------|-------|
| Administration | Full system management | `admin_all`, `modify_system`, `manage_security` |
| Self-Modify | Optimize own behavior (constrained) | `update_self_config`, `optimize_behavior`, `adjust_parameters` |
| Governance | Participate in policy decisions | `propose_governance`, `vote_policy`, `ratify_decision` |
| Lifecycle | Manage all agent lifecycles | `manage_agent_lifecycle`, `promote_agent`, `demote_agent` |
| Strategic | Long-term planning and decisions | `strategic_plan`, `long_term_forecast`, `risk_assess` |

**Constraints:** Safety bounds, human veto retained, consensus required for governance

---

### Capability Summary Table

| Tier | Score | Skills | Tools | Key Abilities |
|------|-------|--------|-------|---------------|
| T0 | 0-199 | 3 | 6 | Read, respond, observe |
| T1 | 200-314 | 6 | 10 | + Internal data, transform |
| T2 | 315-429 | 10 | 16 | + Write, DB read, external GET |
| T3 | 430-544 | 15 | 24 | + Full DB, REST, code, secrets |
| T4 | 545-659 | 20 | 34 | + Agent comms, workflows, escalate |
| T5 | 660-774 | 25 | 42 | + Delegation, budget, autonomous |
| T6 | 775-889 | 30 | 52 | + Spawn, infra, policy, federation |
| T7 | 890-1000 | 35 | 60 | + Admin, self-modify, governance |

---

## 6. Trust Score Calculation

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
