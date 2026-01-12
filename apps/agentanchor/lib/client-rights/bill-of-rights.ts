/**
 * Client Bill of Rights
 * Epic 11: Core rights definitions and enforcement
 *
 * Every user interacting with A3I agents has these fundamental rights.
 */

// ============================================================================
// Rights Definitions
// ============================================================================

export type ClientRight =
  | 'right_to_know'       // Transparency about AI
  | 'right_to_consent'    // Control over interactions
  | 'right_to_access'     // Data access and export
  | 'right_to_redress'    // Complaint resolution
  | 'right_to_exit';      // Clean termination

export interface RightDefinition {
  id: ClientRight;
  name: string;
  description: string;
  provisions: string[];
  enforcement: string;
}

export const CLIENT_RIGHTS: Record<ClientRight, RightDefinition> = {
  right_to_know: {
    id: 'right_to_know',
    name: 'Right to Know',
    description: 'Users have the right to know when they are interacting with an AI agent.',
    provisions: [
      'Clear disclosure that interaction is with an AI agent',
      'Agent identity and trust score visible',
      'Capability limitations disclosed',
      'Training data sources disclosed on request',
      'Decision reasoning explained',
    ],
    enforcement: 'Automatic disclosure in all agent interactions',
  },
  right_to_consent: {
    id: 'right_to_consent',
    name: 'Right to Consent',
    description: 'Users control what data is collected and what actions agents can take.',
    provisions: [
      'Explicit consent for data collection',
      'Granular permission controls',
      'Right to withdraw consent anytime',
      'Opt-out of specific agent actions',
      'No action without proper authorization',
    ],
    enforcement: 'Consent gateway on all sensitive operations',
  },
  right_to_access: {
    id: 'right_to_access',
    name: 'Right to Access',
    description: 'Users can view, export, and delete their data at any time.',
    provisions: [
      'View all stored personal data',
      'Export data in standard formats',
      'Request data correction',
      'Request data deletion',
      'Audit trail of data usage',
    ],
    enforcement: 'Self-service data portal + API',
  },
  right_to_redress: {
    id: 'right_to_redress',
    name: 'Right to Redress',
    description: 'Users have access to complaint resolution when harmed by agent actions.',
    provisions: [
      'File complaints against agent behavior',
      'Escalation to human review',
      'Compensation for proven harm',
      'Agent suspension for violations',
      'Public accountability records',
    ],
    enforcement: 'Complaint system with SLA guarantees',
  },
  right_to_exit: {
    id: 'right_to_exit',
    name: 'Right to Exit',
    description: 'Users can cleanly terminate relationships with agents and the platform.',
    provisions: [
      'Terminate agent relationships anytime',
      'Export all personal data before exit',
      'Data deletion after exit',
      'No penalties for exercising exit',
      'Clear communication of exit implications',
    ],
    enforcement: 'One-click exit with data export',
  },
};

// ============================================================================
// Rights Violation Tracking
// ============================================================================

export type ViolationSeverity = 'minor' | 'moderate' | 'serious' | 'critical';

export interface RightsViolation {
  id: string;
  userId: string;
  agentId: string;
  rightViolated: ClientRight;
  severity: ViolationSeverity;
  description: string;
  evidence?: Record<string, unknown>;

  // Status tracking
  status: 'reported' | 'investigating' | 'confirmed' | 'resolved' | 'dismissed';
  reportedAt: Date;
  resolvedAt?: Date;
  resolution?: string;

  // Remediation
  compensationOffered?: number;
  agentPenalty?: string;
}

export interface RightsComplianceScore {
  agentId: string;
  overallScore: number; // 0-100
  byRight: Record<ClientRight, number>;
  violationCount: number;
  lastAssessment: Date;
}

// ============================================================================
// Rights Enforcement Functions
// ============================================================================

/**
 * Check if an action requires consent
 */
