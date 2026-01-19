import React from 'react';
import { TrustTierBadge } from './TrustTierBadge';
import type { Agent } from '../types';

/**
 * Trust Breakdown Modal
 * 
 * Explains the trust score calculation and shows breakdown by tier.
 */

interface TrustBreakdownModalProps {
    agents: Agent[];
    avgTrust: number;
    onClose: () => void;
}

const TIER_CONFIG = [
    { tier: 5, name: 'ELITE', min: 950, max: 1000, color: '#ffd700' },
    { tier: 4, name: 'CERTIFIED', min: 800, max: 949, color: '#aa44ff' },
    { tier: 3, name: 'VERIFIED', min: 600, max: 799, color: '#00cc88' },
    { tier: 2, name: 'TRUSTED', min: 400, max: 599, color: '#44aaff' },
    { tier: 1, name: 'PROBATIONARY', min: 200, max: 399, color: '#ff8c00' },
    { tier: 0, name: 'UNTRUSTED', min: 0, max: 199, color: '#ff4444' },
];

export const TrustBreakdownModal: React.FC<TrustBreakdownModalProps> = ({ agents, avgTrust, onClose }) => {
    // Count agents by tier
    const agentCounts = TIER_CONFIG.map(config => ({
        ...config,
        count: agents.filter(a => a.tier === config.tier).length,
    }));

    // Calculate weighted average formula display
    const totalAgents = agents.length || 1;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                <div className="modal-header">
                    <h2>📊 Trust Score Breakdown</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="modal-content">
                    {/* Average Display */}
                    <div style={{
                        textAlign: 'center',
                        padding: '24px',
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-lg)',
                        marginBottom: '24px',
                    }}>
                        <div style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
                            {avgTrust}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Average Trust Score
                        </div>
                    </div>

                    {/* Equation */}
                    <div style={{
                        background: 'var(--bg-tertiary)',
                        padding: '16px',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '24px',
                        fontFamily: 'monospace',
                        fontSize: '0.85rem',
                        textAlign: 'center',
                    }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>Trust Score Formula:</div>
                        <div style={{ color: 'var(--accent-cyan)' }}>
                            Avg = Σ(agent.trustScore) / totalAgents
                        </div>
                        <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Score Range: 0-1000 | Tier thresholds determine capabilities
                        </div>
                    </div>

                    {/* Tier Breakdown */}
                    <h3 style={{ marginBottom: '16px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        AGENTS BY TRUST TIER
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {agentCounts.map(tier => {
                            const percentage = totalAgents > 0 ? (tier.count / totalAgents) * 100 : 0;
                            return (
                                <div
                                    key={tier.tier}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px',
                                        background: 'var(--bg-secondary)',
                                        borderRadius: 'var(--radius-md)',
                                    }}
                                >
                                    {/* Tier Badge */}
                                    <TrustTierBadge tier={tier.tier} size="small" />

                                    {/* Bar */}
                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            height: '8px',
                                            background: 'rgba(255,255,255,0.1)',
                                            borderRadius: '4px',
                                            overflow: 'hidden',
                                        }}>
                                            <div style={{
                                                width: `${percentage}%`,
                                                height: '100%',
                                                background: tier.color,
                                                borderRadius: '4px',
                                                transition: 'width 0.3s ease',
                                            }} />
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            marginTop: '4px',
                                            fontSize: '0.65rem',
                                            color: 'var(--text-muted)',
                                        }}>
                                            <span>Score: {tier.min}-{tier.max}</span>
                                            <span>{percentage.toFixed(0)}%</span>
                                        </div>
                                    </div>

                                    {/* Count */}
                                    <div style={{
                                        minWidth: '40px',
                                        textAlign: 'right',
                                        fontWeight: 600,
                                        color: tier.color,
                                    }}>
                                        {tier.count}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Tier Capabilities */}
                    <div style={{
                        marginTop: '24px',
                        padding: '16px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                    }}>
                        <h4 style={{ marginBottom: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            TRUST TIER CAPABILITIES
                        </h4>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                            <div>👑 <strong>ELITE (950+)</strong>: Full system access, can spawn agents, broadcast messages</div>
                            <div>🏅 <strong>CERTIFIED (800-949)</strong>: Create channels, cross-tier messaging, high autonomy</div>
                            <div>✓✓ <strong>VERIFIED (600-799)</strong>: Publish to topics, message lower tiers, persistent memory</div>
                            <div>✓ <strong>TRUSTED (400-599)</strong>: Peer messaging, topic subscriptions, session memory</div>
                            <div>🔶 <strong>PROBATIONARY (200-399)</strong>: Supervisor messaging only, structured protocol</div>
                            <div>⛔ <strong>UNTRUSTED (0-199)</strong>: Receive only, no initiation, ephemeral memory</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrustBreakdownModal;
