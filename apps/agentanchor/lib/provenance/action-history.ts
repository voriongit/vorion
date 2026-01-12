/**
 * Action History
 *
 * Records every action an agent takes:
 * - Every decision made
 * - Every tool called
 * - Every output generated
 * - Timestamps for each action
 *
 * Forms the "Truth Chain" - a tamper-evident log of agent activity.
 */

import { createHash } from 'crypto'

// ============================================================================
// Types
// ============================================================================

export type ActionType =
  | 'decision'        // Agent made a choice
  | 'tool_call'       // Agent called an external tool
  | 'output'          // Agent generated output
  | 'input'           // Agent received input
  | 'escalation'      // Agent escalated to human
  | 'handoff'         // Agent handed off to another agent
  | 'error'           // Agent encountered error
  | 'circuit_break'   // Circuit breaker triggered

export interface ActionContext {
  sessionId: string
  conversationId?: string
  parentActionId?: string
  triggeredBy?: string        // What triggered this action
  environment: 'development' | 'staging' | 'production'
}

export interface ToolCallDetails {
  toolName: string
  toolVersion?: string
  inputHash: string           // Hash of tool input (not raw data for privacy)
  outputHash: string          // Hash of tool output
  duration: number            // Milliseconds
  success: boolean
  errorCode?: string
}

export interface DecisionDetails {
  options: string[]           // What options were considered
  selected: string            // Which was chosen
  reasoning?: string          // Why (if available)
  confidence?: number         // 0-1 confidence score
  modelOutput?: string        // Raw model response hash
}

export interface OutputDetails {
  outputType: 'text' | 'code' | 'data' | 'action'
  contentHash: string         // Hash of output content
  tokenCount?: number
  truncated?: boolean
}

export interface ActionRecord {
  // Identity
  id: string
  agentId: string
  canonicalId: string

  // Action details
  type: ActionType
  timestamp: Date
  context: ActionContext

  // Type-specific details
  toolCall?: ToolCallDetails
  decision?: DecisionDetails
  output?: OutputDetails

  // Trust & risk
  trustScoreAtTime: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  requiresReview: boolean

  // Chain linking
  sequence: number
  prevHash: string | null
  actionHash: string
}

export interface ActionBatch {
  agentId: string
  sessionId: string
  startTime: Date
  endTime: Date
  actions: ActionRecord[]
  batchHash: string
}

// ============================================================================
// Action Hash Generation
// ============================================================================

/**
 * Generate hash for an action record
 */
export function hashAction(action: Omit<ActionRecord, 'actionHash'>): string {
  const content = JSON.stringify({
    id: action.id,
    agentId: action.agentId,
    type: action.type,
    timestamp: action.timestamp.toISOString(),
    context: action.context,
    toolCall: action.toolCall,
    decision: action.decision,
    output: action.output,
    sequence: action.sequence,
    prevHash: action.prevHash
  })

  return createHash('sha256').update(content).digest('hex')
}

/**
 * Generate hash for content (inputs/outputs)
 */
export function hashContent(content: string | object): string {
  const str = typeof content === 'string' ? content : JSON.stringify(content)
  return createHash('sha256').update(str).digest('hex')
}

// ============================================================================
// Action Chain State
// ============================================================================

interface ChainState {
  sequence: number
  lastHash: string | null
}

const chainStates = new Map<string, ChainState>()

/**
 * Get or initialize chain state for an agent
 */
function getChainState(agentId: string): ChainState {
  if (!chainStates.has(agentId)) {
    chainStates.set(agentId, { sequence: 0, lastHash: null })
  }
  return chainStates.get(agentId)!
}

/**
 * Initialize chain state from database
 */
export function initializeActionChain(
  agentId: string,
  lastSequence: number,
  lastHash: string | null
): void {
  chainStates.set(agentId, { sequence: lastSequence, lastHash })
}

// ============================================================================
// Action Recording
// ============================================================================

/**
 * Record an agent action
 */
