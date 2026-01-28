/**
 * Cognigate Governance Middleware
 *
 * Integrates Aurais with the Cognigate API for real governance enforcement.
 * See: https://cognigate.dev/docs
 */

const COGNIGATE_URL = process.env.COGNIGATE_API_URL || 'https://cognigate.dev'
const COGNIGATE_KEY = process.env.COGNIGATE_API_KEY

// BASIS Trust Tiers
export const TRUST_TIERS = {
  SANDBOX: { min: 0, max: 99, name: 'sandbox' },
  PROVISIONAL: { min: 100, max: 299, name: 'provisional' },
  STANDARD: { min: 300, max: 499, name: 'standard' },
  TRUSTED: { min: 500, max: 699, name: 'trusted' },
  CERTIFIED: { min: 700, max: 899, name: 'certified' },
  AUTONOMOUS: { min: 900, max: 1000, name: 'autonomous' },
} as const

export type TrustTier = typeof TRUST_TIERS[keyof typeof TRUST_TIERS]['name']
export type GovernanceDecision = 'ALLOW' | 'DENY' | 'ESCALATE' | 'DEGRADE'

export interface Intent {
  intent_id: string
  entity_id: string
  action: {
    type: string
    subtype?: string
    description: string
  }
  target_resources?: string[]
  capabilities_required: string[]
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  warnings: string[]
  parsed_at: string
}

export interface GovernanceResult {
  decision: GovernanceDecision
  intentId: string
  proofId: string
  trustScore: number
  trustTier: TrustTier
  capabilitiesGranted: string[]
  capabilitiesDenied?: string[]
  denialReason?: string
  escalationReason?: string
  escalationId?: string
  decidedAt: string
}

export interface TrustStatus {
  entityId: string
  score: number
  tier: TrustTier
  capabilities: string[]
  scoreHistory?: {
    '7d_change': number
    '30d_change': number
  }
  lastAction?: string
  createdAt: string
}

export interface ProofRecord {
  proofId: string
  intentId: string
  timestamp: string
  payloadHash: string
  previousProofId?: string
  previousHash?: string
  sequenceNumber: number
  signature: string
}

/**
 * Get headers for Cognigate API requests
 */
function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  if (COGNIGATE_KEY) {
    headers['Authorization'] = `Bearer ${COGNIGATE_KEY}`
  }
  return headers
}

/**
 * Parse user message into structured intent
 */
