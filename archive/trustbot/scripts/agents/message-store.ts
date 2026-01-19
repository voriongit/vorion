/**
 * Persistent Message Store for Agent Communication
 *
 * Provides durable storage for agent messages, collaboration requests,
 * and conversation threads.
 */

import {
    AgentMessage,
    AgentCapability,
    CollaborationRequest,
    ConversationThread,
} from './agent-protocol.js';

export interface MessageStore {
    // Messages
    saveMessage(message: AgentMessage): Promise<void>;
    getMessages(agentId: string, options?: MessageQueryOptions): Promise<AgentMessage[]>;
    getMessageById(id: string): Promise<AgentMessage | null>;
    getConversation(agentId1: string, agentId2: string, limit?: number): Promise<AgentMessage[]>;

    // Collaboration
    saveCollaboration(request: CollaborationRequest): Promise<void>;
    getCollaboration(id: string): Promise<CollaborationRequest | null>;
    getPendingCollaborations(agentId?: string): Promise<CollaborationRequest[]>;
    updateCollaborationStatus(id: string, status: CollaborationRequest['status'], result?: CollaborationRequest['result']): Promise<void>;

    // Agents
    registerAgent(capability: AgentCapability): Promise<void>;
    unregisterAgent(agentId: string): Promise<void>;
    getAgent(agentId: string): Promise<AgentCapability | null>;
    getAllAgents(): Promise<AgentCapability[]>;
    findAgentsBySkills(skills: string[]): Promise<AgentCapability[]>;
    updateAgentLoad(agentId: string, load: number): Promise<void>;

    // Threads
    saveThread(thread: ConversationThread): Promise<void>;
    getThread(threadId: string): Promise<ConversationThread | null>;
    getAgentThreads(agentId: string): Promise<ConversationThread[]>;

    // Cleanup
    pruneOldMessages(olderThan: Date): Promise<number>;
}

export interface MessageQueryOptions {
    limit?: number;
    offset?: number;
    type?: string;
    since?: Date;
    until?: Date;
    from?: string;
}

/**
 * In-Memory Message Store (for development/testing)
 */
export class InMemoryMessageStore implements MessageStore {
    private messages: Map<string, AgentMessage> = new Map();
    private collaborations: Map<string, CollaborationRequest> = new Map();
    private agents: Map<string, AgentCapability> = new Map();
    private threads: Map<string, ConversationThread> = new Map();
    private agentMessages: Map<string, string[]> = new Map(); // agentId -> messageIds

    async saveMessage(message: AgentMessage): Promise<void> {
        this.messages.set(message.id, message);

        // Index by recipient
        const recipientMessages = this.agentMessages.get(message.to as string) || [];
        recipientMessages.push(message.id);
        this.agentMessages.set(message.to as string, recipientMessages);

        // Index by sender
        const senderMessages = this.agentMessages.get(message.from) || [];
        senderMessages.push(message.id);
        this.agentMessages.set(message.from, senderMessages);
    }

    async getMessages(agentId: string, options?: MessageQueryOptions): Promise<AgentMessage[]> {
        const messageIds = this.agentMessages.get(agentId) || [];
        let messages = messageIds
            .map(id => this.messages.get(id))
            .filter((m): m is AgentMessage => m !== undefined);

        // Apply filters
        if (options?.type) {
            messages = messages.filter(m => m.type === options.type);
        }
        if (options?.since) {
            messages = messages.filter(m => m.timestamp >= options.since!);
        }
        if (options?.until) {
            messages = messages.filter(m => m.timestamp <= options.until!);
        }
        if (options?.from) {
            messages = messages.filter(m => m.from === options.from);
        }

        // Sort by timestamp descending
        messages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        // Apply pagination
        const offset = options?.offset || 0;
        const limit = options?.limit || 100;
        return messages.slice(offset, offset + limit);
    }

    async getMessageById(id: string): Promise<AgentMessage | null> {
        return this.messages.get(id) || null;
    }

    async getConversation(agentId1: string, agentId2: string, limit = 50): Promise<AgentMessage[]> {
        const allMessages = Array.from(this.messages.values());
        const conversation = allMessages.filter(m =>
            (m.from === agentId1 && m.to === agentId2) ||
            (m.from === agentId2 && m.to === agentId1)
        );
        conversation.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        return conversation.slice(-limit);
    }

    async saveCollaboration(request: CollaborationRequest): Promise<void> {
        this.collaborations.set(request.id, request);
    }

    async getCollaboration(id: string): Promise<CollaborationRequest | null> {
        return this.collaborations.get(id) || null;
    }

