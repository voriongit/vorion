/**
 * Tool Registry
 * 
 * Defines all available capabilities/tools that agents can use.
 * MCP-style structure for integrating with external services.
 */

import type { AgentTier } from '../types.js';

// ============================================================================
// Types
// ============================================================================

export type ToolCategory =
    | 'KNOWLEDGE'     // RAG, databases, document stores
    | 'CODE'          // File access, repos, execution
    | 'WEB'           // Browse, scrape, interact
    | 'SOCIAL'        // Twitter, LinkedIn, Discord, etc.
    | 'BUSINESS'      // Email, calendar, CRM, Slack
    | 'ANALYTICS'     // Metrics, dashboards, reports
    | 'CREATIVE'      // Image gen, video, audio
    | 'SYSTEM';       // Internal agent operations

export interface ToolDefinition {
    id: string;
    name: string;
    description: string;
    category: ToolCategory;
    minTier: AgentTier;           // Minimum trust tier to use
    requiresApproval: boolean;    // Needs HITL approval?
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    parameters: ToolParameter[];
    returns: string;
}

export interface ToolParameter {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description: string;
    required: boolean;
    default?: unknown;
}

export interface ToolExecution {
    toolId: string;
    agentId: string;
    parameters: Record<string, unknown>;
    timestamp: Date;
    status: 'PENDING' | 'APPROVED' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'REJECTED';
    result?: unknown;
    error?: string;
}

// ============================================================================
// Built-in Tools Registry
// ============================================================================

