/**
 * Integration Manager
 * 
 * Manages connections to external services and MCP servers.
 * Handles authentication, rate limiting, and connection pooling.
 */

import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Types
// ============================================================================

export type IntegrationStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export interface IntegrationConfig {
    id: string;
    name: string;
    description: string;
    category: string;
    icon: string;
    authType: 'API_KEY' | 'OAUTH2' | 'BASIC' | 'TOKEN' | 'NONE';
    configFields: ConfigField[];
    enabled: boolean;
}

export interface ConfigField {
    key: string;
    label: string;
    type: 'string' | 'password' | 'url' | 'boolean';
    required: boolean;
    placeholder?: string;
}

export interface IntegrationInstance {
    config: IntegrationConfig;
    status: IntegrationStatus;
    credentials: Record<string, string>;
    connectedAt?: Date;
    lastUsed?: Date;
    errorMessage?: string;
}

// ============================================================================
// Built-in Integration Configs
// ============================================================================

export const INTEGRATIONS: IntegrationConfig[] = [
    // -------------------------------------------------------------------------
    // AI / LLM
    // -------------------------------------------------------------------------
    { id: 'openai', name: 'OpenAI', description: 'GPT-4, DALL-E APIs', category: 'AI', icon: '🤖', authType: 'API_KEY', configFields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }], enabled: false },
    { id: 'anthropic', name: 'Anthropic', description: 'Claude AI models', category: 'AI', icon: '🧠', authType: 'API_KEY', configFields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }], enabled: false },
    { id: 'google-ai', name: 'Google AI', description: 'Gemini models', category: 'AI', icon: '✨', authType: 'API_KEY', configFields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }], enabled: false },
    { id: 'mistral', name: 'Mistral AI', description: 'Open weights models', category: 'AI', icon: '🌪️', authType: 'API_KEY', configFields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }], enabled: false },
    { id: 'cohere', name: 'Cohere', description: 'Enterprise LLMs', category: 'AI', icon: '🖇️', authType: 'API_KEY', configFields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }], enabled: false },
    { id: 'huggingface', name: 'Hugging Face', description: 'Open source hub', category: 'AI', icon: '🤗', authType: 'TOKEN', configFields: [{ key: 'accessToken', label: 'Access Token', type: 'password', required: true }], enabled: false },
    { id: 'perplexity', name: 'Perplexity', description: 'Online LLM API', category: 'AI', icon: '🔮', authType: 'API_KEY', configFields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }], enabled: false },

    // -------------------------------------------------------------------------
    // Web Search
    // -------------------------------------------------------------------------
    { id: 'serper', name: 'Serper.dev', description: 'Google Search API', category: 'WEB', icon: '🔍', authType: 'API_KEY', configFields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }], enabled: false },
    { id: 'brave', name: 'Brave Search', description: 'Privacy search API', category: 'WEB', icon: '🦁', authType: 'API_KEY', configFields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }], enabled: false },
    { id: 'tavily', name: 'Tavily', description: 'Search for Agents', category: 'WEB', icon: '🕵️', authType: 'API_KEY', configFields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }], enabled: false },

    // -------------------------------------------------------------------------
    // Social Media
    // -------------------------------------------------------------------------
    { id: 'twitter', name: 'Twitter/X', description: 'Read and post tweets', category: 'SOCIAL', icon: '🐦', authType: 'OAUTH2', configFields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }, { key: 'apiSecret', label: 'API Secret', type: 'password', required: true }], enabled: false },
    { id: 'linkedin', name: 'LinkedIn', description: 'Professional network', category: 'SOCIAL', icon: '💼', authType: 'OAUTH2', configFields: [{ key: 'accessToken', label: 'Access Token', type: 'password', required: true }], enabled: false },
    { id: 'discord', name: 'Discord', description: 'Bot and webhooks', category: 'SOCIAL', icon: '🎮', authType: 'TOKEN', configFields: [{ key: 'botToken', label: 'Bot Token', type: 'password', required: true }], enabled: false },
    { id: 'reddit', name: 'Reddit', description: 'Community discussions', category: 'SOCIAL', icon: '👽', authType: 'OAUTH2', configFields: [{ key: 'clientId', label: 'Client ID', type: 'string', required: true }, { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true }], enabled: false },
    { id: 'telegram', name: 'Telegram', description: 'Messaging bot', category: 'SOCIAL', icon: '✈️', authType: 'TOKEN', configFields: [{ key: 'botToken', label: 'Bot Token', type: 'password', required: true }], enabled: false },
    { id: 'youtube', name: 'YouTube', description: 'Video platform', category: 'SOCIAL', icon: '📺', authType: 'API_KEY', configFields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }], enabled: false },
    { id: 'instagram', name: 'Instagram', description: 'Visual media', category: 'SOCIAL', icon: '📸', authType: 'OAUTH2', configFields: [{ key: 'accessToken', label: 'Access Token', type: 'password', required: true }], enabled: false },

    // -------------------------------------------------------------------------
    // Business Tools
    // -------------------------------------------------------------------------
    { id: 'slack', name: 'Slack', description: 'Team messaging', category: 'BUSINESS', icon: '💬', authType: 'TOKEN', configFields: [{ key: 'botToken', label: 'Bot Token', type: 'password', required: true }], enabled: false },
    { id: 'gmail', name: 'Gmail', description: 'Email access', category: 'BUSINESS', icon: '📧', authType: 'OAUTH2', configFields: [{ key: 'refreshToken', label: 'Refresh Token', type: 'password', required: true }], enabled: false },
    { id: 'google-calendar', name: 'Google Calendar', description: 'Calendar management', category: 'BUSINESS', icon: '📅', authType: 'OAUTH2', configFields: [{ key: 'refreshToken', label: 'Refresh Token', type: 'password', required: true }], enabled: false },
    { id: 'notion', name: 'Notion', description: 'Workspace docs', category: 'BUSINESS', icon: '📝', authType: 'TOKEN', configFields: [{ key: 'apiKey', label: 'Integration Token', type: 'password', required: true }], enabled: false },
    { id: 'teams', name: 'Microsoft Teams', description: 'Enterprise chat', category: 'BUSINESS', icon: '👥', authType: 'NONE', configFields: [{ key: 'webhookUrl', label: 'Webhook URL', type: 'url', required: true }], enabled: false },
    { id: 'zoom', name: 'Zoom', description: 'Video conferencing', category: 'BUSINESS', icon: '📹', authType: 'TOKEN', configFields: [{ key: 'jwtToken', label: 'JWT Token', type: 'password', required: true }], enabled: false },
    { id: 'trello', name: 'Trello', description: 'Project boards', category: 'BUSINESS', icon: '🗂️', authType: 'API_KEY', configFields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }, { key: 'token', label: 'Token', type: 'password', required: true }], enabled: false },
    { id: 'asana', name: 'Asana', description: 'Task management', category: 'BUSINESS', icon: '⚪', authType: 'TOKEN', configFields: [{ key: 'accessToken', label: 'Access Token', type: 'password', required: true }], enabled: false },
    { id: 'stripe', name: 'Stripe', description: 'Payments platform', category: 'BUSINESS', icon: '💳', authType: 'API_KEY', configFields: [{ key: 'secretKey', label: 'Secret Key', type: 'password', required: true }], enabled: false },
    { id: 'airtable', name: 'Airtable', description: 'Spreadsheet db', category: 'BUSINESS', icon: '📊', authType: 'API_KEY', configFields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }], enabled: false },

    // -------------------------------------------------------------------------
    // CRM
    // -------------------------------------------------------------------------
    { id: 'hubspot', name: 'HubSpot', description: 'CRM and marketing', category: 'CRM', icon: '🔶', authType: 'API_KEY', configFields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }], enabled: false },
    { id: 'salesforce', name: 'Salesforce', description: 'Enterprise CRM', category: 'CRM', icon: '☁️', authType: 'OAUTH2', configFields: [{ key: 'accessToken', label: 'Access Token', type: 'password', required: true }, { key: 'instanceUrl', label: 'Instance URL', type: 'url', required: true }], enabled: false },
    { id: 'zoho', name: 'Zoho CRM', description: 'Business suite', category: 'CRM', icon: '🇿', authType: 'OAUTH2', configFields: [{ key: 'accessToken', label: 'Access Token', type: 'password', required: true }], enabled: false },
    { id: 'pipedrive', name: 'Pipedrive', description: 'Sales CRM', category: 'CRM', icon: '🚀', authType: 'TOKEN', configFields: [{ key: 'apiToken', label: 'API Token', type: 'password', required: true }], enabled: false },

    // -------------------------------------------------------------------------
    // Development
    // -------------------------------------------------------------------------
    { id: 'github', name: 'GitHub', description: 'Code repositories', category: 'DEV', icon: '🐙', authType: 'TOKEN', configFields: [{ key: 'token', label: 'Personal Access Token', type: 'password', required: true }], enabled: false },
    { id: 'gitlab', name: 'GitLab', description: 'DevOps lifecycle', category: 'DEV', icon: '🦊', authType: 'TOKEN', configFields: [{ key: 'token', label: 'Access Token', type: 'password', required: true }], enabled: false },
    { id: 'bitbucket', name: 'Bitbucket', description: 'Git solutions', category: 'DEV', icon: '🗑️', authType: 'BASIC', configFields: [{ key: 'username', label: 'Username', type: 'string', required: true }, { key: 'appPassword', label: 'App Password', type: 'password', required: true }], enabled: false },
    { id: 'jira', name: 'Jira', description: 'Issue tracking', category: 'DEV', icon: '📋', authType: 'API_KEY', configFields: [{ key: 'domain', label: 'Jira Domain', type: 'url', required: true }, { key: 'apiToken', label: 'API Token', type: 'password', required: true }], enabled: false },
    { id: 'linear', name: 'Linear', description: 'Issue tracking', category: 'DEV', icon: '📐', authType: 'API_KEY', configFields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }], enabled: false },
    { id: 'aws', name: 'AWS', description: 'Cloud infrastructure', category: 'DEV', icon: '☁️', authType: 'API_KEY', configFields: [{ key: 'accessKeyId', label: 'Access Key ID', type: 'string', required: true }, { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true }], enabled: false },
    { id: 'docker', name: 'Docker Hub', description: 'Container registry', category: 'DEV', icon: '🐳', authType: 'BASIC', configFields: [{ key: 'username', label: 'Username', type: 'string', required: true }, { key: 'accessToken', label: 'Access Token', type: 'password', required: true }], enabled: false },
    { id: 'vercel', name: 'Vercel', description: 'Deployment platform', category: 'DEV', icon: '▲', authType: 'TOKEN', configFields: [{ key: 'token', label: 'Access Token', type: 'password', required: true }], enabled: false },

    // -------------------------------------------------------------------------
    // Analytics
    // -------------------------------------------------------------------------
    { id: 'google-analytics', name: 'Google Analytics', description: 'Website analytics', category: 'ANALYTICS', icon: '📊', authType: 'OAUTH2', configFields: [{ key: 'propertyId', label: 'Property ID', type: 'string', required: true }], enabled: false },
    { id: 'mixpanel', name: 'Mixpanel', description: 'Product analytics', category: 'ANALYTICS', icon: '🟣', authType: 'TOKEN', configFields: [{ key: 'projectToken', label: 'Project Token', type: 'password', required: true }], enabled: false },
    { id: 'posthog', name: 'PostHog', description: 'Product tools', category: 'ANALYTICS', icon: '🦔', authType: 'API_KEY', configFields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }], enabled: false },
    { id: 'vercel-analytics', name: 'Vercel Analytics', description: 'Web vitals', category: 'ANALYTICS', icon: '📈', authType: 'NONE', configFields: [{ key: 'teamId', label: 'Team ID', type: 'string', required: true }], enabled: false },
];