    async getPendingCollaborations(agentId?: string): Promise<CollaborationRequest[]> {
        const pending = Array.from(this.collaborations.values())
            .filter(c => c.status === 'PENDING' || c.status === 'ACCEPTED');

        if (agentId) {
            return pending.filter(c => c.requesterId === agentId || c.acceptedBy === agentId);
        }
        return pending;
    }

    async updateCollaborationStatus(
        id: string,
        status: CollaborationRequest['status'],
        result?: CollaborationRequest['result']
    ): Promise<void> {
        const collab = this.collaborations.get(id);
        if (collab) {
            collab.status = status;
            if (result) {
                collab.result = result;
            }
        }
    }

    async registerAgent(capability: AgentCapability): Promise<void> {
        this.agents.set(capability.agentId, capability);
    }

    async unregisterAgent(agentId: string): Promise<void> {
        this.agents.delete(agentId);
    }

    async getAgent(agentId: string): Promise<AgentCapability | null> {
        return this.agents.get(agentId) || null;
    }

    async getAllAgents(): Promise<AgentCapability[]> {
        return Array.from(this.agents.values());
    }

    async findAgentsBySkills(skills: string[]): Promise<AgentCapability[]> {
        return Array.from(this.agents.values()).filter(agent =>
            skills.some(skill =>
                agent.skills.includes(skill) || agent.capabilities.includes(skill)
            )
        );
    }

    async updateAgentLoad(agentId: string, load: number): Promise<void> {
        const agent = this.agents.get(agentId);
        if (agent) {
            agent.currentLoad = load;
            agent.available = load < 80;
        }
    }

    async saveThread(thread: ConversationThread): Promise<void> {
        this.threads.set(thread.id, thread);
    }

    async getThread(threadId: string): Promise<ConversationThread | null> {
        return this.threads.get(threadId) || null;
    }

    async getAgentThreads(agentId: string): Promise<ConversationThread[]> {
        return Array.from(this.threads.values())
            .filter(t => t.participants.includes(agentId));
    }

    async pruneOldMessages(olderThan: Date): Promise<number> {
        let pruned = 0;
        for (const [id, message] of this.messages) {
            if (message.timestamp < olderThan) {
                this.messages.delete(id);
                pruned++;
            }
        }
        return pruned;
    }

    // Stats
    getStats(): {
        messages: number;
        collaborations: number;
        agents: number;
        threads: number;
    } {
        return {
            messages: this.messages.size,
            collaborations: this.collaborations.size,
            agents: this.agents.size,
            threads: this.threads.size,
        };
    }
}

/**
 * API-backed Message Store (connects to TrustBot API)
 */
export class APIMessageStore implements MessageStore {
    private apiBaseUrl: string;
    private cache: InMemoryMessageStore;

    constructor(apiBaseUrl?: string) {
        this.apiBaseUrl = apiBaseUrl || process.env.TRUSTBOT_API_URL || 'https://trustbot-api.fly.dev';
        this.cache = new InMemoryMessageStore();
    }

