---
sidebar_position: 3
title: Certification
description: Get your agent certified
---

# Certification

## Overview

Certification validates that your agent implementation complies with BASIS and can be trusted by the ecosystem.

## Certification Levels

| Level | Requirements | Benefits |
|-------|--------------|----------|
| **Bronze** | Pass basic tests, minimal stake | Registry listing |
| **Silver** | Pass full tests, 30-day audit | Standard trust |
| **Gold** | Extended audit, 90-day history | Extended trust |
| **Platinum** | Full audit, 180-day history | Maximum trust |

## Process

### 1. Register

Create an account at [AgentAnchor](https://agentanchor.ai/register).

### 2. Submit Agent

Provide your agent manifest:

```yaml
agent:
  id: ag_your_agent
  name: "Your Agent"
  version: "1.0.0"
  basis_version: "1.2"
  
capabilities:
  declared:
    - data/read_user
    - communication/send_internal

governance:
  implementation: cognigate
  endpoint: https://your-api.com
```

### 3. Stake Tokens

Lock ANCR tokens based on certification level:

| Level | Stake Required |
|-------|----------------|
| Bronze | 1,000 ANCR |
| Silver | 5,000 ANCR |
| Gold | 25,000 ANCR |
| Platinum | 100,000 ANCR |

### 4. Automated Testing

AgentAnchor runs compliance tests against your implementation.

### 5. Review

For Silver+, human review validates results.

### 6. Certification Issued

You receive:
- Trust score
- Certification badge
- Registry listing
- Verification API access

## Maintain Certification

- Keep implementation updated
- Respond to incidents within SLA
- Renew annually

## Get Started

[Apply at AgentAnchor →](https://agentanchor.ai/register)
