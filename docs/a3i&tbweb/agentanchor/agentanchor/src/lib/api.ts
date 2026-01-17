// AgentAnchor API Client

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.agentanchorai.com/v1'

// Types
export interface Agent {
  id: string
  name: string
  description?: string
  version: string
  trustScore: TrustScore
  certification: CertificationInfo
  capabilities: string[]
  manifest: AgentManifest
  createdAt: string
  updatedAt: string
}

export interface TrustScore {
  composite: number
  tier: TrustTier
  components: {
    compliance: number
    performance: number
    reputation: number
    stake: number
    history: number
    verification: number
  }
  lastUpdated: string
}

export type TrustTier = 
  | 'unverified' 
  | 'provisional' 
  | 'certified' 
  | 'trusted' 
  | 'verified' 
  | 'sovereign'

export interface CertificationInfo {
  level: 'bronze' | 'silver' | 'gold' | 'platinum'
  status: 'active' | 'pending' | 'expired' | 'revoked'
  issuedAt?: string
  expiresAt?: string
  lastAudit?: string
}

export interface AgentManifest {
  basisVersion: string
  capabilities: {
    declared: string[]
  }
  governance: {
    escalationEndpoint?: string
    auditEndpoint?: string
  }
}

export interface TokenBalance {
  ancr: {
    available: number
    staked: number
    locked: number
  }
  trst: {
    available: number
    earned: number
  }
}

export interface StakePosition {
  agentId: string
  amount: number
  lockPeriod: number
  unlocksAt: string
  apy: number
}

// API Client
class AgentAnchorClient {
  private apiKey?: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...options?.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.message || `API error: ${response.status}`)
    }

    return response.json()
  }

  // Agents
  async listAgents(): Promise<Agent[]> {
    return this.fetch<Agent[]>('/agents')
  }

  async getAgent(agentId: string): Promise<Agent> {
    return this.fetch<Agent>(`/agents/${agentId}`)
  }

  async registerAgent(data: {
    name: string
    description?: string
    manifest: AgentManifest
  }): Promise<Agent> {
    return this.fetch<Agent>('/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateAgent(agentId: string, data: Partial<Agent>): Promise<Agent> {
    return this.fetch<Agent>(`/agents/${agentId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  // Trust
  async getTrustScore(agentId: string): Promise<TrustScore> {
    return this.fetch<TrustScore>(`/trust/score/${agentId}`)
  }

  async getTrustHistory(agentId: string, params?: {
    from?: string
    to?: string
    limit?: number
  }): Promise<{ scores: Array<TrustScore & { timestamp: string }> }> {
    const query = new URLSearchParams(params as Record<string, string>)
    return this.fetch(`/trust/score/${agentId}/history?${query}`)
  }

  // Certification
  async submitCertification(agentId: string, level: CertificationInfo['level']): Promise<{
    certificationId: string
    status: 'submitted'
  }> {
    return this.fetch('/certifications', {
      method: 'POST',
      body: JSON.stringify({ agentId, level }),
    })
  }

  async getCertification(certId: string): Promise<{
    id: string
    agentId: string
    level: CertificationInfo['level']
    status: string
    submittedAt: string
    reviewedAt?: string
  }> {
    return this.fetch(`/certifications/${certId}`)
  }

  // Tokens
  async getTokenBalance(): Promise<TokenBalance> {
    return this.fetch('/tokens/balance')
  }

  async stake(agentId: string, amount: number): Promise<StakePosition> {
    return this.fetch('/tokens/stake', {
      method: 'POST',
      body: JSON.stringify({ agentId, amount }),
    })
  }

  async unstake(agentId: string): Promise<{ txHash: string }> {
    return this.fetch('/tokens/unstake', {
      method: 'POST',
      body: JSON.stringify({ agentId }),
    })
  }

  // Registry (Public)
  async searchRegistry(params?: {
    query?: string
    tier?: TrustTier
    category?: string
    limit?: number
    offset?: number
  }): Promise<{ agents: Agent[]; total: number }> {
    const query = new URLSearchParams(params as Record<string, string>)
    return this.fetch(`/registry/agents?${query}`)
  }

  async verifyAgent(agentId: string): Promise<{
    valid: boolean
    agent: Agent
    verificationProof: string
  }> {
    return this.fetch(`/verify/${agentId}`)
  }
}

export const api = new AgentAnchorClient()

export function createClient(apiKey: string) {
  return new AgentAnchorClient(apiKey)
}

// Helper functions
export function getTierFromScore(score: number): TrustTier {
  if (score >= 900) return 'sovereign'
  if (score >= 700) return 'verified'
  if (score >= 500) return 'trusted'
  if (score >= 300) return 'certified'
  if (score >= 100) return 'provisional'
  return 'unverified'
}

export function getTierColor(tier: TrustTier): string {
  const colors: Record<TrustTier, string> = {
    unverified: 'text-red-500',
    provisional: 'text-orange-500',
    certified: 'text-yellow-500',
    trusted: 'text-green-500',
    verified: 'text-blue-500',
    sovereign: 'text-purple-500',
  }
  return colors[tier]
}

export function getTierEmoji(tier: TrustTier): string {
  const emojis: Record<TrustTier, string> = {
    unverified: '🔴',
    provisional: '🟠',
    certified: '🟡',
    trusted: '🟢',
    verified: '🔵',
    sovereign: '💎',
  }
  return emojis[tier]
}
