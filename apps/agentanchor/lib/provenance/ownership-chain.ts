/**
 * Ownership Chain
 *
 * Tracks who is responsible for an agent:
 * - Who deployed the agent
 * - Who authorized its capabilities
 * - Who is accountable for its actions
 * - Transfer of control/ownership over time
 */

import { createHash } from 'crypto'

// ============================================================================
// Types
// ============================================================================

export type OwnershipRole =
  | 'owner'           // Full control, ultimate accountability
  | 'operator'        // Day-to-day operation, delegated authority
  | 'deployer'        // Deployed to production
  | 'developer'       // Created/modified the agent
  | 'auditor'         // Review/audit access only
  | 'guardian'        // Emergency override authority

export type TransferType =
  | 'creation'        // Initial ownership at creation
  | 'assignment'      // Explicit transfer of role
  | 'delegation'      // Temporary delegation
  | 'revocation'      // Removal of access
  | 'escalation'      // Emergency escalation
  | 'succession'      // Planned succession

export interface OwnershipRecord {
  id: string
  agentId: string
  canonicalId: string

  // Who
  principalId: string         // User or org ID
  principalType: 'user' | 'organization' | 'team'
  role: OwnershipRole

  // What authority
  capabilities: string[]      // Specific capabilities granted
  restrictions: string[]      // Explicit restrictions

  // When
  grantedAt: Date
  expiresAt?: Date           // For temporary delegations
  revokedAt?: Date

  // By whom
  grantedBy: string          // Who granted this access
  transferType: TransferType
  reason?: string            // Why the transfer happened

  // Chain linking
  sequence: number
  prevHash: string | null
  recordHash: string
}

export interface OwnershipChain {
  agentId: string
  canonicalId: string
  currentOwner: string
  records: OwnershipRecord[]
  chainHash: string
}

export interface AccountabilityReport {
  agentId: string
  canonicalId: string
  asOf: Date

  // Current state
  owner: {
    principalId: string
    principalType: 'user' | 'organization' | 'team'
    since: Date
  }

  // Active roles
  activeRoles: Array<{
    principalId: string
    role: OwnershipRole
    capabilities: string[]
    since: Date
  }>

  // History summary
  totalTransfers: number
  ownerChanges: number
  lastTransfer: Date

  // Accountability chain (who to contact)
  escalationPath: string[]
}

// ============================================================================
// Hash Generation
// ============================================================================

/**
 * Hash an ownership record
 */
export function hashOwnershipRecord(
  record: Omit<OwnershipRecord, 'recordHash'>
): string {
  const content = JSON.stringify({
    id: record.id,
    agentId: record.agentId,
    principalId: record.principalId,
    role: record.role,
    capabilities: record.capabilities,
    grantedAt: record.grantedAt.toISOString(),
    grantedBy: record.grantedBy,
    transferType: record.transferType,
    sequence: record.sequence,
    prevHash: record.prevHash
  })

  return createHash('sha256').update(content).digest('hex')
}

// ============================================================================
// Chain State
// ============================================================================

interface ChainState {
  sequence: number
  lastHash: string | null
}

const ownershipChainStates = new Map<string, ChainState>()

function getChainState(agentId: string): ChainState {
  if (!ownershipChainStates.has(agentId)) {
    ownershipChainStates.set(agentId, { sequence: 0, lastHash: null })
  }
  return ownershipChainStates.get(agentId)!
}

export function initializeOwnershipChain(
  agentId: string,
  lastSequence: number,
  lastHash: string | null
): void {
  ownershipChainStates.set(agentId, { sequence: lastSequence, lastHash })
}

// ============================================================================
// Ownership Operations
// ============================================================================

/**
 * Create initial ownership record (at agent creation)
 */
export function createInitialOwnership(params: {
  agentId: string
  canonicalId: string
  ownerId: string
  ownerType?: 'user' | 'organization' | 'team'
  capabilities?: string[]
}): OwnershipRecord {
  const state = getChainState(params.agentId)
  state.sequence++

  const record: Omit<OwnershipRecord, 'recordHash'> = {
    id: `own_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    agentId: params.agentId,
    canonicalId: params.canonicalId,
    principalId: params.ownerId,
    principalType: params.ownerType || 'user',
    role: 'owner',
    capabilities: params.capabilities || ['*'],
    restrictions: [],
    grantedAt: new Date(),
    grantedBy: params.ownerId,
    transferType: 'creation',
    reason: 'Initial agent creation',
    sequence: state.sequence,
    prevHash: state.lastHash
  }

  const recordHash = hashOwnershipRecord(record)
  state.lastHash = recordHash

  return { ...record, recordHash }
}

/**
 * Transfer ownership to a new owner
 */
export function transferOwnership(params: {
  agentId: string
  canonicalId: string
  newOwnerId: string
  newOwnerType?: 'user' | 'organization' | 'team'
  transferredBy: string
  reason: string
  capabilities?: string[]
}): OwnershipRecord {
  const state = getChainState(params.agentId)
  state.sequence++

  const record: Omit<OwnershipRecord, 'recordHash'> = {
    id: `own_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    agentId: params.agentId,
    canonicalId: params.canonicalId,
    principalId: params.newOwnerId,
    principalType: params.newOwnerType || 'user',
    role: 'owner',
    capabilities: params.capabilities || ['*'],
    restrictions: [],
    grantedAt: new Date(),
    grantedBy: params.transferredBy,
    transferType: 'assignment',
    reason: params.reason,
    sequence: state.sequence,
    prevHash: state.lastHash
  }

  const recordHash = hashOwnershipRecord(record)
  state.lastHash = recordHash

  return { ...record, recordHash }
}

