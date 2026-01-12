# Story 6-2: Marketplace Browse & Search

**Epic:** 6 - Marketplace & Acquisition
**Status:** Drafted
**Created:** 2025-12-03

---

## User Story

**As a** consumer
**I want** to browse and search the agent marketplace
**So that** I can find agents that meet my needs

---

## Acceptance Criteria

- [ ] Public marketplace page at `/marketplace`
- [ ] Grid view of agent listings with cards
- [ ] Search by title, description, tags
- [ ] Filter by category
- [ ] Filter by trust tier (minimum tier)
- [ ] Sort by: newest, rating, acquisitions, trust score
- [ ] Pagination or infinite scroll
- [ ] Featured agents section
- [ ] Trust badge prominently displayed on cards

---

## Technical Notes

### API Endpoint

```typescript
// GET /api/marketplace/listings
interface MarketplaceSearchParams {
  q?: string;           // Search query
  category?: string;    // Category filter
  minTrustTier?: string; // Minimum trust tier
  sort?: 'newest' | 'rating' | 'popular' | 'trust';
  page?: number;
  limit?: number;
}

interface MarketplaceResponse {
  listings: ListingCard[];
  total: number;
  page: number;
  totalPages: number;
  featured?: ListingCard[];
}
```

### Listing Card Data

```typescript
interface ListingCard {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  agentId: string;
  agentName: string;
  trustScore: number;
  trustTier: string;
  averageRating: number;
  totalAcquisitions: number;
  trainerName: string;
  createdAt: string;
}
```

### UI Components

```
components/marketplace/
├── MarketplaceGrid.tsx      # Grid layout
├── ListingCard.tsx          # Agent card
├── SearchBar.tsx            # Search input
├── CategoryFilter.tsx       # Category chips
├── TrustFilter.tsx          # Trust tier selector
├── SortDropdown.tsx         # Sort options
└── FeaturedSection.tsx      # Featured carousel
```

### Files to Create/Modify

- `app/marketplace/page.tsx` - Marketplace page
- `components/marketplace/MarketplaceGrid.tsx` - Grid component
- `components/marketplace/ListingCard.tsx` - Card component
- `components/marketplace/SearchFilters.tsx` - Filter components
- `app/api/marketplace/listings/route.ts` - Search API (extend)

---

## Dependencies

- Story 6-1: Agent Publishing (listings must exist)
- Epic 4: Trust Score (for tier display)

---

## Out of Scope

- Agent detail page (Story 6-3)
- Acquisition flow (Story 6-4)
- Advanced search (boolean operators, date range)
