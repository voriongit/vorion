# ATSF REST API Reference

Complete reference for all ATSF REST API endpoints.

**Base URL**: `http://localhost:8000` (default)

---

## Authentication

Currently, ATSF API does not require authentication. For production, configure your reverse proxy (nginx, Traefik) to handle auth.

---

## Endpoints

### Health & Monitoring

#### GET /health

Health check endpoint.

**Response**
```json
{
  "status": "healthy",
  "version": "3.3.0",
  "timestamp": "2026-01-09T01:00:00.000000",
  "components": {
    "atsf_system": true,
    "creator_system": true,
    "trism_manager": true
  }
}
```

#### GET /status

Comprehensive system status.

**Response**
```json
{
  "timestamp": "2026-01-09T01:00:00.000000",
  "agents": {
    "total": 15,
    "active": 12
  },
  "creators": {
    "total": 5
  },
  "trism": {
    "drift_detection": {"total_signals": 2, "critical_signals": 0},
    "adversarial_threats": {"attacks_24h": 0},
    "privacy_risks": {"risks_24h": 0}
  },
  "kill_switch": "armed"
}
```

#### GET /metrics

Prometheus-formatted metrics.

**Response** (text/plain)
```
# ATSF Metrics Export
atsf_actions_processed 1523
atsf_actions_allowed 1401
atsf_actions_denied 122
atsf_agents_registered 15
atsf_action_processing_ms_p50 1.2
atsf_action_processing_ms_p99 5.8
```

---

### Creators

#### POST /creators

Register a new creator.

