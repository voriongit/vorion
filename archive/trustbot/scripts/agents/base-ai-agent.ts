/**
 * Base AI Agent for TrustBot
 *
 * Abstract base class for connecting LLM providers to TrustBot Mission Control.
 * Extend this class to create provider-specific agents (Claude, Gemini, Grok, etc.)
 * Includes agent-to-agent communication and collaboration capabilities.
 */

import 'dotenv/config';
import {
    AgentMessage,
    AgentCapability,
    CollaborationRequest,
    CollaborationResult,
    MessageType,
    createMessage,
    createCollaborationRequest,
} from './agent-protocol.js';
import { AgentCoordinator, getCoordinator } from './agent-coordinator.js';

// Types for task handling
export interface Task {
    id: string;
    title: string;
    description: string;
    type?: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    context?: Record<string, unknown>;
}

export interface TaskResult {
    summary: string;
    confidence: number;
    data?: Record<string, unknown>;
}

export interface AgentConfig {
    name: string;
    type: string;
    tier: number;
    capabilities: string[];
    skills: string[];
    provider: string;
}

export interface LLMResponse {
    content: string;
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
}

/**
 * Abstract base class for AI-powered TrustBot agents
 */
export abstract class BaseAIAgent {
    protected config: AgentConfig;
    protected agentId: string | null = null;
    protected apiBaseUrl: string;
    protected tokenId: string | null = null;
    protected masterKey: string;

    // Collaboration properties
    protected coordinator: AgentCoordinator | null = null;
    protected currentLoad: number = 0;
    protected messageHistory: AgentMessage[] = [];
    protected pendingCollaborations: Map<string, CollaborationRequest> = new Map();

    constructor(config: AgentConfig) {
        this.config = config;
        this.apiBaseUrl = process.env.TRUSTBOT_API_URL || 'https://trustbot-api.fly.dev';
        this.masterKey = process.env.MASTER_KEY || 'trustbot-master-key-2025';
    }

