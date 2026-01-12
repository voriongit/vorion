# Story 6-1: Agent Publishing

**Epic:** 6 - Marketplace & Acquisition
**Status:** Drafted
**Created:** 2025-12-03

---

## User Story

**As a** trainer
**I want** to publish my graduated agents to the marketplace
**So that** consumers can discover and acquire them

---

## Acceptance Criteria

- [ ] `marketplace_listings` table created
- [ ] Only graduated agents can be published
- [ ] Trainer can set: title, description, category, tags, commission rate
- [ ] Publish agent form at `/dashboard/trainer/agents/[id]/publish`
- [ ] Listing preview before publish
- [ ] Published status shown on agent card
- [ ] Trainer can unpublish/pause listing
- [ ] Commission rate tiers: 15% (starter), 10% (verified), 7% (legendary)

---

## Technical Notes

### Database Schema

```sql
CREATE TABLE marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES bots(id) UNIQUE,
  trainer_id UUID REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  tags TEXT[],
  commission_rate DECIMAL(5,2) NOT NULL,
  base_rate DECIMAL(10,4),
  status VARCHAR(20) DEFAULT 'active', -- active, paused, removed
  total_acquisitions INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2),
  featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_listings_category ON marketplace_listings(category);
CREATE INDEX idx_listings_status ON marketplace_listings(status);
```

### Commission Tiers

| Trust Tier | Platform Commission | Trainer Keeps |
|------------|--------------------:|-------------:|
| Untrusted/Cautionary | Not eligible | - |
| Starter (300+) | 15% | 85% |
| Verified (500+) | 10% | 90% |
| Trusted (650+) | 10% | 90% |
| Elite (800+) | 7% | 93% |
| Legendary (950+) | 7% | 93% |

### Categories

- `assistant` - General assistants
- `coding` - Development agents
- `writing` - Content creation
- `analysis` - Data analysis
- `support` - Customer support
- `creative` - Creative tasks
- `other` - Miscellaneous

### Files to Create/Modify

- `lib/db/schema/marketplace.ts` - Schema definitions
- `lib/marketplace/listing-service.ts` - Publishing service
- `app/(dashboard)/trainer/agents/[id]/publish/page.tsx` - Publish form
- `components/marketplace/PublishForm.tsx` - Form component
- `components/marketplace/ListingPreview.tsx` - Preview component
- `app/api/marketplace/listings/route.ts` - Listing API

---

## Dependencies

- Epic 2: Agent graduation (only graduated agents)
- Epic 4: Trust score (commission tier calculation)

---

## Out of Scope

- Marketplace browse UI (Story 6-2)
- Acquisition flow (Story 6-4)
- Pricing tiers beyond commission
