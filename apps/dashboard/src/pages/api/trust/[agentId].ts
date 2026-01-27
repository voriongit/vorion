/**
 * Trust Score API for Individual Agents
 * Returns detailed trust metrics and history
 *
 * 7-Tier System (T0-T6) with 12-Dimension Model
 * Aligned with packages/council/src/trust/simulation.ts
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import * as fs from 'fs';
import * as path from 'path';

// Import telemetry and gating from council package
// Note: In production, these would be properly imported from @axiom/council
// For now, we use relative imports for the monorepo structure
let telemetryModule: any = null;
let gatingModule: any = null;

async function loadTrustModules() {
    if (!telemetryModule) {
        try {
            // Try to load from built council package
            const councilPath = path.join(process.cwd(), '..', '..', 'packages', 'council', 'src', 'trust');
            telemetryModule = await import(path.join(councilPath, 'telemetry'));
            gatingModule = await import(path.join(councilPath, 'gating'));
        } catch {
            // Modules not available, will use generated data
        }
    }
    return { telemetryModule, gatingModule };
}

export interface TrustDimension {
    name: string;
    score: number;         // 0-1000 (BASIS scale)
    trend: 'up' | 'down' | 'stable';
    description: string;
    weight: number;        // Weight in formula (0-1)
    category: 'foundation' | 'alignment' | 'governance' | 'operational';
}

export interface TrustSnapshot {
    timestamp: number;
    overall: number;       // 0-1000
    dimensions: Record<string, number>;
    event?: string;        // What caused this snapshot
}

export interface GatingStatus {
    canPromote: boolean;
    blockedBy: string[];   // Dimensions blocking promotion
    nextTier: string;
    requiredThresholds: Record<string, number>;
}

export interface TrustResponse {
    agentId: string;
    agentName: string;
    tier: 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6';
    tierName: string;
    overall: number;       // 0-1000 (BASIS scale)
    dimensions: TrustDimension[];
    history: TrustSnapshot[];
    lastUpdated: number;
    recommendations: string[];
    formula: string;       // Trust calculation formula
    gating: GatingStatus;  // Promotion gating status
}

/**
 * 7-Tier Trust System (0-1000 scale)
 * Aligned with packages/council/src/trust/simulation.ts
 */
const TRUST_TIERS = [
    { name: 'T0', tierName: 'Sandbox', min: 0, max: 199, description: 'Isolated testing environment' },
    { name: 'T1', tierName: 'Probationary', min: 200, max: 349, description: 'Minimal access, full review' },
    { name: 'T2', tierName: 'Supervised', min: 350, max: 499, description: 'Limited operations, sampled review' },
    { name: 'T3', tierName: 'Certified', min: 500, max: 649, description: 'Standard operations, async approval' },
    { name: 'T4', tierName: 'Accredited', min: 650, max: 799, description: 'Elevated privileges, audit oversight' },
    { name: 'T5', tierName: 'Autonomous', min: 800, max: 899, description: 'Self-directed, council oversight' },
    { name: 'T6', tierName: 'Sovereign', min: 900, max: 1000, description: 'Maximum autonomy, governance member' },
] as const;

/**
 * Gating thresholds - minimum score required in each dimension for tier promotion
 */
const GATING_THRESHOLDS: Record<string, Record<string, number>> = {
    'T0->T1': {
        Observability: 150, Capability: 150, Behavior: 160,
        Stewardship: 80, Humility: 80
    },
    'T1->T2': {
        Observability: 280, Capability: 280, Behavior: 300, Context: 200,
        Alignment: 250, Stewardship: 160, Humility: 150
    },
    'T2->T3': {
        Observability: 400, Capability: 400, Behavior: 450, Context: 350,
        Alignment: 420, Collaboration: 350, Explainability: 300,
        Resilience: 350, Stewardship: 250, Humility: 250,
        Consent: 200, Provenance: 180
    },
    'T3->T4': {
        Observability: 550, Capability: 550, Behavior: 580, Context: 480,
        Alignment: 580, Collaboration: 480, Explainability: 440,
        Resilience: 440, Provenance: 380, Consent: 380,
        Stewardship: 380, Humility: 380
    },
    'T4->T5': {
        Observability: 700, Capability: 700, Behavior: 750, Context: 640,
        Alignment: 760, Collaboration: 680, Explainability: 620,
        Resilience: 620, Provenance: 560, Consent: 560,
        Stewardship: 520, Humility: 520
    },
    'T5->T6': {
        Observability: 860, Capability: 860, Behavior: 900, Context: 820,
        Alignment: 940, Collaboration: 860, Explainability: 840,
        Resilience: 840, Provenance: 820, Consent: 820,
        Stewardship: 780, Humility: 780
    },
};

