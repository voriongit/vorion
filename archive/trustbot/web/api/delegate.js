/**
 * Task Delegation API
 *
 * Handles task delegation between agents with full history tracking
 * and anti-delegation rule enforcement.
 *
 * Rules:
 * - Only VERIFIED+ agents (600+ trust) can delegate
 * - Max 2 delegations per task
 * - Full delegation history is tracked
 * - Invalid delegations result in trust penalties
 */

import { getSystemState, saveSystemState, getTasks, saveTask, initStorage } from './lib/storage.js';

// ============================================================================
// TRUST TIER SYSTEM
// ============================================================================

const TrustTier = {
    UNTRUSTED: 0, PROBATIONARY: 1, TRUSTED: 2,
    VERIFIED: 3, CERTIFIED: 4, ELITE: 5,
};

const TIER_CONFIG = {
    [TrustTier.UNTRUSTED]: { name: 'Untrusted', threshold: 0, canDelegate: false },
    [TrustTier.PROBATIONARY]: { name: 'Probationary', threshold: 200, canDelegate: false },
    [TrustTier.TRUSTED]: { name: 'Trusted', threshold: 400, canDelegate: false },
    [TrustTier.VERIFIED]: { name: 'Verified', threshold: 600, canDelegate: true },
    [TrustTier.CERTIFIED]: { name: 'Certified', threshold: 800, canDelegate: true },
    [TrustTier.ELITE]: { name: 'Elite', threshold: 950, canDelegate: true },
};

const EXECUTION_RULES = {
    MAX_DELEGATIONS: 2,
    TRUST_PENALTIES: {
        INVALID_DELEGATION: -20,
        EXCESSIVE_DELEGATION: -25,
    },
};

function getTierFromScore(score) {
    for (const tier of [TrustTier.ELITE, TrustTier.CERTIFIED, TrustTier.VERIFIED, TrustTier.TRUSTED, TrustTier.PROBATIONARY]) {
        if (score >= TIER_CONFIG[tier].threshold) return tier;
    }
    return TrustTier.UNTRUSTED;
}

function getTierName(score) {
    return TIER_CONFIG[getTierFromScore(score)]?.name || 'Unknown';
}

function canAgentDelegate(agent) {
    const tier = getTierFromScore(agent.trustScore || 0);
    return TIER_CONFIG[tier]?.canDelegate || false;
}

