/**
 * Agent Card - Interactive card for the agent roster
 * 
 * Like a video game character card:
 * - Avatar/icon
 * - Name and type
 * - Trust score meter
 * - Capability pills (8 icons with ✓/✗)
 * - Status light (🟢 working, 🟡 idle, 🔴 stopped)
 * - Quick action buttons
 */
import { Agent, getAgentCapabilities } from '../types';
import './AgentCard.css';

interface AgentCardProps {
    agent: Agent;
    onClick: () => void;
    onQuickAction?: (action: 'pause' | 'resume' | 'tick') => void;
}

export function AgentCard({ agent, onClick, onQuickAction }: AgentCardProps) {
    const getStatusLight = () => {
        switch (agent.status) {
            case 'WORKING': return { emoji: '🟢', label: 'Working', color: 'var(--accent-green)' };
            case 'IDLE': return { emoji: '🟡', label: 'Idle', color: 'var(--accent-gold)' };
            case 'IN_MEETING': return { emoji: '🟠', label: 'In Meeting', color: 'var(--accent-orange)' };
            case 'ERROR': return { emoji: '🔴', label: 'Error', color: 'var(--accent-red)' };
            case 'TERMINATED': return { emoji: '⚫', label: 'Terminated', color: 'var(--text-muted)' };
            default: return { emoji: '⚪', label: String(agent.status), color: 'var(--text-muted)' };
        }
    };

    const getTierBadge = () => {
        const tiers = ['', 'T1', 'T2', 'T3', 'T4', 'T5'];
        const tier = tiers[agent.tier] || `T${agent.tier}`;
        const labels = ['', 'Worker', 'Specialist', 'Lead', 'Executive', 'Architect'];
        return { tier, label: labels[agent.tier] || '' };
    };

    const getTrustColor = () => {
        if (agent.trustScore >= 80) return 'var(--accent-green)';
        if (agent.trustScore >= 50) return 'var(--accent-gold)';
        if (agent.trustScore >= 25) return 'var(--accent-orange)';
        return 'var(--accent-red)';
    };

    const getTypeIcon = () => {
        const icons: Record<string, string> = {
            'PLANNER': '🧠',
            'WORKER': '⚙️',
            'EXECUTOR': '⚡',
            'VALIDATOR': '✅',
            'SPAWNER': '🥚',
            'EVOLVER': '🔄',
            'LISTENER': '👂',
            'SITTER': '🛋️',
            'SPECIALIST': '🎯',
            'ORCHESTRATOR': '🎭',
        };
        return icons[agent.type] || '🤖';
    };

    const status = getStatusLight();
    const tierInfo = getTierBadge();
    const trustColor = getTrustColor();
    const capabilities = getAgentCapabilities(agent.tier, agent.trustScore);

    return (
        <div className="agent-card" onClick={onClick}>
            {/* Status light in corner */}
            <div className="agent-card__status" title={status.label}>
                <span className="agent-card__status-dot" style={{ background: status.color }} />
                <span className="agent-card__status-label">{status.label}</span>
            </div>

            {/* Tier badge */}
            <div className="agent-card__tier" title={tierInfo.label}>
                {tierInfo.tier}
            </div>

            {/* Avatar area */}
            <div className="agent-card__avatar">
                <span className="agent-card__avatar-icon">
                    {getTypeIcon()}
                </span>
            </div>

            {/* Name and type */}
            <h3 className="agent-card__name">{agent.name}</h3>
            <p className="agent-card__type">{agent.type}</p>

            {/* Trust Score Meter */}
            <div className="agent-card__trust">
                <div className="trust-meter">
                    <div className="trust-meter__bar">
                        <div 
                            className="trust-meter__fill"
                            style={{ 
                                width: `${agent.trustScore}%`,
                                background: trustColor 
                            }}
                        />
                    </div>
                    <span className="trust-meter__value" style={{ color: trustColor }}>
                        {agent.trustScore}
                    </span>
                </div>
                <span className="agent-card__trust-label">Trust Score</span>
            </div>

            {/* Capability Pills */}
            <div className="agent-card__capabilities">
                {capabilities.map(cap => (
                    <span
                        key={cap.id}
                        className={`cap-pill ${cap.enabled ? 'cap-pill--enabled' : 'cap-pill--disabled'}`}
                        title={`${cap.name}: ${cap.description} ${cap.enabled ? '✓' : '✗'}`}
                    >
                        {cap.icon}
                    </span>
                ))}
            </div>

            {/* Quick Actions */}
            <div className="agent-card__actions">
                {agent.status === 'WORKING' || agent.status === 'IDLE' ? (
                    <button
                        className="agent-card__action-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            onQuickAction?.(agent.status === 'WORKING' ? 'pause' : 'resume');
                        }}
                        title={agent.status === 'WORKING' ? 'Pause' : 'Resume'}
                    >
                        {agent.status === 'WORKING' ? '⏸️' : '▶️'}
                    </button>
                ) : null}
                <button
                    className="agent-card__action-btn agent-card__action-btn--view"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClick();
                    }}
                    title="View Details"
                >
                    👁️
                </button>
            </div>
        </div>
    );
}

