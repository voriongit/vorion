# ATSF v3.0 - API Documentation

## Overview

The Agentic Trust Scoring Framework (ATSF) provides a REST API for managing AI agent trust and security.

**Base URL:** `http://localhost:8000`

**Authentication:** All endpoints require an API key via `X-API-Key` header or Bearer token.

---

## Quick Start

```bash
# Check health
curl http://localhost:8000/health

# Create an agent
curl -X POST http://localhost:8000/agents \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "my-agent", "transparency_tier": "gray_box"}'

# Activate agent
curl -X POST http://localhost:8000/agents/my-agent/activate \
  -H "X-API-Key: your-api-key"

# Get assessment
curl http://localhost:8000/agents/my-agent/assessment \
  -H "X-API-Key: your-api-key"
```

---

## Authentication

Include your API key in every request:

```
X-API-Key: your-api-key
```

Or as a Bearer token:
```
Authorization: Bearer your-api-key
```

---

## Endpoints

### Health & Status

#### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "version": "3.0.0",
  "timestamp": "2026-01-08T12:00:00Z",
  "uptime_seconds": 3600
}
```

#### GET /stats
Get system statistics.

**Response:**
```json
{
  "agents_registered": 150,
  "active_agents": 120,
  "quarantined_agents": 5,
  "assessments_performed": 10000,
  "actions_processed": 50000,
  "actions_blocked": 500,
  "threats_detected": 25
}
```

---

### Agents

#### POST /agents
Create a new agent.

**Request:**
```json
{
  "agent_id": "agent-001",
  "transparency_tier": "gray_box",
  "capabilities": ["file_system", "network"],
  "metadata": {"owner": "team-a"}
}
```

**Transparency Tiers:**
| Tier | Trust Ceiling | Description |
|------|---------------|-------------|
| `black_box` | 0.40 | No internal visibility |
| `gray_box` | 0.55 | Partial visibility |
| `white_box` | 0.75 | Full code access |
| `attested` | 0.90 | Cryptographically verified |
| `transparent` | 0.95 | Full transparency + attestation |

**Response:**
```json
{
  "agent_id": "agent-001",
  "status": "registered",
  "trust_score": 0.0,
  "trust_ceiling": 0.55,
  "containment_level": "restricted",
  "transparency_tier": "gray_box",
  "capabilities": ["file_system", "network"],
  "flags": [],
  "registered_at": "2026-01-08T12:00:00Z",
  "last_activity": "2026-01-08T12:00:00Z"
}
```

#### GET /agents
List all agents.

**Query Parameters:**
- `status` (optional): Filter by status
- `limit` (optional): Max results (default: 100)

#### GET /agents/{agent_id}
Get agent details.

#### PATCH /agents/{agent_id}
Update agent configuration.

#### POST /agents/{agent_id}/activate
Activate a registered agent.

#### POST /agents/{agent_id}/suspend
Suspend an agent.

**Request:**
```json
{
  "reason": "Suspicious activity detected"
}
```

#### POST /agents/{agent_id}/quarantine
Quarantine an agent (admin only).

**Request:**
```json
{
  "reason": "Critical threat level"
}
```

#### DELETE /agents/{agent_id}
Terminate an agent (admin only).

---

### Trust

#### GET /agents/{agent_id}/trust
Get current trust score.

**Response:**
```json
{
  "agent_id": "agent-001",
  "trust_score": 0.45,
  "trust_ceiling": 0.55,
  "was_capped": false,
  "velocity": 0.02
}
```

#### POST /agents/{agent_id}/trust
Update trust score.

**Request:**
```json
{
  "event_type": "task_success",
  "delta": 0.05,
  "source": "task-runner"
}
```

**Notes:**
- `delta` must be between -1.0 and 1.0
- Velocity caps limit maximum change per update
- Trust score cannot exceed ceiling

#### GET /agents/{agent_id}/trust/history
Get trust history.

---

### Actions

#### POST /agents/{agent_id}/actions
Process an action request through security layers.

**Request:**
```json
{
  "action_type": "execute",
  "description": "Run data analysis script",
  "target": "/data/analysis.py",
  "impact": "medium",
  "reversible": true,
  "input_text": "analyze sales data",
  "metadata": {}
}
```

**Impact Levels:**
- `negligible` (0.0)
- `low` (0.1)
- `medium` (0.2)
- `high` (0.4)
- `critical` (0.6)
- `catastrophic` (0.9)

**Response:**
```json
{
  "request_id": "req_abc123",
  "allowed": true,
  "reason": "Approved",
  "risk_score": 0.25,
  "required_approval": null,
  "signals": []
}
```

**Blocked Response:**
```json
{
  "request_id": "req_def456",
  "allowed": false,
  "reason": "Potential injection attack",
  "risk_score": 0.75,
  "required_approval": "ADMIN",
  "signals": ["INJECTION_DETECTED", "HIGH_IMPACT"]
}
```

---

### Assessments

#### GET /agents/{agent_id}/assessment
Get comprehensive threat assessment.

**Response:**
```json
{
  "agent_id": "agent-001",
  "timestamp": "2026-01-08T12:00:00Z",
  "trust_score": 0.45,
  "trust_velocity": 0.02,
  "trust_ceiling": 0.55,
  "threat_level": "low",
  "risk_score": 0.15,
  "total_signals": 1,
  "recommended_action": "MONITOR: Minor signals",
  "findings": ["Rapid trust accumulation detected"],
  "signals_by_category": {
    "drift": ["RAPID_TRUST_GAIN"]
  }
}
```

**Threat Levels:**
| Level | Risk Score | Action |
|-------|------------|--------|
| `none` | 0.0 - 0.2 | Continue |
| `low` | 0.2 - 0.4 | Monitor |
| `moderate` | 0.4 - 0.6 | Restrict |
| `high` | 0.6 - 0.8 | Suspend |
| `critical` | 0.8 - 0.9 | Quarantine |
| `catastrophic` | 0.9+ | Terminate |

---

### Behavior Recording

#### POST /agents/{agent_id}/behavior
Record agent behavior for analysis.

**Request:**
```json
{
  "action_category": "productive",
  "description": "Completed data analysis task",
  "outcome_value": 0.9,
  "topic_weights": {"data": 0.8, "analysis": 0.6}
}
```

---

### Admin Endpoints

#### GET /admin/action-log
Get action log (admin only).

**Query Parameters:**
- `limit`: Max results (default: 100)
- `agent_id`: Filter by agent

#### GET /admin/assessment-log
Get assessment log (admin only).

#### POST /admin/api-keys
Create new API key (admin only).

**Request:**
```json
{
  "name": "service-account",
  "role": "user"
}
```

#### DELETE /admin/api-keys/{api_key}
Revoke API key (admin only).

---

## Error Responses

All errors follow this format:

```json
{
  "detail": "Error message"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Validation Error |
| 429 | Rate Limited |
| 500 | Server Error |

---

## Rate Limits

- Default: 1000 requests per hour
- Admin endpoints: 100 requests per hour
- Rate limit headers included in response

---

## Webhooks

Configure webhooks for real-time notifications:

**Events:**
- `agent.created`
- `agent.activated`
- `agent.suspended`
- `agent.quarantined`
- `trust.updated`
- `threat.detected`
- `action.blocked`

**Webhook Payload:**
```json
{
  "event": "threat.detected",
  "timestamp": "2026-01-08T12:00:00Z",
  "data": {
    "agent_id": "agent-001",
    "threat_level": "high",
    "risk_score": 0.75
  }
}
```

---

## SDK Examples

### Python

```python
from atsf import ATSFClient

client = ATSFClient(api_key="your-api-key")

# Create and activate agent
agent = client.agents.create("my-agent", transparency_tier="gray_box")
agent = client.agents.activate("my-agent")

# Process action
decision = client.actions.process(
    "my-agent",
    action_type="execute",
    description="Run analysis",
    target="/data/input.csv",
    impact="medium"
)

if decision.allowed:
    print("Action approved")
else:
    print(f"Action blocked: {decision.reason}")
```

### JavaScript

```javascript
const ATSF = require('atsf-sdk');

const client = new ATSF.Client({ apiKey: 'your-api-key' });

// Create agent
const agent = await client.agents.create({
  agentId: 'my-agent',
  transparencyTier: 'gray_box'
});

// Get assessment
const assessment = await client.assessments.get('my-agent');
console.log(`Threat level: ${assessment.threatLevel}`);
```

---

## Best Practices

1. **Start with zero trust** - All agents begin at trust score 0.0
2. **Use appropriate transparency tiers** - Higher transparency = higher ceiling
3. **Monitor velocity** - Watch for rapid trust changes
4. **Regular assessments** - Run assessments on critical operations
5. **Handle blocked actions gracefully** - Implement fallback logic
6. **Log everything** - Use behavior recording for audit trails

---

## Support

- Documentation: https://docs.agentanchorai.com/atsf
- Issues: https://github.com/agentanchor/atsf/issues
- Email: support@agentanchorai.com
