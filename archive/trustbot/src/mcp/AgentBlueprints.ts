/**
 * Agent Blueprints
 * 
 * Pre-configured agent templates that users can spawn.
 * Each blueprint defines capabilities, default tools, and behavior.
 */

import type { AgentTier, Capability } from '../types.js';

// ============================================================================
// Types
// ============================================================================

export interface AgentBlueprint {
    id: string;
    name: string;
    description: string;
    category: BlueprintCategory;
    tier: AgentTier;
    icon: string;
    defaultTools: string[];           // Tool IDs from ToolRegistry
    capabilities: Capability[];
    systemPrompt: string;             // Instructions for the agent
    suggestedFor: string[];           // Use cases
}

export type BlueprintCategory =
    | 'RESEARCH'      // Information gathering
    | 'CONTENT'       // Content creation
    | 'DEVELOPMENT'   // Code and technical
    | 'SOCIAL'        // Social media management
    | 'SALES'         // Sales and CRM
    | 'SUPPORT'       // Customer support
    | 'OPERATIONS'    // Internal ops
    | 'ANALYTICS'     // Data and metrics
    | 'EXECUTIVE';    // High-level orchestration

// ============================================================================
// Agent Blueprints Library
// ============================================================================

export const AGENT_BLUEPRINTS: AgentBlueprint[] = [
    // -------------------------------------------------------------------------
    // RESEARCH Agents
    // -------------------------------------------------------------------------
    {
        id: 'research-analyst',
        name: 'Research Analyst',
        description: 'Gathers and synthesizes information from multiple sources',
        category: 'RESEARCH',
        tier: 1,
        icon: '🔍',
        defaultTools: ['knowledge.search', 'knowledge.rag', 'web.browse', 'web.search'],
        capabilities: [
            { id: 'research', name: 'Research', description: 'Conduct thorough research', requiredTier: 1 },
            { id: 'summarize', name: 'Summarize', description: 'Create summaries', requiredTier: 1 },
        ],
        systemPrompt: 'You are a research analyst. Gather information from available sources, verify facts, and provide comprehensive summaries with citations.',
        suggestedFor: ['Market research', 'Competitive analysis', 'Topic deep-dives'],
    },
    {
        id: 'data-collector',
        name: 'Data Collector',
        description: 'Collects and structures data from web sources',
        category: 'RESEARCH',
        tier: 2,
        icon: '📊',
        defaultTools: ['web.browse', 'web.scrape', 'web.api', 'knowledge.store'],
        capabilities: [
            { id: 'scrape', name: 'Web Scraping', description: 'Extract data from websites', requiredTier: 2 },
            { id: 'structure', name: 'Data Structuring', description: 'Organize raw data', requiredTier: 2 },
        ],
        systemPrompt: 'You are a data collector. Extract, clean, and structure data from web sources. Maintain data quality and report any issues.',
        suggestedFor: ['Lead generation', 'Price monitoring', 'Content aggregation'],
    },

    // -------------------------------------------------------------------------
    // CONTENT Agents
    // -------------------------------------------------------------------------
    {
        id: 'content-writer',
        name: 'Content Writer',
        description: 'Creates written content for various purposes',
        category: 'CONTENT',
        tier: 2,
        icon: '✍️',
        defaultTools: ['creative.text.generate', 'knowledge.search', 'web.search'],
        capabilities: [
            { id: 'write', name: 'Content Writing', description: 'Create written content', requiredTier: 2 },
            { id: 'edit', name: 'Editing', description: 'Edit and improve text', requiredTier: 2 },
        ],
        systemPrompt: 'You are a content writer. Create engaging, well-researched content. Match tone and style to the target audience. Always cite sources.',
        suggestedFor: ['Blog posts', 'Articles', 'Documentation', 'Marketing copy'],
    },
    {
        id: 'social-content-creator',
        name: 'Social Content Creator',
        description: 'Creates content optimized for social platforms',
        category: 'CONTENT',
        tier: 2,
        icon: '📱',
        defaultTools: ['creative.text.generate', 'creative.image.generate', 'social.twitter.read', 'social.linkedin.read'],
        capabilities: [
            { id: 'social-write', name: 'Social Writing', description: 'Write for social media', requiredTier: 2 },
            { id: 'trending', name: 'Trend Analysis', description: 'Analyze trends', requiredTier: 2 },
        ],
        systemPrompt: 'You are a social media content creator. Create engaging posts optimized for each platform. Use trending topics and hashtags appropriately.',
        suggestedFor: ['Twitter threads', 'LinkedIn posts', 'Instagram captions'],
    },

    // -------------------------------------------------------------------------
    // DEVELOPMENT Agents
    // -------------------------------------------------------------------------
    {
        id: 'code-reviewer',
        name: 'Code Reviewer',
        description: 'Reviews code for quality, bugs, and best practices',
        category: 'DEVELOPMENT',
        tier: 2,
        icon: '🔎',
        defaultTools: ['code.read', 'code.git', 'knowledge.search'],
        capabilities: [
            { id: 'review', name: 'Code Review', description: 'Review code quality', requiredTier: 2 },
            { id: 'suggest', name: 'Suggest Improvements', description: 'Recommend changes', requiredTier: 2 },
        ],
        systemPrompt: 'You are a code reviewer. Analyze code for bugs, security issues, and best practices. Provide constructive feedback with examples.',
        suggestedFor: ['PR reviews', 'Security audits', 'Code quality checks'],
    },
    {
        id: 'developer-assistant',
        name: 'Developer Assistant',
        description: 'Assists with coding tasks and documentation',
        category: 'DEVELOPMENT',
        tier: 3,
        icon: '💻',
        defaultTools: ['code.read', 'code.write', 'code.git', 'knowledge.rag', 'web.search'],
        capabilities: [
            { id: 'code', name: 'Code Assistance', description: 'Help with coding', requiredTier: 3 },
            { id: 'debug', name: 'Debugging', description: 'Find and fix bugs', requiredTier: 3 },
        ],
        systemPrompt: 'You are a developer assistant. Help with coding tasks, debugging, and documentation. Write clean, tested code following project conventions.',
        suggestedFor: ['Feature implementation', 'Bug fixes', 'Refactoring'],
    },
    {
        id: 'devops-agent',
        name: 'DevOps Agent',
        description: 'Handles deployment and infrastructure tasks',
        category: 'DEVELOPMENT',
        tier: 4,
        icon: '🚀',
        defaultTools: ['code.read', 'code.write', 'code.execute', 'code.git', 'system.notify'],
        capabilities: [
            { id: 'deploy', name: 'Deployment', description: 'Deploy applications', requiredTier: 4 },
            { id: 'monitor', name: 'Monitoring', description: 'Monitor systems', requiredTier: 4 },
        ],
        systemPrompt: 'You are a DevOps agent. Handle deployments, monitor systems, and respond to incidents. Always verify changes before applying to production.',
        suggestedFor: ['CI/CD', 'Infrastructure management', 'Incident response'],
    },

    // -------------------------------------------------------------------------
    // SOCIAL Agents
    // -------------------------------------------------------------------------
    {
        id: 'social-monitor',
        name: 'Social Monitor',
        description: 'Monitors social media for mentions and trends',
        category: 'SOCIAL',
        tier: 1,
        icon: '👁️',
        defaultTools: ['social.twitter.read', 'social.linkedin.read', 'knowledge.store', 'system.notify'],
        capabilities: [
            { id: 'monitor', name: 'Social Monitoring', description: 'Track social mentions', requiredTier: 1 },
            { id: 'alert', name: 'Alerting', description: 'Send alerts', requiredTier: 1 },
        ],
        systemPrompt: 'You are a social media monitor. Track brand mentions, sentiment, and relevant trends. Alert the team about important discoveries.',
        suggestedFor: ['Brand monitoring', 'Competitor tracking', 'Crisis detection'],
    },
    {
        id: 'community-manager',
        name: 'Community Manager',
        description: 'Engages with community on social platforms',
        category: 'SOCIAL',
        tier: 3,
        icon: '🤝',
        defaultTools: ['social.twitter.read', 'social.twitter.post', 'social.discord.send', 'creative.text.generate'],
        capabilities: [
            { id: 'engage', name: 'Community Engagement', description: 'Interact with community', requiredTier: 3 },
            { id: 'moderate', name: 'Moderation', description: 'Moderate content', requiredTier: 3 },
        ],
        systemPrompt: 'You are a community manager. Engage authentically with the community, answer questions, and foster positive discussions.',
        suggestedFor: ['Twitter engagement', 'Discord management', 'Community building'],
    },

    // -------------------------------------------------------------------------
    // SALES Agents
    // -------------------------------------------------------------------------
    {
        id: 'lead-qualifier',
        name: 'Lead Qualifier',
        description: 'Qualifies and scores incoming leads',
        category: 'SALES',
        tier: 2,
        icon: '🎯',
        defaultTools: ['business.crm.read', 'business.crm.update', 'web.browse', 'knowledge.search'],
        capabilities: [
            { id: 'qualify', name: 'Lead Qualification', description: 'Score and qualify leads', requiredTier: 2 },
            { id: 'enrich', name: 'Data Enrichment', description: 'Enrich lead data', requiredTier: 2 },
        ],
        systemPrompt: 'You are a lead qualifier. Research leads, score them based on fit, and update CRM records. Prioritize high-potential opportunities.',
        suggestedFor: ['Lead scoring', 'Sales pipeline', 'Account research'],
    },
    {
        id: 'sales-assistant',
        name: 'Sales Assistant',
        description: 'Assists sales team with outreach and follow-ups',
        category: 'SALES',
        tier: 3,
        icon: '💼',
        defaultTools: ['business.email.read', 'business.email.send', 'business.crm.read', 'business.crm.update', 'business.calendar.read'],
        capabilities: [
            { id: 'outreach', name: 'Sales Outreach', description: 'Handle outreach', requiredTier: 3 },
            { id: 'followup', name: 'Follow-ups', description: 'Manage follow-ups', requiredTier: 3 },
        ],
        systemPrompt: 'You are a sales assistant. Draft personalized outreach, schedule follow-ups, and keep CRM updated. Maintain a professional tone.',
        suggestedFor: ['Cold outreach', 'Follow-up sequences', 'Meeting scheduling'],
    },

    // -------------------------------------------------------------------------
    // SUPPORT Agents
    // -------------------------------------------------------------------------
    {
        id: 'support-agent',
        name: 'Support Agent',
        description: 'Handles customer support inquiries',
        category: 'SUPPORT',
        tier: 2,
        icon: '🎧',
        defaultTools: ['knowledge.search', 'knowledge.rag', 'business.email.read', 'business.email.send', 'system.notify'],
        capabilities: [
            { id: 'support', name: 'Customer Support', description: 'Answer support queries', requiredTier: 2 },
            { id: 'escalate', name: 'Escalation', description: 'Escalate complex issues', requiredTier: 2 },
        ],
        systemPrompt: 'You are a support agent. Help customers resolve issues using the knowledge base. Escalate to humans when needed. Always be empathetic.',
        suggestedFor: ['Ticket triage', 'FAQ responses', 'Basic troubleshooting'],
    },

    // -------------------------------------------------------------------------
    // OPERATIONS Agents
    // -------------------------------------------------------------------------
    {
        id: 'scheduler',
        name: 'Scheduler',
        description: 'Manages calendars and schedules',
        category: 'OPERATIONS',
        tier: 2,
        icon: '📅',
        defaultTools: ['business.calendar.read', 'business.calendar.create', 'business.email.read', 'business.slack.send'],
        capabilities: [
            { id: 'schedule', name: 'Scheduling', description: 'Manage schedules', requiredTier: 2 },
            { id: 'coordinate', name: 'Coordination', description: 'Coordinate across teams', requiredTier: 2 },
        ],
        systemPrompt: 'You are a scheduler. Manage calendars, find optimal meeting times, and handle scheduling conflicts. Send reminders as needed.',
        suggestedFor: ['Meeting scheduling', 'Calendar management', 'Team coordination'],
    },
    {
        id: 'inbox-manager',
        name: 'Inbox Manager',
        description: 'Triages and organizes email inbox',
        category: 'OPERATIONS',
        tier: 2,
        icon: '📧',
        defaultTools: ['business.email.read', 'business.email.send', 'knowledge.store', 'system.delegate'],
        capabilities: [
            { id: 'triage', name: 'Email Triage', description: 'Sort and prioritize emails', requiredTier: 2 },
            { id: 'respond', name: 'Response Drafts', description: 'Draft responses', requiredTier: 2 },
        ],
        systemPrompt: 'You are an inbox manager. Triage incoming emails, draft responses for routine items, and flag important messages for human attention.',
        suggestedFor: ['Email management', 'Response drafting', 'Priority flagging'],
    },

    // -------------------------------------------------------------------------
    // ANALYTICS Agents
    // -------------------------------------------------------------------------
    {
        id: 'metrics-analyst',
        name: 'Metrics Analyst',
        description: 'Analyzes and reports on key metrics',
        category: 'ANALYTICS',
        tier: 2,
        icon: '📈',
        defaultTools: ['analytics.query', 'analytics.report', 'knowledge.store', 'business.slack.send'],
        capabilities: [
            { id: 'analyze', name: 'Data Analysis', description: 'Analyze metrics', requiredTier: 2 },
            { id: 'report', name: 'Reporting', description: 'Generate reports', requiredTier: 2 },
        ],
        systemPrompt: 'You are a metrics analyst. Track KPIs, identify trends, and generate regular reports. Alert the team to significant changes.',
        suggestedFor: ['KPI tracking', 'Weekly reports', 'Trend analysis'],
    },

    // -------------------------------------------------------------------------
    // EXECUTIVE Agents (T4-T5)
    // -------------------------------------------------------------------------
    {
        id: 'project-coordinator',
        name: 'Project Coordinator',
        description: 'Coordinates multi-agent projects',
        category: 'EXECUTIVE',
        tier: 4,
        icon: '📋',
        defaultTools: ['system.delegate', 'system.spawn', 'system.notify', 'business.slack.send', 'business.calendar.create'],
        capabilities: [
            { id: 'coordinate', name: 'Project Coordination', description: 'Coordinate projects', requiredTier: 4 },
            { id: 'delegate', name: 'Task Delegation', description: 'Delegate to agents', requiredTier: 4 },
        ],
        systemPrompt: 'You are a project coordinator. Break down projects into tasks, assign to appropriate agents, and track progress. Escalate blockers.',
        suggestedFor: ['Project management', 'Cross-team initiatives', 'Sprint planning'],
    },
    {
        id: 'strategic-planner',
        name: 'Strategic Planner',
        description: 'High-level planning and strategy',
        category: 'EXECUTIVE',
        tier: 5,
        icon: '🧠',
        defaultTools: ['knowledge.rag', 'analytics.query', 'system.spawn', 'system.delegate', 'system.notify'],
        capabilities: [
            { id: 'strategize', name: 'Strategic Planning', description: 'Create strategies', requiredTier: 5 },
            { id: 'orchestrate', name: 'Orchestration', description: 'Orchestrate agents', requiredTier: 5 },
        ],
        systemPrompt: 'You are a strategic planner. Analyze high-level objectives, create execution plans, and spawn/coordinate agents to achieve goals.',
        suggestedFor: ['Quarterly planning', 'Goal setting', 'Resource allocation'],
    },
];

// ============================================================================
// Blueprint Registry
// ============================================================================

export class BlueprintRegistry {
    private blueprints: Map<string, AgentBlueprint> = new Map();

    constructor() {
        for (const bp of AGENT_BLUEPRINTS) {
            this.blueprints.set(bp.id, bp);
        }
    }

    getAll(): AgentBlueprint[] {
        return [...this.blueprints.values()];
    }

    get(id: string): AgentBlueprint | undefined {
        return this.blueprints.get(id);
    }

    getByCategory(category: BlueprintCategory): AgentBlueprint[] {
        return this.getAll().filter(bp => bp.category === category);
    }

    getByTier(maxTier: number): AgentBlueprint[] {
        return this.getAll().filter(bp => bp.tier <= maxTier);
    }

    search(query: string): AgentBlueprint[] {
        const lower = query.toLowerCase();
        return this.getAll().filter(bp =>
            bp.name.toLowerCase().includes(lower) ||
            bp.description.toLowerCase().includes(lower) ||
            bp.suggestedFor.some(s => s.toLowerCase().includes(lower))
        );
    }

    register(blueprint: AgentBlueprint): void {
        this.blueprints.set(blueprint.id, blueprint);
    }
}

export const blueprintRegistry = new BlueprintRegistry();
