# Epic Technical Specification: Trust Score System

Date: 2025-12-03
Author: frank the tank
Epic ID: 4
Status: Draft

---

## Overview

Epic 4 implements the Trust Score System - the mechanism by which AI agents earn trust through demonstrated behavior. Unlike traditional permission-based systems where trust is granted, AgentAnchor agents earn trust scores (0-1000) through successful task completion, Council approvals, and positive user feedback, while losing trust through denials, complaints, and inactivity decay.

This epic is critical to AgentAnchor's core value proposition: "Trust isn't assumed — it's earned, proven, and verified."

## Objectives and Scope

### In Scope

- **Story 4-1**: Trust Score Display & Tiers - Visual representation of trust scores with tier badges
- **Story 4-2**: Trust Score Changes - Applying score changes based on events (already implemented)
- **Story 4-3**: Trust Score History & Trends - Historical tracking and visualization (services implemented)
- **Story 4-4**: Trust Decay & Autonomy Limits - Inactivity decay and tier-based permissions (already implemented)

### Out of Scope

- Council integration (covered in Epic 3)
- Academy graduation trust initialization (covered in Epic 2)
- Marketplace trust display (covered in Epic 6)
- Public verification of trust scores (covered in Epic 5)

## System Architecture Alignment

The Trust Score System aligns with the Seven-Layer Governance Architecture:

| Layer | Trust Score Interaction |
|-------|------------------------|
| Layer 7: Workers | Agents have trust scores that determine autonomy |
| Layer 5: Truth Chain | Tier changes recorded as trust.milestone events |
| Layer 4: Academy | Graduation initializes trust score (200-399 Novice) |
| Layer 3: Council | Decisions affect trust scores (+/- points) |
| Layer 1: Human | Can override/adjust trust via admin |

**Key Architectural Constraint:** Trust score changes must be atomic and recorded to trust_history for audit compliance.

## Detailed Design

### Services and Modules

| Service | File | Responsibility | Status |
|---------|------|----------------|--------|
| Trust Service | `lib/agents/trust-service.ts` | Apply trust changes, get history | ✅ Implemented |
| Decay Service | `lib/agents/decay-service.ts` | Process inactivity decay, autonomy limits | ✅ Implemented |
| Trust Types | `lib/agents/types.ts` | Type definitions, tier constants | ✅ Implemented |
| Trust API | `app/api/agents/[id]/trust/route.ts` | REST endpoints for trust operations | 🔲 Needed |
| Trust Components | `components/agents/trust-*.tsx` | UI components for trust display | 🔲 Needed |

### Data Models and Contracts

**Existing Tables (Supabase):**

```sql
-- bots table (existing)
ALTER TABLE bots ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 0;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS trust_tier VARCHAR(20) DEFAULT 'untrusted';
ALTER TABLE bots ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS is_on_probation BOOLEAN DEFAULT FALSE;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS probation_started_at TIMESTAMPTZ;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS probation_ended_at TIMESTAMPTZ;

-- trust_history table (existing)
CREATE TABLE IF NOT EXISTS trust_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES bots(id) NOT NULL,
  previous_score INTEGER,
  score INTEGER NOT NULL,
  change_amount INTEGER,
  tier VARCHAR(20) NOT NULL,
  reason TEXT NOT NULL,
  source VARCHAR(50) NOT NULL,
  metadata JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Trust Tier Definitions:**

| Tier | Score Range | Badge | Autonomy Level |
|------|-------------|-------|----------------|
| Untrusted | 0-199 | ⚠️ Gray | None (training only) |
| Novice | 200-399 | 🌱 Yellow | L0-L1 autonomous |
| Proven | 400-599 | ✅ Blue | L0-L2 with validator |
| Trusted | 600-799 | 🛡️ Green | L0-L3 with majority |
| Elite | 800-899 | 👑 Purple | Full autonomous, can mentor |
| Legendary | 900-1000 | 🌟 Gold | Can join Tribunal |

### APIs and Interfaces

**Trust Change Types (already implemented):**

```typescript
export const TRUST_IMPACTS = {
  // Positive (+)
  task_success_low: { change: 1, reason: 'Completed low-risk task' },
  task_success_medium: { change: 2, reason: 'Completed medium-risk task' },
  task_success_high: { change: 5, reason: 'Completed high-risk task' },
  council_approval: { change: 10, reason: 'Council approved action' },
  user_positive_feedback: { change: 15, reason: 'Positive feedback' },
  training_milestone: { change: 20, reason: 'Training milestone' },
  examination_passed: { change: 50, reason: 'Passed examination' },
  commendation: { change: 25, reason: 'Received commendation' },

  // Negative (-)
  task_failure: { change: -5, reason: 'Task failed' },
  council_denial: { change: -20, reason: 'Council denied' },
  user_negative_feedback: { change: -15, reason: 'Negative feedback' },
  policy_violation_minor: { change: -25, reason: 'Minor violation' },
  policy_violation_major: { change: -50, reason: 'Major violation' },
  complaint_filed: { change: -30, reason: 'Complaint filed' },
  suspension: { change: -100, reason: 'Agent suspended' },
  decay: { change: -1, reason: 'Inactivity decay' },
}
```

**API Endpoints Needed (Story 4-1):**

```typescript
// GET /api/agents/[id]/trust
interface TrustResponse {
  score: number;
  tier: TrustTier;
  tierInfo: { label: string; color: string; icon: string };
  autonomyLevel: AutonomyLimits;
  isOnProbation: boolean;
  probationDaysRemaining?: number;
}

