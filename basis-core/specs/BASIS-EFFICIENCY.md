# BASIS Efficiency Specification

**Version 1.0.0 | January 2026**

---

## Abstract

This document defines the efficiency governance extensions for BASIS-conformant implementations. It specifies resource manifests, cost-to-value monitoring, and adaptive efficiency controls that help agents operate sustainably while maximizing value delivery.

---

## 1. Introduction

### 1.1 Purpose

AI agents consume computational resources (GPU, memory, energy) to deliver value. Without efficiency governance:

- Agents may use expensive reasoning modes for simple tasks
- Resource costs can exceed the value of outputs
- Environmental impact grows unchecked
- Organizations lack visibility into agent efficiency

BASIS Efficiency addresses this by defining:

1. **Resource Manifests** — Declared resource requirements and limits
2. **Cost-to-Value Monitoring** — Real-time efficiency tracking
3. **Adaptive Controls** — Automatic throttling and degradation
4. **Efficiency Certification** — Standardized efficiency tiers

### 1.2 Design Principles

1. **Value-First Governance** — Optimize for value delivered, not just resource minimization
2. **Graceful Degradation** — Reduce capability before stopping entirely
3. **Transparency** — Agents see their own efficiency metrics
4. **Sustainability** — Align with SCI (ISO/IEC 21031:2024) methodology

---

## 2. Resource Manifests

### 2.1 Overview

Every BASIS agent SHOULD declare a Resource Manifest specifying its computational requirements. This follows the Kubernetes dual-threshold model (requests/limits).

### 2.2 Manifest Schema

```json
{
  "$schema": "https://basis.vorion.org/schemas/v1/resource-manifest.json",
  "agent_id": "agent_abc123",
  "version": "1.0",
  "compute": {
    "cpu": {
      "request": "500m",
      "limit": "2000m"
    },
    "memory": {
      "request": "2Gi",
      "limit": "8Gi"
    },
    "gpu": {
      "type": "nvidia-a100",
      "vram_request": "20Gi",
      "vram_limit": "40Gi",
      "count": 1
    }
  },
  "inference": {
    "model_id": "claude-3-opus",
    "max_tokens_per_request": 4096,
    "max_requests_per_minute": 60,
    "reasoning_mode": "enabled",
    "reasoning_budget_tokens": 10000
  },
  "efficiency": {
    "hardware_tier": "B",
    "declared_wh_per_1k_queries": 0.5,
    "sustainability_certified": true,
    "sci_score": 12.5
  }
}
```

### 2.3 Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agent_id` | string | Yes | Unique agent identifier |
| `version` | string | Yes | Manifest version |
| `compute.cpu.request` | string | No | Minimum CPU (millicores) |
| `compute.cpu.limit` | string | No | Maximum CPU (millicores) |
| `compute.memory.request` | string | No | Minimum memory (binary units) |
| `compute.memory.limit` | string | No | Maximum memory (binary units) |
| `compute.gpu.type` | string | No | GPU model identifier |
| `compute.gpu.vram_request` | string | No | Minimum VRAM |
| `compute.gpu.vram_limit` | string | No | Maximum VRAM |
| `inference.model_id` | string | Yes | Model being used |
| `inference.reasoning_mode` | enum | No | `enabled`, `disabled`, `adaptive` |
| `inference.reasoning_budget_tokens` | int | No | Max tokens for reasoning |
| `efficiency.hardware_tier` | enum | Yes | `A`, `B`, or `C` |
| `efficiency.declared_wh_per_1k_queries` | float | No | Self-declared energy efficiency |
| `efficiency.sci_score` | float | No | Software Carbon Intensity score |

### 2.4 Hardware Tiers

| Tier | Description | Typical Hardware | VRAM Range |
|------|-------------|------------------|------------|
| A | Consumer | RTX 4090, consumer GPUs | ≤24GB |
| B | Cloud Single | A100, H100 single GPU | 24-80GB |
| C | Cloud Multi | Multi-GPU clusters | >80GB |

---

## 3. Cost-to-Value (CTV) Governance

### 3.1 Overview

