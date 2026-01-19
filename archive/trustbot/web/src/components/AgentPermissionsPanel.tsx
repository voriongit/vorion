import { useState } from 'react';
import type { Agent } from '../types';

/**
 * Agent Permissions Panel
 *
 * Comprehensive permissions management interface:
 * - Capability controls by category
 * - Tool access management
 * - API endpoint permissions
 * - Data access levels
 * - Communication channel controls
 * - Resource limits
 */

interface AgentPermissionsPanelProps {
    agent: Agent;
    onClose: () => void;
    onSavePermissions?: (agentId: string, permissions: AgentPermissions) => void;
}

interface Permission {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    requiresApproval?: boolean;
    tierRequired?: number;
}

interface PermissionCategory {
    id: string;
    name: string;
    icon: string;
    permissions: Permission[];
}

interface AgentPermissions {
    capabilities: string[];
    tools: string[];
    apiEndpoints: string[];
    dataAccess: string[];
    channels: string[];
    resourceLimits: Record<string, number>;
}

// Permission definitions by category
const PERMISSION_CATEGORIES: PermissionCategory[] = [
    {
        id: 'capabilities',
        name: 'Core Capabilities',
        icon: '⚡',
        permissions: [
            { id: 'read_only', name: 'Read Only', description: 'View data without modifications', enabled: true, tierRequired: 0 },
            { id: 'basic_tasks', name: 'Basic Tasks', description: 'Execute simple, predefined tasks', enabled: true, tierRequired: 0 },
            { id: 'session_memory', name: 'Session Memory', description: 'Retain context within session', enabled: false, tierRequired: 1 },
            { id: 'single_task', name: 'Single Task Execution', description: 'Execute one task at a time', enabled: false, tierRequired: 1 },
            { id: 'multi_task', name: 'Multi-Task', description: 'Handle multiple concurrent tasks', enabled: false, tierRequired: 2 },
            { id: 'peer_messaging', name: 'Peer Messaging', description: 'Direct communication with other agents', enabled: false, tierRequired: 2 },
            { id: 'delegation', name: 'Task Delegation', description: 'Assign subtasks to other agents', enabled: false, tierRequired: 3 },
            { id: 'subtask_creation', name: 'Subtask Creation', description: 'Create new subtasks dynamically', enabled: false, tierRequired: 3 },
            { id: 'agent_spawning', name: 'Agent Spawning', description: 'Create new agent instances', enabled: false, tierRequired: 4, requiresApproval: true },
            { id: 'elevated_tools', name: 'Elevated Tools', description: 'Access privileged tool set', enabled: false, tierRequired: 4, requiresApproval: true },
            { id: 'temporal_authority', name: 'Temporal Authority', description: 'Schedule future operations', enabled: false, tierRequired: 5, requiresApproval: true },
            { id: 'full_orchestration', name: 'Full Orchestration', description: 'Complete system orchestration', enabled: false, tierRequired: 5, requiresApproval: true },
        ],
    },
    {
        id: 'tools',
        name: 'Tool Access',
        icon: '🛠️',
        permissions: [
            { id: 'tool_read', name: 'Read Tools', description: 'Use read-only tools (search, query)', enabled: true, tierRequired: 0 },
            { id: 'tool_write', name: 'Write Tools', description: 'Use tools that modify data', enabled: false, tierRequired: 2 },
            { id: 'tool_external', name: 'External APIs', description: 'Call external services', enabled: false, tierRequired: 2, requiresApproval: true },
            { id: 'tool_code_exec', name: 'Code Execution', description: 'Execute generated code', enabled: false, tierRequired: 3, requiresApproval: true },
            { id: 'tool_file_system', name: 'File System', description: 'Read/write file system', enabled: false, tierRequired: 3, requiresApproval: true },
            { id: 'tool_network', name: 'Network Access', description: 'Make network requests', enabled: false, tierRequired: 3 },
            { id: 'tool_database', name: 'Database Access', description: 'Direct database queries', enabled: false, tierRequired: 4, requiresApproval: true },
            { id: 'tool_admin', name: 'Admin Tools', description: 'System administration tools', enabled: false, tierRequired: 5, requiresApproval: true },
        ],
    },
    {
        id: 'data',
        name: 'Data Access',
        icon: '📊',
        permissions: [
            { id: 'data_public', name: 'Public Data', description: 'Access public information', enabled: true, tierRequired: 0 },
            { id: 'data_agent_own', name: 'Own Agent Data', description: 'Access own metrics and history', enabled: true, tierRequired: 0 },
            { id: 'data_agent_peers', name: 'Peer Agent Data', description: 'View other agent summaries', enabled: false, tierRequired: 2 },
            { id: 'data_tasks', name: 'Task Data', description: 'Full task queue access', enabled: false, tierRequired: 2 },
            { id: 'data_user_basic', name: 'User Basic Info', description: 'View user names and roles', enabled: false, tierRequired: 3 },
            { id: 'data_user_full', name: 'User Full Profile', description: 'Complete user information', enabled: false, tierRequired: 4, requiresApproval: true },
            { id: 'data_audit_logs', name: 'Audit Logs', description: 'System audit trail access', enabled: false, tierRequired: 4, requiresApproval: true },
            { id: 'data_sensitive', name: 'Sensitive Data', description: 'Access sensitive/PII data', enabled: false, tierRequired: 5, requiresApproval: true },
        ],
    },
    {
        id: 'communication',
        name: 'Communication',
        icon: '💬',
        permissions: [
            { id: 'comm_receive', name: 'Receive Messages', description: 'Receive inbound messages', enabled: true, tierRequired: 0 },
            { id: 'comm_respond', name: 'Respond to HITL', description: 'Reply to human operators', enabled: true, tierRequired: 0 },
            { id: 'comm_peer_read', name: 'Read Peer Messages', description: 'View agent-to-agent chat', enabled: false, tierRequired: 1 },
            { id: 'comm_peer_write', name: 'Send to Peers', description: 'Message other agents', enabled: false, tierRequired: 2 },
            { id: 'comm_broadcast', name: 'Broadcast', description: 'Send to multiple recipients', enabled: false, tierRequired: 3 },
            { id: 'comm_private', name: 'Private Channels', description: 'Create private conversations', enabled: false, tierRequired: 4 },
            { id: 'comm_external', name: 'External Notify', description: 'Send external notifications', enabled: false, tierRequired: 4, requiresApproval: true },
            { id: 'comm_system', name: 'System Announcements', description: 'System-wide broadcasts', enabled: false, tierRequired: 5, requiresApproval: true },
        ],
    },
];

