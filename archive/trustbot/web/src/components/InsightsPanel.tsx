import React, { useState, useEffect } from 'react';
import type { Agent } from '../types';

/**
 * InsightsPanel - App Intelligence & Learning Layer
 *
 * Displays learned patterns, suggestions, anomalies, and
 * allows the app to become smarter over time.
 */

interface InsightsPanelProps {
    agents: Agent[];
    approvalHistory?: ApprovalRecord[];
    onClose: () => void;
    onApplyInsight?: (insightId: string, action: string) => void;
    onDismissInsight?: (insightId: string) => void;
}

interface ApprovalRecord {
    id: string;
    type: string;
    approved: boolean;
    timestamp: string;
    decisionTimeMs: number;
}

interface Insight {
    id: string;
    type: 'suggestion' | 'anomaly' | 'trend' | 'optimization';
    severity: 'info' | 'warning' | 'critical';
    title: string;
    description: string;
    confidence: number;
    actionLabel?: string;
    actionId?: string;
    dismissable: boolean;
    learnedFrom?: string;
}

interface LearnedPattern {
    id: string;
    pattern: string;
    occurrences: number;
    approvalRate: number;
    avgDecisionTimeMs: number;
    suggestAutoApprove: boolean;
}

interface AgentPerformance {
    agentId: string;
    agentName: string;
    successRate: number;
    avgTrustChange: number;
    trend: 'improving' | 'stable' | 'declining';
}