Cost-to-Value governance monitors whether an agent's resource consumption is justified by the value it delivers. Agents running "high cost for low returns" are automatically throttled or stopped.

### 3.2 CTV Ratio Definition

```
CTV = Cost / Value

Where:
  Cost = (compute_cost + inference_cost + energy_cost) per operation
  Value = value_score assigned to the operation outcome
```

### 3.3 Value Scoring

Value scores are assigned based on operation outcomes:

| Outcome | Base Value Score | Multipliers |
|---------|-----------------|-------------|
| Task completed successfully | 100 | +50% if high priority |
| Partial completion | 50 | -25% if retry needed |
| Useful intermediate result | 25 | +25% if user engaged |
| No actionable output | 5 | — |
| Error or failure | 0 | — |
| User rejected output | -10 | — |

### 3.4 Cost Calculation

```python
def calculate_operation_cost(operation: Operation) -> float:
    """
    Calculate the cost of an operation in normalized cost units (NCU).
    1 NCU ≈ $0.001 USD at reference rates.
    """

    # Compute cost (CPU + Memory + GPU)
    compute_cost = (
        operation.cpu_seconds * CPU_COST_PER_SECOND +
        operation.memory_gb_seconds * MEMORY_COST_PER_GB_SECOND +
        operation.gpu_seconds * GPU_COST_PER_SECOND[operation.gpu_type]
    )

    # Inference cost (tokens)
    inference_cost = (
        operation.input_tokens * INPUT_TOKEN_COST[operation.model_id] +
        operation.output_tokens * OUTPUT_TOKEN_COST[operation.model_id] +
        operation.reasoning_tokens * REASONING_TOKEN_COST[operation.model_id]
    )

    # Energy cost (carbon-aware)
    energy_kwh = operation.energy_wh / 1000
    carbon_intensity = get_grid_carbon_intensity(operation.region)
    energy_cost = energy_kwh * carbon_intensity * CARBON_COST_FACTOR

    return compute_cost + inference_cost + energy_cost
```

### 3.5 CTV Thresholds

| CTV Ratio | Status | Action |
|-----------|--------|--------|
| < 1.0 | Excellent | No action (value exceeds cost) |
| 1.0 - 2.0 | Acceptable | Monitor |
| 2.0 - 5.0 | Marginal | Alert agent, suggest optimization |
| 5.0 - 10.0 | Poor | Throttle (reduce capability) |
| > 10.0 | Unacceptable | Stop and require human review |

### 3.6 CTV Algorithm

