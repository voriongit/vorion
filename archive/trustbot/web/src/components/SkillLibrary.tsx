import React, { useState } from 'react';
import { SKILL_BLOCKS, getSkillsByCategory, canAgentUseSkill } from '../data/skillRegistry';
import { RARITY_COLORS, CATEGORY_ICONS, type SkillBlock, type SkillCategory } from '../types/skills';

interface SkillLibraryProps {
    onClose: () => void;
    onAssignSkill?: (skillId: string, agentId: string) => void;
    selectedAgentId?: string;
    selectedAgentTier?: number;
    selectedAgentTrustScore?: number;
    selectedAgentSkills?: string[];
}

const CATEGORIES: SkillCategory[] = [
    'RESEARCH', 'DEVELOPMENT', 'REVIEW', 'PLANNING',
    'COMMUNICATION', 'INTEGRATION', 'AUTOMATION', 'SECURITY'
];

export function SkillLibrary({
    onClose,
    onAssignSkill,
    selectedAgentId,
    selectedAgentTier = 0,
    selectedAgentTrustScore = 0,
    selectedAgentSkills = [],
}: SkillLibraryProps) {
    const [selectedCategory, setSelectedCategory] = useState<SkillCategory | 'ALL'>('ALL');
    const [selectedSkill, setSelectedSkill] = useState<SkillBlock | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [draggedSkill, setDraggedSkill] = useState<string | null>(null);

    const filteredSkills = SKILL_BLOCKS.filter(skill => {
        const matchesCategory = selectedCategory === 'ALL' || skill.category === selectedCategory;
        const matchesSearch = searchQuery === '' ||
            skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            skill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            skill.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesCategory && matchesSearch;
    });

    const handleDragStart = (e: React.DragEvent, skillId: string) => {
        e.dataTransfer.setData('skillId', skillId);
        setDraggedSkill(skillId);
    };

    const handleDragEnd = () => {
        setDraggedSkill(null);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal"
                onClick={e => e.stopPropagation()}
                style={{
                    maxWidth: '1000px',
                    width: '95%',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {/* Header */}
                <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.5rem' }}>🎮</span>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Skill Library</h2>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {SKILL_BLOCKS.length} skills available • Drag to assign
                            </p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                {/* Search & Filters */}
                <div style={{
                    padding: '12px 20px',
                    borderBottom: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                }}>
                    {/* Search */}
                    <input
                        type="text"
                        placeholder="Search skills..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            color: 'var(--text-primary)',
                            fontSize: '0.9rem',
                            marginBottom: '12px',
                        }}
                    />

                    {/* Category Pills */}
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                    }}>
                        <button
                            onClick={() => setSelectedCategory('ALL')}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '16px',
                                border: 'none',
                                background: selectedCategory === 'ALL' ? 'var(--accent-blue)' : 'var(--bg-card)',
                                color: selectedCategory === 'ALL' ? 'white' : 'var(--text-secondary)',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            🔍 All ({SKILL_BLOCKS.length})
                        </button>
                        {CATEGORIES.map(cat => {
                            const count = getSkillsByCategory(cat).length;
                            return (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '16px',
                                        border: 'none',
                                        background: selectedCategory === cat ? 'var(--accent-blue)' : 'var(--bg-card)',
                                        color: selectedCategory === cat ? 'white' : 'var(--text-secondary)',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {CATEGORY_ICONS[cat]} {cat} ({count})
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Main Content */}
                <div style={{
                    display: 'flex',
                    flex: 1,
                    overflow: 'hidden',
                }}>
                    {/* Skills Grid */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '16px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '12px',
                        alignContent: 'start',
                    }}>
                        {filteredSkills.map(skill => {
                            const canUse = canAgentUseSkill(skill, selectedAgentTier, selectedAgentTrustScore, selectedAgentSkills);
                            const rarityStyle = RARITY_COLORS[skill.rarity];

                            return (
                                <div
                                    key={skill.id}
                                    draggable
                                    onDragStart={e => handleDragStart(e, skill.id)}
                                    onDragEnd={handleDragEnd}
                                    onClick={() => setSelectedSkill(skill)}
                                    style={{
                                        padding: '14px',
                                        background: `linear-gradient(135deg, ${rarityStyle.bg}, var(--bg-card))`,
                                        border: `2px solid ${selectedSkill?.id === skill.id ? rarityStyle.border : 'transparent'}`,
                                        borderRadius: '12px',
                                        cursor: 'grab',
                                        opacity: draggedSkill === skill.id ? 0.5 : 1,
                                        transition: 'all 0.2s ease',
                                        position: 'relative',
                                        overflow: 'hidden',
                                    }}
                                    onMouseOver={e => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = `0 4px 12px ${rarityStyle.border}40`;
                                    }}
                                    onMouseOut={e => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    {/* Rarity Glow */}
                                    <div style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        height: '3px',
                                        background: `linear-gradient(90deg, ${rarityStyle.border}, ${rarityStyle.text})`,
                                    }} />

                                    {/* Header */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '10px',
                                        marginBottom: '8px',
                                    }}>
                                        <span style={{
                                            fontSize: '1.5rem',
                                            filter: canUse ? 'none' : 'grayscale(1)',
                                        }}>
                                            {skill.icon}
                                        </span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{
                                                fontWeight: 700,
                                                fontSize: '0.9rem',
                                                color: rarityStyle.text,
                                            }}>
                                                {skill.name}
                                            </div>
                                            <div style={{
                                                display: 'flex',
                                                gap: '6px',
                                                marginTop: '4px',
                                            }}>
                                                <span style={{
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    background: rarityStyle.border + '30',
                                                    color: rarityStyle.text,
                                                    fontSize: '0.6rem',
                                                    fontWeight: 600,
                                                    textTransform: 'uppercase',
                                                }}>
                                                    {skill.rarity}
                                                </span>
                                                <span style={{
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    background: 'var(--bg-lighter)',
                                                    color: 'var(--text-muted)',
                                                    fontSize: '0.6rem',
                                                    fontWeight: 600,
                                                }}>
                                                    T{skill.requirements.minTier}+
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <p style={{
                                        fontSize: '0.75rem',
                                        color: 'var(--text-secondary)',
                                        lineHeight: 1.4,
                                        margin: '0 0 10px 0',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                    }}>
                                        {skill.description}
                                    </p>

                                    {/* Stats Row */}
                                    {skill.stats && (
                                        <div style={{
                                            display: 'flex',
                                            gap: '12px',
                                            fontSize: '0.65rem',
                                            color: 'var(--text-muted)',
                                        }}>
                                            <span>📊 {skill.stats.totalExecutions.toLocaleString()} uses</span>
                                            <span>✅ {(skill.stats.successRate * 100).toFixed(0)}%</span>
                                            <span>⚡ +{skill.trustReward} trust</span>
                                        </div>
                                    )}

                                    {/* Lock Overlay */}
                                    {!canUse && (
                                        <div style={{
                                            position: 'absolute',
                                            inset: 0,
                                            background: 'rgba(0,0,0,0.6)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: '10px',
                                        }}>
                                            <div style={{
                                                textAlign: 'center',
                                                color: 'var(--text-muted)',
                                            }}>
                                                <span style={{ fontSize: '1.5rem' }}>🔒</span>
                                                <div style={{ fontSize: '0.7rem', marginTop: '4px' }}>
                                                    Requires T{skill.requirements.minTier}
                                                    {skill.requirements.minTrustScore && ` • ${skill.requirements.minTrustScore}+ trust`}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {filteredSkills.length === 0 && (
                            <div style={{
                                gridColumn: '1 / -1',
                                textAlign: 'center',
                                padding: '40px',
                                color: 'var(--text-muted)',
                            }}>
                                <span style={{ fontSize: '2rem' }}>🔍</span>
                                <p>No skills found matching your search</p>
                            </div>
                        )}
                    </div>

                    {/* Skill Detail Panel */}
                    {selectedSkill && (
                        <div style={{
                            width: '320px',
                            borderLeft: '1px solid var(--border-color)',
                            background: 'var(--bg-secondary)',
                            overflowY: 'auto',
                            padding: '20px',
                        }}>
                            <SkillDetailPanel
                                skill={selectedSkill}
                                canUse={canAgentUseSkill(selectedSkill, selectedAgentTier, selectedAgentTrustScore, selectedAgentSkills)}
                                onAssign={() => {
                                    if (selectedAgentId && onAssignSkill) {
                                        onAssignSkill(selectedSkill.id, selectedAgentId);
                                    }
                                }}
                                hasAgent={!!selectedAgentId}
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '12px 20px',
                    borderTop: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        💡 Tip: Drag skills onto agents to assign them
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <RarityLegend />
                    </div>
                </div>
            </div>
        </div>
    );
}

// Skill Detail Panel Component
function SkillDetailPanel({
    skill,
    canUse,
    onAssign,
    hasAgent,
}: {
    skill: SkillBlock;
    canUse: boolean;
    onAssign: () => void;
    hasAgent: boolean;
}) {
    const rarityStyle = RARITY_COLORS[skill.rarity];

    return (
        <div>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
            }}>
                <span style={{ fontSize: '2.5rem' }}>{skill.icon}</span>
                <div>
                    <h3 style={{
                        margin: 0,
                        fontSize: '1.1rem',
                        color: rarityStyle.text,
                    }}>
                        {skill.name}
                    </h3>
                    <div style={{
                        display: 'flex',
                        gap: '6px',
                        marginTop: '4px',
                    }}>
                        <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: rarityStyle.bg,
                            border: `1px solid ${rarityStyle.border}`,
                            color: rarityStyle.text,
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                        }}>
                            {skill.rarity}
                        </span>
                        <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: 'var(--bg-card)',
                            color: 'var(--text-muted)',
                            fontSize: '0.65rem',
                            fontWeight: 600,
                        }}>
                            {CATEGORY_ICONS[skill.category]} {skill.category}
                        </span>
                    </div>
                </div>
            </div>

            {/* Description */}
            <p style={{
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                marginBottom: '16px',
            }}>
                {skill.description}
            </p>

            {/* Requirements */}
            <Section title="Requirements">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <Requirement label="Min Tier" value={`Tier ${skill.requirements.minTier}`} />
                    {skill.requirements.minTrustScore && (
                        <Requirement label="Min Trust" value={`${skill.requirements.minTrustScore}+ score`} />
                    )}
                    {skill.requirements.prerequisiteSkills && (
                        <Requirement
                            label="Prerequisites"
                            value={skill.requirements.prerequisiteSkills.join(', ')}
                        />
                    )}
                    {skill.requirements.cooldownMs && (
                        <Requirement label="Cooldown" value={`${skill.requirements.cooldownMs / 1000}s`} />
                    )}
                </div>
            </Section>

            {/* Trust Impact */}
            <Section title="Trust Impact">
                <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{
                        flex: 1,
                        padding: '10px',
                        background: 'rgba(16, 185, 129, 0.1)',
                        borderRadius: '8px',
                        textAlign: 'center',
                    }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-green)' }}>
                            +{skill.trustReward}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Success</div>
                    </div>
                    <div style={{
                        flex: 1,
                        padding: '10px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        borderRadius: '8px',
                        textAlign: 'center',
                    }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-red)' }}>
                            -{skill.trustPenalty}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Failure</div>
                    </div>
                </div>
            </Section>

            {/* Resource Cost */}
            <Section title="Resource Cost">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {skill.resourceCost.map((cost, i) => (
                        <span
                            key={i}
                            style={{
                                padding: '4px 8px',
                                background: 'var(--bg-card)',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                color: 'var(--text-secondary)',
                            }}
                        >
                            {cost.amount} {cost.unit}
                        </span>
                    ))}
                </div>
            </Section>

            {/* Flags */}
            <Section title="Behavioral Flags">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {skill.requiresApproval && (
                        <Flag icon="✋" label="Requires Approval" color="var(--accent-gold)" />
                    )}
                    {skill.canDelegate && (
                        <Flag icon="🤝" label="Can Delegate" color="var(--accent-green)" />
                    )}
                    {skill.isAutonomous && (
                        <Flag icon="🤖" label="Autonomous" color="var(--accent-blue)" />
                    )}
                </div>
            </Section>

            {/* Stats */}
            {skill.stats && (
                <Section title="Usage Stats">
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '8px',
                    }}>
                        <Stat label="Total Uses" value={skill.stats.totalExecutions.toLocaleString()} />
                        <Stat label="Success Rate" value={`${(skill.stats.successRate * 100).toFixed(1)}%`} />
                        <Stat label="Avg Duration" value={`${(skill.stats.avgDurationMs / 1000).toFixed(1)}s`} />
                        <Stat label="Version" value={skill.version} />
                    </div>
                </Section>
            )}

            {/* Assign Button */}
            {hasAgent && (
                <button
                    onClick={onAssign}
                    disabled={!canUse}
                    style={{
                        width: '100%',
                        padding: '12px',
                        marginTop: '16px',
                        background: canUse
                            ? `linear-gradient(135deg, ${rarityStyle.border}, ${rarityStyle.text})`
                            : 'var(--bg-lighter)',
                        border: 'none',
                        borderRadius: '8px',
                        color: canUse ? 'white' : 'var(--text-muted)',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        cursor: canUse ? 'pointer' : 'not-allowed',
                    }}
                >
                    {canUse ? '✨ Assign to Agent' : '🔒 Requirements Not Met'}
                </button>
            )}

            {/* Tags */}
            <div style={{
                marginTop: '16px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px',
            }}>
                {skill.tags.map(tag => (
                    <span
                        key={tag}
                        style={{
                            padding: '2px 6px',
                            background: 'var(--bg-lighter)',
                            borderRadius: '4px',
                            fontSize: '0.6rem',
                            color: 'var(--text-muted)',
                        }}
                    >
                        #{tag}
                    </span>
                ))}
            </div>
        </div>
    );
}