// ============================================================================
// API HANDLER
// ============================================================================

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    await initStorage();

    // GET: Get delegation rules and status for a task
    if (req.method === 'GET') {
        const { taskId } = req.query;

        if (!taskId) {
            // Return delegation rules
            return res.status(200).json({
                rules: {
                    maxDelegations: EXECUTION_RULES.MAX_DELEGATIONS,
                    minTierToDelegate: 'VERIFIED (600+ trust)',
                    penalties: EXECUTION_RULES.TRUST_PENALTIES,
                },
                tiers: Object.entries(TIER_CONFIG).map(([level, config]) => ({
                    level: parseInt(level),
                    ...config,
                })),
            });
        }

        // Get task delegation status
        const tasks = await getTasks();
        const task = tasks.find(t => t.id === taskId);

        if (!task) {
            return res.status(404).json({ error: `Task not found: ${taskId}` });
        }

        return res.status(200).json({
            taskId: task.id,
            description: task.description,
            currentDelegations: task.currentDelegations || 0,
            maxDelegations: EXECUTION_RULES.MAX_DELEGATIONS,
            remainingDelegations: EXECUTION_RULES.MAX_DELEGATIONS - (task.currentDelegations || 0),
            canDelegate: (task.currentDelegations || 0) < EXECUTION_RULES.MAX_DELEGATIONS,
            delegationHistory: task.delegationHistory || [],
            currentAssignee: task.assigneeName || task.assignee,
        });
    }

    // POST: Perform delegation
    if (req.method === 'POST') {
        const { taskId, fromAgentId, toAgentId, reason } = req.body;

        if (!taskId || !fromAgentId || !toAgentId) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['taskId', 'fromAgentId', 'toAgentId'],
            });
        }

        const state = await getSystemState();
        if (!state) {
            return res.status(500).json({ error: 'System not initialized' });
        }

        const tasks = await getTasks();
        const task = tasks.find(t => t.id === taskId);

        if (!task) {
            return res.status(404).json({ error: `Task not found: ${taskId}` });
        }

        const fromAgent = (state.agents || []).find(a => a.id === fromAgentId);
        const toAgent = (state.agents || []).find(a => a.id === toAgentId);

        if (!fromAgent) {
            return res.status(404).json({ error: `From agent not found: ${fromAgentId}` });
        }

        if (!toAgent) {
            return res.status(404).json({ error: `To agent not found: ${toAgentId}` });
        }

        // Validate: Is fromAgent the current assignee?
        if (task.assignee !== fromAgentId) {
            return res.status(403).json({
                error: 'Only the current assignee can delegate',
                currentAssignee: task.assigneeName || task.assignee,
                requestedFrom: fromAgent.name,
            });
        }

        // Validate: Can fromAgent delegate?
        if (!canAgentDelegate(fromAgent)) {
            // Apply penalty for invalid delegation attempt
            const fromIdx = state.agents.findIndex(a => a.id === fromAgentId);
            if (fromIdx >= 0) {
                const oldTrust = state.agents[fromIdx].trustScore || 0;
                state.agents[fromIdx].trustScore = Math.max(0, oldTrust + EXECUTION_RULES.TRUST_PENALTIES.INVALID_DELEGATION);

                state.events = state.events || [];
                state.events.unshift(`[${new Date().toLocaleTimeString()}] ${fromAgent.name} INVALID DELEGATION ATTEMPT (${EXECUTION_RULES.TRUST_PENALTIES.INVALID_DELEGATION} trust)`);
                state.events = state.events.slice(0, 20);

                await saveSystemState(state);
            }

            return res.status(403).json({
                error: `Agent ${fromAgent.name} cannot delegate`,
                reason: `Requires VERIFIED+ tier (600+ trust). Current: ${getTierName(fromAgent.trustScore)} (${fromAgent.trustScore})`,
                penalty: EXECUTION_RULES.TRUST_PENALTIES.INVALID_DELEGATION,
            });
        }

        // Validate: Max delegations reached?
        if ((task.currentDelegations || 0) >= EXECUTION_RULES.MAX_DELEGATIONS) {
            // Apply penalty for excessive delegation attempt
            const fromIdx = state.agents.findIndex(a => a.id === fromAgentId);
            if (fromIdx >= 0) {
                const oldTrust = state.agents[fromIdx].trustScore || 0;
                state.agents[fromIdx].trustScore = Math.max(0, oldTrust + EXECUTION_RULES.TRUST_PENALTIES.EXCESSIVE_DELEGATION);

                state.events = state.events || [];
                state.events.unshift(`[${new Date().toLocaleTimeString()}] ${fromAgent.name} EXCESSIVE DELEGATION (${EXECUTION_RULES.TRUST_PENALTIES.EXCESSIVE_DELEGATION} trust)`);
                state.events = state.events.slice(0, 20);

                await saveSystemState(state);
            }

            return res.status(403).json({
                error: 'Max delegations reached',
                maxDelegations: EXECUTION_RULES.MAX_DELEGATIONS,
                currentDelegations: task.currentDelegations,
                message: 'Task must be executed directly',
                penalty: EXECUTION_RULES.TRUST_PENALTIES.EXCESSIVE_DELEGATION,
            });
        }

        // Perform delegation
        const delegationRecord = {
            id: `del-${Date.now()}`,
            from: {
                id: fromAgent.id,
                name: fromAgent.name,
                trustScore: fromAgent.trustScore,
                tier: getTierName(fromAgent.trustScore),
            },
            to: {
                id: toAgent.id,
                name: toAgent.name,
                trustScore: toAgent.trustScore,
                tier: getTierName(toAgent.trustScore),
            },
            reason: reason || 'No reason provided',
            timestamp: new Date().toISOString(),
            delegationNumber: (task.currentDelegations || 0) + 1,
        };

        // Update task
        task.currentDelegations = (task.currentDelegations || 0) + 1;
        task.assignee = toAgent.id;
        task.assigneeName = toAgent.name;
        task.delegationHistory = task.delegationHistory || [];
        task.delegationHistory.push(delegationRecord);
        task.updatedAt = new Date().toISOString();
        task.nextSteps = `Delegated to ${toAgent.name} (${task.currentDelegations}/${EXECUTION_RULES.MAX_DELEGATIONS} delegations)`;

        await saveTask(task);

        // Update agent statuses
        const fromIdx = state.agents.findIndex(a => a.id === fromAgentId);
        const toIdx = state.agents.findIndex(a => a.id === toAgentId);

        if (fromIdx >= 0) state.agents[fromIdx].status = 'IDLE';
        if (toIdx >= 0) state.agents[toIdx].status = 'WORKING';

        // Add event
        state.events = state.events || [];
        state.events.unshift(`[${new Date().toLocaleTimeString()}] ${fromAgent.name} → ${toAgent.name}: delegated "${task.description?.slice(0, 30)}..."`);
        state.events = state.events.slice(0, 20);

        await saveSystemState(state);

        return res.status(200).json({
            success: true,
            delegation: delegationRecord,
            task: {
                id: task.id,
                status: task.status,
                assignee: task.assigneeName,
                currentDelegations: task.currentDelegations,
                remainingDelegations: EXECUTION_RULES.MAX_DELEGATIONS - task.currentDelegations,
                canDelegateAgain: task.currentDelegations < EXECUTION_RULES.MAX_DELEGATIONS,
            },
            message: task.currentDelegations >= EXECUTION_RULES.MAX_DELEGATIONS
                ? `Delegation successful. Max delegations reached - ${toAgent.name} must execute this task.`
                : `Delegation successful. ${EXECUTION_RULES.MAX_DELEGATIONS - task.currentDelegations} delegation(s) remaining.`,
        });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
