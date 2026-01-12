# Story 14-1: Decision Indexing

**Epic:** 14 - Precedent Flywheel
**Story ID:** 14-1
**Title:** Decision Indexing with Structured Metadata
**Status:** drafted
**Priority:** High
**Estimated Effort:** Medium (5-8 hours)

---

## User Story

**As a** Council System,
**I want to** automatically index every decision with structured metadata,
**So that** decisions can be efficiently searched and matched for precedent.

---

## Acceptance Criteria

### AC1: Extended Schema
**Given** the council_precedents table
**When** migrations run
**Then** new columns exist:
- `structured_metadata` (JSONB)
- `embedding` (vector - placeholder for Story 14-2)
- `consistency_score` (FLOAT)
- `superseded_by` (UUID reference)
- `is_canonical` (BOOLEAN)

### AC2: Metadata Extraction
**Given** a Council decision is recorded
**When** post-processing runs
**Then** structured metadata is extracted:
- action_type, action_category
- risk_level
- outcome (approved/denied/escalated)
- votes array with validator reasoning
- key_factors (array of strings)
- agent_trust_tier
- has_human_override

### AC3: Automatic Indexing
**Given** a Council decision completes
**When** the decision is finalized
**Then** `indexDecision()` is automatically called
**And** a precedent record is created or updated

### AC4: Full-Text Search
**Given** precedents with structured metadata
**When** I search by keywords or metadata filters
**Then** results are ranked by relevance
**And** metadata filters work (action_type, risk_level, outcome)

### AC5: Backfill Existing Decisions
**Given** existing council_decisions without precedent records
**When** backfill migration runs
**Then** all L3+ decisions are indexed as precedents

---

## Technical Implementation

### Database Migration

```sql
-- Migration: 20250620000001_precedent_indexing.sql

-- Extend council_precedents
ALTER TABLE council_precedents
  ADD COLUMN IF NOT EXISTS structured_metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS consistency_score FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES council_precedents(id),
  ADD COLUMN IF NOT EXISTS is_canonical BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS decision_id UUID REFERENCES council_decisions(id);

-- Index for metadata queries
CREATE INDEX IF NOT EXISTS idx_precedents_metadata
  ON council_precedents
  USING gin (structured_metadata);

-- Index for decision lookup
CREATE INDEX IF NOT EXISTS idx_precedents_decision
  ON council_precedents(decision_id);

-- Full-text search vector (if not exists)
ALTER TABLE council_precedents
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(reasoning, '')), 'C')
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_precedents_search
  ON council_precedents
  USING gin (search_vector);
```

### Service Implementation

```typescript
// lib/council/precedent-flywheel.ts

interface DecisionMetadata {
  actionType: string;
  actionCategory: string;
  riskLevel: number;
  outcome: 'approved' | 'denied' | 'escalated';
  votes: Array<{
    validatorId: string;
    vote: 'approve' | 'deny' | 'abstain';
    confidence: number;
    keyReason: string;
  }>;
  synthesisReasoning: string;
  keyFactors: string[];
  agentTrustTier: string;
  hasHumanOverride: boolean;
}

export async function extractMetadata(
  decision: CouncilDecision
): Promise<DecisionMetadata> {
  const votes = decision.votes?.map(v => ({
    validatorId: v.validatorId,
    vote: v.vote,
    confidence: v.confidence,
    keyReason: extractKeyReason(v.reasoning),
  })) || [];

  return {
    actionType: decision.subjectAction,
    actionCategory: categorizeAction(decision.subjectAction),
    riskLevel: decision.riskLevel,
    outcome: decision.status as 'approved' | 'denied' | 'escalated',
    votes,
    synthesisReasoning: decision.reasoning || '',
    keyFactors: extractKeyFactors(decision),
    agentTrustTier: await getAgentTrustTier(decision.agentId),
    hasHumanOverride: decision.humanOverride,
  };
}

export async function indexDecision(
  decisionId: string
): Promise<Precedent | null> {
  const decision = await getCouncilDecision(decisionId);
  if (!decision) return null;

  // Only index L2+ decisions
  if (decision.riskLevel < 2) return null;

  const metadata = await extractMetadata(decision);

  // Generate title and summary
  const title = generatePrecedentTitle(metadata);
  const summary = generatePrecedentSummary(decision, metadata);

  // Upsert precedent
  const precedent = await upsertPrecedent({
    decisionId,
    title,
    summary,
    actionType: metadata.actionType,
    riskLevel: metadata.riskLevel,
    outcome: metadata.outcome,
    reasoning: metadata.synthesisReasoning,
    structuredMetadata: metadata,
    tags: generateTags(metadata),
    category: metadata.actionCategory,
  });

  return precedent;
}

function generatePrecedentTitle(metadata: DecisionMetadata): string {
  const outcomeText = {
    approved: 'Approved',
    denied: 'Denied',
    escalated: 'Escalated',
  }[metadata.outcome];

  const actionText = metadata.actionType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  return `${actionText} - ${outcomeText} (L${metadata.riskLevel})`;
}
```

### Council Service Integration

```typescript
// lib/council/council-service.ts - Add to decision finalization

export async function finalizeDecision(decision: CouncilDecision) {
  // Existing finalization logic...

  // NEW: Index as precedent
  await indexDecision(decision.id);

  return decision;
}
```

---

## API Specification

### GET /api/v1/precedents

**Query Parameters:**
- `q` - Full-text search query
- `actionType` - Filter by action type
- `outcome` - Filter by outcome (approved/denied/escalated)
- `riskLevel` - Filter by minimum risk level
- `limit` - Max results (default 20)
- `offset` - Pagination offset

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "External API Call - Approved (L3)",
      "summary": "API call to trusted provider approved...",
      "actionType": "external_api_call",
      "riskLevel": 3,
      "outcome": "approved",
      "structuredMetadata": {
        "actionCategory": "external_integration",
        "keyFactors": ["trusted_provider", "rate_limited", "minimal_data"],
        "agentTrustTier": "established"
      },
      "timesCited": 5,
      "createdAt": "2025-12-09T..."
    }
  ],
  "meta": {
    "total": 150,
    "limit": 20,
    "offset": 0
  }
}
```

---

## Testing Checklist

- [ ] Unit: extractMetadata extracts all required fields
- [ ] Unit: generatePrecedentTitle formats correctly
- [ ] Unit: indexDecision skips L0-L1 decisions
- [ ] Integration: Decision creates precedent automatically
- [ ] Integration: Full-text search returns relevant results
- [ ] Integration: Metadata filters work correctly
- [ ] E2E: Search precedents via API

---

## Definition of Done

- [ ] Schema migration applied
- [ ] extractMetadata function complete
- [ ] indexDecision function complete
- [ ] Council service integration
- [ ] Full-text search working
- [ ] API endpoint implemented
- [ ] Backfill script for existing decisions
- [ ] Unit tests passing
- [ ] Code reviewed

---

*Story drafted: 2025-12-09*
*Epic: 14 - Precedent Flywheel*
