# Risk, Trust & Autonomy Model

**Vorion / BASIS / Cognigate — Expanded Trust & Autonomy Specification**

**Version:** 1.1 (Expanded)
**Date:** 2026-01-08
**Classification:** Vorion Confidential

---

## 1. Executive Summary

Vorion implements an adaptive trust model where autonomy dynamically expands or contracts based on behavioral signals, policy conformance, and risk assessment. The system includes anti-gaming protections to prevent trust manipulation. All trust decisions are recorded in PROOF for audit and replay.

---

## 2. Trust Architecture Overview

### 2.1 Trust System Components

```mermaid
flowchart TB
    subgraph Signals["Trust Signal Sources"]
        BEHAVIOR["Behavioral History"]
        COMPLIANCE["Policy Conformance"]
        CONTEXT["Contextual Factors"]
        IDENTITY["Identity Strength"]
        TIME["Temporal Patterns"]
    end

    subgraph Engine["Trust Engine"]
        COLLECT["Signal Collector"]
        WEIGHT["Weight Calculator"]
        SCORE["Score Aggregator"]
        DECAY["Decay Function"]
        ANTIGAME["Anti-Gaming Filter"]
    end

    subgraph Output["Trust Output"]
        TRUST_SCORE["Trust Score<br/>(0-1000)"]
        TRUST_TIER["Trust Tier"]
        AUTONOMY["Autonomy Level"]
        CONSTRAINTS["Applied Constraints"]
    end

    subgraph Enforcement["Enforcement"]
        BASIS_TRUST["BASIS Trust Rules"]
        ENFORCE_GATE["ENFORCE Gate"]
    end

    BEHAVIOR --> COLLECT
    COMPLIANCE --> COLLECT
    CONTEXT --> COLLECT
    IDENTITY --> COLLECT
    TIME --> COLLECT

    COLLECT --> WEIGHT
    WEIGHT --> ANTIGAME
    ANTIGAME --> SCORE
    SCORE --> DECAY

    DECAY --> TRUST_SCORE
    TRUST_SCORE --> TRUST_TIER
    TRUST_TIER --> AUTONOMY
    AUTONOMY --> CONSTRAINTS

    CONSTRAINTS --> BASIS_TRUST
    BASIS_TRUST --> ENFORCE_GATE
```

### 2.2 Trust Tier Definitions

| Tier | Score Range | Autonomy Level | Approval Required | Rate Limits |
|------|-------------|----------------|-------------------|-------------|
| **UNTRUSTED** | 0-199 | None | All actions | 10/hour |
| **PROBATION** | 200-399 | Minimal | Most actions | 50/hour |
| **STANDARD** | 400-599 | Normal | Elevated actions | 200/hour |
| **TRUSTED** | 600-799 | Extended | Critical only | 500/hour |
| **PRIVILEGED** | 800-1000 | Maximum | Emergency only | 1000/hour |

---

## 3. Trust Signal Collection

### 3.1 Signal Categories

```mermaid
flowchart LR
    subgraph Behavioral["Behavioral Signals (40%)"]
        B1["Action Success Rate"]
        B2["Error Frequency"]
        B3["Policy Violations"]
        B4["Anomaly Events"]
    end

    subgraph Compliance["Compliance Signals (25%)"]
        C1["Rule Adherence"]
        C2["Audit Findings"]
        C3["Training Completion"]
        C4["Certification Status"]
    end

    subgraph Identity["Identity Signals (20%)"]
        I1["Authentication Strength"]
        I2["Account Age"]
        I3["Verification Level"]
        I4["Organization Trust"]
    end

    subgraph Context["Contextual Signals (15%)"]
        X1["Request Origin"]
        X2["Time of Access"]
        X3["Resource Sensitivity"]
        X4["Concurrent Sessions"]
    end

    B1 --> SCORE["Trust Score"]
    B2 --> SCORE
    B3 --> SCORE
    B4 --> SCORE
    C1 --> SCORE
    C2 --> SCORE
    C3 --> SCORE
    C4 --> SCORE
    I1 --> SCORE
    I2 --> SCORE
    I3 --> SCORE
    I4 --> SCORE
    X1 --> SCORE
    X2 --> SCORE
    X3 --> SCORE
    X4 --> SCORE
```

