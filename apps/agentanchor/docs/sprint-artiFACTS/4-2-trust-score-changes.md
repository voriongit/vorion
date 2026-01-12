# Story 4.2: Trust Score Changes

Status: drafted

## Story

As a **Trainer**,
I want **trust score changes to be applied automatically based on agent events and displayed in real-time**,
so that I can **see my agent's credibility evolve based on its behavior**.

## Acceptance Criteria

1. **AC-4-2-1**: `applyTrustChange()` increases score for positive events (task success, approvals, feedback) ✅ DONE
2. **AC-4-2-2**: `applyTrustChange()` decreases score for negative events (denials, complaints, violations) ✅ DONE
3. **AC-4-2-3**: Score clamped to 0-1000 range on all changes ✅ DONE
4. **AC-4-2-4**: Tier automatically recalculated when score crosses tier boundary ✅ DONE
5. **AC-4-2-5**: Every change recorded in trust_history with reason and source ✅ DONE
6. **AC-4-2-6**: UI shows toast notification when trust score changes

## Tasks / Subtasks

> **Note:** Backend implementation is COMPLETE. This story focuses on UI integration and testing.

- [x] **Task 1: Trust change service** (AC: 1-5) ✅ ALREADY DONE
  - [x] `lib/agents/trust-service.ts` - applyTrustChange()
  - [x] TRUST_IMPACTS constant with all change types
  - [x] Score clamping and tier recalculation
  - [x] History recording

- [ ] **Task 2: Trust change toast notifications** (AC: 6)
  - [ ] Create `hooks/use-trust-notifications.ts`
  - [ ] Subscribe to trust change events (Supabase realtime or polling)
  - [ ] Show toast with score change (+/- X points, reason)
  - [ ] Different toast styles for positive (green) vs negative (red) changes
  - [ ] Animate tier change with special celebration/warning toast

- [ ] **Task 3: Wire trust changes to existing events**
  - [ ] Council decisions → trigger trust change
  - [ ] Academy completion → trigger trust change
  - [ ] Task completion → trigger trust change (when task system exists)

- [ ] **Task 4: Testing**
  - [ ] Unit tests for all TRUST_IMPACTS values
  - [ ] Integration test for score boundary conditions (0, 1000)
  - [ ] Integration test for tier transitions
  - [ ] Test toast notification triggers

## Dev Notes

### Backend Status: COMPLETE ✅

All backend logic implemented in `lib/agents/trust-service.ts`:
- `applyTrustChange()` - main entry point
- `TRUST_IMPACTS` - predefined change amounts
- `calculateCouncilDecisionImpact()` - Council-specific logic
- `canPerformAction()` - tier-based permission check

### Remaining Work

Only UI toast notifications needed. Consider using:
- `sonner` or `react-hot-toast` for toasts
- Supabase realtime subscriptions for live updates
- Or polling trust_history for recent changes

### References

- [Source: lib/agents/trust-service.ts] - Complete implementation
- [Source: docs/sprint-artiFACTS/tech-spec-epic-4.md#apis-and-interfaces]

## Dev Agent Record

### Completion Notes List

- Backend fully implemented - see lib/agents/trust-service.ts
- Only UI toast notifications remain

### File List

- lib/agents/trust-service.ts (EXISTS - no changes needed)
