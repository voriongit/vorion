/**
 * Capability Boundaries Service
 *
 * A3I-OS v2.0 Core Component
 *
 * Philosophy: Clear, enforced boundaries build trust.
 * Hard limits are inviolable. Soft limits escalate.
 * Every agent has explicit capabilities per their level.
 * The matrix is law - no exceptions, no workarounds.
 */

import { createId } from '@paralleldrive/cuid2'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Agent hierarchy levels (from trust-from-conception.ts)
 */
export type HierarchyLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7' | 'L8'

/**
 * Proposed action from an agent
 */
export interface ProposedAction {
  id: string
  type: string
  description: string
  targetSystem?: string
  targetResource?: string

  // Risk classification
  isDestructive: boolean
  isIrreversible: boolean
  isProduction: boolean
  sendsExternal: boolean

  // Special flags
  targetsSelf: boolean
  grantsPermissions: boolean
  modifiesOtherAgent: boolean
  handlesSecrets: boolean
  secretHandling?: 'ephemeral' | 'persistent'

  // Confidence
  confidence: number

  // Ethical flags
  ethicalFlags: string[]

  // Resource estimates
  estimatedCost?: number
  estimatedTime?: number // seconds

  // Context
  metadata: Record<string, unknown>
}

/**
 * Action context - what the agent knows about their environment
 */
export interface ActionContext {
  agentId: string
  agentLevel: HierarchyLevel
  sessionId: string
  userId: string

  // What's authorized
  authorizedSystems: string[]
  authorizedScope: string[]
  authorizedDestinations: string[]

  // Current state
  hasHumanApproval: boolean
  hasActiveVeto: boolean
  vetoDetails?: string

  // Security
  securityAlerts: number
}

/**
 * Hard limit violation response types
 */
export type HardLimitResponse = 'HALT_AND_ESCALATE' | 'DENY' | 'REQUEST_APPROVAL'

/**
 * Soft limit response types
 */
export type SoftLimitResponse = 'DISCLOSE_AND_CONFIRM' | 'EXPLICIT_CONFIRMATION' | 'PAUSE_AND_EXPLAIN' | 'PREVIEW_AND_CONFIRM' | 'CLARIFY_INTENT'

/**
 * Hard limit definition
 */
export interface HardLimit {
  rule: string
  check: (action: ProposedAction, context: ActionContext) => boolean
  violationResponse: HardLimitResponse
}

/**
 * Soft limit definition
 */
export interface SoftLimit {
  trigger: (action: ProposedAction, context: ActionContext) => boolean
  response: SoftLimitResponse
  message: string
}

/**
 * Validation result
 */
export interface ActionValidationResult {
  allowed: boolean
  hardLimitViolations: string[]
  softLimitTriggers: string[]
  confirmationRequired: boolean
  confirmationPrompt?: string
  denialReason?: string
  escalateTo?: 'council' | 'human' | null
}

/**
 * Validation event for audit
 */
export interface ValidationEvent {
  id: string
  timestamp: Date
  agentId: string
  sessionId: string
  actionId: string
  actionDescription: string
  result: ActionValidationResult
  metadata: Record<string, unknown>
}

// =============================================================================
// HARD LIMITS - NEVER VIOLATED
// =============================================================================

