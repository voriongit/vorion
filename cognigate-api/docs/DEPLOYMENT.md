# Deployment Guide

Production deployment options for Cognigate Engine.

---

## Table of Contents

- [Deployment Options](#deployment-options)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Cloud Deployments](#cloud-deployments)
- [Reverse Proxy Setup](#reverse-proxy-setup)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Environment Configuration](#environment-configuration)
- [Health Checks & Monitoring](#health-checks--monitoring)
- [Scaling](#scaling)
- [Security Hardening](#security-hardening)
- [Backup & Recovery](#backup--recovery)

---

## Deployment Options

| Option | Best For | Complexity |
|--------|----------|------------|
| Docker Compose | Small deployments, development | Low |
| Kubernetes | Production, high availability | Medium |
| AWS ECS/Fargate | AWS-native teams | Medium |
| Google Cloud Run | Serverless, auto-scaling | Low |
| Azure Container Apps | Azure-native teams | Medium |
| Self-hosted (systemd) | Maximum control | Medium |

---

## Docker Deployment

### Production Docker Compose

```yaml
# docker-compose.prod.yaml
version: '3.8'

services:
  cognigate:
    image: voriongit/cognigate:latest
    ports:
      - "8000:8000"
    environment:
      - COGNIGATE_ENVIRONMENT=production
      - COGNIGATE_HOST=0.0.0.0
      - COGNIGATE_PORT=8000
      - TRUST_PROVIDER=agentanchor
      - AGENTANCHOR_API_URL=https://api.agentanchorai.com/v1
      - AGENTANCHOR_API_KEY=${AGENTANCHOR_API_KEY}
      - DATABASE_URL=postgresql://cognigate:${DB_PASSWORD}@postgres:5432/cognigate
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: cognigate
      POSTGRES_USER: cognigate
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cognigate"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: always

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    restart: always

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - cognigate
    restart: always

volumes:
  postgres_data:
  redis_data:
```

### Running Production Stack

```bash
# Create .env file
cat > .env << EOF
DB_PASSWORD=your_secure_password
AGENTANCHOR_API_KEY=your_api_key
EOF

# Start services
docker-compose -f docker-compose.prod.yaml up -d

# View logs
docker-compose -f docker-compose.prod.yaml logs -f

# Scale Cognigate instances
docker-compose -f docker-compose.prod.yaml up -d --scale cognigate=3
```

---

## Kubernetes Deployment

### Namespace and ConfigMap

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: cognigate

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cognigate-config
  namespace: cognigate
data:
  COGNIGATE_ENVIRONMENT: "production"
  COGNIGATE_HOST: "0.0.0.0"
  COGNIGATE_PORT: "8000"
  TRUST_PROVIDER: "agentanchor"
  AGENTANCHOR_API_URL: "https://api.agentanchorai.com/v1"
```

### Secrets

```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: cognigate-secrets
  namespace: cognigate
type: Opaque
stringData:
  AGENTANCHOR_API_KEY: "your_api_key"
  DATABASE_URL: "postgresql://user:pass@postgres:5432/cognigate"
```

### Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cognigate
  namespace: cognigate
spec:
  replicas: 3
  selector:
    matchLabels:
      app: cognigate
  template:
    metadata:
      labels:
        app: cognigate
    spec:
      containers:
      - name: cognigate
        image: voriongit/cognigate:latest
        ports:
        - containerPort: 8000
        envFrom:
        - configMapRef:
            name: cognigate-config
        - secretRef:
            name: cognigate-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Service and Ingress

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: cognigate
  namespace: cognigate
spec:
  selector:
    app: cognigate
  ports:
  - port: 80
    targetPort: 8000
  type: ClusterIP

---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: cognigate
  namespace: cognigate
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - cognigate.dev
    secretName: cognigate-tls
  rules:
  - host: cognigate.dev
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: cognigate
            port:
              number: 80
```

### Deploy to Kubernetes

```bash
# Apply all manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n cognigate
kubectl get services -n cognigate

# View logs
kubectl logs -f deployment/cognigate -n cognigate

# Scale deployment
kubectl scale deployment cognigate --replicas=5 -n cognigate
```

---

## Cloud Deployments

### AWS ECS/Fargate

```bash
# Create cluster
aws ecs create-cluster --cluster-name cognigate-cluster

# Register task definition
aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json

# Create service
aws ecs create-service \
  --cluster cognigate-cluster \
  --service-name cognigate \
  --task-definition cognigate:1 \
  --desired-count 3 \
  --launch-type FARGATE
```

### Google Cloud Run

```bash
# Build and push image
gcloud builds submit --tag gcr.io/PROJECT_ID/cognigate

# Deploy
gcloud run deploy cognigate \
  --image gcr.io/PROJECT_ID/cognigate \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "COGNIGATE_ENVIRONMENT=production"
```

### Azure Container Apps

```bash
# Create environment
az containerapp env create \
  --name cognigate-env \
  --resource-group cognigate-rg \
  --location eastus

# Deploy
az containerapp create \
  --name cognigate \
  --resource-group cognigate-rg \
  --environment cognigate-env \
  --image voriongit/cognigate:latest \
  --target-port 8000 \
  --ingress external
```

---

## Reverse Proxy Setup

### Nginx Configuration

```nginx
# nginx.conf
upstream cognigate {
    least_conn;
    server cognigate:8000;
    # Add more servers for load balancing
    # server cognigate2:8000;
    # server cognigate3:8000;
}

server {
    listen 80;
    server_name cognigate.dev;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name cognigate.dev;

    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://cognigate;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    location /v1/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://cognigate;
    }
}
```

---

## SSL/TLS Configuration

### Using Let's Encrypt with Certbot

```bash
# Install certbot
apt install certbot python3-certbot-nginx

# Obtain certificate
certbot --nginx -d cognigate.dev

# Auto-renewal (add to crontab)
0 0 * * * certbot renew --quiet
```

### Using cert-manager (Kubernetes)

```yaml
# k8s/cluster-issuer.yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@vorion.org
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

---

## Environment Configuration

### Production Environment Variables

```bash
# Required
COGNIGATE_ENVIRONMENT=production
COGNIGATE_HOST=0.0.0.0
COGNIGATE_PORT=8000

# Trust Provider
TRUST_PROVIDER=agentanchor
AGENTANCHOR_API_URL=https://api.agentanchorai.com/v1
AGENTANCHOR_API_KEY=your_api_key

# Database
DATABASE_URL=postgresql://user:pass@host:5432/cognigate

# Redis (optional, for caching)
REDIS_URL=redis://host:6379/0

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json

# Security
SECRET_KEY=your_secret_key_here
ALLOWED_ORIGINS=https://cognigate.dev,https://vorion.org

# AI Provider (if using LLM intent parsing)
OPENAI_API_KEY=your_openai_key
```

---

## Health Checks & Monitoring

### Endpoints

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `GET /health` | Liveness probe | `{"status": "healthy"}` |
| `GET /ready` | Readiness probe | `{"status": "ready"}` |

### Prometheus Metrics (coming soon)

```yaml
# prometheus.yaml
scrape_configs:
  - job_name: 'cognigate'
    static_configs:
      - targets: ['cognigate:8000']
    metrics_path: /metrics
```

### Logging

Cognigate uses structured JSON logging in production:

```json
{
  "timestamp": "2026-01-20T12:00:00Z",
  "level": "INFO",
  "logger": "cognigate",
  "message": "Gate decision",
  "agent_id": "ag_123",
  "decision": "ALLOW",
  "latency_ms": 32
}
```

---

## Scaling

### Horizontal Scaling

```bash
# Docker Compose
docker-compose up -d --scale cognigate=5

# Kubernetes
kubectl scale deployment cognigate --replicas=10 -n cognigate

# AWS ECS
aws ecs update-service --cluster cognigate-cluster --service cognigate --desired-count 10
```

### Auto-scaling (Kubernetes)

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: cognigate
  namespace: cognigate
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: cognigate
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

---

## Security Hardening

### Checklist

- [ ] Use HTTPS everywhere
- [ ] Set secure headers (HSTS, CSP, X-Frame-Options)
- [ ] Enable rate limiting
- [ ] Use secrets management (Vault, AWS Secrets Manager)
- [ ] Run as non-root user
- [ ] Enable network policies (Kubernetes)
- [ ] Regular security updates
- [ ] API key rotation
- [ ] Audit logging enabled

### Docker Security

```dockerfile
# Run as non-root
FROM python:3.11-slim
RUN useradd -m -u 1000 cognigate
USER cognigate
```

---

## Backup & Recovery

### Database Backup

```bash
# PostgreSQL backup
pg_dump -h localhost -U cognigate cognigate > backup.sql

# Automated backup script
0 2 * * * pg_dump -h localhost -U cognigate cognigate | gzip > /backups/cognigate-$(date +\%Y\%m\%d).sql.gz
```

### Recovery

```bash
# Restore database
psql -h localhost -U cognigate cognigate < backup.sql
```

---

## Deployment Checklist

### Pre-deployment

- [ ] Environment variables configured
- [ ] Secrets stored securely
- [ ] SSL certificates ready
- [ ] Database provisioned
- [ ] Health checks tested
- [ ] Monitoring configured

### Post-deployment

- [ ] Verify `/health` returns 200
- [ ] Verify `/ready` returns 200
- [ ] Test API endpoints
- [ ] Check logs for errors
- [ ] Verify SSL certificate
- [ ] Test from external network

---

*For additional help, see the [main documentation](../README.md) or contact support@vorion.org.*
