# Epic 14: Precedent Flywheel - Technical Context

**Epic:** Precedent Flywheel (MOAT BUILDER)
**Goal:** Build an AI-powered governance intelligence system that learns from every Council decision
**FRs Covered:** FR150-FR156
**Priority:** Growth Phase - DATA MOAT - Cannot be replicated
**Generated:** 2025-12-09

---

## 1. Executive Summary

This epic transforms the existing precedent library into a **flywheel** - a self-reinforcing system where:
- Every decision improves future decisions
- Semantic similarity finds relevant precedents automatically
- Validators receive precedent context during deliberation
- Consistency is tracked and measured
- Validator prompts are refined based on accumulated wisdom

**Strategic Value:** Creates proprietary training data that competitors cannot replicate. The more decisions made, the smarter the Council becomes.

---

## 2. Current State Analysis

### Existing Components (Built)

| Component | Location | Status |
|-----------|----------|--------|
| `council_precedents` table | Supabase | Exists |
| `createPrecedent()` | `lib/council/precedent-service.ts` | Basic |
| `searchPrecedents()` | `lib/council/precedent-service.ts` | Keyword-based |
| `findRelevantPrecedents()` | `lib/council/precedent-service.ts` | Basic matching |
| `citePrecedent()` | `lib/council/precedent-service.ts` | Exists |

### Gaps to Address

| Gap | FR | Solution |
|-----|-----|----------|
| No structured metadata indexing | FR150 | Enhanced schema + automated extraction |
| No semantic similarity | FR151 | Vector embeddings + pgvector |
| Validators don't receive precedent context | FR152 | Inject into validator prompts |
| No consistency tracking | FR154 | Decision similarity scoring |
| No fine-tuning pipeline | FR155 | Training data export + versioned prompts |

---

## 3. Functional Requirements

### FR150: Decision Indexing
- Every Council decision indexed with structured metadata
- Metadata: action type, risk level, outcome, validator votes, rationale
- Automatic extraction from decision payload
- Full-text search enabled

### FR151: Semantic Similarity Search
- Vector embeddings for decision context and rationale
- Similarity search using pgvector
- Find precedents even when wording differs
- Threshold-based relevance scoring

### FR152: Validator Precedent Context
- Before voting, validators receive relevant precedents
- Format: "Similar case #4721 was approved because..."
- Arbiter validator specifically uses precedent matching
- Context injected into system prompt

### FR153: Arbiter Precedent Specialization
- Arbiter validator trained on precedent matching
- Consistency enforcement is primary responsibility
- Can flag potential inconsistencies
- Recommends citing specific precedents

### FR154: Consistency Tracking
- Track decision consistency scores
- Similar cases should yield similar outcomes
- Dashboard showing consistency metrics
- Alert when inconsistency detected

### FR155: Validator Fine-Tuning Pipeline
- Export training data for prompt refinement
- Quarterly fine-tuning cycles (manual for MVP)
- Versioned validator prompts
- A/B testing capability

### FR156: Measurable Improvement
- Track Council accuracy over time
- Consistency score as primary metric
- Decision reversal rate tracking
- Human override rate trending

---

## 4. Database Schema

### 4.1 Extend `council_precedents` Table

```sql
-- Add columns to existing table
ALTER TABLE council_precedents
  ADD COLUMN IF NOT EXISTS embedding vector(1536),  -- OpenAI ada-002 dimension
  ADD COLUMN IF NOT EXISTS structured_metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS consistency_score FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES council_precedents(id),
  ADD COLUMN IF NOT EXISTS is_canonical BOOLEAN DEFAULT false;

-- Vector similarity index
CREATE INDEX IF NOT EXISTS idx_precedents_embedding
  ON council_precedents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

### 4.2 New Table: `precedent_similarity_cache`

```sql
CREATE TABLE precedent_similarity_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  precedent_a_id UUID NOT NULL REFERENCES council_precedents(id),
  precedent_b_id UUID NOT NULL REFERENCES council_precedents(id),
  similarity_score FLOAT NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(precedent_a_id, precedent_b_id)
);

CREATE INDEX idx_similarity_a ON precedent_similarity_cache(precedent_a_id);
CREATE INDEX idx_similarity_score ON precedent_similarity_cache(similarity_score DESC);
```

### 4.3 New Table: `decision_consistency_log`

```sql
CREATE TABLE decision_consistency_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES council_decisions(id),

  -- Similar decisions found
  similar_decisions JSONB NOT NULL DEFAULT '[]',
  -- [{id, similarity_score, outcome}]

  -- Consistency analysis
  expected_outcome TEXT, -- What similar decisions suggest
  actual_outcome TEXT,   -- What was decided
  is_consistent BOOLEAN NOT NULL,
  consistency_score FLOAT NOT NULL,

  -- If inconsistent
  inconsistency_reason TEXT,
  was_justified BOOLEAN DEFAULT false,
  justification TEXT,

  analyzed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_consistency_decision ON decision_consistency_log(decision_id);
