/**
 * Skill Cartridge Schema & Registry
 * 
 * Defines the "Skill Cartridges" that can be equipped to agents.
 * Currently a mock registry, but structure enables future DB persistence.
 */

// Schema Definition
export interface SkillCartridge {
    id: string;
    name: string;
    description: string;
    icon: string;
    tier: number; // Minimum agent tier required
    capabilities: string[]; // Capabilities added to the agent
    category: 'FINANCE' | 'TECH' | 'LEGAL' | 'GROWTH';
    price: number; // Trust score cost to equip
}

// Mock Database of Skills ("The Matrix")
const SKILL_LIBRARY: SkillCartridge[] = [
    {
        id: 'skill-wallst-v1',
        name: 'Wall St. Sentiment',
        description: 'Advanced financial text analysis, ticker extraction, and market mood scoring.',
        icon: '📈',
        tier: 1,
        capabilities: ['analyze_stocks', 'extract_tickers', 'sentiment_scoring'],
        category: 'FINANCE',
        price: 50
    },
    {
        id: 'skill-audit-pro',
        name: 'Legal Eagle Audit',
        description: 'Automated compliance checking against standard regulatory frameworks.',
        icon: '⚖️',
        tier: 5, // Requires high tier
        capabilities: ['compliance_check', 'identify_risk', 'generate_audit_report'],
        category: 'LEGAL',
        price: 200
    },
    {
        id: 'skill-react-dev',
        name: 'React 19 Specialist',
        description: 'Expertise in modern React patterns, hooks, and performance optimization.',
        icon: '⚛️',
        tier: 1,
        capabilities: ['write_react', 'debug_react', 'optimize_render'],
        category: 'TECH',
        price: 100
    },
    {
        id: 'skill-growth-hack',
        name: 'Viral Growth Engine',
        description: 'Social media trend analysis and viral loop design patterns.',
        icon: '🚀',
        tier: 3,
        capabilities: ['analyze_trends', 'generate_hooks', 'scrape_social'],
        category: 'GROWTH',
        price: 150
    }
];

// Service Actions
export const SkillRegistry = {
    getAll: () => SKILL_LIBRARY,

    getById: (id: string) => SKILL_LIBRARY.find(s => s.id === id),

    getByCategory: (category: string) => SKILL_LIBRARY.filter(s => s.category === category),

    // Check if an agent qualifies for a skill
    canEquip: (agentTier: number, skill: SkillCartridge) => agentTier >= skill.tier
};
