# Story 5-2: Observer Dashboard Feed

**Epic:** 5 - Observer & Truth Chain
**Status:** Drafted
**Created:** 2025-12-03

---

## User Story

**As a** trainer or administrator
**I want** a real-time feed of platform events
**So that** I can monitor agent activity and system health

---

## Acceptance Criteria

- [ ] Observer dashboard page at `/dashboard/observer`
- [ ] Real-time event feed with WebSocket updates
- [ ] Filter events by source type (agent, council, academy, marketplace)
- [ ] Filter events by event type
- [ ] Filter events by risk level
- [ ] Paginated historical view with cursor-based pagination
- [ ] Event detail drawer/modal showing full payload
- [ ] Search events by action or payload content
- [ ] Export filtered events to CSV

---

## Technical Notes

### UI Components

```
components/observer/
├── ObserverFeed.tsx       # Main feed component
├── EventCard.tsx          # Individual event display
├── EventFilters.tsx       # Filter controls
├── EventDetail.tsx        # Full event detail view
└── LiveIndicator.tsx      # WebSocket connection status
```

### API Endpoints

```typescript
// GET /api/observer/feed
interface ObserverFeedParams {
  sourceType?: string;
  eventType?: string;
  riskLevel?: number;
  cursor?: string;
  limit?: number;
}

interface ObserverFeedResponse {
  events: ObserverEvent[];
  cursor: string | null;
  hasMore: boolean;
}
```

### WebSocket Implementation

- Use Server-Sent Events (SSE) for MVP simplicity
- `/api/observer/stream` - SSE endpoint for live events
- Reconnection logic with exponential backoff

### Files to Create/Modify

- `app/(dashboard)/observer/page.tsx` - Observer dashboard
- `components/observer/ObserverFeed.tsx` - Feed component
- `components/observer/EventCard.tsx` - Event display
- `components/observer/EventFilters.tsx` - Filters
- `app/api/observer/feed/route.ts` - Feed API
- `app/api/observer/stream/route.ts` - SSE endpoint

---

## Dependencies

- Story 5-1: Observer Event Logging (events must exist)
- Authentication (viewer must be authenticated)

---

## Out of Scope

- Push notifications for specific events
- Custom alert rules
- Anomaly highlighting (Story 5-3)
