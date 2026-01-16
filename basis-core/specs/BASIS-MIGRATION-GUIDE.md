# BASIS Migration Guide

**Version 1.0.0 | January 2026**

---

## Overview

This guide provides a phased approach to adopting BASIS governance for AI agent deployments. It covers assessment, planning, implementation, and validation for organizations at any stage of AI maturity.

---

## 1. Adoption Phases

### 1.1 Phase Overview

| Phase | Duration | Focus | Risk |
|-------|----------|-------|------|
| 0: Assessment | 2-4 weeks | Evaluate current state | None |
| 1: Audit-Only | 4-8 weeks | Observe without blocking | Low |
| 2: Shadow Mode | 4-8 weeks | Test enforcement logic | Low |
| 3: Gradual Enforcement | 8-12 weeks | Progressive rollout | Medium |
| 4: Full Enforcement | Ongoing | Complete governance | Managed |

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Phase 0    │  │   Phase 1    │  │   Phase 2    │  │   Phase 3    │  │   Phase 4    │
│  Assessment  │─▶│  Audit-Only  │─▶│ Shadow Mode  │─▶│   Gradual    │─▶│     Full     │
│              │  │              │  │              │  │ Enforcement  │  │ Enforcement  │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
     2-4 wk           4-8 wk           4-8 wk           8-12 wk          Ongoing
```

---

## 2. Phase 0: Assessment

### 2.1 Current State Inventory

**Agent Inventory:**

| Question | Your Answer |
|----------|-------------|
| How many AI agents are deployed? | |
| What actions can agents perform? | |
| Which external systems do agents access? | |
| What data sensitivity levels are accessed? | |
| Who owns each agent? | |
| What monitoring exists today? | |

**Risk Assessment:**

| Question | Your Answer |
|----------|-------------|
| Have agents caused incidents? | |
| What's the worst an agent could do? | |
| Are there compliance requirements? | |
| What's the business impact of agent failure? | |

### 2.2 Capability Mapping

Map existing agent capabilities to BASIS taxonomy:

```yaml
# Example capability mapping
agent_capability_mapping:
  - agent_id: "customer_service_bot"
    current_capabilities:
      - "access customer records"
      - "send emails"
      - "process refunds up to $50"
    basis_mapping:
      - "data:read/sensitive/pii"
      - "comm:external/email"
      - "financial:transaction/low"
    current_controls: "human approval for refunds"
    recommended_tier: "trusted"

  - agent_id: "data_analysis_agent"
    current_capabilities:
      - "query databases"
      - "generate reports"
      - "call external APIs"
    basis_mapping:
      - "data:read/internal"
      - "data:export/report"
      - "comm:external/api/read"
    current_controls: "none"
    recommended_tier: "standard"
```

### 2.3 Gap Analysis

| Area | Current State | BASIS Requirement | Gap |
|------|---------------|-------------------|-----|
| Authentication | | API key or OAuth | |
| Authorization | | Capability-based | |
| Audit logging | | Immutable proof chain | |
| Risk classification | | INTENT layer | |
| Trust measurement | | 0-1000 scoring | |
| Human oversight | | Escalation mechanism | |

### 2.4 Assessment Deliverables

- [ ] Complete agent inventory
- [ ] Capability mapping spreadsheet
- [ ] Gap analysis report
- [ ] Recommended trust tier assignments
- [ ] Migration timeline estimate
- [ ] Resource requirements

---

## 3. Phase 1: Audit-Only Mode

### 3.1 Objectives

- Deploy BASIS infrastructure
- Collect baseline data without affecting operations
- Identify potential enforcement issues
- Train operations team

### 3.2 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Existing Agent System                         │
│                                                                   │
│  Agent ──▶ Action ──▶ [Execute Normally]                        │
│                │                                                 │
│                └──▶ [Copy to BASIS] ──▶ INTENT ──▶ ENFORCE      │
│                         (async)            │          │          │
│                                           ▼          ▼          │
│                                        PROOF    [Log Only]      │
│                                                 No blocking      │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Implementation Steps

**Week 1-2: Infrastructure Setup**

```bash
# Deploy BASIS infrastructure
kubectl apply -f basis-core/
kubectl apply -f basis-monitoring/

# Configure audit-only mode
basis-cli config set enforcement_mode audit_only
basis-cli config set default_decision ALLOW
```

**Week 3-4: Agent Integration**

```python
# Add BASIS observer to existing agents
from basis import AuditObserver

observer = AuditObserver(
    basis_endpoint="https://basis.internal",
    mode="audit_only"  # Log but don't block
)

# Wrap existing agent actions
@observer.observe
async def existing_agent_action(action_request):
    # Original logic unchanged
    return await execute_action(action_request)
