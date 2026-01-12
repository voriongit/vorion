/**
 * Agent Provenance Service
 *
 * Unified interface for the complete provenance system.
 * Provides high-level operations that coordinate across:
 * - Origin tracking
 * - Action history
 * - Ownership chain
 * - Transformation record
 *
 * This is the main entry point for provenance operations.
 */

import {
  AgentOrigin,
  createAgentOrigin,
  verifyAgentOrigin,
  hashSystemPrompt
} from './origin-tracking'

import {
  ActionRecord,
  recordAction,
  recordToolCall,
  recordDecision,
  verifyActionChain,
  getActionStats,
  ActionContext
} from './action-history'

import {
  OwnershipRecord,
  createInitialOwnership,
  transferOwnership,
  delegateRole,
  generateAccountabilityReport,
  verifyOwnershipChain,
  AccountabilityReport
} from './ownership-chain'

import {
  TransformationRecord,
  recordInstructionUpdate,
  recordModelChange,
  generateVersionHistory,
  verifyTransformationChain,
  VersionHistory
} from './transformation-record'

// ============================================================================
// Types
// ============================================================================

/**
 * Complete provenance record for an agent
 */
export interface AgentProvenance {
  // Identity
  agentId: string
  canonicalId: string
  fingerprint: string

  // Origin
  origin: AgentOrigin

  // Current state
  currentVersion: string
  currentOwner: string

  // Chains
  actionCount: number
  ownershipCount: number
  transformationCount: number

  // Verification
  allChainsValid: boolean
  lastVerified: Date

  // Summary
  createdAt: Date
  lastActivity: Date
  trustScore: number
}

/**
 * Provenance verification result
 */
export interface ProvenanceVerification {
  valid: boolean
  originValid: boolean
  actionChainValid: boolean
  ownershipChainValid: boolean
  transformationChainValid: boolean
  errors: string[]
  verifiedAt: Date
}

/**
 * Full provenance report
 */
export interface ProvenanceReport {
  agent: AgentProvenance
  origin: AgentOrigin
  accountability: AccountabilityReport
  versionHistory: VersionHistory
  actionStats: ReturnType<typeof getActionStats>
  verification: ProvenanceVerification
  generatedAt: Date
}

// ============================================================================
// Provenance Initialization
// ============================================================================

/**
 * Initialize complete provenance for a new agent
 */
export function initializeAgentProvenance(params: {
  agentId: string
  canonicalId: string
  fingerprint: string
  name: string
  model: string
  modelProvider: string
  systemPrompt: string
  creatorId: string
  organizationId?: string
  trustScore?: number
}): {
  origin: AgentOrigin
  ownership: OwnershipRecord
} {
  // Create origin record
  const origin = createAgentOrigin({
    agentId: params.agentId,
    canonicalId: params.canonicalId,
    fingerprint: params.fingerprint,
    model: params.model,
    modelProvider: params.modelProvider,
    creatorId: params.creatorId,
    systemPrompt: params.systemPrompt,
    organizationId: params.organizationId
  })

  // Create initial ownership
  const ownership = createInitialOwnership({
    agentId: params.agentId,
    canonicalId: params.canonicalId,
    ownerId: params.creatorId,
    ownerType: params.organizationId ? 'organization' : 'user'
  })

  return { origin, ownership }
}

// ============================================================================
// Action Recording (High-Level)
// ============================================================================

/**
 * Record an agent's tool call with provenance
 */
export function recordAgentToolCall(params: {
  agentId: string
  canonicalId: string
  sessionId: string
  toolName: string
  toolInput: unknown
  toolOutput: unknown
  duration: number
  success: boolean
  trustScore: number
  environment?: 'development' | 'staging' | 'production'
}): ActionRecord {
  const context: ActionContext = {
    sessionId: params.sessionId,
    environment: params.environment || 'production'
  }

  return recordToolCall({
    agentId: params.agentId,
    canonicalId: params.canonicalId,
    context,
    trustScore: params.trustScore,
    toolName: params.toolName,
    toolInput: params.toolInput,
    toolOutput: params.toolOutput,
    duration: params.duration,
    success: params.success
  })
}

/**
 * Record an agent's decision with provenance
 */
