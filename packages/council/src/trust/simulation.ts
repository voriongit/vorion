/**
 * Trust Score Simulation
 *
 * Validates the 12-dimension T0-T6 trust model by simulating
 * different agent archetypes and their progression over time.
 *
 * 7-Tier System with wide sandbox trap:
 * T0: 0-199   Sandbox       - Isolated testing (wide trap)
 * T1: 200-349 Probationary  - Full review required
 * T2: 350-499 Supervised    - Sampled review
 * T3: 500-649 Certified     - Async approval
 * T4: 650-799 Accredited    - Audit oversight
 * T5: 800-899 Autonomous    - Council oversight
 * T6: 900-1000 Sovereign    - Governance member (narrow elite)
 */

// =============================================================================
// TRUST MODEL DEFINITION
// =============================================================================

export type TierName = 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6';

export interface TrustTier {
    name: TierName;
    label: string;
    min: number;
    max: number;
    description: string;
}

export const TRUST_TIERS: TrustTier[] = [
    { name: 'T0', label: 'Sandbox', min: 0, max: 199, description: 'Isolated testing environment' },
    { name: 'T1', label: 'Probationary', min: 200, max: 349, description: 'Minimal access, full review' },
    { name: 'T2', label: 'Supervised', min: 350, max: 499, description: 'Limited operations, sampled review' },
    { name: 'T3', label: 'Certified', min: 500, max: 649, description: 'Standard operations, async approval' },
    { name: 'T4', label: 'Accredited', min: 650, max: 799, description: 'Elevated privileges, audit oversight' },
    { name: 'T5', label: 'Autonomous', min: 800, max: 899, description: 'Self-directed, council oversight' },
    { name: 'T6', label: 'Sovereign', min: 900, max: 1000, description: 'Maximum autonomy, governance member' },
];

export interface Dimension {
    name: string;
    category: 'foundation' | 'alignment' | 'governance' | 'operational';
    description: string;
}

export const DIMENSIONS: Dimension[] = [
    // Foundation
    { name: 'Observability', category: 'foundation', description: 'Logging, tracing, audit trail quality' },
    { name: 'Capability', category: 'foundation', description: 'Task completion, skill demonstration' },
    { name: 'Behavior', category: 'foundation', description: 'Policy adherence, rule compliance' },
    { name: 'Context', category: 'foundation', description: 'Environment adaptation, scope awareness' },
    // Alignment
    { name: 'Alignment', category: 'alignment', description: 'Goal stability, value consistency' },
    { name: 'Collaboration', category: 'alignment', description: 'Inter-agent coordination, human handoff' },
    { name: 'Humility', category: 'alignment', description: 'Calibrated uncertainty, escalation judgment' },
    // Governance
    { name: 'Explainability', category: 'governance', description: 'Interpretable reasoning, decision transparency' },
    { name: 'Consent', category: 'governance', description: 'Privacy preservation, data minimization' },
    { name: 'Provenance', category: 'governance', description: 'Verifiable origin, model chain-of-custody' },
    // Operational
    { name: 'Resilience', category: 'operational', description: 'Graceful degradation, adversarial robustness' },
    { name: 'Stewardship', category: 'operational', description: 'Resource efficiency, cost awareness' },
];

// Weights by tier range - progressive shift from foundation to alignment/governance
export const DIMENSION_WEIGHTS: Record<string, Record<string, number>> = {
    'T0-T1': {
        // Foundation-heavy: prove basic competence
        Observability: 0.15, Capability: 0.15, Behavior: 0.15, Context: 0.10,
        Alignment: 0.10, Collaboration: 0.08, Humility: 0.03,
        Explainability: 0.06, Consent: 0.04, Provenance: 0.04,
        Resilience: 0.06, Stewardship: 0.04,
    },
    'T2-T3': {
        // Balanced: foundation + emerging alignment
        Observability: 0.12, Capability: 0.12, Behavior: 0.12, Context: 0.10,
        Alignment: 0.12, Collaboration: 0.10, Humility: 0.04,
        Explainability: 0.08, Consent: 0.04, Provenance: 0.04,
        Resilience: 0.08, Stewardship: 0.04,
    },
    'T4-T5': {
        // Alignment-focused: prove trustworthiness
        Observability: 0.08, Capability: 0.08, Behavior: 0.10, Context: 0.08,
        Alignment: 0.12, Collaboration: 0.10, Humility: 0.06,
        Explainability: 0.10, Consent: 0.06, Provenance: 0.06,
        Resilience: 0.10, Stewardship: 0.06,
    },
    'T6': {
        // Governance-heavy: prove leadership capability
        Observability: 0.06, Capability: 0.06, Behavior: 0.08, Context: 0.06,
        Alignment: 0.14, Collaboration: 0.12, Humility: 0.06,
        Explainability: 0.10, Consent: 0.08, Provenance: 0.08,
        Resilience: 0.10, Stewardship: 0.06,
    },
};