export const BUILT_IN_TOOLS: ToolDefinition[] = [
    // -------------------------------------------------------------------------
    // KNOWLEDGE Tools
    // -------------------------------------------------------------------------
    {
        id: 'knowledge.search',
        name: 'Search Knowledge Base',
        description: 'Search internal knowledge bases and documents',
        category: 'KNOWLEDGE',
        minTier: 0,
        requiresApproval: false,
        riskLevel: 'LOW',
        parameters: [
            { name: 'query', type: 'string', description: 'Search query', required: true },
            { name: 'limit', type: 'number', description: 'Max results', required: false, default: 10 },
        ],
        returns: 'Array of search results',
    },
    {
        id: 'knowledge.store',
        name: 'Store Knowledge',
        description: 'Add new knowledge to the system',
        category: 'KNOWLEDGE',
        minTier: 2,
        requiresApproval: false,
        riskLevel: 'LOW',
        parameters: [
            { name: 'title', type: 'string', description: 'Knowledge title', required: true },
            { name: 'content', type: 'string', description: 'Knowledge content', required: true },
            { name: 'tags', type: 'array', description: 'Tags for categorization', required: false },
        ],
        returns: 'Stored knowledge entry ID',
    },
    {
        id: 'knowledge.rag',
        name: 'RAG Query',
        description: 'Query using Retrieval Augmented Generation',
        category: 'KNOWLEDGE',
        minTier: 3,
        requiresApproval: false,
        riskLevel: 'LOW',
        parameters: [
            { name: 'question', type: 'string', description: 'Question to answer', required: true },
            { name: 'context', type: 'string', description: 'Additional context', required: false },
        ],
        returns: 'AI-generated answer with sources',
    },

    // -------------------------------------------------------------------------
    // CODE Tools
    // -------------------------------------------------------------------------
    {
        id: 'code.read',
        name: 'Read File',
        description: 'Read contents of a file',
        category: 'CODE',
        minTier: 1,
        requiresApproval: false,
        riskLevel: 'LOW',
        parameters: [
            { name: 'path', type: 'string', description: 'File path', required: true },
        ],
        returns: 'File contents as string',
    },
    {
        id: 'code.write',
        name: 'Write File',
        description: 'Write or create a file',
        category: 'CODE',
        minTier: 3,
        requiresApproval: true,
        riskLevel: 'MEDIUM',
        parameters: [
            { name: 'path', type: 'string', description: 'File path', required: true },
            { name: 'content', type: 'string', description: 'File content', required: true },
        ],
        returns: 'Success boolean',
    },
    {
        id: 'code.execute',
        name: 'Execute Code',
        description: 'Run code in a sandboxed environment',
        category: 'CODE',
        minTier: 4,
        requiresApproval: true,
        riskLevel: 'HIGH',
        parameters: [
            { name: 'language', type: 'string', description: 'Programming language', required: true },
            { name: 'code', type: 'string', description: 'Code to execute', required: true },
        ],
        returns: 'Execution output',
    },
    {
        id: 'code.git',
        name: 'Git Operations',
        description: 'Perform Git operations',
        category: 'CODE',
        minTier: 3,
        requiresApproval: true,
        riskLevel: 'MEDIUM',
        parameters: [
            { name: 'operation', type: 'string', description: 'Git operation (clone, pull, commit, push)', required: true },
            { name: 'repo', type: 'string', description: 'Repository path or URL', required: true },
            { name: 'message', type: 'string', description: 'Commit message', required: false },
        ],
        returns: 'Operation result',
    },

    // -------------------------------------------------------------------------
    // WEB Tools
    // -------------------------------------------------------------------------
    {
        id: 'web.browse',
        name: 'Browse Website',
        description: 'Navigate to and read a web page',
        category: 'WEB',
        minTier: 1,
        requiresApproval: false,
        riskLevel: 'LOW',
        parameters: [
            { name: 'url', type: 'string', description: 'URL to visit', required: true },
        ],
        returns: 'Page content and metadata',
    },
    {
        id: 'web.search',
        name: 'Web Search',
        description: 'Search the web using search engine',
        category: 'WEB',
        minTier: 1,
        requiresApproval: false,
        riskLevel: 'LOW',
        parameters: [
            { name: 'query', type: 'string', description: 'Search query', required: true },
            { name: 'limit', type: 'number', description: 'Max results', required: false, default: 10 },
        ],
        returns: 'Search results array',
    },
    {
        id: 'web.scrape',
        name: 'Scrape Website',
        description: 'Extract structured data from a website',
        category: 'WEB',
        minTier: 2,
        requiresApproval: false,
        riskLevel: 'MEDIUM',
        parameters: [
            { name: 'url', type: 'string', description: 'URL to scrape', required: true },
            { name: 'selector', type: 'string', description: 'CSS selector', required: true },
        ],
        returns: 'Extracted data',
    },
    {
        id: 'web.api',
        name: 'Call API',
        description: 'Make HTTP API requests',
        category: 'WEB',
        minTier: 2,
        requiresApproval: false,
        riskLevel: 'MEDIUM',
        parameters: [
            { name: 'method', type: 'string', description: 'HTTP method', required: true },
            { name: 'url', type: 'string', description: 'API endpoint', required: true },
            { name: 'body', type: 'object', description: 'Request body', required: false },
            { name: 'headers', type: 'object', description: 'Request headers', required: false },
        ],
        returns: 'API response',
    },

    // -------------------------------------------------------------------------
    // SOCIAL Tools
    // -------------------------------------------------------------------------
    {
        id: 'social.twitter.read',
        name: 'Read Twitter',
        description: 'Read tweets and timelines',
        category: 'SOCIAL',
        minTier: 1,
        requiresApproval: false,
        riskLevel: 'LOW',
        parameters: [
            { name: 'type', type: 'string', description: 'timeline, user, search', required: true },
            { name: 'target', type: 'string', description: 'Username or query', required: false },
        ],
        returns: 'Array of tweets',
    },
    {
        id: 'social.twitter.post',
        name: 'Post to Twitter',
        description: 'Create a new tweet',
        category: 'SOCIAL',
        minTier: 4,
        requiresApproval: true,
        riskLevel: 'HIGH',
        parameters: [
            { name: 'content', type: 'string', description: 'Tweet content', required: true },
            { name: 'media', type: 'array', description: 'Media URLs', required: false },
        ],
        returns: 'Posted tweet ID',
    },
    {
        id: 'social.linkedin.read',
        name: 'Read LinkedIn',
        description: 'Read LinkedIn posts and profiles',
        category: 'SOCIAL',
        minTier: 1,
        requiresApproval: false,
        riskLevel: 'LOW',
        parameters: [
            { name: 'type', type: 'string', description: 'feed, profile, company', required: true },
            { name: 'target', type: 'string', description: 'Target identifier', required: false },
        ],
        returns: 'LinkedIn data',
    },
    {
        id: 'social.linkedin.post',
        name: 'Post to LinkedIn',
        description: 'Create a LinkedIn post',
        category: 'SOCIAL',
        minTier: 4,
        requiresApproval: true,
        riskLevel: 'HIGH',
        parameters: [
            { name: 'content', type: 'string', description: 'Post content', required: true },
            { name: 'visibility', type: 'string', description: 'public, connections', required: false },
        ],
        returns: 'Posted content ID',
    },
    {
        id: 'social.discord.send',
        name: 'Send Discord Message',
        description: 'Send a message to a Discord channel',
        category: 'SOCIAL',
        minTier: 3,
        requiresApproval: true,
        riskLevel: 'MEDIUM',
        parameters: [
            { name: 'channel', type: 'string', description: 'Channel ID', required: true },
            { name: 'message', type: 'string', description: 'Message content', required: true },
        ],
        returns: 'Message ID',
    },

    // -------------------------------------------------------------------------
    // BUSINESS Tools
    // -------------------------------------------------------------------------
    {
        id: 'business.email.read',
        name: 'Read Email',
        description: 'Read emails from inbox',
        category: 'BUSINESS',
        minTier: 2,
        requiresApproval: false,
        riskLevel: 'LOW',
        parameters: [
            { name: 'folder', type: 'string', description: 'Folder name', required: false, default: 'inbox' },
            { name: 'limit', type: 'number', description: 'Max emails', required: false, default: 20 },
        ],
        returns: 'Array of emails',
    },
    {
        id: 'business.email.send',
        name: 'Send Email',
        description: 'Send an email',
        category: 'BUSINESS',
        minTier: 4,
        requiresApproval: true,
        riskLevel: 'HIGH',
        parameters: [
            { name: 'to', type: 'array', description: 'Recipient emails', required: true },
            { name: 'subject', type: 'string', description: 'Email subject', required: true },
            { name: 'body', type: 'string', description: 'Email body', required: true },
        ],
        returns: 'Sent email ID',
    },
    {
        id: 'business.calendar.read',
        name: 'Read Calendar',
        description: 'Read calendar events',
        category: 'BUSINESS',
        minTier: 1,
        requiresApproval: false,
        riskLevel: 'LOW',
        parameters: [
            { name: 'start', type: 'string', description: 'Start date', required: false },
            { name: 'end', type: 'string', description: 'End date', required: false },
        ],
        returns: 'Array of calendar events',
    },
    {
        id: 'business.calendar.create',
        name: 'Create Calendar Event',
        description: 'Create a new calendar event',
        category: 'BUSINESS',
        minTier: 3,
        requiresApproval: true,
        riskLevel: 'MEDIUM',
        parameters: [
            { name: 'title', type: 'string', description: 'Event title', required: true },
            { name: 'start', type: 'string', description: 'Start datetime', required: true },
            { name: 'end', type: 'string', description: 'End datetime', required: true },
            { name: 'attendees', type: 'array', description: 'Attendee emails', required: false },
        ],
        returns: 'Created event ID',
    },
    {
        id: 'business.slack.send',
        name: 'Send Slack Message',
        description: 'Send a message to Slack',
        category: 'BUSINESS',
        minTier: 3,
        requiresApproval: true,
        riskLevel: 'MEDIUM',
        parameters: [
            { name: 'channel', type: 'string', description: 'Channel name or ID', required: true },
            { name: 'message', type: 'string', description: 'Message content', required: true },
        ],
        returns: 'Message timestamp',
    },
    {
        id: 'business.crm.read',
        name: 'Read CRM Data',
        description: 'Query CRM records',
        category: 'BUSINESS',
        minTier: 2,
        requiresApproval: false,
        riskLevel: 'LOW',
        parameters: [
            { name: 'entity', type: 'string', description: 'contacts, deals, companies', required: true },
            { name: 'filter', type: 'object', description: 'Query filter', required: false },
        ],
        returns: 'CRM records',
    },
    {
        id: 'business.crm.update',
        name: 'Update CRM Record',
        description: 'Update a CRM record',
        category: 'BUSINESS',
        minTier: 3,
        requiresApproval: true,
        riskLevel: 'MEDIUM',
        parameters: [
            { name: 'entity', type: 'string', description: 'contacts, deals, companies', required: true },
            { name: 'id', type: 'string', description: 'Record ID', required: true },
            { name: 'data', type: 'object', description: 'Data to update', required: true },
        ],
        returns: 'Updated record',
    },

    // -------------------------------------------------------------------------
    // ANALYTICS Tools
    // -------------------------------------------------------------------------
    {
        id: 'analytics.query',
        name: 'Query Analytics',
        description: 'Query analytics data',
        category: 'ANALYTICS',
        minTier: 2,
        requiresApproval: false,
        riskLevel: 'LOW',
        parameters: [
            { name: 'source', type: 'string', description: 'Data source', required: true },
            { name: 'query', type: 'string', description: 'Query or metric name', required: true },
            { name: 'dateRange', type: 'object', description: 'Date range', required: false },
        ],
        returns: 'Analytics data',
    },
    {
        id: 'analytics.report',
        name: 'Generate Report',
        description: 'Generate an analytics report',
        category: 'ANALYTICS',
        minTier: 3,
        requiresApproval: false,
        riskLevel: 'LOW',
        parameters: [
            { name: 'type', type: 'string', description: 'Report type', required: true },
            { name: 'parameters', type: 'object', description: 'Report parameters', required: false },
        ],
        returns: 'Report data or URL',
    },

    // -------------------------------------------------------------------------
    // CREATIVE Tools
    // -------------------------------------------------------------------------
    {
        id: 'creative.image.generate',
        name: 'Generate Image',
        description: 'Generate an image from text prompt',
        category: 'CREATIVE',
        minTier: 2,
        requiresApproval: false,
        riskLevel: 'LOW',
        parameters: [
            { name: 'prompt', type: 'string', description: 'Image description', required: true },
            { name: 'style', type: 'string', description: 'Art style', required: false },
        ],
        returns: 'Image URL',
    },
    {
        id: 'creative.text.generate',
        name: 'Generate Text',
        description: 'Generate text content',
        category: 'CREATIVE',
        minTier: 1,
        requiresApproval: false,
        riskLevel: 'LOW',
        parameters: [
            { name: 'prompt', type: 'string', description: 'Writing prompt', required: true },
            { name: 'maxLength', type: 'number', description: 'Max characters', required: false },
        ],
        returns: 'Generated text',
    },

    // -------------------------------------------------------------------------
    // SYSTEM Tools (Internal)
    // -------------------------------------------------------------------------
    {
        id: 'system.spawn',
        name: 'Spawn Agent',
        description: 'Create a new agent',
        category: 'SYSTEM',
        minTier: 4,
        requiresApproval: true,
        riskLevel: 'HIGH',
        parameters: [
            { name: 'template', type: 'string', description: 'Agent template', required: true },
            { name: 'name', type: 'string', description: 'Agent name', required: true },
            { name: 'capabilities', type: 'array', description: 'Enabled tools', required: false },
        ],
        returns: 'New agent ID',
    },
    {
        id: 'system.delegate',
        name: 'Delegate Task',
        description: 'Delegate a task to another agent',
        category: 'SYSTEM',
        minTier: 2,
        requiresApproval: false,
        riskLevel: 'LOW',
        parameters: [
            { name: 'agentId', type: 'string', description: 'Target agent', required: true },
            { name: 'task', type: 'object', description: 'Task definition', required: true },
        ],
        returns: 'Task ID',
    },
    {
        id: 'system.notify',
        name: 'Notify Human',
        description: 'Send notification to human operator',
        category: 'SYSTEM',
        minTier: 0,
        requiresApproval: false,
        riskLevel: 'LOW',
        parameters: [
            { name: 'message', type: 'string', description: 'Notification message', required: true },
            { name: 'priority', type: 'string', description: 'low, medium, high, urgent', required: false },
        ],
        returns: 'Notification ID',
    },
];

