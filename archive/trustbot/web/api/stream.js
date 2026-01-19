/**
 * SSE Streaming Endpoint - Real-time System Updates
 *
 * Provides Server-Sent Events for real-time dashboard updates.
 * Clients connect once and receive state changes as they happen.
 *
 * Events:
 * - state: Full state update
 * - tick: Tick processing result
 * - task: Task status change
 * - agent: Agent status change
 * - event: New system event
 */

import { getSystemState, getTasks } from './lib/storage.js';

// Track connected clients
const clients = new Set();

// Broadcast to all connected clients
export function broadcast(eventType, data) {
    const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    clients.forEach(client => {
        try {
            client.write(message);
        } catch (e) {
            clients.delete(client);
        }
    });
}

// Get trust tier info
const TIER_CONFIG = {
    0: { name: 'Untrusted', threshold: 0 },
    1: { name: 'Probationary', threshold: 200 },
    2: { name: 'Trusted', threshold: 400 },
    3: { name: 'Verified', threshold: 600 },
    4: { name: 'Certified', threshold: 800 },
    5: { name: 'Elite', threshold: 950 },
};

function getTierFromScore(score) {
    for (let tier = 5; tier >= 0; tier--) {
        if (score >= TIER_CONFIG[tier].threshold) return tier;
    }
    return 0;
}

function enrichAgentWithTier(agent) {
    const tier = getTierFromScore(agent.trustScore || 0);
    return {
        ...agent,
        tierLevel: tier,
        tierName: TIER_CONFIG[tier].name,
        canDelegate: tier >= 3,
        canSpawn: tier >= 4,
    };
}

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Check if client wants SSE
    const acceptSSE = req.headers.accept?.includes('text/event-stream');

    if (!acceptSSE) {
        // Return current state as JSON snapshot
        try {
            const state = await getSystemState();
            const tasks = await getTasks();

            if (!state) {
                return res.status(200).json({
                    connected: true,
                    mode: 'snapshot',
                    state: null,
                    message: 'System not initialized',
                });
            }

            // Enrich agents with tier info
            const enrichedAgents = (state.agents || []).map(enrichAgentWithTier);

            // Calculate trust distribution
            const trustDistribution = {
                untrusted: enrichedAgents.filter(a => a.tierLevel === 0).length,
                probationary: enrichedAgents.filter(a => a.tierLevel === 1).length,
                trusted: enrichedAgents.filter(a => a.tierLevel === 2).length,
                verified: enrichedAgents.filter(a => a.tierLevel === 3).length,
                certified: enrichedAgents.filter(a => a.tierLevel === 4).length,
                elite: enrichedAgents.filter(a => a.tierLevel === 5).length,
            };

            return res.status(200).json({
                connected: true,
                mode: 'snapshot',
                state: {
                    ...state,
                    agents: enrichedAgents,
                },
                tasks,
                trustSystem: {
                    distribution: trustDistribution,
                    avgTrust: enrichedAgents.length > 0
                        ? Math.round(enrichedAgents.reduce((s, a) => s + (a.trustScore || 0), 0) / enrichedAgents.length)
                        : 0,
                },
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            return res.status(500).json({
                error: 'Failed to get state',
                details: error.message,
            });
        }
    }

    // SSE Mode - Keep connection open
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ connected: true, timestamp: new Date().toISOString() })}\n\n`);

    // Add to clients
    clients.add(res);

    // Send initial state
    try {
        const state = await getSystemState();
        const tasks = await getTasks();

        if (state) {
            const enrichedAgents = (state.agents || []).map(enrichAgentWithTier);
            res.write(`event: state\ndata: ${JSON.stringify({
                ...state,
                agents: enrichedAgents,
                tasks,
            })}\n\n`);
        }
    } catch (e) {
        console.error('SSE initial state error:', e);
    }

    // Send keepalive every 30 seconds
    const keepalive = setInterval(() => {
        try {
            res.write(`: keepalive ${new Date().toISOString()}\n\n`);
        } catch (e) {
            clearInterval(keepalive);
            clients.delete(res);
        }
    }, 30000);

    // Handle client disconnect
    req.on('close', () => {
        clearInterval(keepalive);
        clients.delete(res);
        console.log('[SSE] Client disconnected');
    });

    // Note: In Vercel serverless, the connection will timeout after ~10s
    // For real SSE, you'd need Vercel Edge Functions or a dedicated server
    // This implementation works for polling-with-long-timeout pattern

    // Don't end the response - keep connection open
    // res.end() is NOT called for SSE
}

// Export broadcast function for other endpoints to use
export { broadcast as sendSSEEvent };
