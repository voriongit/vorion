# Story 4.1: Trust Score Display & Tiers

Status: drafted

## Story

As a **Trainer or Consumer**,
I want to **see an agent's trust score and tier displayed prominently with visual indicators**,
so that I can **quickly understand the agent's credibility and autonomy level**.

## Acceptance Criteria

1. **AC-4-1-1**: Trust badge component displays score (0-1000) and tier icon with appropriate styling
2. **AC-4-1-2**: Badge color matches tier definition (gray=untrusted, yellow=novice, blue=proven, green=trusted, purple=elite, gold=legendary)
3. **AC-4-1-3**: Agent detail page shows prominent trust score section with score, tier badge, and autonomy description
4. **AC-4-1-4**: Dashboard agent cards display trust tier badge for all user's agents
5. **AC-4-1-5**: Tier label and autonomy description visible on hover/click interaction
6. **AC-4-1-6**: Probation indicator shown when agent is on probation (is_on_probation = true)

## Tasks / Subtasks

- [ ] **Task 1: Create TrustBadge component** (AC: 1, 2)
  - [ ] Create `components/agents/trust-badge.tsx` with score and tier props
  - [ ] Implement tier color mapping from TRUST_TIERS constant
  - [ ] Add tier icons (⚠️🌱✅🛡️👑🌟) based on tier
  - [ ] Support size variants: sm (for cards), md (default), lg (for detail page)
  - [ ] Add unit tests for badge rendering at each tier

- [ ] **Task 2: Create TrustScoreSection component** (AC: 3, 5)
  - [ ] Create `components/agents/trust-score-section.tsx` for agent detail page
  - [ ] Display large score number with tier badge
  - [ ] Show tier name and autonomy level description
  - [ ] Add progress bar showing score within current tier range
  - [ ] Include tooltip/popover with full tier autonomy explanation
  - [ ] Display "Next tier at X points" progress indicator

- [ ] **Task 3: Create ProbationIndicator component** (AC: 6)
  - [ ] Create `components/agents/probation-indicator.tsx`
  - [ ] Show warning styling (orange/red) when is_on_probation = true
  - [ ] Display days remaining in probation period
  - [ ] Add explanation tooltip for probation restrictions

- [ ] **Task 4: Integrate TrustBadge into agent cards** (AC: 4)
  - [ ] Update `components/agents/agent-card.tsx` to include TrustBadge
  - [ ] Position badge prominently on card (top-right or below name)
  - [ ] Ensure badge works in both grid and list views

- [ ] **Task 5: Integrate TrustScoreSection into agent detail page** (AC: 3)
  - [ ] Update `app/(dashboard)/agents/[id]/page.tsx`
  - [ ] Add TrustScoreSection below agent header
  - [ ] Conditionally show ProbationIndicator if on probation
  - [ ] Fetch trust data from agent record

- [ ] **Task 6: Create API endpoint for trust data** (AC: all)
  - [ ] Create `app/api/agents/[id]/trust/route.ts`
  - [ ] Return: score, tier, tierInfo, autonomyLevel, isOnProbation, probationDaysRemaining
  - [ ] Use existing `getAutonomyLimits()` from decay-service

- [ ] **Task 7: Testing**
  - [ ] Unit tests for TrustBadge at all 6 tier levels
  - [ ] Unit tests for TrustScoreSection with various scores
  - [ ] Unit tests for ProbationIndicator
  - [ ] Integration test for trust API endpoint
  - [ ] Visual regression tests for badge colors

## Dev Notes

### Architecture & Patterns

The trust system backend is already fully implemented:
- `lib/agents/types.ts` - TRUST_TIERS constant with tier definitions
- `lib/agents/trust-service.ts` - Trust change application and history
- `lib/agents/decay-service.ts` - Autonomy limits via `getAutonomyLimits()`

This story focuses purely on **UI components** to display the existing trust data.

### Component Structure

```
components/agents/
├── trust-badge.tsx          # NEW - Tier badge with icon/color
├── trust-score-section.tsx  # NEW - Full trust display for detail page
├── probation-indicator.tsx  # NEW - Probation warning
├── agent-card.tsx           # MODIFY - Add TrustBadge
└── ...
```

### Tier Visual Mapping

| Tier | Score | Color | Icon | Tailwind Class |
|------|-------|-------|------|----------------|
| Untrusted | 0-199 | Gray | ⚠️ | `bg-gray-500` |
| Novice | 200-399 | Yellow | 🌱 | `bg-yellow-500` |
| Proven | 400-599 | Blue | ✅ | `bg-blue-500` |
| Trusted | 600-799 | Green | 🛡️ | `bg-green-500` |
| Elite | 800-899 | Purple | 👑 | `bg-purple-500` |
| Legendary | 900-1000 | Gold | 🌟 | `bg-amber-500` |

### References

- [Source: docs/sprint-artiFACTS/tech-spec-epic-4.md#acceptance-criteria]
- [Source: docs/prd.md#trust-score-system] - FR50, FR53, FR54
- [Source: docs/architecture.md#trust-score] - Trust tier definitions
- [Source: lib/agents/types.ts] - TRUST_TIERS constant
- [Source: lib/agents/decay-service.ts#getAutonomyLimits] - Autonomy calculation

### Project Structure Notes

- Components follow existing pattern in `components/agents/`
- Use shadcn/ui base components (Badge, Tooltip, Progress)
- Follow existing Tailwind patterns from other agent components
- API route follows existing pattern in `app/api/agents/[id]/`

### Testing Standards

- Unit tests with Vitest in `__tests__/` adjacent to components
- Use React Testing Library for component tests
- Mock Supabase client for API tests

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

<!-- Will be filled by dev agent -->

### Debug Log References

<!-- Dev agent will add debug references here -->

### Completion Notes List

<!-- Dev agent will add completion notes here -->

### File List

<!-- Dev agent will track files here -->
