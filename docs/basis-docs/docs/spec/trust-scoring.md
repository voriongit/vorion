---
sidebar_position: 4
title: Trust Scoring
description: Trust computation and tier definitions
---

# Trust Scoring

## Score Range

Trust scores range from 0 to 1000.

## Components

Trust scores are computed from four weighted signal components:

| Component | Weight | Description |
|-----------|--------|-------------|
| **Behavioral** | 40% | Task completion, error rates, operational reliability |
| **Compliance** | 25% | BASIS policy adherence, rule violations |
| **Identity** | 20% | Verification strength, authentication signals |
| **Context** | 15% | Environmental factors, operational context |

### Component Details

**Behavioral (40%)**: The largest weight reflects that actions speak louder than credentials. Tracks:
- Task completion rates
- Error frequency
- Response quality
- Tool usage patterns

**Compliance (25%)**: Measures adherence to BASIS policies:
- Policy check pass rates
- Violation history
- Audit outcomes

**Identity (20%)**: Strength of entity verification:
- Authentication method
- Credential validity
- Identity attestations

**Context (15%)**: Environmental and situational factors:
- Operating context appropriateness
- Resource usage patterns
- Interaction patterns

## Trust Tiers (L0-L5)

Six tiers provide graduated autonomy levels:

| Level | Name | Score Range | Description | Capabilities |
|-------|------|-------------|-------------|--------------|
| **L0** | Sandbox | 0-99 | Restricted testing | Read-only, no external access |
| **L1** | Provisional | 100-299 | New or recovering | Basic operations, monitored |
| **L2** | Standard | 300-499 | Normal operations | Standard tools, logging required |
| **L3** | Trusted | 500-699 | Elevated privileges | Extended tools, reduced oversight |
| **L4** | Certified | 700-899 | Verified and audited | Privileged operations |
| **L5** | Autonomous | 900-1000 | Maximum autonomy | Full capabilities, self-governance |

### Tier Transitions

**Promotion** occurs when score crosses upward into a new tier:
- Requires sustained positive signals
- May require additional verification at higher tiers
- Emits `trust:tier_changed` event with `direction: 'promoted'`

**Demotion** occurs when score drops below tier minimum:
- Immediate capability revocation
- Requires recovery to regain privileges
- Emits `trust:tier_changed` event with `direction: 'demoted'`

## Signal Impacts

Trust scores change based on behavioral signals:

| Signal Type | Impact | Notes |
|-------------|--------|-------|
| task_completed | +5 | Standard positive signal |
| task_failed | -15 | 3x amplification for failures |
| policy_violation | -50 | Serious compliance breach |
| compliance_check_passed | +2 | Periodic verification |
| human_endorsement | +25 | Explicit trust delegation |

## Trust Decay

Inactive agents experience trust decay to prevent stale high-trust entities. The decay model uses exponential decay with configurable parameters.

### Decay Formula

```
decayed_score = current_score × (1 - decay_rate)^periods
```

Where:
- `decay_rate`: Percentage decay per interval (default: 1%)
- `periods`: Number of decay intervals elapsed

### Default Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `decayRate` | 0.01 (1%) | Decay per interval |
| `decayIntervalMs` | 60000 (1 min) | Interval between decay checks |
| Signal half-life | 7 days | Weight decay for old signals |

### Accelerated Decay

When an entity accumulates failures, decay accelerates:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `failureThreshold` | 0.3 | Signals below this are failures |
| `acceleratedDecayMultiplier` | 3.0 | Multiplier when accelerated |
| `failureWindowMs` | 3600000 (1 hr) | Window for counting failures |
| `minFailuresForAcceleration` | 2 | Failures needed to trigger |

**Example**: With 2+ failures in the past hour, decay rate becomes 3% per interval instead of 1%.

### Recovery

Entities can recover trust through positive signals:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `successThreshold` | 0.7 | Signals above this trigger recovery |
| `recoveryRate` | 0.02 (2%) | Base recovery per success |
| `acceleratedRecoveryMultiplier` | 1.5 | Multiplier after consecutive successes |
| `minSuccessesForAcceleration` | 3 | Successes needed for acceleration |
| `maxRecoveryPerSignal` | 50 | Maximum points per recovery signal |

**Activity Reset:** Any signal (positive or negative) resets the decay timer.

### Configuration Example

```typescript
import { createTrustEngine } from '@vorionsys/atsf-core/trust-engine';

const engine = createTrustEngine({
  decayRate: 0.005,           // 0.5% per interval (slower decay)
  decayIntervalMs: 300000,    // 5 minutes
  failureThreshold: 0.25,     // Stricter failure detection
  acceleratedDecayMultiplier: 2.0, // Less aggressive acceleration
  recoveryRate: 0.03,         // Faster recovery
});
```

## Initial State

All entities initialize at score 0 (Sandbox tier) unless explicitly promoted by authorized administrator.

## Requirements

**REQ-TRS-001**: Trust scores MUST be computed from defined components.

**REQ-TRS-002**: Trust checks MUST occur before capability grants.

**REQ-TRS-003**: Trust score changes >50 points MUST be anchored.

**REQ-TRS-004**: Trust decay MUST apply to inactive entities.

**REQ-TRS-005**: Signal impacts MUST be configurable per deployment.
