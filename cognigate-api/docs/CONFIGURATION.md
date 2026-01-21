# Configuration Reference

Complete configuration guide for Cognigate Engine.

---

## Table of Contents

- [Environment Variables](#environment-variables)
- [Configuration File](#configuration-file)
- [Trust Providers](#trust-providers)
- [AI Providers](#ai-providers)
- [Database Configuration](#database-configuration)
- [Logging Configuration](#logging-configuration)
- [Security Configuration](#security-configuration)
- [Environment Templates](#environment-templates)

---

## Environment Variables

### Core Settings

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `COGNIGATE_ENVIRONMENT` | Runtime environment | `development` | No |
| `COGNIGATE_HOST` | Server bind address | `0.0.0.0` | No |
| `COGNIGATE_PORT` | Server port | `8000` | No |
| `APP_NAME` | Application name | `Cognigate Engine` | No |
| `APP_VERSION` | Application version | `0.1.0` | No |
| `API_PREFIX` | API route prefix | `/v1` | No |

### Trust Provider Settings

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `TRUST_PROVIDER` | Trust score provider | `local` | No |
| `AGENTANCHOR_API_URL` | AgentAnchor API endpoint | - | If using agentanchor |
| `AGENTANCHOR_API_KEY` | AgentAnchor API key | - | If using agentanchor |
| `DEFAULT_TRUST_SCORE` | Default score for local provider | `500` | No |
| `TRUST_CACHE_TTL` | Cache TTL in seconds | `60` | No |

### AI Provider Settings

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `INTENT_PROVIDER` | LLM provider for intent parsing | `openai` | No |
| `OPENAI_API_KEY` | OpenAI API key | - | If using openai |
| `ANTHROPIC_API_KEY` | Anthropic API key | - | If using anthropic |
| `GOOGLE_API_KEY` | Google Gemini API key | - | If using google |
| `LLM_MODEL` | Model to use | `gpt-4-turbo` | No |
| `LLM_TIMEOUT` | Request timeout in seconds | `30` | No |

### Database Settings

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | - | For persistent storage |
| `DATABASE_POOL_SIZE` | Connection pool size | `5` | No |
| `DATABASE_MAX_OVERFLOW` | Max overflow connections | `10` | No |

### Redis Settings

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `REDIS_URL` | Redis connection string | - | For caching |
| `REDIS_PREFIX` | Key prefix | `cognigate:` | No |

### Logging Settings

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `LOG_LEVEL` | Logging level | `INFO` | No |
| `LOG_FORMAT` | Log format | `json` | No |
| `LOG_FILE` | Log file path | - | No |

### Security Settings

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SECRET_KEY` | Application secret key | Auto-generated | Production |
| `ALLOWED_ORIGINS` | CORS allowed origins | `*` | Production |
| `RATE_LIMIT_REQUESTS` | Requests per minute | `100` | No |
| `RATE_LIMIT_WINDOW` | Rate limit window (seconds) | `60` | No |

---

## Configuration File

Cognigate can also be configured via YAML file:

```yaml
# config/cognigate.yaml

server:
  host: 0.0.0.0
  port: 8000
  workers: 4
  environment: production

intent:
  provider: openai
  model: gpt-4-turbo
  timeout: 30
  max_tokens: 2000

enforce:
  trust_provider: agentanchor
  trust_cache_ttl: 60
  default_policy: deny

  agentanchor:
    api_url: https://api.agentanchorai.com/v1
    api_key: ${AGENTANCHOR_API_KEY}

  local_trust:
    default_score: 500
    overrides:
      ag_admin: 900
      ag_test: 300

proof:
  storage: postgres
  retention_days: 2555
  chain_algorithm: sha256
  batch_size: 100

chain:
  enabled: false
  network: polygon
  rpc_url: https://polygon-rpc.com
  contract: "0x..."
  anchor_threshold: high
  batch_interval: 3600

logging:
  level: INFO
  format: json
  file: /var/log/cognigate/app.log

security:
  allowed_origins:
    - https://cognigate.dev
    - https://vorion.org
  rate_limit:
    requests: 100
    window: 60
```

---

## Trust Providers

### Local Provider (Development)

For development and testing without external dependencies:

```bash
TRUST_PROVIDER=local
DEFAULT_TRUST_SCORE=500
```

Or in YAML:

```yaml
enforce:
  trust_provider: local
  local_trust:
    default_score: 500
    overrides:
      ag_trusted_agent: 800
      ag_untrusted_agent: 200
```

### AgentAnchor Provider (Production)

For production with real trust scores:

```bash
TRUST_PROVIDER=agentanchor
AGENTANCHOR_API_URL=https://api.agentanchorai.com/v1
AGENTANCHOR_API_KEY=your_api_key_here
```

Or in YAML:

```yaml
enforce:
  trust_provider: agentanchor
  agentanchor:
    api_url: https://api.agentanchorai.com/v1
    api_key: ${AGENTANCHOR_API_KEY}
    timeout: 10
    cache_ttl: 60
```

### Custom Provider

Implement the `TrustProvider` interface:

```python
# app/providers/custom_trust.py
from app.core.trust import TrustProvider, TrustScore

class CustomTrustProvider(TrustProvider):
    async def get_score(self, agent_id: str) -> TrustScore:
        # Your custom logic
        score = await self.fetch_from_your_system(agent_id)
        return TrustScore(
            composite=score,
            tier=self.calculate_tier(score),
            dimensions={}
        )
```

Register in configuration:

```yaml
enforce:
  trust_provider: custom
  custom:
    class: app.providers.custom_trust.CustomTrustProvider
```

---

## AI Providers

### OpenAI

```bash
INTENT_PROVIDER=openai
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-4-turbo
```

### Anthropic

```bash
INTENT_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
LLM_MODEL=claude-3-opus
```

### Google Gemini

```bash
INTENT_PROVIDER=google
GOOGLE_API_KEY=...
LLM_MODEL=gemini-pro
```

### Local/Disabled

For environments without LLM intent parsing:

```bash
INTENT_PROVIDER=none
```

---

## Database Configuration

### PostgreSQL (Recommended for Production)

```bash
DATABASE_URL=postgresql://user:password@host:5432/cognigate
DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=20
```

### SQLite (Development Only)

```bash
DATABASE_URL=sqlite:///./cognigate.db
```

### Connection Pooling

```yaml
database:
  url: ${DATABASE_URL}
  pool:
    size: 10
    max_overflow: 20
    timeout: 30
    recycle: 3600
```

---

## Logging Configuration

### Log Levels

| Level | Description |
|-------|-------------|
| `DEBUG` | Detailed debugging information |
| `INFO` | General operational information |
| `WARNING` | Warning messages |
| `ERROR` | Error messages |
| `CRITICAL` | Critical failures |

### JSON Format (Production)

```bash
LOG_LEVEL=INFO
LOG_FORMAT=json
```

Output:
```json
{
  "timestamp": "2026-01-20T12:00:00Z",
  "level": "INFO",
  "logger": "cognigate",
  "message": "Gate decision",
  "agent_id": "ag_123",
  "decision": "ALLOW"
}
```

### Console Format (Development)

```bash
LOG_LEVEL=DEBUG
LOG_FORMAT=console
```

Output:
```
2026-01-20 12:00:00 [INFO] Gate decision: agent_id=ag_123 decision=ALLOW
```

---

## Security Configuration

### CORS

```bash
# Single origin
ALLOWED_ORIGINS=https://cognigate.dev

# Multiple origins
ALLOWED_ORIGINS=https://cognigate.dev,https://vorion.org,https://app.cognigate.dev
```

### Rate Limiting

```bash
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60
```

### Secret Key

Generate a secure secret key for production:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Set it:
```bash
SECRET_KEY=your_generated_secret_key
```

---

## Environment Templates

### .env.example

```bash
# ===========================================
# Cognigate Engine Configuration
# ===========================================

# Environment: development | staging | production
COGNIGATE_ENVIRONMENT=development

# Server
COGNIGATE_HOST=0.0.0.0
COGNIGATE_PORT=8000

# ===========================================
# Trust Provider
# ===========================================
# Options: local | agentanchor | custom
TRUST_PROVIDER=local

# AgentAnchor (if TRUST_PROVIDER=agentanchor)
# AGENTANCHOR_API_URL=https://api.agentanchorai.com/v1
# AGENTANCHOR_API_KEY=your_api_key

# Local Trust (if TRUST_PROVIDER=local)
DEFAULT_TRUST_SCORE=500

# ===========================================
# AI Provider (for intent parsing)
# ===========================================
# Options: openai | anthropic | google | none
INTENT_PROVIDER=openai

# OpenAI
OPENAI_API_KEY=sk-your-key-here

# Anthropic (alternative)
# ANTHROPIC_API_KEY=sk-ant-your-key-here

# Google (alternative)
# GOOGLE_API_KEY=your-key-here

# Model settings
LLM_MODEL=gpt-4-turbo
LLM_TIMEOUT=30

# ===========================================
# Database (optional)
# ===========================================
# DATABASE_URL=postgresql://user:password@localhost:5432/cognigate
# DATABASE_POOL_SIZE=5

# ===========================================
# Redis (optional)
# ===========================================
# REDIS_URL=redis://localhost:6379/0

# ===========================================
# Logging
# ===========================================
LOG_LEVEL=INFO
LOG_FORMAT=json

# ===========================================
# Security
# ===========================================
# SECRET_KEY=generate-a-secure-key-for-production
# ALLOWED_ORIGINS=https://cognigate.dev,https://vorion.org

# Rate Limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60
```

### Development Environment

```bash
# .env.development
COGNIGATE_ENVIRONMENT=development
COGNIGATE_HOST=0.0.0.0
COGNIGATE_PORT=8000
TRUST_PROVIDER=local
DEFAULT_TRUST_SCORE=500
INTENT_PROVIDER=openai
OPENAI_API_KEY=sk-dev-key
LOG_LEVEL=DEBUG
LOG_FORMAT=console
```

### Production Environment

```bash
# .env.production
COGNIGATE_ENVIRONMENT=production
COGNIGATE_HOST=0.0.0.0
COGNIGATE_PORT=8000
TRUST_PROVIDER=agentanchor
AGENTANCHOR_API_URL=https://api.agentanchorai.com/v1
AGENTANCHOR_API_KEY=${AGENTANCHOR_API_KEY}
INTENT_PROVIDER=openai
OPENAI_API_KEY=${OPENAI_API_KEY}
DATABASE_URL=${DATABASE_URL}
REDIS_URL=${REDIS_URL}
SECRET_KEY=${SECRET_KEY}
ALLOWED_ORIGINS=https://cognigate.dev,https://vorion.org
LOG_LEVEL=INFO
LOG_FORMAT=json
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60
```

---

## Configuration Priority

Configuration is loaded in this order (later overrides earlier):

1. Default values in code
2. `config/cognigate.yaml` file
3. Environment variables
4. Command-line arguments

---

*For additional help, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md) or the [main documentation](../README.md).*
