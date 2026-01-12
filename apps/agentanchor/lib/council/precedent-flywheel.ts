/**
 * Precedent Flywheel Service
 * Epic 14: AI-powered governance that learns from decisions [MOAT BUILDER]
 *
 * Story 14-1: Decision Indexing with Embeddings
 * Story 14-2: Precedent Similarity Search (pgvector)
 * Story 14-3: Validator Precedent Context
 */

import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import crypto from 'crypto'

// =============================================================================
// Types
// =============================================================================

export interface PrecedentWithSimilarity {
  id: string
  title: string
  summary: string
  outcome: 'approved' | 'denied' | 'escalated'
  reasoning: string
  similarity: number
  actionType: string
  riskLevel: number
  tags: string[]
}

export interface SimilaritySearchOptions {
  threshold?: number // Minimum similarity (0-1)
  limit?: number // Max results
  actionType?: string // Filter by action type
  outcomeFilter?: 'approved' | 'denied' | 'escalated' // Filter by outcome
  useCache?: boolean // Use cached results
}

export interface ValidatorContext {
  relevantPrecedents: PrecedentWithSimilarity[]
  consistencyWarnings: string[]
  suggestedOutcome: 'approve' | 'deny' | 'escalate' | null
  confidence: number
}

// =============================================================================
// OpenAI Client (for embeddings)
// =============================================================================

let openaiClient: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

// =============================================================================
// Story 14-1: Decision Indexing
// =============================================================================

/**
 * Generate embedding for text using OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI()

  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text.slice(0, 8000), // Limit input length
  })

  return response.data[0].embedding
}

/**
 * Index a precedent with embedding
 */
export async function indexPrecedent(precedentId: string): Promise<boolean> {
  const supabase = await createClient()

  // Get precedent data
  const { data: precedent, error } = await supabase
    .from('council_precedents')
    .select('id, title, summary, reasoning, action_type, tags')
    .eq('id', precedentId)
    .single()

  if (error || !precedent) {
    console.error('Precedent not found:', precedentId)
    return false
  }

  // Create text for embedding
  const embeddingText = [
    precedent.title,
    precedent.summary,
    precedent.reasoning,
    precedent.action_type,
    ...(precedent.tags || []),
  ].filter(Boolean).join('\n')

  try {
    const embedding = await generateEmbedding(embeddingText)

    // Update precedent with embedding
    const { error: updateError } = await supabase
      .from('council_precedents')
      .update({
        embedding: `[${embedding.join(',')}]`,
        indexed_at: new Date().toISOString(),
        embedding_model: 'text-embedding-ada-002',
      })
      .eq('id', precedentId)

    if (updateError) {
      console.error('Error updating precedent embedding:', updateError)
      return false
    }

    return true
  } catch (e) {
    console.error('Error generating embedding:', e)
    return false
  }
}

/**
 * Index all unindexed precedents (batch job)
 */
