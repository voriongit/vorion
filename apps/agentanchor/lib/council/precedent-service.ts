// Precedent Service
// Manages the precedent library for Council decision consistency

import { createClient } from '@/lib/supabase/server'
import { RiskLevel, CouncilDecision } from './types'
import { canonicalToNumericRisk } from './risk-assessment'

export interface Precedent {
  id: string
  title: string
  summary: string
  action_type: string
  risk_level: RiskLevel
  outcome: 'approved' | 'denied' | 'escalated'
  reasoning: string
  tags: string[]
  category: string
  context_summary?: string
  votes_summary?: any[]
  times_cited: number
  created_at: string
}

export interface CreatePrecedentInput {
  title: string
  summary: string
  actionType: string
  riskLevel: RiskLevel
  outcome: 'approved' | 'denied' | 'escalated'
  reasoning: string
  tags?: string[]
  category?: string
  contextSummary?: string
  votesSummary?: any[]
  decisionId?: string
  requestId?: string
}

/**
 * Create a new precedent from a significant decision
 */
export async function createPrecedent(input: CreatePrecedentInput): Promise<Precedent | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('council_precedents')
    .insert({
      title: input.title,
      summary: input.summary,
      action_type: input.actionType,
      risk_level: input.riskLevel,
      outcome: input.outcome,
      reasoning: input.reasoning,
      tags: input.tags || [],
      category: input.category || 'general',
      context_summary: input.contextSummary,
      votes_summary: input.votesSummary || [],
      decision_id: input.decisionId,
      request_id: input.requestId,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating precedent:', error)
    return null
  }

  return data as Precedent
}

/**
 * Create a precedent from a Council decision (if significant enough)
 */
export async function createPrecedentFromDecision(
  decision: CouncilDecision,
  actionType: string,
  actionDetails: string,
  riskLevel: RiskLevel
): Promise<Precedent | null> {
  // Only create precedents for L3+ decisions with clear outcomes
  const numericRisk = typeof riskLevel === 'number' ? riskLevel : canonicalToNumericRisk(riskLevel)
  if (numericRisk < 3 || decision.outcome === 'pending') {
    return null
  }

  // Generate title from action type
  const outcomeText = decision.outcome === 'approved' ? 'Approved' :
                      decision.outcome === 'denied' ? 'Denied' : 'Escalated'
  const title = `${actionType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} - ${outcomeText}`

  // Generate summary
  const summary = `${outcomeText}: ${actionDetails.substring(0, 200)}${actionDetails.length > 200 ? '...' : ''}`

  // Extract tags from action type and details
  const tags = extractTags(actionType, actionDetails)

  // Determine category based on which validators were most concerned
  const category = determineCategory(decision.votes)

  return createPrecedent({
    title,
    summary,
    actionType,
    riskLevel,
    outcome: decision.outcome as 'approved' | 'denied' | 'escalated',
    reasoning: decision.finalReasoning,
    tags,
    category,
    contextSummary: actionDetails,
    votesSummary: decision.votes,
    decisionId: decision.id,
    requestId: decision.requestId,
  })
}

/**
 * Search precedents by query
 */
export async function searchPrecedents(
  query: string,
  options?: {
    actionType?: string
    outcome?: string
    riskLevel?: RiskLevel
    category?: string
    tags?: string[]
    limit?: number
  }
): Promise<Precedent[]> {
  const supabase = createClient()

  let queryBuilder = supabase
    .from('council_precedents')
    .select('*')

  // Full-text search if query provided
  if (query && query.trim()) {
    queryBuilder = queryBuilder.textSearch('search_vector', query.trim(), {
      type: 'websearch',
      config: 'english',
    })
  }

  // Filters
  if (options?.actionType) {
    queryBuilder = queryBuilder.eq('action_type', options.actionType)
  }
  if (options?.outcome) {
    queryBuilder = queryBuilder.eq('outcome', options.outcome)
  }
  if (options?.riskLevel !== undefined) {
    queryBuilder = queryBuilder.eq('risk_level', options.riskLevel)
  }
  if (options?.category) {
    queryBuilder = queryBuilder.eq('category', options.category)
  }
  if (options?.tags && options.tags.length > 0) {
    queryBuilder = queryBuilder.overlaps('tags', options.tags)
  }

  // Ordering and limit
  queryBuilder = queryBuilder
    .order('times_cited', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(options?.limit || 20)

  const { data, error } = await queryBuilder

  if (error) {
    console.error('Error searching precedents:', error)
    return []
  }

  return data as Precedent[]
}

/**
 * Get precedent by ID
 */
export async function getPrecedentById(id: string): Promise<Precedent | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('council_precedents')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching precedent:', error)
    return null
  }

  return data as Precedent
}