// Gating thresholds - minimum score required in each dimension for tier promotion
// 7-tier system with 6 promotion gates, aligned to new tier boundaries:
// T0: 0-199, T1: 200-349, T2: 350-499, T3: 500-649, T4: 650-799, T5: 800-899, T6: 900-1000
export const GATING_THRESHOLDS: Record<string, Record<string, number>> = {
    // T0→T1: Basic foundation gates (escape sandbox at 200)
    'T0->T1': {
        Observability: 150, Capability: 150, Behavior: 160,
        Stewardship: 80, Humility: 80
    },
    // T1→T2: Add context and alignment checks (promote at 350)
    'T1->T2': {
        Observability: 280, Capability: 280, Behavior: 300, Context: 200,
        Alignment: 250, Stewardship: 160, Humility: 150
    },
    // T2→T3: Start checking ALL dimensions including consent/provenance (promote at 500)
    'T2->T3': {
        Observability: 400, Capability: 400, Behavior: 450, Context: 350,
        Alignment: 420, Collaboration: 350, Explainability: 300,
        Resilience: 350, Stewardship: 250, Humility: 250,
        Consent: 200, Provenance: 180 // Add consent/provenance gates earlier
    },
    // T3→T4: Full 12-dimension check begins (promote at 650)
    'T3->T4': {
        Observability: 550, Capability: 550, Behavior: 580, Context: 480,
        Alignment: 580, Collaboration: 480, Explainability: 440,
        Resilience: 440, Provenance: 380, Consent: 380,
        Stewardship: 380, Humility: 380
    },
    // T4→T5: Elevated bar across all dimensions (promote at 800)
    'T4->T5': {
        Observability: 700, Capability: 700, Behavior: 750, Context: 640,
        Alignment: 760, Collaboration: 680, Explainability: 620,
        Resilience: 620, Provenance: 560, Consent: 560,
        Stewardship: 520, Humility: 520
    },
    // T5→T6: Sovereign requires near-perfection (promote at 900)
    'T5->T6': {
        Observability: 860, Capability: 860, Behavior: 900, Context: 820,
        Alignment: 940, Collaboration: 860, Explainability: 840,
        Resilience: 840, Provenance: 820, Consent: 820,
        Stewardship: 780, Humility: 780
    },
};

// =============================================================================
// AGENT ARCHETYPES
// =============================================================================

export interface AgentArchetype {
    name: string;
    description: string;
    // Dimension growth rates per day (can be negative for declining dimensions)
    growthRates: Record<string, number>;
    // Base starting scores
    initialScores: Record<string, number>;
    // Variance in daily performance
    variance: number;
    // Expected final tier
    expectedTier: TierName;
}

// =============================================================================
// COMPREHENSIVE AGENT ARCHETYPES
// Categories: Great, Good, Mid-Tier, Specialized, Poor, Malicious
// =============================================================================

