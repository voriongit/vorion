# AgentAnchor Observer Architecture

**Version:** 1.0
**Date:** 2025-11-28
**Author:** frank the tank

---

## Executive Summary

The Observer Service is the **incorruptible audit layer** of AgentAnchor. It operates in complete isolation from the Worker and Council layers, providing tamper-proof logging, real-time monitoring, anomaly detection, and compliance reporting.

**Core Principle:** The Observer sees everything but touches nothing.

**Design Philosophy:**
> "If the Observer can be influenced, the entire governance model fails. Isolation is not a feature—it's the foundation."

---

## Architecture Overview

### Isolation Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AGENTANCHOR PLATFORM                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    OPERATIONAL ZONE                              │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │    │
│  │  │   Worker    │  │   Council   │  │   Academy   │              │    │
│  │  │   Agents    │←→│  Validators │←→│   Training  │              │    │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │    │
│  │         │                │                │                      │    │
│  │         └────────────────┼────────────────┘                      │    │
│  │                          │                                        │    │
│  │                          ▼                                        │    │
│  │              ┌───────────────────────┐                           │    │
│  │              │     Event Bus         │                           │    │
│  │              │   (Write-Only Queue)  │                           │    │
│  │              └───────────┬───────────┘                           │    │
│  └──────────────────────────┼───────────────────────────────────────┘    │
│                             │                                            │
│  ═══════════════════════════╪════════════════════════════════════════   │
│           ISOLATION BARRIER (No Return Path)                             │
│  ═══════════════════════════╪════════════════════════════════════════   │
│                             │                                            │
│                             ▼ (One-Way Data Flow)                        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    OBSERVER ZONE                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────┐ │   │
│  │  │                 Observer Ingestion Service                   │ │   │
│  │  │  • Validates event signatures                                │ │   │
│  │  │  • Timestamps with trusted clock                             │ │   │
│  │  │  • Writes to append-only log                                 │ │   │
│  │  └──────────────────────────┬──────────────────────────────────┘ │   │
│  │                             │                                     │   │
│  │         ┌───────────────────┼───────────────────┐                │   │
│  │         ▼                   ▼                   ▼                │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │   │
│  │  │ Chronicler  │    │  Analyst    │    │  Auditor    │          │   │
│  │  │  (Logger)   │    │ (Patterns)  │    │ (Compliance)│          │   │
│  │  └─────────────┘    └─────────────┘    └─────────────┘          │   │
│  │                             │                                     │   │
│  │                             ▼                                     │   │
│  │              ┌───────────────────────┐                           │   │
│  │              │   Observer Database   │                           │   │
│  │              │    (Append-Only)      │                           │   │
│  │              └───────────────────────┘                           │   │
│  │                             │                                     │   │
│  │                             ▼                                     │   │
│  │              ┌───────────────────────┐                           │   │
│  │              │   Observer API        │                           │   │
│  │              │   (Read-Only)         │──────► Dashboard/Reports  │   │
│  │              └───────────────────────┘                           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Isolation Properties

| Property | Implementation |
|----------|---------------|
| **No Return Path** | Observer cannot send data back to Operational Zone |
| **No Control Plane Access** | Observer has no API to control Workers/Council |
| **Read-Only Database** | Observer can only read operational data, never write |
| **Append-Only Logs** | Observer's own logs cannot be modified or deleted |
| **Separate Infrastructure** | Different servers, VPC, database instances |
| **Cryptographic Attestation** | Observer integrity verified by external party |

---

## Observer Components

### 1. Chronicler (Event Logger)

**Purpose:** Record every action, decision, and state change.

**Responsibilities:**
- Receive events from Event Bus
- Validate event signatures
- Apply trusted timestamp
- Write to append-only log
- Generate cryptographic proof of logging

**Event Types Logged:**

| Event Category | Examples | Priority |
|---------------|----------|----------|
| Agent Actions | Task execution, API calls, data access | High |
| Council Decisions | Approvals, denials, escalations | Critical |
| Human Overrides | HITL approvals, policy changes | Critical |
| Trust Score Changes | Increases, decreases, decay | Medium |
| Training Progress | Module completion, examinations | Medium |
| Marketplace Activity | Acquisitions, earnings, transfers | High |
| Ownership Changes | Delegation, sales, MIA transitions | Critical |
| System Events | Service starts, failures, recoveries | Low |