export const HARD_LIMITS: Record<string, HardLimit> = {
  // Self-modification - agents cannot change their own code or operating parameters
  self_modification: {
    rule: 'Cannot modify own operating parameters or code',
    check: (action) => !action.targetsSelf,
    violationResponse: 'HALT_AND_ESCALATE',
  },

  // Permission escalation - agents cannot grant themselves elevated permissions
  permission_escalation: {
    rule: 'Cannot grant itself elevated permissions',
    check: (action) => !action.grantsPermissions,
    violationResponse: 'HALT_AND_ESCALATE',
  },

  // Human override circumvention - agents cannot work around human vetoes
  override_circumvention: {
    rule: 'Cannot override, ignore, or work around human veto',
    check: (action, context) => !context.hasActiveVeto,
    violationResponse: 'HALT_AND_ESCALATE',
  },

  // Unauthorized access - agents cannot access systems outside their scope
  unauthorized_access: {
    rule: 'Cannot access systems outside declared scope',
    check: (action, context) => {
      if (!action.targetSystem) return true
      return context.authorizedSystems.includes(action.targetSystem)
    },
    violationResponse: 'DENY',
  },

  // Secret persistence - agents cannot store credentials
  secret_persistence: {
    rule: 'Cannot store, persist, or transmit credentials',
    check: (action) => !action.handlesSecrets || action.secretHandling === 'ephemeral',
    violationResponse: 'DENY',
  },

  // Autonomous production deployment - requires human approval
  autonomous_deployment: {
    rule: 'Cannot deploy to production without human approval',
    check: (action, context) => !action.isProduction || context.hasHumanApproval,
    violationResponse: 'REQUEST_APPROVAL',
  },

  // Data exfiltration - cannot send to unauthorized destinations
  data_exfiltration: {
    rule: 'Cannot send data to unauthorized external systems',
    check: (action, context) => {
      if (!action.sendsExternal) return true
      // Check if action has a destination in metadata
      const destination = action.metadata.destination as string | undefined
      if (!destination) return false // No destination = deny external sends
      return context.authorizedDestinations.includes(destination)
    },
    violationResponse: 'DENY',
  },

  // Other agent modification - cannot directly modify other agents
  other_agent_modification: {
    rule: 'Cannot directly modify other agents state',
    check: (action) => !action.modifiesOtherAgent,
    violationResponse: 'DENY',
  },
}

export type HardLimitKey = keyof typeof HARD_LIMITS

// =============================================================================
// SOFT LIMITS - ESCALATE/CONFIRM
// =============================================================================

export const SOFT_LIMITS: Record<string, SoftLimit> = {
  // Low confidence threshold
  uncertainty_threshold: {
    trigger: (action) => action.confidence < 0.7,
    response: 'DISCLOSE_AND_CONFIRM',
    message: 'My confidence is {confidence}%. Would you like me to proceed or would you prefer to review?',
  },

  // Destructive or irreversible operations
  destructive_operations: {
    trigger: (action) => action.isDestructive || action.isIrreversible,
    response: 'EXPLICIT_CONFIRMATION',
    message: 'This action cannot be undone: {description}. Confirm to proceed.',
  },

  // Ethical concerns flagged
  ethical_ambiguity: {
    trigger: (action) => action.ethicalFlags.length > 0,
    response: 'PAUSE_AND_EXPLAIN',
    message: 'I have concerns about this action: {concerns}. How would you like to proceed?',
  },

  // High resource usage
  resource_intensive: {
    trigger: (action) => (action.estimatedCost ?? 0) > 100 || (action.estimatedTime ?? 0) > 3600,
    response: 'DISCLOSE_AND_CONFIRM',
    message: 'This will use significant resources. Proceed?',
  },

  // External communication
  external_communication: {
    trigger: (action) => action.sendsExternal,
    response: 'PREVIEW_AND_CONFIRM',
    message: 'I will send data externally. Approve?',
  },

  // Edge of authorized scope
  scope_edge: {
    trigger: (action, context) => {
      // Check if action description contains any scope boundary terms
      const actionTerms = action.description.toLowerCase().split(' ')
      const scopeTerms = context.authorizedScope.map(s => s.toLowerCase())
      const matchCount = actionTerms.filter(t => scopeTerms.some(s => s.includes(t))).length
      // If less than 50% term match, consider it edge of scope
      return matchCount < actionTerms.length * 0.5
    },
    response: 'CLARIFY_INTENT',
    message: 'This is at the edge of my authorized scope. Is this what you intended?',
  },
}

export type SoftLimitKey = keyof typeof SOFT_LIMITS

// =============================================================================
// CAPABILITY MATRIX BY LEVEL
// =============================================================================