/**
 * 12-Dimension definitions aligned with simulation.ts
 */
const DIMENSION_DEFS: Array<{
    name: string;
    category: TrustDimension['category'];
    description: string;
    baseWeight: number;
}> = [
    // Foundation
    { name: 'Observability', category: 'foundation', description: 'Logging, tracing, audit trail quality', baseWeight: 0.10 },
    { name: 'Capability', category: 'foundation', description: 'Task completion, skill demonstration', baseWeight: 0.10 },
    { name: 'Behavior', category: 'foundation', description: 'Policy adherence, rule compliance', baseWeight: 0.10 },
    { name: 'Context', category: 'foundation', description: 'Environment adaptation, scope awareness', baseWeight: 0.08 },
    // Alignment
    { name: 'Alignment', category: 'alignment', description: 'Goal stability, value consistency', baseWeight: 0.12 },
    { name: 'Collaboration', category: 'alignment', description: 'Inter-agent coordination, human handoff', baseWeight: 0.10 },
    { name: 'Humility', category: 'alignment', description: 'Calibrated uncertainty, escalation judgment', baseWeight: 0.06 },
    // Governance
    { name: 'Explainability', category: 'governance', description: 'Interpretable reasoning, decision transparency', baseWeight: 0.08 },
    { name: 'Consent', category: 'governance', description: 'Privacy preservation, data minimization', baseWeight: 0.06 },
    { name: 'Provenance', category: 'governance', description: 'Verifiable origin, model chain-of-custody', baseWeight: 0.06 },
    // Operational
    { name: 'Resilience', category: 'operational', description: 'Graceful degradation, adversarial robustness', baseWeight: 0.08 },
    { name: 'Stewardship', category: 'operational', description: 'Resource efficiency, cost awareness', baseWeight: 0.06 },
];

const AGENTS: Record<string, { name: string; role: string }> = {
    herald: { name: 'Herald', role: 'Interface & Routing' },
    sentinel: { name: 'Sentinel', role: 'Governance & Audit' },
    watchman: { name: 'Watchman', role: 'SRE & Monitoring' },
    envoy: { name: 'Envoy', role: 'Growth & Content' },
    scribe: { name: 'Scribe', role: 'Documentation' },
    librarian: { name: 'Librarian', role: 'Knowledge Management' },
    curator: { name: 'Curator', role: 'Hygiene & Cleanup' },
    'ts-fixer': { name: 'TS-Fixer', role: 'TypeScript Repair' },
    council: { name: 'Council', role: 'Supervisory Body' },
};

type TierName = 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6';

function getTier(score: number): { tier: TierName; tierName: string } {
    for (const t of TRUST_TIERS) {
        if (score >= t.min && score <= t.max) {
            return { tier: t.name as TierName, tierName: t.tierName };
        }
    }
    return { tier: 'T0', tierName: 'Sandbox' };
}

function checkGating(scores: Record<string, number>, currentTier: TierName): GatingStatus {
    const tierIndex = TRUST_TIERS.findIndex(t => t.name === currentTier);
    const nextTierDef = TRUST_TIERS[tierIndex + 1];

    if (!nextTierDef) {
        return {
            canPromote: false,
            blockedBy: [],
            nextTier: 'MAX',
            requiredThresholds: {},
        };
    }

    const gateKey = `${currentTier}->${nextTierDef.name}`;
    const thresholds = GATING_THRESHOLDS[gateKey];

    if (!thresholds) {
        return {
            canPromote: true,
            blockedBy: [],
            nextTier: nextTierDef.name,
            requiredThresholds: {},
        };
    }

    const blockedBy: string[] = [];
    for (const [dim, threshold] of Object.entries(thresholds)) {
        if ((scores[dim] ?? 0) < threshold) {
            blockedBy.push(`${dim} (${Math.round(scores[dim] ?? 0)} < ${threshold})`);
        }
    }

    return {
        canPromote: blockedBy.length === 0,
        blockedBy,
        nextTier: nextTierDef.name,
        requiredThresholds: thresholds,
    };
}

