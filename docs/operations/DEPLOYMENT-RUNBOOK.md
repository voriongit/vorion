# Vorion Deployment Runbook

**Version:** 1.0.0
**Classification:** Internal - DevOps Team
**Last Updated:** January 19, 2026

---

## Overview

This runbook provides step-by-step procedures for deploying Vorion platform components across all environments.

---

## Table of Contents

1. [Deployment Architecture](#deployment-architecture)
2. [Environment Configuration](#environment-configuration)
3. [Pre-Deployment Checklist](#pre-deployment-checklist)
4. [Deployment Procedures](#deployment-procedures)
5. [Database Migrations](#database-migrations)
6. [Rollback Procedures](#rollback-procedures)
7. [Health Checks](#health-checks)
8. [Monitoring & Alerts](#monitoring--alerts)
9. [Troubleshooting](#troubleshooting)

---

## Deployment Architecture

### Infrastructure Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PRODUCTION                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                  │
│   │   Vercel    │     │   Vercel    │     │   Vercel    │                  │
│   │  Frontend   │     │  Frontend   │     │   Astro     │                  │
│   │ AgentAnchor │     │  AA-WWW     │     │  BAI-CC     │                  │
│   └──────┬──────┘     └─────────────┘     └─────────────┘                  │
│          │                                                                   │
│          ▼                                                                   │
│   ┌─────────────┐                                                           │
│   │   Vercel    │                                                           │
│   │  Serverless │◀── API Routes (Next.js)                                  │
│   │  Functions  │                                                           │
│   └──────┬──────┘                                                           │
│          │                                                                   │
│          ├──────────────────────────────────────┐                           │
│          ▼                                      ▼                           │
│   ┌─────────────┐                        ┌─────────────┐                   │
│   │    Neon     │                        │   Upstash   │                   │
│   │ PostgreSQL  │                        │    Redis    │                   │
│   │ (Serverless)│                        │   (Cache)   │                   │
│   └─────────────┘                        └─────────────┘                   │
│          │                                                                   │
│          ▼                                                                   │
│   ┌─────────────┐                                                           │
│   │  Supabase   │◀── Auth, Realtime, Storage                               │
│   │  Platform   │                                                           │
│   └─────────────┘                                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Domain Mapping

| Domain | Application | Hosting |
|--------|-------------|---------|
| `app.agentanchorai.com` | AgentAnchor Platform | Vercel |
| `agentanchorai.com` | Marketing Site | Vercel |
| `basis.vorion.org` | BASIS Documentation | Vercel |
| `bai-cc.com` | BAI Portfolio | Vercel |
| `api.agentanchorai.com` | API Gateway | Vercel Functions |

---

## Environment Configuration

### Environment Tiers

| Environment | Purpose | URL Pattern |
|-------------|---------|-------------|
| Development | Local development | localhost:3000 |
| Preview | PR previews | *.vercel.app |
| Staging | Pre-production | staging.agentanchorai.com |
| Production | Live traffic | app.agentanchorai.com |

### Environment Variables

#### AgentAnchor (`apps/agentanchor`)

```bash
# ===================
# DATABASE
# ===================
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
DIRECT_URL=postgresql://user:pass@host:5432/db?sslmode=require

# ===================
# SUPABASE
# ===================
NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# ===================
# AUTHENTICATION
# ===================
NEXTAUTH_URL=https://app.agentanchorai.com
NEXTAUTH_SECRET=min-32-char-secret-here

# ===================
# API
# ===================
VORION_JWT_SECRET=min-32-char-secret-here
API_BASE_URL=https://api.agentanchorai.com

# ===================
# REDIS (Optional)
# ===================
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# ===================
# MONITORING
# ===================
SENTRY_DSN=https://xxx@sentry.io/xxx
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
```

#### Staging vs Production Differences

| Variable | Staging | Production |
|----------|---------|------------|
| `DATABASE_URL` | staging-db | production-db |
| `NEXTAUTH_URL` | staging.agentanchorai.com | app.agentanchorai.com |
| `SENTRY_ENVIRONMENT` | staging | production |

---

## Pre-Deployment Checklist

### Before Every Deployment

- [ ] All tests passing on CI
- [ ] Code reviewed and approved
- [ ] No critical security vulnerabilities
- [ ] Database migrations reviewed
- [ ] Environment variables verified
- [ ] Changelog updated
- [ ] Stakeholders notified

### Before Production Deployment

- [ ] Staging deployment successful
- [ ] Staging smoke tests passed
- [ ] Performance benchmarks acceptable
- [ ] Load testing completed (if significant changes)
- [ ] Rollback plan documented
- [ ] On-call engineer available
- [ ] Deployment window approved

---

## Deployment Procedures

### Automatic Deployment (Vercel)

Vercel automatically deploys:
- **Preview:** On every PR push
- **Production:** On merge to `main`

### Manual Deployment

#### Step 1: Verify CI Status

```bash
# Check GitHub Actions status
gh run list --limit 5

# Ensure latest run passed
gh run view [run-id]
```

#### Step 2: Create Release Tag

```bash
# Checkout main
git checkout main
git pull origin main

# Create release tag
git tag -a v1.2.3 -m "Release v1.2.3: Brief description"
git push origin v1.2.3
```

#### Step 3: Deploy via Vercel CLI

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Login
vercel login

# Deploy to production
cd apps/agentanchor
vercel --prod

# Verify deployment
vercel ls
```

#### Step 4: Verify Deployment

```bash
# Health check
curl https://app.agentanchorai.com/api/health

# Version check
curl https://app.agentanchorai.com/api/version
```

### Package Deployment (npm)

For `@vorionsys/atsf-core`:

```bash
# Bump version
cd packages/atsf-core
npm version patch  # or minor/major

# Build
npm run build

# Publish
npm publish --access public

# Tag release
git tag -a atsf-core@1.2.3 -m "atsf-core v1.2.3"
git push origin atsf-core@1.2.3
```

---

## Database Migrations

### Migration Workflow

```
1. Create migration locally
2. Test in development
3. Apply to staging
4. Verify staging
5. Apply to production
6. Verify production
```

### Creating Migrations

```bash
cd apps/agentanchor

# Generate migration from schema changes
npx drizzle-kit generate

# Review generated SQL
cat drizzle/[timestamp]_migration.sql
```

### Applying Migrations

#### Development

```bash
# Push schema directly (dev only)
npx drizzle-kit push
```

#### Staging/Production

```bash
# Apply migrations via migrate command
npx drizzle-kit migrate

# Or via Supabase CLI
supabase db push --db-url "$DATABASE_URL"
```

### Migration Safety Rules

1. **Never drop columns/tables directly** - deprecate first
2. **Add nullable columns** - make NOT NULL in separate migration
3. **Add indexes concurrently** - `CREATE INDEX CONCURRENTLY`
4. **Test rollback** - ensure you can reverse changes
5. **Backup first** - snapshot before destructive changes

### Rollback Migrations

```sql
-- Create rollback script for each migration
-- Example: drizzle/[timestamp]_migration_rollback.sql

-- Rollback: Add trust_signals column
ALTER TABLE agents DROP COLUMN IF EXISTS trust_signals;
```

```bash
# Execute rollback
psql "$DATABASE_URL" -f drizzle/[timestamp]_migration_rollback.sql
```

---

## Rollback Procedures

### Vercel Instant Rollback

```bash
# List recent deployments
vercel ls

# Rollback to previous deployment
vercel rollback [deployment-url]

# Or via dashboard
# 1. Go to Vercel Dashboard
# 2. Select project
# 3. Go to Deployments
# 4. Click "..." on target deployment
# 5. Select "Promote to Production"
```

### Application Rollback Steps

1. **Identify Issue**
   ```bash
   # Check logs
   vercel logs https://app.agentanchorai.com

   # Check Sentry
   # Open Sentry dashboard for error details
   ```

2. **Decision Point**
   - Minor issue → Hotfix forward
   - Major issue → Rollback

3. **Execute Rollback**
   ```bash
   # Instant rollback via Vercel
   vercel rollback [previous-deployment]

   # Verify rollback
   curl https://app.agentanchorai.com/api/health
   ```

4. **Communicate**
   - Notify team in #deployments channel
   - Update status page if user-facing

5. **Post-Mortem**
   - Document what went wrong
   - Create fix PR
   - Schedule re-deployment

### Database Rollback

**WARNING:** Database rollbacks can cause data loss.

1. **Restore from backup** (safest)
   ```bash
   # Neon: Use point-in-time recovery
   # Go to Neon Dashboard → Branches → Restore
   ```

2. **Run rollback script**
   ```bash
   psql "$DATABASE_URL" -f drizzle/rollback_[timestamp].sql
   ```

---

## Health Checks

### Endpoints

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `/api/health` | Basic health | `{ "status": "healthy" }` |
| `/api/ready` | Readiness check | `{ "status": "ready", "services": {...} }` |
| `/api/version` | Version info | `{ "version": "1.2.3", "commit": "abc123" }` |

### Health Check Script

```bash
#!/bin/bash
# scripts/health-check.sh

BASE_URL=${1:-"https://app.agentanchorai.com"}

echo "Checking health at $BASE_URL..."

# Health check
HEALTH=$(curl -s "$BASE_URL/api/health")
if [[ $(echo $HEALTH | jq -r '.status') != "healthy" ]]; then
    echo "FAIL: Health check failed"
    echo $HEALTH
    exit 1
fi
echo "✓ Health check passed"

# Ready check
READY=$(curl -s "$BASE_URL/api/ready")
if [[ $(echo $READY | jq -r '.status') != "ready" ]]; then
    echo "FAIL: Ready check failed"
    echo $READY
    exit 1
fi
echo "✓ Ready check passed"

# API response check
API=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/health")
if [[ $API != "200" ]]; then
    echo "FAIL: API returned $API"
    exit 1
fi
echo "✓ API check passed"

echo ""
echo "All health checks passed!"
```

### Automated Health Monitoring

Configure uptime monitoring:

```yaml
# monitoring/uptime.yaml
checks:
  - name: AgentAnchor Health
    url: https://app.agentanchorai.com/api/health
    interval: 60s
    timeout: 10s
    alerting:
      - slack: #alerts
      - pagerduty: on-call

  - name: API Health
    url: https://api.agentanchorai.com/api/v1/health
    interval: 30s
    timeout: 5s
```

---

## Monitoring & Alerts

### Key Metrics

| Metric | Warning | Critical |
|--------|---------|----------|
| Response time (p95) | > 500ms | > 2000ms |
| Error rate | > 1% | > 5% |
| CPU usage | > 70% | > 90% |
| Memory usage | > 80% | > 95% |
| Database connections | > 80% pool | > 95% pool |

### Sentry Configuration

```typescript
// sentry.client.config.ts

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV || 'development',

  // Performance monitoring
  tracesSampleRate: 0.1,  // 10% of transactions

  // Release tracking
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  // Filter sensitive data
  beforeSend(event) {
    // Remove sensitive headers
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
    }
    return event;
  }
});
```

### Alert Configuration

```yaml
# Alert rules

alerts:
  - name: High Error Rate
    condition: error_rate > 5%
    duration: 5m
    severity: critical
    notify:
      - pagerduty
      - slack: #incidents

  - name: Elevated Response Time
    condition: p95_latency > 1000ms
    duration: 10m
    severity: warning
    notify:
      - slack: #alerts

  - name: Database Connection Pool
    condition: db_connections > 80%
    duration: 5m
    severity: warning
    notify:
      - slack: #alerts
```

---

## Troubleshooting

### Common Issues

#### Deployment Stuck

**Symptoms:** Vercel deployment hangs

**Solution:**
```bash
# Cancel stuck deployment
vercel cancel

# Check build logs
vercel logs --follow

# Redeploy
vercel --prod
```

#### Database Connection Errors

**Symptoms:** `ECONNREFUSED` or `too many connections`

**Solution:**
```bash
# Check connection pool settings
# Neon: Max 100 connections per branch

# Reduce pool size in DATABASE_URL
# ?connection_limit=10

# Check current connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'your_db';
```

#### Environment Variable Missing

**Symptoms:** `TypeError: Cannot read property of undefined`

**Solution:**
```bash
# List Vercel env vars
vercel env ls

# Add missing variable
vercel env add VARIABLE_NAME production

# Redeploy to pick up changes
vercel --prod
```

#### Build Failures

**Symptoms:** TypeScript or build errors

**Solution:**
```bash
# Clear caches
rm -rf .next node_modules/.cache

# Fresh install
rm -rf node_modules
npm install

# Build locally first
npm run build
```

### Logs Access

```bash
# Vercel logs (real-time)
vercel logs --follow

# Historical logs
vercel logs --since 1h

# Specific deployment
vercel logs [deployment-url]

# Supabase logs
supabase logs --project-ref [ref]
```

### Emergency Contacts

| Role | Contact | When to Escalate |
|------|---------|------------------|
| On-Call Engineer | PagerDuty | Any P1 incident |
| Platform Lead | @lead | Architecture decisions |
| Database Admin | @dba | Data corruption, migrations |
| Security | @security | Security incidents |

---

## Deployment Calendar

### Maintenance Windows

| Day | Time (UTC) | Type |
|-----|------------|------|
| Tuesday | 02:00-04:00 | Routine deployments |
| Thursday | 02:00-04:00 | Routine deployments |
| Sunday | 04:00-08:00 | Major releases |

### Blackout Periods

- Month-end (last 3 days)
- Major holidays
- During scheduled demos
- Customer go-lives

---

## Appendix

### Useful Commands

```bash
# Vercel
vercel ls                    # List deployments
vercel logs                  # View logs
vercel env ls                # List env vars
vercel rollback              # Rollback deployment
vercel inspect [url]         # Inspect deployment

# Database
npx drizzle-kit push         # Apply schema (dev)
npx drizzle-kit generate     # Generate migration
npx drizzle-kit studio       # Open Drizzle Studio

# Supabase
supabase login               # Authenticate
supabase db push             # Apply migrations
supabase db reset            # Reset database

# Testing
npm run test                 # Run tests
npm run test:e2e             # E2E tests
npm run lint                 # Lint check
```

### Deployment Checklist Template

```markdown
## Deployment: [Version/PR]

### Pre-Deployment
- [ ] Tests passing
- [ ] Code reviewed
- [ ] Migrations reviewed
- [ ] Env vars set
- [ ] Stakeholders notified

### Deployment
- [ ] Staging deployed
- [ ] Staging verified
- [ ] Production deployed
- [ ] Production verified

### Post-Deployment
- [ ] Health checks passing
- [ ] Monitoring normal
- [ ] Changelog updated
- [ ] Team notified
```

---

*Deployment Runbook created by BMad Master*
*Review and update quarterly*
