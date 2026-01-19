import React, { useState } from 'react';
import { TrustTierBadge } from './TrustTierBadge';
import { TrustScoreGauge } from './TrustScoreGauge';
import { AgentControlPanel } from './AgentControlPanel';
import { Agent, BlackboardEntry, getAgentCapabilities, SKILLS } from '../types';

/**
 * Agent Profile Page
 *
 * Detailed view of an agent with trust history, capabilities,
 * activity log, and relationship to other agents.
 */

interface CommandResponse {
    command: string;
    response: string;
    timestamp: string;
}

interface AgentProfilePageProps {
    agent: Agent;
    allAgents: Agent[];
    blackboardEntries: BlackboardEntry[];
    onClose: () => void;
    onViewAgent?: (agentId: string) => void;
    onSendCommand?: (command: string) => Promise<CommandResponse | null>;
    onEvaluateAutonomy?: (agentId: string) => void;
    onPauseAgent?: (agentId: string) => void;
    onResumeAgent?: (agentId: string) => void;
    onDeleteAgent?: (agentId: string) => void;
    onReassignAgent?: (agentId: string) => void;
    onEditPermissions?: (agentId: string) => void;
    // Trust is built through actions, not manual adjustment
    onOpenTaskQueue?: () => void;
}

const AGENT_ICONS: Record<string, string> = {
    EXECUTOR: '🎖️',
    PLANNER: '🧠',
    VALIDATOR: '🛡️',
    EVOLVER: '🧬',
    SPAWNER: '🏭',
    LISTENER: '👂',
    WORKER: '🤖',
    SITTER: '👔',
    SPECIALIST: '🔬',
    ORCHESTRATOR: '🎯',
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
    IDLE: { bg: 'rgba(107, 114, 128, 0.2)', color: 'var(--text-muted)' },
    WORKING: { bg: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-green)' },
    IN_MEETING: { bg: 'rgba(59, 130, 246, 0.2)', color: 'var(--accent-blue)' },
    ERROR: { bg: 'rgba(239, 68, 68, 0.2)', color: 'var(--accent-red)' },
};

