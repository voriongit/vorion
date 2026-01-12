# Story 4-3: Trust Score History & Trends

## Status: COMPLETE

## Overview
Implemented UI components for viewing trust score history and trends, fulfilling FR55 (users can view score history).

## Acceptance Criteria
- [x] Timeline view of all trust score changes (FR55)
- [x] Chart showing trust score trends over time
- [x] Each entry shows date, change amount, reason, new score
- [x] Dedicated trust history page per agent
- [x] Toggle between chart and timeline views
- [x] Configurable time ranges (7/30/90/365 days)

## Implementation

### Components Created

#### 1. `components/agents/TrustHistoryChart.tsx`
SVG-based line chart component:
- Displays trust score trend over configurable time period
- Color-coded by trust tier thresholds
- Shows tier threshold lines as reference
- Gradient fill under the line
- Data points colored by tier at that moment
- Change indicator showing net change over period
- Legend with tier color codes

#### 2. `components/agents/TrustHistoryTimeline.tsx`
Timeline list component:
- Expandable entries with detailed information
- Visual timeline with connecting lines
- Change indicators (up/down arrows with color)
- Source event labels
- Relative time formatting (e.g., "2h ago", "3d ago")
- Pagination support with "Load More"
- Click to expand for full metadata view

#### 3. `components/agents/TrustHistorySection.tsx`
Container component managing both views:
- Toggle between chart and timeline views
- Days selector for chart view (7/30/90/365)
- Refresh button
- Loading and error states
- Fetches data from trust API endpoints

### Pages Created

#### `app/(dashboard)/agents/[id]/trust/page.tsx`
Dedicated trust history page:
- Agent header with current trust badge
- Full TrustHistorySection integration
- Breadcrumb navigation back to agent

### API Integration
Uses the API endpoints from Story 4-2:
- `GET /api/agents/[id]/trust` - Paginated history entries
- `GET /api/agents/[id]/trust?trend=true&days=N` - Trend data for charts

## UI Features

### Chart View
- SVG-based (no external charting library)
- Responsive sizing
- Tier threshold reference lines
- Gradient area fill
- Interactive data points
- Y-axis shows score range
- X-axis shows date range

### Timeline View
- Visual timeline with node indicators
- Green/red indicators for positive/negative changes
- Expandable entries showing:
  - Previous score
  - New score
  - Source event type
  - Full reason text
  - Metadata (if present)
- Pagination with offset-based loading

### Trust Tier Colors
- Untrusted (0-199): Red
- Novice (200-399): Green
- Proven (400-599): Blue
- Trusted (600-799): Purple
- Elite (800-899): Amber
- Legendary (900-1000): Pink

## Dependencies
- Story 4-2: Trust Score Changes (provides API)
- Story 4-1: Trust Score Display (provides TrustBadge)

## Next Steps
- Story 4-4: Trust Decay & Autonomy Limits
