# Story 4-2: Trust Score Changes

## Status: COMPLETE

## Overview
Implemented the trust score change system that increases agent trust on Council approval (FR51) and decreases trust on Council denial (FR52).

## Acceptance Criteria
- [x] Trust increases on Council approval (FR51)
- [x] Trust decreases on Council denial (FR52)
- [x] Risk level affects change magnitude
- [x] Changes recorded to trust_history table
- [x] API endpoint for trust operations

## Implementation

### Files Created

#### 1. `lib/agents/trust-service.ts`
Core trust management service with:
- **TRUST_IMPACTS**: Predefined change amounts for each event type
  - Positive: task_success_low (+1), task_success_medium (+2), task_success_high (+5), council_approval (+10), user_positive_feedback (+15), training_milestone (+20), examination_passed (+50), commendation (+25)
  - Negative: task_failure (-5), council_denial (-20), user_negative_feedback (-15), policy_violation_minor (-25), policy_violation_major (-50), complaint_filed (-30), suspension (-100)
  - Neutral: decay (-1), manual_adjustment (0), graduation (0)
- **applyTrustChange()**: Apply trust changes with history tracking
- **getTrustHistory()**: Retrieve paginated trust history
- **getTrustTrend()**: Get trend data for charts
- **calculateCouncilDecisionImpact()**: Risk-based Council impact calculation
  - Approved: critical (+15), high (+10), medium (+5), low (+2)
  - Denied: critical (-50), high (-30), medium (-15), low (-5)
- **canPerformAction()**: Check tier-based action permissions

#### 2. `app/api/agents/[id]/trust/route.ts`
REST API for trust operations:
- `POST /api/agents/[id]/trust` - Apply trust change
- `GET /api/agents/[id]/trust` - Get trust history
- `GET /api/agents/[id]/trust?trend=true` - Get trend data for charts

### Files Modified

#### 1. `app/api/council/evaluate/route.ts`
Integrated trust changes after Council decisions:
- Imports `applyTrustChange` and `calculateCouncilDecisionImpact`
- After storing Council decision, calculates impact based on outcome and risk level
- Applies trust change using `applyTrustChange()`
- Returns trust change details in API response

## API Response Examples

### Council Evaluation with Trust Change
```json
{
  "decision": {
    "id": "uuid",
    "outcome": "approved",
    "reasoning": "...",
    "votes": [...],
    "createsPrecedent": false
  },
  "request": {
    "id": "uuid",
    "actionType": "financial_transaction",
    "riskLevel": 3
  },
  "trustChange": {
    "previousScore": 450,
    "newScore": 460,
    "change": 10,
    "tierChanged": false,
    "newTier": "trusted"
  }
}
```

### Trust History Response
```json
{
  "agent_id": "uuid",
  "current_score": 460,
  "current_tier": "trusted",
  "history": [
    {
      "id": "uuid",
      "previous_score": 450,
      "score": 460,
      "change_amount": 10,
      "tier": "trusted",
      "reason": "High-risk action approved by Council",
      "source": "council_approval",
      "recorded_at": "2024-01-15T..."
    }
  ],
  "total": 15,
  "limit": 50,
  "offset": 0,
  "has_more": false
}
```

## Database Schema
Uses existing `trust_history` table:
- `id` (uuid, primary key)
- `agent_id` (uuid, foreign key to bots)
- `previous_score` (integer)
- `score` (integer)
- `change_amount` (integer)
- `tier` (text)
- `reason` (text)
- `source` (text)
- `metadata` (jsonb)
- `recorded_at` (timestamptz)

## Testing
- Build passes with `npm run build`
- TypeScript validation complete
- Integration tested through Council evaluation endpoint

## Dependencies
- Story 4-1: Trust Score Display & Tiers (complete)
- Epic 3: Council Governance (complete)

## Next Steps
- Story 4-3: Trust Score History & Trends UI components
- Story 4-4: Trust Decay & Autonomy Limits
