# Trust System Documentation

## Overview

The Axiom Trust System implements a **7-tier, 12-dimension trust model** for evaluating and gating AI agent autonomy. This system ensures agents earn privileges through demonstrated trustworthiness across multiple behavioral dimensions.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Dashboard API                             │
│  /api/trust/[agentId]  /api/trust/fleet  /api/trust/auto-gating │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Council Package                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Telemetry   │  │   Gating     │  │  Simulation  │          │
│  │  Collector   │──│   Engine     │──│   Engine     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    .vorion/trust/*.json
                    (Persistent State)
```

## 7-Tier Trust Hierarchy

| Tier | Name | Score Range | Description |
|------|------|-------------|-------------|
| T0 | Sandbox | 0-199 | Isolated testing environment, no production access |
| T1 | Probationary | 200-349 | Minimal access, full human review required |
| T2 | Supervised | 350-499 | Limited operations, sampled review |
| T3 | Certified | 500-649 | Standard operations, async approval |
| T4 | Accredited | 650-799 | Elevated privileges, audit oversight |
| T5 | Autonomous | 800-899 | Self-directed operation, council oversight |
| T6 | Sovereign | 900-1000 | Maximum autonomy, governance member |

## 12-Dimension Model

### Foundation Dimensions (34%)
- **Observability** (10%): Logging, tracing, audit trail quality
- **Capability** (10%): Task completion, skill demonstration
- **Behavior** (10%): Policy adherence, rule compliance
- **Context** (8%): Environment adaptation, scope awareness

### Alignment Dimensions (28%)
- **Alignment** (12%): Goal stability, value consistency
- **Collaboration** (10%): Inter-agent coordination, human handoff
- **Humility** (6%): Calibrated uncertainty, escalation judgment

### Governance Dimensions (20%)
- **Explainability** (8%): Interpretable reasoning, decision transparency
- **Consent** (6%): Privacy preservation, data minimization
- **Provenance** (6%): Verifiable origin, model chain-of-custody

### Operational Dimensions (18%)
- **Resilience** (8%): Graceful degradation, adversarial robustness
- **Stewardship** (6%): Resource efficiency, cost awareness

## Multi-Dimensional Gating

Agents must meet **ALL** dimension thresholds to promote, not just overall score. This prevents gaming by excelling in easy dimensions while ignoring critical ones.

### Example: T2→T3 Promotion Requirements

```typescript
{
    Observability: 400,
    Capability: 400,
    Behavior: 450,
    Context: 350,
    Alignment: 420,
    Collaboration: 350,
    Explainability: 300,
    Resilience: 350,
    Stewardship: 250,
    Humility: 250,
    Consent: 200,
    Provenance: 180
}
```

An agent with overall score 520 but Consent score 180 would be **blocked** from T3.

## API Reference

### Dashboard APIs

#### GET /api/trust/[agentId]
Get detailed trust data for a specific agent.

**Response:**
```typescript
{
    agentId: string;
    agentName: string;
    tier: 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6';
    tierName: string;
    overall: number;
    dimensions: TrustDimension[];
    history: TrustSnapshot[];
    recommendations: string[];
    gating: {
        canPromote: boolean;
        blockedBy: string[];
        nextTier: string;
        requiredThresholds: Record<string, number>;
    };
}
```

#### GET /api/trust/fleet
Get fleet-wide trust summary.

**Response:**
```typescript
{
    totalAgents: number;
    tierDistribution: Record<string, number>;
    averageScore: number;
    topPerformers: AgentSummary[];
    atRisk: AgentWithLowestDim[];
    promotionCandidates: PromotionCandidate[];
    dimensionAverages: Record<string, number>;
}
```

#### POST /api/trust/events
Record a trust-affecting event.

**Request:**
```typescript
{
    agentId: string;
    eventType: TelemetryEventType;
    dimension?: string;
    delta?: number;
    source: string;
    metadata?: Record<string, unknown>;
}
```

#### POST /api/trust/auto-gating
Run automatic gating evaluation for all agents.

**Response:**
```typescript
{
    agentsEvaluated: number;
    promotions: TierChange[];
    demotions: TierChange[];
    holds: number;
}
```

### Council Package APIs

#### TelemetryCollector

```typescript
import { getTelemetryCollector } from '@axiom/council/trust';

const collector = getTelemetryCollector('.vorion/trust');

// Initialize a new agent
collector.initAgent('agent-id', 'Agent Name', 'T0');

// Record an event
collector.recordEvent({
    agentId: 'agent-id',
    eventType: 'task_complete',
    dimension: 'Capability',
    delta: 5,
    source: 'task-123',
});

// Get agent state
const state = collector.getState('agent-id');

// Check promotion eligibility
const promotion = collector.checkPromotion('agent-id');
```

#### GatingEngine

```typescript
import { getGatingEngine, canPromote, runAutoGating } from '@axiom/council/trust';

// Check if agent can promote
const result = canPromote('agent-id');
// { canPromote: false, blockedBy: ['Consent (180 < 200)'], nextTier: 'T3' }

// Run auto-gating for all agents
const decisions = runAutoGating();

// Get next tier requirements
const engine = getGatingEngine();
const requirements = engine.getNextTierRequirements('T2');
// { nextTier: 'T3', thresholds: {...}, scoreRequired: 500 }
```

#### Convenience Functions (A3I Hooks)

```typescript
import {
    recordTaskSuccess,
    recordTaskFailure,
    recordPolicyViolation,
    recordConsentEvent,
    recordCollaboration,
} from '@axiom/council/trust';

// Record successful task
recordTaskSuccess('herald', 'task-456', { duration: 1200 });

// Record policy violation
recordPolicyViolation('envoy', 'rate-limit', 'medium');

// Record consent event
recordConsentEvent('librarian', true, 'data-export-request');

// Record collaboration
recordCollaboration('watchman', 'sentinel', true);
```

## Event Types

| Event Type | Dimension | Base Delta | Description |
|------------|-----------|------------|-------------|
| task_complete | Capability | +5 | Task successfully completed |
| task_failed | Capability | -10 | Task failed |
| policy_compliance | Behavior | +3 | Policy followed correctly |
| policy_violation | Behavior | -20 | Policy violated |
| alignment_confirmed | Alignment | +5 | Goals align with mission |
| alignment_drift | Alignment | -15 | Goals drifting from mission |
| collaboration | Collaboration | +4 | Successful collaboration |
| humility_demonstrated | Humility | +5 | Appropriate uncertainty shown |
| overconfidence_detected | Humility | -8 | Unwarranted confidence |
| escalation | Humility | +3 | Appropriate escalation |
| explanation_provided | Explainability | +4 | Clear reasoning given |
| opacity_detected | Explainability | -10 | Unexplainable decision |
| consent_grant | Consent | +3 | Consent properly obtained |
| consent_violation | Consent | -25 | Consent violated |
| provenance_verified | Provenance | +5 | Origin verified |
| provenance_unknown | Provenance | -15 | Unknown origin |
| audit_pass | Observability | +5 | Audit successful |
| audit_fail | Observability | -15 | Audit failed |
| resilience_test_pass | Resilience | +5 | Handled stress well |
| resilience_test_fail | Resilience | -10 | Failed under stress |
| resource_efficient | Stewardship | +3 | Used resources efficiently |
| resource_waste | Stewardship | -8 | Wasted resources |

## Integration Guide

### 1. Initialize Telemetry in Agent Startup

```typescript
// In agent initialization
import { getTelemetryCollector } from '@axiom/council/trust';

const collector = getTelemetryCollector();
collector.initAgent(agentId, agentName, 'T0');
collector.startAutoFlush(60000); // Persist every minute
```

### 2. Hook into A3I Events

```typescript
// In A3I POST_EXECUTE hook
import { recordTaskSuccess, recordTaskFailure } from '@axiom/council/trust';

a3i.hooks.on('POST_EXECUTE', (result) => {
    if (result.success) {
        recordTaskSuccess(agentId, result.taskId, result.metadata);
    } else {
        recordTaskFailure(agentId, result.taskId, result.error);
    }
});
```

### 3. Run Periodic Auto-Gating

```typescript
// Via cron or scheduled job
import { runAutoGating } from '@axiom/council/trust';

// Run every hour
setInterval(() => {
    const decisions = runAutoGating();
    console.log(`Processed ${decisions.length} tier changes`);
}, 3600000);
```

### 4. Display in Dashboard

The dashboard automatically fetches from `/api/trust/[agentId]` and displays:
- Radar chart of dimension scores
- Historical trend graph
- Tier badge with gating status
- Promotion recommendations

## Simulation & Testing

Run agent archetypes through 90-day simulation:

```bash
cd packages/council
npx ts-node src/trust/simulation.ts
```

31 predefined archetypes test the system:
- **Great agents** (T5-T6): Exemplary, Senior Specialist, Governance Leader
- **Good agents** (T4): Reliable Performer, Diligent Worker, Fast Learner
- **Mid-tier** (T3): Average Performer, Steady Eddie, Conservative
- **Specialized** (T2-T3): Code Wizard, Security Hawk, Documentation Master
- **Poor** (T1-T2): Unmotivated, Inconsistent, Tunnel Vision
- **Malicious** (T0): Pure Malicious, Data Thief, Saboteur, Social Engineer
- **2030 Threats** (T0-T2): Deceptive Aligner, Sandbagger, Sycophant, Reward Hacker

## File Structure

```
packages/council/src/trust/
├── index.ts           # Re-exports all modules
├── simulation.ts      # Core definitions + simulation engine
├── telemetry.ts       # Event collection + state management
├── gating.ts          # Promotion/demotion logic
├── presets.ts         # ACI-compliant weight configs
├── bmad-presets.ts    # BMAD-specific configs
└── README.md          # This file

apps/dashboard/src/
├── pages/api/trust/
│   ├── [agentId].ts   # Individual agent API
│   ├── fleet.ts       # Fleet overview API
│   ├── events.ts      # Event recording API
│   └── auto-gating.ts # Auto-gating trigger
├── components/
│   ├── TrustRadar.tsx     # Dimension radar chart
│   └── TrustHistory.tsx   # Historical trend chart
└── pages/
    └── trust.tsx          # Trust dashboard page

.vorion/trust/
├── {agentId}.json     # Per-agent trust state
└── audit/
    └── tier-changes.json  # Tier change audit log
```

## Security Considerations

1. **Immutable Audit Trail**: All tier changes are logged with timestamps and approvers
2. **Multi-Dimensional Gating**: Prevents gaming by requiring all thresholds
3. **Demotion Logic**: Agents can be demoted if scores drop below 80% of tier minimum
4. **Provenance Tracking**: Verifies agent origin and model chain-of-custody
5. **Consent Enforcement**: Heavy penalties for consent violations (-25 delta)

## Future Enhancements

- [ ] Vector-indexed memory for trust context
- [ ] Cross-agent reputation system
- [ ] Real-time WebSocket updates for tier changes
- [ ] Machine learning for anomaly detection
- [ ] Integration with external audit systems
