/**
 * Agent Coordinator for TrustBot
 *
 * Central hub for agent-to-agent communication and collaboration.
 * Handles message routing, agent discovery, and task delegation.
 */

import {
    AgentMessage,
    AgentCapability,
    CollaborationRequest,
    CollaborationResult,
    ConversationThread,
    CoordinatorEvent,
    MessageHandler,
    CollaborationHandler,
    EventHandler,
    createMessage,
    generateMessageId,
} from './agent-protocol.js';

interface RegisteredAgent {
    capability: AgentCapability;
    messageHandler: MessageHandler;
    collaborationHandler?: CollaborationHandler;
    inbox: AgentMessage[];
}

export class AgentCoordinator {
    private agents: Map<string, RegisteredAgent> = new Map();
    private messageQueue: AgentMessage[] = [];
    private collaborationRequests: Map<string, CollaborationRequest> = new Map();
    private threads: Map<string, ConversationThread> = new Map();
    private eventListeners: EventHandler[] = [];
    private isRunning: boolean = false;

    constructor() {
        console.log('🎯 Agent Coordinator initialized');
    }

    /**
     * Register an agent with the coordinator
     */
    registerAgent(
        capability: AgentCapability,
        messageHandler: MessageHandler,
        collaborationHandler?: CollaborationHandler
    ): void {
        this.agents.set(capability.agentId, {
            capability,
            messageHandler,
            collaborationHandler,
            inbox: [],
        });

        console.log(`   📝 Registered: ${capability.agentName} (${capability.provider})`);
        console.log(`      Skills: ${capability.skills.join(', ')}`);

        this.emitEvent({
            type: 'AGENT_JOINED',
            agent: capability,
        });
    }

    /**
     * Unregister an agent
     */
    unregisterAgent(agentId: string): void {
        const agent = this.agents.get(agentId);
        if (agent) {
            this.agents.delete(agentId);
            console.log(`   🚪 Unregistered: ${agent.capability.agentName}`);
            this.emitEvent({
                type: 'AGENT_LEFT',
                agentId,
            });
        }
    }

    /**
     * Send a message from one agent to another
     */
    async sendMessage(message: AgentMessage): Promise<boolean> {
        console.log(`\n📨 Message: ${message.from} → ${message.to}`);
        console.log(`   Type: ${message.type}`);
        console.log(`   Subject: ${message.subject}`);

        if (message.to === 'ALL') {
            // Broadcast to all agents
            const promises = Array.from(this.agents.entries())
                .filter(([id]) => id !== message.from)
                .map(([_, agent]) => this.deliverMessage(agent, message));
            await Promise.all(promises);
            this.emitEvent({ type: 'BROADCAST', message });
            return true;
        }

        const recipient = this.agents.get(message.to);
        if (!recipient) {
            console.log(`   ❌ Recipient not found: ${message.to}`);
            return false;
        }

        await this.deliverMessage(recipient, message);
        return true;
    }

    /**
     * Deliver a message to an agent
     */
    private async deliverMessage(agent: RegisteredAgent, message: AgentMessage): Promise<void> {
        agent.inbox.push(message);
        this.emitEvent({ type: 'MESSAGE_RECEIVED', message });

        try {
            await agent.messageHandler(message);
            console.log(`   ✅ Delivered to ${agent.capability.agentName}`);
        } catch (error) {
            console.error(`   ❌ Delivery failed: ${error}`);
        }
    }

    /**
     * Request collaboration from agents with specific skills
     */
    async requestCollaboration(request: CollaborationRequest): Promise<string | null> {
        console.log(`\n🤝 Collaboration Request: ${request.taskTitle}`);
        console.log(`   From: ${request.requesterName}`);
        console.log(`   Required Skills: ${request.requiredSkills.join(', ')}`);

        this.collaborationRequests.set(request.id, request);
        this.emitEvent({ type: 'COLLABORATION_REQUEST', request });

        // Find agents with matching skills
        const candidates = this.findAgentsWithSkills(request.requiredSkills, request.requesterId);

        if (candidates.length === 0) {
            console.log('   ❌ No suitable agents found');
            request.status = 'REJECTED';
            return null;
        }

        console.log(`   Found ${candidates.length} candidate(s):`);
        candidates.forEach(c => console.log(`      - ${c.capability.agentName}`));

        // Ask candidates if they can help (in order of best match)
        for (const candidate of candidates) {
            if (candidate.collaborationHandler) {
                const accepted = await candidate.collaborationHandler(request);
                if (accepted) {
                    request.status = 'ACCEPTED';
                    request.acceptedBy = candidate.capability.agentId;
                    console.log(`   ✅ Accepted by ${candidate.capability.agentName}`);
                    this.emitEvent({
                        type: 'COLLABORATION_ACCEPTED',
                        requestId: request.id,
                        acceptedBy: candidate.capability.agentId,
                    });
                    return candidate.capability.agentId;
                }
            }
        }

        console.log('   ❌ No agent accepted the request');
        request.status = 'REJECTED';
        return null;
    }

