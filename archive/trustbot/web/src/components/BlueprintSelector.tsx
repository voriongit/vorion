import { useState } from 'react';

// ============================================================================
// Blueprint Data (matching src/mcp/AgentBlueprints.ts)
// ============================================================================

interface Blueprint {
    id: string;
    name: string;
    description: string;
    category: string;
    tier: number;
    icon: string;
    defaultTools: string[];
    suggestedFor: string[];
}

const BLUEPRINTS: Blueprint[] = [
    // Research
    { id: 'research-analyst', name: 'Research Analyst', description: 'Gathers and synthesizes information', category: 'RESEARCH', tier: 1, icon: '🔍', defaultTools: ['knowledge.search', 'web.browse'], suggestedFor: ['Market research', 'Competitive analysis'] },
    { id: 'data-collector', name: 'Data Collector', description: 'Collects and structures web data', category: 'RESEARCH', tier: 2, icon: '📊', defaultTools: ['web.scrape', 'web.api'], suggestedFor: ['Lead generation', 'Price monitoring'] },

    // Content
    { id: 'content-writer', name: 'Content Writer', description: 'Creates written content', category: 'CONTENT', tier: 2, icon: '✍️', defaultTools: ['creative.text.generate', 'knowledge.search'], suggestedFor: ['Blog posts', 'Documentation'] },
    { id: 'social-content-creator', name: 'Social Content Creator', description: 'Optimized for social platforms', category: 'CONTENT', tier: 2, icon: '📱', defaultTools: ['creative.text.generate', 'social.twitter.read'], suggestedFor: ['Twitter threads', 'LinkedIn posts'] },

    // Development
    { id: 'code-reviewer', name: 'Code Reviewer', description: 'Reviews code quality', category: 'DEVELOPMENT', tier: 2, icon: '🔎', defaultTools: ['code.read', 'code.git'], suggestedFor: ['PR reviews', 'Security audits'] },
    { id: 'developer-assistant', name: 'Developer Assistant', description: 'Helps with coding tasks', category: 'DEVELOPMENT', tier: 3, icon: '💻', defaultTools: ['code.read', 'code.write', 'code.git'], suggestedFor: ['Feature implementation', 'Bug fixes'] },
    { id: 'devops-agent', name: 'DevOps Agent', description: 'Deployment and infrastructure', category: 'DEVELOPMENT', tier: 4, icon: '🚀', defaultTools: ['code.execute', 'code.git'], suggestedFor: ['CI/CD', 'Infrastructure'] },

    // Social
    { id: 'social-monitor', name: 'Social Monitor', description: 'Monitors social mentions', category: 'SOCIAL', tier: 1, icon: '👁️', defaultTools: ['social.twitter.read', 'social.linkedin.read'], suggestedFor: ['Brand monitoring', 'Competitor tracking'] },
    { id: 'community-manager', name: 'Community Manager', description: 'Engages with community', category: 'SOCIAL', tier: 3, icon: '🤝', defaultTools: ['social.twitter.post', 'social.discord.send'], suggestedFor: ['Twitter engagement', 'Discord management'] },

    // Sales
    { id: 'lead-qualifier', name: 'Lead Qualifier', description: 'Qualifies incoming leads', category: 'SALES', tier: 2, icon: '🎯', defaultTools: ['business.crm.read', 'web.browse'], suggestedFor: ['Lead scoring', 'Account research'] },
    { id: 'sales-assistant', name: 'Sales Assistant', description: 'Outreach and follow-ups', category: 'SALES', tier: 3, icon: '💼', defaultTools: ['business.email.send', 'business.crm.update'], suggestedFor: ['Cold outreach', 'Meeting scheduling'] },

    // Support
    { id: 'support-agent', name: 'Support Agent', description: 'Handles support inquiries', category: 'SUPPORT', tier: 2, icon: '🎧', defaultTools: ['knowledge.rag', 'business.email.send'], suggestedFor: ['Ticket triage', 'FAQ responses'] },

    // Operations
    { id: 'scheduler', name: 'Scheduler', description: 'Manages calendars', category: 'OPERATIONS', tier: 2, icon: '📅', defaultTools: ['business.calendar.read', 'business.calendar.create'], suggestedFor: ['Meeting scheduling', 'Team coordination'] },
    { id: 'inbox-manager', name: 'Inbox Manager', description: 'Triages email inbox', category: 'OPERATIONS', tier: 2, icon: '📧', defaultTools: ['business.email.read', 'business.email.send'], suggestedFor: ['Email management', 'Response drafting'] },

    // Analytics
    { id: 'metrics-analyst', name: 'Metrics Analyst', description: 'Analyzes key metrics', category: 'ANALYTICS', tier: 2, icon: '📈', defaultTools: ['analytics.query', 'analytics.report'], suggestedFor: ['KPI tracking', 'Weekly reports'] },

    // Executive
    { id: 'project-coordinator', name: 'Project Coordinator', description: 'Coordinates multi-agent projects', category: 'EXECUTIVE', tier: 4, icon: '📋', defaultTools: ['system.delegate', 'system.spawn'], suggestedFor: ['Project management', 'Sprint planning'] },
    { id: 'strategic-planner', name: 'Strategic Planner', description: 'High-level strategy', category: 'EXECUTIVE', tier: 5, icon: '🧠', defaultTools: ['system.spawn', 'system.delegate'], suggestedFor: ['Quarterly planning', 'Goal setting'] },
];

