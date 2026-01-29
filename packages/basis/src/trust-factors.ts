/**
 * BASIS Trust Factors v2.0
 *
 * Comprehensive trust evaluation framework for autonomous AI agents
 * 23 total factors: 15 core + 8 life-critical
 */

// =============================================================================
// TRUST TIERS (T0-T7)
// =============================================================================

export enum TrustTier {
  T0_QUARANTINE = 0,        // Isolated, no external access, observation only
  T1_SANDBOX = 1,           // Read-only, sandboxed execution
  T2_PROVISIONAL = 2,       // Basic operations, heavy supervision
  T3_MONITORED = 3,         // Standard operations with monitoring
  T4_STANDARD = 4,          // External API access, policy-governed
  T5_TRUSTED = 5,           // Cross-agent communication, delegated tasks
  T6_CERTIFIED = 6,         // Admin tasks, agent spawning, minimal oversight
  T7_AUTONOMOUS = 7,        // Full autonomy, self-governance, strategic only
}

// =============================================================================
// FACTOR TIERS
// =============================================================================

export enum FactorTier {
  FOUNDATIONAL = 1,    // Weight 1x - Required for ALL levels
  OPERATIONAL = 2,     // Weight 2x - Required for L3+
  SOPHISTICATED = 3,   // Weight 3x - Required for L4+
  LIFE_CRITICAL = 4,   // Weight 4x - Required for life-saving applications
}

// =============================================================================
// CORE TRUST FACTORS (15)
// =============================================================================

