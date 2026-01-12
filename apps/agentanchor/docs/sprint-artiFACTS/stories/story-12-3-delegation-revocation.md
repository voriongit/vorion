# Story 12-3: Delegation Revocation

**Epic:** 12 - Maintenance Delegation
**Story ID:** 12-3
**Title:** Delegation Revocation
**Status:** drafted
**Priority:** Medium
**Estimated Effort:** Small (3-5 hours)

---

## User Story

**As a** Trainer,
**I want to** revoke a delegation at any time,
**So that** I can remove delegate access instantly when needed.

---

## Acceptance Criteria

### AC1: Revoke Active Delegation
**Given** I am a Trainer with an active delegation
**When** I click "Revoke Delegation"
**Then** I am prompted to confirm
**And** optionally provide a reason
**And** the delegation status changes to 'revoked'

### AC2: Immediate Access Removal
**Given** a delegation is revoked
**When** the delegate tries to access the agent
**Then** they receive "Access Denied - Delegation Revoked"
**And** any in-progress actions are cancelled

### AC3: Delegate Notification
**Given** a delegation is revoked
**When** revocation completes
**Then** the delegate receives email notification
**And** in-app notification appears

### AC4: Truth Chain Recording
**Given** I revoke a delegation
**When** revocation completes
**Then** `delegation.revoked` event is recorded on Truth Chain
**With** delegationId, revoked_reason, revoked_at

### AC5: Delegation History Preserved
**Given** a delegation is revoked
**When** I view delegation history
**Then** I see the full history including:
- When created, accepted, revoked
- Reason for revocation
- All delegate actions during active period

### AC6: Cancel Pending Invitation
**Given** I have a pending delegation (not yet accepted)
**When** I cancel the invitation
**Then** the delegation is deleted (not revoked)
**And** delegate receives cancellation notification

---

## Technical Implementation

### Service Functions

```typescript
// lib/delegation/delegation-service.ts

export async function revokeDelegation(
  trainerId: string,
  delegationId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Verify trainer owns the delegation
  // 2. Verify delegation is active
  // 3. Update status to 'revoked', set revokedAt, revokedReason
  // 4. Record to Truth Chain
  // 5. Send notification to delegate
  // 6. Return success
}

export async function cancelPendingDelegation(
  trainerId: string,
  delegationId: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Verify delegation is pending
  // 2. Delete the record
  // 3. Notify delegate (if they have account)
}
```

### API Endpoints

```typescript
// app/api/v1/delegations/[id]/route.ts

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { reason } = await req.json().catch(() => ({}));

  // Check delegation status
  const delegation = await getDelegation(params.id);

  if (delegation.status === 'pending') {
    return cancelPendingDelegation(userId, params.id);
  } else if (delegation.status === 'active') {
    return revokeDelegation(userId, params.id, reason);
  } else {
    return NextResponse.json({ error: 'Cannot revoke this delegation' }, { status: 400 });
  }
}
```

### Permission Check Update

```typescript
// lib/delegation/delegation-service.ts

export async function checkDelegatePermission(
  userId: string,
  agentId: string,
  permission: keyof DelegationPermissions
): Promise<boolean> {
  const delegation = await db.query.agentDelegates.findFirst({
    where: and(
      eq(agentDelegates.delegateId, userId),
      eq(agentDelegates.agentId, agentId),
      eq(agentDelegates.status, 'active'),
      // Check not expired
      or(
        isNull(agentDelegates.expiresAt),
        gt(agentDelegates.expiresAt, new Date())
      )
    )
  });

  if (!delegation) return false;

  return delegation.permissions[permission] ?? false;
}
```

### UI Components

```typescript
// components/delegation/RevokeDelegationDialog.tsx
interface Props {
  delegationId: string;
  delegateName: string;
  agentName: string;
  onRevoked: () => void;
}

export function RevokeDelegationDialog({
  delegationId,
  delegateName,
  agentName,
  onRevoked
}: Props) {
  const [reason, setReason] = useState('');
  const [isRevoking, setIsRevoking] = useState(false);

  const handleRevoke = async () => {
    setIsRevoking(true);
    await revokeDelegation(delegationId, reason);
    onRevoked();
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Revoke Delegation</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke Delegation?</AlertDialogTitle>
          <AlertDialogDescription>
            This will immediately remove {delegateName}'s access to {agentName}.
            They will be notified of the revocation.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Label htmlFor="reason">Reason (optional)</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you revoking this delegation?"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleRevoke} disabled={isRevoking}>
            {isRevoking ? 'Revoking...' : 'Revoke Delegation'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

---

## API Specification

### DELETE /api/v1/delegations/:id

**Request (optional body):**
```json
{
  "reason": "Delegate no longer needed"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "revoked",
    "revokedAt": "2025-12-09T...",
    "revokedReason": "Delegate no longer needed"
  }
}
```

**Errors:**
- 403: Not authorized to revoke this delegation
- 404: Delegation not found
- 400: Delegation already revoked/expired

---

## Testing Checklist

- [ ] Unit: revokeDelegation updates status correctly
- [ ] Unit: Permission check returns false after revocation
- [ ] Integration: Revoke flow end-to-end
- [ ] Integration: Delegate cannot access after revocation
- [ ] Integration: Truth Chain records revocation
- [ ] Integration: Notifications sent
- [ ] E2E: Trainer revokes via UI
- [ ] E2E: Cancel pending invitation

---

## Definition of Done

- [ ] Revoke endpoint implemented
- [ ] Cancel pending invitation implemented
- [ ] Immediate access removal verified
- [ ] Truth Chain integration working
- [ ] Notifications working
- [ ] RevokeDelegationDialog UI component
- [ ] Unit tests passing
- [ ] Code reviewed

---

*Story drafted: 2025-12-09*
*Epic: 12 - Maintenance Delegation*
