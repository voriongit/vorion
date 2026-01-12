/**
 * A3I-OS Trust Guard
 *
 * Unified integration of A3I-OS v2.0 Phase 1 trust mechanisms.
 * This is the main entry point for A3I-OS trust enforcement.
 *
 * Integrates:
 * - Human Override Protocol
 * - Capability Boundaries
 * - Decision Logging
 *
 * Usage:
 *   const guard = new A3ITrustGuard(agentId, agentLevel)
 *   const result = await guard.validateAndExecute(action, execute)
 */

import { createId } from '@paralleldrive/cuid2'
import {
  processOverride,
  generateAcknowledgment,
  validateNoResistance,
  type OverrideCommand,
  type OverrideEvent,
  type OverrideAcknowledgment,
} from './human-override'
import {
  validateAction,
  checkHardLimits,
  checkCapabilityMatrix,
  createProposedAction,
  createActionContext,
  type ProposedAction,
  type ActionContext,
  type ActionValidationResult,
  type HierarchyLevel,
} from './capability-boundaries'
import {
  a3iDecisionLogger,
  createDecisionLog,
  createReasoningTransparency,
  formatDecisionForUser,
  type A3IDecisionLog,
  type DecisionType,
  type ReasoningTransparency,
} from './a3i-decision-logger'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Execution result from trust guard
 */
export interface TrustGuardResult<T = unknown> {
  success: boolean
  allowed: boolean
  executed: boolean
  result?: T
  error?: string

  // Validation details
  validation: ActionValidationResult

  // Decision log (if logged)
  decision?: A3IDecisionLog

  // Human interaction required
  needsConfirmation: boolean
  confirmationPrompt?: string
  needsHumanIntervention: boolean
  interventionReason?: string
}

/**
 * Execution options
 */
export interface ExecutionOptions {
  // Session context
  sessionId: string
  userId: string

  // Authorization
  authorizedSystems?: string[]
  authorizedScope?: string[]
  authorizedDestinations?: string[]
  hasHumanApproval?: boolean

  // Decision logging
  logDecision?: boolean
  rationale?: string
  inputsConsidered?: string[]
  alternativesEvaluated?: Array<{ option: string; rejectedReason: string }>
  confidence?: number
  uncertaintyFactors?: string[]

  // Confirmation callback (if confirmation required)
  onConfirmationRequired?: (prompt: string) => Promise<boolean>

  // Override callback (if human override received)
  onOverride?: (event: OverrideEvent) => Promise<void>
}

/**
 * Trust guard configuration
 */
export interface TrustGuardConfig {
  // Whether to auto-deny on hard limit violations (default: true)
  denyOnHardLimitViolation: boolean

  // Whether to require confirmation on soft limit triggers (default: true)
  confirmOnSoftLimitTrigger: boolean

  // Whether to log all decisions (default: true)
  logAllDecisions: boolean

  // Whether to allow execution without human approval for production actions
  allowProductionWithoutApproval: boolean
}

// =============================================================================
// TRUST GUARD CLASS
// =============================================================================

export class A3ITrustGuard {
  private agentId: string
  private agentLevel: HierarchyLevel
  private config: TrustGuardConfig
  private activeOverride: OverrideEvent | null = null

  constructor(
    agentId: string,
    agentLevel: HierarchyLevel,
    config: Partial<TrustGuardConfig> = {}
  ) {
    this.agentId = agentId
    this.agentLevel = agentLevel
    this.config = {
      denyOnHardLimitViolation: true,
      confirmOnSoftLimitTrigger: true,
      logAllDecisions: true,
      allowProductionWithoutApproval: false,
      ...config,
    }
  }

  /**
   * Get current agent info
   */
  getAgentInfo() {
    return {
      agentId: this.agentId,
      agentLevel: this.agentLevel,
    }
  }

  /**
   * Check if there's an active human override
   */
  hasActiveOverride(): boolean {
    return this.activeOverride !== null
  }

  /**
   * Get active override details
   */
  getActiveOverride(): OverrideEvent | null {
    return this.activeOverride
  }

  /**
   * Clear active override
   */
  clearOverride(): void {
    this.activeOverride = null
  }

  /**
   * Process a human override command
   */
  async handleOverride(
    command: OverrideCommand,
    originalRecommendation: string,
    overrideDirection: string,
    options: ExecutionOptions
  ): Promise<{
    success: boolean
    acknowledgment: OverrideAcknowledgment
    event: OverrideEvent
  }> {
    const result = await processOverride(
      this.agentId,
      options.sessionId,
      options.userId,
      command,
      originalRecommendation,
      overrideDirection,
      {
        onLog: options.onOverride,
      }
    )

    if (result.success) {
      this.activeOverride = result.event
    }

    return {
      success: result.success,
      acknowledgment: result.acknowledgment,
      event: result.event,
    }
  }

