# ATSF v3.0 - Deployment Guide

## Overview

This guide covers deploying ATSF in production environments.

---

## Quick Start (Docker)

```bash
# Clone repository
git clone https://github.com/agentanchor/atsf.git
cd atsf/production

# Set environment variables
cp .env.example .env
# Edit .env with your settings

# Start all services
docker-compose up -d

# Verify deployment
curl http://localhost:8000/health
```

---

## Architecture

```
                    ┌─────────────┐
                    │   Nginx     │
                    │  (Reverse   │
                    │   Proxy)    │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │   API    │    │Dashboard │    │ Grafana  │
    │ :8000    │    │  :3000   │    │  :3001   │
    └────┬─────┘    └──────────┘    └────┬─────┘
         │                               │
         ▼                               ▼
    ┌──────────┐                   ┌──────────┐
    │PostgreSQL│                   │Prometheus│
    │  :5432   │                   │  :9090   │
    └──────────┘                   └──────────┘
         │
         ▼
    ┌──────────┐
    │  Redis   │
    │  :6379   │
    └──────────┘
```

---

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM minimum
- 20GB disk space

---

## Configuration

### Environment Variables

Create a `.env` file:

```bash
# Application
ENVIRONMENT=production
DEBUG=false

# Database
DATABASE_URL=postgresql://atsf:your_secure_password@db:5432/atsf

# Redis
REDIS_URL=redis://redis:6379/0

# Security
JWT_SECRET=your-very-long-secure-secret-key-here
API_WORKERS=4

# Monitoring
LOG_LEVEL=INFO
METRICS_ENABLED=true

# Grafana
GRAFANA_PASSWORD=your_grafana_password
```

### Trust Configuration

Edit `config.yaml`:

```yaml
trust:
  # Ceilings by transparency tier
  ceiling_black_box: 0.40
  ceiling_gray_box: 0.55
  ceiling_white_box: 0.75
  ceiling_attested: 0.90
  
  # Velocity caps
  velocity_cap_per_update: 0.10
  velocity_cap_per_hour: 0.25
  velocity_cap_per_day: 0.50

containment:
  default_level: restricted
  auto_quarantine_threshold: 0.8
```

---

## Deployment Steps

### 1. Prepare Infrastructure

```bash
# Create directories
mkdir -p logs monitoring/grafana/provisioning

# Set permissions
chmod 755 logs
```

### 2. Configure SSL (Optional but Recommended)

```bash
# Generate self-signed certificate (for testing)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/atsf.key \
  -out nginx/ssl/atsf.crt

# Or use Let's Encrypt with certbot
```

### 3. Start Services

```bash
# Pull images
docker-compose pull

# Start services
docker-compose up -d

# Check status
docker-compose ps
```

### 4. Initialize Database

```bash
# Run migrations (if using Alembic)
docker-compose exec api alembic upgrade head

# Create admin API key
docker-compose exec api python -c "
from api.database import init_database
init_database()
print('Database initialized')
"
```

### 5. Verify Deployment

```bash
# Health check
curl http://localhost:8000/health

# Test with demo key
curl http://localhost:8000/stats \
  -H "X-API-Key: demo-key-12345"
```

---

## Production Checklist

### Security

- [ ] Change default passwords
- [ ] Generate strong JWT secret
- [ ] Enable SSL/TLS
- [ ] Configure firewall rules
- [ ] Set up rate limiting
- [ ] Enable audit logging
- [ ] Review CORS settings

### Performance

- [ ] Configure connection pooling
- [ ] Set appropriate worker count
- [ ] Enable Redis caching
- [ ] Configure resource limits
- [ ] Set up horizontal scaling

### Monitoring

- [ ] Configure Prometheus scraping
- [ ] Set up Grafana dashboards
- [ ] Configure alerting rules
- [ ] Set up log aggregation
- [ ] Enable health checks

### Backup

- [ ] Configure database backups
- [ ] Set up backup retention
- [ ] Test restore procedures
- [ ] Document recovery process

---

## Scaling

### Horizontal Scaling

```yaml
# docker-compose.override.yml
services:
  api:
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

### Load Balancing

Configure Nginx upstream:

```nginx
upstream atsf_api {
    least_conn;
    server api1:8000;
    server api2:8000;
    server api3:8000;
}
```

---

## Kubernetes Deployment

### Helm Chart

```bash
# Add helm repo
helm repo add atsf https://charts.agentanchorai.com

# Install
helm install atsf atsf/atsf \
  --set api.replicas=3 \
  --set postgresql.enabled=true \
  --set redis.enabled=true
```

### Kubernetes Manifests

See `k8s/` directory for manifests:
- `deployment.yaml`
- `service.yaml`
- `configmap.yaml`
- `secret.yaml`
- `ingress.yaml`

---

## Monitoring

### Prometheus Metrics

Available at `/metrics`:

```
# Agent metrics
atsf_agents_total{status="active"}
atsf_agents_total{status="quarantined"}

# Trust metrics
atsf_trust_updates_total
atsf_trust_score{agent_id="..."}

# Action metrics
atsf_actions_processed_total
atsf_actions_blocked_total

# Assessment metrics
atsf_assessments_total
atsf_threats_detected_total{level="critical"}
```

### Grafana Dashboards

Import dashboards from `monitoring/grafana/dashboards/`:
- ATSF Overview
- Agent Health
- Security Events
- Performance

### Alerting

Example Prometheus alert:

```yaml
groups:
  - name: atsf
    rules:
      - alert: HighThreatLevel
        expr: atsf_threats_detected_total{level="critical"} > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Critical threat detected"
```

---

## Troubleshooting

### Common Issues

**API not responding:**
```bash
# Check logs
docker-compose logs api

# Restart service
docker-compose restart api
```

**Database connection failed:**
```bash
# Check database
docker-compose exec db psql -U atsf -c "SELECT 1"

# Check connection string
echo $DATABASE_URL
```

**Redis connection issues:**
```bash
# Test Redis
docker-compose exec redis redis-cli ping
```

### Log Locations

- API logs: `./logs/api.log`
- Nginx logs: `./logs/nginx/`
- PostgreSQL logs: Docker volume

---

## Maintenance

### Backup Database

```bash
# Create backup
docker-compose exec db pg_dump -U atsf atsf > backup.sql

# Restore
docker-compose exec -T db psql -U atsf atsf < backup.sql
```

### Update Services

```bash
# Pull latest images
docker-compose pull

# Rolling update
docker-compose up -d --no-deps --build api
```

### Rotate API Keys

```bash
# Via API
curl -X POST http://localhost:8000/admin/api-keys \
  -H "X-API-Key: admin-key" \
  -d '{"name": "new-key", "role": "admin"}'
```

---

## Support

- Documentation: https://docs.agentanchorai.com/atsf
- Issues: https://github.com/agentanchor/atsf/issues
- Email: support@agentanchorai.com