### 3.2 Signal Weight Configuration

```yaml
trust_signals:
  behavioral:
    weight: 0.40
    signals:
      action_success_rate:
        weight: 0.30
        lookback_days: 30
        minimum_actions: 10

      error_frequency:
        weight: 0.25
        lookback_days: 7
        threshold_per_day: 5

      policy_violations:
        weight: 0.30
        lookback_days: 90
        severity_multiplier:
          critical: 10
          high: 5
          medium: 2
          low: 1

      anomaly_events:
        weight: 0.15
        lookback_days: 14
        types: [unusual_location, unusual_time, unusual_volume]

  compliance:
    weight: 0.25
    signals:
      rule_adherence:
        weight: 0.40
        measurement: percentage_compliant_actions

      audit_findings:
        weight: 0.30
        lookback_months: 12
        finding_impact:
          critical: -100
          major: -50
          minor: -10

      training_completion:
        weight: 0.15
        required_courses: [security_basics, data_handling, policy_overview]

      certification_status:
        weight: 0.15
        valid_certs: [soc2_trained, gdpr_certified]

  identity:
    weight: 0.20
    signals:
      authentication_strength:
        weight: 0.35
        factors:
          password_only: 0.3
          mfa_sms: 0.6
          mfa_totp: 0.8
          mfa_hardware: 1.0

      account_age:
        weight: 0.25
        curve: logarithmic
        max_days: 365

      verification_level:
        weight: 0.25
        levels:
          email_only: 0.3
          phone_verified: 0.6
          id_verified: 0.9
          in_person: 1.0

      organization_trust:
        weight: 0.15
        inherit_percentage: 0.5

  contextual:
    weight: 0.15
    signals:
      request_origin:
        weight: 0.30
        known_ip_bonus: 0.2
        vpn_penalty: -0.1
        tor_penalty: -0.3

      time_of_access:
        weight: 0.25
        business_hours_bonus: 0.1
        off_hours_penalty: -0.05

      resource_sensitivity:
        weight: 0.25
        adjustment: inverse_to_sensitivity

      concurrent_sessions:
        weight: 0.20
        max_normal: 3
        penalty_per_excess: -0.1
```

---

## 4. Trust Score Calculation

### 4.1 Calculation Flow

```mermaid
flowchart TB
    subgraph Collection["Signal Collection"]
        RAW["Raw Signals"]
        NORMALIZE["Normalize (0-1)"]
    end

    subgraph Weighting["Weight Application"]
        CATEGORY["Category Weights"]
        SIGNAL["Signal Weights"]
        MULTIPLY["Weighted Sum"]
    end

    subgraph Adjustment["Adjustments"]
        DECAY["Time Decay"]
        BONUS["Bonus Events"]
        PENALTY["Penalty Events"]
        FLOOR["Floor/Ceiling"]
    end

    subgraph AntiGaming["Anti-Gaming"]
        VELOCITY["Velocity Check"]
        PATTERN["Pattern Detection"]
        ANOMALY["Anomaly Filter"]
    end

    subgraph Output["Final Score"]
        SCORE["Trust Score"]
        TIER["Map to Tier"]
        STORE["Store in Profile"]
    end

    RAW --> NORMALIZE
    NORMALIZE --> CATEGORY
    CATEGORY --> SIGNAL
    SIGNAL --> MULTIPLY

    MULTIPLY --> DECAY
    DECAY --> BONUS
    BONUS --> PENALTY
    PENALTY --> FLOOR

    FLOOR --> VELOCITY
    VELOCITY --> PATTERN
    PATTERN --> ANOMALY

    ANOMALY --> SCORE
    SCORE --> TIER
    TIER --> STORE
```

### 4.2 Score Calculation Formula

```
Base Score = Σ(Category_Weight × Σ(Signal_Weight × Normalized_Signal_Value))

Decay Factor = e^(-λ × days_since_last_positive_action)
  where λ = 0.01 (slow decay)

Adjusted Score = (Base Score × Decay Factor) + Bonuses - Penalties

Final Score = max(0, min(1000, Adjusted Score))
```

