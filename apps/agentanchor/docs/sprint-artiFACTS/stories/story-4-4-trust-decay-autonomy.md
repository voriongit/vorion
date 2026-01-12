# Story 4-4: Trust Decay & Autonomy Limits

## Status: COMPLETE

## Overview
Implemented trust decay for inactive agents and tier-based autonomy limits that govern what actions agents can perform autonomously.

## Acceptance Criteria
- [x] Inactive agents (7+ days) lose 1 trust point per day (FR56)
- [x] Tier changes trigger notifications to trainer
- [x] Actions limited by tier autonomy rules (FR54)
- [x] Probation system for recovery (FR57)
- [x] Cron job for daily decay processing

## Implementation

### Files Created

#### 1. `lib/agents/decay-service.ts`
Core decay and autonomy logic:
- **DECAY_CONFIG**: Configurable decay parameters
  - `inactivityThresholdDays`: 7 days
  - `decayPointsPerDay`: 1 point
  - `maxDecayPerDay`: 5 points (cap)
  - `minimumScore`: 10 (floor)
  - `probationDurationDays`: 30 days
  - `probationTriggerDrop`: 100 points

- **processDecayBatch()**: Batch process all agents for decay
- **applyDecayToAgent()**: Apply decay to single agent
- **recordActivity()**: Reset decay timer on activity
- **checkProbationStatus()**: Check/end probation periods
- **getAutonomyLimits()**: Get tier-based autonomy limits

#### 2. `app/api/cron/decay/route.ts`
Cron endpoint for scheduled decay:
- `POST /api/cron/decay` - Run decay batch
- `GET /api/cron/decay` - Also supports GET for Vercel Cron
- Protected by CRON_SECRET for security
- Returns detailed statistics on processed agents

### Files Modified

#### 1. `app/api/council/evaluate/route.ts`
Added autonomy limit integration:
- Checks agent's tier and probation status
- Calculates if action exceeds autonomy limits
- Records activity (resets decay timer)
- Includes autonomy info in response

#### 2. `vercel.json`
Added cron configuration:
```json
"crons": [
  {
    "path": "/api/cron/decay",
    "schedule": "0 6 * * *"
  }
]
```
Runs daily at 6 AM UTC.

### Database Migration

#### `20250203000000_trust_decay_probation.sql`
Added columns to `bots` table:
- `last_activity_at` - Tracks last agent activity
- `is_on_probation` - Probation status flag
- `probation_started_at` - Probation start timestamp
- `probation_ended_at` - Probation end timestamp

## Autonomy Limits by Tier

| Tier | Max Risk | Can Execute Auto | Description |
|------|----------|-----------------|-------------|
| Untrusted | 0 | No | Cannot perform autonomous actions |
| Novice | 1 | Yes | Routine (L0-L1) actions only |
| Proven | 2 | Yes | Up to elevated (L2) with validator |
| Trusted | 3 | Yes | High-risk (L3) with majority approval |
| Elite/Legendary | 3 | Yes | Can request L4 for human approval |

## Probation Rules
- Triggered when score drops by 100+ points
- Duration: 30 days of supervised operation
- All actions require human approval during probation
- Activity during probation resets decay timer
- Probation ends automatically after 30 days

## Decay Rules
- Inactivity threshold: 7 days
- Decay rate: 1 point per day after threshold
- Maximum decay per day: 5 points (capped)
- Minimum score floor: 10 points
- Activity resets the decay timer

## API Response Enhancement

Council evaluation now includes autonomy info:
```json
{
  "decision": { ... },
  "request": { ... },
  "autonomy": {
    "tier": "proven",
    "isOnProbation": false,
    "exceedsAutonomy": false,
    "forceHumanApproval": false,
    "maxAutonomousRiskLevel": 2,
    "description": "Can execute up to elevated (L2) actions with single validator"
  },
  "trustChange": { ... }
}
```

## Dependencies
- Story 4-2: Trust Score Changes (provides applyTrustChange)
- Story 4-3: Trust Score History & Trends

## Next Steps
- Epic 5: Observer & Truth Chain
- Story 5-1: Observer Event Logging