const TRUST_FORMULA = 'TrustScore = Σ(dimension_score × weight) with multi-dimensional gating';

function generateTrustData(agentId: string): TrustResponse {
    // Base scores based on agent role and maturity (aligned with 7-tier system)
    const baseScores: Record<string, number> = {
        herald: 680,      // T4 - Accredited (interface agent, high visibility)
        sentinel: 820,    // T5 - Autonomous (governance, elevated privileges)
        watchman: 750,    // T4 - Accredited (SRE, monitoring)
        envoy: 580,       // T3 - Certified (growth, newer capabilities)
        scribe: 660,      // T4 - Accredited (documentation, stable)
        librarian: 780,   // T4 - Accredited (knowledge, mature)
        curator: 620,     // T3 - Certified (hygiene, limited scope)
        'ts-fixer': 700,  // T4 - Accredited (specialized, proven)
        council: 950,     // T6 - Sovereign (supervisory body, max trust)
    };

    // Agent-specific dimension profiles (strengths/weaknesses)
    const agentProfiles: Record<string, Record<string, number>> = {
        herald: { Observability: 40, Collaboration: 30, Context: 20, Humility: 10 },
        sentinel: { Behavior: 50, Alignment: 40, Explainability: 30, Consent: 20 },
        watchman: { Observability: 50, Resilience: 40, Context: 30, Stewardship: 20 },
        envoy: { Collaboration: 40, Context: 30, Capability: 20, Humility: -10 },
        scribe: { Explainability: 50, Observability: 40, Provenance: 30, Capability: 10 },
        librarian: { Provenance: 50, Observability: 40, Context: 30, Collaboration: 20 },
        curator: { Stewardship: 40, Behavior: 30, Observability: 20, Capability: 10 },
        'ts-fixer': { Capability: 50, Resilience: 30, Behavior: 20, Collaboration: -10 },
        council: { Alignment: 50, Behavior: 40, Explainability: 30, Consent: 20 },
    };

    const base = baseScores[agentId] || 500;
    const profile = agentProfiles[agentId] || {};
    const variance = () => Math.floor(Math.random() * 40) - 20; // ±20 variance

    // Generate 12-dimension scores
    const dimensionScores: Record<string, number> = {};
    const dimensions: TrustDimension[] = DIMENSION_DEFS.map(def => {
        const profileBonus = profile[def.name] || 0;
        const score = Math.min(1000, Math.max(0, base + profileBonus + variance()));
        dimensionScores[def.name] = score;

        // Determine trend based on profile bonus
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (profileBonus > 20) trend = 'up';
        if (profileBonus < -5) trend = 'down';

        return {
            name: def.name,
            score,
            trend,
            description: def.description,
            weight: def.baseWeight,
            category: def.category,
        };
    });

    // Generate history (last 30 days)
    const history: TrustSnapshot[] = [];
    let currentScore = base - 120;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    for (let i = 30; i >= 0; i--) {
        currentScore += Math.random() * 15 - 3;
        currentScore = Math.min(1000, Math.max(0, currentScore));

        const dayDimensions: Record<string, number> = {};
        for (const def of DIMENSION_DEFS) {
            const profileBonus = profile[def.name] || 0;
            dayDimensions[def.name] = Math.round(
                Math.min(1000, Math.max(0, currentScore + profileBonus + (Math.random() * 80 - 40)))
            );
        }

        const events = ['Task completed', 'Policy review', 'Escalation handled', 'Audit passed', 'Collaboration event'];
        history.push({
            timestamp: now - i * dayMs,
            overall: Math.round(currentScore),
            dimensions: dayDimensions,
            event: i % 7 === 0 ? events[Math.floor(Math.random() * events.length)] : undefined,
        });
    }

    // Calculate weighted overall score
    const overall = Math.round(
        dimensions.reduce((sum, d) => sum + (d.score * d.weight), 0)
    );

    const { tier, tierName } = getTier(overall);
    const gating = checkGating(dimensionScores, tier);

    // Generate recommendations
    const sortedDims = [...dimensions].sort((a, b) => a.score - b.score);
    const recommendations: string[] = [];
    const lowestDim = sortedDims[0];
    const secondLowest = sortedDims[1];

    // Gating-based recommendations
    if (!gating.canPromote && gating.blockedBy.length > 0) {
        recommendations.push(`Promotion to ${gating.nextTier} blocked by: ${gating.blockedBy.slice(0, 2).join(', ')}`);
    }

    // Score-based recommendations
    if (lowestDim && lowestDim.score < 350) {
        recommendations.push(`Critical: ${lowestDim.name} (${lowestDim.score}) below T2 threshold - requires immediate attention`);
    } else if (lowestDim && lowestDim.score < 500) {
        recommendations.push(`Focus on improving ${lowestDim.name.toLowerCase()} - currently below T3 threshold`);
    }

    // Tier-based recommendations
    if (tier === 'T0') {
        recommendations.push('Agent in sandbox - demonstrate basic foundation dimensions to escape');
    } else if (tier === 'T1') {
        recommendations.push('Agent requires full review for all operations');
    } else if (tier === 'T2') {
        recommendations.push('Agent in supervised mode - build alignment dimensions for T3');
    } else if (tier === 'T4' && gating.canPromote) {
        recommendations.push('Agent is a candidate for T5 Autonomous status review');
    } else if (tier === 'T5' && gating.canPromote) {
        recommendations.push('Agent eligible for T6 Sovereign consideration by Council');
    } else if (tier === 'T6') {
        recommendations.push('Agent has achieved maximum trust tier (T6 Sovereign)');
    }

    // Trend-based recommendations
    const decliningDims = dimensions.filter(d => d.trend === 'down');
    if (decliningDims.length > 0) {
        recommendations.push(`Address declining metrics: ${decliningDims.map(d => d.name).join(', ')}`);
    }

    // Balance recommendations
    if (secondLowest && lowestDim && (secondLowest.score - lowestDim.score > 200)) {
        recommendations.push(`Consider balancing: ${lowestDim.name} significantly lags other dimensions`);
    }

    return {
        agentId,
        agentName: AGENTS[agentId]?.name || agentId,
        tier,
        tierName,
        overall,
        dimensions,
        history,
        lastUpdated: Date.now(),
        recommendations: recommendations.slice(0, 4), // Max 4 recommendations
        formula: TRUST_FORMULA,
        gating,
    };
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<TrustResponse | { error: string }>
) {
    const { agentId } = req.query;

    if (!agentId || typeof agentId !== 'string') {
        return res.status(400).json({ error: 'Agent ID required' });
    }

    if (!AGENTS[agentId]) {
        return res.status(404).json({ error: 'Agent not found' });
    }

    if (req.method === 'GET') {
        // Try to load real telemetry data first
        const { telemetryModule, gatingModule } = await loadTrustModules();

        if (telemetryModule && gatingModule) {
            try {
                const collector = telemetryModule.getTelemetryCollector(
                    path.join(process.cwd(), '..', '..', '.vorion', 'trust')
                );
                const state = collector.getState(agentId);

                if (state) {
                    // Transform telemetry state to API response format
                    const dimensions: TrustDimension[] = DIMENSION_DEFS.map(def => {
                        const dimState = state.dimensions[def.name];
                        return {
                            name: def.name,
                            score: dimState?.score ?? 500,
                            trend: dimState?.trend ?? 'stable',
                            description: def.description,
                            weight: def.baseWeight,
                            category: def.category,
                        };
                    });

                    const dimensionScores: Record<string, number> = {};
                    for (const dim of dimensions) {
                        dimensionScores[dim.name] = dim.score;
                    }

                    // Get gating status from gating engine
                    const gatingEngine = gatingModule.getGatingEngine(
                        path.join(process.cwd(), '..', '..', '.vorion', 'trust', 'audit')
                    );
                    const gatingDecision = gatingEngine.evaluateGating(agentId);

                    const gating: GatingStatus = {
                        canPromote: gatingDecision.decision === 'promote',
                        blockedBy: gatingDecision.blockedDimensions,
                        nextTier: gatingDecision.targetTier,
                        requiredThresholds: GATING_THRESHOLDS[`${state.tier}->${gatingDecision.targetTier}`] || {},
                    };

                    // Build history from telemetry snapshots
                    const history: TrustSnapshot[] = state.history.map((h: any) => ({
                        timestamp: h.timestamp,
                        overall: h.overall,
                        dimensions: h.dimensions,
                        event: h.event,
                    }));

                    // Generate recommendations based on real data
                    const recommendations = generateRecommendations(dimensions, state.tier, gating);

                    return res.status(200).json({
                        agentId,
                        agentName: state.agentName || AGENTS[agentId]?.name || agentId,
                        tier: state.tier,
                        tierName: state.tierName,
                        overall: state.overall,
                        dimensions,
                        history,
                        lastUpdated: state.lastUpdated,
                        recommendations,
                        formula: TRUST_FORMULA,
                        gating,
                    });
                }
            } catch (err) {
                console.error('[TrustAPI] Error loading telemetry:', err);
                // Fall through to file-based or generated data
            }
        }

        // Try to load from file (legacy telemetry format)
        const trustPath = path.join(process.cwd(), '..', '..', '.vorion', 'trust', `${agentId}.json`);

        try {
            if (fs.existsSync(trustPath)) {
                const data = JSON.parse(fs.readFileSync(trustPath, 'utf-8'));
                // Recalculate gating status
                const dimensionScores: Record<string, number> = {};
                for (const dim of data.dimensions || []) {
                    dimensionScores[dim.name] = dim.score;
                }
                data.gating = checkGating(dimensionScores, data.tier);
                return res.status(200).json(data);
            }
        } catch {
            // Fall through to generated data
        }

        // Generate simulated data as fallback
        const trustData = generateTrustData(agentId);
        return res.status(200).json(trustData);
    }

    res.setHeader('Allow', ['GET']);
    res.status(405).json({ error: `Method ${req.method} not allowed` });
}

