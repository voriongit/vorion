/**
 * Transformation Record
 *
 * Tracks how an agent evolves over time:
 * - Behavior modifications
 * - Version history of instructions/prompts
 * - Fine-tuning or updates applied
 * - Configuration changes
 */

import { createHash } from 'crypto'

// ============================================================================
// Types
// ============================================================================

export type TransformationType =
  | 'instruction_update'    // System prompt changed
  | 'model_change'          // Underlying model changed
  | 'capability_add'        // New capability added
  | 'capability_remove'     // Capability removed
  | 'config_change'         // Configuration changed
  | 'fine_tune'            // Model fine-tuning applied
  | 'data_update'          // Training/RAG data updated
  | 'level_change'         // Trust level changed
  | 'status_change'        // Agent status changed
  | 'rollback'             // Reverted to previous version

export interface TransformationDiff {
  field: string
  before: unknown
  after: unknown
  changeType: 'added' | 'removed' | 'modified'
}

export interface TransformationRecord {
  id: string
  agentId: string
  canonicalId: string

  // What changed
  type: TransformationType
  description: string
  diffs: TransformationDiff[]

  // Version tracking
  versionBefore: string
  versionAfter: string

  // Content hashes (for verification without storing full content)
  contentHashBefore: string
  contentHashAfter: string

  // Who & when
  transformedBy: string
  transformedAt: Date
  reason: string

  // Approval (for significant changes)
  approved: boolean
  approvedBy?: string
  approvedAt?: Date

  // Rollback info
  canRollback: boolean
  rollbackToId?: string        // ID of record to rollback to

  // Chain linking
  sequence: number
  prevHash: string | null
  recordHash: string
}

export interface VersionHistory {
  agentId: string
  canonicalId: string
  currentVersion: string
  versions: Array<{
    version: string
    timestamp: Date
    transformationType: TransformationType
    description: string
    author: string
  }>
}

// ============================================================================
// Hash Generation
// ============================================================================

/**
 * Hash a transformation record
 */
export function hashTransformationRecord(
  record: Omit<TransformationRecord, 'recordHash'>
): string {
  const content = JSON.stringify({
    id: record.id,
    agentId: record.agentId,
    type: record.type,
    versionBefore: record.versionBefore,
    versionAfter: record.versionAfter,
    contentHashBefore: record.contentHashBefore,
    contentHashAfter: record.contentHashAfter,
    transformedBy: record.transformedBy,
    transformedAt: record.transformedAt.toISOString(),
    sequence: record.sequence,
    prevHash: record.prevHash
  })

  return createHash('sha256').update(content).digest('hex')
}

/**
 * Hash content for before/after comparison
 */
export function hashTransformationContent(content: unknown): string {
  const str = typeof content === 'string' ? content : JSON.stringify(content)
  return createHash('sha256').update(str).digest('hex')
}

// ============================================================================
// Version Generation
// ============================================================================

/**
 * Generate semantic version bump
 */
export function bumpVersion(
  currentVersion: string,
  type: TransformationType
): string {
  const [major, minor, patch] = currentVersion.split('.').map(Number)

  // Major: model change, fine-tune
  // Minor: instruction update, capability changes
  // Patch: config change, data update

  switch (type) {
    case 'model_change':
    case 'fine_tune':
      return `${major + 1}.0.0`

    case 'instruction_update':
    case 'capability_add':
    case 'capability_remove':
    case 'level_change':
      return `${major}.${minor + 1}.0`

    case 'config_change':
    case 'data_update':
    case 'status_change':
    case 'rollback':
    default:
      return `${major}.${minor}.${patch + 1}`
  }
}

// ============================================================================
// Chain State
// ============================================================================

interface ChainState {
  sequence: number
  lastHash: string | null
  currentVersion: string
}

const transformationChainStates = new Map<string, ChainState>()

function getChainState(agentId: string): ChainState {
  if (!transformationChainStates.has(agentId)) {
    transformationChainStates.set(agentId, {
      sequence: 0,
      lastHash: null,
      currentVersion: '1.0.0'
    })
  }
  return transformationChainStates.get(agentId)!
}

export function initializeTransformationChain(
  agentId: string,
  lastSequence: number,
  lastHash: string | null,
  currentVersion: string
): void {
  transformationChainStates.set(agentId, {
    sequence: lastSequence,
    lastHash,
    currentVersion
  })
}

// ============================================================================
// Transformation Recording
// ============================================================================

