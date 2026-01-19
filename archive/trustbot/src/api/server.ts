/**
 * Backend API Server
 * 
 * Express server providing REST API and WebSocket for the Aurais system.
 * Connects the web UI to the core systems.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

const DATA_FILE = path.join(process.cwd(), 'aurais-data.json');

// ============================================================================
// Types
// ============================================================================

interface Agent {
    id: string;
    name: string;
    type: string;
    tier: number;
    status: 'IDLE' | 'WORKING' | 'IN_MEETING' | 'ERROR';
    location: { floor: string; room: string };
    trustScore: number;
    capabilities: string[];
    parentId: string | null;
    childIds: string[];
    createdAt: Date;
}

interface BlackboardEntry {
    id: string;
    type: string;
    title: string;
    content: unknown;
    author: string;
    priority: string;
    status: string;
    createdAt: Date;
}

interface SystemState {
    agents: Agent[];
    blackboard: BlackboardEntry[];
    hitlLevel: number;
    avgTrust: number;
    day: number;
    events: string[];
    settings: Record<string, any>;
}

interface ApprovalRequest {
    id: string;
    type: 'SPAWN' | 'DECISION' | 'STRATEGY';
    requestor: string;
    summary: string;
    details: unknown;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: Date;
}

// ============================================================================
// API Server
// ============================================================================

export class APIServer extends EventEmitter {
    private state: SystemState;
    private approvalQueue: ApprovalRequest[] = [];
    private server: http.Server | null = null;

    constructor() {
        super();

        // Initialize with demo state
        // Initialize state
        this.state = this.loadState();

        // Auto-save every 30s
        setInterval(() => this.saveState(), 30000);
    }

    private loadState(): SystemState {
        try {
            if (fs.existsSync(DATA_FILE)) {
                const data = fs.readFileSync(DATA_FILE, 'utf-8');
                const state = JSON.parse(data);
                // Hydrate dates
                state.agents.forEach((a: any) => a.createdAt = new Date(a.createdAt));
                state.blackboard.forEach((b: any) => {
                    b.createdAt = new Date(b.createdAt);
                    if (b.updatedAt) b.updatedAt = new Date(b.updatedAt);
                });
                return state;
            }
        } catch (e) {
            console.error('Failed to load state:', e);
        }
        return this.createInitialState();
    }

    private saveState(): void {
        try {
            fs.writeFileSync(DATA_FILE, JSON.stringify(this.state, null, 2));
        } catch (e) {
            console.error('Failed to save state:', e);
        }
    }

    private createInitialState(): SystemState {
        return {
            agents: [
                { id: 'exec-1', name: 'T5-EXECUTOR', type: 'EXECUTOR', tier: 5, status: 'IDLE', location: { floor: 'EXECUTIVE', room: 'EXECUTOR_OFFICE' }, trustScore: 1000, capabilities: ['strategic_decision', 'emergency_control'], parentId: null, childIds: [], createdAt: new Date() },
                { id: 'plan-1', name: 'T5-PLANNER', type: 'PLANNER', tier: 5, status: 'WORKING', location: { floor: 'EXECUTIVE', room: 'PLANNER_OFFICE' }, trustScore: 980, capabilities: ['goal_decomposition', 'hierarchy_design'], parentId: null, childIds: [], createdAt: new Date() },
                { id: 'valid-1', name: 'T5-VALIDATOR', type: 'VALIDATOR', tier: 5, status: 'IDLE', location: { floor: 'EXECUTIVE', room: 'VALIDATOR_OFFICE' }, trustScore: 990, capabilities: ['spawn_validation', 'trust_monitoring'], parentId: null, childIds: [], createdAt: new Date() },
                { id: 'evolve-1', name: 'T5-EVOLVER', type: 'EVOLVER', tier: 5, status: 'WORKING', location: { floor: 'EXECUTIVE', room: 'EVOLVER_OFFICE' }, trustScore: 970, capabilities: ['performance_analysis', 'capability_evolution'], parentId: null, childIds: [], createdAt: new Date() },
                { id: 'spawn-1', name: 'T5-SPAWNER', type: 'SPAWNER', tier: 5, status: 'IDLE', location: { floor: 'EXECUTIVE', room: 'SPAWNER_OFFICE' }, trustScore: 985, capabilities: ['spawn_agents', 'lifecycle_management'], parentId: null, childIds: ['listen-1', 'listen-2', 'asst-1'], createdAt: new Date() },
                { id: 'listen-1', name: 'DecisionListener', type: 'LISTENER', tier: 0, status: 'WORKING', location: { floor: 'OPERATIONS', room: 'LISTENER_STATION' }, trustScore: 40, capabilities: ['observe', 'log'], parentId: 'spawn-1', childIds: [], createdAt: new Date() },
                { id: 'listen-2', name: 'CommunicationListener', type: 'LISTENER', tier: 0, status: 'WORKING', location: { floor: 'OPERATIONS', room: 'LISTENER_STATION' }, trustScore: 40, capabilities: ['observe', 'log'], parentId: 'spawn-1', childIds: [], createdAt: new Date() },
                { id: 'asst-1', name: 'ResearchAssistant', type: 'WORKER', tier: 1, status: 'IDLE', location: { floor: 'OPERATIONS', room: 'ASSISTANT_DESK_A' }, trustScore: 80, capabilities: ['assist', 'research'], parentId: 'spawn-1', childIds: [], createdAt: new Date() },
            ],
            blackboard: [
                { id: 'bb-1', type: 'OBSERVATION', title: 'System Online', content: 'All T5 orchestrators initialized', author: 'exec-1', priority: 'HIGH', status: 'RESOLVED', createdAt: new Date() },
                { id: 'bb-2', type: 'TASK', title: 'Daily Strategic Review', content: 'Analyze yesterday\'s performance', author: 'plan-1', priority: 'HIGH', status: 'IN_PROGRESS', createdAt: new Date() },
                { id: 'bb-3', type: 'DECISION', title: 'Spawn 2 Assistants', content: 'Approved by T5-Validator', author: 'spawn-1', priority: 'MEDIUM', status: 'RESOLVED', createdAt: new Date() },
            ],
            hitlLevel: 100,
            avgTrust: 765,
            day: 1,
            events: [
                'System initialized',
                'T5 Orchestrators online',
                'Initial agents spawned',
            ],
            settings: { theme: 'dark', integrations: {} },
        };
    }

    // -------------------------------------------------------------------------
    // HTTP Server
    // -------------------------------------------------------------------------

    start(port: number = 3001): void {
        this.server = http.createServer((req, res) => {
            // CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }

            // Parse URL
            const url = new URL(req.url ?? '/', `http://localhost:${port}`);
            const path = url.pathname;

            // Route handling
            if (req.method === 'GET') {
                this.handleGet(path, res);
            } else if (req.method === 'POST') {
                let body = '';
                req.on('data', chunk => { body += chunk; });
                req.on('end', () => {
                    try {
                        const data = body ? JSON.parse(body) : {};
                        this.handlePost(path, data, res);
                    } catch {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid JSON' }));
                    }
                });
            } else {
                res.writeHead(405, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Method not allowed' }));
            }
        });

        this.server.listen(port, () => {
            console.log(`🌐 API Server running on http://localhost:${port}`);
        });

        // Start simulation loop
        this.startSimulation();
    }

    stop(): void {
        if (this.server) {
            this.server.close();
        }
    }

    // -------------------------------------------------------------------------
    // GET Routes
    // -------------------------------------------------------------------------

    private handleGet(path: string, res: http.ServerResponse): void {
        const json = (data: unknown) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
        };

        switch (path) {
            case '/api/state':
                json(this.state);
                break;

            case '/api/agents':
                json(this.state.agents);
                break;

            case '/api/blackboard':
                json(this.state.blackboard);
                break;

            case '/api/approvals':
                json(this.approvalQueue.filter(a => a.status === 'PENDING'));
                break;

                json({
                    hitlLevel: this.state.hitlLevel,
                    avgTrust: this.state.avgTrust,
                    agentCount: this.state.agents.length,
                    day: this.state.day,
                });
                break;

            case '/api/settings':
                json(this.state.settings);
                break;

            default:
                if (path.startsWith('/api/agent/')) {
                    const id = path.replace('/api/agent/', '');
                    const agent = this.state.agents.find(a => a.id === id);
                    if (agent) {
                        json(agent);
                    } else {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Agent not found' }));
                    }
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Not found' }));
                }
        }
    }

    // -------------------------------------------------------------------------
    // POST Routes
    // -------------------------------------------------------------------------

    private handlePost(path: string, data: Record<string, unknown>, res: http.ServerResponse): void {
        const json = (result: unknown, status = 200) => {
            res.writeHead(status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        };

        switch (path) {
            case '/api/spawn':
                const spawned = this.spawnAgent(data as { name: string; type: string; tier: number });
                json(spawned);
                break;

            case '/api/hitl':
                const level = data.level as number;
                if (typeof level === 'number' && level >= 0 && level <= 100) {
                    this.state.hitlLevel = level;
                    this.addEvent(`HITL level adjusted to ${level}%`);
                    json({ success: true, hitlLevel: level });
                } else {
                    json({ error: 'Invalid level' }, 400);
                }
                break;

            case '/api/command':
                const result = this.executeCommand(data as { target: string; command: string });
                json(result);
                break;

            case '/api/approve':
                const approval = this.processApproval(data as { id: string; approved: boolean });
                json(approval);
                break;

            case '/api/blackboard/post':
                const entry = this.postToBlackboard(data as { type: string; title: string; content: unknown; priority: string });
                json(entry);
                break;

            case '/api/advance-day':
                this.advanceDay();
                json({ success: true, day: this.state.day });
                break;

            case '/api/settings':
                this.handleSettings(data, res);
                break;

            // Mock Tool Endpoints
            case '/api/research':
            case '/api/code':
            case '/api/social':
            case '/api/business':
            case '/api/crm':
            case '/api/analytics':
                json({ success: true, message: 'Mock endpoint for local demo', data });
                break;

            default:
                json({ error: 'Not found' }, 404);
        }
    }

    // -------------------------------------------------------------------------
    // Actions
    // -------------------------------------------------------------------------

    private spawnAgent(params: { name: string; type: string; tier: number }): Agent {
        const agent: Agent = {
            id: `agent-${Date.now()}`,
            name: params.name,
            type: params.type,
            tier: params.tier,
            status: 'IDLE',
            location: { floor: 'OPERATIONS', room: 'SPAWN_BAY' },
            trustScore: params.tier * 50 + 50,
            capabilities: [],
            parentId: 'spawn-1',
            childIds: [],
            createdAt: new Date(),
        };

        this.state.agents.push(agent);
        this.addEvent(`Spawned ${params.name} (T${params.tier})`);
        this.emit('agent:spawned', agent);

        return agent;
    }

    private executeCommand(params: { target: string; command: string }): { success: boolean; message: string } {
        const agent = this.state.agents.find(a => a.id === params.target);
        if (!agent) {
            return { success: false, message: 'Agent not found' };
        }

        // Simulate command execution
        this.addEvent(`Command to ${agent.name}: "${params.command}"`);
        agent.status = 'WORKING';

        // Reset status after 5 seconds
        setTimeout(() => {
            agent.status = 'IDLE';
        }, 5000);

        return { success: true, message: `Command sent to ${agent.name}` };
    }

    private processApproval(params: { id: string; approved: boolean }): ApprovalRequest | null {
        const request = this.approvalQueue.find(a => a.id === params.id);
        if (!request) return null;

        request.status = params.approved ? 'APPROVED' : 'REJECTED';
        this.addEvent(`${request.type} ${request.status.toLowerCase()}: ${request.summary}`);

        return request;
    }

    private postToBlackboard(params: { type: string; title: string; content: unknown; priority: string }): BlackboardEntry {
        const entry: BlackboardEntry = {
            id: `bb-${Date.now()}`,
            type: params.type,
            title: params.title,
            content: params.content,
            author: 'ceo',
            priority: params.priority,
            status: 'OPEN',
            createdAt: new Date(),
        };

        this.state.blackboard.push(entry);
        this.emit('blackboard:post', entry);

        return entry;
    }

    private advanceDay(): void {
        this.state.day++;

        // Simulate daily changes
        this.state.avgTrust += Math.floor(Math.random() * 10) - 2;

        // Maybe spawn a request
        if (Math.random() > 0.5) {
            this.approvalQueue.push({
                id: `approval-${Date.now()}`,
                type: 'SPAWN',
                requestor: 'plan-1',
                summary: 'Request to spawn new Specialist',
                details: { tier: 2, purpose: 'Data analysis' },
                status: 'PENDING',
                createdAt: new Date(),
            });
        }

        this.addEvent(`Day ${this.state.day} begins`);
    }

    private addEvent(message: string): void {
        this.state.events.push(message);
        if (this.state.events.length > 50) {
            this.state.events = this.state.events.slice(-50);
        }
        this.emit('event', message);
        this.saveState(); // Save on event
    }

    private handleSettings(data: Record<string, unknown>, res: http.ServerResponse): void {
        const { category, key, value } = data;
        const json = (result: unknown) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        };

        if (category === 'integration') {
            if (!this.state.settings.integrations) this.state.settings.integrations = {};
            this.state.settings.integrations[key as string] = value;
            this.addEvent(`Integration updated: ${key}`);
        } else {
            // Generic setting
            this.state.settings[key as string] = value;
        }
        json({ success: true });
    }

    // -------------------------------------------------------------------------
    // Simulation
    // -------------------------------------------------------------------------

    private startSimulation(): void {
        // Randomly change agent statuses
        setInterval(() => {
            const agent = this.state.agents[Math.floor(Math.random() * this.state.agents.length)];
            if (agent && Math.random() > 0.7) {
                const statuses: Agent['status'][] = ['IDLE', 'WORKING'];
                agent.status = statuses[Math.floor(Math.random() * statuses.length)]!;
            }
        }, 5000);

        // Add random blackboard entries
        setInterval(() => {
            if (Math.random() > 0.8) {
                const types = ['OBSERVATION', 'TASK', 'DECISION'];
                const titles = [
                    'Performance metric updated',
                    'New pattern discovered',
                    'Task completed successfully',
                    'Agent collaboration initiated',
                ];

                this.postToBlackboard({
                    type: types[Math.floor(Math.random() * types.length)]!,
                    title: titles[Math.floor(Math.random() * titles.length)]!,
                    content: { timestamp: new Date() },
                    priority: 'MEDIUM',
                });
            }
        }, 10000);
    }
}

// Singleton export
export const apiServer = new APIServer();