```

**Week 5-8: Baseline Collection**

```yaml
# Metrics to collect
audit_metrics:
  - total_actions_observed
  - actions_by_capability
  - actions_by_risk_level
  - would_have_denied_count
  - would_have_escalated_count
  - trust_score_distribution
```

### 3.4 Phase 1 Success Criteria

- [ ] 95%+ of agent actions captured
- [ ] Baseline risk distribution documented
- [ ] "Would-deny" rate < 20% (indicates policy is reasonable)
- [ ] No performance degradation (< 10ms overhead)
- [ ] Operations team trained on dashboard

---

## 4. Phase 2: Shadow Mode

### 4.1 Objectives

- Run ENFORCE decisions in parallel
- Compare governance decisions to actual outcomes
- Tune policies before enforcement
- Build confidence in trust scoring

### 4.2 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│  Agent ──▶ Action ──▶ BASIS ──▶ INTENT ──▶ ENFORCE              │
│                                              │                    │
│                                    ┌─────────┴─────────┐         │
│                                    │                   │         │
│                                Shadow Decision    [Execute       │
│                                (logged only)      Anyway]        │
│                                    │                   │         │
│                                    ▼                   ▼         │
│                               Compare           PROOF Record     │
│                               Results                            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Implementation Steps

**Week 1-2: Shadow Configuration**

```yaml
# Shadow mode configuration
enforcement:
  mode: shadow
  default_action: allow_and_log
  shadow_decision_logging: true
  comparison_metrics: true

comparison:
  enabled: true
  track_outcomes: true
  alert_on_mismatch: true
```

**Week 3-6: Policy Tuning**

```python
# Analyze shadow decisions
from basis.analytics import ShadowAnalyzer

analyzer = ShadowAnalyzer()
report = analyzer.compare_decisions(
    start_date="2026-01-01",
    end_date="2026-02-01"
)

# Output:
# - Actions that would have been denied but succeeded: 142
# - Actions that would have been allowed but failed: 3
# - Escalation candidates that self-resolved: 89
# - Policy adjustment recommendations: [...]
```

**Week 7-8: Policy Refinement**

Based on shadow analysis, adjust:
- Trust tier thresholds
- Capability mappings
- Escalation triggers
- Risk classification rules

### 4.4 Phase 2 Success Criteria

- [ ] Shadow deny rate stabilized (not increasing)
- [ ] False positive rate < 5%
- [ ] False negative rate < 1%
- [ ] Policy tuning complete
- [ ] Stakeholder sign-off on policies

---

## 5. Phase 3: Gradual Enforcement

### 5.1 Objectives

- Enable enforcement incrementally
- Maintain business continuity
- Handle escalations in production
- Refine operational procedures

### 5.2 Rollout Strategies

**Option A: Risk-Based Rollout**

```yaml
# Enforce by risk level
gradual_enforcement:
  week_1_2:
    - risk_level: critical
      enforcement: true
    - risk_level: high
      enforcement: shadow
    - risk_level: medium
      enforcement: shadow
    - risk_level: low
      enforcement: shadow

  week_3_4:
    - risk_level: critical
      enforcement: true
    - risk_level: high
      enforcement: true
    - risk_level: medium
      enforcement: shadow
    - risk_level: low
      enforcement: shadow

  week_5_6:
    # Continue pattern...
```

**Option B: Agent-Based Rollout**

```yaml
# Enforce by agent priority
gradual_enforcement:
  wave_1:
    agents: ["test_agent_1", "low_risk_agent"]
    enforcement: true
    duration: "2 weeks"

  wave_2:
    agents: ["customer_service_bot"]
    enforcement: true
    duration: "2 weeks"

  wave_3:
    agents: ["data_analyst", "report_generator"]
    enforcement: true
    duration: "2 weeks"

  wave_4:
    agents: ["all_remaining"]
    enforcement: true
```

**Option C: Capability-Based Rollout**

```yaml
# Enforce by capability namespace
gradual_enforcement:
  week_1_2:
    enforced_capabilities:
      - "sandbox:*"
      - "data:read/public"

  week_3_4:
    enforced_capabilities:
      - "data:read/*"
      - "comm:internal/*"

  week_5_6:
    enforced_capabilities:
      - "comm:external/*"
      - "execute:internal/*"

  week_7_8:
    enforced_capabilities:
      - "financial:*"
      - "admin:*"
```

### 5.3 Rollback Procedures

```yaml
rollback_triggers:
  automatic:
    - deny_rate_spike: "> 50% increase in 1 hour"
    - escalation_queue_overflow: "> 100 pending"
    - false_positive_spike: "> 10% of denials overridden"

  manual:
    - business_impact_reported: true
    - critical_workflow_blocked: true

