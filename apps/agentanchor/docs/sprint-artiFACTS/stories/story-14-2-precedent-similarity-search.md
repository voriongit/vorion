# Story 14-2: Precedent Similarity Search

**Epic:** 14 - Precedent Flywheel
**Story ID:** 14-2
**Title:** Semantic Similarity Search with Vector Embeddings
**Status:** drafted
**Priority:** High
**Estimated Effort:** Large (8-12 hours)

---

## User Story

**As a** Council System,
**I want to** find semantically similar precedents using vector embeddings,
**So that** relevant precedents are found even when wording differs.

---

## Acceptance Criteria

### AC1: Vector Column Setup
**Given** the council_precedents table
**When** pgvector extension is enabled
**Then** embedding column (vector 1536) can store OpenAI ada-002 embeddings
**And** vector similarity index exists

### AC2: Embedding Generation
**Given** a precedent is created or updated
**When** embedding generation runs
**Then** an embedding is generated from:
- Title + Summary + Reasoning + Key Factors
**And** stored in the embedding column

### AC3: Similarity Search Function
**Given** a search query (text context)
**When** `findSimilarPrecedents()` is called
**Then** returns precedents ranked by cosine similarity
**With** similarity scores included
**And** respects minimum similarity threshold

### AC4: Hybrid Search
**Given** a search request
**When** both keyword and context are provided
**Then** results combine:
- Vector similarity (semantic)
- Full-text match (keyword)
**And** are ranked by combined score

### AC5: Performance
**Given** 10,000+ precedents
**When** similarity search runs
**Then** results return in <500ms
**And** uses IVFFlat index efficiently

### AC6: Backfill Embeddings
**Given** existing precedents without embeddings
**When** backfill job runs
**Then** embeddings are generated for all records
**And** progress is logged

---

## Technical Implementation

### Database Migration

```sql
-- Migration: 20250620000002_vector_embeddings.sql

-- Enable pgvector extension (if not already)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column
ALTER TABLE council_precedents
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create IVFFlat index for fast similarity search
-- Lists = sqrt(rows), start with 100, adjust as data grows
CREATE INDEX IF NOT EXISTS idx_precedents_embedding
  ON council_precedents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Function for similarity search
CREATE OR REPLACE FUNCTION search_similar_precedents(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  summary TEXT,
  action_type TEXT,
  outcome TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    p.id,
    p.title,
    p.summary,
    p.action_type,
    p.outcome,
    1 - (p.embedding <=> query_embedding) as similarity
  FROM council_precedents p
  WHERE p.embedding IS NOT NULL
    AND 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

### Embedding Service

```typescript
// lib/council/embedding-service.ts

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text.slice(0, 8000), // Max token limit consideration
  });

  return response.data[0].embedding;
}

export function buildEmbeddingText(precedent: Precedent): string {
  const parts = [
    precedent.title,
    precedent.summary,
    precedent.reasoning,
    `Action: ${precedent.action_type}`,
    `Outcome: ${precedent.outcome}`,
    `Risk Level: ${precedent.risk_level}`,
  ];

  if (precedent.structured_metadata?.keyFactors) {
    parts.push(`Key Factors: ${precedent.structured_metadata.keyFactors.join(', ')}`);
  }

  if (precedent.tags?.length) {
    parts.push(`Tags: ${precedent.tags.join(', ')}`);
  }

  return parts.filter(Boolean).join('\n');
}

export async function generatePrecedentEmbedding(
  precedentId: string
): Promise<void> {
  const precedent = await getPrecedentById(precedentId);
  if (!precedent) return;

  const text = buildEmbeddingText(precedent);
  const embedding = await generateEmbedding(text);

  await updatePrecedentEmbedding(precedentId, embedding);
}
```

### Similarity Search Service

```typescript
// lib/council/precedent-flywheel.ts - Add

export interface SimilarPrecedent extends Precedent {
  similarity: number;
}