export async function parseIntent(
  entityId: string,
  rawInput: string,
  context?: {
    source?: string
    conversationId?: string
    timestamp?: string
  }
): Promise<Intent> {
  const response = await fetch(`${COGNIGATE_URL}/v1/intent`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      entity_id: entityId,
      raw_input: rawInput,
      context: {
        source: context?.source || 'aurais-chat',
        conversation_id: context?.conversationId,
        timestamp: context?.timestamp || new Date().toISOString(),
      },
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error?.message || `Intent parsing failed: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Enforce governance on a parsed intent
 */
export async function enforceGovernance(
  intent: Intent,
  options?: {
    dryRun?: boolean
    skipProof?: boolean
  }
): Promise<GovernanceResult> {
  const response = await fetch(`${COGNIGATE_URL}/v1/enforce`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      intent,
      options: {
        dry_run: options?.dryRun ?? false,
        skip_proof: options?.skipProof ?? false,
      },
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error?.message || `Enforcement failed: ${response.statusText}`)
  }

  const result = await response.json()

  return {
    decision: result.decision,
    intentId: result.intent_id,
    proofId: result.proof_id,
    trustScore: result.trust_score,
    trustTier: result.trust_tier,
    capabilitiesGranted: result.capabilities_granted || [],
    capabilitiesDenied: result.capabilities_denied,
    denialReason: result.denial_reason,
    escalationReason: result.escalation_reason,
    escalationId: result.escalation_id,
    decidedAt: result.decided_at,
  }
}

/**
 * Get current trust status for an entity
 */
export async function getTrustStatus(entityId: string): Promise<TrustStatus> {
  const response = await fetch(`${COGNIGATE_URL}/v1/entity/${entityId}/score`, {
    headers: getHeaders(),
  })

  if (!response.ok) {
    // Return default for new entities
    return {
      entityId,
      score: 100,
      tier: 'provisional',
      capabilities: ['sandbox:*', 'data:read/public'],
      createdAt: new Date().toISOString(),
    }
  }

  const result = await response.json()

  return {
    entityId: result.entity_id,
    score: result.trust_score,
    tier: result.trust_tier,
    capabilities: result.capabilities,
    scoreHistory: result.score_history,
    lastAction: result.last_action,
    createdAt: result.created_at,
  }
}

/**
 * Submit action outcome to update trust score
 */
export async function submitOutcome(
  entityId: string,
  proofId: string,
  outcome: 'success' | 'failure' | 'partial',
  feedback?: {
    userRating?: number
    flags?: string[]
  }
): Promise<void> {
  const response = await fetch(`${COGNIGATE_URL}/v1/entity/${entityId}/outcome`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      proof_id: proofId,
      outcome,
      feedback,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error?.message || `Outcome submission failed: ${response.statusText}`)
  }
}

/**
 * Get proof record by ID
 */
export async function getProof(proofId: string): Promise<ProofRecord> {
  const response = await fetch(`${COGNIGATE_URL}/v1/proof/${proofId}`, {
    headers: getHeaders(),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error?.message || `Proof retrieval failed: ${response.statusText}`)
  }

  const result = await response.json()

  return {
    proofId: result.proof_id,
    intentId: result.intent_id,
    timestamp: result.timestamp,
    payloadHash: result.payload_hash,
    previousProofId: result.previous_proof_id,
    previousHash: result.previous_hash,
    sequenceNumber: result.sequence_number,
    signature: result.signature,
  }
}

/**
 * Get proof chain statistics
 */
export async function getProofStats(): Promise<{
  chainLength: number
  lastProofAt: string
  status: 'healthy' | 'degraded'
}> {
  const response = await fetch(`${COGNIGATE_URL}/v1/proof/stats`, {
    headers: getHeaders(),
  })

  if (!response.ok) {
    return {
      chainLength: 0,
      lastProofAt: new Date().toISOString(),
      status: 'degraded',
    }
  }

  const result = await response.json()

  return {
    chainLength: result.proof_chain_length,
    lastProofAt: result.last_proof_at,
    status: 'healthy',
  }
}

/**
 * Check Cognigate health
 */
export async function checkHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy'
  version: string
  basisVersion: string
  layers: {
    intent: string
    enforce: string
    proof: string
  }
}> {
  try {
    const response = await fetch(`${COGNIGATE_URL}/v1/health`, {
      headers: getHeaders(),
    })

    if (!response.ok) {
      return {
        status: 'unhealthy',
        version: 'unknown',
        basisVersion: 'unknown',
        layers: {
          intent: 'unknown',
          enforce: 'unknown',
          proof: 'unknown',
        },
      }
    }

    const result = await response.json()

    return {
      status: result.status,
      version: result.version,
      basisVersion: result.basis_version,
      layers: result.layers,
    }
  } catch {
    return {
      status: 'unhealthy',
      version: 'unknown',
      basisVersion: 'unknown',
      layers: {
        intent: 'unknown',
        enforce: 'unknown',
        proof: 'unknown',
      },
    }
  }
}

/**
 * Helper to get tier from score
 */
export function getTierFromScore(score: number): TrustTier {
  if (score >= 900) return 'autonomous'
  if (score >= 700) return 'certified'
  if (score >= 500) return 'trusted'
  if (score >= 300) return 'standard'
  if (score >= 100) return 'provisional'
  return 'sandbox'
}

/**
 * Helper to get tier color for UI
 */
export function getTierColor(tier: TrustTier): string {
  const colors: Record<TrustTier, string> = {
    sandbox: 'text-red-400',
    provisional: 'text-orange-400',
    standard: 'text-yellow-400',
    trusted: 'text-blue-400',
    certified: 'text-purple-400',
    autonomous: 'text-green-400',
  }
  return colors[tier] || 'text-gray-400'
}

/**
 * Helper to get decision color for UI
 */
export function getDecisionColor(decision: GovernanceDecision): string {
  const colors: Record<GovernanceDecision, string> = {
    ALLOW: 'bg-green-900/50 text-green-400',
    DENY: 'bg-red-900/50 text-red-400',
    ESCALATE: 'bg-yellow-900/50 text-yellow-400',
    DEGRADE: 'bg-orange-900/50 text-orange-400',
  }
  return colors[decision] || 'bg-gray-900/50 text-gray-400'
}