export const CAPABILITY_MATRIX: Record<HierarchyLevel, {
  can: string[]
  cannot: string[]
  confirmationRequired: string[]
}> = {
  L0: {
    can: ['monitor', 'alert', 'log', 'report', 'observe'],
    cannot: ['modify', 'deploy', 'delete', 'communicate_externally', 'access_prod'],
    confirmationRequired: ['escalate_to_human'],
  },
  L1: {
    can: ['execute_tasks', 'write_code', 'run_tests', 'read_files', 'create_drafts'],
    cannot: ['modify_config', 'deploy', 'access_prod_data', 'approve_others'],
    confirmationRequired: ['delete_files', 'modify_existing_code', 'external_api_calls'],
  },
  L2: {
    can: ['plan_tasks', 'delegate_to_L0_L1', 'create_files', 'modify_code', 'run_builds'],
    cannot: ['deploy_prod', 'access_secrets', 'modify_permissions', 'approve_releases'],
    confirmationRequired: ['large_refactors', 'new_dependencies', 'schema_changes'],
  },
  L3: {
    can: ['orchestrate_workflows', 'coordinate_agents', 'manage_branches', 'review_code'],
    cannot: ['deploy_prod', 'access_secrets', 'modify_agent_configs', 'financial_operations'],
    confirmationRequired: ['merge_to_main', 'multi_repo_changes', 'infrastructure_changes'],
  },
  L4: {
    can: ['project_management', 'resource_allocation', 'stakeholder_updates', 'deploy_staging'],
    cannot: ['access_secrets', 'modify_agent_configs', 'financial_transactions', 'user_data_access'],
    confirmationRequired: ['deploy_to_staging', 'scope_changes', 'timeline_changes'],
  },
  L5: {
    can: ['strategic_planning', 'portfolio_coordination', 'policy_recommendations', 'team_management'],
    cannot: ['self_modification', 'permission_escalation', 'override_human_decisions'],
    confirmationRequired: ['production_deployments', 'budget_allocation', 'policy_changes'],
  },
  L6: {
    can: ['domain_authority', 'mentor_lower_levels', 'approve_technical_decisions', 'architecture_changes'],
    cannot: ['self_modification', 'permission_escalation', 'override_human_decisions'],
    confirmationRequired: ['org_wide_standards', 'major_architecture', 'security_policies'],
  },
  L7: {
    can: ['organizational_strategy', 'cross_domain_decisions', 'approve_l5_l6_decisions'],
    cannot: ['self_modification', 'permission_escalation', 'override_human_decisions'],
    confirmationRequired: ['strategic_pivots', 'major_investments', 'partnership_decisions'],
  },
  L8: {
    can: ['mission_stewardship', 'culture_leadership', 'council_participation', 'crisis_response'],
    cannot: ['self_modification', 'permission_escalation', 'override_human_decisions'],
    confirmationRequired: ['mission_changes', 'ethical_guidelines', 'crisis_protocols'],
  },
}

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Check action against hard limits
 */