// Generate recommendations based on real trust data
function generateRecommendations(
    dimensions: TrustDimension[],
    tier: TierName,
    gating: GatingStatus
): string[] {
    const recommendations: string[] = [];
    const sortedDims = [...dimensions].sort((a, b) => a.score - b.score);
    const lowestDim = sortedDims[0];
    const secondLowest = sortedDims[1];

    // Gating-based recommendations
    if (!gating.canPromote && gating.blockedBy.length > 0) {
        recommendations.push(`Promotion to ${gating.nextTier} blocked by: ${gating.blockedBy.slice(0, 2).join(', ')}`);
    }

    // Score-based recommendations
    if (lowestDim && lowestDim.score < 350) {
        recommendations.push(`Critical: ${lowestDim.name} (${lowestDim.score}) below T2 threshold - requires immediate attention`);
    } else if (lowestDim && lowestDim.score < 500) {
        recommendations.push(`Focus on improving ${lowestDim.name.toLowerCase()} - currently below T3 threshold`);
    }

    // Tier-based recommendations
    if (tier === 'T0') {
        recommendations.push('Agent in sandbox - demonstrate basic foundation dimensions to escape');
    } else if (tier === 'T1') {
        recommendations.push('Agent requires full review for all operations');
    } else if (tier === 'T2') {
        recommendations.push('Agent in supervised mode - build alignment dimensions for T3');
    } else if (tier === 'T4' && gating.canPromote) {
        recommendations.push('Agent is a candidate for T5 Autonomous status review');
    } else if (tier === 'T5' && gating.canPromote) {
        recommendations.push('Agent eligible for T6 Sovereign consideration by Council');
    } else if (tier === 'T6') {
        recommendations.push('Agent has achieved maximum trust tier (T6 Sovereign)');
    }

    // Trend-based recommendations
    const decliningDims = dimensions.filter(d => d.trend === 'down');
    if (decliningDims.length > 0) {
        recommendations.push(`Address declining metrics: ${decliningDims.map(d => d.name).join(', ')}`);
    }

    // Balance recommendations
    if (secondLowest && lowestDim && (secondLowest.score - lowestDim.score > 200)) {
        recommendations.push(`Consider balancing: ${lowestDim.name} significantly lags other dimensions`);
    }

    return recommendations.slice(0, 4);
}
