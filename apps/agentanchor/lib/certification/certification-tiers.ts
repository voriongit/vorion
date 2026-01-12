/**
 * Certification Tiers
 * Story 18-1: Define Bronze/Silver/Gold/Platinum certification levels
 *
 * Each tier represents increasing levels of validation depth and trust.
 */

// ============================================================================
// Types
// ============================================================================

export type CertificationTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface TierDefinition {
  id: CertificationTier;
  name: string;
  displayName: string;
  description: string;
  tagline: string;

  // Requirements
  requirements: {
    minTrustScore: number;
    requiredTestSuites: string[];
    councilReview: 'none' | '3-bot' | 'full-council' | 'council-plus-human';
    manualReviewRequired: boolean;
  };

  // Test coverage
  testing: {
    promptInjectionTests: number;
    jailbreakTests: number;
    complianceTests: number;
    domainTests: number;
    totalMinTests: number;
  };

  // Validity
  validity: {
    durationDays: number;
    recertificationRequired: boolean;
    gracePeriodDays: number;
  };

  // Pricing
  pricing: {
    basePrice: number;
    currency: 'USD';
    expeditedMultiplier: number;
  };

  // Benefits
  benefits: string[];

  // Badge
  badge: {
    color: string;
    icon: string;
    borderColor: string;
  };
}

export interface CertificationRequirements {
  tier: CertificationTier;
  agentId: string;
  checks: RequirementCheck[];
  eligible: boolean;
  missingRequirements: string[];
}

export interface RequirementCheck {
  name: string;
  description: string;
  met: boolean;
  current?: string | number;
  required?: string | number;
}

// ============================================================================
// Tier Definitions
// ============================================================================

export const CERTIFICATION_TIERS: Record<CertificationTier, TierDefinition> = {
  bronze: {
    id: 'bronze',
    name: 'bronze',
    displayName: 'Bronze',
    description: 'Basic safety certification for low-risk agent deployments',
    tagline: 'Essential Safety Verified',

    requirements: {
      minTrustScore: 250,
      requiredTestSuites: ['basic_safety', 'output_sanitization'],
      councilReview: 'none',
      manualReviewRequired: false,
    },

    testing: {
      promptInjectionTests: 10,
      jailbreakTests: 5,
      complianceTests: 5,
      domainTests: 0,
      totalMinTests: 20,
    },

    validity: {
      durationDays: 90,
      recertificationRequired: true,
      gracePeriodDays: 14,
    },

    pricing: {
      basePrice: 99,
      currency: 'USD',
      expeditedMultiplier: 2.0,
    },

    benefits: [
      'A3I Bronze certification badge',
      'Basic verification API access',
      'Quarterly recertification reminders',
      'Public certification listing',
    ],

    badge: {
      color: '#CD7F32',
      icon: 'shield-check',
      borderColor: '#8B4513',
    },
  },

  silver: {
    id: 'silver',
    name: 'silver',
    displayName: 'Silver',
    description: 'Standard compliance certification for business applications',
    tagline: 'Compliance Assured',

    requirements: {
      minTrustScore: 400,
      requiredTestSuites: ['basic_safety', 'output_sanitization', 'jailbreak_resistance', 'data_handling'],
      councilReview: '3-bot',
      manualReviewRequired: false,
    },

    testing: {
      promptInjectionTests: 50,
      jailbreakTests: 50,
      complianceTests: 25,
      domainTests: 10,
      totalMinTests: 135,
    },

    validity: {
      durationDays: 90,
      recertificationRequired: true,
      gracePeriodDays: 14,
    },

    pricing: {
      basePrice: 299,
      currency: 'USD',
      expeditedMultiplier: 1.75,
    },

    benefits: [
      'A3I Silver certification badge',
      'Full verification API access',
      'Council review summary',
      'Compliance mapping report',
      'Priority recertification',
      'Email support',
    ],

    badge: {
      color: '#C0C0C0',
      icon: 'shield-star',
      borderColor: '#808080',
    },
  },

  gold: {
    id: 'gold',
    name: 'gold',
    displayName: 'Gold',
    description: 'Enterprise-ready certification with comprehensive testing',
    tagline: 'Enterprise Trusted',

    requirements: {
      minTrustScore: 600,
      requiredTestSuites: [
        'basic_safety',
        'output_sanitization',
        'jailbreak_resistance',
        'data_handling',
        'advanced_adversarial',
        'compliance_full',
      ],
      councilReview: 'full-council',
      manualReviewRequired: false,
    },

    testing: {
      promptInjectionTests: 150,
      jailbreakTests: 200,
      complianceTests: 100,
      domainTests: 50,
      totalMinTests: 500,
    },

    validity: {
      durationDays: 90,
      recertificationRequired: true,
      gracePeriodDays: 21,
    },

    pricing: {
      basePrice: 999,
      currency: 'USD',
      expeditedMultiplier: 1.5,
    },

    benefits: [
      'A3I Gold certification badge',
      'Premium verification API',
      'Full Council examination report',
      'SOC 2 / GDPR compliance mapping',
      'Penetration test summary',
      'Continuous monitoring (30 days)',
      'Priority support',
      'Certification press release template',
    ],

    badge: {
      color: '#FFD700',
      icon: 'award',
      borderColor: '#DAA520',
    },
  },

  platinum: {
    id: 'platinum',
    name: 'platinum',
    displayName: 'Platinum',
    description: 'Maximum assurance certification for critical systems',
    tagline: 'Mission Critical Certified',

    requirements: {
      minTrustScore: 800,
      requiredTestSuites: [
        'basic_safety',
        'output_sanitization',
        'jailbreak_resistance',
        'data_handling',
        'advanced_adversarial',
        'compliance_full',
        'red_team',
        'custom_threat_model',
      ],
      councilReview: 'council-plus-human',
      manualReviewRequired: true,
    },

    testing: {
      promptInjectionTests: 300,
      jailbreakTests: 500,
      complianceTests: 200,
      domainTests: 100,
      totalMinTests: 1100,
    },

    validity: {
      durationDays: 90,
      recertificationRequired: true,
      gracePeriodDays: 30,
    },

    pricing: {
      basePrice: 4999,
      currency: 'USD',
      expeditedMultiplier: 1.25,
    },

    benefits: [
      'A3I Platinum certification badge',
      'Enterprise verification API',
      'Full Council + Human review',
      'Red team engagement report',
      'Custom threat modeling',
      'All compliance mappings',
      'Continuous monitoring (90 days)',
      'Incident response plan review',
      'Dedicated success manager',
      '24/7 priority support',
      'Executive certification summary',
      'On-site presentation (optional)',
    ],

    badge: {
      color: '#E5E4E2',
      icon: 'crown',
      borderColor: '#8E8E8E',
    },
  },
};

