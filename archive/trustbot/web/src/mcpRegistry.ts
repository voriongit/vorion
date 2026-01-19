
// Minimal types for frontend
export type AgentTier = 0 | 1 | 2 | 3 | 4 | 5;

export type ToolCategory =
    | 'KNOWLEDGE' | 'CODE' | 'WEB' | 'SOCIAL' | 'BUSINESS' | 'ANALYTICS' | 'CREATIVE' | 'SYSTEM';

export interface ToolDefinition {
    id: string;
    name: string;
    description: string;
    category: ToolCategory;
    minTier: AgentTier;
    requiresApproval: boolean;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    parameters: any[];
    returns: string;
}

export const BUILT_IN_TOOLS: ToolDefinition[] = [
    // KNOWLEDGE
    { id: 'knowledge.search', name: 'Search Knowledge Base', description: 'Search internal knowledge bases', category: 'KNOWLEDGE', minTier: 0, requiresApproval: false, riskLevel: 'LOW', parameters: [], returns: 'Results' },
    { id: 'knowledge.store', name: 'Store Knowledge', description: 'Add new knowledge', category: 'KNOWLEDGE', minTier: 2, requiresApproval: false, riskLevel: 'LOW', parameters: [], returns: 'ID' },
    { id: 'knowledge.rag', name: 'RAG Query', description: 'Retrieval Augmented Generation', category: 'KNOWLEDGE', minTier: 3, requiresApproval: false, riskLevel: 'LOW', parameters: [], returns: 'Answer' },
    // CODE
    { id: 'code.read', name: 'Read File', description: 'Read contents of a file', category: 'CODE', minTier: 1, requiresApproval: false, riskLevel: 'LOW', parameters: [], returns: 'Content' },
    { id: 'code.write', name: 'Write File', description: 'Write or create a file', category: 'CODE', minTier: 3, requiresApproval: true, riskLevel: 'MEDIUM', parameters: [], returns: 'Success' },
    { id: 'code.execute', name: 'Execute Code', description: 'Run code in sandbox', category: 'CODE', minTier: 4, requiresApproval: true, riskLevel: 'HIGH', parameters: [], returns: 'Output' },
    { id: 'code.git', name: 'Git Operations', description: 'Clone, pull, commit, push', category: 'CODE', minTier: 3, requiresApproval: true, riskLevel: 'MEDIUM', parameters: [], returns: 'Result' },
    // WEB
    { id: 'web.browse', name: 'Browse Website', description: 'Navigate to web page', category: 'WEB', minTier: 1, requiresApproval: false, riskLevel: 'LOW', parameters: [], returns: 'Content' },
    { id: 'web.search', name: 'Web Search', description: 'Search the web', category: 'WEB', minTier: 1, requiresApproval: false, riskLevel: 'LOW', parameters: [], returns: 'Results' },
    { id: 'web.scrape', name: 'Scrape Website', description: 'Extract structured data', category: 'WEB', minTier: 2, requiresApproval: false, riskLevel: 'LOW', parameters: [], returns: 'Data' },
    // SOCIAL
    { id: 'social.twitter.post', name: 'Post Tweet', description: 'Post to Twitter/X', category: 'SOCIAL', minTier: 3, requiresApproval: true, riskLevel: 'MEDIUM', parameters: [], returns: 'Status' },
    { id: 'social.discord.send', name: 'Send Discord Message', description: 'Post to Discord channel', category: 'SOCIAL', minTier: 2, requiresApproval: false, riskLevel: 'LOW', parameters: [], returns: 'Status' },
    // BUSINESS
    { id: 'business.email.send', name: 'Send Email', description: 'Send an email', category: 'BUSINESS', minTier: 3, requiresApproval: true, riskLevel: 'MEDIUM', parameters: [], returns: 'Status' },
    { id: 'business.calendar.schedule', name: 'Schedule Meeting', description: 'Add event to calendar', category: 'BUSINESS', minTier: 2, requiresApproval: false, riskLevel: 'LOW', parameters: [], returns: 'Event' },
    // SYSTEM
    { id: 'system.time', name: 'Get Time', description: 'Get current system time', category: 'SYSTEM', minTier: 0, requiresApproval: false, riskLevel: 'LOW', parameters: [], returns: 'Date' },
];

export class FrontendToolRegistry {
    private customTools: Map<string, ToolDefinition> = new Map();
    private config = { enabled: true, minTier: 0 };
    private toolConfig: Map<string, { enabled?: boolean; minTier?: number }> = new Map();

    getAllTools(): ToolDefinition[] {
        return [...BUILT_IN_TOOLS, ...this.customTools.values()];
    }

    setConfig(config: { enabled?: boolean; minTier?: number; tools?: Record<string, { enabled?: boolean; minTier?: number }> }) {
        if (config.tools) {
            for (const [id, toolConf] of Object.entries(config.tools)) {
                this.toolConfig.set(id, { ...this.toolConfig.get(id), ...toolConf });
            }
            delete config.tools;
        }
        this.config = { ...this.config, ...config };
    }

    canUse(toolId: string, agentTier: number): { allowed: boolean; reason?: string } {
        // 0. Check per-tool overrides
        const override = this.toolConfig.get(toolId);
        if (override) {
            if (override.enabled === false) return { allowed: false, reason: 'Disabled by admin' };
        }

        // 1. Global Kill Switch
        if (!this.config.enabled) return { allowed: false, reason: 'MCP globally disabled' };

        // 2. Global Min Tier (unless override exists?) - Logic match with backend
        if (!override?.minTier && agentTier < this.config.minTier) {
            return { allowed: false, reason: `Global restriction: Tier ${this.config.minTier}+` };
        }

        const tool = this.getAllTools().find(t => t.id === toolId);
        if (!tool) return { allowed: false, reason: 'Tool not found' };

        const requiredTier = override?.minTier ?? tool.minTier;
        if (agentTier < requiredTier) {
            return { allowed: false, reason: `Requires Tier ${requiredTier}` };
        }
        return { allowed: true };
    }
}

const mcpRegistry = new FrontendToolRegistry();
export default mcpRegistry;
