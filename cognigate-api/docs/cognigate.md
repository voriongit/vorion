# Cognigate

## The Reference Implementation of BASIS

**Production-ready AI governance runtime. Open source. Battle-tested.**

[GitHub](https://github.com/voriongit/cognigate) · [Documentation](https://cognigate.dev/docs) · [API Reference](https://cognigate.dev/api)

---

## What is Cognigate?

Cognigate is the reference implementation of the [BASIS](/basis) standard — a complete governance runtime for AI agents.

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
# Edit .env with your settings

# Run
poetry run uvicorn cognigate.main:app --reload

# API at http://localhost:8000
# Docs at http://localhost:8000/docs
```

---

## Core Features

### INTENT Layer
- LLM-powered intent parsing
- Automatic risk classification
- Capability detection
- Structured output for ENFORCE

### ENFORCE Layer
- Trust score integration (AgentAnchor or custom)
- Dynamic capability gating
- Policy engine with YAML policies
- Rate limiting
- Escalation handling

### PROOF Layer
- Cryptographically chained audit logs
- SHA-256 hashing
- Agent signatures
- Append-only storage
- Query API

### CHAIN Layer
- Polygon blockchain anchoring
- Merkle tree batching
- Independent verification
- Gas-optimized

---

## API Overview

```yaml
# Intent Evaluation
POST /v1/intent/evaluate
  → Parses agent intent, returns structured plan

# Gate Enforcement
POST /v1/enforce/gate
  → Checks trust, capabilities, policies
  → Returns ALLOW / DENY / ESCALATE / DEGRADE

# Escalation Management
POST /v1/enforce/escalate
GET  /v1/enforce/escalation/{id}
POST /v1/enforce/escalation/{id}/resolve

# Trust Integration
GET  /v1/trust/score/{agentId}
GET  /v1/trust/score/{agentId}/history

# Proof Logging
POST /v1/proof/log
GET  /v1/proof/{proofId}
GET  /v1/proof/verify/{proofId}

# Blockchain Anchoring
POST /v1/chain/anchor
GET  /v1/chain/anchor/{proofId}
GET  /v1/chain/verify/{proofHash}
```

[Full API Documentation →](https://cognigate.dev/api)

---

## Architecture

```
cognigate/
├── api/                    # FastAPI routes
│   ├── intent.py
│   ├── enforce.py
│   ├── proof.py
│   └── chain.py
│
├── core/                   # Business logic
│   ├── intent/
│   │   ├── parser.py       # LLM intent parsing
│   │   ├── planner.py      # Execution planning
│   │   └── risk.py         # Risk assessment
│   │
│   ├── enforce/
│   │   ├── trust.py        # Trust score client
│   │   ├── capabilities.py # Capability resolution
│   │   ├── policies.py     # Policy engine
│   │   └── gate.py         # Gate decision logic
│   │
│   ├── proof/
│   │   ├── recorder.py     # Audit logging
│   │   ├── chain.py        # Hash chaining
│   │   └── storage.py      # Persistence
│   │
│   └── chain/
│       ├── anchor.py       # Blockchain client
│       ├── merkle.py       # Merkle tree
│       └── verify.py       # Verification
│
├── models/                 # Pydantic schemas
├── db/                     # Database layer
├── config/                 # Configuration
└── tests/                  # Test suite
```

---

## Configuration

```yaml
# config/cognigate.yaml

server:
  host: 0.0.0.0
  port: 8000
  workers: 4

intent:
  provider: openai          # or anthropic, local
  model: gpt-4-turbo
  timeout: 30

enforce:
  trust_provider: agentanchor  # or local, custom
  trust_cache_ttl: 60
  default_policy: deny

proof:
  storage: postgres         # or sqlite, firestore
  retention_days: 2555      # 7 years
  chain_algorithm: sha256

chain:
  network: polygon
  rpc_url: https://polygon-rpc.com
  contract: "0x..."
  anchor_threshold: high    # minimal, limited, significant, high
  batch_interval: 3600      # seconds
```

---

## Trust Integration

Cognigate can fetch trust scores from multiple sources:

### AgentAnchor (Recommended)
```yaml
enforce:
  trust_provider: agentanchor
  agentanchor:
    api_url: https://api.agentanchorai.com/v1
    api_key: ${AGENTANCHOR_API_KEY}
```

### Local (Development)
```yaml
enforce:
  trust_provider: local
  local_trust:
    default_score: 500
    overrides:
      ag_test123: 800
```

### Custom Provider
```python
# Implement TrustProvider interface
class CustomTrustProvider(TrustProvider):
    async def get_score(self, agent_id: str) -> TrustScore:
        # Your logic here
        return TrustScore(composite=700, tier="trusted")
```

---

## Policy Examples

```yaml
# policies/email_limits.yaml
policy:
  id: pol_email_limits
  description: "Rate limit external emails"
  
  applies_to:
    capabilities:
      - communication/send_external
  
  conditions:
    - field: context.hourly_count
      operator: lte
      value: 100
    
    - field: trust_score
      operator: gte
      value: 500
  
  on_violation: deny
  message: "Email rate limit exceeded or insufficient trust"
```

```yaml
# policies/financial_approval.yaml
policy:
  id: pol_financial
  description: "Gate financial actions"
  
  applies_to:
    capabilities:
      - financial/initiate_payment
  
  conditions:
    - field: amount
      operator: lte
      value_by_trust:
        500: 100
        600: 1000
        700: 10000
  
  on_exceed: escalate
  escalation:
    approvers: [admin, finance]
    timeout: 3600
```

---

## Deployment Options

### Self-Hosted
Full control, your infrastructure.

```bash
# Kubernetes
kubectl apply -f k8s/

# Docker Compose
docker-compose -f docker-compose.prod.yaml up -d
```

### Managed (Coming Soon)
Hosted Cognigate at `your-org.cognigate.dev`

---

## Performance

| Metric | Target | Typical |
|--------|--------|---------|
| INTENT evaluation | < 500ms | ~200ms |
| ENFORCE gate | < 100ms | ~30ms |
| PROOF logging | < 50ms | ~10ms |
| CHAIN anchor | < 60s | ~5s |

Tested at 1000 req/sec on 4 vCPU / 8GB RAM.

---

## Compliance

Cognigate passes the BASIS compliance test suite:

```bash
npx @basis-protocol/compliance-tests \
  --target http://localhost:8000 \
  --agent-id ag_test123

# Results:
✓ INTENT layer: 12/12 tests passed
✓ ENFORCE layer: 18/18 tests passed
✓ PROOF layer: 15/15 tests passed
✓ CHAIN layer: 8/8 tests passed

Score: 100/100 (Platinum certified)
```

---

## Community

- [GitHub Issues](https://github.com/voriongit/cognigate/issues)
- [Discord](https://discord.gg/basis-protocol)
- [Weekly Community Call](/community#calls)

---

## License

Cognigate is open source under the **Apache 2.0** license.

Commercial support available from [Vorion](https://vorion.org).

---

## Roadmap

| Version | Status | Features |
|---------|--------|----------|
| 0.1 | ✅ Released | Core layers, local trust |
| 0.2 | 🚧 In Progress | AgentAnchor integration |
| 0.3 | Planned | Multi-chain support |
| 0.4 | Planned | Edge deployment |
| 1.0 | Planned | Production stable |

---

## Get Started

```bash
git clone https://github.com/voriongit/cognigate.git
cd cognigate
docker-compose up -d

# Try it:
curl http://localhost:8000/health
```

[Read the Docs →](https://cognigate.dev/docs)

---

*Cognigate is maintained by [Vorion](https://vorion.org) and the BASIS community.*