/**
 * Delegate a role to another principal
 */
export function delegateRole(params: {
  agentId: string
  canonicalId: string
  delegateTo: string
  delegateType?: 'user' | 'organization' | 'team'
  role: OwnershipRole
  capabilities: string[]
  restrictions?: string[]
  delegatedBy: string
  reason: string
  expiresAt?: Date
}): OwnershipRecord {
  const state = getChainState(params.agentId)
  state.sequence++

  const record: Omit<OwnershipRecord, 'recordHash'> = {
    id: `own_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    agentId: params.agentId,
    canonicalId: params.canonicalId,
    principalId: params.delegateTo,
    principalType: params.delegateType || 'user',
    role: params.role,
    capabilities: params.capabilities,
    restrictions: params.restrictions || [],
    grantedAt: new Date(),
    expiresAt: params.expiresAt,
    grantedBy: params.delegatedBy,
    transferType: 'delegation',
    reason: params.reason,
    sequence: state.sequence,
    prevHash: state.lastHash
  }

  const recordHash = hashOwnershipRecord(record)
  state.lastHash = recordHash

  return { ...record, recordHash }
}

/**
 * Revoke a role from a principal
 */
export function revokeRole(params: {
  agentId: string
  canonicalId: string
  principalId: string
  revokedBy: string
  reason: string
}): OwnershipRecord {
  const state = getChainState(params.agentId)
  state.sequence++

  const record: Omit<OwnershipRecord, 'recordHash'> = {
    id: `own_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    agentId: params.agentId,
    canonicalId: params.canonicalId,
    principalId: params.principalId,
    principalType: 'user',
    role: 'owner',
    capabilities: [],
    restrictions: ['*'],
    grantedAt: new Date(),
    revokedAt: new Date(),
    grantedBy: params.revokedBy,
    transferType: 'revocation',
    reason: params.reason,
    sequence: state.sequence,
    prevHash: state.lastHash
  }

  const recordHash = hashOwnershipRecord(record)
  state.lastHash = recordHash

  return { ...record, recordHash }
}

// ============================================================================
// Accountability
// ============================================================================

/**
 * Generate accountability report for an agent
 */
export function generateAccountabilityReport(
  agentId: string,
  canonicalId: string,
  records: OwnershipRecord[]
): AccountabilityReport {
  const now = new Date()
  const sorted = [...records].sort((a, b) => b.sequence - a.sequence)

  // Find current owner
  const ownerRecord = sorted.find(r =>
    r.role === 'owner' && !r.revokedAt && (!r.expiresAt || r.expiresAt > now)
  )

  // Find all active roles
  const activeRoles = sorted
    .filter(r => !r.revokedAt && (!r.expiresAt || r.expiresAt > now))
    .reduce((acc, r) => {
      // Keep only the latest record per principal+role
      const key = `${r.principalId}:${r.role}`
      if (!acc.has(key)) {
        acc.set(key, r)
      }
      return acc
    }, new Map<string, OwnershipRecord>())

  // Build escalation path (owner -> operators -> guardians)
  const escalationPath: string[] = []
  const owner = Array.from(activeRoles.values()).find(r => r.role === 'owner')
  const guardians = Array.from(activeRoles.values()).filter(r => r.role === 'guardian')
  const operators = Array.from(activeRoles.values()).filter(r => r.role === 'operator')

  if (owner) escalationPath.push(owner.principalId)
  operators.forEach(o => escalationPath.push(o.principalId))
  guardians.forEach(g => escalationPath.push(g.principalId))

  return {
    agentId,
    canonicalId,
    asOf: now,

    owner: {
      principalId: ownerRecord?.principalId || 'unknown',
      principalType: ownerRecord?.principalType || 'user',
      since: ownerRecord?.grantedAt || new Date(0)
    },

    activeRoles: Array.from(activeRoles.values()).map(r => ({
      principalId: r.principalId,
      role: r.role,
      capabilities: r.capabilities,
      since: r.grantedAt
    })),

    totalTransfers: records.length,
    ownerChanges: records.filter(r => r.role === 'owner' && r.transferType !== 'revocation').length,
    lastTransfer: sorted[0]?.grantedAt || new Date(0),

    escalationPath
  }
}

// ============================================================================
// Chain Verification
// ============================================================================

/**
 * Verify ownership chain integrity
 */
export function verifyOwnershipChain(records: OwnershipRecord[]): {
  valid: boolean
  brokenAt?: number
  expectedHash?: string
  actualHash?: string
} {
  if (records.length === 0) {
    return { valid: true }
  }

  const sorted = [...records].sort((a, b) => a.sequence - b.sequence)

  for (let i = 0; i < sorted.length; i++) {
    const record = sorted[i]

    // Verify hash
    const { recordHash, ...rest } = record
    const expectedHash = hashOwnershipRecord(rest)
    if (expectedHash !== recordHash) {
      return {
        valid: false,
        brokenAt: record.sequence,
        expectedHash,
        actualHash: recordHash
      }
    }

    // Verify chain link
    if (i > 0) {
      const prevRecord = sorted[i - 1]
      if (record.prevHash !== prevRecord.recordHash) {
        return {
          valid: false,
          brokenAt: record.sequence,
          expectedHash: prevRecord.recordHash,
          actualHash: record.prevHash || 'null'
        }
      }
    }
  }

  return { valid: true }
}
