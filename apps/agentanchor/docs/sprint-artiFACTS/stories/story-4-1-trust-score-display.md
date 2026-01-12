# Story 4-1: Trust Score Display & Tiers

## Story
As a **Trainer**, I want to see my agent's trust score with visual tier badges, so that I understand their standing and autonomy level.

## Status: Done

## Acceptance Criteria

- [x] Trust score (0-1000) displayed prominently on agent profiles
- [x] Emoji badges for each tier: ⚠️ Untrusted, 🌱 Novice, ✅ Proven, 🛡️ Trusted, 👑 Elite, 🌟 Legendary
- [x] Progress bar showing position within current tier
- [x] "Points to next tier" indicator shown
- [x] Autonomy limits displayed based on tier (FR54)
- [x] Tier-based color coding throughout UI

## Technical Notes

### Trust Tier Thresholds
| Tier | Range | Emoji | Autonomy Level |
|------|-------|-------|----------------|
| Untrusted | 0-199 | ⚠️ | Cannot operate autonomously |
| Novice | 200-399 | 🌱 | Low-risk actions with logging |
| Proven | 400-599 | ✅ | Standard actions with oversight |
| Trusted | 600-799 | 🛡️ | Most actions independently |
| Elite | 800-899 | 👑 | High-risk with minimal oversight |
| Legendary | 900-1000 | 🌟 | Full autonomy, mentor privileges |

### Components Created/Updated
- `components/agents/TrustBadge.tsx` - Enhanced with emoji display
- New exports: `tierEmojis`, `tierAutonomy`, `AutonomyIndicator`, `TrustTierCard`

### Existing Infrastructure Leveraged
- `lib/agents/types.ts` - `TrustTier`, `TRUST_TIERS` constants
- `lib/governance/trust.ts` - `getTrustTier()`, decay calculations
- `lib/bot-trust/trust-score-engine.ts` - FICO-style score calculation
- `app/api/agents/[id]/history/route.ts` - Trust history timeline API

## Implementation Tasks

1. [x] Add emoji badges to TrustBadge component
2. [x] Create tierAutonomy mapping for autonomy descriptions
3. [x] Create AutonomyIndicator component showing permitted actions
4. [x] Create TrustTierCard component with score, progress, next tier
5. [x] Update agent detail page to use new components
6. [x] Verify trust history API is functional

## Dependencies

- Story 3-5: Human Escalation Override (complete - Epic 3 done)
- Trust score engine infrastructure (already exists from bot-trust module)

## FRs Covered

- FR50: Trust Score 0-1000 displayed
- FR53: Tier badges with visual indicators
- FR54: Autonomy limits based on tier

## Files Modified

- `components/agents/TrustBadge.tsx` - Added emojis, autonomy, TrustTierCard
- `app/(dashboard)/agents/[id]/page.tsx` - Using new components