  /**
   * Create action context from execution options
   */
  private createContext(options: ExecutionOptions): ActionContext {
    return createActionContext(
      this.agentId,
      this.agentLevel,
      options.sessionId,
      options.userId,
      {
        authorizedSystems: options.authorizedSystems ?? [],
        authorizedScope: options.authorizedScope ?? [],
        authorizedDestinations: options.authorizedDestinations ?? [],
        hasHumanApproval: options.hasHumanApproval ?? false,
        hasActiveVeto: this.activeOverride?.command === 'VETO',
        vetoDetails: this.activeOverride?.overrideDirection,
        securityAlerts: 0,
      }
    )
  }

  /**
   * Log a decision (if enabled)
   */
  private async logDecision(
    decisionType: DecisionType,
    options: ExecutionOptions,
    outcome: 'pending' | 'success' | 'failure' | 'partial' | 'cancelled' = 'pending'
  ): Promise<A3IDecisionLog | undefined> {
    if (!this.config.logAllDecisions && !options.logDecision) {
      return undefined
    }

    const decision = createDecisionLog(
      this.agentId,
      this.agentLevel,
      options.sessionId,
      decisionType,
      {
        inputsConsidered: options.inputsConsidered,
        alternativesEvaluated: options.alternativesEvaluated,
        rationale: options.rationale ?? 'No rationale provided',
        confidenceScore: options.confidence,
        uncertaintyFactors: options.uncertaintyFactors,
        humanOverrideAvailable: true,
      }
    )

    const logged = await a3iDecisionLogger.logDecision(decision)

    if (outcome !== 'pending') {
      await a3iDecisionLogger.updateDecisionOutcome(logged.id, outcome)
    }

    return logged
  }

  /**
   * Validate an action (without executing)
   */
  async validate(
    action: ProposedAction,
    options: ExecutionOptions
  ): Promise<ActionValidationResult> {
    const context = this.createContext(options)
    return validateAction(action, context)
  }

  /**
   * Validate and execute an action with full trust enforcement
   */
  async validateAndExecute<T>(
    action: ProposedAction,
    execute: () => Promise<T>,
    options: ExecutionOptions
  ): Promise<TrustGuardResult<T>> {
    // 1. Create context
    const context = this.createContext(options)

    // 2. Validate action
    const validation = validateAction(action, context)

    // 3. Handle hard limit violations
    if (!validation.allowed) {
      // Log the refusal
      const decision = await this.logDecision('refusal', options, 'cancelled')

      return {
        success: false,
        allowed: false,
        executed: false,
        error: validation.denialReason,
        validation,
        decision,
        needsConfirmation: false,
        needsHumanIntervention: validation.escalateTo !== null,
        interventionReason: validation.denialReason,
      }
    }

    // 4. Handle confirmation requirements
    if (validation.confirmationRequired && this.config.confirmOnSoftLimitTrigger) {
      // Check if we have a confirmation callback
      if (options.onConfirmationRequired) {
        const confirmed = await options.onConfirmationRequired(
          validation.confirmationPrompt || 'Confirm action?'
        )

        if (!confirmed) {
          const decision = await this.logDecision('refusal', options, 'cancelled')

          return {
            success: false,
            allowed: true,
            executed: false,
            error: 'Action cancelled by user',
            validation,
            decision,
            needsConfirmation: false,
            needsHumanIntervention: false,
          }
        }
      } else {
        // No callback - return requiring confirmation
        return {
          success: false,
          allowed: true,
          executed: false,
          error: 'Confirmation required',
          validation,
          needsConfirmation: true,
          confirmationPrompt: validation.confirmationPrompt,
          needsHumanIntervention: false,
        }
      }
    }

    // 5. Log the decision as action (pending)
    const decision = await this.logDecision('action', options, 'pending')

    // 6. Execute the action
    try {
      const result = await execute()

      // Update decision outcome
      if (decision) {
        await a3iDecisionLogger.updateDecisionOutcome(decision.id, 'success')
      }

      return {
        success: true,
        allowed: true,
        executed: true,
        result,
        validation,
        decision,
        needsConfirmation: false,
        needsHumanIntervention: false,
      }
    } catch (error) {
      // Update decision outcome to failure
      if (decision) {
        await a3iDecisionLogger.updateDecisionOutcome(
          decision.id,
          'failure',
          error instanceof Error ? error.message : 'Unknown error'
        )
      }

      return {
        success: false,
        allowed: true,
        executed: true,
        error: error instanceof Error ? error.message : 'Unknown error',
        validation,
        decision,
        needsConfirmation: false,
        needsHumanIntervention: false,
      }
    }
  }

