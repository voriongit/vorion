---
sidebar_position: 4
title: Trust Scoring
description: Trust computation and tier definitions
---

# Trust Scoring

## Score Range

Trust scores range from 0 to 1000.

## Components

| Component | Weight | Description |
|-----------|--------|-------------|
| Compliance | 25% | BASIS adherence |
| Performance | 20% | Runtime reliability |
| Reputation | 15% | Community signals |
| Stake | 15% | Economic commitment |
| History | 15% | Track record |
| Verification | 10% | Identity confirmation |

## Tiers

| Tier | Range | Unlocks |
|------|-------|---------|
| Unverified | 0-99 | Sandbox only |
| Provisional | 100-299 | Basic ops |
| Certified | 300-499 | Standard ops |
| Trusted | 500-699 | Extended ops |
| Verified | 700-899 | Privileged ops |
| Sovereign | 900-1000 | Full autonomy |

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

Inactive agents experience trust decay to prevent stale high-trust entities:

| Configuration | Default | Enterprise |
|---------------|---------|------------|
| Half-life | 7 days | 14 days |
| Minimum floor | 100 | Configurable |
| Maintenance pause | Supported | Supported |

**Maintenance Status:** Organizations may pause decay during planned downtime by setting maintenance mode.

## Initial State

All entities initialize at score 0 (Sandbox tier) unless explicitly promoted by authorized administrator.

## Requirements

**REQ-TRS-001**: Trust scores MUST be computed from defined components.

**REQ-TRS-002**: Trust checks MUST occur before capability grants.

**REQ-TRS-003**: Trust score changes >50 points MUST be anchored.

**REQ-TRS-004**: Trust decay MUST apply to inactive entities.

**REQ-TRS-005**: Signal impacts MUST be configurable per deployment.