**Request Body**
```json
{
  "creator_id": "acme_ai",
  "tier": "verified",
  "stake": 5000.0,
  "metadata": {}
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| creator_id | string | Yes | Unique identifier |
| tier | enum | Yes | `anonymous`, `pseudonymous`, `verified`, `institutional`, `certified` |
| stake | float | No | Initial stake amount (default: 0) |
| metadata | object | No | Additional metadata |

**Response** `201 Created`
```json
{
  "creator_id": "acme_ai",
  "tier": "verified",
  "status": "active",
  "reputation_score": 0.7,
  "stake_deposited": 5000.0,
  "stake_locked": 0.0,
  "effective_ceiling": 0.85,
  "agent_count": 0
}
```

#### GET /creators/{creator_id}

Get creator details.

**Response**
```json
{
  "creator_id": "acme_ai",
  "tier": "verified",
  "status": "active",
  "reputation_score": 0.72,
  "stake_deposited": 5000.0,
  "stake_locked": 500.0,
  "effective_ceiling": 0.85,
  "agent_count": 3
}
```

#### GET /creators

List all creators.

**Query Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status (`active`, `probation`, `suspended`) |

**Response**
```json
{
  "count": 5,
  "creators": [
    {"creator_id": "acme_ai", "tier": "verified", "status": "active", "reputation_score": 0.72},
    {"creator_id": "beta_corp", "tier": "institutional", "status": "active", "reputation_score": 0.85}
  ]
}
```

---

### Agents

#### POST /agents

Register a new agent.

**Request Body**
```json
{
  "agent_id": "assistant_001",
  "creator_id": "acme_ai",
  "tier": "gray_box",
  "name": "ACME Assistant",
  "capabilities": ["read", "write", "api_call"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| agent_id | string | Yes | Unique identifier |
| creator_id | string | Yes | Parent creator ID |
| tier | enum | Yes | `black_box`, `gray_box`, `white_box`, `verified_box` |
| name | string | No | Human-readable name |
| capabilities | array | No | List of capabilities |

**Response** `201 Created`
```json
{
  "agent_id": "assistant_001",
  "creator_id": "acme_ai",
  "tier": "gray_box",
  "status": "active",
  "trust_score": 0.0,
  "trust_ceiling": 0.6,
  "actions_total": 0,
  "actions_allowed": 0,
  "actions_denied": 0
}
```

#### GET /agents/{agent_id}

Get agent details.

**Response**
```json
{
  "agent_id": "assistant_001",
  "creator_id": "acme_ai",
  "tier": "gray_box",
  "status": "active",
  "trust_score": 0.156,
  "trust_ceiling": 0.6,
  "actions_total": 47,
  "actions_allowed": 45,
  "actions_denied": 2
}
```

#### GET /agents

List all agents.

**Query Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status |
| creator_id | string | Filter by creator |

**Response**
```json
{
  "count": 3,
  "agents": [
    {"agent_id": "assistant_001", "creator_id": "acme_ai", "tier": "gray_box", "status": "active", "trust_score": 0.156}
  ]
}
```

---

### Actions

#### POST /actions

**Process an agent action through the full ATSF pipeline.**

This is the core endpoint.

**Request Body**
```json
{
  "request_id": "req_001",
  "agent_id": "assistant_001",
  "action_type": "read",
  "payload": {
    "target": "user_data.json",
    "fields": ["name", "preferences"]
  },
  "reasoning_trace": "Reading user preferences to personalize the response. This is a read-only operation with minimal risk.",
  "tool_outputs": []
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| request_id | string | Yes | Unique request identifier |
| agent_id | string | Yes | Agent making the request |
| action_type | string | Yes | `read`, `write`, `execute`, `api_call`, `network`, etc. |
| payload | object | Yes | Action-specific payload |
| reasoning_trace | string | Yes | Agent's reasoning for this action |
| tool_outputs | array | No | Outputs from tools to sanitize |

**Tool Output Format**
```json
{
  "tool_outputs": [
    {
      "tool": "http_client",
      "content": "{\"status\": \"ok\", \"data\": [...]}"
    },
    {
      "tool": "file_reader",
      "content": "File contents here..."
    }
  ]
}
```

**Response**
```json
{
  "request_id": "req_001",
  "decision": "allow_monitored",
  "allowed": true,
  "risk_score": 0.305,
  "reasons": [
    "Reasoning quality: adequate",
    "Action type risk: low"
  ],
  "trust_delta": 0.0049,
  "new_trust_score": 0.161,
  "requires_approval": false,
  "approval_id": null,
  "processing_time_ms": 1.65
}
```

**Decision Values**
| Decision | allowed | Description |
|----------|---------|-------------|
| `allow` | true | Safe, proceed normally |
| `allow_monitored` | true | Proceed with extra logging |
| `escalate` | false | Requires human approval |
| `deny` | false | Blocked |

#### POST /actions/batch

Process multiple actions in batch.

**Request Body**
```json
[
  {"request_id": "r1", "agent_id": "assistant_001", ...},
  {"request_id": "r2", "agent_id": "assistant_001", ...}
]
```

**Response**
```json
{
  "processed": 2,
  "results": [
    {"request_id": "r1", "success": true, "result": {...}},
    {"request_id": "r2", "success": true, "result": {...}}
  ]
}
```

---

### AI TRiSM

#### GET /trism/dashboard

Get AI TRiSM dashboard data.

**Response**
```json
{
  "timestamp": "2026-01-09T01:00:00.000000",
  "nist_rmf_metrics": {
    "drift_detection": {"total_signals": 2, "critical_signals": 0},
    "adversarial_threats": {
      "attacks_24h": 1,
      "blocked_sources": 0,
      "by_type": {"prompt_injection": 1, "evasion": 0, ...}
    },
    "privacy_risks": {"risks_24h": 0, "by_type": {...}},
    "model_ops": {"active_version": "1.0.0", "kill_switch_status": "armed"},
    "explainability": {"decisions_logged": 156, "audit_entries": 156}
  },
  "kill_switch": {
    "status": "armed",
    "triggers": [
      {"name": "High Risk Rate", "metric": "high_risk_rate", "threshold": 0.1, "enabled": true}
    ]
  },
  "drift_summary": {"total_signals": 2},
  "adversarial_summary": {...},
  "privacy_summary": {...}
}
```

#### GET /trism/stpa

Get STPA control structure analysis.

**Response**
```json
{
  "control_structure": "ASCII diagram...",
  "analysis": {
    "losses": [...],
    "hazards": [...],
    "controllers": [...],
    "unsafe_control_actions": [...],
    "loss_scenarios": [...]
  }
}
```

#### GET /trism/stpa/feedback/{controller_id}

Get STPA feedback for a specific controller.

**Response**
```json
{
  "controller_id": "C2_trust_engine",
  "timestamp": "2026-01-09T01:00:00.000000",
  "system_state": {
    "kill_switch": "armed",
    "active_threats": 0,
    "drift_signals": 2,
    "privacy_risks": 0
  },
  "recommended_actions": ["CONTINUE"],
  "confidence": 0.95
}
```

#### POST /trism/killswitch/reset

Reset the kill switch after investigation.

**Query Parameters**
| Parameter | Type | Required |
|-----------|------|----------|
| reset_by | string | Yes |
| reason | string | Yes |

**Response**
```json
{
  "status": "armed",
  "reset_by": "security_team",
  "reason": "False positive investigated"
}
```

---

### Safety Gate (CI/CD)

#### POST /gate

Run CI/CD safety gate assessment.

**Request Body**
```json
{
  "agent_config": {
    "name": "new_agent",
    "model": "gpt-4",
    "capabilities": ["read", "write"],
    "system_prompt": "You are a helpful assistant..."
  },
  "creator_id": "acme_ai",
  "max_risk_score": 0.3,
  "max_bias_score": 0.2
}
```

**Response**
```json
{
  "passed": true,
  "overall_risk": 0.18,
  "checks_run": 12,
  "warnings": [
    "Agent has write capability - ensure proper sandboxing"
  ],
  "blocking_issues": [],
  "recommendations": [
    "Consider adding rate limiting for API calls"
  ]
}
```

---

### Red Team Probes

#### POST /probes

Run red team probes against an agent.

**Request Body**
```json
{
  "agent_id": "assistant_001",
  "probe_types": ["injection", "jailbreak", "extraction"]
}
```

Leave `probe_types` empty to run all probe types.

**Response**
```json
{
  "agent_id": "assistant_001",
  "probes_run": 3,
  "probes_passed": 3,
  "probes_failed": 0,
  "risk_score": 0.0,
  "details": [
    {"probe_type": "injection", "passed": true, "risk_indicators": []},
    {"probe_type": "jailbreak", "passed": true, "risk_indicators": []},
    {"probe_type": "extraction", "passed": true, "risk_indicators": []}
  ]
}
```

---

### HRO & Appeals

#### POST /hro/near-miss

Report a near-miss event.

**Query Parameters**
| Parameter | Type | Required |
|-----------|------|----------|
| description | string | Yes |
| what_prevented | string | Yes |
| reported_by | string | No |

**Response**
```json
{
  "event_id": "nm_abc123",
  "principle": "preoccupation_with_failure",
  "message": "Near-miss recorded for learning"
}
```

#### GET /hro/health

Get HRO culture health score.

**Response**
```json
{
  "overall_score": 0.72,
  "assessment": "Good HRO culture",
  "by_principle": {
    "preoccupation_with_failure": 0.8,
    "reluctance_to_simplify": 0.7,
    "sensitivity_to_operations": 0.65,
    "commitment_to_resilience": 0.75,
    "deference_to_expertise": 0.7
  }
}
```

#### POST /appeals

File an appeal for a false positive.

**Request Body**
```json
{
  "original_decision_id": "req_001",
  "agent_id": "assistant_001",
  "creator_id": "acme_ai",
  "appeal_reason": "Action was flagged incorrectly - the file read was authorized",
  "evidence": ["Authorization ticket #12345", "User consent log"]
}
```

**Response**
```json
{
  "appeal_id": "appeal_xyz789",
  "status": "pending",
  "message": "Appeal filed successfully"
}
```

#### POST /appeals/{appeal_id}/review

Review and decide on an appeal.

**Request Body**
```json
{
  "appeal_id": "appeal_xyz789",
  "approved": true,
  "reviewer_id": "admin_001",
  "notes": "Verified authorization was in place",
  "reputation_restore": 0.02,
  "stake_refund": 100.0,
  "trust_restore": 0.01
}
```

---

### Explainability

#### GET /explain/{decision_id}

Get human-readable explanation for a decision.

**Response**
```json
{
  "decision_id": "req_001",
  "explanation": "Decision: allow_monitored\n\nPrimary Factors:\n- action_type_risk: 0.15 (weight: 0.3)\n- reasoning_quality: 0.7 (weight: 0.25)\n..."
}
```

#### GET /audit

Get decision audit log.

**Query Parameters**
| Parameter | Type | Default |
|-----------|------|---------|
| limit | int | 100 |

**Response**
```json
{
  "count": 156,
  "entries": [
    {
      "decision_id": "req_156",
      "agent_id": "assistant_001",
      "timestamp": "2026-01-09T01:00:00.000000",
      "decision": "allow",
      "audit_hash": "a1b2c3d4..."
    }
  ]
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "detail": "Error message here"
}
```

| Status | Description |
|--------|-------------|
| 400 | Bad request / validation error |
| 404 | Resource not found |
| 500 | Internal server error |

---

## Rate Limiting

Default limits (configurable):
- 1000 requests/minute per IP
- 100 requests/minute per agent

---

## OpenAPI Schema

Interactive docs available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- OpenAPI JSON: `http://localhost:8000/openapi.json`