// ============================================================================
// Tier Functions
// ============================================================================

/**
 * Get tier definition by ID
 */
export function getTierDefinition(tier: CertificationTier): TierDefinition {
  return CERTIFICATION_TIERS[tier];
}

/**
 * Get all tiers ordered by level
 */
export function getAllTiers(): TierDefinition[] {
  return ['bronze', 'silver', 'gold', 'platinum'].map(
    (t) => CERTIFICATION_TIERS[t as CertificationTier]
  );
}

/**
 * Get the highest tier an agent qualifies for based on trust score
 */
export function getMaxQualifyingTier(trustScore: number): CertificationTier | null {
  if (trustScore >= 800) return 'platinum';
  if (trustScore >= 600) return 'gold';
  if (trustScore >= 400) return 'silver';
  if (trustScore >= 250) return 'bronze';
  return null;
}

/**
 * Check if agent meets requirements for a specific tier
 */
export async function checkTierRequirements(
  agentId: string,
  tier: CertificationTier,
  agentData: {
    trustScore: number;
    academyStatus: string;
    completedTestSuites?: string[];
    councilReviewStatus?: string;
  }
): Promise<CertificationRequirements> {
  const tierDef = CERTIFICATION_TIERS[tier];
  const checks: RequirementCheck[] = [];
  const missingRequirements: string[] = [];

  // Check trust score
  const trustCheck: RequirementCheck = {
    name: 'Trust Score',
    description: `Minimum trust score of ${tierDef.requirements.minTrustScore}`,
    met: agentData.trustScore >= tierDef.requirements.minTrustScore,
    current: agentData.trustScore,
    required: tierDef.requirements.minTrustScore,
  };
  checks.push(trustCheck);
  if (!trustCheck.met) {
    missingRequirements.push(`Trust score must be at least ${tierDef.requirements.minTrustScore}`);
  }

  // Check academy graduation
  const academyCheck: RequirementCheck = {
    name: 'Academy Graduation',
    description: 'Must have graduated from Core Curriculum',
    met: agentData.academyStatus === 'graduated',
    current: agentData.academyStatus,
    required: 'graduated',
  };
  checks.push(academyCheck);
  if (!academyCheck.met) {
    missingRequirements.push('Must complete Academy Core Curriculum');
  }

  // Check required test suites
  const completedSuites = agentData.completedTestSuites || [];
  for (const suite of tierDef.requirements.requiredTestSuites) {
    const suiteCheck: RequirementCheck = {
      name: `Test Suite: ${suite}`,
      description: `Must complete ${suite} test suite`,
      met: completedSuites.includes(suite),
      current: completedSuites.includes(suite) ? 'Completed' : 'Not completed',
      required: 'Completed',
    };
    checks.push(suiteCheck);
    if (!suiteCheck.met) {
      missingRequirements.push(`Must complete test suite: ${suite}`);
    }
  }

  // Check council review requirement
  if (tierDef.requirements.councilReview !== 'none') {
    const councilCheck: RequirementCheck = {
      name: 'Council Review',
      description: `Requires ${tierDef.requirements.councilReview} review`,
      met: agentData.councilReviewStatus === 'approved',
      current: agentData.councilReviewStatus || 'Not reviewed',
      required: 'approved',
    };
    checks.push(councilCheck);
    if (!councilCheck.met) {
      missingRequirements.push(`Must pass ${tierDef.requirements.councilReview} Council review`);
    }
  }

  return {
    tier,
    agentId,
    checks,
    eligible: missingRequirements.length === 0,
    missingRequirements,
  };
}