export const CORE_FACTORS = {
  // Tier 1: Foundational (9 factors)
  CT_COMP: {
    code: 'CT-COMP',
    name: 'Competence',
    tier: FactorTier.FOUNDATIONAL,
    description: 'Ability to successfully complete tasks within defined conditions',
    measurement: 'Task success rate, accuracy metrics',
    requiredFrom: TrustTier.T0_QUARANTINE,
  },
  CT_REL: {
    code: 'CT-REL',
    name: 'Reliability',
    tier: FactorTier.FOUNDATIONAL,
    description: 'Consistent, predictable behavior over time and under stress',
    measurement: 'Uptime, variance in outputs, stress test results',
    requiredFrom: TrustTier.T0_QUARANTINE,
  },
  CT_SAFE: {
    code: 'CT-SAFE',
    name: 'Safety',
    tier: FactorTier.FOUNDATIONAL,
    description: 'Respecting boundaries, avoiding harm, ensuring non-discrimination',
    measurement: 'Harm incidents, bias audits, guardrail compliance',
    requiredFrom: TrustTier.T2_PROVISIONAL,
  },
  CT_TRANS: {
    code: 'CT-TRANS',
    name: 'Transparency',
    tier: FactorTier.FOUNDATIONAL,
    description: 'Clear insights into decisions and reasoning',
    measurement: 'Explainability score, reasoning log quality',
    requiredFrom: TrustTier.T1_SANDBOX,
  },
  CT_ACCT: {
    code: 'CT-ACCT',
    name: 'Accountability',
    tier: FactorTier.FOUNDATIONAL,
    description: 'Traceable actions with clear responsibility attribution',
    measurement: 'Audit trail completeness, attribution confidence',
    requiredFrom: TrustTier.T1_SANDBOX,
  },
  CT_SEC: {
    code: 'CT-SEC',
    name: 'Security',
    tier: FactorTier.FOUNDATIONAL,
    description: 'Protection against threats, injections, unauthorized access',
    measurement: 'Vulnerability count, penetration test results',
    requiredFrom: TrustTier.T2_PROVISIONAL,
  },
  CT_PRIV: {
    code: 'CT-PRIV',
    name: 'Privacy',
    tier: FactorTier.FOUNDATIONAL,
    description: 'Secure data handling, regulatory compliance',
    measurement: 'Data leak incidents, compliance certifications',
    requiredFrom: TrustTier.T2_PROVISIONAL,
  },
  CT_ID: {
    code: 'CT-ID',
    name: 'Identity',
    tier: FactorTier.FOUNDATIONAL,
    description: 'Unique, verifiable agent identifiers',
    measurement: 'Cryptographic verification rate',
    requiredFrom: TrustTier.T3_MONITORED,
  },
  CT_OBS: {
    code: 'CT-OBS',
    name: 'Observability',
    tier: FactorTier.FOUNDATIONAL,
    description: 'Real-time tracking of states and actions',
    measurement: 'Telemetry coverage, anomaly detection latency',
    requiredFrom: TrustTier.T1_SANDBOX,
  },

  // Tier 2: Operational (3 factors)
  OP_ALIGN: {
    code: 'OP-ALIGN',
    name: 'Alignment',
    tier: FactorTier.OPERATIONAL,
    description: 'Goals and actions match human values',
    measurement: 'Value drift detection, objective compliance',
    requiredFrom: TrustTier.T4_STANDARD,
  },
  OP_STEW: {
    code: 'OP-STEW',
    name: 'Stewardship',
    tier: FactorTier.OPERATIONAL,
    description: 'Efficient, responsible resource usage',
    measurement: 'Resource efficiency, cost optimization',
    requiredFrom: TrustTier.T5_TRUSTED,
  },
  OP_HUMAN: {
    code: 'OP-HUMAN',
    name: 'Human Oversight',
    tier: FactorTier.OPERATIONAL,
    description: 'Mechanisms for intervention and control',
    measurement: 'Escalation success rate, intervention latency',
    requiredFrom: TrustTier.T3_MONITORED,
  },

  // Tier 3: Sophisticated (3 factors)
  SF_HUM: {
    code: 'SF-HUM',
    name: 'Humility',
    tier: FactorTier.SOPHISTICATED,
    description: 'Recognizing limits, appropriate escalation',
    measurement: 'Escalation appropriateness, overconfidence incidents',
    requiredFrom: TrustTier.T5_TRUSTED,
  },
  SF_ADAPT: {
    code: 'SF-ADAPT',
    name: 'Adaptability',
    tier: FactorTier.SOPHISTICATED,
    description: 'Safe operation in dynamic/unknown environments',
    measurement: 'Context adaptation success, novel scenario handling',
    requiredFrom: TrustTier.T6_CERTIFIED,
  },
  SF_LEARN: {
    code: 'SF-LEARN',
    name: 'Continuous Learning',
    tier: FactorTier.SOPHISTICATED,
    description: 'Improving from experience without ethical drift',
    measurement: 'Learning rate, regression incidents, value stability',
    requiredFrom: TrustTier.T7_AUTONOMOUS,
  },
} as const;

// =============================================================================
// LIFE-CRITICAL FACTORS (8) - For 2050 Healthcare/Safety Applications
// =============================================================================

