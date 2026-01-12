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

## Next Steps

- [Getting Started Guide](/implement/getting-started)
- [API Reference](https://cognigate.dev/api)
- [GitHub Repository](https://github.com/voriongit/cognigate)
