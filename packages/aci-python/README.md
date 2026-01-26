# Vorion ACI Python SDK

Python client for the Vorion ACI (Agent Classification Identifier) Trust Engine.

## Installation

```bash
pip install vorion-aci
```

## Quick Start

```python
import asyncio
from vorion_aci import ACIClient, RoleGateRequest, TrustTier, AgentRole

async def main():
    async with ACIClient("https://api.vorion.dev", api_key="your-api-key") as client:
        # Get dashboard stats
        stats = await client.get_stats()
        print(f"Total agents: {stats.context_stats.agents}")

        # Evaluate role gate
        result = await client.evaluate_role_gate(RoleGateRequest(
            agent_id="agent-123",
            requested_role=AgentRole.R_L4,
            current_tier=TrustTier.T3,
            current_score=650,
        ))
        print(f"Decision: {result.decision}")

asyncio.run(main())
```

## Features

- **Type-safe**: Full type hints with Pydantic models
- **Async-first**: Built on httpx for async/await support
- **Comprehensive**: Covers all Phase 6 Trust Engine endpoints
- **Utilities**: Helper functions for tier calculations and role validation

## API Reference

### Client

```python
from vorion_aci import ACIClient

# Create client
client = ACIClient(
    base_url="https://api.vorion.dev",
    api_key="your-api-key",  # Optional
    timeout=30.0,  # Request timeout in seconds
)

# Use as context manager (recommended)
async with ACIClient(...) as client:
    stats = await client.get_stats()
```

### Role Gates

```python
from vorion_aci import RoleGateRequest, AgentRole, TrustTier

result = await client.evaluate_role_gate(RoleGateRequest(
    agent_id="agent-123",
    requested_role=AgentRole.R_L4,
    current_tier=TrustTier.T3,
    current_score=650,
))

print(result.decision)  # ALLOW, DENY, or ESCALATE
print(result.reason)
print(result.kernel_allowed)
```

### Ceiling Checks

```python
from vorion_aci import CeilingCheckRequest

result = await client.check_ceiling(CeilingCheckRequest(
    agent_id="agent-123",
    current_score=750,
))

print(result.effective_score)  # Score after ceiling applied
print(result.ceiling_source)  # e.g., "EU_AI_ACT"
print(result.compliance_status)  # COMPLIANT, WARNING, VIOLATION
```

### Provenance

```python
from vorion_aci import ProvenanceCreateRequest, CreationType

# Create provenance record
result = await client.create_provenance(ProvenanceCreateRequest(
    agent_id="agent-new",
    creation_type=CreationType.EVOLVED,
    parent_agent_id="agent-parent",
))

print(result["record"].score_modifier)  # +100 for EVOLVED

# Get provenance history
records = await client.get_provenance("agent-123")
```

### Alerts

```python
from vorion_aci import AlertStatus

# Get active alerts
alerts = await client.get_alerts(status=AlertStatus.ACTIVE)

for alert in alerts:
    print(f"{alert.severity}: {alert.alert_type}")

# Update alert status
await client.update_alert_status(
    alert_id="alert-123",
    status=AlertStatus.RESOLVED,
    resolved_by="admin@example.com",
    resolution_notes="False positive",
)
```

## Utility Functions

```python
from vorion_aci import (
    get_tier_from_score,
    is_role_allowed_for_tier,
    apply_provenance_modifier,
    TrustTier,
    AgentRole,
    CreationType,
)

# Get tier from score
tier = get_tier_from_score(750)  # TrustTier.T4

# Check role eligibility
allowed = is_role_allowed_for_tier(AgentRole.R_L5, TrustTier.T4)  # True

# Apply provenance modifier
new_score = apply_provenance_modifier(500, CreationType.PROMOTED)  # 650
```

## Trust Tiers

| Tier | Label | Score Range |
|------|-------|-------------|
| T0 | Sandbox | 0-99 |
| T1 | Probation | 100-299 |
| T2 | Limited | 300-499 |
| T3 | Standard | 500-699 |
| T4 | Trusted | 700-899 |
| T5 | Sovereign | 900-1000 |

## Agent Roles

| Role | Label | Min Tier |
|------|-------|----------|
| R_L0 | Listener | T0 |
| R_L1 | Responder | T0 |
| R_L2 | Task Executor | T1 |
| R_L3 | Workflow Manager | T2 |
| R_L4 | Domain Expert | T3 |
| R_L5 | Resource Controller | T4 |
| R_L6 | System Administrator | T5 |
| R_L7 | Trust Governor | T5 |
| R_L8 | Ecosystem Controller | T5 |

## License

MIT
