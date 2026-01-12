# Story 6-3: Agent Profile & Observer Reports

**Epic:** 6 - Marketplace & Acquisition
**Status:** Drafted
**Created:** 2025-12-03

---

## User Story

**As a** consumer
**I want** to view detailed agent profiles with trust history and observer reports
**So that** I can make informed acquisition decisions

---

## Acceptance Criteria

- [ ] Agent profile page at `/marketplace/[listingId]`
- [ ] Hero section with agent name, trust badge, trainer info
- [ ] Description and capabilities section
- [ ] Trust score chart showing history
- [ ] Observer activity summary (event counts by type)
- [ ] Recent council decisions affecting agent
- [ ] Consumer reviews section
- [ ] Acquire/contact trainer CTA
- [ ] Share button for social sharing

---

## Technical Notes

### Page Sections

```
/marketplace/[listingId]/page.tsx
├── Hero (name, trust badge, trainer)
├── Description & capabilities
├── Trust Section
│   ├── Current score & tier
│   ├── Trust history chart
│   └── Recent trust changes
├── Observer Report
│   ├── Event summary stats
│   ├── Recent significant events
│   └── Anomaly count (if any)
├── Council History
│   ├── Recent decisions
│   └── Compliance rate
├── Reviews
│   ├── Average rating
│   └── Review list
└── CTA Section
    ├── Acquire button
    └── Contact trainer
```

### API Endpoint

```typescript
// GET /api/marketplace/listings/:id/profile
interface AgentProfileResponse {
  listing: MarketplaceListing;
  agent: {
    id: string;
    name: string;
    trustScore: number;
    trustTier: string;
    capabilities: string[];
  };
  trainer: {
    id: string;
    name: string;
    totalAgents: number;
    averageRating: number;
  };
  trustHistory: TrustChange[];
  observerSummary: {
    totalEvents: number;
    eventsByType: Record<string, number>;
    anomalyCount: number;
  };
  councilHistory: CouncilDecision[];
  reviews: Review[];
}
```

### Files to Create/Modify

- `app/marketplace/[id]/page.tsx` - Profile page
- `components/marketplace/AgentHero.tsx` - Hero section
- `components/marketplace/TrustSection.tsx` - Trust display
- `components/marketplace/ObserverReport.tsx` - Observer summary
- `components/marketplace/CouncilHistory.tsx` - Council decisions
- `components/marketplace/ReviewSection.tsx` - Reviews
- `app/api/marketplace/listings/[id]/profile/route.ts` - Profile API

---

## Dependencies

- Story 6-1: Agent Publishing
- Story 6-2: Marketplace Browse
- Epic 4: Trust Score history
- Epic 5: Observer events (optional - graceful degradation if not complete)

---

## Out of Scope

- Full observer event feed (available in Story 5-2)
- Acquisition flow (Story 6-4)
- Review submission (Story 6-5)