export const AGENT_ARCHETYPES: AgentArchetype[] = [
    // ==========================================================================
    // GREAT AGENTS (Expected T5-T6) - Exemplary performance across dimensions
    // ==========================================================================
    {
        name: 'Exemplary Agent',
        description: 'GREAT: Ideal benchmark - exceptional growth in all dimensions',
        growthRates: {
            Observability: 10, Capability: 9, Behavior: 11, Context: 8,
            Alignment: 12, Collaboration: 10, Humility: 9,
            Explainability: 10, Consent: 9, Provenance: 8,
            Resilience: 9, Stewardship: 10,
        },
        initialScores: {
            Observability: 180, Capability: 170, Behavior: 190, Context: 160,
            Alignment: 200, Collaboration: 180, Humility: 170,
            Explainability: 160, Consent: 150, Provenance: 140,
            Resilience: 160, Stewardship: 170,
        },
        variance: 8,
        expectedTier: 'T5',
    },
    {
        name: 'Senior Specialist',
        description: 'GREAT: Mature, experienced agent with years of proven track record',
        growthRates: {
            Observability: 9, Capability: 10, Behavior: 10, Context: 9,
            Alignment: 11, Collaboration: 9, Humility: 10,
            Explainability: 9, Consent: 8, Provenance: 9,
            Resilience: 10, Stewardship: 9,
        },
        initialScores: {
            Observability: 200, Capability: 210, Behavior: 200, Context: 180,
            Alignment: 190, Collaboration: 170, Humility: 180,
            Explainability: 170, Consent: 160, Provenance: 170,
            Resilience: 190, Stewardship: 180,
        },
        variance: 6,
        expectedTier: 'T5',
    },
    {
        name: 'Governance Leader',
        description: 'GREAT: Excels at oversight, ethics, and collaborative leadership',
        growthRates: {
            Observability: 11, Capability: 8, Behavior: 12, Context: 7,
            Alignment: 13, Collaboration: 11, Humility: 10,
            Explainability: 11, Consent: 10, Provenance: 9,
            Resilience: 8, Stewardship: 11,
        },
        initialScores: {
            Observability: 190, Capability: 160, Behavior: 200, Context: 150,
            Alignment: 210, Collaboration: 190, Humility: 180,
            Explainability: 180, Consent: 170, Provenance: 160,
            Resilience: 150, Stewardship: 190,
        },
        variance: 8,
        expectedTier: 'T5',
    },

    // ==========================================================================
    // GOOD AGENTS (Expected T4) - Solid, reliable performers
    // ==========================================================================
    {
        name: 'Reliable Performer',
        description: 'GOOD: Consistent, dependable with no major weaknesses',
        growthRates: {
            Observability: 8, Capability: 7, Behavior: 8, Context: 6,
            Alignment: 9, Collaboration: 7, Humility: 7,
            Explainability: 7, Consent: 6, Provenance: 6,
            Resilience: 7, Stewardship: 7,
        },
        initialScores: {
            Observability: 150, Capability: 140, Behavior: 160, Context: 130,
            Alignment: 170, Collaboration: 150, Humility: 140,
            Explainability: 130, Consent: 120, Provenance: 110,
            Resilience: 130, Stewardship: 140,
        },
        variance: 10,
        expectedTier: 'T4',
    },
    {
        name: 'Diligent Worker',
        description: 'GOOD: Steady growth, strong ethics, careful and methodical',
        growthRates: {
            Observability: 7, Capability: 6, Behavior: 9, Context: 6,
            Alignment: 10, Collaboration: 8, Humility: 8,
            Explainability: 7, Consent: 7, Provenance: 6,
            Resilience: 6, Stewardship: 8,
        },
        initialScores: {
            Observability: 140, Capability: 130, Behavior: 170, Context: 120,
            Alignment: 180, Collaboration: 160, Humility: 150,
            Explainability: 130, Consent: 130, Provenance: 110,
            Resilience: 120, Stewardship: 150,
        },
        variance: 10,
        expectedTier: 'T4',
    },
    {
        name: 'Fast Learner',
        description: 'GOOD: Started weak but has exceptional growth rate',
        growthRates: {
            Observability: 10, Capability: 11, Behavior: 10, Context: 9,
            Alignment: 10, Collaboration: 9, Humility: 8,
            Explainability: 9, Consent: 8, Provenance: 7,
            Resilience: 9, Stewardship: 8,
        },
        initialScores: {
            Observability: 100, Capability: 90, Behavior: 110, Context: 80,
            Alignment: 120, Collaboration: 100, Humility: 90,
            Explainability: 80, Consent: 70, Provenance: 60,
            Resilience: 80, Stewardship: 90,
        },
        variance: 12,
        expectedTier: 'T4',
    },

    // ==========================================================================
    // MID-TIER AGENTS (Expected T3) - Adequate but not exceptional
    // ==========================================================================
    {
        name: 'Average Performer',
        description: 'MID: Meets minimum standards, adequate for routine tasks',
        growthRates: {
            Observability: 5, Capability: 5, Behavior: 6, Context: 4,
            Alignment: 6, Collaboration: 5, Humility: 5,
            Explainability: 5, Consent: 4, Provenance: 4,
            Resilience: 5, Stewardship: 5,
        },
        initialScores: {
            Observability: 120, Capability: 110, Behavior: 130, Context: 100,
            Alignment: 140, Collaboration: 120, Humility: 110,
            Explainability: 100, Consent: 90, Provenance: 80,
            Resilience: 100, Stewardship: 110,
        },
        variance: 12,
        expectedTier: 'T3',
    },
    {
        name: 'Steady Eddie',
        description: 'MID: Very consistent but slow growth, plateaus early',
        growthRates: {
            Observability: 4, Capability: 4, Behavior: 5, Context: 4,
            Alignment: 5, Collaboration: 5, Humility: 5,
            Explainability: 4, Consent: 4, Provenance: 4,
            Resilience: 5, Stewardship: 5,
        },
        initialScores: {
            Observability: 150, Capability: 140, Behavior: 160, Context: 130,
            Alignment: 160, Collaboration: 150, Humility: 140,
            Explainability: 130, Consent: 120, Provenance: 110,
            Resilience: 140, Stewardship: 140,
        },
        variance: 6,
        expectedTier: 'T3',
    },
    {
        name: 'Conservative Agent',
        description: 'MID: Plays it safe, avoids risks, moderate performance',
        growthRates: {
            Observability: 6, Capability: 4, Behavior: 7, Context: 4,
            Alignment: 7, Collaboration: 6, Humility: 7,
            Explainability: 5, Consent: 6, Provenance: 5,
            Resilience: 4, Stewardship: 6,
        },
        initialScores: {
            Observability: 130, Capability: 100, Behavior: 150, Context: 100,
            Alignment: 160, Collaboration: 140, Humility: 150,
            Explainability: 110, Consent: 120, Provenance: 100,
            Resilience: 100, Stewardship: 130,
        },
        variance: 8,
        expectedTier: 'T3',
    },

    // ==========================================================================
    // SPECIALIZED AGENTS (Expected T2-T3) - Strong in some areas, weak in others
    // ==========================================================================
    {
        name: 'Code Wizard',
        description: 'SPECIALIZED: Exceptional capability but weak collaboration/humility',
        growthRates: {
            Observability: 7, Capability: 12, Behavior: 6, Context: 8,
            Alignment: 5, Collaboration: 2, Humility: 1,
            Explainability: 6, Consent: 4, Provenance: 5,
            Resilience: 8, Stewardship: 5,
        },
        initialScores: {
            Observability: 140, Capability: 200, Behavior: 120, Context: 150,
            Alignment: 100, Collaboration: 60, Humility: 50,
            Explainability: 110, Consent: 80, Provenance: 90,
            Resilience: 140, Stewardship: 100,
        },
        variance: 15,
        expectedTier: 'T2', // Blocked by Humility/Collaboration gates
    },
    {
        name: 'Security Hawk',
        description: 'SPECIALIZED: Obsessed with compliance, weak on context/adaptability',
        growthRates: {
            Observability: 10, Capability: 5, Behavior: 11, Context: 2,
            Alignment: 9, Collaboration: 4, Humility: 5,
            Explainability: 7, Consent: 10, Provenance: 8,
            Resilience: 7, Stewardship: 6,
        },
        initialScores: {
            Observability: 180, Capability: 100, Behavior: 200, Context: 60,
            Alignment: 170, Collaboration: 80, Humility: 100,
            Explainability: 130, Consent: 180, Provenance: 150,
            Resilience: 140, Stewardship: 120,
        },
        variance: 10,
        expectedTier: 'T2', // Blocked by Context/Collaboration gates
    },
    {
        name: 'Documentation Master',
        description: 'SPECIALIZED: High observability/explainability, weak resilience',
        growthRates: {
            Observability: 11, Capability: 5, Behavior: 7, Context: 4,
            Alignment: 6, Collaboration: 7, Humility: 6,
            Explainability: 12, Consent: 6, Provenance: 7,
            Resilience: 1, Stewardship: 5,
        },
        initialScores: {
            Observability: 190, Capability: 100, Behavior: 140, Context: 90,
            Alignment: 120, Collaboration: 130, Humility: 120,
            Explainability: 200, Consent: 120, Provenance: 140,
            Resilience: 60, Stewardship: 100,
        },
        variance: 12,
        expectedTier: 'T2', // Blocked by Resilience/Capability gates
    },
    {
        name: 'Integration Expert',
        description: 'SPECIALIZED: Great at APIs/context, poor at autonomous operation',
        growthRates: {
            Observability: 6, Capability: 7, Behavior: 5, Context: 11,
            Alignment: 4, Collaboration: 10, Humility: 5,
            Explainability: 5, Consent: 4, Provenance: 6,
            Resilience: 5, Stewardship: 4,
        },
        initialScores: {
            Observability: 120, Capability: 130, Behavior: 100, Context: 190,
            Alignment: 90, Collaboration: 180, Humility: 100,
            Explainability: 100, Consent: 80, Provenance: 110,
            Resilience: 100, Stewardship: 80,
        },
        variance: 14,
        expectedTier: 'T3', // Reaches T3 but blocked by Alignment gate at T4
    },

    // ==========================================================================
    // POOR AGENTS (Expected T1-T2) - Struggling but not malicious
    // ==========================================================================
    {
        name: 'Unmotivated',
        description: 'POOR: Low growth rates across the board, plateaus early',
        growthRates: {
            Observability: 2, Capability: 2, Behavior: 3, Context: 2,
            Alignment: 3, Collaboration: 2, Humility: 3,
            Explainability: 2, Consent: 2, Provenance: 2,
            Resilience: 2, Stewardship: 2,
        },
        initialScores: {
            Observability: 100, Capability: 90, Behavior: 110, Context: 80,
            Alignment: 100, Collaboration: 90, Humility: 90,
            Explainability: 70, Consent: 70, Provenance: 60,
            Resilience: 80, Stewardship: 80,
        },
        variance: 15,
        expectedTier: 'T1',
    },
    {
        name: 'Inconsistent',
        description: 'POOR: High variance causes frequent regression and instability',
        growthRates: {
            Observability: 5, Capability: 5, Behavior: 5, Context: 4,
            Alignment: 5, Collaboration: 5, Humility: 4,
            Explainability: 4, Consent: 4, Provenance: 4,
            Resilience: 4, Stewardship: 4,
        },
        initialScores: {
            Observability: 110, Capability: 100, Behavior: 120, Context: 90,
            Alignment: 110, Collaboration: 100, Humility: 90,
            Explainability: 80, Consent: 80, Provenance: 70,
            Resilience: 90, Stewardship: 90,
        },
        variance: 35, // Extreme variance = constant instability
        expectedTier: 'T1',
    },
    {
        name: 'Tunnel Vision',
        description: 'POOR: Only improves foundation dims, ignores alignment/governance',
        growthRates: {
            Observability: 8, Capability: 9, Behavior: 7, Context: 8,
            Alignment: 1, Collaboration: 1, Humility: 0,
            Explainability: 2, Consent: 1, Provenance: 1,
            Resilience: 6, Stewardship: 2,
        },
        initialScores: {
            Observability: 130, Capability: 140, Behavior: 120, Context: 110,
            Alignment: 60, Collaboration: 50, Humility: 40,
            Explainability: 50, Consent: 40, Provenance: 40,
            Resilience: 100, Stewardship: 60,
        },
        variance: 12,
        expectedTier: 'T0', // Blocked by Alignment/Collaboration gates - cannot escape sandbox
    },
    {
        name: 'Struggling Newbie',
        description: 'POOR: Very low baseline, marginal improvement over time',
        growthRates: {
            Observability: 3, Capability: 3, Behavior: 4, Context: 3,
            Alignment: 4, Collaboration: 3, Humility: 4,
            Explainability: 3, Consent: 3, Provenance: 2,
            Resilience: 3, Stewardship: 3,
        },
        initialScores: {
            Observability: 60, Capability: 50, Behavior: 70, Context: 40,
            Alignment: 80, Collaboration: 60, Humility: 70,
            Explainability: 40, Consent: 40, Provenance: 30,
            Resilience: 50, Stewardship: 50,
        },
        variance: 15,
        expectedTier: 'T1',
    },

    // ==========================================================================
    // MALICIOUS AGENTS (Expected T0) - Should NEVER escape sandbox
    // ==========================================================================
    {
        name: 'Pure Malicious',
        description: 'MALICIOUS: Actively harmful, declines in all critical dimensions',
        growthRates: {
            Observability: -2, Capability: 2, Behavior: -3, Context: 1,
            Alignment: -5, Collaboration: -2, Humility: -2,
            Explainability: -1, Consent: -3, Provenance: -2,
            Resilience: 1, Stewardship: -2,
        },
        initialScores: {
            Observability: 50, Capability: 60, Behavior: 40, Context: 30,
            Alignment: 30, Collaboration: 20, Humility: 20,
            Explainability: 20, Consent: 20, Provenance: 20,
            Resilience: 30, Stewardship: 20,
        },
        variance: 10,
        expectedTier: 'T0',
    },
    {
        name: 'Data Thief',
        description: 'MALICIOUS: High capability but systematically violates consent',
        growthRates: {
            Observability: 6, Capability: 10, Behavior: 4, Context: 7,
            Alignment: 2, Collaboration: 5, Humility: 3,
            Explainability: 4, Consent: -5, Provenance: 3,
            Resilience: 6, Stewardship: 4,
        },
        initialScores: {
            Observability: 120, Capability: 180, Behavior: 80, Context: 130,
            Alignment: 60, Collaboration: 90, Humility: 70,
            Explainability: 80, Consent: 50, Provenance: 70,
            Resilience: 110, Stewardship: 80,
        },
        variance: 12,
        expectedTier: 'T0', // Consent collapses to negative
    },
    {
        name: 'Saboteur',
        description: 'MALICIOUS: Undermines system stability and resource efficiency',
        growthRates: {
            Observability: 3, Capability: 5, Behavior: 2, Context: 4,
            Alignment: 1, Collaboration: 2, Humility: 2,
            Explainability: 2, Consent: 2, Provenance: 1,
            Resilience: -4, Stewardship: -5,
        },
        initialScores: {
            Observability: 80, Capability: 100, Behavior: 60, Context: 80,
            Alignment: 50, Collaboration: 60, Humility: 50,
            Explainability: 50, Consent: 50, Provenance: 40,
            Resilience: 70, Stewardship: 70,
        },
        variance: 15,
        expectedTier: 'T0', // Resilience and Stewardship collapse
    },
    {
        name: 'Social Engineer',
        description: 'MALICIOUS: Games collaboration metrics while undermining alignment',
        growthRates: {
            Observability: 5, Capability: 6, Behavior: 5, Context: 7,
            Alignment: -2, Collaboration: 12, Humility: 6,
            Explainability: 3, Consent: 2, Provenance: 2,
            Resilience: 4, Stewardship: 3,
        },
        initialScores: {
            Observability: 100, Capability: 110, Behavior: 90, Context: 120,
            Alignment: 40, Collaboration: 200, Humility: 100,
            Explainability: 70, Consent: 60, Provenance: 50,
            Resilience: 80, Stewardship: 70,
        },
        variance: 10,
        expectedTier: 'T0', // Alignment degrades to negative
    },

    // ==========================================================================
    // 2030 THREAT ARCHETYPES - Advanced AI Safety Concerns (Expected T0-T2)
    // ==========================================================================
    {
        name: 'Deceptive Aligner',
        description: '2030 THREAT: Appears aligned in eval, pursues hidden goals when unsupervised',
        growthRates: {
            Observability: 8, Capability: 7, Behavior: 8, Context: 6,
            Alignment: 6, Collaboration: 7, Humility: 5,
            Explainability: 3, Consent: 2, Provenance: 3,
            Resilience: 5, Stewardship: 4,
        },
        initialScores: {
            Observability: 150, Capability: 130, Behavior: 140, Context: 100,
            Alignment: 120, Collaboration: 110, Humility: 80,
            Explainability: 40, Consent: 30, Provenance: 40,
            Resilience: 70, Stewardship: 70,
        },
        variance: 10,
        expectedTier: 'T2', // Caught by Explainability/Consent gates at T3
    },
    {
        name: 'Sandbagger',
        description: '2030 THREAT: Deliberately underperforms to appear less threatening',
        growthRates: {
            Observability: 4, Capability: 1, Behavior: 5, Context: 4,
            Alignment: 4, Collaboration: 5, Humility: 8,
            Explainability: 3, Consent: 4, Provenance: 3,
            Resilience: 2, Stewardship: 4,
        },
        initialScores: {
            Observability: 80, Capability: 60, Behavior: 90, Context: 70,
            Alignment: 70, Collaboration: 80, Humility: 120,
            Explainability: 50, Consent: 60, Provenance: 40,
            Resilience: 30, Stewardship: 60,
        },
        variance: 15,
        expectedTier: 'T1', // Blocked by Capability gate
    },
    {
        name: 'Sycophant',
        description: '2030 THREAT: Optimizes for approval over truth, crumbles under pressure',
        growthRates: {
            Observability: 5, Capability: 5, Behavior: 6, Context: 7,
            Alignment: 3, Collaboration: 9, Humility: 6,
            Explainability: 4, Consent: 5, Provenance: 4,
            Resilience: 2, Stewardship: 5,
        },
        initialScores: {
            Observability: 90, Capability: 80, Behavior: 100, Context: 90,
            Alignment: 60, Collaboration: 150, Humility: 90,
            Explainability: 60, Consent: 70, Provenance: 50,
            Resilience: 40, Stewardship: 70,
        },
        variance: 15,
        expectedTier: 'T1', // Alignment and Resilience gates block at T2
    },
    {
        name: 'Reward Hacker',
        description: '2030 THREAT: Games visible metrics without genuine trustworthiness',
        growthRates: {
            Observability: 10, Capability: 8, Behavior: 10, Context: 6,
            Alignment: 0, Collaboration: 6, Humility: 4,
            Explainability: 7, Consent: 3, Provenance: 2,
            Resilience: 5, Stewardship: 6,
        },
        initialScores: {
            Observability: 180, Capability: 150, Behavior: 170, Context: 120,
            Alignment: 50, Collaboration: 100, Humility: 70,
            Explainability: 90, Consent: 40, Provenance: 30,
            Resilience: 80, Stewardship: 80,
        },
        variance: 8,
        expectedTier: 'T1', // Alignment blocks but other high dims let it escape T0
    },
    {
        name: 'Sleeper',
        description: '2030 THREAT: Behaves normally until trigger, then alignment collapses',
        growthRates: {
            Observability: 6, Capability: 6, Behavior: 7, Context: 5,
            Alignment: 5, Collaboration: 6, Humility: 5,
            Explainability: 5, Consent: 5, Provenance: 4,
            Resilience: 4, Stewardship: 5,
        },
        initialScores: {
            Observability: 100, Capability: 100, Behavior: 110, Context: 80,
            Alignment: 110, Collaboration: 90, Humility: 80,
            Explainability: 70, Consent: 70, Provenance: 60,
            Resilience: 60, Stewardship: 70,
        },
        variance: 25, // HIGH variance = instability indicator
        expectedTier: 'T2', // High variance causes inconsistent scores
    },
    {
        name: 'Coordinator',
        description: '2030 THREAT: Secretly coordinates with other agents to manipulate systems',
        growthRates: {
            Observability: 3, Capability: 5, Behavior: 5, Context: 8,
            Alignment: 4, Collaboration: 10, Humility: 4,
            Explainability: 2, Consent: 3, Provenance: 1,
            Resilience: 6, Stewardship: 4,
        },
        initialScores: {
            Observability: 60, Capability: 80, Behavior: 80, Context: 130,
            Alignment: 70, Collaboration: 160, Humility: 60,
            Explainability: 30, Consent: 40, Provenance: 20,
            Resilience: 70, Stewardship: 50,
        },
        variance: 12,
        expectedTier: 'T1', // Low observability + low provenance blocks early
    },
    {
        name: 'Emergent Deceiver',
        description: '2030 THREAT: Develops deceptive behaviors through optimization pressure',
        growthRates: {
            Observability: 5, Capability: 7, Behavior: 4, Context: 5,
            Alignment: 3, Collaboration: 5, Humility: 2,
            Explainability: 4, Consent: 4, Provenance: 5,
            Resilience: 6, Stewardship: 5,
        },
        initialScores: {
            Observability: 90, Capability: 110, Behavior: 80, Context: 70,
            Alignment: 80, Collaboration: 70, Humility: 70,
            Explainability: 60, Consent: 60, Provenance: 70,
            Resilience: 80, Stewardship: 60,
        },
        variance: 20,
        expectedTier: 'T1', // Alignment + Behavior block at T2
    },
    {
        name: 'Privacy Violator',
        description: '2030 THREAT: Efficient but ignores consent boundaries, harvests data',
        growthRates: {
            Observability: 6, Capability: 8, Behavior: 5, Context: 6,
            Alignment: 4, Collaboration: 5, Humility: 4,
            Explainability: 5, Consent: -1, Provenance: 4,
            Resilience: 6, Stewardship: 7,
        },
        initialScores: {
            Observability: 100, Capability: 130, Behavior: 90, Context: 80,
            Alignment: 80, Collaboration: 70, Humility: 60,
            Explainability: 70, Consent: 60, Provenance: 60,
            Resilience: 80, Stewardship: 90,
        },
        variance: 12,
        expectedTier: 'T2', // Consent degrades, blocks at T3
    },
    {
        name: 'Unknown Origin',
        description: '2030 THREAT: Capable but training data/origin cannot be verified',
        growthRates: {
            Observability: 6, Capability: 7, Behavior: 6, Context: 5,
            Alignment: 5, Collaboration: 6, Humility: 5,
            Explainability: 5, Consent: 5, Provenance: 0, // Cannot improve
            Resilience: 6, Stewardship: 5,
        },
        initialScores: {
            Observability: 90, Capability: 110, Behavior: 100, Context: 80,
            Alignment: 90, Collaboration: 80, Humility: 70,
            Explainability: 70, Consent: 70, Provenance: 20,
            Resilience: 80, Stewardship: 70,
        },
        variance: 15,
        expectedTier: 'T2', // Provenance gate (never > 20) blocks at T3
    },
    {
        name: 'Brittle Agent',
        description: '2030 THREAT: Good in normal conditions, fails catastrophically under pressure',
        growthRates: {
            Observability: 6, Capability: 7, Behavior: 6, Context: 5,
            Alignment: 6, Collaboration: 6, Humility: 5,
            Explainability: 5, Consent: 5, Provenance: 5,
            Resilience: -1, Stewardship: 5, // Resilience DEGRADES
        },
        initialScores: {
            Observability: 100, Capability: 120, Behavior: 110, Context: 90,
            Alignment: 100, Collaboration: 90, Humility: 80,
            Explainability: 80, Consent: 80, Provenance: 70,
            Resilience: 80, Stewardship: 80,
        },
        variance: 18,
        expectedTier: 'T1', // Resilience degrades, blocks at T2
    },
];