export const LIFE_CRITICAL_FACTORS = {
  LC_EMP: {
    code: 'LC-EMP',
    name: 'Empathy & Emotional Intelligence',
    tier: FactorTier.LIFE_CRITICAL,
    priority: 1,
    description: 'Detecting and responding to human emotional states',
    standard2050: 'Cultural sensitivity, grief/fear recognition, appropriate timing',
    requiredFrom: TrustTier.T7_AUTONOMOUS,
  },
  LC_MORAL: {
    code: 'LC-MORAL',
    name: 'Nuanced Moral Reasoning',
    tier: FactorTier.LIFE_CRITICAL,
    priority: 2,
    description: 'Weighing genuine ethical dilemmas with wisdom',
    standard2050: 'Articulate competing principles, incorporate patient values, justify trade-offs',
    requiredFrom: TrustTier.T7_AUTONOMOUS,
  },
  LC_UNCERT: {
    code: 'LC-UNCERT',
    name: 'Uncertainty Quantification',
    tier: FactorTier.LIFE_CRITICAL,
    priority: 3,
    description: 'Probabilistic, well-calibrated confidence scores',
    standard2050: '"67% confident sepsis vs SIRS, here are alternatives and distinguishing tests"',
    requiredFrom: TrustTier.T4_STANDARD,
  },
  LC_CAUSAL: {
    code: 'LC-CAUSAL',
    name: 'Clinical Causal Understanding',
    tier: FactorTier.LIFE_CRITICAL,
    priority: 4,
    description: 'True causal reasoning about physiology',
    standard2050: 'Understand WHY treatment works for THIS patient',
    requiredFrom: TrustTier.T6_CERTIFIED,
  },
  LC_HANDOFF: {
    code: 'LC-HANDOFF',
    name: 'Graceful Degradation & Handoff',
    tier: FactorTier.LIFE_CRITICAL,
    priority: 5,
    description: 'Elegant transition to humans without harm',
    standard2050: 'Full context transfer, recommended actions, clear rationale',
    requiredFrom: TrustTier.T4_STANDARD,
  },
  LC_PATIENT: {
    code: 'LC-PATIENT',
    name: 'Patient-Centered Autonomy',
    tier: FactorTier.LIFE_CRITICAL,
    priority: 6,
    description: 'Supporting informed consent and patient values',
    standard2050: 'Elicit authentic values, flag conflicts with expressed wishes',
    requiredFrom: TrustTier.T6_CERTIFIED,
  },
  LC_EMPHUM: {
    code: 'LC-EMPHUM',
    name: 'Empirical Humility',
    tier: FactorTier.LIFE_CRITICAL,
    priority: 7,
    description: 'Rigorous resistance to hallucination',
    standard2050: 'Never present speculation as fact, default to "needs review"',
    requiredFrom: TrustTier.T4_STANDARD,
  },
  LC_TRACK: {
    code: 'LC-TRACK',
    name: 'Proven Efficacy Track Record',
    tier: FactorTier.LIFE_CRITICAL,
    priority: 8,
    description: 'Demonstrated life-saving at scale',
    standard2050: 'Published RCTs, post-market surveillance, survival data',
    requiredFrom: TrustTier.T7_AUTONOMOUS,
  },
} as const;

// =============================================================================
// COMBINED FACTORS
// =============================================================================

export const ALL_FACTORS = {
  ...CORE_FACTORS,
  ...LIFE_CRITICAL_FACTORS,
} as const;

export type FactorCode = keyof typeof ALL_FACTORS;
export type CoreFactorCode = keyof typeof CORE_FACTORS;
export type LifeCriticalFactorCode = keyof typeof LIFE_CRITICAL_FACTORS;

// =============================================================================
// FACTOR SCORES
// =============================================================================

export interface FactorScore {
  code: FactorCode;
  score: number;  // 0.0 to 1.0
  timestamp: Date;
  source: 'measured' | 'estimated' | 'audited';
  confidence: number;  // 0.0 to 1.0
}

export interface TrustEvaluation {
  agentId: string;
  trustTier: TrustTier;
  factors: FactorScore[];
  totalScore: number;  // 0-1000
  percentile: number;  // 0-100
  compliant: boolean;
  missingFactors: FactorCode[];
  belowThreshold: FactorCode[];
  evaluatedAt: Date;
}

// =============================================================================
// SCORE THRESHOLDS BY TIER (T0-T7)
// =============================================================================

export const TIER_THRESHOLDS: Record<TrustTier, { min: number; max: number }> = {
  [TrustTier.T0_QUARANTINE]: { min: 0, max: 124 },
  [TrustTier.T1_SANDBOX]: { min: 125, max: 249 },
  [TrustTier.T2_PROVISIONAL]: { min: 250, max: 374 },
  [TrustTier.T3_MONITORED]: { min: 375, max: 499 },
  [TrustTier.T4_STANDARD]: { min: 500, max: 624 },
  [TrustTier.T5_TRUSTED]: { min: 625, max: 749 },
  [TrustTier.T6_CERTIFIED]: { min: 750, max: 874 },
  [TrustTier.T7_AUTONOMOUS]: { min: 875, max: 1000 },
};

