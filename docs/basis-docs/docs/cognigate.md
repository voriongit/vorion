---
sidebar_position: 6
title: Cognigate
description: The reference implementation of BASIS
---

# Cognigate

## The Reference Implementation of BASIS

**Production-ready AI governance runtime. Open source. Battle-tested.**

[GitHub](https://github.com/voriongit/cognigate) · [API Reference](https://cognigate.dev/api)

---

## What is Cognigate?

Cognigate is the reference implementation of the BASIS standard — a complete governance runtime for AI agents.

```
┌─────────────────────────────────────────────────────────────┐
│                       COGNIGATE                             │
│              AI Governance Runtime Engine                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   │
│   │ INTENT  │──▶│ ENFORCE │──▶│  PROOF  │──▶│  CHAIN  │   │
│   └─────────┘   └─────────┘   └─────────┘   └─────────┘   │
│                                                             │
│   Parse &        Trust &       Immutable      Blockchain    │
│   Plan           Gate          Audit          Anchor        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Docker (Fastest)

```bash
# Clone the repository
git clone https://github.com/voriongit/cognigate.git
cd cognigate

# Start with Docker Compose
docker-compose up -d

# Cognigate is now running at http://localhost:8000
```

### From Source

```bash
# Prerequisites: Python 3.11+, Poetry

git clone https://github.com/voriongit/cognigate.git
cd cognigate

# Install dependencies
poetry install

# Configure
cp .env.example .env

# Run
poetry run uvicorn cognigate.main:app --reload
```

---

## Core Features

| Layer | Features |
|-------|----------|
| **INTENT** | LLM-powered parsing, risk classification, capability detection |
| **ENFORCE** | Trust integration, capability gating, policy engine, escalation |
| **PROOF** | Cryptographic chaining, agent signatures, append-only storage |
| **CHAIN** | Polygon anchoring, Merkle batching, independent verification |

---

## API Overview

```yaml
# Intent
POST /v1/intent/evaluate     # Parse agent intent

# Enforce
POST /v1/enforce/gate        # Gate decision
POST /v1/enforce/escalate    # Create escalation

# Trust
GET  /v1/trust/score/{id}    # Get trust score

# Proof
POST /v1/proof/log           # Log record
GET  /v1/proof/{id}          # Get record
GET  /v1/proof/verify/{id}   # Verify record

# Chain
POST /v1/chain/anchor        # Anchor to blockchain
GET  /v1/chain/verify/{hash} # Verify on-chain
```

---

## Configuration

```yaml
# config/cognigate.yaml

server:
  host: 0.0.0.0
  port: 8000

intent:
  provider: openai
  model: gpt-4-turbo

enforce:
  trust_provider: agentanchor
  default_policy: deny

proof:
  storage: postgres
  retention_days: 2555  # 7 years

chain:
  network: polygon
  anchor_threshold: high
```

---

## Performance

| Metric | Target | Typical |
|--------|--------|---------|
| INTENT evaluation | < 500ms | ~200ms |
| ENFORCE gate | < 100ms | ~30ms |
| PROOF logging | < 50ms | ~10ms |
| CHAIN anchor | < 60s | ~5s |

---

## License

Cognigate is open source under **Apache 2.0**.

Commercial support available from [Vorion](https://vorion.org).

---

## Python Integration

### Basic Usage

```python
# cognigate_example.py
import httpx
from dataclasses import dataclass
from typing import Literal

@dataclass
class GateDecision:
    allowed: bool
    reason: str
    trust_score: int
    trust_level: int

class CognigateClient:
    """Python client for Cognigate API."""

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.client = httpx.Client(timeout=30.0)

    def evaluate_intent(self, agent_id: str, intent: str, context: dict = None) -> dict:
        """Parse and evaluate an agent's intent."""
        response = self.client.post(
            f"{self.base_url}/v1/intent/evaluate",
            json={
                "agent_id": agent_id,
                "raw_intent": intent,
                "context": context or {}
            }
        )
        response.raise_for_status()
        return response.json()

    def gate_action(
        self,
        agent_id: str,
        action: str,
        capabilities_required: list[str]
    ) -> GateDecision:
        """Gate an agent action through policy enforcement."""
        response = self.client.post(
            f"{self.base_url}/v1/enforce/gate",
            json={
                "agent_id": agent_id,
                "action": action,
                "capabilities_required": capabilities_required
            }
        )
        response.raise_for_status()
        data = response.json()

        return GateDecision(
            allowed=data["decision"] == "ALLOW",
            reason=data["reason"],
            trust_score=data["trust_score"],
            trust_level=data["trust_level"]
        )

    def get_trust_score(self, agent_id: str) -> dict:
        """Get current trust score for an agent."""
        response = self.client.get(
            f"{self.base_url}/v1/trust/score/{agent_id}"
        )
        response.raise_for_status()
        return response.json()

# Usage example
if __name__ == "__main__":
    client = CognigateClient()

    # Check if action is allowed
    decision = client.gate_action(
        agent_id="agent-123",
        action="send_email",
        capabilities_required=["network:external", "email:send"]
    )

    if decision.allowed:
        print(f"Action allowed! Trust score: {decision.trust_score}")
        # ... perform the action ...
    else:
        print(f"Action denied: {decision.reason}")
```

### LangChain Integration

```python
# cognigate_langchain.py
from langchain.tools import BaseTool
from langchain.callbacks.base import BaseCallbackHandler
from typing import Any

class CognigateGatedTool(BaseTool):
    """A LangChain tool that gates execution through Cognigate."""

    name: str = "gated_tool"
    description: str = "Tool that requires Cognigate approval"
    cognigate_client: Any = None
    agent_id: str = ""
    required_capabilities: list[str] = []

    def _run(self, query: str) -> str:
        # Gate the action through Cognigate
        decision = self.cognigate_client.gate_action(
            agent_id=self.agent_id,
            action=self.name,
            capabilities_required=self.required_capabilities
        )

        if not decision.allowed:
            return f"Action blocked by governance: {decision.reason}"

        # Execute the actual tool logic
        return self._execute_tool(query)

    def _execute_tool(self, query: str) -> str:
        # Override in subclasses
        raise NotImplementedError


class CognigateCallbackHandler(BaseCallbackHandler):
    """Callback handler that logs all LLM interactions to Cognigate."""

    def __init__(self, cognigate_client, agent_id: str):
        self.client = cognigate_client
        self.agent_id = agent_id

    def on_llm_start(self, serialized: dict, prompts: list[str], **kwargs):
        # Log intent evaluation
        for prompt in prompts:
            self.client.evaluate_intent(
                agent_id=self.agent_id,
                intent=prompt[:500],  # Truncate for logging
                context={"source": "llm_prompt"}
            )

    def on_tool_start(self, serialized: dict, input_str: str, **kwargs):
        # Gate tool execution
        tool_name = serialized.get("name", "unknown")
        decision = self.client.gate_action(
            agent_id=self.agent_id,
            action=f"tool:{tool_name}",
            capabilities_required=[f"tool:{tool_name}"]
        )

        if not decision.allowed:
            raise PermissionError(f"Tool {tool_name} blocked: {decision.reason}")
```

### Constrained Execution

```python
# constrained_agent.py
from contextlib import contextmanager
from typing import Callable, Any

class ConstrainedExecutionContext:
    """
    Context manager for constrained agent execution.
    All actions are validated against Cognigate policies.
    """

    def __init__(self, cognigate_client, agent_id: str):
        self.client = cognigate_client
        self.agent_id = agent_id
        self.session_proofs = []

    def require_capability(self, capability: str):
        """Decorator to require a capability for a function."""
        def decorator(func: Callable) -> Callable:
            def wrapper(*args, **kwargs) -> Any:
                decision = self.client.gate_action(
                    agent_id=self.agent_id,
                    action=func.__name__,
                    capabilities_required=[capability]
                )

                if not decision.allowed:
                    raise PermissionError(
                        f"Capability '{capability}' denied: {decision.reason}"
                    )

                return func(*args, **kwargs)
            return wrapper
        return decorator

    @contextmanager
    def governed_session(self):
        """Context manager for a governed execution session."""
        # Start session
        session = self.client.client.post(
            f"{self.client.base_url}/v1/session/start",
            json={"agent_id": self.agent_id}
        ).json()

        try:
            yield session
        finally:
            # End session and log all proofs
            self.client.client.post(
                f"{self.client.base_url}/v1/session/end",
                json={
                    "session_id": session["session_id"],
                    "proofs": self.session_proofs
                }
            )

# Usage
client = CognigateClient()
ctx = ConstrainedExecutionContext(client, "agent-123")

@ctx.require_capability("file:read")
def read_user_data(user_id: str) -> dict:
    """This function requires file:read capability."""
    # Implementation
    pass

# Using governed session
with ctx.governed_session() as session:
    data = read_user_data("user-456")
    # All actions in this block are logged and governed
```

---

## Next Steps

- [Getting Started Guide](/implement/getting-started)
- [API Reference](https://cognigate.dev/api)
- [GitHub Repository](https://github.com/voriongit/cognigate)