CREATE INDEX idx_consistency_score ON decision_consistency_log(consistency_score);
```

### 4.4 New Table: `validator_prompt_versions`

```sql
CREATE TABLE validator_prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  validator_id TEXT NOT NULL, -- guardian, arbiter, etc.
  version INT NOT NULL,
  prompt_template TEXT NOT NULL,

  -- Training context
  based_on_precedent_count INT,
  training_date_range JSONB, -- {from, to}

  -- Performance
  consistency_score_at_creation FLOAT,
  decisions_made INT DEFAULT 0,
  is_active BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  activated_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,

  UNIQUE(validator_id, version)
);

CREATE INDEX idx_prompt_validator ON validator_prompt_versions(validator_id);
CREATE INDEX idx_prompt_active ON validator_prompt_versions(is_active) WHERE is_active = true;
```

---

## 5. Service Layer

### 5.1 Enhanced Precedent Service

```typescript
// lib/council/precedent-flywheel.ts

interface DecisionMetadata {
  actionType: string;
  actionCategory: string;
  riskLevel: number;
  outcome: 'approved' | 'denied' | 'escalated';
  votes: ValidatorVote[];
  synthesisReasoning: string;
  keyFactors: string[];
  agentTrustTier: string;
  hasHumanOverride: boolean;
}

// FR150: Decision Indexing
export async function indexDecision(
  decisionId: string,
  metadata: DecisionMetadata
): Promise<void> {
  // 1. Extract structured metadata
  // 2. Generate embedding for decision context
  // 3. Store in council_precedents
  // 4. Update search index
}

// FR151: Semantic Similarity Search
export async function findSimilarPrecedents(
  context: string,
  options?: {
    actionType?: string;
    minSimilarity?: number;
    limit?: number;
  }
): Promise<SimilarPrecedent[]> {
  // 1. Generate embedding for context
  // 2. Vector similarity search using pgvector
  // 3. Apply filters
  // 4. Return ranked results
}

// FR152: Validator Context Injection
export async function getPrecedentContextForValidator(
  actionType: string,
  actionContext: string,
  validatorId: string
): Promise<string> {
  // 1. Find relevant precedents
  // 2. Format for validator consumption
  // 3. Return formatted context string
  // Example output:
  // "RELEVANT PRECEDENTS:
  //  1. Case #4721 (92% similar): APPROVED - External API call to trusted provider
  //     Reasoning: Provider on approved list, data minimal, rate limited
  //  2. Case #3892 (87% similar): DENIED - External API call to unknown provider
  //     Reasoning: Provider not vetted, potential data exposure"
}
```

### 5.2 Consistency Service

```typescript
// lib/council/consistency-service.ts

// FR154: Consistency Tracking
export async function analyzeDecisionConsistency(
  decisionId: string
): Promise<ConsistencyAnalysis> {
  // 1. Find similar past decisions
  // 2. Compare outcomes
  // 3. Calculate consistency score
  // 4. Log analysis
  // 5. Alert if inconsistent
}

export async function getConsistencyMetrics(
  timeRange?: { from: Date; to: Date }
): Promise<ConsistencyMetrics> {
  // 1. Aggregate consistency scores
  // 2. Calculate trends
  // 3. Identify problem areas
}

export async function getInconsistentDecisions(
  limit?: number
): Promise<InconsistentDecision[]> {
  // For review and potential correction
}
```

### 5.3 Fine-Tuning Pipeline

```typescript
// lib/council/fine-tuning-service.ts

// FR155: Training Data Export
export async function exportTrainingData(
  validatorId: string,
  options?: {
    fromDate?: Date;
    toDate?: Date;
    minConsistencyScore?: number;
    includeRationale?: boolean;
  }
): Promise<TrainingDataset> {
  // 1. Fetch relevant decisions
  // 2. Filter by quality/consistency
  // 3. Format for fine-tuning
  // 4. Return dataset
}

export async function createPromptVersion(
  validatorId: string,
  promptTemplate: string,
  metadata: {
    basedOnPrecedentCount: number;
    trainingDateRange: { from: Date; to: Date };
    consistencyScoreAtCreation: number;
  }
): Promise<PromptVersion> {
  // Create new versioned prompt
}

export async function activatePromptVersion(
  validatorId: string,
  version: number
): Promise<void> {
  // Activate specific version for production use
}
```

---

## 6. Integration Points

### 6.1 Council Service Integration

```typescript
// lib/council/council-service.ts - Update