    /**
     * Complete a collaboration request
     */
    completeCollaboration(requestId: string, result: CollaborationResult): void {
        const request = this.collaborationRequests.get(requestId);
        if (request) {
            request.status = 'COMPLETED';
            request.result = result;
            console.log(`\n✨ Collaboration completed: ${request.taskTitle}`);
            console.log(`   Success: ${result.success}`);
            console.log(`   Summary: ${result.summary}`);
            this.emitEvent({
                type: 'COLLABORATION_COMPLETED',
                requestId,
                result,
            });
        }
    }

    /**
     * Find agents with specific skills
     */
    findAgentsWithSkills(requiredSkills: string[], excludeId?: string): RegisteredAgent[] {
        const candidates: Array<{ agent: RegisteredAgent; matchScore: number }> = [];

        for (const [id, agent] of this.agents) {
            if (id === excludeId) continue;
            if (!agent.capability.available) continue;

            // Calculate skill match score
            const matchingSkills = requiredSkills.filter(skill =>
                agent.capability.skills.includes(skill) ||
                agent.capability.capabilities.includes(skill)
            );
            const matchScore = matchingSkills.length / requiredSkills.length;

            if (matchScore > 0) {
                // Factor in current load (prefer less busy agents)
                const loadFactor = 1 - (agent.capability.currentLoad / 100);
                const finalScore = matchScore * 0.7 + loadFactor * 0.3;
                candidates.push({ agent, matchScore: finalScore });
            }
        }

        // Sort by match score descending
        return candidates
            .sort((a, b) => b.matchScore - a.matchScore)
            .map(c => c.agent);
    }

    /**
     * Get all registered agents
     */
    getAgents(): AgentCapability[] {
        return Array.from(this.agents.values()).map(a => a.capability);
    }

    /**
     * Get agent by ID
     */
    getAgent(agentId: string): AgentCapability | undefined {
        return this.agents.get(agentId)?.capability;
    }

    /**
     * Create a conversation thread
     */
    createThread(participants: string[], topic: string): ConversationThread {
        const thread: ConversationThread = {
            id: `thread-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            participants,
            topic,
            messages: [],
            status: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.threads.set(thread.id, thread);
        return thread;
    }

    /**
     * Add message to a thread
     */
    async addToThread(threadId: string, message: AgentMessage): Promise<void> {
        const thread = this.threads.get(threadId);
        if (thread) {
            thread.messages.push(message);
            thread.updatedAt = new Date();

            // Deliver to all thread participants
            for (const participantId of thread.participants) {
                if (participantId !== message.from) {
                    const participant = this.agents.get(participantId);
                    if (participant) {
                        await this.deliverMessage(participant, message);
                    }
                }
            }
        }
    }

    /**
     * Subscribe to coordinator events
     */
    addEventListener(handler: EventHandler): void {
        this.eventListeners.push(handler);
    }

    /**
     * Remove event listener
     */
    removeEventListener(handler: EventHandler): void {
        const index = this.eventListeners.indexOf(handler);
        if (index > -1) {
            this.eventListeners.splice(index, 1);
        }
    }

    /**
     * Emit an event to all listeners
     */
    private emitEvent(event: CoordinatorEvent): void {
        for (const listener of this.eventListeners) {
            try {
                listener(event);
            } catch (error) {
                console.error('Event listener error:', error);
            }
        }
    }

    /**
     * Get coordinator status
     */
    getStatus(): {
        agentCount: number;
        pendingMessages: number;
        activeCollaborations: number;
        activeThreads: number;
    } {
        return {
            agentCount: this.agents.size,
            pendingMessages: Array.from(this.agents.values())
                .reduce((sum, a) => sum + a.inbox.length, 0),
            activeCollaborations: Array.from(this.collaborationRequests.values())
                .filter(r => r.status === 'PENDING' || r.status === 'ACCEPTED').length,
            activeThreads: Array.from(this.threads.values())
                .filter(t => t.status === 'ACTIVE').length,
        };
    }

    /**
     * Print coordinator status
     */
    printStatus(): void {
        const status = this.getStatus();
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('                 AGENT COORDINATOR STATUS');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log(`   Registered Agents:      ${status.agentCount}`);
        console.log(`   Pending Messages:       ${status.pendingMessages}`);
        console.log(`   Active Collaborations:  ${status.activeCollaborations}`);
        console.log(`   Active Threads:         ${status.activeThreads}`);
        console.log('───────────────────────────────────────────────────────────────');

        if (this.agents.size > 0) {
            console.log('   AGENTS:');
            for (const [id, agent] of this.agents) {
                const cap = agent.capability;
                const loadBar = '█'.repeat(Math.floor(cap.currentLoad / 10)) +
                               '░'.repeat(10 - Math.floor(cap.currentLoad / 10));
                console.log(`   • ${cap.agentName} (${cap.provider})`);
                console.log(`     Load: [${loadBar}] ${cap.currentLoad}%`);
                console.log(`     Skills: ${cap.skills.slice(0, 3).join(', ')}${cap.skills.length > 3 ? '...' : ''}`);
            }
        }
        console.log('═══════════════════════════════════════════════════════════════\n');
    }
}

// Singleton instance for global coordination
let coordinatorInstance: AgentCoordinator | null = null;

export function getCoordinator(): AgentCoordinator {
    if (!coordinatorInstance) {
        coordinatorInstance = new AgentCoordinator();
    }
    return coordinatorInstance;
}

export function resetCoordinator(): void {
    coordinatorInstance = null;
}
