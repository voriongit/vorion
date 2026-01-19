/**
 * Vercel Serverless API - Spawn Endpoint
 */

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, type, tier } = req.body || {};

    const agent = {
        id: `agent-${Date.now()}`,
        name: name || 'NewAgent',
        type: type || 'WORKER',
        tier: tier || 1,
        status: 'IDLE',
        location: { floor: 'OPERATIONS', room: 'SPAWN_BAY' },
        trustScore: (tier || 1) * 50 + 50,
        capabilities: [],
        parentId: 'spawn-1',
        childIds: [],
        createdAt: new Date().toISOString(),
    };

    return res.status(200).json(agent);
}