**Log Schema:**

```typescript
interface ObserverLogEntry {
  // Identity
  id: string;                    // UUID v7 (time-ordered)
  sequence: bigint;              // Global sequence number

  // Timestamp
  timestamp: {
    event: ISO8601;              // When event occurred
    received: ISO8601;           // When Observer received
    logged: ISO8601;             // When written to storage
  };

  // Source
  source: {
    type: 'worker' | 'council' | 'academy' | 'human' | 'system';
    id: string;                  // Agent ID, validator ID, user ID
    tenant: string;              // Organization namespace
  };

  // Event
  event: {
    type: string;                // e.g., 'action.execute', 'council.approve'
    category: string;            // e.g., 'agent', 'governance', 'marketplace'
    level: 0 | 1 | 2 | 3;        // Risk/importance level
    action: string;              // Human-readable action description
    details: Record<string, any>; // Event-specific data
  };

  // Context
  context: {
    conversationId?: string;     // If part of conversation
    taskId?: string;             // If part of task
    precedentId?: string;        // If referencing precedent
    requestId: string;           // Correlation ID
  };

  // Integrity
  integrity: {
    sourceSignature: string;     // Signature from event source
    observerSignature: string;   // Observer's signature
    previousHash: string;        // Hash of previous entry (chain)
    entryHash: string;           // Hash of this entry
  };
}
```

### 2. Analyst (Pattern Detector)

**Purpose:** Identify anomalies, trends, and potential issues.

**Responsibilities:**
- Real-time pattern matching
- Anomaly detection
- Trend analysis
- Alert generation
- Statistical aggregation

**Detection Rules:**

| Rule Category | Example Rules |
|--------------|---------------|
| **Volume Anomalies** | Sudden spike in actions, unusual quiet period |
| **Behavior Anomalies** | Agent acting outside normal patterns |
| **Trust Anomalies** | Rapid trust score changes |
| **Timing Anomalies** | Actions at unusual times |
| **Sequence Anomalies** | Steps out of expected order |
| **Resource Anomalies** | Unusual data access patterns |

**Alert Levels:**

| Level | Name | Response | Example |
|-------|------|----------|---------|
| L0 | Info | Log only | Normal operation stats |
| L1 | Notice | Dashboard highlight | Unusual but not concerning |
| L2 | Warning | Active notification | Potential issue, investigate |
| L3 | Critical | Immediate alert | Possible security incident |

**Anomaly Detection Algorithms:**

```typescript
interface AnomalyDetector {
  // Statistical baseline
  baseline: {
    actionRate: MovingAverage;     // Normal actions per minute
    errorRate: MovingAverage;      // Normal error frequency
    responseTime: Percentiles;     // Normal latency distribution
  };

  // Detection methods
  detectVolumeAnomaly(current: number): AnomalyScore;
  detectBehaviorAnomaly(actions: Action[]): AnomalyScore;
  detectSequenceAnomaly(sequence: Event[]): AnomalyScore;

  // Learning
  updateBaseline(events: Event[]): void;
  adjustSensitivity(feedback: Feedback): void;
}
```

### 3. Auditor (Compliance Engine)

**Purpose:** Generate compliance reports and verify governance integrity.

**Responsibilities:**
- Compliance report generation
- Audit trail verification
- Regulatory evidence export
- Governance integrity checks
- Certification verification support

**Compliance Reports:**

| Report Type | Frequency | Contents |
|------------|-----------|----------|
| Daily Summary | Daily | Actions, decisions, anomalies |
| Governance Report | Weekly | Council activity, escalations, precedents |
| Trust Report | Weekly | Score changes, tier movements |
| Audit Export | On-demand | Full audit trail for period |
| Incident Report | As needed | Detailed investigation package |
| Regulatory Package | Quarterly | SOC2/GDPR evidence bundle |

**Report Schema:**