// Helper Components
function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: '16px' }}>
            <h4 style={{
                margin: '0 0 8px 0',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
            }}>
                {title}
            </h4>
            {children}
        </div>
    );
}

function Requirement({ label, value }: { label: string; value: string }) {
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
        }}>
            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
        </div>
    );
}

function Flag({ icon, label, color }: { icon: string; label: string; color: string }) {
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            background: `${color}20`,
            borderRadius: '4px',
            fontSize: '0.7rem',
            color: color,
        }}>
            {icon} {label}
        </span>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div style={{
            padding: '8px',
            background: 'var(--bg-card)',
            borderRadius: '6px',
            textAlign: 'center',
        }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {value}
            </div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{label}</div>
        </div>
    );
}

function RarityLegend() {
    const rarities: Array<{ name: string; color: string }> = [
        { name: 'Common', color: RARITY_COLORS.common.border },
        { name: 'Uncommon', color: RARITY_COLORS.uncommon.border },
        { name: 'Rare', color: RARITY_COLORS.rare.border },
        { name: 'Epic', color: RARITY_COLORS.epic.border },
        { name: 'Legendary', color: RARITY_COLORS.legendary.border },
    ];

    return (
        <div style={{ display: 'flex', gap: '8px' }}>
            {rarities.map(r => (
                <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: r.color,
                    }} />
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{r.name}</span>
                </div>
            ))}
        </div>
    );
}

export default SkillLibrary;
