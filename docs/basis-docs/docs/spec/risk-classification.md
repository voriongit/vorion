---
sidebar_position: 3
title: Risk Classification
description: Risk levels and governance requirements
---

# Risk Classification

## Risk Levels

| Level | Description | Examples |
|-------|-------------|----------|
| **MINIMAL** | No external effects | Read-only, computations |
| **LIMITED** | Scoped, reversible | User data ops, internal comms |
| **SIGNIFICANT** | External impact | External comms, sensitive data |
| **HIGH** | Major impact, irreversible | Financial, permissions, bulk ops |

## Governance Requirements

| Risk | Trust Required | Approval | Audit |
|------|----------------|----------|-------|
| Minimal | 100+ | Automatic | Log |
| Limited | 300+ | Automatic | Log |
| Significant | 500+ | Conditional | Log + Alert |
| High | 700+ | Human | Log + Anchor |

## Risk Assessment Factors

- Reversibility of the action
- Scope of impact (users affected)
- Sensitivity of data involved
- Financial implications
- Regulatory implications

**REQ-RSK-001**: Every action MUST be classified by risk level.

**REQ-RSK-002**: When factors conflict, higher risk level MUST apply.