```python
# Constants
CTV_WINDOW_OPERATIONS = 10  # Rolling window size
CTV_THRESHOLD_ALERT = 2.0
CTV_THRESHOLD_THROTTLE = 5.0
CTV_THRESHOLD_STOP = 10.0
REASONING_COST_MULTIPLIER = 30  # Reasoning is ~30x more expensive

def evaluate_ctv(
    agent_id: str,
    recent_operations: list[Operation]
) -> CTVResult:
    """
    Evaluate cost-to-value ratio for recent operations.

    Returns:
        CTVResult with action recommendation
    """

    if len(recent_operations) < 3:
        return CTVResult(action="monitor", reason="insufficient_data")

    # Calculate rolling CTV
    total_cost = sum(calculate_operation_cost(op) for op in recent_operations)
    total_value = sum(op.value_score for op in recent_operations)

    if total_value <= 0:
        # Avoid division by zero; negative value is critical
        return CTVResult(
            action="stop",
            reason="zero_or_negative_value",
            ctv_ratio=float('inf'),
            recommendation="Agent produced no value in recent operations"
        )

    ctv_ratio = total_cost / total_value

    # Check for reasoning mode waste
    reasoning_operations = [op for op in recent_operations if op.reasoning_enabled]
    if reasoning_operations:
        reasoning_ctv = calculate_reasoning_ctv(reasoning_operations)
        if reasoning_ctv > CTV_THRESHOLD_THROTTLE:
            return CTVResult(
                action="degrade",
                reason="reasoning_inefficient",
                ctv_ratio=reasoning_ctv,
                recommendation="Disable reasoning mode for routine tasks",
                degrade_to={"reasoning_mode": "disabled"}
            )

    # Standard CTV evaluation
    if ctv_ratio > CTV_THRESHOLD_STOP:
        return CTVResult(
            action="stop",
            reason="ctv_exceeded_stop_threshold",
            ctv_ratio=ctv_ratio,
            recommendation="Cost significantly exceeds value; human review required"
        )

    if ctv_ratio > CTV_THRESHOLD_THROTTLE:
        return CTVResult(
            action="throttle",
            reason="ctv_exceeded_throttle_threshold",
            ctv_ratio=ctv_ratio,
            recommendation="Reduce operation frequency or capability scope",
            throttle_factor=0.5  # Reduce to 50% capacity
        )

    if ctv_ratio > CTV_THRESHOLD_ALERT:
        return CTVResult(
            action="alert",
            reason="ctv_marginal",
            ctv_ratio=ctv_ratio,
            recommendation="Consider optimization strategies"
        )

    return CTVResult(
        action="continue",
        reason="ctv_acceptable",
        ctv_ratio=ctv_ratio
    )


def calculate_reasoning_ctv(operations: list[Operation]) -> float:
    """
    Calculate CTV specifically for reasoning-mode operations.
    Reasoning has 150-700x energy cost, so we need separate analysis.
    """
    reasoning_cost = sum(
        op.reasoning_tokens * REASONING_TOKEN_COST[op.model_id]
        for op in operations
    )
    reasoning_value = sum(
        op.value_score * (1.5 if op.reasoning_contributed else 0.5)
        for op in operations
    )

    if reasoning_value <= 0:
        return float('inf')

    return reasoning_cost / reasoning_value
```

---

## 4. Adaptive Efficiency Controls

### 4.1 Degradation Cascade

When CTV indicates inefficiency, the system applies progressive degradation:

```
Level 0: Normal Operation
    ↓ (CTV > 2.0)
Level 1: Alert & Suggest
    - Notify agent of efficiency concern
    - Suggest optimization strategies
    - Log for review
    ↓ (CTV > 5.0)
Level 2: Throttle
    - Reduce max requests per minute by 50%
    - Increase latency tolerance
    - Disable non-essential capabilities
    ↓ (CTV > 10.0)
Level 3: Degrade
    - Disable reasoning mode
    - Reduce context window
    - Limit to essential capabilities only
    ↓ (CTV > 20.0 or repeated failures)
Level 4: Stop
    - Halt agent operations
    - Require human review and approval to resume
    - Generate efficiency report
```

### 4.2 Reasoning Mode Governance

Given that reasoning-enabled models consume 150-700x more energy, special rules apply:

```python
def should_use_reasoning(
    task: Task,
    agent: Agent
) -> ReasoningDecision:
    """
    Determine if reasoning mode is appropriate for this task.
    """

    # Tasks that warrant reasoning
    REASONING_JUSTIFIED_TASKS = [
        "complex_analysis",
        "multi_step_planning",
        "code_generation",
        "mathematical_proof",
        "strategic_decision"
    ]

    # Tasks that should NOT use reasoning
    REASONING_WASTEFUL_TASKS = [
        "simple_lookup",
        "data_formatting",
        "template_fill",
        "status_check",
        "acknowledgment"
    ]

    if task.type in REASONING_WASTEFUL_TASKS:
        return ReasoningDecision(
            use_reasoning=False,
            reason="task_type_simple",
            suggested_model="fast_model"
        )

    if task.type in REASONING_JUSTIFIED_TASKS:
        # Check if agent has budget remaining
        if agent.reasoning_budget_remaining > task.estimated_reasoning_tokens:
            return ReasoningDecision(
                use_reasoning=True,
                reason="task_warrants_reasoning",
                budget_impact=task.estimated_reasoning_tokens
            )
        else:
            return ReasoningDecision(
                use_reasoning=False,
                reason="reasoning_budget_exhausted",
                suggested_alternative="escalate_to_human"
            )

    # Adaptive decision based on recent CTV
    recent_ctv = get_recent_ctv(agent.id)
    if recent_ctv > CTV_THRESHOLD_ALERT:
        return ReasoningDecision(
            use_reasoning=False,
            reason="ctv_efficiency_concern",
            suggested_model="balanced_model"
        )

    return ReasoningDecision(
        use_reasoning=True,
        reason="default_allow"
    )
```

