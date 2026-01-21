# Cognigate Engine

**The AI Governance Runtime for the BASIS Standard**

[![License](https://img.shields.io/badge/license-Proprietary-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.11+-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-green.svg)](https://fastapi.tiangolo.com)

Cognigate is VORION's production-ready governance runtime for AI agents. It implements the [BASIS standard](https://vorion.org/basis) through a layered architecture that parses intent, enforces policies, and maintains cryptographic proof chains.

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

## Table of Contents

- [Quick Start](#quick-start)
- [Core Layers](#core-layers)
- [API Endpoints](#api-endpoints)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Related Projects](#related-projects)
- [License](#license)

---

## Quick Start

### Prerequisites

- Python 3.11+
- pip or Poetry

### Installation

```bash
# Clone the repository
git clone https://github.com/voriongit/cognigate.git
cd cognigate-api

# Install dependencies
pip install -r requirements.txt

# Or with Poetry
poetry install
```

### Running

```bash
# Development server with hot reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Production with multiple workers
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Verify Installation

```bash
# Health check
curl http://localhost:8000/health

# Expected response:
# {"status":"healthy","service":"cognigate-engine","version":"0.1.0","timestamp":"..."}
```

### Access Points

| URL | Description |
|-----|-------------|
| http://localhost:8000 | Landing page |
| http://localhost:8000/docs | Interactive API documentation (Swagger) |
| http://localhost:8000/redoc | API documentation (ReDoc) |
| http://localhost:8000/status | System status dashboard |
| http://localhost:8000/health | Health check endpoint |
| http://localhost:8000/openapi.json | OpenAPI specification |

---

## Core Layers

### INTENT Layer
Parses and normalizes agent intentions into structured, evaluable formats.

- LLM-powered intent parsing
- Automatic risk classification
- Capability detection
- Structured output for ENFORCE layer

**Endpoint:** `POST /v1/intent`

### ENFORCE Layer
Evaluates intentions against trust scores and policies to make gate decisions.

- Trust score integration (AgentAnchor, local, or custom)
- Dynamic capability gating
- YAML-based policy engine
- Rate limiting and escalation handling

**Endpoint:** `POST /v1/enforce`

**Decisions:** `ALLOW` | `DENY` | `ESCALATE` | `DEGRADE`

### PROOF Layer
Maintains cryptographically chained audit logs for compliance and forensics.

- SHA-256 hash chaining
- Agent signatures
- Append-only storage
- Query and verification API

**Endpoints:** `POST /v1/proof`, `GET /v1/proof/verify`

### CHAIN Layer (Optional)
Anchors proof records to blockchain for independent verification.

- Polygon blockchain anchoring
- Merkle tree batching
- Gas-optimized transactions

---

## API Endpoints

### Health & Status
```
GET  /health          - Service health check
GET  /ready           - Readiness probe
GET  /status          - Status dashboard (HTML)
```

### Intent
```
POST /v1/intent       - Parse and evaluate agent intent
```

### Enforce
```
POST /v1/enforce      - Gate decision based on trust and policies
```

### Proof
```
POST /v1/proof        - Log action to proof chain
POST /v1/proof/verify - Verify proof authenticity
GET  /v1/proof/{id}   - Retrieve proof record
```

### Admin
```
GET  /v1/admin/stats  - Runtime statistics
```

See [API Documentation](http://localhost:8000/docs) for full request/response schemas.

---

## Configuration

### Environment Variables

Create a `.env` file or set environment variables:

```bash
# Server
COGNIGATE_HOST=0.0.0.0
COGNIGATE_PORT=8000
COGNIGATE_ENVIRONMENT=development

# Trust Provider
TRUST_PROVIDER=local                    # local | agentanchor | custom
AGENTANCHOR_API_URL=https://api.agentanchorai.com/v1
AGENTANCHOR_API_KEY=your_api_key

# AI Provider (for intent parsing)
OPENAI_API_KEY=your_openai_key
# or
ANTHROPIC_API_KEY=your_anthropic_key

# Database (optional, for persistent proof storage)
DATABASE_URL=postgresql://user:pass@localhost:5432/cognigate
```

See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for detailed configuration options.

---

## Project Structure

```
cognigate-api/
├── app/
│   ├── main.py           # FastAPI application entry point
│   ├── config.py         # Configuration management
│   ├── routers/          # API route handlers
│   │   ├── intent.py     # INTENT layer endpoints
│   │   ├── enforce.py    # ENFORCE layer endpoints
│   │   ├── proof.py      # PROOF layer endpoints
│   │   ├── health.py     # Health check endpoints
│   │   └── admin.py      # Admin endpoints
│   ├── core/             # Business logic
│   ├── models/           # Pydantic schemas
│   └── services/         # External service integrations
├── static/
│   ├── index.html        # Landing page
│   └── status.html       # Status dashboard
├── docs/                 # Documentation
│   ├── cognigate.md      # Product overview
│   ├── layers/           # Layer-specific docs
│   ├── INSTALLATION.md   # Installation guide
│   ├── DEPLOYMENT.md     # Deployment guide
│   └── CONFIGURATION.md  # Configuration reference
├── tests/                # Test suite
├── requirements.txt      # Python dependencies
├── pyproject.toml        # Poetry configuration
├── Dockerfile            # Container build
├── docker-compose.yaml   # Local development stack
└── README.md             # This file
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/INSTALLATION.md](docs/INSTALLATION.md) | Detailed installation guide |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production deployment options |
| [docs/CONFIGURATION.md](docs/CONFIGURATION.md) | Configuration reference |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common issues and solutions |
| [docs/cognigate.md](docs/cognigate.md) | Product overview |
| [docs/layers/intent.md](docs/layers/intent.md) | INTENT layer specification |
| [docs/layers/enforce.md](docs/layers/enforce.md) | ENFORCE layer specification |
| [docs/layers/proof.md](docs/layers/proof.md) | PROOF layer specification |
| [CHANGELOG.md](CHANGELOG.md) | Version history |

---

## Development

### Running in Development Mode

```bash
# Install dev dependencies
pip install -r requirements-dev.txt

# Run with hot reload
uvicorn app.main:app --reload

# Run with debug logging
COGNIGATE_ENVIRONMENT=development uvicorn app.main:app --reload
```

### Code Style

```bash
# Format code
black app/
isort app/

# Lint
flake8 app/
mypy app/
```

---

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_intent.py

# Run integration tests
pytest tests/integration/ -v
```

---

## Deployment

### Docker

```bash
# Build image
docker build -t cognigate:latest .

# Run container
docker run -p 8000:8000 cognigate:latest
```

### Docker Compose

```bash
# Development stack
docker-compose up -d

# Production stack
docker-compose -f docker-compose.prod.yaml up -d
```

### Kubernetes

```bash
kubectl apply -f k8s/
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed deployment instructions.

---

## Performance Targets

| Metric | Target | Typical |
|--------|--------|---------|
| INTENT evaluation | < 500ms | ~200ms |
| ENFORCE gate | < 100ms | ~30ms |
| PROOF logging | < 50ms | ~10ms |
| Health check | < 10ms | ~5ms |

---

## Related Projects

| Project | Description | Link |
|---------|-------------|------|
| **VORION** | The Steward of Safe Autonomous Systems | [vorion.org](https://vorion.org) |
| **BASIS** | The behavioral governance standard | [vorion.org/basis](https://vorion.org/basis) |
| **AgentAnchor** | Trust registry and certification | [agentanchorai.com](https://agentanchorai.com) |
| **Cognigate SDK** | TypeScript/Python client libraries | Coming Soon |

---

## Support

- **Documentation:** [cognigate.dev/docs](https://cognigate.dev/docs)
- **Issues:** [GitHub Issues](https://github.com/voriongit/cognigate/issues)
- **Discord:** [VORION Community](https://discord.gg/vorion)

---

## License

Proprietary - VORION

For licensing inquiries, contact [licensing@vorion.org](mailto:licensing@vorion.org).

---

*Cognigate is developed and maintained by [VORION](https://vorion.org) - The Steward of Safe Autonomous Systems.*
