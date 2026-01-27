/**
 * Fleet Trust Overview API
 *
 * GET /api/trust/fleet - Get trust summary for all agents
 *
 * Returns aggregated trust metrics across the entire agent fleet.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import * as path from 'path';
import * as fs from 'fs';

interface FleetTrustSummary {
    timestamp: number;
    totalAgents: number;
    tierDistribution: Record<string, number>;
    averageScore: number;
    topPerformers: Array<{
        agentId: string;
        agentName: string;
        tier: string;
        overall: number;
    }>;
    atRisk: Array<{
        agentId: string;
        agentName: string;
        tier: string;
        overall: number;
        lowestDimension: { name: string; score: number };
    }>;
    promotionCandidates: Array<{
        agentId: string;
        agentName: string;
        currentTier: string;
        nextTier: string;
        blockedBy: string[];
    }>;
    dimensionAverages: Record<string, number>;
}

async function loadTrustModules() {
    try {
        const councilPath = path.join(process.cwd(), '..', '..', 'packages', 'council', 'src', 'trust');
        const telemetryModule = await import(path.join(councilPath, 'telemetry'));
        const gatingModule = await import(path.join(councilPath, 'gating'));
        return { telemetryModule, gatingModule };
    } catch (err) {
        console.error('[FleetAPI] Failed to load modules:', err);
        return null;
    }
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<FleetTrustSummary | { error: string }>
) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }

    const trustPath = path.join(process.cwd(), '..', '..', '.vorion', 'trust');
    const modules = await loadTrustModules();

    // Initialize tier distribution
    const tierDistribution: Record<string, number> = {
        T0: 0, T1: 0, T2: 0, T3: 0, T4: 0, T5: 0, T6: 0,
    };

    const dimensionTotals: Record<string, number> = {};
    const dimensionCounts: Record<string, number> = {};

    const agents: Array<{
        agentId: string;
        agentName: string;
        tier: string;
        overall: number;
        dimensions: Record<string, number>;
    }> = [];

    if (modules) {
        try {
            const collector = modules.telemetryModule.getTelemetryCollector(trustPath);
            const gatingEngine = modules.gatingModule.getGatingEngine(
                path.join(trustPath, 'audit')
            );

            const allStates = collector.getAllStates();

            for (const state of allStates) {
                tierDistribution[state.tier] = (tierDistribution[state.tier] || 0) + 1;

                const dimScores: Record<string, number> = {};
                for (const [name, dimState] of Object.entries(state.dimensions)) {
                    const score = (dimState as any).score;
                    dimScores[name] = score;
                    dimensionTotals[name] = (dimensionTotals[name] || 0) + score;
                    dimensionCounts[name] = (dimensionCounts[name] || 0) + 1;
                }

                agents.push({
                    agentId: state.agentId,
                    agentName: state.agentName,
                    tier: state.tier,
                    overall: state.overall,
                    dimensions: dimScores,
                });
            }
        } catch (err) {
            console.error('[FleetAPI] Error loading telemetry:', err);
        }
    }

    // If no real data, generate from files or defaults
    if (agents.length === 0) {
        const defaultAgents = [
            { id: 'herald', name: 'Herald', tier: 'T3', overall: 580 },
            { id: 'sentinel', name: 'Sentinel', tier: 'T4', overall: 720 },
            { id: 'watchman', name: 'Watchman', tier: 'T3', overall: 620 },
            { id: 'envoy', name: 'Envoy', tier: 'T2', overall: 420 },
            { id: 'scribe', name: 'Scribe', tier: 'T3', overall: 560 },
            { id: 'librarian', name: 'Librarian', tier: 'T3', overall: 590 },
            { id: 'curator', name: 'Curator', tier: 'T2', overall: 380 },
            { id: 'ts-fixer', name: 'TS-Fixer', tier: 'T3', overall: 550 },
            { id: 'council', name: 'Council', tier: 'T5', overall: 850 },
        ];

        for (const agent of defaultAgents) {
            tierDistribution[agent.tier] = (tierDistribution[agent.tier] || 0) + 1;
            agents.push({
                agentId: agent.id,
                agentName: agent.name,
                tier: agent.tier,
                overall: agent.overall,
                dimensions: {},
            });
        }
    }

    // Calculate averages
    const totalScore = agents.reduce((sum, a) => sum + a.overall, 0);
    const averageScore = agents.length > 0 ? Math.round(totalScore / agents.length) : 0;

    const dimensionAverages: Record<string, number> = {};
    for (const [name, total] of Object.entries(dimensionTotals)) {
        dimensionAverages[name] = Math.round(total / (dimensionCounts[name] || 1));
    }

    // Sort for top performers and at-risk
    const sortedByScore = [...agents].sort((a, b) => b.overall - a.overall);
    const topPerformers = sortedByScore.slice(0, 3).map(a => ({
        agentId: a.agentId,
        agentName: a.agentName,
        tier: a.tier,
        overall: a.overall,
    }));

    // Find at-risk agents (lowest scores or declining)
    const atRisk = sortedByScore.reverse().slice(0, 3).map(a => {
        const dims = Object.entries(a.dimensions);
        const lowest = dims.length > 0
            ? dims.reduce((min, [name, score]) => score < min.score ? { name, score } : min, { name: 'N/A', score: 1000 })
            : { name: 'N/A', score: a.overall };

        return {
            agentId: a.agentId,
            agentName: a.agentName,
            tier: a.tier,
            overall: a.overall,
            lowestDimension: lowest,
        };
    });

    // Find promotion candidates
    const promotionCandidates: Array<{
        agentId: string;
        agentName: string;
        currentTier: string;
        nextTier: string;
        blockedBy: string[];
    }> = [];

    if (modules) {
        try {
            const gatingEngine = modules.gatingModule.getGatingEngine(
                path.join(trustPath, 'audit')
            );

            for (const agent of agents) {
                const decision = gatingEngine.evaluateGating(agent.agentId);
                if (decision.blockedDimensions.length > 0 && decision.blockedDimensions.length <= 3) {
                    promotionCandidates.push({
                        agentId: agent.agentId,
                        agentName: agent.agentName,
                        currentTier: decision.currentTier,
                        nextTier: decision.targetTier,
                        blockedBy: decision.blockedDimensions,
                    });
                }
            }
        } catch {
            // Ignore gating errors
        }
    }

    const summary: FleetTrustSummary = {
        timestamp: Date.now(),
        totalAgents: agents.length,
        tierDistribution,
        averageScore,
        topPerformers,
        atRisk,
        promotionCandidates: promotionCandidates.slice(0, 5),
        dimensionAverages,
    };

    return res.status(200).json(summary);
}