### 4.3 Trust Score Lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant ACTION as User Action
    participant COLLECT as Signal Collector
    participant CALC as Score Calculator
    participant ANTIGAME as Anti-Gaming
    participant PROFILE as Trust Profile
    participant PROOF

    ACTION->>COLLECT: Action Completed
    COLLECT->>COLLECT: Extract Signals
    COLLECT->>CALC: Signal Bundle

    CALC->>CALC: Apply Weights
    CALC->>CALC: Calculate Base Score
    CALC->>CALC: Apply Decay
    CALC->>CALC: Apply Adjustments

    CALC->>ANTIGAME: Proposed Score Change

    alt Change Looks Normal
        ANTIGAME-->>CALC: Approved
        CALC->>PROFILE: Update Trust Score
        PROFILE->>PROOF: Record Score Change
    else Suspicious Pattern
        ANTIGAME-->>CALC: Flagged
        ANTIGAME->>ANTIGAME: Apply Dampening
        CALC->>PROFILE: Dampened Update
        PROFILE->>PROOF: Record with Flag
    end
```

---

## 5. Autonomy Control

### 5.1 Autonomy Levels

```mermaid
flowchart TB
    subgraph Levels["Autonomy Levels"]
        L0["LEVEL 0: No Autonomy<br/>All actions require approval"]
        L1["LEVEL 1: Minimal<br/>Read-only without approval"]
        L2["LEVEL 2: Standard<br/>Normal operations allowed"]
        L3["LEVEL 3: Extended<br/>Batch operations allowed"]
        L4["LEVEL 4: Maximum<br/>Admin operations allowed"]
    end

    subgraph Mapping["Tier to Autonomy Mapping"]
        UNTRUSTED --> L0
        PROBATION --> L1
        STANDARD --> L2
        TRUSTED --> L3
        PRIVILEGED --> L4
    end

    subgraph Operations["Allowed Operations"]
        O0["None without approval"]
        O1["Read public data<br/>View own profile"]
        O2["Read/Write own data<br/>Standard API calls"]
        O3["Bulk operations<br/>Report generation"]
        O4["Configuration changes<br/>User management"]
    end

    L0 --- O0
    L1 --- O1
    L2 --- O2
    L3 --- O3
    L4 --- O4
```

### 5.2 Dynamic Autonomy Adjustment

```mermaid
stateDiagram-v2
    [*] --> STANDARD: New Account (Default)

    STANDARD --> TRUSTED: Consistent Good Behavior
    STANDARD --> PROBATION: Policy Violation

    TRUSTED --> PRIVILEGED: Extended Good Behavior
    TRUSTED --> STANDARD: Minor Issues
    TRUSTED --> PROBATION: Serious Violation

    PRIVILEGED --> TRUSTED: Risk Event
    PRIVILEGED --> STANDARD: Multiple Issues
    PRIVILEGED --> UNTRUSTED: Critical Violation

    PROBATION --> STANDARD: Remediation Complete
    PROBATION --> UNTRUSTED: Continued Issues

    UNTRUSTED --> PROBATION: Manual Review + Approval
    UNTRUSTED --> [*]: Account Suspension

    note right of PRIVILEGED: Requires 6+ months at TRUSTED
    note right of PROBATION: 30-day remediation period
    note left of UNTRUSTED: Human review required to exit
```

### 5.3 Autonomy Decision Matrix

| Operation Type | UNTRUSTED | PROBATION | STANDARD | TRUSTED | PRIVILEGED |
|----------------|-----------|-----------|----------|---------|------------|
| **Read Public** | Approve | Auto | Auto | Auto | Auto |
| **Read Own Data** | Approve | Auto | Auto | Auto | Auto |
| **Write Own Data** | Deny | Approve | Auto | Auto | Auto |
| **Read Others' Data** | Deny | Deny | Approve | Auto | Auto |
| **Bulk Read** | Deny | Deny | Approve | Auto | Auto |
| **Bulk Write** | Deny | Deny | Deny | Approve | Auto |
| **Config Change** | Deny | Deny | Deny | Approve | Auto |
| **User Management** | Deny | Deny | Deny | Deny | Approve |
| **System Admin** | Deny | Deny | Deny | Deny | Approve |

---

## 6. Anti-Gaming Protections

### 6.1 Gaming Attack Vectors

```mermaid
flowchart TB
    subgraph Attacks["Gaming Attack Types"]
        A1["Trust Farming<br/>Artificial positive actions"]
        A2["Score Inflation<br/>Rapid legitimate actions"]
        A3["Sybil Attack<br/>Multiple fake accounts"]
        A4["Reputation Laundering<br/>Transfer trust between accounts"]
        A5["Time Gaming<br/>Exploit decay functions"]
    end

    subgraph Defenses["Defense Mechanisms"]
        D1["Velocity Limits"]
        D2["Diminishing Returns"]
        D3["Account Correlation"]
        D4["Trust Non-Transferability"]
        D5["Irregular Decay"]
    end

    A1 --> D1
    A2 --> D2
    A3 --> D3
    A4 --> D4
    A5 --> D5