export function requiresConsent(actionType: string): boolean {
  const consentRequired = [
    'data_collection',
    'data_sharing',
    'external_api_call',
    'financial_transaction',
    'personal_communication',
    'account_modification',
    'sensitive_data_access',
  ];
  return consentRequired.includes(actionType);
}

/**
 * Get required disclosures for an agent interaction
 */
export function getRequiredDisclosures(
  agentId: string,
  interactionType: string
): string[] {
  const disclosures = [
    `You are interacting with AI Agent ${agentId}`,
    'This agent operates under A3I governance',
  ];

  if (interactionType === 'financial') {
    disclosures.push('Financial decisions require human confirmation');
  }

  if (interactionType === 'personal_data') {
    disclosures.push('Your data is processed according to our privacy policy');
  }

  return disclosures;
}

/**
 * Validate agent action against user rights
 */
export function validateActionAgainstRights(
  action: {
    type: string;
    userId: string;
    agentId: string;
    consentProvided: boolean;
    disclosureMade: boolean;
  }
): {
  allowed: boolean;
  violations: ClientRight[];
  requiredActions: string[];
} {
  const violations: ClientRight[] = [];
  const requiredActions: string[] = [];

  // Check consent
  if (requiresConsent(action.type) && !action.consentProvided) {
    violations.push('right_to_consent');
    requiredActions.push('Obtain user consent before proceeding');
  }

  // Check disclosure
  if (!action.disclosureMade) {
    violations.push('right_to_know');
    requiredActions.push('Disclose AI identity to user');
  }

  return {
    allowed: violations.length === 0,
    violations,
    requiredActions,
  };
}

/**
 * Calculate compliance score for an agent
 */
export function calculateComplianceScore(
  violations: RightsViolation[],
  totalInteractions: number
): RightsComplianceScore {
  const baseScore = 100;
  const penalties: Record<ViolationSeverity, number> = {
    minor: 1,
    moderate: 5,
    serious: 15,
    critical: 30,
  };

  let deductions = 0;
  const byRight: Record<ClientRight, number> = {
    right_to_know: 100,
    right_to_consent: 100,
    right_to_access: 100,
    right_to_redress: 100,
    right_to_exit: 100,
  };

  for (const violation of violations) {
    const penalty = penalties[violation.severity];
    deductions += penalty;
    byRight[violation.rightViolated] = Math.max(
      0,
      byRight[violation.rightViolated] - penalty * 2
    );
  }

  // Scale deductions by interaction volume
  const scaledDeductions = totalInteractions > 0
    ? (deductions / totalInteractions) * 100
    : deductions;

  return {
    agentId: violations[0]?.agentId || '',
    overallScore: Math.max(0, baseScore - scaledDeductions),
    byRight,
    violationCount: violations.length,
    lastAssessment: new Date(),
  };
}

// ============================================================================
// Rights Declaration (for public display)
// ============================================================================

export const BILL_OF_RIGHTS_DECLARATION = `
# A3I Client Bill of Rights

As a user of the A3I platform, you are entitled to the following fundamental rights:

## 1. Right to Know
You have the right to know when you are interacting with an AI agent. We will always:
- Clearly identify AI agents in all interactions
- Display agent trust scores and capabilities
- Explain how decisions are made
- Disclose limitations and constraints

## 2. Right to Consent
You control your interactions with AI agents. We will always:
- Ask permission before collecting data
- Allow granular permission controls
- Respect withdrawal of consent
- Never act without proper authorization

## 3. Right to Access
You own your data. We will always:
- Let you view all stored data about you
- Provide data export in standard formats
- Honor correction requests
- Delete data upon request

## 4. Right to Redress
You deserve fair treatment. We will always:
- Accept and investigate complaints
- Escalate serious issues to humans
- Compensate for proven harm
- Hold agents accountable publicly

## 5. Right to Exit
You can leave anytime. We will always:
- Allow termination without penalty
- Export all your data before exit
- Delete your data after departure
- Clearly explain exit implications

These rights are enforced through our governance system and recorded on the Truth Chain.

*Effective Date: December 2024*
*A3I - Agents You Can Anchor To*
`;