// GET /api/agents/[id]/trust/history
interface TrustHistoryResponse {
  entries: TrustHistoryEntry[];
  total: number;
  trend: Array<{ date: string; score: number; tier: TrustTier }>;
}
```

### Workflows and Sequencing

**Trust Change Flow:**

```
Event Occurs (task, council, feedback)
    │
    ▼
┌─────────────────────────┐
│ applyTrustChange()      │
│ - Calculate new score   │
│ - Clamp to 0-1000       │
│ - Determine new tier    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Update bots table       │
│ - trust_score           │
│ - trust_tier            │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Record to trust_history │
│ - previous_score        │
│ - change_amount         │
│ - reason, source        │
└───────────┬─────────────┘
            │
      ┌─────┴─────┐
      │Tier Changed?│
      └─────┬─────┘
            │ Yes
            ▼
┌─────────────────────────┐
│ Record to Truth Chain   │
│ type: trust.milestone   │
└─────────────────────────┘
```

**Decay Processing (Daily Cron):**

```
Scheduled Job (daily)
    │
    ▼
┌─────────────────────────┐
│ processDecayBatch()     │
│ - Get active agents     │
│ - Filter by inactivity  │
└───────────┬─────────────┘
            │
   For each inactive agent
            │
            ▼
┌─────────────────────────┐
│ shouldDecay()           │
│ - Check last_activity   │
│ - > 7 days threshold    │
└───────────┬─────────────┘
            │ Yes
            ▼
┌─────────────────────────┐
│ applyDecayToAgent()     │
│ - Calculate decay       │
│ - Max 5 points/day      │
│ - Floor at score 10     │
└───────────┬─────────────┘
            │
      ┌─────┴─────┐
      │Drop >= 100?│
      └─────┬─────┘
            │ Yes
            ▼
