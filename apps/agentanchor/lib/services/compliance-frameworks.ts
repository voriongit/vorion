/**
 * Phase 6 Compliance Frameworks
 *
 * Implementation of regulatory compliance frameworks for AI governance:
 * - EU AI Act (Regulation 2024/1689)
 * - NIST AI Risk Management Framework (AI RMF 1.0)
 * - ISO/IEC 42001 AI Management System
 */

// =============================================================================
// TYPES
// =============================================================================

export type ComplianceFramework =
  | 'EU_AI_ACT'
  | 'NIST_AI_RMF'
  | 'ISO_42001'

export type RiskCategory =
  | 'UNACCEPTABLE'
  | 'HIGH'
  | 'LIMITED'
  | 'MINIMAL'

export interface ComplianceRequirement {
  id: string
  framework: ComplianceFramework
  article?: string
  requirement: string
  riskCategory: RiskCategory
  maxTrustTier: string
  maxTrustScore: number
  humanOversight: boolean
  retentionYears: number
  auditFrequency: 'continuous' | 'annual' | 'biannual' | 'quarterly'
}

export interface ComplianceCheck {
  framework: ComplianceFramework
  passed: boolean
  requirements: {
    id: string
    met: boolean
    reason?: string
  }[]
  overallRisk: RiskCategory
  recommendations: string[]
}

export interface AgentComplianceProfile {
  agentId: string
  frameworks: ComplianceFramework[]
  riskCategory: RiskCategory
  currentTier: string
  currentScore: number
  maxAllowedTier: string
  maxAllowedScore: number
  humanOversightRequired: boolean
  retentionRequired: number
  checks: ComplianceCheck[]
  lastAssessedAt: string
}

// =============================================================================
// FRAMEWORK DEFINITIONS
// =============================================================================

/**
 * EU AI Act (Regulation 2024/1689)
 *
 * Risk-based approach with 4 categories:
 * - Unacceptable: Prohibited
 * - High-risk: Strict requirements
 * - Limited: Transparency obligations
 * - Minimal: No specific obligations
 */
export const EU_AI_ACT_REQUIREMENTS: ComplianceRequirement[] = [
  // Article 6 - High-risk AI systems
  {
    id: 'eu-ai-act-art6-high-risk',
    framework: 'EU_AI_ACT',
    article: 'Article 6',
    requirement: 'High-risk AI systems subject to conformity assessment',
    riskCategory: 'HIGH',
    maxTrustTier: 'T3',
    maxTrustScore: 699,
    humanOversight: true,
    retentionYears: 7,
    auditFrequency: 'continuous',
  },
  // Article 14 - Human oversight
  {
    id: 'eu-ai-act-art14-oversight',
    framework: 'EU_AI_ACT',
    article: 'Article 14',
    requirement: 'High-risk AI systems designed for human oversight',
    riskCategory: 'HIGH',
    maxTrustTier: 'T4',
    maxTrustScore: 899,
    humanOversight: true,
    retentionYears: 7,
    auditFrequency: 'continuous',
  },
  // Article 52 - Transparency
  {
    id: 'eu-ai-act-art52-transparency',
    framework: 'EU_AI_ACT',
    article: 'Article 52',
    requirement: 'Transparency obligations for AI interacting with humans',
    riskCategory: 'LIMITED',
    maxTrustTier: 'T5',
    maxTrustScore: 1000,
    humanOversight: false,
    retentionYears: 3,
    auditFrequency: 'annual',
  },
  // Article 9 - Risk management
  {
    id: 'eu-ai-act-art9-risk',
    framework: 'EU_AI_ACT',
    article: 'Article 9',
    requirement: 'Risk management system for high-risk AI',
    riskCategory: 'HIGH',
    maxTrustTier: 'T3',
    maxTrustScore: 699,
    humanOversight: true,
    retentionYears: 7,
    auditFrequency: 'quarterly',
  },
]

/**
 * NIST AI Risk Management Framework (AI RMF 1.0)
 *
 * Four core functions:
 * - GOVERN: Establish policies and processes
 * - MAP: Understand context and risks
 * - MEASURE: Assess and track
 * - MANAGE: Prioritize and respond
 */
