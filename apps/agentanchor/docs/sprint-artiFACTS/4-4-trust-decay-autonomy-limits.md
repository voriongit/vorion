# Story 4.4: Trust Decay & Autonomy Limits

Status: drafted

## Story

As a **Platform Operator**,
I want **inactive agents to experience trust decay and have autonomy limited by their tier**,
so that **trust remains meaningful and agents must stay active to maintain privileges**.

## Acceptance Criteria

1. **AC-4-4-1**: Agents inactive > 7 days begin trust decay ✅ DONE
2. **AC-4-4-2**: Decay rate: 1 point/day after threshold, max 5 points/day ✅ DONE
3. **AC-4-4-3**: Score floor at 10 (never decays to 0) ✅ DONE
4. **AC-4-4-4**: Drop >= 100 points triggers 30-day probation ✅ DONE
5. **AC-4-4-5**: `getAutonomyLimits()` returns tier-based permissions ✅ DONE
6. **AC-4-4-6**: Probation restricts all actions to human approval ✅ DONE
7. **AC-4-4-7**: Decay cron job scheduled and running daily
8. **AC-4-4-8**: UI shows last activity and decay warning

## Tasks / Subtasks

> **Note:** Backend implementation is COMPLETE. Needs cron job setup and UI warnings.

- [x] **Task 1: Decay service** (AC: 1-6) ✅ ALREADY DONE
  - [x] `lib/agents/decay-service.ts` - full implementation
  - [x] `shouldDecay()` - 7 day threshold check
  - [x] `calculateDecayAmount()` - decay calculation
  - [x] `applyDecayToAgent()` - apply with probation trigger
  - [x] `processDecayBatch()` - batch processing for all agents
  - [x] `getAutonomyLimits()` - tier-based permissions
  - [x] `checkProbationStatus()` - probation management

- [ ] **Task 2: Set up decay cron job** (AC: 7)
  - [ ] Create `app/api/cron/decay/route.ts`
  - [ ] Configure Vercel cron in `vercel.json`
  - [ ] Schedule daily at 00:00 UTC
  - [ ] Add authentication (cron secret)
  - [ ] Log results to Observer (when available)

- [ ] **Task 3: Create DecayWarning component** (AC: 8)
  - [ ] Create `components/agents/decay-warning.tsx`
  - [ ] Show warning banner when agent inactive > 5 days
  - [ ] Display "Last active X days ago"
  - [ ] Show decay countdown: "Decay starts in X days"
  - [ ] Provide "Mark Active" button to reset timer

- [ ] **Task 4: Create AutonomyLimitsDisplay component** (AC: 5, 6)
  - [ ] Create `components/agents/autonomy-limits-display.tsx`
  - [ ] Show current autonomy level based on tier
  - [ ] List what actions agent can perform autonomously
  - [ ] Highlight restrictions if on probation
  - [ ] Show "Probation ends in X days" countdown

- [ ] **Task 5: Add activity recording**
  - [ ] Call `recordActivity(agentId)` on agent interactions
  - [ ] Update last_activity_at on chat, task completion, etc.

- [ ] **Task 6: Testing**
  - [ ] Unit tests for decay calculation edge cases
  - [ ] Integration test for cron endpoint
  - [ ] Test probation trigger and end
  - [ ] Test autonomy limits for all tiers

## Dev Notes

### Backend Status: COMPLETE ✅

Full implementation in `lib/agents/decay-service.ts`:
- DECAY_CONFIG with all thresholds
- Complete decay processing pipeline
- Probation management
- Autonomy limits by tier

### Cron Job Setup (Vercel)

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/decay",
    "schedule": "0 0 * * *"
  }]
}
```

```typescript
// app/api/cron/decay/route.ts
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await processDecayBatch()
  return Response.json(result)
}
```

### References

- [Source: lib/agents/decay-service.ts] - Complete implementation
- [Source: docs/sprint-artiFACTS/tech-spec-epic-4.md#story-4-4]

## Dev Agent Record

### Completion Notes List

- Backend fully implemented in decay-service.ts
- Need: cron job, UI warnings, activity recording hooks

### File List

- lib/agents/decay-service.ts (EXISTS - no changes needed)
