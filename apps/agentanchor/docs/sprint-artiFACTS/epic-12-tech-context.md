# Epic 12: Maintenance Delegation - Technical Context

**Epic:** Maintenance Delegation
**Goal:** Allow trainers to delegate agent maintenance while retaining ownership and earnings
**FRs Covered:** FR18-FR22
**Priority:** Growth Phase - Trainer UX Moat
**Generated:** 2025-12-09

---

## 1. Executive Summary

This epic enables Trainers to designate other users as maintenance delegates for their agents. Delegates can perform limited maintenance tasks (update system prompts, respond to feedback, view analytics) while the Trainer retains full ownership and earnings. All delegation activities are recorded on the Truth Chain for auditability.

---

## 2. Functional Requirements

### FR18: Trainers can designate maintenance delegate
- Trainer selects a user to become delegate for specific agent(s)
- Delegate must accept the delegation invitation
- One delegate per agent (can be same delegate for multiple agents)
- Trainer can designate themselves as delegate (no-op, but allowed)

### FR19: Delegate receives limited access
- **CAN:** Update agent system prompt
- **CAN:** Respond to consumer feedback
- **CAN:** View agent analytics and metrics
- **CANNOT:** Change pricing
- **CANNOT:** Transfer ownership
- **CANNOT:** Access earnings/payouts
- **CANNOT:** Publish/unpublish from marketplace
- **CANNOT:** Archive/retire agent

### FR20: Trainer retains ownership and earnings
- Ownership remains with original Trainer
- All earnings accrue to Trainer's account
- Trainer maintains full access to all features
- Delegation does not affect Trust Score attribution

### FR21: Trainers can revoke delegation at any time
- Instant revocation with no notice period
- Delegate loses access immediately
- Pending delegate actions are cancelled
- No penalty or cost to revoke

### FR22: Delegation history recorded on Truth Chain
- `delegation.created` - When delegation established
- `delegation.revoked` - When delegation revoked
- `delegation.action` - Each action taken by delegate
- Public verification of delegation history

---

## 3. Database Schema

### 3.1 New Table: `agent_delegates`

```sql
CREATE TABLE agent_delegates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parties
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES profiles(id),
  delegate_id UUID NOT NULL REFERENCES profiles(id),

  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, revoked, expired

  -- Permissions (explicit for audit)
  permissions JSONB NOT NULL DEFAULT '{
    "update_system_prompt": true,
    "respond_to_feedback": true,
    "view_analytics": true,
    "change_pricing": false,
    "transfer_ownership": false,
    "access_earnings": false,
    "publish_marketplace": false,
    "archive_agent": false
  }',

  -- Timestamps
  invited_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  expires_at TIMESTAMPTZ, -- Optional expiration

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  UNIQUE(agent_id, delegate_id, status), -- One active delegation per agent-delegate pair
  CONSTRAINT different_users CHECK (trainer_id != delegate_id)
);

CREATE INDEX idx_delegates_agent ON agent_delegates(agent_id);
CREATE INDEX idx_delegates_delegate ON agent_delegates(delegate_id);
CREATE INDEX idx_delegates_trainer ON agent_delegates(trainer_id);
CREATE INDEX idx_delegates_status ON agent_delegates(status) WHERE status = 'active';
```

### 3.2 New Table: `delegate_actions`

```sql
CREATE TABLE delegate_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference
  delegation_id UUID NOT NULL REFERENCES agent_delegates(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  delegate_id UUID NOT NULL REFERENCES profiles(id),

  -- Action Details
  action_type TEXT NOT NULL, -- 'update_prompt', 'respond_feedback', 'view_analytics'
  action_details JSONB NOT NULL,

  -- Previous State (for rollback)
  previous_state JSONB,

  -- Result
  success BOOLEAN NOT NULL,
  error_message TEXT,

  -- Truth Chain
  truth_chain_hash TEXT,

  -- Timestamp
  performed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_delegate_actions_delegation ON delegate_actions(delegation_id);
CREATE INDEX idx_delegate_actions_agent ON delegate_actions(agent_id);
CREATE INDEX idx_delegate_actions_time ON delegate_actions(performed_at DESC);
```

### 3.3 RLS Policies

```sql
-- Trainers can manage delegations for their agents
CREATE POLICY trainer_manage_delegations ON agent_delegates
  FOR ALL USING (trainer_id = auth.uid());

-- Delegates can view their own delegations
CREATE POLICY delegate_view_delegations ON agent_delegates
  FOR SELECT USING (delegate_id = auth.uid());

-- Delegates can update status (accept invitation)
CREATE POLICY delegate_accept ON agent_delegates
  FOR UPDATE USING (delegate_id = auth.uid() AND status = 'pending')
  WITH CHECK (status IN ('active', 'pending'));

-- Delegate actions viewable by trainer and delegate
CREATE POLICY view_delegate_actions ON delegate_actions
  FOR SELECT USING (
    delegate_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM agent_delegates ad
      WHERE ad.id = delegation_id AND ad.trainer_id = auth.uid()
    )
  );
```

