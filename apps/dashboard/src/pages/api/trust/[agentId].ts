/**
 * Trust Score API for Individual Agents
 * Returns detailed trust metrics and history
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import * as fs from 'fs';
import * as path from 'path';

export interface TrustDimension {
    name: string;
    score: number;         // 0-100
    trend: 'up' | 'down' | 'stable';
    description: string;
}

export interface TrustSnapshot {
    timestamp: number;
    overall: number;
    dimensions: Record<string, number>;
    event?: string;        // What caused this snapshot
}

export interface TrustResponse {
    agentId: string;
    agentName: string;
    tier: 'UNTRUSTED' | 'PROBATION' | 'SUPERVISED' | 'TRUSTED' | 'PRIVILEGED' | 'AUTONOMOUS';
    overall: number;       // 0-100
    dimensions: TrustDimension[];
    history: TrustSnapshot[];
    lastUpdated: number;
    recommendations: string[];
}

const TRUST_TIERS = [
    { name: 'UNTRUSTED', min: 0, max: 19 },
    { name: 'PROBATION', min: 20, max: 39 },
    { name: 'SUPERVISED', min: 40, max: 59 },
    { name: 'TRUSTED', min: 60, max: 79 },
    { name: 'PRIVILEGED', min: 80, max: 94 },
    { name: 'AUTONOMOUS', min: 95, max: 100 },
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

function getTier(score: number): TrustResponse['tier'] {
    for (const tier of TRUST_TIERS) {
        if (score >= tier.min && score <= tier.max) {
            return tier.name;
        }
    }
    return 'UNTRUSTED';
}

function generateTrustData(agentId: string): TrustResponse {
    // Generate realistic trust scores based on agent role
    const baseScores: Record<string, number> = {
        herald: 72,
        sentinel: 85,
        watchman: 78,
        envoy: 65,
        scribe: 70,
        librarian: 82,
        curator: 68,
        'ts-fixer': 75,
        council: 95,
    };

    const base = baseScores[agentId] || 50;
    const variance = () => Math.floor(Math.random() * 10) - 5;

    const dimensions: TrustDimension[] = [
        {
            name: 'Reliability',
            score: Math.min(100, Math.max(0, base + variance() + 5)),
            trend: 'up',
            description: 'Consistency of successful task completion',
        },
        {
            name: 'Accuracy',
            score: Math.min(100, Math.max(0, base + variance())),
            trend: 'stable',
            description: 'Correctness of outputs and decisions',
        },
        {
            name: 'Security',
            score: Math.min(100, Math.max(0, base + variance() + 3)),
            trend: 'up',
            description: 'Adherence to security policies',
        },
        {
            name: 'Governance',
            score: Math.min(100, Math.max(0, base + variance() - 2)),
            trend: 'stable',
            description: 'Compliance with governance rules',
        },
        {
            name: 'Collaboration',
            score: Math.min(100, Math.max(0, base + variance() + 2)),
            trend: 'up',
            description: 'Effective coordination with other agents',
        },
    ];

    // Generate history (last 30 days)
    const history: TrustSnapshot[] = [];
    let currentScore = base - 15;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    for (let i = 30; i >= 0; i--) {
        // Gradual improvement with some variance
        currentScore += Math.random() * 2 - 0.5;
        currentScore = Math.min(100, Math.max(0, currentScore));

        history.push({
            timestamp: now - i * dayMs,
            overall: Math.round(currentScore),
            dimensions: {
                Reliability: Math.round(currentScore + (Math.random() * 10 - 5)),
                Accuracy: Math.round(currentScore + (Math.random() * 10 - 5)),
                Security: Math.round(currentScore + (Math.random() * 10 - 5)),
                Governance: Math.round(currentScore + (Math.random() * 10 - 5)),
                Collaboration: Math.round(currentScore + (Math.random() * 10 - 5)),
            },
            event: i % 7 === 0 ? ['Task completed', 'Policy review', 'Escalation handled'][Math.floor(Math.random() * 3)] : undefined,
        });
    }

    const overall = Math.round(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length);

    // Generate recommendations based on lowest dimension
    const sortedDims = [...dimensions].sort((a, b) => a.score - b.score);
    const recommendations: string[] = [];
    const lowestDim = sortedDims[0];

    if (lowestDim && lowestDim.score < 70) {
        recommendations.push(`Focus on improving ${lowestDim.name.toLowerCase()} - currently the weakest dimension`);
    }
    if (overall < 80) {
        recommendations.push('Consider additional supervised tasks to build trust');
    }
    if (sortedDims.some(d => d.trend === 'down')) {
        recommendations.push('Address declining metrics before expanding autonomy');
    }
    if (overall >= 80 && overall < 95) {
        recommendations.push('Agent is a candidate for privilege escalation review');
    }

    return {
        agentId,
        agentName: AGENTS[agentId] || agentId,
        tier: getTier(overall),
        overall,
        dimensions,
        history,
        lastUpdated: Date.now(),
        recommendations,
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
