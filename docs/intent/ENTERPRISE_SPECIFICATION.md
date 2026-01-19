# VORION INTENT: Enterprise Specification

**Version:** 1.0.0
**Status:** Draft
**Target:** Global Standard for AI Governance
**Audiences:** Enterprises, Governments, Personal Use, Developers

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Core Engine Specifications](#3-core-engine-specifications)
4. [Database Schema](#4-database-schema)
5. [API Specification](#5-api-specification)
6. [Security Framework](#6-security-framework)
7. [Compliance Framework](#7-compliance-framework)
8. [Observability Framework](#8-observability-framework)
9. [Operational Framework](#9-operational-framework)
10. [Integration Framework](#10-integration-framework)
11. [Testing Framework](#11-testing-framework)
12. [Deployment Specifications](#12-deployment-specifications)
13. [Migration Path](#13-migration-path)
14. [Appendices](#14-appendices)

---

## 1. Executive Summary

### 1.1 Vision

INTENT is the core orchestration layer of Vorion, designed to become the **global standard for AI governance**. It must support:

- **Enterprises**: Fortune 500, multi-national corporations with complex governance requirements
- **Governments**: Federal, state, and municipal agencies with strict compliance mandates
- **Personal Use**: Individual developers and small teams with simple governance needs
- **Global Scale**: 10M+ intents/day, multi-region, multi-tenant isolation

### 1.2 Current State Assessment

| Dimension | Current | Target | Gap |
|-----------|---------|--------|-----|
| Security | 4/10 | 10/10 | Critical |
| Scalability | 5/10 | 10/10 | Large |
| Compliance | 2/10 | 10/10 | Critical |
| Observability | 6/10 | 10/10 | Medium |
| Operability | 3/10 | 10/10 | Large |
| API Quality | 5/10 | 10/10 | Medium |

### 1.3 Success Criteria

1. **Zero-downtime deployments** with rolling updates
2. **99.99% availability** SLA (52.6 minutes/year downtime max)
3. **Sub-second P99 latency** for intent submission
4. **SOC 2 Type II, HIPAA, FedRAMP** certification ready
5. **Multi-region active-active** deployment capability
6. **Complete audit trail** for all governance decisions

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL LAYER                                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │   Web   │  │  Mobile │  │   CLI   │  │   SDK   │  │   API   │          │
│  │  Apps   │  │  Apps   │  │  Tools  │  │ Clients │  │ Gateway │          │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘          │
└───────┼────────────┼────────────┼────────────┼────────────┼─────────────────┘
        │            │            │            │            │
        └────────────┴────────────┴────────────┴────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GATEWAY LAYER                                   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         API Gateway (Kong/Envoy)                      │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐             │  │
│  │  │   Auth   │  │   Rate   │  │  Request │  │  Circuit │             │  │
│  │  │  (OIDC)  │  │  Limit   │  │ Validate │  │  Breaker │             │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CONTROL PLANE                                   │
│                                                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                   │
│  │    POLICY     │  │    AUDIT      │  │   ANALYTICS   │                   │
│  │    ENGINE     │  │    ENGINE     │  │    ENGINE     │                   │
│  │               │  │               │  │               │                   │
│  │  - OPA/Rego   │  │  - Immutable  │  │  - Anomaly    │                   │
│  │  - Versioned  │  │  - Queryable  │  │  - Forecast   │                   │
│  │  - Hot reload │  │  - Compliant  │  │  - ML-based   │                   │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘                   │
│          │                  │                  │                            │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                   │
│  │  NOTIFICATION │  │    REPLAY     │  │  FEDERATION   │                   │
│  │    ENGINE     │  │    ENGINE     │  │    ENGINE     │                   │
│  │               │  │               │  │               │                   │
│  │  - Multi-ch   │  │  - Historical │  │  - Cross-org  │                   │
│  │  - Templates  │  │  - What-if    │  │  - Trust fed  │                   │
│  │  - Routing    │  │  - Backfill   │  │  - Sovereign  │                   │
│  └───────────────┘  └───────────────┘  └───────────────┘                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA PLANE                                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        INTENT ORCHESTRATOR                           │   │
│  │                                                                      │   │
│  │  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐          │   │
│  │  │ INTAKE  │───▶│ EVALUATE│───▶│ DECIDE  │───▶│ ENFORCE │          │   │
│  │  │ STAGE   │    │  STAGE  │    │  STAGE  │    │  STAGE  │          │   │
│  │  └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘          │   │
│  │       │              │              │              │                │   │
│  │       ▼              ▼              ▼              ▼                │   │
│  │  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐          │   │
│  │  │Validate │    │  Trust  │    │  Rules  │    │ Execute │          │   │
│  │  │ Dedupe  │    │  Engine │    │  Engine │    │ Monitor │          │   │
│  │  │ Enrich  │    │         │    │         │    │         │          │   │
│  │  └─────────┘    └─────────┘    └─────────┘    └─────────┘          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                  │                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     ESCALATION GATEWAY                               │   │
│  │                                                                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │   │
│  │  │   Create    │  │   Resolve   │  │   Timeout   │                  │   │
│  │  │  Escalation │  │  (Approve/  │  │   Handler   │                  │   │
│  │  │             │  │   Reject)   │  │             │                  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PERSISTENCE LAYER                                  │
│                                                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐ │
│  │  PostgreSQL   │  │    Redis      │  │   S3/Blob     │  │ TimeSeries  │ │
│  │  (Primary)    │  │   (Cache/     │  │  (Archive)    │  │ (Metrics)   │ │
│  │               │  │   Queue)      │  │               │  │             │ │
│  │ - Intents     │  │ - Rate limit  │  │ - Audit logs  │  │ - Prom/VicM │ │
│  │ - Events      │  │ - Locks       │  │ - Backups     │  │ - Traces    │ │
│  │ - Escalations │  │ - Session     │  │ - Compliance  │  │ - Logs      │ │
│  │ - Policies    │  │ - Queue jobs  │  │               │  │             │ │
│  │               │  │               │  │               │  │             │ │
│  │ [Partitioned] │  │ [Cluster]     │  │ [Encrypted]   │  │ [Federated] │ │
│  └───────────────┘  └───────────────┘  └───────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          INTEGRATION LAYER                                   │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │   Webhook   │  │    Email    │  │    Slack    │  │  PagerDuty  │       │
│  │   Service   │  │   Service   │  │   Service   │  │   Service   │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │   External  │  │   Identity  │  │    Vault    │  │   External  │       │
│  │   Trust     │  │   Provider  │  │    (KMS)    │  │   Policy    │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Responsibilities

| Component | Responsibility | SLA |
|-----------|---------------|-----|
| API Gateway | Auth, rate limit, routing | 99.99% |
| Intent Orchestrator | Core processing pipeline | 99.99% |
| Policy Engine | Rule evaluation | 99.95% |
| Audit Engine | Compliance logging | 99.999% |
| Escalation Gateway | Human-in-the-loop | 99.9% |
| Notification Engine | Multi-channel alerts | 99.9% |
| Analytics Engine | BI and anomaly detection | 99.5% |

### 2.3 Data Flow

```
1. SUBMISSION
   Client → Gateway → Validate → Dedupe → Persist → Enqueue

2. EVALUATION
   Queue → Trust Snapshot → Trust Gate → Rules Engine → Decision

3. DECISION
   Decision → Policy Check → Enforce/Escalate → Notify → Complete

4. ESCALATION
   Escalate → Create Record → Notify → Wait → Resolve/Timeout → Resume
```

---

## 3. Core Engine Specifications

### 3.1 Policy Engine

**Purpose:** Declarative governance rules evaluated at decision time

#### 3.1.1 Architecture

```typescript
interface PolicyEngine {
  // Core operations
  evaluate(context: PolicyContext): Promise<PolicyDecision>;
  listPolicies(tenantId: ID): Promise<Policy[]>;
  getPolicy(policyId: ID): Promise<Policy | null>;

  // Policy management
  createPolicy(policy: PolicyDefinition): Promise<Policy>;
  updatePolicy(policyId: ID, policy: PolicyDefinition): Promise<Policy>;
  deletePolicy(policyId: ID): Promise<void>;

  // Versioning
  getVersion(policyId: ID, version: number): Promise<Policy | null>;
  rollback(policyId: ID, version: number): Promise<Policy>;

  // Testing
  dryRun(context: PolicyContext, policyId?: ID): Promise<PolicyDecision>;
  validate(policy: PolicyDefinition): Promise<ValidationResult>;
}
```

#### 3.1.2 Policy Definition Language

```yaml
# policies/data-export.yaml
apiVersion: vorion.io/v1
kind: Policy
metadata:
  name: data-export-policy
  namespace: default
  version: 1.2.0
  labels:
    intent-type: data-export
    risk-level: high
spec:
  description: "Controls data export operations"

  # Matching criteria
  match:
    intentTypes:
      - "data-export"
      - "bulk-download"
    entityTypes:
      - "user"
      - "service"

  # Rules evaluated in order (first match wins)
  rules:
    - name: "block-pii-export-low-trust"
      description: "Block PII export for entities below trust level 3"
      condition: |
        intent.context.containsPII == true &&
        entity.trustLevel < 3
      action: deny
      reason: "PII export requires trust level 3 or higher"

    - name: "escalate-bulk-export"
      description: "Escalate exports exceeding 10000 records"
      condition: |
        intent.context.recordCount > 10000
      action: escalate
      reason: "Bulk exports require human approval"
      escalateTo: "data-governance-team"
      timeout: "PT4H"

    - name: "allow-during-business-hours"
      description: "Allow exports during business hours"
      condition: |
        time.hour >= 9 && time.hour <= 17 &&
        time.dayOfWeek >= 1 && time.dayOfWeek <= 5
      action: allow

    - name: "rate-limit-after-hours"
      description: "Rate limit after-hours exports"
      condition: |
        time.hour < 9 || time.hour > 17
      action: limit
      limit:
        requests: 10
        window: "PT1H"
      reason: "After-hours exports are rate limited"

  # Default action if no rules match
  default:
    action: deny
    reason: "No matching policy rule"

  # Audit requirements
  audit:
    level: detailed
    includeContext: true
    retentionDays: 2555
```

#### 3.1.3 Policy Evaluation Context

```typescript
interface PolicyContext {
  // Intent details
  intent: {
    id: ID;
    type: string;
    goal: string;
    context: Record<string, unknown>;
    metadata: Record<string, unknown>;
    priority: number;
  };

  // Entity details
  entity: {
    id: ID;
    type: EntityType;
    trustLevel: TrustLevel;
    trustScore: TrustScore;
    trustComponents: TrustComponents;
    attributes: Record<string, unknown>;
  };

  // Tenant details
  tenant: {
    id: ID;
    tier: 'free' | 'standard' | 'enterprise' | 'government';
    features: string[];
    limits: Record<string, number>;
  };

  // Temporal context
  time: {
    timestamp: string;
    hour: number;
    dayOfWeek: number;
    dayOfMonth: number;
    month: number;
    year: number;
    timezone: string;
  };

  // Historical context
  history: {
    recentIntents: number;
    recentDenials: number;
    recentEscalations: number;
    lastIntentAt: string | null;
  };

  // Request context
  request: {
    ip: string;
    userAgent: string;
    geoLocation?: {
      country: string;
      region: string;
    };
  };
}
```

#### 3.1.4 Database Schema

```sql
-- Policy definitions
CREATE TABLE policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(256) NOT NULL,
  namespace VARCHAR(128) NOT NULL DEFAULT 'default',
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  definition JSONB NOT NULL,
  checksum VARCHAR(64) NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,

  CONSTRAINT policies_tenant_name_version_unique
    UNIQUE (tenant_id, namespace, name, version),
  CONSTRAINT policies_status_check
    CHECK (status IN ('draft', 'published', 'deprecated', 'archived'))
);

-- Policy version history
CREATE TABLE policy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES policies(id),
  version INTEGER NOT NULL,
  definition JSONB NOT NULL,
  checksum VARCHAR(64) NOT NULL,
  change_summary TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT policy_versions_unique UNIQUE (policy_id, version)
);

-- Policy evaluation cache
CREATE TABLE policy_cache (
  cache_key VARCHAR(256) PRIMARY KEY,
  policy_id UUID NOT NULL REFERENCES policies(id),
  result JSONB NOT NULL,
  context_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  CONSTRAINT policy_cache_expiry CHECK (expires_at > created_at)
);

-- Indexes
CREATE INDEX idx_policies_tenant_status ON policies(tenant_id, status);
CREATE INDEX idx_policies_namespace ON policies(namespace) WHERE status = 'published';
CREATE INDEX idx_policy_versions_policy ON policy_versions(policy_id);
CREATE INDEX idx_policy_cache_expiry ON policy_cache(expires_at);
```

---

### 3.2 Audit Engine

**Purpose:** Immutable, queryable audit log with compliance reporting

#### 3.2.1 Architecture

```typescript
interface AuditEngine {
  // Core logging
  log(event: AuditEvent): Promise<AuditRecord>;
  logBatch(events: AuditEvent[]): Promise<AuditRecord[]>;

  // Querying
  query(filter: AuditFilter): Promise<AuditQueryResult>;
  getRecord(recordId: ID): Promise<AuditRecord | null>;

  // Chain verification
  verifyChain(from: string, to: string): Promise<ChainVerification>;
  getChainProof(recordId: ID): Promise<ChainProof>;

  // Compliance reports
  generateReport(type: ReportType, params: ReportParams): Promise<Report>;
  scheduleReport(schedule: ReportSchedule): Promise<void>;

  // Archival
  archive(before: string): Promise<ArchiveResult>;
  restore(archiveId: ID): Promise<RestoreResult>;
}
```

#### 3.2.2 Audit Event Schema

```typescript
interface AuditEvent {
  // Event identification
  eventType: AuditEventType;
  eventCategory: 'intent' | 'escalation' | 'policy' | 'admin' | 'system';
  severity: 'info' | 'warning' | 'error' | 'critical';

  // Actor information
  actor: {
    type: 'user' | 'service' | 'system';
    id: ID;
    name?: string;
    ip?: string;
    userAgent?: string;
  };

  // Target information
  target: {
    type: 'intent' | 'escalation' | 'policy' | 'tenant' | 'entity';
    id: ID;
    name?: string;
  };

  // Context
  tenantId: ID;
  requestId: string;
  traceId?: string;
  spanId?: string;

  // Event details
  action: string;
  outcome: 'success' | 'failure' | 'partial';
  reason?: string;

  // Change tracking
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  diff?: Record<string, { old: unknown; new: unknown }>;

  // Metadata
  metadata?: Record<string, unknown>;
  tags?: string[];
}

type AuditEventType =
  // Intent events
  | 'intent.submitted'
  | 'intent.evaluated'
  | 'intent.approved'
  | 'intent.denied'
  | 'intent.escalated'
  | 'intent.completed'
  | 'intent.failed'
  | 'intent.cancelled'
  | 'intent.deleted'

  // Escalation events
  | 'escalation.created'
  | 'escalation.acknowledged'
  | 'escalation.approved'
  | 'escalation.rejected'
  | 'escalation.timeout'
  | 'escalation.reassigned'

  // Policy events
  | 'policy.created'
  | 'policy.updated'
  | 'policy.published'
  | 'policy.deprecated'
  | 'policy.deleted'
  | 'policy.evaluated'

  // Admin events
  | 'admin.tenant.created'
  | 'admin.tenant.updated'
  | 'admin.tenant.suspended'
  | 'admin.user.created'
  | 'admin.user.updated'
  | 'admin.user.deleted'
  | 'admin.config.changed'

  // System events
  | 'system.startup'
  | 'system.shutdown'
  | 'system.error'
  | 'system.maintenance'
  | 'system.backup'
  | 'system.restore';
```

#### 3.2.3 Database Schema

```sql
-- Audit records (append-only, partitioned by month)
CREATE TABLE audit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Event identification
  event_type VARCHAR(64) NOT NULL,
  event_category VARCHAR(32) NOT NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'info',

  -- Actor
  actor_type VARCHAR(32) NOT NULL,
  actor_id UUID NOT NULL,
  actor_name VARCHAR(256),
  actor_ip INET,
  actor_user_agent TEXT,

  -- Target
  target_type VARCHAR(32) NOT NULL,
  target_id UUID NOT NULL,
  target_name VARCHAR(256),

  -- Context
  request_id UUID NOT NULL,
  trace_id VARCHAR(64),
  span_id VARCHAR(64),

  -- Event details
  action VARCHAR(128) NOT NULL,
  outcome VARCHAR(16) NOT NULL,
  reason TEXT,

  -- Change tracking (encrypted at rest)
  before_state JSONB,
  after_state JSONB,
  diff_state JSONB,

  -- Metadata
  metadata JSONB,
  tags TEXT[],

  -- Chain integrity
  sequence_number BIGINT NOT NULL,
  previous_hash VARCHAR(64),
  record_hash VARCHAR(64) NOT NULL,

  -- Timestamps
  event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT audit_records_severity_check
    CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  CONSTRAINT audit_records_outcome_check
    CHECK (outcome IN ('success', 'failure', 'partial'))
) PARTITION BY RANGE (event_time);

-- Create monthly partitions
CREATE TABLE audit_records_2024_01 PARTITION OF audit_records
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
-- ... (auto-generated by partition manager)

-- Indexes
CREATE INDEX idx_audit_tenant_time ON audit_records(tenant_id, event_time DESC);
CREATE INDEX idx_audit_actor ON audit_records(actor_id, event_time DESC);
CREATE INDEX idx_audit_target ON audit_records(target_type, target_id, event_time DESC);
CREATE INDEX idx_audit_event_type ON audit_records(event_type, event_time DESC);
CREATE INDEX idx_audit_request ON audit_records(request_id);
CREATE INDEX idx_audit_trace ON audit_records(trace_id) WHERE trace_id IS NOT NULL;

-- Chain verification
CREATE TABLE audit_chain_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  checkpoint_time TIMESTAMPTZ NOT NULL,
  first_sequence BIGINT NOT NULL,
  last_sequence BIGINT NOT NULL,
  record_count INTEGER NOT NULL,
  chain_root_hash VARCHAR(64) NOT NULL,
  merkle_root VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT audit_chain_unique UNIQUE (tenant_id, checkpoint_time)
);
```

#### 3.2.4 Compliance Reports

```typescript
interface ReportType {
  // GDPR reports
  'gdpr.access-log': GDPRAccessReport;
  'gdpr.data-processing': GDPRProcessingReport;
  'gdpr.deletion-log': GDPRDeletionReport;

  // SOC 2 reports
  'soc2.access-control': SOC2AccessReport;
  'soc2.change-management': SOC2ChangeReport;
  'soc2.incident-response': SOC2IncidentReport;

  // HIPAA reports
  'hipaa.access-log': HIPAAAccessReport;
  'hipaa.disclosure-log': HIPAADisclosureReport;

  // Custom reports
  'custom.intent-volume': IntentVolumeReport;
  'custom.escalation-metrics': EscalationMetricsReport;
  'custom.policy-effectiveness': PolicyEffectivenessReport;
}

interface GDPRAccessReport {
  tenantId: ID;
  entityId: ID;
  period: { from: string; to: string };

  accessRecords: Array<{
    timestamp: string;
    accessor: { type: string; id: ID; name: string };
    dataCategory: string;
    purpose: string;
    lawfulBasis: string;
  }>;

  summary: {
    totalAccesses: number;
    uniqueAccessors: number;
    dataCategories: string[];
  };
}
```

---

### 3.3 Notification Engine

**Purpose:** Multi-channel alerting for escalations and SLA breaches

#### 3.3.1 Architecture

```typescript
interface NotificationEngine {
  // Core operations
  send(notification: Notification): Promise<NotificationResult>;
  sendBatch(notifications: Notification[]): Promise<NotificationResult[]>;

  // Templates
  createTemplate(template: NotificationTemplate): Promise<Template>;
  updateTemplate(templateId: ID, template: NotificationTemplate): Promise<Template>;
  listTemplates(tenantId: ID): Promise<Template[]>;

  // Channels
  registerChannel(channel: ChannelConfig): Promise<Channel>;
  testChannel(channelId: ID): Promise<ChannelTestResult>;

  // Routing
  setRoutingRules(rules: RoutingRule[]): Promise<void>;
  getRoutingRules(tenantId: ID): Promise<RoutingRule[]>;

  // Tracking
  getDeliveryStatus(notificationId: ID): Promise<DeliveryStatus>;
  getDeliveryHistory(filter: DeliveryFilter): Promise<DeliveryHistory>;
}
```

#### 3.3.2 Notification Schema

```typescript
interface Notification {
  // Identification
  type: NotificationType;
  priority: 'low' | 'normal' | 'high' | 'urgent';

  // Targeting
  tenantId: ID;
  recipients: Recipient[];

  // Content
  subject: string;
  body: string;
  templateId?: ID;
  templateData?: Record<string, unknown>;

  // Attachments
  attachments?: Attachment[];

  // Delivery options
  channels: ChannelType[];
  fallbackChannels?: ChannelType[];

  // Timing
  sendAt?: string;
  expiresAt?: string;

  // Tracking
  requireAcknowledgment?: boolean;
  acknowledgmentDeadline?: string;

  // Context
  context: {
    intentId?: ID;
    escalationId?: ID;
    policyId?: ID;
    requestId: string;
  };
}

type NotificationType =
  | 'escalation.created'
  | 'escalation.reminder'
  | 'escalation.urgent'
  | 'escalation.timeout-warning'
  | 'escalation.resolved'
  | 'sla.breach-warning'
  | 'sla.breached'
  | 'policy.violation'
  | 'system.alert'
  | 'system.maintenance';

type ChannelType =
  | 'email'
  | 'sms'
  | 'slack'
  | 'teams'
  | 'pagerduty'
  | 'webhook'
  | 'in-app';

interface Recipient {
  type: 'user' | 'group' | 'role' | 'channel';
  id: ID;
  name?: string;

  // Channel-specific addresses
  email?: string;
  phone?: string;
  slackUserId?: string;
  slackChannelId?: string;
  teamsUserId?: string;
  teamsChannelId?: string;
  webhookUrl?: string;
}
```

#### 3.3.3 Database Schema

```sql
-- Notification templates
CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(128) NOT NULL,
  type VARCHAR(64) NOT NULL,
  channel VARCHAR(32) NOT NULL,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  metadata JSONB,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT templates_tenant_name_channel_unique
    UNIQUE (tenant_id, name, channel)
);

-- Notification channels
CREATE TABLE notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(128) NOT NULL,
  type VARCHAR(32) NOT NULL,
  config JSONB NOT NULL, -- Encrypted
  is_enabled BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT channels_tenant_name_unique UNIQUE (tenant_id, name)
);

-- Notification routing rules
CREATE TABLE notification_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(128) NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  condition JSONB NOT NULL,
  channels UUID[] NOT NULL,
  recipients JSONB NOT NULL,
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notification delivery log
CREATE TABLE notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  notification_id UUID NOT NULL,
  channel_id UUID REFERENCES notification_channels(id),
  channel_type VARCHAR(32) NOT NULL,
  recipient_id UUID NOT NULL,
  recipient_address VARCHAR(256),

  -- Status
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  status_detail TEXT,

  -- Timing
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,

  -- Retry tracking
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,

  -- Response
  external_id VARCHAR(256),
  response JSONB,

  CONSTRAINT delivery_status_check
    CHECK (status IN ('pending', 'queued', 'sent', 'delivered', 'read',
                      'acknowledged', 'failed', 'expired', 'cancelled'))
) PARTITION BY RANGE (queued_at);

-- Indexes
CREATE INDEX idx_deliveries_status ON notification_deliveries(status, next_retry_at)
  WHERE status IN ('pending', 'queued', 'failed');
CREATE INDEX idx_deliveries_notification ON notification_deliveries(notification_id);
CREATE INDEX idx_deliveries_recipient ON notification_deliveries(recipient_id, queued_at DESC);
```

---

### 3.4 Replay Engine

**Purpose:** Re-process historical intents with new rules/policies

#### 3.4.1 Architecture

```typescript
interface ReplayEngine {
  // Replay operations
  createReplay(params: ReplayParams): Promise<Replay>;
  startReplay(replayId: ID): Promise<void>;
  pauseReplay(replayId: ID): Promise<void>;
  cancelReplay(replayId: ID): Promise<void>;

  // Monitoring
  getStatus(replayId: ID): Promise<ReplayStatus>;
  getProgress(replayId: ID): Promise<ReplayProgress>;
  getResults(replayId: ID): Promise<ReplayResults>;

  // What-if analysis
  whatIf(intentId: ID, policyId: ID): Promise<WhatIfResult>;
  whatIfBatch(intentIds: ID[], policyId: ID): Promise<WhatIfResult[]>;

  // Comparison
  compare(replayId: ID, baseline: 'original' | ID): Promise<ComparisonReport>;
}

interface ReplayParams {
  name: string;
  description?: string;
  tenantId: ID;

  // Scope
  filter: {
    intentIds?: ID[];
    intentTypes?: string[];
    entityIds?: string[];
    dateRange?: { from: string; to: string };
    statuses?: IntentStatus[];
  };

  // Replay configuration
  mode: 'dry-run' | 'shadow' | 'live';
  policyVersion?: number;
  trustSnapshot?: 'original' | 'current';

  // Rate limiting
  maxConcurrency?: number;
  rateLimit?: number; // intents per second

  // Output
  captureDecisions: boolean;
  captureDiffs: boolean;
}

interface ReplayProgress {
  replayId: ID;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;

  percentComplete: number;
  estimatedTimeRemaining?: number; // seconds

  currentIntentId?: ID;
  errors: Array<{ intentId: ID; error: string }>;

  startedAt?: string;
  completedAt?: string;
}

interface WhatIfResult {
  intentId: ID;

  original: {
    policyVersion: number;
    decision: Decision;
    evaluatedAt: string;
  };

  simulated: {
    policyVersion: number;
    decision: Decision;
    evaluatedAt: string;
  };

  diff: {
    actionChanged: boolean;
    originalAction: ControlAction;
    simulatedAction: ControlAction;

    constraintChanges: Array<{
      constraintId: ID;
      original: ConstraintEvaluationResult;
      simulated: ConstraintEvaluationResult;
    }>;
  };
}
```

---

### 3.5 Analytics Engine

**Purpose:** Business intelligence on governance patterns

#### 3.5.1 Architecture

```typescript
interface AnalyticsEngine {
  // Metrics
  getMetrics(query: MetricsQuery): Promise<MetricsResult>;

  // Time series
  getTimeSeries(query: TimeSeriesQuery): Promise<TimeSeriesResult>;

  // Anomaly detection
  detectAnomalies(params: AnomalyParams): Promise<AnomalyResult[]>;
  configureAnomalyDetection(config: AnomalyConfig): Promise<void>;

  // Forecasting
  forecast(params: ForecastParams): Promise<ForecastResult>;

  // Dashboards
  createDashboard(dashboard: DashboardDefinition): Promise<Dashboard>;
  getDashboard(dashboardId: ID): Promise<Dashboard>;

  // Alerts
  createAlert(alert: AlertDefinition): Promise<Alert>;
  getAlertHistory(alertId: ID): Promise<AlertHistory>;
}

interface MetricsQuery {
  tenantId?: ID;
  metrics: MetricName[];
  dimensions?: string[];
  filters?: Record<string, string | string[]>;
  timeRange: { from: string; to: string };
  granularity: 'minute' | 'hour' | 'day' | 'week' | 'month';
}

type MetricName =
  // Volume metrics
  | 'intents.submitted'
  | 'intents.approved'
  | 'intents.denied'
  | 'intents.escalated'
  | 'intents.completed'
  | 'intents.failed'

  // Latency metrics
  | 'intents.submission_latency'
  | 'intents.evaluation_latency'
  | 'intents.decision_latency'
  | 'intents.total_latency'

  // Trust metrics
  | 'trust.gate_passes'
  | 'trust.gate_rejections'
  | 'trust.average_score'
  | 'trust.level_distribution'

  // Escalation metrics
  | 'escalations.created'
  | 'escalations.approved'
  | 'escalations.rejected'
  | 'escalations.timeout'
  | 'escalations.resolution_time'
  | 'escalations.pending'

  // Policy metrics
  | 'policies.evaluations'
  | 'policies.cache_hits'
  | 'policies.cache_misses'
  | 'policies.evaluation_latency';

interface AnomalyConfig {
  tenantId: ID;

  detectors: Array<{
    name: string;
    metric: MetricName;
    algorithm: 'zscore' | 'isolation_forest' | 'prophet' | 'custom';
    sensitivity: number; // 0-1
    windowSize: string; // ISO 8601 duration
    evaluationFrequency: string;

    alertOnAnomaly: boolean;
    alertChannels?: ID[];
  }>;
}
```

---

### 3.6 Federation Engine

**Purpose:** Cross-organization intent sharing with sovereignty

#### 3.6.1 Architecture

```typescript
interface FederationEngine {
  // Peer management
  registerPeer(peer: FederationPeer): Promise<Peer>;
  updatePeer(peerId: ID, peer: Partial<FederationPeer>): Promise<Peer>;
  removePeer(peerId: ID): Promise<void>;
  listPeers(): Promise<Peer[]>;

  // Trust federation
  requestTrustAttestation(entityId: ID, peerId: ID): Promise<TrustAttestation>;
  verifyTrustAttestation(attestation: TrustAttestation): Promise<VerificationResult>;

  // Intent sharing
  shareIntent(intentId: ID, peerId: ID, options: ShareOptions): Promise<SharedIntent>;
  receiveSharedIntent(intent: SharedIntent): Promise<Intent>;

  // Data residency
  setDataResidencyRules(rules: DataResidencyRule[]): Promise<void>;
  checkDataResidency(data: unknown, targetRegion: string): Promise<ResidencyResult>;
}

interface FederationPeer {
  name: string;
  organizationId: string;

  // Connection
  endpoint: string;
  publicKey: string;

  // Trust
  trustLevel: 'untrusted' | 'limited' | 'standard' | 'trusted' | 'privileged';

  // Capabilities
  capabilities: FederationCapability[];

  // Data handling
  dataResidency: {
    regions: string[];
    encryptionRequired: boolean;
    retentionPolicy: string;
  };
}

type FederationCapability =
  | 'intent.receive'
  | 'intent.share'
  | 'trust.attest'
  | 'trust.verify'
  | 'policy.sync'
  | 'audit.share';

interface TrustAttestation {
  // Identification
  attestationId: string;
  entityId: ID;
  issuerId: ID;

  // Trust claims
  trustLevel: TrustLevel;
  trustScore: TrustScore;
  trustComponents: TrustComponents;

  // Validity
  issuedAt: string;
  expiresAt: string;

  // Cryptographic proof
  signature: string;
  signatureAlgorithm: string;

  // Chain of trust
  issuerAttestation?: TrustAttestation;
}
```

---

## 4. Database Schema

### 4.1 Core Tables (Enhanced)

```sql
-- =============================================================================
-- TENANT MANAGEMENT
-- =============================================================================

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(256) NOT NULL,
  slug VARCHAR(128) NOT NULL UNIQUE,

  -- Classification
  tier VARCHAR(32) NOT NULL DEFAULT 'standard',
  status VARCHAR(32) NOT NULL DEFAULT 'active',

  -- Limits
  limits JSONB NOT NULL DEFAULT '{
    "maxIntentsPerDay": 10000,
    "maxConcurrentIntents": 1000,
    "maxPolicies": 100,
    "maxEscalationsPerDay": 500,
    "maxUsersPerTenant": 100,
    "retentionDays": 90
  }',

  -- Features
  features TEXT[] NOT NULL DEFAULT ARRAY['basic'],

  -- Compliance
  data_residency VARCHAR(32)[] DEFAULT ARRAY['us'],
  compliance_frameworks TEXT[],

  -- Billing
  billing_id VARCHAR(256),

  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  suspended_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT tenants_tier_check
    CHECK (tier IN ('free', 'standard', 'enterprise', 'government')),
  CONSTRAINT tenants_status_check
    CHECK (status IN ('active', 'suspended', 'deleted'))
);

-- =============================================================================
-- INTENTS (PARTITIONED)
-- =============================================================================

CREATE TABLE intents (
  id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  entity_id UUID NOT NULL,

  -- Core fields
  goal TEXT NOT NULL,
  intent_type VARCHAR(128),
  priority INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',

  -- Context (encrypted at rest)
  context JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',

  -- Trust metadata
  trust_snapshot JSONB,
  trust_level INTEGER,
  trust_score INTEGER,

  -- Deduplication
  dedupe_hash VARCHAR(64) NOT NULL,
  idempotency_key VARCHAR(128),

  -- Cancellation
  cancellation_reason TEXT,

  -- Policy reference
  policy_version INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evaluated_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  -- Constraints
  PRIMARY KEY (id, created_at),
  CONSTRAINT intents_status_check CHECK (status IN (
    'pending', 'evaluating', 'approved', 'denied', 'escalated',
    'executing', 'completed', 'failed', 'cancelled'
  )),
  CONSTRAINT intents_priority_check CHECK (priority BETWEEN 0 AND 9),
  CONSTRAINT intents_trust_level_check CHECK (trust_level IS NULL OR trust_level BETWEEN 0 AND 4)
) PARTITION BY RANGE (created_at);

-- Create partitions (auto-managed in production)
CREATE TABLE intents_2024_01 PARTITION OF intents
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Unique constraint within partition
CREATE UNIQUE INDEX intents_dedupe_idx ON intents(tenant_id, dedupe_hash, created_at);

-- Performance indexes
CREATE INDEX intents_tenant_status_idx ON intents(tenant_id, status, created_at DESC);
CREATE INDEX intents_entity_idx ON intents(entity_id, created_at DESC);
CREATE INDEX intents_type_idx ON intents(intent_type, created_at DESC) WHERE intent_type IS NOT NULL;

-- =============================================================================
-- INTENT EVENTS (APPEND-ONLY, PARTITIONED)
-- =============================================================================

CREATE TABLE intent_events (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  intent_id UUID NOT NULL,
  tenant_id UUID NOT NULL,

  -- Event details
  event_type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',

  -- Chain integrity
  sequence_number INTEGER NOT NULL,
  previous_hash VARCHAR(64),
  event_hash VARCHAR(64) NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE INDEX intent_events_intent_idx ON intent_events(intent_id, sequence_number);
CREATE INDEX intent_events_type_idx ON intent_events(event_type, created_at DESC);

-- =============================================================================
-- INTENT EVALUATIONS
-- =============================================================================

CREATE TABLE intent_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID NOT NULL,
  tenant_id UUID NOT NULL,

  -- Evaluation details
  stage VARCHAR(32) NOT NULL,
  result JSONB NOT NULL,

  -- Performance
  duration_ms INTEGER,

  -- Policy tracking
  policy_id UUID,
  policy_version INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT evaluations_stage_check CHECK (stage IN (
    'trust-snapshot', 'trust-gate', 'basis', 'policy', 'decision', 'error', 'cancelled'
  ))
);

CREATE INDEX intent_evaluations_intent_idx ON intent_evaluations(intent_id, stage);

-- =============================================================================
-- ESCALATIONS (PERSISTED, NOT JUST REDIS)
-- =============================================================================

CREATE TABLE escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID NOT NULL,
  tenant_id UUID NOT NULL,

  -- Escalation details
  reason TEXT NOT NULL,
  reason_category VARCHAR(64),

  -- Routing
  escalated_to VARCHAR(256) NOT NULL,
  escalated_by VARCHAR(256),

  -- Status
  status VARCHAR(32) NOT NULL DEFAULT 'pending',

  -- Resolution
  resolved_by VARCHAR(256),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,

  -- SLA tracking
  timeout_at TIMESTAMPTZ NOT NULL,
  acknowledged_at TIMESTAMPTZ,
  sla_breached BOOLEAN DEFAULT FALSE,

  -- Metadata
  context JSONB,
  metadata JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT escalations_status_check CHECK (status IN (
    'pending', 'acknowledged', 'approved', 'rejected', 'timeout', 'cancelled'
  ))
);

CREATE INDEX escalations_tenant_status_idx ON escalations(tenant_id, status, created_at DESC);
CREATE INDEX escalations_timeout_idx ON escalations(timeout_at) WHERE status = 'pending';
CREATE INDEX escalations_intent_idx ON escalations(intent_id);

-- =============================================================================
-- USERS & PERMISSIONS
-- =============================================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- Identity
  external_id VARCHAR(256), -- From IdP
  email VARCHAR(256) NOT NULL,
  name VARCHAR(256),

  -- Authentication
  password_hash VARCHAR(256),
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret VARCHAR(256),

  -- Authorization
  roles TEXT[] NOT NULL DEFAULT ARRAY['user'],
  permissions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  -- Status
  status VARCHAR(32) NOT NULL DEFAULT 'active',

  -- Metadata
  metadata JSONB,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT users_tenant_email_unique UNIQUE (tenant_id, email),
  CONSTRAINT users_status_check CHECK (status IN ('active', 'inactive', 'suspended', 'deleted'))
);

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(128) NOT NULL,
  description TEXT,
  permissions TEXT[] NOT NULL,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT roles_tenant_name_unique UNIQUE (tenant_id, name)
);

-- =============================================================================
-- ENCRYPTION KEY MANAGEMENT
-- =============================================================================

CREATE TABLE encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id), -- NULL for system keys

  -- Key identification
  key_id VARCHAR(64) NOT NULL UNIQUE,
  version INTEGER NOT NULL DEFAULT 1,

  -- Key material (encrypted with master key)
  encrypted_key BYTEA NOT NULL,
  key_checksum VARCHAR(64) NOT NULL,

  -- Algorithm
  algorithm VARCHAR(32) NOT NULL DEFAULT 'aes-256-gcm',

  -- Status
  status VARCHAR(32) NOT NULL DEFAULT 'active',

  -- Lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  rotated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,

  -- Usage tracking
  last_used_at TIMESTAMPTZ,
  usage_count BIGINT DEFAULT 0,

  CONSTRAINT keys_status_check CHECK (status IN ('pending', 'active', 'rotating', 'expired', 'revoked'))
);

CREATE INDEX encryption_keys_tenant_status ON encryption_keys(tenant_id, status);
CREATE INDEX encryption_keys_status_expires ON encryption_keys(status, expires_at)
  WHERE status = 'active';
```

### 4.2 Partitioning Strategy

```sql
-- Automatic partition management function
CREATE OR REPLACE FUNCTION create_monthly_partitions(
  table_name TEXT,
  start_date DATE,
  end_date DATE
) RETURNS VOID AS $$
DECLARE
  partition_date DATE := start_date;
  partition_name TEXT;
  start_range TEXT;
  end_range TEXT;
BEGIN
  WHILE partition_date < end_date LOOP
    partition_name := table_name || '_' || TO_CHAR(partition_date, 'YYYY_MM');
    start_range := TO_CHAR(partition_date, 'YYYY-MM-DD');
    end_range := TO_CHAR(partition_date + INTERVAL '1 month', 'YYYY-MM-DD');

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
      partition_name, table_name, start_range, end_range
    );

    partition_date := partition_date + INTERVAL '1 month';
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule partition creation (run monthly)
-- Creates partitions 3 months ahead
SELECT create_monthly_partitions('intents', CURRENT_DATE, CURRENT_DATE + INTERVAL '3 months');
SELECT create_monthly_partitions('intent_events', CURRENT_DATE, CURRENT_DATE + INTERVAL '3 months');
SELECT create_monthly_partitions('audit_records', CURRENT_DATE, CURRENT_DATE + INTERVAL '3 months');
```

---

## 5. API Specification

### 5.1 API Versioning Strategy

```yaml
# All APIs follow semantic versioning
# Base path: /api/v{major}

# Version negotiation via header
# Accept: application/vnd.vorion.v1+json

# Deprecation header
# Deprecation: true
# Sunset: Sat, 1 Jan 2025 00:00:00 GMT
```

### 5.2 Intent API (v2)

```yaml
openapi: 3.1.0
info:
  title: Vorion INTENT API
  version: 2.0.0
  description: Enterprise-grade intent governance API

servers:
  - url: https://api.vorion.io/api/v2
    description: Production
  - url: https://api.staging.vorion.io/api/v2
    description: Staging

security:
  - BearerAuth: []
  - OAuth2: [intents:read, intents:write]

paths:
  /intents:
    post:
      operationId: submitIntent
      summary: Submit a new intent for governance
      tags: [Intents]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/IntentSubmission'
      responses:
        '202':
          description: Intent accepted for processing
          headers:
            X-Request-Id:
              schema:
                type: string
            X-RateLimit-Limit:
              schema:
                type: integer
            X-RateLimit-Remaining:
              schema:
                type: integer
            X-RateLimit-Reset:
              schema:
                type: integer
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Intent'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '409':
          $ref: '#/components/responses/Conflict'
        '422':
          $ref: '#/components/responses/TrustInsufficient'
        '429':
          $ref: '#/components/responses/RateLimited'

    get:
      operationId: listIntents
      summary: List intents with pagination and filtering
      tags: [Intents]
      parameters:
        - name: status
          in: query
          schema:
            type: array
            items:
              $ref: '#/components/schemas/IntentStatus'
        - name: intent_type
          in: query
          schema:
            type: string
        - name: entity_id
          in: query
          schema:
            type: string
            format: uuid
        - name: created_after
          in: query
          schema:
            type: string
            format: date-time
        - name: created_before
          in: query
          schema:
            type: string
            format: date-time
        - name: cursor
          in: query
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 50
      responses:
        '200':
          description: List of intents
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Intent'
                  pagination:
                    $ref: '#/components/schemas/Pagination'

  /intents/{intentId}:
    get:
      operationId: getIntent
      summary: Get intent by ID
      tags: [Intents]
      parameters:
        - $ref: '#/components/parameters/IntentId'
        - name: include
          in: query
          description: Related resources to include
          schema:
            type: array
            items:
              type: string
              enum: [events, evaluations, escalations]
      responses:
        '200':
          description: Intent details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/IntentWithRelations'
        '404':
          $ref: '#/components/responses/NotFound'

    delete:
      operationId: deleteIntent
      summary: Soft delete an intent (GDPR)
      tags: [Intents]
      parameters:
        - $ref: '#/components/parameters/IntentId'
      responses:
        '200':
          description: Intent deleted
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Intent'
        '404':
          $ref: '#/components/responses/NotFound'

  /intents/{intentId}/cancel:
    post:
      operationId: cancelIntent
      summary: Cancel an in-flight intent
      tags: [Intents]
      parameters:
        - $ref: '#/components/parameters/IntentId'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [reason]
              properties:
                reason:
                  type: string
                  minLength: 1
                  maxLength: 1024
      responses:
        '200':
          description: Intent cancelled
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Intent'
        '400':
          $ref: '#/components/responses/BadRequest'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          description: Intent cannot be cancelled in current state

  /intents/{intentId}/events:
    get:
      operationId: listIntentEvents
      summary: Get intent event history
      tags: [Intents]
      parameters:
        - $ref: '#/components/parameters/IntentId'
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
      responses:
        '200':
          description: Event history
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/IntentEvent'
                  chainValid:
                    type: boolean
                    description: Whether the event chain integrity is valid

  /intents/{intentId}/verify:
    get:
      operationId: verifyIntentChain
      summary: Verify intent event chain integrity
      tags: [Intents]
      parameters:
        - $ref: '#/components/parameters/IntentId'
      responses:
        '200':
          description: Verification result
          content:
            application/json:
              schema:
                type: object
                properties:
                  valid:
                    type: boolean
                  eventCount:
                    type: integer
                  invalidAt:
                    type: integer
                    description: Sequence number where chain breaks (if invalid)
                  error:
                    type: string

components:
  schemas:
    IntentSubmission:
      type: object
      required: [entityId, goal, context]
      properties:
        entityId:
          type: string
          format: uuid
          description: Entity submitting the intent
        goal:
          type: string
          minLength: 1
          maxLength: 1024
          description: Human-readable description of the intent
        context:
          type: object
          additionalProperties: true
          description: Structured context for the intent
        metadata:
          type: object
          additionalProperties: true
          description: Additional metadata
        intentType:
          type: string
          minLength: 1
          maxLength: 128
          description: Intent classification for routing
        priority:
          type: integer
          minimum: 0
          maximum: 9
          default: 0
          description: Processing priority (0=lowest, 9=highest)
        idempotencyKey:
          type: string
          maxLength: 128
          description: Client-provided idempotency key

    Intent:
      type: object
      properties:
        id:
          type: string
          format: uuid
        tenantId:
          type: string
          format: uuid
        entityId:
          type: string
          format: uuid
        goal:
          type: string
        intentType:
          type: string
          nullable: true
        context:
          type: object
        metadata:
          type: object
        priority:
          type: integer
        status:
          $ref: '#/components/schemas/IntentStatus'
        trustLevel:
          type: integer
          nullable: true
        trustScore:
          type: integer
          nullable: true
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time
        evaluatedAt:
          type: string
          format: date-time
          nullable: true
        decidedAt:
          type: string
          format: date-time
          nullable: true
        completedAt:
          type: string
          format: date-time
          nullable: true
        deletedAt:
          type: string
          format: date-time
          nullable: true
        cancellationReason:
          type: string
          nullable: true

    IntentStatus:
      type: string
      enum:
        - pending
        - evaluating
        - approved
        - denied
        - escalated
        - executing
        - completed
        - failed
        - cancelled

    IntentEvent:
      type: object
      properties:
        id:
          type: string
          format: uuid
        intentId:
          type: string
          format: uuid
        eventType:
          type: string
        payload:
          type: object
        sequenceNumber:
          type: integer
        eventHash:
          type: string
        previousHash:
          type: string
          nullable: true
        createdAt:
          type: string
          format: date-time

    Pagination:
      type: object
      properties:
        cursor:
          type: string
          nullable: true
        hasMore:
          type: boolean
        total:
          type: integer

  parameters:
    IntentId:
      name: intentId
      in: path
      required: true
      schema:
        type: string
        format: uuid

  responses:
    BadRequest:
      description: Invalid request
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'

    Unauthorized:
      description: Authentication required
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'

    Forbidden:
      description: Insufficient permissions
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'

    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'

    Conflict:
      description: Resource conflict (e.g., duplicate)
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'

    TrustInsufficient:
      description: Trust level insufficient
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: object
                properties:
                  code:
                    type: string
                    example: TRUST_INSUFFICIENT
                  message:
                    type: string
                  required:
                    type: integer
                  actual:
                    type: integer

    RateLimited:
      description: Rate limit exceeded
      headers:
        Retry-After:
          schema:
            type: integer
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'

  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

    OAuth2:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: https://auth.vorion.io/oauth/authorize
          tokenUrl: https://auth.vorion.io/oauth/token
          scopes:
            intents:read: Read intents
            intents:write: Create and modify intents
            escalations:read: Read escalations
            escalations:write: Resolve escalations
            policies:read: Read policies
            policies:write: Manage policies
            admin: Administrative access
```

---

## 6. Security Framework

### 6.1 Authentication

```typescript
interface AuthenticationConfig {
  // JWT configuration
  jwt: {
    algorithm: 'RS256' | 'ES256';
    publicKeyUrl: string; // JWKS URL
    issuer: string;
    audience: string[];
    clockTolerance: number; // seconds
    maxAge: string; // e.g., '1h'
  };

  // API key configuration
  apiKey: {
    headerName: string;
    hashAlgorithm: 'sha256' | 'sha512';
    rotationWarningDays: number;
  };

  // OAuth2 configuration
  oauth2: {
    providers: OAuthProvider[];
    defaultScopes: string[];
  };

  // MFA configuration
  mfa: {
    required: boolean;
    methods: ('totp' | 'sms' | 'email' | 'webauthn')[];
    rememberDays: number;
  };
}
```

### 6.2 Authorization (RBAC + ABAC)

```typescript
// Role definitions
const ROLES = {
  // System roles
  'system:admin': {
    permissions: ['*'],
    description: 'Full system access',
  },

  // Tenant roles
  'tenant:admin': {
    permissions: [
      'tenant:read',
      'tenant:update',
      'users:*',
      'policies:*',
      'intents:*',
      'escalations:*',
      'audit:read',
    ],
  },

  'tenant:user': {
    permissions: [
      'intents:read',
      'intents:write',
      'escalations:read',
    ],
  },

  'tenant:approver': {
    permissions: [
      'intents:read',
      'escalations:read',
      'escalations:write',
    ],
  },

  'tenant:auditor': {
    permissions: [
      'intents:read',
      'escalations:read',
      'audit:read',
      'policies:read',
    ],
  },
};

// Attribute-based access control
interface ABACPolicy {
  name: string;
  effect: 'allow' | 'deny';

  // Subject attributes
  subject: {
    roles?: string[];
    permissions?: string[];
    attributes?: Record<string, unknown>;
  };

  // Resource attributes
  resource: {
    type: string;
    attributes?: Record<string, unknown>;
  };

  // Action
  action: string | string[];

  // Conditions
  conditions?: ABACCondition[];
}

interface ABACCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: unknown;
}

// Example policy: Users can only access their own tenant's intents
const tenantIsolationPolicy: ABACPolicy = {
  name: 'tenant-isolation',
  effect: 'allow',
  subject: {
    attributes: { tenantId: '${user.tenantId}' },
  },
  resource: {
    type: 'intent',
    attributes: { tenantId: '${user.tenantId}' },
  },
  action: ['read', 'write'],
  conditions: [
    { field: 'resource.tenantId', operator: 'eq', value: '${subject.tenantId}' },
  ],
};
```

### 6.3 Encryption

```typescript
interface EncryptionConfig {
  // Field-level encryption
  fieldEncryption: {
    enabled: boolean;
    algorithm: 'aes-256-gcm';
    keyProvider: 'local' | 'vault' | 'aws-kms' | 'gcp-kms' | 'azure-keyvault';
    keyRotationDays: number;

    // Fields to encrypt
    encryptedFields: {
      intents: ['context', 'metadata'];
      escalations: ['context', 'resolution_notes'];
      users: ['password_hash', 'mfa_secret'];
    };
  };

  // Transport encryption
  transport: {
    minTlsVersion: '1.2' | '1.3';
    cipherSuites: string[];
    hsts: {
      enabled: boolean;
      maxAge: number;
      includeSubDomains: boolean;
      preload: boolean;
    };
  };

  // Storage encryption
  storage: {
    database: {
      enabled: boolean;
      provider: 'native' | 'pgcrypto';
    };
    redis: {
      enabled: boolean;
    };
    s3: {
      enabled: boolean;
      algorithm: 'AES256' | 'aws:kms';
      kmsKeyId?: string;
    };
  };
}
```

### 6.4 Security Headers

```typescript
const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
};
```

### 6.5 Input Validation

```typescript
// Validation middleware
interface ValidationConfig {
  // Request validation
  request: {
    maxBodySize: '1mb';
    maxUrlLength: 2048;
    maxHeaderSize: 8192;
    allowedContentTypes: ['application/json'];
  };

  // SQL injection prevention
  sql: {
    parameterizedQueries: true;
    allowRawQueries: false;
  };

  // XSS prevention
  xss: {
    sanitizeInput: true;
    sanitizeOutput: true;
    allowedTags: [];
  };

  // SSRF prevention
  ssrf: {
    blockPrivateIPs: true;
    blockLocalhost: true;
    allowedDomains: string[];
    blockedDomains: string[];
  };

  // Rate limiting per endpoint
  rateLimits: {
    '/intents': { requests: 100, window: '1m' };
    '/intents/*/cancel': { requests: 10, window: '1m' };
    '/escalations/*/approve': { requests: 50, window: '1m' };
    '/admin/*': { requests: 20, window: '1m' };
  };
}
```

---

## 7. Compliance Framework

### 7.1 GDPR Compliance

```typescript
interface GDPRCompliance {
  // Data subject rights
  rights: {
    // Right to access (Article 15)
    accessRequest: {
      enabled: true;
      responseTimeDays: 30;
      format: 'json' | 'csv' | 'pdf';
      endpoint: 'GET /gdpr/access-request';
    };

    // Right to rectification (Article 16)
    rectification: {
      enabled: true;
      auditRequired: true;
      endpoint: 'POST /gdpr/rectification';
    };

    // Right to erasure (Article 17)
    erasure: {
      enabled: true;
      softDeleteFirst: true;
      hardDeleteAfterDays: 30;
      endpoint: 'POST /gdpr/erasure';
    };

    // Right to data portability (Article 20)
    portability: {
      enabled: true;
      formats: ['json', 'csv'];
      endpoint: 'GET /gdpr/export';
    };
  };

  // Consent management
  consent: {
    required: true;
    granular: true;
    withdrawable: true;
    storageDays: 2555; // 7 years
  };

  // Data retention
  retention: {
    intents: { days: 90, basis: 'contract' };
    auditLogs: { days: 2555, basis: 'legal' };
    personalData: { days: 365, basis: 'consent' };
  };

  // Data processing records
  processingRecords: {
    enabled: true;
    autoGenerate: true;
    reviewFrequencyDays: 365;
  };
}
```

### 7.2 SOC 2 Type II Controls

```typescript
interface SOC2Controls {
  // CC1: Control Environment
  controlEnvironment: {
    codeOfConduct: true;
    securityPolicies: true;
    backgroundChecks: true;
    trainingRequired: true;
  };

  // CC2: Communication and Information
  communication: {
    securityAwareness: true;
    incidentReporting: true;
    changeManagement: true;
  };

  // CC3: Risk Assessment
  riskAssessment: {
    annualRiskAssessment: true;
    vulnerabilityScanning: true;
    penetrationTesting: true;
    threatModeling: true;
  };

  // CC4: Monitoring Activities
  monitoring: {
    continuousMonitoring: true;
    auditLogging: true;
    alerting: true;
    accessReviews: true;
  };

  // CC5: Control Activities
  controlActivities: {
    accessControl: true;
    changeControl: true;
    dataProtection: true;
    incidentResponse: true;
  };

  // CC6: Logical and Physical Access
  accessControl: {
    mfaRequired: true;
    passwordPolicy: true;
    sessionManagement: true;
    privilegedAccess: true;
  };

  // CC7: System Operations
  operations: {
    backupProcedures: true;
    disasterRecovery: true;
    capacityPlanning: true;
    patchManagement: true;
  };

  // CC8: Change Management
  changeManagement: {
    changeApproval: true;
    testingRequired: true;
    rollbackProcedures: true;
    documentationRequired: true;
  };

  // CC9: Risk Mitigation
  riskMitigation: {
    vendorManagement: true;
    businessContinuity: true;
    insuranceCoverage: true;
  };
}
```

### 7.3 FedRAMP Baseline

```typescript
interface FedRAMPControls {
  impact: 'Low' | 'Moderate' | 'High';

  // Access Control (AC)
  accessControl: {
    'AC-1': 'Access Control Policy and Procedures';
    'AC-2': 'Account Management';
    'AC-3': 'Access Enforcement';
    'AC-4': 'Information Flow Enforcement';
    'AC-5': 'Separation of Duties';
    'AC-6': 'Least Privilege';
    'AC-7': 'Unsuccessful Logon Attempts';
    'AC-8': 'System Use Notification';
    // ... additional controls
  };

  // Audit and Accountability (AU)
  audit: {
    'AU-1': 'Audit and Accountability Policy';
    'AU-2': 'Audit Events';
    'AU-3': 'Content of Audit Records';
    'AU-4': 'Audit Storage Capacity';
    'AU-5': 'Response to Audit Processing Failures';
    'AU-6': 'Audit Review, Analysis, and Reporting';
    // ... additional controls
  };

  // System and Communications Protection (SC)
  systemProtection: {
    'SC-1': 'System and Communications Protection Policy';
    'SC-7': 'Boundary Protection';
    'SC-8': 'Transmission Confidentiality and Integrity';
    'SC-12': 'Cryptographic Key Establishment and Management';
    'SC-13': 'Cryptographic Protection';
    'SC-28': 'Protection of Information at Rest';
    // ... additional controls
  };
}
```

---

## 8. Observability Framework

### 8.1 Metrics (Prometheus)

```typescript
// SLI definitions
interface SLIDefinitions {
  // Availability SLI
  availability: {
    metric: 'up{job="vorion-intent"}';
    target: 0.9999; // 99.99%
  };

  // Latency SLI
  latency: {
    submission: {
      metric: 'histogram_quantile(0.99, vorion_intent_submission_duration_seconds_bucket)';
      target: 1.0; // 1 second P99
    };
    evaluation: {
      metric: 'histogram_quantile(0.99, vorion_intent_evaluation_duration_seconds_bucket)';
      target: 5.0; // 5 seconds P99
    };
    decision: {
      metric: 'histogram_quantile(0.99, vorion_intent_decision_duration_seconds_bucket)';
      target: 10.0; // 10 seconds P99
    };
  };

  // Error rate SLI
  errorRate: {
    metric: 'sum(rate(vorion_intent_errors_total[5m])) / sum(rate(vorion_intent_requests_total[5m]))';
    target: 0.001; // 0.1%
  };

  // Throughput SLI
  throughput: {
    metric: 'sum(rate(vorion_intent_submissions_total[5m]))';
    minimum: 100; // intents per second
  };
}

// Complete metrics list
const metricsRegistry = `
# HELP vorion_intent_submissions_total Total number of intent submissions
# TYPE vorion_intent_submissions_total counter
vorion_intent_submissions_total{tenant_id, intent_type, outcome, trust_level}

# HELP vorion_intent_submission_duration_seconds Time to submit an intent
# TYPE vorion_intent_submission_duration_seconds histogram
vorion_intent_submission_duration_seconds_bucket{tenant_id, le}

# HELP vorion_intent_evaluation_duration_seconds Time to evaluate an intent
# TYPE vorion_intent_evaluation_duration_seconds histogram
vorion_intent_evaluation_duration_seconds_bucket{stage, le}

# HELP vorion_intent_status_transitions_total Status transition counts
# TYPE vorion_intent_status_transitions_total counter
vorion_intent_status_transitions_total{tenant_id, from_status, to_status}

# HELP vorion_trust_gate_evaluations_total Trust gate evaluation counts
# TYPE vorion_trust_gate_evaluations_total counter
vorion_trust_gate_evaluations_total{tenant_id, intent_type, result}

# HELP vorion_escalations_total Escalation counts
# TYPE vorion_escalations_total counter
vorion_escalations_total{tenant_id, reason_category, outcome}

# HELP vorion_escalation_resolution_duration_seconds Time to resolve escalations
# TYPE vorion_escalation_resolution_duration_seconds histogram
vorion_escalation_resolution_duration_seconds_bucket{outcome, le}

# HELP vorion_escalations_pending Current pending escalations
# TYPE vorion_escalations_pending gauge
vorion_escalations_pending{tenant_id}

# HELP vorion_policy_evaluations_total Policy evaluation counts
# TYPE vorion_policy_evaluations_total counter
vorion_policy_evaluations_total{policy_id, action}

# HELP vorion_policy_evaluation_duration_seconds Policy evaluation time
# TYPE vorion_policy_evaluation_duration_seconds histogram
vorion_policy_evaluation_duration_seconds_bucket{policy_id, le}

# HELP vorion_queue_depth Current queue depth
# TYPE vorion_queue_depth gauge
vorion_queue_depth{queue_name}

# HELP vorion_queue_processing_duration_seconds Queue job processing time
# TYPE vorion_queue_processing_duration_seconds histogram
vorion_queue_processing_duration_seconds_bucket{queue_name, le}

# HELP vorion_errors_total Error counts by type
# TYPE vorion_errors_total counter
vorion_errors_total{error_code, component, severity}

# HELP vorion_rate_limit_exceeded_total Rate limit exceeded counts
# TYPE vorion_rate_limit_exceeded_total counter
vorion_rate_limit_exceeded_total{tenant_id, endpoint}

# HELP vorion_encryption_operations_total Encryption operation counts
# TYPE vorion_encryption_operations_total counter
vorion_encryption_operations_total{operation, algorithm}

# HELP vorion_db_connection_pool_size Database connection pool metrics
# TYPE vorion_db_connection_pool_size gauge
vorion_db_connection_pool_size{state}

# HELP vorion_redis_connection_pool_size Redis connection pool metrics
# TYPE vorion_redis_connection_pool_size gauge
vorion_redis_connection_pool_size{state}
`;
```

### 8.2 Distributed Tracing (OpenTelemetry)

```typescript
// Trace configuration
interface TraceConfig {
  // Sampling
  sampling: {
    defaultRate: 0.1; // 10% default
    rules: [
      { match: { 'http.status_code': '5*' }, rate: 1.0 }, // 100% for errors
      { match: { priority: 9 }, rate: 1.0 }, // 100% for high priority
      { match: { 'intent.type': 'high-risk' }, rate: 1.0 }, // 100% for high-risk
    ];
  };

  // Propagation
  propagation: ['tracecontext', 'baggage'];

  // Export
  export: {
    endpoint: 'https://otlp.vorion.io:4317';
    protocol: 'grpc';
    compression: 'gzip';
    headers: {
      'Authorization': '${OTLP_TOKEN}';
    };
  };

  // Resource attributes
  resource: {
    'service.name': 'vorion-intent';
    'service.version': '${VERSION}';
    'deployment.environment': '${ENV}';
    'cloud.provider': '${CLOUD_PROVIDER}';
    'cloud.region': '${CLOUD_REGION}';
  };
}

// Span naming conventions
const spanNaming = {
  // HTTP spans
  http: 'HTTP {method} {route}',

  // Database spans
  database: 'DB {operation} {table}',

  // Queue spans
  queue: 'Queue {queue_name} {operation}',

  // Intent spans
  intent: {
    submit: 'Intent Submit',
    evaluate: 'Intent Evaluate {stage}',
    decide: 'Intent Decide',
    escalate: 'Intent Escalate',
    complete: 'Intent Complete',
  };

  // Policy spans
  policy: {
    load: 'Policy Load',
    evaluate: 'Policy Evaluate {policy_name}',
    cache: 'Policy Cache {operation}',
  };
};

// Required span attributes
const spanAttributes = {
  intent: {
    'intent.id': 'string',
    'intent.type': 'string',
    'intent.status': 'string',
    'intent.priority': 'number',
    'tenant.id': 'string',
    'entity.id': 'string',
    'trust.level': 'number',
    'trust.score': 'number',
  };

  escalation: {
    'escalation.id': 'string',
    'escalation.reason': 'string',
    'escalation.status': 'string',
    'escalation.assigned_to': 'string',
  };

  policy: {
    'policy.id': 'string',
    'policy.name': 'string',
    'policy.version': 'number',
    'policy.action': 'string',
  };
};
```

### 8.3 Logging (Structured)

```typescript
// Log schema
interface LogEntry {
  // Required fields
  timestamp: string; // ISO 8601
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;

  // Context
  service: string;
  version: string;
  environment: string;

  // Request context
  requestId?: string;
  traceId?: string;
  spanId?: string;

  // Tenant context
  tenantId?: string;
  userId?: string;

  // Error context
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };

  // Additional context
  [key: string]: unknown;
}

// Log configuration
interface LogConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'pretty';

  // Output
  outputs: [
    { type: 'stdout' },
    { type: 'file', path: '/var/log/vorion/intent.log', maxSize: '100m', maxFiles: 10 },
    { type: 'loki', endpoint: 'https://loki.vorion.io/loki/api/v1/push' },
  ];

  // Redaction
  redact: ['password', 'secret', 'token', 'apiKey', 'authorization'];

  // Sampling (for debug logs)
  sampling: {
    debug: 0.01; // 1% of debug logs
  };
}
```

### 8.4 Alerting Rules

```yaml
# Prometheus alerting rules
groups:
  - name: vorion-intent-availability
    rules:
      - alert: IntentServiceDown
        expr: up{job="vorion-intent"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Intent service is down"
          description: "Intent service {{ $labels.instance }} has been down for more than 1 minute."

      - alert: IntentHighErrorRate
        expr: |
          sum(rate(vorion_errors_total{severity="error"}[5m]))
          / sum(rate(vorion_intent_submissions_total[5m])) > 0.01
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate in intent processing"
          description: "Error rate is {{ $value | humanizePercentage }} (threshold: 1%)"

      - alert: IntentHighLatency
        expr: |
          histogram_quantile(0.99,
            rate(vorion_intent_submission_duration_seconds_bucket[5m])
          ) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High P99 latency for intent submission"
          description: "P99 latency is {{ $value | humanizeDuration }} (threshold: 2s)"

  - name: vorion-intent-escalations
    rules:
      - alert: EscalationBacklog
        expr: vorion_escalations_pending > 100
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "High number of pending escalations"
          description: "{{ $value }} escalations pending for tenant {{ $labels.tenant_id }}"

      - alert: EscalationSLABreach
        expr: |
          (time() - vorion_escalation_created_timestamp)
          / vorion_escalation_timeout_seconds > 0.9
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "Escalation approaching SLA breach"
          description: "Escalation {{ $labels.escalation_id }} is 90% through its timeout window"

  - name: vorion-intent-infrastructure
    rules:
      - alert: QueueBacklog
        expr: vorion_queue_depth > 10000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High queue depth"
          description: "Queue {{ $labels.queue_name }} has {{ $value }} pending jobs"

      - alert: DatabaseConnectionPoolExhausted
        expr: vorion_db_connection_pool_size{state="idle"} < 2
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Database connection pool nearly exhausted"
          description: "Only {{ $value }} idle connections remaining"

      - alert: RedisHighMemory
        expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Redis memory usage high"
          description: "Redis is using {{ $value | humanizePercentage }} of max memory"
```

---

## 9. Operational Framework

### 9.1 Deployment Strategy

```yaml
# Kubernetes deployment configuration
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vorion-intent
  labels:
    app: vorion-intent
    version: v2.0.0
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: vorion-intent
  template:
    metadata:
      labels:
        app: vorion-intent
        version: v2.0.0
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
    spec:
      serviceAccountName: vorion-intent
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000

      containers:
        - name: intent-api
          image: vorion/intent:v2.0.0
          imagePullPolicy: Always

          ports:
            - name: http
              containerPort: 3000
            - name: metrics
              containerPort: 9090

          env:
            - name: VORION_ENV
              value: production
            - name: VORION_DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: vorion-secrets
                  key: db-password
            - name: VORION_JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: vorion-secrets
                  key: jwt-secret
            - name: VORION_ENCRYPTION_KEY
              valueFrom:
                secretKeyRef:
                  name: vorion-secrets
                  key: encryption-key

          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 2000m
              memory: 2Gi

          livenessProbe:
            httpGet:
              path: /health/live
              port: http
            initialDelaySeconds: 10
            periodSeconds: 10
            failureThreshold: 3

          readinessProbe:
            httpGet:
              path: /health/ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 3

          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop:
                - ALL

      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app: vorion-intent
                topologyKey: kubernetes.io/hostname

      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels:
              app: vorion-intent

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: vorion-intent-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: vorion-intent
  minReplicas: 3
  maxReplicas: 50
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
    - type: Pods
      pods:
        metric:
          name: vorion_queue_depth
        target:
          type: AverageValue
          averageValue: "1000"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
        - type: Pods
          value: 4
          periodSeconds: 15
      selectPolicy: Max
```

### 9.2 Backup and Recovery

```typescript
interface BackupConfig {
  // Database backups
  database: {
    schedule: '0 */4 * * *'; // Every 4 hours
    retention: {
      hourly: 24;
      daily: 30;
      weekly: 52;
      monthly: 24;
    };
    type: 'logical' | 'physical';
    encryption: true;
    compression: 'zstd';
    destination: 's3://vorion-backups/db/';
  };

  // Redis backups
  redis: {
    schedule: '0 * * * *'; // Every hour
    retention: {
      hourly: 24;
      daily: 7;
    };
    type: 'rdb';
    destination: 's3://vorion-backups/redis/';
  };

  // Configuration backups
  config: {
    schedule: '0 0 * * *'; // Daily
    include: [
      'policies',
      'templates',
      'routing-rules',
    ];
    destination: 's3://vorion-backups/config/';
  };
}

interface RecoveryProcedures {
  // Recovery Time Objective
  rto: {
    critical: '15m';
    standard: '1h';
    low: '4h';
  };

  // Recovery Point Objective
  rpo: {
    critical: '5m';
    standard: '1h';
    low: '4h';
  };

  // Procedures
  procedures: {
    fullRestore: {
      steps: [
        '1. Verify backup integrity',
        '2. Stop all services',
        '3. Restore database from backup',
        '4. Restore Redis from backup',
        '5. Verify data consistency',
        '6. Start services in maintenance mode',
        '7. Run integrity checks',
        '8. Enable traffic',
      ];
      estimatedTime: '30m';
    };

    pointInTimeRecovery: {
      steps: [
        '1. Identify target timestamp',
        '2. Restore base backup',
        '3. Apply WAL logs to target time',
        '4. Verify restoration',
      ];
      estimatedTime: '45m';
    };
  };
}
```

### 9.3 Incident Response

```typescript
interface IncidentResponse {
  // Severity levels
  severity: {
    P1: {
      description: 'Critical - System down, data loss risk';
      responseTime: '5m';
      escalationTime: '15m';
      notifyChannels: ['pagerduty', 'slack-critical', 'email-oncall'];
    };
    P2: {
      description: 'High - Major feature degraded';
      responseTime: '15m';
      escalationTime: '1h';
      notifyChannels: ['slack-alerts', 'email-oncall'];
    };
    P3: {
      description: 'Medium - Minor feature impacted';
      responseTime: '1h';
      escalationTime: '4h';
      notifyChannels: ['slack-alerts'];
    };
    P4: {
      description: 'Low - Cosmetic or minor issue';
      responseTime: '24h';
      escalationTime: null;
      notifyChannels: ['email-team'];
    };
  };

  // Runbooks
  runbooks: {
    'database-connection-exhausted': {
      symptoms: ['Connection pool depleted alerts', 'Slow queries', 'Timeouts'];
      diagnosis: [
        'Check connection pool metrics',
        'Identify long-running queries',
        'Check for connection leaks',
      ];
      remediation: [
        'Kill idle connections',
        'Increase pool size temporarily',
        'Restart problematic pods',
      ];
    };

    'queue-backlog': {
      symptoms: ['High queue depth', 'Processing delays', 'Worker errors'];
      diagnosis: [
        'Check worker health',
        'Check downstream service health',
        'Check for poison messages',
      ];
      remediation: [
        'Scale workers',
        'Fix downstream issues',
        'Move poison messages to DLQ',
      ];
    };

    'escalation-sla-breach': {
      symptoms: ['Pending escalations > timeout', 'SLA alerts'];
      diagnosis: [
        'Check notification delivery',
        'Verify approver availability',
        'Check system access',
      ];
      remediation: [
        'Contact approvers directly',
        'Reassign escalations',
        'Invoke backup approvers',
      ];
    };
  };
}
```

---

## 10. Integration Framework

### 10.1 Identity Provider Integration

```typescript
interface IdentityProviderConfig {
  // Supported providers
  providers: {
    // OIDC providers
    oidc: {
      issuer: string;
      clientId: string;
      clientSecret: string;
      scopes: string[];
      userInfoEndpoint?: string;

      // Claim mapping
      claimMapping: {
        userId: 'sub';
        email: 'email';
        name: 'name';
        tenantId: 'tenant_id' | 'org_id';
        roles: 'roles' | 'groups';
      };
    };

    // SAML providers
    saml: {
      entityId: string;
      ssoUrl: string;
      certificate: string;

      // Attribute mapping
      attributeMapping: {
        userId: 'urn:oid:0.9.2342.19200300.100.1.1';
        email: 'urn:oid:0.9.2342.19200300.100.1.3';
        name: 'urn:oid:2.5.4.3';
      };
    };

    // LDAP providers
    ldap: {
      url: string;
      baseDn: string;
      bindDn: string;
      bindPassword: string;
      userSearchFilter: string;
      groupSearchFilter: string;
    };
  };

  // Just-in-time provisioning
  jitProvisioning: {
    enabled: boolean;
    defaultRole: string;
    defaultTenant?: string;
    attributeSync: boolean;
  };
}
```

### 10.2 Secret Management Integration

```typescript
interface SecretManagerConfig {
  provider: 'vault' | 'aws-secrets-manager' | 'gcp-secret-manager' | 'azure-keyvault';

  // HashiCorp Vault
  vault?: {
    address: string;
    namespace?: string;
    authMethod: 'kubernetes' | 'approle' | 'token';

    // Kubernetes auth
    kubernetes?: {
      role: string;
      mountPath: string;
    };

    // AppRole auth
    appRole?: {
      roleId: string;
      secretId: string;
    };

    // Secret paths
    paths: {
      database: 'secret/data/vorion/database';
      encryption: 'secret/data/vorion/encryption';
      jwt: 'secret/data/vorion/jwt';
      api: 'secret/data/vorion/api-keys';
    };

    // Dynamic secrets
    dynamicSecrets: {
      database: {
        enabled: true;
        path: 'database/creds/vorion-app';
        ttl: '1h';
      };
    };
  };

  // AWS Secrets Manager
  aws?: {
    region: string;
    secretPrefix: 'vorion/';
    rotationSchedule: '30d';
  };
}
```

### 10.3 External Policy Integration (OPA)

```typescript
interface OPAConfig {
  // OPA server
  server: {
    url: string;
    timeout: '5s';
    retries: 3;
  };

  // Bundle configuration
  bundles: {
    vorion: {
      resource: '/bundles/vorion';
      polling: {
        minDelay: '60s';
        maxDelay: '120s';
      };
    };
  };

  // Decision logging
  decisionLogs: {
    enabled: true;
    console: false;
    service: 'vorion-audit';
  };

  // Query paths
  queries: {
    intentAuthorization: 'data.vorion.intent.authorize';
    escalationAuthorization: 'data.vorion.escalation.authorize';
    policyEvaluation: 'data.vorion.policy.evaluate';
  };
}
```

---

## 11. Testing Framework

### 11.1 Test Categories

```typescript
interface TestingStrategy {
  // Unit tests
  unit: {
    coverage: {
      statements: 80;
      branches: 75;
      functions: 80;
      lines: 80;
    };
    frameworks: ['vitest'];
    mocking: ['vitest-mock'];
  };

  // Integration tests
  integration: {
    coverage: {
      critical_paths: 100;
      api_endpoints: 100;
    };
    frameworks: ['vitest', 'supertest'];
    fixtures: ['testcontainers'];
  };

  // End-to-end tests
  e2e: {
    coverage: {
      user_journeys: 100;
      happy_paths: 100;
      error_paths: 80;
    };
    frameworks: ['playwright'];
  };

  // Performance tests
  performance: {
    tools: ['k6', 'artillery'];
    scenarios: {
      baseline: {
        vus: 10;
        duration: '5m';
        thresholds: {
          p95: '500ms';
          error_rate: '0.1%';
        };
      };
      stress: {
        vus: 1000;
        duration: '30m';
        thresholds: {
          p95: '2s';
          error_rate: '1%';
        };
      };
      soak: {
        vus: 100;
        duration: '4h';
        thresholds: {
          p95: '1s';
          error_rate: '0.5%';
        };
      };
    };
  };

  // Security tests
  security: {
    sast: ['semgrep', 'eslint-security'];
    dast: ['owasp-zap'];
    dependency: ['snyk', 'npm-audit'];
    secrets: ['gitleaks', 'trufflehog'];
  };

  // Chaos tests
  chaos: {
    tools: ['chaos-mesh', 'litmus'];
    scenarios: [
      'pod-kill',
      'network-partition',
      'database-failure',
      'redis-failure',
      'cpu-stress',
      'memory-stress',
    ];
  };
}
```

### 11.2 Test Data Management

```typescript
interface TestDataConfig {
  // Factories
  factories: {
    intent: IntentFactory;
    escalation: EscalationFactory;
    tenant: TenantFactory;
    user: UserFactory;
    policy: PolicyFactory;
  };

  // Fixtures
  fixtures: {
    location: './tests/fixtures';
    format: 'json' | 'yaml';
    encryption: false;
  };

  // Database seeding
  seeding: {
    strategy: 'clean-seed' | 'incremental';
    parallelism: 4;
  };

  // Data anonymization (for production-like data)
  anonymization: {
    enabled: true;
    rules: {
      email: 'faker.internet.email()';
      name: 'faker.person.fullName()';
      ip: 'faker.internet.ip()';
      context: 'redact';
    };
  };
}
```

---

## 12. Deployment Specifications

### 12.1 Infrastructure Requirements

```yaml
# Minimum production infrastructure
infrastructure:
  compute:
    api:
      instances: 3
      cpu: 2 vCPU
      memory: 4 GB
      disk: 50 GB SSD

    workers:
      instances: 3
      cpu: 2 vCPU
      memory: 4 GB
      disk: 50 GB SSD

    scheduler:
      instances: 2 # Active-passive
      cpu: 1 vCPU
      memory: 2 GB
      disk: 20 GB SSD

  database:
    type: PostgreSQL 15+
    instances: 3 # Primary + 2 replicas
    cpu: 4 vCPU
    memory: 16 GB
    disk: 500 GB SSD
    iops: 10000

    # High availability
    ha:
      enabled: true
      mode: synchronous
      failover: automatic

  redis:
    type: Redis 7+
    instances: 6 # 3 masters + 3 replicas
    cpu: 2 vCPU
    memory: 8 GB
    mode: cluster

    # Persistence
    persistence:
      rdb: true
      aof: true

  storage:
    type: S3-compatible
    buckets:
      - name: vorion-backups
        versioning: true
        encryption: AES256
        lifecycle:
          - prefix: db/
            transition_days: 30
            storage_class: GLACIER
      - name: vorion-audit
        versioning: true
        encryption: AES256
        immutable: true

  networking:
    load_balancer:
      type: ALB
      ssl_policy: ELBSecurityPolicy-TLS-1-2-2017-01
      health_check:
        path: /health/ready
        interval: 10s
        threshold: 3

    vpc:
      cidr: 10.0.0.0/16
      subnets:
        public: 3
        private: 3
        database: 3

    security_groups:
      api:
        ingress:
          - port: 443
            source: 0.0.0.0/0
          - port: 3000
            source: internal
      database:
        ingress:
          - port: 5432
            source: app-sg
      redis:
        ingress:
          - port: 6379
            source: app-sg
```

### 12.2 Environment Configuration

```yaml
# Environment-specific configuration
environments:
  development:
    replicas: 1
    resources:
      cpu: 500m
      memory: 512Mi
    database:
      pool_size: 5
    features:
      debug: true
      profiling: true
      seed_data: true

  staging:
    replicas: 2
    resources:
      cpu: 1000m
      memory: 1Gi
    database:
      pool_size: 10
    features:
      debug: false
      profiling: true
      seed_data: false

  production:
    replicas: 3
    resources:
      cpu: 2000m
      memory: 4Gi
    database:
      pool_size: 50
    features:
      debug: false
      profiling: false
      seed_data: false

    # Production-specific
    high_availability:
      multi_az: true
      auto_scaling: true
      backup_retention: 30
```

---

## 13. Migration Path

### 13.1 Phase Timeline

```
Phase 0: Foundation (Weeks 1-2)
├── Security hardening
│   ├── Remove insecure defaults
│   ├── Add authorization checks
│   └── Implement SSRF protection
├── Data integrity
│   ├── Add database constraints
│   ├── Fix race conditions
│   └── Implement proper locking
└── Critical bug fixes

Phase 1: Core Engines (Weeks 3-6)
├── Audit Engine
│   ├── Schema implementation
│   ├── Chain verification
│   └── Basic compliance reports
├── Escalation persistence
│   ├── PostgreSQL storage
│   ├── Redis caching
│   └── Migration script
└── Distributed tracing
    ├── W3C TraceContext propagation
    └── Sampling configuration

Phase 2: Policy & Notification (Weeks 7-10)
├── Policy Engine
│   ├── OPA integration
│   ├── Policy versioning
│   └── Hot reload
├── Notification Engine
│   ├── Multi-channel support
│   ├── Template management
│   └── Delivery tracking
└── Enhanced rate limiting
    ├── IP-based fallback
    └── Bypass configuration

Phase 3: Analytics & Operations (Weeks 11-14)
├── Analytics Engine
│   ├── Metrics aggregation
│   ├── Anomaly detection
│   └── Dashboard templates
├── Database partitioning
│   ├── Migration scripts
│   └── Partition management
└── Operational tooling
    ├── Runbooks
    └── Incident response

Phase 4: Advanced Features (Weeks 15-20)
├── Replay Engine
│   ├── Historical replay
│   └── What-if analysis
├── Federation Engine
│   ├── Trust attestation
│   └── Cross-org sharing
└── Compliance certification prep
    ├── SOC 2 evidence
    └── FedRAMP documentation

Phase 5: Scale & Optimize (Weeks 21-26)
├── Multi-region deployment
├── Performance optimization
├── Chaos engineering
└── Documentation completion
```

### 13.2 Migration Scripts

```sql
-- Migration: Add escalations table
-- Version: 2024_01_001

BEGIN;

-- Create escalations table
CREATE TABLE IF NOT EXISTS escalations (
  -- [schema as defined above]
);

-- Migrate existing escalations from Redis
-- This requires a custom script to read from Redis

-- Create indexes
CREATE INDEX IF NOT EXISTS escalations_tenant_status_idx
  ON escalations(tenant_id, status, created_at DESC);

-- Add foreign key constraints
ALTER TABLE escalations
  ADD CONSTRAINT escalations_intent_fk
  FOREIGN KEY (intent_id) REFERENCES intents(id);

COMMIT;
```

### 13.3 Feature Flags

```typescript
interface FeatureFlags {
  // Gradual rollout flags
  'policy-engine-v2': {
    enabled: boolean;
    percentage: number; // 0-100
    tenants: string[]; // Specific tenants
  };

  'notification-engine': {
    enabled: boolean;
    channels: ('email' | 'slack' | 'webhook')[];
  };

  'analytics-engine': {
    enabled: boolean;
    features: ('metrics' | 'anomaly' | 'forecast')[];
  };

  'federation-engine': {
    enabled: boolean;
    peers: string[];
  };

  // Infrastructure flags
  'database-partitioning': {
    enabled: boolean;
    tables: string[];
  };

  'distributed-tracing': {
    enabled: boolean;
    sampleRate: number;
  };
}
```

---

## 14. Appendices

### A. Glossary

| Term | Definition |
|------|------------|
| Intent | A goal or action submitted for governance evaluation |
| Escalation | A request for human review of an intent decision |
| Trust Level | A 0-4 scale representing entity trustworthiness |
| Trust Score | A 0-1000 numeric score for fine-grained trust |
| Policy | A declarative rule governing intent decisions |
| Tenant | An isolated organization within the system |
| Entity | An actor (user, agent, service) that submits intents |

### B. Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| TRUST_INSUFFICIENT | 422 | Entity trust level below required threshold |
| INTENT_RATE_LIMIT | 429 | Tenant exceeded concurrent intent limit |
| INTENT_LOCKED | 409 | Duplicate submission in progress |
| ESCALATION_NOT_FOUND | 404 | Escalation does not exist |
| ESCALATION_ALREADY_RESOLVED | 409 | Escalation already resolved |
| POLICY_VIOLATION | 403 | Policy denied the action |
| TENANT_SUSPENDED | 403 | Tenant account suspended |
| UNAUTHORIZED | 401 | Authentication required |
| FORBIDDEN | 403 | Insufficient permissions |

### C. Configuration Reference

See `src/common/config.ts` for complete configuration schema.

### D. API Reference

See `openapi/intent-api.yaml` for complete API specification.

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2024-01-18 | Vorion Team | Initial enterprise specification |

---

**End of Specification**