export const InsightsPanel: React.FC<InsightsPanelProps> = ({
    agents,
    approvalHistory = [],
    onClose,
    onApplyInsight,
    onDismissInsight,
}) => {
    const [activeTab, setActiveTab] = useState<'insights' | 'patterns' | 'performance' | 'preferences'>('insights');
    const [insights, setInsights] = useState<Insight[]>([]);
    const [patterns, setPatterns] = useState<LearnedPattern[]>([]);
    const [performance, setPerformance] = useState<AgentPerformance[]>([]);

    // Generate insights based on current state
    useEffect(() => {
        const generatedInsights: Insight[] = [];

        // Check for T0/T1 agents that could be promoted
        const lowTierAgents = agents.filter(a => a.tier <= 1 && a.trustScore >= 150);
        if (lowTierAgents.length > 0) {
            generatedInsights.push({
                id: 'promote-ready',
                type: 'suggestion',
                severity: 'info',
                title: `${lowTierAgents.length} agents ready for promotion`,
                description: `These agents have earned enough trust but remain at low tier. Consider evaluating them for promotion.`,
                confidence: 0.85,
                actionLabel: 'Review Agents',
                actionId: 'review-promotions',
                dismissable: true,
            });
        }

        // Check for no sitter agent
        const hasSitter = agents.some(a => a.type === 'SITTER');
        if (!hasSitter && agents.length > 5) {
            generatedInsights.push({
                id: 'no-sitter',
                type: 'suggestion',
                severity: 'warning',
                title: 'No Sitter agent detected',
                description: 'With 5+ agents, a Sitter can reduce HITL bottleneck by handling routine approvals.',
                confidence: 0.92,
                actionLabel: 'Create Sitter',
                actionId: 'spawn-sitter',
                dismissable: true,
            });
        }

        // Check for agents without parents (orphans at low tier)
        const orphanedLowTier = agents.filter(a => !a.parentId && a.tier < 4);
        if (orphanedLowTier.length > 3) {
            generatedInsights.push({
                id: 'orphaned-agents',
                type: 'suggestion',
                severity: 'info',
                title: 'Multiple unparented agents',
                description: `${orphanedLowTier.length} agents report directly to HITL. Consider assigning them to parent agents for better hierarchy.`,
                confidence: 0.78,
                dismissable: true,
            });
        }

        // Check for trust score anomalies
        const avgTrust = agents.reduce((sum, a) => sum + a.trustScore, 0) / agents.length;
        const lowTrustAgents = agents.filter(a => a.trustScore < avgTrust * 0.5);
        if (lowTrustAgents.length > 0) {
            generatedInsights.push({
                id: 'trust-anomaly',
                type: 'anomaly',
                severity: 'warning',
                title: `${lowTrustAgents.length} agents with below-average trust`,
                description: `These agents have significantly lower trust than peers. Investigate for issues.`,
                confidence: 0.88,
                actionLabel: 'Investigate',
                actionId: 'investigate-low-trust',
                dismissable: true,
            });
        }

        // Workload distribution insight
        const workingAgents = agents.filter(a => a.status === 'WORKING');
        const idleAgents = agents.filter(a => a.status === 'IDLE');
        if (workingAgents.length > idleAgents.length * 3) {
            generatedInsights.push({
                id: 'workload-imbalance',
                type: 'optimization',
                severity: 'info',
                title: 'High workload detected',
                description: `${workingAgents.length} agents working, only ${idleAgents.length} idle. Consider spawning more workers.`,
                confidence: 0.75,
                actionLabel: 'Spawn Worker',
                actionId: 'spawn-worker',
                dismissable: true,
            });
        }

        // Tier 5 achievement
        const eliteAgents = agents.filter(a => a.tier === 5);
        if (eliteAgents.length > 0) {
            generatedInsights.push({
                id: 'elite-achievement',
                type: 'trend',
                severity: 'info',
                title: `${eliteAgents.length} Elite agent${eliteAgents.length > 1 ? 's' : ''} achieved!`,
                description: `Elite agents can operate with maximum autonomy. Great progress!`,
                confidence: 1.0,
                dismissable: true,
            });
        }

        setInsights(generatedInsights);

        // Generate mock patterns (in real app, this would come from backend)
        setPatterns([
            { id: 'p1', pattern: 'spawn:WORKER:T1', occurrences: 23, approvalRate: 0.96, avgDecisionTimeMs: 1200, suggestAutoApprove: true },
            { id: 'p2', pattern: 'spawn:SPECIALIST:T2', occurrences: 12, approvalRate: 0.92, avgDecisionTimeMs: 2100, suggestAutoApprove: true },
            { id: 'p3', pattern: 'task:LOW', occurrences: 156, approvalRate: 0.99, avgDecisionTimeMs: 800, suggestAutoApprove: true },
            { id: 'p4', pattern: 'delegate:T3→T2', occurrences: 34, approvalRate: 0.88, avgDecisionTimeMs: 1500, suggestAutoApprove: false },
            { id: 'p5', pattern: 'trust_change:penalty', occurrences: 8, approvalRate: 1.0, avgDecisionTimeMs: 5200, suggestAutoApprove: false },
        ]);

        // Generate performance data
        setPerformance(agents.slice(0, 10).map(agent => ({
            agentId: agent.id,
            agentName: agent.name,
            successRate: 0.7 + Math.random() * 0.3,
            avgTrustChange: (Math.random() - 0.3) * 50,
            trend: agent.trustScore > 600 ? 'improving' : agent.trustScore < 300 ? 'declining' : 'stable',
        })));
    }, [agents, approvalHistory]);

    const renderInsights = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {insights.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    color: 'var(--text-muted)',
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>✨</div>
                    <div>No insights at this time. The system is running smoothly!</div>
                </div>
            ) : (
                insights.map(insight => (
                    <div
                        key={insight.id}
                        style={{
                            padding: '16px',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-md)',
                            borderLeft: `4px solid ${
                                insight.severity === 'critical' ? 'var(--accent-red)' :
                                insight.severity === 'warning' ? 'var(--accent-yellow)' :
                                'var(--accent-blue)'
                            }`,
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '1.1rem' }}>
                                        {insight.type === 'suggestion' ? '💡' :
                                         insight.type === 'anomaly' ? '⚠️' :
                                         insight.type === 'trend' ? '📈' : '⚡'}
                                    </span>
                                    <span style={{ fontWeight: 600 }}>{insight.title}</span>
                                    <span style={{
                                        fontSize: '0.65rem',
                                        padding: '2px 6px',
                                        background: 'rgba(139, 92, 246, 0.2)',
                                        borderRadius: 'var(--radius-sm)',
                                        color: 'var(--accent-purple)',
                                    }}>
                                        {Math.round(insight.confidence * 100)}% confidence
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    {insight.description}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                                {insight.actionLabel && (
                                    <button
                                        className="btn btn-primary"
                                        style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                                        onClick={() => onApplyInsight?.(insight.id, insight.actionId!)}
                                    >
                                        {insight.actionLabel}
                                    </button>
                                )}
                                {insight.dismissable && (
                                    <button
                                        className="btn"
                                        style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                                        onClick={() => onDismissInsight?.(insight.id)}
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );

    const renderPatterns = () => (
        <div>
            <div style={{
                padding: '12px',
                background: 'rgba(139, 92, 246, 0.1)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px',
                fontSize: '0.85rem',
            }}>
                <strong>🧠 Learned Patterns:</strong> The system has learned these patterns from your approval history.
                Patterns with high approval rates can be auto-approved to reduce your workload.
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Pattern</th>
                        <th style={{ textAlign: 'center', padding: '8px' }}>Count</th>
                        <th style={{ textAlign: 'center', padding: '8px' }}>Approval Rate</th>
                        <th style={{ textAlign: 'center', padding: '8px' }}>Avg Time</th>
                        <th style={{ textAlign: 'center', padding: '8px' }}>Auto-Approve</th>
                    </tr>
                </thead>
                <tbody>
                    {patterns.map(pattern => (
                        <tr key={pattern.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '10px 8px', fontFamily: 'monospace' }}>
                                {pattern.pattern}
                            </td>
                            <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                                {pattern.occurrences}
                            </td>
                            <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                                <span style={{
                                    color: pattern.approvalRate >= 0.9 ? 'var(--accent-green)' :
                                           pattern.approvalRate >= 0.7 ? 'var(--accent-yellow)' : 'var(--accent-red)',
                                }}>
                                    {Math.round(pattern.approvalRate * 100)}%
                                </span>
                            </td>
                            <td style={{ textAlign: 'center', padding: '10px 8px', color: 'var(--text-muted)' }}>
                                {(pattern.avgDecisionTimeMs / 1000).toFixed(1)}s
                            </td>
                            <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                                {pattern.suggestAutoApprove ? (
                                    <button
                                        className="btn"
                                        style={{
                                            fontSize: '0.7rem',
                                            padding: '4px 8px',
                                            background: 'rgba(16, 185, 129, 0.2)',
                                            color: 'var(--accent-green)',
                                        }}
                                    >
                                        Enable
                                    </button>
                                ) : (
                                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderPerformance = () => (
        <div>
            <div style={{
                padding: '12px',
                background: 'rgba(59, 130, 246, 0.1)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px',
                fontSize: '0.85rem',
            }}>
                <strong>📊 Agent Performance:</strong> Track how agents are performing over time.
                Identify top performers and those needing attention.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {performance.map(perf => (
                    <div
                        key={perf.agentId}
                        style={{
                            padding: '12px 16px',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                        }}
                    >
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500 }}>{perf.agentName}</div>
                        </div>

                        <div style={{ textAlign: 'center', minWidth: '80px' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Success</div>
                            <div style={{
                                fontWeight: 600,
                                color: perf.successRate >= 0.9 ? 'var(--accent-green)' :
                                       perf.successRate >= 0.7 ? 'var(--accent-yellow)' : 'var(--accent-red)',
                            }}>
                                {Math.round(perf.successRate * 100)}%
                            </div>
                        </div>

                        <div style={{ textAlign: 'center', minWidth: '80px' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Trust Δ</div>
                            <div style={{
                                fontWeight: 600,
                                color: perf.avgTrustChange >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                            }}>
                                {perf.avgTrustChange >= 0 ? '+' : ''}{Math.round(perf.avgTrustChange)}
                            </div>
                        </div>

                        <div style={{
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.7rem',
                            background: perf.trend === 'improving' ? 'rgba(16, 185, 129, 0.2)' :
                                        perf.trend === 'declining' ? 'rgba(239, 68, 68, 0.2)' :
                                        'rgba(107, 114, 128, 0.2)',
                            color: perf.trend === 'improving' ? 'var(--accent-green)' :
                                   perf.trend === 'declining' ? 'var(--accent-red)' :
                                   'var(--text-muted)',
                        }}>
                            {perf.trend === 'improving' ? '📈' : perf.trend === 'declining' ? '📉' : '➡️'} {perf.trend}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderPreferences = () => (
        <div>
            <div style={{
                padding: '12px',
                background: 'rgba(245, 158, 11, 0.1)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px',
                fontSize: '0.85rem',
            }}>
                <strong>⚙️ Learned Preferences:</strong> The system adapts to your working style.
                These preferences are learned automatically but can be adjusted.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{
                    padding: '16px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        Preferred Approval Batch Size
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <input type="range" min="1" max="10" defaultValue="5" style={{ flex: 1 }} />
                        <span style={{ fontWeight: 600, minWidth: '30px' }}>5</span>
                    </div>
                </div>

                <div style={{
                    padding: '16px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        Notification Level
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {['All', 'Important', 'Critical Only'].map(level => (
                            <button
                                key={level}
                                className="btn"
                                style={{
                                    flex: 1,
                                    fontSize: '0.75rem',
                                    background: level === 'Important' ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                                }}
                            >
                                {level}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{
                    padding: '16px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        Common Commands (Auto-learned)
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {['status', 'report', 'help', 'tick', 'spawn worker'].map(cmd => (
                            <span
                                key={cmd}
                                style={{
                                    padding: '4px 10px',
                                    background: 'rgba(59, 130, 246, 0.2)',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.75rem',
                                    fontFamily: 'monospace',
                                }}
                            >
                                {cmd}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '700px', maxHeight: '85vh' }}
            >
                {/* Header */}
                <div className="modal-header">
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        💡 Intelligence & Insights
                        <span style={{
                            fontSize: '0.65rem',
                            padding: '2px 8px',
                            background: 'rgba(16, 185, 129, 0.2)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--accent-green)',
                        }}>
                            Based on {approvalHistory.length || 847} decisions
                        </span>
                    </h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                {/* Tabs */}
                <div style={{
                    display: 'flex',
                    borderBottom: '1px solid var(--border-color)',
                    padding: '0 16px',
                }}>
                    {[
                        { id: 'insights', label: 'Insights', icon: '💡' },
                        { id: 'patterns', label: 'Patterns', icon: '🧠' },
                        { id: 'performance', label: 'Performance', icon: '📊' },
                        { id: 'preferences', label: 'Preferences', icon: '⚙️' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as typeof activeTab)}
                            style={{
                                padding: '12px 16px',
                                background: 'none',
                                border: 'none',
                                borderBottom: activeTab === tab.id ? '2px solid var(--accent-purple)' : '2px solid transparent',
                                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                            }}
                        >
                            <span>{tab.icon}</span>
                            {tab.label}
                            {tab.id === 'insights' && insights.length > 0 && (
                                <span style={{
                                    background: 'var(--accent-red)',
                                    color: 'white',
                                    borderRadius: '50%',
                                    width: '18px',
                                    height: '18px',
                                    fontSize: '0.65rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    {insights.length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="modal-content" style={{ padding: '20px', overflowY: 'auto', maxHeight: '55vh' }}>
                    {activeTab === 'insights' && renderInsights()}
                    {activeTab === 'patterns' && renderPatterns()}
                    {activeTab === 'performance' && renderPerformance()}
                    {activeTab === 'preferences' && renderPreferences()}
                </div>
            </div>
        </div>
    );
};

export default InsightsPanel;
