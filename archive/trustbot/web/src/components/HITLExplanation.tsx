import React from 'react';

/**
 * HITL (Human-in-the-Loop) Explanation Modal
 * 
 * Explains the governance levels and what each HITL percentage means
 * for the autonomous agent system.
 */

interface HITLExplanationProps {
    currentLevel: number;
    onClose: () => void;
}

const HITL_LEVELS = [
    {
        range: '80-100%',
        name: 'Full Human Oversight',
        icon: '🔒',
        color: 'var(--accent-gold)',
        description: 'All agent decisions require human approval. Maximum safety, minimum autonomy.',
        metrics: [
            'All task completions reviewed',
            'No autonomous spending',
            'All communications moderated',
            'Full audit trail required',
        ],
    },
    {
        range: '50-79%',
        name: 'Shared Governance',
        icon: '🔓',
        color: 'var(--accent-green)',
        description: 'Major decisions need approval; routine tasks run autonomously.',
        metrics: [
            'Critical tasks reviewed',
            'Budget limits: $100/decision',
            'External comms moderated',
            'Weekly audit summaries',
        ],
    },
    {
        range: '20-49%',
        name: 'Mostly Autonomous',
        icon: '🤖',
        color: 'var(--accent-blue)',
        description: 'Only critical decisions escalate. High autonomy with safety rails.',
        metrics: [
            'Only escalations reviewed',
            'Budget limits: $1000/decision',
            'Standard comms automated',
            'Daily audit reports',
        ],
    },
    {
        range: '0-19%',
        name: 'Full Autonomy',
        icon: '🚀',
        color: 'var(--accent-purple)',
        description: 'System operates independently. Maximum efficiency, human oversight on-demand.',
        metrics: [
            'Minimal human reviews',
            'High spending authority',
            'Full communication autonomy',
            'Continuous audit logging',
        ],
    },
];

export const HITLExplanation: React.FC<HITLExplanationProps> = ({ currentLevel, onClose }) => {
    const getCurrentLevelInfo = () => {
        if (currentLevel >= 80) return HITL_LEVELS[0];
        if (currentLevel >= 50) return HITL_LEVELS[1];
        if (currentLevel >= 20) return HITL_LEVELS[2];
        return HITL_LEVELS[3];
    };

    const currentInfo = getCurrentLevelInfo();

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                <div className="modal-header">
                    <h2>👤 HITL Governance Explained</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="modal-content">
                    {/* Current Level Highlight */}
                    <div style={{
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '20px',
                        marginBottom: '20px',
                        borderLeft: `4px solid ${currentInfo.color}`,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '2rem' }}>{currentInfo.icon}</span>
                            <div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: currentInfo.color }}>
                                    {currentLevel}%
                                </div>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                    Current: {currentInfo.name}
                                </div>
                            </div>
                        </div>
                        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                            {currentInfo.description}
                        </p>
                    </div>

                    {/* All Levels */}
                    <h3 style={{ marginBottom: '16px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        ALL GOVERNANCE LEVELS
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {HITL_LEVELS.map((level, idx) => (
                            <div
                                key={idx}
                                style={{
                                    padding: '16px',
                                    background: level.range === currentInfo.range ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-md)',
                                    border: level.range === currentInfo.range ? '1px solid var(--accent-blue)' : '1px solid transparent',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span>{level.icon}</span>
                                        <span style={{ fontWeight: 600, color: level.color }}>{level.name}</span>
                                    </div>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                        {level.range}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                    {level.description}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {level.metrics.map((metric, mIdx) => (
                                        <span
                                            key={mIdx}
                                            style={{
                                                fontSize: '0.65rem',
                                                padding: '2px 8px',
                                                background: 'rgba(255,255,255,0.05)',
                                                borderRadius: '4px',
                                                color: 'var(--text-muted)',
                                            }}
                                        >
                                            {metric}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HITLExplanation;
