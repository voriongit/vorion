/**
 * Autonomy Status API
 * Returns status of autonomous agent operations
 */

import type { NextApiRequest, NextApiResponse } from 'next';

export interface AgentAutonomyStatus {
    agentId: string;
    name: string;
    mode: 'autonomous' | 'supervised' | 'manual' | 'paused';
    enabled: boolean;
    lastRun?: number;
    nextRun?: number;
    tasksToday: number;
    pendingApprovals: number;
    status: 'active' | 'idle' | 'working' | 'waiting_approval';
}

export interface AutonomyStatusResponse {
    running: boolean;
    agents: AgentAutonomyStatus[];
    pendingApprovals: number;
    tasksToday: number;
    recentActivity: Array<{
        id: string;
        agentId: string;
        description: string;
        status: string;
        timestamp: number;
    }>;
}

// Simulated data for demo
function generateStatus(): AutonomyStatusResponse {
    const agents: AgentAutonomyStatus[] = [
        {
            agentId: 'herald',
            name: 'Herald',
            mode: 'supervised',
            enabled: true,
            lastRun: Date.now() - 300000,
            nextRun: Date.now() + 300000,
            tasksToday: 12,
            pendingApprovals: 1,
            status: 'waiting_approval',
        },
        {
            agentId: 'sentinel',
            name: 'Sentinel',
            mode: 'autonomous',
            enabled: true,
            lastRun: Date.now() - 60000,
            nextRun: Date.now() + 240000,
            tasksToday: 28,
            pendingApprovals: 0,
            status: 'active',
        },
        {
            agentId: 'watchman',
            name: 'Watchman',
            mode: 'autonomous',
            enabled: true,
            lastRun: Date.now() - 120000,
            nextRun: Date.now() + 180000,
            tasksToday: 45,
            pendingApprovals: 0,
            status: 'working',
        },
        {
            agentId: 'scribe',
            name: 'Scribe',
            mode: 'supervised',
            enabled: true,
            lastRun: Date.now() - 600000,
            nextRun: Date.now() + 600000,
            tasksToday: 5,
            pendingApprovals: 2,
            status: 'waiting_approval',
        },
        {
            agentId: 'curator',
            name: 'Curator',
            mode: 'manual',
            enabled: false,
            tasksToday: 0,
            pendingApprovals: 0,
            status: 'idle',
        },
        {
            agentId: 'ts-fixer',
            name: 'TS-Fixer',
            mode: 'autonomous',
            enabled: true,
            lastRun: Date.now() - 180000,
            nextRun: Date.now() + 120000,
            tasksToday: 18,
            pendingApprovals: 0,
            status: 'active',
        },
    ];

    const recentActivity = [
        { id: '1', agentId: 'sentinel', description: 'Code review: auth module', status: 'completed', timestamp: Date.now() - 60000 },
        { id: '2', agentId: 'watchman', description: 'Health check: API endpoints', status: 'running', timestamp: Date.now() - 30000 },
        { id: '3', agentId: 'ts-fixer', description: 'Fix type error in utils.ts', status: 'completed', timestamp: Date.now() - 120000 },
        { id: '4', agentId: 'herald', description: 'Process user request: deploy', status: 'pending', timestamp: Date.now() - 180000 },
        { id: '5', agentId: 'scribe', description: 'Update API documentation', status: 'pending', timestamp: Date.now() - 240000 },
    ];

    return {
        running: true,
        agents,
        pendingApprovals: agents.reduce((sum, a) => sum + a.pendingApprovals, 0),
        tasksToday: agents.reduce((sum, a) => sum + a.tasksToday, 0),
        recentActivity,
    };
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<AutonomyStatusResponse | { error: string }>
) {
    if (req.method === 'GET') {
        const status = generateStatus();
        return res.status(200).json(status);
    }

    if (req.method === 'POST') {
        // Extract body params (used in production for actual autonomy control)
        const { action: _action, agentId: _agentId, mode: _mode } = req.body;
        void _action; void _agentId; void _mode; // Acknowledge for future use

        // Handle actions like start/stop, mode changes
        // In production, this would interact with the actual AutonomySystem

        return res.status(200).json(generateStatus());
    }

    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).json({ error: `Method ${req.method} not allowed` });
}