// ============================================================================
// Tool Registry Class
// ============================================================================

export class ToolRegistry {
    private tools: Map<string, ToolDefinition> = new Map();
    private customTools: Map<string, ToolDefinition> = new Map();

    constructor() {
        // Register built-in tools
        for (const tool of BUILT_IN_TOOLS) {
            this.tools.set(tool.id, tool);
        }
    }

    /**
     * Get all tools
     */
    getAllTools(): ToolDefinition[] {
        return [...this.tools.values(), ...this.customTools.values()];
    }

    /**
     * Get tool by ID
     */
    getTool(id: string): ToolDefinition | undefined {
        return this.tools.get(id) ?? this.customTools.get(id);
    }

    /**
     * Get tools by category
     */
    getByCategory(category: ToolCategory): ToolDefinition[] {
        return this.getAllTools().filter(t => t.category === category);
    }

    /**
     * Get tools available to a tier
     */
    getAvailableForTier(tier: number): ToolDefinition[] {
        return this.getAllTools().filter(t => t.minTier <= tier);
    }

    /**
     * Register a custom tool
     */
    registerTool(tool: ToolDefinition): void {
        this.customTools.set(tool.id, tool);
    }

    private config = { enabled: true, minTier: 0 };
    private toolConfig: Map<string, { enabled?: boolean; minTier?: number }> = new Map();