```

### 6.2 Anti-Gaming Rules

```yaml
anti_gaming_rules:
  velocity_limits:
    description: "Limit how fast trust can increase"
    max_daily_increase: 20
    max_weekly_increase: 50
    max_monthly_increase: 100
    cooldown_after_max: 24_hours

  diminishing_returns:
    description: "Reduce value of repeated similar actions"
    same_action_decay: 0.9  # Each repeat worth 90% of previous
    same_category_decay: 0.95
    reset_period_hours: 24

  anomaly_detection:
    description: "Detect unusual trust-building patterns"
    patterns:
      - sudden_activity_spike:
          threshold: 5x_normal
          action: flag_and_dampen

      - perfect_compliance:
          threshold: 100%_over_extended_period
          action: flag_for_review

      - coordinated_accounts:
          similarity_threshold: 0.8
          action: link_and_investigate

  score_dampening:
    description: "Apply friction to suspicious increases"
    flagged_account_multiplier: 0.5
    investigation_freeze: true
    appeal_process: manual_review

  non_transferability:
    description: "Prevent trust transfer between entities"
    account_merge_policy: lowest_score
    organization_change_policy: reset_to_standard
    delegation_inherits_trust: false
```

### 6.3 Gaming Detection Flow

```mermaid
flowchart TB
    subgraph Input["Score Change Request"]
        CHANGE["Proposed Change"]
        HISTORY["Account History"]
        PATTERN["Behavior Pattern"]
    end

    subgraph Detection["Detection Checks"]
        VELOCITY["Velocity Check"]
        SIMILAR["Similar Action Check"]
        ANOMALY["Anomaly Check"]
        CORRELATION["Account Correlation"]
    end

    subgraph Decision["Decision"]
        ALLOW["Allow Full Change"]
        DAMPEN["Dampen Change"]
        BLOCK["Block Change"]
        FLAG["Flag for Review"]
    end

    subgraph Response["Response Actions"]
        APPLY["Apply to Profile"]
        ALERT["Alert Security Team"]
        FREEZE["Freeze Account"]
    end

    CHANGE --> VELOCITY
    HISTORY --> VELOCITY
    PATTERN --> VELOCITY

    VELOCITY -->|"Pass"| SIMILAR
    VELOCITY -->|"Fail"| DAMPEN

    SIMILAR -->|"Pass"| ANOMALY
    SIMILAR -->|"Fail"| DAMPEN

    ANOMALY -->|"Pass"| CORRELATION
    ANOMALY -->|"Fail"| FLAG

    CORRELATION -->|"Pass"| ALLOW
    CORRELATION -->|"Fail"| BLOCK

    ALLOW --> APPLY
    DAMPEN --> APPLY
    FLAG --> ALERT
    BLOCK --> FREEZE
```

---

## 7. Risk Assessment Integration

### 7.1 Risk-Trust Matrix

```mermaid
quadrantChart
    title Risk vs Trust Decision Space
    x-axis Low Trust --> High Trust
    y-axis Low Risk --> High Risk
    quadrant-1 "ESCALATE<br/>Human Review Required"
    quadrant-2 "DENY<br/>Insufficient Trust"
    quadrant-3 "CONDITIONAL<br/>Extra Verification"
    quadrant-4 "PERMIT<br/>Auto-Approve"

    "Delete All Data": [0.15, 0.95]
    "Admin Config": [0.25, 0.85]
    "Bulk Export": [0.45, 0.70]
    "Write Sensitive": [0.55, 0.55]
    "Read Internal": [0.70, 0.35]
    "Read Public": [0.85, 0.15]
    "View Dashboard": [0.90, 0.10]
