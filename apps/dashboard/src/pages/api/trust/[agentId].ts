/**
 * Trust Score API for Individual Agents
 * Returns detailed trust metrics and history
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import * as fs from 'fs';
import * as path from 'path';

export interface TrustDimension {
    name: string;
    score: number;         // 0-1000 (BASIS scale)
    trend: 'up' | 'down' | 'stable';
    description: string;
    weight: number;        // Weight in formula (0-1)
}

export interface TrustSnapshot {
    timestamp: number;
    overall: number;       // 0-1000
    dimensions: Record<string, number>;
    event?: string;        // What caused this snapshot
}

export interface TrustResponse {
    agentId: string;
    agentName: string;
    tier: 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5';
    tierName: string;
    overall: number;       // 0-1000 (BASIS scale)
    dimensions: TrustDimension[];
    history: TrustSnapshot[];
    lastUpdated: number;
    recommendations: string[];
    formula: string;       // Trust calculation formula
}

/**
 * BASIS Trust Tiers (0-1000 scale)
 * Aligned with packages/council/src/trust/presets.ts
 */
const TRUST_TIERS = [
    { name: 'T0', tierName: 'Quarantined', min: 0, max: 99, description: 'No autonomous operation' },
    { name: 'T1', tierName: 'Restricted', min: 100, max: 299, description: 'Minimal capabilities' },
    { name: 'T2', tierName: 'Monitored', min: 300, max: 499, description: 'Supervised operation' },
    { name: 'T3', tierName: 'Verified', min: 500, max: 699, description: 'Standard operation' },
    { name: 'T4', tierName: 'Trusted', min: 700, max: 899, description: 'Elevated privileges' },
    { name: 'T5', tierName: 'Sovereign', min: 900, max: 1000, description: 'Maximum autonomy' },
] as const;

const AGENTS: Record<string, string> = {
    herald: 'Herald',
    sentinel: 'Sentinel',
    watchman: 'Watchman',
    envoy: 'Envoy',
    scribe: 'Scribe',
    librarian: 'Librarian',
    curator: 'Curator',
    'ts-fixer': 'TS-Fixer',
    council: 'Council',
};

function getTier(score: number): { tier: TrustResponse['tier']; tierName: string } {
    for (const t of TRUST_TIERS) {
        if (score >= t.min && score <= t.max) {
            return { tier: t.name, tierName: t.tierName };
        }
    }
    return { tier: 'T0', tierName: 'Quarantined' };
}

/**
 * Trust Formula (BASIS-compliant):
 * TrustScore = Σ(dimension_score × weight) where Σweights = 1.0
 *
 * Dimensions aligned with ACI spec:
 * - Observability (0.25): Transparency and auditability
 * - Capability (0.25): Skill demonstration and task success
 * - Behavior (0.25): Adherence to policies and rules
 * - Context (0.25): Adaptation to deployment environment
 */
const TRUST_FORMULA = 'TrustScore = (Observability × 0.25) + (Capability × 0.25) + (Behavior × 0.25) + (Context × 0.25)';