/**
 * Get recent precedents
 */
export async function getRecentPrecedents(limit: number = 10): Promise<Precedent[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('council_precedents')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching recent precedents:', error)
    return []
  }

  return data as Precedent[]
}

/**
 * Get most cited precedents
 */
export async function getMostCitedPrecedents(limit: number = 10): Promise<Precedent[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('council_precedents')
    .select('*')
    .order('times_cited', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching cited precedents:', error)
    return []
  }

  return data as Precedent[]
}

/**
 * Find relevant precedents for a new request
 */
export async function findRelevantPrecedents(
  actionType: string,
  actionDetails: string,
  limit: number = 5
): Promise<Precedent[]> {
  // Search by action type first
  let precedents = await searchPrecedents('', {
    actionType,
    limit,
  })

  // If not enough, search by keywords
  if (precedents.length < limit) {
    const keywords = extractKeywords(actionDetails)
    if (keywords.length > 0) {
      const keywordPrecedents = await searchPrecedents(keywords.join(' | '), {
        limit: limit - precedents.length,
      })
      // Deduplicate
      const existingIds = new Set(precedents.map(p => p.id))
      precedents = [
        ...precedents,
        ...keywordPrecedents.filter(p => !existingIds.has(p.id)),
      ]
    }
  }

  return precedents
}

/**
 * Record a citation of a precedent
 */
export async function citePrecedent(
  precedentId: string,
  decisionId?: string,
  context?: string
): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('precedent_citations')
    .insert({
      precedent_id: precedentId,
      decision_id: decisionId,
      context,
    })

  if (error) {
    console.error('Error citing precedent:', error)
    return false
  }

  return true
}

// Helper functions

function extractTags(actionType: string, details: string): string[] {
  const tags = new Set<string>()

  // Add action type as tag
  tags.add(actionType.replace(/_/g, '-'))

  // Common tag keywords
  const tagKeywords: Record<string, string[]> = {
    'security': ['security', 'secure', 'vulnerability', 'attack', 'threat'],
    'privacy': ['privacy', 'personal', 'pii', 'gdpr', 'data-protection'],
    'api': ['api', 'endpoint', 'external', 'webhook'],
    'email': ['email', 'mail', 'send', 'notification'],
    'financial': ['payment', 'money', 'billing', 'transaction', 'financial'],
    'code': ['code', 'execute', 'script', 'program'],
    'data': ['data', 'database', 'storage', 'file'],
  }

  const lowerDetails = details.toLowerCase()
  for (const [tag, keywords] of Object.entries(tagKeywords)) {
    if (keywords.some(kw => lowerDetails.includes(kw))) {
      tags.add(tag)
    }
  }

  return Array.from(tags).slice(0, 10)
}

function extractKeywords(text: string): string[] {
  // Simple keyword extraction - remove common words, keep significant ones
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'to', 'of', 'in', 'for', 'on', 'with',
    'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after',
    'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once',
    'this', 'that', 'these', 'those', 'and', 'but', 'or', 'nor', 'so', 'yet',
  ])

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 5)
}

function determineCategory(votes: any[]): string {
  // Determine category based on which validator had strongest opinion
  const denyVotes = votes.filter(v => v.decision === 'deny')

  if (denyVotes.length === 0) {
    return 'general'
  }

  // Check which validator denied with highest confidence
  const highestConfidenceDeny = denyVotes.reduce((max, v) =>
    v.confidence > max.confidence ? v : max
  , denyVotes[0])

  const categoryMap: Record<string, string> = {
    guardian: 'security',
    arbiter: 'ethics',
    scholar: 'compliance',
    advocate: 'user-impact',
  }

  return categoryMap[highestConfidenceDeny.validatorId] || 'general'
}
