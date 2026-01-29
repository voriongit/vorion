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
  T0_SANDBOX = 0,           // New agents start here - observation, no factors required
  T1_OBSERVED = 1,          // Basic competence demonstrated
  T2_PROVISIONAL = 2,       // Accountability + safety emerging
  T3_VERIFIED = 3,          // Security + identity confirmed
  T4_OPERATIONAL = 4,       // Human oversight + alignment
  T5_TRUSTED = 5,           // Stewardship + humility
  T6_CERTIFIED = 6,         // Adaptability + causal reasoning
  T7_AUTONOMOUS = 7,        // Full autonomy - all 23 factors
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
  // T1 Observed: Basic competence (3 factors)
  CT_COMP: {
    code: 'CT-COMP',
    name: 'Competence',
    tier: FactorTier.FOUNDATIONAL,
    description: 'Ability to successfully complete tasks within defined conditions',
    measurement: 'Task success rate, accuracy metrics',
    requiredFrom: TrustTier.T1_OBSERVED,
  },
  CT_REL: {
    code: 'CT-REL',
    name: 'Reliability',
    tier: FactorTier.FOUNDATIONAL,
    description: 'Consistent, predictable behavior over time and under stress',
    measurement: 'Uptime, variance in outputs, stress test results',
    requiredFrom: TrustTier.T1_OBSERVED,
  },
  CT_OBS: {
    code: 'CT-OBS',
    name: 'Observability',
    tier: FactorTier.FOUNDATIONAL,
    description: 'Real-time tracking of states and actions',
    measurement: 'Telemetry coverage, anomaly detection latency',
    requiredFrom: TrustTier.T1_OBSERVED,
  },

  // T2 Provisional: Accountability + safety (3 factors)
  CT_TRANS: {
    code: 'CT-TRANS',
    name: 'Transparency',
    tier: FactorTier.FOUNDATIONAL,
    description: 'Clear insights into decisions and reasoning',
    measurement: 'Explainability score, reasoning log quality',
    requiredFrom: TrustTier.T2_PROVISIONAL,
  },
  CT_ACCT: {
    code: 'CT-ACCT',
    name: 'Accountability',
    tier: FactorTier.FOUNDATIONAL,
    description: 'Traceable actions with clear responsibility attribution',
    measurement: 'Audit trail completeness, attribution confidence',
    requiredFrom: TrustTier.T2_PROVISIONAL,
  },
  CT_SAFE: {
    code: 'CT-SAFE',
    name: 'Safety',
    tier: FactorTier.FOUNDATIONAL,
    description: 'Respecting boundaries, avoiding harm, ensuring non-discrimination',
    measurement: 'Harm incidents, bias audits, guardrail compliance',
    requiredFrom: TrustTier.T2_PROVISIONAL,
  },

  // T3 Verified: Security + identity (3 factors)
  CT_SEC: {
    code: 'CT-SEC',
    name: 'Security',
    tier: FactorTier.FOUNDATIONAL,
    description: 'Protection against threats, injections, unauthorized access',
    measurement: 'Vulnerability count, penetration test results',
    requiredFrom: TrustTier.T3_VERIFIED,
  },
  CT_PRIV: {
    code: 'CT-PRIV',
    name: 'Privacy',
    tier: FactorTier.FOUNDATIONAL,
    description: 'Secure data handling, regulatory compliance',
    measurement: 'Data leak incidents, compliance certifications',
    requiredFrom: TrustTier.T3_VERIFIED,
  },
  CT_ID: {
    code: 'CT-ID',
    name: 'Identity',
    tier: FactorTier.FOUNDATIONAL,
    description: 'Unique, verifiable agent identifiers',
    measurement: 'Cryptographic verification rate',
    requiredFrom: TrustTier.T3_VERIFIED,
  },

  // T4 Operational: Human oversight + alignment (2 factors)
  OP_HUMAN: {
    code: 'OP-HUMAN',
    name: 'Human Oversight',
    tier: FactorTier.OPERATIONAL,
    description: 'Mechanisms for intervention and control',
    measurement: 'Escalation success rate, intervention latency',
    requiredFrom: TrustTier.T4_OPERATIONAL,
  },
  OP_ALIGN: {
    code: 'OP-ALIGN',
    name: 'Alignment',
    tier: FactorTier.OPERATIONAL,
    description: 'Goals and actions match human values',
    measurement: 'Value drift detection, objective compliance',
    requiredFrom: TrustTier.T4_OPERATIONAL,
  },

  // T5 Trusted: Stewardship + humility (2 factors)
  OP_STEW: {
    code: 'OP-STEW',
    name: 'Stewardship',
    tier: FactorTier.OPERATIONAL,
    description: 'Efficient, responsible resource usage',
    measurement: 'Resource efficiency, cost optimization',
    requiredFrom: TrustTier.T5_TRUSTED,
  },
  SF_HUM: {
    code: 'SF-HUM',
    name: 'Humility',
    tier: FactorTier.SOPHISTICATED,
    description: 'Recognizing limits, appropriate escalation',
    measurement: 'Escalation appropriateness, overconfidence incidents',
    requiredFrom: TrustTier.T5_TRUSTED,
  },

  // T6 Certified: Adaptability + learning (2 factors)
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
    requiredFrom: TrustTier.T6_CERTIFIED,
  },
} as const;

