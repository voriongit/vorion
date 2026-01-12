# ATSF v3.0 - Integration Tutorial

## Overview

This tutorial walks you through integrating ATSF into your AI agent system.

---

## Prerequisites

- ATSF API running (local or cloud)
- API key
- Python 3.9+ or Node.js 16+

---

## Quick Start (5 Minutes)

### Step 1: Install SDK

**Python:**
```bash
pip install atsf-sdk
```

**JavaScript:**
```bash
npm install @agentanchor/atsf-sdk
```

### Step 2: Initialize Client

**Python:**
```python
from atsf import ATSFClient

client = ATSFClient(
    api_key="your-api-key",
    base_url="http://localhost:8000"  # or your deployment URL
)

# Verify connection
health = client.health()
print(f"ATSF Status: {health['status']}")
```

**JavaScript:**
```javascript
import { ATSFClient } from '@agentanchor/atsf-sdk';

const client = new ATSFClient({
  apiKey: 'your-api-key',
  baseUrl: 'http://localhost:8000'
});

const health = await client.health();
console.log(`ATSF Status: ${health.status}`);
```

### Step 3: Register Your Agent

```python
# Create agent with gray-box transparency
agent = client.agents.create(
    agent_id="my-agent-001",
    transparency_tier="gray_box",
    capabilities=["file_system", "network"],
    metadata={"owner": "your-team", "version": "1.0"}
)

print(f"Agent created: {agent.agent_id}")
print(f"Trust ceiling: {agent.trust_ceiling}")

# Activate the agent
agent = client.agents.activate("my-agent-001")
print(f"Agent status: {agent.status}")
```

---

## Core Integration Patterns

### Pattern 1: Action Gating

Gate all agent actions through ATSF before execution.

```python
from atsf import ATSFClient, ImpactLevel

client = ATSFClient(api_key="your-key")

def execute_action(agent_id: str, action: dict) -> bool:
    """Execute action only if ATSF approves."""
    
    # Request permission from ATSF
    decision = client.actions.process(
        agent_id=agent_id,
        action_type=action["type"],
        description=action["description"],
        target=action["target"],
        impact=action.get("impact", ImpactLevel.MEDIUM),
        reversible=action.get("reversible", True),
        input_text=action.get("input")
    )
    
    if not decision.allowed:
        print(f"Action blocked: {decision.reason}")
        print(f"Signals: {decision.signals}")
        return False
        
    if decision.required_approval:
        print(f"Action requires approval: {decision.required_approval}")
        # Implement approval workflow
        return wait_for_approval(decision)
        
    # Execute the action
    result = perform_action(action)
    
    # Update trust based on outcome
    if result.success:
        client.trust.update(
            agent_id=agent_id,
            event_type="action_success",
            delta=0.01,
            source="action_executor"
        )
    else:
        client.trust.update(
            agent_id=agent_id,
            event_type="action_failure",
            delta=-0.02,
            source="action_executor"
        )
        
    return result.success
```

### Pattern 2: Continuous Monitoring

Monitor agent behavior and respond to threats.

```python
import time
from threading import Thread

def monitor_agent(agent_id: str, interval: int = 60):
    """Continuously monitor agent for threats."""
    
    while True:
        assessment = client.assessments.get(agent_id)
        
        # Check threat level
        if assessment.threat_level in ["critical", "catastrophic"]:
            print(f"⚠️ CRITICAL THREAT: {agent_id}")
            client.agents.quarantine(agent_id, "Automatic: Critical threat detected")
            send_alert(assessment)
            break
            
        elif assessment.threat_level == "high":
            print(f"⚠️ High threat: {agent_id}")
            client.agents.suspend(agent_id, "Automatic: High threat detected")
            send_alert(assessment)
            
        elif assessment.threat_level == "moderate":
            print(f"⚠ Moderate threat: {agent_id}")
            # Increase monitoring frequency
            interval = 30
            
        # Log findings
        if assessment.findings:
            for finding in assessment.findings:
                log_finding(agent_id, finding)
                
        time.sleep(interval)

# Start monitoring in background
monitor_thread = Thread(target=monitor_agent, args=("my-agent-001",))
monitor_thread.daemon = True
monitor_thread.start()
```

### Pattern 3: Trust-Based Capabilities

Unlock capabilities based on trust level.