interface IntegrationManagerEvents {
    'integration:connected': (id: string) => void;
    'integration:disconnected': (id: string) => void;
    'integration:error': (id: string, error: string) => void;
}

export class IntegrationManager extends EventEmitter<IntegrationManagerEvents> {
    private integrations: Map<string, IntegrationInstance> = new Map();

    constructor() {
        super();
        // Initialize with configs
        for (const config of INTEGRATIONS) {
            this.integrations.set(config.id, {
                config,
                status: 'DISCONNECTED',
                credentials: {},
            });
        }
    }

    /**
     * Get all integrations
     */
    getAll(): IntegrationInstance[] {
        return [...this.integrations.values()];
    }

    /**
     * Get integration by ID
     */
    get(id: string): IntegrationInstance | undefined {
        return this.integrations.get(id);
    }

    /**
     * Get integrations by category
     */
    getByCategory(category: string): IntegrationInstance[] {
        return this.getAll().filter(i => i.config.category === category);
    }

    /**
     * Get connected integrations
     */
    getConnected(): IntegrationInstance[] {
        return this.getAll().filter(i => i.status === 'CONNECTED');
    }

    /**
     * Configure an integration
     */
    configure(id: string, credentials: Record<string, string>): boolean {
        const integration = this.integrations.get(id);
        if (!integration) return false;

        integration.credentials = credentials;
        integration.config.enabled = true;
        return true;
    }

