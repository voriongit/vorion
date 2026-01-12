# Story 14-4: Consistency Tracking

**Epic:** 14 - Precedent Flywheel
**Story ID:** 14-4
**Title:** Decision Consistency Tracking and Analysis
**Status:** drafted
**Priority:** Medium
**Estimated Effort:** Medium (5-8 hours)

---

## User Story

**As a** Platform Administrator,
**I want to** track decision consistency with precedents,
**So that** I can ensure the Council makes consistent rulings and identify areas for improvement.

---

## Acceptance Criteria

### AC1: Consistency Analysis Table
**Given** a Council decision is finalized
**When** post-processing runs
**Then** consistency analysis is recorded:
- Similar decisions found
- Expected outcome (based on precedents)
- Actual outcome
- Consistency score (0-1)
- Is consistent (boolean)

### AC2: Automatic Consistency Check
**Given** a new decision is recorded
**When** consistency analysis runs
**Then** similar past decisions are found
**And** outcomes are compared
**And** consistency score is calculated

### AC3: Inconsistency Alert
**Given** a decision is inconsistent with precedents
**When** consistency score < 0.5
**Then** alert is generated
**And** appears in admin dashboard
**And** requires review/justification

### AC4: Justification Workflow
**Given** an inconsistency is flagged
**When** admin reviews the inconsistency
**Then** they can mark as "justified" with reason
**Or** escalate for reconsideration

### AC5: Consistency Dashboard
**Given** I am an admin viewing the dashboard
**When** I navigate to Council > Consistency
**Then** I see:
- Overall consistency score (trending)
- Recent inconsistent decisions
- Consistency by action type
- Consistency by validator

### AC6: Metrics Export
**Given** I need consistency metrics
**When** I request export
**Then** CSV/JSON with all consistency data is generated

---

## Technical Implementation

### Database Schema

```sql
-- Migration: 20250620000004_consistency_tracking.sql

CREATE TABLE decision_consistency_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES council_decisions(id),

  -- Similar decisions found
  similar_decisions JSONB NOT NULL DEFAULT '[]',

  -- Consistency analysis
  expected_outcome TEXT,
  actual_outcome TEXT NOT NULL,
  is_consistent BOOLEAN NOT NULL,
  consistency_score FLOAT NOT NULL,

  -- Inconsistency handling
  inconsistency_reason TEXT,
  was_reviewed BOOLEAN DEFAULT false,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  was_justified BOOLEAN DEFAULT false,
  justification TEXT,

  analyzed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_consistency_decision ON decision_consistency_log(decision_id);
CREATE INDEX idx_consistency_score ON decision_consistency_log(consistency_score);
CREATE INDEX idx_consistency_inconsistent ON decision_consistency_log(is_consistent)
  WHERE is_consistent = false;

-- Materialized view for metrics
CREATE MATERIALIZED VIEW consistency_metrics AS
SELECT
  DATE_TRUNC('day', dcl.analyzed_at) as date,
  COUNT(*) as total_decisions,
  COUNT(*) FILTER (WHERE dcl.is_consistent) as consistent_count,
  COUNT(*) FILTER (WHERE NOT dcl.is_consistent) as inconsistent_count,
  AVG(dcl.consistency_score) as avg_consistency_score,
  COUNT(*) FILTER (WHERE dcl.was_justified) as justified_count
FROM decision_consistency_log dcl
GROUP BY DATE_TRUNC('day', dcl.analyzed_at)
ORDER BY date DESC;

CREATE UNIQUE INDEX idx_consistency_metrics_date ON consistency_metrics(date);
```

### Consistency Service

