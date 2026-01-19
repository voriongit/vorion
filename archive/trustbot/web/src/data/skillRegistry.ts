/**
 * Skill Registry
 *
 * Pre-built skill blocks that can be assigned to agents.
 * Organized by category with varying rarity and tier requirements.
 */

import type { SkillBlock } from '../types/skills';

export const SKILL_BLOCKS: SkillBlock[] = [
    // ==================== RESEARCH SKILLS ====================
    {
        id: 'web-research',
        name: 'Web Research',
        description: 'Search the web for information, synthesize findings, and produce structured reports.',
        category: 'RESEARCH',
        rarity: 'common',
        icon: '🌐',
        requirements: {
            minTier: 1,
            cooldownMs: 5000,
        },
        resourceCost: [
            { type: 'API_CALL', amount: 5, unit: 'calls' },
            { type: 'TOKEN', amount: 2000, unit: 'tokens' },
        ],
        trustReward: 3,
        trustPenalty: 1,
        inputs: [
            { name: 'query', type: 'string', description: 'Search query or research topic', required: true },
            { name: 'depth', type: 'number', description: 'Research depth (1-5)', required: false, default: 2 },
        ],
        outputs: [
            { name: 'summary', type: 'string', description: 'Synthesized research summary' },
            { name: 'sources', type: 'array', description: 'List of source URLs' },
        ],
        requiresApproval: false,
        canDelegate: true,
        isAutonomous: true,
        version: '1.0.0',
        author: 'Aurais Core',
        tags: ['research', 'web', 'information'],
        stats: { totalExecutions: 1247, successRate: 0.94, avgDurationMs: 8500 },
    },
    {
        id: 'doc-analysis',
        name: 'Document Analysis',
        description: 'Analyze documents, extract key information, and generate summaries with citations.',
        category: 'RESEARCH',
        rarity: 'uncommon',
        icon: '📄',
        requirements: {
            minTier: 2,
            prerequisiteSkills: ['web-research'],
        },
        resourceCost: [
            { type: 'TOKEN', amount: 5000, unit: 'tokens' },
            { type: 'MEMORY', amount: 50, unit: 'MB' },
        ],
        trustReward: 5,
        trustPenalty: 2,
        inputs: [
            { name: 'document', type: 'string', description: 'Document content or URL', required: true },
            { name: 'extractFields', type: 'array', description: 'Specific fields to extract', required: false },
        ],
        outputs: [
            { name: 'analysis', type: 'object', description: 'Structured analysis results' },
            { name: 'keyPoints', type: 'array', description: 'Key points extracted' },
        ],
        requiresApproval: false,
        canDelegate: true,
        isAutonomous: true,
        version: '1.0.0',
        author: 'Aurais Core',
        tags: ['research', 'documents', 'analysis'],
        stats: { totalExecutions: 523, successRate: 0.91, avgDurationMs: 12000 },
    },

    // ==================== DEVELOPMENT SKILLS ====================
    {
        id: 'code-generation',
        name: 'Code Generation',
        description: 'Generate code based on specifications, following project patterns and best practices.',
        category: 'DEVELOPMENT',
        rarity: 'rare',
        icon: '⚙️',
        requirements: {
            minTier: 3,
            minTrustScore: 500,
        },
        resourceCost: [
            { type: 'TOKEN', amount: 8000, unit: 'tokens' },
            { type: 'COMPUTE', amount: 2, unit: 'units' },
        ],
        trustReward: 10,
        trustPenalty: 5,
        inputs: [
            { name: 'specification', type: 'string', description: 'Code specification or requirements', required: true },
            { name: 'language', type: 'string', description: 'Programming language', required: true },
            { name: 'context', type: 'object', description: 'Project context and patterns', required: false },
        ],
        outputs: [
            { name: 'code', type: 'string', description: 'Generated code' },
            { name: 'explanation', type: 'string', description: 'Code explanation' },
            { name: 'tests', type: 'string', description: 'Suggested test cases' },
        ],
        requiresApproval: true,
        canDelegate: false,
        isAutonomous: false,
        version: '1.2.0',
        author: 'Aurais Core',
        tags: ['development', 'code', 'generation'],
        stats: { totalExecutions: 892, successRate: 0.87, avgDurationMs: 15000 },
    },
    {
        id: 'code-modification',
        name: 'Code Modification',
        description: 'Modify existing code with surgical precision. Requires high trust and approval.',
        category: 'DEVELOPMENT',
        rarity: 'epic',
        icon: '🔧',
        requirements: {
            minTier: 4,
            minTrustScore: 700,
            prerequisiteSkills: ['code-generation', 'code-review'],
        },
        resourceCost: [
            { type: 'TOKEN', amount: 10000, unit: 'tokens' },
            { type: 'COMPUTE', amount: 3, unit: 'units' },
        ],
        trustReward: 15,
        trustPenalty: 10,
        inputs: [
            { name: 'targetFile', type: 'string', description: 'File to modify', required: true },
            { name: 'changes', type: 'object', description: 'Requested changes', required: true },
            { name: 'reason', type: 'string', description: 'Reason for modification', required: true },
        ],
        outputs: [
            { name: 'diff', type: 'string', description: 'Git-style diff of changes' },
            { name: 'impactAnalysis', type: 'object', description: 'Impact analysis' },
        ],
        requiresApproval: true,
        canDelegate: false,
        isAutonomous: false,
        version: '1.0.0',
        author: 'Aurais Core',
        tags: ['development', 'code', 'modification', 'critical'],
        stats: { totalExecutions: 156, successRate: 0.95, avgDurationMs: 25000 },
    },

    // ==================== REVIEW SKILLS ====================
    {
        id: 'code-review',
        name: 'Code Review',
        description: 'Review code for quality, security issues, and best practices compliance.',
        category: 'REVIEW',
        rarity: 'uncommon',
        icon: '🔎',
        requirements: {
            minTier: 2,
        },
        resourceCost: [
            { type: 'TOKEN', amount: 4000, unit: 'tokens' },
        ],
        trustReward: 5,
        trustPenalty: 2,
        inputs: [
            { name: 'code', type: 'string', description: 'Code to review', required: true },
            { name: 'focusAreas', type: 'array', description: 'Areas to focus on', required: false },
        ],
        outputs: [
            { name: 'issues', type: 'array', description: 'List of issues found' },
            { name: 'suggestions', type: 'array', description: 'Improvement suggestions' },
            { name: 'score', type: 'number', description: 'Quality score (0-100)' },
        ],
        requiresApproval: false,
        canDelegate: true,
        isAutonomous: true,
        version: '1.1.0',
        author: 'Aurais Core',
        tags: ['review', 'code', 'quality'],
        stats: { totalExecutions: 2341, successRate: 0.96, avgDurationMs: 8000 },
    },
    {
        id: 'security-audit',
        name: 'Security Audit',
        description: 'Comprehensive security analysis including OWASP top 10, dependency scanning, and secrets detection.',
        category: 'SECURITY',
        rarity: 'epic',
        icon: '🔒',
        requirements: {
            minTier: 4,
            minTrustScore: 750,
            prerequisiteSkills: ['code-review'],
        },
        resourceCost: [
            { type: 'TOKEN', amount: 8000, unit: 'tokens' },
            { type: 'COMPUTE', amount: 4, unit: 'units' },
            { type: 'TIME', amount: 60, unit: 'seconds' },
        ],
        trustReward: 20,
        trustPenalty: 5,
        inputs: [
            { name: 'target', type: 'string', description: 'Codebase or file path', required: true },
            { name: 'scanType', type: 'string', description: 'Type of scan: full, quick, dependencies', required: false, default: 'full' },
        ],
        outputs: [
            { name: 'vulnerabilities', type: 'array', description: 'List of vulnerabilities' },
            { name: 'riskScore', type: 'number', description: 'Overall risk score' },
            { name: 'recommendations', type: 'array', description: 'Remediation recommendations' },
        ],
        requiresApproval: false,
        canDelegate: false,
        isAutonomous: true,
        version: '1.0.0',
        author: 'Aurais Security',
        tags: ['security', 'audit', 'vulnerability'],
        stats: { totalExecutions: 89, successRate: 0.98, avgDurationMs: 45000 },
    },

    // ==================== PLANNING SKILLS ====================
    {
        id: 'task-breakdown',
        name: 'Task Breakdown',
        description: 'Break down complex tasks into actionable subtasks with estimates and dependencies.',
        category: 'PLANNING',
        rarity: 'common',
        icon: '📊',
        requirements: {
            minTier: 1,
        },
        resourceCost: [
            { type: 'TOKEN', amount: 2000, unit: 'tokens' },
        ],
        trustReward: 3,
        trustPenalty: 1,
        inputs: [
            { name: 'task', type: 'string', description: 'Task to break down', required: true },
            { name: 'maxDepth', type: 'number', description: 'Maximum nesting depth', required: false, default: 3 },
        ],
        outputs: [
            { name: 'subtasks', type: 'array', description: 'List of subtasks' },
            { name: 'dependencies', type: 'object', description: 'Task dependency graph' },
        ],
        requiresApproval: false,
        canDelegate: true,
        isAutonomous: true,
        version: '1.0.0',
        author: 'Aurais Core',
        tags: ['planning', 'tasks', 'breakdown'],
        stats: { totalExecutions: 3456, successRate: 0.93, avgDurationMs: 5000 },
    },
    {
        id: 'strategic-planning',
        name: 'Strategic Planning',
        description: 'High-level strategic planning with risk assessment, resource allocation, and milestone definition.',
        category: 'PLANNING',
        rarity: 'rare',
        icon: '🎯',
        requirements: {
            minTier: 4,
            minTrustScore: 600,
            prerequisiteSkills: ['task-breakdown'],
        },
        resourceCost: [
            { type: 'TOKEN', amount: 6000, unit: 'tokens' },
            { type: 'TIME', amount: 30, unit: 'seconds' },
        ],
        trustReward: 12,
        trustPenalty: 4,
        inputs: [
            { name: 'objective', type: 'string', description: 'Strategic objective', required: true },
            { name: 'constraints', type: 'object', description: 'Resource and time constraints', required: false },
            { name: 'context', type: 'object', description: 'Current project context', required: false },
        ],
        outputs: [
            { name: 'plan', type: 'object', description: 'Strategic plan with phases' },
            { name: 'risks', type: 'array', description: 'Identified risks' },
            { name: 'milestones', type: 'array', description: 'Key milestones' },
        ],
        requiresApproval: true,
        canDelegate: false,
        isAutonomous: false,
        version: '1.0.0',
        author: 'Aurais Core',
        tags: ['planning', 'strategy', 'leadership'],
        stats: { totalExecutions: 234, successRate: 0.89, avgDurationMs: 20000 },
    },

    // ==================== COMMUNICATION SKILLS ====================
    {
        id: 'status-report',
        name: 'Status Report',
        description: 'Generate concise status reports with progress metrics and blockers.',
        category: 'COMMUNICATION',
        rarity: 'common',
        icon: '📝',
        requirements: {
            minTier: 0,
        },
        resourceCost: [
            { type: 'TOKEN', amount: 1000, unit: 'tokens' },
        ],
        trustReward: 2,
        trustPenalty: 1,
        inputs: [
            { name: 'period', type: 'string', description: 'Reporting period', required: true },
            { name: 'includeMetrics', type: 'boolean', description: 'Include detailed metrics', required: false, default: true },
        ],
        outputs: [
            { name: 'report', type: 'string', description: 'Formatted status report' },
            { name: 'metrics', type: 'object', description: 'Key metrics' },
        ],
        requiresApproval: false,
        canDelegate: true,
        isAutonomous: true,
        version: '1.0.0',
        author: 'Aurais Core',
        tags: ['communication', 'reporting', 'status'],
        stats: { totalExecutions: 5678, successRate: 0.99, avgDurationMs: 3000 },
    },
    {
        id: 'agent-coordination',
        name: 'Agent Coordination',
        description: 'Coordinate with other agents, delegate tasks, and manage collaborative workflows.',
        category: 'COMMUNICATION',
        rarity: 'rare',
        icon: '🤝',
        requirements: {
            minTier: 3,
            minTrustScore: 500,
        },
        resourceCost: [
            { type: 'API_CALL', amount: 10, unit: 'calls' },
            { type: 'TOKEN', amount: 3000, unit: 'tokens' },
        ],
        trustReward: 8,
        trustPenalty: 3,
        inputs: [
            { name: 'objective', type: 'string', description: 'Coordination objective', required: true },
            { name: 'targetAgents', type: 'array', description: 'Agents to coordinate with', required: true },
        ],
        outputs: [
            { name: 'assignments', type: 'array', description: 'Task assignments made' },
            { name: 'timeline', type: 'object', description: 'Coordination timeline' },
        ],
        requiresApproval: true,
        canDelegate: false,
        isAutonomous: false,
        version: '1.0.0',
        author: 'Aurais Core',
        tags: ['communication', 'coordination', 'teamwork'],
        stats: { totalExecutions: 456, successRate: 0.91, avgDurationMs: 10000 },
    },

    // ==================== INTEGRATION SKILLS ====================
    {
        id: 'api-integration',
        name: 'API Integration',
        description: 'Connect to external APIs, handle authentication, and manage data synchronization.',
        category: 'INTEGRATION',
        rarity: 'uncommon',
        icon: '🔌',
        requirements: {
            minTier: 2,
        },
        resourceCost: [
            { type: 'API_CALL', amount: 20, unit: 'calls' },
            { type: 'TOKEN', amount: 2000, unit: 'tokens' },
        ],
        trustReward: 6,
        trustPenalty: 3,
        inputs: [
            { name: 'apiSpec', type: 'object', description: 'API specification', required: true },
            { name: 'operation', type: 'string', description: 'Operation to perform', required: true },
        ],
        outputs: [
            { name: 'response', type: 'object', description: 'API response' },
            { name: 'metadata', type: 'object', description: 'Response metadata' },
        ],
        requiresApproval: true,
        canDelegate: true,
        isAutonomous: false,
        version: '1.0.0',
        author: 'Aurais Core',
        tags: ['integration', 'api', 'external'],
        stats: { totalExecutions: 1890, successRate: 0.88, avgDurationMs: 6000 },
    },
    {
        id: 'mcp-bridge',
        name: 'MCP Bridge',
        description: 'Interface with Model Context Protocol servers for extended capabilities.',
        category: 'INTEGRATION',
        rarity: 'epic',
        icon: '🌉',
        requirements: {
            minTier: 4,
            minTrustScore: 700,
            prerequisiteSkills: ['api-integration'],
        },
        resourceCost: [
            { type: 'API_CALL', amount: 50, unit: 'calls' },
            { type: 'TOKEN', amount: 5000, unit: 'tokens' },
            { type: 'COMPUTE', amount: 2, unit: 'units' },
        ],
        trustReward: 15,
        trustPenalty: 8,
        inputs: [
            { name: 'mcpServer', type: 'string', description: 'MCP server identifier', required: true },
            { name: 'toolName', type: 'string', description: 'Tool to invoke', required: true },
            { name: 'parameters', type: 'object', description: 'Tool parameters', required: true },
        ],
        outputs: [
            { name: 'result', type: 'object', description: 'Tool execution result' },
            { name: 'resourceUsage', type: 'object', description: 'Resources consumed' },
        ],
        requiresApproval: true,
        canDelegate: false,
        isAutonomous: false,
        version: '1.0.0',
        author: 'Aurais Core',
        tags: ['integration', 'mcp', 'advanced'],
        stats: { totalExecutions: 67, successRate: 0.92, avgDurationMs: 15000 },
    },

    // ==================== AUTOMATION SKILLS ====================
    {
        id: 'workflow-automation',
        name: 'Workflow Automation',
        description: 'Create and execute automated workflows with conditional logic and error handling.',
        category: 'AUTOMATION',
        rarity: 'rare',
        icon: '🔄',
        requirements: {
            minTier: 3,
            prerequisiteSkills: ['task-breakdown'],
        },
        resourceCost: [
            { type: 'COMPUTE', amount: 5, unit: 'units' },
            { type: 'TOKEN', amount: 4000, unit: 'tokens' },
        ],
        trustReward: 10,
        trustPenalty: 5,
        inputs: [
            { name: 'workflow', type: 'object', description: 'Workflow definition', required: true },
            { name: 'triggerCondition', type: 'string', description: 'When to trigger', required: false },
        ],
        outputs: [
            { name: 'executionLog', type: 'array', description: 'Step-by-step execution log' },
            { name: 'finalState', type: 'object', description: 'Final workflow state' },
        ],
        requiresApproval: true,
        canDelegate: true,
        isAutonomous: false,
        version: '1.0.0',
        author: 'Aurais Core',
        tags: ['automation', 'workflow', 'orchestration'],
        stats: { totalExecutions: 567, successRate: 0.85, avgDurationMs: 30000 },
    },
    {
        id: 'self-improvement',
        name: 'Self-Improvement',
        description: 'Analyze performance patterns and suggest optimizations to own behavior.',
        category: 'AUTOMATION',
        rarity: 'legendary',
        icon: '🧬',
        requirements: {
            minTier: 5,
            minTrustScore: 900,
            prerequisiteSkills: ['strategic-planning', 'code-review'],
        },
        resourceCost: [
            { type: 'TOKEN', amount: 15000, unit: 'tokens' },
            { type: 'COMPUTE', amount: 10, unit: 'units' },
            { type: 'TIME', amount: 120, unit: 'seconds' },
        ],
        trustReward: 25,
        trustPenalty: 15,
        inputs: [
            { name: 'analysisScope', type: 'string', description: 'What to analyze', required: true },
            { name: 'improvementGoals', type: 'array', description: 'Target improvements', required: true },
        ],
        outputs: [
            { name: 'insights', type: 'array', description: 'Performance insights' },
            { name: 'proposedChanges', type: 'array', description: 'Suggested behavioral changes' },
            { name: 'projectedImpact', type: 'object', description: 'Expected improvements' },
        ],
        requiresApproval: true,
        canDelegate: false,
        isAutonomous: false,
        version: '0.9.0',
        author: 'Aurais Research',
        tags: ['automation', 'self-improvement', 'meta', 'experimental'],
        stats: { totalExecutions: 12, successRate: 0.83, avgDurationMs: 120000 },
    },
];

// Helper functions
export function getSkillById(id: string): SkillBlock | undefined {
    return SKILL_BLOCKS.find(s => s.id === id);
}

export function getSkillsByCategory(category: SkillBlock['category']): SkillBlock[] {
    return SKILL_BLOCKS.filter(s => s.category === category);
}

export function getSkillsByRarity(rarity: SkillBlock['rarity']): SkillBlock[] {
    return SKILL_BLOCKS.filter(s => s.rarity === rarity);
}

export function getSkillsForTier(tier: number): SkillBlock[] {
    return SKILL_BLOCKS.filter(s => s.requirements.minTier <= tier);
}

export function canAgentUseSkill(skill: SkillBlock, agentTier: number, agentTrustScore: number, agentSkills: string[]): boolean {
    if (agentTier < skill.requirements.minTier) return false;
    if (skill.requirements.minTrustScore && agentTrustScore < skill.requirements.minTrustScore) return false;
    if (skill.requirements.prerequisiteSkills) {
        const hasPrereqs = skill.requirements.prerequisiteSkills.every(prereq => agentSkills.includes(prereq));
        if (!hasPrereqs) return false;
    }
    return true;
}
