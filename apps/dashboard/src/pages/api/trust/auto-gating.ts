/**
 * Auto-Gating API Endpoint
 *
 * Runs periodic gating evaluation for all agents.
 * Can be triggered via cron, webhook, or manual request.
 *
 * POST /api/trust/auto-gating - Run auto-gating for all agents
 * GET /api/trust/auto-gating - Get last run status
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import * as path from 'path';
import * as fs from 'fs';

interface GatingRunResult {
    timestamp: number;
    agentsEvaluated: number;
    promotions: Array<{
        agentId: string;
        fromTier: string;
        toTier: string;
        reason: string;
    }>;
    demotions: Array<{
        agentId: string;
        fromTier: string;
        toTier: string;
        reason: string;
    }>;
    holds: number;
    errors: string[];
}

// Store last run result in memory (could be persisted)
let lastRunResult: GatingRunResult | null = null;

async function loadGatingModule() {
    try {
        const councilPath = path.join(process.cwd(), '..', '..', 'packages', 'council', 'src', 'trust');
        const gatingModule = await import(path.join(councilPath, 'gating'));
        const telemetryModule = await import(path.join(councilPath, 'telemetry'));
        return { gatingModule, telemetryModule };
    } catch (err) {
        console.error('[AutoGating] Failed to load modules:', err);
        return null;
    }
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method === 'GET') {
        // Return last run status
        if (lastRunResult) {
            return res.status(200).json({
                status: 'ok',
                lastRun: lastRunResult,
            });
        }
        return res.status(200).json({
            status: 'ok',
            lastRun: null,
            message: 'No auto-gating runs yet',
        });
    }

    if (req.method === 'POST') {
        const modules = await loadGatingModule();

        if (!modules) {
            return res.status(500).json({
                error: 'Failed to load trust modules',
            });
        }

        const { gatingModule, telemetryModule } = modules;
        const result: GatingRunResult = {
            timestamp: Date.now(),
            agentsEvaluated: 0,
            promotions: [],
            demotions: [],
            holds: 0,
            errors: [],
        };

        try {
            // Initialize collector and engine with proper paths
            const trustPath = path.join(process.cwd(), '..', '..', '.vorion', 'trust');
            const auditPath = path.join(trustPath, 'audit');

            // Ensure directories exist
            if (!fs.existsSync(trustPath)) {
                fs.mkdirSync(trustPath, { recursive: true });
            }
            if (!fs.existsSync(auditPath)) {
                fs.mkdirSync(auditPath, { recursive: true });
            }

            const collector = telemetryModule.getTelemetryCollector(trustPath);
            const gatingEngine = gatingModule.getGatingEngine(auditPath);

            // Get all agent states
            const allStates = collector.getAllStates();
            result.agentsEvaluated = allStates.length;

            // If no agents have telemetry, initialize default agents
            if (allStates.length === 0) {
                const defaultAgents = [
                    { id: 'herald', name: 'Herald', tier: 'T3' },
                    { id: 'sentinel', name: 'Sentinel', tier: 'T4' },
                    { id: 'watchman', name: 'Watchman', tier: 'T3' },
                    { id: 'envoy', name: 'Envoy', tier: 'T2' },
                    { id: 'scribe', name: 'Scribe', tier: 'T3' },
                    { id: 'librarian', name: 'Librarian', tier: 'T3' },
                    { id: 'curator', name: 'Curator', tier: 'T2' },
                    { id: 'ts-fixer', name: 'TS-Fixer', tier: 'T3' },
                    { id: 'council', name: 'Council', tier: 'T5' },
                ];

                for (const agent of defaultAgents) {
                    collector.initAgent(agent.id, agent.name, agent.tier as any);
                }

                result.agentsEvaluated = defaultAgents.length;
            }

            // Run auto-gating
            const decisions = gatingEngine.runAutoGating();

            for (const decision of decisions) {
                if (decision.decision === 'promote') {
                    result.promotions.push({
                        agentId: decision.agentId,
                        fromTier: decision.currentTier,
                        toTier: decision.targetTier,
                        reason: decision.reason,
                    });
                } else if (decision.decision === 'demote') {
                    result.demotions.push({
                        agentId: decision.agentId,
                        fromTier: decision.currentTier,
                        toTier: decision.targetTier,
                        reason: decision.reason,
                    });
                }
            }

            result.holds = result.agentsEvaluated - result.promotions.length - result.demotions.length;

        } catch (err: any) {
            result.errors.push(err.message || 'Unknown error during gating');
        }

        lastRunResult = result;

        return res.status(200).json({
            status: 'ok',
            result,
        });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).json({ error: `Method ${req.method} not allowed` });
}