---

## 4. Service Layer

### 4.1 New Service: `lib/delegation/delegation-service.ts`

```typescript
// Core Types
interface DelegationPermissions {
  update_system_prompt: boolean;
  respond_to_feedback: boolean;
  view_analytics: boolean;
  change_pricing: boolean;
  transfer_ownership: boolean;
  access_earnings: boolean;
  publish_marketplace: boolean;
  archive_agent: boolean;
}

interface CreateDelegationInput {
  agentId: string;
  delegateEmail: string; // or delegateId
  expiresAt?: Date;
  customPermissions?: Partial<DelegationPermissions>;
}

interface DelegationResult {
  success: boolean;
  delegationId?: string;
  error?: string;
}

// Service Functions
export async function createDelegation(
  trainerId: string,
  input: CreateDelegationInput
): Promise<DelegationResult>;

export async function acceptDelegation(
  delegateId: string,
  delegationId: string
): Promise<DelegationResult>;

export async function revokeDelegation(
  trainerId: string,
  delegationId: string,
  reason?: string
): Promise<DelegationResult>;

export async function getDelegationsForTrainer(
  trainerId: string
): Promise<Delegation[]>;

export async function getDelegationsForDelegate(
  delegateId: string
): Promise<Delegation[]>;

export async function getDelegationForAgent(
  agentId: string
): Promise<Delegation | null>;

export async function checkDelegatePermission(
  delegateId: string,
  agentId: string,
  permission: keyof DelegationPermissions
): Promise<boolean>;

export async function recordDelegateAction(
  delegationId: string,
  actionType: string,
  details: Record<string, unknown>,
  previousState?: Record<string, unknown>
): Promise<void>;
```

### 4.2 Integration with Existing Services

#### Agent Service Updates
```typescript
// lib/agents/trust-service.ts - Add delegate check
export async function updateAgentSystemPrompt(
  userId: string,
  agentId: string,
  newPrompt: string
): Promise<Result> {
  // Check if user is owner OR active delegate
  const isOwner = await isAgentOwner(userId, agentId);
  const hasPermission = await checkDelegatePermission(userId, agentId, 'update_system_prompt');

  if (!isOwner && !hasPermission) {
    throw new UnauthorizedError('Not authorized to update this agent');
  }

  // Record action if delegate
  if (!isOwner && hasPermission) {
    await recordDelegateAction(/* ... */);
  }

  // ... existing update logic
}
```

#### Feedback Service Updates
```typescript
// lib/marketplace/feedback-service.ts
export async function respondToFeedback(
  userId: string,
  feedbackId: string,
  response: string
): Promise<Result> {
  const feedback = await getFeedback(feedbackId);
  const agentId = feedback.agentId;

  const isOwner = await isAgentOwner(userId, agentId);
  const hasPermission = await checkDelegatePermission(userId, agentId, 'respond_to_feedback');

  if (!isOwner && !hasPermission) {
    throw new UnauthorizedError('Not authorized to respond to feedback');
  }

  // ... existing response logic
}
```

---

## 5. API Design

### 5.1 Endpoints

```
/api/v1/delegations
├── GET    /                      # List delegations (filtered by role)
├── POST   /                      # Create new delegation (trainer)
├── GET    /:id                   # Get delegation details
├── PATCH  /:id/accept            # Accept delegation (delegate)
├── DELETE /:id                   # Revoke delegation (trainer)
└── GET    /:id/actions           # Get delegate action history

/api/v1/agents/:agentId
└── GET    /delegation            # Get delegation for specific agent
```

### 5.2 Request/Response Examples

#### Create Delegation
```typescript
// POST /api/v1/delegations
{
  "agentId": "uuid",
  "delegateEmail": "delegate@example.com",
  "expiresAt": "2025-06-01T00:00:00Z" // optional
}

// Response
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "pending",
    "agent": { "id": "uuid", "name": "Agent Name" },
    "delegate": { "id": "uuid", "email": "delegate@example.com" },
    "invitedAt": "2025-12-09T...",
    "expiresAt": "2025-06-01T..."
  }
}
```

#### Accept Delegation
```typescript
// PATCH /api/v1/delegations/:id/accept
// No body required

// Response
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
    }
  }
}
```

---

## 6. UI Components

