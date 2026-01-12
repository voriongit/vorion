# Story 12-2: Delegate Permissions

**Epic:** 12 - Maintenance Delegation
**Story ID:** 12-2
**Title:** Delegate Permissions
**Status:** drafted
**Priority:** High
**Estimated Effort:** Large (8-12 hours)

---

## User Story

**As a** Delegate,
**I want to** accept a delegation invitation and perform allowed maintenance tasks,
**So that** I can help maintain agents while respecting permission boundaries.

---

## Acceptance Criteria

### AC1: Accept Delegation
**Given** I am a user with a pending delegation invitation
**When** I click the accept link or navigate to my delegations
**Then** I see the delegation details and can accept
**And** acceptance updates status to 'active'
**And** I gain access to the agent per permissions

### AC2: Permission Enforcement - Update System Prompt
**Given** I am an active delegate for an agent
**When** I navigate to the agent's edit page
**Then** I can edit the system prompt
**And** my changes are saved with delegate attribution

### AC3: Permission Enforcement - Respond to Feedback
**Given** I am an active delegate for an agent
**When** I view consumer feedback on the agent
**Then** I can respond to feedback on behalf of the trainer
**And** response shows "Responded by [Delegate Name] (Delegate)"

### AC4: Permission Enforcement - View Analytics
**Given** I am an active delegate for an agent
**When** I navigate to the agent's analytics
**Then** I can view all analytics and metrics
**But** I cannot export earnings data

### AC5: Permission Denial - Pricing
**Given** I am an active delegate for an agent
**When** I try to change pricing settings
**Then** the pricing fields are disabled/hidden
**And** API returns 403 if attempted

### AC6: Permission Denial - Ownership/Earnings
**Given** I am an active delegate for an agent
**When** I view the agent dashboard
**Then** I cannot see earnings tab
**And** I cannot access transfer ownership
**And** I cannot publish/unpublish from marketplace
**And** I cannot archive the agent

### AC7: Delegate Actions Recorded
**Given** I perform any action as a delegate
**When** the action completes
**Then** it is recorded in `delegate_actions` table
**With** action_type, details, previous_state

### AC8: Delegate Badge Display
**Given** I am viewing an agent as a delegate
**When** the page loads
**Then** I see a badge "You are a delegate for this agent"
**And** I see my permission level

---

## Technical Implementation

### Database Migration

```sql
-- Migration: 20250611000000_delegate_actions.sql

CREATE TABLE delegate_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegation_id UUID NOT NULL REFERENCES agent_delegates(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  delegate_id UUID NOT NULL REFERENCES profiles(id),
  action_type TEXT NOT NULL,
  action_details JSONB NOT NULL,
  previous_state JSONB,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  truth_chain_hash TEXT,
  performed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_delegate_actions_delegation ON delegate_actions(delegation_id);
CREATE INDEX idx_delegate_actions_agent ON delegate_actions(agent_id);
CREATE INDEX idx_delegate_actions_time ON delegate_actions(performed_at DESC);

-- RLS
ALTER TABLE delegate_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY delegate_view_own ON delegate_actions
  FOR SELECT USING (delegate_id = auth.uid());

CREATE POLICY trainer_view_all ON delegate_actions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agent_delegates ad
      WHERE ad.id = delegation_id AND ad.trainer_id = auth.uid()
    )
  );
```

### Service Functions

```typescript
// lib/delegation/delegation-service.ts

export async function acceptDelegation(
  delegateId: string,
  delegationId: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Verify delegation exists and is pending
  // 2. Verify delegateId matches
  // 3. Update status to 'active', set acceptedAt
  // 4. Record to Truth Chain
  // 5. Notify trainer
}

export async function checkDelegatePermission(
  userId: string,
  agentId: string,
  permission: keyof DelegationPermissions
): Promise<boolean> {
  // 1. Find active delegation for user + agent
  // 2. Check permission in permissions JSONB
  // 3. Return boolean
}

export async function recordDelegateAction(
  delegationId: string,
  actionType: string,
  details: Record<string, unknown>,
  previousState?: Record<string, unknown>
): Promise<void> {
  // 1. Insert into delegate_actions
  // 2. Optionally record to Truth Chain
}
```

### Permission Checking Middleware

