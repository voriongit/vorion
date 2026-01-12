# Story 4.3: Trust Score History & Trends

Status: drafted

## Story

As a **Trainer**,
I want to **view my agent's trust score history and trends over time**,
so that I can **understand how my agent's credibility has evolved and identify patterns**.

## Acceptance Criteria

1. **AC-4-3-1**: `getTrustHistory()` returns paginated history entries ✅ DONE
2. **AC-4-3-2**: `getTrustTrend()` returns chart-ready data for visualization ✅ DONE
3. **AC-4-3-3**: Trust history timeline component shows chronological changes
4. **AC-4-3-4**: Trend chart shows score over time (30/60/90 day options)
5. **AC-4-3-5**: Filter history by change type (positive/negative/all)

## Tasks / Subtasks

> **Note:** Backend services are COMPLETE. This story focuses on UI components.

- [x] **Task 1: History service functions** (AC: 1-2) ✅ ALREADY DONE
  - [x] `getTrustHistory()` in trust-service.ts
  - [x] `getTrustTrend()` in trust-service.ts

- [ ] **Task 2: Create TrustHistoryTimeline component** (AC: 3, 5)
  - [ ] Create `components/agents/trust-history-timeline.tsx`
  - [ ] Display list of trust changes with icons, scores, and reasons
  - [ ] Color-code by positive (green) vs negative (red) changes
  - [ ] Show tier badges at tier transition points
  - [ ] Add filter dropdown: All / Positive / Negative
  - [ ] Paginate with "Load more" button

- [ ] **Task 3: Create TrustTrendChart component** (AC: 4)
  - [ ] Create `components/agents/trust-trend-chart.tsx`
  - [ ] Use Recharts for line chart visualization
  - [ ] X-axis: dates, Y-axis: score (0-1000)
  - [ ] Show tier threshold lines as horizontal guides
  - [ ] Time range selector: 30 / 60 / 90 days
  - [ ] Hover tooltip showing exact score and tier

- [ ] **Task 4: Create API endpoints**
  - [ ] `GET /api/agents/[id]/trust/history` - paginated history
  - [ ] `GET /api/agents/[id]/trust/trend?days=30` - chart data

- [ ] **Task 5: Integrate into agent detail page**
  - [ ] Add tabbed section: Overview | History | Trend
  - [ ] Or add collapsible sections below TrustScoreSection

- [ ] **Task 6: Testing**
  - [ ] Unit tests for timeline component
  - [ ] Unit tests for chart component
  - [ ] API endpoint tests with mock data

## Dev Notes

### Backend Status: COMPLETE ✅

Services in `lib/agents/trust-service.ts`:
- `getTrustHistory(agentId, limit, offset)` - paginated history
- `getTrustTrend(agentId, days)` - returns `{ date, score, tier }[]`

### UI Components Needed

```
components/agents/
├── trust-history-timeline.tsx  # NEW
├── trust-trend-chart.tsx       # NEW
└── ...
```

### Chart Library

Use Recharts (already in dependencies):
```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts'
```

### References

- [Source: lib/agents/trust-service.ts#getTrustHistory]
- [Source: lib/agents/trust-service.ts#getTrustTrend]
- [Source: docs/sprint-artiFACTS/tech-spec-epic-4.md#story-4-3]

## Dev Agent Record

### Completion Notes List

- Backend complete - getTrustHistory() and getTrustTrend() ready
- Need UI timeline and chart components

### File List

- lib/agents/trust-service.ts (EXISTS - no changes needed)