export function recordAgentDecision(params: {
  agentId: string
  canonicalId: string
  sessionId: string
  options: string[]
  selected: string
  reasoning?: string
  confidence?: number
  trustScore: number
  riskLevel?: 'low' | 'medium' | 'high' | 'critical'
}): ActionRecord {
  const context: ActionContext = {
    sessionId: params.sessionId,
    environment: 'production'
  }

  return recordDecision({
    agentId: params.agentId,
    canonicalId: params.canonicalId,
    context,
    trustScore: params.trustScore,
    options: params.options,
    selected: params.selected,
    reasoning: params.reasoning,
    confidence: params.confidence,
    riskLevel: params.riskLevel
  })
}

// ============================================================================
// Ownership Operations (High-Level)
// ============================================================================

/**
 * Transfer agent ownership with full provenance
 */
export function transferAgentOwnership(params: {
  agentId: string
  canonicalId: string
  newOwnerId: string
  newOwnerType?: 'user' | 'organization' | 'team'
  transferredBy: string
  reason: string
}): OwnershipRecord {
  return transferOwnership({
    agentId: params.agentId,
    canonicalId: params.canonicalId,
    newOwnerId: params.newOwnerId,
    newOwnerType: params.newOwnerType,
    transferredBy: params.transferredBy,
    reason: params.reason
  })
}

/**
 * Delegate role to operator
 */
export function delegateAgentOperator(params: {
  agentId: string
  canonicalId: string
  operatorId: string
  capabilities: string[]
  delegatedBy: string
  expiresAt?: Date
}): OwnershipRecord {
  return delegateRole({
    agentId: params.agentId,
    canonicalId: params.canonicalId,
    delegateTo: params.operatorId,
    role: 'operator',
    capabilities: params.capabilities,
    delegatedBy: params.delegatedBy,
    reason: 'Operator delegation',
    expiresAt: params.expiresAt
  })
}

// ============================================================================
// Transformation Operations (High-Level)
// ============================================================================

/**
 * Update agent instructions with provenance
 */
export function updateAgentInstructions(params: {
  agentId: string
  canonicalId: string
  oldPrompt: string
  newPrompt: string
  updatedBy: string
  reason: string
}): TransformationRecord {
  return recordInstructionUpdate({
    agentId: params.agentId,
    canonicalId: params.canonicalId,
    oldPrompt: params.oldPrompt,
    newPrompt: params.newPrompt,
    updatedBy: params.updatedBy,
    reason: params.reason
  })
}

/**
 * Change agent model with provenance
 */
export function changeAgentModel(params: {
  agentId: string
  canonicalId: string
  oldModel: string
  newModel: string
  changedBy: string
  reason: string
}): TransformationRecord {
  return recordModelChange({
    agentId: params.agentId,
    canonicalId: params.canonicalId,
    oldModel: params.oldModel,
    newModel: params.newModel,
    changedBy: params.changedBy,
    reason: params.reason
  })
}

// ============================================================================
// Verification
// ============================================================================

/**
 * Verify complete agent provenance
 */
export function verifyAgentProvenance(params: {
  origin: AgentOrigin
  actions: ActionRecord[]
  ownership: OwnershipRecord[]
  transformations: TransformationRecord[]
}): ProvenanceVerification {
  const errors: string[] = []

  // Verify origin
  const originResult = verifyAgentOrigin(params.origin)
  if (!originResult.valid) {
    errors.push(`Origin tampered: expected ${originResult.expectedHash}, got ${originResult.actualHash}`)
  }

  // Verify action chain
  const actionResult = verifyActionChain(params.actions)
  if (!actionResult.valid) {
    errors.push(`Action chain broken at sequence ${actionResult.brokenAt}`)
  }

  // Verify ownership chain
  const ownershipResult = verifyOwnershipChain(params.ownership)
  if (!ownershipResult.valid) {
    errors.push(`Ownership chain broken at sequence ${ownershipResult.brokenAt}`)
  }

  // Verify transformation chain
  const transformationResult = verifyTransformationChain(params.transformations)
  if (!transformationResult.valid) {
    errors.push(`Transformation chain broken at sequence ${transformationResult.brokenAt}`)
  }

  return {
    valid: errors.length === 0,
    originValid: originResult.valid,
    actionChainValid: actionResult.valid,
    ownershipChainValid: ownershipResult.valid,
    transformationChainValid: transformationResult.valid,
    errors,
    verifiedAt: new Date()
  }
}

