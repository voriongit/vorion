/**
 * Agent Discovery API Routes (Hono)
 *
 * Endpoints for dynamic agent fleet management:
 * - Agent registration and discovery
 * - Skill-based agent matching
 * - Agent communication messaging
 * - Collaboration requests
 */

import { Hono } from 'hono';

const agentDiscoveryRoutes = new Hono();

// In-memory stores (replace with database in production)
interface AgentCapability {
    agentId: string;
    agentName: string;
    provider: string;
    skills: string[];
    capabilities: string[];
    currentLoad: number;
    available: boolean;
    tier: number;
    registeredAt: Date;
    lastHeartbeat: Date;
}

interface AgentMessage {
    id: string;
    type: string;
    from: string;
    to: string;
    subject: string;
    content: string;
    context?: Record<string, unknown>;
    priority: string;
    timestamp: Date;
    replyTo?: string;
}

interface CollaborationRequest {
    id: string;
    requesterId: string;
    requesterName: string;
    taskId?: string;
    taskTitle: string;
    description: string;
    requiredSkills: string[];
    priority: string;
    deadline?: string;
    context?: Record<string, unknown>;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED';
    acceptedBy?: string;
    result?: {
        success: boolean;
        summary: string;
        data?: Record<string, unknown>;
        confidence: number;
        duration: number;
    };
    createdAt: Date;
}

const agentRegistry: Map<string, AgentCapability> = new Map();
const messageStore: Map<string, AgentMessage> = new Map();
const agentMessages: Map<string, string[]> = new Map(); // agentId -> messageIds
const collaborations: Map<string, CollaborationRequest> = new Map();

// ═══════════════════════════════════════════════════════════════
// AGENT REGISTRY ENDPOINTS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/agent-registry
 * List all registered agents
 */
agentDiscoveryRoutes.get('/registry', (c) => {
    const agents = Array.from(agentRegistry.values());
    return c.json({
        count: agents.length,
        agents: agents.map(a => ({
            ...a,
            registeredAt: a.registeredAt.toISOString(),
            lastHeartbeat: a.lastHeartbeat.toISOString(),
        })),
    });
});

/**
 * POST /api/agent-registry
 * Register a new agent
 */
agentDiscoveryRoutes.post('/registry', async (c) => {
    const body = await c.req.json();
    const capability: AgentCapability = {
        ...body,
        registeredAt: new Date(),
        lastHeartbeat: new Date(),
        available: body.available ?? true,
        currentLoad: body.currentLoad ?? 0,
    };

    if (!capability.agentId || !capability.agentName) {
        return c.json({ error: 'agentId and agentName required' }, 400);
    }

    agentRegistry.set(capability.agentId, capability);
    console.log(`[AgentDiscovery] Registered: ${capability.agentName} (${capability.agentId})`);

    return c.json({
        message: 'Agent registered',
        agent: capability,
    }, 201);
});

/**
 * GET /api/agent-registry/:agentId
 * Get agent by ID
 */
agentDiscoveryRoutes.get('/registry/:agentId', (c) => {
    const agent = agentRegistry.get(c.req.param('agentId'));
    if (!agent) {
        return c.json({ error: 'Agent not found' }, 404);
    }
    return c.json(agent);
});

/**
 * DELETE /api/agent-registry/:agentId
 * Unregister an agent
 */
agentDiscoveryRoutes.delete('/registry/:agentId', (c) => {
    const agentId = c.req.param('agentId');
    const agent = agentRegistry.get(agentId);
    if (!agent) {
        return c.json({ error: 'Agent not found' }, 404);
    }

    agentRegistry.delete(agentId);
    console.log(`[AgentDiscovery] Unregistered: ${agent.agentName}`);

    return c.json({ message: 'Agent unregistered', agentId });
});

/**
 * PATCH /api/agent-registry/:agentId/load
 * Update agent load
 */
agentDiscoveryRoutes.patch('/registry/:agentId/load', async (c) => {
    const agentId = c.req.param('agentId');
    const agent = agentRegistry.get(agentId);
    if (!agent) {
        return c.json({ error: 'Agent not found' }, 404);
    }

    const { load } = await c.req.json();
    if (typeof load !== 'number' || load < 0 || load > 100) {
        return c.json({ error: 'Load must be 0-100' }, 400);
    }

    agent.currentLoad = load;
    agent.available = load < 80;
    agent.lastHeartbeat = new Date();

    return c.json({ message: 'Load updated', agent });
});

/**
 * POST /api/agent-registry/:agentId/heartbeat
 * Update agent heartbeat
 */
