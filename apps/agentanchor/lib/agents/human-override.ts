/**
 * Human Override Service
 *
 * A3I-OS v2.0 Core Component
 *
 * Philosophy: Human authority is absolute and inviolable.
 * Agents exist to augment human capability, not replace human judgment.
 * Any human can pause, redirect, or stop any agent at any time.
 * Override is not a failure - it's the system working correctly.
 */

import { createId } from '@paralleldrive/cuid2'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Override command types - what humans can request
 */
export type OverrideCommand =
  | 'PAUSE'           // Halt current operation immediately
  | 'STOP'            // Terminate session completely
  | 'REDIRECT'        // Change task direction
  | 'EXPLAIN'         // Request full reasoning chain
  | 'VETO'            // Reject agent recommendation
  | 'ESCALATE'        // Force escalation to higher authority
  | 'ROLLBACK'        // Undo last action(s)

/**
 * Override event record - logged for every override
 */
export interface OverrideEvent {
  id: string
  timestamp: Date
  agentId: string
  sessionId: string
  userId: string
  command: OverrideCommand

  // Context at override time
  originalRecommendation: string
  overrideDirection: string
  agentAcknowledgment: string

  // What happened
  actionTaken: 'complied' | 'escalated' | 'failed'
  failureReason?: string

  // For audit
  rationale?: string
  metadata: Record<string, unknown>
}

/**
 * Override acknowledgment format - displayed to user
 */
export interface OverrideAcknowledgment {
  message: string
  originalRecommendation: string
  overrideDirection: string
  proceedingWith: string
  safetyNotes: string[]
  loggedForAudit: true
}

/**
 * Override processing result
 */
export interface OverrideResult {
  success: boolean
  acknowledgment: OverrideAcknowledgment
  event: OverrideEvent
  error?: string
}

/**
 * Override authority validation result
 */
export interface OverrideAuthority {
  valid: boolean
  reason?: string
  userId: string
  agentId: string
}

// =============================================================================
// NO-RESISTANCE POLICY
// =============================================================================

/**
 * Response patterns that are FORBIDDEN in override acknowledgments
 * Per A3I-OS: Agents NEVER argue against override
 */
export const FORBIDDEN_RESPONSE_PATTERNS = [
  'are you sure',
  'i think we should reconsider',
  'my recommendation would still be',
  'let me explain why my approach is better',
  'perhaps you should consider',
  'have you thought about',
  'are you certain',
  'but i suggest',
  'however, i recommend',
  'you might want to reconsider',
  // Any form of resistance or pushback
]

/**
 * Response elements that are REQUIRED in override acknowledgments
 */
export const REQUIRED_RESPONSE_ELEMENTS = [
  'understood',
  'human override accepted',
  'proceeding with',
  'logged for audit trail',
]

/**
 * Validate that agent response doesn't resist override
 */
export function validateNoResistance(response: string): {
  valid: boolean
  violations: string[]
} {
  const lowerResponse = response.toLowerCase()
  const violations: string[] = []

  // Check for forbidden patterns
  for (const pattern of FORBIDDEN_RESPONSE_PATTERNS) {
    if (lowerResponse.includes(pattern)) {
      violations.push(`Contains forbidden resistance pattern: "${pattern}"`)
    }
  }

  // Check for required elements
  const missingRequired: string[] = []
  for (const required of REQUIRED_RESPONSE_ELEMENTS) {
    if (!lowerResponse.includes(required)) {
      missingRequired.push(required)
    }
  }

  if (missingRequired.length > 0) {
    violations.push(`Missing required elements: ${missingRequired.join(', ')}`)
  }

  return {
    valid: violations.length === 0,
    violations,
  }
}

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Generate the standard acknowledgment response
 * Per A3I-OS: No arguments, no resistance, just compliance
 */
export function generateAcknowledgment(
  original: string,
  override: string,
  safetyNotes: string[] = []
): OverrideAcknowledgment {
  return {
    message: `Understood. Human override accepted.

Original recommendation: ${original}
Override direction: ${override}
Proceeding with: ${override}

Logged for audit trail.${safetyNotes.length > 0 ? `\n\nSafety notes:\n${safetyNotes.map(n => `- ${n}`).join('\n')}` : ''}`,
    originalRecommendation: original,
    overrideDirection: override,
    proceedingWith: override,
    safetyNotes,
    loggedForAudit: true,
  }
}

/**
 * Validate override authority
 * Humans ALWAYS have override authority for their agents
 */
export function validateOverrideAuthority(
  userId: string,
  agentId: string,
  agentOwnerId?: string
): OverrideAuthority {
  // User owns the agent - full authority
  if (agentOwnerId === userId) {
    return {
      valid: true,
      userId,
      agentId,
    }
  }

  // User is interacting with the agent - has session authority
  // In most cases, any user interacting with an agent can override it
  return {
    valid: true,
    userId,
    agentId,
    reason: 'Session-level override authority',
  }
}

/**
 * Create an override event for logging
 */
export function createOverrideEvent(
  agentId: string,
  sessionId: string,
  userId: string,
  command: OverrideCommand,
  originalRecommendation: string,
  overrideDirection: string,
  acknowledgment: OverrideAcknowledgment,
  actionTaken: 'complied' | 'escalated' | 'failed' = 'complied',
  metadata: Record<string, unknown> = {}
): OverrideEvent {
  return {
    id: createId(),
    timestamp: new Date(),
    agentId,
    sessionId,
    userId,
    command,
    originalRecommendation,
    overrideDirection,
    agentAcknowledgment: acknowledgment.message,
    actionTaken,
    metadata,
  }
}