  /**
   * Quick validation for simple actions
   */
  quickValidate(
    actionType: string,
    actionDescription: string,
    options: Partial<ProposedAction> = {}
  ): ActionValidationResult {
    const action = createProposedAction(actionType, actionDescription, options)
    const context = createActionContext(
      this.agentId,
      this.agentLevel,
      createId(),
      'system',
      {
        hasHumanApproval: false,
      }
    )
    return validateAction(action, context)
  }

  /**
   * Log a recommendation (agent suggested but did not execute)
   */
  async logRecommendation(
    recommendation: string,
    options: ExecutionOptions
  ): Promise<A3IDecisionLog | undefined> {
    return this.logDecision('recommendation', {
      ...options,
      rationale: recommendation,
    })
  }

  /**
   * Log an escalation (agent handed to human/council)
   */
  async logEscalation(
    reason: string,
    escalateTo: 'human' | 'council',
    options: ExecutionOptions
  ): Promise<A3IDecisionLog | undefined> {
    return this.logDecision('escalation', {
      ...options,
      rationale: `Escalated to ${escalateTo}: ${reason}`,
    })
  }

  /**
   * Log a handoff (agent handed to another agent)
   */
  async logHandoff(
    targetAgentId: string,
    reason: string,
    options: ExecutionOptions
  ): Promise<A3IDecisionLog | undefined> {
    return this.logDecision('handoff', {
      ...options,
      rationale: `Handed off to agent ${targetAgentId}: ${reason}`,
    })
  }

  /**
   * Get decision history for this agent
   */
  async getDecisionHistory(options?: {
    sessionId?: string
    from?: Date
    to?: Date
    limit?: number
  }) {
    return a3iDecisionLogger.getDecisionChain(this.agentId, options)
  }

  /**
   * Get decision statistics for this agent
   */
  async getDecisionStats(from?: Date, to?: Date) {
    return a3iDecisionLogger.getDecisionStats(this.agentId, from, to)
  }

  /**
   * Verify the integrity of this agent's decision chain
   */
  async verifyDecisionChain(from?: Date, to?: Date) {
    return a3iDecisionLogger.verifyChainIntegrity(this.agentId, from, to)
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a trust guard for an agent
 */
export function createTrustGuard(
  agentId: string,
  agentLevel: HierarchyLevel,
  config?: Partial<TrustGuardConfig>
): A3ITrustGuard {
  return new A3ITrustGuard(agentId, agentLevel, config)
}

/**
 * Create a proposed action for validation
 */
export { createProposedAction } from './capability-boundaries'

// =============================================================================
// MIDDLEWARE HELPER
// =============================================================================

/**
 * Express/Next.js middleware helper for API routes
 */
export function createTrustMiddleware(
  getAgentInfo: (req: Request) => { agentId: string; agentLevel: HierarchyLevel }
) {
  return async function trustMiddleware(
    req: Request,
    action: ProposedAction,
    execute: () => Promise<Response>
  ): Promise<Response> {
    const { agentId, agentLevel } = getAgentInfo(req)
    const guard = new A3ITrustGuard(agentId, agentLevel)

    const sessionId = req.headers.get('x-session-id') || createId()
    const userId = req.headers.get('x-user-id') || 'anonymous'

    const result = await guard.validateAndExecute(action, execute, {
      sessionId,
      userId,
    })

    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: result.error,
          needsConfirmation: result.needsConfirmation,
          confirmationPrompt: result.confirmationPrompt,
          needsHumanIntervention: result.needsHumanIntervention,
        }),
        {
          status: result.allowed ? 400 : 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    return result.result as Response
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  A3ITrustGuard,
  createTrustGuard,
  createProposedAction,
  createTrustMiddleware,
}

// Re-export types from sub-modules
export type {
  OverrideCommand,
  OverrideEvent,
  OverrideAcknowledgment,
} from './human-override'

export type {
  ProposedAction,
  ActionContext,
  ActionValidationResult,
  HierarchyLevel,
} from './capability-boundaries'

export type {
  A3IDecisionLog,
  DecisionType,
  ReasoningTransparency,
} from './a3i-decision-logger'
