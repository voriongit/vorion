# Epic Technical Specification: Observer & Truth Chain

Date: 2025-12-03
Author: frank the tank
Epic ID: 5
Status: Draft

---

## Overview

Epic 5 implements the Observer Layer and Truth Chain - the audit and immutability infrastructure that makes AgentAnchor's governance verifiable. The Observer provides an isolated, append-only audit trail of all platform events, while the Truth Chain creates cryptographically-linked records for public verification.

This epic is critical to AgentAnchor's core promise: "Trust isn't assumed — it's earned, proven, and **verified**."

## Objectives and Scope

### In Scope

- **Story 5-1**: Observer Event Logging - Capture and store all platform events
- **Story 5-2**: Observer Dashboard Feed - Real-time event visualization
- **Story 5-3**: Anomaly Detection - Pattern detection and alerting
- **Story 5-4**: Truth Chain Records - Cryptographic decision recording
- **Story 5-5**: Public Verification - External verification API and UI

### Out of Scope

- Full blockchain integration (MVP uses internal hash chain)
- Decentralized Observer network
- Cross-platform verification
- Advanced ML-based anomaly detection

## System Architecture Alignment

The Observer Layer sits **below the isolation barrier** - completely separated from operational systems:

```
┌─────────────────────────────────────┐
│  Operational Zone                    │
│  (Workers, Council, Academy)         │
└──────────────┬──────────────────────┘
               │ Events (One-Way)
═══════════════╪══════════════════════
  ISOLATION BARRIER - No Return Path
═══════════════╪══════════════════════
               ▼
┌─────────────────────────────────────┐
│  Observer Zone                       │
│  Chronicler → Analyst → Auditor     │
│  (Read-only, Append-only)           │
└─────────────────────────────────────┘
```

**Key Constraint:** Observer cannot influence operational systems. One-way data flow only.

## Detailed Design

### Services and Modules

| Service | Purpose | Status |
|---------|---------|--------|
| Event Ingestion | Capture events from operational zone | 🔲 Needed |
| Chronicler | Log events to append-only store | 🔲 Needed |
| Analyst | Detect patterns and anomalies | 🔲 Needed |
| Auditor | Generate compliance reports | 🔲 Needed |
| Truth Chain | Cryptographic record linking | 🔲 Needed |
| Verification API | Public verification endpoints | 🔲 Needed |

### Data Models

```sql
-- observer_events table (append-only)
CREATE TABLE observer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence BIGSERIAL UNIQUE,
  event_type VARCHAR(100) NOT NULL,
  source_type VARCHAR(50) NOT NULL, -- 'agent', 'council', 'academy', 'marketplace'
  source_id UUID,
  actor_id UUID,
  action VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  risk_level INTEGER DEFAULT 0,
  hash VARCHAR(64) NOT NULL, -- SHA-256 of event
  previous_hash VARCHAR(64), -- Link to previous event
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- truth_chain table
CREATE TABLE truth_chain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type VARCHAR(50) NOT NULL, -- 'certification', 'decision', 'ownership', 'milestone'
  subject_type VARCHAR(50) NOT NULL,
  subject_id UUID NOT NULL,
  action TEXT NOT NULL,
  payload JSONB NOT NULL,
  sequence BIGSERIAL UNIQUE,
  previous_hash VARCHAR(64),
  hash VARCHAR(64) NOT NULL,
  anchor_tx VARCHAR(66), -- Blockchain tx hash (future)
  anchor_block INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- anomalies table
CREATE TABLE anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES observer_events(id),
  anomaly_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
  description TEXT NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);
```

### APIs and Interfaces

```typescript
// POST /api/observer/events (internal only)
interface ObserverEvent {
  eventType: string;
  sourceType: 'agent' | 'council' | 'academy' | 'marketplace' | 'user';
  sourceId?: string;
  actorId?: string;
  action: string;
  payload: Record<string, unknown>;
  riskLevel?: number;
}

// GET /api/observer/feed (authenticated)
interface ObserverFeedResponse {
  events: ObserverEvent[];
  cursor: string;
  hasMore: boolean;
}

// GET /api/truth-chain/verify/:id (public, no auth)
interface VerificationResponse {
  verified: boolean;
  record: TruthChainRecord;
  chainIntegrity: boolean;
  proof: {
    sequence: number;
    previousHash: string;
    hash: string;
  };
}
```

## Acceptance Criteria Summary

### Story 5-1: Observer Event Logging
- [ ] Events captured from all source types
- [ ] Append-only storage (no UPDATE/DELETE)
- [ ] Cryptographic hash linking
- [ ] < 100ms ingestion latency

### Story 5-2: Observer Dashboard Feed
- [ ] Real-time event feed UI
- [ ] Filter by source, type, risk level
- [ ] Paginated historical view
- [ ] WebSocket for live updates

### Story 5-3: Anomaly Detection
- [ ] Rule-based anomaly detection
- [ ] Alert on suspicious patterns
- [ ] Anomaly dashboard with resolution workflow

### Story 5-4: Truth Chain Records
- [ ] Critical events recorded to truth chain
- [ ] Hash chain integrity maintained
- [ ] Merkle tree for batch verification (future)

### Story 5-5: Public Verification
- [ ] Public API endpoint (no auth)
- [ ] Verification page with QR code
- [ ] Embeddable verification widget
- [ ] Certificate generation (PDF)

## Dependencies

- Epic 3 (Council) - Source of decision events
- Epic 4 (Trust) - Source of trust milestone events
- Epic 2 (Academy) - Source of graduation events

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Event volume overwhelms storage | High | Implement retention policy, archival |
| Hash chain breaks | Critical | Validate on every write, alerts |
| Observer accessed by operations | Critical | Network isolation, strict ACLs |

## Test Strategy

- Unit tests for hash chain integrity
- Integration tests for event ingestion
- E2E tests for verification flow
- Load tests for event throughput
