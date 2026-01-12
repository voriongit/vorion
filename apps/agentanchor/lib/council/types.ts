// Council Types and Interfaces

export type ValidatorId = 'guardian' | 'arbiter' | 'scholar' | 'advocate'

export type VoteDecision = 'approve' | 'deny' | 'abstain'

export type RiskLevel = 0 | 1 | 2 | 3 | 4

export interface ValidatorVote {
  validatorId: ValidatorId
  decision: VoteDecision
  reasoning: string
  confidence: number // 0-1
  votedAt: string
}

export interface UpchainRequest {
  id: string
  agentId: string
  actionType: string
  actionDetails: string
  context: Record<string, any>
  justification: string
  riskLevel: RiskLevel
  requestedAt: string
}

export interface CouncilDecision {
  id: string
  requestId: string
  agentId: string
  votes: ValidatorVote[]
  outcome: 'approved' | 'denied' | 'escalated' | 'pending'
  finalReasoning: string
  createsPrecedent: boolean
  precedentId?: string
  decidedAt: string
  recordedOnTruthChain: boolean
}

export interface ValidatorConfig {
  id: ValidatorId
  name: string
  domain: string
  description: string
  icon: string
  systemPrompt: string
}

// Risk level definitions
export const RISK_LEVELS: Record<RiskLevel, { name: string; description: string; approval: string }> = {
  0: {
    name: 'Routine',
    description: 'Read data, format text',
    approval: 'Auto (logged)',
  },
  1: {
    name: 'Standard',
    description: 'Generate content, analyze',
    approval: 'Auto (logged)',
  },
  2: {
    name: 'Elevated',
    description: 'External API call, create file',
    approval: 'Single validator',
  },
  3: {
    name: 'Significant',
    description: 'Modify system, send email',
    approval: 'Majority (3/4)',
  },
  4: {
    name: 'Critical',
    description: 'Delete data, financial action',
    approval: 'Unanimous + Human',
  },
}

// Trust tier to autonomy mapping
export const TRUST_TIER_AUTONOMY: Record<string, RiskLevel> = {
  untrusted: 0,  // Can only do L0 actions automatically
  novice: 1,     // L0-L1 automatically
  proven: 2,     // L0-L2 automatically
  trusted: 2,    // L0-L2 automatically, L3 with single vote
  elite: 3,      // L0-L3 automatically
  legendary: 3,  // L0-L3 automatically, L4 with majority
}