export async function findSimilarPrecedents(
  context: string,
  options?: {
    actionType?: string;
    minSimilarity?: number;
    limit?: number;
    excludeIds?: string[];
  }
): Promise<SimilarPrecedent[]> {
  const minSimilarity = options?.minSimilarity ?? 0.7;
  const limit = options?.limit ?? 10;

  // Generate embedding for search context
  const queryEmbedding = await generateEmbedding(context);

  // Call database function
  const supabase = createClient();
  const { data, error } = await supabase.rpc('search_similar_precedents', {
    query_embedding: queryEmbedding,
    match_threshold: minSimilarity,
    match_count: limit * 2, // Get extra for filtering
  });

  if (error) {
    console.error('Similarity search error:', error);
    return [];
  }

  let results = data as SimilarPrecedent[];

  // Apply additional filters
  if (options?.actionType) {
    results = results.filter(p => p.action_type === options.actionType);
  }

  if (options?.excludeIds?.length) {
    const excludeSet = new Set(options.excludeIds);
    results = results.filter(p => !excludeSet.has(p.id));
  }

  return results.slice(0, limit);
}

// Hybrid search combining vector + keyword
export async function hybridSearchPrecedents(
  query: string,
  context: string,
  options?: {
    limit?: number;
    minSimilarity?: number;
  }
): Promise<SimilarPrecedent[]> {
  const limit = options?.limit ?? 10;

  // Parallel searches
  const [semanticResults, keywordResults] = await Promise.all([
    findSimilarPrecedents(context, { limit, minSimilarity: options?.minSimilarity }),
    searchPrecedents(query, { limit }),
  ]);

  // Merge and deduplicate
  const resultMap = new Map<string, SimilarPrecedent>();

  // Semantic results get base score
  for (const result of semanticResults) {
    resultMap.set(result.id, {
      ...result,
      similarity: result.similarity * 0.7, // Weighted
    });
  }

  // Keyword results add to score
  for (const result of keywordResults) {
    const existing = resultMap.get(result.id);
    if (existing) {
      existing.similarity = Math.min(1, existing.similarity + 0.3);
    } else {
      resultMap.set(result.id, {
        ...result,
        similarity: 0.3, // Keyword only score
      });
    }
  }

  // Sort by combined score
  return Array.from(resultMap.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
```

### Integration with Indexing

```typescript
// lib/council/precedent-flywheel.ts - Update indexDecision

export async function indexDecision(decisionId: string): Promise<Precedent | null> {
  // ... existing indexing logic ...

  const precedent = await upsertPrecedent({...});

  // NEW: Generate embedding asynchronously
  generatePrecedentEmbedding(precedent.id).catch(err =>
    console.error('Embedding generation failed:', err)
  );

  return precedent;
}
```

---

## API Specification

### GET /api/v1/precedents/similar

**Request Body:**
```json
{
  "context": "Agent wants to call external weather API...",
  "actionType": "external_api_call",
  "minSimilarity": 0.7,
  "limit": 5
}
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "External API Call - Approved (L3)",
      "similarity": 0.92,
      "outcome": "approved",
      "reasoning": "Trusted provider, minimal data exposure..."
    }
  ]
}
```

---

## Testing Checklist

- [ ] Unit: generateEmbedding returns 1536-dim vector
- [ ] Unit: buildEmbeddingText includes all relevant fields
- [ ] Integration: Embedding stored on precedent creation
- [ ] Integration: Similarity search returns ranked results
- [ ] Integration: Hybrid search combines semantic + keyword
- [ ] Performance: Search <500ms with 1000+ records
- [ ] E2E: Similar API returns relevant precedents

---

## Definition of Done

- [ ] pgvector extension enabled
- [ ] Schema migration applied
- [ ] Embedding service implemented
- [ ] Similarity search function working
- [ ] Hybrid search implemented
- [ ] Backfill script for existing precedents
- [ ] API endpoint implemented
- [ ] Performance validated
- [ ] Unit tests passing
- [ ] Code reviewed

---

*Story drafted: 2025-12-09*
*Epic: 14 - Precedent Flywheel*