```typescript
// lib/council/consistency-service.ts

interface ConsistencyAnalysis {
  decisionId: string;
  similarDecisions: Array<{
    id: string;
    similarity: number;
    outcome: string;
  }>;
  expectedOutcome: string | null;
  actualOutcome: string;
  isConsistent: boolean;
  consistencyScore: number;
  inconsistencyReason?: string;
}

export async function analyzeDecisionConsistency(
  decisionId: string
): Promise<ConsistencyAnalysis> {
  const decision = await getCouncilDecision(decisionId);
  if (!decision) throw new Error('Decision not found');

  // Find similar past decisions
  const similarPrecedents = await findSimilarPrecedents(
    buildContextFromDecision(decision),
    {
      minSimilarity: 0.7,
      limit: 10,
      excludeIds: [decisionId],
    }
  );

  if (similarPrecedents.length === 0) {
    // No precedents = automatically consistent (new territory)
    const analysis: ConsistencyAnalysis = {
      decisionId,
      similarDecisions: [],
      expectedOutcome: null,
      actualOutcome: decision.status,
      isConsistent: true,
      consistencyScore: 1.0,
    };

    await saveConsistencyAnalysis(analysis);
    return analysis;
  }

  // Determine expected outcome from precedents
  const outcomeCounts = countOutcomes(similarPrecedents);
  const expectedOutcome = getMajorityOutcome(outcomeCounts);

  // Calculate consistency score
  const consistencyScore = calculateConsistencyScore(
    decision.status,
    similarPrecedents
  );

  const isConsistent = consistencyScore >= 0.5;

  const analysis: ConsistencyAnalysis = {
    decisionId,
    similarDecisions: similarPrecedents.map(p => ({
      id: p.id,
      similarity: p.similarity,
      outcome: p.outcome,
    })),
    expectedOutcome,
    actualOutcome: decision.status,
    isConsistent,
    consistencyScore,
    inconsistencyReason: !isConsistent
      ? `Expected ${expectedOutcome} based on ${similarPrecedents.length} similar cases`
      : undefined,
  };

  await saveConsistencyAnalysis(analysis);

  // Alert if inconsistent
  if (!isConsistent) {
    await createInconsistencyAlert(analysis);
  }

  return analysis;
}

function calculateConsistencyScore(
  actualOutcome: string,
  precedents: SimilarPrecedent[]
): number {
  if (precedents.length === 0) return 1.0;

  // Weighted average: higher similarity = more weight
  let weightedMatches = 0;
  let totalWeight = 0;

  for (const p of precedents) {
    const weight = p.similarity;
    const matches = p.outcome === actualOutcome ? 1 : 0;

    weightedMatches += weight * matches;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedMatches / totalWeight : 1.0;
}

export async function getConsistencyMetrics(
  timeRange?: { from: Date; to: Date }
): Promise<ConsistencyMetrics> {
  const supabase = createClient();

  let query = supabase
    .from('consistency_metrics')
    .select('*')
    .order('date', { ascending: false });

  if (timeRange) {
    query = query
      .gte('date', timeRange.from.toISOString())
      .lte('date', timeRange.to.toISOString());
  }

  const { data } = await query;

  return {
    daily: data || [],
    overall: calculateOverallMetrics(data || []),
  };
}

export async function getInconsistentDecisions(
  options?: { reviewed?: boolean; limit?: number }
): Promise<InconsistentDecision[]> {
  const supabase = createClient();

  let query = supabase
    .from('decision_consistency_log')
    .select(`
      *,
      decision:council_decisions(*)
    `)
    .eq('is_consistent', false)
    .order('analyzed_at', { ascending: false });

  if (options?.reviewed !== undefined) {
    query = query.eq('was_reviewed', options.reviewed);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data } = await query;
  return data || [];
}

export async function justifyInconsistency(
  consistencyLogId: string,
  userId: string,
  justification: string
): Promise<void> {
  const supabase = createClient();

  await supabase
    .from('decision_consistency_log')
    .update({
      was_reviewed: true,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      was_justified: true,
      justification,
    })
    .eq('id', consistencyLogId);
}
```

### UI Components

```typescript
// app/(dashboard)/admin/council/consistency/page.tsx

export default function ConsistencyDashboard() {
  const { data: metrics } = useSWR('/api/v1/council/consistency/metrics');
  const { data: inconsistent } = useSWR('/api/v1/council/consistency/inconsistent?reviewed=false');

  return (
    <div className="space-y-6">
      <h1>Council Consistency Dashboard</h1>

      {/* Overall Score Card */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Consistency Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">
            {Math.round((metrics?.overall?.avgScore || 0) * 100)}%
          </div>
          <TrendIndicator trend={metrics?.overall?.trend} />
        </CardContent>
      </Card>

      {/* Trend Chart */}
      <ConsistencyTrendChart data={metrics?.daily || []} />

      {/* Inconsistent Decisions Requiring Review */}
      <Card>
        <CardHeader>
          <CardTitle>Inconsistencies Requiring Review</CardTitle>
          <Badge>{inconsistent?.length || 0}</Badge>
        </CardHeader>
        <CardContent>
          <InconsistentDecisionsList
            decisions={inconsistent || []}
            onJustify={handleJustify}
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## API Specification

### GET /api/v1/council/consistency/metrics

**Response (200):**
```json
{
  "success": true,
  "data": {
    "overall": {
      "avgScore": 0.87,
      "totalDecisions": 1250,
      "consistentCount": 1088,
      "inconsistentCount": 162,
      "justifiedCount": 145,
      "trend": "improving"
    },
    "daily": [
      {
        "date": "2025-12-09",
        "avgScore": 0.89,
        "totalDecisions": 45
      }
    ]
  }
}
```

### POST /api/v1/council/consistency/:id/justify

**Request:**
```json
{
  "justification": "Case differs due to agent trust tier being Legendary..."
}
```

---

## Testing Checklist

- [ ] Unit: calculateConsistencyScore returns correct values
- [ ] Unit: No precedents = score 1.0
- [ ] Integration: Analysis runs on decision finalization
- [ ] Integration: Inconsistency alerts created
- [ ] Integration: Justification workflow works
- [ ] E2E: View consistency dashboard
- [ ] E2E: Justify inconsistent decision

---

## Definition of Done

- [ ] Schema migration applied
- [ ] analyzeDecisionConsistency function complete
- [ ] Metrics aggregation working
- [ ] Inconsistency alerts implemented
- [ ] Justification workflow complete
- [ ] Consistency dashboard UI
- [ ] API endpoints implemented
- [ ] Unit tests passing
- [ ] Code reviewed

---

*Story drafted: 2025-12-09*
*Epic: 14 - Precedent Flywheel*