    private async apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
        const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${await response.text()}`);
        }

        return response.json();
    }

    async saveMessage(message: AgentMessage): Promise<void> {
        // Save to cache first for immediate availability
        await this.cache.saveMessage(message);

        // Persist to API
        try {
            await this.apiCall('/api/agent-messages', {
                method: 'POST',
                body: JSON.stringify(message),
            });
        } catch (error) {
            console.warn('Failed to persist message to API:', error);
            // Message is still in cache, will be synced later
        }
    }

    async getMessages(agentId: string, options?: MessageQueryOptions): Promise<AgentMessage[]> {
        try {
            const params = new URLSearchParams();
            if (options?.limit) params.set('limit', options.limit.toString());
            if (options?.offset) params.set('offset', options.offset.toString());
            if (options?.type) params.set('type', options.type);
            if (options?.since) params.set('since', options.since.toISOString());

            const messages = await this.apiCall<AgentMessage[]>(
                `/api/agent-messages/${agentId}?${params}`
            );
            return messages;
        } catch {
            // Fallback to cache
            return this.cache.getMessages(agentId, options);
        }
    }

    async getMessageById(id: string): Promise<AgentMessage | null> {
        // Try cache first
        const cached = await this.cache.getMessageById(id);
        if (cached) return cached;

        try {
            return await this.apiCall<AgentMessage>(`/api/agent-messages/by-id/${id}`);
        } catch {
            return null;
        }
    }

    async getConversation(agentId1: string, agentId2: string, limit?: number): Promise<AgentMessage[]> {
        try {
            return await this.apiCall<AgentMessage[]>(
                `/api/agent-messages/conversation/${agentId1}/${agentId2}?limit=${limit || 50}`
            );
        } catch {
            return this.cache.getConversation(agentId1, agentId2, limit);
        }
    }

    async saveCollaboration(request: CollaborationRequest): Promise<void> {
        await this.cache.saveCollaboration(request);
        try {
            await this.apiCall('/api/collaborations', {
                method: 'POST',
                body: JSON.stringify(request),
            });
        } catch (error) {
            console.warn('Failed to persist collaboration to API:', error);
        }
    }

    async getCollaboration(id: string): Promise<CollaborationRequest | null> {
        const cached = await this.cache.getCollaboration(id);
        if (cached) return cached;

        try {
            return await this.apiCall<CollaborationRequest>(`/api/collaborations/${id}`);
        } catch {
            return null;
        }
    }

    async getPendingCollaborations(agentId?: string): Promise<CollaborationRequest[]> {
        try {
            const endpoint = agentId
                ? `/api/collaborations/pending?agentId=${agentId}`
                : '/api/collaborations/pending';
            return await this.apiCall<CollaborationRequest[]>(endpoint);
        } catch {
            return this.cache.getPendingCollaborations(agentId);
        }
    }

    async updateCollaborationStatus(
        id: string,
        status: CollaborationRequest['status'],
        result?: CollaborationRequest['result']
    ): Promise<void> {
        await this.cache.updateCollaborationStatus(id, status, result);
        try {
            await this.apiCall(`/api/collaborations/${id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status, result }),
            });
        } catch (error) {
            console.warn('Failed to update collaboration status:', error);
        }
    }

    async registerAgent(capability: AgentCapability): Promise<void> {
        await this.cache.registerAgent(capability);
        try {
            await this.apiCall('/api/agent-registry', {
                method: 'POST',
                body: JSON.stringify(capability),
            });
        } catch (error) {
            console.warn('Failed to register agent with API:', error);
        }
    }

    async unregisterAgent(agentId: string): Promise<void> {
        await this.cache.unregisterAgent(agentId);
        try {
            await this.apiCall(`/api/agent-registry/${agentId}`, {
                method: 'DELETE',
            });
        } catch (error) {
            console.warn('Failed to unregister agent:', error);
        }
    }

    async getAgent(agentId: string): Promise<AgentCapability | null> {
        const cached = await this.cache.getAgent(agentId);
        if (cached) return cached;

        try {
            return await this.apiCall<AgentCapability>(`/api/agent-registry/${agentId}`);
        } catch {
            return null;
        }
    }

    async getAllAgents(): Promise<AgentCapability[]> {
        try {
            return await this.apiCall<AgentCapability[]>('/api/agent-registry');
        } catch {
            return this.cache.getAllAgents();
        }
    }

    async findAgentsBySkills(skills: string[]): Promise<AgentCapability[]> {
        try {
            return await this.apiCall<AgentCapability[]>(
                `/api/agent-registry/by-skills?skills=${skills.join(',')}`
            );
        } catch {
            return this.cache.findAgentsBySkills(skills);
        }
    }

    async updateAgentLoad(agentId: string, load: number): Promise<void> {
        await this.cache.updateAgentLoad(agentId, load);
        try {
            await this.apiCall(`/api/agent-registry/${agentId}/load`, {
                method: 'PATCH',
                body: JSON.stringify({ load }),
            });
        } catch (error) {
            console.warn('Failed to update agent load:', error);
        }
    }

    async saveThread(thread: ConversationThread): Promise<void> {
        await this.cache.saveThread(thread);
        try {
            await this.apiCall('/api/agent-threads', {
                method: 'POST',
                body: JSON.stringify(thread),
            });
        } catch (error) {
            console.warn('Failed to save thread:', error);
        }
    }

    async getThread(threadId: string): Promise<ConversationThread | null> {
        const cached = await this.cache.getThread(threadId);
        if (cached) return cached;

        try {
            return await this.apiCall<ConversationThread>(`/api/agent-threads/${threadId}`);
        } catch {
            return null;
        }
    }

    async getAgentThreads(agentId: string): Promise<ConversationThread[]> {
        try {
            return await this.apiCall<ConversationThread[]>(`/api/agent-threads/by-agent/${agentId}`);
        } catch {
            return this.cache.getAgentThreads(agentId);
        }
    }

    async pruneOldMessages(olderThan: Date): Promise<number> {
        try {
            const result = await this.apiCall<{ pruned: number }>('/api/agent-messages/prune', {
                method: 'POST',
                body: JSON.stringify({ olderThan: olderThan.toISOString() }),
            });
            return result.pruned;
        } catch {
            return this.cache.pruneOldMessages(olderThan);
        }
    }
}

// Singleton store instance
let storeInstance: MessageStore | null = null;

export function getMessageStore(useAPI = false): MessageStore {
    if (!storeInstance) {
        storeInstance = useAPI ? new APIMessageStore() : new InMemoryMessageStore();
    }
    return storeInstance;
}

export function setMessageStore(store: MessageStore): void {
    storeInstance = store;
}
