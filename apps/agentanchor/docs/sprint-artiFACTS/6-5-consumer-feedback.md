# Story 6-5: Consumer Feedback

**Epic:** 6 - Marketplace & Acquisition
**Status:** Drafted
**Created:** 2025-12-03

---

## User Story

**As a** consumer
**I want** to rate and review agents I've acquired
**So that** other consumers can benefit from my experience

---

## Acceptance Criteria

- [ ] `reviews` table for consumer feedback
- [ ] Only consumers who acquired an agent can review it
- [ ] One review per consumer per listing
- [ ] Rating: 1-5 stars
- [ ] Optional review text (min 20 chars if provided)
- [ ] Review displayed on agent profile
- [ ] Average rating calculated and displayed
- [ ] Trainer can respond to reviews
- [ ] Edit/delete own review within 7 days

---

## Technical Notes

### Database Schema

```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES marketplace_listings(id),
  consumer_id UUID REFERENCES users(id),
  acquisition_id UUID REFERENCES acquisitions(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  trainer_response TEXT,
  trainer_responded_at TIMESTAMPTZ,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, consumer_id)
);

CREATE INDEX idx_reviews_listing ON reviews(listing_id);
```

### Rating Aggregation

```typescript
// Update listing average on review change
async function updateListingRating(listingId: string): Promise<void> {
  const stats = await db
    .select({
      avg: sql<number>`AVG(rating)`,
      count: sql<number>`COUNT(*)`
    })
    .from(reviews)
    .where(eq(reviews.listingId, listingId));

  await db
    .update(marketplaceListings)
    .set({
      averageRating: stats[0].avg,
      reviewCount: stats[0].count
    })
    .where(eq(marketplaceListings.id, listingId));
}
```

### UI Components

```
components/marketplace/
├── ReviewForm.tsx         # Submit review
├── ReviewCard.tsx         # Display review
├── ReviewList.tsx         # List of reviews
├── RatingStars.tsx        # Star rating display/input
├── TrainerResponse.tsx    # Trainer reply
└── HelpfulButton.tsx      # Mark as helpful
```

### Files to Create/Modify

- `lib/db/schema/reviews.ts` - Schema
- `lib/marketplace/review-service.ts` - Review logic
- `components/marketplace/ReviewForm.tsx` - Submit form
- `components/marketplace/ReviewCard.tsx` - Display
- `app/api/marketplace/reviews/route.ts` - Review API
- Update agent profile to show reviews

---

## Dependencies

- Story 6-4: Agent Acquisition (must have acquired to review)
- Story 6-3: Agent Profile (display location)

---

## Out of Scope

- Review verification/fraud detection
- Image attachments
- Video reviews
- Review disputes