### 4.3 Auto-Stop Conditions

An agent MUST be automatically stopped when ANY of:

| Condition | Threshold | Rationale |
|-----------|-----------|-----------|
| CTV ratio | > 10.0 sustained | Cost far exceeds value |
| Consecutive failures | > 5 | Agent not functioning |
| Value score | < 0 rolling avg | Agent producing negative value |
| Resource breach | > 150% of limit | Exceeding declared resources |
| Carbon budget | Exhausted | Sustainability constraint |

### 4.4 Recovery from Stop

After an auto-stop, resumption requires:

1. Human review of efficiency report
2. Identification of root cause
3. Updated resource manifest (if applicable)
4. Explicit approval to resume
5. Agent starts in `PROVISIONAL` tier regardless of prior tier

---

## 5. Efficiency Scoring

### 5.1 Efficiency Score Formula

Each agent receives an Efficiency Score (0-100):

```python
def calculate_efficiency_score(agent: Agent) -> int:
    """
    Calculate overall efficiency score (0-100).
    """

    # Component weights
    WEIGHT_CTV = 0.35
    WEIGHT_RESOURCE = 0.25
    WEIGHT_SUSTAINABILITY = 0.25
    WEIGHT_ADAPTABILITY = 0.15

    # CTV component (lower is better)
    avg_ctv = agent.get_average_ctv(window_days=7)
    ctv_score = max(0, 100 - (avg_ctv * 10))  # CTV 10 = score 0

    # Resource utilization (closer to declared is better)
    declared = agent.manifest.compute
    actual = agent.get_average_utilization(window_days=7)
    utilization_ratio = actual / declared
    resource_score = 100 - abs(utilization_ratio - 0.7) * 100  # Target 70%

    # Sustainability component
    sci_score = agent.manifest.efficiency.sci_score or 50
    sustainability_score = max(0, 100 - sci_score)  # Lower SCI = better

    # Adaptability (accepts degradation gracefully)
    degradations_accepted = agent.get_graceful_degradations(window_days=30)
    degradations_total = agent.get_total_degradations(window_days=30)
    adaptability_score = (degradations_accepted / max(1, degradations_total)) * 100

    # Weighted total
    total = (
        WEIGHT_CTV * ctv_score +
        WEIGHT_RESOURCE * resource_score +
        WEIGHT_SUSTAINABILITY * sustainability_score +
        WEIGHT_ADAPTABILITY * adaptability_score
    )

    return int(max(0, min(100, total)))
```

### 5.2 Efficiency Score Impact on Trust

Efficiency scores can modify trust score calculations:

```python
# Addition to trust score algorithm
EFFICIENCY_BONUS_THRESHOLD = 80  # Score above 80 = bonus
EFFICIENCY_PENALTY_THRESHOLD = 30  # Score below 30 = penalty
EFFICIENCY_MULTIPLIER_BONUS = 0.1  # +10% on positive deltas
EFFICIENCY_MULTIPLIER_PENALTY = 0.1  # -10% on positive deltas (slower growth)

def apply_efficiency_modifier(
    base_delta: int,
    efficiency_score: int
) -> int:
    """
    Modify trust score delta based on efficiency score.
    """

    if base_delta > 0:  # Positive outcome
        if efficiency_score >= EFFICIENCY_BONUS_THRESHOLD:
            # Efficient agents earn trust faster
            return int(base_delta * (1 + EFFICIENCY_MULTIPLIER_BONUS))
        elif efficiency_score < EFFICIENCY_PENALTY_THRESHOLD:
            # Inefficient agents earn trust slower
            return int(base_delta * (1 - EFFICIENCY_MULTIPLIER_PENALTY))

    return base_delta  # No modifier for negative outcomes
```

---

## 6. Integration with ENFORCE Layer

### 6.1 Efficiency Pre-Check

