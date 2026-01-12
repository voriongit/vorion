# Story 5-1: Observer Event Logging

## Status: COMPLETE

## Overview
Implemented the Observer service - an isolated, append-only audit layer that records every agent action with cryptographic integrity.

## Acceptance Criteria
- [x] Every agent action logged with timestamp and details (FR82)
- [x] Logs are append-only - modifications rejected (FR83)
- [x] Events include cryptographic signatures (FR84)
- [x] Observer isolated from Worker/Council (FR85, FR86)

## Implementation

### Files Created

#### 1. `lib/observer/types.ts`
Type definitions:
- **EventSource**: agent, council, academy, marketplace, user, system, cron
- **EventType**: 20+ event types covering all system actions
- **EventRiskLevel**: info, low, medium, high, critical
- **ObserverEvent**: Full event structure with hash chain

#### 2. `lib/observer/observer-service.ts`
Core Observer service:
- **logEvent()**: Append event with hash chain and signature
- **queryEvents()**: Query events with filters (FR88)
- **getEventsSince()**: For real-time updates
- **verifyEvent()**: Verify event signature integrity
- **verifyChainIntegrity()**: Check hash chain is unbroken
- **getAgentStats()**: Get event statistics for an agent

Cryptographic features:
- SHA-256 hash chain linking events
- HMAC signature using platform key
- Previous event hash stored in each event

#### 3. `lib/observer/index.ts`
Module exports.

#### 4. `app/api/observer/events/route.ts`
REST API:
- `GET /api/observer/events` - Query events with filters
- `POST /api/observer/events` - Log new events

### Database Migration

#### `20250204000000_observer_events.sql`
Created `observer_events` table with:
- `sequence` - Monotonic sequence number
- `source` - Event source
- `event_type` - Type of event
- `risk_level` - Risk classification
- `agent_id`, `user_id` - Foreign keys
- `data` - JSONB event data
- `previous_hash`, `hash`, `signature` - Cryptographic fields

RLS Policies:
- **INSERT**: Allowed (for logging)
- **UPDATE**: **Blocked** (append-only)
- **DELETE**: **Blocked** (append-only)
- **SELECT**: User's own events or public agents

### Integration

#### Council Evaluation (`app/api/council/evaluate/route.ts`)
Added Observer logging for:
1. `council_request` - When action submitted for evaluation
2. `council_decision` - Council's decision
3. `trust_change` - Any trust score changes

## Event Structure

```typescript
interface ObserverEvent {
  id: string                    // UUID
  sequence: number              // Monotonic counter
  source: EventSource           // Who generated event
  event_type: EventType         // What happened
  risk_level: EventRiskLevel    // Risk classification
  agent_id?: string             // Related agent
  user_id?: string              // Related user
  data: Record<string, unknown> // Event details
  timestamp: string             // ISO timestamp
  previous_hash: string         // Hash of previous event
  hash: string                  // SHA-256 of this event
  signature: string             // HMAC signature
}
```

## Hash Chain

Each event links to the previous via hash chain:
```
Event 1: hash = SHA256(data), previous_hash = genesis
Event 2: hash = SHA256(data), previous_hash = Event1.hash
Event 3: hash = SHA256(data), previous_hash = Event2.hash
...
```

This ensures:
- Events cannot be modified (hash would break)
- Events cannot be reordered (chain would break)
- Events cannot be deleted (chain would break)

## Append-Only Enforcement

RLS policies at database level:
```sql
-- No updates allowed
CREATE POLICY "observer_events_no_update"
ON observer_events FOR UPDATE USING (false);

-- No deletes allowed
CREATE POLICY "observer_events_no_delete"
ON observer_events FOR DELETE USING (false);
```

## Signature Verification

```typescript
async function verifyEvent(event: ObserverEvent): Promise<boolean> {
  const expectedHash = await generateHash(eventData)
  const expectedSignature = await generateSignature(expectedHash)
  return event.hash === expectedHash &&
         event.signature === expectedSignature
}
```

## Dependencies
- Epic 1: Foundation (database, auth)
- Uses: `@/lib/supabase/server` for database access

## Next Steps
- Story 5-2: Observer Dashboard Feed (real-time UI)
- Story 5-3: Compliance Export (FR89)
