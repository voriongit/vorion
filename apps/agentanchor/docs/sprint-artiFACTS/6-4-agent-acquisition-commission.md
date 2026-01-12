# Story 6-4: Agent Acquisition (Commission)

**Epic:** 6 - Marketplace & Acquisition
**Status:** Drafted
**Created:** 2025-12-03

---

## User Story

**As a** consumer
**I want** to acquire agents through the marketplace
**So that** I can use trusted agents for my tasks

---

## Acceptance Criteria

- [ ] `acquisitions` table tracking all acquisitions
- [ ] Acquire button on agent profile page
- [ ] Acquisition confirmation modal with terms
- [ ] Commission calculated based on trainer's trust tier
- [ ] Acquisition recorded to truth chain (ownership transfer)
- [ ] Consumer sees acquired agents in dashboard
- [ ] Trainer notified of new acquisition
- [ ] Acquisition types: commission (usage-based), clone, enterprise

---

## Technical Notes

### Database Schema

```sql
CREATE TABLE acquisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES marketplace_listings(id),
  consumer_id UUID REFERENCES users(id),
  agent_id UUID REFERENCES bots(id),
  acquisition_type VARCHAR(20) NOT NULL, -- 'commission', 'clone', 'enterprise'
  status VARCHAR(20) DEFAULT 'active', -- active, paused, revoked
  commission_rate DECIMAL(5,2) NOT NULL,
  usage_count INTEGER DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_acquisitions_consumer ON acquisitions(consumer_id);
CREATE INDEX idx_acquisitions_agent ON acquisitions(agent_id);
```

### Acquisition Types

| Type | Description | Billing |
|------|-------------|---------|
| Commission | Usage-based access | Per-use fee + commission |
| Clone | Full copy of agent | One-time fee |
| Enterprise | Dedicated instance | Custom contract |

### Acquisition Flow

1. Consumer clicks "Acquire" on agent profile
2. Modal shows: commission rate, terms, acquisition type options
3. Consumer confirms acquisition
4. System creates acquisition record
5. Truth chain records ownership event
6. Consumer redirected to their agent dashboard
7. Trainer receives notification

### Files to Create/Modify

- `lib/db/schema/acquisitions.ts` - Schema
- `lib/marketplace/acquisition-service.ts` - Acquisition logic
- `components/marketplace/AcquireModal.tsx` - Confirmation modal
- `app/api/marketplace/acquire/route.ts` - Acquisition API
- `app/(dashboard)/consumer/agents/page.tsx` - Consumer's agents
- Integrate with truth chain (Story 5-4)

---

## Dependencies

- Story 6-1: Agent Publishing
- Story 6-3: Agent Profile
- Story 5-4: Truth Chain (for ownership recording)
- Epic 7: Notifications (for trainer notification)

---

## Out of Scope

- Payment processing (future - MVP tracks but doesn't charge)
- Clone implementation details
- Enterprise contracts
- Refunds/revocations workflow