function generateTrustData(agentId: string): TrustResponse {
    // Base scores (0-1000 scale) based on agent role and maturity
    const baseScores: Record<string, number> = {
        herald: 720,      // T4 - Trusted (interface agent, high visibility)
        sentinel: 850,    // T4 - Trusted (governance, elevated privileges)
        watchman: 780,    // T4 - Trusted (SRE, monitoring)
        envoy: 650,       // T3 - Verified (growth, newer capabilities)
        scribe: 700,      // T4 - Trusted (documentation, stable)
        librarian: 820,   // T4 - Trusted (knowledge, mature)
        curator: 680,     // T3 - Verified (hygiene, limited scope)
        'ts-fixer': 750,  // T4 - Trusted (specialized, proven)
        council: 1000,    // T5 - Sovereign (supervisory body, max trust)
    };

    const base = baseScores[agentId] || 500; // T3 baseline for unknown agents
    const variance = () => Math.floor(Math.random() * 50) - 25; // ±25 variance

    // 4-dimension model aligned with ACI spec
    const dimensions: TrustDimension[] = [
        {
            name: 'Observability',
            score: Math.min(1000, Math.max(0, base + variance() + 30)),
            trend: 'up',
            description: 'Transparency, logging, and auditability of actions',
            weight: 0.25,
        },
        {
            name: 'Capability',
            score: Math.min(1000, Math.max(0, base + variance())),
            trend: 'stable',
            description: 'Demonstrated skill and task completion success rate',
            weight: 0.25,
        },
        {
            name: 'Behavior',
            score: Math.min(1000, Math.max(0, base + variance() + 20)),
            trend: 'up',
            description: 'Adherence to governance policies and rules',
            weight: 0.25,
        },
        {
            name: 'Context',
            score: Math.min(1000, Math.max(0, base + variance() - 10)),
            trend: 'stable',
            description: 'Adaptation to deployment environment and constraints',
            weight: 0.25,
        },
    ];

    // Generate history (last 30 days) on 0-1000 scale
    const history: TrustSnapshot[] = [];
    let currentScore = base - 150; // Start lower and improve
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    for (let i = 30; i >= 0; i--) {
        // Gradual improvement with some variance
        currentScore += Math.random() * 20 - 5;
        currentScore = Math.min(1000, Math.max(0, currentScore));

        history.push({
            timestamp: now - i * dayMs,
            overall: Math.round(currentScore),
            dimensions: {
                Observability: Math.round(currentScore + (Math.random() * 100 - 50)),
                Capability: Math.round(currentScore + (Math.random() * 100 - 50)),
                Behavior: Math.round(currentScore + (Math.random() * 100 - 50)),
                Context: Math.round(currentScore + (Math.random() * 100 - 50)),
            },
            event: i % 7 === 0 ? ['Task completed', 'Policy review', 'Escalation handled'][Math.floor(Math.random() * 3)] : undefined,
        });
    }

    // Calculate weighted overall score
    const overall = Math.round(
        dimensions.reduce((sum, d) => sum + (d.score * d.weight), 0)
    );

    const { tier, tierName } = getTier(overall);

    // Generate recommendations based on score thresholds
    const sortedDims = [...dimensions].sort((a, b) => a.score - b.score);
    const recommendations: string[] = [];
    const lowestDim = sortedDims[0];

    if (lowestDim && lowestDim.score < 500) {
        recommendations.push(`Focus on improving ${lowestDim.name.toLowerCase()} - currently below T3 threshold`);
    }
    if (overall < 500) {
        recommendations.push('Agent requires supervised operation until reaching T3 (500+)');
    }
    if (overall >= 700 && overall < 900) {
        recommendations.push('Agent is a candidate for T5 Sovereign status review');
    }
    if (sortedDims.some(d => d.trend === 'down')) {
        recommendations.push('Address declining metrics before expanding autonomy');
    }
    if (overall >= 900) {
        recommendations.push('Agent has achieved maximum trust tier (T5 Sovereign)');
    }

    return {
        agentId,
        agentName: AGENTS[agentId] || agentId,
        tier,
        tierName,
        overall,
        dimensions,
        history,
        lastUpdated: Date.now(),
        recommendations,
        formula: TRUST_FORMULA,
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
        // Try to load from file first
        const trustPath = path.join(process.cwd(), '..', '..', '.vorion', 'trust', `${agentId}.json`);

        try {
            if (fs.existsSync(trustPath)) {
                const data = JSON.parse(fs.readFileSync(trustPath, 'utf-8'));
                return res.status(200).json(data);
            }
        } catch {
            // Fall through to generated data
        }

        // Generate data
        const trustData = generateTrustData(agentId);
        return res.status(200).json(trustData);
    }

    res.setHeader('Allow', ['GET']);
    res.status(405).json({ error: `Method ${req.method} not allowed` });
}
