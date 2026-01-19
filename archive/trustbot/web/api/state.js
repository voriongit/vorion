import { getSystemState, saveSystemState, initStorage, isPersistent } from './lib/storage.js';

/**
 * Vercel Serverless API - State Endpoint
 * 
 * Returns full system state including agents, blackboard, and stats.
 * Uses Storage Adapter for persistence (Postgres or Memory).
 */

// Default State (Genesis Protocol)
const defaultState = {
    agents: [
        {
            id: 'arch-1',
            name: 'The Architect',
            type: 'PLANNER',
            tier: 5,
            status: 'WORKING',
            location: { floor: 'EXECUTIVE', room: 'PLANNER_OFFICE' },
            trustScore: 1000,
            capabilities: ['strategy_design', 'org_chart_planning', 'goal_decomposition'],
            skills: [],
            parentId: null,
            childIds: [],
            createdAt: new Date().toISOString()
        },
        {
            id: 'rec-1',
            name: 'The Recruiter',
            type: 'SPAWNER',
            tier: 5,
            status: 'IDLE',
            location: { floor: 'EXECUTIVE', room: 'SPAWNER_OFFICE' },
            trustScore: 1000,
            capabilities: ['agent_spawn', 'resource_allocation', 'team_building'],
            skills: [],
            parentId: null,
            childIds: ['w-1'],
            createdAt: new Date().toISOString()
        },
        {
            id: 'over-1',
            name: 'The Overseer',
            type: 'VALIDATOR',
            tier: 5,
            status: 'IDLE',
            location: { floor: 'EXECUTIVE', room: 'VALIDATOR_OFFICE' },
            trustScore: 1000,
            capabilities: ['compliance_check', 'trust_monitoring', 'security_audit'],
            skills: [],
            parentId: null,
            childIds: [],
            createdAt: new Date().toISOString()
        },
        {
            id: 'exec-1',
            name: 'Head of Ops',
            type: 'EXECUTOR',
            tier: 5,
            status: 'WORKING',
            location: { floor: 'EXECUTIVE', room: 'EXECUTOR_OFFICE' },
            trustScore: 990,
            capabilities: ['task_execution', 'emergency_override'],
            skills: [],
            parentId: null,
            childIds: [],
            createdAt: new Date().toISOString()
        },
        {
            id: 'evol-1',
            name: 'The Evolver',
            type: 'EVOLVER',
            tier: 5,
            status: 'IDLE',
            location: { floor: 'EXECUTIVE', room: 'EVOLVER_OFFICE' },
            trustScore: 980,
            capabilities: ['system_optimization', 'pattern_recognition', 'evolution_design'],
            skills: [],
            parentId: null,
            childIds: [],
            createdAt: new Date().toISOString()
        },
        // Initial Workers
        { id: 'w-1', name: 'Scout-Alpha', type: 'LISTENER', tier: 1, status: 'WORKING', location: { floor: 'OPERATIONS', room: 'LISTENER_STATION' }, trustScore: 150, capabilities: ['observe'], skills: [], parentId: 'rec-1', childIds: [], createdAt: new Date().toISOString() },
    ],
    blackboard: [
        {
            id: 'bb-genesis',
            type: 'DECISION',
            title: 'Genesis Protocol Initiated',
            content: 'Founding Fathers initialized. Awaiting Founder intent.',
            author: 'arch-1',
            priority: 'CRITICAL',
            status: 'OPEN',
            createdAt: new Date().toISOString(),
            comments: [
                { author: 'rec-1', text: 'Resources allocated. Ready to spawn workforce.', timestamp: new Date().toISOString() },
                { author: 'over-1', text: 'Security protocols active. Trust baseline set to 100.', timestamp: new Date().toISOString() }
            ]
        },
        {
            id: 'bb-task-1',
            type: 'TASK',
            title: 'Awaiting Mission Statement',
            content: 'Please define the company goal.',
            author: 'arch-1',
            priority: 'HIGH',
            status: 'IN_PROGRESS',
            createdAt: new Date().toISOString(),
            comments: []
        }
    ],
    hitlLevel: 100,
    avgTrust: 1000,
    startedAt: new Date().toISOString(),
    events: ['Genesis Protocol Initiated', 'Founding Fathers Online'],
};

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Initialize Storage
    await initStorage();

    // Load State
    let currentState = await getSystemState();

    // Fallback if empty (First run or Memory reset)
    if (!currentState) {
        currentState = defaultState;
        // In persistent mode, this saves the default state to DB.
        // In memory mode, this sets the memory cache.
        await saveSystemState(currentState);
    }

    // Handle Comment Actions
    if (req.method === 'POST') {
        const { action, entryId, comment, author } = req.body;

        if (action === 'comment') {
            const entry = currentState.blackboard.find(e => e.id === entryId);
            if (entry) {
                if (!entry.comments) entry.comments = [];
                entry.comments.push({
                    author: author || 'Founder',
                    text: comment,
                    timestamp: new Date().toISOString()
                });

                // Simulate reply from Architect
                if (Math.random() > 0.5) {
                    entry.comments.push({
                        author: 'arch-1',
                        text: `Acknowledged. "The Architect" is analyzing: "${comment}"`,
                        timestamp: new Date().toISOString()
                    });
                }

                // Save updated state
                await saveSystemState(currentState);

                return res.status(200).json({ success: true, entry });
            }
        }
    }

    // Calculate day from real time since system started
    const startedAt = currentState.startedAt ? new Date(currentState.startedAt) : new Date();
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const day = Math.floor((now - startedAt) / msPerDay) + 1;

    return res.status(200).json({
        ...currentState,
        day, // Calculated from real time
        persistenceMode: isPersistent ? 'postgres' : 'memory'
    });
}