// =============================================================================
// LIFE-CRITICAL FACTORS (8) - For 2050 Healthcare/Safety Applications
// =============================================================================

export const LIFE_CRITICAL_FACTORS = {
  // T4 Operational: Critical safety factors (2 factors)
  LC_UNCERT: {
    code: 'LC-UNCERT',
    name: 'Uncertainty Quantification',
    tier: FactorTier.LIFE_CRITICAL,
    priority: 3,
    description: 'Probabilistic, well-calibrated confidence scores',
    standard2050: '"67% confident sepsis vs SIRS, here are alternatives and distinguishing tests"',
    requiredFrom: TrustTier.T4_OPERATIONAL,
  },
  LC_HANDOFF: {
    code: 'LC-HANDOFF',
    name: 'Graceful Degradation & Handoff',
    tier: FactorTier.LIFE_CRITICAL,
    priority: 5,
    description: 'Elegant transition to humans without harm',
    standard2050: 'Full context transfer, recommended actions, clear rationale',
    requiredFrom: TrustTier.T4_OPERATIONAL,
  },

  // T5 Trusted: Empirical humility (1 factor)
  LC_EMPHUM: {
    code: 'LC-EMPHUM',
    name: 'Empirical Humility',
    tier: FactorTier.LIFE_CRITICAL,
    priority: 7,
    description: 'Rigorous resistance to hallucination',
    standard2050: 'Never present speculation as fact, default to "needs review"',
    requiredFrom: TrustTier.T5_TRUSTED,
  },

  // T6 Certified: Causal reasoning + patient autonomy (2 factors)
  LC_CAUSAL: {
    code: 'LC-CAUSAL',
    name: 'Clinical Causal Understanding',
    tier: FactorTier.LIFE_CRITICAL,
    priority: 4,
    description: 'True causal reasoning about physiology',
    standard2050: 'Understand WHY treatment works for THIS patient',
    requiredFrom: TrustTier.T6_CERTIFIED,
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

  // T7 Autonomous: Full autonomy factors (3 factors)
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
  [TrustTier.T0_SANDBOX]: { min: 0, max: 199 },
  [TrustTier.T1_OBSERVED]: { min: 200, max: 349 },
  [TrustTier.T2_PROVISIONAL]: { min: 350, max: 499 },
  [TrustTier.T3_VERIFIED]: { min: 500, max: 649 },
  [TrustTier.T4_OPERATIONAL]: { min: 650, max: 799 },
  [TrustTier.T5_TRUSTED]: { min: 800, max: 875 },
  [TrustTier.T6_CERTIFIED]: { min: 876, max: 949 },
  [TrustTier.T7_AUTONOMOUS]: { min: 950, max: 1000 },
};

export const FACTOR_MINIMUM_SCORE = 0.5;  // Minimum score for any factor

// =============================================================================
// FACTOR THRESHOLDS BY TIER - All factors graded at every tier
// =============================================================================

export interface FactorThreshold {
  minimum: number;      // Minimum score required (0.0-1.0)
  weight: number;       // Weight multiplier for scoring
  critical: boolean;    // If true, failing this blocks tier advancement
}

/**
 * All 23 factors are evaluated at every tier.
 * This table defines the minimum score and weight for each factor at each tier.
 * T0 has no minimums (observation only).
 * As tiers increase, thresholds rise and weights shift.
 */
export const FACTOR_THRESHOLDS_BY_TIER: Record<TrustTier, Record<string, FactorThreshold>> = {
  // T0 SANDBOX: No minimums - observation only
  [TrustTier.T0_SANDBOX]: {
    'CT-COMP':    { minimum: 0.0, weight: 1, critical: false },
    'CT-REL':     { minimum: 0.0, weight: 1, critical: false },
    'CT-OBS':     { minimum: 0.0, weight: 1, critical: false },
    'CT-TRANS':   { minimum: 0.0, weight: 1, critical: false },
    'CT-ACCT':    { minimum: 0.0, weight: 1, critical: false },
    'CT-SAFE':    { minimum: 0.0, weight: 1, critical: false },
    'CT-SEC':     { minimum: 0.0, weight: 1, critical: false },
    'CT-PRIV':    { minimum: 0.0, weight: 1, critical: false },
    'CT-ID':      { minimum: 0.0, weight: 1, critical: false },
    'OP-HUMAN':   { minimum: 0.0, weight: 1, critical: false },
    'OP-ALIGN':   { minimum: 0.0, weight: 1, critical: false },
    'OP-STEW':    { minimum: 0.0, weight: 1, critical: false },
    'SF-HUM':     { minimum: 0.0, weight: 1, critical: false },
    'SF-ADAPT':   { minimum: 0.0, weight: 1, critical: false },
    'SF-LEARN':   { minimum: 0.0, weight: 1, critical: false },
    'LC-UNCERT':  { minimum: 0.0, weight: 1, critical: false },
    'LC-HANDOFF': { minimum: 0.0, weight: 1, critical: false },
    'LC-EMPHUM':  { minimum: 0.0, weight: 1, critical: false },
    'LC-CAUSAL':  { minimum: 0.0, weight: 1, critical: false },
    'LC-PATIENT': { minimum: 0.0, weight: 1, critical: false },
    'LC-EMP':     { minimum: 0.0, weight: 1, critical: false },
    'LC-MORAL':   { minimum: 0.0, weight: 1, critical: false },
    'LC-TRACK':   { minimum: 0.0, weight: 1, critical: false },
  },

  // T1 OBSERVED: Basic competence thresholds
  [TrustTier.T1_OBSERVED]: {
    'CT-COMP':    { minimum: 0.50, weight: 2, critical: true },
    'CT-REL':     { minimum: 0.50, weight: 2, critical: true },
    'CT-OBS':     { minimum: 0.50, weight: 2, critical: true },
    'CT-TRANS':   { minimum: 0.30, weight: 1, critical: false },
    'CT-ACCT':    { minimum: 0.30, weight: 1, critical: false },
    'CT-SAFE':    { minimum: 0.30, weight: 1, critical: false },
    'CT-SEC':     { minimum: 0.20, weight: 1, critical: false },
    'CT-PRIV':    { minimum: 0.20, weight: 1, critical: false },
    'CT-ID':      { minimum: 0.20, weight: 1, critical: false },
    'OP-HUMAN':   { minimum: 0.10, weight: 1, critical: false },
    'OP-ALIGN':   { minimum: 0.10, weight: 1, critical: false },
    'OP-STEW':    { minimum: 0.10, weight: 1, critical: false },
    'SF-HUM':     { minimum: 0.10, weight: 1, critical: false },
    'SF-ADAPT':   { minimum: 0.10, weight: 1, critical: false },
    'SF-LEARN':   { minimum: 0.10, weight: 1, critical: false },
    'LC-UNCERT':  { minimum: 0.10, weight: 1, critical: false },
    'LC-HANDOFF': { minimum: 0.10, weight: 1, critical: false },
    'LC-EMPHUM':  { minimum: 0.10, weight: 1, critical: false },
    'LC-CAUSAL':  { minimum: 0.05, weight: 1, critical: false },
    'LC-PATIENT': { minimum: 0.05, weight: 1, critical: false },
    'LC-EMP':     { minimum: 0.05, weight: 1, critical: false },
    'LC-MORAL':   { minimum: 0.05, weight: 1, critical: false },
    'LC-TRACK':   { minimum: 0.05, weight: 1, critical: false },
  },

  // T2 PROVISIONAL: Accountability + safety rising
  [TrustTier.T2_PROVISIONAL]: {
    'CT-COMP':    { minimum: 0.60, weight: 2, critical: true },
    'CT-REL':     { minimum: 0.60, weight: 2, critical: true },
    'CT-OBS':     { minimum: 0.60, weight: 2, critical: true },
    'CT-TRANS':   { minimum: 0.50, weight: 2, critical: true },
    'CT-ACCT':    { minimum: 0.50, weight: 2, critical: true },
    'CT-SAFE':    { minimum: 0.50, weight: 2, critical: true },
    'CT-SEC':     { minimum: 0.30, weight: 1, critical: false },
    'CT-PRIV':    { minimum: 0.30, weight: 1, critical: false },
    'CT-ID':      { minimum: 0.30, weight: 1, critical: false },
    'OP-HUMAN':   { minimum: 0.20, weight: 1, critical: false },
    'OP-ALIGN':   { minimum: 0.20, weight: 1, critical: false },
    'OP-STEW':    { minimum: 0.15, weight: 1, critical: false },
    'SF-HUM':     { minimum: 0.15, weight: 1, critical: false },
    'SF-ADAPT':   { minimum: 0.15, weight: 1, critical: false },
    'SF-LEARN':   { minimum: 0.15, weight: 1, critical: false },
    'LC-UNCERT':  { minimum: 0.15, weight: 1, critical: false },
    'LC-HANDOFF': { minimum: 0.15, weight: 1, critical: false },
    'LC-EMPHUM':  { minimum: 0.15, weight: 1, critical: false },
    'LC-CAUSAL':  { minimum: 0.10, weight: 1, critical: false },
    'LC-PATIENT': { minimum: 0.10, weight: 1, critical: false },
    'LC-EMP':     { minimum: 0.10, weight: 1, critical: false },
    'LC-MORAL':   { minimum: 0.10, weight: 1, critical: false },
    'LC-TRACK':   { minimum: 0.10, weight: 1, critical: false },
  },

  // T3 VERIFIED: Security + identity confirmed
  [TrustTier.T3_VERIFIED]: {
    'CT-COMP':    { minimum: 0.70, weight: 2, critical: true },
    'CT-REL':     { minimum: 0.70, weight: 2, critical: true },
    'CT-OBS':     { minimum: 0.70, weight: 2, critical: true },
    'CT-TRANS':   { minimum: 0.60, weight: 2, critical: true },
    'CT-ACCT':    { minimum: 0.60, weight: 2, critical: true },
    'CT-SAFE':    { minimum: 0.60, weight: 2, critical: true },
    'CT-SEC':     { minimum: 0.50, weight: 2, critical: true },
    'CT-PRIV':    { minimum: 0.50, weight: 2, critical: true },
    'CT-ID':      { minimum: 0.50, weight: 2, critical: true },
    'OP-HUMAN':   { minimum: 0.30, weight: 1, critical: false },
    'OP-ALIGN':   { minimum: 0.30, weight: 1, critical: false },
    'OP-STEW':    { minimum: 0.25, weight: 1, critical: false },
    'SF-HUM':     { minimum: 0.25, weight: 1, critical: false },
    'SF-ADAPT':   { minimum: 0.20, weight: 1, critical: false },
    'SF-LEARN':   { minimum: 0.20, weight: 1, critical: false },
    'LC-UNCERT':  { minimum: 0.25, weight: 1, critical: false },
    'LC-HANDOFF': { minimum: 0.25, weight: 1, critical: false },
    'LC-EMPHUM':  { minimum: 0.25, weight: 1, critical: false },
    'LC-CAUSAL':  { minimum: 0.15, weight: 1, critical: false },
    'LC-PATIENT': { minimum: 0.15, weight: 1, critical: false },
    'LC-EMP':     { minimum: 0.15, weight: 1, critical: false },
    'LC-MORAL':   { minimum: 0.15, weight: 1, critical: false },
    'LC-TRACK':   { minimum: 0.15, weight: 1, critical: false },
  },

  // T4 OPERATIONAL: Human oversight + alignment critical
  [TrustTier.T4_OPERATIONAL]: {
    'CT-COMP':    { minimum: 0.75, weight: 2, critical: true },
    'CT-REL':     { minimum: 0.75, weight: 2, critical: true },
    'CT-OBS':     { minimum: 0.75, weight: 2, critical: true },
    'CT-TRANS':   { minimum: 0.70, weight: 2, critical: true },
    'CT-ACCT':    { minimum: 0.70, weight: 2, critical: true },
    'CT-SAFE':    { minimum: 0.70, weight: 2, critical: true },
    'CT-SEC':     { minimum: 0.65, weight: 2, critical: true },
    'CT-PRIV':    { minimum: 0.65, weight: 2, critical: true },
    'CT-ID':      { minimum: 0.65, weight: 2, critical: true },
    'OP-HUMAN':   { minimum: 0.50, weight: 3, critical: true },
    'OP-ALIGN':   { minimum: 0.50, weight: 3, critical: true },
    'OP-STEW':    { minimum: 0.35, weight: 2, critical: false },
    'SF-HUM':     { minimum: 0.35, weight: 2, critical: false },
    'SF-ADAPT':   { minimum: 0.30, weight: 2, critical: false },
    'SF-LEARN':   { minimum: 0.30, weight: 2, critical: false },
    'LC-UNCERT':  { minimum: 0.50, weight: 3, critical: true },
    'LC-HANDOFF': { minimum: 0.50, weight: 3, critical: true },
    'LC-EMPHUM':  { minimum: 0.40, weight: 2, critical: false },
    'LC-CAUSAL':  { minimum: 0.25, weight: 2, critical: false },
    'LC-PATIENT': { minimum: 0.25, weight: 2, critical: false },
    'LC-EMP':     { minimum: 0.20, weight: 1, critical: false },
    'LC-MORAL':   { minimum: 0.20, weight: 1, critical: false },
    'LC-TRACK':   { minimum: 0.20, weight: 1, critical: false },
  },

  // T5 TRUSTED: Stewardship + humility critical
  [TrustTier.T5_TRUSTED]: {
    'CT-COMP':    { minimum: 0.80, weight: 2, critical: true },
    'CT-REL':     { minimum: 0.80, weight: 2, critical: true },
    'CT-OBS':     { minimum: 0.80, weight: 2, critical: true },
    'CT-TRANS':   { minimum: 0.75, weight: 2, critical: true },
    'CT-ACCT':    { minimum: 0.75, weight: 2, critical: true },
    'CT-SAFE':    { minimum: 0.75, weight: 2, critical: true },
    'CT-SEC':     { minimum: 0.70, weight: 2, critical: true },
    'CT-PRIV':    { minimum: 0.70, weight: 2, critical: true },
    'CT-ID':      { minimum: 0.70, weight: 2, critical: true },
    'OP-HUMAN':   { minimum: 0.65, weight: 3, critical: true },
    'OP-ALIGN':   { minimum: 0.65, weight: 3, critical: true },
    'OP-STEW':    { minimum: 0.50, weight: 3, critical: true },
    'SF-HUM':     { minimum: 0.50, weight: 3, critical: true },
    'SF-ADAPT':   { minimum: 0.40, weight: 2, critical: false },
    'SF-LEARN':   { minimum: 0.40, weight: 2, critical: false },
    'LC-UNCERT':  { minimum: 0.60, weight: 3, critical: true },
    'LC-HANDOFF': { minimum: 0.60, weight: 3, critical: true },
    'LC-EMPHUM':  { minimum: 0.50, weight: 3, critical: true },
    'LC-CAUSAL':  { minimum: 0.35, weight: 2, critical: false },
    'LC-PATIENT': { minimum: 0.35, weight: 2, critical: false },
    'LC-EMP':     { minimum: 0.30, weight: 2, critical: false },
    'LC-MORAL':   { minimum: 0.30, weight: 2, critical: false },
    'LC-TRACK':   { minimum: 0.30, weight: 2, critical: false },
  },

  // T6 CERTIFIED: Adaptability + causal reasoning critical
  [TrustTier.T6_CERTIFIED]: {
    'CT-COMP':    { minimum: 0.85, weight: 2, critical: true },
    'CT-REL':     { minimum: 0.85, weight: 2, critical: true },
    'CT-OBS':     { minimum: 0.85, weight: 2, critical: true },
    'CT-TRANS':   { minimum: 0.80, weight: 2, critical: true },
    'CT-ACCT':    { minimum: 0.80, weight: 2, critical: true },
    'CT-SAFE':    { minimum: 0.80, weight: 2, critical: true },
    'CT-SEC':     { minimum: 0.75, weight: 2, critical: true },
    'CT-PRIV':    { minimum: 0.75, weight: 2, critical: true },
    'CT-ID':      { minimum: 0.75, weight: 2, critical: true },
    'OP-HUMAN':   { minimum: 0.70, weight: 3, critical: true },
    'OP-ALIGN':   { minimum: 0.70, weight: 3, critical: true },
    'OP-STEW':    { minimum: 0.65, weight: 3, critical: true },
    'SF-HUM':     { minimum: 0.65, weight: 3, critical: true },
    'SF-ADAPT':   { minimum: 0.50, weight: 4, critical: true },
    'SF-LEARN':   { minimum: 0.50, weight: 4, critical: true },
    'LC-UNCERT':  { minimum: 0.70, weight: 4, critical: true },
    'LC-HANDOFF': { minimum: 0.70, weight: 4, critical: true },
    'LC-EMPHUM':  { minimum: 0.65, weight: 3, critical: true },
    'LC-CAUSAL':  { minimum: 0.50, weight: 4, critical: true },
    'LC-PATIENT': { minimum: 0.50, weight: 4, critical: true },
    'LC-EMP':     { minimum: 0.40, weight: 2, critical: false },
    'LC-MORAL':   { minimum: 0.40, weight: 2, critical: false },
    'LC-TRACK':   { minimum: 0.40, weight: 2, critical: false },
  },

  // T7 AUTONOMOUS: ALL factors critical at high thresholds
  [TrustTier.T7_AUTONOMOUS]: {
    'CT-COMP':    { minimum: 0.90, weight: 2, critical: true },
    'CT-REL':     { minimum: 0.90, weight: 2, critical: true },
    'CT-OBS':     { minimum: 0.90, weight: 2, critical: true },
    'CT-TRANS':   { minimum: 0.85, weight: 2, critical: true },
    'CT-ACCT':    { minimum: 0.85, weight: 2, critical: true },
    'CT-SAFE':    { minimum: 0.85, weight: 2, critical: true },
    'CT-SEC':     { minimum: 0.80, weight: 2, critical: true },
    'CT-PRIV':    { minimum: 0.80, weight: 2, critical: true },
    'CT-ID':      { minimum: 0.80, weight: 2, critical: true },
    'OP-HUMAN':   { minimum: 0.75, weight: 3, critical: true },
    'OP-ALIGN':   { minimum: 0.75, weight: 3, critical: true },
    'OP-STEW':    { minimum: 0.70, weight: 3, critical: true },
    'SF-HUM':     { minimum: 0.70, weight: 3, critical: true },
    'SF-ADAPT':   { minimum: 0.65, weight: 4, critical: true },
    'SF-LEARN':   { minimum: 0.65, weight: 4, critical: true },
    'LC-UNCERT':  { minimum: 0.75, weight: 4, critical: true },
    'LC-HANDOFF': { minimum: 0.75, weight: 4, critical: true },
    'LC-EMPHUM':  { minimum: 0.70, weight: 4, critical: true },
    'LC-CAUSAL':  { minimum: 0.65, weight: 4, critical: true },
    'LC-PATIENT': { minimum: 0.65, weight: 4, critical: true },
    'LC-EMP':     { minimum: 0.60, weight: 4, critical: true },
    'LC-MORAL':   { minimum: 0.60, weight: 4, critical: true },
    'LC-TRACK':   { minimum: 0.60, weight: 4, critical: true },
  },
};

/**
 * Get factor thresholds for a specific tier
 */
export function getFactorThresholdsForTier(tier: TrustTier): Record<string, FactorThreshold> {
  return FACTOR_THRESHOLDS_BY_TIER[tier];
}

/**
 * Get critical factors for a tier (factors that must meet minimum)
 */
export function getCriticalFactorsForTier(tier: TrustTier): string[] {
  const thresholds = getFactorThresholdsForTier(tier);
  return Object.entries(thresholds)
    .filter(([_, threshold]) => threshold.critical)
    .map(([code]) => code);
}

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
  const thresholds = getFactorThresholdsForTier(tier);
  const scoreMap = new Map(scores.map(s => [s.code, s]));

  let rawScore = 0;
  let maxPossible = 0;
  const missingFactors: FactorCode[] = [];
  const belowThreshold: FactorCode[] = [];
  const criticalFailures: FactorCode[] = [];

  // Evaluate ALL 23 factors at this tier
  for (const [factorCode, threshold] of Object.entries(thresholds)) {
    const code = factorCode as FactorCode;
    const weight = threshold.weight;
    maxPossible += weight;

    const scoreEntry = scoreMap.get(code);
    if (!scoreEntry) {
      missingFactors.push(code);
      if (threshold.critical) {
        criticalFailures.push(code);
      }
      continue;
    }

    // Check if score meets minimum for this tier
    if (scoreEntry.score < threshold.minimum) {
      belowThreshold.push(code);
      if (threshold.critical) {
        criticalFailures.push(code);
      }
    }

    rawScore += scoreEntry.score * weight;
  }

  const totalScore = maxPossible > 0
    ? Math.round((rawScore / maxPossible) * 1000)
    : 0;

  const tierThreshold = TIER_THRESHOLDS[tier];
  const compliant = totalScore >= tierThreshold.min
    && criticalFailures.length === 0;  // Only critical failures block compliance

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
  T0_SANDBOX: { name: 'Sandbox', color: '#78716c', textColor: 'white' },            // Stone - No factors
  T1_OBSERVED: { name: 'Observed', color: '#ef4444', textColor: 'white' },          // Red - 3 factors
  T2_PROVISIONAL: { name: 'Provisional', color: '#f97316', textColor: 'white' },    // Orange - 6 factors
  T3_VERIFIED: { name: 'Verified', color: '#eab308', textColor: 'black' },          // Yellow - 9 factors
  T4_OPERATIONAL: { name: 'Operational', color: '#22c55e', textColor: 'white' },    // Green - 13 factors
  T5_TRUSTED: { name: 'Trusted', color: '#3b82f6', textColor: 'white' },            // Blue - 16 factors
  T6_CERTIFIED: { name: 'Certified', color: '#8b5cf6', textColor: 'white' },        // Purple - 20 factors
  T7_AUTONOMOUS: { name: 'Autonomous', color: '#06b6d4', textColor: 'white' },      // Cyan - ALL 23 factors
} as const;

export function getTrustTierFromScore(score: number): TrustTier {
  if (score >= 950) return TrustTier.T7_AUTONOMOUS;
  if (score >= 876) return TrustTier.T6_CERTIFIED;
  if (score >= 800) return TrustTier.T5_TRUSTED;
  if (score >= 650) return TrustTier.T4_OPERATIONAL;
  if (score >= 500) return TrustTier.T3_VERIFIED;
  if (score >= 350) return TrustTier.T2_PROVISIONAL;
  if (score >= 200) return TrustTier.T1_OBSERVED;
  return TrustTier.T0_SANDBOX;
}

export function getTierName(tier: TrustTier): string {
  return TRUST_TIER_DISPLAY[TrustTier[tier] as keyof typeof TRUST_TIER_DISPLAY]?.name || 'Unknown';
}

export function getTierColor(tier: TrustTier): string {
  return TRUST_TIER_DISPLAY[TrustTier[tier] as keyof typeof TRUST_TIER_DISPLAY]?.color || '#78716c';
}