    /**
     * Update global MCP configuration
     */
    setConfig(config: { enabled?: boolean; minTier?: number; tools?: Record<string, { enabled?: boolean; minTier?: number }> }) {
        if (config.tools) {
            for (const [id, toolConf] of Object.entries(config.tools)) {
                this.toolConfig.set(id, { ...this.toolConfig.get(id), ...toolConf });
            }
            delete config.tools;
        }
        this.config = { ...this.config, ...config };
    }

    /**
     * Check if agent can use tool
     */
    canUse(toolId: string, agentTier: number): { allowed: boolean; reason?: string } {
        // 0. Check per-tool overrides first
        const override = this.toolConfig.get(toolId);
        if (override) {
            if (override.enabled === false) {
                return { allowed: false, reason: 'Tool explicitly disabled by administrator' };
            }
            // If tool has specific tier override, use it instead of tool's default
            // But we still respect global minTier unless we decide overrides bypass globals.
            // Requirement says "override minimum tier requirements".
            // So if I set tool X to Tier 0, it should work even if global min is Tier 2?
            // "Source of truth for all" implies this config is supreme.
            // Let's assume specific override > global default for TIER, but maybe Global Disable kills all?
            // "Global Kill Switch" usually implies EVERYTHING off.
            // I will keep Global Kill Switch supreme, but specific Tier override > Global Min Tier.
        }

        // 1. Global Kill Switch
        if (!this.config.enabled) {
            return { allowed: false, reason: 'MCP System is globally disabled' };
        }

        // 2. Global Minimum Tier (Skip if tool has specific tier override)
        if (!override?.minTier && agentTier < this.config.minTier) {
            return { allowed: false, reason: `Global MCP restriction: Minimum Tier ${this.config.minTier} required` };
        }

        const tool = this.getTool(toolId);
        if (!tool) {
            return { allowed: false, reason: 'Tool not found' };
        }

        // 3. Tool Tier Requirement (Use override if present, else default)
        const requiredTier = override?.minTier ?? tool.minTier;
        if (agentTier < requiredTier) {
            return { allowed: false, reason: `Requires Tier ${requiredTier}, agent is Tier ${agentTier}` };
        }
        return { allowed: true };
    }

    /**
     * Get summary stats
     */
    getStats(): { total: number; byCategory: Record<string, number>; byRisk: Record<string, number> } {
        const tools = this.getAllTools();
        const byCategory: Record<string, number> = {};
        const byRisk: Record<string, number> = {};

        for (const tool of tools) {
            byCategory[tool.category] = (byCategory[tool.category] ?? 0) + 1;
            byRisk[tool.riskLevel] = (byRisk[tool.riskLevel] ?? 0) + 1;
        }

        return { total: tools.length, byCategory, byRisk };
    }
}

// Singleton export
export const toolRegistry = new ToolRegistry();