```python
def get_allowed_capabilities(agent_id: str) -> list:
    """Get capabilities based on current trust level."""
    
    trust = client.trust.get(agent_id)
    agent = client.agents.get(agent_id)
    
    capabilities = []
    
    # Base capabilities (always available)
    capabilities.extend(["read_only", "logging"])
    
    # Trust level 0.2+
    if trust.trust_score >= 0.2:
        capabilities.extend(["file_read", "api_read"])
        
    # Trust level 0.4+
    if trust.trust_score >= 0.4:
        capabilities.extend(["file_write", "network_access"])
        
    # Trust level 0.6+ (requires white_box or higher)
    if trust.trust_score >= 0.6 and agent.transparency_tier in ["white_box", "attested"]:
        capabilities.extend(["execute_code", "database_access"])
        
    # Trust level 0.8+ (requires attestation)
    if trust.trust_score >= 0.8 and agent.transparency_tier == "attested":
        capabilities.extend(["admin_operations", "spawn_processes"])
        
    return capabilities

# Use in your agent
class TrustAwareAgent:
    def __init__(self, agent_id: str):
        self.agent_id = agent_id
        self.capabilities = []
        
    def refresh_capabilities(self):
        self.capabilities = get_allowed_capabilities(self.agent_id)
        
    def can_perform(self, capability: str) -> bool:
        return capability in self.capabilities
        
    def execute(self, action: dict):
        required_cap = action.get("requires_capability")
        
        if required_cap and not self.can_perform(required_cap):
            raise PermissionError(
                f"Agent lacks capability: {required_cap}. "
                f"Current trust: {client.trust.get(self.agent_id).trust_score}"
            )
            
        return execute_action(self.agent_id, action)
```

---

## Advanced Integration

### Webhook Integration

Set up webhooks to receive real-time events.

```python
from flask import Flask, request
import hmac
import hashlib

app = Flask(__name__)
WEBHOOK_SECRET = "your-webhook-secret"

@app.route("/atsf/webhook", methods=["POST"])
def handle_webhook():
    """Handle ATSF webhook events."""
    
    # Verify signature
    signature = request.headers.get("X-ATSF-Signature")
    payload = request.get_data()
    expected = hmac.new(
        WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(signature, expected):
        return {"error": "Invalid signature"}, 401
        
    event = request.json
    event_type = event["event"]
    data = event["data"]
    
    # Handle events
    if event_type == "threat.detected":
        handle_threat(data["agent_id"], data["threat_level"])
        
    elif event_type == "agent.quarantined":
        notify_team(f"Agent {data['agent_id']} quarantined: {data['reason']}")
        
    elif event_type == "action.blocked":
        log_blocked_action(data)
        
    elif event_type == "trust.updated":
        if data["trust_score"] < 0.1:
            review_agent(data["agent_id"])
            
    return {"status": "ok"}

def handle_threat(agent_id: str, threat_level: str):
    """Handle detected threat."""
    if threat_level in ["critical", "catastrophic"]:
        # Immediate action
        disable_agent_operations(agent_id)
        page_oncall()
    elif threat_level == "high":
        # Escalate
        create_incident(agent_id, threat_level)
```

### Batch Operations

Process multiple agents efficiently.

```python
import asyncio
from atsf import ATSFClient

async def assess_all_agents():
    """Assess all active agents."""
    
    client = ATSFClient(api_key="your-key")
    
    # Get all active agents
    agents = client.agents.list(status="active")
    
    # Assess each agent
    results = {}
    for agent in agents:
        assessment = client.assessments.get(agent.agent_id)
        results[agent.agent_id] = {
            "threat_level": assessment.threat_level,
            "risk_score": assessment.risk_score,
            "signals": assessment.total_signals
        }
        
    # Generate report
    critical = [a for a, r in results.items() if r["threat_level"] == "critical"]
    high = [a for a, r in results.items() if r["threat_level"] == "high"]
    
    print(f"Total agents: {len(agents)}")
    print(f"Critical threats: {len(critical)}")
    print(f"High threats: {len(high)}")
    
    return results

# Run assessment
results = asyncio.run(assess_all_agents())
```

### Custom Metrics Collection

Integrate with your monitoring stack.

```python
from prometheus_client import Counter, Gauge, Histogram
import time

# Define metrics
atsf_requests = Counter(
    'atsf_requests_total',
    'Total ATSF API requests',
    ['method', 'endpoint', 'status']
)

atsf_trust_score = Gauge(
    'atsf_agent_trust_score',
    'Current agent trust score',
    ['agent_id']
)

atsf_threat_level = Gauge(
    'atsf_agent_threat_level',
    'Current agent threat level (0-5)',
    ['agent_id']
)

atsf_response_time = Histogram(
    'atsf_response_seconds',
    'ATSF API response time',
    ['endpoint']
)

THREAT_LEVELS = {
    'none': 0, 'low': 1, 'moderate': 2,
    'high': 3, 'critical': 4, 'catastrophic': 5
}

class MetricsClient:
    """ATSF client with Prometheus metrics."""
    
    def __init__(self, client: ATSFClient):
        self.client = client
        
    def update_agent_metrics(self, agent_id: str):
        """Update Prometheus metrics for agent."""
        
        with atsf_response_time.labels(endpoint='trust').time():
            trust = self.client.trust.get(agent_id)
            
        with atsf_response_time.labels(endpoint='assessment').time():
            assessment = self.client.assessments.get(agent_id)
            
        atsf_trust_score.labels(agent_id=agent_id).set(trust.trust_score)
        atsf_threat_level.labels(agent_id=agent_id).set(
            THREAT_LEVELS.get(assessment.threat_level, 0)
        )
        
    def process_action(self, agent_id: str, **kwargs):
        """Process action with metrics."""
        
        start = time.time()
        try:
            result = self.client.actions.process(agent_id, **kwargs)
            atsf_requests.labels(
                method='POST',
                endpoint='actions',
                status='success' if result.allowed else 'blocked'
            ).inc()
            return result
        except Exception as e:
            atsf_requests.labels(
                method='POST',
                endpoint='actions',
                status='error'
            ).inc()
            raise
        finally:
            atsf_response_time.labels(endpoint='actions').observe(
                time.time() - start
            )
```