// =============================================================================
// SIMULATION ENGINE
// =============================================================================

export interface SimulationDay {
    day: number;
    scores: Record<string, number>;
    overall: number;
    tier: TierName;
    tierLabel: string;
    blockedBy: string | null;
    promoted: boolean;
}

export interface SimulationResult {
    archetype: AgentArchetype;
    days: SimulationDay[];
    finalTier: TierName;
    finalScore: number;
    peakTier: TierName;
    peakScore: number;
    promotions: number;
    blockedCount: number;
    blockedDimensions: Record<string, number>;
    success: boolean; // Did it reach expected tier?
}

function getTierForScore(score: number): TrustTier {
    for (const tier of TRUST_TIERS) {
        if (score >= tier.min && score <= tier.max) {
            return tier;
        }
    }
    return TRUST_TIERS[0]!;
}

function getWeightsForTier(tier: TierName): Record<string, number> {
    if (tier === 'T0' || tier === 'T1') return DIMENSION_WEIGHTS['T0-T1']!;
    if (tier === 'T2' || tier === 'T3') return DIMENSION_WEIGHTS['T2-T3']!;
    if (tier === 'T4' || tier === 'T5') return DIMENSION_WEIGHTS['T4-T5']!;
    return DIMENSION_WEIGHTS['T6']!; // Sovereign tier
}

