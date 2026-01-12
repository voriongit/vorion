# Vorion Platform Operations Runbook

**Platform Team Operations Guide**

Version 1.0 | 2026-01-08 | Internal Use Only

---

## Purpose

This runbook provides the Vorion Platform Team with standardized procedures for operating, monitoring, troubleshooting, and maintaining the Vorion platform. It is the primary reference for on-call engineers, SREs, and platform operators.

---

## Table of Contents

1. [Quick Reference](#1-quick-reference)
2. [On-Call Procedures](#2-on-call-procedures)
3. [System Architecture](#3-system-architecture)
4. [Health Checks & Monitoring](#4-health-checks--monitoring)
5. [Incident Response Playbooks](#5-incident-response-playbooks)
6. [Common Operational Tasks](#6-common-operational-tasks)
7. [Troubleshooting Guide](#7-troubleshooting-guide)
8. [Deployment Procedures](#8-deployment-procedures)
9. [Scaling Operations](#9-scaling-operations)
10. [Backup & Recovery](#10-backup--recovery)
11. [Security Operations](#11-security-operations)
12. [Maintenance Windows](#12-maintenance-windows)
13. [Vendor & Dependency Management](#13-vendor--dependency-management)
14. [Communication Templates](#14-communication-templates)
15. [Appendices](#appendices)

---

## 1. Quick Reference

### Emergency Contacts

| Role | Name | Phone | Slack |
|------|------|-------|-------|
| On-Call Primary | Rotation | +1-XXX-XXX-XXXX | @oncall-primary |
| On-Call Secondary | Rotation | +1-XXX-XXX-XXXX | @oncall-secondary |
| Engineering Manager | [Name] | +1-XXX-XXX-XXXX | @eng-manager |
| CISO | [Name] | +1-XXX-XXX-XXXX | @ciso |
| VP Engineering | [Name] | +1-XXX-XXX-XXXX | @vp-eng |
| AWS TAM | [Name] | +1-XXX-XXX-XXXX | N/A |

### Critical URLs

| System | URL | Purpose |
|--------|-----|---------|
| Production API | https://api.vorion.io | Main API endpoint |
| Status Page | https://status.vorion.io | Public status |
| Grafana | https://grafana.internal.vorion.io | Metrics dashboards |
| PagerDuty | https://vorion.pagerduty.com | Alerting |
| Datadog | https://app.datadoghq.com | APM & logs |
| AWS Console | https://console.aws.amazon.com | Infrastructure |
| Kubernetes | https://k8s.internal.vorion.io | Cluster management |
| ArgoCD | https://argocd.internal.vorion.io | Deployments |
| Vault | https://vault.internal.vorion.io | Secrets |

### Critical Commands Cheat Sheet

```bash
# Check cluster health
kubectl get nodes -o wide
kubectl get pods -n vorion-prod --field-selector=status.phase!=Running

# Check service health
curl -s https://api.vorion.io/v1/health | jq

# View logs
kubectl logs -n vorion-prod -l app=intent-service --tail=100 -f

# Restart a service
kubectl rollout restart deployment/intent-service -n vorion-prod

# Scale a service
kubectl scale deployment/intent-service -n vorion-prod --replicas=10

# Check database connections
kubectl exec -n vorion-prod deploy/intent-service -- \
  psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Emergency circuit breaker
kubectl set env deployment/api-gateway -n vorion-prod CIRCUIT_BREAKER=true
```

### Severity Definitions

| Severity | Definition | Response Time | Examples |
|----------|------------|---------------|----------|
| **SEV-1** | Complete outage, data loss risk | 15 min | API down, DB corruption |
| **SEV-2** | Major degradation, partial outage | 30 min | High latency, region down |
| **SEV-3** | Minor degradation, workaround exists | 2 hours | Single service issues |
| **SEV-4** | Low impact, scheduled work | Next business day | Performance tuning |

---

## 2. On-Call Procedures

### On-Call Rotation

```
┌─────────────────────────────────────────────────────────────────┐
│                    ON-CALL STRUCTURE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PRIMARY ON-CALL                                                │
│  └── First responder for all alerts                            │
│      └── Rotation: Weekly (Mon 9AM - Mon 9AM)                  │
│                                                                 │
│  SECONDARY ON-CALL                                              │
│  └── Backup if primary unavailable                             │
│      └── Escalation after 15 min no response                   │
│                                                                 │
│  ESCALATION MANAGER                                             │
│  └── Engineering manager on rotation                           │
│      └── Escalation for SEV-1/SEV-2                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### On-Call Handoff Checklist

**Outgoing On-Call:**
- [ ] Document all open incidents
- [ ] Update incident tickets with current status
- [ ] Note any ongoing maintenance or deployments
- [ ] Flag any systems requiring extra attention
- [ ] Verify monitoring is healthy
- [ ] Post handoff summary in #oncall-handoff

**Incoming On-Call:**
- [ ] Review handoff notes
- [ ] Check open incidents/tickets
- [ ] Verify PagerDuty contact info
- [ ] Test notification delivery
- [ ] Review recent deployments
- [ ] Check scheduled maintenance

### Alert Response Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    ALERT RESPONSE FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ALERT FIRES                                                    │
│      │                                                          │
│      ▼                                                          │
│  ACKNOWLEDGE (5 min SLA)                                        │
│      │                                                          │
│      ▼                                                          │
│  ASSESS SEVERITY ──────────────────────┐                       │
│      │                                  │                       │
│      ▼                                  ▼                       │
│  SEV-1/SEV-2                       SEV-3/SEV-4                  │
│      │                                  │                       │
│      ▼                                  ▼                       │
│  START INCIDENT                    INVESTIGATE                  │
│  OPEN BRIDGE                       FIX OR TICKET                │
│  PAGE ESCALATION                   DOCUMENT                     │
│      │                                  │                       │
│      ▼                                  ▼                       │
│  MITIGATE ◄─────────────────────── RESOLVE                     │
│      │                                                          │
│      ▼                                                          │
│  RESOLVE                                                        │
│      │                                                          │
│      ▼                                                          │
│  POST-MORTEM (SEV-1/2 only)                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Escalation Matrix

| Condition | Action | Contact |
|-----------|--------|---------|
| No ACK in 5 min | Page secondary | @oncall-secondary |
| No ACK in 15 min | Page manager | @eng-manager |
| SEV-1 declared | Page manager + VP | @vp-eng |
| Security incident | Page CISO | @ciso |
| Customer impact | Notify CS lead | @cs-lead |
| PR/reputation risk | Notify comms | @comms |

---

## 3. System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    VORION PLATFORM ARCHITECTURE                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  INTERNET                                                       │
│      │                                                          │
│      ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ CLOUDFLARE: CDN, DDoS, WAF                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│      │                                                          │
│      ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ AWS ALB: Load Balancing, TLS Termination                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│      │                                                          │
│      ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ KUBERNETES CLUSTER (EKS)                                 │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │
│  │  │   API   │ │ INTENT  │ │ ENFORCE │ │COGNIGATE│       │   │
│  │  │ GATEWAY │ │ SERVICE │ │ SERVICE │ │ RUNTIME │       │   │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘       │   │
│  │       │           │           │           │             │   │
│  │  ┌────┴───────────┴───────────┴───────────┴────┐       │   │
│  │  │              SERVICE MESH (Istio)            │       │   │
│  │  └──────────────────────────────────────────────┘       │   │
│  └─────────────────────────────────────────────────────────┘   │
│      │                                                          │
│      ▼                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ POSTGRESQL   │ │    REDIS     │ │   KAFKA      │            │
│  │ (RDS Aurora) │ │ (ElastiCache)│ │   (MSK)      │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ PROOF STORAGE: S3 + DynamoDB                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Service Inventory

| Service | Namespace | Replicas | Port | Dependencies |
|---------|-----------|----------|------|--------------|
| api-gateway | vorion-prod | 6 | 8080 | Redis, all services |
| intent-service | vorion-prod | 8 | 8081 | PostgreSQL, Kafka |
| enforce-service | vorion-prod | 8 | 8082 | Redis, BASIS engine |
| cognigate-runtime | vorion-prod | 12 | 8083 | All data stores |
| proof-service | vorion-prod | 6 | 8084 | S3, DynamoDB |
| trust-service | vorion-prod | 4 | 8085 | PostgreSQL, Redis |
| basis-engine | vorion-prod | 4 | 8086 | Redis |
| auth-service | vorion-prod | 4 | 8087 | PostgreSQL, Redis |

### Data Stores

| Store | Type | Endpoint | Purpose |
|-------|------|----------|---------|
| vorion-prod-db | Aurora PostgreSQL | vorion-prod.cluster-xxx.us-east-1.rds.amazonaws.com | Primary data |
| vorion-prod-cache | ElastiCache Redis | vorion-prod-cache.xxx.use1.cache.amazonaws.com | Caching, sessions |
| vorion-prod-kafka | MSK | b-1.vorion-prod.xxx.kafka.us-east-1.amazonaws.com | Event streaming |
| vorion-proof-bucket | S3 | vorion-proof-prod-us-east-1 | PROOF artifacts |
| vorion-proof-index | DynamoDB | vorion-proof-index-prod | PROOF indexing |

### Network Architecture

| VPC | CIDR | Region | Purpose |
|-----|------|--------|---------|
| vorion-prod | 10.0.0.0/16 | us-east-1 | Production |
| vorion-prod-dr | 10.1.0.0/16 | us-west-2 | DR/Failover |
| vorion-staging | 10.2.0.0/16 | us-east-1 | Staging |

| Subnet Type | CIDR Range | AZs | Purpose |
|-------------|------------|-----|---------|
| Public | 10.0.0.0/20 | 3 | Load balancers |
| Private App | 10.0.16.0/20 | 3 | Application pods |
| Private Data | 10.0.32.0/20 | 3 | Databases |

---

## 4. Health Checks & Monitoring

### Health Check Endpoints

| Service | Endpoint | Expected Response | Timeout |
|---------|----------|-------------------|---------|
| API Gateway | /health | `{"status":"healthy"}` | 5s |
| Intent Service | /health | `{"status":"healthy"}` | 5s |
| Enforce Service | /health | `{"status":"healthy"}` | 5s |
| Cognigate | /health | `{"status":"healthy"}` | 5s |
| Proof Service | /health | `{"status":"healthy"}` | 5s |

### Health Check Script

```bash
#!/bin/bash
# health_check.sh - Comprehensive platform health check

SERVICES=(
  "api-gateway:8080"
  "intent-service:8081"
  "enforce-service:8082"
  "cognigate-runtime:8083"
  "proof-service:8084"
  "trust-service:8085"
  "basis-engine:8086"
  "auth-service:8087"
)

echo "=== Vorion Platform Health Check ==="
echo "Time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

for svc in "${SERVICES[@]}"; do
  name="${svc%%:*}"
  port="${svc##*:}"

  response=$(kubectl exec -n vorion-prod deploy/$name -- \
    curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/health 2>/dev/null)

  if [ "$response" == "200" ]; then
    echo "✓ $name: HEALTHY"
  else
    echo "✗ $name: UNHEALTHY (HTTP $response)"
  fi
done

echo ""
echo "=== Database Connectivity ==="
kubectl exec -n vorion-prod deploy/intent-service -- \
  psql $DATABASE_URL -c "SELECT 1" >/dev/null 2>&1 && \
  echo "✓ PostgreSQL: CONNECTED" || echo "✗ PostgreSQL: FAILED"

kubectl exec -n vorion-prod deploy/api-gateway -- \
  redis-cli -h $REDIS_HOST ping >/dev/null 2>&1 && \
  echo "✓ Redis: CONNECTED" || echo "✗ Redis: FAILED"

echo ""
echo "=== Kubernetes Cluster ==="
kubectl get nodes -o wide | grep -v "NAME" | while read line; do
  name=$(echo $line | awk '{print $1}')
  status=$(echo $line | awk '{print $2}')
  echo "  Node $name: $status"
done

echo ""
echo "=== Pod Status ==="
unhealthy=$(kubectl get pods -n vorion-prod --field-selector=status.phase!=Running --no-headers 2>/dev/null | wc -l)
echo "  Unhealthy pods: $unhealthy"
```

### Key Metrics & Thresholds

| Metric | Warning | Critical | Dashboard |
|--------|---------|----------|-----------|
| API Latency (P95) | > 200ms | > 500ms | API Performance |
| API Error Rate | > 1% | > 5% | API Performance |
| Request Rate | > 80% capacity | > 95% capacity | API Performance |
| CPU Usage | > 70% | > 90% | Infrastructure |
| Memory Usage | > 75% | > 90% | Infrastructure |
| Disk Usage | > 70% | > 85% | Infrastructure |
| DB Connections | > 70% pool | > 90% pool | Database |
| DB Replication Lag | > 100ms | > 1s | Database |
| Kafka Consumer Lag | > 10K | > 100K | Streaming |
| Redis Memory | > 70% | > 85% | Cache |
| PROOF Write Latency | > 50ms | > 200ms | PROOF System |

### Grafana Dashboards

| Dashboard | URL | Purpose |
|-----------|-----|---------|
| Platform Overview | /d/platform-overview | High-level system health |
| API Performance | /d/api-performance | API latency, errors, throughput |
| Service Health | /d/service-health | Per-service metrics |
| Database | /d/database | PostgreSQL metrics |
| Kubernetes | /d/kubernetes | Cluster and pod metrics |
| PROOF System | /d/proof-system | Evidence chain metrics |
| Business Metrics | /d/business | Intents, trust scores |

### Alert Configuration

```yaml
# PagerDuty alert routing
alerts:
  - name: API High Error Rate
    condition: error_rate_5xx > 5% for 5m
    severity: SEV-1
    routing: platform-oncall
    runbook: "#5-1-api-errors"

  - name: API High Latency
    condition: p95_latency > 500ms for 5m
    severity: SEV-2
    routing: platform-oncall
    runbook: "#5-2-high-latency"

  - name: Service Down
    condition: health_check_failures > 3
    severity: SEV-1
    routing: platform-oncall
    runbook: "#5-3-service-down"

  - name: Database Connection Pool Exhausted
    condition: db_connections > 90%
    severity: SEV-2
    routing: platform-oncall
    runbook: "#5-4-db-connections"

  - name: Disk Space Critical
    condition: disk_usage > 85%
    severity: SEV-2
    routing: platform-oncall
    runbook: "#5-5-disk-space"

  - name: Certificate Expiring
    condition: cert_expiry < 14 days
    severity: SEV-3
    routing: platform-oncall
    runbook: "#6-7-certificate-renewal"
```

---

## 5. Incident Response Playbooks

### 5.1 API Errors (High 5xx Rate)

**Symptoms:**
- Elevated 5xx error rate in monitoring
- Customer reports of failures
- PagerDuty alert: "API High Error Rate"

**Diagnosis:**

```bash
# Step 1: Check error rate and identify patterns
kubectl logs -n vorion-prod -l app=api-gateway --tail=500 | grep -i error | tail -50

# Step 2: Check which endpoint is failing
kubectl exec -n vorion-prod deploy/api-gateway -- \
  curl -s localhost:8080/metrics | grep http_requests_total | grep "status=\"5"

# Step 3: Check downstream services
for svc in intent-service enforce-service cognigate-runtime; do
  echo "=== $svc ==="
  kubectl logs -n vorion-prod -l app=$svc --tail=100 | grep -i error | tail -10
done

# Step 4: Check database connectivity
kubectl exec -n vorion-prod deploy/intent-service -- \
  psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"
```

**Mitigation:**

| Cause | Action |
|-------|--------|
| Single service failing | Restart: `kubectl rollout restart deployment/<service> -n vorion-prod` |
| Database overloaded | Scale read replicas or enable connection pooling |
| Downstream timeout | Increase timeout or enable circuit breaker |
| Bad deployment | Rollback: `kubectl rollout undo deployment/<service> -n vorion-prod` |
| Resource exhaustion | Scale: `kubectl scale deployment/<service> --replicas=<N>` |

**Resolution Checklist:**
- [ ] Error rate returned to normal (< 0.1%)
- [ ] No customer-reported issues
- [ ] Root cause identified
- [ ] Incident ticket updated
- [ ] Post-mortem scheduled (if SEV-1/2)

---

### 5.2 High Latency

**Symptoms:**
- P95 latency > 500ms
- Customer complaints about slowness
- PagerDuty alert: "API High Latency"

**Diagnosis:**

```bash
# Step 1: Identify slow endpoints
kubectl exec -n vorion-prod deploy/api-gateway -- \
  curl -s localhost:8080/metrics | grep http_request_duration

# Step 2: Check service latency breakdown
for svc in intent-service enforce-service cognigate-runtime; do
  echo "=== $svc P95 ==="
  kubectl exec -n vorion-prod deploy/$svc -- \
    curl -s localhost:8080/metrics | grep request_duration | grep "quantile=\"0.95\""
done

# Step 3: Check database query performance
kubectl exec -n vorion-prod deploy/intent-service -- \
  psql $DATABASE_URL -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Step 4: Check Redis latency
kubectl exec -n vorion-prod deploy/api-gateway -- \
  redis-cli -h $REDIS_HOST --latency-history

# Step 5: Check for resource contention
kubectl top pods -n vorion-prod --sort-by=cpu
```

**Mitigation:**

| Cause | Action |
|-------|--------|
| Database slow queries | Identify and optimize query, add index |
| Redis latency | Check memory, eviction policy |
| CPU throttling | Scale pods or increase limits |
| Network latency | Check inter-AZ traffic |
| External service slow | Enable caching or circuit breaker |

**Quick Fixes:**

```bash
# Enable query result caching
kubectl set env deployment/intent-service -n vorion-prod QUERY_CACHE_ENABLED=true

# Increase connection pool
kubectl set env deployment/intent-service -n vorion-prod DB_POOL_SIZE=50

# Scale for more capacity
kubectl scale deployment/intent-service -n vorion-prod --replicas=12
```

---

### 5.3 Service Down

**Symptoms:**
- Health check failures
- Service returning 503
- PagerDuty alert: "Service Down"

**Diagnosis:**

```bash
# Step 1: Check pod status
kubectl get pods -n vorion-prod -l app=<service-name>
kubectl describe pod <pod-name> -n vorion-prod

# Step 2: Check recent events
kubectl get events -n vorion-prod --sort-by='.lastTimestamp' | tail -20

# Step 3: Check logs for crash reason
kubectl logs -n vorion-prod <pod-name> --previous

# Step 4: Check resource limits
kubectl describe pod <pod-name> -n vorion-prod | grep -A5 "Limits:"

# Step 5: Check node health
kubectl describe node <node-name> | grep -A10 "Conditions:"
```

**Mitigation:**

| Cause | Action |
|-------|--------|
| OOMKilled | Increase memory limits |
| CrashLoopBackOff | Check logs, fix config/code |
| ImagePullBackOff | Check image exists, registry auth |
| Node failure | Pods will reschedule automatically |
| Bad config | Rollback ConfigMap/Secret |
| Dependency down | Fix dependency first |

**Recovery:**

```bash
# Force restart all pods
kubectl rollout restart deployment/<service> -n vorion-prod

# Rollback to previous version
kubectl rollout undo deployment/<service> -n vorion-prod

# Scale to zero and back (nuclear option)
kubectl scale deployment/<service> -n vorion-prod --replicas=0
sleep 10
kubectl scale deployment/<service> -n vorion-prod --replicas=<original>
```

---

### 5.4 Database Connection Pool Exhausted

**Symptoms:**
- "too many connections" errors
- Services timing out on DB operations
- PagerDuty alert: "Database Connection Pool Exhausted"

**Diagnosis:**

```bash
# Step 1: Check current connections
kubectl exec -n vorion-prod deploy/intent-service -- \
  psql $DATABASE_URL -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"

# Step 2: Check connections by application
kubectl exec -n vorion-prod deploy/intent-service -- \
  psql $DATABASE_URL -c "SELECT application_name, count(*) FROM pg_stat_activity GROUP BY application_name;"

# Step 3: Check for long-running queries
kubectl exec -n vorion-prod deploy/intent-service -- \
  psql $DATABASE_URL -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query
   FROM pg_stat_activity WHERE state = 'active' AND now() - pg_stat_activity.query_start > interval '1 minute';"

# Step 4: Check connection pool settings in services
kubectl get deployment -n vorion-prod -o yaml | grep -i pool
```

**Mitigation:**

```bash
# Kill long-running queries
kubectl exec -n vorion-prod deploy/intent-service -- \
  psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity
   WHERE state = 'active' AND now() - query_start > interval '5 minutes';"

# Reduce pool size temporarily on non-critical services
kubectl set env deployment/reporting-service -n vorion-prod DB_POOL_SIZE=5

# Restart services to release connections
kubectl rollout restart deployment/intent-service -n vorion-prod

# Increase max connections (requires DB restart)
# AWS Console: RDS > Parameter Groups > max_connections
```

---

### 5.5 Disk Space Critical

**Symptoms:**
- Disk usage > 85%
- Write operations failing
- PagerDuty alert: "Disk Space Critical"

**Diagnosis:**

```bash
# Step 1: Check disk usage on nodes
kubectl get nodes -o wide
for node in $(kubectl get nodes -o name); do
  echo "=== $node ==="
  kubectl debug node/${node#node/} -it --image=busybox -- df -h
done

# Step 2: Check PVC usage
kubectl get pvc -n vorion-prod
kubectl exec -n vorion-prod <pod-with-pvc> -- df -h

# Step 3: Check for large log files
kubectl exec -n vorion-prod deploy/intent-service -- du -sh /var/log/*

# Step 4: Check database storage
# AWS Console: RDS > Databases > vorion-prod > Storage
```

**Mitigation:**

| Location | Action |
|----------|--------|
| Node disk | Clean Docker images: `docker system prune -af` |
| Application logs | Rotate logs, reduce verbosity |
| Database | Archive old data, VACUUM FULL |
| PVC | Expand volume, archive data |
| S3/PROOF | Check lifecycle policies |

```bash
# Clean up old container images on nodes
kubectl get nodes -o name | xargs -I {} kubectl debug {} -it --image=docker -- \
  docker system prune -af

# Clean up old ReplicaSets
kubectl delete rs -n vorion-prod $(kubectl get rs -n vorion-prod -o name | grep -v $(kubectl get deploy -n vorion-prod -o jsonpath='{.items[*].status.observedGeneration}'))

# Expand PVC (if using expandable storage class)
kubectl patch pvc <pvc-name> -n vorion-prod -p '{"spec":{"resources":{"requests":{"storage":"100Gi"}}}}'
```

---

### 5.6 Kafka Consumer Lag

**Symptoms:**
- Events processing delayed
- Consumer lag > 100K messages
- PagerDuty alert: "Kafka Consumer Lag Critical"

**Diagnosis:**

```bash
# Step 1: Check consumer lag
kubectl exec -n vorion-prod deploy/kafka-tools -- \
  kafka-consumer-groups.sh --bootstrap-server $KAFKA_BROKERS \
  --describe --group vorion-intent-processor

# Step 2: Check consumer health
kubectl logs -n vorion-prod -l app=intent-processor --tail=100 | grep -i consumer

# Step 3: Check partition distribution
kubectl exec -n vorion-prod deploy/kafka-tools -- \
  kafka-topics.sh --bootstrap-server $KAFKA_BROKERS \
  --describe --topic vorion-intents

# Step 4: Check broker health
kubectl exec -n vorion-prod deploy/kafka-tools -- \
  kafka-broker-api-versions.sh --bootstrap-server $KAFKA_BROKERS
```

**Mitigation:**

```bash
# Scale consumers
kubectl scale deployment/intent-processor -n vorion-prod --replicas=16

# Reset consumer offset (CAUTION: may skip messages)
kubectl exec -n vorion-prod deploy/kafka-tools -- \
  kafka-consumer-groups.sh --bootstrap-server $KAFKA_BROKERS \
  --group vorion-intent-processor --reset-offsets --to-latest --execute --all-topics

# Increase partition count for parallelism
kubectl exec -n vorion-prod deploy/kafka-tools -- \
  kafka-topics.sh --bootstrap-server $KAFKA_BROKERS \
  --alter --topic vorion-intents --partitions 24
```

---

### 5.7 PROOF Chain Integrity Alert

**Symptoms:**
- Hash verification failures
- Chain continuity errors
- PagerDuty alert: "PROOF Chain Integrity Alert"

**This is a CRITICAL security event. Escalate immediately.**

**Diagnosis:**

```bash
# Step 1: Identify affected chain segment
kubectl logs -n vorion-prod -l app=proof-service --tail=500 | grep -i "integrity\|hash\|chain"

# Step 2: Get chain verification report
kubectl exec -n vorion-prod deploy/proof-service -- \
  curl -s localhost:8084/internal/chain/verify?from=<start>&to=<end>

# Step 3: Check for tampering indicators
kubectl exec -n vorion-prod deploy/proof-service -- \
  curl -s localhost:8084/internal/chain/audit/<chain_id>
```

**Immediate Actions:**
1. **DO NOT** attempt to "fix" the chain
2. Preserve all logs and evidence
3. Page CISO immediately
4. Enable read-only mode on PROOF service
5. Document everything

```bash
# Enable read-only mode
kubectl set env deployment/proof-service -n vorion-prod READ_ONLY_MODE=true

# Export affected chain segment for forensics
kubectl exec -n vorion-prod deploy/proof-service -- \
  /app/bin/export-chain --chain-id=<id> --output=/tmp/chain_export.json
kubectl cp vorion-prod/<pod>:/tmp/chain_export.json ./chain_export_$(date +%s).json
```

---

### 5.8 Security Incident

**Symptoms:**
- Unauthorized access detected
- Anomalous behavior alerts
- Customer report of compromise

**IMMEDIATE ACTIONS:**

```bash
# 1. Preserve evidence - DO NOT delete anything
kubectl logs -n vorion-prod --all-containers --timestamps > incident_logs_$(date +%s).txt

# 2. Isolate affected systems if necessary
kubectl cordon <node-name>  # Prevent new pods
kubectl drain <node-name> --ignore-daemonsets  # Remove existing pods

# 3. Revoke compromised credentials
kubectl delete secret <compromised-secret> -n vorion-prod

# 4. Enable enhanced logging
kubectl set env deployment/api-gateway -n vorion-prod LOG_LEVEL=DEBUG SECURITY_AUDIT=true
```

**Escalation:**
1. Page CISO: @ciso
2. Start incident bridge
3. Engage IR team
4. Notify legal if data breach suspected

**DO NOT:**
- Delete logs or evidence
- Reboot systems without preserving state
- Communicate externally without approval
- Attempt to "clean up" without IR guidance

---

## 6. Common Operational Tasks

### 6.1 User Access Management

**Grant cluster access:**
```bash
# Add user to kubectl access
kubectl create clusterrolebinding <user>-binding \
  --clusterrole=<role> --user=<user>@vorion.io

# Available roles: view, edit, admin, cluster-admin
```

**Revoke access:**
```bash
kubectl delete clusterrolebinding <user>-binding
```

**Audit access:**
```bash
kubectl get clusterrolebindings -o wide | grep <user>
kubectl auth can-i --list --as=<user>@vorion.io
```

### 6.2 Secret Rotation

**Database credentials:**
```bash
# 1. Generate new password
NEW_PASSWORD=$(openssl rand -base64 32)

# 2. Update in database
kubectl exec -n vorion-prod deploy/intent-service -- \
  psql $DATABASE_URL -c "ALTER USER vorion_app PASSWORD '$NEW_PASSWORD';"

# 3. Update Kubernetes secret
kubectl create secret generic db-credentials -n vorion-prod \
  --from-literal=password=$NEW_PASSWORD \
  --dry-run=client -o yaml | kubectl apply -f -

# 4. Restart services to pick up new credentials
kubectl rollout restart deployment -n vorion-prod -l requires-db=true
```

**API keys:**
```bash
# Rotate via Vault
vault write vorion/api-keys/rotate key_id=<key_id>

# Services auto-refresh from Vault
```

### 6.3 Certificate Management

**Check certificate expiry:**
```bash
# Check all ingress certificates
kubectl get certificates -A

# Check specific certificate
kubectl describe certificate vorion-tls -n vorion-prod

# Check actual certificate expiry
echo | openssl s_client -connect api.vorion.io:443 2>/dev/null | \
  openssl x509 -noout -dates
```

**Force certificate renewal:**
```bash
# Delete certificate to trigger renewal (cert-manager)
kubectl delete certificate vorion-tls -n vorion-prod

# Verify renewal
kubectl get certificaterequest -n vorion-prod
```

### 6.4 Log Management

**View logs:**
```bash
# Single service
kubectl logs -n vorion-prod -l app=intent-service --tail=100 -f

# All services
kubectl logs -n vorion-prod -l tier=application --tail=50

# Previous container (after crash)
kubectl logs -n vorion-prod <pod-name> --previous

# Specific time range (via Datadog)
# Use Datadog UI: Logs > service:intent-service > time range
```

**Export logs for analysis:**
```bash
# Export last hour of logs
kubectl logs -n vorion-prod -l app=intent-service --since=1h > intent_logs.txt

# Export with timestamps
kubectl logs -n vorion-prod -l app=intent-service --timestamps > intent_logs_ts.txt
```

### 6.5 Configuration Changes

**Update ConfigMap:**
```bash
# Edit directly
kubectl edit configmap intent-service-config -n vorion-prod

# Or apply from file
kubectl apply -f config/intent-service-config.yaml

# Restart to apply (ConfigMaps don't auto-reload)
kubectl rollout restart deployment/intent-service -n vorion-prod
```

**Update environment variables:**
```bash
# Single variable
kubectl set env deployment/intent-service -n vorion-prod LOG_LEVEL=DEBUG

# Multiple variables
kubectl set env deployment/intent-service -n vorion-prod \
  LOG_LEVEL=DEBUG \
  CACHE_TTL=300 \
  FEATURE_X_ENABLED=true

# Remove variable
kubectl set env deployment/intent-service -n vorion-prod LOG_LEVEL-
```

### 6.6 Feature Flags

**Enable feature flag:**
```bash
# Via ConfigMap
kubectl patch configmap feature-flags -n vorion-prod \
  -p '{"data":{"FEATURE_NEW_TRUST_MODEL":"true"}}'

# Restart services that read flags at startup
kubectl rollout restart deployment -n vorion-prod -l reads-feature-flags=true
```

**Check feature flag status:**
```bash
kubectl get configmap feature-flags -n vorion-prod -o yaml
```

---

## 7. Troubleshooting Guide

### 7.1 Service Won't Start

**Check pod status:**
```bash
kubectl get pods -n vorion-prod -l app=<service>
kubectl describe pod <pod-name> -n vorion-prod
```

**Common issues:**

| Status | Cause | Solution |
|--------|-------|----------|
| ImagePullBackOff | Image not found | Check image name/tag, registry auth |
| CrashLoopBackOff | App crashing | Check logs: `kubectl logs <pod> --previous` |
| Pending | No resources | Check node capacity, resource requests |
| Init:Error | Init container failed | Check init container logs |
| ContainerCreating | Volume mount issue | Check PVC status, storage class |

### 7.2 High Memory Usage

```bash
# Check current memory usage
kubectl top pods -n vorion-prod --sort-by=memory

# Check memory limits
kubectl get deployment <service> -n vorion-prod -o yaml | grep -A5 memory

# Check for memory leaks (look for steady increase)
# Grafana > Service Health > Memory over time

# Check heap dumps (Java services)
kubectl exec -n vorion-prod deploy/intent-service -- \
  jmap -histo:live 1 | head -30
```

**Mitigation:**
```bash
# Increase memory limit
kubectl patch deployment intent-service -n vorion-prod \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"intent-service","resources":{"limits":{"memory":"4Gi"}}}]}}}}'

# Restart to clear memory
kubectl rollout restart deployment/intent-service -n vorion-prod
```

### 7.3 Network Connectivity Issues

```bash
# Test service-to-service connectivity
kubectl exec -n vorion-prod deploy/api-gateway -- \
  curl -v http://intent-service:8081/health

# Test external connectivity
kubectl exec -n vorion-prod deploy/intent-service -- \
  curl -v https://external-api.example.com/health

# Check DNS resolution
kubectl exec -n vorion-prod deploy/api-gateway -- \
  nslookup intent-service.vorion-prod.svc.cluster.local

# Check network policies
kubectl get networkpolicies -n vorion-prod

# Test from specific pod
kubectl debug -n vorion-prod <pod-name> -it --image=nicolaka/netshoot -- \
  tcpdump -i any port 8081
```

### 7.4 Slow Database Queries

```bash
# Find slow queries
kubectl exec -n vorion-prod deploy/intent-service -- \
  psql $DATABASE_URL -c "
    SELECT query, calls, mean_time, total_time
    FROM pg_stat_statements
    ORDER BY mean_time DESC
    LIMIT 20;"

# Check for missing indexes
kubectl exec -n vorion-prod deploy/intent-service -- \
  psql $DATABASE_URL -c "
    SELECT relname, seq_scan, idx_scan
    FROM pg_stat_user_tables
    WHERE seq_scan > idx_scan
    ORDER BY seq_scan DESC;"

# Check table bloat
kubectl exec -n vorion-prod deploy/intent-service -- \
  psql $DATABASE_URL -c "
    SELECT relname, n_dead_tup, n_live_tup
    FROM pg_stat_user_tables
    ORDER BY n_dead_tup DESC
    LIMIT 10;"

# Analyze query plan
kubectl exec -n vorion-prod deploy/intent-service -- \
  psql $DATABASE_URL -c "EXPLAIN ANALYZE <slow_query>;"
```

### 7.5 Kubernetes Resource Issues

```bash
# Check node resources
kubectl describe nodes | grep -A5 "Allocated resources"

# Check for pending pods
kubectl get pods -n vorion-prod --field-selector=status.phase=Pending

# Check resource quotas
kubectl get resourcequota -n vorion-prod

# Check HPA status
kubectl get hpa -n vorion-prod

# Check cluster autoscaler
kubectl logs -n kube-system -l app=cluster-autoscaler --tail=50
```

### 7.6 TLS/Certificate Issues

```bash
# Check certificate validity
openssl s_client -connect api.vorion.io:443 -servername api.vorion.io </dev/null 2>/dev/null | \
  openssl x509 -text -noout | grep -A2 "Validity"

# Check certificate chain
openssl s_client -connect api.vorion.io:443 -showcerts </dev/null 2>/dev/null

# Check Kubernetes TLS secret
kubectl get secret vorion-tls -n vorion-prod -o jsonpath='{.data.tls\.crt}' | \
  base64 -d | openssl x509 -text -noout

# Check cert-manager
kubectl get certificates -n vorion-prod
kubectl describe certificate vorion-tls -n vorion-prod
```

---

## 8. Deployment Procedures

### 8.1 Standard Deployment

**Pre-deployment checklist:**
- [ ] Code reviewed and approved
- [ ] CI/CD pipeline passed
- [ ] Staging tests passed
- [ ] Change ticket approved
- [ ] Rollback plan documented
- [ ] On-call notified

**Deployment via ArgoCD:**
```bash
# Check current status
argocd app get vorion-prod

# Sync (deploy) application
argocd app sync vorion-prod

# Watch rollout
kubectl rollout status deployment/<service> -n vorion-prod

# Verify health
curl -s https://api.vorion.io/v1/health | jq
```

**Manual deployment (if ArgoCD unavailable):**
```bash
# Update image
kubectl set image deployment/<service> -n vorion-prod \
  <service>=<registry>/<image>:<new-tag>

# Watch rollout
kubectl rollout status deployment/<service> -n vorion-prod
```

### 8.2 Canary Deployment

```bash
# Deploy canary (10% traffic)
kubectl apply -f deployments/canary/<service>-canary.yaml

# Monitor canary metrics
# Grafana > Canary Dashboard > Select service

# Check error rate comparison
kubectl exec -n vorion-prod deploy/api-gateway -- \
  curl -s localhost:8080/metrics | grep "http_requests_total.*version"

# Promote canary to stable
kubectl apply -f deployments/stable/<service>.yaml
kubectl delete -f deployments/canary/<service>-canary.yaml

# OR rollback canary
kubectl delete -f deployments/canary/<service>-canary.yaml
```

### 8.3 Rollback Procedure

```bash
# Check rollout history
kubectl rollout history deployment/<service> -n vorion-prod

# Rollback to previous version
kubectl rollout undo deployment/<service> -n vorion-prod

# Rollback to specific revision
kubectl rollout undo deployment/<service> -n vorion-prod --to-revision=<N>

# Verify rollback
kubectl rollout status deployment/<service> -n vorion-prod
kubectl get deployment <service> -n vorion-prod -o jsonpath='{.spec.template.spec.containers[0].image}'
```

### 8.4 Database Migration

```bash
# Pre-migration checklist
# [ ] Backup taken
# [ ] Migration tested in staging
# [ ] Rollback script ready
# [ ] Maintenance window scheduled

# Run migration
kubectl create job db-migrate-$(date +%s) -n vorion-prod \
  --from=cronjob/db-migrations

# Watch migration
kubectl logs -n vorion-prod -l job-name=db-migrate-* -f

# Verify migration
kubectl exec -n vorion-prod deploy/intent-service -- \
  psql $DATABASE_URL -c "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 5;"

# Rollback migration (if needed)
kubectl create job db-rollback-$(date +%s) -n vorion-prod \
  --from=cronjob/db-rollback -- /app/bin/migrate rollback
```

---

## 9. Scaling Operations

### 9.1 Manual Scaling

```bash
# Scale deployment
kubectl scale deployment/<service> -n vorion-prod --replicas=<N>

# Scale multiple services
kubectl scale deployment/intent-service deployment/enforce-service -n vorion-prod --replicas=10

# Check current replicas
kubectl get deployment -n vorion-prod
```

### 9.2 Horizontal Pod Autoscaler (HPA)

```bash
# Check HPA status
kubectl get hpa -n vorion-prod

# Describe HPA
kubectl describe hpa <service>-hpa -n vorion-prod

# Modify HPA
kubectl patch hpa <service>-hpa -n vorion-prod \
  -p '{"spec":{"minReplicas":4,"maxReplicas":20}}'

# Create HPA
kubectl autoscale deployment/<service> -n vorion-prod \
  --min=4 --max=20 --cpu-percent=70
```

### 9.3 Cluster Scaling

```bash
# Check node count
kubectl get nodes

# Check cluster autoscaler status
kubectl logs -n kube-system -l app=cluster-autoscaler --tail=100

# Manually scale node group (AWS)
aws eks update-nodegroup-config \
  --cluster-name vorion-prod \
  --nodegroup-name workers \
  --scaling-config minSize=6,maxSize=50,desiredSize=12

# Check node group status
aws eks describe-nodegroup \
  --cluster-name vorion-prod \
  --nodegroup-name workers
```

### 9.4 Database Scaling

**Read replica scaling:**
```bash
# Add read replica (AWS Console or CLI)
aws rds create-db-instance-read-replica \
  --db-instance-identifier vorion-prod-replica-3 \
  --source-db-instance-identifier vorion-prod

# Update application to use new replica
# (Update reader endpoint if using Aurora)
```

**Vertical scaling:**
```bash
# Scale instance class (causes brief downtime for non-Aurora)
aws rds modify-db-instance \
  --db-instance-identifier vorion-prod \
  --db-instance-class db.r6g.2xlarge \
  --apply-immediately
```

---

## 10. Backup & Recovery

### 10.1 Backup Status Check

```bash
# Check latest backups
aws rds describe-db-cluster-snapshots \
  --db-cluster-identifier vorion-prod \
  --query 'DBClusterSnapshots[*].[DBClusterSnapshotIdentifier,SnapshotCreateTime,Status]' \
  --output table

# Check S3 backup sync
aws s3 ls s3://vorion-backups-prod/ --recursive | tail -20

# Check PROOF backup status
kubectl exec -n vorion-prod deploy/proof-service -- \
  curl -s localhost:8084/internal/backup/status
```

### 10.2 Database Restore

**Point-in-time recovery:**
```bash
# Restore to new cluster
aws rds restore-db-cluster-to-point-in-time \
  --db-cluster-identifier vorion-prod-restored \
  --source-db-cluster-identifier vorion-prod \
  --restore-to-time "2026-01-08T12:00:00Z" \
  --use-latest-restorable-time

# Create instance in restored cluster
aws rds create-db-instance \
  --db-instance-identifier vorion-prod-restored-instance \
  --db-cluster-identifier vorion-prod-restored \
  --db-instance-class db.r6g.xlarge \
  --engine aurora-postgresql
```

**Restore from snapshot:**
```bash
# List available snapshots
aws rds describe-db-cluster-snapshots \
  --db-cluster-identifier vorion-prod

# Restore from snapshot
aws rds restore-db-cluster-from-snapshot \
  --db-cluster-identifier vorion-prod-restored \
  --snapshot-identifier <snapshot-id> \
  --engine aurora-postgresql
```

### 10.3 PROOF Chain Recovery

```bash
# Verify chain integrity
kubectl exec -n vorion-prod deploy/proof-service -- \
  /app/bin/verify-chain --full

# Restore from backup (if needed)
kubectl exec -n vorion-prod deploy/proof-service -- \
  /app/bin/restore-chain --backup-path=s3://vorion-backups-prod/proof/latest

# Re-verify after restore
kubectl exec -n vorion-prod deploy/proof-service -- \
  /app/bin/verify-chain --full
```

### 10.4 Disaster Recovery Procedure

**DR Activation Checklist:**
- [ ] Confirm primary region is down
- [ ] Get VP/CISO approval for DR activation
- [ ] Notify customers of failover
- [ ] Update DNS to DR region
- [ ] Verify DR systems operational
- [ ] Monitor for issues

**Failover steps:**
```bash
# 1. Promote DR database
aws rds promote-read-replica-db-cluster \
  --db-cluster-identifier vorion-dr

# 2. Update DNS (Route 53)
aws route53 change-resource-record-sets \
  --hosted-zone-id <zone-id> \
  --change-batch file://dr-failover-dns.json

# 3. Scale up DR Kubernetes cluster
kubectl --context vorion-dr scale deployment --all -n vorion-prod --replicas=8

# 4. Verify services
curl -s https://api.vorion.io/v1/health | jq

# 5. Update status page
# https://status.vorion.io/admin
```

---

## 11. Security Operations

### 11.1 Security Patching

**Check for vulnerabilities:**
```bash
# Scan running images
kubectl get pods -n vorion-prod -o jsonpath='{.items[*].spec.containers[*].image}' | \
  tr ' ' '\n' | sort -u | while read img; do
    echo "=== $img ==="
    trivy image --severity HIGH,CRITICAL $img
  done

# Check for CVEs in dependencies
kubectl exec -n vorion-prod deploy/intent-service -- \
  /app/bin/check-vulnerabilities
```

**Apply security patch:**
```bash
# Update base image
kubectl set image deployment/<service> -n vorion-prod \
  <service>=<registry>/<image>:<patched-tag>

# Rolling restart all services (for base OS patches)
kubectl rollout restart deployment -n vorion-prod
```

### 11.2 Access Audit

```bash
# Audit Kubernetes access
kubectl get clusterrolebindings -o wide
kubectl get rolebindings -n vorion-prod -o wide

# Check recent admin actions
kubectl get events -n vorion-prod --field-selector reason=Update

# Audit API access
# Datadog > Logs > @http.url:"/v1/*" @http.status_code:401
```

### 11.3 Secret Audit

```bash
# List all secrets
kubectl get secrets -n vorion-prod

# Check secret age
kubectl get secrets -n vorion-prod -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.metadata.creationTimestamp}{"\n"}{end}'

# Audit Vault access
vault audit list
vault read sys/audit/file
```

### 11.4 Incident Evidence Collection

```bash
# Preserve pod state
kubectl get pod <pod-name> -n vorion-prod -o yaml > evidence/pod_state_$(date +%s).yaml

# Preserve logs
kubectl logs -n vorion-prod <pod-name> --timestamps > evidence/logs_$(date +%s).txt

# Preserve events
kubectl get events -n vorion-prod --sort-by='.lastTimestamp' > evidence/events_$(date +%s).txt

# Network capture
kubectl debug -n vorion-prod <pod-name> -it --image=nicolaka/netshoot -- \
  tcpdump -i any -w /tmp/capture.pcap &
sleep 60
kubectl cp vorion-prod/<debug-pod>:/tmp/capture.pcap evidence/capture_$(date +%s).pcap
```

---

## 12. Maintenance Windows

### 12.1 Maintenance Schedule

| Window | Time (UTC) | Duration | Use For |
|--------|------------|----------|---------|
| Weekly | Sun 02:00-06:00 | 4 hours | Routine maintenance |
| Monthly | 1st Sun 00:00-08:00 | 8 hours | Major updates |
| Emergency | As needed | Varies | Critical fixes |

### 12.2 Maintenance Checklist

**Pre-maintenance:**
- [ ] Notify customers 48h in advance
- [ ] Update status page
- [ ] Verify rollback procedures
- [ ] Confirm on-call coverage
- [ ] Take pre-maintenance backups

**During maintenance:**
- [ ] Enable maintenance mode (if needed)
- [ ] Execute planned changes
- [ ] Verify each change before proceeding
- [ ] Run health checks after each step

**Post-maintenance:**
- [ ] Disable maintenance mode
- [ ] Full system health check
- [ ] Monitor for 30 minutes
- [ ] Update status page
- [ ] Send completion notification

### 12.3 Maintenance Mode

**Enable maintenance mode:**
```bash
# API returns 503 with maintenance message
kubectl set env deployment/api-gateway -n vorion-prod \
  MAINTENANCE_MODE=true \
  MAINTENANCE_MESSAGE="Scheduled maintenance in progress. ETA: 2 hours"

# Or use feature flag
kubectl patch configmap feature-flags -n vorion-prod \
  -p '{"data":{"MAINTENANCE_MODE":"true"}}'
```

**Disable maintenance mode:**
```bash
kubectl set env deployment/api-gateway -n vorion-prod MAINTENANCE_MODE-
```

---

## 13. Vendor & Dependency Management

### 13.1 AWS Service Health

```bash
# Check AWS service status
aws health describe-events --filter "services=EKS,RDS,ELASTICACHE"

# Check RDS events
aws rds describe-events --source-type db-cluster --source-identifier vorion-prod

# Check EKS cluster status
aws eks describe-cluster --name vorion-prod --query 'cluster.status'
```

### 13.2 Third-Party Service Status

| Service | Status URL | Slack Alert Channel |
|---------|------------|---------------------|
| Cloudflare | cloudflarestatus.com | #alerts-cloudflare |
| Datadog | status.datadoghq.com | #alerts-datadog |
| PagerDuty | status.pagerduty.com | #alerts-pagerduty |
| GitHub | githubstatus.com | #alerts-github |
| AWS | health.aws.amazon.com | #alerts-aws |

### 13.3 Dependency Updates

```bash
# Check for outdated Helm charts
helm list -n vorion-prod
helm search repo <chart> --versions

# Update Helm release
helm upgrade <release> <chart> -n vorion-prod --version <new-version>

# Check for Kubernetes API deprecations
kubectl deprecations

# Check for container image updates
# Use Dependabot/Renovate automation
```

---

## 14. Communication Templates

### 14.1 Incident Communication

**Initial notification:**
```
Subject: [INCIDENT] Vorion API - Investigating Elevated Error Rates

Status: Investigating
Impact: Some API requests may fail
Start Time: 2026-01-08 14:30 UTC

We are investigating elevated error rates on the Vorion API.
We will provide updates every 30 minutes.

Current status: https://status.vorion.io
```

**Update notification:**
```
Subject: [INCIDENT UPDATE] Vorion API - Issue Identified

Status: Identified
Impact: ~5% of API requests affected
Start Time: 2026-01-08 14:30 UTC

Root cause has been identified as database connection pool exhaustion.
We are implementing a fix and expect resolution within 30 minutes.

Next update in 30 minutes.
```

**Resolution notification:**
```
Subject: [RESOLVED] Vorion API - Service Restored

Status: Resolved
Impact: ~5% of API requests were affected
Duration: 14:30-15:15 UTC (45 minutes)

The issue has been resolved. All systems are operating normally.

Root cause: Database connection pool was exhausted due to a slow query.
We will conduct a post-mortem and share findings.

Thank you for your patience.
```

### 14.2 Maintenance Communication

**Advance notice:**
```
Subject: [MAINTENANCE] Scheduled Maintenance - Jan 12, 2026

Scheduled Maintenance Window:
Date: January 12, 2026
Time: 02:00-06:00 UTC
Duration: 4 hours (expected: 2 hours)

Impact:
- Brief API interruptions (< 30 seconds) during service restarts
- No expected data loss or extended downtime

Work being performed:
- Database version upgrade
- Security patches
- Infrastructure updates

No action required from customers.
Updates will be posted at: https://status.vorion.io
```

### 14.3 Internal Escalation

**Slack message:**
```
@oncall-primary @oncall-secondary

:rotating_light: INCIDENT DECLARED

Severity: SEV-2
Issue: API latency > 500ms
Impact: Customer-facing degradation
Start: 14:30 UTC

Bridge: https://meet.vorion.io/incident-bridge
Ticket: INC-12345
Runbook: #5-2-high-latency

Please join the bridge immediately.
```

---

## 15. Appendices

### Appendix A: Environment Variables Reference

| Variable | Service | Description | Default |
|----------|---------|-------------|---------|
| `LOG_LEVEL` | All | Logging verbosity | INFO |
| `DB_POOL_SIZE` | DB services | Connection pool size | 20 |
| `CACHE_TTL` | API Gateway | Cache duration (sec) | 60 |
| `CIRCUIT_BREAKER` | All | Enable circuit breaker | false |
| `MAINTENANCE_MODE` | API Gateway | Return 503 | false |
| `RATE_LIMIT_RPS` | API Gateway | Requests per second | 1000 |
| `FEATURE_*` | All | Feature flags | varies |

### Appendix B: Port Reference

| Port | Service | Protocol |
|------|---------|----------|
| 8080 | API Gateway | HTTP |
| 8081 | Intent Service | gRPC |
| 8082 | Enforce Service | gRPC |
| 8083 | Cognigate Runtime | gRPC |
| 8084 | Proof Service | HTTP |
| 8085 | Trust Service | gRPC |
| 8086 | BASIS Engine | gRPC |
| 8087 | Auth Service | HTTP |
| 9090 | All (metrics) | HTTP |
| 5432 | PostgreSQL | TCP |
| 6379 | Redis | TCP |
| 9092 | Kafka | TCP |

### Appendix C: Useful Aliases

Add to `~/.bashrc` or `~/.zshrc`:

```bash
# Kubernetes shortcuts
alias k='kubectl'
alias kp='kubectl -n vorion-prod'
alias ks='kubectl -n vorion-staging'
alias kgp='kubectl get pods'
alias kgd='kubectl get deployments'
alias kl='kubectl logs -f'
alias kx='kubectl exec -it'

# Vorion-specific
alias vorion-health='curl -s https://api.vorion.io/v1/health | jq'
alias vorion-pods='kubectl get pods -n vorion-prod -o wide'
alias vorion-logs='kubectl logs -n vorion-prod -l tier=application --tail=100 -f'
alias vorion-top='kubectl top pods -n vorion-prod --sort-by=cpu'

# Quick access
alias grafana='open https://grafana.internal.vorion.io'
alias pagerduty='open https://vorion.pagerduty.com'
alias argocd='open https://argocd.internal.vorion.io'
```

### Appendix D: Runbook Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-08 | Platform Team | Initial release |

---

## Document Control

**Owner:** Platform Engineering Team
**Review Cycle:** Quarterly
**Next Review:** 2026-04-08
**Classification:** Internal Use Only

**Feedback:** #platform-runbook-feedback

---

*This runbook is a living document. If you find errors or have improvements, please submit a PR to the platform-docs repository or post in #platform-runbook-feedback.*
