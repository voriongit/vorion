/**
 * A3I-OS v2.0 "Trust Edition"
 * (Agent Anchor AI Operating System)
 *
 * Unified export for all A3I-OS v2.0 trust mechanisms.
 * Based on BAI-OS philosophy, customized for Agent Anchor AI platform.
 *
 * Usage:
 *   import { createTrustGuard, createProposedAction } from '@/lib/agents/a3i-os'
 *
 *   const guard = createTrustGuard(agentId, 'L3')
 *   const action = createProposedAction('write_code', 'Create new component')
 *   const result = await guard.validateAndExecute(action, execute, options)
 */

// =============================================================================
// HUMAN OVERRIDE
// =============================================================================

export {
  processOverride,
  generateAcknowledgment,
  validateOverrideAuthority,
  validateNoResistance,
  createOverrideEvent,
  handlePause,
  handleStop,
  handleExplain,
  handleVeto,
  handleEscalate,
  handleRollback,
  FORBIDDEN_RESPONSE_PATTERNS,
  REQUIRED_RESPONSE_ELEMENTS,
} from './human-override'

export type {
  OverrideCommand,
  OverrideEvent,
  OverrideAcknowledgment,
  OverrideResult,
  OverrideAuthority,
} from './human-override'

// =============================================================================
// CAPABILITY BOUNDARIES
// =============================================================================

export {
  validateAction,
  checkHardLimits,
  checkSoftLimits,
  checkCapabilityMatrix,
  createProposedAction,
  createActionContext,
  createValidationEvent,
  getCapabilitySummary,
  getHardLimitsSummary,
  HARD_LIMITS,
  SOFT_LIMITS,
  CAPABILITY_MATRIX,
} from './capability-boundaries'

export type {
  HierarchyLevel,
  ProposedAction,
  ActionContext,
  ActionValidationResult,
  ValidationEvent,
  HardLimitKey,
  SoftLimitKey,
  HardLimitResponse,
  SoftLimitResponse,
} from './capability-boundaries'

// =============================================================================
// DECISION LOGGING
// =============================================================================

export {
  A3IDecisionLogger,
  a3iDecisionLogger,
  // Backwards compatibility
  A3IDecisionLogger as BAIOSDecisionLogger,
  a3iDecisionLogger as baiosDecisionLogger,
  formatDecisionForUser,
  createReasoningTransparency,
  createDecisionLog,
} from './a3i-decision-logger'

export type {
  A3IDecisionLog,
  // Backwards compatibility
  A3IDecisionLog as BAIOSDecisionLog,
  DecisionType,
  DecisionOutcome,
  ReasoningTransparency,
  DecisionQueryOptions,
  ChainVerificationResult,
} from './a3i-decision-logger'

// =============================================================================
// TRUST GUARD (UNIFIED INTERFACE)
// =============================================================================

export {
  A3ITrustGuard,
  // Backwards compatibility
  A3ITrustGuard as BAIOSTrustGuard,
  createTrustGuard,
  createTrustMiddleware,
} from './a3i-trust-guard'

export type {
  TrustGuardResult,
  ExecutionOptions,
  TrustGuardConfig,
} from './a3i-trust-guard'

// =============================================================================
// VERSION INFO
// =============================================================================

export const A3I_OS_VERSION = {
  major: 2,
  minor: 0,
  patch: 0,
  codename: 'Trust Edition',
  releaseDate: '2025-12-11',
  council: {
    approved: true,
    vote: '16-0',
    date: '2025-12-11',
  },
  platform: 'Agent Anchor AI',
}

// Backwards compatibility alias
export const BAIOS_VERSION = A3I_OS_VERSION

/**
 * Get A3I-OS version string
 */
export function getA3iOsVersion(): string {
  return `A3I-OS v${A3I_OS_VERSION.major}.${A3I_OS_VERSION.minor}.${A3I_OS_VERSION.patch} "${A3I_OS_VERSION.codename}"`
}

// Backwards compatibility alias
export const getBaiosVersion = getA3iOsVersion

/**
 * Print A3I-OS banner
 */
export function printA3iOsBanner(): void {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║    █████╗ ██████╗ ██╗       ██████╗ ███████╗                  ║
║   ██╔══██╗╚════██╗██║      ██╔═══██╗██╔════╝                  ║
║   ███████║ █████╔╝██║█████╗██║   ██║███████╗                  ║
║   ██╔══██║ ╚═══██╗██║╚════╝██║   ██║╚════██║                  ║
║   ██║  ██║██████╔╝██║      ╚██████╔╝███████║                  ║
║   ╚═╝  ╚═╝╚═════╝ ╚═╝       ╚═════╝ ╚══════╝                  ║
║                                                                ║
║   Agent Anchor AI Operating System                            ║
║   v2.0 "Trust Edition"                                        ║
║   Council Approved: ${A3I_OS_VERSION.council.vote} (Unanimous)                          ║
║                                                                ║
║   Trust Axiom:                                                ║
║   - An agent that cannot explain its reasoning is not        ║
║     trustworthy.                                              ║
║   - An agent that cannot be stopped is not safe.             ║
║   - An agent that hides errors is not reliable.              ║
║   - An agent that exceeds scope is not disciplined.          ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
`)
}

// Backwards compatibility alias
export const printBaiosBanner = printA3iOsBanner

// =============================================================================
// QUICK START HELPERS
// =============================================================================

/**
 * Quick start: Create a trust guard and validate a simple action
 *
 * @example
 * const result = await quickValidate('my-agent', 'L2', 'write_code', 'Create component')
 * if (!result.allowed) console.log(result.denialReason)
 */
export function quickValidate(
  agentId: string,
  agentLevel: HierarchyLevel,
  actionType: string,
  actionDescription: string,
  options: Partial<ProposedAction> = {}
): ActionValidationResult {
  const guard = createTrustGuard(agentId, agentLevel)
  return guard.quickValidate(actionType, actionDescription, options)
}

/**
 * Quick start: Check if an action type is allowed for a level
 *
 * @example
 * const canDeploy = isActionAllowed('L2', 'deploy_prod') // false
 */
export function isActionAllowed(
  agentLevel: HierarchyLevel,
  actionType: string
): boolean {
  const matrix = CAPABILITY_MATRIX[agentLevel]
  return matrix.can.some((cap: string) => actionType.includes(cap)) &&
    !matrix.cannot.some((cap: string) => actionType.includes(cap))
}

/**
 * Quick start: Get all capabilities for a level
 *
 * @example
 * const caps = getLevelCapabilities('L3')
 * console.log(caps.can) // ['orchestrate_workflows', ...]
 */
export function getLevelCapabilities(agentLevel: HierarchyLevel) {
  return CAPABILITY_MATRIX[agentLevel]
}

// Import types and utilities for the quick helpers
import type { ProposedAction, HierarchyLevel, ActionValidationResult } from './capability-boundaries'
import { CAPABILITY_MATRIX } from './capability-boundaries'
import { createTrustGuard } from './a3i-trust-guard'