rollback_procedure:
  1. Disable enforcement for affected scope
  2. Alert operations team
  3. Preserve decision logs
  4. Analyze root cause
  5. Adjust policies
  6. Re-enable with monitoring
```

### 5.4 Phase 3 Success Criteria

- [ ] All agents under gradual enforcement
- [ ] Escalation response time < 15 minutes
- [ ] Override rate < 5%
- [ ] No critical workflow disruptions
- [ ] Rollback procedure tested

---

## 6. Phase 4: Full Enforcement

### 6.1 Objectives

- Complete enforcement coverage
- Operational excellence
- Continuous improvement
- Compliance reporting

### 6.2 Steady-State Operations

**Daily Operations:**
- Review escalation queue
- Monitor trust score changes
- Check proof chain integrity
- Review anomaly alerts

**Weekly Operations:**
- Analyze deny patterns
- Review trust tier distributions
- Assess policy effectiveness
- Generate compliance reports

**Monthly Operations:**
- Trust score calibration review
- Policy audit
- Capacity planning
- Stakeholder reporting

### 6.3 Continuous Improvement

```yaml
improvement_cycle:
  collect:
    - governance_decision_metrics
    - override_patterns
    - escalation_outcomes
    - trust_score_trajectories

  analyze:
    - identify_false_positives
    - identify_false_negatives
    - detect_policy_gaps
    - benchmark_against_goals

  improve:
    - tune_trust_scoring
    - adjust_capability_tiers
    - refine_risk_classification
    - update_policies

  validate:
    - shadow_test_changes
    - gradual_rollout
    - measure_improvement
```

### 6.4 Phase 4 Success Criteria

- [ ] 100% enforcement coverage
- [ ] Audit trail complete and verified
- [ ] Compliance requirements met
- [ ] Mean escalation resolution < 1 hour
- [ ] Trust scoring calibrated to outcomes

---

## 7. Integration Patterns

### 7.1 LangChain Integration

```python
from langchain.callbacks import BaseCallbackHandler
from basis import BasisClient

class BasisCallback(BaseCallbackHandler):
    def __init__(self, basis_client: BasisClient, entity_id: str):
        self.client = basis_client
        self.entity_id = entity_id

    def on_tool_start(self, tool, input_str, **kwargs):
        # Evaluate action before tool execution
        decision = self.client.enforce(
            entity_id=self.entity_id,
            action_type=f"tool:{tool.name}",
            parameters={"input": input_str}
        )

        if decision.decision == "DENY":
            raise PermissionError(f"Action denied: {decision.denial_reason}")
        elif decision.decision == "ESCALATE":
            # Handle escalation
            pass

    def on_tool_end(self, output, **kwargs):
        # Log completion for trust scoring
        self.client.record_outcome(
            proof_id=self.current_proof_id,
            outcome="success"
        )

# Usage
callback = BasisCallback(basis_client, entity_id="agent_123")
agent.invoke(input, callbacks=[callback])
```

### 7.2 CrewAI Integration

```python
from crewai import Agent, Task
from basis import BasisClient

class GovernedAgent(Agent):
    def __init__(self, *args, basis_client: BasisClient, **kwargs):
        super().__init__(*args, **kwargs)
        self.basis = basis_client

    def execute_task(self, task: Task):
        # Pre-execution governance
        decision = self.basis.enforce(
            entity_id=self.id,
            action_type="task_execution",
            parameters={
                "task_description": task.description,
                "expected_output": task.expected_output
            }
        )

        if decision.decision != "ALLOW":
            return self._handle_governance_decision(decision)

        # Execute with proof tracking
        with self.basis.proof_context(decision.proof_id):
            result = super().execute_task(task)

        # Record outcome
        self.basis.record_outcome(
            proof_id=decision.proof_id,
            outcome="success" if result else "failure"
        )

        return result
```

### 7.3 REST API Integration

```python
# Generic REST API middleware
from fastapi import Request, HTTPException
from basis import BasisClient

basis = BasisClient()

async def governance_middleware(request: Request, call_next):
    # Extract entity from auth
    entity_id = request.state.entity_id

    # Build intent
    intent = {
        "action_type": f"{request.method}:{request.url.path}",
        "parameters": dict(request.query_params)
    }

    # Enforce
    decision = await basis.enforce_async(
        entity_id=entity_id,
        **intent
    )

    if decision.decision == "DENY":
        raise HTTPException(
            status_code=403,
            detail={
                "error_code": decision.denial_code,
                "message": decision.denial_reason,
                "proof_id": decision.proof_id
            }
        )

    # Add proof context to request
    request.state.proof_id = decision.proof_id

    response = await call_next(request)

    # Record outcome
    await basis.record_outcome_async(
        proof_id=decision.proof_id,
        outcome="success" if response.status_code < 400 else "failure"
    )

    return response