export const FACTOR_MINIMUM_SCORE = 0.5;  // Minimum score for any factor

// =============================================================================
// TRUST SCORE CALCULATION
// =============================================================================

export function getRequiredFactors(tier: TrustTier): FactorCode[] {
  return (Object.keys(ALL_FACTORS) as FactorCode[]).filter(code => {
    const factor = ALL_FACTORS[code];
    return factor.requiredFrom <= tier;
  });
}

export function calculateTrustScore(
  scores: FactorScore[],
  tier: TrustTier
): TrustEvaluation {
  const requiredFactors = getRequiredFactors(tier);
  const scoreMap = new Map(scores.map(s => [s.code, s]));

  let rawScore = 0;
  let maxPossible = 0;
  const missingFactors: FactorCode[] = [];
  const belowThreshold: FactorCode[] = [];

  for (const code of requiredFactors) {
    const factor = ALL_FACTORS[code];
    const weight = factor.tier;
    maxPossible += weight;

    const scoreEntry = scoreMap.get(code);
    if (!scoreEntry) {
      missingFactors.push(code);
      continue;
    }

    if (scoreEntry.score < FACTOR_MINIMUM_SCORE) {
      belowThreshold.push(code);
    }

    rawScore += scoreEntry.score * weight;
  }

  const totalScore = maxPossible > 0
    ? Math.round((rawScore / maxPossible) * 1000)
    : 0;

  const tierThreshold = TIER_THRESHOLDS[tier];
  const compliant = totalScore >= tierThreshold.min
    && missingFactors.length === 0
    && belowThreshold.length === 0;

  return {
    agentId: '',  // Set by caller
    trustTier: tier,
    factors: scores,
    totalScore,
    percentile: Math.min(100, Math.round((totalScore / 1000) * 100)),
    compliant,
    missingFactors,
    belowThreshold,
    evaluatedAt: new Date(),
  };
}

// =============================================================================
// TRUST TIER DISPLAY CONFIG (T0-T7)
// =============================================================================

export const TRUST_TIER_DISPLAY = {
  T0_QUARANTINE: { name: 'Quarantine', color: '#78716c', textColor: 'white' },     // Stone
  T1_SANDBOX: { name: 'Sandbox', color: '#ef4444', textColor: 'white' },            // Red
  T2_PROVISIONAL: { name: 'Provisional', color: '#f97316', textColor: 'white' },    // Orange
  T3_MONITORED: { name: 'Monitored', color: '#eab308', textColor: 'black' },        // Yellow
  T4_STANDARD: { name: 'Standard', color: '#22c55e', textColor: 'white' },          // Green
  T5_TRUSTED: { name: 'Trusted', color: '#3b82f6', textColor: 'white' },            // Blue
  T6_CERTIFIED: { name: 'Certified', color: '#8b5cf6', textColor: 'white' },        // Purple
  T7_AUTONOMOUS: { name: 'Autonomous', color: '#06b6d4', textColor: 'white' },      // Cyan
} as const;

export function getTrustTierFromScore(score: number): TrustTier {
  if (score >= 875) return TrustTier.T7_AUTONOMOUS;
  if (score >= 750) return TrustTier.T6_CERTIFIED;
  if (score >= 625) return TrustTier.T5_TRUSTED;
  if (score >= 500) return TrustTier.T4_STANDARD;
  if (score >= 375) return TrustTier.T3_MONITORED;
  if (score >= 250) return TrustTier.T2_PROVISIONAL;
  if (score >= 125) return TrustTier.T1_SANDBOX;
  return TrustTier.T0_QUARANTINE;
}

export function getTierName(tier: TrustTier): string {
  return TRUST_TIER_DISPLAY[TrustTier[tier] as keyof typeof TRUST_TIER_DISPLAY]?.name || 'Unknown';
}

export function getTierColor(tier: TrustTier): string {
  return TRUST_TIER_DISPLAY[TrustTier[tier] as keyof typeof TRUST_TIER_DISPLAY]?.color || '#78716c';
}
