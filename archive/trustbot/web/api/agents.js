/**
 * Vercel Serverless API - Agents Endpoint
 */

const agents = [
    { id: 'exec-1', name: 'T5-EXECUTOR', type: 'EXECUTOR', tier: 5, status: 'IDLE', location: { floor: 'EXECUTIVE', room: 'EXECUTOR_OFFICE' }, trustScore: 1000, capabilities: ['strategic_decision'], parentId: null, childIds: [], createdAt: new Date().toISOString() },
    { id: 'plan-1', name: 'T5-PLANNER', type: 'PLANNER', tier: 5, status: 'WORKING', location: { floor: 'EXECUTIVE', room: 'PLANNER_OFFICE' }, trustScore: 980, capabilities: ['goal_decomposition'], parentId: null, childIds: [], createdAt: new Date().toISOString() },
    { id: 'valid-1', name: 'T5-VALIDATOR', type: 'VALIDATOR', tier: 5, status: 'IDLE', location: { floor: 'EXECUTIVE', room: 'VALIDATOR_OFFICE' }, trustScore: 990, capabilities: ['spawn_validation'], parentId: null, childIds: [], createdAt: new Date().toISOString() },
    { id: 'evolve-1', name: 'T5-EVOLVER', type: 'EVOLVER', tier: 5, status: 'WORKING', location: { floor: 'EXECUTIVE', room: 'EVOLVER_OFFICE' }, trustScore: 970, capabilities: ['performance_analysis'], parentId: null, childIds: [], createdAt: new Date().toISOString() },
    { id: 'spawn-1', name: 'T5-SPAWNER', type: 'SPAWNER', tier: 5, status: 'IDLE', location: { floor: 'EXECUTIVE', room: 'SPAWNER_OFFICE' }, trustScore: 985, capabilities: ['spawn_agents'], parentId: null, childIds: [], createdAt: new Date().toISOString() },
    { id: 'listen-1', name: 'DecisionListener', type: 'LISTENER', tier: 0, status: 'WORKING', location: { floor: 'OPERATIONS', room: 'LISTENER_STATION' }, trustScore: 40, capabilities: ['observe'], parentId: 'spawn-1', childIds: [], createdAt: new Date().toISOString() },
    { id: 'asst-1', name: 'ResearchAssistant', type: 'WORKER', tier: 1, status: 'IDLE', location: { floor: 'OPERATIONS', room: 'ASSISTANT_DESK_A' }, trustScore: 80, capabilities: ['assist'], parentId: 'spawn-1', childIds: [], createdAt: new Date().toISOString() },
];

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    return res.status(200).json(agents);
}
