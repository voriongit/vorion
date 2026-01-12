# Story 5-1: Observer Event Logging

**Epic:** 5 - Observer & Truth Chain
**Status:** Drafted
**Created:** 2025-12-03

---

## User Story

**As a** platform administrator
**I want** all platform events captured in an append-only audit log
**So that** we have a complete, tamper-evident record of all system activity

---

## Acceptance Criteria

- [ ] `observer_events` table created with append-only constraints
- [ ] Events captured from all source types: agent, council, academy, marketplace, user
- [ ] Each event includes cryptographic hash of its content
- [ ] Hash chain links each event to previous event
- [ ] Event ingestion completes in < 100ms
- [ ] No UPDATE or DELETE operations allowed on observer_events
- [ ] Internal API endpoint `/api/observer/events` for event submission
- [ ] Events include: eventType, sourceType, sourceId, actorId, action, payload, riskLevel

---

## Technical Notes

### Database Schema

```sql
CREATE TABLE observer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence BIGSERIAL UNIQUE,
  event_type VARCHAR(100) NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  source_id UUID,
  actor_id UUID,
  action VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  risk_level INTEGER DEFAULT 0,
  hash VARCHAR(64) NOT NULL,
  previous_hash VARCHAR(64),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent updates and deletes
CREATE RULE observer_events_no_update AS ON UPDATE TO observer_events DO INSTEAD NOTHING;
CREATE RULE observer_events_no_delete AS ON DELETE TO observer_events DO INSTEAD NOTHING;
```

### Hash Calculation

```typescript
function calculateEventHash(event: ObserverEvent, previousHash: string): string {
  const content = JSON.stringify({
    eventType: event.eventType,
    sourceType: event.sourceType,
    sourceId: event.sourceId,
    action: event.action,
    payload: event.payload,
    timestamp: event.timestamp,
    previousHash
  });
  return crypto.createHash('sha256').update(content).digest('hex');
}
```

### Service Location

- `lib/observer/event-service.ts` - Event ingestion and hash chain
- `lib/observer/types.ts` - Event type definitions

### Files to Create/Modify

- `lib/db/schema/observer.ts` - Observer schema definitions
- `lib/observer/event-service.ts` - Core event service
- `lib/observer/types.ts` - Type definitions
- `app/api/observer/events/route.ts` - Internal ingestion API

---

## Dependencies

- Database migration system
- Council events (Epic 3) - for decision event capture
- Trust events (Epic 4) - for trust change capture

---

## Out of Scope

- Real-time feed UI (Story 5-2)
- Anomaly detection (Story 5-3)
- External verification (Story 5-5)
