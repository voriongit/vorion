/**
 * T5-Spawner: Agent Factory
 * 
 * Creates all lower-tier agents. Embeds spawn instructions in child agents
 * so they can create their own children (T4 creates T3, T3 creates T2, etc.)
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseAgent } from '../agents/BaseAgent.js';
import type { AgentId, AgentLocation, AgentTier, Capability, SpawnRequest, SpawnResult } from '../types.js';
import { blackboard } from '../core/Blackboard.js';
import { trustEngine } from '../core/TrustEngine.js';

const SPAWNER_KNOWLEDGE = {
    role: 'Agent Factory',
    tier: 5,
    blueprintLibrary: {
        LISTENER: { tier: 0, trustBudget: 50, defaultCapabilities: ['observe', 'log', 'report'] },
        ASSISTANT: { tier: 1, trustBudget: 100, defaultCapabilities: ['assist', 'research', 'document'] },
        SPECIALIST: { tier: 2, trustBudget: 200, defaultCapabilities: ['execute', 'analyze', 'implement'] },
        TASK_ORCHESTRATOR: { tier: 3, trustBudget: 400, defaultCapabilities: ['coordinate', 'plan', 'delegate'] },
        DOMAIN_ORCHESTRATOR: { tier: 4, trustBudget: 600, defaultCapabilities: ['strategize', 'manage', 'govern'] },
    },
    spawnInstructions: {
        T4: 'T4 agents may spawn T3 Task Orchestrators for their domain',
        T3: 'T3 agents may spawn T2 Specialists for specific tasks',
        T2: 'T2 agents may spawn T1 Workers for basic execution',
        T1: 'T1 agents may spawn T0 Listeners for observation',
    },
};

interface SpawnedAgent {
    id: AgentId;
    name: string;
    tier: AgentTier;
    parentId: AgentId;
    capabilities: Capability[];
    spawnedAt: Date;
}

export class T5Spawner extends BaseAgent {
    private spawnedAgents: Map<AgentId, SpawnedAgent> = new Map();
    private spawnQueue: SpawnRequest[] = [];

    constructor() {
        super({
            name: 'T5-SPAWNER',
            type: 'SPAWNER',
            tier: 5,
            parentId: null,
            location: { floor: 'EXECUTIVE', room: 'SPAWNER_OFFICE' },
            capabilities: [
                { id: 'spawn_agents', name: 'Spawn Agents', description: 'Create new agents', requiredTier: 5 },
                { id: 'lifecycle_management', name: 'Lifecycle Management', description: 'Manage agent lifecycles', requiredTier: 5 },
                { id: 'blueprint_management', name: 'Blueprint Management', description: 'Manage agent templates', requiredTier: 5 },
            ],
        });
        this.metadata['knowledge'] = SPAWNER_KNOWLEDGE;
    }

    protected getDefaultLocation(): AgentLocation {
        return { floor: 'EXECUTIVE', room: 'SPAWNER_OFFICE' };
    }

    async initialize(): Promise<void> {
        await super.initialize();
        this.postToBlackboard({
            type: 'OBSERVATION',
            title: 'T5-SPAWNER Online',
            content: { message: 'Agent Factory initialized', blueprints: Object.keys(SPAWNER_KNOWLEDGE.blueprintLibrary) },
            priority: 'HIGH',
        });
    }

    async execute(): Promise<void> {
        while (this.status !== 'TERMINATED') {
            const requests = this.getPendingRequests();
            for (const req of requests) await this.handleRequest(req);
            await this.processSpawnQueue();
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    /**
     * Queue a spawn request
     */
    queueSpawn(request: SpawnRequest): string {
        this.spawnQueue.push(request);
        this.remember('SPAWN_QUEUED', { requestId: request.id, name: request.name });
        return request.id;
    }

    /**
     * Spawn a listener agent (T0) - first creation type
     */
    spawnListener(name: string, purpose: string): SpawnResult {
        const request: SpawnRequest = {
            id: uuidv4(),
            requestor: this.id,
            template: 'LISTENER',
            purpose,
            name,
            capabilities: [
                { id: 'observe', name: 'Observe', description: 'Observe and record', requiredTier: 0 },
                { id: 'log', name: 'Log', description: 'Log events', requiredTier: 0 },
                { id: 'report', name: 'Report', description: 'Generate reports', requiredTier: 0 },
            ],
            trustBudget: 50,
            constraints: [],
            priority: 'MEDIUM',
            requestedAt: new Date(),
        };
        return this.executeSpawn(request);
    }

    /**
     * Spawn an assistant agent (T1) - first creation type
     */
    spawnAssistant(name: string, purpose: string): SpawnResult {
        const request: SpawnRequest = {
            id: uuidv4(),
            requestor: this.id,
            template: 'WORKER',
            purpose,
            name,
            capabilities: [
                { id: 'assist', name: 'Assist', description: 'Assist higher-tier agents', requiredTier: 1 },
                { id: 'research', name: 'Research', description: 'Gather information', requiredTier: 1 },
                { id: 'document', name: 'Document', description: 'Create documentation', requiredTier: 1 },
            ],
            trustBudget: 100,
            constraints: [],
            priority: 'MEDIUM',
            requestedAt: new Date(),
        };
        return this.executeSpawn(request);
    }

    /**
     * Execute a spawn request
     */
    private executeSpawn(request: SpawnRequest): SpawnResult {
        // Validate with trust engine
        const validation = trustEngine.validateSpawn(request.requestor, {
            requestedTier: this.getTierFromTemplate(request.template),
            trustBudget: request.trustBudget,
            purpose: request.purpose,
        });

        if (!validation.isValid) {
            this.makeDecision(`Spawn rejected: ${request.name}`, validation.errors.join(', '));
            return { success: false, rejectionReason: validation.errors.join(', '), validationReport: validation };
        }

        // Create spawned agent record
        const spawnedAgent: SpawnedAgent = {
            id: uuidv4(),
            name: request.name,
            tier: this.getTierFromTemplate(request.template),
            parentId: request.requestor,
            capabilities: request.capabilities,
            spawnedAt: new Date(),
        };

        this.spawnedAgents.set(spawnedAgent.id, spawnedAgent);
        this.registerChild(spawnedAgent.id);

        // Create trust for new agent
        trustEngine.createTrust(spawnedAgent.id, {
            tier: spawnedAgent.tier,
            parentId: request.requestor,
        });

        this.postToBlackboard({
            type: 'OBSERVATION',
            title: `Agent Spawned: ${request.name}`,
            content: { agentId: spawnedAgent.id, tier: spawnedAgent.tier, purpose: request.purpose },
            priority: 'MEDIUM',
        });

        this.makeDecision(`Spawned ${request.name}`, `T${spawnedAgent.tier} agent for: ${request.purpose}`);

        return {
            success: true,
            trustAllocation: request.trustBudget,
            validationReport: validation,
            spawnedAt: new Date(),
        };
    }

    private getTierFromTemplate(template: string): AgentTier {
        const blueprint = SPAWNER_KNOWLEDGE.blueprintLibrary[template as keyof typeof SPAWNER_KNOWLEDGE.blueprintLibrary];
        return (blueprint?.tier ?? 1) as AgentTier;
    }

    private async processSpawnQueue(): Promise<void> {
        while (this.spawnQueue.length > 0) {
            const request = this.spawnQueue.shift()!;
            this.executeSpawn(request);
        }
    }

    /**
     * Get all spawned agents
     */
    getSpawnedAgents(): SpawnedAgent[] {
        return Array.from(this.spawnedAgents.values());
    }

    /**
     * Get agents by tier
     */
    getAgentsByTier(tier: AgentTier): SpawnedAgent[] {
        return Array.from(this.spawnedAgents.values()).filter(a => a.tier === tier);
    }

    private async handleRequest(msg: any): Promise<void> {
        switch (msg.subject) {
            case 'Spawn Request':
                const result = this.executeSpawn(msg.content as SpawnRequest);
                this.respond(msg.id, result);
                break;
            case 'Spawn Listener':
                const listener = this.spawnListener(msg.content.name, msg.content.purpose);
                this.respond(msg.id, listener);
                break;
            case 'Spawn Assistant':
                const assistant = this.spawnAssistant(msg.content.name, msg.content.purpose);
                this.respond(msg.id, assistant);
                break;
            case 'Get Spawned Agents':
                this.respond(msg.id, { agents: this.getSpawnedAgents() });
                break;
            default:
                this.respond(msg.id, { error: 'Unknown request' });
        }
    }
}