### 6.1 New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `DelegationManager` | `components/delegation/` | Main delegation management panel |
| `DelegateInviteForm` | `components/delegation/` | Form to invite delegate |
| `DelegationCard` | `components/delegation/` | Display delegation with actions |
| `DelegationBadge` | `components/delegation/` | Show delegate status on agent |
| `DelegateActionLog` | `components/delegation/` | Audit trail of delegate actions |

### 6.2 Page Updates

| Page | Change |
|------|--------|
| `/agents/[id]` | Add delegation section for trainers |
| `/agents/[id]` | Show delegate badge if delegate viewing |
| `/dashboard` | Add "Delegations" tab for trainers |
| `/dashboard` | Add "Delegated Agents" section for delegates |
| `/settings/delegations` | Manage all delegations |

### 6.3 Access Control UI

```typescript
// Hook for checking user role on agent
function useAgentAccess(agentId: string) {
  return {
    isOwner: boolean,
    isDelegate: boolean,
    permissions: DelegationPermissions | null,
    canEdit: boolean,
    canViewAnalytics: boolean,
    canRespondFeedback: boolean,
  };
}
```

---

## 7. Truth Chain Integration

### 7.1 New Event Types

```typescript
type DelegationTruthChainEvent =
  | 'delegation.created'
  | 'delegation.accepted'
  | 'delegation.revoked'
  | 'delegation.expired'
  | 'delegation.action';

interface DelegationTruthChainPayload {
  delegationId: string;
  agentId: string;
  trainerId: string;
  delegateId: string;
  action?: {
    type: string;
    details: Record<string, unknown>;
  };
  reason?: string;
}
```

### 7.2 Recording Events

```typescript
// When delegation is created
await truthChainService.recordEvent({
  type: 'delegation.created',
  actorId: trainerId,
  actorType: 'HUMAN',
  agentId: agentId,
  payload: { delegationId, delegateId }
});

// When delegate performs action
await truthChainService.recordEvent({
  type: 'delegation.action',
  actorId: delegateId,
  actorType: 'HUMAN',
  agentId: agentId,
  payload: {
    delegationId,
    action: { type: 'update_prompt', details: { ... } }
  }
});
```

---

## 8. Notification Integration

### 8.1 Notification Events

| Event | Recipients | Channel |
|-------|------------|---------|
| Delegation invite | Delegate | Email + In-app |
| Delegation accepted | Trainer | In-app |
| Delegation revoked | Delegate | Email + In-app |
| Delegate action | Trainer | In-app (configurable) |
| Delegation expiring | Both | Email |

---

## 9. Story Breakdown

### Story 12-1: Delegate Designation
- Database schema for `agent_delegates`
- `createDelegation` service function
- `POST /api/v1/delegations` endpoint
- `DelegateInviteForm` component
- Email notification to delegate
- Truth Chain: `delegation.created`

### Story 12-2: Delegate Permissions
- Permission checking functions
- Update agent service for delegate checks
- Update feedback service for delegate checks
- `delegate_actions` table and recording
- Delegate view of agent with limited UI

### Story 12-3: Delegation Revocation
- `revokeDelegation` service function
- `DELETE /api/v1/delegations/:id` endpoint
- UI to revoke from delegation manager
- Immediate access removal
- Truth Chain: `delegation.revoked`

### Story 12-4: Delegation Truth Chain
- All delegation events recorded
- `DelegateActionLog` component
- Public verification of delegation history
- Compliance export includes delegations

---

## 10. Testing Strategy

### Unit Tests
- Permission checking logic
- Delegation state transitions
- Action recording

### Integration Tests
- Full delegation flow (invite -> accept -> action -> revoke)
- Permission enforcement in APIs
- Truth Chain recording

### E2E Tests
- Trainer invites delegate
- Delegate accepts and edits agent
- Trainer revokes delegation

---

## 11. Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| Profiles table | Existing | Links to users |
| Agents table | Existing | The agents being delegated |
| Truth Chain service | Existing | For audit records |
| Notification service | Existing | For alerts |
| Feedback service | Existing | Needs delegate check |

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Delegate abuse | Full audit trail, instant revocation |
| Confusion about ownership | Clear UI badges, earnings always to trainer |
| Permission creep | Explicit permission list, no admin access |
| Stale delegations | Optional expiration, revocation reminder |

---

## 13. Implementation Order

1. **Story 12-1** - Foundation (schema, invite flow)
2. **Story 12-2** - Permissions (the core value)
3. **Story 12-4** - Truth Chain (audit trail)
4. **Story 12-3** - Revocation (cleanup)

---

*Epic 12 Tech Context generated by BMad Master*
*AgentAnchor Growth Phase - Trainer UX Moat*