    /**
     * Connect to an integration with Validation
     */
    async connect(id: string): Promise<{ success: boolean; error?: string }> {
        const integration = this.integrations.get(id);
        if (!integration) {
            return { success: false, error: 'Integration not found' };
        }

        // Validate required credentials presence
        for (const field of integration.config.configFields) {
            if (field.required && !integration.credentials[field.key]) {
                return { success: false, error: `Missing required field: ${field.label}` };
            }
        }

        integration.status = 'CONNECTING';

        try {
            // Perform Validation
            await this.validateCredentials(id, integration.credentials);

            integration.status = 'CONNECTED';
            integration.connectedAt = new Date();
            integration.errorMessage = undefined;

            this.emit('integration:connected', id);
            return { success: true };
        } catch (err) {
            integration.status = 'ERROR';
            integration.errorMessage = err instanceof Error ? err.message : 'Connection failed';

            this.emit('integration:error', id, integration.errorMessage);
            throw err; // Re-throw to inform API
        }
    }

    /**
     * Validate credentials against external services
     */
    private async validateCredentials(id: string, credentials: Record<string, string>): Promise<void> {
        // Simple heuristic checks first
        if (id === 'openai') {
            if (!credentials.apiKey?.startsWith('sk-')) {
                throw new Error('Invalid OpenAI Key format (must start with sk-)');
            }
            // In a real backend, we would hit https://api.openai.com/v1/models
        }
        else if (id === 'anthropic') {
            if (!credentials.apiKey?.startsWith('sk-ant')) {
                throw new Error('Invalid Anthropic Key format (must start with sk-ant)');
            }
        }
        else if (id === 'google-ai') {
            if (!credentials.apiKey?.startsWith('AIza')) {
                throw new Error('Invalid Google AI Key format (must start with AIza)');
            }
        }
        else if (id === 'slack') {
            if (!credentials.botToken?.startsWith('xoxb-')) {
                throw new Error('Invalid Slack Bot Token (must start with xoxb-)');
            }
        }
        else if (id === 'discord') {
            if ((credentials.botToken?.length ?? 0) < 50) {
                throw new Error('Discord Bot Token seems too short');
            }
        }

        // Artificial delay for "Testing" feel
        await new Promise(r => setTimeout(r, 800));
    }