// Resource limit definitions
const RESOURCE_LIMITS = [
    { id: 'max_concurrent_tasks', name: 'Max Concurrent Tasks', min: 1, max: 50, default: 5 },
    { id: 'max_api_calls_hour', name: 'API Calls/Hour', min: 10, max: 10000, default: 100 },
    { id: 'max_memory_mb', name: 'Memory (MB)', min: 128, max: 8192, default: 512 },
    { id: 'max_execution_time_sec', name: 'Max Execution Time (s)', min: 30, max: 3600, default: 300 },
    { id: 'max_spawned_agents', name: 'Spawned Agent Limit', min: 0, max: 20, default: 0 },
    { id: 'max_daily_tokens', name: 'Daily Token Budget', min: 1000, max: 1000000, default: 50000 },
];

const TIER_COLORS = ['#6b7280', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#fbbf24'];

export function AgentPermissionsPanel({
    agent,
    onClose,
    onSavePermissions,
}: AgentPermissionsPanelProps) {
    const [activeCategory, setActiveCategory] = useState('capabilities');
    const [permissions, setPermissions] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        PERMISSION_CATEGORIES.forEach(cat => {
            cat.permissions.forEach(perm => {
                // Enable by default if tier requirement is met
                initial[perm.id] = perm.tierRequired !== undefined && agent.tier >= perm.tierRequired;
            });
        });
        return initial;
    });
    const [resourceLimits, setResourceLimits] = useState<Record<string, number>>(() => {
        const initial: Record<string, number> = {};
        RESOURCE_LIMITS.forEach(limit => {
            // Scale default by tier
            initial[limit.id] = Math.min(limit.max, limit.default * (1 + agent.tier * 0.5));
        });
        return initial;
    });
    const [pendingApprovals, setPendingApprovals] = useState<string[]>([]);
    const [hasChanges, setHasChanges] = useState(false);

    const togglePermission = (permId: string, perm: Permission) => {
        const newValue = !permissions[permId];

        // Check if this requires approval
        if (newValue && perm.requiresApproval && !pendingApprovals.includes(permId)) {
            setPendingApprovals(prev => [...prev, permId]);
        }

        setPermissions(prev => ({ ...prev, [permId]: newValue }));
        setHasChanges(true);
    };

    const updateResourceLimit = (limitId: string, value: number) => {
        setResourceLimits(prev => ({ ...prev, [limitId]: value }));
        setHasChanges(true);
    };

    const handleSave = () => {
        const enabled: AgentPermissions = {
            capabilities: [],
            tools: [],
            apiEndpoints: [],
            dataAccess: [],
            channels: [],
            resourceLimits,
        };

        PERMISSION_CATEGORIES.forEach(cat => {
            cat.permissions.forEach(perm => {
                if (permissions[perm.id]) {
                    if (cat.id === 'capabilities') enabled.capabilities.push(perm.id);
                    else if (cat.id === 'tools') enabled.tools.push(perm.id);
                    else if (cat.id === 'data') enabled.dataAccess.push(perm.id);
                    else if (cat.id === 'communication') enabled.channels.push(perm.id);
                }
            });
        });

        onSavePermissions?.(agent.id, enabled);
        setHasChanges(false);
        onClose();
    };

    const currentCategory = PERMISSION_CATEGORIES.find(c => c.id === activeCategory)!;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            >
                {/* Header */}
                <div className="modal-header" style={{ borderBottom: 'none', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.5rem' }}>🔐</span>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Permissions Manager</h2>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Configure access controls for {agent.name}
                            </p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                {/* Agent Info */}
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
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: TIER_COLORS[agent.tier],
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem',
                        color: 'white',
                        fontWeight: 700,
                    }}>
                        T{agent.tier}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{agent.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {agent.structuredId || agent.id.slice(0, 8)} • Trust: {agent.trustScore}
                        </div>
                    </div>
                    {pendingApprovals.length > 0 && (
                        <div style={{
                            padding: '4px 10px',
                            background: 'rgba(245, 158, 11, 0.15)',
                            border: '1px solid var(--accent-gold)',
                            borderRadius: '6px',
                            fontSize: '0.7rem',
                            color: 'var(--accent-gold)',
                        }}>
                            ⏳ {pendingApprovals.length} pending approval
                        </div>
                    )}
                </div>

                {/* Main Content */}
                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* Sidebar */}
                    <div style={{
                        width: '200px',
                        background: 'var(--bg-tertiary)',
                        borderRight: '1px solid var(--border-color)',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        flexShrink: 0,
                    }}>
                        {PERMISSION_CATEGORIES.map(cat => {
                            const enabledCount = cat.permissions.filter(p => permissions[p.id]).length;
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategory(cat.id)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '10px 12px',
                                        background: activeCategory === cat.id ? 'var(--accent-blue)' : 'transparent',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: activeCategory === cat.id ? 'white' : 'var(--text-secondary)',
                                        fontSize: '0.8rem',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                    }}
                                >
                                    <span style={{ fontSize: '1rem' }}>{cat.icon}</span>
                                    <span style={{ flex: 1 }}>{cat.name}</span>
                                    <span style={{
                                        padding: '2px 6px',
                                        background: activeCategory === cat.id ? 'rgba(255,255,255,0.2)' : 'var(--bg-secondary)',
                                        borderRadius: '4px',
                                        fontSize: '0.65rem',
                                    }}>
                                        {enabledCount}/{cat.permissions.length}
                                    </span>
                                </button>
                            );
                        })}

                        {/* Resource Limits */}
                        <button
                            onClick={() => setActiveCategory('resources')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '10px 12px',
                                background: activeCategory === 'resources' ? 'var(--accent-blue)' : 'transparent',
                                border: 'none',
                                borderRadius: '8px',
                                color: activeCategory === 'resources' ? 'white' : 'var(--text-secondary)',
                                fontSize: '0.8rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                                textAlign: 'left',
                                marginTop: '8px',
                                borderTop: '1px solid var(--border-color)',
                                paddingTop: '18px',
                            }}
                        >
                            <span style={{ fontSize: '1rem' }}>📏</span>
                            <span style={{ flex: 1 }}>Resource Limits</span>
                        </button>
                    </div>

                    {/* Content Area */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                        {activeCategory !== 'resources' ? (
                            <>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    marginBottom: '16px',
                                }}>
                                    <span style={{ fontSize: '1.25rem' }}>{currentCategory.icon}</span>
                                    <h3 style={{ margin: 0, fontSize: '1rem' }}>{currentCategory.name}</h3>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {currentCategory.permissions.map(perm => {
                                        const isEnabled = permissions[perm.id];
                                        const meetsRequirement = perm.tierRequired === undefined || agent.tier >= perm.tierRequired;
                                        const isPending = pendingApprovals.includes(perm.id);

                                        return (
                                            <div
                                                key={perm.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    padding: '12px',
                                                    background: isEnabled ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-secondary)',
                                                    border: `1px solid ${isEnabled ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)'}`,
                                                    borderRadius: '8px',
                                                    opacity: meetsRequirement ? 1 : 0.5,
                                                }}
                                            >
                                                {/* Toggle */}
                                                <button
                                                    onClick={() => meetsRequirement && togglePermission(perm.id, perm)}
                                                    disabled={!meetsRequirement}
                                                    style={{
                                                        width: '44px',
                                                        height: '24px',
                                                        borderRadius: '12px',
                                                        background: isEnabled ? 'var(--accent-green)' : 'var(--bg-tertiary)',
                                                        border: `1px solid ${isEnabled ? 'var(--accent-green)' : 'var(--border-color)'}`,
                                                        padding: '2px',
                                                        cursor: meetsRequirement ? 'pointer' : 'not-allowed',
                                                        transition: 'all 0.2s ease',
                                                        position: 'relative',
                                                    }}
                                                >
                                                    <div style={{
                                                        width: '18px',
                                                        height: '18px',
                                                        borderRadius: '50%',
                                                        background: 'white',
                                                        transform: isEnabled ? 'translateX(20px)' : 'translateX(0)',
                                                        transition: 'transform 0.2s ease',
                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                                    }} />
                                                </button>

                                                {/* Info */}
                                                <div style={{ flex: 1 }}>
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        marginBottom: '2px',
                                                    }}>
                                                        <span style={{
                                                            fontWeight: 600,
                                                            fontSize: '0.85rem',
                                                            color: isEnabled ? 'var(--accent-green)' : 'var(--text-primary)',
                                                        }}>
                                                            {perm.name}
                                                        </span>
                                                        {perm.tierRequired !== undefined && (
                                                            <span style={{
                                                                padding: '1px 6px',
                                                                background: TIER_COLORS[perm.tierRequired],
                                                                borderRadius: '4px',
                                                                fontSize: '0.6rem',
                                                                color: 'white',
                                                                fontWeight: 600,
                                                            }}>
                                                                T{perm.tierRequired}+
                                                            </span>
                                                        )}
                                                        {perm.requiresApproval && (
                                                            <span style={{
                                                                padding: '1px 6px',
                                                                background: 'var(--accent-gold)',
                                                                borderRadius: '4px',
                                                                fontSize: '0.6rem',
                                                                color: 'white',
                                                                fontWeight: 600,
                                                            }}>
                                                                Approval
                                                            </span>
                                                        )}
                                                        {isPending && (
                                                            <span style={{
                                                                padding: '1px 6px',
                                                                background: 'rgba(245, 158, 11, 0.2)',
                                                                border: '1px solid var(--accent-gold)',
                                                                borderRadius: '4px',
                                                                fontSize: '0.6rem',
                                                                color: 'var(--accent-gold)',
                                                            }}>
                                                                ⏳ Pending
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{
                                                        fontSize: '0.75rem',
                                                        color: 'var(--text-muted)',
                                                    }}>
                                                        {perm.description}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    marginBottom: '16px',
                                }}>
                                    <span style={{ fontSize: '1.25rem' }}>📏</span>
                                    <h3 style={{ margin: 0, fontSize: '1rem' }}>Resource Limits</h3>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {RESOURCE_LIMITS.map(limit => {
                                        const value = resourceLimits[limit.id];
                                        const percentage = ((value - limit.min) / (limit.max - limit.min)) * 100;

                                        return (
                                            <div key={limit.id} style={{
                                                padding: '16px',
                                                background: 'var(--bg-secondary)',
                                                borderRadius: '8px',
                                                border: '1px solid var(--border-color)',
                                            }}>
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    marginBottom: '8px',
                                                }}>
                                                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                                        {limit.name}
                                                    </span>
                                                    <span style={{
                                                        fontWeight: 700,
                                                        fontSize: '0.9rem',
                                                        color: 'var(--accent-blue)',
                                                    }}>
                                                        {Math.round(value).toLocaleString()}
                                                    </span>
                                                </div>

                                                {/* Slider */}
                                                <div style={{ position: 'relative', marginBottom: '8px' }}>
                                                    <input
                                                        type="range"
                                                        min={limit.min}
                                                        max={limit.max}
                                                        value={value}
                                                        onChange={e => updateResourceLimit(limit.id, Number(e.target.value))}
                                                        style={{
                                                            width: '100%',
                                                            height: '8px',
                                                            borderRadius: '4px',
                                                            background: `linear-gradient(to right, var(--accent-blue) ${percentage}%, var(--bg-tertiary) ${percentage}%)`,
                                                            appearance: 'none',
                                                            cursor: 'pointer',
                                                        }}
                                                    />
                                                </div>

                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    fontSize: '0.7rem',
                                                    color: 'var(--text-muted)',
                                                }}>
                                                    <span>{limit.min.toLocaleString()}</span>
                                                    <span>Default: {limit.default.toLocaleString()}</span>
                                                    <span>{limit.max.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 20px',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    gap: '12px',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexShrink: 0,
                }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {hasChanges && (
                            <span style={{ color: 'var(--accent-gold)' }}>
                                ⚠️ Unsaved changes
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '10px 20px',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!hasChanges}
                            style={{
                                padding: '10px 20px',
                                background: hasChanges ? 'var(--accent-green)' : 'var(--bg-tertiary)',
                                border: 'none',
                                borderRadius: '8px',
                                color: hasChanges ? 'white' : 'var(--text-muted)',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: hasChanges ? 'pointer' : 'not-allowed',
                            }}
                        >
                            {pendingApprovals.length > 0 ? 'Submit for Approval' : 'Save Permissions'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AgentPermissionsPanel;