// ============================================================================
// Reporting
// ============================================================================

/**
 * Generate complete provenance report
 */
export function generateProvenanceReport(params: {
  agentId: string
  canonicalId: string
  fingerprint: string
  origin: AgentOrigin
  actions: ActionRecord[]
  ownership: OwnershipRecord[]
  transformations: TransformationRecord[]
  trustScore: number
}): ProvenanceReport {
  // Verify all chains
  const verification = verifyAgentProvenance({
    origin: params.origin,
    actions: params.actions,
    ownership: params.ownership,
    transformations: params.transformations
  })

  // Generate accountability report
  const accountability = generateAccountabilityReport(
    params.agentId,
    params.canonicalId,
    params.ownership
  )

  // Generate version history
  const versionHistory = generateVersionHistory(
    params.agentId,
    params.canonicalId,
    params.transformations
  )

  // Get action stats
  const actionStats = getActionStats(params.actions)

  // Build agent summary
  const lastAction = params.actions.length > 0
    ? params.actions.reduce((a, b) => a.timestamp > b.timestamp ? a : b)
    : null

  const agent: AgentProvenance = {
    agentId: params.agentId,
    canonicalId: params.canonicalId,
    fingerprint: params.fingerprint,
    origin: params.origin,
    currentVersion: versionHistory.currentVersion,
    currentOwner: accountability.owner.principalId,
    actionCount: params.actions.length,
    ownershipCount: params.ownership.length,
    transformationCount: params.transformations.length,
    allChainsValid: verification.valid,
    lastVerified: verification.verifiedAt,
    createdAt: params.origin.createdAt,
    lastActivity: lastAction?.timestamp || params.origin.createdAt,
    trustScore: params.trustScore
  }

  return {
    agent,
    origin: params.origin,
    accountability,
    versionHistory,
    actionStats,
    verification,
    generatedAt: new Date()
  }
}

// ============================================================================
// Export summary for external display
// ============================================================================

/**
 * Generate a human-readable provenance summary
 */
export function generateProvenanceSummary(report: ProvenanceReport): string {
  const { agent, origin, accountability, versionHistory, actionStats } = report

  return `
# Agent Provenance Report
Generated: ${report.generatedAt.toISOString()}

## Identity
- **Canonical ID:** ${agent.canonicalId}
- **Fingerprint:** ${agent.fingerprint.slice(0, 16)}...
- **Created:** ${agent.createdAt.toISOString()}
- **Current Version:** ${agent.currentVersion}

## Origin
- **Model:** ${origin.primaryModel}
- **Provider:** ${origin.models[0]?.provider}
- **Creator:** ${origin.primaryCreator}
- **Instruction Hash:** ${origin.currentInstructionHash.slice(0, 16)}...

## Accountability
- **Owner:** ${accountability.owner.principalId}
- **Owner Since:** ${accountability.owner.since.toISOString()}
- **Active Roles:** ${accountability.activeRoles.length}
- **Escalation Path:** ${accountability.escalationPath.join(' → ')}

## Activity
- **Total Actions:** ${actionStats.total}
- **Decisions:** ${actionStats.byType.decision || 0}
- **Tool Calls:** ${actionStats.byType.tool_call || 0}
- **Requiring Review:** ${actionStats.reviewRequired}

## Version History
${versionHistory.versions.slice(-5).map(v =>
    `- ${v.version}: ${v.description} (${v.timestamp.toISOString().split('T')[0]})`
  ).join('\n')}

## Verification
- **All Chains Valid:** ${report.verification.valid ? '✅' : '❌'}
- **Origin Valid:** ${report.verification.originValid ? '✅' : '❌'}
- **Action Chain Valid:** ${report.verification.actionChainValid ? '✅' : '❌'}
- **Ownership Chain Valid:** ${report.verification.ownershipChainValid ? '✅' : '❌'}
- **Transformation Chain Valid:** ${report.verification.transformationChainValid ? '✅' : '❌'}
${report.verification.errors.length > 0 ? `\n**Errors:**\n${report.verification.errors.map(e => `- ${e}`).join('\n')}` : ''}
`.trim()
}