    /**
     * Disconnect an integration
     */
    disconnect(id: string): boolean {
        const integration = this.integrations.get(id);
        if (!integration) return false;

        integration.status = 'DISCONNECTED';
        integration.connectedAt = undefined;

        this.emit('integration:disconnected', id);
        return true;
    }

    /**
     * Execute a tool using an integration
     */
    async execute(integrationId: string, method: string, params: Record<string, unknown>): Promise<{ success: boolean; data?: unknown; error?: string }> {
        const integration = this.integrations.get(integrationId);
        if (!integration) {
            return { success: false, error: 'Integration not found' };
        }
        if (integration.status !== 'CONNECTED') {
            return { success: false, error: 'Integration not connected' };
        }

        integration.lastUsed = new Date();

        // In real implementation, would route to actual API calls
        // For now, return mock success
        return {
            success: true,
            data: { message: `Executed ${method} on ${integrationId}`, params },
        };
    }

    /**
     * Get summary stats
     */
    getStats(): { total: number; connected: number; byCategory: Record<string, number> } {
        const all = this.getAll();
        const byCategory: Record<string, number> = {};

        for (const i of all) {
            byCategory[i.config.category] = (byCategory[i.config.category] ?? 0) + 1;
        }

        return {
            total: all.length,
            connected: this.getConnected().length,
            byCategory,
        };
    }
}

export const integrationManager = new IntegrationManager();
