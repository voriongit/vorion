import React, { useState } from 'react';
import { TrustTierBadge } from './TrustTierBadge';
import { CompletedTodayCard } from './CompletedTodayCard';
import { HumanAuthModal } from './HumanAuthModal';
import type { Agent, BlackboardEntry } from '../types';

/**
 * Metrics Dashboard
 * 
 * Comprehensive dashboard showing system metrics, governance levels,
 * trust distribution, and agent activity.
 */

interface MetricsDashboardProps {
    agents: Agent[];
    blackboardEntries: BlackboardEntry[];
    hitlLevel: number;
    avgTrust: number;
    uptime: number;
    onClose: () => void;
    onViewAgent?: (agentId: string) => void;
}

const TIER_CONFIG = [
    { tier: 5, name: 'ELITE', color: '#ffd700', min: 950 },
    { tier: 4, name: 'CERTIFIED', color: '#aa44ff', min: 800 },
    { tier: 3, name: 'VERIFIED', color: '#00cc88', min: 600 },
    { tier: 2, name: 'TRUSTED', color: '#44aaff', min: 400 },
    { tier: 1, name: 'PROBATIONARY', color: '#ff8c00', min: 200 },
    { tier: 0, name: 'UNTRUSTED', color: '#ff4444', min: 0 },
];

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({
    agents,
    blackboardEntries,
    hitlLevel,
    avgTrust,
    uptime,
    onClose,
    onViewAgent,
}) => {
    // Human auth state
    const [humanToken, setHumanToken] = useState<string | null>(null);
    const [showAuthModal, setShowAuthModal] = useState(false);

    // Calculate metrics
    const totalAgents = agents.length;
    const activeAgents = agents.filter(a => a.status === 'WORKING').length;
    const idleAgents = agents.filter(a => a.status === 'IDLE').length;

    // Trust distribution
    const trustDistribution = TIER_CONFIG.map(config => ({
        ...config,
        count: agents.filter(a => a.tier === config.tier).length,
        percentage: totalAgents > 0 ? (agents.filter(a => a.tier === config.tier).length / totalAgents) * 100 : 0,
    }));

    // Blackboard stats
    const bbStats = {
        total: blackboardEntries.length,
        open: blackboardEntries.filter(e => e.status === 'OPEN').length,
        inProgress: blackboardEntries.filter(e => e.status === 'IN_PROGRESS').length,
        resolved: blackboardEntries.filter(e => e.status === 'RESOLVED').length,
    };

    // Entry types
    const entryTypes = [
        { type: 'PROBLEM', count: blackboardEntries.filter(e => e.type === 'PROBLEM').length, color: 'var(--accent-red)' },
        { type: 'SOLUTION', count: blackboardEntries.filter(e => e.type === 'SOLUTION').length, color: 'var(--accent-green)' },
        { type: 'DECISION', count: blackboardEntries.filter(e => e.type === 'DECISION').length, color: 'var(--accent-gold)' },
        { type: 'TASK', count: blackboardEntries.filter(e => e.type === 'TASK').length, color: 'var(--accent-blue)' },
        { type: 'PATTERN', count: blackboardEntries.filter(e => e.type === 'PATTERN').length, color: 'var(--accent-purple)' },
        { type: 'OBSERVATION', count: blackboardEntries.filter(e => e.type === 'OBSERVATION').length, color: 'var(--accent-cyan)' },
    ];

    const formatUptime = (seconds: number): string => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const getHITLDescription = () => {
        if (hitlLevel >= 80) return { level: 'Full Oversight', icon: '🔒', color: 'var(--accent-gold)' };
        if (hitlLevel >= 50) return { level: 'Shared Governance', icon: '🔓', color: 'var(--accent-green)' };
        if (hitlLevel >= 20) return { level: 'Mostly Autonomous', icon: '🤖', color: 'var(--accent-blue)' };
        return { level: 'Full Autonomy', icon: '🚀', color: 'var(--accent-purple)' };
    };

    const hitlInfo = getHITLDescription();

    return (
        <div className="modal-overlay" onClick={onClose} role="presentation">
            <div
                className="modal"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '900px', maxHeight: '90vh' }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="metrics-dashboard-title"
            >
                <div className="modal-header">
                    <h2 id="metrics-dashboard-title">📊 System Metrics & Governance</h2>
                    <button className="close-btn" onClick={onClose} aria-label="Close metrics dashboard">✕</button>
                </div>

                <div className="modal-content" style={{ overflowY: 'auto', maxHeight: '75vh' }}>
                    {/* Top Stats Row */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: '16px',
                        marginBottom: '24px',
                    }}>
                        {/* HITL Level */}
                        <div style={{
                            background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '20px',
                            textAlign: 'center',
                            borderTop: `4px solid ${hitlInfo.color}`,
                        }}>
                            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: hitlInfo.color }}>
                                {hitlLevel}%
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                {hitlInfo.icon} {hitlInfo.level}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                HITL GOVERNANCE
                            </div>
                        </div>

                        {/* Avg Trust */}
                        <div style={{
                            background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '20px',
                            textAlign: 'center',
                            borderTop: '4px solid var(--accent-blue)',
                        }}>
                            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
                                {avgTrust}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                out of 1000
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                AVG TRUST SCORE
                            </div>
                        </div>

                        {/* Total Agents */}
                        <div style={{
                            background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '20px',
                            textAlign: 'center',
                            borderTop: '4px solid var(--accent-green)',
                        }}>
                            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--accent-green)' }}>
                                {totalAgents}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                {activeAgents} active / {idleAgents} idle
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                TOTAL AGENTS
                            </div>
                        </div>

                        {/* Uptime */}
                        <div style={{
                            background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '20px',
                            textAlign: 'center',
                            borderTop: '4px solid var(--accent-cyan)',
                        }}>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', fontFamily: 'monospace' }}>
                                {formatUptime(uptime)}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                                Session Duration
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                UPTIME
                            </div>
                        </div>
                    </div>

                    {/* Two Column Layout */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                        {/* Trust Distribution */}
                        <div style={{
                            background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '20px',
                        }}>
                            <h3 style={{ marginBottom: '16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                🏆 Trust Distribution
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {trustDistribution.map(tier => (
                                    <div key={tier.tier} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <TrustTierBadge tier={tier.tier} size="small" />
                                        <div style={{ flex: 1 }}>
                                            <div style={{
                                                height: '8px',
                                                background: 'rgba(255,255,255,0.1)',
                                                borderRadius: '4px',
                                                overflow: 'hidden',
                                            }}>
                                                <div style={{
                                                    width: `${tier.percentage}%`,
                                                    height: '100%',
                                                    background: tier.color,
                                                    borderRadius: '4px',
                                                    transition: 'width 0.3s ease',
                                                }} />
                                            </div>
                                        </div>
                                        <span style={{ fontWeight: 600, minWidth: '24px', textAlign: 'right' }}>
                                            {tier.count}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Blackboard Activity */}
                        <div style={{
                            background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '20px',
                        }}>
                            <h3 style={{ marginBottom: '16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                📋 Blackboard Activity
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                                <div style={{ textAlign: 'center', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-blue)' }}>{bbStats.open}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>OPEN</div>
                                </div>
                                <div style={{ textAlign: 'center', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-gold)' }}>{bbStats.inProgress}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>IN PROGRESS</div>
                                </div>
                                <div style={{ textAlign: 'center', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-green)' }}>{bbStats.resolved}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>RESOLVED</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {entryTypes.map(et => (
                                    <div key={et.type} style={{
                                        padding: '6px 12px',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-sm)',
                                        borderLeft: `3px solid ${et.color}`,
                                        fontSize: '0.75rem',
                                    }}>
                                        <span style={{ fontWeight: 600 }}>{et.count}</span>
                                        <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>{et.type.toLowerCase()}s</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Active Agents Section */}
                    <div style={{
                        marginTop: '24px',
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '20px',
                    }}>
                        <h3 style={{ marginBottom: '16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🤖 Agent Status Overview
                        </h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {agents.map(agent => (
                                <div
                                    key={agent.id}
                                    onClick={() => onViewAgent?.(agent.id)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '8px 12px',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: onViewAgent ? 'pointer' : 'default',
                                        transition: 'transform 0.1s ease',
                                    }}
                                    onMouseOver={e => onViewAgent && (e.currentTarget.style.transform = 'scale(1.02)')}
                                    onMouseOut={e => onViewAgent && (e.currentTarget.style.transform = 'scale(1)')}
                                >
                                    <span style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: agent.status === 'WORKING' ? 'var(--accent-green)' :
                                            agent.status === 'IDLE' ? 'var(--text-muted)' : 'var(--accent-gold)',
                                    }} />
                                    <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>{agent.name}</span>
                                    <TrustTierBadge tier={agent.tier} size="small" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Unified Workflow - Completed Today */}
                    <div style={{ marginTop: '24px' }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '16px'
                        }}>
                            <h3 style={{ fontSize: '0.9rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                🔄 Unified Workflow API
                            </h3>
                            {humanToken ? (
                                <span style={{
                                    background: 'rgba(16, 185, 129, 0.2)',
                                    color: 'var(--accent-green)',
                                    padding: '4px 12px',
                                    borderRadius: '12px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600
                                }}>
                                    ✓ Authenticated
                                </span>
                            ) : (
                                <button
                                    onClick={() => setShowAuthModal(true)}
                                    style={{
                                        background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
                                        border: 'none',
                                        color: 'white',
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    🔐 Authenticate
                                </button>
                            )}
                        </div>
                        <CompletedTodayCard
                            humanToken={humanToken ?? undefined}
                            onTokenNeeded={() => setShowAuthModal(true)}
                        />
                    </div>
                </div>
            </div>

            {/* Human Auth Modal */}
            {showAuthModal && (
                <HumanAuthModal
                    onAuthenticated={(token) => {
                        setHumanToken(token);
                        setShowAuthModal(false);
                    }}
                    onClose={() => setShowAuthModal(false)}
                />
            )}
        </div>
    );
};

export default MetricsDashboard;
