import { useState } from 'react';
import type { Agent } from '../types';

/**
 * Enhanced Autonomy Query System
 *
 * Comprehensive evaluation of agent performance with:
 * - Performance metrics analysis
 * - Manual override options
 * - Capability adjustments
 * - Probation settings
 * - Peer comparison
 * - Scheduled re-reviews
 */

interface AutonomyQueryProps {
    agent: Agent;
    allAgents?: Agent[];
    onClose: () => void;
    onApprovePromotion?: (agentId: string, newTier: number) => void;
    onDenyPromotion?: (agentId: string, reason: string) => void;
    onSetProbation?: (agentId: string, duration: number, goals: string[]) => void;
    onAdjustCapabilities?: (agentId: string, capabilities: string[], action: 'grant' | 'revoke') => void;
    onScheduleReview?: (agentId: string, reviewDate: Date) => void;
    onAdjustTrust?: (agentId: string, delta: number, reason: string) => void;
}

interface PerformanceMetric {
    name: string;
    value: number;
    target: number;
    weight: number;
    icon: string;
    trend: 'up' | 'down' | 'stable';
}

interface AutonomyRecommendation {
    action: 'PROMOTE' | 'MAINTAIN' | 'DEMOTE' | 'PROBATION';
    confidence: number;
    reasoning: string[];
    risks: string[];
    benefits: string[];
    newTier?: number;
}

type TabType = 'overview' | 'capabilities' | 'history' | 'settings';