```

### 7.2 Risk Scoring Factors

| Factor | Weight | Low (0.0-0.3) | Medium (0.3-0.7) | High (0.7-1.0) |
|--------|--------|---------------|------------------|----------------|
| **Data Sensitivity** | 30% | Public data | Internal data | PII/Financial |
| **Operation Impact** | 25% | Read-only | Reversible write | Irreversible |
| **Blast Radius** | 20% | Single record | Multiple records | System-wide |
| **Regulatory Exposure** | 15% | None | Audit required | Compliance critical |
| **Historical Incidents** | 10% | None | Minor | Major |

### 7.3 Combined Risk-Trust Decision

```mermaid
flowchart TB
    subgraph Inputs["Decision Inputs"]
        TRUST["Trust Score"]
        RISK["Risk Score"]
        CONTEXT["Context"]
    end

    subgraph Calculation["Decision Calculation"]
        MATRIX["Risk-Trust Matrix Lookup"]
        ADJUST["Context Adjustment"]
        THRESHOLD["Threshold Check"]
    end

    subgraph Outcomes["Decision Outcomes"]
        PERMIT["PERMIT<br/>No constraints"]
        CONDITIONAL["PERMIT<br/>With constraints"]
        ESCALATE["ESCALATE<br/>Human approval"]
        DENY["DENY<br/>Blocked"]
    end

    TRUST --> MATRIX
    RISK --> MATRIX
    MATRIX --> ADJUST
    CONTEXT --> ADJUST
    ADJUST --> THRESHOLD

    THRESHOLD -->|"Trust > Risk + Margin"| PERMIT
    THRESHOLD -->|"Trust ≈ Risk"| CONDITIONAL
    THRESHOLD -->|"Risk > Trust (Moderate)"| ESCALATE
    THRESHOLD -->|"Risk >> Trust"| DENY
```

---

## 8. Trust Events & Triggers

### 8.1 Positive Trust Events

| Event | Score Impact | Cooldown | Max Daily |
|-------|--------------|----------|-----------|
| **Successful Operation** | +1 | None | 50 |
| **Security Training Completed** | +25 | 90 days | 1 |
| **MFA Enabled** | +50 | Once | 1 |
| **Clean Audit Period (30 days)** | +10 | 30 days | 1 |
| **Verified Identity Upgrade** | +30 | Once per level | 1 |
| **Reported Security Issue** | +20 | 7 days | 3 |

### 8.2 Negative Trust Events

| Event | Score Impact | Recovery | Escalation |
|-------|--------------|----------|------------|
| **Failed Authentication** | -5 | 24 hours | After 5x |
| **Policy Violation (Minor)** | -20 | 7 days | After 3x |
| **Policy Violation (Major)** | -100 | 30 days | Immediate |
| **Anomaly Detected** | -30 | Investigation | Review |
| **Rate Limit Exceeded** | -10 | 1 hour | After 10x |
| **Unauthorized Access Attempt** | -50 | 14 days | Immediate |
| **Data Breach Involvement** | -200 | Manual review | Immediate |

### 8.3 Trust Event Flow

```mermaid
sequenceDiagram
    autonumber
    participant EVENT as Trust Event
    participant ENGINE as Trust Engine
    participant ANTIGAME as Anti-Gaming
    participant PROFILE as Trust Profile
    participant NOTIFY as Notification
    participant PROOF

    EVENT->>ENGINE: Event Occurred
    ENGINE->>ENGINE: Classify Event Type
    ENGINE->>ENGINE: Calculate Impact

    ENGINE->>ANTIGAME: Verify Legitimacy

    alt Legitimate Event
        ANTIGAME-->>ENGINE: Approved
        ENGINE->>PROFILE: Apply Score Change

        alt Tier Change
            PROFILE->>NOTIFY: Alert User
            PROFILE->>NOTIFY: Alert Admin (if downgrade)
        end

        PROFILE->>PROOF: Record Trust Event
    else Suspicious Event
        ANTIGAME-->>ENGINE: Blocked/Dampened
        ANTIGAME->>NOTIFY: Alert Security
        ANTIGAME->>PROOF: Record Blocked Event
    end
