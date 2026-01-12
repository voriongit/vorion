# Story 12-4: Delegation Truth Chain

**Epic:** 12 - Maintenance Delegation
**Story ID:** 12-4
**Title:** Delegation Truth Chain
**Status:** drafted
**Priority:** Medium
**Estimated Effort:** Medium (5-8 hours)

---

## User Story

**As a** Platform User (Trainer, Delegate, or Auditor),
**I want to** view the complete delegation history on the Truth Chain,
**So that** I have a verifiable audit trail of all delegation activities.

---

## Acceptance Criteria

### AC1: Delegation Events Recorded
**Given** any delegation event occurs
**When** the event completes
**Then** it is recorded on the Truth Chain with:
- Event type (created, accepted, revoked, action)
- Timestamp
- Actor (trainer or delegate)
- Agent ID
- Event-specific details

### AC2: Delegate Action Events
**Given** a delegate performs an action on an agent
**When** the action completes
**Then** `delegation.action` is recorded with:
- Action type (update_prompt, respond_feedback, etc.)
- Action details (what was changed)
- Previous state (for audit rollback reference)

### AC3: Delegation Action Log UI
**Given** I am a Trainer viewing my agent's delegation
**When** I click "View Action History"
**Then** I see chronological list of all delegate actions
**With** timestamps, action types, and details

### AC4: Public Verification
**Given** I have a delegation Truth Chain hash
**When** I visit /verify/[hash]
**Then** I see the delegation event details
**And** verification status (valid/invalid)

### AC5: Compliance Export
**Given** I need delegation records for compliance
**When** I export Truth Chain records
**Then** delegation events are included
**With** proper filtering by date range and type

### AC6: Delegation Summary on Agent
**Given** I view an agent's Truth Chain tab
**When** the page loads
**Then** I see delegation events in the timeline
**Including** who was delegate, when, and actions taken

---

## Technical Implementation

### Truth Chain Event Types

```typescript
// lib/truth-chain/types.ts - Update

export type TruthChainEventType =
  | 'certification.issued'
  | 'council.decision'
  | 'ownership.transferred'
  | 'human.override'
  | 'trust.milestone'
  | 'client.walkaway'
  | 'acquisition.complete'
  // New delegation events
  | 'delegation.created'
  | 'delegation.accepted'
  | 'delegation.revoked'
  | 'delegation.expired'
  | 'delegation.action';

export interface DelegationEventPayload {
  delegationId: string;
  agentId: string;
  trainerId: string;
  delegateId: string;
  action?: {
    type: string;
    details: Record<string, unknown>;
    previousState?: Record<string, unknown>;
  };
  reason?: string;
}
```

### Service Integration

```typescript
// lib/delegation/delegation-service.ts

import { recordTruthChainEvent } from '@/lib/truth-chain';

export async function createDelegation(...) {
  // ... existing logic

  // Record to Truth Chain
  await recordTruthChainEvent({
    type: 'delegation.created',
    actorId: trainerId,
    actorType: 'HUMAN',
    agentId: input.agentId,
    payload: {
      delegationId: delegation.id,
      trainerId,
      delegateId: delegate.id,
      expiresAt: input.expiresAt,
    }
  });
}

export async function acceptDelegation(...) {
  // ... existing logic

  await recordTruthChainEvent({
    type: 'delegation.accepted',
    actorId: delegateId,
    actorType: 'HUMAN',
    agentId: delegation.agentId,
    payload: {
      delegationId,
      trainerId: delegation.trainerId,
      delegateId,
    }
  });
}

export async function revokeDelegation(...) {
  // ... existing logic

  await recordTruthChainEvent({
    type: 'delegation.revoked',
    actorId: trainerId,
    actorType: 'HUMAN',
    agentId: delegation.agentId,
    payload: {
      delegationId,
      trainerId,
      delegateId: delegation.delegateId,
      reason,
    }
  });
}

export async function recordDelegateAction(
  delegationId: string,
  actionType: string,
  details: Record<string, unknown>,
  previousState?: Record<string, unknown>
) {
  const delegation = await getDelegation(delegationId);

  // Record in delegate_actions table
  await db.insert(delegateActions).values({
    delegationId,
    agentId: delegation.agentId,
    delegateId: delegation.delegateId,
    actionType,
    actionDetails: details,
    previousState,
    success: true,
  });

  // Record to Truth Chain
  const truthChainRecord = await recordTruthChainEvent({
    type: 'delegation.action',
    actorId: delegation.delegateId,
    actorType: 'HUMAN',
    agentId: delegation.agentId,
    payload: {
      delegationId,
      trainerId: delegation.trainerId,
      delegateId: delegation.delegateId,
      action: {
        type: actionType,
        details,
        previousState,
      }
    }
  });

  // Update delegate_actions with hash
  await db.update(delegateActions)
    .set({ truthChainHash: truthChainRecord.hash })
    .where(eq(delegateActions.delegationId, delegationId));
}
```

