/**
 * Truth Chain Types
 * Story 5-4: Truth Chain Records (FR92-FR97)
 */

// Record types that can be stored on Truth Chain
export type TruthChainRecordType =
  | 'council_decision'      // FR92
  | 'certification'         // FR93 (graduation, training completion)
  | 'human_override'        // FR94
  | 'ownership_change'      // FR95
  | 'agent_creation'
  | 'agent_archive'
  | 'trust_milestone'
  | 'marketplace_listing'
  | 'acquisition'
  | 'circuit_breaker'       // Story 16-4: Kill Switch Truth Chain Records

// Base record structure
export interface TruthChainRecord {
  id: string
  sequence: number
  record_type: TruthChainRecordType
  agent_id?: string
  user_id?: string
  data: Record<string, unknown>
  timestamp: string
  previous_hash: string
  hash: string
  signature: string
  verified: boolean
  verification_url?: string
}

// Council Decision Record (FR92)
export interface CouncilDecisionRecord {
  decision_id: string
  request_id: string
  agent_id: string
  action_type: string
  risk_level: number
  outcome: 'approved' | 'denied' | 'escalated'
  votes: Array<{
    validator_id: string
    decision: string
    confidence: number
  }>
  reasoning: string
  creates_precedent: boolean
}

// Certification Record (FR93)
export interface CertificationRecord {
  agent_id: string
  agent_name: string
  certification_type: 'graduation' | 'training_completion' | 'specialization'
  curriculum_id?: string
  curriculum_name?: string
  initial_trust_score?: number
  trust_tier?: string
  examination_id?: string
}

// Human Override Record (FR94)
export interface HumanOverrideRecord {
  escalation_id: string
  agent_id: string
  original_decision: string
  override_decision: string
  override_reason: string
  overridden_by: string
}

// Ownership Change Record (FR95)
export interface OwnershipChangeRecord {
  agent_id: string
  agent_name: string
  previous_owner_id?: string
  new_owner_id: string
  change_type: 'creation' | 'transfer' | 'acquisition'
  terms?: Record<string, unknown>
}

// Input for creating records
export interface TruthChainRecordInput {
  record_type: TruthChainRecordType
  agent_id?: string
  user_id?: string
  data: Record<string, unknown>
}

// Query options
export interface TruthChainQueryOptions {
  agent_id?: string
  record_type?: TruthChainRecordType
  from_timestamp?: string
  to_timestamp?: string
  limit?: number
  offset?: number
}

// Verification result
export interface VerificationResult {
  valid: boolean
  record?: TruthChainRecord
  chain_valid?: boolean
  error?: string
}