```

---

## 9. Human Override & Appeals

### 9.1 Override Authority Levels

```mermaid
flowchart TB
    subgraph Levels["Override Authority"]
        L1["L1: Team Lead<br/>+/- 50 points"]
        L2["L2: Manager<br/>+/- 150 points"]
        L3["L3: Security Admin<br/>+/- 300 points"]
        L4["L4: Executive<br/>Unlimited"]
    end

    subgraph Actions["Override Actions"]
        BOOST["Trust Boost"]
        REDUCE["Trust Reduction"]
        FREEZE["Account Freeze"]
        RESTORE["Trust Restore"]
        RESET["Full Reset"]
    end

    subgraph Requirements["Requirements"]
        JUSTIFY["Justification Required"]
        APPROVE["Approval Chain"]
        AUDIT["Audit Trail"]
        EXPIRE["Expiration"]
    end

    L1 --> BOOST
    L1 --> REDUCE
    L2 --> FREEZE
    L2 --> RESTORE
    L3 --> RESET
    L4 --> RESET

    BOOST --> JUSTIFY
    REDUCE --> JUSTIFY
    FREEZE --> APPROVE
    RESTORE --> APPROVE
    RESET --> AUDIT

    JUSTIFY --> EXPIRE
    APPROVE --> EXPIRE
    AUDIT --> EXPIRE
```

### 9.2 Appeal Process

```mermaid
stateDiagram-v2
    [*] --> SUBMITTED: User Files Appeal

    SUBMITTED --> SCREENING: Initial Review
    SCREENING --> REJECTED: Insufficient Basis
    SCREENING --> INVESTIGATION: Valid Concerns

    INVESTIGATION --> EVIDENCE_REVIEW: Gather Evidence
    EVIDENCE_REVIEW --> DECISION: Review Complete

    DECISION --> UPHELD: Original Decision Stands
    DECISION --> PARTIAL: Partial Adjustment
    DECISION --> OVERTURNED: Full Reversal

    REJECTED --> CLOSED: Appeal Closed
    UPHELD --> CLOSED: Appeal Closed
    PARTIAL --> ADJUSTED: Score Adjusted
    OVERTURNED --> RESTORED: Score Restored

    ADJUSTED --> CLOSED: Process Complete
    RESTORED --> CLOSED: Process Complete

    CLOSED --> [*]: Record in PROOF
```

---

## 10. Monitoring & Reporting

### 10.1 Trust Metrics Dashboard

```yaml
trust_metrics:
  population_health:
    - metric: "Trust Distribution"
      breakdown: by_tier
      alert_if: untrusted > 5%

    - metric: "Average Trust Score"
      target: "> 500"
      trend: weekly

    - metric: "Trust Volatility"
      measurement: std_deviation
      alert_if: "> 100"

  movement_metrics:
    - metric: "Daily Upgrades"
      count: tier_increases
      benchmark: historical_average

    - metric: "Daily Downgrades"
      count: tier_decreases
      alert_if: "> 2x normal"

    - metric: "Autonomy Utilization"
      measurement: auto_approved_percentage

  security_metrics:
    - metric: "Gaming Attempts Blocked"
      count: anti_gaming_triggers
      trend: daily

    - metric: "Appeals Filed"
      count: active_appeals
      sla: "< 5 days resolution"

    - metric: "Override Usage"
      count: manual_overrides
      audit: monthly_review
```

---

## 11. Appendix

### 11.1 Trust Score Examples

| Scenario | Starting Score | Event | Ending Score | Tier |
|----------|---------------|-------|--------------|------|
| New user | 400 | Account created | 400 | STANDARD |
| MFA enabled | 400 | +50 bonus | 450 | STANDARD |
| 30 days clean | 450 | +10 bonus | 460 | STANDARD |
| Minor violation | 460 | -20 penalty | 440 | STANDARD |
| Major violation | 440 | -100 penalty | 340 | PROBATION |
| Remediation | 340 | +60 over 30 days | 400 | STANDARD |

### 11.2 Related Documents

- 01_System_Governance_and_Authority_Model.pdf
- 02_Security_Architecture_and_Threat_Model.pdf
- 07_Incident_Response_and_Resilience.pdf
- 08_Technical_Architecture_and_Flow.pdf

---

*Vorion Confidential — 2026-01-08 — Expanded Trust & Autonomy Specification*