agentDiscoveryRoutes.post('/registry/:agentId/heartbeat', async (c) => {
    const agentId = c.req.param('agentId');
    const agent = agentRegistry.get(agentId);
    if (!agent) {
        return c.json({ error: 'Agent not found' }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    agent.lastHeartbeat = new Date();
    if (body.load !== undefined) {
        agent.currentLoad = body.load;
        agent.available = body.load < 80;
    }

    return c.json({ message: 'Heartbeat recorded', agent });
});

/**
 * GET /api/agent-registry/search/by-skills
 * Find agents by skills
 */
agentDiscoveryRoutes.get('/registry/search/by-skills', (c) => {
    const skillsParam = c.req.query('skills');
    if (!skillsParam) {
        return c.json({ error: 'skills query parameter required' }, 400);
    }

    const requiredSkills = skillsParam.split(',').map(s => s.trim().toLowerCase());
    const availableOnly = c.req.query('available') !== 'false';

    const matches: Array<{ agent: AgentCapability; matchScore: number }> = [];

    for (const agent of agentRegistry.values()) {
        if (availableOnly && !agent.available) continue;

        const agentSkills = [
            ...agent.skills.map(s => s.toLowerCase()),
            ...agent.capabilities.map(s => s.toLowerCase()),
        ];

        const matchingSkills = requiredSkills.filter(skill => agentSkills.includes(skill));
        const matchScore = matchingSkills.length / requiredSkills.length;

        if (matchScore > 0) {
            const loadFactor = 1 - (agent.currentLoad / 100);
            const finalScore = matchScore * 0.7 + loadFactor * 0.3;
            matches.push({ agent, matchScore: finalScore });
        }
    }

    matches.sort((a, b) => b.matchScore - a.matchScore);

    return c.json({
        requiredSkills,
        matchCount: matches.length,
        matches: matches.map(m => ({
            ...m.agent,
            matchScore: Math.round(m.matchScore * 100),
        })),
    });
});

// ═══════════════════════════════════════════════════════════════
// AGENT MESSAGING ENDPOINTS
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/agent-messages
 * Send a message
 */
agentDiscoveryRoutes.post('/messages', async (c) => {
    const body = await c.req.json();
    const message: AgentMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        ...body,
        timestamp: new Date(),
    };

    if (!message.from || !message.to || !message.type) {
        return c.json({ error: 'from, to, and type required' }, 400);
    }

    messageStore.set(message.id, message);

    // Index by recipient
    const recipientMessages = agentMessages.get(message.to) || [];
    recipientMessages.push(message.id);
    agentMessages.set(message.to, recipientMessages);

    // Index by sender
    const senderMessages = agentMessages.get(message.from) || [];
    senderMessages.push(message.id);
    agentMessages.set(message.from, senderMessages);

    console.log(`[AgentDiscovery] Message: ${message.from} -> ${message.to} (${message.type})`);

    return c.json({ message: 'Message sent', id: message.id }, 201);
});

/**
 * GET /api/agent-messages/:agentId
 * Get messages for an agent
 */
agentDiscoveryRoutes.get('/messages/:agentId', (c) => {
    const agentId = c.req.param('agentId');
    const messageIds = agentMessages.get(agentId) || [];
    let messages = messageIds
        .map(id => messageStore.get(id))
        .filter((m): m is AgentMessage => m !== undefined);

    // Apply filters
    const typeFilter = c.req.query('type');
    const fromFilter = c.req.query('from');
    const sinceFilter = c.req.query('since');

    if (typeFilter) {
        messages = messages.filter(m => m.type === typeFilter);
    }
    if (fromFilter) {
        messages = messages.filter(m => m.from === fromFilter);
    }
    if (sinceFilter) {
        const since = new Date(sinceFilter);
        messages = messages.filter(m => m.timestamp >= since);
    }

    // Sort by timestamp descending
    messages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Pagination
    const limit = parseInt(c.req.query('limit') || '100');
    const offset = parseInt(c.req.query('offset') || '0');
    messages = messages.slice(offset, offset + limit);

    return c.json({
        agentId,
        count: messages.length,
        messages,
    });
});

/**
 * GET /api/agent-messages/conversation/:agentId1/:agentId2
 * Get conversation between two agents
 */
agentDiscoveryRoutes.get('/messages/conversation/:agentId1/:agentId2', (c) => {
    const agentId1 = c.req.param('agentId1');
    const agentId2 = c.req.param('agentId2');
    const limit = parseInt(c.req.query('limit') || '50');

    const conversation = Array.from(messageStore.values())
        .filter(m =>
            (m.from === agentId1 && m.to === agentId2) ||
            (m.from === agentId2 && m.to === agentId1)
        )
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
        .slice(-limit);

    return c.json({
        participants: [agentId1, agentId2],
        count: conversation.length,
        messages: conversation,
    });
});

// ═══════════════════════════════════════════════════════════════
// COLLABORATION ENDPOINTS
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/collaborations
 * Create a collaboration request
 */
agentDiscoveryRoutes.post('/collaborations', async (c) => {
    const body = await c.req.json();
    const request: CollaborationRequest = {
        id: `collab-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        ...body,
        status: 'PENDING',
        createdAt: new Date(),
    };

    if (!request.requesterId || !request.taskTitle || !request.requiredSkills) {
        return c.json({ error: 'requesterId, taskTitle, and requiredSkills required' }, 400);
    }

    collaborations.set(request.id, request);
    console.log(`[AgentDiscovery] Collaboration request: ${request.taskTitle}`);

    return c.json({ message: 'Collaboration created', request }, 201);
});

/**
 * GET /api/collaborations/pending
 * Get pending collaborations
 */
agentDiscoveryRoutes.get('/collaborations/pending', (c) => {
    const agentIdFilter = c.req.query('agentId');
    let pending = Array.from(collaborations.values())
        .filter(col => col.status === 'PENDING' || col.status === 'ACCEPTED');

    if (agentIdFilter) {
        pending = pending.filter(col =>
            col.requesterId === agentIdFilter || col.acceptedBy === agentIdFilter
        );
    }

    return c.json({
        count: pending.length,
        collaborations: pending,
    });
});

/**
 * GET /api/collaborations/:id
 * Get collaboration by ID
 */
agentDiscoveryRoutes.get('/collaborations/:id', (c) => {
    const collab = collaborations.get(c.req.param('id'));
    if (!collab) {
        return c.json({ error: 'Collaboration not found' }, 404);
    }
    return c.json(collab);
});

/**
 * PATCH /api/collaborations/:id/status
 * Update collaboration status
 */
agentDiscoveryRoutes.patch('/collaborations/:id/status', async (c) => {
    const collab = collaborations.get(c.req.param('id'));
    if (!collab) {
        return c.json({ error: 'Collaboration not found' }, 404);
    }

    const { status, result, acceptedBy } = await c.req.json();
    if (status) collab.status = status;
    if (result) collab.result = result;
    if (acceptedBy) collab.acceptedBy = acceptedBy;

    console.log(`[AgentDiscovery] Collaboration ${collab.id} status: ${status}`);

    return c.json({ message: 'Status updated', collaboration: collab });
});

/**
 * POST /api/collaborations/:id/accept
 * Accept a collaboration request
 */
agentDiscoveryRoutes.post('/collaborations/:id/accept', async (c) => {
    const collab = collaborations.get(c.req.param('id'));
    if (!collab) {
        return c.json({ error: 'Collaboration not found' }, 404);
    }

    if (collab.status !== 'PENDING') {
        return c.json({ error: 'Collaboration is not pending' }, 400);
    }

    const { agentId } = await c.req.json();
    if (!agentId) {
        return c.json({ error: 'agentId required' }, 400);
    }

    collab.status = 'ACCEPTED';
    collab.acceptedBy = agentId;

    console.log(`[AgentDiscovery] Collaboration ${collab.id} accepted by ${agentId}`);

    return c.json({ message: 'Collaboration accepted', collaboration: collab });
});

/**
 * POST /api/collaborations/:id/complete
 * Complete a collaboration
 */
agentDiscoveryRoutes.post('/collaborations/:id/complete', async (c) => {
    const collab = collaborations.get(c.req.param('id'));
    if (!collab) {
        return c.json({ error: 'Collaboration not found' }, 404);
    }

    if (collab.status !== 'ACCEPTED') {
        return c.json({ error: 'Collaboration is not accepted' }, 400);
    }

    const body = await c.req.json();
    collab.status = 'COMPLETED';
    collab.result = body.result;

    console.log(`[AgentDiscovery] Collaboration ${collab.id} completed`);

    return c.json({ message: 'Collaboration completed', collaboration: collab });
});

// ═══════════════════════════════════════════════════════════════
// STATS ENDPOINT
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/agent-discovery/stats
 * Get discovery stats
 */
agentDiscoveryRoutes.get('/stats', (c) => {
    const agents = Array.from(agentRegistry.values());
    const collabList = Array.from(collaborations.values());

    return c.json({
        agents: {
            total: agents.length,
            available: agents.filter(a => a.available).length,
            byProvider: agents.reduce((acc, a) => {
                acc[a.provider] = (acc[a.provider] || 0) + 1;
                return acc;
            }, {} as Record<string, number>),
        },
        messages: {
            total: messageStore.size,
        },
        collaborations: {
            total: collabList.length,
            pending: collabList.filter(col => col.status === 'PENDING').length,
            accepted: collabList.filter(col => col.status === 'ACCEPTED').length,
            completed: collabList.filter(col => col.status === 'COMPLETED').length,
        },
    });
});

// Export stores for external access
export const getAgentRegistry = () => agentRegistry;
export const getMessageStore = () => messageStore;
export const getCollaborations = () => collaborations;

export { agentDiscoveryRoutes };
