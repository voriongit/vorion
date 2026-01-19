/**
 * MCP (Model Context Protocol) Server Endpoint
 *
 * Allows Claude Desktop, Cursor, and other MCP clients to interact
 * with the TrustBot agent swarm via standardized tool calls.
 *
 * MCP Tools:
 * - trustbot_get_state: Get current world state
 * - trustbot_list_agents: List all agents with filters
 * - trustbot_get_agent: Get specific agent details
 * - trustbot_create_task: Create a new task
 * - trustbot_list_tasks: List tasks with filters
 * - trustbot_delegate_task: Delegate task to another agent
 * - trustbot_spawn_agent: Spawn a new agent (requires CERTIFIED+)
 * - trustbot_send_message: Send inter-agent message
 * - trustbot_get_metrics: Get system metrics and trust distribution
 * - trustbot_run_tick: Manually trigger a tick cycle
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
    [TrustTier.UNTRUSTED]: { name: 'Untrusted', threshold: 0, canDelegate: false, canSpawn: false },
    [TrustTier.PROBATIONARY]: { name: 'Probationary', threshold: 200, canDelegate: false, canSpawn: false },
    [TrustTier.TRUSTED]: { name: 'Trusted', threshold: 400, canDelegate: false, canSpawn: false },
    [TrustTier.VERIFIED]: { name: 'Verified', threshold: 600, canDelegate: true, canSpawn: false },
    [TrustTier.CERTIFIED]: { name: 'Certified', threshold: 800, canDelegate: true, canSpawn: true },
    [TrustTier.ELITE]: { name: 'Elite', threshold: 950, canDelegate: true, canSpawn: true },
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

// ============================================================================
// MCP TOOLS DEFINITION
// ============================================================================

const MCP_TOOLS = {
    trustbot_get_state: {
        name: 'trustbot_get_state',
        description: 'Get the current TrustBot world state including all agents, tasks, and blackboard entries',
        inputSchema: {
            type: 'object',
            properties: {
                includeBlackboard: { type: 'boolean', description: 'Include blackboard entries', default: true },
                includeEvents: { type: 'boolean', description: 'Include recent events', default: true },
            },
        },
    },

    trustbot_list_agents: {
        name: 'trustbot_list_agents',
        description: 'List all agents in the TrustBot system with optional filtering',
        inputSchema: {
            type: 'object',
            properties: {
                status: { type: 'string', enum: ['IDLE', 'WORKING', 'IN_MEETING', 'ERROR', 'TERMINATED'], description: 'Filter by status' },
                minTrust: { type: 'number', description: 'Minimum trust score' },
                type: { type: 'string', description: 'Filter by agent type' },
            },
        },
    },

    trustbot_get_agent: {
        name: 'trustbot_get_agent',
        description: 'Get detailed information about a specific agent',
        inputSchema: {
            type: 'object',
            properties: {
                agentId: { type: 'string', description: 'The agent ID or name' },
            },
            required: ['agentId'],
        },
    },

    trustbot_create_task: {
        name: 'trustbot_create_task',
        description: 'Create a new task for agents to work on',
        inputSchema: {
            type: 'object',
            properties: {
                description: { type: 'string', description: 'Task description' },
                type: { type: 'string', enum: ['research', 'analysis', 'validation', 'execution', 'monitoring', 'strategy'], description: 'Task type' },
                priority: { type: 'string', enum: ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'], description: 'Priority level' },
                assignTo: { type: 'string', description: 'Optional: Assign to specific agent ID' },
            },
            required: ['description', 'type'],
        },
    },

    trustbot_list_tasks: {
        name: 'trustbot_list_tasks',
        description: 'List tasks with optional filtering',
        inputSchema: {
            type: 'object',
            properties: {
                status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'], description: 'Filter by status' },
                assignee: { type: 'string', description: 'Filter by assigned agent' },
                limit: { type: 'number', description: 'Max results', default: 20 },
            },
        },
    },

    trustbot_delegate_task: {
        name: 'trustbot_delegate_task',
        description: 'Delegate a task from one agent to another (requires VERIFIED+ tier)',
        inputSchema: {
            type: 'object',
            properties: {
                taskId: { type: 'string', description: 'The task ID to delegate' },
                fromAgentId: { type: 'string', description: 'Current assignee agent ID' },
                toAgentId: { type: 'string', description: 'Target agent ID' },
                reason: { type: 'string', description: 'Reason for delegation' },
            },
            required: ['taskId', 'fromAgentId', 'toAgentId'],
        },
    },

    trustbot_spawn_agent: {
        name: 'trustbot_spawn_agent',
        description: 'Spawn a new agent (requires CERTIFIED+ parent agent)',
        inputSchema: {
            type: 'object',
            properties: {
                parentAgentId: { type: 'string', description: 'Parent agent ID (must be CERTIFIED+)' },
                name: { type: 'string', description: 'New agent name' },
                type: { type: 'string', enum: ['EXECUTOR', 'PLANNER', 'VALIDATOR', 'EVOLVER', 'SPAWNER', 'LISTENER', 'WORKER'], description: 'Agent type' },
                purpose: { type: 'string', description: 'Agent purpose/description' },
            },
            required: ['parentAgentId', 'name', 'type'],
        },
    },

    trustbot_send_message: {
        name: 'trustbot_send_message',
        description: 'Send a message between agents or to the blackboard',
        inputSchema: {
            type: 'object',
            properties: {
                fromAgentId: { type: 'string', description: 'Sender agent ID' },
                toAgentId: { type: 'string', description: 'Recipient agent ID (or "blackboard" for public)' },
                content: { type: 'string', description: 'Message content' },
                type: { type: 'string', enum: ['OBSERVATION', 'DECISION', 'PROBLEM', 'SOLUTION'], description: 'Message type for blackboard' },
            },
            required: ['fromAgentId', 'content'],
        },
    },

    trustbot_get_metrics: {
        name: 'trustbot_get_metrics',
        description: 'Get system metrics including trust distribution and task statistics',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },

    trustbot_run_tick: {
        name: 'trustbot_run_tick',
        description: 'Manually trigger a tick cycle to process pending tasks',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
};

// ============================================================================
// TOOL HANDLERS
// ============================================================================

const toolHandlers = {
    async trustbot_get_state({ includeBlackboard = true, includeEvents = true }) {
        const state = await getSystemState();
        if (!state) return { error: 'System not initialized' };

        const result = {
            tick: state.tick || 0,
            agentCount: (state.agents || []).length,
            agents: (state.agents || []).map(a => ({
                id: a.id,
                name: a.name,
                type: a.type,
                status: a.status,
                trustScore: a.trustScore,
                tier: getTierName(a.trustScore || 0),
            })),
        };

        if (includeBlackboard) {
            result.blackboard = (state.blackboard || []).slice(0, 10);
        }
        if (includeEvents) {
            result.events = (state.events || []).slice(0, 10);
        }

        return result;
    },

    async trustbot_list_agents({ status, minTrust, type }) {
        const state = await getSystemState();
        if (!state) return { error: 'System not initialized' };

        let agents = state.agents || [];

        if (status) agents = agents.filter(a => a.status === status);
        if (minTrust) agents = agents.filter(a => (a.trustScore || 0) >= minTrust);
        if (type) agents = agents.filter(a => a.type === type);

        return {
            count: agents.length,
            agents: agents.map(a => ({
                id: a.id,
                name: a.name,
                type: a.type,
                status: a.status,
                trustScore: a.trustScore,
                tier: getTierName(a.trustScore || 0),
                canDelegate: TIER_CONFIG[getTierFromScore(a.trustScore || 0)]?.canDelegate,
                canSpawn: TIER_CONFIG[getTierFromScore(a.trustScore || 0)]?.canSpawn,
            })),
        };
    },

    async trustbot_get_agent({ agentId }) {
        const state = await getSystemState();
        if (!state) return { error: 'System not initialized' };

        const agent = (state.agents || []).find(a =>
            a.id === agentId || a.name.toLowerCase().includes(agentId.toLowerCase())
        );

        if (!agent) return { error: `Agent not found: ${agentId}` };

        const tier = getTierFromScore(agent.trustScore || 0);
        return {
            ...agent,
            tier: getTierName(agent.trustScore || 0),
            tierLevel: tier,
            canDelegate: TIER_CONFIG[tier]?.canDelegate,
            canSpawn: TIER_CONFIG[tier]?.canSpawn,
        };
    },

    async trustbot_create_task({ description, type, priority = 'NORMAL', assignTo }) {
        const state = await getSystemState();
        if (!state) return { error: 'System not initialized' };

        const task = {
            id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            description,
            type: type || 'research',
            priority,
            status: assignTo ? 'IN_PROGRESS' : 'PENDING',
            creator: 'MCP_CLIENT',
            assignee: assignTo || null,
            assigneeName: null,
            progress: 0,
            nextSteps: 'Awaiting assignment',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            currentDelegations: 0,
            maxDelegations: 2,
            delegationHistory: [],
        };

        if (assignTo) {
            const agent = (state.agents || []).find(a => a.id === assignTo);
            if (agent) {
                task.assigneeName = agent.name;
                task.nextSteps = `Assigned to ${agent.name}`;
            }
        }

        await saveTask(task);

        return { success: true, task };
    },

    async trustbot_list_tasks({ status, assignee, limit = 20 }) {
        let tasks = await getTasks();

        if (status) tasks = tasks.filter(t => t.status === status);
        if (assignee) tasks = tasks.filter(t => t.assignee === assignee);

        return {
            count: tasks.length,
            tasks: tasks.slice(0, limit).map(t => ({
                id: t.id,
                description: t.description?.slice(0, 50) + (t.description?.length > 50 ? '...' : ''),
                type: t.type,
                status: t.status,
                priority: t.priority,
                assignee: t.assigneeName || t.assignee,
                progress: t.progress,
                delegations: t.currentDelegations || 0,
            })),
        };
    },

    async trustbot_delegate_task({ taskId, fromAgentId, toAgentId, reason = 'Delegation requested' }) {
        const state = await getSystemState();
        if (!state) return { error: 'System not initialized' };

        const tasks = await getTasks();
        const task = tasks.find(t => t.id === taskId);
        if (!task) return { error: `Task not found: ${taskId}` };

        const fromAgent = (state.agents || []).find(a => a.id === fromAgentId);
        const toAgent = (state.agents || []).find(a => a.id === toAgentId);

        if (!fromAgent) return { error: `From agent not found: ${fromAgentId}` };
        if (!toAgent) return { error: `To agent not found: ${toAgentId}` };

        // Check delegation permission
        const fromTier = getTierFromScore(fromAgent.trustScore || 0);
        if (!TIER_CONFIG[fromTier]?.canDelegate) {
            return {
                error: `Agent ${fromAgent.name} (${getTierName(fromAgent.trustScore)}) cannot delegate - requires VERIFIED+ tier`,
            };
        }

        // Check max delegations
        if ((task.currentDelegations || 0) >= 2) {
            return { error: 'Max delegations (2) reached - task must be executed' };
        }

        // Perform delegation
        task.currentDelegations = (task.currentDelegations || 0) + 1;
        task.assignee = toAgent.id;
        task.assigneeName = toAgent.name;
        task.delegationHistory = task.delegationHistory || [];
        task.delegationHistory.push({
            from: fromAgent.id,
            fromName: fromAgent.name,
            to: toAgent.id,
            toName: toAgent.name,
            reason,
            timestamp: new Date().toISOString(),
        });
        task.updatedAt = new Date().toISOString();
        task.nextSteps = `Delegated to ${toAgent.name} (${task.currentDelegations}/2 delegations)`;

        await saveTask(task);

        // Update agent statuses
        const fromIdx = state.agents.findIndex(a => a.id === fromAgentId);
        const toIdx = state.agents.findIndex(a => a.id === toAgentId);
        if (fromIdx >= 0) state.agents[fromIdx].status = 'IDLE';
        if (toIdx >= 0) state.agents[toIdx].status = 'WORKING';

        // Add event
        state.events = state.events || [];
        state.events.unshift(`[${new Date().toLocaleTimeString()}] ${fromAgent.name} delegated to ${toAgent.name}: "${task.description?.slice(0, 30)}..."`);
        state.events = state.events.slice(0, 20);

        await saveSystemState(state);

        return {
            success: true,
            task: {
                id: task.id,
                status: task.status,
                assignee: task.assigneeName,
                delegations: task.currentDelegations,
                remainingDelegations: 2 - task.currentDelegations,
            },
        };
    },

    async trustbot_spawn_agent({ parentAgentId, name, type, purpose = 'General assistance' }) {
        const state = await getSystemState();
        if (!state) return { error: 'System not initialized' };

        const parent = (state.agents || []).find(a => a.id === parentAgentId);
        if (!parent) return { error: `Parent agent not found: ${parentAgentId}` };

        // Check spawn permission
        const parentTier = getTierFromScore(parent.trustScore || 0);
        if (!TIER_CONFIG[parentTier]?.canSpawn) {
            return {
                error: `Agent ${parent.name} (${getTierName(parent.trustScore)}) cannot spawn - requires CERTIFIED+ tier`,
            };
        }

        // Create new agent
        const newAgent = {
            id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            name,
            type,
            tier: 1, // Start at tier 1
            status: 'IDLE',
            location: { floor: 'WORKSPACE', room: 'spawn-room' },
            trustScore: 100, // Start with low trust
            capabilities: [],
            parentId: parent.id,
            childIds: [],
            createdAt: new Date().toISOString(),
        };

        // Update parent's childIds
        const parentIdx = state.agents.findIndex(a => a.id === parentAgentId);
        if (parentIdx >= 0) {
            state.agents[parentIdx].childIds = state.agents[parentIdx].childIds || [];
            state.agents[parentIdx].childIds.push(newAgent.id);
        }

        state.agents.push(newAgent);

        // Add event
        state.events = state.events || [];
        state.events.unshift(`[${new Date().toLocaleTimeString()}] ${parent.name} spawned new agent: ${name} (${type})`);
        state.events = state.events.slice(0, 20);

        await saveSystemState(state);

        return {
            success: true,
            agent: {
                id: newAgent.id,
                name: newAgent.name,
                type: newAgent.type,
                trustScore: newAgent.trustScore,
                tier: getTierName(newAgent.trustScore),
                parentId: parent.id,
                parentName: parent.name,
            },
        };
    },

    async trustbot_send_message({ fromAgentId, toAgentId, content, type = 'OBSERVATION' }) {
        const state = await getSystemState();
        if (!state) return { error: 'System not initialized' };

        const fromAgent = (state.agents || []).find(a => a.id === fromAgentId);
        if (!fromAgent) return { error: `Agent not found: ${fromAgentId}` };

        if (toAgentId === 'blackboard' || !toAgentId) {
            // Post to blackboard
            const entry = {
                id: `bb-${Date.now()}`,
                type,
                title: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
                content,
                author: fromAgent.id,
                authorName: fromAgent.name,
                priority: 'NORMAL',
                status: 'OPEN',
                createdAt: new Date().toISOString(),
                comments: [],
            };

            state.blackboard = state.blackboard || [];
            state.blackboard.unshift(entry);
            state.blackboard = state.blackboard.slice(0, 50);

            await saveSystemState(state);

            return { success: true, posted: 'blackboard', entry };
        } else {
            // Direct message (add to events for now)
            const toAgent = (state.agents || []).find(a => a.id === toAgentId);
            if (!toAgent) return { error: `Recipient agent not found: ${toAgentId}` };

            state.events = state.events || [];
            state.events.unshift(`[${new Date().toLocaleTimeString()}] ${fromAgent.name} → ${toAgent.name}: "${content.slice(0, 50)}..."`);
            state.events = state.events.slice(0, 20);

            await saveSystemState(state);

            return { success: true, posted: 'direct', from: fromAgent.name, to: toAgent.name };
        }
    },

    async trustbot_get_metrics() {
        const state = await getSystemState();
        const tasks = await getTasks();

        if (!state) return { error: 'System not initialized' };

        const agents = state.agents || [];

        // Trust distribution
        const trustDistribution = {
            untrusted: agents.filter(a => getTierFromScore(a.trustScore || 0) === TrustTier.UNTRUSTED).length,
            probationary: agents.filter(a => getTierFromScore(a.trustScore || 0) === TrustTier.PROBATIONARY).length,
            trusted: agents.filter(a => getTierFromScore(a.trustScore || 0) === TrustTier.TRUSTED).length,
            verified: agents.filter(a => getTierFromScore(a.trustScore || 0) === TrustTier.VERIFIED).length,
            certified: agents.filter(a => getTierFromScore(a.trustScore || 0) === TrustTier.CERTIFIED).length,
            elite: agents.filter(a => getTierFromScore(a.trustScore || 0) === TrustTier.ELITE).length,
        };

        // Task statistics
        const taskStats = {
            total: tasks.length,
            pending: tasks.filter(t => t.status === 'PENDING').length,
            inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
            completed: tasks.filter(t => t.status === 'COMPLETED').length,
            failed: tasks.filter(t => t.status === 'FAILED').length,
        };

        return {
            agents: {
                total: agents.length,
                byStatus: {
                    idle: agents.filter(a => a.status === 'IDLE').length,
                    working: agents.filter(a => a.status === 'WORKING').length,
                    inMeeting: agents.filter(a => a.status === 'IN_MEETING').length,
                },
                avgTrust: agents.length > 0
                    ? Math.round(agents.reduce((s, a) => s + (a.trustScore || 0), 0) / agents.length)
                    : 0,
                trustDistribution,
            },
            tasks: taskStats,
            blackboard: {
                total: (state.blackboard || []).length,
            },
        };
    },

    async trustbot_run_tick() {
        // Import tick handler dynamically to avoid circular deps
        const tickModule = await import('./tick.js');
        // The tick handler expects req/res, so we'll simulate it
        const mockReq = { method: 'POST' };
        const mockRes = {
            status: () => mockRes,
            json: (data) => data,
            end: () => {},
            setHeader: () => {},
        };

        try {
            await initStorage();
            const result = await tickModule.default(mockReq, mockRes);
            return result || { success: true, message: 'Tick executed' };
        } catch (e) {
            return { error: 'Tick failed', details: e.message };
        }
    },
};

// ============================================================================
// MCP ENDPOINT HANDLER
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

    // GET: Return tool definitions (for MCP clients to discover tools)
    if (req.method === 'GET') {
        return res.status(200).json({
            name: 'TrustBot MCP Server',
            version: '1.0.0',
            description: 'MCP interface for TrustBot agent orchestration system',
            tools: Object.values(MCP_TOOLS),
        });
    }

    // POST: Execute a tool
    if (req.method === 'POST') {
        const { tool, params = {} } = req.body;

        if (!tool) {
            return res.status(400).json({ error: 'Tool name required' });
        }

        const handler = toolHandlers[tool];
        if (!handler) {
            return res.status(404).json({
                error: `Unknown tool: ${tool}`,
                availableTools: Object.keys(MCP_TOOLS),
            });
        }

        try {
            const result = await handler(params);
            return res.status(200).json({ success: true, result });
        } catch (error) {
            return res.status(500).json({
                error: 'Tool execution failed',
                details: error.message,
            });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