export const AgentProfilePage: React.FC<AgentProfilePageProps> = ({
    agent,
    allAgents,
    blackboardEntries,
    onClose,
    onViewAgent,
    onSendCommand,
    onEvaluateAutonomy,
    onPauseAgent,
    onResumeAgent,
    onDeleteAgent,
    onReassignAgent,
    onEditPermissions,
    onOpenTaskQueue,
}) => {
    const [commandHistory, setCommandHistory] = useState<CommandResponse[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    const icon = AGENT_ICONS[agent.type] || '🤖';
    const statusStyle = STATUS_COLORS[agent.status] || STATUS_COLORS.IDLE;

    // Get agent's blackboard entries
    const agentEntries = blackboardEntries.filter(e => e.author === agent.id);

    // Get parent agent
    const parentAgent = agent.parentId ? allAgents.find(a => a.id === agent.parentId) : null;

    // Child agents - not displayed in profile (shown in spawn flows instead)

    // Get sibling agents (same parent)
    const siblingAgents = agent.parentId
        ? allAgents.filter(a => a.parentId === agent.parentId && a.id !== agent.id)
        : [];

    // Get sitter agent (T4 SITTER type if exists)
    const sitterAgent = allAgents.find(a => a.type === 'SITTER' && a.tier >= 4);

    // Build delegation chain
    const buildDelegationChain = (agentId: string, chain: Agent[] = []): Agent[] => {
        const a = allAgents.find(ag => ag.id === agentId);
        if (!a) return chain;
        chain.unshift(a);
        if (a.parentId) {
            return buildDelegationChain(a.parentId, chain);
        }
        return chain;
    };
    const delegationChain = buildDelegationChain(agent.id);

    // Get related agents (same location)
    const relatedAgents = allAgents.filter(a =>
        a.id !== agent.id &&
        a.parentId !== agent.id &&
        a.id !== agent.parentId &&
        a.location.room === agent.location.room
    ).slice(0, 5);

    // Calculate trust progress to next tier
    const tierThresholds = [0, 200, 400, 600, 800, 950];
    const currentTierMin = tierThresholds[agent.tier] || 0;
    const nextTierMin = tierThresholds[agent.tier + 1] || 1000;
    const progress = ((agent.trustScore - currentTierMin) / (nextTierMin - currentTierMin)) * 100;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '800px', maxHeight: '90vh' }}
                role="dialog"
                aria-labelledby="agent-profile-title"
            >
                {/* Header */}
                <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            background: `linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary))`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '2rem',
                            border: `3px solid ${statusStyle.color}`,
                        }}>
                            {icon}
                        </div>
                        <div>
                            <h2 id="agent-profile-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {agent.name}
                                <TrustTierBadge tier={agent.tier} size="medium" />
                            </h2>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                <span style={{
                                    fontFamily: 'var(--font-mono)',
                                    background: 'var(--bg-tertiary)',
                                    padding: '2px 8px',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'var(--accent-cyan)',
                                    fontSize: '0.75rem',
                                    marginRight: '8px',
                                }}>
                                    ID: {agent.structuredId || agent.id.slice(0, 8)}
                                </span>
                                {agent.type} • {agent.location.floor} / {agent.location.room}
                            </div>
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                marginTop: '8px',
                                padding: '4px 12px',
                                borderRadius: 'var(--radius-full)',
                                background: statusStyle.bg,
                                color: statusStyle.color,
                                fontSize: '0.75rem',
                                fontWeight: 600,
                            }}>
                                <span style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: statusStyle.color,
                                    animation: agent.status === 'WORKING' ? 'pulse 2s infinite' : 'none',
                                }} />
                                {agent.status}
                            </div>
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose} aria-label="Close">✕</button>
                </div>

                <div className="modal-content" style={{ overflowY: 'auto', maxHeight: '70vh' }}>
                    {/* Hierarchy & Delegation Section */}
                    <div style={{
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '20px',
                        marginBottom: '20px',
                    }}>
                        <h3 style={{ fontSize: '0.9rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🏛️ Hierarchy & Delegation
                        </h3>

                        {/* Delegation Chain Visualization */}
                        {delegationChain.length > 1 && (
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                    Delegation Chain:
                                </div>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    flexWrap: 'wrap',
                                    padding: '12px',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-md)',
                                }}>
                                    <span style={{
                                        padding: '4px 8px',
                                        background: 'rgba(139, 92, 246, 0.2)',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.75rem',
                                        color: 'var(--accent-purple)',
                                    }}>
                                        👤 HITL
                                    </span>
                                    {sitterAgent && (
                                        <>
                                            <span style={{ color: 'var(--text-muted)' }}>→</span>
                                            <span
                                                onClick={() => onViewAgent?.(sitterAgent.id)}
                                                style={{
                                                    padding: '4px 8px',
                                                    background: 'rgba(245, 158, 11, 0.2)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    fontSize: '0.75rem',
                                                    color: 'var(--accent-yellow)',
                                                    cursor: onViewAgent ? 'pointer' : 'default',
                                                }}
                                            >
                                                👔 Sitter
                                            </span>
                                        </>
                                    )}
                                    {delegationChain.map((a) => (
                                        <React.Fragment key={a.id}>
                                            <span style={{ color: 'var(--text-muted)' }}>→</span>
                                            <span
                                                onClick={() => a.id !== agent.id && onViewAgent?.(a.id)}
                                                style={{
                                                    padding: '4px 8px',
                                                    background: a.id === agent.id
                                                        ? 'rgba(16, 185, 129, 0.3)'
                                                        : 'rgba(59, 130, 246, 0.2)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    fontSize: '0.75rem',
                                                    color: a.id === agent.id ? 'var(--accent-green)' : 'var(--accent-blue)',
                                                    cursor: a.id !== agent.id && onViewAgent ? 'pointer' : 'default',
                                                    fontWeight: a.id === agent.id ? 600 : 400,
                                                    border: a.id === agent.id ? '1px solid var(--accent-green)' : 'none',
                                                }}
                                            >
                                                {AGENT_ICONS[a.type] || '🤖'} {a.name}
                                            </span>
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Parent, Sitter, Children Grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '12px',
                        }}>
                            {/* Parent Agent */}
                            <div style={{
                                padding: '12px',
                                background: 'var(--bg-tertiary)',
                                borderRadius: 'var(--radius-md)',
                                borderLeft: '3px solid var(--accent-blue)',
                            }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                                    ⬆️ PARENT
                                </div>
                                {parentAgent ? (
                                    <div
                                        onClick={() => onViewAgent?.(parentAgent.id)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            cursor: onViewAgent ? 'pointer' : 'default',
                                        }}
                                    >
                                        <span style={{ fontSize: '1.2rem' }}>{AGENT_ICONS[parentAgent.type] || '🤖'}</span>
                                        <div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{parentAgent.name}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                T{parentAgent.tier} {parentAgent.type}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                        None (Root Level)
                                    </div>
                                )}
                            </div>

                            {/* Sitter Agent */}
                            <div style={{
                                padding: '12px',
                                background: 'var(--bg-tertiary)',
                                borderRadius: 'var(--radius-md)',
                                borderLeft: '3px solid var(--accent-yellow)',
                            }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                                    👔 SITTER (Deputy)
                                </div>
                                {sitterAgent ? (
                                    <div
                                        onClick={() => onViewAgent?.(sitterAgent.id)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            cursor: onViewAgent ? 'pointer' : 'default',
                                        }}
                                    >
                                        <span style={{ fontSize: '1.2rem' }}>👔</span>
                                        <div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{sitterAgent.name}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                T{sitterAgent.tier} • Handles routine approvals
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                        Not assigned
                                    </div>
                                )}
                            </div>

                            {/* Children - removed from profile, shown in spawn flows instead */}
                        </div>

                        {/* Siblings */}
                        {siblingAgents.length > 0 && (
                            <div style={{ marginTop: '12px' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                                    👥 SIBLINGS ({siblingAgents.length}):
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {siblingAgents.slice(0, 6).map(sibling => (
                                        <span
                                            key={sibling.id}
                                            onClick={() => onViewAgent?.(sibling.id)}
                                            style={{
                                                padding: '4px 10px',
                                                background: 'var(--bg-tertiary)',
                                                borderRadius: 'var(--radius-sm)',
                                                fontSize: '0.75rem',
                                                cursor: onViewAgent ? 'pointer' : 'default',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                            }}
                                        >
                                            {AGENT_ICONS[sibling.type] || '🤖'} {sibling.name}
                                            <TrustTierBadge tier={sibling.tier} size="small" />
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Trust Score Section - Enhanced with Gauge */}
                    <div style={{
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '24px',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '24px',
                    }}>
                        {/* Animated Gauge */}
                        <TrustScoreGauge
                            score={agent.trustScore}
                            trend={agent.trustScore >= 800 ? 'rising' : agent.trustScore < 400 ? 'falling' : 'stable'}
                            size="large"
                            showLabel={true}
                            animated={true}
                        />

                        {/* Progress to Next Tier */}
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                Progress to Next Tier
                            </div>
                            <div style={{
                                height: '10px',
                                background: 'rgba(255,255,255,0.1)',
                                borderRadius: '5px',
                                overflow: 'hidden',
                                marginBottom: '8px',
                            }}>
                                <div style={{
                                    width: `${Math.min(progress, 100)}%`,
                                    height: '100%',
                                    background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-purple))',
                                    borderRadius: '5px',
                                    transition: 'width 0.5s ease',
                                    boxShadow: '0 0 10px rgba(139, 92, 246, 0.4)',
                                }} />
                            </div>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '0.75rem',
                            }}>
                                <span style={{ color: 'var(--text-muted)' }}>
                                    {agent.tier < 5 ? `${Math.round(progress)}% complete` : '✨ Max Tier'}
                                </span>
                                <span style={{ color: 'var(--accent-purple)', fontWeight: 600 }}>
                                    {agent.tier < 5 ? `+${nextTierMin - agent.trustScore} to T${agent.tier + 1}` : 'ELITE'}
                                </span>
                            </div>

                            {/* Capabilities Grid */}
                            <div style={{ marginTop: '16px' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                    🎮 Capabilities
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {getAgentCapabilities(agent.tier, agent.trustScore).map(cap => (
                                        <div
                                            key={cap.id}
                                            title={`${cap.name}: ${cap.description}${cap.enabled ? '' : ` (Requires T${cap.requiredTier}${cap.requiredTrust ? ` + Trust ${cap.requiredTrust}+` : ''})`}`}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '8px 12px',
                                                background: cap.enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                                                borderRadius: 'var(--radius-sm)',
                                                fontSize: '0.8rem',
                                                opacity: cap.enabled ? 1 : 0.5,
                                                border: cap.enabled ? '1px solid var(--accent-green)' : '1px solid var(--border-color)',
                                            }}
                                        >
                                            <span style={{ fontSize: '1rem' }}>{cap.icon}</span>
                                            <span style={{ fontWeight: 500, color: cap.enabled ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                                                {cap.name}
                                            </span>
                                            <span style={{ fontSize: '0.7rem', color: cap.enabled ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                                                {cap.enabled ? '✓' : '✗'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Skills */}
                            {agent.skills && agent.skills.length > 0 && (
                                <div style={{ marginTop: '16px' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                        🎯 Skills & Specializations
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {agent.skills.map(skillId => {
                                            const skill = SKILLS[skillId];
                                            if (!skill) return null;
                                            return (
                                                <div
                                                    key={skillId}
                                                    title={skill.description}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        padding: '6px 10px',
                                                        background: 'rgba(139, 92, 246, 0.15)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        fontSize: '0.75rem',
                                                        border: '1px solid var(--accent-purple)',
                                                    }}
                                                >
                                                    <span>{skill.icon}</span>
                                                    <span style={{ fontWeight: 500, color: 'var(--accent-purple)' }}>
                                                        {skill.name}
                                                    </span>
                                                    <span style={{
                                                        fontSize: '0.6rem',
                                                        padding: '2px 4px',
                                                        background: 'rgba(255,255,255,0.1)',
                                                        borderRadius: '3px',
                                                        color: 'var(--text-muted)',
                                                    }}>
                                                        {skill.category}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>

                    {/* Agent Control Panel */}
                    <AgentControlPanel
                        agent={agent}
                        onPause={onPauseAgent}
                        onResume={onResumeAgent}
                        onEvaluateAutonomy={onEvaluateAutonomy}
                        onReassign={onReassignAgent}
                        onEditPermissions={onEditPermissions}
                        onDelete={onDeleteAgent}
                        onOpenTaskQueue={onOpenTaskQueue}
                    />

                    {/* Stats Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                        gap: '12px',
                        marginBottom: '20px',
                    }}>
                        <div style={{
                            textAlign: 'center',
                            padding: '16px',
                            background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-md)',
                        }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                                {agentEntries.length}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>CONTRIBUTIONS</div>
                        </div>
                        <div style={{
                            textAlign: 'center',
                            padding: '16px',
                            background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-md)',
                        }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-green)' }}>
                                {agentEntries.filter(e => e.status === 'RESOLVED').length}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>RESOLVED</div>
                        </div>
                        <div style={{
                            textAlign: 'center',
                            padding: '16px',
                            background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-md)',
                        }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
                                T{agent.tier}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>TIER</div>
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div style={{
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '20px',
                        marginBottom: '20px',
                    }}>
                        <h3 style={{ fontSize: '0.9rem', marginBottom: '12px' }}>📋 Recent Activity</h3>
                        {agentEntries.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {agentEntries.slice(0, 5).map(entry => (
                                    <div key={entry.id} style={{
                                        padding: '10px 12px',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-sm)',
                                        borderLeft: '3px solid var(--accent-blue)',
                                        fontSize: '0.8rem',
                                    }}>
                                        <div style={{ fontWeight: 500 }}>{entry.title}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            {entry.type} • {entry.status}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '16px' }}>
                                No recent activity
                            </div>
                        )}
                    </div>

                    {/* Related Agents */}
                    {relatedAgents.length > 0 && (
                        <div style={{
                            background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '20px',
                            marginBottom: '20px',
                        }}>
                            <h3 style={{ fontSize: '0.9rem', marginBottom: '12px' }}>👥 Nearby Agents</h3>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {relatedAgents.map(a => (
                                    <div
                                        key={a.id}
                                        onClick={() => onViewAgent?.(a.id)}
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
                                        <span>{AGENT_ICONS[a.type] || '🤖'}</span>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{a.name}</span>
                                        <TrustTierBadge tier={a.tier} size="small" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Command Input */}
                    {onSendCommand && (
                        <div style={{
                            background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '20px',
                        }}>
                            <h3 style={{ fontSize: '0.9rem', marginBottom: '12px' }}>💬 Send Command</h3>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    placeholder="Enter command..."
                                    disabled={isProcessing}
                                    style={{
                                        flex: 1,
                                        padding: '10px 14px',
                                        background: 'var(--bg-tertiary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.85rem',
                                        opacity: isProcessing ? 0.6 : 1,
                                    }}
                                    onKeyDown={async e => {
                                        if (e.key === 'Enter' && e.currentTarget.value.trim() && !isProcessing) {
                                            const cmd = e.currentTarget.value.trim();
                                            e.currentTarget.value = '';
                                            setIsProcessing(true);
                                            const response = await onSendCommand(cmd);
                                            if (response) {
                                                setCommandHistory(prev => [response, ...prev].slice(0, 5));
                                            }
                                            setIsProcessing(false);
                                        }
                                    }}
                                    aria-label="Command input"
                                />
                                <button
                                    className="btn btn-primary"
                                    disabled={isProcessing}
                                    style={{ opacity: isProcessing ? 0.6 : 1 }}
                                    onClick={async e => {
                                        const input = (e.currentTarget.previousSibling as HTMLInputElement);
                                        if (input.value.trim() && !isProcessing) {
                                            const cmd = input.value.trim();
                                            input.value = '';
                                            setIsProcessing(true);
                                            const response = await onSendCommand(cmd);
                                            if (response) {
                                                setCommandHistory(prev => [response, ...prev].slice(0, 5));
                                            }
                                            setIsProcessing(false);
                                        }
                                    }}
                                >
                                    {isProcessing ? '⏳' : 'Send'}
                                </button>
                            </div>

                            {/* Command Response History */}
                            {commandHistory.length > 0 && (
                                <div style={{ marginTop: '16px' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '8px', color: 'var(--accent-green)' }}>
                                        📨 Response:
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {commandHistory.map((item, idx) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    padding: '12px',
                                                    background: idx === 0 ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-tertiary)',
                                                    borderRadius: 'var(--radius-md)',
                                                    borderLeft: `3px solid ${idx === 0 ? 'var(--accent-green)' : 'var(--border-color)'}`,
                                                    opacity: idx === 0 ? 1 : 0.6,
                                                }}
                                            >
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'monospace' }}>
                                                    &gt; {item.command}
                                                </div>
                                                <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                                                    {item.response}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {/* Available Commands */}
                            <div style={{
                                marginTop: '16px',
                                padding: '12px',
                                background: 'var(--bg-tertiary)',
                                borderRadius: 'var(--radius-md)',
                                borderLeft: '3px solid var(--accent-cyan)',
                            }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '8px', color: 'var(--accent-cyan)' }}>
                                    📋 Available Commands:
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {[
                                        { cmd: 'status', desc: 'Check current status' },
                                        { cmd: 'report', desc: 'Generate activity report' },
                                        { cmd: 'pause', desc: 'Pause current task' },
                                        { cmd: 'resume', desc: 'Resume paused task' },
                                        { cmd: 'prioritize <task>', desc: 'Set task priority' },
                                        { cmd: 'collaborate <agent>', desc: 'Request collaboration' },
                                        { cmd: 'review', desc: 'Request trust review' },
                                        { cmd: 'help', desc: 'Show all commands' },
                                    ].map(({ cmd, desc }) => (
                                        <div
                                            key={cmd}
                                            title={desc}
                                            style={{
                                                padding: '4px 10px',
                                                background: 'rgba(255,255,255,0.05)',
                                                borderRadius: 'var(--radius-sm)',
                                                fontSize: '0.7rem',
                                                fontFamily: 'monospace',
                                                color: 'var(--text-secondary)',
                                                cursor: 'pointer',
                                                transition: 'background 0.15s ease',
                                            }}
                                            onClick={() => {
                                                const input = document.querySelector<HTMLInputElement>('input[aria-label="Command input"]');
                                                if (input) {
                                                    input.value = cmd;
                                                    input.focus();
                                                }
                                            }}
                                            onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                                            onMouseOut={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                                        >
                                            {cmd}
                                        </div>
                                    ))}
                                </div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                                    💡 Click a command to insert it, or type your own custom command
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AgentProfilePage;
