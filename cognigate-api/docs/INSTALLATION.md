# Installation Guide

Complete installation instructions for Cognigate Engine.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Install](#quick-install)
- [Docker Installation](#docker-installation)
- [Source Installation](#source-installation)
- [Verifying Installation](#verifying-installation)
- [Next Steps](#next-steps)

---

## Prerequisites

### Required

| Requirement | Minimum Version | Recommended |
|-------------|-----------------|-------------|
| Python | 3.11+ | 3.12 |
| pip | 21.0+ | Latest |

### Optional (for full features)

| Requirement | Purpose |
|-------------|---------|
| Docker | Containerized deployment |
| PostgreSQL | Persistent proof storage |
| Redis | Caching and rate limiting |
| OpenAI/Anthropic API key | LLM-powered intent parsing |

---

## Quick Install

For the fastest setup:

```bash
# Clone repository
git clone https://github.com/voriongit/cognigate.git
cd cognigate-api

# Install dependencies
pip install -r requirements.txt

# Run
uvicorn app.main:app --reload
```

Cognigate is now running at http://localhost:8000

---

## Docker Installation

### Using Docker Compose (Recommended)

```bash
# Clone repository
git clone https://github.com/voriongit/cognigate.git
cd cognigate-api

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f cognigate
```

### Using Docker Directly

```bash
# Build image
docker build -t cognigate:latest .

# Run container
docker run -d \
  --name cognigate \
  -p 8000:8000 \
  -e COGNIGATE_ENVIRONMENT=production \
  cognigate:latest

# Check status
docker ps
docker logs cognigate
```

### Docker Compose Configuration

```yaml
# docker-compose.yaml
version: '3.8'

services:
  cognigate:
    build: .
    ports:
      - "8000:8000"
    environment:
      - COGNIGATE_ENVIRONMENT=development
      - TRUST_PROVIDER=local
    volumes:
      - ./app:/app/app:ro
    restart: unless-stopped

  # Optional: PostgreSQL for persistent storage
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: cognigate
      POSTGRES_USER: cognigate
      POSTGRES_PASSWORD: changeme
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  # Optional: Redis for caching
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

---

## Source Installation

### Step 1: Clone Repository

```bash
git clone https://github.com/voriongit/cognigate.git
cd cognigate-api
```

### Step 2: Create Virtual Environment

```bash
# Using venv
python -m venv venv

# Activate (Linux/macOS)
source venv/bin/activate

# Activate (Windows)
.\venv\Scripts\activate
```

### Step 3: Install Dependencies

```bash
# Production dependencies
pip install -r requirements.txt

# Development dependencies (optional)
pip install -r requirements-dev.txt
```

### Step 4: Configure Environment

```bash
# Copy example configuration
cp .env.example .env

# Edit configuration
nano .env
```

Minimum configuration:

```bash
# .env
COGNIGATE_ENVIRONMENT=development
COGNIGATE_HOST=0.0.0.0
COGNIGATE_PORT=8000
TRUST_PROVIDER=local
```

### Step 5: Run the Server

```bash
# Development mode (with hot reload)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Production mode
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## Using Poetry (Alternative)

If you prefer Poetry for dependency management:

```bash
# Install Poetry
curl -sSL https://install.python-poetry.org | python3 -

# Install dependencies
poetry install

# Activate environment
poetry shell

# Run server
poetry run uvicorn app.main:app --reload
```

---

## Verifying Installation

### 1. Health Check

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "cognigate-engine",
  "version": "0.1.0",
  "timestamp": "2026-01-20T12:00:00Z"
}
```

### 2. Readiness Check

```bash
curl http://localhost:8000/ready
```

Expected response:
```json
{
  "status": "ready"
}
```

### 3. API Documentation

Open in browser: http://localhost:8000/docs

You should see the Swagger UI with all available endpoints.

### 4. Landing Page

Open in browser: http://localhost:8000

You should see the Cognigate landing page with interactive playground.

### 5. Test Intent Endpoint

```bash
curl -X POST http://localhost:8000/v1/intent \
  -H "Content-Type: application/json" \
  -d '{
    "action": "read",
    "resource": "test_file.txt",
    "agent_id": "ag_test123"
  }'
```

---

## Troubleshooting Installation

### Port Already in Use

```bash
# Find process using port 8000
lsof -i :8000  # Linux/macOS
netstat -ano | findstr :8000  # Windows

# Use different port
uvicorn app.main:app --port 8001
```

### Module Not Found

```bash
# Ensure virtual environment is activated
source venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

### Permission Denied

```bash
# Linux/macOS: Ensure execute permissions
chmod +x venv/bin/activate

# Windows: Run as Administrator or check antivirus
```

### Python Version Issues

```bash
# Check Python version
python --version

# Use specific Python version
python3.11 -m venv venv
```

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for more solutions.

---

## Next Steps

1. **Configure** - Set up your environment in [CONFIGURATION.md](CONFIGURATION.md)
2. **Explore** - Try the API at http://localhost:8000/docs
3. **Deploy** - Follow [DEPLOYMENT.md](DEPLOYMENT.md) for production setup
4. **Integrate** - Connect to AgentAnchor for trust scores

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `pip install -r requirements.txt` | Install dependencies |
| `uvicorn app.main:app --reload` | Run dev server |
| `docker-compose up -d` | Run with Docker |
| `curl localhost:8000/health` | Check health |

---

*For additional help, see the [main documentation](../README.md) or open an issue on GitHub.*