/**
 * Record a transformation
 */
export function recordTransformation(params: {
  agentId: string
  canonicalId: string
  type: TransformationType
  description: string
  diffs: TransformationDiff[]
  contentBefore: unknown
  contentAfter: unknown
  transformedBy: string
  reason: string
  requiresApproval?: boolean
  canRollback?: boolean
}): TransformationRecord {
  const state = getChainState(params.agentId)
  state.sequence++

  const versionBefore = state.currentVersion
  const versionAfter = bumpVersion(versionBefore, params.type)
  state.currentVersion = versionAfter

  const record: Omit<TransformationRecord, 'recordHash'> = {
    id: `txf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    agentId: params.agentId,
    canonicalId: params.canonicalId,
    type: params.type,
    description: params.description,
    diffs: params.diffs,
    versionBefore,
    versionAfter,
    contentHashBefore: hashTransformationContent(params.contentBefore),
    contentHashAfter: hashTransformationContent(params.contentAfter),
    transformedBy: params.transformedBy,
    transformedAt: new Date(),
    reason: params.reason,
    approved: !params.requiresApproval,
    canRollback: params.canRollback ?? true,
    sequence: state.sequence,
    prevHash: state.lastHash
  }

  const recordHash = hashTransformationRecord(record)
  state.lastHash = recordHash

  return { ...record, recordHash }
}

/**
 * Record an instruction update
 */
export function recordInstructionUpdate(params: {
  agentId: string
  canonicalId: string
  oldPrompt: string
  newPrompt: string
  updatedBy: string
  reason: string
}): TransformationRecord {
  return recordTransformation({
    agentId: params.agentId,
    canonicalId: params.canonicalId,
    type: 'instruction_update',
    description: 'System prompt updated',
    diffs: [{
      field: 'system_prompt',
      before: params.oldPrompt.slice(0, 100) + '...',
      after: params.newPrompt.slice(0, 100) + '...',
      changeType: 'modified'
    }],
    contentBefore: params.oldPrompt,
    contentAfter: params.newPrompt,
    transformedBy: params.updatedBy,
    reason: params.reason,
    canRollback: true
  })
}

/**
 * Record a model change
 */
export function recordModelChange(params: {
  agentId: string
  canonicalId: string
  oldModel: string
  newModel: string
  changedBy: string
  reason: string
}): TransformationRecord {
  return recordTransformation({
    agentId: params.agentId,
    canonicalId: params.canonicalId,
    type: 'model_change',
    description: `Model changed from ${params.oldModel} to ${params.newModel}`,
    diffs: [{
      field: 'model',
      before: params.oldModel,
      after: params.newModel,
      changeType: 'modified'
    }],
    contentBefore: { model: params.oldModel },
    contentAfter: { model: params.newModel },
    transformedBy: params.changedBy,
    reason: params.reason,
    requiresApproval: true,
    canRollback: true
  })
}

/**
 * Approve a transformation
 */
export function approveTransformation(
  record: TransformationRecord,
  approvedBy: string
): TransformationRecord {
  return {
    ...record,
    approved: true,
    approvedBy,
    approvedAt: new Date()
  }
}

// ============================================================================
// Version History
// ============================================================================

/**
 * Generate version history from transformation records
 */
export function generateVersionHistory(
  agentId: string,
  canonicalId: string,
  records: TransformationRecord[]
): VersionHistory {
  const sorted = [...records].sort((a, b) => a.sequence - b.sequence)

  return {
    agentId,
    canonicalId,
    currentVersion: sorted.length > 0
      ? sorted[sorted.length - 1].versionAfter
      : '1.0.0',
    versions: sorted.map(r => ({
      version: r.versionAfter,
      timestamp: r.transformedAt,
      transformationType: r.type,
      description: r.description,
      author: r.transformedBy
    }))
  }
}

// ============================================================================
// Chain Verification
// ============================================================================

/**
 * Verify transformation chain integrity
 */
export function verifyTransformationChain(records: TransformationRecord[]): {
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
    const expectedHash = hashTransformationRecord(rest)
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

// ============================================================================
// Rollback
// ============================================================================

/**
 * Get rollback candidates (transformations that can be undone)
 */
export function getRollbackCandidates(
  records: TransformationRecord[]
): TransformationRecord[] {
  return records
    .filter(r => r.canRollback && r.approved)
    .sort((a, b) => b.sequence - a.sequence)
}