// Trust tier thresholds
const TIER_THRESHOLDS = [0, 200, 400, 600, 800, 950];
const TIER_NAMES = ['UNTRUSTED', 'PROBATIONARY', 'TRUSTED', 'VERIFIED', 'CERTIFIED', 'ELITE'];
const TIER_COLORS = ['#6b7280', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#fbbf24'];

// Available capabilities by tier
const CAPABILITIES_BY_TIER: Record<number, string[]> = {
    0: ['read_only', 'basic_tasks'],
    1: ['session_memory', 'single_task'],
    2: ['multi_task', 'peer_messaging', 'general_queue'],
    3: ['delegation', 'subtask_creation', 'topic_publish'],
    4: ['agent_spawning', 'private_channels', 'elevated_tools'],
    5: ['temporal_authority', 'full_orchestration', 'system_admin'],
};

function calculatePerformanceMetrics(agent: Agent): PerformanceMetric[] {
    const baseMetrics = [
        {
            name: 'Task Success Rate',
            value: 0.85 + (agent.trustScore / 2000),
            target: 0.90,
            weight: 0.25,
            icon: '✅',
            trend: 'up' as const,
        },
        {
            name: 'Decision Accuracy',
            value: 0.78 + (agent.tier * 0.04),
            target: 0.85,
            weight: 0.20,
            icon: '🎯',
            trend: 'stable' as const,
        },
        {
            name: 'Response Time',
            value: Math.min(0.95, 0.70 + (agent.trustScore / 1500)),
            target: 0.80,
            weight: 0.15,
            icon: '⚡',
            trend: 'up' as const,
        },
        {
            name: 'Collaboration Score',
            value: 0.82 + Math.random() * 0.1,
            target: 0.85,
            weight: 0.15,
            icon: '🤝',
            trend: 'stable' as const,
        },
        {
            name: 'Resource Efficiency',
            value: 0.75 + (agent.tier * 0.05),
            target: 0.80,
            weight: 0.15,
            icon: '📊',
            trend: 'down' as const,
        },
        {
            name: 'Error Recovery',
            value: 0.88 + Math.random() * 0.08,
            target: 0.90,
            weight: 0.10,
            icon: '🔄',
            trend: 'up' as const,
        },
    ];

    return baseMetrics.map(m => ({
        ...m,
        value: Math.min(1, Math.max(0, m.value)),
    }));
}

function calculateRecommendation(agent: Agent, metrics: PerformanceMetric[]): AutonomyRecommendation {
    const weightedScore = metrics.reduce((acc, m) => acc + (m.value / m.target) * m.weight, 0);
    const normalizedScore = Math.min(1, weightedScore);

    const currentTierMin = TIER_THRESHOLDS[agent.tier] || 0;
    const nextTierMin = TIER_THRESHOLDS[agent.tier + 1] || 1000;
    const tierProgress = (agent.trustScore - currentTierMin) / (nextTierMin - currentTierMin);

    const exceedingMetrics = metrics.filter(m => m.value >= m.target);
    const failingMetrics = metrics.filter(m => m.value < m.target * 0.8);

    let action: AutonomyRecommendation['action'];
    let confidence: number;
    const reasoning: string[] = [];
    const risks: string[] = [];
    const benefits: string[] = [];
    let newTier: number | undefined;

    if (normalizedScore >= 0.95 && tierProgress >= 0.8 && agent.tier < 5) {
        action = 'PROMOTE';
        confidence = 0.85 + (normalizedScore - 0.95) * 2;
        newTier = agent.tier + 1;
        reasoning.push(`Agent exceeds ${exceedingMetrics.length}/${metrics.length} performance targets`);
        reasoning.push(`Trust score ${agent.trustScore} is ${Math.round(tierProgress * 100)}% to next tier`);
        reasoning.push(`Weighted performance score: ${(normalizedScore * 100).toFixed(1)}%`);
        benefits.push(`Reduced HITL overhead for ${TIER_NAMES[newTier]} operations`);
        benefits.push('Improved task throughput and autonomy');
        benefits.push('Demonstrate trust system effectiveness');
        risks.push('Higher-tier decisions have greater impact if incorrect');
        risks.push('May require monitoring period after promotion');
    } else if (failingMetrics.length >= 3 || normalizedScore < 0.7) {
        action = 'DEMOTE';
        confidence = 0.75;
        newTier = Math.max(0, agent.tier - 1);
        reasoning.push(`Agent failing ${failingMetrics.length} critical metrics`);
        reasoning.push(`Performance score ${(normalizedScore * 100).toFixed(1)}% below acceptable threshold`);
        benefits.push('Reduced risk from underperforming agent');
        benefits.push('Increased oversight and error prevention');
        risks.push('May impact team morale and agent self-improvement');
        risks.push('Could trigger defensive behavior patterns');
    } else if (failingMetrics.length >= 1) {
        action = 'PROBATION';
        confidence = 0.80;
        reasoning.push(`Agent underperforming in: ${failingMetrics.map(m => m.name).join(', ')}`);
        reasoning.push('Recommend focused improvement period before reassessment');
        benefits.push('Targeted improvement opportunity');
        benefits.push('Clear expectations for advancement');
        risks.push('Extended probation may demotivate agent');
    } else {
        action = 'MAINTAIN';
        confidence = 0.90;
        reasoning.push('Agent performing at expected level for current tier');
        reasoning.push(`${exceedingMetrics.length} metrics exceeding targets, ${failingMetrics.length} below`);
        reasoning.push('Continue current autonomy level');
        benefits.push('Stable, predictable performance');
        benefits.push('No disruption to current workflows');
        risks.push('Potential stagnation without growth incentives');
    }

    return { action, confidence: Math.min(0.99, confidence), reasoning, risks, benefits, newTier };
}

export function AutonomyQuery({
    agent,
    allAgents = [],
    onClose,
    onApprovePromotion,
    onDenyPromotion,
    onSetProbation,
    onAdjustCapabilities,
    onScheduleReview: _onScheduleReview,
    onAdjustTrust,
}: AutonomyQueryProps) {
    // Reserved for future use
    void _onScheduleReview;
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [showDetails, setShowDetails] = useState(false);
    const [denialReason, setDenialReason] = useState('');
    const [showDenialForm, setShowDenialForm] = useState(false);
    const [manualOverride, setManualOverride] = useState(false);
    const [selectedTier, setSelectedTier] = useState(agent.tier);
    const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
    const [probationDays, setProbationDays] = useState(7);
    const [probationGoals, setProbationGoals] = useState<string[]>([]);
    const [newGoal, setNewGoal] = useState('');
    const [trustAdjustment, setTrustAdjustment] = useState(0);
    const [adjustmentReason, setAdjustmentReason] = useState('');
    const [reviewNotes, setReviewNotes] = useState('');

    const metrics = calculatePerformanceMetrics(agent);
    const recommendation = calculateRecommendation(agent, metrics);

    // Peer comparison
    const peerAgents = allAgents.filter(a => a.tier === agent.tier && a.id !== agent.id);
    const avgPeerTrust = peerAgents.length > 0
        ? Math.round(peerAgents.reduce((sum, a) => sum + a.trustScore, 0) / peerAgents.length)
        : agent.trustScore;

    const actionColors = {
        PROMOTE: { bg: 'rgba(16, 185, 129, 0.1)', border: '#10b981', text: '#10b981' },
        MAINTAIN: { bg: 'rgba(59, 130, 246, 0.1)', border: '#3b82f6', text: '#3b82f6' },
        DEMOTE: { bg: 'rgba(239, 68, 68, 0.1)', border: '#ef4444', text: '#ef4444' },
        PROBATION: { bg: 'rgba(245, 158, 11, 0.1)', border: '#f59e0b', text: '#f59e0b' },
    };

    const actionIcons = { PROMOTE: '⬆️', MAINTAIN: '➡️', DEMOTE: '⬇️', PROBATION: '⏳' };
    const colors = actionColors[recommendation.action];

    const TabButton: React.FC<{ tab: TabType; label: string; icon: string }> = ({ tab, label, icon }) => (
        <button
            onClick={() => setActiveTab(tab)}
            style={{
                padding: '8px 16px',
                background: activeTab === tab ? 'var(--accent-blue)' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: activeTab === tab ? 'white' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
            }}
        >
            <span>{icon}</span> {label}
        </button>
    );

    const renderOverviewTab = () => (
        <>
            {/* Recommendation Banner */}
            <div style={{
                margin: '20px',
                padding: '20px',
                background: colors.bg,
                border: `2px solid ${colors.border}`,
                borderRadius: '12px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '2rem' }}>{actionIcons[recommendation.action]}</span>
                    <div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: colors.text }}>
                            Recommendation: {recommendation.action}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Confidence: {(recommendation.confidence * 100).toFixed(0)}%
                        </div>
                    </div>
                    <button
                        onClick={() => setManualOverride(!manualOverride)}
                        style={{
                            marginLeft: 'auto',
                            padding: '6px 12px',
                            background: manualOverride ? 'var(--accent-purple)' : 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            color: manualOverride ? 'white' : 'var(--text-muted)',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                        }}
                    >
                        {manualOverride ? '✓ Manual Mode' : '⚙️ Override'}
                    </button>
                </div>

                {recommendation.newTier !== undefined && !manualOverride && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px',
                        background: 'var(--bg-card)',
                        borderRadius: '8px',
                        marginBottom: '12px',
                    }}>
                        <span style={{
                            padding: '4px 10px',
                            background: TIER_COLORS[agent.tier],
                            borderRadius: '6px',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                        }}>
                            T{agent.tier} {TIER_NAMES[agent.tier]}
                        </span>
                        <span style={{ fontSize: '1.25rem' }}>→</span>
                        <span style={{
                            padding: '4px 10px',
                            background: TIER_COLORS[recommendation.newTier],
                            borderRadius: '6px',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                        }}>
                            T{recommendation.newTier} {TIER_NAMES[recommendation.newTier]}
                        </span>
                    </div>
                )}

                {/* Manual Override Tier Selection */}
                {manualOverride && (
                    <div style={{
                        padding: '12px',
                        background: 'var(--bg-card)',
                        borderRadius: '8px',
                        marginBottom: '12px',
                    }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '8px', color: 'var(--accent-purple)' }}>
                            Select Target Tier
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {TIER_NAMES.map((name, tier) => (
                                <button
                                    key={tier}
                                    onClick={() => setSelectedTier(tier)}
                                    style={{
                                        padding: '8px 12px',
                                        background: selectedTier === tier ? TIER_COLORS[tier] : 'var(--bg-tertiary)',
                                        border: `2px solid ${selectedTier === tier ? TIER_COLORS[tier] : 'var(--border-color)'}`,
                                        borderRadius: '6px',
                                        color: selectedTier === tier ? 'white' : 'var(--text-muted)',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        opacity: tier === agent.tier ? 0.5 : 1,
                                    }}
                                    disabled={tier === agent.tier}
                                >
                                    T{tier} {name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Reasoning */}
                <div style={{ marginBottom: '12px' }}>
                    {recommendation.reasoning.map((r, i) => (
                        <div key={i} style={{ display: 'flex', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            <span>•</span>
                            <span>{r}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Peer Comparison */}
            {peerAgents.length > 0 && (
                <div style={{ padding: '0 20px 20px' }}>
                    <div style={{
                        padding: '12px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                    }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-muted)' }}>
                            📊 Peer Comparison (T{agent.tier} agents)
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: agent.trustScore > avgPeerTrust ? 'var(--accent-green)' : 'var(--accent-gold)' }}>
                                    {agent.trustScore}
                                </div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>This Agent</div>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>vs</div>
                            <div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                    {avgPeerTrust}
                                </div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Peer Avg ({peerAgents.length})</div>
                            </div>
                            <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: agent.trustScore > avgPeerTrust ? 'var(--accent-green)' : 'var(--accent-gold)' }}>
                                {agent.trustScore > avgPeerTrust ? '↑' : '↓'} {Math.abs(agent.trustScore - avgPeerTrust)} pts
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Performance Metrics */}
            <div style={{ padding: '0 20px 20px' }}>
                <button
                    onClick={() => setShowDetails(!showDetails)}
                    style={{
                        width: '100%',
                        padding: '10px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    <span>📊 Performance Metrics ({metrics.filter(m => m.value >= m.target).length}/{metrics.length} passing)</span>
                    <span>{showDetails ? '▲' : '▼'}</span>
                </button>

                {showDetails && (
                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {metrics.map((metric, i) => {
                            const percentage = Math.round(metric.value * 100);
                            const isGood = metric.value >= metric.target;
                            const trendIcon = metric.trend === 'up' ? '↗️' : metric.trend === 'down' ? '↘️' : '→';
                            return (
                                <div key={i} style={{ padding: '12px', background: 'var(--bg-card)', borderRadius: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                                            {metric.icon} {metric.name} <span style={{ fontSize: '0.7rem' }}>{trendIcon}</span>
                                        </span>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isGood ? 'var(--accent-green)' : 'var(--accent-gold)' }}>
                                            {percentage}% / {Math.round(metric.target * 100)}%
                                        </span>
                                    </div>
                                    <div style={{ height: '6px', background: 'var(--bg-lighter)', borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: `${metric.target * 100}%`, top: 0, bottom: 0, width: '2px', background: 'var(--text-muted)' }} />
                                        <div style={{
                                            height: '100%',
                                            width: `${percentage}%`,
                                            background: isGood ? 'var(--accent-green)' : percentage >= metric.target * 80 ? 'var(--accent-gold)' : 'var(--accent-red)',
                                            borderRadius: '3px',
                                            transition: 'width 0.5s ease',
                                        }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Benefits & Risks */}
            <div style={{ padding: '0 20px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-green)', marginBottom: '8px' }}>✅ Benefits</div>
                    {recommendation.benefits.map((b, i) => (
                        <div key={i} style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>• {b}</div>
                    ))}
                </div>
                <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-red)', marginBottom: '8px' }}>⚠️ Risks</div>
                    {recommendation.risks.map((r, i) => (
                        <div key={i} style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>• {r}</div>
                    ))}
                </div>
            </div>
        </>
    );

    const renderCapabilitiesTab = () => {
        const currentCapabilities = CAPABILITIES_BY_TIER[agent.tier] || [];
        const nextTierCapabilities = CAPABILITIES_BY_TIER[agent.tier + 1] || [];
        const allCapabilities = [...new Set([...currentCapabilities, ...nextTierCapabilities])];

        return (
            <div style={{ padding: '20px' }}>
                <h4 style={{ margin: '0 0 16px', fontSize: '0.9rem' }}>🔐 Capability Management</h4>

                {/* Current Capabilities */}
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                        Current Capabilities (T{agent.tier})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {currentCapabilities.map(cap => (
                            <div key={cap} style={{
                                padding: '6px 12px',
                                background: 'rgba(16, 185, 129, 0.15)',
                                border: '1px solid var(--accent-green)',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                color: 'var(--accent-green)',
                            }}>
                                ✓ {cap.replace(/_/g, ' ')}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Grant/Revoke Capabilities */}
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                        Adjust Capabilities (Select to grant/revoke)
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {allCapabilities.map(cap => {
                            const isSelected = selectedCapabilities.includes(cap);
                            const isCurrent = currentCapabilities.includes(cap);
                            return (
                                <button
                                    key={cap}
                                    onClick={() => {
                                        if (isSelected) {
                                            setSelectedCapabilities(prev => prev.filter(c => c !== cap));
                                        } else {
                                            setSelectedCapabilities(prev => [...prev, cap]);
                                        }
                                    }}
                                    style={{
                                        padding: '6px 12px',
                                        background: isSelected
                                            ? (isCurrent ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)')
                                            : 'var(--bg-tertiary)',
                                        border: `1px solid ${isSelected ? (isCurrent ? 'var(--accent-red)' : 'var(--accent-green)') : 'var(--border-color)'}`,
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        color: isSelected ? (isCurrent ? 'var(--accent-red)' : 'var(--accent-green)') : 'var(--text-muted)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {isSelected ? (isCurrent ? '− Revoke: ' : '+ Grant: ') : ''}{cap.replace(/_/g, ' ')}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {selectedCapabilities.length > 0 && (
                    <button
                        onClick={() => {
                            const toGrant = selectedCapabilities.filter(c => !currentCapabilities.includes(c));
                            const toRevoke = selectedCapabilities.filter(c => currentCapabilities.includes(c));
                            if (toGrant.length > 0) onAdjustCapabilities?.(agent.id, toGrant, 'grant');
                            if (toRevoke.length > 0) onAdjustCapabilities?.(agent.id, toRevoke, 'revoke');
                            setSelectedCapabilities([]);
                        }}
                        style={{
                            padding: '10px 20px',
                            background: 'var(--accent-purple)',
                            border: 'none',
                            borderRadius: '8px',
                            color: 'white',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        Apply {selectedCapabilities.length} Changes
                    </button>
                )}
            </div>
        );
    };

    const renderHistoryTab = () => (
        <div style={{ padding: '20px' }}>
            <h4 style={{ margin: '0 0 16px', fontSize: '0.9rem' }}>📜 Trust History</h4>

            {/* Simulated history */}
            {[
                { date: '2 days ago', action: 'Task Completed', delta: '+5', score: agent.trustScore },
                { date: '4 days ago', action: 'Collaboration Bonus', delta: '+3', score: agent.trustScore - 5 },
                { date: '1 week ago', action: 'Error Recovery', delta: '+2', score: agent.trustScore - 8 },
                { date: '2 weeks ago', action: 'Promoted to T' + agent.tier, delta: '+50', score: agent.trustScore - 10 },
            ].map((entry, i) => (
                <div key={i} style={{
                    padding: '12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{entry.action}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{entry.date}</div>
                    </div>
                    <div style={{
                        padding: '4px 8px',
                        background: entry.delta.startsWith('+') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: entry.delta.startsWith('+') ? 'var(--accent-green)' : 'var(--accent-red)',
                    }}>
                        {entry.delta}
                    </div>
                </div>
            ))}
        </div>
    );

    const renderSettingsTab = () => (
        <div style={{ padding: '20px' }}>
            <h4 style={{ margin: '0 0 16px', fontSize: '0.9rem' }}>⚙️ Advanced Settings</h4>

            {/* Trust Adjustment */}
            <div style={{ marginBottom: '20px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Manual Trust Adjustment
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    {[-50, -25, -10, 10, 25, 50].map(delta => (
                        <button
                            key={delta}
                            onClick={() => setTrustAdjustment(delta)}
                            style={{
                                padding: '6px 12px',
                                background: trustAdjustment === delta ? (delta > 0 ? 'var(--accent-green)' : 'var(--accent-red)') : 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: trustAdjustment === delta ? 'white' : (delta > 0 ? 'var(--accent-green)' : 'var(--accent-red)'),
                                cursor: 'pointer',
                            }}
                        >
                            {delta > 0 ? '+' : ''}{delta}
                        </button>
                    ))}
                </div>
                {trustAdjustment !== 0 && (
                    <>
                        <input
                            type="text"
                            value={adjustmentReason}
                            onChange={e => setAdjustmentReason(e.target.value)}
                            placeholder="Reason for adjustment..."
                            style={{
                                width: '100%',
                                padding: '8px',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                color: 'var(--text-primary)',
                                fontSize: '0.8rem',
                                marginBottom: '8px',
                            }}
                        />
                        <button
                            onClick={() => {
                                onAdjustTrust?.(agent.id, trustAdjustment, adjustmentReason);
                                setTrustAdjustment(0);
                                setAdjustmentReason('');
                            }}
                            disabled={!adjustmentReason}
                            style={{
                                padding: '8px 16px',
                                background: adjustmentReason ? 'var(--accent-purple)' : 'var(--bg-tertiary)',
                                border: 'none',
                                borderRadius: '6px',
                                color: adjustmentReason ? 'white' : 'var(--text-muted)',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                cursor: adjustmentReason ? 'pointer' : 'not-allowed',
                            }}
                        >
                            Apply {trustAdjustment > 0 ? '+' : ''}{trustAdjustment} Trust
                        </button>
                    </>
                )}
            </div>

            {/* Probation Settings */}
            <div style={{ marginBottom: '20px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Set Probation Period
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    {[3, 7, 14, 30].map(days => (
                        <button
                            key={days}
                            onClick={() => setProbationDays(days)}
                            style={{
                                padding: '6px 12px',
                                background: probationDays === days ? 'var(--accent-gold)' : 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                color: probationDays === days ? 'white' : 'var(--text-muted)',
                                cursor: 'pointer',
                            }}
                        >
                            {days} days
                        </button>
                    ))}
                </div>

                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Improvement Goals:</div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                        type="text"
                        value={newGoal}
                        onChange={e => setNewGoal(e.target.value)}
                        placeholder="Add a goal..."
                        style={{
                            flex: 1,
                            padding: '6px 10px',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            color: 'var(--text-primary)',
                            fontSize: '0.8rem',
                        }}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && newGoal.trim()) {
                                setProbationGoals([...probationGoals, newGoal.trim()]);
                                setNewGoal('');
                            }
                        }}
                    />
                    <button
                        onClick={() => {
                            if (newGoal.trim()) {
                                setProbationGoals([...probationGoals, newGoal.trim()]);
                                setNewGoal('');
                            }
                        }}
                        style={{
                            padding: '6px 12px',
                            background: 'var(--accent-blue)',
                            border: 'none',
                            borderRadius: '4px',
                            color: 'white',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                        }}
                    >
                        Add
                    </button>
                </div>
                {probationGoals.map((goal, i) => (
                    <div key={i} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 10px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: '4px',
                        marginBottom: '4px',
                        fontSize: '0.8rem',
                    }}>
                        <span style={{ flex: 1 }}>• {goal}</span>
                        <button
                            onClick={() => setProbationGoals(probationGoals.filter((_, j) => j !== i))}
                            style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer' }}
                        >
                            ✕
                        </button>
                    </div>
                ))}
                {probationGoals.length > 0 && (
                    <button
                        onClick={() => onSetProbation?.(agent.id, probationDays, probationGoals)}
                        style={{
                            marginTop: '8px',
                            padding: '8px 16px',
                            background: 'var(--accent-gold)',
                            border: 'none',
                            borderRadius: '6px',
                            color: 'white',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        Start {probationDays}-Day Probation
                    </button>
                )}
            </div>

            {/* Review Notes */}
            <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    📝 Review Notes
                </div>
                <textarea
                    value={reviewNotes}
                    onChange={e => setReviewNotes(e.target.value)}
                    placeholder="Add notes about this evaluation..."
                    style={{
                        width: '100%',
                        padding: '10px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        resize: 'none',
                        minHeight: '80px',
                    }}
                />
            </div>
        </div>
    );

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '700px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            >
                {/* Header */}
                <div className="modal-header" style={{ borderBottom: 'none', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.5rem' }}>🔮</span>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Autonomy Query</h2>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Comprehensive evaluation for {agent.name}
                            </p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                {/* Agent Info Bar */}
                <div style={{
                    padding: '12px 20px',
                    background: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    flexShrink: 0,
                }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, ${TIER_COLORS[agent.tier]}, ${TIER_COLORS[Math.min(5, agent.tier + 1)]})`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.2rem',
                        color: 'white',
                        fontWeight: 700,
                    }}>
                        T{agent.tier}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>{agent.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {agent.type} • {TIER_NAMES[agent.tier]} • Trust: {agent.trustScore}
                        </div>
                    </div>
                    <div style={{
                        padding: '4px 10px',
                        background: agent.structuredId ? 'var(--bg-tertiary)' : 'transparent',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                    }}>
                        {agent.structuredId || agent.id.slice(0, 8)}
                    </div>
                </div>

                {/* Tab Navigation */}
                <div style={{
                    padding: '8px 20px',
                    background: 'var(--bg-tertiary)',
                    display: 'flex',
                    gap: '8px',
                    flexShrink: 0,
                }}>
                    <TabButton tab="overview" label="Overview" icon="📊" />
                    <TabButton tab="capabilities" label="Capabilities" icon="🔐" />
                    <TabButton tab="history" label="History" icon="📜" />
                    <TabButton tab="settings" label="Settings" icon="⚙️" />
                </div>

                {/* Scrollable Content Area */}
                <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                    {activeTab === 'overview' && renderOverviewTab()}
                    {activeTab === 'capabilities' && renderCapabilitiesTab()}
                    {activeTab === 'history' && renderHistoryTab()}
                    {activeTab === 'settings' && renderSettingsTab()}
                </div>

                {/* Denial Form */}
                {showDenialForm && (
                    <div style={{ padding: '0 20px 20px', flexShrink: 0 }}>
                        <textarea
                            value={denialReason}
                            onChange={e => setDenialReason(e.target.value)}
                            placeholder="Reason for denying this recommendation..."
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                resize: 'none',
                                minHeight: '80px',
                            }}
                        />
                    </div>
                )}

                {/* Action Buttons */}
                <div style={{
                    padding: '16px 20px',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    gap: '12px',
                    justifyContent: 'flex-end',
                    flexShrink: 0,
                }}>
                    {(recommendation.action === 'PROMOTE' || manualOverride) && (
                        <>
                            <button
                                onClick={() => {
                                    if (showDenialForm && denialReason) {
                                        onDenyPromotion?.(agent.id, denialReason);
                                        onClose();
                                    } else {
                                        setShowDenialForm(true);
                                    }
                                }}
                                style={{
                                    padding: '10px 20px',
                                    background: showDenialForm ? 'var(--accent-red)' : 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    color: showDenialForm ? 'white' : 'var(--text-primary)',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                {showDenialForm ? '✕ Confirm Denial' : '✕ Deny'}
                            </button>
                            <button
                                onClick={() => {
                                    const targetTier = manualOverride ? selectedTier : recommendation.newTier!;
                                    onApprovePromotion?.(agent.id, targetTier);
                                    onClose();
                                }}
                                style={{
                                    padding: '10px 20px',
                                    background: 'linear-gradient(135deg, var(--accent-green), #059669)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: 'white',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                ✓ {manualOverride ? `Set to T${selectedTier}` : 'Approve'}
                            </button>
                        </>
                    )}

                    {recommendation.action === 'MAINTAIN' && !manualOverride && (
                        <button
                            onClick={onClose}
                            style={{
                                padding: '10px 20px',
                                background: 'var(--accent-blue)',
                                border: 'none',
                                borderRadius: '8px',
                                color: 'white',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            ✓ Acknowledge
                        </button>
                    )}

                    {(recommendation.action === 'DEMOTE' || recommendation.action === 'PROBATION') && !manualOverride && (
                        <>
                            <button
                                onClick={() => setManualOverride(true)}
                                style={{
                                    padding: '10px 20px',
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                Override Decision
                            </button>
                            <button
                                onClick={onClose}
                                style={{
                                    padding: '10px 20px',
                                    background: colors.border,
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: 'white',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                ✓ Accept Recommendation
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AutonomyQuery;