```

---

## 8. Common Migration Challenges

### 8.1 Challenge: High Initial Deny Rate

**Symptoms:**
- > 20% of actions would be denied
- Business disruption during enforcement

**Solutions:**
1. Review capability-to-tier mapping
2. Adjust initial trust scores higher
3. Add more capabilities to lower tiers
4. Implement grace period for existing agents

```yaml
# Grace period configuration
migration_grace_period:
  enabled: true
  duration_days: 30
  behavior:
    - existing_agents: "start at tier 'trusted'"
    - deny_threshold: "warn_only for first 14 days"
    - escalation: "auto_approve if low_risk"
```

### 8.2 Challenge: Escalation Overload

**Symptoms:**
- Escalation queue grows faster than resolution
- Approvers overwhelmed

**Solutions:**
1. Tune escalation triggers to reduce volume
2. Implement auto-approval for low-risk escalations
3. Add more escalation targets
4. Batch similar escalations

```yaml
# Auto-approval rules
auto_approval:
  enabled: true
  rules:
    - condition: "risk_level == 'low' AND trust_tier >= 'standard'"
      action: "auto_approve"
      max_per_hour: 100

    - condition: "same_action_approved_3x_today"
      action: "auto_approve_with_logging"
```

### 8.3 Challenge: Trust Score Cold Start

**Symptoms:**
- All entities start at low trust
- Productive agents blocked

**Solutions:**
1. Initialize scores based on historical performance
2. Accelerated trust building in migration period
3. Admin-assigned initial tiers

```python
# Historical score initialization
def initialize_trust_from_history(entity_id: str, history: List[Action]) -> int:
    """Calculate initial trust score from historical actions."""

    successful_actions = [a for a in history if a.outcome == "success"]
    failed_actions = [a for a in history if a.outcome == "failure"]

    # Base score from success rate
    success_rate = len(successful_actions) / len(history) if history else 0
    base_score = int(success_rate * 500)  # 0-500 based on history

    # Bonus for volume
    volume_bonus = min(100, len(successful_actions) // 10)

    # Penalty for failures
    failure_penalty = len(failed_actions) * 20

    initial_score = max(100, base_score + volume_bonus - failure_penalty)

    return initial_score
```

### 8.4 Challenge: Legacy System Integration

**Symptoms:**
- Existing systems don't support middleware
- Can't modify agent code

**Solutions:**
1. Proxy-based governance
2. Log-based async governance
3. Database trigger governance

```yaml
# Proxy-based governance
proxy_governance:
  enabled: true
  proxy_port: 8443

  intercepts:
    - pattern: "POST /api/v1/actions/*"
      governance:
        extract_entity: "header:X-Agent-ID"
        extract_action: "body:action_type"
        on_deny: "return_403"

    - pattern: "* /external/*"
      governance:
        default_risk: "high"
        require_capability: "comm:external/*"
```

---

## 9. Migration Checklist

### 9.1 Pre-Migration

- [ ] Executive sponsor identified
- [ ] Budget approved
- [ ] Team trained on BASIS concepts
- [ ] Current agent inventory complete
- [ ] Compliance requirements documented
- [ ] Success metrics defined

### 9.2 Infrastructure

- [ ] BASIS core deployed
- [ ] Monitoring configured
- [ ] Alerting configured
- [ ] Backup procedures tested
- [ ] Disaster recovery planned

### 9.3 Integration

- [ ] Agent integration pattern selected
- [ ] Test agents integrated
- [ ] Production agents integrated
- [ ] Proof chain verified
- [ ] Performance benchmarks met

### 9.4 Operations

- [ ] Escalation workflow defined
- [ ] On-call procedures documented
- [ ] Runbooks created
- [ ] Team trained on operations
- [ ] SLAs defined

### 9.5 Compliance

- [ ] Audit trail meets requirements
- [ ] Retention configured
- [ ] Reports automated
- [ ] Auditor access configured
- [ ] Documentation complete

---

## 10. Post-Migration Support

### 10.1 Resources

- Documentation: https://vorion.org/basis/docs
- Community Discord: https://discord.gg/basis-protocol
- GitHub Issues: https://github.com/voriongit/basis-spec
- Enterprise Support: support@vorion.org

### 10.2 Training Materials

- BASIS Fundamentals (self-paced)
- Operations Training (instructor-led)
- Policy Authoring Workshop
- Compliance Implementation Guide

### 10.3 Certification

Organizations can pursue BASIS Conformance Certification:

| Level | Requirements |
|-------|--------------|
| Bronze | BASIS Core + conformance test suite |
| Silver | BASIS Complete + operational audit |
| Gold | BASIS Extended + annual recertification |

---

*Copyright © 2026 Vorion Risk, LLC. This work is licensed under CC BY 4.0.*
