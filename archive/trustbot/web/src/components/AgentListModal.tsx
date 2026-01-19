import React, { useState, useMemo } from 'react';
import { TrustTierBadge } from './TrustTierBadge';
import { FilterBar, EmptyStates, SkeletonAgentCard } from './ui';
import { Tooltip } from './Tooltip';
import type { Agent, HITLUser } from '../types';

/**
 * Agent List Modal
 *
 * Displays all agents with their trust tiers and links to profiles.
 * Now with search and filtering capabilities.
 * Shows HITL users at the top of the directory.
 */

interface AgentListModalProps {
    agents: Agent[];
    hitlUser?: HITLUser;
    onClose: () => void;
    onSelectAgent: (id: string) => void;
    loading?: boolean;
}

// HITL Authority labels
const HITL_AUTHORITY_LABELS: Record<number, string> = {
    9: 'CEO',
    8: 'Executive',
    7: 'Director',
    6: 'Manager',
    5: 'Lead',
    4: 'Senior',
    3: 'Standard',
    2: 'Limited',
    1: 'Observer',
};

const HITL_STATUS_CONFIG: Record<string, { color: string; icon: string }> = {
    ONLINE: { color: 'var(--accent-green)', icon: '🟢' },
    AWAY: { color: 'var(--accent-gold)', icon: '🟡' },
    OFFLINE: { color: 'var(--text-muted)', icon: '⚫' },
};

const AGENT_ICONS: Record<string, string> = {
    EXECUTOR: '🎖️',
    PLANNER: '🧠',
    VALIDATOR: '🛡️',
    EVOLVER: '🧬',
    SPAWNER: '🏭',
    LISTENER: '👂',
    WORKER: '🤖',
    SPECIALIST: '🔧',
    ORCHESTRATOR: '📋',
};

const STATUS_CONFIG: Record<string, { color: string; description: string }> = {
    IDLE: {
        color: 'var(--text-muted)',
        description: 'Agent is ready and waiting for tasks. No current workload assigned.',
    },
    WORKING: {
        color: 'var(--accent-green)',
        description: 'Agent is actively executing tasks. Check the blackboard for progress updates.',
    },
    IN_MEETING: {
        color: 'var(--accent-blue)',
        description: 'Agent is coordinating with other agents or awaiting collaborative input.',
    },
    WAITING: {
        color: 'var(--accent-gold)',
        description: 'Agent is blocked, waiting for approval or external input to continue.',
    },
    SUSPENDED: {
        color: 'var(--accent-red)',
        description: 'Agent has been paused due to an error or governance decision. Review required.',
    },
};

const AGENT_TYPE_DESCRIPTIONS: Record<string, string> = {
    EXECUTOR: 'Carries out defined tasks and operations. The "doers" of your agent workforce.',
    PLANNER: 'Creates strategies and breaks down complex goals into actionable steps.',
    VALIDATOR: 'Reviews work from other agents, ensures quality and compliance.',
    EVOLVER: 'Analyzes patterns and suggests improvements to processes and other agents.',
    SPAWNER: 'Creates and manages other agents based on workload and needs.',
    LISTENER: 'Monitors external inputs like webhooks, emails, or API calls.',
    WORKER: 'General-purpose agent for routine tasks and basic automation.',
    SPECIALIST: 'Expert in a specific domain or tool integration.',
    ORCHESTRATOR: 'Coordinates multi-agent workflows and complex task chains.',
};