```typescript
// lib/delegation/permission-check.ts

export async function withDelegatePermission(
  userId: string,
  agentId: string,
  permission: keyof DelegationPermissions,
  action: () => Promise<unknown>
) {
  const isOwner = await isAgentOwner(userId, agentId);

  if (isOwner) {
    return action();
  }

  const hasPermission = await checkDelegatePermission(userId, agentId, permission);

  if (!hasPermission) {
    throw new ForbiddenError(`Permission denied: ${permission}`);
  }

  // Get delegation for action recording
  const delegation = await getDelegationForAgentAndUser(agentId, userId);

  // Execute and record
  const result = await action();

  await recordDelegateAction(delegation.id, permission, { result });

  return result;
}
```

### Integrate with Agent Service

```typescript
// lib/agents/trust-service.ts - Update

export async function updateAgentSystemPrompt(
  userId: string,
  agentId: string,
  newPrompt: string
) {
  return withDelegatePermission(
    userId,
    agentId,
    'update_system_prompt',
    async () => {
      const agent = await getAgent(agentId);
      const previousPrompt = agent.systemPrompt;

      await db.update(agents)
        .set({ systemPrompt: newPrompt, updatedAt: new Date() })
        .where(eq(agents.id, agentId));

      // Record previous state for delegate actions
      return { previousPrompt, newPrompt };
    }
  );
}
```

### UI Components

```typescript
// components/delegation/DelegateBadge.tsx
interface Props {
  agentId: string;
}

export function DelegateBadge({ agentId }: Props) {
  const { isDelegate, permissions } = useAgentAccess(agentId);

  if (!isDelegate) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
      <Badge variant="outline">Delegate Access</Badge>
      <p>You are a delegate for this agent</p>
      <p className="text-sm text-muted-foreground">
        Permissions: Edit prompt, Respond to feedback, View analytics
      </p>
    </div>
  );
}

// hooks/useAgentAccess.ts
export function useAgentAccess(agentId: string) {
  const { data } = useSWR(`/api/v1/agents/${agentId}/access`);

  return {
    isOwner: data?.isOwner ?? false,
    isDelegate: data?.isDelegate ?? false,
    permissions: data?.permissions ?? null,
    canEdit: data?.isOwner || data?.permissions?.update_system_prompt,
    canViewAnalytics: data?.isOwner || data?.permissions?.view_analytics,
    canRespondFeedback: data?.isOwner || data?.permissions?.respond_to_feedback,
    canChangePrice: data?.isOwner,
    canAccessEarnings: data?.isOwner,
  };
}
```

---

## API Specification

### PATCH /api/v1/delegations/:id/accept

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "active",
    "acceptedAt": "2025-12-09T...",
    "permissions": {
      "update_system_prompt": true,
      "respond_to_feedback": true,
      "view_analytics": true,
      "change_pricing": false,
      "transfer_ownership": false,
      "access_earnings": false,
      "publish_marketplace": false,
      "archive_agent": false
    },
    "agent": { "id": "uuid", "name": "Agent Name" }
  }
}
```

### GET /api/v1/agents/:agentId/access

**Response (200):**
```json
{
  "isOwner": false,
  "isDelegate": true,
  "permissions": {
    "update_system_prompt": true,
    "respond_to_feedback": true,
    "view_analytics": true,
    "change_pricing": false,
    "transfer_ownership": false,
    "access_earnings": false,
    "publish_marketplace": false,
    "archive_agent": false
  }
}
```

---

## Testing Checklist

- [ ] Unit: checkDelegatePermission returns correct values
- [ ] Unit: Permission denied for unauthorized actions
- [ ] Integration: Accept delegation flow
- [ ] Integration: Update prompt as delegate
- [ ] Integration: Respond to feedback as delegate
- [ ] Integration: Actions recorded in delegate_actions
- [ ] E2E: Delegate accepts invitation
- [ ] E2E: Delegate edits agent prompt
- [ ] E2E: Delegate cannot access earnings

---

## Definition of Done

- [ ] Accept delegation endpoint working
- [ ] Permission checking integrated into agent/feedback services
- [ ] delegate_actions table and recording working
- [ ] Delegate badge UI component
- [ ] All permissions properly enforced (allow + deny)
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Code reviewed

---

*Story drafted: 2025-12-09*
*Epic: 12 - Maintenance Delegation*