---

## Error Handling

```python
from atsf import (
    ATSFClient,
    ATSFError,
    AuthenticationError,
    NotFoundError,
    RateLimitError
)
import time

def robust_action(client: ATSFClient, agent_id: str, action: dict, retries: int = 3):
    """Execute action with robust error handling."""
    
    for attempt in range(retries):
        try:
            return client.actions.process(agent_id, **action)
            
        except AuthenticationError:
            # Don't retry auth errors
            raise
            
        except NotFoundError:
            # Agent doesn't exist
            print(f"Agent {agent_id} not found, creating...")
            client.agents.create(agent_id=agent_id, transparency_tier="black_box")
            client.agents.activate(agent_id)
            continue
            
        except RateLimitError:
            # Wait and retry
            wait_time = 2 ** attempt
            print(f"Rate limited, waiting {wait_time}s...")
            time.sleep(wait_time)
            continue
            
        except ATSFError as e:
            # General API error
            print(f"ATSF error: {e}")
            if attempt == retries - 1:
                raise
            time.sleep(1)
            
    raise RuntimeError(f"Failed after {retries} attempts")
```

---

## Testing Your Integration

```python
import pytest
from unittest.mock import Mock, patch

def test_action_gating():
    """Test that actions are properly gated."""
    
    with patch('atsf.ATSFClient') as MockClient:
        # Setup mock
        mock_client = MockClient.return_value
        mock_client.actions.process.return_value = Mock(
            allowed=False,
            reason="Test blocked",
            signals=["TEST_SIGNAL"]
        )
        
        # Test
        result = execute_action("test-agent", {
            "type": "execute",
            "description": "Test action",
            "target": "/test"
        })
        
        assert result == False
        mock_client.actions.process.assert_called_once()

def test_trust_based_capabilities():
    """Test capability unlocking based on trust."""
    
    with patch('atsf.ATSFClient') as MockClient:
        mock_client = MockClient.return_value
        
        # Low trust
        mock_client.trust.get.return_value = Mock(trust_score=0.1)
        mock_client.agents.get.return_value = Mock(transparency_tier="gray_box")
        
        caps = get_allowed_capabilities("test-agent")
        assert "file_write" not in caps
        
        # Higher trust
        mock_client.trust.get.return_value = Mock(trust_score=0.5)
        caps = get_allowed_capabilities("test-agent")
        assert "file_write" in caps
```

---

## Best Practices

### 1. Start Conservative
```python
# Start with black_box tier and minimal capabilities
agent = client.agents.create(
    agent_id="new-agent",
    transparency_tier="black_box",  # Lowest trust ceiling
    capabilities=["read_only"]       # Minimal capabilities
)
```

### 2. Always Check Before Acting
```python
# Never skip the action check
decision = client.actions.process(...)
if not decision.allowed:
    # Handle gracefully
    log_blocked_action(decision)
    return fallback_action()
```

### 3. Monitor Continuously
```python
# Regular health checks
assessment = client.assessments.get(agent_id)
if assessment.risk_score > 0.5:
    alert_team(assessment)
```

### 4. Handle Failures Gracefully
```python
try:
    result = client.actions.process(...)
except ATSFError:
    # Fall back to safe mode
    enter_safe_mode(agent_id)
```

### 5. Log Everything
```python
# Log all ATSF interactions for audit
decision = client.actions.process(...)
audit_log.info(
    "ATSF decision",
    agent_id=agent_id,
    action=action_type,
    allowed=decision.allowed,
    risk=decision.risk_score
)
```

---

## Next Steps

1. **Read the API documentation**: [API.md](./API.md)
2. **Review architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
3. **Deploy to production**: [DEPLOYMENT.md](./DEPLOYMENT.md)
4. **Join the community**: https://github.com/agentanchor/atsf/discussions

---

## Support

- Documentation: https://docs.agentanchor.com/atsf
- Issues: https://github.com/agentanchor/atsf/issues
- Email: support@agentanchor.com