```typescript
interface ComplianceReport {
  metadata: {
    reportId: string;
    type: ReportType;
    tenant: string;
    period: { start: ISO8601; end: ISO8601 };
    generated: ISO8601;
    generator: 'observer-auditor';
    version: string;
  };

  summary: {
    totalEvents: number;
    byCategory: Record<string, number>;
    byLevel: Record<number, number>;
    anomalies: number;
    alerts: number;
  };

  governance: {
    councilDecisions: number;
    approvals: number;
    denials: number;
    escalations: number;
    humanOverrides: number;
    precedentsCreated: number;
  };

  agents: {
    active: number;
    training: number;
    graduated: number;
    trustChanges: TrustChange[];
  };

  integrity: {
    chainVerified: boolean;
    missingEvents: number;
    signatureFailures: number;
    lastVerifiedHash: string;
  };

  signature: string;  // Report cryptographic signature
}
```

---

## Infrastructure Isolation

### Network Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         VPC: Main                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                 Subnet: Operational                          ││
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        ││
│  │  │ API     │  │ Worker  │  │ Council │  │ Academy │        ││
│  │  │ Gateway │  │ Service │  │ Service │  │ Service │        ││
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        ││
│  │       └────────────┴────────────┴────────────┘              ││
│  │                          │                                   ││
│  │                          ▼                                   ││
│  │              ┌───────────────────────┐                      ││
│  │              │   Event Bus (Kafka)   │                      ││
│  │              │   or SQS/SNS          │                      ││
│  │              └───────────┬───────────┘                      ││
│  └──────────────────────────┼───────────────────────────────────┘│
│                             │                                    │
│  ═══════════════════════════╪═══════════════════════════════════│
│       Network ACL: Observer Ingress Only (No Egress to Ops)      │
│  ═══════════════════════════╪═══════════════════════════════════│
│                             │                                    │
│  ┌──────────────────────────┼───────────────────────────────────┐│
│  │                 Subnet: Observer (Isolated)                  ││
│  │                          │                                   ││
│  │              ┌───────────▼───────────┐                      ││
│  │              │  Observer Ingestion   │                      ││
│  │              └───────────┬───────────┘                      ││
│  │                          │                                   ││
│  │    ┌─────────────────────┼─────────────────────┐            ││
│  │    ▼                     ▼                     ▼            ││
│  │ ┌──────────┐      ┌──────────┐      ┌──────────┐           ││
│  │ │Chronicler│      │ Analyst  │      │ Auditor  │           ││
│  │ └────┬─────┘      └────┬─────┘      └────┬─────┘           ││
│  │      └─────────────────┼─────────────────┘                  ││
│  │                        ▼                                     ││
│  │              ┌───────────────────────┐                      ││
│  │              │   Observer Database   │                      ││
│  │              │   (TimescaleDB)       │                      ││
│  │              └───────────────────────┘                      ││
│  │                                                              ││
│  │              ┌───────────────────────┐                      ││
│  │              │   Observer API        │◄──── Dashboard       ││
│  │              │   (Read-Only)         │      (via API GW)    ││
│  │              └───────────────────────┘                      ││
│  └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Security Groups / Firewall Rules

**Operational Zone → Observer Zone:**
```
ALLOW: TCP 9092 (Kafka) FROM operational-sg TO observer-ingestion-sg
ALLOW: TCP 443 (HTTPS) FROM operational-sg TO event-bus-endpoint
DENY: ALL FROM operational-sg TO observer-*-sg
```

**Observer Zone → Operational Zone:**
```
DENY: ALL FROM observer-*-sg TO operational-sg
DENY: ALL FROM observer-*-sg TO operational-db-sg
```

**Observer Zone Internal:**
```
ALLOW: TCP 5432 FROM observer-services-sg TO observer-db-sg
ALLOW: TCP 8080 FROM observer-api-sg TO observer-services-sg
```

**External Access:**
```
ALLOW: TCP 443 FROM api-gateway TO observer-api-sg (read-only endpoints)
```

### Database Isolation

**Operational Database (PostgreSQL/Supabase):**
- Contains: Agents, Users, Council config, Trust scores
- Observer access: READ-ONLY replica connection
- Observer credentials: SELECT only, no INSERT/UPDATE/DELETE

**Observer Database (TimescaleDB):**
- Contains: Event logs, anomaly records, reports
- Write access: Observer services only
- External access: READ-ONLY via Observer API
- Retention: Configurable per event type