export const AgentListModal: React.FC<AgentListModalProps> = ({ agents, hitlUser, onClose, onSelectAgent, loading = false }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

    // Filter agents based on search and status
    const filteredAgents = useMemo(() => {
        return agents.filter(agent => {
            const matchesSearch = searchQuery === '' ||
                agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                agent.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                agent.location.room.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesStatus = statusFilter === 'ALL' || agent.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [agents, searchQuery, statusFilter]);

    // Build filter options with counts
    const statusFilters = useMemo(() => {
        const counts: Record<string, number> = { ALL: agents.length };
        agents.forEach(a => {
            counts[a.status] = (counts[a.status] || 0) + 1;
        });
        return [
            { id: 'ALL', label: 'All', icon: '📋', count: counts.ALL },
            { id: 'WORKING', label: 'Working', icon: '🟢', count: counts.WORKING || 0 },
            { id: 'IDLE', label: 'Idle', icon: '⚪', count: counts.IDLE || 0 },
            { id: 'WAITING', label: 'Waiting', icon: '🟡', count: counts.WAITING || 0 },
        ].filter(f => f.id === 'ALL' || f.count > 0);
    }, [agents]);

    // Group filtered agents by tier
    const agentsByTier = filteredAgents.reduce((acc, agent) => {
        const tier = agent.tier;
        if (!acc[tier]) acc[tier] = [];
        acc[tier].push(agent);
        return acc;
    }, {} as Record<number, Agent[]>);

    const sortedTiers = Object.keys(agentsByTier)
        .map(Number)
        .sort((a, b) => b - a);

    return (
        <div className="modal-overlay" onClick={onClose} role="presentation">
            <div
                className="modal"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '700px', maxHeight: '80vh' }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="agent-list-title"
            >
                <div className="modal-header">
                    <h2 id="agent-list-title">🤖 Agent Directory ({filteredAgents.length}/{agents.length})</h2>
                    <button className="close-btn" onClick={onClose} aria-label="Close agent directory">✕</button>
                </div>

                <div className="modal-content" style={{ overflowY: 'auto', maxHeight: '60vh' }}>
                    {/* Search and Filter Bar */}
                    <div style={{ marginBottom: '20px' }}>
                        <FilterBar
                            searchValue={searchQuery}
                            onSearchChange={setSearchQuery}
                            filters={statusFilters}
                            activeFilter={statusFilter}
                            onFilterChange={setStatusFilter}
                            placeholder="Search agents by name, type, or location..."
                        />
                    </div>

                    {/* HITL User Section */}
                    {hitlUser && (
                        <div style={{ marginBottom: '24px' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginBottom: '12px',
                                paddingBottom: '8px',
                                borderBottom: '2px solid var(--accent-gold)',
                            }}>
                                <span style={{ fontSize: '1.2rem' }}>👤</span>
                                <span style={{
                                    fontWeight: 700,
                                    color: 'var(--accent-gold)',
                                    textTransform: 'uppercase',
                                    fontSize: '0.8rem',
                                    letterSpacing: '0.05em',
                                }}>
                                    Human Operator
                                </span>
                            </div>

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '16px',
                                background: 'linear-gradient(135deg, var(--bg-secondary) 0%, rgba(245, 158, 11, 0.1) 100%)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--accent-gold)',
                            }}>
                                {/* Avatar */}
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    background: 'var(--accent-gold)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.5rem',
                                    color: 'var(--bg-primary)',
                                }}>
                                    👑
                                </div>

                                {/* Info */}
                                <div style={{ flex: 1 }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        marginBottom: '4px',
                                    }}>
                                        <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                                            {hitlUser.name}
                                        </span>
                                        <span style={{
                                            fontFamily: 'var(--font-mono)',
                                            fontSize: '0.75rem',
                                            padding: '2px 6px',
                                            background: 'var(--accent-gold)',
                                            color: 'var(--bg-primary)',
                                            borderRadius: '4px',
                                            fontWeight: 600,
                                        }}>
                                            {hitlUser.structuredId}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {HITL_AUTHORITY_LABELS[hitlUser.authority] || 'User'} • All Areas
                                    </div>
                                </div>

                                {/* Status */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '0.8rem',
                                    color: HITL_STATUS_CONFIG[hitlUser.status]?.color || 'var(--text-muted)',
                                }}>
                                    <span>{HITL_STATUS_CONFIG[hitlUser.status]?.icon || '⚫'}</span>
                                    {hitlUser.status}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Loading State */}
                    {loading && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {[1, 2, 3].map(i => <SkeletonAgentCard key={i} />)}
                        </div>
                    )}

                    {/* Empty States */}
                    {!loading && agents.length === 0 && (
                        EmptyStates.noAgents(() => onClose())
                    )}

                    {!loading && agents.length > 0 && filteredAgents.length === 0 && (
                        EmptyStates.noSearchResults(searchQuery, () => {
                            setSearchQuery('');
                            setStatusFilter('ALL');
                        })
                    )}

                    {/* Agent List */}
                    {!loading && sortedTiers.map(tier => (
                        <div key={tier} style={{ marginBottom: '24px' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginBottom: '12px',
                                paddingBottom: '8px',
                                borderBottom: '1px solid var(--border-color)',
                            }}>
                                <TrustTierBadge tier={tier} size="medium" />
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                    {agentsByTier[tier].length} agent{agentsByTier[tier].length !== 1 ? 's' : ''}
                                </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {agentsByTier[tier].map(agent => (
                                    <div
                                        key={agent.id}
                                        onClick={() => {
                                            onSelectAgent(agent.id);
                                            onClose();
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '12px',
                                            background: 'var(--bg-secondary)',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease',
                                        }}
                                        onMouseOver={e => {
                                            e.currentTarget.style.background = 'var(--bg-tertiary)';
                                            e.currentTarget.style.transform = 'translateX(4px)';
                                        }}
                                        onMouseOut={e => {
                                            e.currentTarget.style.background = 'var(--bg-secondary)';
                                            e.currentTarget.style.transform = 'translateX(0)';
                                        }}
                                    >
                                        {/* Icon with type tooltip */}
                                        <Tooltip
                                            title={agent.type}
                                            content={AGENT_TYPE_DESCRIPTIONS[agent.type] || 'AI agent'}
                                            position="right"
                                        >
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '50%',
                                                background: 'var(--bg-tertiary)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '1.2rem',
                                                cursor: 'help',
                                            }}>
                                                {AGENT_ICONS[agent.type] ?? '🤖'}
                                            </div>
                                        </Tooltip>

                                        {/* Info */}
                                        <div style={{ flex: 1 }}>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                marginBottom: '2px',
                                            }}>
                                                <span style={{ fontWeight: 600 }}>
                                                    {agent.name}
                                                </span>
                                                {agent.structuredId && (
                                                    <span style={{
                                                        fontFamily: 'var(--font-mono)',
                                                        fontSize: '0.65rem',
                                                        padding: '1px 4px',
                                                        background: 'var(--bg-tertiary)',
                                                        color: 'var(--text-muted)',
                                                        borderRadius: '3px',
                                                    }}>
                                                        {agent.structuredId}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {agent.type} • {agent.location.floor} / {agent.location.room}
                                            </div>
                                        </div>

                                        {/* Status with tooltip */}
                                        <Tooltip
                                            title={`Status: ${agent.status}`}
                                            content={STATUS_CONFIG[agent.status]?.description || 'Current agent state'}
                                            position="left"
                                        >
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                fontSize: '0.75rem',
                                                color: STATUS_CONFIG[agent.status]?.color || 'var(--text-muted)',
                                                cursor: 'help',
                                            }}>
                                                <span style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    background: STATUS_CONFIG[agent.status]?.color || 'var(--text-muted)',
                                                }} />
                                                {agent.status}
                                            </div>
                                        </Tooltip>

                                        {/* Arrow */}
                                        <span style={{ color: 'var(--accent-blue)', fontSize: '0.8rem' }}>→</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AgentListModal;
