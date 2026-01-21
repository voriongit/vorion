# Troubleshooting Guide

Common issues and solutions for Cognigate Engine.

---

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Installation Issues](#installation-issues)
- [Runtime Issues](#runtime-issues)
- [API Errors](#api-errors)
- [Performance Issues](#performance-issues)
- [Trust Provider Issues](#trust-provider-issues)
- [Database Issues](#database-issues)
- [Error Code Reference](#error-code-reference)
- [Getting Help](#getting-help)

---

## Quick Diagnostics

### Health Check

```bash
curl http://localhost:8000/health
```

**Expected:** `{"status": "healthy", ...}`

If this fails, check:
1. Is the server running? `ps aux | grep uvicorn`
2. Is the port correct? Check `COGNIGATE_PORT`
3. Is there a firewall blocking? Check port 8000

### Readiness Check

```bash
curl http://localhost:8000/ready
```

**Expected:** `{"status": "ready"}`

### View Logs

```bash
# Docker
docker logs cognigate

# Docker Compose
docker-compose logs -f cognigate

# Direct
tail -f /var/log/cognigate/app.log
```

---

## Installation Issues

### Python Version Mismatch

**Error:**
```
ERROR: This project requires Python 3.11+
```

**Solution:**
```bash
# Check Python version
python --version

# Install Python 3.11+
# Ubuntu/Debian
sudo apt install python3.11 python3.11-venv

# macOS
brew install python@3.11

# Use specific version
python3.11 -m venv venv
source venv/bin/activate
```

### Dependency Installation Fails

**Error:**
```
ERROR: Could not find a version that satisfies the requirement
```

**Solution:**
```bash
# Upgrade pip
pip install --upgrade pip

# Clear cache and retry
pip cache purge
pip install -r requirements.txt --no-cache-dir

# Install with verbose output
pip install -r requirements.txt -v
```

### Permission Denied

**Error:**
```
PermissionError: [Errno 13] Permission denied
```

**Solution:**
```bash
# Linux/macOS
chmod +x venv/bin/activate
source venv/bin/activate

# Or use --user flag
pip install --user -r requirements.txt
```

### Module Not Found

**Error:**
```
ModuleNotFoundError: No module named 'app'
```

**Solution:**
```bash
# Ensure you're in the correct directory
cd cognigate-api

# Ensure virtual environment is activated
source venv/bin/activate

# Reinstall
pip install -e .
```

---

## Runtime Issues

### Port Already in Use

**Error:**
```
ERROR: [Errno 98] Address already in use
```

**Solution:**
```bash
# Find process using port
lsof -i :8000           # Linux/macOS
netstat -ano | findstr :8000  # Windows

# Kill the process
kill -9 <PID>

# Or use a different port
uvicorn app.main:app --port 8001
```

### Server Won't Start

**Error:**
```
ERROR: Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
[then immediately exits]
```

**Solution:**
```bash
# Run with verbose output
uvicorn app.main:app --reload --log-level debug

# Check for import errors
python -c "from app.main import app; print('OK')"
```

### Configuration Not Loading

**Error:**
```
WARNING: Using default configuration
```

**Solution:**
```bash
# Check .env file exists
ls -la .env

# Check environment variables
env | grep COGNIGATE

# Verify file format (no spaces around =)
cat .env
# Correct: COGNIGATE_PORT=8000
# Wrong:   COGNIGATE_PORT = 8000
```

---

## API Errors

### 400 Bad Request

**Cause:** Invalid request body or missing required fields.

**Example:**
```json
{
  "detail": [
    {
      "loc": ["body", "agent_id"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

**Solution:**
Check your request matches the expected schema. Required fields:
- `/v1/intent`: `action`, `resource`, `agent_id`
- `/v1/enforce`: `action`, `resource`, `agent_id`, `context`
- `/v1/proof`: `agent_id`, `action`, `decision`

### 401 Unauthorized

**Cause:** Missing or invalid API key.

**Solution:**
```bash
# Check API key is set
echo $AGENTANCHOR_API_KEY

# Verify key format
curl -H "Authorization: Bearer $API_KEY" http://localhost:8000/v1/intent
```

### 404 Not Found

**Cause:** Endpoint doesn't exist or wrong path.

**Solution:**
Check available endpoints at http://localhost:8000/docs

Common mistakes:
- `/intent` → should be `/v1/intent`
- `/api/v1/intent` → should be `/v1/intent`

### 422 Unprocessable Entity

**Cause:** Request body has correct structure but invalid values.

**Example:**
```json
{
  "detail": [
    {
      "loc": ["body", "trust_score"],
      "msg": "ensure this value is less than or equal to 1000",
      "type": "value_error.number.not_le"
    }
  ]
}
```

**Solution:**
Check value constraints in API documentation.

### 500 Internal Server Error

**Cause:** Server-side error.

**Solution:**
```bash
# Check server logs
docker logs cognigate

# Enable debug mode
COGNIGATE_ENVIRONMENT=development uvicorn app.main:app --reload
```

Common causes:
- Database connection failed
- External service (AgentAnchor, OpenAI) unreachable
- Configuration error

---

## Performance Issues

### Slow Response Times

**Symptoms:** API responses taking > 1 second

**Diagnosis:**
```bash
# Check endpoint timing
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:8000/health
```

**Solutions:**

1. **INTENT layer slow** (> 500ms)
   - Check LLM provider status
   - Reduce `LLM_TIMEOUT`
   - Consider caching

2. **ENFORCE layer slow** (> 100ms)
   - Check trust provider connection
   - Increase `TRUST_CACHE_TTL`
   - Check database performance

3. **PROOF layer slow** (> 50ms)
   - Check database write performance
   - Consider async logging

### High Memory Usage

**Symptoms:** Container/process using excessive RAM

**Solutions:**
```bash
# Limit workers
uvicorn app.main:app --workers 2

# Docker memory limit
docker run -m 1g cognigate:latest
```

### Connection Timeouts

**Symptoms:** Requests timing out

**Solutions:**
```bash
# Increase timeout
uvicorn app.main:app --timeout-keep-alive 30

# Check external service timeouts
LLM_TIMEOUT=60
TRUST_CACHE_TTL=120
```

---

## Trust Provider Issues

### AgentAnchor Connection Failed

**Error:**
```
ERROR: Failed to connect to AgentAnchor API
```

**Solutions:**
```bash
# Verify API URL
curl $AGENTANCHOR_API_URL/health

# Check API key
curl -H "Authorization: Bearer $AGENTANCHOR_API_KEY" \
  $AGENTANCHOR_API_URL/v1/trust/score/ag_test

# Fall back to local
TRUST_PROVIDER=local
```

### Trust Score Not Found

**Error:**
```json
{
  "error": "Agent not registered",
  "agent_id": "ag_unknown"
}
```

**Solution:**
Register the agent with AgentAnchor or use local trust with defaults:
```bash
TRUST_PROVIDER=local
DEFAULT_TRUST_SCORE=500
```

### Invalid Trust Score

**Error:**
```json
{
  "error": "Trust score out of range",
  "score": -100
}
```

**Solution:**
Trust scores must be 0-1000. Check your custom provider implementation.

---

## Database Issues

### Connection Refused

**Error:**
```
ERROR: connection refused to database
```

**Solutions:**
```bash
# Check database is running
docker ps | grep postgres

# Verify connection string
psql $DATABASE_URL -c "SELECT 1"

# Check host/port
nc -zv localhost 5432
```

### Migration Errors

**Error:**
```
ERROR: relation "proofs" does not exist
```

**Solution:**
```bash
# Run migrations
alembic upgrade head

# Or initialize database
python -c "from app.db import init_db; init_db()"
```

### Pool Exhausted

**Error:**
```
ERROR: QueuePool limit reached
```

**Solutions:**
```bash
# Increase pool size
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=30

# Check for connection leaks
# Ensure async with blocks are properly closed
```

---

## Error Code Reference

### E1xxx - INTENT Layer Errors

| Code | Message | Solution |
|------|---------|----------|
| E1001 | Intent parsing failed | Check LLM provider configuration |
| E1002 | Invalid action format | Use valid action: read, write, execute, etc. |
| E1003 | Resource not specified | Include `resource` in request |
| E1010 | LLM timeout | Increase `LLM_TIMEOUT` or retry |
| E1011 | LLM rate limited | Reduce request rate or upgrade plan |

### E2xxx - ENFORCE Layer Errors

| Code | Message | Solution |
|------|---------|----------|
| E2001 | Trust provider unavailable | Check provider connection |
| E2002 | Agent not registered | Register agent or use local trust |
| E2003 | Policy evaluation failed | Check policy syntax |
| E2010 | Capability denied | Agent lacks required capability |
| E2011 | Trust score too low | Agent needs higher trust level |
| E2020 | Rate limit exceeded | Wait before retrying |
| E2030 | Escalation required | Human approval needed |

### E3xxx - PROOF Layer Errors

| Code | Message | Solution |
|------|---------|----------|
| E3001 | Proof creation failed | Check database connection |
| E3002 | Invalid proof ID | Use valid UUID format |
| E3003 | Proof not found | ID doesn't exist |
| E3010 | Chain verification failed | Proof chain corrupted |
| E3011 | Signature invalid | Proof tampered |

### E4xxx - CHAIN Layer Errors

| Code | Message | Solution |
|------|---------|----------|
| E4001 | Blockchain unavailable | Check RPC connection |
| E4002 | Transaction failed | Check gas, retry |
| E4010 | Anchor not found | Proof not yet anchored |

---

## Getting Help

### Self-Service

1. Check this troubleshooting guide
2. Review [API documentation](http://localhost:8000/docs)
3. Search [GitHub Issues](https://github.com/voriongit/cognigate/issues)

### Community Support

- **Discord:** [VORION Community](https://discord.gg/vorion)
- **GitHub Discussions:** [voriongit/cognigate/discussions](https://github.com/voriongit/cognigate/discussions)

### Enterprise Support

Contact support@vorion.org for:
- Priority support
- Custom integrations
- Training and consulting

### Reporting Issues

When reporting issues, include:

1. **Environment:**
   ```bash
   python --version
   pip show fastapi uvicorn
   echo $COGNIGATE_ENVIRONMENT
   ```

2. **Request that failed:**
   ```bash
   curl -v http://localhost:8000/v1/intent \
     -H "Content-Type: application/json" \
     -d '{"action": "...", ...}'
   ```

3. **Error response:**
   ```json
   {"error": "...", "code": "E1001"}
   ```

4. **Relevant logs:**
   ```bash
   docker logs cognigate --tail 50
   ```

---

*For additional help, see the [main documentation](../README.md) or contact support.*
