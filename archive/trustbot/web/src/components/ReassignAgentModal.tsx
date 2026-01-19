/**
 * ReassignAgentModal - Reassign agent to different role/task/location
 */
import React, { useState } from 'react';
import type { Agent, AgentType } from '../types';

interface ReassignAgentModalProps {
    agent: Agent;
    allAgents: Agent[];
    onClose: () => void;
    onReassign: (agentId: string, updates: {
        type?: string;
        parentAgentId?: string;
        location?: string;
    }) => void;
}

const AGENT_TYPES: Array<{ value: AgentType; label: string; description: string }> = [
    { value: 'EXECUTOR', label: 'Executor', description: 'Handles task execution' },
    { value: 'PLANNER', label: 'Planner', description: 'Strategic planning and coordination' },
    { value: 'VALIDATOR', label: 'Validator', description: 'Reviews and validates work' },
    { value: 'SPECIALIST', label: 'Specialist', description: 'Domain-specific expertise' },
    { value: 'ORCHESTRATOR', label: 'Orchestrator', description: 'Manages other agents' },
    { value: 'WORKER', label: 'Worker', description: 'General task processing' },
];

const LOCATIONS = [
    { value: 'HQ', label: 'Headquarters', description: 'Central operations' },
    { value: 'FRONTEND', label: 'Frontend', description: 'UI/UX development' },
    { value: 'BACKEND', label: 'Backend', description: 'Server-side development' },
    { value: 'DATA', label: 'Data', description: 'Data processing and analysis' },
    { value: 'INFRA', label: 'Infrastructure', description: 'DevOps and infrastructure' },
    { value: 'QA', label: 'Quality Assurance', description: 'Testing and validation' },
];

export const ReassignAgentModal: React.FC<ReassignAgentModalProps> = ({
    agent,
    allAgents,
    onClose,
    onReassign,
}) => {
    const [newType, setNewType] = useState<AgentType>(agent.type);
    const [newParentId, setNewParentId] = useState(agent.parentId || '');
    const [newLocation, setNewLocation] = useState('HQ');
    const [reason, setReason] = useState('');

    // Get potential parent agents (higher tier than current)
    const potentialParents = allAgents.filter(a => a.id !== agent.id && a.tier > agent.tier);

    const hasChanges = newType !== agent.type || newParentId !== (agent.parentId || '') || newLocation !== 'HQ';

    const handleSubmit = () => {
        const updates: { type?: string; parentId?: string; location?: string } = {};
        if (newType !== agent.type) updates.type = newType;
        if (newParentId !== (agent.parentId || '')) updates.parentId = newParentId || undefined;
        if (newLocation !== 'HQ') updates.location = newLocation;

        onReassign(agent.id, updates);
        onClose();
    };

    return (
        <div
            className="modal-backdrop"
            onClick={onClose}
        >
            <div
                className="modal-content"
                style={{
                    maxWidth: '500px',
                    width: '90%',
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '20px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.5rem' }}>🔄</span>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Reassign Agent</h2>
                            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                {agent.name}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="modal-close-btn">✕</button>
                </div>

                {/* Current assignment */}
                <div style={{
                    padding: '12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '20px',
                }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>CURRENT ASSIGNMENT</div>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Type:</span>
                            <span style={{ marginLeft: '6px', fontWeight: 500 }}>{agent.type}</span>
                        </div>
                        <div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tier:</span>
                            <span style={{ marginLeft: '6px', fontWeight: 500 }}>T{agent.tier}</span>
                        </div>
                        <div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Trust:</span>
                            <span style={{ marginLeft: '6px', fontWeight: 500 }}>{agent.trustScore}</span>
                        </div>
                    </div>
                </div>

                {/* New Type */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', fontWeight: 500 }}>
                        Agent Type
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                        {AGENT_TYPES.map(type => (
                            <button
                                key={type.value}
                                onClick={() => setNewType(type.value)}
                                style={{
                                    padding: '10px 12px',
                                    background: newType === type.value ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                                    border: `1px solid ${newType === type.value ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                                    borderRadius: 'var(--radius-md)',
                                    color: newType === type.value ? 'white' : 'var(--text-primary)',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                }}
                            >
                                <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{type.label}</div>
                                <div style={{
                                    fontSize: '0.7rem',
                                    color: newType === type.value ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)',
                                    marginTop: '2px',
                                }}>
                                    {type.description}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Report to (Parent Agent) */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', fontWeight: 500 }}>
                        Reports To
                    </label>
                    <select
                        value={newParentId}
                        onChange={e => setNewParentId(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--text-primary)',
                            fontSize: '0.9rem',
                        }}
                    >
                        <option value="">No supervisor (self-directed)</option>
                        {potentialParents.map(parent => (
                            <option key={parent.id} value={parent.id}>
                                {parent.name} (T{parent.tier} {parent.type})
                            </option>
                        ))}
                    </select>
                </div>

                {/* Location */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', fontWeight: 500 }}>
                        Assignment Location
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {LOCATIONS.map(loc => (
                            <button
                                key={loc.value}
                                onClick={() => setNewLocation(loc.value)}
                                style={{
                                    padding: '8px 14px',
                                    background: newLocation === loc.value ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                                    border: `1px solid ${newLocation === loc.value ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                                    borderRadius: 'var(--radius-sm)',
                                    color: newLocation === loc.value ? 'white' : 'var(--text-primary)',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                }}
                            >
                                {loc.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Reason */}
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', fontWeight: 500 }}>
                        Reason for Reassignment (optional)
                    </label>
                    <textarea
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder="e.g., Better fit for current project needs..."
                        rows={2}
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--text-primary)',
                            fontSize: '0.9rem',
                            resize: 'none',
                        }}
                    />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 16px',
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
                        onClick={handleSubmit}
                        disabled={!hasChanges}
                        style={{
                            padding: '10px 20px',
                            background: hasChanges ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            color: hasChanges ? 'white' : 'var(--text-muted)',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: hasChanges ? 'pointer' : 'not-allowed',
                        }}
                    >
                        🔄 Reassign Agent
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReassignAgentModal;