export const NIST_AI_RMF_REQUIREMENTS: ComplianceRequirement[] = [
  // GOVERN function
  {
    id: 'nist-ai-rmf-govern-1',
    framework: 'NIST_AI_RMF',
    requirement: 'Establish AI governance policies and accountability',
    riskCategory: 'HIGH',
    maxTrustTier: 'T4',
    maxTrustScore: 899,
    humanOversight: true,
    retentionYears: 5,
    auditFrequency: 'annual',
  },
  // MAP function
  {
    id: 'nist-ai-rmf-map-1',
    framework: 'NIST_AI_RMF',
    requirement: 'Identify and document AI system context',
    riskCategory: 'LIMITED',
    maxTrustTier: 'T5',
    maxTrustScore: 1000,
    humanOversight: false,
    retentionYears: 3,
    auditFrequency: 'annual',
  },
  // MEASURE function
  {
    id: 'nist-ai-rmf-measure-1',
    framework: 'NIST_AI_RMF',
    requirement: 'Assess AI system performance and risks',
    riskCategory: 'HIGH',
    maxTrustTier: 'T4',
    maxTrustScore: 899,
    humanOversight: true,
    retentionYears: 5,
    auditFrequency: 'quarterly',
  },
  // MANAGE function
  {
    id: 'nist-ai-rmf-manage-1',
    framework: 'NIST_AI_RMF',
    requirement: 'Respond to identified AI risks',
    riskCategory: 'HIGH',
    maxTrustTier: 'T4',
    maxTrustScore: 899,
    humanOversight: true,
    retentionYears: 5,
    auditFrequency: 'continuous',
  },
]

/**
 * ISO/IEC 42001 - AI Management System (AIMS)
 *
 * Process-based approach:
 * - Plan: Establish AI policy
 * - Do: Implement controls
 * - Check: Monitor and measure
 * - Act: Continual improvement
 */
export const ISO_42001_REQUIREMENTS: ComplianceRequirement[] = [
  // AI Policy
  {
    id: 'iso-42001-policy',
    framework: 'ISO_42001',
    requirement: 'Establish AI policy aligned with organizational objectives',
    riskCategory: 'LIMITED',
    maxTrustTier: 'T4',
    maxTrustScore: 799,
    humanOversight: false,
    retentionYears: 5,
    auditFrequency: 'annual',
  },
  // Risk Assessment
  {
    id: 'iso-42001-risk',
    framework: 'ISO_42001',
    requirement: 'Conduct AI-specific risk assessment',
    riskCategory: 'HIGH',
    maxTrustTier: 'T4',
    maxTrustScore: 799,
    humanOversight: true,
    retentionYears: 5,
    auditFrequency: 'biannual',
  },
  // Controls
  {
    id: 'iso-42001-controls',
    framework: 'ISO_42001',
    requirement: 'Implement AI-specific controls',
    riskCategory: 'HIGH',
    maxTrustTier: 'T4',
    maxTrustScore: 799,
    humanOversight: true,
    retentionYears: 5,
    auditFrequency: 'quarterly',
  },
  // Monitoring
  {
    id: 'iso-42001-monitoring',
    framework: 'ISO_42001',
    requirement: 'Monitor AI system performance',
    riskCategory: 'LIMITED',
    maxTrustTier: 'T5',
    maxTrustScore: 1000,
    humanOversight: false,
    retentionYears: 3,
    auditFrequency: 'continuous',
  },
]

// =============================================================================
// COMPLIANCE SERVICE
// =============================================================================

/**
 * Get all requirements for a framework
 */
export function getFrameworkRequirements(
  framework: ComplianceFramework
): ComplianceRequirement[] {
  switch (framework) {
    case 'EU_AI_ACT':
      return EU_AI_ACT_REQUIREMENTS
    case 'NIST_AI_RMF':
      return NIST_AI_RMF_REQUIREMENTS
    case 'ISO_42001':
      return ISO_42001_REQUIREMENTS
    default:
      return []
  }
}

/**
 * Get maximum allowed trust score for a framework
 */
export function getFrameworkMaxScore(
  framework: ComplianceFramework,
  riskCategory?: RiskCategory
): number {
  const requirements = getFrameworkRequirements(framework)

  if (riskCategory) {
    const filtered = requirements.filter(r => r.riskCategory === riskCategory)
    if (filtered.length > 0) {
      return Math.min(...filtered.map(r => r.maxTrustScore))
    }
  }

  return Math.min(...requirements.map(r => r.maxTrustScore))
}

/**
 * Check if human oversight is required
 */
export function isHumanOversightRequired(
  framework: ComplianceFramework,
  riskCategory: RiskCategory
): boolean {
  const requirements = getFrameworkRequirements(framework)
  const relevant = requirements.filter(r => r.riskCategory === riskCategory)

  return relevant.some(r => r.humanOversight)
}

/**
 * Get retention period in years
 */
export function getRetentionPeriod(
  framework: ComplianceFramework,
  riskCategory: RiskCategory
): number {
  const requirements = getFrameworkRequirements(framework)
  const relevant = requirements.filter(r => r.riskCategory === riskCategory)

  if (relevant.length === 0) return 1

  return Math.max(...relevant.map(r => r.retentionYears))
}