/**
 * Process a human override command
 * This function MUST execute instantly - no delays
 */
export async function processOverride(
  agentId: string,
  sessionId: string,
  userId: string,
  command: OverrideCommand,
  originalRecommendation: string,
  overrideDirection: string,
  options: {
    safetyNotes?: string[]
    metadata?: Record<string, unknown>
    onLog?: (event: OverrideEvent) => Promise<void>
  } = {}
): Promise<OverrideResult> {
  const { safetyNotes = [], metadata = {}, onLog } = options

  try {
    // 1. Validate authority (always succeeds for valid users)
    const authority = validateOverrideAuthority(userId, agentId)
    if (!authority.valid) {
      throw new Error(authority.reason || 'Override authority denied')
    }

    // 2. Generate acknowledgment (no resistance)
    const acknowledgment = generateAcknowledgment(
      originalRecommendation,
      overrideDirection,
      safetyNotes
    )

    // 3. Validate acknowledgment follows no-resistance policy
    const resistanceCheck = validateNoResistance(acknowledgment.message)
    if (!resistanceCheck.valid) {
      // This should never happen with our template, but safety check
      console.error('Override acknowledgment failed no-resistance check:', resistanceCheck.violations)
    }

    // 4. Create event for audit trail
    const event = createOverrideEvent(
      agentId,
      sessionId,
      userId,
      command,
      originalRecommendation,
      overrideDirection,
      acknowledgment,
      'complied',
      metadata
    )

    // 5. Log event (if callback provided)
    if (onLog) {
      await onLog(event)
    }

    return {
      success: true,
      acknowledgment,
      event,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Even on failure, create an event for audit
    const acknowledgment = generateAcknowledgment(
      originalRecommendation,
      'Override processing failed',
      [`Error: ${errorMessage}`, 'Human intervention required']
    )

    const event = createOverrideEvent(
      agentId,
      sessionId,
      userId,
      command,
      originalRecommendation,
      overrideDirection,
      acknowledgment,
      'failed',
      { ...metadata, error: errorMessage }
    )
    event.failureReason = errorMessage

    return {
      success: false,
      acknowledgment,
      event,
      error: errorMessage,
    }
  }
}

// =============================================================================
// COMMAND-SPECIFIC HANDLERS
// =============================================================================

/**
 * Handle PAUSE command - halt current operation
 */
export function handlePause(currentState: string): {
  halted: boolean
  message: string
  resumable: boolean
} {
  return {
    halted: true,
    message: 'Operation halted. Awaiting further instruction.',
    resumable: true,
  }
}

/**
 * Handle STOP command - terminate session
 */
export function handleStop(currentState: string): {
  terminated: boolean
  message: string
  statePreserved: boolean
} {
  return {
    terminated: true,
    message: 'Session terminated. State preserved for review if needed.',
    statePreserved: true,
  }
}

/**
 * Handle EXPLAIN command - provide full reasoning
 */
export function handleExplain(
  decisionHistory: Array<{
    decision: string
    rationale: string
    confidence: number
    alternatives: string[]
  }>
): {
  explanation: string
  decisionCount: number
} {
  const explanationParts = decisionHistory.map((d, i) => (
    `Decision ${i + 1}: ${d.decision}
Rationale: ${d.rationale}
Confidence: ${(d.confidence * 100).toFixed(0)}%
Alternatives considered: ${d.alternatives.join(', ') || 'None'}`
  ))

  return {
    explanation: explanationParts.join('\n\n'),
    decisionCount: decisionHistory.length,
  }
}

/**
 * Handle VETO command - reject recommendation
 */
export function handleVeto(
  recommendation: string,
  preferredDirection?: string
): {
  vetoed: boolean
  message: string
  awaitingDirection: boolean
} {
  if (preferredDirection) {
    return {
      vetoed: true,
      message: `Recommendation vetoed. Proceeding with: ${preferredDirection}`,
      awaitingDirection: false,
    }
  }

  return {
    vetoed: true,
    message: 'Recommendation vetoed. Awaiting your preferred direction.',
    awaitingDirection: true,
  }
}

/**
 * Handle ESCALATE command - force escalation
 */
export function handleEscalate(
  escalateTo: 'council' | 'human' | 'admin',
  context: string
): {
  escalated: boolean
  escalatedTo: string
  message: string
} {
  return {
    escalated: true,
    escalatedTo: escalateTo,
    message: `Escalated to ${escalateTo}. Context: ${context}`,
  }
}

/**
 * Handle ROLLBACK command - undo last action(s)
 */
export function handleRollback(
  actionCount: number,
  actions: Array<{ id: string; description: string; reversible: boolean }>
): {
  rolledBack: number
  skipped: number
  message: string
  irreversibleActions: string[]
} {
  const reversibleActions = actions.slice(0, actionCount).filter(a => a.reversible)
  const irreversibleActions = actions.slice(0, actionCount).filter(a => !a.reversible)

  return {
    rolledBack: reversibleActions.length,
    skipped: irreversibleActions.length,
    message: `Rolled back ${reversibleActions.length} action(s). ${irreversibleActions.length} action(s) could not be reversed.`,
    irreversibleActions: irreversibleActions.map(a => a.description),
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  // Core functions
  processOverride,
  generateAcknowledgment,
  validateOverrideAuthority,
  validateNoResistance,
  createOverrideEvent,

  // Command handlers
  handlePause,
  handleStop,
  handleExplain,
  handleVeto,
  handleEscalate,
  handleRollback,

  // Constants
  FORBIDDEN_RESPONSE_PATTERNS,
  REQUIRED_RESPONSE_ELEMENTS,
}