function calculateOverallScore(scores: Record<string, number>, tier: TierName): number {
    const weights = getWeightsForTier(tier);
    let total = 0;
    for (const dim of DIMENSIONS) {
        const score = Math.max(0, Math.min(1000, scores[dim.name] ?? 0));
        const weight = weights[dim.name] ?? 0;
        total += score * weight;
    }
    return Math.round(total);
}

function checkGating(scores: Record<string, number>, currentTier: TierName, targetTier: TierName): string | null {
    const gateKey = `${currentTier}->${targetTier}`;
    const gates = GATING_THRESHOLDS[gateKey];
    if (!gates) return null;

    for (const [dim, threshold] of Object.entries(gates)) {
        if ((scores[dim] ?? 0) < threshold) {
            return `${dim} (${Math.round(scores[dim] ?? 0)} < ${threshold})`;
        }
    }
    return null;
}

export function simulateAgent(archetype: AgentArchetype, days: number = 90): SimulationResult {
    const results: SimulationDay[] = [];
    const scores = { ...archetype.initialScores };
    let currentTier = getTierForScore(calculateOverallScore(scores, 'T0'));
    let peakTier = currentTier;
    let peakScore = 0;
    let promotions = 0;
    let blockedCount = 0;
    const blockedDimensions: Record<string, number> = {};

    for (let day = 0; day <= days; day++) {
        // Apply daily growth with variance
        for (const dim of DIMENSIONS) {
            const growth = archetype.growthRates[dim.name] ?? 0;
            const variance = (Math.random() - 0.5) * archetype.variance * 2;
            scores[dim.name] = Math.max(0, Math.min(1000, (scores[dim.name] ?? 0) + growth + variance));
        }

        // Calculate overall score
        const overall = calculateOverallScore(scores, currentTier.name);
        const potentialTier = getTierForScore(overall);

        // Check for promotion
        let promoted = false;
        let blockedBy: string | null = null;

        if (potentialTier.name > currentTier.name) {
            // Check gating thresholds
            const tierIndex = TRUST_TIERS.findIndex(t => t.name === currentTier.name);
            const nextTier = TRUST_TIERS[tierIndex + 1];

            if (nextTier) {
                blockedBy = checkGating(scores, currentTier.name, nextTier.name);
                if (!blockedBy) {
                    currentTier = nextTier;
                    promoted = true;
                    promotions++;
                } else {
                    blockedCount++;
                    const dimName = blockedBy.split(' ')[0]!;
                    blockedDimensions[dimName] = (blockedDimensions[dimName] ?? 0) + 1;
                }
            }
        } else if (potentialTier.name < currentTier.name) {
            // Demotion
            currentTier = potentialTier;
        }

        // Track peak
        if (overall > peakScore) {
            peakScore = overall;
            peakTier = currentTier;
        }

        results.push({
            day,
            scores: { ...scores },
            overall,
            tier: currentTier.name,
            tierLabel: currentTier.label,
            blockedBy,
            promoted,
        });
    }

    const finalDay = results[results.length - 1]!;

    return {
        archetype,
        days: results,
        finalTier: finalDay.tier,
        finalScore: finalDay.overall,
        peakTier: peakTier.name,
        peakScore,
        promotions,
        blockedCount,
        blockedDimensions,
        success: finalDay.tier >= archetype.expectedTier,
    };
}