const CATEGORIES = ['ALL', 'RESEARCH', 'CONTENT', 'DEVELOPMENT', 'SOCIAL', 'SALES', 'SUPPORT', 'OPERATIONS', 'ANALYTICS', 'EXECUTIVE'];

const CATEGORY_ICONS: Record<string, string> = {
    ALL: '🌐',
    RESEARCH: '🔍',
    CONTENT: '✍️',
    DEVELOPMENT: '💻',
    SOCIAL: '📱',
    SALES: '💼',
    SUPPORT: '🎧',
    OPERATIONS: '⚙️',
    ANALYTICS: '📈',
    EXECUTIVE: '👔',
};

// ============================================================================
// Component
// ============================================================================

interface BlueprintSelectorProps {
    onSpawn: (blueprint: Blueprint, customName: string) => void;
    onClose: () => void;
}

export function BlueprintSelector({ onSpawn, onClose }: BlueprintSelectorProps) {
    const [category, setCategory] = useState('ALL');
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Blueprint | null>(null);
    const [customName, setCustomName] = useState('');

    const filtered = BLUEPRINTS.filter(bp => {
        if (category !== 'ALL' && bp.category !== category) return false;
        if (search) {
            const lower = search.toLowerCase();
            return bp.name.toLowerCase().includes(lower) ||
                bp.description.toLowerCase().includes(lower) ||
                bp.suggestedFor.some(s => s.toLowerCase().includes(lower));
        }
        return true;
    });

    const handleSpawn = () => {
        if (selected) {
            onSpawn(selected, customName || selected.name);
            onClose();
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal blueprint-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
                <div className="modal-header">
                    <div>
                        <h2>🏭 Spawn Agent from Blueprint</h2>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Choose a template to create a new agent
                        </span>
                    </div>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="modal-content">
                    {/* Search */}
                    <input
                        type="text"
                        placeholder="Search blueprints..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="spawn-input"
                        style={{ marginBottom: '12px' }}
                    />

                    {/* Categories */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setCategory(cat)}
                                style={{
                                    padding: '4px 12px',
                                    borderRadius: '16px',
                                    border: 'none',
                                    background: category === cat ? 'var(--accent-blue)' : 'var(--bg-card)',
                                    color: category === cat ? 'white' : 'var(--text-secondary)',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                }}
                            >
                                <span>{CATEGORY_ICONS[cat]}</span>
                                <span>{cat}</span>
                            </button>
                        ))}
                    </div>

                    {/* Blueprint Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '8px',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        marginBottom: '16px',
                    }}>
                        {filtered.map(bp => (
                            <div
                                key={bp.id}
                                onClick={() => {
                                    setSelected(bp);
                                    setCustomName(bp.name);
                                }}
                                style={{
                                    padding: '12px',
                                    background: selected?.id === bp.id ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-card)',
                                    border: `1px solid ${selected?.id === bp.id ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '1.25rem' }}>{bp.icon}</span>
                                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{bp.name}</span>
                                    <span style={{
                                        marginLeft: 'auto',
                                        fontSize: '0.625rem',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-muted)',
                                    }}>
                                        T{bp.tier}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {bp.description}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Selected Blueprint Details */}
                    {selected && (
                        <div style={{
                            padding: '16px',
                            background: 'var(--bg-card)',
                            borderRadius: '8px',
                            border: '1px solid var(--accent-blue)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                <span style={{ fontSize: '2rem' }}>{selected.icon}</span>
                                <div>
                                    <div style={{ fontWeight: 600 }}>{selected.name}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        Tier {selected.tier} • {selected.category}
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                                    Agent Name
                                </label>
                                <input
                                    type="text"
                                    value={customName}
                                    onChange={e => setCustomName(e.target.value)}
                                    className="spawn-input"
                                    placeholder="Enter agent name..."
                                />
                            </div>

                            <div style={{ marginBottom: '12px' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                    Default Tools
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {selected.defaultTools.map(tool => (
                                        <span key={tool} style={{
                                            fontSize: '0.625rem',
                                            padding: '2px 8px',
                                            background: 'var(--bg-secondary)',
                                            borderRadius: '4px',
                                            color: 'var(--text-secondary)',
                                        }}>
                                            {tool}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div style={{ marginBottom: '12px' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                    Suggested For
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {selected.suggestedFor.map(use => (
                                        <span key={use} style={{
                                            fontSize: '0.625rem',
                                            padding: '2px 8px',
                                            background: 'rgba(59, 130, 246, 0.1)',
                                            borderRadius: '4px',
                                            color: 'var(--accent-blue)',
                                        }}>
                                            {use}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <button className="btn btn-primary" onClick={handleSpawn} style={{ width: '100%' }}>
                                🚀 Spawn {customName || selected.name}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