export async function indexAllPrecedents(): Promise<{ indexed: number; errors: number }> {
  const supabase = await createClient()

  // Get unindexed precedents
  const { data: precedents } = await supabase
    .from('council_precedents')
    .select('id')
    .is('indexed_at', null)
    .limit(100)

  if (!precedents || precedents.length === 0) {
    return { indexed: 0, errors: 0 }
  }

  let indexed = 0
  let errors = 0

  for (const p of precedents) {
    const success = await indexPrecedent(p.id)
    if (success) {
      indexed++
    } else {
      errors++
    }

    // Rate limit - 1 per 100ms
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return { indexed, errors }
}

// =============================================================================
// Story 14-2: Precedent Similarity Search
// =============================================================================

/**
 * Find similar precedents using vector similarity
 */
export async function findSimilarPrecedents(
  queryText: string,
  options: SimilaritySearchOptions = {}
): Promise<PrecedentWithSimilarity[]> {
  const {
    threshold = 0.7,
    limit = 5,
    actionType,
    outcomeFilter,
    useCache = true,
  } = options

  const supabase = await createClient()

  // Check cache first
  if (useCache) {
    const queryHash = hashQuery(queryText)
    const cached = await getCachedResults(queryHash)
    if (cached) {
      return cached
    }
  }

  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(queryText)

  // Use pgvector similarity search via RPC
  const { data, error } = await supabase.rpc('find_similar_precedents', {
    query_embedding: `[${queryEmbedding.join(',')}]`,
    match_threshold: threshold,
    match_count: limit,
  })

  if (error) {
    console.error('Similarity search error:', error)
    // Fallback to basic search
    return fallbackKeywordSearch(queryText, { actionType, outcomeFilter, limit })
  }

  // Get full precedent data
  const precedentIds = data.map((d: any) => d.id)
  const { data: fullPrecedents } = await supabase
    .from('council_precedents')
    .select('*')
    .in('id', precedentIds)

  if (!fullPrecedents) {
    return []
  }

  // Map results with similarity scores
  let results: PrecedentWithSimilarity[] = data.map((d: any) => {
    const full = fullPrecedents.find(p => p.id === d.id)
    return {
      id: d.id,
      title: d.title,
      summary: d.summary,
      outcome: d.outcome,
      reasoning: full?.reasoning || '',
      similarity: d.similarity,
      actionType: full?.action_type || '',
      riskLevel: full?.risk_level || 0,
      tags: full?.tags || [],
    }
  })

  // Apply filters
  if (actionType) {
    results = results.filter(r => r.actionType === actionType)
  }
  if (outcomeFilter) {
    results = results.filter(r => r.outcome === outcomeFilter)
  }

  // Cache results
  if (useCache && results.length > 0) {
    await cacheResults(hashQuery(queryText), queryText, results)
  }

  return results
}

/**
 * Fallback to keyword-based search when vector search unavailable
 */
async function fallbackKeywordSearch(
  queryText: string,
  options: { actionType?: string; outcomeFilter?: string; limit?: number }
): Promise<PrecedentWithSimilarity[]> {
  const supabase = await createClient()

  let query = supabase
    .from('council_precedents')
    .select('*')
    .order('times_cited', { ascending: false })
    .limit(options.limit || 5)

  if (options.actionType) {
    query = query.eq('action_type', options.actionType)
  }
  if (options.outcomeFilter) {
    query = query.eq('outcome', options.outcomeFilter)
  }

  const { data } = await query

  return (data || []).map(d => ({
    id: d.id,
    title: d.title,
    summary: d.summary,
    outcome: d.outcome,
    reasoning: d.reasoning,
    similarity: 0.5, // Default similarity for fallback
    actionType: d.action_type,
    riskLevel: d.risk_level,
    tags: d.tags || [],
  }))
}

// =============================================================================
// Story 14-3: Validator Precedent Context
// =============================================================================

/**
 * Build context for validators including relevant precedents
 */
export async function buildValidatorContext(
  actionDescription: string,
  actionType: string,
  riskLevel: number
): Promise<ValidatorContext> {
  // Find similar precedents
  const relevantPrecedents = await findSimilarPrecedents(
    `${actionType}: ${actionDescription}`,
    {
      threshold: 0.65,
      limit: 5,
    }
  )

  // Analyze precedent outcomes
  const approveCount = relevantPrecedents.filter(p => p.outcome === 'approved').length
  const denyCount = relevantPrecedents.filter(p => p.outcome === 'denied').length
  const escalateCount = relevantPrecedents.filter(p => p.outcome === 'escalated').length

  // Check for consistency warnings
  const consistencyWarnings: string[] = []

  // High similarity with mixed outcomes suggests unclear precedent
  const highSimilarity = relevantPrecedents.filter(p => p.similarity > 0.85)
  if (highSimilarity.length > 1) {
    const outcomes = new Set(highSimilarity.map(p => p.outcome))
    if (outcomes.size > 1) {
      consistencyWarnings.push(
        'Similar cases have resulted in different outcomes - careful evaluation required'
      )
    }
  }

  // Risk level mismatch
  const avgRisk = relevantPrecedents.length > 0
    ? relevantPrecedents.reduce((sum, p) => sum + p.riskLevel, 0) / relevantPrecedents.length
    : 0

  if (Math.abs(riskLevel - avgRisk) > 1) {
    consistencyWarnings.push(
      `Current risk level (${riskLevel}) differs significantly from similar cases (avg: ${avgRisk.toFixed(1)})`
    )
  }

  // Determine suggested outcome based on precedent majority
  let suggestedOutcome: ValidatorContext['suggestedOutcome'] = null
  let confidence = 0

  if (relevantPrecedents.length >= 3) {
    const total = approveCount + denyCount + escalateCount
    if (approveCount > denyCount && approveCount > escalateCount) {
      suggestedOutcome = 'approve'
      confidence = approveCount / total
    } else if (denyCount > approveCount && denyCount > escalateCount) {
      suggestedOutcome = 'deny'
      confidence = denyCount / total
    } else if (escalateCount > 0) {
      suggestedOutcome = 'escalate'
      confidence = escalateCount / total
    }
  }

  return {
    relevantPrecedents,
    consistencyWarnings,
    suggestedOutcome,
    confidence,
  }
}

/**
 * Format precedents for validator prompt injection
 */
export function formatPrecedentsForPrompt(
  precedents: PrecedentWithSimilarity[],
  maxLength: number = 2000
): string {
  if (precedents.length === 0) {
    return 'No relevant precedents found.'
  }

  const lines: string[] = ['## Relevant Precedents\n']

  for (const p of precedents) {
    const entry = `### ${p.title} (${Math.round(p.similarity * 100)}% similar)
- **Outcome:** ${p.outcome}
- **Summary:** ${p.summary}
- **Reasoning:** ${p.reasoning.slice(0, 200)}${p.reasoning.length > 200 ? '...' : ''}
`
    if (lines.join('\n').length + entry.length > maxLength) {
      break
    }
    lines.push(entry)
  }

  return lines.join('\n')
}

// =============================================================================
// Caching
// =============================================================================

function hashQuery(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 32)
}

async function getCachedResults(queryHash: string): Promise<PrecedentWithSimilarity[] | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('precedent_similarity_cache')
    .select('similar_precedent_ids, similarity_scores')
    .eq('query_hash', queryHash)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!data) {
    return null
  }

  // Hit count increment skipped (handled via analytics)
  

  // Fetch full precedent data
  const { data: precedents } = await supabase
    .from('council_precedents')
    .select('*')
    .in('id', data.similar_precedent_ids)

  if (!precedents) {
    return null
  }

  return precedents.map((p, i) => ({
    id: p.id,
    title: p.title,
    summary: p.summary,
    outcome: p.outcome,
    reasoning: p.reasoning,
    similarity: data.similarity_scores[i] || 0,
    actionType: p.action_type,
    riskLevel: p.risk_level,
    tags: p.tags || [],
  }))
}

async function cacheResults(
  queryHash: string,
  queryText: string,
  results: PrecedentWithSimilarity[]
): Promise<void> {
  const supabase = await createClient()

  await supabase
    .from('precedent_similarity_cache')
    .upsert({
      query_hash: queryHash,
      query_text: queryText.slice(0, 500),
      similar_precedent_ids: results.map(r => r.id),
      similarity_scores: results.map(r => r.similarity),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    }, {
      onConflict: 'query_hash',
    })
}
