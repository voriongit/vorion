/**
 * Origin Tracking
 *
 * Documents where an agent came from:
 * - Which model(s) power the agent
 * - Who created/trained it
 * - What data it was trained on
 * - What instructions/prompts define its behavior
 */

import { createHash } from 'crypto'

// ============================================================================
// Types
// ============================================================================

export interface ModelOrigin {
  provider: string           // e.g., 'anthropic', 'openai'
  model: string             // e.g., 'claude-sonnet-4-20250514'
  version?: string          // Model version/checkpoint
  capabilities: string[]    // e.g., ['text', 'vision', 'tools']
}

export interface CreatorOrigin {
  userId: string
  organizationId?: string
  role: 'owner' | 'developer' | 'deployer'
  attestation?: string      // Optional signed attestation
}

export interface DataOrigin {
  type: 'prompt' | 'fine-tune' | 'rag' | 'knowledge-base'
  source: string            // Description or reference
  hash?: string            // Hash of data for verification
  timestamp: Date
  dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted'
}

export interface InstructionOrigin {
  systemPrompt: string
  systemPromptHash: string
  version: string
  author: string
  timestamp: Date
  parentVersion?: string    // Link to previous version
}

export interface AgentOrigin {
  // Unique identifier
  agentId: string
  canonicalId: string
  fingerprint: string

  // Model lineage
  models: ModelOrigin[]
  primaryModel: string

  // Creator information
  creators: CreatorOrigin[]
  primaryCreator: string

  // Data sources
  dataSources: DataOrigin[]

  // Instruction history
  instructions: InstructionOrigin[]
  currentInstructionHash: string

  // Timestamps
  createdAt: Date
  originRecordedAt: Date

  // Cryptographic proof
  originHash: string
  signature?: string
}

// ============================================================================
// Origin Hash Generation
// ============================================================================

/**
 * Generate deterministic hash of agent origin
 * Used for tamper detection
 */
export function hashAgentOrigin(origin: Omit<AgentOrigin, 'originHash' | 'signature'>): string {
  const content = JSON.stringify({
    agentId: origin.agentId,
    canonicalId: origin.canonicalId,
    fingerprint: origin.fingerprint,
    models: origin.models,
    creators: origin.creators,
    dataSources: origin.dataSources.map(d => ({
      type: d.type,
      source: d.source,
      hash: d.hash
    })),
    currentInstructionHash: origin.currentInstructionHash,
    createdAt: origin.createdAt.toISOString()
  }, Object.keys)

  return createHash('sha256').update(content).digest('hex')
}

/**
 * Hash system prompt for version tracking
 */
export function hashSystemPrompt(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex')
}

// ============================================================================
// Origin Record Creation
// ============================================================================

/**
 * Create an origin record for a new agent
 */
export function createAgentOrigin(params: {
  agentId: string
  canonicalId: string
  fingerprint: string
  model: string
  modelProvider: string
  creatorId: string
  systemPrompt: string
  organizationId?: string
  dataSources?: DataOrigin[]
}): AgentOrigin {
  const now = new Date()
  const systemPromptHash = hashSystemPrompt(params.systemPrompt)

  const origin: Omit<AgentOrigin, 'originHash' | 'signature'> = {
    agentId: params.agentId,
    canonicalId: params.canonicalId,
    fingerprint: params.fingerprint,

    models: [{
      provider: params.modelProvider,
      model: params.model,
      capabilities: ['text', 'tools']
    }],
    primaryModel: params.model,

    creators: [{
      userId: params.creatorId,
      organizationId: params.organizationId,
      role: 'owner'
    }],
    primaryCreator: params.creatorId,

    dataSources: params.dataSources || [],

    instructions: [{
      systemPrompt: params.systemPrompt,
      systemPromptHash,
      version: '1.0.0',
      author: params.creatorId,
      timestamp: now
    }],
    currentInstructionHash: systemPromptHash,

    createdAt: now,
    originRecordedAt: now
  }

  return {
    ...origin,
    originHash: hashAgentOrigin(origin)
  }
}

// ============================================================================
// Origin Verification
// ============================================================================

/**
 * Verify an origin record hasn't been tampered with
 */
export function verifyAgentOrigin(origin: AgentOrigin): {
  valid: boolean
  expectedHash: string
  actualHash: string
} {
  const { originHash, signature, ...rest } = origin
  const expectedHash = hashAgentOrigin(rest as Omit<AgentOrigin, 'originHash' | 'signature'>)

  return {
    valid: expectedHash === originHash,
    expectedHash,
    actualHash: originHash
  }
}

/**
 * Check if instruction has changed from origin
 */
export function hasInstructionChanged(
  origin: AgentOrigin,
  currentPrompt: string
): boolean {
  const currentHash = hashSystemPrompt(currentPrompt)
  return currentHash !== origin.currentInstructionHash
}