### UI Components

```typescript
// components/delegation/DelegateActionLog.tsx
interface Props {
  delegationId: string;
}

export function DelegateActionLog({ delegationId }: Props) {
  const { data: actions } = useSWR(`/api/v1/delegations/${delegationId}/actions`);

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Delegate Action History</h3>
      {actions?.map((action) => (
        <Card key={action.id}>
          <CardHeader>
            <CardTitle className="text-sm">
              {formatActionType(action.actionType)}
            </CardTitle>
            <CardDescription>
              {formatDate(action.performedAt)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-2 rounded">
              {JSON.stringify(action.actionDetails, null, 2)}
            </pre>
            {action.truthChainHash && (
              <Link href={`/verify/${action.truthChainHash}`}>
                View on Truth Chain
              </Link>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// components/truth-chain/DelegationEventCard.tsx
interface Props {
  event: TruthChainEvent;
}

export function DelegationEventCard({ event }: Props) {
  const payload = event.payload as DelegationEventPayload;

  return (
    <Card>
      <CardHeader>
        <Badge variant={getEventVariant(event.type)}>
          {formatEventType(event.type)}
        </Badge>
        <CardDescription>{formatDate(event.timestamp)}</CardDescription>
      </CardHeader>
      <CardContent>
        {event.type === 'delegation.action' && (
          <div>
            <p>Action: {payload.action?.type}</p>
            <details>
              <summary>Details</summary>
              <pre className="text-xs">
                {JSON.stringify(payload.action?.details, null, 2)}
              </pre>
            </details>
          </div>
        )}
        {event.type === 'delegation.revoked' && (
          <p>Reason: {payload.reason || 'No reason provided'}</p>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## API Specification

### GET /api/v1/delegations/:id/actions

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "actionType": "update_prompt",
      "actionDetails": {
        "newPrompt": "Updated system prompt...",
        "previousPrompt": "Old prompt..."
      },
      "performedAt": "2025-12-09T...",
      "truthChainHash": "abc123..."
    }
  ]
}
```

### GET /api/v1/truth-chain?type=delegation.*&agentId=:id

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "delegation.created",
      "timestamp": "2025-12-09T...",
      "hash": "abc123...",
      "payload": {
        "delegationId": "uuid",
        "trainerId": "uuid",
        "delegateId": "uuid"
      }
    }
  ]
}
```

---

## Testing Checklist

- [ ] Unit: Truth Chain events recorded correctly
- [ ] Unit: Event payloads contain required fields
- [ ] Integration: Full lifecycle (create -> accept -> actions -> revoke) recorded
- [ ] Integration: Public verification works for delegation events
- [ ] E2E: View action history in UI
- [ ] E2E: Export includes delegation events

---

## Definition of Done

- [ ] All delegation events recorded to Truth Chain
- [ ] DelegateActionLog component working
- [ ] DelegationEventCard component working
- [ ] Public verification page shows delegation events
- [ ] Compliance export includes delegations
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Code reviewed

---

*Story drafted: 2025-12-09*
*Epic: 12 - Maintenance Delegation*