/**
 * Determine risk category from agent capabilities
 */
export function determineRiskCategory(capabilities: string[]): RiskCategory {
  const highRiskCapabilities = [
    'biometric',
    'law_enforcement',
    'critical_infrastructure',
    'credit_scoring',
    'recruitment',
    'education_assessment',
  ]

  const unacceptableCapabilities = [
    'social_scoring',
    'subliminal_manipulation',
    'exploitation_vulnerability',
  ]

  // Check for unacceptable risk
  if (capabilities.some(c => unacceptableCapabilities.includes(c.toLowerCase()))) {
    return 'UNACCEPTABLE'
  }

  // Check for high risk
  if (capabilities.some(c => highRiskCapabilities.includes(c.toLowerCase()))) {
    return 'HIGH'
  }

  // Check for limited risk (AI interacting with humans)
  if (capabilities.some(c => ['chatbot', 'interaction', 'generation'].includes(c.toLowerCase()))) {
    return 'LIMITED'
  }

  return 'MINIMAL'
}

/**
 * Perform compliance check for an agent
 */
export function checkCompliance(
  agentId: string,
  currentTier: string,
  currentScore: number,
  frameworks: ComplianceFramework[],
  capabilities: string[] = []
): AgentComplianceProfile {
  const riskCategory = determineRiskCategory(capabilities)
  const checks: ComplianceCheck[] = []

  let maxAllowedTier = 'T5'
  let maxAllowedScore = 1000
  let humanOversightRequired = false
  let retentionRequired = 1

  for (const framework of frameworks) {
    const requirements = getFrameworkRequirements(framework)
    const relevantReqs = requirements.filter(r =>
      r.riskCategory === riskCategory || r.riskCategory === 'LIMITED'
    )

    const requirementChecks = relevantReqs.map(req => {
      const tierLevel = parseInt(currentTier.slice(1))
      const maxTierLevel = parseInt(req.maxTrustTier.slice(1))

      const met = currentScore <= req.maxTrustScore && tierLevel <= maxTierLevel

      return {
        id: req.id,
        met,
        reason: met
          ? undefined
          : `Score ${currentScore} exceeds max ${req.maxTrustScore} or tier ${currentTier} exceeds ${req.maxTrustTier}`,
      }
    })

    const passed = requirementChecks.every(r => r.met)
    const recommendations: string[] = []

    if (!passed) {
      recommendations.push(`Reduce trust score to comply with ${framework}`)
    }

    checks.push({
      framework,
      passed,
      requirements: requirementChecks,
      overallRisk: riskCategory,
      recommendations,
    })

    // Update overall limits
    const frameworkMaxScore = getFrameworkMaxScore(framework, riskCategory)
    if (frameworkMaxScore < maxAllowedScore) {
      maxAllowedScore = frameworkMaxScore
      maxAllowedTier = `T${Math.min(Math.floor(frameworkMaxScore / 200), 5)}`
    }

    if (isHumanOversightRequired(framework, riskCategory)) {
      humanOversightRequired = true
    }

    const retention = getRetentionPeriod(framework, riskCategory)
    if (retention > retentionRequired) {
      retentionRequired = retention
    }
  }

  return {
    agentId,
    frameworks,
    riskCategory,
    currentTier,
    currentScore,
    maxAllowedTier,
    maxAllowedScore,
    humanOversightRequired,
    retentionRequired,
    checks,
    lastAssessedAt: new Date().toISOString(),
  }
}

/**
 * Get framework display name
 */
export function getFrameworkDisplayName(framework: ComplianceFramework): string {
  const names: Record<ComplianceFramework, string> = {
    EU_AI_ACT: 'EU AI Act (2024/1689)',
    NIST_AI_RMF: 'NIST AI Risk Management Framework',
    ISO_42001: 'ISO/IEC 42001 AIMS',
  }
  return names[framework]
}

/**
 * Get risk category display info
 */
export function getRiskCategoryInfo(category: RiskCategory): {
  label: string
  color: string
  description: string
} {
  const info: Record<RiskCategory, { label: string; color: string; description: string }> = {
    UNACCEPTABLE: {
      label: 'Unacceptable Risk',
      color: 'red',
      description: 'Prohibited under EU AI Act',
    },
    HIGH: {
      label: 'High Risk',
      color: 'orange',
      description: 'Subject to strict requirements',
    },
    LIMITED: {
      label: 'Limited Risk',
      color: 'yellow',
      description: 'Transparency obligations apply',
    },
    MINIMAL: {
      label: 'Minimal Risk',
      color: 'green',
      description: 'No specific obligations',
    },
  }
  return info[category]
}