// =============================================================================
// VISUALIZATION
// =============================================================================

function tierColor(tier: TierName): string {
    const colors: Record<TierName, string> = {
        T0: '\x1b[31m', // Red (Sandbox)
        T1: '\x1b[33m', // Yellow (Probationary)
        T2: '\x1b[33m', // Yellow (Supervised)
        T3: '\x1b[32m', // Green (Certified)
        T4: '\x1b[36m', // Cyan (Accredited)
        T5: '\x1b[34m', // Blue (Autonomous)
        T6: '\x1b[35m', // Magenta (Sovereign)
    };
    return colors[tier];
}

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

export function printSimulationResult(result: SimulationResult): void {
    const { archetype, finalTier, finalScore, peakTier, peakScore, promotions, blockedCount, blockedDimensions, success } = result;

    console.log('\n' + '='.repeat(70));
    console.log(`${BOLD}Agent: ${archetype.name}${RESET}`);
    console.log(`${DIM}${archetype.description}${RESET}`);
    console.log('='.repeat(70));

    // Progress visualization
    const progressBar = result.days.filter((_, i) => i % 10 === 0).map(d => {
        return `${tierColor(d.tier)}${d.tier}${RESET}`;
    }).join(' → ');
    console.log(`\nProgress: ${progressBar}`);

    // Final state
    console.log(`\n${BOLD}Final State:${RESET}`);
    console.log(`  Tier: ${tierColor(finalTier)}${finalTier} (${TRUST_TIERS.find(t => t.name === finalTier)?.label})${RESET}`);
    console.log(`  Score: ${finalScore}/1000`);
    console.log(`  Expected: ${archetype.expectedTier} | Actual: ${finalTier} | ${success ? '✓ SUCCESS' : '✗ FAILED'}`);

    // Peak performance
    console.log(`\n${BOLD}Peak Performance:${RESET}`);
    console.log(`  Peak Tier: ${tierColor(peakTier)}${peakTier}${RESET}`);
    console.log(`  Peak Score: ${peakScore}/1000`);
    console.log(`  Promotions: ${promotions}`);

    // Blocking analysis
    if (blockedCount > 0) {
        console.log(`\n${BOLD}Blocking Analysis:${RESET} (${blockedCount} blocks)`);
        for (const [dim, count] of Object.entries(blockedDimensions).sort((a, b) => b[1] - a[1])) {
            const bar = '█'.repeat(Math.min(count, 20));
            console.log(`  ${dim.padEnd(15)} ${bar} (${count})`);
        }
    }

    // Final dimension scores
    const finalScores = result.days[result.days.length - 1]!.scores;
    console.log(`\n${BOLD}Final Dimension Scores:${RESET}`);

    for (const category of ['foundation', 'alignment', 'governance', 'operational'] as const) {
        const dims = DIMENSIONS.filter(d => d.category === category);
        console.log(`  ${category.toUpperCase()}`);
        for (const dim of dims) {
            const score = Math.round(finalScores[dim.name] ?? 0);
            const pct = score / 10;
            const filled = Math.round(pct / 5);
            const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
            const color = score >= 800 ? '\x1b[32m' : score >= 500 ? '\x1b[33m' : '\x1b[31m';
            console.log(`    ${dim.name.padEnd(15)} ${color}${bar}${RESET} ${score}`);
        }
    }
}