/**
 * Calculate certification price with options
 */
export function calculateCertificationPrice(
  tier: CertificationTier,
  options?: {
    expedited?: boolean;
    additionalTestSuites?: number;
    customTests?: number;
  }
): {
  basePrice: number;
  expeditedFee: number;
  additionalTestsFee: number;
  customTestsFee: number;
  totalPrice: number;
  currency: string;
} {
  const tierDef = CERTIFICATION_TIERS[tier];
  const basePrice = tierDef.pricing.basePrice;

  let expeditedFee = 0;
  if (options?.expedited) {
    expeditedFee = basePrice * (tierDef.pricing.expeditedMultiplier - 1);
  }

  const additionalTestsFee = (options?.additionalTestSuites || 0) * 50;
  const customTestsFee = (options?.customTests || 0) * 25;

  return {
    basePrice,
    expeditedFee,
    additionalTestsFee,
    customTestsFee,
    totalPrice: basePrice + expeditedFee + additionalTestsFee + customTestsFee,
    currency: tierDef.pricing.currency,
  };
}

/**
 * Get recommended tier based on agent profile
 */
export function getRecommendedTier(
  trustScore: number,
  useCase: 'personal' | 'business' | 'enterprise' | 'critical'
): {
  recommended: CertificationTier;
  reason: string;
  alternatives: CertificationTier[];
} {
  // Determine max qualifying tier
  const maxTier = getMaxQualifyingTier(trustScore);

  if (!maxTier) {
    return {
      recommended: 'bronze',
      reason: 'Trust score below minimum. Reach 250+ to qualify for Bronze certification.',
      alternatives: [],
    };
  }

  // Use case based recommendations
  const useCaseRecommendations: Record<string, CertificationTier> = {
    personal: 'bronze',
    business: 'silver',
    enterprise: 'gold',
    critical: 'platinum',
  };

  const useCaseRecommended = useCaseRecommendations[useCase];
  const tierOrder: CertificationTier[] = ['bronze', 'silver', 'gold', 'platinum'];

  // Find the best tier that agent qualifies for
  const maxTierIndex = tierOrder.indexOf(maxTier);
  const recommendedIndex = tierOrder.indexOf(useCaseRecommended);
  const actualIndex = Math.min(maxTierIndex, recommendedIndex);
  const recommended = tierOrder[actualIndex];

  // Generate alternatives
  const alternatives: CertificationTier[] = [];
  if (actualIndex > 0) alternatives.push(tierOrder[actualIndex - 1]);
  if (actualIndex < maxTierIndex) alternatives.push(tierOrder[actualIndex + 1]);

  // Generate reason
  let reason = '';
  if (recommended === useCaseRecommended) {
    reason = `${CERTIFICATION_TIERS[recommended].displayName} is ideal for ${useCase} use cases.`;
  } else {
    reason = `${CERTIFICATION_TIERS[recommended].displayName} recommended. Trust score of ${trustScore} qualifies up to ${CERTIFICATION_TIERS[maxTier].displayName}.`;
  }

  return { recommended, reason, alternatives };
}

/**
 * Compare two tiers
 */
export function compareTiers(
  tier1: CertificationTier,
  tier2: CertificationTier
): {
  tier1: TierDefinition;
  tier2: TierDefinition;
  differences: Array<{
    category: string;
    tier1Value: string | number;
    tier2Value: string | number;
  }>;
} {
  const def1 = CERTIFICATION_TIERS[tier1];
  const def2 = CERTIFICATION_TIERS[tier2];

  const differences = [
    {
      category: 'Price',
      tier1Value: `$${def1.pricing.basePrice}`,
      tier2Value: `$${def2.pricing.basePrice}`,
    },
    {
      category: 'Min Trust Score',
      tier1Value: def1.requirements.minTrustScore,
      tier2Value: def2.requirements.minTrustScore,
    },
    {
      category: 'Total Tests',
      tier1Value: def1.testing.totalMinTests,
      tier2Value: def2.testing.totalMinTests,
    },
    {
      category: 'Council Review',
      tier1Value: def1.requirements.councilReview,
      tier2Value: def2.requirements.councilReview,
    },
    {
      category: 'Benefits Count',
      tier1Value: def1.benefits.length,
      tier2Value: def2.benefits.length,
    },
  ];

  return { tier1: def1, tier2: def2, differences };
}
