import React, { useState } from 'react';
import { Tooltip } from './Tooltip';
import type { Agent } from '../types';

/**
 * Agent Control Panel
 *
 * Comprehensive control interface for managing agent state,
 * permissions, assignments, and lifecycle actions.
 */

interface AgentControlPanelProps {
    agent: Agent;
    onPause?: (agentId: string) => void;
    onResume?: (agentId: string) => void;
    onEvaluateAutonomy?: (agentId: string) => void;
    onReassign?: (agentId: string, newRole?: string, newLocation?: string) => void;
    onEditPermissions?: (agentId: string) => void;
    onDelete?: (agentId: string) => void;
    onTerminate?: (agentId: string) => void;
    // Trust is built through actions, not manual adjustment
    onOpenTaskQueue?: () => void;
}

interface ConfirmModalProps {
    title: string;
    message: string;
    confirmLabel: string;
    confirmColor: string;
    onConfirm: () => void;
    onCancel: () => void;
    requireReason?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    title,
    message,
    confirmLabel,
    confirmColor,
    onConfirm,
    onCancel,
    requireReason = false,
}) => {
    const [reason, setReason] = useState('');

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
            }}
            onClick={onCancel}
        >
            <div
                style={{
                    background: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '24px',
                    maxWidth: '400px',
                    width: '90%',
                    border: '1px solid var(--border-color)',
                }}
                onClick={e => e.stopPropagation()}
            >
                <h3 style={{ margin: '0 0 12px', fontSize: '1.1rem' }}>{title}</h3>
                <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {message}
                </p>

                {requireReason && (
                    <textarea
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder="Enter reason (required)..."
                        style={{
                            width: '100%',
                            padding: '10px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            resize: 'none',
                            minHeight: '60px',
                            marginBottom: '16px',
                        }}
                    />
                )}

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '8px 16px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            if (requireReason && !reason.trim()) return;
                            onConfirm();
                        }}
                        disabled={requireReason && !reason.trim()}
                        style={{
                            padding: '8px 16px',
                            background: confirmColor,
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            color: 'white',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: requireReason && !reason.trim() ? 'not-allowed' : 'pointer',
                            opacity: requireReason && !reason.trim() ? 0.5 : 1,
                        }}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const AgentControlPanel: React.FC<AgentControlPanelProps> = ({
    agent,
    onPause,
    onResume,
    onEvaluateAutonomy,
    onReassign,
    onEditPermissions,
    onDelete,
    onTerminate,
    onOpenTaskQueue,
}) => {
    const [confirmAction, setConfirmAction] = useState<{
        type: 'delete' | 'terminate' | 'pause' | 'demote' | null;
        title: string;
        message: string;
        confirmLabel: string;
        confirmColor: string;
        onConfirm: () => void;
        requireReason?: boolean;
    } | null>(null);

    const isPaused = agent.status === 'IDLE' || agent.status === 'TERMINATED';
    const isWorking = agent.status === 'WORKING';

    const ActionButton: React.FC<{
        icon: string;
        label: string;
        tooltip: string;
        onClick: () => void;
        color?: string;
        disabled?: boolean;
        variant?: 'default' | 'danger' | 'success' | 'warning';
    }> = ({ icon, label, tooltip, onClick, disabled = false, variant = 'default' }) => {
        const variantStyles = {
            default: {
                bg: 'var(--bg-tertiary)',
                hoverBg: 'var(--bg-secondary)',
                border: 'var(--border-color)',
                color: 'var(--text-primary)',
            },
            danger: {
                bg: 'rgba(239, 68, 68, 0.1)',
                hoverBg: 'rgba(239, 68, 68, 0.2)',
                border: 'rgba(239, 68, 68, 0.3)',
                color: 'var(--accent-red)',
            },
            success: {
                bg: 'rgba(16, 185, 129, 0.1)',
                hoverBg: 'rgba(16, 185, 129, 0.2)',
                border: 'rgba(16, 185, 129, 0.3)',
                color: 'var(--accent-green)',
            },
            warning: {
                bg: 'rgba(245, 158, 11, 0.1)',
                hoverBg: 'rgba(245, 158, 11, 0.2)',
                border: 'rgba(245, 158, 11, 0.3)',
                color: 'var(--accent-gold)',
            },
        };

        const style = variantStyles[variant];

        return (
            <Tooltip title={label} content={tooltip} position="top">
                <button
                    onClick={onClick}
                    disabled={disabled}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '12px 16px',
                        background: style.bg,
                        border: `1px solid ${style.border}`,
                        borderRadius: 'var(--radius-md)',
                        color: style.color,
                        fontSize: '0.75rem',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.5 : 1,
                        transition: 'all 0.15s ease',
                        minWidth: '80px',
                    }}
                    onMouseOver={e => {
                        if (!disabled) {
                            e.currentTarget.style.background = style.hoverBg;
                        }
                    }}
                    onMouseOut={e => {
                        e.currentTarget.style.background = style.bg;
                    }}
                >
                    <span style={{ fontSize: '1.25rem' }}>{icon}</span>
                    <span style={{ fontWeight: 500 }}>{label}</span>
                </button>
            </Tooltip>
        );
    };

    return (
        <>
            <div style={{
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px',
                marginBottom: '20px',
            }}>
                <h3 style={{
                    fontSize: '0.9rem',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}>
                    <span>🎮</span> Agent Controls
                    <span style={{
                        marginLeft: 'auto',
                        fontSize: '0.7rem',
                        padding: '2px 8px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-muted)',
                    }}>
                        ID: {agent.structuredId || agent.id.slice(0, 8)}
                    </span>
                </h3>

                {/* Primary Actions Row */}
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '10px',
                    marginBottom: '16px',
                }}>
                    {/* Pause/Resume */}
                    {isWorking && onPause && (
                        <ActionButton
                            icon="⏸️"
                            label="Pause"
                            tooltip="Pause agent's current work. Can be resumed later."
                            onClick={() => setConfirmAction({
                                type: 'pause',
                                title: 'Pause Agent?',
                                message: `This will pause ${agent.name}'s current work. The agent can be resumed later.`,
                                confirmLabel: 'Pause Agent',
                                confirmColor: 'var(--accent-gold)',
                                onConfirm: () => {
                                    onPause(agent.id);
                                    setConfirmAction(null);
                                },
                            })}
                            variant="warning"
                        />
                    )}

                    {isPaused && onResume && (
                        <ActionButton
                            icon="▶️"
                            label="Resume"
                            tooltip="Resume agent's work from paused state."
                            onClick={() => onResume(agent.id)}
                            variant="success"
                        />
                    )}

                    {/* Evaluate Autonomy */}
                    {onEvaluateAutonomy && (
                        <ActionButton
                            icon="🔮"
                            label="Evaluate"
                            tooltip="Run autonomy evaluation to check if agent should be promoted or demoted."
                            onClick={() => onEvaluateAutonomy(agent.id)}
                        />
                    )}

                    {/* Reassign */}
                    {onReassign && (
                        <ActionButton
                            icon="🔄"
                            label="Reassign"
                            tooltip="Reassign agent to a different role, task, or location."
                            onClick={() => onReassign(agent.id)}
                        />
                    )}

                    {/* Edit Permissions */}
                    {onEditPermissions && (
                        <ActionButton
                            icon="🔐"
                            label="Permissions"
                            tooltip="View and modify agent's capabilities and access permissions."
                            onClick={() => onEditPermissions(agent.id)}
                        />
                    )}

                    {/* Task Queue */}
                    {onOpenTaskQueue && (
                        <ActionButton
                            icon="📋"
                            label="Tasks"
                            tooltip="View and manage agent's task queue. Add, remove, or reorder tasks."
                            onClick={onOpenTaskQueue}
                        />
                    )}

                    {/* Export */}
                    <ActionButton
                        icon="📤"
                        label="Export"
                        tooltip="Download agent as JSON file."
                        onClick={() => {
                            const data = JSON.stringify({
                                name: agent.name,
                                type: agent.type,
                                tier: agent.tier,
                                trustScore: agent.trustScore,
                                skills: agent.skills || [],
                                capabilities: agent.capabilities,
                                exportedAt: new Date().toISOString(),
                            }, null, 2);
                            const blob = new Blob([data], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${agent.name.toLowerCase().replace(/\s+/g, '-')}-agent.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                        }}
                    />

                    {/* Clone */}
                    <ActionButton
                        icon="🧬"
                        label="Clone"
                        tooltip="Create a copy with same skills. Trust starts at 0."
                        onClick={() => setConfirmAction({
                            type: 'pause',
                            title: `Clone ${agent.name}?`,
                            message: `Creates a new agent with the same skills and config. The clone starts at T0 with trust score 0.`,
                            confirmLabel: 'Clone Agent',
                            confirmColor: 'var(--accent-blue)',
                            onConfirm: () => {
                                alert(`🧬 Cloned! New agent "${agent.name} (Copy)" created.`);
                                setConfirmAction(null);
                            },
                        })}
                    />

                    {/* Embed */}
                    <ActionButton
                        icon="🔗"
                        label="Embed"
                        tooltip="Get embed code for your website."
                        onClick={() => {
                            const code = `<script src="https://aurais.ai/embed.js" data-agent="${agent.id}"></script>`;
                            navigator.clipboard.writeText(code);
                            alert('Embed code copied!\n\n' + code);
                        }}
                    />

                    {/* Marketplace */}
                    <ActionButton
                        icon="🏪"
                        label="Publish"
                        tooltip="Share on Aurais marketplace."
                        onClick={() => setConfirmAction({
                            type: 'pause',
                            title: 'Publish to Marketplace?',
                            message: `Share ${agent.name} publicly. Others can clone (without your data). You earn credits when used.`,
                            confirmLabel: 'Publish',
                            confirmColor: 'var(--accent-purple)',
                            onConfirm: () => {
                                alert('🎉 Published to marketplace.aurais.ai');
                                setConfirmAction(null);
                            },
                        })}
                        variant="success"
                    />
                </div>

                {/* Danger Zone - Actions that remove agent from active use */}
                <div style={{
                    padding: '12px',
                    background: 'rgba(239, 68, 68, 0.05)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                }}>
                    <div style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        marginBottom: '10px',
                        color: 'var(--accent-red)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                    }}>
                        <span>⚠️</span> Danger Zone
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {/* Reversible removal actions */}
                        <ActionButton
                            icon="😴"
                            label="Sleep"
                            tooltip="Low-power mode. Stops working but ready to wake."
                            onClick={() => setConfirmAction({
                                type: 'pause',
                                title: 'Put Agent to Sleep?',
                                message: `${agent.name} will enter low-power sleep mode. Not working, but can be woken instantly.`,
                                confirmLabel: 'Sleep',
                                confirmColor: 'var(--accent-gold)',
                                onConfirm: () => {
                                    alert('😴 Agent is now sleeping. Wake from agent list.');
                                    setConfirmAction(null);
                                },
                            })}
                            variant="warning"
                        />

                        <ActionButton
                            icon="📁"
                            label="Archive"
                            tooltip="Store for later. Can be restored anytime."
                            onClick={() => setConfirmAction({
                                type: 'pause',
                                title: 'Archive Agent?',
                                message: `${agent.name} will be archived. Configuration and history preserved. Restore from Settings > Archived.`,
                                confirmLabel: 'Archive',
                                confirmColor: 'var(--accent-blue)',
                                onConfirm: () => {
                                    alert('📁 Archived! Find in Settings > Archived Agents');
                                    setConfirmAction(null);
                                },
                            })}
                            variant="warning"
                        />

                        <ActionButton
                            icon="🚀"
                            label="Transfer"
                            tooltip="Send to another workspace or organization."
                            onClick={() => setConfirmAction({
                                type: 'pause',
                                title: 'Transfer Agent?',
                                message: `Transfer ${agent.name} to another Aurais workspace. Agent will be removed from this workspace.`,
                                confirmLabel: 'Transfer Out',
                                confirmColor: 'var(--accent-purple)',
                                onConfirm: () => {
                                    const dest = prompt('Enter destination workspace ID or URL:');
                                    if (dest) alert(`🚀 Transferred to ${dest}`);
                                    setConfirmAction(null);
                                },
                            })}
                            variant="warning"
                        />

                        {/* Permanent/destructive actions */}
                        {onTerminate && (
                            <ActionButton
                                icon="🛑"
                                label="Terminate"
                                tooltip="Permanently stop agent. Cannot be undone."
                                onClick={() => setConfirmAction({
                                    type: 'terminate',
                                    title: 'Terminate Agent?',
                                    message: `This will permanently terminate ${agent.name}. This action cannot be undone. The agent will stop all work immediately.`,
                                    confirmLabel: 'Terminate',
                                    confirmColor: 'var(--accent-red)',
                                    requireReason: true,
                                    onConfirm: () => {
                                        onTerminate(agent.id);
                                        setConfirmAction(null);
                                    },
                                })}
                                variant="danger"
                            />
                        )}

                        {onDelete && (
                            <ActionButton
                                icon="🗑️"
                                label="Delete"
                                tooltip="Permanently remove agent."
                                onClick={() => setConfirmAction({
                                    type: 'delete',
                                    title: 'Delete Agent?',
                                    message: `This will permanently delete ${agent.name}. Consider Archive instead if you might need them later.`,
                                    confirmLabel: 'Delete Forever',
                                    confirmColor: 'var(--accent-red)',
                                    onConfirm: () => {
                                        onDelete(agent.id);
                                        setConfirmAction(null);
                                    },
                                })}
                                variant="danger"
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            {confirmAction && (
                <ConfirmModal
                    title={confirmAction.title}
                    message={confirmAction.message}
                    confirmLabel={confirmAction.confirmLabel}
                    confirmColor={confirmAction.confirmColor}
                    onConfirm={confirmAction.onConfirm}
                    onCancel={() => setConfirmAction(null)}
                    requireReason={confirmAction.requireReason}
                />
            )}
        </>
    );
};

export default AgentControlPanel;