export function recordAction(params: {
  agentId: string
  canonicalId: string
  type: ActionType
  context: ActionContext
  trustScore: number
  riskLevel?: ActionRecord['riskLevel']
  toolCall?: ToolCallDetails
  decision?: DecisionDetails
  output?: OutputDetails
}): ActionRecord {
  const state = getChainState(params.agentId)
  state.sequence++

  const record: Omit<ActionRecord, 'actionHash'> = {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    agentId: params.agentId,
    canonicalId: params.canonicalId,
    type: params.type,
    timestamp: new Date(),
    context: params.context,
    toolCall: params.toolCall,
    decision: params.decision,
    output: params.output,
    trustScoreAtTime: params.trustScore,
    riskLevel: params.riskLevel || 'low',
    requiresReview: params.riskLevel === 'high' || params.riskLevel === 'critical',
    sequence: state.sequence,
    prevHash: state.lastHash
  }

  const actionHash = hashAction(record)
  state.lastHash = actionHash

  return { ...record, actionHash }
}

/**
 * Record a tool call
 */
export function recordToolCall(params: {
  agentId: string
  canonicalId: string
  context: ActionContext
  trustScore: number
  toolName: string
  toolInput: unknown
  toolOutput: unknown
  duration: number
  success: boolean
  errorCode?: string
}): ActionRecord {
  return recordAction({
    agentId: params.agentId,
    canonicalId: params.canonicalId,
    type: 'tool_call',
    context: params.context,
    trustScore: params.trustScore,
    toolCall: {
      toolName: params.toolName,
      inputHash: hashContent(params.toolInput as object),
      outputHash: hashContent(params.toolOutput as object),
      duration: params.duration,
      success: params.success,
      errorCode: params.errorCode
    }
  })
}

/**
 * Record a decision
 */
export function recordDecision(params: {
  agentId: string
  canonicalId: string
  context: ActionContext
  trustScore: number
  options: string[]
  selected: string
  reasoning?: string
  confidence?: number
  riskLevel?: ActionRecord['riskLevel']
}): ActionRecord {
  return recordAction({
    agentId: params.agentId,
    canonicalId: params.canonicalId,
    type: 'decision',
    context: params.context,
    trustScore: params.trustScore,
    riskLevel: params.riskLevel,
    decision: {
      options: params.options,
      selected: params.selected,
      reasoning: params.reasoning,
      confidence: params.confidence
    }
  })
}

// ============================================================================
// Chain Verification
// ============================================================================

/**
 * Verify action chain integrity
 */
export function verifyActionChain(actions: ActionRecord[]): {
  valid: boolean
  brokenAt?: number
  expectedHash?: string
  actualHash?: string
} {
  if (actions.length === 0) {
    return { valid: true }
  }

  // Sort by sequence
  const sorted = [...actions].sort((a, b) => a.sequence - b.sequence)

  // Verify each action links to previous
  for (let i = 0; i < sorted.length; i++) {
    const action = sorted[i]

    // Verify hash
    const { actionHash, ...rest } = action
    const expectedHash = hashAction(rest)
    if (expectedHash !== actionHash) {
      return {
        valid: false,
        brokenAt: action.sequence,
        expectedHash,
        actualHash: actionHash
      }
    }

    // Verify chain link
    if (i > 0) {
      const prevAction = sorted[i - 1]
      if (action.prevHash !== prevAction.actionHash) {
        return {
          valid: false,
          brokenAt: action.sequence,
          expectedHash: prevAction.actionHash,
          actualHash: action.prevHash || 'null'
        }
      }
    }
  }

  return { valid: true }
}

// ============================================================================
// Query Helpers
// ============================================================================

/**
 * Filter actions by type
 */
export function filterActionsByType(
  actions: ActionRecord[],
  type: ActionType
): ActionRecord[] {
  return actions.filter(a => a.type === type)
}

/**
 * Get actions requiring review
 */
export function getActionsRequiringReview(actions: ActionRecord[]): ActionRecord[] {
  return actions.filter(a => a.requiresReview)
}

/**
 * Get action statistics
 */
export function getActionStats(actions: ActionRecord[]): {
  total: number
  byType: Record<ActionType, number>
  byRisk: Record<string, number>
  reviewRequired: number
} {
  const byType: Record<string, number> = {}
  const byRisk: Record<string, number> = {}
  let reviewRequired = 0

  for (const action of actions) {
    byType[action.type] = (byType[action.type] || 0) + 1
    byRisk[action.riskLevel] = (byRisk[action.riskLevel] || 0) + 1
    if (action.requiresReview) reviewRequired++
  }

  return {
    total: actions.length,
    byType: byType as Record<ActionType, number>,
    byRisk,
    reviewRequired
  }
}