```sql
-- Observer database user (for operational data reads)
CREATE USER observer_reader WITH PASSWORD '***';
GRANT CONNECT ON DATABASE agentanchor TO observer_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO observer_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO observer_reader;

-- Prevent any writes
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  FROM observer_reader;
```

---

## Event Flow

### Event Emission (Operational Zone)

```typescript
// Worker Agent emitting event
class WorkerAgent {
  private eventEmitter: EventEmitter;

  async executeAction(action: Action): Promise<Result> {
    const eventId = uuid();

    // Emit before action
    await this.eventEmitter.emit({
      id: eventId,
      type: 'action.started',
      source: { type: 'worker', id: this.id },
      event: {
        type: 'action.execute',
        action: action.description,
        details: action.sanitizedDetails(), // No secrets
      },
      signature: this.sign(eventId),
    });

    const result = await this.performAction(action);

    // Emit after action
    await this.eventEmitter.emit({
      id: uuid(),
      type: 'action.completed',
      source: { type: 'worker', id: this.id },
      event: {
        type: 'action.result',
        action: action.description,
        details: { success: result.success, correlationId: eventId },
      },
      signature: this.sign(eventId),
    });

    return result;
  }
}
```

### Event Bus (Isolation Boundary)

```typescript
// Event Bus configuration (Kafka or SQS)
const eventBusConfig = {
  // One-way topic - Observer consumes, never produces back
  topics: {
    'observer-events': {
      producers: ['worker-service', 'council-service', 'academy-service'],
      consumers: ['observer-ingestion'],
      retention: '7d',
      replication: 3,
    },
  },

  // Security
  acl: {
    'observer-ingestion': {
      allow: ['READ'],
      deny: ['WRITE', 'DELETE', 'ALTER'],
    },
    'worker-service': {
      allow: ['WRITE'],
      deny: ['READ'], // Workers can't read their own events back
    },
  },
};
```

### Event Ingestion (Observer Zone)

```typescript
class ObserverIngestionService {
  private chronicler: Chronicler;
  private trustedClock: TrustedTimeSource;

  async processEvent(event: RawEvent): Promise<void> {
    // 1. Validate source signature
    if (!this.validateSignature(event)) {
      await this.logRejection(event, 'INVALID_SIGNATURE');
      return;
    }

    // 2. Apply trusted timestamp
    const trustedTimestamp = await this.trustedClock.now();

    // 3. Get previous hash for chain
    const previousHash = await this.chronicler.getLastHash(event.source.tenant);

    // 4. Create log entry
    const entry: ObserverLogEntry = {
      id: uuidv7(),
      sequence: await this.chronicler.nextSequence(),
      timestamp: {
        event: event.timestamp,
        received: new Date().toISOString(),
        logged: trustedTimestamp,
      },
      source: event.source,
      event: event.event,
      context: event.context,
      integrity: {
        sourceSignature: event.signature,
        observerSignature: this.sign(entry),
        previousHash,
        entryHash: this.hash(entry),
      },
    };

    // 5. Write to append-only log
    await this.chronicler.append(entry);

    // 6. Forward to Analyst for real-time processing
    await this.analyst.analyze(entry);
  }

  private validateSignature(event: RawEvent): boolean {
    const publicKey = this.keyStore.getPublicKey(event.source.id);
    return crypto.verify(event.signature, event, publicKey);
  }
}
```

---

## Append-Only Log Implementation

### Storage Design

```sql
-- TimescaleDB hypertable for events
CREATE TABLE observer_events (
  id UUID PRIMARY KEY,
  sequence BIGSERIAL NOT NULL,

  -- Timestamps
  event_time TIMESTAMPTZ NOT NULL,
  received_time TIMESTAMPTZ NOT NULL,
  logged_time TIMESTAMPTZ NOT NULL,

  -- Source
  source_type VARCHAR(20) NOT NULL,
  source_id VARCHAR(100) NOT NULL,
  tenant_id VARCHAR(100) NOT NULL,

  -- Event
  event_type VARCHAR(100) NOT NULL,
  event_category VARCHAR(50) NOT NULL,
  event_level SMALLINT NOT NULL,
  event_action TEXT NOT NULL,
  event_details JSONB,

  -- Context
  conversation_id VARCHAR(100),
  task_id VARCHAR(100),
  precedent_id VARCHAR(100),
  request_id VARCHAR(100) NOT NULL,

  -- Integrity
  source_signature TEXT NOT NULL,
  observer_signature TEXT NOT NULL,
  previous_hash VARCHAR(64) NOT NULL,
  entry_hash VARCHAR(64) NOT NULL
);

-- Convert to hypertable (TimescaleDB)
SELECT create_hypertable('observer_events', 'logged_time');

-- Prevent modifications
CREATE OR REPLACE FUNCTION prevent_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Observer events cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_update_observer_events
  BEFORE UPDATE ON observer_events
  FOR EACH ROW EXECUTE FUNCTION prevent_modification();

CREATE TRIGGER no_delete_observer_events
  BEFORE DELETE ON observer_events
  FOR EACH ROW EXECUTE FUNCTION prevent_modification();

-- Only allow inserts from observer service
REVOKE ALL ON observer_events FROM PUBLIC;
GRANT INSERT ON observer_events TO observer_chronicler;
GRANT SELECT ON observer_events TO observer_reader;
```