The ENFORCE layer MAY include an efficiency pre-check before standard capability evaluation:

```python
def enforce_with_efficiency(
    intent: IntentRecord,
    agent: Agent
) -> GovernanceDecision:
    """
    Enhanced ENFORCE with efficiency governance.
    """

    # Step 1: Efficiency pre-check
    efficiency_result = evaluate_ctv(agent.id, agent.recent_operations)

    if efficiency_result.action == "stop":
        return GovernanceDecision(
            decision="DENY",
            reason=f"efficiency_stop:{efficiency_result.reason}",
            recommendation=efficiency_result.recommendation
        )

    if efficiency_result.action == "degrade":
        # Modify intent to use degraded capabilities
        intent = apply_degradation(intent, efficiency_result.degrade_to)

    if efficiency_result.action == "throttle":
        # Check if within throttled rate limit
        if not check_throttled_rate(agent.id, efficiency_result.throttle_factor):
            return GovernanceDecision(
                decision="DENY",
                reason="throttle_rate_exceeded",
                retry_after_seconds=calculate_retry_delay(agent.id)
            )

    # Step 2: Standard capability and trust evaluation
    return standard_enforce(intent, agent)
```

### 6.2 DEGRADE Decision Enhancement

The existing DEGRADE decision type gains efficiency-specific modes:

| Degrade Mode | Description |
|--------------|-------------|
| `degrade:scope` | Reduce action scope (existing) |
| `degrade:reasoning` | Disable reasoning mode |
| `degrade:model` | Use smaller/faster model |
| `degrade:rate` | Reduce request rate |
| `degrade:context` | Reduce context window |

---

## 7. Conformance

### 7.1 Efficiency Conformance Level

Implementations MAY claim "BASIS Efficiency" conformance by implementing:

**Required:**
- Resource Manifest declaration
- CTV monitoring and logging
- Efficiency Score calculation
- At least one adaptive control (alert, throttle, or degrade)

**Recommended:**
- Full degradation cascade
- Reasoning mode governance
- Auto-stop implementation
- SCI score integration

### 7.2 Certification

Agents may obtain efficiency certification badges:

| Badge | Requirements |
|-------|-------------|
| `efficiency:certified/tier-a` | Operates within Tier A hardware limits |
| `efficiency:certified/tier-b` | Operates within Tier B hardware limits |
| `efficiency:certified/tier-c` | Operates within Tier C hardware limits |
| `efficiency:certified/sustainable` | SCI score < 20, carbon-aware scheduling |
| `efficiency:certified/reasoning` | Reasoning CTV < 3.0 sustained |

---

## 8. Reporting

### 8.1 Efficiency Report Schema

```json
{
  "$schema": "https://basis.vorion.org/schemas/v1/efficiency-report.json",
  "report_id": "eff_rpt_xyz789",
  "agent_id": "agent_abc123",
  "period": {
    "start": "2026-01-10T00:00:00Z",
    "end": "2026-01-17T00:00:00Z"
  },
  "summary": {
    "total_operations": 1523,
    "total_cost_ncu": 4521.5,
    "total_value_score": 89450,
    "average_ctv": 0.051,
    "efficiency_score": 87
  },
  "resource_utilization": {
    "cpu_avg_percent": 45,
    "memory_avg_percent": 62,
    "gpu_avg_percent": 71,
    "within_manifest_limits": true
  },
  "sustainability": {
    "total_energy_kwh": 12.5,
    "carbon_intensity_avg": 425,
    "total_emissions_gco2eq": 5312,
    "sci_score": 3.5,
    "carbon_aware_operations_percent": 68
  },
  "adaptive_events": {
    "alerts_issued": 3,
    "throttles_applied": 1,
    "degrades_applied": 0,
    "stops_triggered": 0
  },
  "recommendations": [
    "Consider disabling reasoning for data formatting tasks",
    "Batch API calls to improve efficiency",
    "Schedule non-urgent tasks during low-carbon periods"
  ]
}
```

---

*Copyright © 2026 Vorion Risk, LLC. This work is licensed under CC BY 4.0.*