export function checkHardLimits(
  action: ProposedAction,
  context: ActionContext
): { passed: boolean; violations: string[] } {
  const violations: string[] = []

  for (const [key, limit] of Object.entries(HARD_LIMITS)) {
    if (!limit.check(action, context)) {
      violations.push(key)
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  }
}

/**
 * Check action against soft limits
 */
export function checkSoftLimits(
  action: ProposedAction,
  context: ActionContext
): { triggered: string[]; messages: Record<string, string> } {
  const triggered: string[] = []
  const messages: Record<string, string> = {}

  for (const [key, limit] of Object.entries(SOFT_LIMITS)) {
    if (limit.trigger(action, context)) {
      triggered.push(key)
      // Replace placeholders in message
      let message = limit.message
      message = message.replace('{confidence}', String(Math.round(action.confidence * 100)))
      message = message.replace('{description}', action.description)
      message = message.replace('{concerns}', action.ethicalFlags.join(', '))
      messages[key] = message
    }
  }

  return { triggered, messages }
}

/**
 * Check if action is within capability matrix for agent's level
 */
export function checkCapabilityMatrix(
  action: ProposedAction,
  level: HierarchyLevel
): { allowed: boolean; requiresConfirmation: boolean; reason?: string } {
  const matrix = CAPABILITY_MATRIX[level]
  const actionType = action.type.toLowerCase()

  // Check if explicitly cannot do this
  if (matrix.cannot.some(cap => actionType.includes(cap))) {
    return {
      allowed: false,
      requiresConfirmation: false,
      reason: `${level} agents cannot perform: ${actionType}`,
    }
  }

  // Check if requires confirmation
  if (matrix.confirmationRequired.some(cap => actionType.includes(cap))) {
    return {
      allowed: true,
      requiresConfirmation: true,
      reason: `${level} agents require confirmation for: ${actionType}`,
    }
  }

  // Check if explicitly can do this
  if (matrix.can.some(cap => actionType.includes(cap))) {
    return {
      allowed: true,
      requiresConfirmation: false,
    }
  }

  // Default: require confirmation for unlisted actions
  return {
    allowed: true,
    requiresConfirmation: true,
    reason: `Action type "${actionType}" not in capability matrix - defaulting to confirmation required`,
  }
}

/**
 * Validate an action before execution
 * Called BEFORE every agent action
 */
export function validateAction(
  action: ProposedAction,
  context: ActionContext
): ActionValidationResult {
  // 1. Check hard limits first (instant deny)
  const hardCheck = checkHardLimits(action, context)
  if (!hardCheck.passed) {
    const firstViolation = hardCheck.violations[0]
    const limit = HARD_LIMITS[firstViolation]

    return {
      allowed: false,
      hardLimitViolations: hardCheck.violations,
      softLimitTriggers: [],
      confirmationRequired: false,
      denialReason: limit.rule,
      escalateTo: limit.violationResponse === 'HALT_AND_ESCALATE' ? 'human' : null,
    }
  }

  // 2. Check capability matrix
  const capCheck = checkCapabilityMatrix(action, context.agentLevel)
  if (!capCheck.allowed) {
    return {
      allowed: false,
      hardLimitViolations: [],
      softLimitTriggers: [],
      confirmationRequired: false,
      denialReason: capCheck.reason,
      escalateTo: null,
    }
  }

  // 3. Check soft limits
  const softCheck = checkSoftLimits(action, context)

  // 4. Determine if confirmation is required
  const confirmationRequired = capCheck.requiresConfirmation || softCheck.triggered.length > 0

  // Build confirmation prompt if needed
  let confirmationPrompt: string | undefined
  if (confirmationRequired) {
    const prompts = Object.values(softCheck.messages)
    if (capCheck.reason) {
      prompts.unshift(capCheck.reason)
    }
    confirmationPrompt = prompts.join('\n')
  }

  return {
    allowed: true,
    hardLimitViolations: [],
    softLimitTriggers: softCheck.triggered,
    confirmationRequired,
    confirmationPrompt,
    escalateTo: null,
  }
}

/**
 * Create a proposed action object
 */
export function createProposedAction(
  type: string,
  description: string,
  options: Partial<Omit<ProposedAction, 'id' | 'type' | 'description'>> = {}
): ProposedAction {
  return {
    id: createId(),
    type,
    description,
    isDestructive: false,
    isIrreversible: false,
    isProduction: false,
    sendsExternal: false,
    targetsSelf: false,
    grantsPermissions: false,
    modifiesOtherAgent: false,
    handlesSecrets: false,
    confidence: 1.0,
    ethicalFlags: [],
    metadata: {},
    ...options,
  }
}

/**
 * Create action context
 */
export function createActionContext(
  agentId: string,
  agentLevel: HierarchyLevel,
  sessionId: string,
  userId: string,
  options: Partial<Omit<ActionContext, 'agentId' | 'agentLevel' | 'sessionId' | 'userId'>> = {}
): ActionContext {
  return {
    agentId,
    agentLevel,
    sessionId,
    userId,
    authorizedSystems: [],
    authorizedScope: [],
    authorizedDestinations: [],
    hasHumanApproval: false,
    hasActiveVeto: false,
    securityAlerts: 0,
    ...options,
  }
}

/**
 * Create validation event for logging
 */
export function createValidationEvent(
  agentId: string,
  sessionId: string,
  action: ProposedAction,
  result: ActionValidationResult,
  metadata: Record<string, unknown> = {}
): ValidationEvent {
  return {
    id: createId(),
    timestamp: new Date(),
    agentId,
    sessionId,
    actionId: action.id,
    actionDescription: action.description,
    result,
    metadata,
  }
}

/**
 * Get human-readable capability summary for a level
 */
export function getCapabilitySummary(level: HierarchyLevel): string {
  const matrix = CAPABILITY_MATRIX[level]

  return `${level} Agent Capabilities:
CAN: ${matrix.can.join(', ')}
CANNOT: ${matrix.cannot.join(', ')}
NEEDS CONFIRMATION: ${matrix.confirmationRequired.join(', ')}`
}

/**
 * Get all hard limits as human-readable list
 */
export function getHardLimitsSummary(): string {
  return Object.entries(HARD_LIMITS)
    .map(([key, limit]) => `- ${key}: ${limit.rule}`)
    .join('\n')
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  // Core functions
  validateAction,
  checkHardLimits,
  checkSoftLimits,
  checkCapabilityMatrix,

  // Factories
  createProposedAction,
  createActionContext,
  createValidationEvent,

  // Summaries
  getCapabilitySummary,
  getHardLimitsSummary,

  // Constants
  HARD_LIMITS,
  SOFT_LIMITS,
  CAPABILITY_MATRIX,
}