┌─────────────────────────┐
│ Trigger Probation       │
│ - 30 day period         │
│ - All actions supervised│
└─────────────────────────┘
```

## Non-Functional Requirements

### Performance

| Metric | Requirement | Implementation |
|--------|-------------|----------------|
| Trust score read | < 50ms | Direct DB query on indexed column |
| Trust change write | < 200ms | Transactional update + history insert |
| History query (50 entries) | < 100ms | Indexed by agent_id, paginated |
| Decay batch (1000 agents) | < 30s | Parallel processing, batched updates |
| UI render (trust badge) | < 16ms | Memoized components |

### Security

- Trust score changes require authenticated user with agent ownership
- Trust history is append-only (no UPDATE/DELETE)
- Admin override requires elevated permissions + audit log
- Decay processing runs in isolated service context
- Probation flag cannot be cleared except by system (time-based)

### Reliability/Availability

- Trust score reads: 99.9% availability (cached with 1min TTL)
- Trust score writes: Strong consistency required
- Decay job: Idempotent (safe to re-run)
- History: Immutable, no data loss

### Observability

| Signal | Type | Purpose |
|--------|------|---------|
| `trust.change.applied` | Event | Log all trust changes |
| `trust.tier.changed` | Event | Track tier transitions |
| `trust.decay.processed` | Metric | Daily decay job stats |
| `trust.probation.triggered` | Alert | Notify on probation |
| Trust score distribution | Dashboard | Aggregate trust health |

## Dependencies and Integrations

### Package Dependencies (package.json)

```json
{
  "@supabase/supabase-js": "^2.39.1",
  "@supabase/auth-helpers-nextjs": "^0.8.7",
  "recharts": "latest",  // For trust trend charts
  "framer-motion": "latest"  // For badge animations
}
```

### Internal Dependencies

| Dependency | Purpose | Version |
|------------|---------|---------|
| Supabase Client | Database operations | Current |
| Truth Chain Service | Record tier milestones | Epic 5 |
| Observer Service | Log trust events | Epic 5 |
| Council Service | Trust impact from decisions | Epic 3 |

### External Integrations

None for this epic. Trust data stays internal until Epic 5 (public verification).

## Acceptance Criteria (Authoritative)

### Story 4-1: Trust Score Display & Tiers (FR50, FR53, FR54)

- [ ] **AC-4-1-1**: Trust badge component displays score (0-1000) and tier icon
- [ ] **AC-4-1-2**: Badge color matches tier (gray, yellow, blue, green, purple, gold)
- [ ] **AC-4-1-3**: Agent detail page shows prominent trust score section
- [ ] **AC-4-1-4**: Dashboard shows trust tier for all user's agents
- [ ] **AC-4-1-5**: Tier label and autonomy description visible on hover/click
- [ ] **AC-4-1-6**: Probation indicator shown when is_on_probation = true

### Story 4-2: Trust Score Changes (FR51, FR52)

- [x] **AC-4-2-1**: applyTrustChange() increases score for positive events
- [x] **AC-4-2-2**: applyTrustChange() decreases score for negative events
- [x] **AC-4-2-3**: Score clamped to 0-1000 range
- [x] **AC-4-2-4**: Tier automatically recalculated on score change
- [x] **AC-4-2-5**: Change recorded in trust_history with reason and source
- [ ] **AC-4-2-6**: UI shows toast/notification on trust change

### Story 4-3: Trust Score History & Trends (FR55)

- [x] **AC-4-3-1**: getTrustHistory() returns paginated history entries
- [x] **AC-4-3-2**: getTrustTrend() returns data for chart visualization
- [ ] **AC-4-3-3**: Trust history timeline component shows changes
- [ ] **AC-4-3-4**: Trend chart shows score over time (30/60/90 days)
- [ ] **AC-4-3-5**: Filter history by change type (positive/negative/all)

### Story 4-4: Trust Decay & Autonomy Limits (FR56, FR57)

- [x] **AC-4-4-1**: Agents inactive > 7 days begin decay
- [x] **AC-4-4-2**: Decay rate: 1 point/day, max 5 points/day
- [x] **AC-4-4-3**: Score floor at 10 (never decays to 0)
- [x] **AC-4-4-4**: Drop >= 100 triggers 30-day probation
- [x] **AC-4-4-5**: getAutonomyLimits() returns tier-based permissions
- [x] **AC-4-4-6**: Probation restricts all actions to human approval
- [ ] **AC-4-4-7**: Decay cron job scheduled and running daily
- [ ] **AC-4-4-8**: UI shows last activity and decay warning

## Traceability Mapping

| AC | Spec Section | Component/API | Test Idea |
|----|--------------|---------------|-----------|
| AC-4-1-1 | Services/Modules | TrustBadge component | Render badge with various scores |
| AC-4-1-2 | Data Models | TRUST_TIERS constant | Verify color mapping |
| AC-4-1-3 | Frontend | Agent detail page | E2E test trust section |
| AC-4-1-6 | Data Models | is_on_probation flag | Test probation indicator |
| AC-4-2-1 | APIs | applyTrustChange() | Unit test positive events |
| AC-4-2-2 | APIs | applyTrustChange() | Unit test negative events |
| AC-4-2-3 | APIs | applyTrustChange() | Test boundary conditions |
| AC-4-2-4 | APIs | getTrustTierFromScore() | Test tier transitions |
| AC-4-3-1 | APIs | getTrustHistory() | Test pagination |
| AC-4-3-2 | APIs | getTrustTrend() | Test date range queries |
| AC-4-4-1 | Workflows | shouldDecay() | Test 7-day threshold |
| AC-4-4-4 | Workflows | applyDecayToAgent() | Test probation trigger |
| AC-4-4-5 | APIs | getAutonomyLimits() | Test all tier levels |

## Risks, Assumptions, Open Questions

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Decay job fails silently | Medium | Medium | Add monitoring, alerts on failure |
| Trust history grows too large | Low | Medium | Add retention policy (archive after 1 year) |
| Race condition on score update | Low | High | Use database transaction with row lock |

### Assumptions

- Database migrations for trust_history already applied
- Supabase Row Level Security allows agent owners to read trust data
- Cron job infrastructure available for decay processing
- Truth Chain service from Epic 5 not required for MVP (can add later)

### Open Questions

1. **Q:** Should trust score be visible to consumers in marketplace?
   **A:** Yes, deferred to Epic 6 (Marketplace)

2. **Q:** Can trainers see other trainers' agent trust scores?
   **A:** Only for published marketplace agents

3. **Q:** What happens when agent is archived? Decay continues?
   **A:** No, archived agents excluded from decay processing

## Test Strategy Summary

### Test Levels

| Level | Coverage | Framework |
|-------|----------|-----------|
| Unit | Trust service functions | Vitest |
| Integration | API endpoints + DB | Vitest + Supabase test client |
| Component | Trust UI components | React Testing Library |
| E2E | Trust flows | Playwright |

### Key Test Scenarios

1. **Trust Change Happy Path**: Apply positive change, verify score/tier update
2. **Trust Floor/Ceiling**: Verify 0-1000 bounds enforced
3. **Tier Transition**: Score crosses tier boundary, verify tier updates
4. **Decay Processing**: Inactive agent decays correctly
5. **Probation Trigger**: Large drop triggers probation
6. **Autonomy Check**: Verify tier-based action permissions
7. **UI Badge Rendering**: All 6 tiers render correctly
8. **History Pagination**: Query with offset/limit works
9. **Trend Chart Data**: Returns valid chart data structure

### Edge Cases

- Score exactly on tier boundary (199 → 200)
- Multiple rapid score changes
- Decay on already minimum score
- Probation ending exactly at 30 days