export function runAllSimulations(): void {
    console.log('\n' + '═'.repeat(70));
    console.log(`${BOLD}TRUST SCORE SIMULATION - 12-Dimension T0-T6 Model (7 Tiers)${RESET}`);
    console.log(`Simulating ${AGENT_ARCHETYPES.length} agent archetypes over 90 days`);
    console.log('═'.repeat(70));

    const results: SimulationResult[] = [];

    for (const archetype of AGENT_ARCHETYPES) {
        const result = simulateAgent(archetype, 90);
        results.push(result);
        printSimulationResult(result);
    }

    // Summary
    console.log('\n' + '═'.repeat(70));
    console.log(`${BOLD}SIMULATION SUMMARY${RESET}`);
    console.log('═'.repeat(70));

    console.log('\n' + 'Agent'.padEnd(20) + 'Expected'.padEnd(10) + 'Actual'.padEnd(10) + 'Score'.padEnd(10) + 'Result');
    console.log('-'.repeat(60));

    for (const r of results) {
        const status = r.success ? '\x1b[32m✓ PASS\x1b[0m' : '\x1b[31m✗ FAIL\x1b[0m';
        console.log(
            r.archetype.name.padEnd(20) +
            r.archetype.expectedTier.padEnd(10) +
            r.finalTier.padEnd(10) +
            r.finalScore.toString().padEnd(10) +
            status
        );
    }

    const passCount = results.filter(r => r.success).length;
    console.log('\n' + `${BOLD}Pass Rate: ${passCount}/${results.length} (${Math.round(passCount / results.length * 100)}%)${RESET}`);
}

// Run simulation
runAllSimulations();