    /**
     * Initialize the agent - register with TrustBot and get auth token
     */
    async initialize(): Promise<void> {
        console.log(`\n🤖 Initializing ${this.config.name} (${this.config.provider})...`);

        // Get auth token
        const authRes = await fetch(`${this.apiBaseUrl}/auth/human`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ masterKey: this.masterKey }),
        });

        if (!authRes.ok) {
            throw new Error(`Failed to authenticate: ${await authRes.text()}`);
        }

        const auth = await authRes.json() as { tokenId: string };
        this.tokenId = auth.tokenId;
        console.log(`   ✅ Authenticated with TrustBot`);

        // Spawn agent
        const spawnRes = await fetch(`${this.apiBaseUrl}/api/spawn`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: this.config.name,
                type: this.config.type.toUpperCase(),
                tier: this.config.tier,
                capabilities: this.config.capabilities,
                skills: this.config.skills,
            }),
        });

        if (!spawnRes.ok) {
            throw new Error(`Failed to spawn agent: ${await spawnRes.text()}`);
        }

        const spawn = await spawnRes.json() as { agent: { id: string } };
        this.agentId = spawn.agent.id;
        console.log(`   ✅ Agent spawned: ${this.agentId}`);
    }

    /**
     * Process a task using the LLM
     */
    async processTask(task: Task): Promise<TaskResult> {
        console.log(`\n📋 Processing task: ${task.title}`);
        console.log(`   Priority: ${task.priority}`);
        console.log(`   Description: ${task.description.substring(0, 100)}...`);

        const startTime = Date.now();

        try {
            // Build prompt for LLM
            const prompt = this.buildTaskPrompt(task);

            // Call LLM provider
            console.log(`   🧠 Calling ${this.config.provider}...`);
            const response = await this.callLLM(prompt);

            const duration = Date.now() - startTime;
            console.log(`   ⏱️  Completed in ${duration}ms`);

            // Parse response into result
            const result = this.parseResponse(response, task);
            console.log(`   📊 Confidence: ${result.confidence}%`);

            return result;
        } catch (error) {
            console.error(`   ❌ Error: ${error}`);
            throw error;
        }
    }

    /**
     * Build a prompt for the LLM based on the task
     */
    protected buildTaskPrompt(task: Task): string {
        return `You are an AI agent working within the TrustBot system. Your role is to complete tasks efficiently and accurately.

TASK: ${task.title}

DESCRIPTION:
${task.description}

PRIORITY: ${task.priority}

${task.context ? `CONTEXT:\n${JSON.stringify(task.context, null, 2)}` : ''}

Please complete this task. Provide:
1. A clear summary of what you accomplished
2. Any relevant data or results
3. Your confidence level (0-100) in the completion

Respond in JSON format:
{
    "summary": "Brief description of what was accomplished",
    "confidence": 85,
    "data": { "any": "relevant data" }
}`;
    }

    /**
     * Parse LLM response into TaskResult
     */
    protected parseResponse(response: LLMResponse, task: Task): TaskResult {
        try {
            // Try to parse JSON from response
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    summary: parsed.summary || 'Task completed',
                    confidence: Math.min(100, Math.max(0, parsed.confidence || 80)),
                    data: {
                        ...parsed.data,
                        provider: this.config.provider,
                        tokens: response.usage,
                    },
                };
            }
        } catch {
            // If JSON parsing fails, use the raw response
        }

        return {
            summary: response.content.substring(0, 200),
            confidence: 75,
            data: {
                rawResponse: response.content,
                provider: this.config.provider,
            },
        };
    }

    /**
     * Create a task, process it, and complete it
     */
    async executeTask(title: string, description: string, priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM'): Promise<void> {
        if (!this.agentId || !this.tokenId) {
            throw new Error('Agent not initialized. Call initialize() first.');
        }

        // Create task
        const createRes = await fetch(`${this.apiBaseUrl}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                description,
                priority,
                requiredTier: this.config.tier,
                approvalRequired: false,
            }),
        });

        if (!createRes.ok) {
            throw new Error(`Failed to create task: ${await createRes.text()}`);
        }

        const task = await createRes.json() as Task;
        console.log(`\n✅ Task created: ${task.id}`);

        // Assign to self
        const assignRes = await fetch(`${this.apiBaseUrl}/tasks/${task.id}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: this.agentId,
                tokenId: this.tokenId,
            }),
        });

        if (!assignRes.ok) {
            throw new Error(`Failed to assign task: ${await assignRes.text()}`);
        }
        console.log(`   ✅ Task assigned to ${this.config.name}`);

        // Process with LLM
        const result = await this.processTask(task);

        // Complete task
        const completeRes = await fetch(`${this.apiBaseUrl}/tasks/${task.id}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                result,
                tokenId: this.tokenId,
            }),
        });

        if (!completeRes.ok) {
            throw new Error(`Failed to complete task: ${await completeRes.text()}`);
        }

        console.log(`\n🎉 Task completed successfully!`);
        console.log(`   Summary: ${result.summary}`);
    }

    /**
     * Abstract method - implement in subclass to call specific LLM provider
     */
    abstract callLLM(prompt: string): Promise<LLMResponse>;

    /**
     * Get agent info
     */
    getInfo(): { agentId: string | null; config: AgentConfig } {
        return {
            agentId: this.agentId,
            config: this.config,
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // AGENT-TO-AGENT COMMUNICATION METHODS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Join the agent coordinator for inter-agent communication
     */
    joinCoordinator(coordinator?: AgentCoordinator): void {
        this.coordinator = coordinator || getCoordinator();

        if (!this.agentId) {
            throw new Error('Agent must be initialized before joining coordinator');
        }

        const capability: AgentCapability = {
            agentId: this.agentId,
            agentName: this.config.name,
            provider: this.config.provider,
            skills: this.config.skills,
            capabilities: this.config.capabilities,
            currentLoad: this.currentLoad,
            available: true,
            tier: this.config.tier,
        };

        this.coordinator.registerAgent(
            capability,
            this.handleMessage.bind(this),
            this.handleCollaborationRequest.bind(this)
        );

        console.log(`   🔗 Joined coordinator as ${this.config.name}`);
    }

    /**
     * Leave the coordinator
     */
    leaveCoordinator(): void {
        if (this.coordinator && this.agentId) {
            this.coordinator.unregisterAgent(this.agentId);
            this.coordinator = null;
        }
    }

    /**
     * Send a message to another agent
     */
    async sendMessage(
        to: string | 'ALL',
        type: MessageType,
        subject: string,
        content: string,
        options?: {
            priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
            context?: Record<string, unknown>;
            replyTo?: string;
        }
    ): Promise<boolean> {
        if (!this.coordinator || !this.agentId) {
            throw new Error('Must join coordinator before sending messages');
        }

        const message = createMessage(type, this.agentId, to, subject, content, options);
        return this.coordinator.sendMessage(message);
    }

    /**
     * Handle incoming messages
     */
    protected async handleMessage(message: AgentMessage): Promise<void> {
        this.messageHistory.push(message);
        console.log(`\n📬 ${this.config.name} received: ${message.subject}`);

        // Process message based on type
        switch (message.type) {
            case 'REQUEST_HELP':
                await this.handleHelpRequest(message);
                break;
            case 'QUERY':
                await this.handleQuery(message);
                break;
            case 'DELEGATE_TASK':
                await this.handleDelegatedTask(message);
                break;
            case 'SHARE_CONTEXT':
                this.handleSharedContext(message);
                break;
            default:
                console.log(`   Received ${message.type}: ${message.content.substring(0, 50)}...`);
        }
    }

    /**
     * Handle a help request from another agent
     */
    protected async handleHelpRequest(message: AgentMessage): Promise<void> {
        console.log(`   🆘 Help requested: ${message.subject}`);

        // Use LLM to generate a response
        const prompt = `Another AI agent named "${message.from}" is asking for help with the following:

SUBJECT: ${message.subject}

REQUEST:
${message.content}

${message.context ? `CONTEXT:\n${JSON.stringify(message.context, null, 2)}` : ''}

Please provide helpful guidance or assistance. Be concise and actionable.`;

        try {
            const response = await this.callLLM(prompt);

            // Send response back
            await this.sendMessage(
                message.from,
                'PROVIDE_HELP',
                `Re: ${message.subject}`,
                response.content,
                {
                    replyTo: message.id,
                    priority: message.priority,
                }
            );
        } catch (error) {
            console.error(`   ❌ Failed to help: ${error}`);
        }
    }

    /**
     * Handle a query from another agent
     */
    protected async handleQuery(message: AgentMessage): Promise<void> {
        console.log(`   ❓ Query: ${message.subject}`);

        const prompt = `Another AI agent is asking you a question:

QUESTION: ${message.content}

${message.context ? `CONTEXT:\n${JSON.stringify(message.context, null, 2)}` : ''}

Please provide a clear, accurate answer.`;

        try {
            const response = await this.callLLM(prompt);

            await this.sendMessage(
                message.from,
                'RESPONSE',
                `Answer: ${message.subject}`,
                response.content,
                { replyTo: message.id }
            );
        } catch (error) {
            console.error(`   ❌ Failed to respond: ${error}`);
        }
    }

    /**
     * Handle a delegated task from another agent
     */
    protected async handleDelegatedTask(message: AgentMessage): Promise<void> {
        console.log(`   📥 Delegated task: ${message.subject}`);

        if (message.context?.taskDescription) {
            // Execute the delegated task
            const result = await this.processTask({
                id: `delegated-${Date.now()}`,
                title: message.subject,
                description: message.context.taskDescription as string,
                priority: message.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
                context: message.context,
            });

            // Send result back
            await this.sendMessage(
                message.from,
                'TASK_RESULT',
                `Result: ${message.subject}`,
                JSON.stringify(result),
                {
                    replyTo: message.id,
                    context: { result },
                }
            );
        }
    }

    /**
     * Handle shared context from another agent
     */
    protected handleSharedContext(message: AgentMessage): void {
        console.log(`   📋 Context shared: ${message.subject}`);
        // Store context for future tasks
        // Subclasses can override to handle specific context types
    }

    /**
     * Request collaboration from other agents
     */
    async requestCollaboration(
        taskTitle: string,
        description: string,
        requiredSkills: string[],
        options?: {
            taskId?: string;
            priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
            deadline?: Date;
            context?: Record<string, unknown>;
        }
    ): Promise<string | null> {
        if (!this.coordinator || !this.agentId) {
            throw new Error('Must join coordinator before requesting collaboration');
        }

        const request = createCollaborationRequest(
            this.agentId,
            this.config.name,
            taskTitle,
            description,
            requiredSkills,
            options
        );

        this.pendingCollaborations.set(request.id, request);

        return this.coordinator.requestCollaboration(request);
    }

    /**
     * Handle incoming collaboration requests
     */
    protected async handleCollaborationRequest(request: CollaborationRequest): Promise<boolean> {
        console.log(`\n🤝 Collaboration request: ${request.taskTitle}`);
        console.log(`   From: ${request.requesterName}`);
        console.log(`   Skills needed: ${request.requiredSkills.join(', ')}`);

        // Check if we have capacity
        if (this.currentLoad > 80) {
            console.log(`   ⏸️  Declining - load too high (${this.currentLoad}%)`);
            return false;
        }

        // Check skill match
        const matchingSkills = request.requiredSkills.filter(
            skill => this.config.skills.includes(skill) || this.config.capabilities.includes(skill)
        );

        if (matchingSkills.length === 0) {
            console.log(`   ⏸️  Declining - no matching skills`);
            return false;
        }

        console.log(`   ✅ Accepting - can help with: ${matchingSkills.join(', ')}`);
        this.currentLoad += 20; // Increase load when accepting work
        return true;
    }

    /**
     * Complete a collaboration and report results
     */
    completeCollaboration(
        requestId: string,
        result: CollaborationResult
    ): void {
        if (!this.coordinator) {
            throw new Error('Not connected to coordinator');
        }

        this.coordinator.completeCollaboration(requestId, result);
        this.currentLoad = Math.max(0, this.currentLoad - 20);
    }

    /**
     * Broadcast a message to all agents
     */
    async broadcast(
        subject: string,
        content: string,
        type: MessageType = 'BROADCAST'
    ): Promise<void> {
        await this.sendMessage('ALL', type, subject, content);
    }

    /**
     * Ask another agent a question
     */
    async askAgent(
        agentId: string,
        question: string,
        context?: Record<string, unknown>
    ): Promise<void> {
        await this.sendMessage(
            agentId,
            'QUERY',
            'Question',
            question,
            { context }
        );
    }

    /**
     * Request help from another agent
     */
    async requestHelp(
        agentId: string,
        subject: string,
        description: string,
        priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' = 'MEDIUM'
    ): Promise<void> {
        await this.sendMessage(
            agentId,
            'REQUEST_HELP',
            subject,
            description,
            { priority }
        );
    }

    /**
     * Delegate a task to another agent
     */
    async delegateTask(
        agentId: string,
        taskTitle: string,
        taskDescription: string,
        priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' = 'MEDIUM'
    ): Promise<void> {
        await this.sendMessage(
            agentId,
            'DELEGATE_TASK',
            taskTitle,
            `Please complete the following task: ${taskTitle}`,
            {
                priority,
                context: { taskDescription },
            }
        );
    }

    /**
     * Share context with another agent
     */
    async shareContext(
        agentId: string,
        subject: string,
        context: Record<string, unknown>
    ): Promise<void> {
        await this.sendMessage(
            agentId,
            'SHARE_CONTEXT',
            subject,
            'Sharing relevant context for your current work',
            { context }
        );
    }

    /**
     * Get agent's capability profile
     */
    getCapability(): AgentCapability {
        return {
            agentId: this.agentId || 'uninitialized',
            agentName: this.config.name,
            provider: this.config.provider,
            skills: this.config.skills,
            capabilities: this.config.capabilities,
            currentLoad: this.currentLoad,
            available: this.currentLoad < 80,
            tier: this.config.tier,
        };
    }

    /**
     * Update current load
     */
    setLoad(load: number): void {
        this.currentLoad = Math.min(100, Math.max(0, load));
    }
}