### Hash Chain Integrity

```typescript
class HashChain {
  private algorithm = 'sha256';

  computeEntryHash(entry: ObserverLogEntry): string {
    const payload = JSON.stringify({
      id: entry.id,
      sequence: entry.sequence,
      timestamp: entry.timestamp,
      source: entry.source,
      event: entry.event,
      context: entry.context,
      previousHash: entry.integrity.previousHash,
    });

    return crypto.createHash(this.algorithm).update(payload).digest('hex');
  }

  async verifyChain(startSequence: bigint, endSequence: bigint): Promise<ChainVerification> {
    const entries = await this.chronicler.getRange(startSequence, endSequence);

    let previousHash = entries[0].integrity.previousHash;
    const failures: ChainFailure[] = [];

    for (const entry of entries) {
      // Verify hash chain link
      if (entry.integrity.previousHash !== previousHash) {
        failures.push({
          sequence: entry.sequence,
          type: 'CHAIN_BREAK',
          expected: previousHash,
          actual: entry.integrity.previousHash,
        });
      }

      // Verify entry hash
      const computedHash = this.computeEntryHash(entry);
      if (computedHash !== entry.integrity.entryHash) {
        failures.push({
          sequence: entry.sequence,
          type: 'HASH_MISMATCH',
          expected: entry.integrity.entryHash,
          actual: computedHash,
        });
      }

      previousHash = entry.integrity.entryHash;
    }

    return {
      verified: failures.length === 0,
      entriesChecked: entries.length,
      failures,
      lastVerifiedHash: previousHash,
    };
  }
}
```

---

## Real-Time Feed

### WebSocket Implementation

```typescript
// Observer API - Read-only WebSocket feed
class ObserverFeedService {
  private subscribers: Map<string, WebSocket[]> = new Map();

  async subscribe(ws: WebSocket, tenantId: string, filters: FeedFilters): Promise<void> {
    // Validate tenant access
    if (!await this.validateAccess(ws.userId, tenantId)) {
      ws.close(4403, 'Access denied');
      return;
    }

    // Store subscription
    const key = `${tenantId}:${JSON.stringify(filters)}`;
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, []);
    }
    this.subscribers.get(key)!.push(ws);

    // Send recent history
    const recent = await this.chronicler.getRecent(tenantId, filters, 50);
    ws.send(JSON.stringify({ type: 'history', events: recent }));
  }

  // Called by Chronicler after each append
  async broadcast(entry: ObserverLogEntry): Promise<void> {
    const tenantId = entry.source.tenant;

    for (const [key, sockets] of this.subscribers) {
      if (!key.startsWith(tenantId)) continue;

      const filters = JSON.parse(key.split(':')[1]);
      if (this.matchesFilters(entry, filters)) {
        const message = JSON.stringify({ type: 'event', event: entry });
        sockets.forEach(ws => ws.send(message));
      }
    }
  }

  private matchesFilters(entry: ObserverLogEntry, filters: FeedFilters): boolean {
    if (filters.agentId && entry.source.id !== filters.agentId) return false;
    if (filters.minLevel && entry.event.level < filters.minLevel) return false;
    if (filters.categories && !filters.categories.includes(entry.event.category)) return false;
    return true;
  }
}
```

### Dashboard Integration

