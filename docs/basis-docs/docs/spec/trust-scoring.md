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

## Requirements

**REQ-TRS-001**: Trust scores MUST be computed from defined components.

**REQ-TRS-002**: Trust checks MUST occur before capability grants.

**REQ-TRS-003**: Trust score changes >50 points MUST be anchored.
