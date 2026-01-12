# Story 12-1: Delegate Designation

**Epic:** 12 - Maintenance Delegation
**Story ID:** 12-1
**Title:** Delegate Designation
**Status:** drafted
**Priority:** High
**Estimated Effort:** Medium (5-8 hours)

---

## User Story

**As a** Trainer,
**I want to** designate another user as a maintenance delegate for my agent,
**So that** I can have help maintaining my agent while retaining ownership and earnings.

---

## Acceptance Criteria

### AC1: Database Schema
**Given** the platform database
**When** migrations run
**Then** `agent_delegates` table exists with columns:
- id, agent_id, trainer_id, delegate_id
- status (pending, active, revoked, expired)
- permissions (JSONB)
- invited_at, accepted_at, revoked_at, expires_at
- RLS policies for trainer and delegate access

### AC2: Invite Delegate Form
**Given** I am a Trainer viewing my agent
**When** I click "Manage Delegation" or "Invite Delegate"
**Then** I see a form to enter delegate email
**And** I can optionally set an expiration date
**And** form validates email exists in platform

### AC3: Send Invitation
**Given** I complete the invite delegate form
**When** I submit the form
**Then** a delegation record is created with status='pending'
**And** delegate receives email notification with accept link
**And** I see "Invitation Sent" confirmation

### AC4: Delegation Status Display
**Given** I have sent a delegation invitation
**When** I view my agent or delegation settings
**Then** I see the pending delegation with delegate email
**And** I can cancel the pending invitation

### AC5: Prevent Duplicate Delegations
**Given** my agent already has an active delegation
**When** I try to invite another delegate
**Then** I see error "This agent already has an active delegate"
**And** I must revoke existing delegation first

### AC6: Truth Chain Recording
**Given** I successfully create a delegation
**When** the invitation is sent
**Then** `delegation.created` event is recorded on Truth Chain
**With** agent_id, trainer_id, delegate_id, invited_at

---

## Technical Implementation

### Database Migration

```sql
-- Migration: 20250610000000_agent_delegates.sql

CREATE TABLE agent_delegates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES profiles(id),
  delegate_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'revoked', 'expired')),
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
  invited_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT different_users CHECK (trainer_id != delegate_id)
);

CREATE UNIQUE INDEX idx_delegates_agent_active
  ON agent_delegates(agent_id)
  WHERE status = 'active';

CREATE INDEX idx_delegates_agent ON agent_delegates(agent_id);
CREATE INDEX idx_delegates_delegate ON agent_delegates(delegate_id);
CREATE INDEX idx_delegates_trainer ON agent_delegates(trainer_id);

-- RLS
ALTER TABLE agent_delegates ENABLE ROW LEVEL SECURITY;

CREATE POLICY trainer_manage ON agent_delegates
  FOR ALL USING (trainer_id = auth.uid());

CREATE POLICY delegate_view ON agent_delegates
  FOR SELECT USING (delegate_id = auth.uid());
```

### Drizzle Schema

```typescript
// lib/db/schema/delegation.ts
import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { profiles } from './users';
import { agents } from './agents';

export const agentDelegates = pgTable('agent_delegates', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  trainerId: uuid('trainer_id').notNull().references(() => profiles.id),
  delegateId: uuid('delegate_id').notNull().references(() => profiles.id),
  status: text('status').notNull().default('pending'),
  permissions: jsonb('permissions').$type<DelegationPermissions>().notNull().default(DEFAULT_PERMISSIONS),
  invitedAt: timestamp('invited_at', { withTimezone: true }).defaultNow().notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedReason: text('revoked_reason'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  agentIdx: index('idx_delegates_agent').on(table.agentId),
  delegateIdx: index('idx_delegates_delegate').on(table.delegateId),
  trainerIdx: index('idx_delegates_trainer').on(table.trainerId),
}));
```

### Service Functions

```typescript
// lib/delegation/delegation-service.ts
export async function createDelegation(
  trainerId: string,
  input: { agentId: string; delegateEmail: string; expiresAt?: Date }
): Promise<{ success: boolean; delegationId?: string; error?: string }> {
  // 1. Verify trainer owns agent
  // 2. Find delegate by email
  // 3. Check no active delegation exists
  // 4. Create delegation record
  // 5. Send email notification
  // 6. Record to Truth Chain
  // 7. Return result
}

export async function cancelPendingDelegation(
  trainerId: string,
  delegationId: string
): Promise<{ success: boolean; error?: string }> {
  // Cancel pending invitation
}
```

### API Endpoint

```typescript
// app/api/v1/delegations/route.ts
export async function POST(req: Request) {
  // Create delegation
}

export async function GET(req: Request) {
  // List delegations for authenticated user
}
```

### UI Components

```typescript
// components/delegation/DelegateInviteForm.tsx
interface Props {
  agentId: string;
  onSuccess: () => void;
}

// components/delegation/DelegationCard.tsx
interface Props {
  delegation: Delegation;
  onCancel?: () => void;
  onRevoke?: () => void;
}
```

---

## API Specification

### POST /api/v1/delegations

**Request:**
```json
{
  "agentId": "uuid",
  "delegateEmail": "delegate@example.com",
  "expiresAt": "2025-06-01T00:00:00Z"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "pending",
    "agent": { "id": "uuid", "name": "Agent Name" },
    "delegate": { "id": "uuid", "email": "delegate@example.com", "name": "Delegate Name" },
    "invitedAt": "2025-12-09T...",
    "expiresAt": "2025-06-01T00:00:00Z"
  }
}
```

**Errors:**
- 400: Agent already has active delegate
- 400: Cannot delegate to yourself
- 404: Agent not found or not owned by you
- 404: Delegate email not found in platform

---

## Dependencies

- Profiles table (existing)
- Agents table (existing)
- Truth Chain service (existing)
- Notification service (existing)
- Email service (existing)

---

## Testing Checklist

- [ ] Unit: createDelegation validates ownership
- [ ] Unit: createDelegation prevents duplicate active delegations
- [ ] Unit: createDelegation prevents self-delegation
- [ ] Integration: Full invite flow (create -> email sent -> record in DB)
- [ ] Integration: Truth Chain records delegation.created
- [ ] E2E: Trainer invites delegate via UI
- [ ] E2E: Cancel pending invitation

---

## Definition of Done

- [ ] Database migration applied
- [ ] Drizzle schema updated
- [ ] API endpoint implemented and tested
- [ ] UI components created
- [ ] Email notification working
- [ ] Truth Chain integration working
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Code reviewed
- [ ] Documented in API docs

---

*Story drafted: 2025-12-09*
*Epic: 12 - Maintenance Delegation*
