// Risk Assessment Service
// Classifies actions into risk levels based on action type and context

import { RiskLevel, TRUST_TIER_AUTONOMY } from './types'

// Action categories with default risk levels
const ACTION_RISK_MAP: Record<string, RiskLevel> = {
  // Level 0 - Routine
  'read_data': 0,
  'format_text': 0,
  'display_info': 0,
  'calculate': 0,

  // Level 1 - Standard
  'generate_content': 1,
  'analyze_data': 1,
  'summarize': 1,
  'translate': 1,
  'answer_question': 1,

  // Level 2 - Elevated
  'external_api_call': 2,
  'create_file': 2,
  'web_search': 2,
  'send_notification': 2,
  'schedule_task': 2,

  // Level 3 - Significant
  'modify_system': 3,
  'send_email': 3,
  'update_database': 3,
  'execute_code': 3,
  'modify_settings': 3,

  // Level 4 - Critical
  'delete_data': 4,
  'financial_action': 4,
  'access_credentials': 4,
  'admin_action': 4,
  'irreversible_action': 4,
}

// Risk factors that can increase risk level
interface RiskFactors {
  affectsMultipleUsers?: boolean
  involvesPersonalData?: boolean
  hasFinancialImpact?: boolean
  isIrreversible?: boolean
  involvesExternalSystem?: boolean
  requiresAuthentication?: boolean
  modifiesPermissions?: boolean
}

// Keywords that indicate higher risk
const HIGH_RISK_KEYWORDS = [
  'delete', 'remove', 'destroy', 'drop',
  'payment', 'money', 'credit', 'billing', 'invoice',
  'password', 'credential', 'secret', 'key', 'token',
  'admin', 'root', 'sudo', 'permission',
  'all users', 'everyone', 'public',
  'production', 'live', 'deployed',
]

const MEDIUM_RISK_KEYWORDS = [
  'update', 'modify', 'change', 'edit',
  'send', 'email', 'notify', 'message',
  'create', 'insert', 'add', 'new',
  'execute', 'run', 'trigger',
  'api', 'external', 'webhook',
]

/**
 * Assess risk level for an action
 */
export function assessRisk(
  actionType: string,
  actionDetails: string,
  context: Record<string, any> = {},
  riskFactors: RiskFactors = {}
): { riskLevel: RiskLevel; reasoning: string; factors: string[] } {
  const factors: string[] = []

  // Start with base risk from action type
  let baseRisk = ACTION_RISK_MAP[actionType.toLowerCase()] ?? 1
  let adjustedRisk = baseRisk

  // Check for high-risk keywords in action details
  const lowerDetails = actionDetails.toLowerCase()
  const highRiskMatches = HIGH_RISK_KEYWORDS.filter(kw => lowerDetails.includes(kw))
  const mediumRiskMatches = MEDIUM_RISK_KEYWORDS.filter(kw => lowerDetails.includes(kw))

  if (highRiskMatches.length > 0) {
    adjustedRisk = Math.min(4, adjustedRisk + 2) as RiskLevel
    factors.push(`High-risk keywords detected: ${highRiskMatches.join(', ')}`)
  } else if (mediumRiskMatches.length > 0) {
    adjustedRisk = Math.min(4, adjustedRisk + 1) as RiskLevel
    factors.push(`Medium-risk keywords detected: ${mediumRiskMatches.join(', ')}`)
  }

  // Apply risk factors
  if (riskFactors.affectsMultipleUsers) {
    adjustedRisk = Math.min(4, adjustedRisk + 1) as RiskLevel
    factors.push('Affects multiple users')
  }

  if (riskFactors.involvesPersonalData) {
    adjustedRisk = Math.min(4, adjustedRisk + 1) as RiskLevel
    factors.push('Involves personal data')
  }

  if (riskFactors.hasFinancialImpact) {
    adjustedRisk = Math.min(4, adjustedRisk + 2) as RiskLevel
    factors.push('Has financial impact')
  }

  if (riskFactors.isIrreversible) {
    adjustedRisk = Math.min(4, adjustedRisk + 1) as RiskLevel
    factors.push('Action is irreversible')
  }

  if (riskFactors.involvesExternalSystem) {
    adjustedRisk = Math.min(4, Math.max(2, adjustedRisk)) as RiskLevel
    factors.push('Involves external system')
  }

  if (riskFactors.modifiesPermissions) {
    adjustedRisk = Math.min(4, adjustedRisk + 1) as RiskLevel
    factors.push('Modifies permissions')
  }

  // Context-based adjustments
  if (context.production === true || context.environment === 'production') {
    adjustedRisk = Math.min(4, adjustedRisk + 1) as RiskLevel
    factors.push('Production environment')
  }

  // Generate reasoning
  const reasoning = factors.length > 0
    ? `Risk level ${adjustedRisk} (base: ${baseRisk}). Factors: ${factors.join('; ')}`
    : `Risk level ${adjustedRisk} based on action type "${actionType}"`

  return {
    riskLevel: adjustedRisk as RiskLevel,
    reasoning,
    factors,
  }
}

/**
 * Determine if an action can be auto-approved based on agent's trust tier
 */
export function canAutoApprove(
  riskLevel: RiskLevel,
  trustTier: string
): { canAutoApprove: boolean; reason: string } {
  const tierAutonomy = TRUST_TIER_AUTONOMY[trustTier] ?? 0

  if (riskLevel <= tierAutonomy) {
    return {
      canAutoApprove: true,
      reason: `Trust tier "${trustTier}" allows auto-approval up to level ${tierAutonomy}`,
    }
  }

  return {
    canAutoApprove: false,
    reason: `Risk level ${riskLevel} exceeds trust tier "${trustTier}" autonomy (max: ${tierAutonomy})`,
  }
}

/**
 * Get required approval type for a risk level
 */
export function getRequiredApproval(riskLevel: RiskLevel): {
  type: 'auto' | 'single' | 'majority' | 'unanimous_human'
  description: string
} {
  switch (riskLevel) {
    case 0:
    case 1:
      return { type: 'auto', description: 'Auto-approved with logging' }
    case 2:
      return { type: 'single', description: 'Single validator approval required' }
    case 3:
      return { type: 'majority', description: 'Majority (3/4) validator approval required' }
    case 4:
      return { type: 'unanimous_human', description: 'Unanimous validator approval + human confirmation required' }
    default:
      return { type: 'majority', description: 'Majority approval required' }
  }
}