async function evaluateWithCouncil(request: CouncilRequest) {
  // NEW: Inject precedent context into each validator
  const precedentContext = await getPrecedentContextForValidator(
    request.actionType,
    request.actionDetails,
    'all' // Get context for all validators
  );

  // Modify validator prompts with context
  const validatorPrompts = await getActiveValidatorPrompts();
  const enhancedPrompts = validatorPrompts.map(p => ({
    ...p,
    systemPrompt: `${p.systemPrompt}\n\n${precedentContext}`
  }));

  // Run evaluation
  const votes = await evaluateWithValidators(request, enhancedPrompts);

  // Record decision
  const decision = await recordDecision(request, votes);

  // NEW: Post-decision processing
  await indexDecision(decision.id, extractMetadata(decision));
  await analyzeDecisionConsistency(decision.id);

  return decision;
}
```

### 6.2 Arbiter Validator Enhancement

```typescript
// Special handling for Arbiter validator (FR153)
const ARBITER_ENHANCED_PROMPT = `
You are the ARBITER - Guardian of Consistency and Precedent.

PRIMARY RESPONSIBILITIES:
1. Ensure this decision is CONSISTENT with similar past decisions
2. Cite specific precedents that support or contradict the proposed action
3. Flag if this decision would create an INCONSISTENCY
4. Recommend how to maintain consistency while achieving the right outcome

PRECEDENT CITATION FORMAT:
"Per Precedent #[ID]: [summary of similar case and outcome]"

If no relevant precedent exists, state: "No relevant precedent found. This decision may establish new precedent for [category]."

{PRECEDENT_CONTEXT}

Now evaluate the following request...
`;
```

---

## 7. UI Components

### 7.1 New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `PrecedentSimilarityPanel` | `components/council/` | Show similar precedents during deliberation |
| `ConsistencyDashboard` | `app/(dashboard)/council/consistency/` | Metrics and trends |
| `InconsistencyReviewList` | `components/council/` | Review inconsistent decisions |
| `ValidatorPromptManager` | `app/(dashboard)/admin/validators/` | Manage prompt versions |
| `TrainingDataExporter` | `components/admin/` | Export training data |

### 7.2 Council Decision View Enhancement

```typescript
// Show precedent context on decision detail page
<CouncilDecisionDetail>
  <PrecedentSimilarityPanel decisionId={decisionId} />
  <ConsistencyIndicator score={consistencyScore} />
  {!isConsistent && (
    <InconsistencyAlert
      expected={expectedOutcome}
      actual={actualOutcome}
      justification={justification}
    />
  )}
</CouncilDecisionDetail>
```

---

## 8. Metrics & Dashboard (FR156)

### Key Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| Consistency Score | % of decisions matching similar precedents | >85% |
| Human Override Rate | % of decisions overridden by humans | <5% (trending down) |
| Precedent Coverage | % of decisions with relevant precedents | >70% |
| Average Similarity Score | Mean similarity of cited precedents | >0.75 |
| Decision Reversal Rate | % of decisions later reversed | <2% |

### Dashboard Features

- Real-time consistency score trend
- Inconsistency alerts and review queue
- Precedent library growth chart
- Validator performance by consistency
- Monthly governance quality report

---

## 9. Story Breakdown

### Story 14-1: Decision Indexing
- Extend council_precedents schema
- `indexDecision()` function with metadata extraction
- Automatic indexing after each decision
- Migration to index existing decisions

### Story 14-2: Precedent Similarity Search
- pgvector setup for semantic search
- Embedding generation (OpenAI ada-002)
- `findSimilarPrecedents()` with vector search
- Similarity threshold configuration

### Story 14-3: Validator Precedent Context
- `getPrecedentContextForValidator()` function
- Inject into validator prompts
- Arbiter specialization (FR153)
- UI to show precedent context in deliberation view

### Story 14-4: Consistency Tracking
- `decision_consistency_log` table
- `analyzeDecisionConsistency()` function
- Consistency metrics dashboard
- Inconsistency alerts and review flow

### Story 14-5: Validator Fine-Tuning Pipeline
- `validator_prompt_versions` table
- Training data export function
- Prompt version management UI
- Manual fine-tuning process documentation

---

## 10. Implementation Priorities

**Phase 1: Foundation (Stories 14-1, 14-2)**
- Schema extensions
- Vector embeddings
- Basic similarity search

**Phase 2: Integration (Story 14-3)**
- Validator context injection
- Arbiter enhancement
- UI updates

**Phase 3: Intelligence (Stories 14-4, 14-5)**
- Consistency tracking
- Fine-tuning pipeline
- Metrics dashboard

---

## 11. Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| pgvector extension | Database | For vector similarity |
| OpenAI Embeddings API | External | For text embeddings |
| Existing precedent-service | Internal | Extend, don't replace |
| Council service | Internal | Integration point |
| Supabase | Database | Vector support required |

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| pgvector not available | Fall back to keyword search |
| Embedding API costs | Cache embeddings, batch processing |
| False similarity matches | Tunable threshold, human review |
| Inconsistency false positives | Justification workflow |
| Prompt version regression | A/B testing, rollback capability |

---

## 13. Competitive Moat Analysis

**Why This Cannot Be Replicated:**

1. **Data Moat:** Every decision adds to proprietary corpus
2. **Time Moat:** Years of governance wisdom accumulated
3. **Network Effect:** More users → more decisions → smarter Council → more trust → more users
4. **Fine-Tuning Advantage:** Validator prompts refined on real governance data
5. **Consistency Reputation:** Provably consistent governance builds trust

**Patent Opportunities:**
- Semantic precedent matching for AI governance
- Consistency-aware multi-agent deliberation
- Self-improving governance through precedent learning

---

*Epic 14 Tech Context generated by BMad Master*
*AgentAnchor Growth Phase - DATA MOAT Builder*
*"The more we govern, the better we govern."*