```typescript
// Frontend component for Observer Feed
interface ObserverFeedProps {
  tenantId: string;
  filters?: {
    agentId?: string;
    minLevel?: 0 | 1 | 2 | 3;
    categories?: string[];
  };
}

function ObserverFeed({ tenantId, filters }: ObserverFeedProps) {
  const [events, setEvents] = useState<ObserverLogEntry[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(`wss://api.agentanchor.ai/observer/feed`);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', tenantId, filters }));
      setConnected(true);
    };

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.type === 'history') {
        setEvents(data.events);
      } else if (data.type === 'event') {
        setEvents(prev => [data.event, ...prev].slice(0, 100));
      }
    };

    ws.onclose = () => setConnected(false);

    return () => ws.close();
  }, [tenantId, filters]);

  return (
    <div className="observer-feed">
      <div className="feed-header">
        <span className={`status ${connected ? 'connected' : 'disconnected'}`} />
        Live Observer Feed
      </div>
      <div className="feed-entries">
        {events.map(event => (
          <ObserverLine key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
```

---

## Cryptographic Attestation

### Observer Integrity Verification

External parties can verify that the Observer is operating correctly:

```typescript
class ObserverAttestation {
  // Generate attestation report
  async generateAttestation(): Promise<AttestationReport> {
    const report: AttestationReport = {
      timestamp: new Date().toISOString(),
      observerId: this.observerId,
      version: this.version,

      // Code integrity
      codeHash: await this.computeCodeHash(),
      configHash: await this.computeConfigHash(),

      // Chain integrity
      chainStatus: await this.hashChain.verifyRecent(1000),
      lastEntryHash: await this.chronicler.getLastHash(),
      totalEntries: await this.chronicler.count(),

      // Infrastructure
      infrastructure: {
        isolated: await this.verifyNetworkIsolation(),
        readOnlyDb: await this.verifyReadOnlyAccess(),
        appendOnly: await this.verifyAppendOnlyLogs(),
      },

      // Signature
      signature: '', // Filled below
    };

    report.signature = this.sign(report);
    return report;
  }

  // Verify attestation (can be done externally)
  static verifyAttestation(
    report: AttestationReport,
    publicKey: string
  ): boolean {
    const { signature, ...payload } = report;
    return crypto.verify(signature, JSON.stringify(payload), publicKey);
  }
}
```

### Public Verification Endpoint

```typescript
// GET /observer/attestation
// Returns current attestation report (public, no auth required)
app.get('/observer/attestation', async (req, res) => {
  const attestation = await observerAttestation.generateAttestation();

  res.json({
    attestation,
    publicKey: observerAttestation.publicKey,
    verificationInstructions: {
      algorithm: 'RSA-SHA256',
      steps: [
        '1. Remove "signature" field from attestation object',
        '2. JSON.stringify the remaining object',
        '3. Verify signature using provided publicKey',
        '4. Check chainStatus.verified === true',
        '5. Check infrastructure.isolated === true',
      ],
    },
  });
});
```

---

## Deployment Architecture

### Container Configuration

```yaml
# docker-compose.observer.yml
version: '3.8'

services:
  observer-ingestion:
    image: agentanchor/observer-ingestion:latest
    environment:
      - KAFKA_BROKERS=kafka:9092
      - OBSERVER_DB_URL=postgres://observer_chronicler:***@observer-db:5432/observer
      - TRUSTED_TIME_URL=https://time.agentanchor.ai
    networks:
      - observer-internal
      - event-bus  # One-way: can only consume
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2'
          memory: 4G

  observer-chronicler:
    image: agentanchor/observer-chronicler:latest
    environment:
      - OBSERVER_DB_URL=postgres://observer_chronicler:***@observer-db:5432/observer
    networks:
      - observer-internal
    deploy:
      replicas: 2

  observer-analyst:
    image: agentanchor/observer-analyst:latest
    environment:
      - OBSERVER_DB_URL=postgres://observer_reader:***@observer-db:5432/observer
    networks:
      - observer-internal
    deploy:
      replicas: 2

  observer-auditor:
    image: agentanchor/observer-auditor:latest
    environment:
      - OBSERVER_DB_URL=postgres://observer_reader:***@observer-db:5432/observer
    networks:
      - observer-internal
    deploy:
      replicas: 1

  observer-api:
    image: agentanchor/observer-api:latest
    environment:
      - OBSERVER_DB_URL=postgres://observer_reader:***@observer-db:5432/observer
    networks:
      - observer-internal
      - api-gateway  # Exposed for dashboard reads
    deploy:
      replicas: 3

  observer-db:
    image: timescale/timescaledb:latest-pg14
    volumes:
      - observer-data:/var/lib/postgresql/data
    networks:
      - observer-internal
    deploy:
      replicas: 1

networks:
  observer-internal:
    internal: true  # No external access
  event-bus:
    external: true
  api-gateway:
    external: true

volumes:
  observer-data:
```

### Kubernetes Configuration

```yaml
# observer-namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: observer
  labels:
    istio-injection: enabled  # For network policies

---
# Network policy - isolate Observer
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: observer-isolation
  namespace: observer
spec:
  podSelector: {}  # Apply to all pods in namespace
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # Allow from event bus only
    - from:
        - namespaceSelector:
            matchLabels:
              name: event-bus
      ports:
        - protocol: TCP
          port: 9092
    # Allow from API gateway (read-only)
    - from:
        - namespaceSelector:
            matchLabels:
              name: api-gateway
      ports:
        - protocol: TCP
          port: 8080
  egress:
    # Only allow internal observer communication
    - to:
        - podSelector: {}
    # Allow DNS
    - to:
        - namespaceSelector: {}
      ports:
        - protocol: UDP
          port: 53
    # Block egress to operational namespace
    - to:
        - namespaceSelector:
            matchLabels:
              name: operational
      ports: []  # Empty = deny all
```

---

## Monitoring & Alerting

### Observer Health Metrics

```typescript
const observerMetrics = {
  // Ingestion
  'observer.events.received': Counter,
  'observer.events.processed': Counter,
  'observer.events.rejected': Counter,
  'observer.ingestion.latency': Histogram,

  // Chain integrity
  'observer.chain.length': Gauge,
  'observer.chain.last_verified': Gauge,
  'observer.chain.failures': Counter,

  // Analyst
  'observer.anomalies.detected': Counter,
  'observer.alerts.generated': Counter,
  'observer.analysis.latency': Histogram,

  // API
  'observer.api.requests': Counter,
  'observer.api.latency': Histogram,
  'observer.feed.subscribers': Gauge,

  // Infrastructure
  'observer.isolation.verified': Gauge,  // 1 = isolated, 0 = breach
  'observer.db.connections': Gauge,
  'observer.db.query_latency': Histogram,
};
```

### Alert Rules

```yaml
# prometheus-rules.yaml
groups:
  - name: observer-critical
    rules:
      - alert: ObserverIsolationBreach
        expr: observer_isolation_verified == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Observer isolation compromised"
          description: "The Observer service may have network access to operational zone"

      - alert: ObserverChainIntegrityFailure
        expr: observer_chain_failures > 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Observer hash chain integrity failure"
          description: "{{ $value }} chain verification failures detected"

      - alert: ObserverIngestionBacklog
        expr: rate(observer_events_received[5m]) > rate(observer_events_processed[5m]) * 1.5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Observer ingestion falling behind"
          description: "Events receiving faster than processing"
```

---

## Summary

The Observer Architecture provides:

| Capability | Implementation |
|------------|---------------|
| **Complete Isolation** | Separate VPC, no return path, read-only access |
| **Tamper-Proof Logs** | Append-only database, hash chain, triggers prevent modification |
| **Real-Time Monitoring** | WebSocket feed, live dashboard integration |
| **Anomaly Detection** | Statistical baselines, pattern matching, alert generation |
| **Compliance Reporting** | Automated reports, audit exports, regulatory packages |
| **Cryptographic Integrity** | Source signatures, Observer signatures, hash chain |
| **External Verification** | Public attestation endpoint, verifiable proofs |

**Key Guarantees:**

1. **Observers cannot influence agents** - No write path back to operational zone
2. **Logs cannot be tampered** - Append-only storage with hash chain
3. **Nothing escapes logging** - All events flow through event bus
4. **Integrity is verifiable** - Cryptographic proofs available externally

---

_"The Observer sees everything but touches nothing."_

_AgentAnchor Observer Architecture v1.0_
